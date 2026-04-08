// lib/database.types.ts
// Types générés automatiquement depuis Supabase — ne pas modifier manuellement

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          adresse: string
          categorie: string
          categorie2: string | null
          code_postal: string | null
          created_at: string | null
          date: string
          dates_supplementaires: string | null
          description: string
          host_id: string
          host_type: string | null
          id: string
          image_url: string | null
          inclusions: string[] | null
          latitude: number
          longitude: number
          max_participants: number
          nom: string
          participants: number | null
          places_restantes: number | null
          prix: number | null
          prix_devise: string | null
          regles: string[] | null
          status: string | null
          time_end: string | null
          time_start: string | null
          titre: string | null
          updated_at: string | null
          ville: string
        }
        Insert: {
          adresse: string
          categorie: string
          categorie2?: string | null
          code_postal?: string | null
          created_at?: string | null
          date: string
          dates_supplementaires?: string | null
          description: string
          host_id: string
          host_type?: string | null
          id?: string
          image_url?: string | null
          inclusions?: string[] | null
          latitude: number
          longitude: number
          max_participants: number
          nom: string
          participants?: number | null
          places_restantes?: number | null
          prix?: number | null
          prix_devise?: string | null
          regles?: string[] | null
          status?: string | null
          time_end?: string | null
          time_start?: string | null
          titre?: string | null
          updated_at?: string | null
          ville: string
        }
        Update: {
          adresse?: string
          categorie?: string
          categorie2?: string | null
          code_postal?: string | null
          created_at?: string | null
          date?: string
          dates_supplementaires?: string | null
          description?: string
          host_id?: string
          host_type?: string | null
          id?: string
          image_url?: string | null
          inclusions?: string[] | null
          latitude?: number
          longitude?: number
          max_participants?: number
          nom?: string
          participants?: number | null
          places_restantes?: number | null
          prix?: number | null
          prix_devise?: string | null
          regles?: string[] | null
          status?: string | null
          time_end?: string | null
          time_start?: string | null
          titre?: string | null
          updated_at?: string | null
          ville?: string
        }
        Relationships: []
      }
      activity_participants: {
        Row: {
          activity_id: string
          id: string
          joined_at: string | null
          user_id: string
        }
        Insert: {
          activity_id: string
          id?: string
          joined_at?: string | null
          user_id: string
        }
        Update: {
          activity_id?: string
          id?: string
          joined_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_participants_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_participants_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_slots_pending_group_formation"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "activity_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_slots: {
        Row: {
          activity_id: string
          cancelled_at: string | null
          cancelled_reason: string | null
          created_at: string | null
          created_by: string
          date: string
          discover_mode: boolean
          duration: number | null
          groups_formed: boolean | null
          groups_formed_at: string | null
          id: string
          is_cancelled: boolean
          is_locked: boolean | null
          locked_at: string | null
          max_groups: number | null
          max_participants: number | null
          min_participants_per_group: number | null
          participants_per_group: number | null
          registration_closed: boolean
          time: string
        }
        Insert: {
          activity_id: string
          cancelled_at?: string | null
          cancelled_reason?: string | null
          created_at?: string | null
          created_by: string
          date: string
          discover_mode?: boolean
          duration?: number | null
          groups_formed?: boolean | null
          groups_formed_at?: string | null
          id?: string
          is_cancelled?: boolean
          is_locked?: boolean | null
          locked_at?: string | null
          max_groups?: number | null
          max_participants?: number | null
          min_participants_per_group?: number | null
          participants_per_group?: number | null
          registration_closed?: boolean
          time: string
        }
        Update: {
          activity_id?: string
          cancelled_at?: string | null
          cancelled_reason?: string | null
          created_at?: string | null
          created_by?: string
          date?: string
          discover_mode?: boolean
          duration?: number | null
          groups_formed?: boolean | null
          groups_formed_at?: string | null
          id?: string
          is_cancelled?: boolean
          is_locked?: boolean | null
          locked_at?: string | null
          max_groups?: number | null
          max_participants?: number | null
          min_participants_per_group?: number | null
          participants_per_group?: number | null
          registration_closed?: boolean
          time?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_slots_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_slots_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_slots_pending_group_formation"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "activity_slots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_slots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      banned_phones: {
        Row: {
          banned_at: string
          id: string
          phone: string
          reason: string | null
        }
        Insert: {
          banned_at?: string
          id?: string
          phone: string
          reason?: string | null
        }
        Update: {
          banned_at?: string
          id?: string
          phone?: string
          reason?: string | null
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_users_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_users_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_users_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_users_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_stats: {
        Row: {
          activity_views: number | null
          business_id: string | null
          created_at: string | null
          date: string
          id: string
          total_participants: number | null
          total_revenue: number | null
          views: number | null
        }
        Insert: {
          activity_views?: number | null
          business_id?: string | null
          created_at?: string | null
          date: string
          id?: string
          total_participants?: number | null
          total_revenue?: number | null
          views?: number | null
        }
        Update: {
          activity_views?: number | null
          business_id?: string | null
          created_at?: string | null
          date?: string
          id?: string
          total_participants?: number | null
          total_revenue?: number | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "business_stats_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_stats_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checkin_logs: {
        Row: {
          action: string
          activity_id: string | null
          created_at: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          performed_by: string | null
          result: string
          slot_id: string | null
          slot_participant_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          activity_id?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          performed_by?: string | null
          result: string
          slot_id?: string | null
          slot_participant_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          activity_id?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          performed_by?: string | null
          result?: string
          slot_id?: string | null
          slot_participant_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkin_logs_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_logs_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_slots_pending_group_formation"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "checkin_logs_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_logs_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_logs_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "activity_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_logs_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "v_slots_pending_group_formation"
            referencedColumns: ["slot_id"]
          },
          {
            foreignKeyName: "checkin_logs_slot_participant_id_fkey"
            columns: ["slot_participant_id"]
            isOneToOne: false
            referencedRelation: "slot_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          is_hidden: boolean | null
          is_muted: boolean | null
          joined_at: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          is_hidden?: boolean | null
          is_muted?: boolean | null
          joined_at?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          is_hidden?: boolean | null
          is_muted?: boolean | null
          joined_at?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations_with_last_message"
            referencedColumns: ["conversation_id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          activity_id: string | null
          closed_at: string | null
          closed_reason: string | null
          created_at: string
          friend_request_id: string | null
          id: string
          image_url: string | null
          is_closed: boolean | null
          is_group: boolean | null
          last_message_at: string | null
          name: string | null
          slot_id: string | null
          updated_at: string
        }
        Insert: {
          activity_id?: string | null
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string
          friend_request_id?: string | null
          id?: string
          image_url?: string | null
          is_closed?: boolean | null
          is_group?: boolean | null
          last_message_at?: string | null
          name?: string | null
          slot_id?: string | null
          updated_at?: string
        }
        Update: {
          activity_id?: string | null
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string
          friend_request_id?: string | null
          id?: string
          image_url?: string | null
          is_closed?: boolean | null
          is_group?: boolean | null
          last_message_at?: string | null
          name?: string | null
          slot_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_slots_pending_group_formation"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "conversations_friend_request_id_fkey"
            columns: ["friend_request_id"]
            isOneToOne: false
            referencedRelation: "friend_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_friend_request_id_fkey"
            columns: ["friend_request_id"]
            isOneToOne: false
            referencedRelation: "friend_requests_with_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "activity_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "v_slots_pending_group_formation"
            referencedColumns: ["slot_id"]
          },
        ]
      }
      friend_requests: {
        Row: {
          created_at: string
          id: string
          receiver_id: string
          sender_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          receiver_id: string
          sender_id: string
          status: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          receiver_id?: string
          sender_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      group_formation_logs: {
        Row: {
          activity_id: string | null
          avg_compatibility: number | null
          created_at: string | null
          details: Json | null
          error_message: string | null
          groups_created: number | null
          id: string
          participants_count: number | null
          slot_id: string | null
          status: string
          total_participants: number | null
          triggered_by: string | null
        }
        Insert: {
          activity_id?: string | null
          avg_compatibility?: number | null
          created_at?: string | null
          details?: Json | null
          error_message?: string | null
          groups_created?: number | null
          id?: string
          participants_count?: number | null
          slot_id?: string | null
          status: string
          total_participants?: number | null
          triggered_by?: string | null
        }
        Update: {
          activity_id?: string | null
          avg_compatibility?: number | null
          created_at?: string | null
          details?: Json | null
          error_message?: string | null
          groups_created?: number | null
          id?: string
          participants_count?: number | null
          slot_id?: string | null
          status?: string
          total_participants?: number | null
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_formation_logs_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_formation_logs_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_slots_pending_group_formation"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "group_formation_logs_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "activity_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_formation_logs_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "v_slots_pending_group_formation"
            referencedColumns: ["slot_id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          id: string
          is_admin_message: boolean | null
          media_duration: number | null
          media_url: string | null
          message_type: string
          reply_to_message_id: string | null
          sender_id: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_admin_message?: boolean | null
          media_duration?: number | null
          media_url?: string | null
          message_type: string
          reply_to_message_id?: string | null
          sender_id: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_admin_message?: boolean | null
          media_duration?: number | null
          media_url?: string | null
          message_type?: string
          reply_to_message_id?: string | null
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations_with_last_message"
            referencedColumns: ["conversation_id"]
          },
          {
            foreignKeyName: "messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_profiles_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_profiles_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      met_people_hidden: {
        Row: {
          created_at: string
          hidden_user_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hidden_user_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          hidden_user_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "met_people_hidden_hidden_user_id_fkey"
            columns: ["hidden_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "met_people_hidden_hidden_user_id_fkey"
            columns: ["hidden_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "met_people_hidden_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "met_people_hidden_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plus_one_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          expires_at: string
          id: string
          invitee_id: string | null
          inviter_id: string
          slot_id: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          invitee_id?: string | null
          inviter_id: string
          slot_id: string
          status?: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          invitee_id?: string | null
          inviter_id?: string
          slot_id?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "plus_one_invitations_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plus_one_invitations_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plus_one_invitations_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plus_one_invitations_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plus_one_invitations_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "activity_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plus_one_invitations_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "v_slots_pending_group_formation"
            referencedColumns: ["slot_id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: string | null
          activities_hosted: number | null
          activities_joined: number | null
          avatar_url: string | null
          bio: string | null
          business_address: string | null
          business_category: string | null
          business_cover_url: string | null
          business_description: string | null
          business_email: string | null
          business_hours: Json | null
          business_logo_url: string | null
          business_name: string | null
          business_phone: string | null
          business_rating: number | null
          business_review_count: number | null
          business_siret: string | null
          business_social_links: Json | null
          business_verified: boolean | null
          business_website: string | null
          city: string | null
          created_at: string | null
          date_of_birth: string | null
          expo_push_token: string | null
          full_name: string | null
          id: string
          intention: string | null
          interests: string[] | null
          is_banned: boolean
          notifications_enabled: boolean | null
          penalty_count: number
          personality_tags: string[] | null
          phone: string | null
          phone_verified: boolean | null
          updated_at: string | null
          username: string
        }
        Insert: {
          account_type?: string | null
          activities_hosted?: number | null
          activities_joined?: number | null
          avatar_url?: string | null
          bio?: string | null
          business_address?: string | null
          business_category?: string | null
          business_cover_url?: string | null
          business_description?: string | null
          business_email?: string | null
          business_hours?: Json | null
          business_logo_url?: string | null
          business_name?: string | null
          business_phone?: string | null
          business_rating?: number | null
          business_review_count?: number | null
          business_siret?: string | null
          business_social_links?: Json | null
          business_verified?: boolean | null
          business_website?: string | null
          city?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          expo_push_token?: string | null
          full_name?: string | null
          id: string
          intention?: string | null
          interests?: string[] | null
          is_banned?: boolean
          notifications_enabled?: boolean | null
          penalty_count?: number
          personality_tags?: string[] | null
          phone?: string | null
          phone_verified?: boolean | null
          updated_at?: string | null
          username: string
        }
        Update: {
          account_type?: string | null
          activities_hosted?: number | null
          activities_joined?: number | null
          avatar_url?: string | null
          bio?: string | null
          business_address?: string | null
          business_category?: string | null
          business_cover_url?: string | null
          business_description?: string | null
          business_email?: string | null
          business_hours?: Json | null
          business_logo_url?: string | null
          business_name?: string | null
          business_phone?: string | null
          business_rating?: number | null
          business_review_count?: number | null
          business_siret?: string | null
          business_social_links?: Json | null
          business_verified?: boolean | null
          business_website?: string | null
          city?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          expo_push_token?: string | null
          full_name?: string | null
          id?: string
          intention?: string | null
          interests?: string[] | null
          is_banned?: boolean
          notifications_enabled?: boolean | null
          penalty_count?: number
          personality_tags?: string[] | null
          phone?: string | null
          phone_verified?: boolean | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          description: string | null
          id: string
          reason: string
          reported_by: string
          status: string
          target_id: string
          target_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          reason: string
          reported_by: string
          status?: string
          target_id: string
          target_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          reason?: string
          reported_by?: string
          status?: string
          target_id?: string
          target_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          activity_id: string
          comment: string | null
          created_at: string
          id: string
          rating: number
          reviewer_id: string
        }
        Insert: {
          activity_id: string
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          reviewer_id: string
        }
        Update: {
          activity_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_slots_pending_group_formation"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      slot_group_members: {
        Row: {
          compatibility_score: number | null
          created_at: string | null
          group_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          compatibility_score?: number | null
          created_at?: string | null
          group_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          compatibility_score?: number | null
          created_at?: string | null
          group_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "slot_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "slot_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      slot_groups: {
        Row: {
          activity_id: string | null
          conversation_id: string | null
          created_at: string | null
          group_name: string | null
          group_number: number | null
          id: string
          slot_id: string
        }
        Insert: {
          activity_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          group_name?: string | null
          group_number?: number | null
          id?: string
          slot_id: string
        }
        Update: {
          activity_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          group_name?: string | null
          group_number?: number | null
          id?: string
          slot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "slot_groups_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_groups_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_slots_pending_group_formation"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "slot_groups_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_groups_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations_with_last_message"
            referencedColumns: ["conversation_id"]
          },
          {
            foreignKeyName: "slot_groups_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "activity_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_groups_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "v_slots_pending_group_formation"
            referencedColumns: ["slot_id"]
          },
        ]
      }
      slot_groups_backup: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          group_index: number | null
          slot_id: string | null
          user_id: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          group_index?: number | null
          slot_id?: string | null
          user_id?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          group_index?: number | null
          slot_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      slot_participants: {
        Row: {
          activity_id: string
          cancelled_at: string | null
          cancelled_notified: boolean
          checked_in_at: string | null
          checked_in_by: string | null
          checkin_nonce: string | null
          checkin_token_expires_at: string | null
          id: string
          invited_by: string | null
          is_plus_one: boolean
          joined_at: string | null
          plus_one_invitation_id: string | null
          slot_id: string
          status: string | null
          user_id: string
        }
        Insert: {
          activity_id: string
          cancelled_at?: string | null
          cancelled_notified?: boolean
          checked_in_at?: string | null
          checked_in_by?: string | null
          checkin_nonce?: string | null
          checkin_token_expires_at?: string | null
          id?: string
          invited_by?: string | null
          is_plus_one?: boolean
          joined_at?: string | null
          plus_one_invitation_id?: string | null
          slot_id: string
          status?: string | null
          user_id: string
        }
        Update: {
          activity_id?: string
          cancelled_at?: string | null
          cancelled_notified?: boolean
          checked_in_at?: string | null
          checked_in_by?: string | null
          checkin_nonce?: string | null
          checkin_token_expires_at?: string | null
          id?: string
          invited_by?: string | null
          is_plus_one?: boolean
          joined_at?: string | null
          plus_one_invitation_id?: string | null
          slot_id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "slot_participants_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_participants_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "v_slots_pending_group_formation"
            referencedColumns: ["activity_id"]
          },
          {
            foreignKeyName: "slot_participants_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_participants_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_participants_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_participants_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_participants_plus_one_invitation_id_fkey"
            columns: ["plus_one_invitation_id"]
            isOneToOne: false
            referencedRelation: "plus_one_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_participants_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "activity_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_participants_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "v_slots_pending_group_formation"
            referencedColumns: ["slot_id"]
          },
          {
            foreignKeyName: "slot_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_penalties: {
        Row: {
          created_at: string
          id: string
          penalty_type: string
          slot_participant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          penalty_type?: string
          slot_participant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          penalty_type?: string
          slot_participant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_penalties_slot_participant_id_fkey"
            columns: ["slot_participant_id"]
            isOneToOne: false
            referencedRelation: "slot_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_penalties_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_penalties_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      conversations_with_last_message: {
        Row: {
          conversation_id: string | null
          last_message_at: string | null
          last_message_content: string | null
          last_message_sender_id: string | null
          last_message_sender_name: string | null
          last_message_type: string | null
          participant_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_sender_id_profiles_fkey"
            columns: ["last_message_sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_profiles_fkey"
            columns: ["last_message_sender_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_requests_with_profiles: {
        Row: {
          created_at: string | null
          id: string | null
          receiver_avatar: string | null
          receiver_id: string | null
          receiver_name: string | null
          sender_avatar: string | null
          sender_id: string | null
          sender_name: string | null
          status: string | null
        }
        Relationships: []
      }
      friends_with_profiles: {
        Row: {
          avatar_url: string | null
          city: string | null
          created_at: string | null
          friend_id: string | null
          full_name: string | null
          user_id: string | null
        }
        Relationships: []
      }
      public_profiles: {
        Row: {
          account_type: string | null
          avatar_url: string | null
          bio: string | null
          business_category: string | null
          business_cover_url: string | null
          business_logo_url: string | null
          business_name: string | null
          business_rating: number | null
          business_review_count: number | null
          business_verified: boolean | null
          city: string | null
          full_name: string | null
          id: string | null
          intention: string | null
          interests: string[] | null
          personality_tags: string[] | null
          username: string | null
        }
        Insert: {
          account_type?: string | null
          avatar_url?: string | null
          bio?: string | null
          business_category?: string | null
          business_cover_url?: string | null
          business_logo_url?: string | null
          business_name?: string | null
          business_rating?: number | null
          business_review_count?: number | null
          business_verified?: boolean | null
          city?: string | null
          full_name?: string | null
          id?: string | null
          intention?: string | null
          interests?: string[] | null
          personality_tags?: string[] | null
          username?: string | null
        }
        Update: {
          account_type?: string | null
          avatar_url?: string | null
          bio?: string | null
          business_category?: string | null
          business_cover_url?: string | null
          business_logo_url?: string | null
          business_name?: string | null
          business_rating?: number | null
          business_review_count?: number | null
          business_verified?: boolean | null
          city?: string | null
          full_name?: string | null
          id?: string | null
          intention?: string | null
          interests?: string[] | null
          personality_tags?: string[] | null
          username?: string | null
        }
        Relationships: []
      }
      v_slots_pending_group_formation: {
        Row: {
          activity_id: string | null
          activity_name: string | null
          current_participants: number | null
          date: string | null
          formation_due_at: string | null
          formation_status: string | null
          groups_formed: boolean | null
          is_locked: boolean | null
          max_groups: number | null
          participants_per_group: number | null
          slot_datetime: string | null
          slot_id: string | null
          time: string | null
        }
        Relationships: []
      }
      v_slow_queries: {
        Row: {
          calls: number | null
          max_exec_time: number | null
          mean_exec_time: number | null
          query: string | null
          rows: number | null
          total_exec_time: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_friend_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      accept_plus_one_invitation: { Args: { p_token: string }; Returns: Json }
      cancel_plus_one_invitation: {
        Args: { p_invitation_id: string }
        Returns: Json
      }
      cancel_slot_participation: {
        Args: { p_activity_id: string; p_slot_id: string }
        Returns: Json
      }
      check_contact_availability: {
        Args: { p_email?: string; p_phone?: string }
        Returns: Json
      }
      check_phone_banned: { Args: { p_phone: string }; Returns: Json }
      claim_push_token: { Args: { p_token: string }; Returns: undefined }
      cleanup_slot_groups: { Args: { p_slot_id: string }; Returns: undefined }
      create_bidirectional_friendship: {
        Args: { p_friend_id: string; p_user_id: string }
        Returns: undefined
      }
      create_plus_one_invitation: { Args: { p_slot_id: string }; Returns: Json }
      delete_activity_with_notification: {
        Args: { p_activity_id: string }
        Returns: undefined
      }
      detect_no_shows: { Args: never; Returns: Json }
      earth: { Args: never; Returns: number }
      form_groups_v3: { Args: { p_slot_id: string }; Returns: Json }
      get_activities_with_slots: {
        Args: { p_limit: number; p_status: string }
        Returns: {
          activity_id: string
          adresse: string
          categorie: string
          categorie2: string
          created_at: string
          date: string
          description: string
          host_id: string
          image_url: string
          latitude: number
          longitude: number
          max_participants: number
          next_slot_date: string
          nom: string
          participants: number
          prix: number
          slot_count: number
          status: string
          time_start: string
          total_remaining_places: number
          ville: string
        }[]
      }
      get_all_constraints: {
        Args: never
        Returns: {
          columns: string[]
          constraint_name: string
          constraint_type: string
          definition: string
          ref_columns: string[]
          ref_schema: string
          ref_table: string
          schema_name: string
          table_name: string
        }[]
      }
      get_business_dashboard: {
        Args: { p_business_id: string }
        Returns: {
          active_activities: number
          avg_rating: number
          review_count: number
          top_activities: Json
          total_activities: number
          total_participants: number
          total_revenue: number
        }[]
      }
      get_friends_with_profiles: {
        Args: { p_user_id: string }
        Returns: {
          avatar_url: string
          city: string
          created_at: string
          friend_id: string
          full_name: string
        }[]
      }
      get_my_activities: {
        Args: { p_user_id: string }
        Returns: {
          activity_id: string
          adresse: string
          categorie: string
          created_at: string
          date: string
          description: string
          image_url: string
          max_participants: number
          next_slot_date: string
          nom: string
          participants: number
          prix: number
          slot_count: number
          status: string
          total_participants: number
          ville: string
        }[]
      }
      get_my_conversations: {
        Args: { p_user_id: string }
        Returns: {
          conversation_id: string
          last_message_at: string
          last_message_content: string
          last_message_sender_id: string
          last_message_sender_name: string
          last_message_type: string
          participant_count: number
        }[]
      }
      get_my_conversations_v2: {
        Args: { p_user_id: string }
        Returns: {
          activity_id: string
          conversation_id: string
          conversation_image: string
          conversation_name: string
          is_closed: boolean
          is_group: boolean
          is_past_activity: boolean
          is_slot_cancelled: boolean
          last_message_at: string
          last_message_content: string
          last_message_sender_id: string
          last_message_sender_name: string
          last_message_type: string
          other_participant_avatar: string
          other_participant_name: string
          participant_count: number
          slot_date: string
          slot_id: string
          slot_time: string
          unread_count: number
          updated_at: string
        }[]
      }
      get_pending_invitations: { Args: { p_slot_id: string }; Returns: Json }
      get_slot_participant_count: {
        Args: { p_slot_id: string }
        Returns: number
      }
      get_unseen_cancellations: { Args: never; Returns: Json }
      get_user_profile_stats: {
        Args: { p_user_id: string }
        Returns: {
          activities_hosted: number
          activities_joined: number
          friends_count: number
          pending_friend_requests: number
        }[]
      }
      get_user_push_token: { Args: { user_id: string }; Returns: string }
      join_activity_slot: {
        Args: { p_activity_id: string; p_slot_id: string }
        Returns: Json
      }
      mark_cancellations_seen: {
        Args: { p_slot_participant_ids: string[] }
        Returns: Json
      }
      notify_push: {
        Args: {
          p_body: string
          p_data?: Json
          p_title: string
          p_user_id: string
        }
        Returns: undefined
      }
      process_slots_for_grouping_v3: { Args: never; Returns: number }
      remove_bidirectional_friendship: {
        Args: { p_friend_id: string }
        Returns: undefined
      }
      search_activities: {
        Args: {
          p_category?: string
          p_limit?: number
          p_max_distance_km?: number
          p_max_price?: number
          p_min_price?: number
          p_offset?: number
          p_search_text?: string
          p_user_lat?: number
          p_user_lng?: number
          p_ville?: string
        }
        Returns: {
          categorie: string
          categorie2: string
          created_at: string
          description: string
          distance_km: number
          earliest_slot_date: string
          host_id: string
          id: string
          image_url: string
          latitude: number
          longitude: number
          max_participants: number
          nom: string
          participants: number
          places_restantes: number
          prix: number
          remaining_places: number
          slot_count: number
          status: string
          titre: string
          ville: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      submit_review: {
        Args: { p_activity_id: string; p_comment?: string; p_rating: number }
        Returns: Json
      }
      test_form_groups_now: { Args: { p_slot_id: string }; Returns: Json }
      update_business_rating: {
        Args: { p_host_id: string }
        Returns: undefined
      }
      validate_plus_one_token: { Args: { p_token: string }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
