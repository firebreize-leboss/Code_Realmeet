// app/chat-detail.tsx
// Version avec navigation vers profil/groupe, option sourdine ET markAsRead

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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
// ✅ MODIFICATION : Ajouter useConversations pour markAsRead
import { useMessages, useConversations, TransformedMessage } from '@/hooks/useMessaging';
import { Keyboard } from 'react-native';
import { messageStorageService } from '@/services/message-storage.service';
import { voiceMessageService } from '@/services/voice-message.service';
import { blockService } from '@/services/block.service';
import ReportModal from '@/components/ReportModal';

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

  const insets = useSafeAreaInsets();

  // États de base
  const [convName, setConvName] = useState('Conversation');
  const [convImage, setConvImage] = useState('');
  const [isGroup, setIsGroup] = useState(false);
  const [activityId, setActivityId] = useState<string | null>(null);
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
  
  // États pour le modal et la sourdine
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // États pour le signalement
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTargetMessageId, setReportTargetMessageId] = useState<string | null>(null);

  const { messages, loading: messagesLoading, sendMessage, currentUserId } = useMessages(conversationId as string);

  // ✅ MODIFICATION : Récupérer markAsRead depuis useConversations
  const { markAsRead } = useConversations();

  const [keyboardExtraOffset, setKeyboardExtraOffset] = useState(0);

  
  // ✅ NOUVEAU : Marquer la conversation comme lue quand on l'ouvre
  useEffect(() => {
    if (conversationId) {
      // Marquer comme lue immédiatement
      markAsRead(conversationId as string);
      
      // Et aussi marquer comme lue quand on reçoit de nouveaux messages
      // (au cas où on reste sur la conversation)
    }
  }, [conversationId, markAsRead]);

  // ✅ NOUVEAU : Marquer comme lue quand de nouveaux messages arrivent (on est sur la conversation)
  useEffect(() => {
    if (conversationId && messages && messages.length > 0) {
      markAsRead(conversationId as string);
    }
  }, [messages, conversationId, markAsRead]);

  // Charger les infos de conversation (OPTIMISÉ - requêtes groupées)
  useEffect(() => {
    const loadConversationInfo = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const currentUser = userData?.user;
        if (!currentUser) return;

        if (!conversationId) return;

        // Charger les infos de conversation
        const { data: convDataRaw } = await supabase
          .from('conversations')
          .select('*, name, image_url, is_closed, closed_reason, closed_at, activity_id, slot_id')
          .eq('id', conversationId)
          .single();

        const convData = convDataRaw as any;
        if (!convData) return;

        const isGroupConv = convData.is_group === true || !convData.name;
        setIsGroup(isGroupConv);

        // REQUÊTE GROUPÉE 2: Charger slot et participants en parallèle si nécessaire
        const requests: any[] = [];

        if (convData.slot_id) {
          requests.push(
            supabase
              .from('activity_slots')
              .select('activity_id, date, time, duration')
              .eq('id', convData.slot_id)
              .single()
          );
        }

        if (!convData.name) {
          requests.push(
            supabase
              .from('conversation_participants')
              .select(`user_id, is_muted, profiles (full_name, avatar_url)`)
              .eq('conversation_id', conversationId)
          );
        }

        const results = requests.length > 0 ? await Promise.all(requests) : [];

        // Traiter les résultats du slot
        if (convData.slot_id && results[0]?.data) {
          const slotData = results[0].data;

          if (slotData?.activity_id) {
            setActivityId(slotData.activity_id);
          }

          // Vérifier si le créneau est passé
          if (slotData && !convData.is_closed) {
            const slotDateTime = new Date(`${slotData.date}T${slotData.time || '00:00'}`);
            const slotDuration = slotData.duration || 60;
            const slotEndTime = new Date(slotDateTime.getTime() + slotDuration * 60000);
            const now = new Date();

            if (now > slotEndTime) {
              await supabase
                .from('conversations')
                .update({
                  is_closed: true,
                  closed_reason: 'Le créneau de cette activité est terminé',
                  closed_at: new Date().toISOString(),
                })
                .eq('id', conversationId);

              convData.is_closed = true;
              convData.closed_reason = 'Le créneau de cette activité est terminé';
              convData.closed_at = new Date().toISOString();
            }
          }
        } else if (convData.activity_id) {
          setActivityId(convData.activity_id);
        }

        setConversationStatus({
          isClosed: convData.is_closed || false,
          closedReason: convData.closed_reason,
          closedAt: convData.closed_at,
        });

        if (convData.name) {
          setConvName(convData.name);
          setConvImage(convData.image_url || '');
        } else {
          // Traiter les participants
          const participantsIndex = convData.slot_id ? 1 : 0;
          const participants = results[participantsIndex]?.data;

          if (participants) {
            const myParticipant = participants.find((p: any) => p.user_id === currentUser.id);
            if (myParticipant) {
              setIsMuted(myParticipant.is_muted || false);
            }

            const otherParticipant = participants.find((p: any) => p.user_id !== currentUser.id);

            if (otherParticipant) {
              setOtherUserId(otherParticipant.user_id);
              const profile = (otherParticipant as any).profiles;
              setConvName(profile?.full_name || 'Utilisateur');
              setConvImage(profile?.avatar_url || '');

              // REQUÊTE GROUPÉE 3: Vérifier le blocage en parallèle
              const [blocked, blockedByOther] = await Promise.all([
                blockService.isUserBlocked(otherParticipant.user_id),
                blockService.amIBlockedBy(otherParticipant.user_id)
              ]);

              setIsBlocked(blocked);
              setHasBlockedMe(blockedByOther);
            }
          }
        }
      } catch (error) {
        console.error('Erreur loading conversation info:', error);
      }
    };

    loadConversationInfo();
  }, [conversationId]);

  useEffect(() => {
    Keyboard.dismiss();
  }, [conversationId]);

