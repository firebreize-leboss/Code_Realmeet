import { supabase } from '@/lib/supabase';
import { Alert } from 'react-native';

export interface RegisterData {
  email: string;
  password: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  city?: string;
  date_of_birth?: string;
  phone?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

class AuthService {
  /**
   * Inscription d'un nouvel utilisateur
   */
  async registerUser(data: RegisterData) {
    try {
      // 1. Créer le compte auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Erreur lors de la création du compte');

      // 2. Créer le profil utilisateur
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          username: data.username,
          full_name: data.full_name || null,
          avatar_url: data.avatar_url || null,
          city: data.city || null,
          date_of_birth: data.date_of_birth || null,
          phone: data.phone || null,
        });

      if (profileError) throw profileError;

      return {
        success: true,
        user: authData.user,
        message: 'Compte créé avec succès !',
      };
    } catch (error: any) {
      console.error('Erreur inscription:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors de l\'inscription',
      };
    }
  }

  /**
   * Connexion d'un utilisateur
   */
  async loginUser(data: LoginData) {
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) throw error;

      return {
        success: true,
        user: authData.user,
        session: authData.session,
        message: 'Connexion réussie !',
      };
    } catch (error: any) {
      console.error('Erreur connexion:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors de la connexion',
      };
    }
  }

  /**
   * Déconnexion
   */
  async logoutUser() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      return {
        success: true,
        message: 'Déconnexion réussie',
      };
    } catch (error: any) {
      console.error('Erreur déconnexion:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors de la déconnexion',
      };
    }
  }

  /**
   * Récupérer l'utilisateur connecté
   */
  async getCurrentUser() {
    try {
      // Vérifier d'abord s'il y a une session active
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Pas de session = pas d'utilisateur connecté, c'est normal
        return null;
      }

      const { data: { user }, error } = await supabase.auth.getUser();

      if (error) throw error;
      if (!user) return null;

      return user;
    } catch (error: any) {
      // Ne pas logger les erreurs de session manquante car c'est un cas normal
      if (error?.name !== 'AuthSessionMissingError') {
        console.error('Erreur récupération utilisateur:', error);
      }
      return null;
    }
  }

  /**
   * Récupérer la session actuelle
   */
  async getSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      return session;
    } catch (error: any) {
      console.error('Erreur récupération session:', error);
      return null;
    }
  }

  /**
   * Écouter les changements d'authentification
   */
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }

  /**
   * Réinitialisation du mot de passe
   */
  async resetPassword(email: string) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'yourapp://reset-password',
      });

      if (error) throw error;

      return {
        success: true,
        message: 'Email de réinitialisation envoyé !',
      };
    } catch (error: any) {
      console.error('Erreur reset password:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors de l\'envoi de l\'email',
      };
    }
  }
}

export const authService = new AuthService();