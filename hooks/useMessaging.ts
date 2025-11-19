// hooks/useMessaging.ts
// Hooks personnalisés pour le système de messagerie

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// ============================================
// HOOKS POUR LES AMIS
// ============================================

export function useFriends() {
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    try {
      setLoading(true);
      const { data: currentUser } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('friends_with_profiles')
        .select('*')
        .eq('user_id', currentUser?.user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFriends(data || []);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  return { friends, loading, error, refresh: loadFriends };
}

// ============================================
// HOOKS POUR LES DEMANDES D'AMITIÉ
// ============================================

export function useFriendRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    loadRequests();
    subscribeToRequests();
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const { data: currentUser } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('friend_requests_with_profiles')
        .select('*')
        .eq('receiver_id', currentUser?.user?.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
      setPendingCount(data?.length || 0);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToRequests = () => {
    const channel = supabase
      .channel('friend_requests')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'friend_requests',
        },
        () => {
          loadRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const acceptRequest = async (requestId: string) => {
    try {
      const { error } = await supabase.rpc('accept_friend_request', {
        p_request_id: requestId,
      });

      if (error) throw error;
      await loadRequests();
    } catch (err) {
      throw err;
    }
  };

  const rejectRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);

      if (error) throw error;
      await loadRequests();
    } catch (err) {
      throw err;
    }
  };

  return {
    requests,
    loading,
    error,
    pendingCount,
    acceptRequest,
    rejectRequest,
    refresh: loadRequests,
  };
}

// ============================================
// HOOKS POUR LES CONVERSATIONS
// ============================================

export function useConversations() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    loadConversations();
    subscribeToMessages();
  }, []);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const { data: currentUser } = await supabase.auth.getUser();

      // Récupérer les IDs de conversations
      const { data: participantData, error: participantError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', currentUser?.user?.id);

      if (participantError) throw participantError;

      const conversationIds = participantData?.map(p => p.conversation_id) || [];

      if (conversationIds.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // Récupérer les détails des conversations
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          conversation_participants!inner (
            user_id,
            profiles:user_id (
              id,
              full_name,
              avatar_url
            )
          ),
          messages (
            content,
            message_type,
            created_at
          )
        `)
        .in('id', conversationIds)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      // Transformer les données
      const transformedConversations = data?.map(conv => {
        const otherParticipant = conv.conversation_participants.find(
          (p: any) => p.user_id !== currentUser?.user?.id
        );

        const lastMessage = conv.messages
          ?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

        return {
          id: conv.id,
          name: otherParticipant?.profiles?.full_name || 'Inconnu',
          image: otherParticipant?.profiles?.avatar_url,
          lastMessage: lastMessage?.content || '',
          lastMessageTime: lastMessage?.created_at
            ? new Date(lastMessage.created_at).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : '',
          isGroup: conv.conversation_participants.length > 2,
          updated_at: conv.last_message_at,
        };
      }) || [];

      setConversations(transformedConversations);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel('all_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const createConversation = async (participantIds: string[]) => {
    try {
      const { data: currentUser } = await supabase.auth.getUser();

      // Créer la conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({})
        .select()
        .single();

      if (convError) throw convError;

      // Ajouter les participants
      const participants = [
        currentUser?.user?.id,
        ...participantIds,
      ].map(userId => ({
        conversation_id: conversation.id,
        user_id: userId,
      }));

      const { error: partError } = await supabase
        .from('conversation_participants')
        .insert(participants);

      if (partError) throw partError;

      await loadConversations();
      return conversation.id;
    } catch (err) {
      throw err;
    }
  };

  return {
    conversations,
    loading,
    error,
    createConversation,
    refresh: loadConversations,
  };
}

// ============================================
// HOOKS POUR LES MESSAGES
// ============================================

export function useMessages(conversationId: string) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (conversationId) {
      loadMessages();
      subscribeToMessages();
    }
  }, [conversationId]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          profiles:sender_id (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const transformedMessages = data?.map(msg => ({
        id: msg.id,
        senderId: msg.sender_id,
        senderName: msg.profiles?.full_name || 'Inconnu',
        senderAvatar: msg.profiles?.avatar_url,
        text: msg.content,
        imageUrl: msg.message_type === 'image' ? msg.media_url : undefined,
        voiceUrl: msg.message_type === 'voice' ? msg.media_url : undefined,
        voiceDuration: msg.media_duration,
        type: msg.message_type,
        timestamp: new Date(msg.created_at).toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      })) || [];

      setMessages(transformedMessages);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const sendMessage = async (
    content: string,
    type: 'text' | 'image' | 'voice' = 'text',
    mediaUrl?: string,
    mediaDuration?: number
  ) => {
    try {
      const { data: currentUser } = await supabase.auth.getUser();

      const { error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: currentUser?.user?.id,
        content: type === 'text' ? content : null,
        message_type: type,
        media_url: mediaUrl,
        media_duration: mediaDuration,
      });

      if (error) throw error;
    } catch (err) {
      throw err;
    }
  };

  return {
    messages,
    loading,
    error,
    sendMessage,
    refresh: loadMessages,
  };
}

// ============================================
// HOOK POUR RECHERCHER DES UTILISATEURS
// ============================================

export function useUserSearch(query: string) {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (query.length >= 2) {
      searchUsers();
    } else {
      setResults([]);
    }
  }, [query]);

  const searchUsers = async () => {
    try {
      setLoading(true);
      const { data: currentUser } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, city')
        .ilike('full_name', `%${query}%`)
        .neq('id', currentUser?.user?.id)
        .limit(10);

      if (error) throw error;

      // Vérifier les statuts d'amitié
      const { data: friendships } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', currentUser?.user?.id);

      const { data: requests } = await supabase
        .from('friend_requests')
        .select('receiver_id')
        .eq('sender_id', currentUser?.user?.id)
        .eq('status', 'pending');

      const friendIds = new Set(friendships?.map(f => f.friend_id) || []);
      const pendingIds = new Set(requests?.map(r => r.receiver_id) || []);

      setResults(
        data?.map(user => ({
          ...user,
          is_friend: friendIds.has(user.id),
          request_sent: pendingIds.has(user.id),
        })) || []
      );
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  return { results, loading, error };
}