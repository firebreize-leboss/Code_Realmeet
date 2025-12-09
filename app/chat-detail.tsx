// app/chat-detail.tsx
// Version mise à jour avec: messages vocaux, blocage, conversations fermées

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useMessages, MessageStatus, TransformedMessage } from '@/hooks/useMessaging';
import { Keyboard } from 'react-native';
import { messageStorageService } from '@/services/message-storage.service';
import { voiceMessageService } from '@/services/voice-message.service';
import { blockService } from '@/services/block.service';

type MessageType = 'text' | 'image' | 'voice' | 'system';

interface Message extends TransformedMessage {}

interface ConversationStatus {
  isClosed: boolean;
  closedReason?: string;
  closedAt?: string;
}

export default function ChatDetailScreen() {
  const router = useRouter();
  const { id: conversationId } = useLocalSearchParams();
  const scrollViewRef = useRef<ScrollView>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // États de base
  const [convName, setConvName] = useState('Conversation');
  const [convImage, setConvImage] = useState('');
  const [isGroup, setIsGroup] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState('Moi');
  const [currentUserAvatar, setCurrentUserAvatar] = useState('');
  const [message, setMessage] = useState('');
  const [otherUserId, setOtherUserId] = useState<string | null>(null);

  // États pour les messages vocaux
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  // États pour la conversation fermée
  const [conversationStatus, setConversationStatus] = useState<ConversationStatus>({
    isClosed: false,
  });

  // États pour le blocage
  const [isBlocked, setIsBlocked] = useState(false);
  const [hasBlockedMe, setHasBlockedMe] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);

  const [localMessages, setLocalMessages] = useState<Message[]>([]);

  const { messages, loading: messagesLoading, sendMessage } = useMessages(conversationId as string);
  const combinedMessages: Message[] = [...(messages || []), ...localMessages];

  // Charger les infos de conversation
  useEffect(() => {
    const loadConversationInfo = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const currentUser = userData?.user;
        if (currentUser) {
          setCurrentUserId(currentUser.id);
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', currentUser.id)
            .single();
          if (profileData) {
            setCurrentUserName(profileData.full_name || 'Moi');
            setCurrentUserAvatar(profileData.avatar_url || '');
          }
        }

        if (conversationId) {
          // Marquer comme lu
          if (currentUser) {
            await supabase
              .from('conversation_participants')
              .update({ last_read_at: new Date().toISOString() })
              .eq('conversation_id', conversationId)
              .eq('user_id', currentUser.id);
          }

          // Récupérer les infos de la conversation
          const { data: convData } = await supabase
            .from('conversations')
            .select('name, image, is_group, activity_id, is_closed, closed_at, closed_reason')
            .eq('id', conversationId)
            .single();

          if (convData) {
            setIsGroup(convData.is_group || false);
            setConversationStatus({
              isClosed: convData.is_closed || false,
              closedReason: convData.closed_reason,
              closedAt: convData.closed_at,
            });

            if (convData.name) {
              setConvName(convData.name);
              setConvImage(convData.image || '');
            } else {
              // Conversation 1-to-1
              const { data: participants } = await supabase
                .from('conversation_participants')
                .select('user_id, profiles:user_id(full_name, avatar_url)')
                .eq('conversation_id', conversationId);

              const otherParticipant = participants?.find(
                (p: any) => p.user_id !== currentUser?.id
              );

              if (otherParticipant) {
                setOtherUserId(otherParticipant.user_id);
                const profile = (otherParticipant as any).profiles;
                setConvName(profile?.full_name || 'Utilisateur');
                setConvImage(profile?.avatar_url || '');

                // Vérifier les blocages
                const blocked = await blockService.isUserBlocked(otherParticipant.user_id);
                setIsBlocked(blocked);
                
                const blockedByOther = await blockService.amIBlockedBy(otherParticipant.user_id);
                setHasBlockedMe(blockedByOther);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error loading conversation info:', error);
      }
    };

    loadConversationInfo();
  }, [conversationId]);

  useEffect(() => {
    Keyboard.dismiss();
  }, [conversationId]);

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [combinedMessages]);

  // Nettoyage à la fermeture
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      voiceMessageService.cleanup();
    };
  }, []);

  // Vérifier si on peut envoyer des messages
  const canSendMessages = (): boolean => {
    if (conversationStatus.isClosed) return false;
    if (isBlocked || hasBlockedMe) return false;
    return true;
  };

  // Obtenir le message d'avertissement pour la zone de saisie
  const getInputWarning = (): string | null => {
    if (conversationStatus.isClosed) {
      if (conversationStatus.closedReason === 'activity_ended') {
        return "L'activité est terminée. Vous ne pouvez plus envoyer de messages.";
      }
      return 'Cette conversation est fermée.';
    }
    if (isBlocked) {
      return 'Vous avez bloqué cet utilisateur.';
    }
    if (hasBlockedMe) {
      return 'Vous ne pouvez pas envoyer de messages à cet utilisateur.';
    }
    return null;
  };

  // Envoyer un message texte
  const handleSendText = async () => {
    if (!canSendMessages()) return;
    
    const messageToSend = message.trim();
    if (messageToSend) {
      setMessage('');
      if (Platform.OS === 'ios') {
        Keyboard.dismiss();
      }
      try {
        await sendMessage(messageToSend, 'text');
      } catch (error) {
        console.error('Error sending message:', error);
        setMessage(messageToSend);
        Alert.alert('Erreur', "Le message n'a pas pu être envoyé");
      }
    }
  };

  // === MESSAGES VOCAUX ===
  const handleStartRecording = async () => {
    if (!canSendMessages()) return;

    const result = await voiceMessageService.startRecording();
    if (result.success) {
      setIsRecording(true);
      setRecordingTime(0);
      
      // Timer pour afficher la durée
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(voiceMessageService.getCurrentRecordingDuration());
      }, 100);
    } else {
      Alert.alert('Erreur', result.error || 'Impossible de démarrer l\'enregistrement');
    }
  };

  const handleStopRecording = async () => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    const result = await voiceMessageService.stopRecording();
    setIsRecording(false);

    if (result.success && result.uri && currentUserId) {
      // Durée minimale de 1 seconde
      if ((result.duration || 0) < 1) {
        Alert.alert('Message trop court', 'L\'enregistrement doit durer au moins 1 seconde.');
        return;
      }

      // Upload et envoi
      const uploadResult = await voiceMessageService.uploadVoiceMessage(
        result.uri,
        conversationId as string,
        currentUserId
      );

      if (uploadResult.success && uploadResult.url) {
        await sendMessage('', 'voice', uploadResult.url, result.duration);
      } else {
        Alert.alert('Erreur', 'Impossible d\'envoyer le message vocal');
      }
    }
    
    setRecordingTime(0);
  };

  const handleCancelRecording = async () => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    await voiceMessageService.cancelRecording();
    setIsRecording(false);
    setRecordingTime(0);
  };

  const handlePlayVoice = async (voiceUrl: string, messageId: string) => {
    if (playingVoiceId === messageId) {
      await voiceMessageService.stopPlayback();
      setPlayingVoiceId(null);
    } else {
      await voiceMessageService.stopPlayback();
      const result = await voiceMessageService.playVoiceMessage(voiceUrl);
      if (result.success) {
        setPlayingVoiceId(messageId);
      }
    }
  };

  // === BLOCAGE ===
  const handleBlockUser = async () => {
    if (!otherUserId) return;

    Alert.alert(
      'Bloquer cet utilisateur ?',
      'Vous ne pourrez plus recevoir de messages de cette personne.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Bloquer',
          style: 'destructive',
          onPress: async () => {
            const result = await blockService.blockUser(otherUserId);
            if (result.success) {
              setIsBlocked(true);
              setShowOptionsModal(false);
              Alert.alert('Utilisateur bloqué', 'Vous avez bloqué cet utilisateur.');
            }
          },
        },
      ]
    );
  };

  const handleUnblockUser = async () => {
    if (!otherUserId) return;

    const result = await blockService.unblockUser(otherUserId);
    if (result.success) {
      setIsBlocked(false);
      setShowOptionsModal(false);
      Alert.alert('Utilisateur débloqué', 'Vous pouvez à nouveau échanger des messages.');
    }
  };

  // Sélection d'image
  const handlePickImage = async () => {
    if (!canSendMessages()) return;

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'Accès à la galerie nécessaire.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      if (!asset.base64 || !currentUserId) {
        Alert.alert('Erreur', 'Impossible de lire l\'image.');
        return;
      }

      const uploadResult = await messageStorageService.uploadMessageImage(
        asset,
        conversationId as string,
        currentUserId
      );

      if (uploadResult.success && uploadResult.url) {
        await sendMessage('', 'image', uploadResult.url);
      } else {
        Alert.alert('Erreur', uploadResult.error || 'Impossible d\'uploader l\'image.');
      }
    } catch (error) {
      console.error('Erreur envoi image:', error);
      Alert.alert('Erreur', 'Impossible d\'envoyer l\'image.');
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Rendu des messages
  const renderMessage = (msg: Message) => {
    const isOwnMessage = msg.senderId === currentUserId;
    const isFailed = msg.status === 'failed';

    // Message système
    if (msg.type === 'system') {
      return (
        <View key={msg.id} style={styles.systemMessageWrapper}>
          <View style={styles.systemMessageBubble}>
            <Text style={styles.systemMessageText}>{msg.text}</Text>
          </View>
        </View>
      );
    }

    return (
      <View
        key={msg.id}
        style={[styles.messageWrapper, isOwnMessage && styles.messageWrapperOwn]}
      >
        {!isOwnMessage && isGroup && (
          <Image source={{ uri: msg.senderAvatar || 'https://via.placeholder.com/32' }} style={styles.messageAvatar} />
        )}

        <View style={[
          styles.messageBubble,
          isOwnMessage && styles.messageBubbleOwn,
          isFailed && styles.messageBubbleFailed,
          msg.type === 'image' && styles.imageBubble,
        ]}>
          {!isOwnMessage && isGroup && (
            <Text style={styles.senderName}>{msg.senderName}</Text>
          )}

          {msg.type === 'text' && (
            <Text style={[styles.messageText, isOwnMessage && styles.messageTextOwn]}>
              {msg.text}
            </Text>
          )}

          {msg.type === 'image' && msg.imageUrl && (
            <Image source={{ uri: msg.imageUrl }} style={styles.messageImage} />
          )}

          {msg.type === 'voice' && msg.voiceUrl && (
            <TouchableOpacity
              style={styles.voiceMessage}
              onPress={() => handlePlayVoice(msg.voiceUrl!, msg.id)}
            >
              <View style={[styles.playButton, isOwnMessage && styles.playButtonOwn]}>
                <IconSymbol
                  name={playingVoiceId === msg.id ? 'pause.fill' : 'play.fill'}
                  size={16}
                  color={isOwnMessage ? colors.primary : colors.background}
                />
              </View>
              <View style={styles.waveformContainer}>
                {[...Array(12)].map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.waveformBar,
                      { height: 8 + Math.random() * 16 },
                      isOwnMessage && styles.waveformBarOwn,
                    ]}
                  />
                ))}
              </View>
              <Text style={[styles.voiceDuration, isOwnMessage && styles.voiceDurationOwn]}>
                {formatDuration(msg.voiceDuration || 0)}
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.messageFooter}>
            <Text style={[styles.messageTime, isOwnMessage && styles.messageTimeOwn]}>
              {msg.timestamp}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const inputWarning = getInputWarning();

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerInfo} onPress={() => setShowOptionsModal(true)}>
          <Image source={{ uri: convImage || 'https://via.placeholder.com/40' }} style={styles.headerAvatar} />
          <View>
            <Text style={styles.headerName}>{convName}</Text>
            {conversationStatus.isClosed && (
              <Text style={styles.closedBadge}>Conversation fermée</Text>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.moreButton} onPress={() => setShowOptionsModal(true)}>
          <IconSymbol name="ellipsis" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Bannière de fin si conversation fermée */}
          {conversationStatus.isClosed && (
            <View style={styles.closedBanner}>
              <IconSymbol name="info.circle.fill" size={20} color={colors.textSecondary} />
              <Text style={styles.closedBannerText}>
                {conversationStatus.closedReason === 'activity_ended'
                  ? "L'activité est terminée. Cette conversation est maintenant en lecture seule."
                  : 'Cette conversation est fermée.'}
              </Text>
            </View>
          )}

          {messagesLoading ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : (
            combinedMessages.map(renderMessage)
          )}
        </ScrollView>

        {/* Zone de saisie ou avertissement */}
        {inputWarning ? (
          <View style={styles.warningContainer}>
            <IconSymbol name="exclamationmark.triangle.fill" size={18} color={colors.textSecondary} />
            <Text style={styles.warningText}>{inputWarning}</Text>
            {isBlocked && (
              <TouchableOpacity onPress={handleUnblockUser} style={styles.unblockButton}>
                <Text style={styles.unblockButtonText}>Débloquer</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : isRecording ? (
          <View style={styles.recordingBar}>
            <TouchableOpacity onPress={handleCancelRecording} style={styles.cancelRecordButton}>
              <IconSymbol name="xmark" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>{formatDuration(recordingTime)}</Text>
            </View>
            <TouchableOpacity style={styles.stopRecordingButton} onPress={handleStopRecording}>
              <IconSymbol name="arrow.up" size={20} color={colors.background} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.inputContainer}>
            <TouchableOpacity style={styles.attachButton} onPress={handlePickImage}>
              <IconSymbol name="plus.circle.fill" size={28} color={colors.primary} />
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="Message..."
              placeholderTextColor={colors.textSecondary}
              value={message}
              onChangeText={setMessage}
              multiline
            />

            {message.trim() ? (
              <TouchableOpacity style={styles.sendButton} onPress={handleSendText}>
                <IconSymbol name="arrow.up.circle.fill" size={32} color={colors.primary} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.voiceButton}
                onPress={handleStartRecording}
              >
                <IconSymbol name="mic.fill" size={24} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Modal Options */}
      <Modal
        visible={showOptionsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOptionsModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowOptionsModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />

            {!isGroup && otherUserId && (
              <>
                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={() => {
                    setShowOptionsModal(false);
                    router.push(`/user-profile?id=${otherUserId}`);
                  }}
                >
                  <IconSymbol name="person.fill" size={22} color={colors.text} />
                  <Text style={styles.modalOptionText}>Voir le profil</Text>
                </TouchableOpacity>

                {isBlocked ? (
                  <TouchableOpacity style={styles.modalOption} onPress={handleUnblockUser}>
                    <IconSymbol name="checkmark.circle" size={22} color={colors.primary} />
                    <Text style={[styles.modalOptionText, { color: colors.primary }]}>
                      Débloquer l'utilisateur
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.modalOption} onPress={handleBlockUser}>
                    <IconSymbol name="nosign" size={22} color="#FF3B30" />
                    <Text style={[styles.modalOptionText, { color: '#FF3B30' }]}>
                      Bloquer l'utilisateur
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            <TouchableOpacity
              style={[styles.modalOption, styles.modalOptionCancel]}
              onPress={() => setShowOptionsModal(false)}
            >
              <Text style={styles.modalCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  closedBadge: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  moreButton: {
    padding: 4,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    gap: 8,
  },
  closedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  closedBannerText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  messageWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 4,
    gap: 8,
  },
  messageWrapperOwn: {
    flexDirection: 'row-reverse',
  },
  messageAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  messageBubble: {
    maxWidth: '75%',
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageBubbleOwn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  messageBubbleFailed: {
    borderColor: '#FF3B30',
    opacity: 0.7,
  },
  imageBubble: {
    padding: 4,
    borderRadius: 12,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 20,
  },
  messageTextOwn: {
    color: colors.background,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  messageTime: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  messageTimeOwn: {
    color: colors.background + 'CC',
  },
  voiceMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 160,
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonOwn: {
    backgroundColor: colors.background,
  },
  waveformContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 32,
  },
  waveformBar: {
    width: 3,
    backgroundColor: colors.textSecondary,
    borderRadius: 2,
  },
  waveformBarOwn: {
    backgroundColor: colors.background + '80',
  },
  voiceDuration: {
    fontSize: 12,
    color: colors.textSecondary,
    minWidth: 35,
  },
  voiceDurationOwn: {
    color: colors.background + 'CC',
  },
  systemMessageWrapper: {
    alignItems: 'center',
    marginVertical: 12,
  },
  systemMessageBubble: {
    backgroundColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  systemMessageText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
  },
  unblockButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  unblockButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.background,
  },
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FF3B30' + '15',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelRecordButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF3B30',
  },
  recordingText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  stopRecordingButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  attachButton: {
    padding: 4,
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 100,
    backgroundColor: colors.card,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    padding: 2,
  },
  voiceButton: {
    padding: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginVertical: 12,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 14,
  },
  modalOptionText: {
    fontSize: 17,
    color: colors.text,
  },
  modalOptionCancel: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 8,
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});