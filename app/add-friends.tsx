// app/add-friends.tsx
// Page de recherche et ajout d'amis avec autocomplétion

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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';

interface UserSearchResult {
  id: string;
  full_name: string;
  avatar_url?: string;
  city?: string;
  is_friend: boolean;
  request_sent: boolean;
}

export default function AddFriendsScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);

  // Simuler la recherche d'utilisateurs avec debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        searchUsers();
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const searchUsers = async () => {
    setLoading(true);
    try {
      // TODO: Implémenter la vraie recherche avec Supabase
      // const { data, error } = await supabase
      //   .from('profiles')
      //   .select('id, full_name, avatar_url, city')
      //   .ilike('full_name', `%${searchQuery}%`)
      //   .limit(10);

      // Données de test
      const mockResults: UserSearchResult[] = [
        {
          id: '1',
          full_name: 'Marie Dubois',
          avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
          city: 'Paris',
          is_friend: false,
          request_sent: false,
        },
        {
          id: '2',
          full_name: 'Pierre Martin',
          avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
          city: 'Lyon',
          is_friend: false,
          request_sent: false,
        },
        {
          id: '3',
          full_name: 'Sophie Bernard',
          avatar_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
          city: 'Marseille',
          is_friend: true,
          request_sent: false,
        },
      ];

      setSearchResults(
        mockResults.filter(user =>
          user.full_name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendFriendRequest = async (userId: string) => {
    setSendingRequest(userId);
    try {
      // TODO: Implémenter l'envoi de demande d'amitié avec Supabase
      // const { error } = await supabase
      //   .from('friend_requests')
      //   .insert({
      //     sender_id: currentUser.id,
      //     receiver_id: userId,
      //     status: 'pending'
      //   });

      // Simuler un délai
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mettre à jour l'état local
      setSearchResults(prev =>
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
        source={{ uri: item.avatar_url }}
        style={styles.userAvatar}
      />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.full_name}</Text>
        {item.city && (
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
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
          autoFocus
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <IconSymbol name="xmark" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : searchQuery.length < 2 ? (
        <View style={styles.emptyState}>
          <IconSymbol name="person.2.fill" size={64} color={colors.textSecondary} />
          <Text style={styles.emptyText}>Rechercher des personnes</Text>
          <Text style={styles.emptySubtext}>
            Tapez au moins 2 caractères pour commencer la recherche
          </Text>
        </View>
      ) : searchResults.length === 0 ? (
        <View style={styles.emptyState}>
          <IconSymbol name="magnifyingglass" size={64} color={colors.textSecondary} />
          <Text style={styles.emptyText}>Aucun résultat</Text>
          <Text style={styles.emptySubtext}>
            Essayez avec un autre pseudo
          </Text>
        </View>
      ) : (
        <FlatList
          data={searchResults}
          renderItem={renderUserItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    minWidth: 100,
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.background,
  },
  friendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  friendBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  pendingBadge: {
    backgroundColor: colors.textSecondary + '20',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pendingBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});