useEffect(() => {
  const sub = Keyboard.addListener('keyboardDidChangeFrame', e => {
    if (!e.endCoordinates) {
      setKeyboardExtraOffset(0);
      return;
    }

    // petite marge visuelle constante
    setKeyboardExtraOffset(10);
  });

  const hideSub = Keyboard.addListener('keyboardDidHide', () => {
    setKeyboardExtraOffset(0);
  });

  return () => {
    sub.remove();
    hideSub.remove();
  };
}, []);

  
  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      voiceMessageService.cleanup();
    };
  }, []);

  const canSendMessages = (): boolean => {
    if (conversationStatus.isClosed) return false;
    if (isBlocked || hasBlockedMe) return false;
    return true;
  };

  const getInputWarning = (): string | null => {
    if (conversationStatus.isClosed) {
      if (conversationStatus.closedReason === 'activity_ended') {
        return "L'activité est terminée. Vous ne pouvez plus envoyer de messages.";
      }
      return 'Cette conversation est fermée.';
    }
    if (isBlocked) return 'Vous avez bloqué cet utilisateur.';
    if (hasBlockedMe) return 'Vous ne pouvez pas envoyer de messages à cet utilisateur.';
    return null;
  };

  // Navigation vers profil OU groupe
  const handleHeaderPress = () => {
    if (isGroup) {
      router.push(`/group-info?id=${conversationId}`);
    } else if (otherUserId) {
      router.push(`/user-profile?id=${otherUserId}`);
    }
  };

  const handleToggleMute = async () => {
    if (!conversationId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const newMutedState = !isMuted;

      const { error } = await supabase
        .from('conversation_participants')
        .update({ is_muted: newMutedState })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);

      if (error) throw error;

      setIsMuted(newMutedState);
      setShowOptionsModal(false);
      Alert.alert(
        'Succès',
        newMutedState ? 'Conversation mise en sourdine' : 'Notifications réactivées'
      );
    } catch (error) {
      console.error('Erreur toggle mute:', error);
      Alert.alert('Erreur', 'Impossible de modifier les notifications');
    }
  };

  // Gestion du long press sur un message pour signaler
  const handleMessageLongPress = (messageId: string, senderId: string) => {
    if (senderId === currentUserId) return;

    Alert.alert(
      'Options du message',
      'Que souhaitez-vous faire ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Signaler ce message',
          style: 'destructive',
          onPress: () => {
            setReportTargetMessageId(messageId);
            setShowReportModal(true);
          },
        },
      ]
    );
  };

  // Ouvrir le profil pour signaler l'utilisateur
  const handleReportUser = () => {
    setShowOptionsModal(false);
    if (otherUserId) {
      setTimeout(() => {
        router.push(`/user-profile?id=${otherUserId}`);
      }, 300);
    }
  };

  const handleSend = async () => {
    if (!message.trim() || !canSendMessages()) return;

    const userMessage = message.trim();
    setMessage('');
    Keyboard.dismiss();

    try {
      await sendMessage(userMessage, 'text');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleImagePick = async () => {
    if (!canSendMessages()) {
      Alert.alert('Action impossible', getInputWarning() || '');
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', "L'accès à la galerie est nécessaire");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        try {
          const uploadedUrl = await messageStorageService.uploadImage(result.assets[0].uri);
          await sendMessage('', 'image', uploadedUrl);
        } catch (error) {
          Alert.alert('Erreur', "Impossible d'envoyer l'image");
        }
      }
    } catch (error) {
      console.error('Erreur ImagePicker:', error);
    }
  };

  const handleStartRecording = async () => {
    if (!canSendMessages()) {
      Alert.alert('Action impossible', getInputWarning() || '');
      return;
    }

    try {
      const started = await voiceMessageService.startRecording();
      if (started) {
        setIsRecording(true);
        setRecordingTime(0);
        recordingIntervalRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      }
    } catch (error) {
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

    // ✅ Vérifier le succès et extraire l'URI correctement
    if (!result.success || !result.uri) {
      console.error('Erreur enregistrement:', result.error);
      Alert.alert('Erreur', result.error || "Impossible d'enregistrer le message vocal");
      return;
    }

    const uri = result.uri;
    const duration = result.duration || recordingTime;

    if (duration >= 1) {
      try {
        const uploadedUrl = await messageStorageService.uploadVoiceMessage(uri);
        if (uploadedUrl) {
          await sendMessage('', 'voice', uploadedUrl, duration);
        } else {
          throw new Error('Upload failed');
        }
      } catch (error) {
        console.error('Erreur upload message vocal:', error);
        Alert.alert('Erreur', "Impossible d'envoyer le message vocal");
      }
    }
  } catch (error) {
    console.error('Erreur stop recording:', error);
    setIsRecording(false);
    setRecordingTime(0);
  }
};

  const handlePlayVoice = async (messageId: string, voiceUrl: string) => {
    if (playingVoiceId === messageId) {
      await voiceMessageService.stopPlayback();
      setPlayingVoiceId(null);
    } else {
      if (playingVoiceId) await voiceMessageService.stopPlayback();
      await voiceMessageService.playVoiceMessage(voiceUrl);
      setPlayingVoiceId(messageId);
      setTimeout(() => setPlayingVoiceId(null), 5000);
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

  const renderMessage = (msg: Message) => {
    const isOwnMessage = msg.senderId === currentUserId;
    const isSystemMessage = msg.type === 'system';

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
          <Image source={{ uri: msg.senderAvatar || 'https://via.placeholder.com/40' }} style={styles.messageAvatar} />
        )}

        <TouchableOpacity
          style={[styles.messageBubble, isOwnMessage && styles.ownMessageBubble]}
          activeOpacity={0.8}
          onLongPress={() => handleMessageLongPress(msg.id, msg.senderId)}
          delayLongPress={500}
          disabled={isOwnMessage}
        >
          {!isOwnMessage && isGroup && <Text style={styles.senderName}>{msg.senderName}</Text>}

          {msg.text && <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>{msg.text}</Text>}

          {msg.imageUrl && <Image source={{ uri: msg.imageUrl }} style={styles.messageImage} />}

          {msg.voiceUrl && (
            <TouchableOpacity style={styles.voiceMessage} onPress={() => handlePlayVoice(msg.id, msg.voiceUrl!)}>
              <View style={[styles.voicePlayButton, isOwnMessage && styles.voicePlayButtonOwn]}>
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
                    style={[styles.waveformBar, { height: 8 + Math.random() * 16 }, isOwnMessage && styles.waveformBarOwn]}
                  />
                ))}
              </View>
              <Text style={[styles.voiceDuration, isOwnMessage && styles.voiceDurationOwn]}>
                {formatDuration(msg.voiceDuration || 0)}
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.messageFooter}>
            <Text style={[styles.messageTime, isOwnMessage && styles.messageTimeOwn]}>{msg.timestamp}</Text>
            {isOwnMessage && msg.status && (
              <View style={styles.statusContainer}>
                {msg.status === 'sending' && <ActivityIndicator size="small" color={colors.textSecondary} />}
                {msg.status === 'sent' && <IconSymbol name="checkmark" size={14} color={colors.textSecondary} />}
                {msg.status === 'delivered' && (
                  <View style={styles.doubleCheck}>
                    <IconSymbol name="checkmark" size={14} color={colors.textSecondary} />
                    <IconSymbol name="checkmark" size={14} color={colors.textSecondary} />
                  </View>
                )}
                {msg.status === 'failed' && <IconSymbol name="exclamationmark.circle" size={14} color={colors.error} />}
              </View>
            )}
          </View>
        </TouchableOpacity>
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

        <TouchableOpacity
  style={styles.headerCenter}
  onPress={() => {
    if (isGroup) {
      router.push(`/group-info?id=${conversationId}`);
    } else if (otherUserId) {
      router.push(`/user-profile?id=${otherUserId}`);
    }
  }}
