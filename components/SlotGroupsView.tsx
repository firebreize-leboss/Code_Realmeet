// components/SlotGroupsView.tsx
// Composant pour afficher et gérer les groupes d'un créneau

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { groupsService } from '@/services/groups.service';
import { useRouter } from 'expo-router';

interface SlotGroupsViewProps {
  slotId: string;
  slotDate: string;
  participantCount: number;
  onGroupsGenerated?: () => void;
}

interface GroupMember {
  user_id: string;
  full_name: string;
  avatar_url: string;
}

export default function SlotGroupsView({ 
  slotId, 
  slotDate, 
  participantCount,
  onGroupsGenerated,
}: SlotGroupsViewProps) {
  const router = useRouter();
  const [groups, setGroups] = useState<{ [key: number]: GroupMember[] }>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadGroups();
  }, [slotId]);

  const loadGroups = async () => {
    try {
      setLoading(true);
      const result = await groupsService.getGroups(slotId);
      
      if (result.success && result.groups) {
        setGroups(result.groups);
      }
    } catch (error) {
      console.error('Erreur chargement groupes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateGroups = async () => {
    if (participantCount < 2) {
      Alert.alert('Info', 'Il faut au moins 2 participants pour créer des groupes.');
      return;
    }

    Alert.alert(
      'Composer les groupes',
      `Voulez-vous créer automatiquement des groupes équilibrés pour les ${participantCount} participants de ce créneau ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Composer',
          onPress: async () => {
            try {
              setGenerating(true);
              
              const result = await groupsService.assignGroups(slotId);
              
              if (result.success) {
                await loadGroups();
                onGroupsGenerated?.();
                Alert.alert(
                  'Groupes créés ! 🎉',
                  `${result.totalGroups} groupe(s) ont été composés avec succès.`
                );
              } else {
                Alert.alert('Erreur', result.error || 'Impossible de créer les groupes');
              }
            } catch (error: any) {
              Alert.alert('Erreur', error.message);
            } finally {
              setGenerating(false);
            }
          },
        },
      ]
    );
  };

  const handleRegenerateGroups = () => {
    Alert.alert(
      'Regénérer les groupes',
      'Les groupes actuels seront remplacés. Continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Regénérer',
          style: 'destructive',
          onPress: async () => {
            try {
              setGenerating(true);
              const result = await groupsService.assignGroups(slotId);
              
              if (result.success) {
                await loadGroups();
                onGroupsGenerated?.();
                Alert.alert('Succès', 'Groupes regénérés !');
              } else {
                Alert.alert('Erreur', result.error || 'Échec de la regénération');
              }
            } catch (error: any) {
              Alert.alert('Erreur', error.message);
            } finally {
              setGenerating(false);
            }
          },
        },
      ]
    );
  };

  const handleClearGroups = () => {
    Alert.alert(
      'Supprimer les groupes',
      'Tous les groupes de ce créneau seront supprimés. Continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await groupsService.clearGroups(slotId);
              if (result.success) {
                setGroups({});
                Alert.alert('Succès', 'Groupes supprimés');
              } else {
                Alert.alert('Erreur', result.error);
              }
            } catch (error: any) {
              Alert.alert('Erreur', error.message);
            }
          },
        },
      ]
    );
  };

  const handleUserPress = (userId: string) => {
    router.push(`/user-profile?id=${userId}`);
  };

  const hasGroups = Object.keys(groups).length > 0;
  const groupKeys = Object.keys(groups).map(Number).sort((a, b) => a - b);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>Chargement des groupes...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header avec actions */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Groupes du créneau</Text>
          <Text style={styles.subtitle}>{slotDate}</Text>
        </View>
        
        {hasGroups ? (
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleRegenerateGroups}
              disabled={generating}
            >
              <IconSymbol name="arrow.clockwise" size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconButton, styles.deleteButton]}
              onPress={handleClearGroups}
              disabled={generating}
            >
              <IconSymbol name="trash" size={18} color="#ef4444" />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {/* Contenu */}
      {!hasGroups ? (
        <View style={styles.emptyState}>
          <IconSymbol name="person.3.fill" size={48} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>Aucun groupe créé</Text>
          <Text style={styles.emptySubtitle}>
            Composez des groupes équilibrés pour optimiser l'expérience des participants
          </Text>
          
          <TouchableOpacity
            style={[styles.generateButton, generating && styles.generateButtonDisabled]}
            onPress={handleGenerateGroups}
            disabled={generating || participantCount < 2}
          >
            {generating ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <>
                <IconSymbol name="sparkles" size={20} color={colors.background} />
                <Text style={styles.generateButtonText}>Composer les groupes</Text>
              </>
            )}
          </TouchableOpacity>
          
          {participantCount < 2 && (
            <Text style={styles.warningText}>
              Minimum 2 participants requis
            </Text>
          )}
        </View>
      ) : (
        <ScrollView style={styles.groupsList} showsVerticalScrollIndicator={false}>
          {groupKeys.map((groupIndex) => (
            <View key={groupIndex} style={styles.groupCard}>
              <View style={styles.groupHeader}>
                <View style={styles.groupBadge}>
                  <Text style={styles.groupBadgeText}>Groupe {groupIndex}</Text>
                </View>
                <Text style={styles.groupCount}>
                  {groups[groupIndex].length} participant{groups[groupIndex].length > 1 ? 's' : ''}
                </Text>
              </View>
              
              <View style={styles.membersGrid}>
                {groups[groupIndex].map((member) => (
                  <TouchableOpacity
                    key={member.user_id}
                    style={styles.memberCard}
                    onPress={() => handleUserPress(member.user_id)}
                  >
                    <Image
                      source={{ uri: member.avatar_url || 'https://via.placeholder.com/40' }}
                      style={styles.memberAvatar}
                    />
                    <Text style={styles.memberName} numberOfLines={1}>
                      {member.full_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#fee2e2',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  warningText: {
    fontSize: 13,
    color: '#f59e0b',
    marginTop: 12,
  },
  groupsList: {
    flex: 1,
  },
  groupCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  groupBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  groupBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.background,
  },
  groupCount: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  membersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  memberCard: {
    alignItems: 'center',
    width: 70,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.border,
  },
  memberName: {
    fontSize: 12,
    color: colors.text,
    marginTop: 6,
    textAlign: 'center',
  },
});