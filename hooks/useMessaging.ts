// hooks/useMessaging.ts
// Hooks personnalisés pour le système de messagerie avec système de statut

import { useState, useEffect, useCallback, useRef } from 'react';
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
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'friend_requests',
        },
        () => {
          // Recharger quand une demande est acceptée/refusée
          loadRequests();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
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

// ============================================
// HOOK POUR LES CONVERSATIONS (MIS À JOUR POUR LES GROUPES D'ACTIVITÉ + UNREAD COUNT)
// ============================================

// ============================================
// REMPLACE UNIQUEMENT la fonction useConversations() dans hooks/useMessaging.ts
// Assure-toi que useRef est importé en haut du fichier:
// import { useState, useEffect, useCallback, useRef } from 'react';
// ============================================

export function useConversations() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // ✅ Utiliser useRef pour stocker les IDs (évite les problèmes de closure)
  const userConversationIdsRef = useRef<string[]>([]);
  const channelRef = useRef<any>(null);
  const userIdRef = useRef<string | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      const { data: currentUser } = await supabase.auth.getUser();

      if (!currentUser?.user?.id) {
        setConversations([]);
        userConversationIdsRef.current = [];
        userIdRef.current = null;
        setLoading(false);
        return;
      }

      const userId = currentUser.user.id;
      userIdRef.current = userId;

      // Récupérer les conversations où l'utilisateur participe AVEC last_read_at
      const { data: participantData, error: participantError } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', userId);

      if (participantError) throw participantError;

      const conversationIds = participantData?.map(p => p.conversation_id) || [];
      
      // ✅ STOCKER dans le ref pour accès dans les callbacks
      userConversationIdsRef.current = conversationIds;

      if (conversationIds.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // Créer un map de last_read_at par conversation
      const lastReadMap: Record<string, string | null> = {};
      participantData?.forEach(p => {
        lastReadMap[p.conversation_id] = p.last_read_at;
      });

      // Récupérer les conversations
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
        .select('conversation_id, content, message_type, created_at, sender_id')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false });

      // Grouper les derniers messages par conversation
      const lastMessageByConv: Record<string, any> = {};
      lastMessages?.forEach(msg => {
        if (!lastMessageByConv[msg.conversation_id]) {
          lastMessageByConv[msg.conversation_id] = msg;
        }
      });

      // Compter les messages non lus pour chaque conversation
      const unreadCounts: Record<string, number> = {};
      for (const convId of conversationIds) {
        const lastReadAt = lastReadMap[convId];
        
        let query = supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', convId)
          .neq('sender_id', userId)
          .neq('message_type', 'system');
        
        if (lastReadAt) {
          query = query.gt('created_at', lastReadAt);
        }
        
        const { count } = await query;
        unreadCounts[convId] = count || 0;
      }

      const transformedConversations = data?.map(conv => {
        const participants = conv.conversation_participants as any[];
        const otherParticipant = participants.find(
          p => p.user_id !== userId
        );

        const lastMsg = lastMessageByConv[conv.id];
        
        // Formater le dernier message
        let lastMessageText = '';
        if (lastMsg) {
          if (lastMsg.message_type === 'image') {
            lastMessageText = '📷 Photo';
          } else if (lastMsg.message_type === 'voice') {
            lastMessageText = '🎤 Message vocal';
          } else if (lastMsg.message_type === 'system') {
            lastMessageText = lastMsg.content || '';
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

        // Déterminer le type de conversation
        const isActivityGroup = conv.is_group === true && (conv.activity_id !== null || conv.slot_id !== null);
        const isRegularGroup = conv.is_group === true && conv.activity_id === null && conv.slot_id === null;

        let displayName: string;
        let displayImage: string;
        let isGroup: boolean;

        if (isActivityGroup || isRegularGroup) {
          displayName = conv.name || 'Groupe';
          displayImage = conv.image_url || '';
          isGroup = true;
        } else {
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
          slotId: conv.slot_id || null,
          isActivityGroup: isActivityGroup,
          participantCount: participants.length,
          updated_at: conv.updated_at,
          unreadCount: unreadCounts[conv.id] || 0,
        };
      }) || [];

      // Pour les groupes d'activité, déterminer si l'activité est passée
      const now = new Date();
      const conversationsWithPastInfo = await Promise.all(
        transformedConversations.map(async (conv) => {
          if (!conv.isActivityGroup || !conv.slotId) {
            return { ...conv, isPastActivity: false };
          }

          // Récupérer la date du slot
          const { data: slotData } = await supabase
            .from('activity_slots')
            .select('date, time')
            .eq('id', conv.slotId)
            .single();

          if (slotData) {
            const slotDateTime = new Date(`${slotData.date}T${slotData.time || '00:00'}`);
            return {
              ...conv,
              slotDate: slotData.date,
              isPastActivity: slotDateTime < now,
            };
          }

          return { ...conv, isPastActivity: false };
        })
      );

      setConversations(conversationsWithPastInfo);
    } catch (err) {
      console.error('Error loading conversations:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Marquer une conversation comme lue
  const markAsRead = useCallback(async (conversationId: string) => {
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser?.user?.id) return;

      await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', currentUser.user.id);

      // Mettre à jour l'état local
      setConversations(prev => 
        prev.map(conv => 
          conv.id === conversationId 
            ? { ...conv, unreadCount: 0 } 
            : conv
        )
      );
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }, []);

  // Charger les conversations au montage
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // ✅ SUBSCRIPTION REALTIME - séparée et optimisée
  useEffect(() => {
    // Nettoyer l'ancien channel si existant
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`conversations_realtime_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload: any) => {
          const newMsg = payload.new;
          const convId = newMsg.conversation_id;
          
          // ✅ Utiliser le ref pour vérifier (toujours à jour)
          const userConvIds = userConversationIdsRef.current;
          const currentUserId = userIdRef.current;
          
          if (!userConvIds.includes(convId)) {
            return;
          }

          // Formater le texte du message
          let lastMessageText = '';
          if (newMsg.message_type === 'image') {
            lastMessageText = '📷 Photo';
          } else if (newMsg.message_type === 'voice') {
            lastMessageText = '🎤 Message vocal';
          } else if (newMsg.message_type === 'system') {
            lastMessageText = newMsg.content || '';
          } else {
            lastMessageText = newMsg.content || '';
          }

          // Formater l'heure
          const msgDate = new Date(newMsg.created_at);
          const lastMessageTime = msgDate.toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });

          // ✅ MISE À JOUR OPTIMISTE de l'état local
          setConversations(prev => {
            const existingIndex = prev.findIndex(c => c.id === convId);
            
            if (existingIndex === -1) {
              // Nouvelle conversation qu'on ne connaît pas, recharger
              loadConversations();
              return prev;
            }

            const updatedConv = {
              ...prev[existingIndex],
              lastMessage: lastMessageText,
              lastMessageTime: lastMessageTime,
              updated_at: newMsg.created_at,
              // Incrémenter unreadCount si ce n'est pas notre message
              unreadCount: newMsg.sender_id !== currentUserId 
                ? (prev[existingIndex].unreadCount || 0) + 1 
                : prev[existingIndex].unreadCount,
            };

            // Retirer la conversation de sa position actuelle et la remettre en premier
            const newList = prev.filter(c => c.id !== convId);

            return [updatedConv, ...newList];
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
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
              const { data: convData } = await supabase
                .from('conversations')
                .select('is_group')
                .eq('id', fp.conversation_id)
                .single();

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
          is_group: false,
        })
        .select()
        .single();

      if (convError) throw convError;

      const participants = [currentUser.user.id, ...participantIds].map(odUserId => ({
        conversation_id: conversation.id,
        user_id: odUserId,
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
  markAsRead,
  refreshConversations: loadConversations,
};
}

// ============================================
// HOOK POUR LES MESSAGES (OPTIMISÉ AVEC STATUT)
// ============================================

export function useMessages(conversationId: string) {
  const [messages, setMessages] = useState<TransformedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{ full_name: string; avatar_url: string } | null>(null);
  const loadedMessageIdsRef = useRef<Set<string>>(new Set());
  const isLoadingRef = useRef(false);
  const hasInitialLoadRef = useRef(false);

  // Chargement initial PARALLÈLE : utilisateur + messages en même temps
  useEffect(() => {
    if (!conversationId || hasInitialLoadRef.current) return;
    hasInitialLoadRef.current = true;

    const loadInitialData = async () => {
      try {
        isLoadingRef.current = true;
        setLoading(true);

        // Charger utilisateur ET messages EN PARALLÈLE
        const [userResult, messagesResult] = await Promise.all([
          // 1. Charger l'utilisateur et son profil
          (async () => {
            const { data: userData } = await supabase.auth.getUser();
            if (!userData?.user?.id) return null;

            const { data: profileData } = await supabase
              .from('profiles')
              .select('full_name, avatar_url')
              .eq('id', userData.user.id)
              .single();

            return {
              userId: userData.user.id,
              profile: profileData as { full_name: string; avatar_url: string } | null
            };
          })(),
          // 2. Charger les messages
          supabase
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
            .order('created_at', { ascending: true })
        ]);

        // Mettre à jour l'utilisateur
        if (userResult) {
          setCurrentUserId(userResult.userId);
          if (userResult.profile) {
            setUserProfile(userResult.profile);
          }
        }

        // Mettre à jour les messages
        if (!messagesResult.error && messagesResult.data) {
          const messagesData = messagesResult.data as any[];
          const transformedMessages: TransformedMessage[] = messagesData.map(msg => ({
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
            status: 'delivered' as const,
          }));

          loadedMessageIdsRef.current = new Set(transformedMessages.map(m => m.id));
          setMessages(transformedMessages);
        }
      } catch (err) {
        console.error('Error loading initial data:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
        isLoadingRef.current = false;
      }
    };

    loadInitialData();
  }, [conversationId]);

  // Fonction de refresh (pour les rechargements manuels)
  const loadMessages = useCallback(async () => {
    if (!conversationId || isLoadingRef.current) return;

    try {
      isLoadingRef.current = true;

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
        status: 'delivered',
      })) || [];

      loadedMessageIdsRef.current = new Set(transformedMessages.map(m => m.id));
      setMessages(transformedMessages);
    } catch (err) {
      console.error('Error loading messages:', err);
      setError(err as Error);
    } finally {
      isLoadingRef.current = false;
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
          const newMsg = payload.new;

          // Vérifier si le message existe déjà (évite les doublons avec les messages optimistes)
          if (loadedMessageIdsRef.current.has(newMsg.id)) {
            return;
          }

          // Charger le profil de l'expéditeur
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', newMsg.sender_id)
            .single();

          const profile = profileData as { full_name: string; avatar_url: string } | null;

          const newMessage: TransformedMessage = {
            id: newMsg.id,
            senderId: newMsg.sender_id,
            senderName: profile?.full_name || 'Inconnu',
            senderAvatar: profile?.avatar_url,
            text: newMsg.content || undefined,
            imageUrl: newMsg.message_type === 'image' ? newMsg.media_url || undefined : undefined,
            voiceUrl: newMsg.message_type === 'voice' ? newMsg.media_url || undefined : undefined,
            voiceDuration: newMsg.media_duration || undefined,
            type: newMsg.message_type,
            timestamp: new Date(newMsg.created_at).toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            status: 'delivered',
          };

          setMessages(prev => {
            // Double vérification pour éviter les doublons
            if (prev.some(m => m.id === newMsg.id)) {
              return prev;
            }
            loadedMessageIdsRef.current.add(newMsg.id);
            return [...prev, newMessage];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, loadMessages]);

  // ENVOI DE MESSAGE AVEC SYSTÈME DE STATUT OPTIMISÉ (utilise le cache)
  const sendMessage = async (
    content: string,
    type: 'text' | 'image' | 'voice' = 'text',
    mediaUrl?: string,
    mediaDuration?: number
  ) => {
    try {
      // Utiliser le cache si disponible, sinon charger
      let userId = currentUserId;
      let profile = userProfile;

      if (!userId) {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user?.id) {
          throw new Error('User not authenticated');
        }
        userId = userData.user.id;
      }

      if (!profile) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', userId)
          .single();
        profile = profileData as { full_name: string; avatar_url: string } | null;
      }

      const tempId = `temp_${Date.now()}_${Math.random()}`;

      const optimisticMessage: TransformedMessage = {
        id: tempId,
        senderId: userId,
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

      const { data: messageData, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: userId,
          content: type === 'text' ? content : null,
          message_type: type,
          media_url: mediaUrl || null,
          media_duration: mediaDuration || null,
        } as any)
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

      const insertedMessage = messageData as { id: string } | null;
      if (!insertedMessage) throw new Error('Message insertion failed');

      // Ajouter le vrai ID aux messages chargés pour éviter les doublons avec realtime
      loadedMessageIdsRef.current.add(insertedMessage.id);

      // Remplacer le message optimiste par le vrai message
      setMessages(prev =>
        prev.map(msg =>
          msg.id === tempId
            ? {
                ...msg,
                id: insertedMessage.id,
                status: 'delivered' as const,
              }
            : msg
        )
      );

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
    currentUserId,
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