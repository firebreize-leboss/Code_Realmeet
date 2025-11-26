import { supabase } from '@/lib/supabase';

export interface CreateActivityData {
  nom: string;
  titre?: string;
  description: string;
  categorie: string;
  date: string;
  time_start: string;
  time_end?: string;
  adresse: string;
  ville: string;
  code_postal?: string;
  max_participants: number;
  image_url?: string;
  latitude?: number;
  longitude?: number;
  prix?: number;
  prix_devise?: string;
  inclusions?: string[];
  regles?: string[];
  dates_supplementaires?: string;
}

class ActivityService {
  /**
   * Créer une nouvelle activité
   */
  async createActivity(activityData: CreateActivityData) {
    try {
      // Récupérer l'utilisateur actuel
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non connecté');

      // Insérer l'activité dans Supabase
      const { data, error } = await supabase
        .from('activities')
        .insert({
          host_id: user.id,
          nom: activityData.nom,
          titre: activityData.titre,
          description: activityData.description,
          categorie: activityData.categorie,
          date: activityData.date,
          time_start: activityData.time_start,
          time_end: activityData.time_end,
          adresse: activityData.adresse,
          ville: activityData.ville,
          code_postal: activityData.code_postal,
          max_participants: activityData.max_participants,
          image_url: activityData.image_url || 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800',
          latitude: activityData.latitude || 0,
          longitude: activityData.longitude || 0,
          participants: 0,
          prix: activityData.prix,
          prix_devise: activityData.prix_devise || 'EUR',
          inclusions: activityData.inclusions,
          regles: activityData.regles,
          dates_supplementaires: activityData.dates_supplementaires,
          host_type: 'Particulier',
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data,
        message: 'Activité créée avec succès !',
      };
    } catch (error: any) {
      console.error('Erreur création activité:', error);
      return {
        success: false,
        error: error.message || 'Erreur lors de la création de l\'activité',
      };
    }
  }

  /**
   * Récupérer toutes les activités
   */
  async getActivities() {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return {
        success: true,
        data: data || [],
      };
    } catch (error: any) {
      console.error('Erreur récupération activités:', error);
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }
  }

  /**
   * Récupérer une activité par son ID
   */
  async getActivityById(id: string) {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      return {
        success: true,
        data,
      };
    } catch (error: any) {
      console.error('Erreur récupération activité:', error);
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }

  /**
   * Rejoindre une activité
   */
  async joinActivity(activityId: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non connecté');

      // Vérifier si l'activité existe et a des places
      const { data: activity } = await supabase
        .from('activities')
        .select('participants, max_participants')
        .eq('id', activityId)
        .single();

      if (!activity) throw new Error('Activité introuvable');
      
      if (activity.participants >= activity.max_participants) {
        throw new Error('Cette activité est complète');
      }

      // Incrémenter le nombre de participants
      const { error } = await supabase
        .from('activities')
        .update({ 
          participants: activity.participants + 1 
        })
        .eq('id', activityId);

      if (error) throw error;

      return {
        success: true,
        message: 'Vous avez rejoint l\'activité !',
      };
    } catch (error: any) {
      console.error('Erreur rejoindre activité:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Quitter une activité
   */
  async leaveActivity(activityId: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non connecté');

      // Récupérer le nombre actuel de participants
      const { data: activity } = await supabase
        .from('activities')
        .select('participants')
        .eq('id', activityId)
        .single();

      if (!activity) throw new Error('Activité introuvable');

      // Décrémenter le nombre de participants
      const { error } = await supabase
        .from('activities')
        .update({ 
          participants: Math.max(0, activity.participants - 1)
        })
        .eq('id', activityId);

      if (error) throw error;

      return {
        success: true,
        message: 'Vous avez quitté l\'activité',
      };
    } catch (error: any) {
      console.error('Erreur quitter activité:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export const activityService = new ActivityService();