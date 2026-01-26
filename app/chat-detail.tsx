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
// Les couleurs utilisées: #60A5FA (bleu), #818CF8 (violet), #C084FC (rose/violet) pour le dégradé
// #1F2937 (texte principal), #6B7280 (texte secondaire), #9CA3AF (texte tertiaire)
// #F3F4F6 (fond clair), #FFFFFF (fond blanc)
import { LinearGradient } from 'expo-linear-gradient';
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

            // Récupérer le nom de l'expéditeur pour l'affichage
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

        // Une conversation est un groupe seulement si is_group=true ET elle a une activité associée
        // Les conversations privées 1-1 n'ont pas de nom mais ne sont pas des groupes
        const isActivityGroup = convData.is_group === true && (convData.activity_id || convData.slot_id);
        setIsGroup(isActivityGroup);

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
    // Si invitation en attente, personne ne peut envoyer de messages supplémentaires
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
        return null; // Pas de warning, on affiche les boutons à la place
      }
      return "En attente de réponse à votre invitation.";
    }
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

  // Accepter l'invitation (demande d'ami)
  const handleAcceptInvitation = async () => {
    if (!pendingInvitation?.friendRequestId) return;

    setProcessingInvitation(true);
    try {
      // Utiliser la RPC pour accepter la demande d'ami
      const { error } = await supabase.rpc('accept_friend_request', {
        p_request_id: pendingInvitation.friendRequestId,
      });

      if (error) throw error;

      // Supprimer le friend_request_id de la conversation pour la débloquer
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

  // Refuser l'invitation
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
              // Refuser la demande d'ami
              const { error } = await supabase
                .from('friend_requests')
                .update({ status: 'rejected' })
                .eq('id', pendingInvitation.friendRequestId);

              if (error) throw error;

              // Supprimer le friend_request_id mais garder la conversation fermée
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
                  color={isOwnMessage ? '#818CF8' : '#FFFFFF'}
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
                {msg.status === 'sending' && <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />}
                {msg.status === 'sent' && <IconSymbol name="checkmark" size={14} color="rgba(255,255,255,0.8)" />}
                {msg.status === 'delivered' && (
                  <View style={styles.doubleCheck}>
                    <IconSymbol name="checkmark" size={14} color="rgba(255,255,255,0.8)" />
                    <IconSymbol name="checkmark" size={14} color="rgba(255,255,255,0.8)" />
                  </View>
                )}
                {msg.status === 'failed' && <IconSymbol name="exclamationmark.circle" size={14} color="#EF4444" />}
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const inputWarning = getInputWarning();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header avec dégradé */}
      <LinearGradient
        colors={['#60A5FA', '#818CF8', '#C084FC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={24} color="#FFFFFF" />
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
            <Image
              source={{ uri: convImage }}
              style={styles.headerActivityImage}
            />
          ) : (
            <View style={styles.headerAvatarPlaceholder}>
              <IconSymbol name={isGroup ? "person.2.fill" : "person.fill"} size={20} color="rgba(255,255,255,0.8)" />
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
            style={styles.viewActivityButton}
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
            <IconSymbol name="calendar" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.moreButton} onPress={() => setShowOptionsModal(true)}>
          <IconSymbol name="ellipsis" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Messages */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <ScrollView ref={scrollViewRef} style={styles.messagesContainer} contentContainerStyle={styles.messagesContent} showsVerticalScrollIndicator={false}>
          {conversationStatus.isClosed && (
            <View style={styles.closedBanner}>
              <IconSymbol name="info.circle.fill" size={20} color="#9CA3AF" />
              <Text style={styles.closedBannerText}>
                {conversationStatus.closedReason === 'activity_ended'
                  ? "L'activité est terminée. Cette conversation est maintenant en lecture seule."
                  : 'Cette conversation est fermée.'}
              </Text>
            </View>
          )}

          {(messagesLoading || !currentUserId) ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#818CF8" />
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


          {/* Bannière d'invitation en attente pour le destinataire */}
          {pendingInvitation?.isRecipient && (
            <View style={styles.invitationBanner}>
              <View style={styles.invitationBannerContent}>
                <IconSymbol name="person.badge.plus" size={20} color="#818CF8" />
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
                    <ActivityIndicator size="small" color="#6B7280" />
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
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.invitationAcceptText}>Accepter</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {inputWarning && (
            <View style={styles.warningBanner}>
              <IconSymbol name="exclamationmark.triangle.fill" size={16} color="#D97706" />
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
                <IconSymbol name="stop.fill" size={24} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.inputRow}>
              <TouchableOpacity style={styles.iconButton} onPress={handleImagePick} disabled={!canSendMessages()}>
                <IconSymbol name="photo" size={24} color={canSendMessages() ? '#818CF8' : '#9CA3AF'} />
              </TouchableOpacity>

              <TextInput
                style={styles.input}
                placeholder="Message..."
                placeholderTextColor="#9CA3AF"
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={500}
                editable={canSendMessages()}
              />

              {message.trim() ? (
                <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={!canSendMessages()}>
                  <IconSymbol name="arrow.up.circle.fill" size={32} color="#818CF8" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.iconButton} onPress={handleStartRecording} disabled={!canSendMessages()}>
                  <IconSymbol name="mic.fill" size={24} color={canSendMessages() ? '#818CF8' : '#9CA3AF'} />
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
              <IconSymbol name={isMuted ? 'bell.fill' : 'bell.slash.fill'} size={20} color={isMuted ? '#818CF8' : '#9CA3AF'} />
              <Text style={styles.modalOptionText}>{isMuted ? 'Réactiver les notifications' : 'Mettre en sourdine'}</Text>
            </TouchableOpacity>

            {/* Option Signaler - seulement pour les conversations privées */}
            {!isGroup && otherUserId && (
              <TouchableOpacity style={styles.modalOption} onPress={handleReportUser}>
                <IconSymbol name="flag.fill" size={20} color="#EF4444" />
                <Text style={[styles.modalOptionText, { color: '#EF4444' }]}>Signaler cet utilisateur</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.modalOption} onPress={() => setShowOptionsModal(false)}>
              <IconSymbol name="xmark" size={20} color="#9CA3AF" />
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
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
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
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closedBadge: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  groupSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
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
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  headerTitleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  moreButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewActivityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 10,
  },
  closedBannerText: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  systemMessageText: {
    fontSize: 13,
    color: '#9CA3AF',
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
    backgroundColor: '#E5E7EB',
  },
  messageBubble: {
    maxWidth: '75%',
    backgroundColor: '#F3F4F6',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    padding: 12,
  },
  ownMessageBubble: {
    backgroundColor: '#818CF8',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#1F2937',
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#FFFFFF',
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
    backgroundColor: '#818CF8',
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
    backgroundColor: '#9CA3AF',
    borderRadius: 2,
  },
  waveformBarOwn: {
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  voiceDuration: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  voiceDurationOwn: {
    color: 'rgba(255,255,255,0.9)',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  messageTime: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  messageTimeOwn: {
    color: 'rgba(255,255,255,0.8)',
  },
  statusContainer: {
    marginLeft: 4,
  },
  doubleCheck: {
    flexDirection: 'row',
    marginLeft: -8,
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#D97706',
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
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1F2937',
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
    backgroundColor: '#EF4444',
  },
  recordingTime: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  stopRecordingButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#1F2937',
  },
  // Styles pour l'invitation en attente
  invitationBanner: {
    backgroundColor: 'rgba(129, 140, 252, 0.1)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 252, 0.3)',
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
    color: '#1F2937',
    fontWeight: '500',
  },
  invitationActions: {
    flexDirection: 'row',
    gap: 10,
  },
  invitationRejectButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invitationRejectText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  invitationAcceptButton: {
    flex: 1,
    backgroundColor: '#818CF8',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invitationAcceptText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});