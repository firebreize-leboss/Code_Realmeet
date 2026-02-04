// app/friend-requests.tsx
// Page des demandes d'amis avec protection entreprise
// Design premium: fond neutre, orange accent, typographie Manrope

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase } from '@/lib/supabase';
import { useBusinessRestrictions } from '@/hooks/useBusinessRestrictions';
import { useDataCache } from '@/contexts/DataCacheContext';
import { colors, typography, spacing, borderRadius } from '@/styles/commonStyles';

interface FriendRequest {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  sender_city?: string;
  created_at: string;
}

export default function FriendRequestsScreen() {
  const router = useRouter();
  const { returnTab } = useLocalSearchParams<{ returnTab?: string }>();
  const { isBusiness } = useBusinessRestrictions();
  const { refreshFriends } = useDataCache();

  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  // Rediriger si entreprise
  useEffect(() => {
    if (isBusiness) {
      Alert.alert(
        'Fonctionnalité non disponible',
        'Les comptes entreprise ne peuvent pas recevoir de demandes d\'amis.',
        [{ text: 'Compris', onPress: () => router.back() }]
      );
    }
  }, [isBusiness]);

  useEffect(() => {
    if (!isBusiness) {
      loadRequests();
    }
  }, [isBusiness]);

  const loadRequests = async () => {
    try {
      const { data: currentUserData } = await supabase.auth.getUser();
      const currentUser = currentUserData?.user;
      if (!currentUser) throw new Error('Utilisateur non connecté');

      const { data, error } = await supabase
        .from('friend_requests_with_profiles')
        .select('*')
        .eq('receiver_id', currentUser.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error('Error loading friend requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    setProcessing(requestId);
    try {
      const { error } = await supabase.rpc('accept_friend_request', {
        p_request_id: requestId
      });

      if (error) throw error;

      // Débloquer la conversation associée si elle existe
      await supabase
        .from('conversations')
        .update({ friend_request_id: null })
        .eq('friend_request_id', requestId);

      setRequests(prev => prev.filter(req => req.id !== requestId));
      await refreshFriends();
      Alert.alert('Succès', 'Demande acceptée ! Vous êtes maintenant amis.');
    } catch (error) {
      console.error('Error accepting friend request:', error);
      Alert.alert('Erreur', 'Impossible d\'accepter la demande');
    } finally {
      setProcessing(null);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    setProcessing(requestId);
    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);

      if (error) throw error;

      setRequests(prev => prev.filter(req => req.id !== requestId));
    } catch (error) {
      console.error('Error rejecting friend request:', error);
      Alert.alert('Erreur', 'Impossible de refuser la demande');
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return "Aujourd'hui";
    if (diffDays === 2) return 'Hier';
    if (diffDays <= 7) return `Il y a ${diffDays} jours`;
    return date.toLocaleDateString('fr-FR');
  };

  // Écran de blocage pour les entreprises
  if (isBusiness) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => {
            if (returnTab) {
              router.navigate(`/(tabs)/${returnTab}` as any);
            } else {
              router.back();
            }
          }} style={styles.headerButton}>
            <IconSymbol name="chevron.left" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Demandes d'amis</Text>
          <View style={styles.headerButton} />
        </View>

        <View style={styles.restrictedContainer}>
          <View style={styles.emptyIconContainer}>
            <IconSymbol name="building.2.fill" size={40} color={colors.textMuted} />
          </View>
          <Text style={styles.restrictedTitle}>Fonctionnalité non disponible</Text>
          <Text style={styles.restrictedText}>
            Les comptes entreprise ne peuvent pas recevoir de demandes d'amis.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderRequestItem = ({ item }: { item: FriendRequest }) => {
    const isProcessing = processing === item.id;

    return (
      <View style={styles.requestCard}>
        <TouchableOpacity
          onPress={() => router.push(`/user-profile?id=${item.sender_id}`)}
          style={styles.userInfo}
          activeOpacity={0.7}
        >
          <Image
            source={{ uri: item.sender_avatar || 'https://via.placeholder.com/52' }}
            style={styles.userAvatar}
          />
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{item.sender_name}</Text>
            {item.sender_city && (
              <View style={styles.locationRow}>
                <IconSymbol name="location.fill" size={12} color={colors.textTertiary} />
                <Text style={styles.userCity}>{item.sender_city}</Text>
              </View>
            )}
            <Text style={styles.requestDate}>{formatDate(item.created_at)}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.rejectButton, isProcessing && styles.buttonDisabled]}
            onPress={() => handleRejectRequest(item.id)}
            disabled={isProcessing}
            activeOpacity={0.7}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={colors.textSecondary} />
            ) : (
              <Text style={styles.rejectButtonText}>Refuser</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.acceptButton, isProcessing && styles.buttonDisabled]}
            onPress={() => handleAcceptRequest(item.id)}
            disabled={isProcessing}
            activeOpacity={0.8}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={colors.textOnPrimary} />
            ) : (
              <Text style={styles.acceptButtonText}>Accepter</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          if (returnTab) {
            router.navigate(`/(tabs)/${returnTab}` as any);
          } else {
            router.back();
          }
        }} style={styles.headerButton}>
          <IconSymbol name="chevron.left" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Demandes d'amis</Text>
        <View style={styles.headerButton} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : requests.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <IconSymbol name="person.2" size={40} color={colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>Aucune demande</Text>
          <Text style={styles.emptySubtitle}>
            Vous n'avez pas de demandes d'amis en attente.
          </Text>
          <TouchableOpacity
            style={styles.addFriendsButton}
            onPress={() => router.push('/add-friends')}
            activeOpacity={0.8}
          >
            <Text style={styles.addFriendsButtonText}>Ajouter des amis</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={requests}
          renderItem={renderRequestItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
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

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  addFriendsButton: {
    marginTop: spacing.xxl,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  addFriendsButtonText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope-SemiBold',
    fontWeight: typography.semibold,
    color: colors.textOnPrimary,
  },

  // Liste
  listContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 40 : 60,
  },

  // Separator
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderLight,
  },

  // Request card
  requestCard: {
    paddingVertical: spacing.md,
  },

  // User info
  userInfo: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  userAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.borderLight,
  },
  userDetails: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
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
  requestDate: {
    fontSize: typography.xs,
    fontFamily: 'Manrope-Regular',
    color: colors.textMuted,
  },

  // Action buttons
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButtonText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope-Medium',
    fontWeight: typography.medium,
    color: colors.textSecondary,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope-SemiBold',
    fontWeight: typography.semibold,
    color: colors.textOnPrimary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // Restricted
  restrictedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
  },
  restrictedTitle: {
    fontSize: typography.lg,
    fontFamily: 'Manrope-SemiBold',
    fontWeight: typography.semibold,
    color: colors.text,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
  restrictedText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope-Regular',
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
  },
});
