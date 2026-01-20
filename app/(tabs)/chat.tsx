// app/(tabs)/chat.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import { useFriendRequests } from '@/hooks/useMessaging';
import { useAuth } from '@/contexts/AuthContext';
import { useDataCache } from '@/contexts/DataCacheContext';
import { supabase } from "@/lib/supabase";

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

// Composant pour l'animation pulse du point vert en ligne
const OnlinePulse = ({ size = 14, style }: { size?: number; style?: any }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#22C55E',
          borderWidth: 2,
          borderColor: '#FFFFFF',
          transform: [{ scale: pulseAnim }],
        },
        style,
      ]}
    />
  );
};

// Fonction pour vérifier si quelqu'un est en ligne (lastMessageTime < 5 minutes)
const isUserOnline = (lastMessageTime: string): boolean => {
  if (!lastMessageTime) return false;

  // Si c'est un format relatif comme "2 min", "5 min", etc.
  const minMatch = lastMessageTime.match(/(\d+)\s*min/i);
  if (minMatch) {
    const minutes = parseInt(minMatch[1]);
    return minutes < 5;
  }

  // Si c'est "À l'instant" ou similaire
  if (lastMessageTime.toLowerCase().includes('instant') || lastMessageTime.toLowerCase().includes('maintenant')) {
    return true;
  }

  return false;
};

