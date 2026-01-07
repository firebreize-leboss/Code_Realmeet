// lib/database.types.ts
// Types mis à jour avec support des comptes entreprise, intention, personality_tags, slot_groups et reviews

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Type pour l'intention utilisateur
export type UserIntention = 'amicaux' | 'rencontres' | 'reseau' | 'decouverte' | null;

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          full_name: string | null
          avatar_url: string | null
          bio: string | null
          city: string | null
          date_of_birth: string | null
          phone: string | null
          interests: string[] | null
          intention: UserIntention
          personality_tags: string[] | null
          created_at: string
          updated_at: string
          account_type: 'user' | 'business'
          business_name: string | null
          business_description: string | null
          business_category: string | null
          business_website: string | null
          business_phone: string | null
          business_email: string | null
          business_address: string | null
          business_siret: string | null
          business_logo_url: string | null
          business_cover_url: string | null
          business_hours: Json | null
          business_social_links: Json | null
          business_verified: boolean
          business_rating: number
          business_review_count: number
          expo_push_token: string | null
          notifications_enabled: boolean
        }
        Insert: {
          id: string
          username: string
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          date_of_birth?: string | null
          phone?: string | null
          interests?: string[] | null
          intention?: UserIntention
          personality_tags?: string[] | null
          created_at?: string
          updated_at?: string
          account_type?: 'user' | 'business'
          business_name?: string | null
          business_description?: string | null
          business_category?: string | null
          business_website?: string | null
          business_phone?: string | null
          business_email?: string | null
          business_address?: string | null
          business_siret?: string | null
          business_logo_url?: string | null
          business_cover_url?: string | null
          business_hours?: Json | null
          business_social_links?: Json | null
          business_verified?: boolean
          business_rating?: number
          business_review_count?: number
          expo_push_token?: string | null
          notifications_enabled?: boolean
        }
        Update: {
          id?: string
          username?: string
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          date_of_birth?: string | null
          phone?: string | null
          interests?: string[] | null
          intention?: UserIntention
          personality_tags?: string[] | null
          created_at?: string
          updated_at?: string
          account_type?: 'user' | 'business'
          business_name?: string | null
          business_description?: string | null
          business_category?: string | null
          business_website?: string | null
          business_phone?: string | null
          business_email?: string | null
          business_address?: string | null
          business_siret?: string | null
          business_logo_url?: string | null
          business_cover_url?: string | null
          business_hours?: Json | null
          business_social_links?: Json | null
          business_verified?: boolean
          business_rating?: number
          business_review_count?: number
        }
      }
      activities: {
        Row: {
          id: string
          host_id: string
          nom: string
          titre: string | null
          description: string | null
          categorie: string
          categorie2: string | null
          image_url: string | null
          date: string | null
          time_start: string | null
          time_end: string | null
          dates_supplementaires: string | null
          adresse: string | null
          ville: string | null
          code_postal: string | null
          latitude: number | null
          longitude: number | null
          prix: number | null
          max_participants: number
          participants: number
          inclusions: string[] | null
          regles: string[] | null
          status: 'active' | 'paused' | 'ended' | 'draft'
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          host_id: string
          nom: string
          titre?: string | null
          description?: string | null
          categorie: string
          categorie2?: string | null
          image_url?: string | null
          date?: string | null
          time_start?: string | null
          time_end?: string | null
          dates_supplementaires?: string | null
          adresse?: string | null
          ville?: string | null
          code_postal?: string | null
          latitude?: number | null
          longitude?: number | null
          prix?: number | null
          max_participants?: number
          participants?: number
          inclusions?: string[] | null
          regles?: string[] | null
          status?: 'active' | 'paused' | 'ended' | 'draft'
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          host_id?: string
          nom?: string
          titre?: string | null
          description?: string | null
          categorie?: string
          categorie2?: string | null
          image_url?: string | null
          date?: string | null
          time_start?: string | null
          time_end?: string | null
          dates_supplementaires?: string | null
          adresse?: string | null
          ville?: string | null
          code_postal?: string | null
          latitude?: number | null
          longitude?: number | null
          prix?: number | null
          max_participants?: number
          participants?: number
          inclusions?: string[] | null
          regles?: string[] | null
          status?: 'active' | 'paused' | 'ended' | 'draft'
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      activity_slots: {
        Row: {
          id: string
          activity_id: string
          date: string
          time: string
          time_start: string | null
          time_end: string | null
          duration: number | null
          max_participants: number | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          activity_id: string
          date: string
          time: string
          time_start?: string | null
          time_end?: string | null
          duration?: number | null
          max_participants?: number | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          activity_id?: string
          date?: string
          time?: string
          time_start?: string | null
          time_end?: string | null
          duration?: number | null
          max_participants?: number | null
          created_by?: string
          created_at?: string
        }
      }
      slot_participants: {
        Row: {
          id: string
          slot_id: string
          activity_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          slot_id: string
          activity_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          slot_id?: string
          activity_id?: string
          user_id?: string
          created_at?: string
        }
      }
      slot_groups: {
        Row: {
          slot_id: string
          user_id: string
          group_index: number
          created_at: string
        }
        Insert: {
          slot_id: string
          user_id: string
          group_index: number
          created_at?: string
        }
        Update: {
          slot_id?: string
          user_id?: string
          group_index?: number
          created_at?: string
        }
      }
      conversations: {
        Row: {
          id: string
          slot_id: string | null
          name: string | null
          image_url: string | null
          is_group: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slot_id?: string | null
          name?: string | null
          image_url?: string | null
          is_group?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slot_id?: string | null
          name?: string | null
          image_url?: string | null
          is_group?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      conversation_participants: {
        Row: {
          id: string
          conversation_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          user_id?: string
          created_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string
          content: string | null
          message_type: 'text' | 'image' | 'voice' | 'system'
          media_url: string | null
          media_duration: number | null
          is_admin_message: boolean
          created_at: string
          
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id: string
          content?: string | null
          message_type?: 'text' | 'image' | 'voice' | 'system'
          media_url?: string | null
          media_duration?: number | null
          is_admin_message?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_id?: string
          content?: string | null
          message_type?: 'text' | 'image' | 'voice' | 'system'
          media_url?: string | null
          media_duration?: number | null
          is_admin_message?: boolean
          created_at?: string

        }
      }
      friend_requests: {
        Row: {
          id: string
          sender_id: string
          receiver_id: string
          status: 'pending' | 'accepted' | 'rejected'
          created_at: string
        }
        Insert: {
          id?: string
          sender_id: string
          receiver_id: string
          status?: 'pending' | 'accepted' | 'rejected'
          created_at?: string
        }
        Update: {
          id?: string
          sender_id?: string
          receiver_id?: string
          status?: 'pending' | 'accepted' | 'rejected'
          created_at?: string
        }
      }
      friendships: {
        Row: {
          id: string
          user_id: string
          friend_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          friend_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          friend_id?: string
          created_at?: string
        }
      }
      blocked_users: {
        Row: {
          id: string
          blocker_id: string
          blocked_id: string
          created_at: string
        }
        Insert: {
          id?: string
          blocker_id: string
          blocked_id: string
          created_at?: string
        }
        Update: {
          id?: string
          blocker_id?: string
          blocked_id?: string
          created_at?: string
        }
      }
      reports: {
        Row: {
          id: string
          reported_by: string
          target_type: 'profile' | 'message' | 'activity'
          target_id: string
          reason: string
          description: string | null
          status: 'pending' | 'reviewed' | 'resolved'
          created_at: string
        }
        Insert: {
          id?: string
          reported_by: string
          target_type: 'profile' | 'message' | 'activity'
          target_id: string
          reason: string
          description?: string | null
          status?: 'pending' | 'reviewed' | 'resolved'
          created_at?: string
        }
        Update: {
          id?: string
          reported_by?: string
          target_type?: 'profile' | 'message' | 'activity'
          target_id?: string
          reason?: string
          description?: string | null
          status?: 'pending' | 'reviewed' | 'resolved'
          created_at?: string
        }
      }
      business_stats: {
        Row: {
          id: string
          business_id: string
          date: string
          views: number
          activity_views: number
          total_participants: number
          total_revenue: number
          created_at: string
        }
        Insert: {
          id?: string
          business_id: string
          date: string
          views?: number
          activity_views?: number
          total_participants?: number
          total_revenue?: number
          created_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          date?: string
          views?: number
          activity_views?: number
          total_participants?: number
          total_revenue?: number
          created_at?: string
        }
      }
      activity_revenue: {
        Row: {
          id: string
          activity_id: string
          business_id: string
          participant_id: string | null
          amount: number
          currency: string
          payment_status: 'pending' | 'completed' | 'refunded' | 'cancelled'
          created_at: string
        }
        Insert: {
          id?: string
          activity_id: string
          business_id: string
          participant_id?: string | null
          amount: number
          currency?: string
          payment_status?: 'pending' | 'completed' | 'refunded' | 'cancelled'
          created_at?: string
        }
        Update: {
          id?: string
          activity_id?: string
          business_id?: string
          participant_id?: string | null
          amount?: number
          currency?: string
          payment_status?: 'pending' | 'completed' | 'refunded' | 'cancelled'
          created_at?: string
        }
      }
      reviews: {
        Row: {
          id: string
          activity_id: string
          reviewer_id: string
          rating: number
          comment: string | null
          created_at: string
        }
        Insert: {
          id?: string
          activity_id: string
          reviewer_id: string
          rating: number
          comment?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          activity_id?: string
          reviewer_id?: string
          rating?: number
          comment?: string | null
          created_at?: string
        }
      }
    }
    Functions: {
      get_business_dashboard: {
        Args: { p_business_id: string }
        Returns: Json
      }
      submit_review: {
        Args: { p_activity_id: string; p_rating: number; p_comment?: string }
        Returns: Json
      }
    }
  }
}

// Helper types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type Activity = Database['public']['Tables']['activities']['Row']
export type ActivityInsert = Database['public']['Tables']['activities']['Insert']
export type ActivityUpdate = Database['public']['Tables']['activities']['Update']

export type ActivitySlot = Database['public']['Tables']['activity_slots']['Row']
export type ActivitySlotInsert = Database['public']['Tables']['activity_slots']['Insert']

export type SlotParticipant = Database['public']['Tables']['slot_participants']['Row']
export type SlotParticipantInsert = Database['public']['Tables']['slot_participants']['Insert']

export type SlotGroup = Database['public']['Tables']['slot_groups']['Row']
export type SlotGroupInsert = Database['public']['Tables']['slot_groups']['Insert']
export type SlotGroupUpdate = Database['public']['Tables']['slot_groups']['Update']

export type Conversation = Database['public']['Tables']['conversations']['Row']
export type Message = Database['public']['Tables']['messages']['Row']

export type BusinessStats = Database['public']['Tables']['business_stats']['Row']
export type ActivityRevenue = Database['public']['Tables']['activity_revenue']['Row']

export type Review = Database['public']['Tables']['reviews']['Row']
export type ReviewInsert = Database['public']['Tables']['reviews']['Insert']

// Business-specific types
export interface BusinessHours {
  [day: string]: {
    open: string
    close: string
    closed?: boolean
  }
}

export interface SocialLinks {
  instagram?: string
  facebook?: string
  twitter?: string
  linkedin?: string
}

export interface BusinessDashboardData {
  total_activities: number
  active_activities: number
  total_participants: number
  total_revenue: number
  avg_rating: number
  review_count: number
  monthly_stats: Array<{
    date: string
    views: number
    activity_views: number
    total_participants: number
    total_revenue: number
  }>
  top_activities: Array<{
    id: string
    nom: string
    image_url: string
    participants: number
    max_participants: number
    prix: number
    date: string
  }>
}

// Slot Groups types
export interface SlotGroupMember {
  user_id: string
  group_index: number
  full_name: string
  avatar_url: string | null
  intention?: UserIntention
  personality_tags?: string[]
}

export interface ComposedGroup {
  groupIndex: number
  members: SlotGroupMember[]
}

// Constantes pour les intentions
export const INTENTION_OPTIONS = [
  { value: 'amicaux', label: 'Rencontres amicales', icon: 'person.2.fill', color: '#10B981' },
  { value: 'rencontres', label: 'Rencontres amoureuses', icon: 'heart.fill', color: '#EC4899' },
  { value: 'reseau', label: 'Réseautage pro', icon: 'briefcase.fill', color: '#3B82F6' },
  { value: 'decouverte', label: 'Découverte & activités', icon: 'star.fill', color: '#F59E0B' },
] as const;

export function getIntentionLabel(intention: UserIntention): string {
  const option = INTENTION_OPTIONS.find(o => o.value === intention);
  return option?.label || 'Non renseigné';
}

export function getIntentionInfo(intention: UserIntention) {
  return INTENTION_OPTIONS.find(o => o.value === intention) || null;
}