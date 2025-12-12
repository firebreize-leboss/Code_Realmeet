// app/business-group-view.tsx
// Vue lecture seule d'un groupe pour l'entreprise

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  type: 'text' | 'image' | 'voice' | 'system';
  mediaUrl?: string;
  timestamp: string;
  fullDate: string;
}

interface Participant {
  id: string;
  name: string;
  avatar: string;
}

export default function BusinessGroupViewScreen() {
  const router = useRouter();
  const { id: conversationId, name: activityName } = useLocalSearchParams();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showParticipants, setShowParticipants] = useState(false);

  useEffect(() => {
    if (conversationId) {
      loadGroupData();
    }
  }, [conversationId]);

  // Souscrire aux nouveaux messages (lecture seule)
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`business-view:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload: any) => {
          console.log('📩 Nouveau message reçu:', payload.new);
          
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', payload.new.sender_id)
            .single();

          const newMsg: Message = {
            id: payload.new.id,
            senderId: payload.new.sender_id,
            senderName: profile?.full_name || 'Participant',
            senderAvatar: profile?.avatar_url || '',
            content: payload.new.content || '',
            type: payload.new.message_type,
            mediaUrl: payload.new.media_url,
            timestamp: new Date(payload.new.created_at).toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            fullDate: new Date(payload.new.created_at).toLocaleDateString('fr-FR'),
          };

          setMessages(prev => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const loadGroupData = async () => {
    try {
      setLoading(true);
      console.log('🔍 Chargement du groupe, conversationId:', conversationId);

      // Charger les participants
      const { data: participantsData, error: partError } = await supabase
        .from('conversation_participants')
        .select(`
          user_id,
          profiles:user_id (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('conversation_id', conversationId);

      if (partError) {
        console.error('❌ Erreur chargement participants:', partError);
      } else {
        console.log('✅ Participants chargés:', participantsData?.length);
      }

      if (participantsData) {
        const formattedParticipants = participantsData
          .filter((p: any) => p.profiles) // Filtrer les profils null
          .map((p: any) => ({
            id: p.profiles.id,
            name: p.profiles.full_name || 'Participant',
            avatar: p.profiles.avatar_url || '',
          }));
        setParticipants(formattedParticipants);
      }

      // Charger les messages
      const { data: messagesData, error: msgError } = await supabase
        .from('messages')
        .select(`
          id,
          sender_id,
          content,
          message_type,
          media_url,
          created_at
        `)
        .eq('conversation_id', conversationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (msgError) {
        console.error('❌ Erreur chargement messages:', msgError);
      } else {
        console.log('✅ Messages chargés:', messagesData?.length, messagesData);
      }

      if (messagesData && messagesData.length > 0) {
        // Récupérer les profils des expéditeurs
        const senderIds = [...new Set(messagesData.map(m => m.sender_id))];
        console.log('👤 Sender IDs:', senderIds);
        
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', senderIds);

        if (profileError) {
          console.error('❌ Erreur chargement profils:', profileError);
        } else {
          console.log('✅ Profils chargés:', profiles?.length);
        }

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        const formattedMessages: Message[] = messagesData.map(msg => {
          const profile = profileMap.get(msg.sender_id);
          return {
            id: msg.id,
            senderId: msg.sender_id,
            senderName: profile?.full_name || 'Participant',
            senderAvatar: profile?.avatar_url || '',
            content: msg.content || '',
            type: msg.message_type,
            mediaUrl: msg.media_url,
            timestamp: new Date(msg.created_at).toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            fullDate: new Date(msg.created_at).toLocaleDateString('fr-FR'),
          };
        });

        console.log('📝 Messages formatés:', formattedMessages.length);
        setMessages(formattedMessages);
      } else {
        console.log('⚠️ Aucun message trouvé pour cette conversation');
        setMessages([]);
      }
    } catch (error) {
      console.error('❌ Erreur chargement groupe:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderParticipant = ({ item }: { item: Participant }) => (
    <View style={styles.participantItem}>
      <Image
        source={{ uri: item.avatar || 'https://via.placeholder.com/40' }}
        style={styles.participantAvatar}
      />
      <Text style={styles.participantName} numberOfLines={1}>{item.name}</Text>
    </View>
  );

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const showDateHeader = index === 0 || messages[index - 1]?.fullDate !== item.fullDate;

    return (
      <View>
        {showDateHeader && (
          <View style={styles.dateHeader}>
            <Text style={styles.dateHeaderText}>{item.fullDate}</Text>
          </View>
        )}

        {item.type === 'system' ? (
          <View style={styles.systemMessage}>
            <Text style={styles.systemMessageText}>{item.content}</Text>
          </View>
        ) : (
          <View style={styles.messageRow}>
            <Image
              source={{ uri: item.senderAvatar || 'https://via.placeholder.com/36' }}
              style={styles.messageAvatar}
            />
            <View style={styles.messageBubble}>
              <Text style={styles.senderName}>{item.senderName}</Text>
              
              {item.type === 'image' && item.mediaUrl ? (
                <Image source={{ uri: item.mediaUrl }} style={styles.messageImage} />
              ) : item.type === 'voice' ? (
                <View style={styles.voiceMessage}>
                  <IconSymbol name="waveform" size={20} color={colors.textSecondary} />
                  <Text style={styles.voiceText}>Message vocal</Text>
                </View>
              ) : (
                <Text style={styles.messageText}>{item.content}</Text>
              )}
              
              <Text style={styles.messageTime}>{item.timestamp}</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={commonStyles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement des messages...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {decodeURIComponent(activityName as string || 'Groupe')}
          </Text>
          <Text style={styles.headerSubtitle}>{participants.length} participants</Text>
        </View>

        <TouchableOpacity 
          onPress={() => setShowParticipants(!showParticipants)}
          style={styles.participantsButton}
        >
          <IconSymbol name="person.2.fill" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Badge lecture seule */}
      <View style={styles.readOnlyBanner}>
        <IconSymbol name="eye.fill" size={14} color={colors.background} />
        <Text style={styles.readOnlyText}>Mode observation - Vous ne pouvez pas envoyer de messages</Text>
      </View>

      {/* Liste des participants (toggle) */}
      {showParticipants && (
        <View style={styles.participantsPanel}>
          <Text style={styles.participantsTitle}>Participants ({participants.length})</Text>
          <FlatList
            data={participants}
            renderItem={renderParticipant}
            keyExtractor={item => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.participantsList}
          />
        </View>
      )}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={[
          styles.messagesContent,
          messages.length === 0 && styles.emptyContent
        ]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => {
          if (messages.length > 0) {
            flatListRef.current?.scrollToEnd();
          }
        }}
        ListEmptyComponent={
          <View style={styles.emptyMessages}>
            <IconSymbol name="bubble.left.and.bubble.right" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>Aucun message dans ce groupe</Text>
            <Text style={styles.emptySubtext}>
              Les messages des participants apparaîtront ici
            </Text>
          </View>
        }
      />

      {/* Footer informatif */}
      <View style={styles.footer}>
        <IconSymbol name="lock.fill" size={16} color={colors.textSecondary} />
        <Text style={styles.footerText}>
          Les messages des participants sont visibles mais vous ne pouvez pas interagir
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  participantsButton: {
    padding: 8,
  },
  readOnlyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  readOnlyText: {
    fontSize: 12,
    color: colors.background,
    fontWeight: '500',
  },
  participantsPanel: {
    backgroundColor: colors.surface,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  participantsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  participantsList: {
    paddingHorizontal: 12,
    gap: 12,
  },
  participantItem: {
    alignItems: 'center',
    width: 60,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 4,
  },
  participantName: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 20,
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
  },
  dateHeader: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateHeaderText: {
    fontSize: 12,
    color: colors.textSecondary,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  systemMessage: {
    alignItems: 'center',
    marginVertical: 8,
  },
  systemMessageText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  messageAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  messageBubble: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    padding: 12,
    maxWidth: '85%',
  },
  senderName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 20,
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
    marginTop: 4,
  },
  voiceMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  voiceText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  messageTime: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'right',
  },
  emptyMessages: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  footerText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    flex: 1,
  },
});