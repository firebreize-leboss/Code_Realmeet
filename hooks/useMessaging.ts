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
      
      // Récupérer les friendships
      const { data: friendships, error: friendError } = await supabase
        .from('friendships')
        .select('friend_id, created_at')
        .eq('user_id', currentUser?.user?.id);

      if (friendError) throw friendError;

      if (!friendships || friendships.length === 0) {
        setFriends([]);
        setLoading(false);
        return;
      }

      // Récupérer les profils des amis
      const friendIds = friendships.map(f => f.friend_id);
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, city')
        .in('id', friendIds);

      if (profileError) throw profileError;

      // Combiner les données
      const formatted = friendships.map(f => {
        const profile = profiles?.find(p => p.id === f.friend_id);
        return {
          friend_id: f.friend_id,
          full_name: profile?.full_name || 'Inconnu',
          avatar_url: profile?.avatar_url || '',
          city: profile?.city || '',
          created_at: f.created_at,
        };
      });

      setFriends(formatted);
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

  // Dans useConversations
useEffect(() => {
  loadConversations();
  
  // Subscribe aux nouveaux messages pour rafraîchir la liste
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
}, []);

 const loadConversations = async () => {
  try {
    setLoading(true);
    const { data: currentUser } = await supabase.auth.getUser();
    console.log('👤 Loading conversations for user:', currentUser?.user?.id);

    // Récupérer les IDs de conversations
    const { data: participantData, error: participantError } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', currentUser?.user?.id);

    console.log('📋 Participant data:', participantData);

    if (participantError) throw participantError;

    const conversationIds = participantData?.map(p => p.conversation_id) || [];
    console.log('🆔 Conversation IDs:', conversationIds);

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
        )
      `)
      .in('id', conversationIds)
      .order('updated_at', { ascending: false });

    console.log('💬 Conversations data:', data);
    console.log('❌ Conversations error:', error);

    if (error) throw error;

    const transformedConversations = data?.map(conv => {
      console.log('🔄 Processing conv:', conv);
      const otherParticipant = conv.conversation_participants.find(
        (p: any) => p.user_id !== currentUser?.user?.id
      );
      console.log('👥 Other participant:', otherParticipant);

      return {
        id: conv.id,
        name: otherParticipant?.profiles?.full_name || 'Inconnu',
        image: otherParticipant?.profiles?.avatar_url || '',
        lastMessage: '',
        lastMessageTime: '',
        isGroup: conv.conversation_participants.length > 2,
        updated_at: conv.updated_at,
      };
    }) || [];

    console.log('✅ Final conversations:', transformedConversations);
    setConversations(transformedConversations);
  } catch (err) {
    console.error('💥 Load conversations error:', err);
    setError(err as Error);
  } finally {
    setLoading(false);
  }
};

  

 const createConversation = async (participantIds: string[]) => {
  try {
    const { data: currentUser } = await supabase.auth.getUser();

    // Vérifier si une conversation existe déjà avec ce participant (discussion 1-à-1)
    if (participantIds.length === 1) {
      const friendId = participantIds[0];
      
      // Récupérer toutes les conversations de l'utilisateur
      const { data: myParticipations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', currentUser?.user?.id);

      if (myParticipations && myParticipations.length > 0) {
        const myConvIds = myParticipations.map(p => p.conversation_id);

        // Vérifier si le friend participe à l'une de ces conversations
        const { data: friendParticipations } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', friendId)
          .in('conversation_id', myConvIds);

        if (friendParticipations && friendParticipations.length > 0) {
          // Vérifier que c'est bien une conversation à 2 personnes
          for (const fp of friendParticipations) {
            const { count } = await supabase
              .from('conversation_participants')
              .select('*', { count: 'exact', head: true })
              .eq('conversation_id', fp.conversation_id);

            if (count === 2) {
              // Conversation existante trouvée
              console.log('✅ Conversation existante trouvée:', fp.conversation_id);
              return fp.conversation_id;
            }
          }
        }
      }
    }

    console.log('🆕 Création d\'une nouvelle conversation');

    // Créer nouvelle conversation
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
    console.error('💥 Error in createConversation:', err);
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
        .is('deleted_at', null)
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

 useEffect(() => {
  if (!conversationId) return;

  loadMessages();

  // Configuration du realtime
  const channel = supabase
    .channel(`room:${conversationId}`, {
      config: {
        broadcast: { self: true },
      },
    })
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      async (payload: any) => {
        console.log('🔔 New message received:', payload);
        
        // Vérifier si le message existe déjà (éviter les doublons)
        setMessages((prev) => {
          const exists = prev.some(msg => msg.id === payload.new.id);
          if (exists) {
            console.log('⚠️ Message already exists, skipping');
            return prev;
          }

          // Récupérer le profil de l'expéditeur de manière asynchrone
          supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', payload.new.sender_id)
            .single()
            .then(({ data: profile }) => {
              const newMessage = {
                id: payload.new.id,
                senderId: payload.new.sender_id,
                senderName: profile?.full_name || 'Inconnu',
                senderAvatar: profile?.avatar_url,
                text: payload.new.content,
                imageUrl: payload.new.message_type === 'image' ? payload.new.media_url : undefined,
                voiceUrl: payload.new.message_type === 'voice' ? payload.new.media_url : undefined,
                voiceDuration: payload.new.media_duration,
                type: payload.new.message_type,
                timestamp: new Date(payload.new.created_at).toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              };

              setMessages((prevMsgs) => {
                // Double vérification avant d'ajouter
                if (prevMsgs.some(m => m.id === newMessage.id)) {
                  return prevMsgs;
                }
                return [...prevMsgs, newMessage];
              });
            });

          return prev; // Retourner prev immédiatement pour éviter le re-render
        });
      }
    )
    .subscribe((status) => {
      console.log('📡 Subscription status:', status);
    });

  return () => {
    console.log('🔌 Cleaning up realtime subscription');
    supabase.removeChannel(channel);
  };
}, [conversationId]);

  const sendMessage = async (
  content: string,
  type: 'text' | 'image' | 'voice' = 'text',
  mediaUrl?: string,
  mediaDuration?: number
) => {
  try {
    const { data: currentUser } = await supabase.auth.getUser();

    const { data, error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: currentUser?.user?.id,
      content: type === 'text' ? content : null,
      message_type: type,
      media_url: mediaUrl,
      media_duration: mediaDuration,
    }).select().single();

    if (error) throw error;

    // Récupérer le profil pour afficher immédiatement
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', currentUser?.user?.id)
      .single();

    // Ajouter immédiatement le message sans attendre le realtime
    const newMessage = {
      id: data.id,
      senderId: data.sender_id,
      senderName: profile?.full_name || 'Moi',
      senderAvatar: profile?.avatar_url,
      text: data.content,
      imageUrl: data.message_type === 'image' ? data.media_url : undefined,
      voiceUrl: data.message_type === 'voice' ? data.media_url : undefined,
      voiceDuration: data.media_duration,
      type: data.message_type,
      timestamp: new Date(data.created_at).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    setMessages((prev) => [...prev, newMessage]);
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