// app/chat-detail.tsx - Version améliorée avec support média

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
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import { messagingService } from '@/services/messaging.service';
import { useAuth } from '@/contexts/AuthContext';
import { storageService } from '@/services/storage.service';
import * as ImagePicker from 'expo-image-picker';

type MessageType = 'text' | 'image' | 'voice';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text?: string;
  imageUrl?: string;
  voiceUrl?: string;
  voiceDuration?: number;
  type: MessageType;
  timestamp: string;
}

export default function ChatDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);
  
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showMediaOptions, setShowMediaOptions] = useState(false);
  
  const [conversation, setConversation] = useState<any>(null);

  useEffect(() => {
    if (id && user) {
      loadMessages();
      
      const unsubscribe = messagingService.subscribeToMessages(
        id as string,
        (newMessage) => {
          setMessages(prev => [...prev, newMessage]);
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      );

      return () => unsubscribe();
    }
  }, [id, user]);

  const loadMessages = async () => {
    setLoading(true);
    const result = await messagingService.getMessages(id as string);
    if (result.success) {
      setMessages(result.data || []);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
    setLoading(false);
  };

  const handleSendText = async () => {
    if (message.trim()) {
      const result = await messagingService.sendMessage(
        id as string,
        message.trim()
      );

      if (result.success) {
        setMessage('');
      }
    }
  };

  const handlePickImage = async () => {
    try {
      const imageResult = await storageService.pickImage();
      if (!imageResult.success || !imageResult.uri) return;

      setShowMediaOptions(false);

      // Upload l'image
      const uploadResult = await storageService.uploadAvatar(
        imageResult.uri,
        `chat_${Date.now()}`
      );

      if (uploadResult.success) {
        await messagingService.sendMessage(
          id as string,
          '',
          'image',
          uploadResult.url
        );
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const photoResult = await storageService.takePhoto();
      if (!photoResult.success || !photoResult.uri) return;

      setShowMediaOptions(false);

      // Upload la photo
      const uploadResult = await storageService.uploadAvatar(
        photoResult.uri,
        `chat_${Date.now()}`
      );

      if (uploadResult.success) {
        await messagingService.sendMessage(
          id as string,
          '',
          'image',
          uploadResult.url
        );
      }
    } catch (error) {
      console.error('Error taking photo:', error);
    }
  };

  const handleStartRecording = () => {
    // TODO: Implémenter l'enregistrement vocal avec expo-av
    setRecording(true);
    setRecordingTime(0);
    
    // Simuler l'enregistrement
    const interval = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);

    // Arrêter après 60 secondes max
    setTimeout(() => {
      clearInterval(interval);
      if (recording) {
        handleStopRecording();
      }
    }, 60000);
  };

  const handleStopRecording = () => {
    setRecording(false);
    
    // Créer un message vocal
    const newMessage: Message = {
      id: Date.now().toString(),
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      voiceUrl: 'mock_voice_url',
      voiceDuration: recordingTime,
      type: 'voice',
      timestamp: new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    
    setMessages(prev => [...prev, newMessage]);
    setRecordingTime(0);
    
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderMessage = (msg: Message) => {
    const isOwnMessage = msg.senderId === currentUser.id;

    return (
      <View
        key={msg.id}
        style={[
          styles.messageWrapper,
          isOwnMessage && styles.messageWrapperOwn,
        ]}
      >
        {!isOwnMessage && (
          <Image
            source={{ uri: msg.senderAvatar }}
            style={styles.messageAvatar}
          />
        )}
        
        <View
          style={[
            styles.messageBubble,
            isOwnMessage && styles.messageBubbleOwn,
            msg.type === 'image' && styles.imageBubble,
          ]}
        >
          {msg.type === 'text' && (
            <>
              {!isOwnMessage && conversation.isGroup && (
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
            </>
          )}

          {msg.type === 'image' && (
            <>
              <Image
                source={{ uri: msg.imageUrl }}
                style={styles.messageImage}
                resizeMode="cover"
              />
              <View style={[styles.imageTimestamp, isOwnMessage && styles.imageTimestampOwn]}>
                <Text style={styles.imageTimeText}>{msg.timestamp}</Text>
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
                {/* Simuler une forme d'onde */}
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
            <Text
              style={[
                styles.messageTime,
                isOwnMessage && styles.messageTimeOwn,
              ]}
            >
              {msg.timestamp}
            </Text>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={commonStyles.container} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
}
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  headerButton: {
    padding: 8,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  messageWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 8,
  },
  messageWrapperOwn: {
    flexDirection: 'row-reverse',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.border,
  },
  messageBubble: {
    maxWidth: '70%',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 12,
    gap: 4,
  },
  messageBubbleOwn: {
    backgroundColor: colors.primary,
  },
  imageBubble: {
    padding: 0,
    overflow: 'hidden',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 2,
  },
  messageText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 20,
  },
  messageTextOwn: {
    color: colors.background,
  },
  messageTime: {
    fontSize: 11,
    color: colors.textSecondary,
    alignSelf: 'flex-end',
  },
  messageTimeOwn: {
    color: colors.background + 'CC',
  },
  messageImage: {
    width: 250,
    height: 250,
    borderRadius: 16,
  },
  imageTimestamp: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  imageTimestampOwn: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  imageTimeText: {
    fontSize: 11,
    color: colors.text,
    fontWeight: '600',
  },
  voiceMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
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
    flex: 1,
    borderRadius: 2,
  },
  voiceDuration: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  voiceDurationOwn: {
    color: colors.background,
  },
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    paddingHorizontal: 20,
    paddingVertical: 12,
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
    backgroundColor: colors.error,
  },
  recordingText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  stopRecordingButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 12,
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
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    maxHeight: 100,
  },
  sendButton: {
    padding: 4,
  },
  voiceButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  mediaOptionsContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 24,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  mediaOption: {
    alignItems: 'center',
    gap: 8,
  },
  mediaOptionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
});