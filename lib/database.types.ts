// lib/database.types.ts
// Types mis à jour avec support des comptes entreprise

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

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
          created_at: string
          updated_at: string
          // Business fields
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
          created_at?: string
          updated_at?: string
          // Business fields
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
          created_at?: string
          updated_at?: string
          // Business fields
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
      activities: {
        Row: {
          id: string
          host_id: string
          nom: string
          titre: string | null
          description: string
          categorie: string
          categorie2: string | null
          date: string
          time_start: string
          time_end: string | null
          adresse: string
          ville: string
          code_postal: string | null
          max_participants: number
          participants: number
          image_url: string
          latitude: number
          longitude: number
          prix: number | null
          prix_devise: string
          inclusions: string[] | null
          regles: string[] | null
          dates_supplementaires: string | null
          host_type: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          host_id: string
          nom: string
          titre?: string | null
          description: string
          categorie: string
          categorie2?: string | null
          date: string
          time_start: string
          time_end?: string | null
          adresse: string
          ville: string
          code_postal?: string | null
          max_participants: number
          participants?: number
          image_url?: string
          latitude?: number
          longitude?: number
          prix?: number | null
          prix_devise?: string
          inclusions?: string[] | null
          regles?: string[] | null
          dates_supplementaires?: string | null
          host_type?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          host_id?: string
          nom?: string
          titre?: string | null
          description?: string
          categorie?: string
          categorie2?: string | null
          date?: string
          time_start?: string
          time_end?: string | null
          adresse?: string
          ville?: string
          code_postal?: string | null
          max_participants?: number
          participants?: number
          image_url?: string
          latitude?: number
          longitude?: number
          prix?: number | null
          prix_devise?: string
          inclusions?: string[] | null
          regles?: string[] | null
          dates_supplementaires?: string | null
          host_type?: string
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      friend_requests: {
        Row: {
          id: string
          sender_id: string
          receiver_id: string
          status: 'pending' | 'accepted' | 'rejected'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sender_id: string
          receiver_id: string
          status?: 'pending' | 'accepted' | 'rejected'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sender_id?: string
          receiver_id?: string
          status?: 'pending' | 'accepted' | 'rejected'
          created_at?: string
          updated_at?: string
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
      conversations: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          last_message_at: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          last_message_at?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          last_message_at?: string | null
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string
          content: string | null
          message_type: 'text' | 'image' | 'voice'
          media_url: string | null
          media_duration: number | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id: string
          content?: string | null
          message_type?: 'text' | 'image' | 'voice'
          media_url?: string | null
          media_duration?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_id?: string
          content?: string | null
          message_type?: 'text' | 'image' | 'voice'
          media_url?: string | null
          media_duration?: number | null
          created_at?: string
        }
      }
    }
    Functions: {
      get_business_dashboard: {
        Args: { p_business_id: string }
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

export type BusinessStats = Database['public']['Tables']['business_stats']['Row']
export type ActivityRevenue = Database['public']['Tables']['activity_revenue']['Row']

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