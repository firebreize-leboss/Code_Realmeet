// app/(tabs)/chat.tsx - Version mise à jour avec fonctionnalités amis

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';

interface Friend {
  id: string;
  name: string;
  avatar: string;
  is_online: boolean;
}

interface Conversation {
  id: string;
  name: string;
  image: string;
  lastMessage: string;
  lastMessageTime: string;
  isGroup: boolean;
  unreadCount?: number;
}

export default function ChatScreen() {
  const router = useRouter();
  const [pendingRequestsCount, setPendingRequestsCount] = useState(3);
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  
  // Liste de conversations (vide au début)
  const [conversations, setConversations] = useState<Conversation[]>([]);
  
  // Liste d'amis pour le modal
  const [friends] = useState<Friend[]>([
    {
      id: '1',
      name: 'Marie Dubois',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
      is_online: true,
    },
    {
      id: '2',
      name: 'Pierre Martin',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
      is_online: false,
    },
    {
      id: '3',
      name: 'Sophie Bernard',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
      is_online: true,
    },
    {
      id: '4',
      name: 'Thomas Leclerc',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
      is_online: false,
    },
  ]);

  const handleCreateConversation = (friendId: string) => {
    // Trouver l'ami sélectionné
    const friend = friends.find(f => f.id === friendId);
    if (!friend) return;

    // Créer une nouvelle conversation
    const newConversation: Conversation = {
      id: `conv_${Date.now()}`,
      name: friend.name,
      image: friend.avatar,
      lastMessage: '',
      lastMessageTime: 'Maintenant',
      isGroup: false,
      unreadCount: 0,
    };

    // Ajouter la conversation à la liste
    setConversations(prev => [newConversation, ...prev]);
    
    // Fermer le modal
    setShowFriendsModal(false);
    
    // Rediriger vers la conversation
    router.push(`/chat-detail?id=${newConversation.id}`);
  };

  const renderChatItem = (chat: Conversation) => (
    <TouchableOpacity
      key={chat.id}
      style={styles.chatItem}
      onPress={() => router.push(`/chat-detail?id=${chat.id}`)}
      activeOpacity={0.8}
    >
      <View style={styles.chatImageContainer}>
        <Image source={{ uri: chat.image }} style={styles.chatImage} />
        {chat.isGroup && (
          <View style={styles.groupBadge}>
            <IconSymbol name="person.2.fill" size={12} color={colors.background} />
          </View>
        )}
      </View>
      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatName} numberOfLines={1}>
            {chat.name}
          </Text>
          <Text style={styles.chatTime}>{chat.lastMessageTime}</Text>
        </View>
        <View style={styles.lastMessageRow}>
          <Text style={styles.lastMessage} numberOfLines={2}>
            {chat.lastMessage || 'Commencez une conversation...'}
          </Text>
          {chat.unreadCount && chat.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{chat.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderFriendItem = ({ item }: { item: Friend }) => (
    <TouchableOpacity
      style={styles.friendItem}
      onPress={() => handleCreateConversation(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.friendAvatarContainer}>
        <Image source={{ uri: item.avatar }} style={styles.friendAvatar} />
        {item.is_online && <View style={styles.onlineIndicator} />}
      </View>
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>{item.name}</Text>
        <Text style={styles.friendStatus}>
          {item.is_online ? 'En ligne' : 'Hors ligne'}
        </Text>
      </View>
      <IconSymbol name="chevron.right" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={styles.headerButtons}>
          {/* Bouton demandes d'amitié */}
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push('/friend-requests')}
          >
            <IconSymbol name="envelope.fill" size={22} color={colors.text} />
            {pendingRequestsCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {pendingRequestsCount > 9 ? '9+' : pendingRequestsCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Bouton ajouter des amis */}
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push('/add-friends')}
          >
            <IconSymbol name="person.2.fill" size={22} color={colors.text} />
          </TouchableOpacity>

          {/* Bouton nouvelle conversation */}
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowFriendsModal(true)}
          >
            <IconSymbol name="square.and.pencil" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          Platform.OS !== 'ios' && styles.contentContainerWithTabBar,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {conversations.length > 0 ? (
          conversations.map(renderChatItem)
        ) : (
          <View style={styles.emptyState}>
            <IconSymbol name="message.fill" size={64} color={colors.textSecondary} />
            <Text style={styles.emptyText}>Aucune conversation</Text>
            <Text style={styles.emptySubtext}>
              Commencez une conversation avec vos amis
            </Text>
            <TouchableOpacity
              style={styles.startChatButton}
              onPress={() => setShowFriendsModal(true)}
            >
              <Text style={styles.startChatButtonText}>Nouvelle conversation</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Modal de sélection d'ami */}
      <Modal
        visible={showFriendsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFriendsModal(false)}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nouvelle conversation</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowFriendsModal(false)}
            >
              <IconSymbol name="xmark" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={friends}
            renderItem={renderFriendItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.friendsList}
            showsVerticalScrollIndicator={false}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    position: 'relative',
    padding: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: colors.background,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  contentContainerWithTabBar: {
    paddingBottom: 100,
  },
  chatItem: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chatImageContainer: {
    position: 'relative',
  },
  chatImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.border,
  },
  groupBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  chatInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  chatTime: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  lastMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.background,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  startChatButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  startChatButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  // Styles du modal
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendsList: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  friendAvatarContainer: {
    position: 'relative',
  },
  friendAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.border,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.card,
  },
  friendInfo: {
    flex: 1,
    gap: 4,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  friendStatus: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});