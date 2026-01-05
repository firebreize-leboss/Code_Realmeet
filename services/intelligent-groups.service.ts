// services/intelligent-groups.service.ts
// Service de formation intelligente de groupes basé sur les affinités

import { supabase } from '@/lib/supabase';

interface ParticipantProfile {
  id: string;
  full_name: string;
  personality_tags: string[];
  interests: string[];
  avatar_url: string;
}

interface GroupFormationResult {
  groups: Array<{
    groupNumber: number;
    members: ParticipantProfile[];
    avgCompatibility: number;
  }>;
  stats: {
    totalParticipants: number;
    groupsFormed: number;
    avgGroupSize: number;
  };
}

/**
 * Calcule le score de compatibilité entre deux participants
 * Basé sur les tags de personnalité et centres d'intérêt communs
 */
function calculateCompatibility(p1: ParticipantProfile, p2: ParticipantProfile): number {
  let score = 0;

  // Comparer les tags de personnalité (poids: 60%)
  const personalityMatches = p1.personality_tags?.filter(tag =>
    p2.personality_tags?.includes(tag)
  )?.length || 0;
  const personalityScore = personalityMatches * 15; // Chaque tag commun = 15 points

  // Comparer les centres d'intérêt (poids: 40%)
  const interestMatches = p1.interests?.filter(interest =>
    p2.interests?.includes(interest)
  )?.length || 0;
  const interestScore = interestMatches * 10; // Chaque intérêt commun = 10 points

  score = personalityScore + interestScore;

  // Normaliser le score sur 100
  return Math.min(score, 100);
}

/**
 * Calcule le score moyen de compatibilité d'un participant avec un groupe
 */
function calculateGroupCompatibility(
  participant: ParticipantProfile,
  group: ParticipantProfile[]
): number {
  if (group.length === 0) return 0;

  const totalScore = group.reduce((sum, member) => {
    return sum + calculateCompatibility(participant, member);
  }, 0);

  return totalScore / group.length;
}

/**
 * Distribue les participants de manière optimale dans les groupes
 * en maximisant les affinités et le remplissage
 */
function distributeParticipants(
  participants: ParticipantProfile[],
  maxGroups: number,
  participantsPerGroup: number | null
): ParticipantProfile[][] {
  const totalParticipants = participants.length;

  // Cas 1: Un seul groupe ou assez de participants pour remplir
  if (maxGroups === 1) {
    return [participants];
  }

  // Cas 2: Pas assez de participants pour former plusieurs groupes (< 5)
  if (totalParticipants < 5) {
    return [participants];
  }

  // Calculer la taille idéale des groupes
  const idealGroupSize = participantsPerGroup || Math.ceil(totalParticipants / maxGroups);

  // Déterminer combien de groupes on va réellement former
  const actualGroupCount = Math.min(
    maxGroups,
    Math.ceil(totalParticipants / Math.max(idealGroupSize, 3)) // Minimum 3 par groupe
  );

  // Calculer la distribution optimale
  const baseSize = Math.floor(totalParticipants / actualGroupCount);
  const remainder = totalParticipants % actualGroupCount;

  // Créer les groupes vides
  const groups: ParticipantProfile[][] = Array.from(
    { length: actualGroupCount },
    () => []
  );

  // Copie des participants pour manipulation
  const remainingParticipants = [...participants];

  // Étape 1: Choisir un participant aléatoire comme "seed" pour chaque groupe
  for (let i = 0; i < actualGroupCount; i++) {
    const randomIndex = Math.floor(Math.random() * remainingParticipants.length);
    const seed = remainingParticipants.splice(randomIndex, 1)[0];
    groups[i].push(seed);
  }

  // Étape 2: Distribuer les participants restants par affinité
  while (remainingParticipants.length > 0) {
    const participant = remainingParticipants.shift()!;

    // Trouver le groupe avec lequel ce participant a la meilleure compatibilité
    // tout en respectant les contraintes de taille
    let bestGroupIndex = 0;
    let bestScore = -1;

    for (let i = 0; i < groups.length; i++) {
      // Ne pas dépasser la taille max du groupe
      const maxSize = baseSize + (i < remainder ? 1 : 0);
      if (groups[i].length >= maxSize) continue;

      const score = calculateGroupCompatibility(participant, groups[i]);
      if (score > bestScore) {
        bestScore = score;
        bestGroupIndex = i;
      }
    }

    groups[bestGroupIndex].push(participant);
  }

  return groups;
}

