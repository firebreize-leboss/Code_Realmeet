// components/SlotParticipantsModal.tsx
// Modal affichant les participants d'un créneau spécifique

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';

interface SlotParticipant {
  id: string;
  name: string;
  avatar: string;
  joinedAt: string;
}

interface SlotInfo {
  id: string;
  date: string;
  time: string;
  duration?: number;
}

interface SlotParticipantsModalProps {
  visible: boolean;
  onClose: () => void;
  slot: SlotInfo | null;
  activityId: string;
  activityTitle?: string;
  maxParticipants?: number;
}

export default function SlotParticipantsModal({
  visible,
  onClose,
  slot,
  activityId,
  activityTitle,
  maxParticipants,
}: SlotParticipantsModalProps) {
  const router = useRouter();
  const [participants, setParticipants] = useState<SlotParticipant[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && slot) {
      loadSlotParticipants();
    }
  }, [visible, slot]);

  const loadSlotParticipants = async () => {
    if (!slot) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('slot_participants')
        .select(`
          id,
          user_id,
          created_at,
          profiles:user_id (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('slot_id', slot.id)
        .eq('activity_id', activityId)
        .eq('status', 'active');

      if (error) throw error;

      const formattedParticipants: SlotParticipant[] = (data || []).map((p: any) => ({
        id: p.profiles?.id || p.user_id,
        name: p.profiles?.full_name || 'Participant',
        avatar: p.profiles?.avatar_url || '',
        joinedAt: new Date(p.created_at).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'short',
        }),
      }));

      setParticipants(formattedParticipants);
    } catch (error) {
      console.error('Erreur chargement participants du créneau:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatSlotDate = () => {
    if (!slot) return '';
    const date = new Date(slot.date);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return '';
    if (minutes < 60) return `${minutes}min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`;
  };

  const handleParticipantPress = (participantId: string) => {
    onClose();
    router.push(`/user-profile?id=${participantId}`);
  };

  const renderParticipant = ({ item }: { item: SlotParticipant }) => (
    <TouchableOpacity
      style={styles.participantCard}
      onPress={() => handleParticipantPress(item.id)}
      activeOpacity={0.7}
    >
      <Image
        source={{ uri: item.avatar || 'https://via.placeholder.com/48' }}
        style={styles.participantAvatar}
      />
      <View style={styles.participantInfo}>
        <Text style={styles.participantName}>{item.name}</Text>
        <Text style={styles.participantMeta}>Inscrit le {item.joinedAt}</Text>
      </View>
      <IconSymbol name="chevron.right" size={18} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <IconSymbol name="person.2" size={48} color={colors.textSecondary} />
      <Text style={styles.emptyTitle}>Aucun participant</Text>
      <Text style={styles.emptySubtitle}>
        Personne n'est encore inscrit à ce créneau
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <IconSymbol name="xmark" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Participants</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Slot Info */}
        {slot && (
          <View style={styles.slotInfoCard}>
            <View style={styles.slotInfoRow}>
              <IconSymbol name="calendar" size={20} color={colors.primary} />
              <Text style={styles.slotInfoText}>{formatSlotDate()}</Text>
            </View>
            <View style={styles.slotInfoRow}>
              <IconSymbol name="clock" size={20} color={colors.primary} />
              <Text style={styles.slotInfoText}>
                {slot.time}
                {slot.duration ? ` • ${formatDuration(slot.duration)}` : ''}
              </Text>
            </View>
            <View style={styles.slotInfoRow}>
              <IconSymbol name="person.2.fill" size={20} color={colors.primary} />
              <Text style={styles.slotInfoText}>
                {participants.length}
                {maxParticipants ? ` / ${maxParticipants}` : ''} participant
                {participants.length > 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        )}

        {/* Participants List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Chargement...</Text>
          </View>
        ) : (
          <FlatList
            data={participants}
            keyExtractor={(item) => item.id}
            renderItem={renderParticipant}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={renderEmptyState}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  slotInfoCard: {
    backgroundColor: colors.card,
    margin: 16,
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },
  slotInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  slotInfoText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
    flexGrow: 1,
  },
  participantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  participantAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.border,
  },
  participantInfo: {
    flex: 1,
    marginLeft: 12,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  participantMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
});