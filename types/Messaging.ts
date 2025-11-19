// types/Messaging.ts

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
  sender?: Profile;
  receiver?: Profile;
}

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  created_at: string;
  friend?: Profile;
}

export interface Profile {
  id: string;
  full_name: string;
  avatar_url?: string;
  city?: string;
}

export interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
  last_message_at?: string;
  participants?: ConversationParticipant[];
  last_message?: Message;
  unread_count?: number;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_at?: string;
  profile?: Profile;
}

export type MessageType = 'text' | 'image' | 'voice' | 'system';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content?: string;
  message_type: MessageType;
  media_url?: string;
  media_duration?: number; // en secondes pour les messages vocaux
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  sender?: Profile;
}

export interface ConversationWithDetails extends Conversation {
  other_participant?: Profile;
  is_online?: boolean;
}

// Types pour les formulaires
export interface SendMessageInput {
  conversation_id: string;
  content?: string;
  message_type: MessageType;
  media_url?: string;
  media_duration?: number;
}

export interface CreateConversationInput {
  participant_ids: string[];
}

export interface SendFriendRequestInput {
  receiver_id: string;
}

export interface UpdateFriendRequestInput {
  request_id: string;
  status: 'accepted' | 'rejected';
}