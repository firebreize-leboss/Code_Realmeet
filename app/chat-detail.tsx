// app/chat-detail.tsx
// Version premium avec DA orange unique + Manrope

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useMessages, useConversations, TransformedMessage } from '@/hooks/useMessaging';
import { messageStorageService } from '@/services/message-storage.service';
import { voiceMessageService } from '@/services/voice-message.service';
import { blockService } from '@/services/block.service';
import ReportModal from '@/components/ReportModal';

// === DESIGN SYSTEM PREMIUM ===
const COLORS = {
  // Orange premium désaturé (pas fluo)
  orangePrimary: '#E07A3D',
  orangeLight: '#F5EBE6',
  orangeMuted: '#C9936F',

  // Gris / Neutres
  white: '#FFFFFF',
  grayBg: '#F8F9FA',
  grayLight: '#F3F4F6',
  grayMedium: '#E5E7EB',
  grayText: '#9CA3AF',
  grayTextDark: '#6B7280',
  charcoal: '#1F2937',
  charcoalLight: '#374151',

  // Utilitaires
  error: '#EF4444',
  warning: '#D97706',
  warningBg: '#FEF3C7',
};

type MessageType = 'text' | 'image' | 'voice' | 'system';

interface Message extends TransformedMessage {}

interface ConversationStatus {
  isClosed: boolean;
  closedReason?: string;
  closedAt?: string;
}

// Helper pour formater la date des messages
const formatMessageDate = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (messageDate.getTime() === today.getTime()) {
    return "Aujourd'hui";
  } else if (messageDate.getTime() === yesterday.getTime()) {
    return 'Hier';
  } else {
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  }
};

// Helper pour obtenir la clé de date d'un message
const getDateKey = (timestamp: string): string => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

