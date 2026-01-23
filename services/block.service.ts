// services/block.service.ts
// Service de gestion des utilisateurs bloqués

import { supabase } from '@/lib/supabase';

export interface BlockedUser {
  id: string;
  blockedUserId: string;
  blockedAt: string;
  profile?: {
    full_name: string;
    avatar_url: string;
  };
}

class BlockService {
  /**
   * Bloquer un utilisateur
   */
  async blockUser(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      // Vérifier si déjà bloqué
      const { data: existing } = await supabase
        .from('blocked_users')
        .select('id')
        .eq('blocker_id', user.id)
        .eq('blocked_id', userId)
        .single();

      if (existing) {
        return { success: true }; // Déjà bloqué
      }

      // Créer le blocage
      const { error } = await supabase
        .from('blocked_users')
        .insert({
          blocker_id: user.id,
          blocked_id: userId,
        });

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      console.error('Erreur blocage utilisateur:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Débloquer un utilisateur
   */
  async unblockUser(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', userId);

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      console.error('Erreur déblocage utilisateur:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Vérifier si un utilisateur est bloqué
   */
  async isUserBlocked(userId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data } = await supabase
        .from('blocked_users')
        .select('id')
        .eq('blocker_id', user.id)
        .eq('blocked_id', userId)
        .single();

      return !!data;
    } catch {
      return false;
    }
  }

  /**
   * Vérifier si l'utilisateur actuel est bloqué par quelqu'un
   */
  async amIBlockedBy(userId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data } = await supabase
        .from('blocked_users')
        .select('id')
        .eq('blocker_id', userId)
        .eq('blocked_id', user.id)
        .single();

      return !!data;
    } catch {
      return false;
    }
  }

  /**
   * Récupérer la liste des utilisateurs bloqués
   */
  async getBlockedUsers(): Promise<BlockedUser[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('blocked_users')
        .select(`
          id,
          blocked_id,
          created_at,
          profiles:blocked_id (
            full_name,
            avatar_url
          )
        `)
        .eq('blocker_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((item: any) => ({
        id: item.id,
        blockedUserId: item.blocked_id,
        blockedAt: item.created_at,
        profile: item.profiles ? {
          full_name: item.profiles.full_name,
          avatar_url: item.profiles.avatar_url,
        } : undefined,
      }));
    } catch (error) {
      console.error('Erreur récupération bloqués:', error);
      return [];
    }
  }

  /**
   * Vérifier si on peut envoyer un message à un utilisateur
   * (ni bloqué, ni bloquant)
   */
  async canMessageUser(userId: string): Promise<{ canMessage: boolean; reason?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { canMessage: false, reason: 'Non connecté' };

      // Vérifier si je l'ai bloqué
      const iBlocked = await this.isUserBlocked(userId);
      if (iBlocked) {
        return { canMessage: false, reason: 'Vous avez bloqué cet utilisateur' };
      }

      // Vérifier si il m'a bloqué
      const theyBlocked = await this.amIBlockedBy(userId);
      if (theyBlocked) {
        return { canMessage: false, reason: 'Cet utilisateur vous a bloqué' };
      }

      return { canMessage: true };
    } catch {
      return { canMessage: true };
    }
  }
}

export const blockService = new BlockService();