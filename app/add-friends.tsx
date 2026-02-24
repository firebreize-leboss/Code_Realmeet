// app/add-friends.tsx
// Page de recherche et ajout d'amis avec contacts des activités passées
// Design premium: fond neutre, orange accent, typographie Manrope

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  FlatList,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase } from '@/lib/supabase';
import { colors, typography, spacing, borderRadius } from '@/styles/commonStyles';

interface UserSearchResult {
  id: string;
  full_name: string;
  avatar_url?: string;
  city?: string;
  is_friend: boolean;
  request_sent: boolean;
  from_activity?: boolean;
  activity_name?: string;
}

export default function AddFriendsScreen() {
  const router = useRouter();
  const { returnTab } = useLocalSearchParams<{ returnTab?: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [activityContacts, setActivityContacts] = useState<UserSearchResult[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);

  useEffect(() => {
    loadActivityContacts();
  }, []);

  const loadActivityContacts = async () => {
    try {
      setLoadingContacts(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        setLoadingContacts(false);
        return;
      }

      const currentUserId = userData.user.id;

      const { data: myParticipations } = await supabase
        .from('slot_participants')
        .select('slot_id, activity_id')
        .eq('user_id', currentUserId)
        .in('status', ['active', 'completed']);

      if (!myParticipations || myParticipations.length === 0) {
        setActivityContacts([]);
        setLoadingContacts(false);
        return;
      }

      const slotIds = myParticipations.map(p => p.slot_id);
      const activityIds = [...new Set(myParticipations.map(p => p.activity_id))];

      const { data: activitiesData } = await supabase
        .from('activities')
        .select('id, nom')
        .in('id', activityIds);

      const activityNames = new Map(activitiesData?.map(a => [a.id, a.nom]) || []);

      const { data: otherParticipants } = await supabase
        .from('slot_participants')
        .select(`
          user_id,
          activity_id,
          profiles:user_id (
            id,
            full_name,
            avatar_url,
            city
          )
        `)
        .in('slot_id', slotIds)
        .neq('user_id', currentUserId)
        .in('status', ['active', 'completed']);

      if (!otherParticipants) {
        setActivityContacts([]);
        setLoadingContacts(false);
        return;
      }

      const { data: friendships } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', currentUserId);

      const { data: requests } = await supabase
        .from('friend_requests')
        .select('receiver_id')
        .eq('sender_id', currentUserId)
        .eq('status', 'pending');

      const friendIds = new Set(friendships?.map(f => f.friend_id) || []);
      const pendingIds = new Set(requests?.map(r => r.receiver_id) || []);

      const uniqueContacts = new Map<string, UserSearchResult>();
      otherParticipants.forEach((p: any) => {
        if (p.profiles && !uniqueContacts.has(p.user_id)) {
          uniqueContacts.set(p.user_id, {
            id: p.user_id,
            full_name: p.profiles.full_name || 'Utilisateur',
            avatar_url: p.profiles.avatar_url || undefined,
            city: p.profiles.city || undefined,
            is_friend: friendIds.has(p.user_id),
            request_sent: pendingIds.has(p.user_id),
            from_activity: true,
            activity_name: activityNames.get(p.activity_id) || 'Activité',
          });
        }
      });

      setActivityContacts(Array.from(uniqueContacts.values()));
    } catch (error) {
      console.error('Erreur chargement contacts activités:', error);
    } finally {
      setLoadingContacts(false);
    }
  };

  const getFilteredActivityContacts = () => {
    if (searchQuery.trim().length === 0) {
      return activityContacts;
    }
    return activityContacts.filter(contact =>
      contact.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const handleSendFriendRequest = async (userId: string) => {
    setSendingRequest(userId);
    try {
      const { data: currentUserData } = await supabase.auth.getUser();
      const currentUser = currentUserData?.user;
      if (!currentUser) throw new Error("Utilisateur non connecté");

      const { error } = await supabase.from('friend_requests').insert({
        sender_id: currentUser.id,
        receiver_id: userId,
        status: 'pending',
      });

      if (error && !error.message.toLowerCase().includes('duplicate')) {
        throw error;
      }

      setActivityContacts(prev =>
        prev.map(user =>
          user.id === userId ? { ...user, request_sent: true } : user
        )
      );
    } catch (error) {
      console.error('Error sending friend request:', error);
    } finally {
      setSendingRequest(null);
    }
  };

  const handleViewProfile = (userId: string) => {
    router.push(`/user-profile?id=${userId}`);
  };

  const renderUserItem = ({ item }: { item: UserSearchResult }) => (
    <TouchableOpacity
      style={styles.userCard}
      onPress={() => handleViewProfile(item.id)}
      activeOpacity={0.7}
    >
      <Image
        source={{ uri: item.avatar_url || 'https://via.placeholder.com/52' }}
        style={styles.userAvatar}
      />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.full_name}</Text>
        {item.from_activity && item.activity_name && (
          <View style={styles.activityBadge}>
            <IconSymbol name="figure.run" size={11} color={colors.primary} />
            <Text style={styles.activityBadgeText}>{item.activity_name}</Text>
          </View>
        )}
        {item.city && !item.from_activity && (
          <View style={styles.locationRow}>
            <IconSymbol name="location.fill" size={12} color={colors.textTertiary} />
            <Text style={styles.userCity}>{item.city}</Text>
          </View>
        )}
      </View>
      {item.is_friend ? (
        <View style={styles.friendBadge}>
          <IconSymbol name="checkmark" size={14} color={colors.success} />
          <Text style={styles.friendBadgeText}>Ami</Text>
        </View>
      ) : item.request_sent ? (
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingBadgeText}>Envoyé</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => handleSendFriendRequest(item.id)}
          disabled={sendingRequest === item.id}
        >
          {sendingRequest === item.id ? (
            <ActivityIndicator size="small" color={colors.textOnPrimary} />
          ) : (
            <>
              <IconSymbol name="plus" size={14} color={colors.textOnPrimary} />
              <Text style={styles.addButtonText}>Ajouter</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  const filteredActivityContacts = getFilteredActivityContacts();
  const hasActivityResults = filteredActivityContacts.length > 0;
  const isSearching = searchQuery.trim().length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => {
          if (returnTab) {
            router.navigate(`/(tabs)/${returnTab}` as any);
          } else {
            router.back();
          }
        }}>
          <IconSymbol name="chevron.left" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ajouter des contacts</Text>
        <View style={styles.headerButton} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <IconSymbol name="magnifyingglass" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher par pseudo"
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <IconSymbol name="xmark.circle.fill" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loadingContacts ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredActivityContacts}
          renderItem={renderUserItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            hasActivityResults ? (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {isSearching ? 'Résultats' : 'Personnes rencontrées'}
                </Text>
                <Text style={styles.sectionSubtitle}>
                  {filteredActivityContacts.length} contact{filteredActivityContacts.length > 1 ? 's' : ''}
                </Text>
              </View>
            ) : null
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <IconSymbol
                  name={isSearching ? "magnifyingglass" : "person.2"}
                  size={40}
                  color={colors.textMuted}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {isSearching ? 'Aucun résultat' : 'Aucun contact pour l\'instant'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {isSearching
                  ? 'Aucun contact ne correspond à cette recherche.'
                  : 'Participez à des activités pour rencontrer des personnes et les ajouter en amis.'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundAlt,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.backgroundAlt,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.lg,
    fontFamily: 'Manrope-SemiBold',
    fontWeight: typography.semibold,
    color: colors.text,
  },

  // Search
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.backgroundAlt,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sm,
    fontFamily: 'Manrope-Regular',
    color: colors.text,
    paddingVertical: 0,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Liste
  listContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 40 : 60,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.base,
    fontFamily: 'Manrope-SemiBold',
    fontWeight: typography.semibold,
    color: colors.text,
  },
  sectionSubtitle: {
    fontSize: typography.xs,
    fontFamily: 'Manrope-Regular',
    color: colors.textTertiary,
  },

  // User card
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  userAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.borderLight,
  },
  userInfo: {
    flex: 1,
    gap: 4,
  },
  userName: {
    fontSize: typography.base,
    fontFamily: 'Manrope-Medium',
    fontWeight: typography.medium,
    color: colors.text,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userCity: {
    fontSize: typography.xs,
    fontFamily: 'Manrope-Regular',
    color: colors.textTertiary,
  },
  activityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm - 2,
    alignSelf: 'flex-start',
  },
  activityBadgeText: {
    fontSize: 11,
    fontFamily: 'Manrope-Medium',
    fontWeight: typography.medium,
    color: colors.primary,
  },

  // Separator
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderLight,
  },

  // Badges
  friendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.successLight,
  },
  friendBadgeText: {
    fontSize: typography.xs,
    fontFamily: 'Manrope-Medium',
    fontWeight: typography.medium,
    color: colors.success,
  },
  pendingBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  pendingBadgeText: {
    fontSize: typography.xs,
    fontFamily: 'Manrope-Medium',
    fontWeight: typography.medium,
    color: colors.textTertiary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  addButtonText: {
    fontSize: typography.xs,
    fontFamily: 'Manrope-SemiBold',
    fontWeight: typography.semibold,
    color: colors.textOnPrimary,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: spacing.xxxl,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
  },
});
