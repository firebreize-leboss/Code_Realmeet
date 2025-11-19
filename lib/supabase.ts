// lib/supabase.ts
// Configuration du client Supabase avec gestion d'authentification

import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Créer le client Supabase avec configuration pour React Native
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Upload un fichier vers Supabase Storage
 */
export async function uploadFile(
  bucket: string,
  path: string,
  file: File | Blob,
  options?: {
    contentType?: string;
    upsert?: boolean;
  }
) {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        contentType: options?.contentType,
        upsert: options?.upsert ?? false,
      });

    if (error) throw error;

    // Retourner l'URL publique
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return {
      success: true,
      url: urlData.publicUrl,
      path: data.path,
    };
  } catch (error) {
    console.error('Error uploading file:', error);
    return {
      success: false,
      error: error as Error,
    };
  }
}

/**
 * Supprime un fichier de Supabase Storage
 */
export async function deleteFile(bucket: string, path: string) {
  try {
    const { error } = await supabase.storage.from(bucket).remove([path]);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error deleting file:', error);
    return {
      success: false,
      error: error as Error,
    };
  }
}

/**
 * Obtient l'URL publique d'un fichier
 */
export function getPublicUrl(bucket: string, path: string) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Vérifie si un utilisateur est connecté
 */
export async function isAuthenticated() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return !!session;
}

/**
 * Obtient l'utilisateur actuel
 */
export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Obtient le profil de l'utilisateur actuel
 */
export async function getCurrentUserProfile() {
  try {
    const user = await getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
}

/**
 * Met à jour le profil de l'utilisateur
 */
export async function updateUserProfile(updates: {
  full_name?: string;
  avatar_url?: string;
  bio?: string;
  city?: string;
  interests?: string[];
}) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('No user logged in');

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error updating profile:', error);
    return {
      success: false,
      error: error as Error,
    };
  }
}

// ============================================
// AUTHENTICATION HELPERS
// ============================================

/**
 * Inscription avec email et mot de passe
 */
export async function signUp(email: string, password: string, metadata?: {
  full_name?: string;
  avatar_url?: string;
}) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });

    if (error) throw error;
    return { success: true, user: data.user };
  } catch (error) {
    console.error('Error signing up:', error);
    return {
      success: false,
      error: error as Error,
    };
  }
}

/**
 * Connexion avec email et mot de passe
 */
export async function signIn(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return { success: true, user: data.user };
  } catch (error) {
    console.error('Error signing in:', error);
    return {
      success: false,
      error: error as Error,
    };
  }
}

/**
 * Déconnexion
 */
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error signing out:', error);
    return {
      success: false,
      error: error as Error,
    };
  }
}

/**
 * Réinitialisation du mot de passe
 */
export async function resetPassword(email: string) {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error resetting password:', error);
    return {
      success: false,
      error: error as Error,
    };
  }
}

// ============================================
// MESSAGING HELPERS
// ============================================

/**
 * Envoie une demande d'amitié
 */
export async function sendFriendRequest(receiverId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('No user logged in');

    const { error } = await supabase.from('friend_requests').insert({
      sender_id: user.id,
      receiver_id: receiverId,
      status: 'pending',
    });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error sending friend request:', error);
    return {
      success: false,
      error: error as Error,
    };
  }
}

/**
 * Accepte une demande d'amitié
 */
export async function acceptFriendRequest(requestId: string) {
  try {
    const { error } = await supabase.rpc('accept_friend_request', {
      p_request_id: requestId,
    });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error accepting friend request:', error);
    return {
      success: false,
      error: error as Error,
    };
  }
}

/**
 * Rejette une demande d'amitié
 */
export async function rejectFriendRequest(requestId: string) {
  try {
    const { error } = await supabase
      .from('friend_requests')
      .update({ status: 'rejected' })
      .eq('id', requestId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    return {
      success: false,
      error: error as Error,
    };
  }
}

/**
 * Crée une nouvelle conversation
 */
export async function createConversation(participantIds: string[]) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('No user logged in');

    // Créer la conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert({})
      .select()
      .single();

    if (convError) throw convError;

    // Ajouter les participants
    const participants = [user.id, ...participantIds].map(userId => ({
      conversation_id: conversation.id,
      user_id: userId,
    }));

    const { error: partError } = await supabase
      .from('conversation_participants')
      .insert(participants);

    if (partError) throw partError;

    return {
      success: true,
      conversationId: conversation.id,
    };
  } catch (error) {
    console.error('Error creating conversation:', error);
    return {
      success: false,
      error: error as Error,
    };
  }
}

/**
 * Envoie un message
 */
export async function sendMessage(
  conversationId: string,
  content: string,
  type: 'text' | 'image' | 'voice' = 'text',
  mediaUrl?: string,
  mediaDuration?: number
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('No user logged in');

    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: type === 'text' ? content : null,
      message_type: type,
      media_url: mediaUrl,
      media_duration: mediaDuration,
    });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error sending message:', error);
    return {
      success: false,
      error: error as Error,
    };
  }
}

// ============================================
// REALTIME HELPERS
// ============================================

/**
 * S'abonne aux changements d'une table
 */
export function subscribeToTable(
  table: string,
  callback: (payload: any) => void,
  filter?: string
) {
  const channel = supabase
    .channel(`${table}_changes`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter,
      },
      callback
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * S'abonne aux nouveaux messages d'une conversation
 */
export function subscribeToMessages(
  conversationId: string,
  callback: (message: any) => void
) {
  const channel = supabase
    .channel(`messages_${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        callback(payload.new);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * S'abonne aux demandes d'amitié
 */
export function subscribeToFriendRequests(callback: (request: any) => void) {
  return subscribeToTable('friend_requests', callback);
}