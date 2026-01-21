// app/(tabs)/chat.tsx
import React, { useState, useEffect, useCallback } from 'react';
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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import { useFriendRequests } from '@/hooks/useMessaging';
import { useAuth } from '@/contexts/AuthContext';
import { useDataCache } from '@/contexts/DataCacheContext';
import { supabase } from "@/lib/supabase";
import { LinearGradient } from 'expo-linear-gradient';

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
  // Nouveaux champs optionnels
  is_online?: boolean;
  activity_name?: string;
  participants_count?: number;
  mutual_activities?: number;
  activity_date?: string;
  emoji?: string;
}

type ChatFilter = 'all' | 'activities' | 'friends';

export default function ChatScreen() {
  const router = useRouter();
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ChatFilter>('all');

  // Obtenir les données via le cache global
  const { cache, markConversationAsRead, refreshConversations, removeConversationFromCache } = useDataCache();
  const { pendingCount: pendingRequestsCount } = useFriendRequests();
  const { profile } = useAuth();
  const [activityContacts, setActivityContacts] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [headerSearchQuery, setHeaderSearchQuery] = useState('');

  // Rafraîchir les conversations à chaque fois qu'on revient sur cette page
  useFocusEffect(
    useCallback(() => {
      refreshConversations();
    }, [refreshConversations])
  );

  // Utiliser les données du cache
  const conversations = cache.conversations;
  const friends = cache.friends.map(f => ({
    id: f.friend_id,
    name: f.full_name || 'Inconnu',
    avatar: f.avatar_url || '',
    is_online: false,
  }));
  const convLoading = false;
  const friendsLoading = false;

  // Compteurs pour le header
  const groupsCount = conversations.filter(c => c.isActivityGroup).length;
  const friendsCount = friends.length;

  // Compteurs pour les onglets
  const activitiesCount = conversations.filter(c => c.isActivityGroup && !c.isPastActivity).length;
  const privateCount = conversations.filter(c => !c.isGroup).length;

  const handleCreateConversation = async (friendId: string) => {
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser?.user?.id) throw new Error('User not authenticated');

      const { data: myParticipations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', currentUser.user.id);

      if (myParticipations && myParticipations.length > 0) {
        const myConvIds = myParticipations.map(p => p.conversation_id);
        const { data: friendParticipations } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', friendId)
          .in('conversation_id', myConvIds);

        if (friendParticipations && friendParticipations.length > 0) {
          for (const fp of friendParticipations) {
            const { data: convData } = await supabase
              .from('conversations')
              .select('is_group')
              .eq('id', fp.conversation_id)
              .single();

            if (convData?.is_group) continue;

            const { count } = await supabase
              .from('conversation_participants')
              .select('*', { count: 'exact', head: true })
              .eq('conversation_id', fp.conversation_id);

            if (count === 2) {
              // Réinitialiser is_hidden si la conversation était cachée
              await supabase
                .from('conversation_participants')
                .update({ is_hidden: false })
                .eq('conversation_id', fp.conversation_id)
                .eq('user_id', currentUser.user.id);

              setShowFriendsModal(false);
              router.push(`/chat-detail?id=${fp.conversation_id}`);
              return;
            }
          }
        }
      }

      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({ is_group: false })
        .select()
        .single();

      if (convError) throw convError;

      const participants = [currentUser.user.id, friendId].map(userId => ({
        conversation_id: conversation.id,
        user_id: userId,
      }));

      const { error: partError } = await supabase
        .from('conversation_participants')
        .insert(participants);

      if (partError) throw partError;

      setShowFriendsModal(false);
      router.push(`/chat-detail?id=${conversation.id}`);
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const loadActivityContacts = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;

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

      const { data: futureSlots } = await supabase
        .from('activity_slots')
        .select('activity_id')
        .in('activity_id', activityIds)
        .gte('date', todayStr);

      if (!futureSlots || futureSlots.length === 0) {
        setActivityContacts([]);
        return;
      }

      const validActivityIds = [...new Set(futureSlots.map(s => s.activity_id))];
      const validSlotIds = myParticipations
        .filter(p => validActivityIds.includes(p.activity_id))
        .map(p => p.slot_id);

      if (validSlotIds.length === 0) {
        setActivityContacts([]);
        return;
      }

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

  // Filtrer les conversations selon le filtre actif et la recherche
  const getFilteredConversations = () => {
    let filtered = conversations;

    // Filtre par recherche
    if (headerSearchQuery) {
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(headerSearchQuery.toLowerCase())
      );
    }

    // Filtre par onglet
    switch (activeFilter) {
      case 'activities':
        return filtered.filter(c => c.isActivityGroup && !c.isPastActivity);
      case 'friends':
        return filtered.filter(c => !c.isGroup);
      default:
        return filtered;
    }
  };

  // Supprimer une conversation (la cacher pour l'utilisateur)
  const handleDeleteConversation = async (conversationId: string, conversationName: string) => {
    Alert.alert(
      'Supprimer la conversation',
      `Voulez-vous supprimer la conversation avec ${conversationName} ? Vous pourrez démarrer une nouvelle conversation plus tard.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: currentUser } = await supabase.auth.getUser();
              if (!currentUser?.user?.id) return;

              // Retirer immédiatement du cache (optimistic update)
              removeConversationFromCache(conversationId);

              // Marquer la conversation comme cachée pour cet utilisateur en BDD
              const { error } = await supabase
                .from('conversation_participants')
                .update({ is_hidden: true })
                .eq('conversation_id', conversationId)
                .eq('user_id', currentUser.user.id);

              if (error) {
                // En cas d'erreur, rafraîchir pour remettre l'état correct
                await refreshConversations();
                throw error;
              }
            } catch (error) {
              console.error('Erreur suppression conversation:', error);
              Alert.alert('Erreur', 'Impossible de supprimer la conversation');
            }
          },
        },
      ]
    );
  };

  // Render d'un item de conversation style Instagram
  const renderChatItem = (chat: Conversation) => {
    return (
      <TouchableOpacity
        key={chat.id}
        style={styles.chatItem}
        onPress={() => {
          console.log('[CHAT ITEM] Clic court sur conversation:', chat.id, chat.name);
          markConversationAsRead(chat.id);
          router.push(`/chat-detail?id=${chat.id}`);
        }}
        onLongPress={() => {
          console.log('[CHAT ITEM] 🔴 Appui long détecté sur conversation:', chat.id, chat.name);
          handleDeleteConversation(chat.id, chat.name);
        }}
        activeOpacity={0.7}
      >
        {/* Avatar */}
        <Image
          source={{ uri: chat.image || 'https://via.placeholder.com/56' }}
          style={styles.chatAvatar}
        />

        {/* Infos conversation */}
        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatName} numberOfLines={1}>
              {chat.name}
            </Text>
            <Text style={styles.chatTime}>{chat.lastMessageTime}</Text>
          </View>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {chat.lastMessage || 'Commencez une conversation...'}
          </Text>
        </View>

        {/* Badge non lu */}
        {chat.unreadCount !== undefined && chat.unreadCount > 0 && (
          <LinearGradient
            colors={['#60A5FA', '#818CF8', '#C084FC']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.unreadBadge}
          >
            <Text style={styles.unreadText}>
              {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
            </Text>
          </LinearGradient>
        )}
      </TouchableOpacity>
    );
  };

  const renderFriendItem = ({ item }: { item: Friend }) => (
    <TouchableOpacity
      style={styles.friendItem}
      onPress={() => handleCreateConversation(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.friendAvatarContainer}>
        <Image source={{ uri: item.avatar }} style={styles.friendAvatar} />
        {item.is_online && (
          <View style={styles.friendOnlineIndicator}>
            <OnlinePulse size={14} />
          </View>
        )}
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
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header - barre avec dégradé bleu → violet → rose/violet */}
      <LinearGradient
        colors={['#60A5FA', '#818CF8', '#C084FC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
          <View style={styles.headerTop}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerLeftButtons}>
                <TouchableOpacity
                  style={styles.headerButton}
                  onPress={() => router.push('/add-friends')}
                >
                  <IconSymbol name="person.badge.plus" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <Text style={styles.headerUsername}>
                {profile?.full_name || profile?.username || 'Utilisateur'}
              </Text>
              <View style={styles.headerRightButtons}>
                <TouchableOpacity
                  style={styles.headerButton}
                  onPress={() => router.push('/friend-requests')}
                >
                  <IconSymbol name="envelope.fill" size={20} color="#FFFFFF" />
                  {pendingRequestsCount > 0 && (
                    <View style={styles.headerBadge}>
                      <Text style={styles.headerBadgeText}>
                        {pendingRequestsCount > 9 ? '9+' : pendingRequestsCount}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.headerButton}
                  onPress={() => setShowFriendsModal(true)}
                >
                  <IconSymbol name="pencil" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Barre de recherche */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <IconSymbol name="magnifyingglass" size={18} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher une conversation..."
            placeholderTextColor="#9CA3AF"
            value={headerSearchQuery}
            onChangeText={setHeaderSearchQuery}
          />
        </View>
      </View>

      {/* Onglets de filtre */}
      <View style={styles.filterTabs}>
        <TouchableOpacity
          onPress={() => setActiveFilter('all')}
          activeOpacity={0.7}
        >
          {activeFilter === 'all' ? (
            <LinearGradient
              colors={['#60A5FA', '#818CF8', '#C084FC']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.filterTabActive}
            >
              <Text style={styles.filterTabTextActive}>Tous</Text>
            </LinearGradient>
          ) : (
            <View style={styles.filterTab}>
              <Text style={styles.filterTabText}>Tous</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveFilter('activities')}
          activeOpacity={0.7}
        >
          {activeFilter === 'activities' ? (
            <LinearGradient
              colors={['#60A5FA', '#818CF8', '#C084FC']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.filterTabActive}
            >
              <Text style={styles.filterTabTextActive}>
                Activités {activitiesCount > 0 && `(${activitiesCount})`}
              </Text>
            </LinearGradient>
          ) : (
            <View style={styles.filterTab}>
              <Text style={styles.filterTabText}>
                Activités {activitiesCount > 0 && `(${activitiesCount})`}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveFilter('friends')}
          activeOpacity={0.7}
        >
          {activeFilter === 'friends' ? (
            <LinearGradient
              colors={['#60A5FA', '#818CF8', '#C084FC']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.filterTabActive}
            >
              <Text style={styles.filterTabTextActive}>
                Amis {privateCount > 0 && `(${privateCount})`}
              </Text>
            </LinearGradient>
          ) : (
            <View style={styles.filterTab}>
              <Text style={styles.filterTabText}>
                Amis {privateCount > 0 && `(${privateCount})`}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Titre Messages avec barre dégradée */}
      <View style={styles.messagesTitleContainer}>
        <Text style={styles.messagesTitle}>Messages</Text>
        <LinearGradient
          colors={['#60A5FA', '#818CF8', '#C084FC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.messagesTitleBar}
        />
      </View>

      {/* Liste des conversations pleine largeur */}
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
            <ActivityIndicator size="large" color="#3B82F6" />
          </View>
        ) : getFilteredConversations().length > 0 ? (
          <View style={styles.conversationsList}>
            {getFilteredConversations().map(renderChatItem)}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <IconSymbol
              name={activeFilter === 'activities' ? 'calendar' : activeFilter === 'friends' ? 'heart.fill' : 'message.fill'}
              size={64}
              color="#D1D5DB"
            />
            <Text style={styles.emptyText}>
              {activeFilter === 'activities'
                ? 'Aucune activité en cours'
                : activeFilter === 'friends'
                ? 'Aucune conversation'
                : 'Aucun message'}
            </Text>
            <Text style={styles.emptySubtext}>
              {activeFilter === 'activities'
                ? 'Rejoignez une activité pour voir vos groupes ici'
                : activeFilter === 'friends'
                ? 'Commencez une conversation avec vos amis'
                : 'Vos conversations apparaîtront ici'}
            </Text>
            {activeFilter === 'friends' && (
              <TouchableOpacity onPress={() => setShowFriendsModal(true)}>
                <LinearGradient
                  colors={['#60A5FA', '#818CF8', '#C084FC']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.startChatButton}
                >
                  <Text style={styles.startChatButtonText}>Nouvelle conversation</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
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
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nouvelle conversation</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowFriendsModal(false)}
            >
              <IconSymbol name="xmark" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          {friendsLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color="#818CF8" />
              <Text style={styles.emptyText}>Chargement...</Text>
            </View>
          ) : friends.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol name="person.2.fill" size={64} color="#D1D5DB" />
              <Text style={styles.emptyText}>Aucun ami</Text>
              <Text style={styles.emptySubtext}>
                Ajoutez des amis pour démarrer une conversation
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.modalSearchContainer}>
                <IconSymbol name="magnifyingglass" size={20} color="#9CA3AF" />
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder="Rechercher un contact..."
                  placeholderTextColor="#9CA3AF"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>

              <View style={styles.modalInfoBar}>
                <IconSymbol name="info.circle.fill" size={14} color="#818CF8" />
                <Text style={styles.modalInfoBarText}>
                  Vous pouvez contacter les personnes avec qui vous avez fait une activité
                </Text>
              </View>

              <FlatList
                data={friends.filter(c =>
                  c.name.toLowerCase().includes(searchQuery.toLowerCase())
                )}
                renderItem={renderFriendItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.friendsList}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <IconSymbol name="person.2" size={48} color="#D1D5DB" />
                    <Text style={styles.emptyText}>Aucun ami trouvé</Text>
                    <Text style={styles.emptySubtext}>
                      Ajoutez des amis pour démarrer une conversation
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
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // Header - barre avec dégradé
  header: {
    // backgroundColor sera remplacé par le gradient
  },
  headerSafeArea: {
    width: '100%',
  },
  headerTop: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLeftButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerRightButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerUsername: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  headerButton: {
    position: 'relative',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#60A5FA',
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Barre de recherche
  searchContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
  },

  // Onglets de filtre
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  filterTab: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    minWidth: '30%',
    alignItems: 'center',
  },
  filterTabActive: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    minWidth: '30%',
    alignItems: 'center',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  filterTabTextActive: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Titre Messages
  messagesTitleContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  messagesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  messagesTitleBar: {
    width: 40,
    height: 3,
    borderRadius: 2,
  },

  // Liste des conversations
  scrollView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    paddingBottom: 20,
  },
  contentContainerWithTabBar: {
    paddingBottom: 100,
  },
  conversationsList: {
    backgroundColor: '#FFFFFF',
  },

  // Item de conversation style Instagram
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  chatAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E5E7EB',
    marginRight: 12,
  },
  chatInfo: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginRight: 8,
  },
  chatTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  lastMessage: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  unreadBadge: {
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  startChatButton: {
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  startChatButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 8,
  },
  modalSearchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#374151',
  },
  modalInfoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    gap: 8,
  },
  modalInfoBarText: {
    flex: 1,
    fontSize: 13,
    color: '#818CF8',
    fontWeight: '500',
  },
  friendsList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
    gap: 12,
  },
  friendAvatarContainer: {
    position: 'relative',
  },
  friendAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E5E7EB',
  },
  friendOnlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  friendStatus: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },
});
