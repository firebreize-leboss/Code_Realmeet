// components/SlotGroupsDisplay.tsx
// Composant pour afficher les groupes formés pour un créneau

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';
import { intelligentGroupsService } from '@/services/intelligent-groups.service';
import { useRouter } from 'expo-router';

interface GroupMember {
  id: string;
  full_name: string;
  avatar_url: string;
  compatibility_score: number;
}

interface Group {
  id: string;
  group_number: number;
  group_name: string;
  conversation_id: string | null;
  members: GroupMember[];
}

interface SlotGroupsDisplayProps {
  slotId: string;
  activityId: string;
  isHost?: boolean;
}

export default function SlotGroupsDisplay({
  slotId,
  activityId,
  isHost = false,
}: SlotGroupsDisplayProps) {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [reforming, setReforming] = useState(false);
  const [groupsFormed, setGroupsFormed] = useState(false);

  useEffect(() => {
    loadGroups();
  }, [slotId]);

  const loadGroups = async () => {
    try {
      setLoading(true);

      // Vérifier si les groupes ont été formés
      const { data: slotData } = await supabase
        .from('activity_slots')
        .select('groups_formed')
        .eq('id', slotId)
        .single();

      setGroupsFormed(slotData?.groups_formed || false);

      if (!slotData?.groups_formed) {
        setLoading(false);
        return;
      }

      // Charger les groupes
      const { data: groupsData, error: groupsError } = await supabase
        .from('slot_groups')
        .select('id, group_number, group_name, conversation_id')
        .eq('slot_id', slotId)
        .order('group_number', { ascending: true });

      if (groupsError) throw groupsError;

      if (!groupsData || groupsData.length === 0) {
        setGroups([]);
        setLoading(false);
        return;
      }

      // Charger les membres de chaque groupe
      const groupsWithMembers = await Promise.all(
        groupsData.map(async (group) => {
          const { data: membersData } = await supabase
            .from('slot_group_members')
            .select(`
              user_id,
              compatibility_score,
              profiles:user_id (
                id,
                full_name,
                avatar_url
              )
            `)
            .eq('group_id', group.id);

          const members: GroupMember[] = (membersData || []).map((m: any) => ({
            id: m.profiles.id,
            full_name: m.profiles.full_name || 'Participant',
            avatar_url: m.profiles.avatar_url || '',
            compatibility_score: m.compatibility_score || 0,
          }));

          return {
            ...group,
            members,
          };
        })
      );

      setGroups(groupsWithMembers);
    } catch (error) {
      console.error('Erreur chargement groupes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReformGroups = async () => {
    Alert.alert(
      'Reformer les groupes',
      'Êtes-vous sûr de vouloir reformer les groupes ? Les groupes actuels et leurs conversations seront supprimés.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Reformer',
          style: 'destructive',
          onPress: async () => {
            try {
              setReforming(true);
              await intelligentGroupsService.formIntelligentGroups(slotId, activityId);
              await loadGroups();
              Alert.alert('Succès', 'Les groupes ont été reformés avec succès.');
            } catch (error) {
              console.error('Erreur reformation groupes:', error);
              Alert.alert('Erreur', 'Impossible de reformer les groupes.');
            } finally {
              setReforming(false);
            }
          },
        },
      ]
    );
  };

  const handleOpenConversation = (conversationId: string) => {
    router.push(`/chat-detail?id=${conversationId}`);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Chargement des groupes...</Text>
      </View>
    );
  }

  if (!groupsFormed) {
    return (
      <View style={styles.emptyContainer}>
        <IconSymbol name="person.3.fill" size={64} color={colors.textSecondary} />
        <Text style={styles.emptyTitle}>Groupes non formés</Text>
        <Text style={styles.emptyText}>
          Les groupes seront automatiquement formés 24h avant le créneau
        </Text>
        {isHost && (
          <TouchableOpacity
            style={styles.manualFormButton}
            onPress={async () => {
              try {
                setReforming(true);
                await intelligentGroupsService.formIntelligentGroups(slotId, activityId);
                await loadGroups();
                Alert.alert('Succès', 'Les groupes ont été formés avec succès.');
              } catch (error) {
                console.error('Erreur formation groupes:', error);
                Alert.alert('Erreur', 'Impossible de former les groupes.');
              } finally {
                setReforming(false);
              }
            }}
            disabled={reforming}
          >
            {reforming ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <>
                <IconSymbol name="wand.and.stars" size={20} color={colors.background} />
                <Text style={styles.manualFormButtonText}>Former maintenant</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (groups.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <IconSymbol name="exclamationmark.triangle" size={64} color={colors.textSecondary} />
        <Text style={styles.emptyTitle}>Aucun groupe</Text>
        <Text style={styles.emptyText}>
          Les groupes n'ont pas pu être formés. Assurez-vous qu'il y a des participants inscrits.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Groupes formés</Text>
          <Text style={styles.subtitle}>
            {groups.length} groupe{groups.length > 1 ? 's' : ''} •{' '}
            {groups.reduce((sum, g) => sum + g.members.length, 0)} participants
          </Text>
        </View>
        {isHost && (
          <TouchableOpacity
            style={styles.reformButton}
            onPress={handleReformGroups}
            disabled={reforming}
          >
            {reforming ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <IconSymbol name="arrow.clockwise" size={20} color={colors.primary} />
            )}
          </TouchableOpacity>
        )}
      </View>

      {groups.map((group) => (
        <View key={group.id} style={styles.groupCard}>
          <View style={styles.groupHeader}>
            <View style={styles.groupTitleContainer}>
              <View style={styles.groupNumberBadge}>
                <Text style={styles.groupNumberText}>{group.group_number}</Text>
              </View>
              <Text style={styles.groupName}>{group.group_name}</Text>
            </View>
            {group.conversation_id && (
              <TouchableOpacity
                style={styles.chatButton}
                onPress={() => handleOpenConversation(group.conversation_id!)}
              >
                <IconSymbol name="message.fill" size={18} color={colors.primary} />
                <Text style={styles.chatButtonText}>Chat</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.membersContainer}>
            {group.members.map((member) => (
              <View key={member.id} style={styles.memberItem}>
                <Image
                  source={{ uri: member.avatar_url || 'https://via.placeholder.com/40' }}
                  style={styles.memberAvatar}
                />
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.full_name}</Text>
                  {member.compatibility_score > 0 && (
                    <View style={styles.compatibilityBadge}>
                      <IconSymbol name="star.fill" size={12} color="#FFD700" />
                      <Text style={styles.compatibilityText}>
                        {Math.round(member.compatibility_score)}% affinité
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  manualFormButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  manualFormButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  reformButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  groupTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  groupNumberBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.background,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  chatButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  membersContainer: {
    gap: 12,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.border,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  compatibilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  compatibilityText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
