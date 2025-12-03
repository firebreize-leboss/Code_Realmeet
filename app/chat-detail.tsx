// app/chat-detail.tsx
// Écran de détail d'une conversation avec système de statut de message

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

type MessageType = 'text' | 'image' | 'voice' | 'system';

interface Message extends TransformedMessage {}

export default function ChatDetailScreen() {
  const router = useRouter();
  const { id: conversationId } = useLocalSearchParams();
  const scrollViewRef = useRef<ScrollView>(null);

  const [convName, setConvName] = useState('Conversation');
  const [convImage, setConvImage] = useState('');
  const [isGroup, setIsGroup] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState('Moi');
  const [currentUserAvatar, setCurrentUserAvatar] = useState('');
  const [message, setMessage] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [activityId, setActivityId] = useState<string | null>(null);
  

  const { messages, loading: messagesLoading, sendMessage } = useMessages(conversationId as string);

  const combinedMessages: Message[] = [...(messages || []), ...localMessages];

  // Dans chat-detail.tsx, remplacer le useEffect loadConversationInfo par celui-ci :

useEffect(() => {
  const loadConversationInfo = async () => {
    try {
      // Récupérer l'utilisateur actuel
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
        // ✅ MARQUER LA CONVERSATION COMME LUE
        if (currentUser) {
          await supabase
            .from('conversation_participants')
            .update({ last_read_at: new Date().toISOString() })
            .eq('conversation_id', conversationId)
            .eq('user_id', currentUser.id);
        }

        // Récupérer les infos de la conversation (incluant les nouvelles colonnes)
        const { data: convData } = await supabase
          .from('conversations')
          .select('name, image_url, is_group, activity_id, slot_id')
          .eq('id', conversationId)
          .single();

        // Stocker l'activityId pour la navigation
        setActivityId(convData?.activity_id || null);

        // Récupérer les participants
        const { data: participants } = await supabase
          .from('conversation_participants')
          .select('user_id, profiles: user_id (full_name, avatar_url)')
          .eq('conversation_id', conversationId);

        if (participants && currentUser) {
          const isActivityGroup = convData?.is_group === true && (convData?.activity_id !== null || convData?.slot_id !== null);
          
          if (isActivityGroup) {
            // === GROUPE D'ACTIVITÉ ===
            // Utiliser le nom et l'image stockés dans la conversation
            setIsGroup(true);
            setConvName(convData.name || 'Groupe');
            setConvImage(convData.image_url || '');
          } else if (convData?.is_group === true) {
            // === GROUPE RÉGULIER (sans activité) ===
            setIsGroup(true);
            setConvName(convData.name || 'Groupe');
            setConvImage(convData.image_url || '');
          } else {
            // === CONVERSATION PRIVÉE ===
            setIsGroup(participants.length > 2);
            const other = participants.find(p => p.user_id !== currentUser.id);
            if (other) {
              setConvName(other.profiles?.full_name || 'Conversation');
              setConvImage(other.profiles?.avatar_url || '');
              setOtherUserId(other.user_id);
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

  const handleSendText = async () => {
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

  const handleRetryMessage = async (msg: Message) => {
    if (msg.status !== 'failed') return;

    try {
      if (msg.type === 'text' && msg.text) {
        await sendMessage(msg.text, 'text');
      } else if (msg.type === 'image' && msg.imageUrl) {
        await sendMessage('', 'image', msg.imageUrl);
      } else if (msg.type === 'voice' && msg.voiceUrl) {
        await sendMessage('', 'voice', msg.voiceUrl, msg.voiceDuration);
      }
    } catch (error) {
      console.error('Error retrying message:', error);
      Alert.alert('Erreur', 'Impossible de renvoyer le message');
    }
  };

 const handlePickImage = async () => {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Nous avons besoin de votre permission pour accéder à la galerie.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true, // ✅ IMPORTANT
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];

    if (!asset.base64) {
      Alert.alert('Erreur', 'Impossible de lire l\'image.');
      return;
    }

    if (!currentUserId || !conversationId) {
      Alert.alert('Erreur', 'Impossible d\'envoyer l\'image.');
      return;
    }

    Alert.alert('Envoi en cours', 'Votre image est en cours d\'envoi...');

    // ✅ Passer l'asset complet
    const uploadResult = await messageStorageService.uploadMessageImage(
      asset,
      conversationId as string,
      currentUserId
    );

    if (!uploadResult.success || !uploadResult.url) {
      Alert.alert('Erreur', uploadResult.error || 'Impossible d\'uploader l\'image.');
      return;
    }

    await sendMessage('', 'image', uploadResult.url);

  } catch (error) {
    console.error('Erreur envoi image:', error);
    Alert.alert('Erreur', 'Impossible d\'envoyer l\'image.');
  }
};

  const handleStartRecording = async () => {
    setRecording(true);
    setRecordingTime(0);
  };

  const handleStopRecording = async () => {
    setRecording(false);
    const newMsg: Message = {
      id: Date.now().toString(),
      senderId: currentUserId || '',
      senderName: currentUserName || 'Moi',
      senderAvatar: currentUserAvatar || '',
      voiceUrl: 'mock-voice-url',
      voiceDuration: recordingTime,
      type: 'voice',
      timestamp: new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      status: 'sending',
    };
    setLocalMessages(prev => [...prev, newMsg]);
    setRecordingTime(0);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderMessageStatus = (status?: MessageStatus) => {
    if (!status) return null;

    switch (status) {
      case 'sending':
        return (
          <View style={styles.statusIcon}>
            <IconSymbol name="clock" size={14} color={colors.textSecondary} />
          </View>
        );
      case 'sent':
        return (
          <View style={styles.statusIcon}>
            <IconSymbol name="checkmark" size={14} color={colors.textSecondary} />
          </View>
        );
      case 'delivered':
        return (
          <View style={styles.statusIcon}>
            <IconSymbol name="checkmark" size={14} color={colors.primary} />
            <IconSymbol
              name="checkmark"
              size={14}
              color={colors.primary}
              style={{ marginLeft: -8 }}
            />
          </View>
        );
      case 'failed':
        return (
          <View style={styles.statusIcon}>
            <IconSymbol name="exclamationmark.circle" size={14} color="#FF3B30" />
          </View>
        );
      default:
        return null;
    }
  };

const renderMessage = (msg: Message) => {
  const isOwnMessage = msg.senderId === currentUserId;
  const isFailed = msg.status === 'failed';

  // === MESSAGE SYSTÈME (rejoindre/quitter le groupe) ===
  if (msg.type === 'system') {
    return (
      <View key={msg.id} style={styles.systemMessageWrapper}>
        <View style={styles.systemMessageBubble}>
          <Text style={styles.systemMessageText}>{msg.text}</Text>
        </View>
      </View>
    );
  }

  // === MESSAGES NORMAUX ===
  return (
    <TouchableOpacity
      key={msg.id}
      style={[
        styles.messageWrapper,
        isOwnMessage && styles.messageWrapperOwn,
      ]}
      onPress={isFailed && isOwnMessage ? () => handleRetryMessage(msg) : undefined}
      activeOpacity={isFailed && isOwnMessage ? 0.7 : 1}
      disabled={!isFailed || !isOwnMessage}
    >
      {!isOwnMessage && (
        <Image source={{ uri: msg.senderAvatar }} style={styles.messageAvatar} />
      )}
      <View
        style={[
          styles.messageBubble,
          isOwnMessage && styles.messageBubbleOwn,
          msg.type === 'image' && styles.imageBubble,
          isFailed && isOwnMessage && styles.messageBubbleFailed,
        ]}
      >
        {msg.type === 'text' && (
          <>
            {!isOwnMessage && isGroup && (
              <Text style={styles.senderName}>{msg.senderName}</Text>
            )}
            <Text
              style={[
                styles.messageText,
                isOwnMessage && styles.messageTextOwn,
              ]}
            >
              {msg.text}
            </Text>
            {isFailed && isOwnMessage && (
              <Text style={styles.retryHint}>
                Appuyer pour réessayer
              </Text>
            )}
          </>
        )}

        {msg.type === 'image' && (
          <>
            <Image source={{ uri: msg.imageUrl }} style={styles.messageImage} resizeMode="cover" />
            <View style={[styles.imageTimestamp, isOwnMessage && styles.imageTimestampOwn]}>
              <Text style={styles.imageTimeText}>{msg.timestamp}</Text>
              {isOwnMessage && renderMessageStatus(msg.status)}
            </View>
          </>
        )}

        {msg.type === 'voice' && (
          <View style={styles.voiceMessage}>
            <TouchableOpacity style={styles.playButton}>
              <IconSymbol
                name="play.fill"
                size={20}
                color={isOwnMessage ? colors.background : colors.primary}
              />
            </TouchableOpacity>
            <View style={styles.waveformContainer}>
              {[...Array(20)].map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.waveformBar,
                    {
                      height: Math.random() * 24 + 8,
                      backgroundColor: isOwnMessage
                        ? colors.background + '80'
                        : colors.primary + '80',
                    },
                  ]}
                />
              ))}
            </View>
            <Text
              style={[
                styles.voiceDuration,
                isOwnMessage && styles.voiceDurationOwn,
              ]}
            >
              {formatDuration(msg.voiceDuration || 0)}
            </Text>
          </View>
        )}

        {msg.type !== 'image' && (
          <View style={styles.messageFooter}>
            <Text
              style={[
                styles.messageTime,
                isOwnMessage && styles.messageTimeOwn,
              ]}
            >
              {msg.timestamp}
            </Text>
            {isOwnMessage && renderMessageStatus(msg.status)}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

  return (
    <SafeAreaView style={commonStyles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerInfo}
          onPress={() => {
            if (isGroup) {
              router.push(`/group-info?id=${conversationId}`);
            } else if (otherUserId) {
              router.push(`/user-profile?id=${otherUserId}`);
            }
          }}
          activeOpacity={0.7}
        >
          <Image source={{ uri: convImage }} style={styles.headerAvatar} />
          <View>
            <Text style={styles.headerTitle}>{convName}</Text>
            {isGroup && (
              <Text style={styles.headerSubtitle}>Appuyez pour voir les membres</Text>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerButton}>
          <IconSymbol name="info.circle" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messagesLoading ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : (
            combinedMessages.map(renderMessage)
          )}
        </ScrollView>

        {recording && (
          <View style={styles.recordingBar}>
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>
                Enregistrement... {formatDuration(recordingTime)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.stopRecordingButton}
              onPress={handleStopRecording}
            >
              <IconSymbol name="stop.fill" size={24} color={colors.background} />
            </TouchableOpacity>
          </View>
        )}

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
            <TouchableOpacity style={styles.voiceButton} onPress={handleStartRecording}>
              <IconSymbol name="mic.fill" size={24} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
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
    backgroundColor: colors.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  headerButton: {
    padding: 8,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  messageWrapperOwn: {
    flexDirection: 'row-reverse',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: colors.border,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 18,
    backgroundColor: colors.border,
  },
  messageBubbleOwn: {
    backgroundColor: colors.primary,
  },
  messageBubbleFailed: {
    borderWidth: 1,
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
  imageTimestamp: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  imageTimestampOwn: {
    right: 8,
    left: 'auto',
  },
  imageTimeText: {
    fontSize: 12,
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
    marginTop: 2,
  },
  messageTimeOwn: {
    color: colors.background + 'CC',
  },
  statusIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  retryHint: {
    fontSize: 11,
    color: '#FF3B30',
    marginTop: 4,
    fontStyle: 'italic',
  },
  voiceMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 180,
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
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
    borderRadius: 2,
  },
  voiceDuration: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  voiceDurationOwn: {
    color: colors.background + 'CC',
  },
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.primary + '10',
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
    backgroundColor: '#FF3B30',
  },
  recordingText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  stopRecordingButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF3B30',
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
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 100,
    backgroundColor: colors.border,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 16,
    color: colors.text,
  },
  sendButton: {
    padding: 4,
  },
  voiceButton: {
    padding: 8,
  },
});