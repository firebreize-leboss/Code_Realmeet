// app/friend-requests.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';

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
  const [requests, setRequests] = useState<FriendRequest[]>([
    {
      id: '1',
      sender_id: '101',
      sender_name: 'Thomas Leclerc',
      sender_avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
      sender_city: 'Paris',
      created_at: '2024-01-15T10:30:00',
    },
    {
      id: '2',
      sender_id: '102',
      sender_name: 'Julie Moreau',
      sender_avatar: 'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=400',
      sender_city: 'Lyon',
      created_at: '2024-01-14T15:20:00',
    },
    {
      id: '3',
      sender_id: '103',
      sender_name: 'Alexandre Roux',
      sender_avatar: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400',
      sender_city: 'Marseille',
      created_at: '2024-01-13T09:15:00',
    },
  ]);
  const [processing, setProcessing] = useState<string | null>(null);

  const handleAcceptRequest = async (requestId: string) => {
    setProcessing(requestId);
    try {
      // TODO: Implémenter l'acceptation avec Supabase
      // await supabase.rpc('accept_friend_request', { p_request_id: requestId });

      // Simuler un délai
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Retirer la demande de la liste
      setRequests(prev => prev.filter(req => req.id !== requestId));
    } catch (error) {
      console.error('Error accepting friend request:', error);
    } finally {
      setProcessing(null);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    setProcessing(requestId);
    try {
      // TODO: Implémenter le rejet avec Supabase
      // await supabase
      //   .from('friend_requests')
      //   .update({ status: 'rejected' })
      //   .eq('id', requestId);

      // Simuler un délai
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Retirer la demande de la liste
      setRequests(prev => prev.filter(req => req.id !== requestId));
    } catch (error) {
      console.error('Error rejecting friend request:', error);
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

  const renderRequestItem = ({ item }: { item: FriendRequest }) => {
    const isProcessing = processing === item.id;

    return (
      <View style={styles.requestItem}>
        <TouchableOpacity
          onPress={() => router.push(`/user-profile?id=${item.sender_id}`)}
          style={styles.userInfo}
        >
          <Image
            source={{ uri: item.sender_avatar }}
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
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Demandes d'amitié</Text>
        <View style={styles.placeholder} />
      </View>

      {requests.length === 0 ? (
        <View style={styles.emptyState}>
          <IconSymbol name="envelope.fill" size={64} color={colors.textSecondary} />
          <Text style={styles.emptyText}>Aucune demande</Text>
          <Text style={styles.emptySubtext}>
            Les demandes d'amitié que vous recevez apparaîtront ici
          </Text>
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
    paddingVertical: 16,
  },
  requestItem: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 16,
  },
  userInfo: {
    flexDirection: 'row',
    gap: 12,
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
    fontSize: 14,
    color: colors.textSecondary,
  },
  requestDate: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
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
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  acceptButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.background,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});