// app/add-friends.tsx
// Page de recherche et ajout d'amis avec contacts des activités passées
// Design Glassmorphism comme profile.tsx

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
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

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
        .eq('user_id', currentUserId);

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
        .neq('user_id', currentUserId);

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
      style={styles.glassCard}
      onPress={() => handleViewProfile(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.userItemContent}>
        <Image
          source={{ uri: item.avatar_url || 'https://via.placeholder.com/56' }}
          style={styles.userAvatar}
        />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.full_name}</Text>
          {item.from_activity && item.activity_name && (
            <View style={styles.activityBadge}>
              <IconSymbol name="figure.run" size={12} color="#FFFFFF" />
              <Text style={styles.activityBadgeText}>{item.activity_name}</Text>
            </View>
          )}
          {item.city && !item.from_activity && (
            <View style={styles.locationRow}>
              <IconSymbol name="location.fill" size={14} color="rgba(255,255,255,0.8)" />
              <Text style={styles.userCity}>{item.city}</Text>
            </View>
          )}
        </View>
        {item.is_friend ? (
          <View style={styles.friendBadge}>
            <IconSymbol name="checkmark" size={16} color="#FFFFFF" />
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
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <IconSymbol name="plus" size={16} color="#FFFFFF" />
                <Text style={styles.addButtonText}>Ajouter</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  const filteredActivityContacts = getFilteredActivityContacts();
  const hasActivityResults = filteredActivityContacts.length > 0;
  const isSearching = searchQuery.trim().length > 0;

  return (
    <LinearGradient
      colors={['#60A5FA', '#818CF8', '#C084FC']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
            <IconSymbol name="chevron.left" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <IconSymbol name="magnifyingglass" size={20} color="rgba(255,255,255,0.7)" />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher par pseudo..."
              placeholderTextColor="rgba(255,255,255,0.6)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <IconSymbol name="xmark" size={18} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {loadingContacts ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingText}>Chargement...</Text>
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
                  <View style={styles.sectionTitleRow}>
                    <IconSymbol name="person.2.fill" size={18} color="#FFFFFF" />
                    <Text style={styles.sectionTitle}>
                      {isSearching ? 'Résultats dans vos activités' : 'Personnes rencontrées'}
                    </Text>
                  </View>
                  <Text style={styles.sectionSubtitle}>
                    Ajoutez les personnes avec qui vous avez partagé une activité
                  </Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View style={styles.glassCard}>
                  <IconSymbol
                    name={isSearching ? "magnifyingglass" : "person.2.fill"}
                    size={64}
                    color="rgba(255,255,255,0.9)"
                  />
                  <Text style={styles.emptyText}>
                    {isSearching ? 'Aucun résultat' : 'Aucun contact pour l\'instant'}
                  </Text>
                  <Text style={styles.emptySubtext}>
                    {isSearching
                      ? 'Aucun contact ne correspond à cette recherche'
                      : 'Participez à des activités pour rencontrer des personnes et les ajouter en amis'}
                  </Text>
                </View>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Search
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Liste
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 60,
    gap: 12,
  },

  // Section header
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginLeft: 26,
  },

  // Glass Card
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },

  // User item
  userItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  userInfo: {
    flex: 1,
    gap: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userCity: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  activityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  activityBadgeText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },

  // Badges
  friendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  friendBadgeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  pendingBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  pendingBadgeText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 22,
  },
});