export default function ChatDetailScreen() {
  const router = useRouter();
  const { id: conversationId } = useLocalSearchParams();
  const flatListRef = useRef<FlatList>(null);
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

  // États pour l'invitation en attente
  const [pendingInvitation, setPendingInvitation] = useState<{
    friendRequestId: string | null;
    isRecipient: boolean;
    senderName: string;
  } | null>(null);
  const [processingInvitation, setProcessingInvitation] = useState(false);

  // États pour le modal et la sourdine
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // États pour le signalement
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTargetMessageId, setReportTargetMessageId] = useState<string | null>(null);

  const { messages, loading: messagesLoading, sendMessage, currentUserId } = useMessages(conversationId as string);

  const { markAsRead } = useConversations();

  // Marquer la conversation comme lue quand on l'ouvre
  useEffect(() => {
    if (conversationId) {
      markAsRead(conversationId as string);
    }
  }, [conversationId, markAsRead]);

  // Marquer comme lue quand de nouveaux messages arrivent
  useEffect(() => {
    if (conversationId && messages && messages.length > 0) {
      markAsRead(conversationId as string);
    }
  }, [messages, conversationId, markAsRead]);

  // Préparer les messages avec les séparateurs de date (pour FlatList inversée)
  const messagesWithDateSeparators = useMemo(() => {
    if (!messages || messages.length === 0) return [];

    const result: (Message | { type: 'date-separator'; date: string; id: string })[] = [];
    let lastDateKey = '';

    // Parcourir dans l'ordre chronologique pour ajouter les séparateurs
    const sortedMessages = [...messages].sort((a, b) =>
      new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    );

    sortedMessages.forEach((msg) => {
      const dateKey = getDateKey(msg.createdAt || new Date().toISOString());

      if (dateKey !== lastDateKey) {
        result.push({
          type: 'date-separator',
          date: formatMessageDate(msg.createdAt || new Date().toISOString()),
          id: `separator-${dateKey}`,
        });
        lastDateKey = dateKey;
      }

      result.push(msg);
    });

    // Inverser pour FlatList inverted
    return result.reverse();
  }, [messages]);

  // Charger les infos de conversation
  useEffect(() => {
    const loadConversationInfo = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const currentUser = userData?.user;
        if (!currentUser) return;

        if (!conversationId) return;

        const { data: convDataRaw } = await supabase
          .from('conversations')
          .select('*, name, image_url, is_closed, closed_reason, closed_at, activity_id, slot_id, friend_request_id')
          .eq('id', conversationId)
          .single();

        const convData = convDataRaw as any;
        if (!convData) return;

        // Vérifier si c'est une conversation avec invitation en attente
        if (convData.friend_request_id) {
          const { data: friendRequest } = await supabase
            .from('friend_requests')
            .select('id, sender_id, receiver_id, status')
            .eq('id', convData.friend_request_id)
            .single();

          if (friendRequest && friendRequest.status === 'pending') {
            const isRecipient = friendRequest.receiver_id === currentUser.id;

            let senderName = 'Utilisateur';
            if (isRecipient) {
              const { data: senderProfile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', friendRequest.sender_id)
                .single();
              senderName = senderProfile?.full_name || 'Utilisateur';
            }

            setPendingInvitation({
              friendRequestId: friendRequest.id,
              isRecipient,
              senderName,
            });
          } else {
            setPendingInvitation(null);
          }
        } else {
          setPendingInvitation(null);
        }

        const isActivityGroup = convData.is_group === true && (convData.activity_id || convData.slot_id);
        setIsGroup(isActivityGroup);

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

        if (convData.slot_id && results[0]?.data) {
          const slotData = results[0].data;

          if (slotData?.activity_id) {
            setActivityId(slotData.activity_id);
          }

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
    if (pendingInvitation) return false;
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
    if (pendingInvitation) {
      if (pendingInvitation.isRecipient) {
        return null;
      }
      return "En attente de réponse à votre invitation.";
    }
    return null;
  };

  const handleAcceptInvitation = async () => {
    if (!pendingInvitation?.friendRequestId) return;

    setProcessingInvitation(true);
    try {
      const { error } = await supabase.rpc('accept_friend_request', {
        p_request_id: pendingInvitation.friendRequestId,
      });

      if (error) throw error;

      await supabase
        .from('conversations')
        .update({ friend_request_id: null })
        .eq('id', conversationId);

      setPendingInvitation(null);
      Alert.alert('Succès', 'Invitation acceptée ! Vous pouvez maintenant discuter.');
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      Alert.alert('Erreur', 'Impossible d\'accepter l\'invitation');
    } finally {
      setProcessingInvitation(false);
    }
  };

  const handleRejectInvitation = async () => {
    if (!pendingInvitation?.friendRequestId) return;

    Alert.alert(
      'Refuser l\'invitation ?',
      'Cette personne ne pourra plus vous envoyer de messages.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Refuser',
          style: 'destructive',
          onPress: async () => {
            setProcessingInvitation(true);
            try {
              const { error } = await supabase
                .from('friend_requests')
                .update({ status: 'rejected' })
                .eq('id', pendingInvitation.friendRequestId);

              if (error) throw error;

              await supabase
                .from('conversations')
                .update({
                  friend_request_id: null,
                  is_closed: true,
                  closed_reason: 'invitation_rejected',
                })
                .eq('id', conversationId);

              setPendingInvitation(null);
              setConversationStatus({
                isClosed: true,
                closedReason: 'invitation_rejected',
              });

              Alert.alert('Invitation refusée', 'Cette conversation est maintenant fermée.');
            } catch (error: any) {
              console.error('Error rejecting invitation:', error);
              Alert.alert('Erreur', 'Impossible de refuser l\'invitation');
            } finally {
              setProcessingInvitation(false);
            }
          },
        },
      ]
    );
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

  const renderDateSeparator = (date: string) => (
    <View style={styles.dateSeparatorContainer}>
      <View style={styles.dateSeparatorLine} />
      <Text style={styles.dateSeparatorText}>{date}</Text>
      <View style={styles.dateSeparatorLine} />
    </View>
  );

  const renderMessage = useCallback(({ item }: { item: Message | { type: 'date-separator'; date: string; id: string } }) => {
    // Séparateur de date
    if ('type' in item && item.type === 'date-separator') {
      return renderDateSeparator(item.date);
    }

    const msg = item as Message;
    const isOwnMessage = msg.senderId === currentUserId;
    const isSystemMessage = msg.type === 'system';

    if (isSystemMessage) {
      return (
        <View style={styles.systemMessageContainer}>
          <Text style={styles.systemMessageText}>{msg.text}</Text>
        </View>
      );
    }

    return (
      <View style={[styles.messageRow, isOwnMessage && styles.ownMessageRow]}>
        {!isOwnMessage && (
          <Image
            source={{ uri: msg.senderAvatar || 'https://via.placeholder.com/40' }}
            style={styles.messageAvatar}
          />
        )}

        <TouchableOpacity
          style={[styles.messageBubble, isOwnMessage && styles.ownMessageBubble]}
          activeOpacity={0.8}
          onLongPress={() => handleMessageLongPress(msg.id, msg.senderId)}
          delayLongPress={500}
          disabled={isOwnMessage}
        >
          {!isOwnMessage && isGroup && (
            <Text style={styles.senderName}>{msg.senderName}</Text>
          )}

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
              <View style={[styles.voicePlayButton, isOwnMessage && styles.voicePlayButtonOwn]}>
                <IconSymbol
                  name={playingVoiceId === msg.id ? 'pause.fill' : 'play.fill'}
                  size={14}
                  color={isOwnMessage ? COLORS.orangePrimary : COLORS.white}
                />
              </View>
              <View style={styles.waveformContainer}>
                {[...Array(12)].map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.waveformBar,
                      { height: 8 + Math.random() * 14 },
                      isOwnMessage && styles.waveformBarOwn
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
                  <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
                )}
                {msg.status === 'sent' && (
                  <IconSymbol name="checkmark" size={12} color="rgba(255,255,255,0.6)" />
                )}
                {msg.status === 'delivered' && (
                  <View style={styles.doubleCheck}>
                    <IconSymbol name="checkmark" size={12} color="rgba(255,255,255,0.6)" />
                    <IconSymbol name="checkmark" size={12} color="rgba(255,255,255,0.6)" style={{ marginLeft: -6 }} />
                  </View>
                )}
                {msg.status === 'failed' && (
                  <IconSymbol name="exclamationmark.circle" size={12} color={COLORS.error} />
                )}
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  }, [currentUserId, isGroup, playingVoiceId]);

  const inputWarning = getInputWarning();
  const hasText = message.trim().length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header Premium Clair */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={22} color={COLORS.charcoal} />
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
          {convImage ? (
            <Image source={{ uri: convImage }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.headerAvatarPlaceholder}>
              <IconSymbol
                name={isGroup ? "person.2.fill" : "person.fill"}
                size={18}
                color={COLORS.grayTextDark}
              />
            </View>
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
            style={styles.headerIconButton}
            onPress={async () => {
              try {
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
            <IconSymbol name="calendar" size={20} color={COLORS.orangeMuted} />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.headerIconButton} onPress={() => setShowOptionsModal(true)}>
          <IconSymbol name="ellipsis" size={20} color={COLORS.grayTextDark} />
        </TouchableOpacity>
      </View>

      {/* Séparateur fin sous le header */}
      <View style={styles.headerSeparator} />

      {/* Messages - KeyboardAvoidingView */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {conversationStatus.isClosed && (
          <View style={styles.closedBanner}>
            <IconSymbol name="info.circle.fill" size={18} color={COLORS.grayTextDark} />
            <Text style={styles.closedBannerText}>
              {conversationStatus.closedReason === 'activity_ended'
                ? "L'activité est terminée. Cette conversation est maintenant en lecture seule."
                : 'Cette conversation est fermée.'}
            </Text>
          </View>
        )}

        {(messagesLoading || !currentUserId) ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.orangePrimary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messagesWithDateSeparators}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            inverted
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            maxToRenderPerBatch={10}
            windowSize={10}
          />
        )}

        {/* Zone de saisie Premium */}
        <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>

          {/* Bannière d'invitation en attente pour le destinataire */}
          {pendingInvitation?.isRecipient && (
            <View style={styles.invitationBanner}>
              <View style={styles.invitationBannerContent}>
                <IconSymbol name="person.badge.plus" size={18} color={COLORS.orangePrimary} />
                <Text style={styles.invitationBannerText}>
                  {pendingInvitation.senderName} souhaite vous ajouter en ami
                </Text>
              </View>
              <View style={styles.invitationActions}>
                <TouchableOpacity
                  style={styles.invitationRejectButton}
                  onPress={handleRejectInvitation}
                  disabled={processingInvitation}
                >
                  {processingInvitation ? (
                    <ActivityIndicator size="small" color={COLORS.grayTextDark} />
                  ) : (
                    <Text style={styles.invitationRejectText}>Refuser</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.invitationAcceptButton}
                  onPress={handleAcceptInvitation}
                  disabled={processingInvitation}
                >
                  {processingInvitation ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <Text style={styles.invitationAcceptText}>Accepter</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {inputWarning && (
            <View style={styles.warningBanner}>
              <IconSymbol name="exclamationmark.triangle.fill" size={16} color={COLORS.warning} />
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
                <IconSymbol name="stop.fill" size={22} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.inputRow}>
              <TouchableOpacity
                style={styles.inputIconButton}
                onPress={handleImagePick}
                disabled={!canSendMessages()}
              >
                <IconSymbol
                  name="photo"
                  size={22}
                  color={canSendMessages() ? COLORS.grayTextDark : COLORS.grayMedium}
                />
              </TouchableOpacity>

              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Écrire un message..."
                  placeholderTextColor={COLORS.grayText}
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  maxLength={500}
                  editable={canSendMessages()}
                />
              </View>

              {hasText ? (
                <TouchableOpacity
                  style={styles.sendButton}
                  onPress={handleSend}
                  disabled={!canSendMessages()}
                >
                  <IconSymbol name="arrow.up" size={18} color={COLORS.white} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.inputIconButton}
                  onPress={handleStartRecording}
                  disabled={!canSendMessages()}
                >
                  <IconSymbol
                    name="mic.fill"
                    size={22}
                    color={canSendMessages() ? COLORS.grayTextDark : COLORS.grayMedium}
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
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Options</Text>

            <TouchableOpacity style={styles.modalOption} onPress={handleToggleMute}>
              <IconSymbol
                name={isMuted ? 'bell.fill' : 'bell.slash.fill'}
                size={20}
                color={isMuted ? COLORS.orangePrimary : COLORS.grayTextDark}
              />
              <Text style={styles.modalOptionText}>
                {isMuted ? 'Réactiver les notifications' : 'Mettre en sourdine'}
              </Text>
            </TouchableOpacity>

            {!isGroup && otherUserId && (
              <TouchableOpacity style={styles.modalOption} onPress={handleReportUser}>
                <IconSymbol name="flag.fill" size={20} color={COLORS.error} />
                <Text style={[styles.modalOptionText, { color: COLORS.error }]}>
                  Signaler cet utilisateur
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.modalOption, styles.modalOptionLast]}
              onPress={() => setShowOptionsModal(false)}
            >
              <IconSymbol name="xmark" size={20} color={COLORS.grayTextDark} />
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
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },

  // === HEADER PREMIUM ===
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
  },
  headerSeparator: {
    height: 1,
    backgroundColor: COLORS.grayMedium,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    gap: 10,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.grayLight,
  },
  headerAvatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.grayLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Manrope_600SemiBold',
    fontWeight: '600',
    color: COLORS.charcoal,
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
    color: COLORS.grayTextDark,
    marginTop: 1,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },

  // === MESSAGES ===
  messagesContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.grayLight,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
  },
  closedBannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Manrope_400Regular',
    color: COLORS.grayTextDark,
  },

  // === DATE SEPARATOR ===
  dateSeparatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 20,
  },
  dateSeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.grayMedium,
  },
  dateSeparatorText: {
    fontSize: 12,
    fontFamily: 'Manrope_500Medium',
    color: COLORS.grayText,
    marginHorizontal: 12,
  },

  // === SYSTEM MESSAGE ===
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 12,
    paddingHorizontal: 20,
  },
  systemMessageText: {
    fontSize: 13,
    fontFamily: 'Manrope_400Regular',
    color: COLORS.grayText,
    fontStyle: 'italic',
    textAlign: 'center',
  },

  // === MESSAGE BUBBLES ===
  messageRow: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'flex-end',
  },
  ownMessageRow: {
    justifyContent: 'flex-end',
  },
  messageAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
    backgroundColor: COLORS.grayLight,
  },
  messageBubble: {
    maxWidth: '75%',
    backgroundColor: COLORS.grayLight,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  ownMessageBubble: {
    backgroundColor: COLORS.orangePrimary,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 6,
  },
  senderName: {
    fontSize: 12,
    fontFamily: 'Manrope_600SemiBold',
    fontWeight: '600',
    color: COLORS.orangePrimary,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    fontFamily: 'Manrope_400Regular',
    color: COLORS.charcoal,
    lineHeight: 20,
  },
  ownMessageText: {
    color: COLORS.white,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginTop: 4,
  },

  // === VOICE MESSAGE ===
  voiceMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    minWidth: 140,
  },
  voicePlayButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.orangePrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voicePlayButtonOwn: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flex: 1,
  },
  waveformBar: {
    width: 3,
    backgroundColor: COLORS.grayText,
    borderRadius: 2,
  },
  waveformBarOwn: {
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  voiceDuration: {
    fontSize: 11,
    fontFamily: 'Manrope_500Medium',
    color: COLORS.grayText,
  },
  voiceDurationOwn: {
    color: 'rgba(255,255,255,0.8)',
  },

  // === MESSAGE FOOTER (time + status) ===
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
    justifyContent: 'flex-end',
  },
  messageTime: {
    fontSize: 10,
    fontFamily: 'Manrope_400Regular',
    color: COLORS.grayText,
    opacity: 0.8,
  },
  messageTimeOwn: {
    color: 'rgba(255,255,255,0.7)',
  },
  statusContainer: {
    marginLeft: 2,
  },
  doubleCheck: {
    flexDirection: 'row',
  },

  // === INPUT CONTAINER ===
  inputContainer: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.grayMedium,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warningBg,
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Manrope_400Regular',
    color: COLORS.warning,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  inputIconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: COLORS.grayBg,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.grayMedium,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 40,
    justifyContent: 'center',
  },
  input: {
    fontSize: 15,
    fontFamily: 'Manrope_400Regular',
    color: COLORS.charcoal,
    maxHeight: 100,
    paddingVertical: 0,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.orangePrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // === RECORDING ===
  recordingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.error,
  },
  recordingTime: {
    fontSize: 16,
    fontFamily: 'Manrope_600SemiBold',
    fontWeight: '600',
    color: COLORS.charcoal,
  },
  stopRecordingButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // === MODAL OPTIONS ===
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: COLORS.grayMedium,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: 'Manrope_700Bold',
    fontWeight: '700',
    color: COLORS.charcoal,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },
  modalOptionLast: {
    borderBottomWidth: 0,
  },
  modalOptionText: {
    fontSize: 15,
    fontFamily: 'Manrope_500Medium',
    color: COLORS.charcoal,
  },

  // === INVITATION BANNER ===
  invitationBanner: {
    backgroundColor: COLORS.orangeLight,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(224, 122, 61, 0.2)',
  },
  invitationBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  invitationBannerText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Manrope_500Medium',
    color: COLORS.charcoal,
  },
  invitationActions: {
    flexDirection: 'row',
    gap: 10,
  },
  invitationRejectButton: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.grayMedium,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invitationRejectText: {
    fontSize: 14,
    fontFamily: 'Manrope_600SemiBold',
    fontWeight: '600',
    color: COLORS.grayTextDark,
  },
  invitationAcceptButton: {
    flex: 1,
    backgroundColor: COLORS.orangePrimary,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invitationAcceptText: {
    fontSize: 14,
    fontFamily: 'Manrope_600SemiBold',
    fontWeight: '600',
    color: COLORS.white,
  },
});
