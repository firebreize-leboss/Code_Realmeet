// services/groups.service.ts
// Service pour la composition intelligente des groupes

import { supabase } from '@/lib/supabase';
import { UserIntention } from '@/lib/database.types';

interface ParticipantWithProfile {
  user_id: string;
  intention: UserIntention;
  personality_tags: string[];
}

interface GroupAssignment {
  user_id: string;
  group_index: number;
}

interface AssignGroupsResult {
  success: boolean;
  groups?: { [key: number]: ParticipantWithProfile[] };
  error?: string;
  totalGroups?: number;
}

class GroupsService {
  /**
   * Génère des groupes équilibrés pour un créneau
   * Utilise un algorithme round-robin stratifié par intention et personality_tags
   */
  async assignGroups(slotId: string, groupSize: number = 5): Promise<AssignGroupsResult> {
    try {
      // 1. Vérifier que l'utilisateur actuel est le host
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        return { success: false, error: 'Non authentifié' };
      }

      const isHost = await this.verifyHost(slotId, userData.user.id);
      if (!isHost) {
        return { success: false, error: 'Seul l\'hôte peut composer les groupes' };
      }

      // 2. Récupérer tous les participants du slot avec leurs profils
      const { data: participants, error: partError } = await supabase
        .from('slot_participants')
        .select(`
          user_id,
          profiles:user_id (
            intention,
            personality_tags
          )
        `)
        .eq('slot_id', slotId);

      if (partError) throw partError;

      if (!participants || participants.length === 0) {
        return { success: false, error: 'Aucun participant à répartir' };
      }

      // 3. Transformer les données
      const participantsWithProfile: ParticipantWithProfile[] = participants.map((p: any) => ({
        user_id: p.user_id,
        intention: p.profiles?.intention || null,
        personality_tags: p.profiles?.personality_tags || [],
      }));

      // 4. Calculer le nombre de groupes nécessaires
      const numGroups = Math.max(1, Math.ceil(participantsWithProfile.length / groupSize));

      // 5. Appliquer l'algorithme de répartition stratifiée
      const groupAssignments = this.stratifiedRoundRobin(participantsWithProfile, numGroups);

      // 6. Purger les anciens groupes pour ce slot
      const { error: deleteError } = await supabase
        .from('slot_groups')
        .delete()
        .eq('slot_id', slotId);

      if (deleteError) throw deleteError;

      // 7. Insérer les nouvelles attributions
      const insertData = groupAssignments.map(assignment => ({
        slot_id: slotId,
        user_id: assignment.user_id,
        group_index: assignment.group_index,
      }));

      const { error: insertError } = await supabase
        .from('slot_groups')
        .insert(insertData);

      if (insertError) throw insertError;

      // 8. Construire la réponse avec les groupes
      const groupedResult: { [key: number]: ParticipantWithProfile[] } = {};
      for (let i = 1; i <= numGroups; i++) {
        groupedResult[i] = [];
      }
      
      groupAssignments.forEach(assignment => {
        const participant = participantsWithProfile.find(p => p.user_id === assignment.user_id);
        if (participant) {
          groupedResult[assignment.group_index].push(participant);
        }
      });

      return {
        success: true,
        groups: groupedResult,
        totalGroups: numGroups,
      };
    } catch (error: any) {
      console.error('Erreur assignGroups:', error);
      return { success: false, error: error.message || 'Erreur lors de la composition' };
    }
  }

  /**
   * Récupère les groupes existants pour un créneau
   */
  async getGroups(slotId: string): Promise<{
    success: boolean;
    groups?: { [key: number]: Array<{ user_id: string; full_name: string; avatar_url: string }> };
    error?: string;
  }> {
    try {
      const { data, error } = await supabase
        .from('slot_groups')
        .select(`
          user_id,
          group_index,
          profiles:user_id (
            full_name,
            avatar_url
          )
        `)
        .eq('slot_id', slotId)
        .order('group_index', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        return { success: true, groups: {} };
      }

      // Grouper par group_index
      const grouped: { [key: number]: Array<{ user_id: string; full_name: string; avatar_url: string }> } = {};
      
      data.forEach((row: any) => {
        const idx = row.group_index;
        if (!grouped[idx]) {
          grouped[idx] = [];
        }
        grouped[idx].push({
          user_id: row.user_id,
          full_name: row.profiles?.full_name || 'Participant',
          avatar_url: row.profiles?.avatar_url || '',
        });
      });

      return { success: true, groups: grouped };
    } catch (error: any) {
      console.error('Erreur getGroups:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Vérifie si l'utilisateur est le host de l'activité liée au slot
   */
  private async verifyHost(slotId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('activity_slots')
      .select(`
        activity_id,
        activities:activity_id (
          host_id
        )
      `)
      .eq('id', slotId)
      .single();

    if (error || !data) return false;
    
    const activity = data.activities as any;
    return activity?.host_id === userId;
  }

  /**
   * Algorithme Round-Robin stratifié
   * 1. Trie les participants par intention pour diversifier
   * 2. Mélange au sein de chaque strate d'intention
   * 3. Distribue en round-robin pour équilibrer les groupes
   */
  private stratifiedRoundRobin(
    participants: ParticipantWithProfile[],
    numGroups: number
  ): GroupAssignment[] {
    // Grouper par intention
    const byIntention: { [key: string]: ParticipantWithProfile[] } = {
      'amicaux': [],
      'rencontres': [],
      'reseau': [],
      'decouverte': [],
      'null': [],
    };

    participants.forEach(p => {
      const key = p.intention || 'null';
      if (byIntention[key]) {
        byIntention[key].push(p);
      } else {
        byIntention['null'].push(p);
      }
    });

    // Mélanger chaque strate (Fisher-Yates shuffle)
    Object.keys(byIntention).forEach(key => {
      byIntention[key] = this.shuffle(byIntention[key]);
    });

    // Créer une liste intercalée (round-robin sur les strates)
    const intentionKeys = ['amicaux', 'rencontres', 'reseau', 'decouverte', 'null'];
    const interleavedList: ParticipantWithProfile[] = [];
    
    let hasMore = true;
    let index = 0;
    
    while (hasMore) {
      hasMore = false;
      for (const key of intentionKeys) {
        if (byIntention[key].length > index) {
          interleavedList.push(byIntention[key][index]);
          hasMore = true;
        }
      }
      index++;
    }

    // Distribuer en round-robin dans les groupes
    const assignments: GroupAssignment[] = [];
    
    interleavedList.forEach((participant, idx) => {
      const groupIndex = (idx % numGroups) + 1;
      assignments.push({
        user_id: participant.user_id,
        group_index: groupIndex,
      });
    });

    return assignments;
  }

  /**
   * Fisher-Yates shuffle
   */
  private shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Supprime tous les groupes d'un slot
   */
  async clearGroups(slotId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        return { success: false, error: 'Non authentifié' };
      }

      const isHost = await this.verifyHost(slotId, userData.user.id);
      if (!isHost) {
        return { success: false, error: 'Seul l\'hôte peut supprimer les groupes' };
      }

      const { error } = await supabase
        .from('slot_groups')
        .delete()
        .eq('slot_id', slotId);

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

export const groupsService = new GroupsService();