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
  activityId?: string | null;
  slotId?: string | null;
  slotDate?: string | null;
  isActivityGroup?: boolean;
  isPastActivity?: boolean;
}

type ChatFilter = 'ongoing' | 'past' | 'private';

export default function ChatScreen() {
  const router = useRouter();
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ChatFilter>('ongoing');

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

    const activityIds = [...new Set(myParticipations.map(p => p.activity_id))];
    const todayStr = new Date().toISOString().split('T')[0];

    // Récupérer les activités qui ont encore des créneaux futurs
    const { data: futureSlots } = await supabase
      .from('activity_slots')
      .select('activity_id')
      .in('activity_id', activityIds)
      .gte('date', todayStr);

    if (!futureSlots || futureSlots.length === 0) {
      setActivityContacts([]);
      return;
    }

    // Garder uniquement les activités avec créneaux futurs
    const validActivityIds = [...new Set(futureSlots.map(s => s.activity_id))];
    const validSlotIds = myParticipations
      .filter(p => validActivityIds.includes(p.activity_id))
      .map(p => p.slot_id);

    if (validSlotIds.length === 0) {
      setActivityContacts([]);
      return;
    }

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
      .in('slot_id', validSlotIds)
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
    <SafeAreaView style={[commonStyles.container, { backgroundColor: '#F5EDE4' }]} edges={['top','bottom']}>
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

      {/* Barre de filtres */}
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterButton, activeFilter === 'ongoing' && styles.filterButtonActive]}
          onPress={() => setActiveFilter('ongoing')}
        >
          <View style={[styles.filterDot, activeFilter === 'ongoing' && styles.filterDotActive]} />
          <Text style={[styles.filterText, activeFilter === 'ongoing' && styles.filterTextActive]}>
            En cours
          </Text>
          {conversations.filter(c => c.isActivityGroup && !c.isPastActivity).length > 0 && (
            <View style={[styles.filterBadge, activeFilter === 'ongoing' && styles.filterBadgeActive]}>
              <Text style={[styles.filterBadgeText, activeFilter === 'ongoing' && styles.filterBadgeTextActive]}>
                {conversations.filter(c => c.isActivityGroup && !c.isPastActivity).length}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterButton, activeFilter === 'past' && styles.filterButtonActive]}
          onPress={() => setActiveFilter('past')}
        >
          <IconSymbol
            name="clock.fill"
            size={16}
            color={activeFilter === 'past' ? '#FFFFFF' : '#666666'}
          />
          <Text style={[styles.filterText, activeFilter === 'past' && styles.filterTextActive]}>
            Terminées
          </Text>
          {conversations.filter(c => c.isActivityGroup && c.isPastActivity).length > 0 && (
            <View style={[styles.filterBadge, activeFilter === 'past' && styles.filterBadgeActive]}>
              <Text style={[styles.filterBadgeText, activeFilter === 'past' && styles.filterBadgeTextActive]}>
                {conversations.filter(c => c.isActivityGroup && c.isPastActivity).length}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterButton, activeFilter === 'private' && styles.filterButtonActive]}
          onPress={() => setActiveFilter('private')}
        >
          <IconSymbol
            name="message.fill"
            size={16}
            color={activeFilter === 'private' ? '#FFFFFF' : '#666666'}
          />
          <Text style={[styles.filterText, activeFilter === 'private' && styles.filterTextActive]}>
            Privés
          </Text>
          {conversations.filter(c => !c.isGroup).length > 0 && (
            <View style={[styles.filterBadge, activeFilter === 'private' && styles.filterBadgeActive]}>
              <Text style={[styles.filterBadgeText, activeFilter === 'private' && styles.filterBadgeTextActive]}>
                {conversations.filter(c => !c.isGroup).length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
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
        ) : (
          <>
            {/* Activités en cours */}
            {activeFilter === 'ongoing' && (
              conversations.filter(c => c.isActivityGroup && !c.isPastActivity).length > 0 ? (
                <View style={styles.section}>
                  {conversations.filter(c => c.isActivityGroup && !c.isPastActivity).map(renderChatItem)}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <IconSymbol name="calendar" size={64} color={colors.textSecondary} />
                  <Text style={styles.emptyText}>Aucune activité en cours</Text>
                  <Text style={styles.emptySubtext}>
                    Rejoignez une activité pour voir vos groupes ici
                  </Text>
                </View>
              )
            )}

            {/* Activités terminées */}
            {activeFilter === 'past' && (
              conversations.filter(c => c.isActivityGroup && c.isPastActivity).length > 0 ? (
                <View style={styles.section}>
                  {conversations.filter(c => c.isActivityGroup && c.isPastActivity).map((chat) => (
                    <TouchableOpacity
                      key={chat.id}
                      style={[styles.chatItem, styles.chatItemPast]}
                      onPress={() => router.push(`/chat-detail?id=${chat.id}`)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.chatImageContainer}>
                        <Image
                          source={{ uri: chat.image || 'https://via.placeholder.com/56' }}
                          style={[styles.chatImage, styles.chatImagePast]}
                        />
                        <View style={styles.groupBadge}>
                          <IconSymbol name="person.2.fill" size={12} color={colors.background} />
                        </View>
                        <View style={styles.pastLockBadge}>
                          <IconSymbol name="lock.fill" size={10} color={colors.background} />
                        </View>
                      </View>
                      <View style={styles.chatInfo}>
                        <View style={styles.chatHeader}>
                          <Text style={[styles.chatName, styles.chatNamePast]} numberOfLines={1}>
                            {chat.name}
                          </Text>
                          <Text style={styles.chatTime}>{chat.lastMessageTime}</Text>
                        </View>
                        <View style={styles.lastMessageRow}>
                          <Text style={styles.lastMessage} numberOfLines={1}>
                            {chat.lastMessage || 'Groupe fermé'}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <IconSymbol name="clock.fill" size={64} color={colors.textSecondary} />
                  <Text style={styles.emptyText}>Aucune activité passée</Text>
                  <Text style={styles.emptySubtext}>
                    Vos activités terminées apparaîtront ici
                  </Text>
                </View>
              )
            )}

            {/* Messages privés */}
            {activeFilter === 'private' && (
              conversations.filter(c => !c.isGroup).length > 0 ? (
                <View style={styles.section}>
                  {conversations.filter(c => !c.isGroup).map(renderChatItem)}
                </View>
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
              )
            )}
          </>
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
    backgroundColor: '#F5EDE4',
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
    backgroundColor: '#F5EDE4',
    borderBottomWidth: 2,
    borderBottomColor: '#E8DCC8',
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    gap: 7,
    borderWidth: 2,
    borderColor: '#E8DCC8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  filterButtonActive: {
    backgroundColor: '#FF6B9D',
    borderColor: '#FF6B9D',
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  filterDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981',
  },
  filterDotActive: {
    backgroundColor: '#FFFFFF',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666666',
    letterSpacing: 0.2,
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  filterBadge: {
    backgroundColor: '#FF6B9D',
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 7,
  },
  filterBadgeActive: {
    backgroundColor: '#FFFFFF',
  },
  filterBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  filterBadgeTextActive: {
    color: '#FF6B9D',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2D2D2D',
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
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E8DCC8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FF4757',
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#F5EDE4',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#F5EDE4',
  },
  searchContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#FFFFFF',
  marginHorizontal: 20,
  marginVertical: 12,
  paddingHorizontal: 16,
  borderRadius: 12,
  gap: 12,
  borderWidth: 2,
  borderColor: '#E8DCC8',
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
  backgroundColor: '#E3F2FD',
  marginHorizontal: 20,
  marginBottom: 12,
  padding: 14,
  borderRadius: 12,
  gap: 10,
  borderLeftWidth: 4,
  borderLeftColor: '#2196F3',
},
infoBarText: {
  flex: 1,
  fontSize: 13,
  color: '#1976D2',
  fontWeight: '600',
},
  contentContainer: {
    paddingBottom: 20,
  },
  contentContainerWithTabBar: {
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  sectionLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  chatItem: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8DCC8',
    marginHorizontal: 12,
    marginVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  chatItemPast: {
    opacity: 0.75,
  },
  chatImagePast: {
    opacity: 0.7,
  },
  chatNamePast: {
    color: colors.textSecondary,
  },
  pastLockBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#9E9E9E',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
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
    backgroundColor: '#FF6B9D',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
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
    backgroundColor: '#FF6B9D',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  unreadText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
    backgroundColor: '#F5EDE4',
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D2D2D',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  startChatButton: {
    backgroundColor: '#FF6B9D',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 24,
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  startChatButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  // Styles du modal de nouvelle conversation
  modalContainer: {
    flex: 1,
    backgroundColor: '#F5EDE4',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#F5EDE4',
    borderBottomWidth: 2,
    borderBottomColor: '#E8DCC8',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2D2D2D',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E8DCC8',
  },
  friendsList: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    gap: 14,
    borderWidth: 2,
    borderColor: '#E8DCC8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CAF50',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 3,
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
