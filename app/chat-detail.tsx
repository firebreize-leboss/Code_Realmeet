// app/chat-detail.tsx
// Version corrigée avec chargement proper des infos de conversation

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
        console.log('🔄 Début chargement conversation:', conversationId);
        
        const { data: userData } = await supabase.auth.getUser();
        const currentUser = userData?.user;
        
        if (currentUser) {
          setCurrentUserId(currentUser.id);
          console.log('👤 Utilisateur actuel:', currentUser.id);
          
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
          const { data: convData, error: convDataError } = await supabase
            .from('conversations')
            .select('name, image_url, is_group, activity_id, is_closed, closed_at, closed_reason')
            .eq('id', conversationId)
            .single();

          console.log('📊 Données de conversation:', convData);
          console.log('❌ Erreur conversation:', convDataError);

          if (convData) {
            setIsGroup(convData.is_group || false);
            setConversationStatus({
              isClosed: convData.is_closed || false,
              closedReason: convData.closed_reason,
              closedAt: convData.closed_at,
            });

            if (convData.name) {
              console.log('✅ Nom de groupe trouvé:', convData.name);
              setConvName(convData.name);
              setConvImage(convData.image_url || '');
            } else {
              // Conversation 1-to-1
              console.log('🔍 Recherche des participants pour conversation 1-to-1...');
              const { data: participants, error: partError } = await supabase
                .from('conversation_participants')
                .select(`
                  user_id,
                  profiles (
                    full_name,
                    avatar_url
                  )
                `)
                .eq('conversation_id', conversationId);

              console.log('👥 Participants trouvés:', JSON.stringify(participants, null, 2));
              console.log('❌ Erreur participants:', partError);

              const otherParticipant = participants?.find(
                (p: any) => p.user_id !== currentUser?.id
              );

              console.log('👤 Autre participant:', JSON.stringify(otherParticipant, null, 2));

              if (otherParticipant) {
                setOtherUserId(otherParticipant.user_id);
                const profile = (otherParticipant as any).profiles;
                
                console.log('📝 Profile de l\'autre participant:', profile);
                
                setConvName(profile?.full_name || 'Utilisateur');
                setConvImage(profile?.avatar_url || '');

                console.log('✅ Nom final défini:', profile?.full_name || 'Utilisateur');

                // Vérifier les blocages
                const blocked = await blockService.isUserBlocked(otherParticipant.user_id);
                setIsBlocked(blocked);
                
                const blockedByOther = await blockService.amIBlockedBy(otherParticipant.user_id);
                setHasBlockedMe(blockedByOther);
              } else {
                console.log('⚠️ Aucun autre participant trouvé');
              }
            }
          } else {
            console.log('⚠️ Aucune donnée de conversation trouvée');
          }
        }
      } catch (error) {
        console.error('❌ Erreur loading conversation info:', error);
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

  const handleSend = async () => {
    if (!message.trim() || !canSendMessages()) return;

    const userMessage = message.trim();
    setMessage('');
    Keyboard.dismiss();

    // Message optimiste
    const optimisticId = `temp-${Date.now()}`;
    const optimisticMessage: Message = {
      id: optimisticId,
      senderId: currentUserId!,
      senderName: currentUserName,
      senderAvatar: currentUserAvatar,
      text: userMessage,
      timestamp: new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      status: 'sending' as MessageStatus,
    };

    setLocalMessages(prev => [...prev, optimisticMessage]);

    try {
      await sendMessage(conversationId as string, userMessage, 'text');
      setLocalMessages(prev => prev.filter(msg => msg.id !== optimisticId));
    } catch (error) {
      setLocalMessages(prev =>
        prev.map(msg =>
          msg.id === optimisticId ? { ...msg, status: 'failed' as MessageStatus } : msg
        )
      );
      Alert.alert('Erreur', "Impossible d'envoyer le message");
    }
  };

  const handleImagePick = async () => {
    if (!canSendMessages()) {
      Alert.alert('Action impossible', getInputWarning() || '');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;

      const optimisticId = `temp-${Date.now()}`;
      const optimisticMessage: Message = {
        id: optimisticId,
        senderId: currentUserId!,
        senderName: currentUserName,
        senderAvatar: currentUserAvatar,
        imageUrl: uri,
        timestamp: new Date().toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        status: 'sending' as MessageStatus,
      };

      setLocalMessages(prev => [...prev, optimisticMessage]);

      try {
        const uploadedUrl = await messageStorageService.uploadImage(uri);
        await sendMessage(conversationId as string, '', 'image', uploadedUrl);
        setLocalMessages(prev => prev.filter(msg => msg.id !== optimisticId));
      } catch (error) {
        console.error('Error sending image:', error);
        setLocalMessages(prev =>
          prev.map(msg =>
            msg.id === optimisticId ? { ...msg, status: 'failed' as MessageStatus } : msg
          )
        );
        Alert.alert('Erreur', "Impossible d'envoyer l'image");
      }
    }
  };

  // Gestion des messages vocaux
  const handleStartRecording = async () => {
    if (!canSendMessages()) {
      Alert.alert('Action impossible', getInputWarning() || '');
      return;
    }

    try {
      await voiceMessageService.startRecording();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Erreur', "Impossible de démarrer l'enregistrement");
    }
  };

  const handleStopRecording = async () => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    try {
      const result = await voiceMessageService.stopRecording();
      setIsRecording(false);
      setRecordingTime(0);

      if (result) {
        const optimisticId = `temp-${Date.now()}`;
        const optimisticMessage: Message = {
          id: optimisticId,
          senderId: currentUserId!,
          senderName: currentUserName,
          senderAvatar: currentUserAvatar,
          voiceUrl: result.uri,
          voiceDuration: result.duration,
          timestamp: new Date().toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          status: 'sending' as MessageStatus,
        };

        setLocalMessages(prev => [...prev, optimisticMessage]);

        try {
          const uploadedUrl = await messageStorageService.uploadVoiceMessage(result.uri);
          await sendMessage('', 'voice', uploadedUrl, result.duration);
          setLocalMessages(prev => prev.filter(msg => msg.id !== optimisticId));
        } catch (error) {
          console.error('Error sending voice message:', error);
          setLocalMessages(prev =>
            prev.map(msg =>
              msg.id === optimisticId ? { ...msg, status: 'failed' as MessageStatus } : msg
            )
          );
          Alert.alert('Erreur', "Impossible d'envoyer le message vocal");
        }
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      setIsRecording(false);
      setRecordingTime(0);
    }
  };

  const handlePlayVoice = async (messageId: string, voiceUrl: string) => {
    if (playingVoiceId === messageId) {
      await voiceMessageService.stopPlayback();
      setPlayingVoiceId(null);
    } else {
      if (playingVoiceId) {
        await voiceMessageService.stopPlayback();
      }
      await voiceMessageService.playVoiceMessage(voiceUrl);
      setPlayingVoiceId(messageId);

      setTimeout(() => {
        setPlayingVoiceId(null);
      }, 5000);
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (duration: number) => {
    const mins = Math.floor(duration / 60);
    const secs = Math.floor(duration % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleBlockUser = async () => {
    if (!otherUserId) return;

    Alert.alert(
      'Bloquer cet utilisateur',
      'Vous ne pourrez plus recevoir de messages de cette personne.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Bloquer',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockService.blockUser(otherUserId);
              setIsBlocked(true);
              setShowOptionsModal(false);
              Alert.alert('Succès', 'Utilisateur bloqué');
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de bloquer cet utilisateur');
            }
          },
        },
      ]
    );
  };

  const handleUnblockUser = async () => {
    if (!otherUserId) return;

    try {
      await blockService.unblockUser(otherUserId);
      setIsBlocked(false);
      setShowOptionsModal(false);
      Alert.alert('Succès', 'Utilisateur débloqué');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de débloquer cet utilisateur');
    }
  };

  const handleViewProfile = () => {
    setShowOptionsModal(false);
    if (otherUserId) {
      router.push(`/user-profile?id=${otherUserId}`);
    }
  };

  const renderMessage = (msg: Message) => {
    const isOwnMessage = msg.senderId === currentUserId;
    const isSystemMessage = msg.messageType === 'system';

    if (isSystemMessage) {
      return (
        <View key={msg.id} style={styles.systemMessageContainer}>
          <Text style={styles.systemMessageText}>{msg.text}</Text>
        </View>
      );
    }

    return (
      <View key={msg.id} style={[styles.messageRow, isOwnMessage && styles.ownMessageRow]}>
        {!isOwnMessage && (
          <Image
            source={{ uri: msg.senderAvatar || 'https://via.placeholder.com/40' }}
            style={styles.messageAvatar}
          />
        )}

        <View style={[styles.messageBubble, isOwnMessage && styles.ownMessageBubble]}>
          {!isOwnMessage && <Text style={styles.senderName}>{msg.senderName}</Text>}

          {msg.text && (
            <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>
              {msg.text}
            </Text>
          )}

          {msg.imageUrl && (
            <Image source={{ uri: msg.imageUrl }} style={styles.messageImage} />
          )}

          {msg.voiceUrl && (
            <TouchableOpacity
              style={styles.voiceMessage}
              onPress={() => handlePlayVoice(msg.id, msg.voiceUrl!)}
            >
              <View
                style={[
                  styles.voicePlayButton,
                  isOwnMessage && styles.voicePlayButtonOwn,
                ]}
              >
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
            {isOwnMessage && msg.status && (
              <View style={styles.statusContainer}>
                {msg.status === 'sending' && (
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                )}
                {msg.status === 'sent' && (
                  <IconSymbol name="checkmark" size={14} color={colors.textSecondary} />
                )}
                {msg.status === 'delivered' && (
                  <View style={styles.doubleCheck}>
                    <IconSymbol name="checkmark" size={14} color={colors.textSecondary} />
                    <IconSymbol name="checkmark" size={14} color={colors.textSecondary} />
                  </View>
                )}
                {msg.status === 'failed' && (
                  <IconSymbol name="exclamationmark.circle" size={14} color={colors.error} />
                )}
              </View>
            )}
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
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            combinedMessages.map(renderMessage)
          )}
        </ScrollView>

        {/* Zone de saisie */}
        <View style={styles.inputContainer}>
          {inputWarning && (
            <View style={styles.warningBanner}>
              <IconSymbol name="exclamationmark.triangle.fill" size={16} color={colors.warning} />
              <Text style={styles.warningText}>{inputWarning}</Text>
            </View>
          )}

          {isRecording ? (
            <View style={styles.recordingContainer}>
              <View style={styles.recordingIndicator}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingTime}>{formatRecordingTime(recordingTime)}</Text>
              </View>
              <TouchableOpacity style={styles.stopRecordingButton} onPress={handleStopRecording}>
                <IconSymbol name="stop.fill" size={24} color={colors.error} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.inputRow}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={handleImagePick}
                disabled={!canSendMessages()}
              >
                <IconSymbol
                  name="photo"
                  size={24}
                  color={canSendMessages() ? colors.primary : colors.textSecondary}
                />
              </TouchableOpacity>

              <TextInput
                style={styles.input}
                placeholder="Message..."
                placeholderTextColor={colors.textSecondary}
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={500}
                editable={canSendMessages()}
              />

              {message.trim() ? (
                <TouchableOpacity
                  style={styles.sendButton}
                  onPress={handleSend}
                  disabled={!canSendMessages()}
                >
                  <IconSymbol name="arrow.up.circle.fill" size={32} color={colors.primary} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={handleStartRecording}
                  disabled={!canSendMessages()}
                >
                  <IconSymbol
                    name="mic.fill"
                    size={24}
                    color={canSendMessages() ? colors.primary : colors.textSecondary}
                  />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Modal Options */}
      <Modal
        visible={showOptionsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOptionsModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowOptionsModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Options</Text>
            
            {!isGroup && (
              <>
                <TouchableOpacity style={styles.modalOption} onPress={handleViewProfile}>
                  <IconSymbol name="person.fill" size={20} color={colors.text} />
                  <Text style={styles.modalOptionText}>Voir le profil</Text>
                </TouchableOpacity>

                {isBlocked ? (
                  <TouchableOpacity style={styles.modalOption} onPress={handleUnblockUser}>
                    <IconSymbol name="checkmark.circle" size={20} color={colors.success} />
                    <Text style={styles.modalOptionText}>Débloquer</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.modalOption} onPress={handleBlockUser}>
                    <IconSymbol name="hand.raised.fill" size={20} color={colors.error} />
                    <Text style={styles.modalOptionText}>Bloquer</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => setShowOptionsModal(false)}
            >
              <IconSymbol name="xmark" size={20} color={colors.textSecondary} />
              <Text style={styles.modalOptionText}>Annuler</Text>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    gap: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.border,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  closedBadge: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  moreButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 32,
  },
  closedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  closedBannerText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  systemMessageText: {
    fontSize: 13,
    color: colors.textSecondary,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
    gap: 8,
  },
  ownMessageRow: {
    flexDirection: 'row-reverse',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.border,
  },
  messageBubble: {
    maxWidth: '75%',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 12,
  },
  ownMessageBubble: {
    backgroundColor: colors.primary,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 20,
  },
  ownMessageText: {
    color: colors.background,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginTop: 4,
  },
  voiceMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  voicePlayButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voicePlayButtonOwn: {
    backgroundColor: colors.background,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flex: 1,
  },
  waveformBar: {
    width: 3,
    backgroundColor: colors.textSecondary,
    borderRadius: 2,
  },
  waveformBarOwn: {
    backgroundColor: colors.background,
  },
  voiceDuration: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  voiceDurationOwn: {
    color: colors.background,
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
    color: colors.background,
    opacity: 0.7,
  },
  statusContainer: {
    marginLeft: 4,
  },
  doubleCheck: {
    flexDirection: 'row',
    marginLeft: -8,
  },
  inputContainer: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: colors.warning,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    maxHeight: 100,
  },
  sendButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.error,
  },
  recordingTime: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  stopRecordingButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  modalOptionText: {
    fontSize: 16,
    color: colors.text,
  },
});