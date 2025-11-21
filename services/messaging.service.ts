import { supabase } from '@/lib/supabase';

class MessagingService {
  // ============================================
  // AMIS
  // ============================================

  async getFriends() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      const { data, error } = await supabase
        .from('friendships')
        .select(`
          friend_id,
          created_at,
          profiles:friend_id (
            id,
            full_name,
            avatar_url,
            city
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      return {
        success: true,
        data: data?.map(f => ({
          id: f.friend_id,
          name: f.profiles?.full_name || 'Inconnu',
          avatar: f.profiles?.avatar_url,
          city: f.profiles?.city,
          is_online: false, // TODO: implémenter presence
        })) || [],
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // DEMANDES D'AMITIÉ
  // ============================================

  async getFriendRequests() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      const { data, error } = await supabase
        .from('friend_requests')
        .select(`
          id,
          sender_id,
          created_at,
          sender:sender_id (
            id,
            full_name,
            avatar_url,
            city
          )
        `)
        .eq('receiver_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return {
        success: true,
        data: data || [],
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async sendFriendRequest(receiverId: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      const { error } = await supabase
        .from('friend_requests')
        .insert({
          sender_id: user.id,
          receiver_id: receiverId,
          status: 'pending',
        });

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async acceptFriendRequest(requestId: string) {
    try {
      const { error } = await supabase.rpc('accept_friend_request', {
        p_request_id: requestId,
      });

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async rejectFriendRequest(requestId: string) {
    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // CONVERSATIONS
  // ============================================

  async getConversations() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      // Récupérer les conversations où l'utilisateur participe
      const { data: participations, error: partError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (partError) throw partError;

      const conversationIds = participations?.map(p => p.conversation_id) || [];

      if (conversationIds.length === 0) {
        return { success: true, data: [] };
      }

      // Récupérer les détails des conversations
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select(`
          id,
          last_message_at,
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
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (convError) throw convError;

      // Récupérer les derniers messages
      const { data: lastMessages } = await supabase
        .from('messages')
        .select('conversation_id, content, created_at')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false });

      // Grouper les messages par conversation
      const messagesByConv = lastMessages?.reduce((acc: any, msg) => {
        if (!acc[msg.conversation_id]) {
          acc[msg.conversation_id] = msg;
        }
        return acc;
      }, {});

      // Transformer les données
      const result = conversations?.map(conv => {
        const otherParticipant = conv.conversation_participants.find(
          (p: any) => p.user_id !== user.id
        );

        const lastMsg = messagesByConv?.[conv.id];

        return {
          id: conv.id,
          name: otherParticipant?.profiles?.full_name || 'Inconnu',
          image: otherParticipant?.profiles?.avatar_url,
          lastMessage: lastMsg?.content || '',
          lastMessageTime: lastMsg?.created_at
            ? new Date(lastMsg.created_at).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : '',
          isGroup: conv.conversation_participants.length > 2,
        };
      }) || [];

      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async createConversation(friendId: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      // Vérifier si une conversation existe déjà
      const { data: existingParticipations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (existingParticipations) {
        for (const part of existingParticipations) {
          const { data: otherPart } = await supabase
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', part.conversation_id)
            .eq('user_id', friendId)
            .single();

          if (otherPart) {
            return { success: true, conversationId: part.conversation_id };
          }
        }
      }

      // Créer nouvelle conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({})
        .select()
        .single();

      if (convError) throw convError;

      // Ajouter les participants
      const { error: partError } = await supabase
        .from('conversation_participants')
        .insert([
          { conversation_id: conversation.id, user_id: user.id },
          { conversation_id: conversation.id, user_id: friendId },
        ]);

      if (partError) throw partError;

      return { success: true, conversationId: conversation.id };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // MESSAGES
  // ============================================

  async getMessages(conversationId: string) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          sender_id,
          content,
          message_type,
          media_url,
          media_duration,
          created_at,
          profiles:sender_id (
            full_name,
            avatar_url
          )
        `)
        .eq('conversation_id', conversationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const messages = data?.map(msg => ({
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

      return { success: true, data: messages };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async sendMessage(
    conversationId: string,
    content: string,
    type: 'text' | 'image' | 'voice' = 'text',
    mediaUrl?: string,
    mediaDuration?: number
  ) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

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
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // REALTIME
  // ============================================

  subscribeToMessages(conversationId: string, callback: (message: any) => void) {
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
        async (payload) => {
          // Récupérer les infos du sender
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', payload.new.sender_id)
            .single();

          callback({
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
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  subscribeToConversations(callback: () => void) {
    const channel = supabase
      .channel('conversations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        () => callback()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  subscribeToFriendRequests(callback: () => void) {
    const channel = supabase
      .channel('friend_requests_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'friend_requests',
        },
        () => callback()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}

export const messagingService = new MessagingService();