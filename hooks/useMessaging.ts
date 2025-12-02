// hooks/useMessaging.ts
// Hooks personnalisés pour le système de messagerie avec système de statut

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// ============================================
// TYPES
// ============================================

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'failed';

export interface TransformedMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text?: string;
  imageUrl?: string;
  voiceUrl?: string;
  voiceDuration?: number;
  type: 'text' | 'image' | 'voice' | 'system';
  timestamp: string;
  status?: MessageStatus;
}

interface ConversationParticipant {
  user_id: string;
  profiles?: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
}

// ============================================
// HOOK POUR LES AMIS
// ============================================

export function useFriends() {
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadFriends = useCallback(async () => {
    try {
      setLoading(true);
      const { data: currentUser } = await supabase.auth.getUser();

      if (!currentUser?.user?.id) {
        setFriends([]);
        setLoading(false);
        return;
      }

      const { data: friendships, error: friendError } = await supabase
        .from('friendships')
        .select('friend_id, created_at')
        .eq('user_id', currentUser.user.id);

      if (friendError) throw friendError;

      if (!friendships || friendships.length === 0) {
        setFriends([]);
        setLoading(false);
        return;
      }

      const friendIds = friendships.map(f => f.friend_id);
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, city')
        .in('id', friendIds);

      if (profileError) throw profileError;

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
      console.error('Error loading friends:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  return { friends, loading, error, refresh: loadFriends };
}

// ============================================
// HOOK POUR LES DEMANDES D'AMITIÉ
// ============================================

export function useFriendRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      const { data: currentUser } = await supabase.auth.getUser();

      if (!currentUser?.user?.id) {
        setRequests([]);
        setPendingCount(0);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('friend_requests_with_profiles')
        .select('*')
        .eq('receiver_id', currentUser.user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRequests(data || []);
      setPendingCount(data?.length || 0);
    } catch (err) {
      console.error('Error loading friend requests:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();

    const channel = supabase
      .channel('friend_requests_changes')
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
  }, [loadRequests]);

  const acceptRequest = async (requestId: string) => {
    try {
      const { error } = await supabase.rpc('accept_friend_request', {
        p_request_id: requestId,
      });

      if (error) throw error;
      await loadRequests();
    } catch (err) {
      console.error('Error accepting friend request:', err);
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
      console.error('Error rejecting friend request:', err);
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
// HOOK POUR LES CONVERSATIONS
// ============================================

// ============================================
// HOOK POUR LES CONVERSATIONS (MIS À JOUR POUR LES GROUPES D'ACTIVITÉ)
// ============================================

export function useConversations() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      const { data: currentUser } = await supabase.auth.getUser();

      if (!currentUser?.user?.id) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // Récupérer les conversations où l'utilisateur participe
      const { data: participantData, error: participantError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', currentUser.user.id);

      if (participantError) throw participantError;

      const conversationIds = participantData?.map(p => p.conversation_id) || [];

      if (conversationIds.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // Récupérer les conversations AVEC les nouvelles colonnes (name, image_url, is_group, activity_id)
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

      if (error) throw error;

      // Récupérer les derniers messages pour chaque conversation
      const { data: lastMessages } = await supabase
        .from('messages')
        .select('conversation_id, content, message_type, created_at')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false });

      // Grouper les derniers messages par conversation
      const lastMessageByConv: Record<string, any> = {};
      lastMessages?.forEach(msg => {
        if (!lastMessageByConv[msg.conversation_id]) {
          lastMessageByConv[msg.conversation_id] = msg;
        }
      });

      const transformedConversations = data?.map(conv => {
        const participants = conv.conversation_participants as any[];
        const otherParticipant = participants.find(
          p => p.user_id !== currentUser.user?.id
        );

        const lastMsg = lastMessageByConv[conv.id];
        
        // Formater le dernier message
        let lastMessageText = '';
        if (lastMsg) {
          if (lastMsg.message_type === 'image') {
            lastMessageText = '📷 Photo';
          } else if (lastMsg.message_type === 'voice') {
            lastMessageText = '🎤 Message vocal';
          } else {
            lastMessageText = lastMsg.content || '';
          }
        }

        // Formater l'heure du dernier message
        let lastMessageTime = '';
        if (lastMsg?.created_at) {
          const msgDate = new Date(lastMsg.created_at);
          const now = new Date();
          const diffDays = Math.floor((now.getTime() - msgDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (diffDays === 0) {
            lastMessageTime = msgDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          } else if (diffDays === 1) {
            lastMessageTime = 'Hier';
          } else if (diffDays < 7) {
            lastMessageTime = msgDate.toLocaleDateString('fr-FR', { weekday: 'short' });
          } else {
            lastMessageTime = msgDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
          }
        }

        // === LOGIQUE IMPORTANTE ===
        // Si c'est un groupe d'activité (is_group = true ET activity_id existe),
        // utiliser le nom et l'image de la conversation (= nom et image de l'activité)
        // Sinon, utiliser le nom et l'avatar de l'autre participant
        
        const isActivityGroup = conv.is_group === true && conv.activity_id !== null;
        const isRegularGroup = conv.is_group === true && conv.activity_id === null;
        const isPrivateChat = !conv.is_group || participants.length === 2;

        let displayName: string;
        let displayImage: string;
        let isGroup: boolean;

        if (isActivityGroup) {
          // Groupe d'activité : utiliser nom et image de l'activité
          displayName = conv.name || 'Groupe';
          displayImage = conv.image_url || '';
          isGroup = true;
        } else if (isRegularGroup) {
          // Groupe régulier (pas d'activité)
          displayName = conv.name || 'Groupe';
          displayImage = conv.image_url || '';
          isGroup = true;
        } else {
          // Conversation privée : utiliser l'autre participant
          displayName = otherParticipant?.profiles?.full_name || 'Inconnu';
          displayImage = otherParticipant?.profiles?.avatar_url || '';
          isGroup = false;
        }

        return {
          id: conv.id,
          name: displayName,
          image: displayImage,
          lastMessage: lastMessageText,
          lastMessageTime: lastMessageTime,
          isGroup: isGroup,
          activityId: conv.activity_id || null,
          participantCount: participants.length,
          updated_at: conv.updated_at,
        };
      }) || [];

      setConversations(transformedConversations);
    } catch (err) {
      console.error('Error loading conversations:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();

    // S'abonner aux nouveaux messages pour rafraîchir la liste
    const channel = supabase
      .channel('conversations_updates')
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
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadConversations]);

  const createConversation = async (participantIds: string[]) => {
    try {
      const { data: currentUser } = await supabase.auth.getUser();

      if (!currentUser?.user?.id) {
        throw new Error('User not authenticated');
      }

      // Pour une conversation privée (1 seul autre participant)
      if (participantIds.length === 1) {
        const friendId = participantIds[0];

        // Vérifier si une conversation privée existe déjà
        const { data: myParticipations } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', currentUser.user.id);

        if (myParticipations && myParticipations.length > 0) {
          const myConvIds = myParticipations.map(p => p.conversation_id);

          const { data: friendParticipations } = await supabase
            .from('conversation_participants')
            .select('conversation_id')
            .eq('user_id', friendId)
            .in('conversation_id', myConvIds);

          if (friendParticipations && friendParticipations.length > 0) {
            for (const fp of friendParticipations) {
              // Vérifier que c'est bien une conversation à 2 (pas un groupe)
              const { data: convData } = await supabase
                .from('conversations')
                .select('is_group')
                .eq('id', fp.conversation_id)
                .single();

              // Si c'est un groupe, continuer à chercher
              if (convData?.is_group) continue;

              const { count } = await supabase
                .from('conversation_participants')
                .select('*', { count: 'exact', head: true })
                .eq('conversation_id', fp.conversation_id);

              if (count === 2) {
                return fp.conversation_id;
              }
            }
          }
        }
      }

      // Créer une nouvelle conversation privée
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          is_group: false, // Conversation privée
        })
        .select()
        .single();

      if (convError) throw convError;

      const participants = [currentUser.user.id, ...participantIds].map(userId => ({
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
      console.error('Error creating conversation:', err);
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
// HOOK POUR LES MESSAGES (OPTIMISÉ AVEC STATUT)
// ============================================

export function useMessages(conversationId: string) {
  const [messages, setMessages] = useState<TransformedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadMessages = useCallback(async () => {
    if (!conversationId) return;

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

      const transformedMessages: TransformedMessage[] = data?.map(msg => ({
        id: msg.id,
        senderId: msg.sender_id,
        senderName: msg.profiles?.full_name || 'Inconnu',
        senderAvatar: msg.profiles?.avatar_url,
        text: msg.content || undefined,
        imageUrl: msg.message_type === 'image' ? msg.media_url || undefined : undefined,
        voiceUrl: msg.message_type === 'voice' ? msg.media_url || undefined : undefined,
        voiceDuration: msg.media_duration || undefined,
        type: msg.message_type,
        timestamp: new Date(msg.created_at).toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        status: 'delivered', // Messages chargés sont déjà délivrés
      })) || [];

      setMessages(transformedMessages);
    } catch (err) {
      console.error('Error loading messages:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;

    loadMessages();

    const channel = supabase
      .channel(`room:${conversationId}`, {
        config: {
          broadcast: { self: false },
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
          console.log('🔔 New message from other user:', payload);

          setMessages(prev => {
            const exists = prev.some(msg => msg.id === payload.new.id);
            if (exists) {
              console.log('⚠️ Message already exists, skipping');
              return prev;
            }

            supabase
              .from('profiles')
              .select('full_name, avatar_url')
              .eq('id', payload.new.sender_id)
              .single()
              .then(({ data: profile }) => {
                const newMessage: TransformedMessage = {
                  id: payload.new.id,
                  senderId: payload.new.sender_id,
                  senderName: profile?.full_name || 'Inconnu',
                  senderAvatar: profile?.avatar_url,
                  text: payload.new.content || undefined,
                  imageUrl: payload.new.message_type === 'image' 
                    ? payload.new.media_url || undefined 
                    : undefined,
                  voiceUrl: payload.new.message_type === 'voice' 
                    ? payload.new.media_url || undefined 
                    : undefined,
                  voiceDuration: payload.new.media_duration || undefined,
                  type: payload.new.message_type,
                  timestamp: new Date(payload.new.created_at).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                  status: 'delivered',
                };

                setMessages(prevMsgs => {
                  if (prevMsgs.some(m => m.id === newMessage.id)) {
                    return prevMsgs;
                  }
                  return [...prevMsgs, newMessage];
                });
              });

            return prev;
          });
        }
      )
      .subscribe(status => {
        console.log('📡 Realtime subscription status:', status);
      });

    return () => {
      console.log('🔌 Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [conversationId, loadMessages]);

  // ENVOI DE MESSAGE AVEC SYSTÈME DE STATUT
  const sendMessage = async (
    content: string,
    type: 'text' | 'image' | 'voice' = 'text',
    mediaUrl?: string,
    mediaDuration?: number
  ) => {
    try {
      const { data: currentUser } = await supabase.auth.getUser();

      if (!currentUser?.user?.id) {
        throw new Error('User not authenticated');
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', currentUser.user.id)
        .single();

      const tempId = `temp_${Date.now()}_${Math.random()}`;

      const optimisticMessage: TransformedMessage = {
        id: tempId,
        senderId: currentUser.user.id,
        senderName: profile?.full_name || 'Moi',
        senderAvatar: profile?.avatar_url,
        text: type === 'text' ? content : undefined,
        imageUrl: type === 'image' ? mediaUrl : undefined,
        voiceUrl: type === 'voice' ? mediaUrl : undefined,
        voiceDuration: mediaDuration,
        type: type,
        timestamp: new Date().toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        status: 'sending',
      };

      setMessages(prev => [...prev, optimisticMessage]);

      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: currentUser.user.id,
          content: type === 'text' ? content : null,
          message_type: type,
          media_url: mediaUrl || null,
          media_duration: mediaDuration || null,
        })
        .select()
        .single();

      if (error) {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === tempId
              ? { ...msg, status: 'failed' as const }
              : msg
          )
        );
        throw error;
      }

      setMessages(prev =>
        prev.map(msg =>
          msg.id === tempId
            ? {
                ...msg,
                id: data.id,
                status: 'sent' as const,
              }
            : msg
        )
      );

      setTimeout(() => {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === data.id
              ? { ...msg, status: 'delivered' as const }
              : msg
          )
        );
      }, 1000);

    } catch (err) {
      console.error('Error sending message:', err);
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
// HOOK POUR LA RECHERCHE D'UTILISATEURS
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

      if (!currentUser?.user?.id) {
        setResults([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, city')
        .ilike('full_name', `%${query}%`)
        .neq('id', currentUser.user.id)
        .limit(10);

      if (error) throw error;

      const { data: friendships } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', currentUser.user.id);

      const { data: requests } = await supabase
        .from('friend_requests')
        .select('receiver_id')
        .eq('sender_id', currentUser.user.id)
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
      console.error('Error searching users:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  return { results, loading, error };
}