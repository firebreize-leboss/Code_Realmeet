// app/add-friends.tsx
// Page de recherche et ajout d'amis avec contacts des activités passées

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
  SectionList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';

interface UserSearchResult {
  id: string;
  full_name: string;
  avatar_url?: string;
  city?: string;
  is_friend: boolean;
  request_sent: boolean;
  from_activity?: boolean; // Indique si c'est un contact d'activité
  activity_name?: string; // Nom de la dernière activité partagée
}

export default function AddFriendsScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activityContacts, setActivityContacts] = useState<UserSearchResult[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);

  // Charger les contacts des activités passées au montage
  useEffect(() => {
    loadActivityContacts();
  }, []);

  // Charger les personnes avec qui on a fait des activités
  const loadActivityContacts = async () => {
    try {
      setLoadingContacts(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        setLoadingContacts(false);
        return;
      }

      const currentUserId = userData.user.id;

      // Récupérer les activités auxquelles l'utilisateur a participé
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

      // Récupérer les noms des activités
      const { data: activitiesData } = await supabase
        .from('activities')
        .select('id, nom')
        .in('id', activityIds);

      const activityNames = new Map(activitiesData?.map(a => [a.id, a.nom]) || []);

      // Récupérer les autres participants de ces mêmes créneaux
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

      // Récupérer les amis et demandes en attente
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

      // Dédupliquer par user_id et construire les contacts
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

  // Filtrer les contacts d'activités selon la recherche
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

      // Mettre à jour les deux listes
      setSearchResults(prev =>
        prev.map(user =>
          user.id === userId ? { ...user, request_sent: true } : user
        )
      );
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
      style={styles.userItem}
      onPress={() => handleViewProfile(item.id)}
      activeOpacity={0.7}
    >
      <Image 
        source={{ uri: item.avatar_url || 'https://via.placeholder.com/56' }} 
        style={styles.userAvatar} 
      />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.full_name}</Text>
        {item.from_activity && item.activity_name && (
          <View style={styles.activityBadge}>
            <IconSymbol name="figure.run" size={12} color={colors.primary} />
            <Text style={styles.activityBadgeText}>{item.activity_name}</Text>
          </View>
        )}
        {item.city && !item.from_activity && (
          <View style={styles.locationRow}>
            <IconSymbol name="location.fill" size={14} color={colors.textSecondary} />
            <Text style={styles.userCity}>{item.city}</Text>
          </View>
        )}
      </View>
      {item.is_friend ? (
        <View style={styles.friendBadge}>
          <IconSymbol name="checkmark" size={16} color={colors.primary} />
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
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <>
              <IconSymbol name="plus" size={16} color={colors.background} />
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
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ajouter des amis</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.searchContainer}>
        <IconSymbol name="magnifyingglass" size={20} color={colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher par pseudo..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoFocus={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <IconSymbol name="xmark" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {loadingContacts ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={[]} // On utilise ListHeaderComponent et ListFooterComponent
          renderItem={null}
          ListHeaderComponent={
            <>
              {/* Section: Contacts des activités passées */}
              {hasActivityResults && (
                <View style={styles.sectionContainer}>
                  <View style={styles.sectionHeader}>
                    <IconSymbol name="person.2.fill" size={18} color={colors.primary} />
                    <Text style={styles.sectionTitle}>
                      {isSearching ? 'Résultats dans vos activités' : 'Personnes rencontrées'}
                    </Text>
                  </View>
                  <Text style={styles.sectionSubtitle}>
                    Ajoutez les personnes avec qui vous avez partagé une activité
                  </Text>
                  {filteredActivityContacts.map(item => (
                    <View key={item.id}>
                      {renderUserItem({ item })}
                    </View>
                  ))}
                </View>
              )}

              {/* État vide: Aucun contact d'activité */}
              {!hasActivityResults && !isSearching && (
                <View style={styles.emptyState}>
                  <IconSymbol name="person.2.fill" size={64} color={colors.textSecondary} />
                  <Text style={styles.emptyText}>Aucun contact pour l'instant</Text>
                  <Text style={styles.emptySubtext}>
                    Participez à des activités pour rencontrer des personnes et les ajouter en amis
                  </Text>
                </View>
              )}

              {/* État vide: Recherche sans résultat dans les contacts */}
              {isSearching && !hasActivityResults && (
                <View style={styles.emptyState}>
                  <IconSymbol name="magnifyingglass" size={64} color={colors.textSecondary} />
                  <Text style={styles.emptyText}>Aucun résultat</Text>
                  <Text style={styles.emptySubtext}>
                    Aucun contact ne correspond à cette recherche
                  </Text>
                </View>
              )}
            </>
          }
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          keyExtractor={() => 'main'}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: 20,
    marginVertical: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
    marginLeft: 26,
  },

  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
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
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.border,
  },
  userInfo: {
    flex: 1,
    gap: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userCity: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  activityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  activityBadgeText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  friendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.primary + '20',
  },
  friendBadgeText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
  },
  pendingBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  pendingBadgeText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.background,
  },
}); 