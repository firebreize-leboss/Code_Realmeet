// app/chat-detail.tsx
// Écran de détail d'une conversation (messages)

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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useMessages } from '@/hooks/useMessaging';
import { Keyboard } from 'react-native';

type MessageType = 'text' | 'image' | 'voice' | 'system';

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
  const { id: conversationId } = useLocalSearchParams();
  const scrollViewRef = useRef<ScrollView>(null);

  // Informations de la conversation (nom, image) et de l'utilisateur courant
  const [convName, setConvName] = useState('Conversation');
  const [convImage, setConvImage] = useState('');
  const [isGroup, setIsGroup] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState('Moi');
  const [currentUserAvatar, setCurrentUserAvatar] = useState('');

  // État du message en saisie et enregistrement vocal en cours
  const [message, setMessage] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  // Stockage local des messages non envoyés (images/voix simulées)
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);

  // Charger l'utilisateur actuel et les participants de la conversation pour définir le titre
  useEffect(() => {
    const loadConversationInfo = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const currentUser = userData?.user;
        if (currentUser) {
          setCurrentUserId(currentUser.id);
          // Récupérer le profil de l'utilisateur actuel pour nom/avatar
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
          // Récupérer les participants de la conversation (avec profil)
          const { data: participants } = await supabase
            .from('conversation_participants')
            .select('user_id, profiles: user_id (full_name, avatar_url)')
            .eq('conversation_id', conversationId);
          if (participants) {
            setIsGroup(participants.length > 2);
            // Identifier l'autre participant pour une discussion 1-à-1
            if (currentUser) {
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
    // Fermer le clavier au montage du composant
    Keyboard.dismiss();
  }, [conversationId]);

  // Utiliser le hook de messages pour récupérer/envoyer les messages de la conversation
  const { messages, loading: messagesLoading, sendMessage } = useMessages(conversationId as string);

  // Combiner les messages de la BDD et les messages locaux (images/voix non partagés)
  const combinedMessages: Message[] = [...(messages || []), ...localMessages];

  // Faire défiler vers le bas à chaque mise à jour de la liste de messages
  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [combinedMessages]);

  const handleSendText = async () => {
    if (message.trim()) {
      try {
        await sendMessage(message.trim(), 'text');
        setMessage(''); // Réinitialiser le champ de saisie
      } catch (error) {
        console.error('Error sending message:', error);
        Alert.alert('Erreur', "Le message n'a pas pu être envoyé");
      }
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        // Ajouter un message local pour l'image (non envoyé à Supabase)
        const newMsg: Message = {
          id: Date.now().toString(),
          senderId: currentUserId || '',
          senderName: currentUserName || 'Moi',
          senderAvatar: currentUserAvatar || '',
          imageUrl: result.assets[0].uri,
          type: 'image',
          timestamp: new Date().toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };
        setLocalMessages(prev => [...prev, newMsg]);
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
          const newMsg: Message = {
            id: Date.now().toString(),
            senderId: currentUserId || '',
            senderName: currentUserName || 'Moi',
            senderAvatar: currentUserAvatar || '',
            imageUrl: result.assets[0].uri,
            type: 'image',
            timestamp: new Date().toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            }),
          };
          setLocalMessages(prev => [...prev, newMsg]);
          setShowMediaOptions(false);
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
    // Commencer l'enregistrement vocal (simulation)
    setRecording(true);
    setRecordingTime(0);
    const interval = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
    // Arrêter automatiquement après 60 secondes maximum
    setTimeout(() => {
      clearInterval(interval);
      if (recording) {
        handleStopRecording();
      }
    }, 60000);
  };

  const handleStopRecording = () => {
    setRecording(false);
    // Créer un message vocal local simulé (non envoyé à Supabase)
    const newMsg: Message = {
      id: Date.now().toString(),
      senderId: currentUserId || '',
      senderName: currentUserName || 'Moi',
      senderAvatar: currentUserAvatar || '',
      voiceUrl: 'mock_voice_url',
      voiceDuration: recordingTime,
      type: 'voice',
      timestamp: new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    setLocalMessages(prev => [...prev, newMsg]);
    setRecordingTime(0);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderMessage = (msg: Message) => {
    const isOwnMessage = msg.senderId === currentUserId;
    return (
      <View
        key={msg.id}
        style={[
          styles.messageWrapper,
          isOwnMessage && styles.messageWrapperOwn,
        ]}
      >
        {!isOwnMessage && (
          <Image source={{ uri: msg.senderAvatar }} style={styles.messageAvatar} />
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
            </>
          )}

          {msg.type === 'image' && (
            <>
              <Image source={{ uri: msg.imageUrl }} style={styles.messageImage} resizeMode="cover" />
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
                {/* Barres de simulation de la forme d'onde */}
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

          {/* Heure pour les messages texte et voix */}
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
    <SafeAreaView style={commonStyles.container} edges={['top','bottom']}>
      {/* En-tête de la conversation */}
  <View style={styles.header}>
  <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
    <IconSymbol name="chevron.left" size={24} color={colors.text} />
  </TouchableOpacity>
  
  <TouchableOpacity 
    style={styles.headerInfo}
    onPress={() => {
      if (otherUserId && !isGroup) {
        router.push(`/user-profile?id=${otherUserId}`);
      }
    }}
    activeOpacity={0.7}
  >
    <Image source={{ uri: convImage }} style={styles.headerAvatar} />
    <View>
      <Text style={styles.headerTitle}>{convName}</Text>
      {isGroup && <Text style={styles.headerSubtitle}>Groupe</Text>}
    </View>
  </TouchableOpacity>
  
  <TouchableOpacity style={styles.headerButton}>
    <IconSymbol name="info.circle" size={24} color={colors.text} />
  </TouchableOpacity>
  </View>

      {/* Contenu de la conversation et zone de saisie */}
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
            // Spinner de chargement si les messages sont en cours de récupération
            <ActivityIndicator size="large" color={colors.primary} />
          ) : (
            combinedMessages.map(renderMessage)
          )}
        </ScrollView>

        {/* Barre de statut d'enregistrement vocal */}
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

        {/* Zone d'entrée de message */}
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

        {/* Modal (placeholder) pour options média (par ex. choix Photo vs Appareil) */}
        
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.border,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  headerButton: {
    padding: 8,
  },
  container: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  messageWrapperOwn: {
    justifyContent: 'flex-end',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.border,
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 8,
    borderRadius: 12,
    backgroundColor: colors.card,
  },
  messageBubbleOwn: {
    backgroundColor: colors.primary,
  },
  messageText: {
    fontSize: 15,
    color: colors.text,
  },
  messageTextOwn: {
    color: colors.background,
  },
  senderName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  imageBubble: {
    padding: 0,
    overflow: 'hidden',
  },
  imageTimestamp: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#00000060',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  imageTimestampOwn: {
    backgroundColor: '#00000040',
  },
  imageTimeText: {
    fontSize: 10,
    color: '#fff',
  },
  voiceMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playButton: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: colors.card,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
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
    color: colors.background,
  },
  messageTime: {
    fontSize: 11,
    color: colors.textSecondary,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  messageTimeOwn: {
    color: colors.background,
  },
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  recordingIndicator: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
  },
  recordingText: {
    fontSize: 15,
    color: colors.text,
  },
  stopRecordingButton: {
    padding: 8,
    backgroundColor: colors.error,
    borderRadius: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: colors.background,
  },
  attachButton: {
    padding: 4,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 8,
  },
  sendButton: {
    padding: 4,
    marginLeft: 8,
  },
  voiceButton: {
    padding: 4,
    marginLeft: 8,
  },
});
