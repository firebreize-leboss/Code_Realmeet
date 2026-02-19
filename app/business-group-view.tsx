// app/business-group-view.tsx
// Vue d'un groupe pour l'entreprise avec possibilité d'envoyer des messages admin

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
  isAdminMessage: boolean;
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
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [activityHostId, setActivityHostId] = useState<string | null>(null);

  const insets = useSafeAreaInsets();
  const { height: kbHeight } = useReanimatedKeyboardAnimation();

  const animatedBottomStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(insets.bottom, -kbHeight.value),
  }));

  useEffect(() => {
    if (conversationId) {
      loadGroupData();
    }
  }, [conversationId]);

  // Souscrire aux nouveaux messages
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
            isAdminMessage: payload.new.is_admin_message || false,
          };

          setMessages(prev => [newMsg, ...prev]);
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

      // Récupérer l'ID de l'entreprise connectée
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        setBusinessId(userData.user.id);
      }

      // Récupérer le host de l'activité pour ce groupe
      const { data: convData } = await supabase
        .from('conversations')
        .select('slot_id')
        .eq('id', conversationId)
        .single();

      if (convData?.slot_id) {
        const { data: slotData } = await supabase
          .from('activity_slots')
          .select('activity_id')
          .eq('id', convData.slot_id)
          .single();

        if (slotData?.activity_id) {
          const { data: activityData } = await supabase
            .from('activities')
            .select('host_id')
            .eq('id', slotData.activity_id)
            .single();

          if (activityData?.host_id) {
            setActivityHostId(activityData.host_id);
          }
        }
      }

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
        console.error('Erreur chargement participants:', partError);
      }

      if (participantsData) {
        const formattedParticipants = participantsData
          .filter((p: any) => p.profiles)
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
          is_admin_message,
          created_at
        `)
        .eq('conversation_id', conversationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (msgError) {
        console.error('Erreur chargement messages:', msgError);
      }

      if (messagesData && messagesData.length > 0) {
        const senderIds = [...new Set(messagesData.map(m => m.sender_id))];
        
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', senderIds);

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
            isAdminMessage: msg.is_admin_message || false,
          };
        });

        setMessages(formattedMessages);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error('❌ Erreur chargement groupe:', error);
    } finally {
      setLoading(false);
    }
  };

  // Vérifier si l'entreprise est le host de cette activité
  const isActivityHost = businessId && activityHostId && businessId === activityHostId;

  const handleSendAdminMessage = async () => {
    if (!messageText.trim() || sending || !isActivityHost) return;

    setSending(true);
    try {
      const { error } = await supabase.from('messages').insert({
        conversation_id: conversationId as string,
        sender_id: businessId,
        content: messageText.trim(),
        message_type: 'text',
        is_admin_message: true,
      });

      if (error) throw error;
      setMessageText('');
    } catch (error) {
      console.error('Erreur envoi message:', error);
    } finally {
      setSending(false);
    }
  };

  const renderParticipant = ({ item }: { item: Participant }) => (
    <TouchableOpacity 
      style={styles.participantItem}
      onPress={() => router.push(`/user-profile?id=${item.id}`)}
      activeOpacity={0.7}
    >
      <Image
        source={{ uri: item.avatar || 'https://via.placeholder.com/40' }}
        style={styles.participantAvatar}
      />
      <Text style={styles.participantName} numberOfLines={1}>{item.name}</Text>
    </TouchableOpacity>
  );

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const showDateHeader = index === messages.length - 1 || messages[index + 1]?.fullDate !== item.fullDate;

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
            <View style={[
              styles.messageBubble,
              item.isAdminMessage && styles.adminMessageBubble
            ]}>
              <View style={styles.senderRow}>
                <Text style={[styles.senderName, item.isAdminMessage && styles.adminSenderName]}>
                  {item.senderName}
                </Text>
                {item.isAdminMessage && (
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>Admin</Text>
                  </View>
                )}
              </View>
              
              {item.type === 'image' && item.mediaUrl ? (
                <Image source={{ uri: item.mediaUrl }} style={styles.messageImage} />
              ) : item.type === 'voice' ? (
                <View style={styles.voiceMessage}>
                  <IconSymbol name="waveform" size={20} color={colors.textSecondary} />
                  <Text style={styles.voiceText}>Message vocal</Text>
                </View>
              ) : (
                <Text style={[
                  styles.messageText,
                  item.isAdminMessage && styles.adminMessageText
                ]}>{item.content}</Text>
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
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={() => setShowParticipants(!showParticipants)}
          style={styles.participantsButton}
        >
          <IconSymbol name="person.2.fill" size={20} color={colors.text} />
        </TouchableOpacity>
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
        inverted
        contentContainerStyle={[
          styles.messagesContent,
          messages.length === 0 && styles.emptyContent
        ]}
        showsVerticalScrollIndicator={false}
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

      {/* Zone de saisie pour les messages admin */}
      <Animated.View style={[styles.inputBottomWrapper, animatedBottomStyle]}>
        {isActivityHost ? (
          <View style={styles.inputContainer}>
            <View style={styles.adminInputWrapper}>
              <IconSymbol name="shield.fill" size={16} color={colors.primary} />
              <TextInput
                style={styles.textInput}
                placeholder="Message admin (visible par tous)..."
                placeholderTextColor={colors.textSecondary}
                value={messageText}
                onChangeText={setMessageText}
                multiline
                maxLength={1000}
              />
              <TouchableOpacity
                style={[styles.sendButton, (!messageText.trim() || sending) && styles.sendButtonDisabled]}
                onPress={handleSendAdminMessage}
                disabled={!messageText.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <IconSymbol name="arrow.up.circle.fill" size={32} color={colors.primary} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.footer}>
            <IconSymbol name="info.circle.fill" size={16} color={colors.textSecondary} />
            <Text style={styles.footerText}>
              Vous ne pouvez pas envoyer de messages dans ce groupe
            </Text>
          </View>
        )}
      </Animated.View>
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
  },
  backButton: {
    padding: 8,
  },
  participantsButton: {
    padding: 8,
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
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  senderName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  adminMessageBubble: {
    backgroundColor: colors.primary + '15',
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  adminSenderName: {
    color: colors.primary,
    fontWeight: '700',
  },
  adminBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.background,
  },
  adminMessageText: {
    fontWeight: '600',
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
    paddingVertical: 16,
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
  inputBottomWrapper: {
    backgroundColor: colors.surface,
  },
  inputContainer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  adminInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    paddingLeft: 12,
    paddingRight: 4,
    gap: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    maxHeight: 100,
    paddingVertical: 10,
  },
  sendButton: {
    padding: 4,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});