/**
 * Fonction principale de formation des groupes
 */
export async function formIntelligentGroups(
  slotId: string,
  activityId: string
): Promise<GroupFormationResult> {
  try {
    // 1. Récupérer les informations du créneau
    const { data: slotData, error: slotError } = await supabase
      .from('activity_slots')
      .select('max_groups, participants_per_group')
      .eq('id', slotId)
      .single();

    if (slotError) throw slotError;

    const maxGroups = slotData.max_groups || 1;
    const participantsPerGroup = slotData.participants_per_group;

    // 2. Récupérer tous les participants du créneau avec leurs profils
    const { data: participants, error: participantsError } = await supabase
      .from('slot_participants')
      .select(`
        user_id,
        profiles:user_id (
          id,
          full_name,
          personality_tags,
          interests,
          avatar_url
        )
      `)
      .eq('slot_id', slotId);

    if (participantsError) throw participantsError;

    // Transformer les données
    const participantProfiles: ParticipantProfile[] = participants
      .map((p: any) => ({
        id: p.profiles.id,
        full_name: p.profiles.full_name || 'Participant',
        personality_tags: p.profiles.personality_tags || [],
        interests: p.profiles.interests || [],
        avatar_url: p.profiles.avatar_url || '',
      }))
      .filter((p: ParticipantProfile) => p.id); // Filtrer les profils invalides

    // 3. Former les groupes de manière intelligente
    const distributedGroups = distributeParticipants(
      participantProfiles,
      maxGroups,
      participantsPerGroup
    );

    // 4. Nettoyer les anciens groupes
    await supabase.rpc('cleanup_slot_groups', { p_slot_id: slotId });

    // 5. Créer les nouveaux groupes dans la base de données
    const groupsToInsert = distributedGroups.map((group, index) => ({
      slot_id: slotId,
      activity_id: activityId,
      group_number: index + 1,
      group_name: `Groupe ${index + 1}`,
    }));

    const { data: createdGroups, error: groupsError } = await supabase
      .from('slot_groups')
      .insert(groupsToInsert)
      .select();

    if (groupsError) throw groupsError;

    // 6. Assigner les membres aux groupes
    const membersToInsert: any[] = [];

    distributedGroups.forEach((group, groupIndex) => {
      const groupId = createdGroups[groupIndex].id;

      group.forEach((member) => {
        // Calculer le score de compatibilité moyen avec le groupe
        const otherMembers = group.filter((m) => m.id !== member.id);
        const compatibilityScore = calculateGroupCompatibility(member, otherMembers);

        membersToInsert.push({
          group_id: groupId,
          user_id: member.id,
          compatibility_score: compatibilityScore,
        });
      });
    });

    await supabase.from('slot_group_members').insert(membersToInsert);

    // 7. Marquer le créneau comme ayant des groupes formés
    await supabase
      .from('activity_slots')
      .update({
        groups_formed: true,
        groups_formed_at: new Date().toISOString(),
      })
      .eq('id', slotId);

    // 8. Créer les conversations de groupe
    await createGroupConversations(createdGroups, activityId);

    // 9. Préparer le résultat
    const result: GroupFormationResult = {
      groups: distributedGroups.map((group, index) => ({
        groupNumber: index + 1,
        members: group,
        avgCompatibility:
          group.reduce((sum, member) => {
            const others = group.filter((m) => m.id !== member.id);
            return sum + calculateGroupCompatibility(member, others);
          }, 0) / group.length,
      })),
      stats: {
        totalParticipants: participantProfiles.length,
        groupsFormed: distributedGroups.length,
        avgGroupSize:
          participantProfiles.length / distributedGroups.length,
      },
    };

    return result;
  } catch (error) {
    console.error('Erreur formation groupes intelligents:', error);
    throw error;
  }
}

