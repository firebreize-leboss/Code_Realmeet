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
  Alert,
  Animated as RNAnimated,
  Pressable,
  Dimensions,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles, typography, spacing, borderRadius } from '@/styles/commonStyles';
import { useFriendRequests } from '@/hooks/useMessaging';
import { useAuth } from '@/contexts/AuthContext';
import { useDataCache } from '@/contexts/DataCacheContext';
import { supabase } from "@/lib/supabase";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
  isMuted?: boolean;
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
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

  const { cache, markConversationAsRead, refreshConversations, refreshFriends, removeConversationFromCache, toggleMuteConversation } = useDataCache();
  const { pendingCount: pendingRequestsCount, refresh: refreshFriendRequests } = useFriendRequests();
  const { profile } = useAuth();
  const [activityContacts, setActivityContacts] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [headerSearchQuery, setHeaderSearchQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      refreshConversations();
      refreshFriends();
      refreshFriendRequests();
    }, [refreshConversations, refreshFriends, refreshFriendRequests])
  );

  const conversations = cache.conversations;
  const friends = cache.friends.map(f => ({
    id: f.friend_id,
    name: f.full_name || 'Inconnu',
    avatar: f.avatar_url || '',
    is_online: false,
  }));
  const convLoading = false;
  const friendsLoading = false;

  const groupsCount = conversations.filter(c => c.isActivityGroup).length;
  const friendsCount = friends.length;

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

  const getFilteredConversations = () => {
    let filtered = conversations;

    if (headerSearchQuery) {
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(headerSearchQuery.toLowerCase())
      );
    }

    switch (activeFilter) {
      case 'activities':
        return filtered.filter(c => c.isActivityGroup && !c.isPastActivity);
      case 'friends':
        return filtered.filter(c => !c.isGroup);
      default:
        return filtered;
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser?.user?.id) return;

      removeConversationFromCache(conversationId);

      const { error } = await supabase
        .from('conversation_participants')
        .update({ is_hidden: true })
        .eq('conversation_id', conversationId)
        .eq('user_id', currentUser.user.id);

      if (error) {
        await refreshConversations();
        throw error;
      }

      setSelectedConversation(null);
    } catch (error) {
      console.error('Erreur suppression conversation:', error);
      Alert.alert('Erreur', 'Impossible de supprimer la conversation');
    }
  };

  const handleCloseActionBar = () => {
    setSelectedConversation(null);
  };

  const handleMuteConversation = async () => {
    if (!selectedConversation) return;

    const newMutedState = await toggleMuteConversation(selectedConversation.id);
    setSelectedConversation(null);
  };

  const handleArchiveConversation = () => {
    Alert.alert('Archiver', `Conversation "${selectedConversation?.name}" archivée`);
    setSelectedConversation(null);
  };

  // Composant pour un item de conversation
  const ChatItem = ({ chat }: { chat: Conversation }) => {
    const isSelected = selectedConversation?.id === chat.id;
    const hasUnread = chat.unreadCount !== undefined && chat.unreadCount > 0;
    const scale = useSharedValue(1);
    const bgOpacity = useSharedValue(0);

    useEffect(() => {
      if (isSelected) {
        scale.value = withSpring(0.98, { damping: 15, stiffness: 300 });
        bgOpacity.value = withTiming(1, { duration: 150 });
      } else {
        scale.value = withSpring(1, { damping: 15, stiffness: 300 });
        bgOpacity.value = withTiming(0, { duration: 150 });
      }
    }, [isSelected]);

    const animatedContainerStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const animatedBgStyle = useAnimatedStyle(() => ({
      opacity: bgOpacity.value,
    }));

    const handlePress = () => {
      if (selectedConversation) {
        setSelectedConversation(null);
      } else {
        markConversationAsRead(chat.id);
        router.push(`/chat-detail?id=${chat.id}`);
      }
    };

    const handleLongPress = async () => {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (e) {
        // Haptics might not be available
      }
      setSelectedConversation(chat);
    };

    return (
      <Animated.View style={animatedContainerStyle}>
        <Pressable
          onPress={handlePress}
          onLongPress={handleLongPress}
          delayLongPress={300}
          style={styles.chatItem}
        >
          {/* Background de sélection animé */}
          <Animated.View style={[styles.chatItemSelectedBg, animatedBgStyle]} />

          {/* Indicateur non-lu (point orange) */}
          {hasUnread && !isSelected && (
            <View style={styles.unreadDot} />
          )}

          {/* Avatar */}
          <Image
            source={{ uri: chat.image || 'https://via.placeholder.com/48' }}
            style={styles.chatAvatar}
          />

          {/* Infos conversation */}
          <View style={styles.chatInfo}>
            <View style={styles.chatHeader}>
              <Text
                style={[
                  styles.chatName,
                  hasUnread && styles.chatNameUnread
                ]}
                numberOfLines={1}
              >
                {chat.name}
              </Text>
              <Text style={[styles.chatTime, hasUnread && styles.chatTimeUnread]}>
                {chat.lastMessageTime}
              </Text>
            </View>

            <View style={styles.chatSubline}>
              <Text
                style={[
                  styles.lastMessage,
                  hasUnread && styles.lastMessageUnread
                ]}
                numberOfLines={1}
              >
                {chat.lastMessage || 'Commencez une conversation...'}
              </Text>

              {/* Icône de sourdine discrète */}
              {chat.isMuted && !isSelected && (
                <IconSymbol name="bell.slash.fill" size={14} color={colors.textMuted} style={styles.muteIcon} />
              )}
            </View>

            {/* Contexte léger (activité liée) */}
            {chat.isActivityGroup && chat.activity_name && (
              <View style={styles.contextRow}>
                <IconSymbol name="calendar" size={12} color={colors.textTertiary} />
                <Text style={styles.contextText} numberOfLines={1}>
                  {chat.activity_name}
                </Text>
              </View>
            )}
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  const renderChatItem = (chat: Conversation) => {
    return <ChatItem key={chat.id} chat={chat} />;
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
          <View style={styles.friendOnlineIndicator} />
        )}
      </View>
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>{item.name}</Text>
        <Text style={styles.friendStatus}>
          {item.is_online ? 'En ligne' : 'Hors ligne'}
        </Text>
      </View>
      <IconSymbol name="chevron.right" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );

  // Empty state component
  const EmptyState = () => {
    const getEmptyContent = () => {
      switch (activeFilter) {
        case 'activities':
          return {
            icon: 'calendar' as const,
            title: 'Aucun groupe d\'activité',
            subtitle: 'Rejoignez une activité pour discuter avec les autres participants.',
            cta: 'Explorer les activités',
            onPress: () => router.push('/(tabs)/browse'),
          };
        case 'friends':
          return {
            icon: 'person.2' as const,
            title: 'Aucune conversation',
            subtitle: 'Commencez à échanger avec vos amis dès maintenant.',
            cta: 'Nouvelle conversation',
            onPress: () => setShowFriendsModal(true),
          };
        default:
          return {
            icon: 'bubble.left.and.bubble.right' as const,
            title: 'Pas encore de messages',
            subtitle: 'Vos conversations apparaîtront ici. Rejoignez une activité ou contactez un ami pour commencer.',
            cta: 'Explorer les activités',
            onPress: () => router.push('/(tabs)/browse'),
          };
      }
    };

    const content = getEmptyContent();

    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconContainer}>
          <IconSymbol name={content.icon} size={48} color={colors.textMuted} />
        </View>
        <Text style={styles.emptyTitle}>{content.title}</Text>
        <Text style={styles.emptySubtitle}>{content.subtitle}</Text>
        <TouchableOpacity
          style={styles.emptyCta}
          onPress={content.onPress}
          activeOpacity={0.8}
        >
          <Text style={styles.emptyCtaText}>{content.cta}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Barre d'actions contextuelle */}
      {selectedConversation && (
        <View style={styles.actionBarContainer}>
          <SafeAreaView edges={['top']} style={styles.actionBarSafeArea}>
            <View style={styles.actionBar}>
              <TouchableOpacity
                style={styles.actionBarButton}
                onPress={handleCloseActionBar}
              >
                <IconSymbol name="xmark" size={20} color={colors.text} />
              </TouchableOpacity>

              <Text style={styles.actionBarTitle}>1 sélectionné</Text>

              <View style={styles.actionBarActions}>
                <TouchableOpacity
                  style={styles.actionBarButton}
                  onPress={handleMuteConversation}
                >
                  <IconSymbol
                    name={selectedConversation?.isMuted ? "bell.fill" : "bell.slash.fill"}
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBarButton}
                  onPress={handleArchiveConversation}
                >
                  <IconSymbol name="archivebox" size={20} color={colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBarButton}
                  onPress={() => handleDeleteConversation(selectedConversation.id)}
                >
                  <IconSymbol name="trash" size={20} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </View>
      )}

      {/* Header - fond clair */}
      {!selectedConversation && (
        <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
          <View style={styles.header}>
            <View style={styles.headerTop}>
              {/* Icône gauche */}
              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={() => router.push('/add-friends?returnTab=chat')}
              >
                <IconSymbol name="person.badge.plus" size={22} color={colors.textSecondary} />
              </TouchableOpacity>

              {/* Nom utilisateur central */}
              <Text style={styles.headerUsername}>
                {profile?.full_name || profile?.username || 'Messages'}
              </Text>

              {/* Icônes droites */}
              <View style={styles.headerRightButtons}>
                <TouchableOpacity
                  style={styles.headerIconButton}
                  onPress={() => router.push('/friend-requests?returnTab=chat')}
                >
                  <IconSymbol name="envelope" size={22} color={colors.textSecondary} />
                  {pendingRequestsCount > 0 && (
                    <View style={styles.headerBadge}>
                      <Text style={styles.headerBadgeText}>
                        {pendingRequestsCount > 9 ? '9+' : pendingRequestsCount}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.headerIconButton}
                  onPress={() => setShowFriendsModal(true)}
                >
                  <IconSymbol name="square.and.pencil" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </SafeAreaView>
      )}

      {/* Barre de recherche compacte */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <IconSymbol name="magnifyingglass" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher..."
            placeholderTextColor={colors.textMuted}
            value={headerSearchQuery}
            onChangeText={setHeaderSearchQuery}
          />
          {headerSearchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setHeaderSearchQuery('')}>
              <IconSymbol name="xmark.circle.fill" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Segmented control sobre */}
      <View style={styles.segmentedControl}>
        <View style={styles.segmentedControlInner}>
          <TouchableOpacity
            onPress={() => setActiveFilter('all')}
            activeOpacity={0.7}
            style={[
              styles.segmentedTab,
              activeFilter === 'all' && styles.segmentedTabActive,
            ]}
          >
            <Text style={[
              styles.segmentedTabText,
              activeFilter === 'all' && styles.segmentedTabTextActive,
            ]}>
              Tous
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveFilter('activities')}
            activeOpacity={0.7}
            style={[
              styles.segmentedTab,
              activeFilter === 'activities' && styles.segmentedTabActive,
            ]}
          >
            <Text style={[
              styles.segmentedTabText,
              activeFilter === 'activities' && styles.segmentedTabTextActive,
            ]}>
              Activités
            </Text>
            {activitiesCount > 0 && (
              <View style={[
                styles.segmentedBadge,
                activeFilter === 'activities' && styles.segmentedBadgeActive,
              ]}>
                <Text style={[
                  styles.segmentedBadgeText,
                  activeFilter === 'activities' && styles.segmentedBadgeTextActive,
                ]}>
                  {activitiesCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveFilter('friends')}
            activeOpacity={0.7}
            style={[
              styles.segmentedTab,
              activeFilter === 'friends' && styles.segmentedTabActive,
            ]}
          >
            <Text style={[
              styles.segmentedTabText,
              activeFilter === 'friends' && styles.segmentedTabTextActive,
            ]}>
              Amis
            </Text>
            {privateCount > 0 && (
              <View style={[
                styles.segmentedBadge,
                activeFilter === 'friends' && styles.segmentedBadgeActive,
              ]}>
                <Text style={[
                  styles.segmentedBadgeText,
                  activeFilter === 'friends' && styles.segmentedBadgeTextActive,
                ]}>
                  {privateCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

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
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : getFilteredConversations().length > 0 ? (
          <View style={styles.conversationsList}>
            {getFilteredConversations().map(renderChatItem)}
          </View>
        ) : (
          <EmptyState />
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
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowFriendsModal(false)}
            >
              <IconSymbol name="xmark" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Nouvelle conversation</Text>
            <View style={styles.modalCloseButton} />
          </View>

          {/* Modal Search */}
          <View style={styles.modalSearchContainer}>
            <View style={styles.modalSearchBar}>
              <IconSymbol name="magnifyingglass" size={16} color={colors.textMuted} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Rechercher un ami..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>

          {friendsLoading ? (
            <View style={styles.modalLoadingState}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : friends.length === 0 ? (
            <View style={styles.modalEmptyState}>
              <View style={styles.modalEmptyIconContainer}>
                <IconSymbol name="person.2" size={48} color={colors.textMuted} />
              </View>
              <Text style={styles.modalEmptyTitle}>Aucun ami</Text>
              <Text style={styles.modalEmptySubtitle}>
                Ajoutez des amis pour pouvoir leur envoyer des messages.
              </Text>
              <TouchableOpacity
                style={styles.modalEmptyCta}
                onPress={() => {
                  setShowFriendsModal(false);
                  router.push('/add-friends');
                }}
              >
                <Text style={styles.modalEmptyCtaText}>Ajouter des amis</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={friends.filter(c =>
                c.name.toLowerCase().includes(searchQuery.toLowerCase())
              )}
              renderItem={renderFriendItem}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.friendsList}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={styles.friendSeparator} />}
              ListEmptyComponent={
                <View style={styles.modalEmptyState}>
                  <IconSymbol name="magnifyingglass" size={40} color={colors.textMuted} />
                  <Text style={styles.modalEmptyTitle}>Aucun résultat</Text>
                  <Text style={styles.modalEmptySubtitle}>
                    Aucun ami ne correspond à votre recherche.
                  </Text>
                </View>
              }
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundAlt,
  },

  // Action Bar (sélection)
  actionBarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: colors.backgroundAlt,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  actionBarSafeArea: {
    width: '100%',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  actionBarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBarTitle: {
    flex: 1,
    fontSize: typography.base,
    fontFamily: 'Manrope-SemiBold',
    fontWeight: typography.semibold,
    color: colors.text,
    marginLeft: spacing.sm,
  },
  actionBarActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },

  // Header
  headerSafeArea: {
    backgroundColor: colors.backgroundAlt,
  },
  header: {
    backgroundColor: colors.backgroundAlt,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerIconButton: {
    position: 'relative',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerUsername: {
    flex: 1,
    fontSize: typography.xl,
    fontFamily: 'Manrope-Bold',
    fontWeight: typography.bold,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  headerRightButtons: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  headerBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  headerBadgeText: {
    fontSize: 10,
    fontFamily: 'Manrope-Bold',
    fontWeight: typography.bold,
    color: colors.textOnPrimary,
  },

  // Search Bar
  searchContainer: {
    backgroundColor: colors.backgroundAlt,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sm,
    fontFamily: 'Manrope-Regular',
    color: colors.text,
    paddingVertical: 0,
  },

  // Segmented Control
  segmentedControl: {
    backgroundColor: colors.backgroundAlt,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  segmentedControlInner: {
    flexDirection: 'row',
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.sm,
    padding: 3,
  },
  segmentedTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm - 2,
    gap: spacing.xs,
  },
  segmentedTabActive: {
    backgroundColor: colors.backgroundAlt,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentedTabText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope-Medium',
    fontWeight: typography.medium,
    color: colors.textTertiary,
  },
  segmentedTabTextActive: {
    color: colors.text,
    fontFamily: 'Manrope-SemiBold',
    fontWeight: typography.semibold,
  },
  segmentedBadge: {
    backgroundColor: colors.borderLight,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  segmentedBadgeActive: {
    backgroundColor: colors.primaryLight,
  },
  segmentedBadgeText: {
    fontSize: 11,
    fontFamily: 'Manrope-SemiBold',
    fontWeight: typography.semibold,
    color: colors.textTertiary,
  },
  segmentedBadgeTextActive: {
    color: colors.primary,
  },

  // Conversations List
  scrollView: {
    flex: 1,
    backgroundColor: colors.backgroundAlt,
  },
  contentContainer: {
    paddingBottom: spacing.xl,
  },
  contentContainerWithTabBar: {
    paddingBottom: 100,
  },
  conversationsList: {
    backgroundColor: colors.backgroundAlt,
  },

  // Chat Item
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.backgroundAlt,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
    position: 'relative',
  },
  chatItemSelectedBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.primaryLight,
  },
  unreadDot: {
    position: 'absolute',
    left: spacing.sm,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  chatAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.borderLight,
    marginRight: spacing.md,
  },
  chatInfo: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  chatName: {
    flex: 1,
    fontSize: typography.base,
    fontFamily: 'Manrope-Medium',
    fontWeight: typography.medium,
    color: colors.text,
    marginRight: spacing.sm,
  },
  chatNameUnread: {
    fontFamily: 'Manrope-SemiBold',
    fontWeight: typography.semibold,
  },
  chatTime: {
    fontSize: typography.xs,
    fontFamily: 'Manrope-Regular',
    color: colors.textTertiary,
  },
  chatTimeUnread: {
    color: colors.primary,
    fontFamily: 'Manrope-Medium',
    fontWeight: typography.medium,
  },
  chatSubline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastMessage: {
    flex: 1,
    fontSize: typography.sm,
    fontFamily: 'Manrope-Regular',
    color: colors.textTertiary,
    lineHeight: 20,
  },
  lastMessageUnread: {
    color: colors.textSecondary,
    fontFamily: 'Manrope-Medium',
    fontWeight: typography.medium,
  },
  muteIcon: {
    marginLeft: spacing.xs,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  contextText: {
    fontSize: 11,
    fontFamily: 'Manrope-Regular',
    color: colors.textTertiary,
  },

  // Loading State
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: spacing.xxxl,
  },
  emptyIconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.lg,
    fontFamily: 'Manrope-SemiBold',
    fontWeight: typography.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: typography.sm,
    fontFamily: 'Manrope-Regular',
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  emptyCta: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  emptyCtaText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope-SemiBold',
    fontWeight: typography.semibold,
    color: colors.textOnPrimary,
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: colors.backgroundAlt,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: typography.lg,
    fontFamily: 'Manrope-SemiBold',
    fontWeight: typography.semibold,
    color: colors.text,
  },
  modalSearchContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  modalSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: typography.sm,
    fontFamily: 'Manrope-Regular',
    color: colors.text,
    paddingVertical: 0,
  },
  modalLoadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalEmptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxxl,
  },
  modalEmptyIconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  modalEmptyTitle: {
    fontSize: typography.lg,
    fontFamily: 'Manrope-SemiBold',
    fontWeight: typography.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  modalEmptySubtitle: {
    fontSize: typography.sm,
    fontFamily: 'Manrope-Regular',
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  modalEmptyCta: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  modalEmptyCtaText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope-SemiBold',
    fontWeight: typography.semibold,
    color: colors.textOnPrimary,
  },
  friendsList: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  friendSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderLight,
  },
  friendAvatarContainer: {
    position: 'relative',
  },
  friendAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.borderLight,
  },
  friendOnlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.backgroundAlt,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: typography.base,
    fontFamily: 'Manrope-Medium',
    fontWeight: typography.medium,
    color: colors.text,
  },
  friendStatus: {
    fontSize: typography.xs,
    fontFamily: 'Manrope-Regular',
    color: colors.textTertiary,
    marginTop: 2,
  },
});
