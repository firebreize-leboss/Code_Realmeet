// app/my-activities.tsx
// Page de gestion des activités pour les entreprises

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';
import { useDataCache } from '@/contexts/DataCacheContext';

type FilterType = 'all' | 'active' | 'past' | 'draft';

interface Activity {
  id: string;
  nom: string;
  description: string;
  image_url: string;
  date: string;
  time_start: string;
  ville: string;
  categorie: string;
  participants: number;
  max_participants: number;
  prix: number;
  status: string;
  created_at: string;
}

export default function MyActivitiesScreen() {
  const router = useRouter();
  const { cache, refreshMyActivities } = useDataCache();
  const activities = cache.myActivities;
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');

  // Calculer les stats à partir du cache
  const stats = useMemo(() => {
    const now = new Date();
    const active = activities.filter(a =>
      a.status === 'active' && new Date(a.date) >= now
    ).length;
    const past = activities.filter(a =>
      new Date(a.date) < now
    ).length;
    const totalParticipants = activities.reduce(
      (sum, a) => sum + (a.participants || 0), 0
    );

    return {
      total: activities.length,
      active,
      past,
      totalParticipants,
    };
  }, [activities]);

  const loading = false; // Les données viennent du cache

  // Pas besoin de loadActivities, les données viennent du cache

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshMyActivities();
    setRefreshing(false);
  };

  const handleDeleteActivity = (activityId: string, activityName: string) => {
    Alert.alert(
      'Supprimer l\'activité',
      `Êtes-vous sûr de vouloir supprimer "${activityName}" ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('activities')
                .delete()
                .eq('id', activityId);

              if (error) throw error;

              // Rafraîchir le cache
              await refreshMyActivities();
              Alert.alert('Succès', 'Activité supprimée');
            } catch (error) {
              console.error('Error deleting activity:', error);
              Alert.alert('Erreur', 'Impossible de supprimer l\'activité');
            }
          },
        },
      ]
    );
  };

  const handleDuplicateActivity = async (activity: Activity) => {
    try {
      const { id, created_at, ...activityData } = activity;
      
      const { data, error } = await supabase
        .from('activities')
        .insert({
          ...activityData,
          nom: `${activity.nom} (copie)`,
          participants: 0,
          status: 'draft',
        })
        .select()
        .single();

      if (error) throw error;

      // Rafraîchir le cache
      await refreshMyActivities();
      Alert.alert('Succès', 'Activité dupliquée !');
    } catch (error) {
      console.error('Error duplicating activity:', error);
      Alert.alert('Erreur', 'Impossible de dupliquer l\'activité');
    }
  };

  const getFilteredActivities = () => {
    const now = new Date();
    switch (filter) {
      case 'active':
        return activities.filter(a => 
          a.status === 'active' && new Date(a.date) >= now
        );
      case 'past':
        return activities.filter(a => new Date(a.date) < now);
      case 'draft':
        return activities.filter(a => a.status === 'draft');
      default:
        return activities;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusBadge = (activity: Activity) => {
    const now = new Date();
    const activityDate = new Date(activity.date);
    
    if (activity.status === 'draft') {
      return { label: 'Brouillon', color: '#F59E0B' };
    }
    if (activityDate < now) {
      return { label: 'Terminée', color: colors.textSecondary };
    }
    if (activity.participants >= activity.max_participants) {
      return { label: 'Complet', color: '#EF4444' };
    }
    return { label: 'Active', color: '#10B981' };
  };

  const renderActivityCard = ({ item }: { item: Activity }) => {
    const status = getStatusBadge(item);
    const fillPercentage = (item.participants / item.max_participants) * 100;

    return (
      <TouchableOpacity
        style={styles.activityCard}
        onPress={() => router.push(`/activity-detail?id=${item.id}`)}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: item.image_url || 'https://via.placeholder.com/150' }}
          style={styles.activityImage}
        />
        
        <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: status.color }]} />
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>

        <View style={styles.activityContent}>
          <View style={styles.activityHeader}>
            <Text style={styles.activityTitle} numberOfLines={1}>{item.nom}</Text>
            <Text style={styles.activityPrice}>
              {item.prix > 0 ? `${item.prix}€` : 'Gratuit'}
            </Text>
          </View>

          <View style={styles.activityMeta}>
            <View style={styles.metaItem}>
              <IconSymbol name="calendar" size={14} color={colors.textSecondary} />
              <Text style={styles.metaText}>{formatDate(item.date)}</Text>
            </View>
            <View style={styles.metaItem}>
              <IconSymbol name="location.fill" size={14} color={colors.textSecondary} />
              <Text style={styles.metaText}>{item.ville}</Text>
            </View>
          </View>

          <View style={styles.participantsSection}>
            <View style={styles.participantsInfo}>
              <IconSymbol name="person.2.fill" size={14} color={colors.primary} />
              <Text style={styles.participantsText}>
                {item.participants} / {item.max_participants} participants
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.min(fillPercentage, 100)}%` }]} />
            </View>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push(`/edit-activity?id=${item.id}`)}
            >
              <IconSymbol name="pencil" size={16} color={colors.primary} />
              <Text style={styles.actionButtonText}>Modifier</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleDuplicateActivity(item)}
            >
              <IconSymbol name="doc.on.doc.fill" size={16} color={colors.secondary} />
              <Text style={[styles.actionButtonText, { color: colors.secondary }]}>Dupliquer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleDeleteActivity(item.id, item.nom)}
            >
              <IconSymbol name="trash.fill" size={16} color="#EF4444" />
              <Text style={[styles.actionButtonText, { color: '#EF4444' }]}>Supprimer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <IconSymbol name="calendar" size={64} color={colors.textSecondary} />
      <Text style={styles.emptyTitle}>Aucune activité</Text>
      <Text style={styles.emptyText}>
        {filter === 'all'
          ? 'Créez votre première activité pour commencer à accueillir des participants'
          : `Aucune activité ${filter === 'active' ? 'active' : filter === 'past' ? 'passée' : 'en brouillon'}`
        }
      </Text>
      {filter === 'all' && (
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => router.push('/create-activity')}
        >
          <IconSymbol name="plus" size={20} color={colors.background} />
          <Text style={styles.createButtonText}>Créer une activité</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={commonStyles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={() => router.push('/create-activity')}
          style={styles.addButton}
        >
          <IconSymbol name="plus" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Stats Summary */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#10B981' }]}>{stats.active}</Text>
          <Text style={styles.statLabel}>Actives</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.past}</Text>
          <Text style={styles.statLabel}>Passées</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{stats.totalParticipants}</Text>
          <Text style={styles.statLabel}>Inscrits</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        {([
          { key: 'all', label: 'Toutes' },
          { key: 'active', label: 'Actives' },
          { key: 'past', label: 'Passées' },
          { key: 'draft', label: 'Brouillons' },
        ] as { key: FilterType; label: string }[]).map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterTab, filter === tab.key && styles.filterTabActive]}
            onPress={() => setFilter(tab.key)}
          >
            <Text style={[styles.filterTabText, filter === tab.key && styles.filterTabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Activities List */}
      <FlatList
        data={getFilteredActivities()}
        renderItem={renderActivityCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmptyList}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  addButton: {
    padding: 8,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    marginHorizontal: 20,
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.card,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  filterTabTextActive: {
    color: colors.background,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 100 : 120,
  },
  activityCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  activityImage: {
    width: '100%',
    height: 140,
    backgroundColor: colors.border,
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activityContent: {
    padding: 16,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activityTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    marginRight: 12,
  },
  activityPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  activityMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  participantsSection: {
    marginBottom: 16,
  },
  participantsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  participantsText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
});