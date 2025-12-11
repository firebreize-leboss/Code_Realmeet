// app/friend-requests.tsx
// Page des demandes d'amis avec protection entreprise

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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';
import { useBusinessRestrictions } from '@/hooks/useBusinessRestrictions';

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
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <IconSymbol name="chevron.left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Demandes d'amis</Text>
          <View style={styles.placeholder} />
        </View>
        
        <View style={styles.restrictedContainer}>
          <IconSymbol name="building.2.fill" size={64} color={colors.textSecondary} />
          <Text style={styles.restrictedTitle}>Fonctionnalité non disponible</Text>
          <Text style={styles.restrictedText}>
            Les comptes entreprise ne peuvent pas recevoir de demandes d'amis.
            Les utilisateurs peuvent découvrir votre entreprise via vos activités.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderRequestItem = ({ item }: { item: FriendRequest }) => {
    const isProcessing = processing === item.id;
    
    return (
      <View style={styles.requestItem}>
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
                <IconSymbol name="location.fill" size={14} color={colors.textSecondary} />
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
              <ActivityIndicator size="small" color={colors.text} />
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
              <ActivityIndicator size="small" color={colors.background} />
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Demandes d'amis</Text>
        <View style={styles.placeholder} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : requests.length === 0 ? (
        <View style={styles.emptyState}>
          <IconSymbol name="person.crop.circle.badge.checkmark" size={64} color={colors.textSecondary} />
          <Text style={styles.emptyText}>Aucune demande</Text>
          <Text style={styles.emptySubtext}>
            Vous n'avez pas de demandes d'amis en attente
          </Text>
          <TouchableOpacity 
            style={styles.addFriendsButton}
            onPress={() => router.push('/add-friends')}
          >
            <IconSymbol name="person.badge.plus" size={20} color={colors.background} />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  placeholder: {
    width: 40,
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
  },
  emptySubtext: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  addFriendsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  addFriendsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  requestItem: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    gap: 14,
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.border,
  },
  userDetails: {
    flex: 1,
    justifyContent: 'center',
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
    fontSize: 13,
    color: colors.textSecondary,
  },
  requestDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.background,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  // Styles pour l'écran restreint
  restrictedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  restrictedTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: 20,
    textAlign: 'center',
  },
  restrictedText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
  },
});