/**
 * Créer les conversations de groupe pour chaque groupe formé
 */
async function createGroupConversations(
  groups: any[],
  activityId: string
): Promise<void> {
  try {
    // Récupérer les infos de l'activité
    const { data: activity } = await supabase
      .from('activities')
      .select('nom, image_url')
      .eq('id', activityId)
      .single();

    for (const group of groups) {
      // Créer la conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          slot_id: group.slot_id,
          name: `${activity?.nom || 'Activité'} - ${group.group_name}`,
          image_url: activity?.image_url || '',
          is_group: true,
        })
        .select()
        .single();

      if (convError) {
        console.error('Erreur création conversation:', convError);
        continue;
      }

      // Récupérer les membres du groupe
      const { data: members } = await supabase
        .from('slot_group_members')
        .select('user_id')
        .eq('group_id', group.id);

      if (!members || members.length === 0) continue;

      // Ajouter les participants à la conversation
      const participantsToInsert = members.map((m: any) => ({
        conversation_id: conversation.id,
        user_id: m.user_id,
      }));

      await supabase
        .from('conversation_participants')
        .insert(participantsToInsert);

      // Mettre à jour le groupe avec l'ID de la conversation
      await supabase
        .from('slot_groups')
        .update({ conversation_id: conversation.id })
        .eq('id', group.id);

      // Message système de création
      await supabase.from('messages').insert({
        conversation_id: conversation.id,
        sender_id: members[0].user_id, // Utiliser le premier membre comme expéditeur système
        content: `Groupe créé avec ${members.length} participant${
          members.length > 1 ? 's' : ''
        }. Bonne activité ! 🎉`,
        message_type: 'system',
      });
    }
  } catch (error) {
    console.error('Erreur création conversations de groupe:', error);
  }
}

/**
 * Vérifier si un créneau doit former ses groupes (J-1)
 */
export async function shouldFormGroups(slotId: string): Promise<boolean> {
  try {
    const { data: slot, error } = await supabase
      .from('activity_slots')
      .select('date, time, groups_formed')
      .eq('id', slotId)
      .single();

    if (error || !slot) return false;

    // Si déjà formés, ne pas reformer
    if (slot.groups_formed) return false;

    // Calculer la date/heure du créneau
    const slotDateTime = new Date(`${slot.date}T${slot.time || '00:00'}`);

    // Calculer J-1 à la même heure
    const oneDayBefore = new Date(slotDateTime.getTime() - 24 * 60 * 60 * 1000);
    const now = new Date();

    // Vérifier si on est passé J-1
    return now >= oneDayBefore && now < slotDateTime;
  } catch (error) {
    console.error('Erreur vérification formation groupes:', error);
    return false;
  }
}

/**
 * Vérifie et forme les groupes pour un créneau si c'est le moment (J-1)
 */
export async function checkAndFormGroupsIfNeeded(slotId: string, activityId: string): Promise<boolean> {
  try {
    const shouldForm = await shouldFormGroups(slotId);
    
    if (shouldForm) {
      console.log(`Formation automatique des groupes pour le créneau ${slotId}`);
      await formIntelligentGroups(slotId, activityId);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Erreur checkAndFormGroupsIfNeeded:', error);
    return false;
  }
}

export const intelligentGroupsService = {
  formIntelligentGroups,
  shouldFormGroups,
  checkAndFormGroupsIfNeeded,
};
