// app/friend-requests.tsx
import React, { useState, useEffect } from 'react';
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
import { messagingService } from '@/services/messaging.service';

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
  const [requests, setRequests] = useState<any[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    const result = await messagingService.getFriendRequests();
    if (result.success) {
      setRequests(result.data || []);
    }
    setLoading(false);
  };

  const handleAcceptRequest = async (requestId: string) => {
    setProcessing(requestId);
    const result = await messagingService.acceptFriendRequest(requestId);
    if (result.success) {
      setRequests(prev => prev.filter(req => req.id !== requestId));
    }
    setProcessing(null);
  };

  const handleRejectRequest = async (requestId: string) => {
    setProcessing(requestId);
    const result = await messagingService.rejectFriendRequest(requestId);
    if (result.success) {
      setRequests(prev => prev.filter(req => req.id !== requestId));
    }
    setProcessing(null);
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

  const renderRequestItem = ({ item }: { item: any }) => {
    const isProcessing = processing === item.id;

    return (
      <View style={styles.requestItem}>
        <TouchableOpacity
          onPress={() => router.push(`/user-profile?id=${item.sender_id}`)}
          style={styles.userInfo}
        >
          <Image
            source={{ uri: item.sender?.avatar_url }}
            style={styles.userAvatar}
          />
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{item.sender?.full_name || 'Inconnu'}</Text>
            {item.sender?.city && (
              <View style={styles.locationRow}>
                <IconSymbol name="location.fill" size={14} color={colors.textSecondary} />
                <Text style={styles.userCity}>{item.sender.city}</Text>
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }
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