// app/(tabs)/chat.tsx
import React, { useState, useEffect , useCallback} from 'react';
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
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import { useFriends, useFriendRequests, useConversations } from '@/hooks/useMessaging';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from "@/lib/supabase"; // adapte le chemin

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
  const [showFriendsModal, setShowFriendsModal] = useState(false);

  // Obtenir les données via les hooks de messagerie
  const { pendingCount: pendingRequestsCount } = useFriendRequests();
  const { friends: friendData, loading: friendsLoading } = useFriends();
  const { conversations, createConversation, refresh: refreshConversations, loading: convLoading } = useConversations();
  const { profile } = useAuth();
  const [activityContacts, setActivityContacts] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  // État local pour stocker la liste d'amis formatée
  const [friends, setFriends] = useState<Friend[]>([]);
useEffect(() => {
  console.log('📦 friendData reçu:', JSON.stringify(friendData, null, 2));
  
  if (friendData) {
    const formatted = (friendData as any[]).map(f => {
      console.log('🔄 Formatting friend:', f);
      return {
        id: f.friend_id,
        name: f.full_name || 'Inconnu',
        avatar: f.avatar_url || '',
        is_online: false,
      };
    });
    console.log('✅ Friends formatted:', formatted);
    setFriends(formatted);
  } else {
    setFriends([]);
  }
}, [friendData]);

  const handleCreateConversation = async (friendId: string) => {
    try {
      const convId = await createConversation([friendId]);
      setShowFriendsModal(false);
      router.push(`/chat-detail?id=${convId}`);
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

 // Dans app/(tabs)/chat.tsx, remplace la fonction renderChatItem par celle-ci :
useFocusEffect(
  useCallback(() => {
    // Rafraîchir les conversations à chaque fois qu'on revient sur cette page
    refreshConversations();
  }, [refreshConversations])
);
const renderChatItem = (chat: Conversation) => (
  <TouchableOpacity
    key={chat.id}
    style={styles.chatItem}
    onPress={() => router.push(`/chat-detail?id=${chat.id}`)}
    activeOpacity={0.8}
  >
    <View style={styles.chatImageContainer}>
      <Image 
        source={{ uri: chat.image || 'https://via.placeholder.com/56' }} 
        style={styles.chatImage} 
      />
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
        <Text style={styles.lastMessage} numberOfLines={1}>
          {chat.lastMessage || 'Commencez une conversation...'}
        </Text>
        {chat.unreadCount !== undefined && chat.unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>
              {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
            </Text>
          </View>
        )}
      </View>
    </View>
  </TouchableOpacity>
);
// Charger les personnes avec qui on a fait des activités
const loadActivityContacts = async () => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    // Récupérer les activités auxquelles l'utilisateur a participé
    const { data: myParticipations } = await supabase
      .from('slot_participants')
      .select('slot_id, activity_id')
      .eq('user_id', userData.user.id);

    if (!myParticipations || myParticipations.length === 0) {
      setActivityContacts([]);
      return;
    }

    const slotIds = myParticipations.map(p => p.slot_id);

    // Récupérer les autres participants de ces mêmes créneaux
    const { data: otherParticipants } = await supabase
      .from('slot_participants')
      .select(`
        user_id,
        profiles:user_id (
          id,
          full_name,
          avatar_url
        )
      `)
      .in('slot_id', slotIds)
      .neq('user_id', userData.user.id);

    if (!otherParticipants) {
      setActivityContacts([]);
      return;
    }

    // Dédupliquer par user_id
    const uniqueContacts = new Map();
    otherParticipants.forEach((p: any) => {
      if (p.profiles && !uniqueContacts.has(p.user_id)) {
        uniqueContacts.set(p.user_id, {
          id: p.user_id,
          name: p.profiles.full_name || 'Utilisateur',
          avatar: p.profiles.avatar_url || '',
          is_online: false,
        });
      }
    });

    setActivityContacts(Array.from(uniqueContacts.values()));
  } catch (error) {
    console.error('Erreur chargement contacts activités:', error);
  }
};

useEffect(() => {
  loadActivityContacts();
}, []);
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
    <SafeAreaView style={commonStyles.container} edges={['top','bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={styles.headerButtons}>
          {/* Bouton personnes rencontrées */}
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push('/met-people')}
          >
            <IconSymbol name="person.2.wave.2" size={22} color={colors.text} />
          </TouchableOpacity>

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
        {convLoading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : conversations.length > 0 ? (
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
        <SafeAreaView style={styles.modalContainer} edges={['top',"bottom"]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nouvelle conversation</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowFriendsModal(false)}
            >
              <IconSymbol name="xmark" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {friendsLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.emptyText}>Chargement...</Text>
            </View>
          ) : friends.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol name="person.2.fill" size={64} color={colors.textSecondary} />
              <Text style={styles.emptyText}>Aucun ami</Text>
              <Text style={styles.emptySubtext}>
                Ajoutez des amis pour démarrer une conversation
              </Text>
            </View>
          ) : (
            <>
            <View style={styles.searchContainer}>
              <IconSymbol name="magnifyingglass" size={20} color={colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Rechercher un contact..."
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

{/* Info */}
<View style={styles.infoBar}>
  <IconSymbol name="info.circle.fill" size={14} color={colors.primary} />
  <Text style={styles.infoBarText}>
    Vous pouvez contacter les personnes avec qui vous avez fait une activité
  </Text>
</View>

<FlatList
  data={activityContacts.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  )}
  renderItem={renderFriendItem}
  keyExtractor={item => item.id}
  contentContainerStyle={styles.friendsList}
  showsVerticalScrollIndicator={false}
  ListEmptyComponent={
    <View style={styles.emptyState}>
      <IconSymbol name="person.2" size={48} color={colors.textSecondary} />
      <Text style={styles.emptyText}>Aucun contact trouvé</Text>
      <Text style={styles.emptySubtext}>
        Participez à des activités pour rencontrer des personnes
      </Text>
    </View>
  }
/>
</>
          )}
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
  searchContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: colors.card,
  marginHorizontal: 20,
  marginVertical: 12,
  paddingHorizontal: 16,
  borderRadius: 12,
  gap: 12,
},
searchInput: {
  flex: 1,
  paddingVertical: 12,
  fontSize: 16,
  color: colors.text,
},
infoBar: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: colors.primary + '15',
  marginHorizontal: 20,
  marginBottom: 12,
  padding: 12,
  borderRadius: 10,
  gap: 8,
},
infoBarText: {
  flex: 1,
  fontSize: 12,
  color: colors.primary,
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
  // Styles du modal de nouvelle conversation
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
    bottom: 4,
    right: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.background,
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
