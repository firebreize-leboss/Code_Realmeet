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
 * Fonction principale de formation des groupes
 * Utilise une fonction SQL pour garantir la cohérence des données
 */
export async function formIntelligentGroups(
  slotId: string,
  activityId: string
): Promise<GroupFormationResult> {
  try {
    console.log(`Formation des groupes pour le créneau ${slotId}`);
    
    // Appeler la fonction SQL qui fait tout en une transaction
    const { data, error } = await supabase.rpc('form_slot_groups', {
      p_slot_id: slotId
    });

    if (error) {
      console.error('Erreur RPC form_slot_groups:', error);
      throw error;
    }

    console.log('Résultat formation groupes:', data);

    if (!data.success) {
      throw new Error(data.error || 'Erreur formation groupes');
    }

    // Retourner un résultat simplifié
    return {
      groups: [],
      stats: {
        totalParticipants: data.participants || 0,
        groupsFormed: data.groups_created || 0,
        avgGroupSize: data.participants || 0,
      },
    };
  } catch (error) {
    console.error('Erreur formation groupes intelligents:', error);
    throw error;
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

    if (error || !slot) {
      console.log('Erreur ou slot non trouvé:', error);
      return false;
    }

    // Si déjà formés, ne pas reformer
    if (slot.groups_formed) {
      console.log(`Slot ${slotId}: groupes déjà formés`);
      return false;
    }

    // Calculer la date/heure du créneau
    const slotDateTime = new Date(`${slot.date}T${slot.time || '00:00'}`);

    // Calculer J-1 à la même heure
    const oneDayBefore = new Date(slotDateTime.getTime() - 24 * 60 * 60 * 1000);
    const now = new Date();

    console.log(`Slot ${slotId}: date=${slotDateTime.toISOString()}, J-1=${oneDayBefore.toISOString()}, now=${now.toISOString()}`);

    // Vérifier si on est passé J-1
    const shouldForm = now >= oneDayBefore && now < slotDateTime;
    console.log(`Slot ${slotId}: shouldForm=${shouldForm}`);
    
    return shouldForm;
  } catch (error) {
    console.error('Erreur vérification formation groupes:', error);
    return false;
  }
}

/**
 * Vérifie et forme les groupes pour un créneau si c'est le moment (J-1)
 */
export async function checkAndFormGroupsIfNeeded(
  slotId: string, 
  activityId: string
): Promise<boolean> {
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

/**
 * Force la formation des groupes (pour les tests ou l'admin)
 */
export async function forceFormGroups(slotId: string): Promise<boolean> {
  try {
    // Réinitialiser d'abord le flag groups_formed
    await supabase
      .from('activity_slots')
      .update({ groups_formed: false, groups_formed_at: null })
      .eq('id', slotId);

    // Récupérer l'activity_id
    const { data: slot } = await supabase
      .from('activity_slots')
      .select('activity_id')
      .eq('id', slotId)
      .single();

    if (!slot?.activity_id) {
      throw new Error('Créneau non trouvé');
    }

    // Former les groupes
    await formIntelligentGroups(slotId, slot.activity_id);
    return true;
  } catch (error) {
    console.error('Erreur forceFormGroups:', error);
    return false;
  }
}

export const intelligentGroupsService = {
  formIntelligentGroups,
  shouldFormGroups,
  checkAndFormGroupsIfNeeded,
  forceFormGroups,
};