>
  {convImage && (
    <Image
      source={{ uri: convImage }}
      style={styles.headerActivityImage}
    />
  )}

  <View style={styles.headerTitleContainer}>
    <Text style={styles.headerTitle} numberOfLines={1}>{convName}</Text>
    {isGroup && (
      <Text style={styles.headerSubtitle}>Groupe</Text>
    )}
  </View>
</TouchableOpacity>


        {/* Bouton Voir l'activité pour les groupes d'activité */}
        {isGroup && activityId && (
          <TouchableOpacity
            style={styles.viewActivityButton}
            onPress={async () => {
              try {
                // Vérifier si l'activité existe toujours avant de naviguer
                const { data: activityExists, error } = await supabase
                  .from('activities')
                  .select('id')
                  .eq('id', activityId)
                  .maybeSingle();

                if (error || !activityExists) {
                  Alert.alert(
                    'Activité non disponible',
                    'Cette activité n\'existe plus ou a été supprimée.'
                  );
                  return;
                }

                router.push(`/activity-detail?id=${activityId}`);
              } catch (e) {
                Alert.alert(
                  'Erreur',
                  'Impossible d\'accéder à cette activité.'
                );
              }
            }}
          >
            <IconSymbol name="calendar" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.moreButton} onPress={() => setShowOptionsModal(true)}>
          <IconSymbol name="ellipsis" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <ScrollView ref={scrollViewRef} style={styles.messagesContainer} contentContainerStyle={styles.messagesContent} showsVerticalScrollIndicator={false}>
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

          {(messagesLoading || !currentUserId) ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            messages.map(renderMessage)
          )}
        </ScrollView>

        {/* Zone de saisie */}
       <View
  style={[
    styles.inputContainer,
    { paddingBottom: Math.max(insets.bottom, 12) + keyboardExtraOffset },
  ]}
