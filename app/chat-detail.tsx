// app/chat-detail.tsx - Version améliorée avec support média

import React, { useState, useRef } from 'react';
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
  const scrollViewRef = useRef<ScrollView>(null);
  
  const [message, setMessage] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showMediaOptions, setShowMediaOptions] = useState(false);
  
  // Mock conversation info
  const conversation = {
    id: id as string,
    name: 'Marie Dubois',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
    isGroup: false,
  };

  // Mock current user
  const currentUser = {
    id: '1',
    name: 'Moi',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      senderId: '2',
      senderName: 'Marie Dubois',
      senderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
      text: 'Salut ! Comment vas-tu ?',
      type: 'text',
      timestamp: '10:30',
    },
    {
      id: '2',
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      text: 'Très bien merci ! Et toi ?',
      type: 'text',
      timestamp: '10:32',
    },
  ]);

  const handleSendText = () => {
    if (message.trim()) {
      const newMessage: Message = {
        id: Date.now().toString(),
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderAvatar: currentUser.avatar,
        text: message.trim(),
        type: 'text',
        timestamp: new Date().toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      
      setMessages(prev => [...prev, newMessage]);
      setMessage('');
      
      // Scroll to bottom
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const newMessage: Message = {
          id: Date.now().toString(),
          senderId: currentUser.id,
          senderName: currentUser.name,
          senderAvatar: currentUser.avatar,
          imageUrl: result.assets[0].uri,
          type: 'image',
          timestamp: new Date().toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };
        
        setMessages(prev => [...prev, newMessage]);
        setShowMediaOptions(false);
        
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Erreur', "Impossible d'accéder à la galerie");
    }
  };

  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permission.granted) {
        const result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
          const newMessage: Message = {
            id: Date.now().toString(),
            senderId: currentUser.id,
            senderName: currentUser.name,
            senderAvatar: currentUser.avatar,
            imageUrl: result.assets[0].uri,
            type: 'image',
            timestamp: new Date().toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            }),
          };
          
          setMessages(prev => [...prev, newMessage]);
          setShowMediaOptions(false);
          
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      } else {
        Alert.alert('Permission refusée', 'Accès à la caméra nécessaire');
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Erreur', "Impossible d'accéder à la caméra");
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

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Image source={{ uri: conversation.image }} style={styles.headerAvatar} />
          <View>
            <Text style={styles.headerTitle}>{conversation.name}</Text>
            {conversation.isGroup && (
              <Text style={styles.headerSubtitle}>Groupe</Text>
            )}
          </View>
        </View>
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
          {messages.map(renderMessage)}
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
          <TouchableOpacity
            style={styles.attachButton}
            onPress={() => setShowMediaOptions(true)}
          >
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
            <TouchableOpacity
              style={styles.sendButton}
              onPress={handleSendText}
            >
              <IconSymbol
                name="arrow.up.circle.fill"
                size={32}
                color={colors.primary}
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.voiceButton}
              onPress={handleStartRecording}
            >
              <IconSymbol
                name="mic.fill"
                size={24}
                color={colors.primary}
              />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Modal options média */}
      <Modal
        visible={showMediaOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMediaOptions(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowMediaOptions(false)}
        >
          <View style={styles.mediaOptionsContainer}>
            <TouchableOpacity
              style={styles.mediaOption}
              onPress={handlePickImage}
            >
              <View style={[styles.mediaOptionIcon, { backgroundColor: colors.secondary + '20' }]}>
                <IconSymbol name="photo.fill" size={24} color={colors.secondary} />
              </View>
              <Text style={styles.mediaOptionText}>Galerie</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.mediaOption}
              onPress={handleTakePhoto}
            >
              <View style={[styles.mediaOptionIcon, { backgroundColor: colors.accent + '20' }]}>
                <IconSymbol name="camera.fill" size={24} color={colors.accent} />
              </View>
              <Text style={styles.mediaOptionText}>Caméra</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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