export default function ChatScreen() {
  const router = useRouter();
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ChatFilter>('all');

  // Obtenir les données via le cache global
  const { cache, markConversationAsRead, refreshConversations } = useDataCache();
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

  // Filtrer les utilisateurs en ligne pour la section "En ligne maintenant"
  const onlineUsers = conversations
    .filter(c => isUserOnline(c.lastMessageTime))
    .map(c => ({
      id: c.id,
      name: c.name.split(' ')[0], // Prénom seulement
      avatar: c.image,
      isGroup: c.isGroup,
    }));

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

  // Render d'un utilisateur en ligne dans la section horizontale
  const renderOnlineUser = (user: { id: string; name: string; avatar: string; isGroup: boolean }) => (
    <TouchableOpacity
      key={user.id}
      style={styles.onlineUserItem}
      onPress={() => {
        markConversationAsRead(user.id);
        router.push(`/chat-detail?id=${user.id}`);
      }}
      activeOpacity={0.8}
    >
      <View style={styles.onlineAvatarContainer}>
        <LinearGradient
          colors={['#A855F7', '#EC4899', '#F43F5E']}
          style={styles.onlineAvatarBorder}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.onlineAvatarInner}>
            <Image
              source={{ uri: user.avatar || 'https://via.placeholder.com/56' }}
              style={styles.onlineAvatar}
            />
          </View>
        </LinearGradient>
        <View style={styles.onlinePulseContainer}>
          <OnlinePulse size={12} />
        </View>
      </View>
      <Text style={styles.onlineUserName} numberOfLines={1}>
        {user.name}
      </Text>
    </TouchableOpacity>
  );

  // Render d'une carte de conversation selon son type
  const renderChatItem = (chat: Conversation) => {
    const isOnline = isUserOnline(chat.lastMessageTime);
    const isActivity = chat.isActivityGroup;

    return (
      <TouchableOpacity
        key={chat.id}
        style={[
          styles.chatCard,
          isActivity ? styles.chatCardActivity : styles.chatCardFriend,
        ]}
        onPress={() => {
          markConversationAsRead(chat.id);
          router.push(`/chat-detail?id=${chat.id}`);
        }}
        activeOpacity={0.8}
      >
        {/* Badge type en haut */}
        <View style={styles.cardBadgeRow}>
          {isActivity ? (
            <View style={styles.activityTypeBadge}>
              <IconSymbol name="calendar" size={10} color="#3B82F6" />
              <Text style={styles.activityTypeBadgeText}>ACTIVITÉ</Text>
            </View>
          ) : (
            <View style={styles.friendTypeBadge}>
              <IconSymbol name="heart.fill" size={10} color="#EC4899" />
              <Text style={styles.friendTypeBadgeText}>AMI</Text>
            </View>
          )}
        </View>

        <View style={styles.chatItemContent}>
          {/* Avatar avec indicateur en ligne */}
          <View style={styles.chatImageContainer}>
            <Image
              source={{ uri: chat.image || 'https://via.placeholder.com/56' }}
              style={[
                styles.chatImage,
                isActivity && styles.chatImageActivity,
              ]}
            />
            {isOnline && (
              <View style={styles.chatOnlineIndicator}>
                <OnlinePulse size={14} />
              </View>
            )}
            {chat.isGroup && !isActivity && (
              <View style={styles.groupBadge}>
                <IconSymbol name="person.2.fill" size={12} color="#FFFFFF" />
              </View>
            )}
          </View>

          {/* Infos conversation */}
          <View style={styles.chatInfo}>
            <View style={styles.chatHeader}>
              <Text style={styles.chatName} numberOfLines={1}>
                {chat.emoji && `${chat.emoji} `}{chat.name}
              </Text>
              <Text style={styles.chatTime}>{chat.lastMessageTime}</Text>
            </View>

            {/* Infos supplémentaires selon le type */}
            {isActivity ? (
              <View style={styles.activityMeta}>
                {chat.activity_name && (
                  <View style={styles.activityNameBadge}>
                    <Text style={styles.activityNameText}>{chat.activity_name}</Text>
                  </View>
                )}
                <View style={styles.activityMetaRow}>
                  {chat.participants_count && (
                    <View style={styles.metaItem}>
                      <IconSymbol name="person.2.fill" size={12} color="#6B7280" />
                      <Text style={styles.metaText}>{chat.participants_count} participants</Text>
                    </View>
                  )}
                  {chat.activity_date && (
                    <View style={styles.metaItem}>
                      <IconSymbol name="clock.fill" size={12} color="#6B7280" />
                      <Text style={styles.metaText}>{chat.activity_date}</Text>
                    </View>
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.friendMeta}>
                {chat.mutual_activities && chat.mutual_activities > 0 && (
                  <View style={styles.metaItem}>
                    <IconSymbol name="cup.and.saucer.fill" size={12} color="#EC4899" />
                    <Text style={styles.metaTextPink}>{chat.mutual_activities} activités en commun</Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.lastMessageRow}>
              <Text style={styles.lastMessage} numberOfLines={1}>
                {chat.lastMessage || 'Commencez une conversation...'}
              </Text>
              {chat.unreadCount !== undefined && chat.unreadCount > 0 && (
                <LinearGradient
                  colors={isActivity ? ['#3B82F6', '#06B6D4'] : ['#F43F5E', '#EC4899']}
                  style={styles.unreadBadge}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.unreadText}>
                    {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                  </Text>
                </LinearGradient>
              )}
            </View>
          </View>
        </View>
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
      {/* Header avec gradient */}
      <LinearGradient
        colors={['#A855F7', '#EC4899', '#F43F5E']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
          <View style={styles.headerTop}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>Messages</Text>
              <View style={styles.headerButtons}>
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
                  onPress={() => router.push('/add-friends')}
                >
                  <IconSymbol name="person.badge.plus" size={20} color="#FFFFFF" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.headerButton}
                  onPress={() => setShowFriendsModal(true)}
                >
                  <IconSymbol name="square.and.pencil" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Compteurs */}
            <View style={styles.headerStats}>
              <View style={styles.headerStatItem}>
                <IconSymbol name="person.2.fill" size={14} color="rgba(255,255,255,0.9)" />
                <Text style={styles.headerStatText}>{groupsCount} groupes</Text>
              </View>
              <Text style={styles.headerStatDot}>•</Text>
              <View style={styles.headerStatItem}>
                <IconSymbol name="heart.fill" size={14} color="rgba(255,255,255,0.9)" />
                <Text style={styles.headerStatText}>{friendsCount} amis</Text>
              </View>
            </View>

            {/* Barre de recherche */}
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
        </SafeAreaView>
      </LinearGradient>

      {/* Section En ligne maintenant */}
      {onlineUsers.length > 0 && (
        <View style={styles.onlineSection}>
          <Text style={styles.onlineSectionTitle}>En ligne maintenant</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.onlineScrollContent}
          >
            {onlineUsers.map(renderOnlineUser)}
          </ScrollView>
        </View>
      )}

      {/* Onglets de filtre */}
      <View style={styles.filterTabs}>
        {/* Onglet Tous */}
        <TouchableOpacity
          style={styles.filterTab}
          onPress={() => setActiveFilter('all')}
          activeOpacity={0.8}
        >
          {activeFilter === 'all' ? (
            <LinearGradient
              colors={['#A855F7', '#EC4899']}
              style={styles.filterTabActive}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <IconSymbol name="sparkles" size={16} color="#FFFFFF" />
              <Text style={styles.filterTabTextActive}>Tous</Text>
            </LinearGradient>
          ) : (
            <View style={styles.filterTabInactive}>
              <IconSymbol name="sparkles" size={16} color="#6B7280" />
              <Text style={styles.filterTabTextInactive}>Tous</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Onglet Activités */}
        <TouchableOpacity
          style={styles.filterTab}
          onPress={() => setActiveFilter('activities')}
          activeOpacity={0.8}
        >
          {activeFilter === 'activities' ? (
            <LinearGradient
              colors={['#3B82F6', '#06B6D4']}
              style={styles.filterTabActive}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <IconSymbol name="calendar" size={16} color="#FFFFFF" />
              <Text style={styles.filterTabTextActive}>Activités</Text>
              {activitiesCount > 0 && (
                <View style={styles.filterTabBadgeActive}>
                  <Text style={styles.filterTabBadgeTextActive}>{activitiesCount}</Text>
                </View>
              )}
            </LinearGradient>
          ) : (
            <View style={styles.filterTabInactive}>
              <IconSymbol name="calendar" size={16} color="#6B7280" />
              <Text style={styles.filterTabTextInactive}>Activités</Text>
              {activitiesCount > 0 && (
                <View style={styles.filterTabBadgeInactive}>
                  <Text style={styles.filterTabBadgeTextInactive}>{activitiesCount}</Text>
                </View>
              )}
            </View>
          )}
        </TouchableOpacity>

        {/* Onglet Amis */}
        <TouchableOpacity
          style={styles.filterTab}
          onPress={() => setActiveFilter('friends')}
          activeOpacity={0.8}
        >
          {activeFilter === 'friends' ? (
            <LinearGradient
              colors={['#F43F5E', '#EC4899']}
              style={styles.filterTabActive}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <IconSymbol name="heart.fill" size={16} color="#FFFFFF" />
              <Text style={styles.filterTabTextActive}>Amis</Text>
              {privateCount > 0 && (
                <View style={styles.filterTabBadgeActive}>
                  <Text style={styles.filterTabBadgeTextActive}>{privateCount}</Text>
                </View>
              )}
            </LinearGradient>
          ) : (
            <View style={styles.filterTabInactive}>
              <IconSymbol name="heart.fill" size={16} color="#6B7280" />
              <Text style={styles.filterTabTextInactive}>Amis</Text>
              {privateCount > 0 && (
                <View style={styles.filterTabBadgeInactive}>
                  <Text style={styles.filterTabBadgeTextInactive}>{privateCount}</Text>
                </View>
              )}
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Bannière d'info selon le filtre */}
      {activeFilter === 'activities' && (
        <View style={styles.infoBannerActivity}>
          <IconSymbol name="calendar" size={18} color="#3B82F6" />
          <Text style={styles.infoBannerTextActivity}>
            Groupes d'activités - Conversations créées automatiquement pour vos activités planifiées
          </Text>
        </View>
      )}
      {activeFilter === 'friends' && (
        <View style={styles.infoBannerFriend}>
          <IconSymbol name="heart.fill" size={18} color="#EC4899" />
          <Text style={styles.infoBannerTextFriend}>
            Vos amis - Personnes rencontrées lors d'activités et ajoutées en amis
          </Text>
        </View>
      )}

      {/* Liste des conversations */}
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
            <ActivityIndicator size="large" color="#A855F7" />
          </View>
        ) : getFilteredConversations().length > 0 ? (
          <View style={styles.section}>
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
              <TouchableOpacity
                style={styles.startChatButton}
                onPress={() => setShowFriendsModal(true)}
              >
                <LinearGradient
                  colors={['#F43F5E', '#EC4899']}
                  style={styles.startChatButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
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
              <ActivityIndicator size="large" color="#A855F7" />
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
                <IconSymbol name="info.circle.fill" size={14} color="#3B82F6" />
                <Text style={styles.modalInfoBarText}>
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
                    <IconSymbol name="person.2" size={48} color="#D1D5DB" />
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
  container: {
    flex: 1,
    backgroundColor: '#FAF5FF',
  },

  // Header styles
  header: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  headerSafeArea: {
    width: '100%',
  },
  headerTop: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    position: 'relative',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  headerBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F43F5E',
  },
  headerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerStatText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  headerStatDot: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginHorizontal: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
  },

  // Online section styles
  onlineSection: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3E8FF',
  },
  onlineSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
    marginLeft: 20,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  onlineScrollContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  onlineUserItem: {
    alignItems: 'center',
    width: 70,
  },
  onlineAvatarContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  onlineAvatarBorder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    padding: 3,
  },
  onlineAvatarInner: {
    flex: 1,
    borderRadius: 27,
    backgroundColor: '#FFFFFF',
    padding: 2,
  },
  onlineAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
  },
  onlinePulseContainer: {
    position: 'absolute',
    bottom: 2,
    right: 2,
  },
  onlineUserName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },

  // Filter tabs styles
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: '#FFFFFF',
  },
  filterTab: {
    flex: 1,
  },
  filterTabActive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 6,
  },
  filterTabInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  filterTabTextActive: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  filterTabTextInactive: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterTabBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  filterTabBadgeTextActive: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  filterTabBadgeInactive: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  filterTabBadgeTextInactive: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },

  // Info banners
  infoBannerActivity: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    gap: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  infoBannerTextActivity: {
    flex: 1,
    fontSize: 13,
    color: '#1D4ED8',
    fontWeight: '500',
    lineHeight: 18,
  },
  infoBannerFriend: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    gap: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#EC4899',
  },
  infoBannerTextFriend: {
    flex: 1,
    fontSize: 13,
    color: '#BE185D',
    fontWeight: '500',
    lineHeight: 18,
  },

  // Chat cards
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
    paddingTop: 12,
  },
  contentContainerWithTabBar: {
    paddingBottom: 100,
  },
  section: {
    paddingHorizontal: 16,
    gap: 12,
  },
  chatCard: {
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  chatCardActivity: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
  },
  chatCardFriend: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FECDD3',
  },
  cardBadgeRow: {
    marginBottom: 10,
  },
  activityTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  activityTypeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#3B82F6',
    letterSpacing: 0.5,
  },
  friendTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FCE7F3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  friendTypeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#EC4899',
    letterSpacing: 0.5,
  },
  chatItemContent: {
    flexDirection: 'row',
    gap: 14,
  },
  chatImageContainer: {
    position: 'relative',
  },
  chatImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E5E7EB',
  },
  chatImageActivity: {
    borderRadius: 16,
  },
  chatOnlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  groupBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#EC4899',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
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
    fontWeight: '700',
    color: '#1F2937',
  },
  chatTime: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  activityMeta: {
    gap: 6,
  },
  activityNameBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activityNameText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  activityMetaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  metaTextPink: {
    fontSize: 12,
    color: '#EC4899',
    fontWeight: '500',
  },
  friendMeta: {
    marginTop: 2,
  },
  lastMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  unreadBadge: {
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  unreadText: {
    fontSize: 12,
    fontWeight: '800',
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
    fontWeight: '700',
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
    overflow: 'hidden',
    borderRadius: 24,
  },
  startChatButtonGradient: {
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  startChatButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#FAF5FF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3E8FF',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
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
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
    gap: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  modalInfoBarText: {
    flex: 1,
    fontSize: 13,
    color: '#1D4ED8',
    fontWeight: '500',
  },
  friendsList: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 14,
    borderWidth: 1.5,
    borderColor: '#F3E8FF',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
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
  },
  friendInfo: {
    flex: 1,
    gap: 2,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  friendStatus: {
    fontSize: 13,
    color: '#9CA3AF',
  },
});