>


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
              <TouchableOpacity style={styles.iconButton} onPress={handleImagePick} disabled={!canSendMessages()}>
                <IconSymbol name="photo" size={24} color={canSendMessages() ? colors.primary : colors.textSecondary} />
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
                <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={!canSendMessages()}>
                  <IconSymbol name="arrow.up.circle.fill" size={32} color={colors.primary} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.iconButton} onPress={handleStartRecording} disabled={!canSendMessages()}>
                  <IconSymbol name="mic.fill" size={24} color={canSendMessages() ? colors.primary : colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Modal Options */}
      <Modal visible={showOptionsModal} transparent animationType="fade" onRequestClose={() => setShowOptionsModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowOptionsModal(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Options</Text>

            <TouchableOpacity style={styles.modalOption} onPress={handleToggleMute}>
              <IconSymbol name={isMuted ? 'bell.fill' : 'bell.slash.fill'} size={20} color={isMuted ? colors.primary : colors.textSecondary} />
              <Text style={styles.modalOptionText}>{isMuted ? 'Réactiver les notifications' : 'Mettre en sourdine'}</Text>
            </TouchableOpacity>

            {/* Option Signaler - seulement pour les conversations privées */}
            {!isGroup && otherUserId && (
              <TouchableOpacity style={styles.modalOption} onPress={handleReportUser}>
                <IconSymbol name="flag.fill" size={20} color={colors.error} />
                <Text style={[styles.modalOptionText, { color: colors.error }]}>Signaler cet utilisateur</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.modalOption} onPress={() => setShowOptionsModal(false)}>
              <IconSymbol name="xmark" size={20} color={colors.textSecondary} />
              <Text style={styles.modalOptionText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal Signalement de message */}
      <ReportModal
        visible={showReportModal}
        onClose={() => {
          setShowReportModal(false);
          setReportTargetMessageId(null);
        }}
        targetType="message"
        targetId={reportTargetMessageId || ''}
      />
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
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  closedBadge: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  groupSubtitle: {
    fontSize: 12,
    color: colors.primary,
    marginTop: 2,
  },
  headerCenter: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  marginHorizontal: 12,
  gap: 10,
},

headerActivityImage: {
  width: 40,
  height: 40,
  borderRadius: 20, // rond
  borderWidth: 2,
  borderColor: colors.background,
},
headerTitleContainer: {
  flex: 1,
  justifyContent: 'center',
},

  moreButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewActivityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  closedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 10,
  },
  closedBannerText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  systemMessageText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  ownMessageRow: {
    justifyContent: 'flex-end',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '75%',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    padding: 12,
  },
  ownMessageBubble: {
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
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
  paddingTop: 12,
},

  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '20',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: colors.warning,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
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
    width: 40,
    height: 40,
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
    gap: 8,
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
    backgroundColor: colors.error + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  headerTitle: {
  fontSize: 17,
  fontWeight: '700',
  color: colors.text,         // ou '#fff' si ton header est sombre
  letterSpacing: 0.2,
},
headerSubtitle: {
  fontSize: 12,
  fontWeight: '600',
  color: colors.primary,      // petit accent couleur
  opacity: 0.9,
},
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalOptionText: {
    fontSize: 16,
    color: colors.text,
  },
});