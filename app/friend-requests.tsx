// app/friend-requests.tsx
// Page des demandes d'amis avec protection entreprise
// Design Glassmorphism comme profile.tsx

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
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase } from '@/lib/supabase';
import { useBusinessRestrictions } from '@/hooks/useBusinessRestrictions';
import { LinearGradient } from 'expo-linear-gradient';

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
  const { isBusiness } = useBusinessRestrictions();

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
      <LinearGradient
        colors={['#60A5FA', '#818CF8', '#C084FC']}
        style={styles.container}
      >
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
              <IconSymbol name="chevron.left" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.restrictedContainer}>
            <View style={styles.glassCard}>
              <IconSymbol name="building.2.fill" size={64} color="rgba(255,255,255,0.9)" />
              <Text style={styles.restrictedTitle}>Fonctionnalité non disponible</Text>
              <Text style={styles.restrictedText}>
                Les comptes entreprise ne peuvent pas recevoir de demandes d'amis.
                Les utilisateurs peuvent découvrir votre entreprise via vos activités.
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const renderRequestItem = ({ item }: { item: FriendRequest }) => {
    const isProcessing = processing === item.id;

    return (
      <View style={styles.glassCard}>
        <TouchableOpacity
          onPress={() => router.push(`/user-profile?id=${item.sender_id}`)}
          style={styles.userInfo}
        >
          <Image
            source={{ uri: item.sender_avatar || 'https://via.placeholder.com/56' }}
            style={styles.userAvatar}
          />
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{item.sender_name}</Text>
            {item.sender_city && (
              <View style={styles.locationRow}>
                <IconSymbol name="location.fill" size={14} color="rgba(255,255,255,0.8)" />
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
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.rejectButtonText}>Refuser</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.acceptButton, isProcessing && styles.buttonDisabled]}
            onPress={() => handleAcceptRequest(item.id)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.acceptButtonText}>Accepter</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <LinearGradient
      colors={['#60A5FA', '#818CF8', '#C084FC']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <IconSymbol name="chevron.left" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingText}>Chargement...</Text>
          </View>
        ) : requests.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.glassCard}>
              <IconSymbol name="person.crop.circle.badge.checkmark" size={64} color="rgba(255,255,255,0.9)" />
              <Text style={styles.emptyText}>Aucune demande</Text>
              <Text style={styles.emptySubtext}>
                Vous n'avez pas de demandes d'amis en attente
              </Text>
              <TouchableOpacity
                style={styles.addFriendsButton}
                onPress={() => router.push('/add-friends')}
              >
                <IconSymbol name="person.badge.plus" size={20} color="#FFFFFF" />
                <Text style={styles.addFriendsButtonText}>Ajouter des amis</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <FlatList
            data={requests}
            renderItem={renderRequestItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
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

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  addFriendsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 18,
    marginTop: 24,
  },
  addFriendsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Liste
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 40 : 60,
    gap: 16,
  },

  // Glass Card
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },

  // User info
  userInfo: {
    flexDirection: 'row',
    gap: 14,
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  userDetails: {
    flex: 1,
    justifyContent: 'center',
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
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  requestDate: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },

  // Action buttons
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  acceptButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // Restricted
  restrictedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  restrictedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 20,
    textAlign: 'center',
  },
  restrictedText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
  },
});
