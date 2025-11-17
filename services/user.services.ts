import { supabase } from '@/lib/supabase';
import { Database } from '@/lib/supabase';

type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];
type Profile = Database['public']['Tables']['profiles']['Row'];

class UserService {
  /**
   * Récupérer le profil d'un utilisateur
   */
  async getProfile(userId: string): Promise<Profile | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Erreur récupération profil:', error);
      return null;
    }
  }

  /**
   * Mettre à jour le profil
   */
  async updateProfile(userId: string, updates: ProfileUpdate) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data,
        message: 'Profil mis à jour !',
      };
    } catch (error: any) {
      console.error('Erreur mise à jour profil:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors de la mise à jour',
      };
    }
  }

  /**
   * Mettre à jour les centres d'intérêt
   */
  async updateInterests(userId: string, interests: string[]) {
    return this.updateProfile(userId, { interests });
  }

  /**
   * Vérifier si un username est disponible
   */
  async isUsernameAvailable(username: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .single();

      if (error && error.code === 'PGRST116') {
        // Aucun résultat = username disponible
        return true;
      }

      return !data;
    } catch (error) {
      console.error('Erreur vérification username:', error);
      return false;
    }
  }

  /**
   * Récupérer tous les profils (pour la recherche)
   */
  async searchProfiles(query: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`username.ilike.%${query}%,full_name.ilike.%${query}%,city.ilike.%${query}%`)
        .limit(20);

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Erreur recherche profils:', error);
      return [];
    }
  }
}

export const userService = new UserService();