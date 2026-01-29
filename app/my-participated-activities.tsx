// app/my-participated-activities.tsx
// Page "Mes activités" avec onglets En cours / Passées
// Design premium cohérent avec profile et browse (orange unique + Manrope + fond blanc/gris)

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, spacing, borderRadius, shadows } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';
import { useFonts, Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';

type TabType = 'ongoing' | 'past';

interface Activity {
  id: string;
  nom: string;
  image_url: string;
  date: string;
  time_start?: string;
  ville: string;
  categorie: string;
  slot_id?: string;
  slot_date?: string;
  slot_time?: string;
  isPast?: boolean;
}

export default function MyParticipatedActivitiesScreen() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('ongoing');

  const loadActivities = useCallback(async () => {
    try {
      setLoading(true);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;

      const { data: participations, error: partError } = await supabase
        .from('slot_participants')
        .select('activity_id, slot_id')
        .eq('user_id', userData.user.id);

      if (partError) throw partError;

      if (!participations || participations.length === 0) {
        setAllActivities([]);
        setLoading(false);
        return;
      }

      const activityIds = [...new Set(participations.map(p => p.activity_id))];

      const { data: activitiesData, error: actError } = await supabase
        .from('activities')
        .select('id, nom, image_url, date, time_start, ville, categorie')
        .in('id', activityIds)
        .order('date', { ascending: false });

      if (actError) throw actError;

      // Pour chaque activité, récupérer les infos du slot et déterminer si passée
      const now = new Date();
      const activitiesWithSlotInfo = await Promise.all(
        (activitiesData || []).map(async (activity) => {
          const participation = participations.find(p => p.activity_id === activity.id);
          let slotDate: string | null = null;
          let slotTime: string | null = null;
          let isPast = false;

          if (participation?.slot_id) {
            const { data: slotData } = await supabase
              .from('activity_slots')
              .select('date, time, duration')
              .eq('id', participation.slot_id)
              .single();

            if (slotData) {
              slotDate = slotData.date;
              slotTime = slotData.time;
              const slotDateTime = new Date(`${slotData.date}T${slotData.time || '00:00'}`);
              const durationMinutes = slotData.duration || 0;
              const slotEndTime = new Date(slotDateTime.getTime() + durationMinutes * 60 * 1000);
              isPast = slotEndTime < now;
            }
          }

          return {
            ...activity,
            slot_id: participation?.slot_id,
            slot_date: slotDate || activity.date,
            slot_time: slotTime || activity.time_start,
            isPast,
          };
        })
      );

      setAllActivities(activitiesWithSlotInfo);
    } catch (error) {
      console.error('Erreur chargement activités:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadActivities();
    }, [loadActivities])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadActivities();
    setRefreshing(false);
  };

  // Séparer les activités en cours et passées
  const ongoingActivities = useMemo(() =>
    allActivities.filter(a => !a.isPast).sort((a, b) =>
      new Date(a.slot_date || a.date).getTime() - new Date(b.slot_date || b.date).getTime()
    ), [allActivities]);

  const pastActivities = useMemo(() =>
    allActivities.filter(a => a.isPast).sort((a, b) =>
      new Date(b.slot_date || b.date).getTime() - new Date(a.slot_date || a.date).getTime()
    ), [allActivities]);

  const currentActivities = activeTab === 'ongoing' ? ongoingActivities : pastActivities;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = date.toDateString() === today.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    if (isToday) return "Aujourd'hui";
    if (isTomorrow) return 'Demain';

    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return '';
    return timeString.substring(0, 5);
  };

  const renderActivity = ({ item, index }: { item: Activity; index: number }) => {
    const isPast = item.isPast;

    return (
      <TouchableOpacity
        style={[styles.activityCard, isPast && styles.activityCardPast]}
        onPress={() => {
          router.push(`/activity-detail?id=${item.id}&from=${isPast ? 'past' : 'ongoing'}&slotId=${item.slot_id}`);
        }}
        activeOpacity={0.7}
      >
        {/* Image avec ratio stable */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: item.image_url || 'https://via.placeholder.com/80' }}
            style={[styles.activityImage, isPast && styles.activityImagePast]}
          />
          {isPast && (
            <View style={styles.pastOverlay}>
              <IconSymbol name="clock.fill" size={12} color={colors.textTertiary} />
            </View>
          )}
        </View>

        {/* Contenu */}
        <View style={styles.activityContent}>
          {/* Titre */}
          <Text
            style={[styles.activityTitle, isPast && styles.activityTitlePast]}
            numberOfLines={2}
          >
            {item.nom}
          </Text>

          {/* Meta: Date & Heure */}
          <View style={styles.metaRow}>
            <IconSymbol
              name="calendar"
              size={14}
              color={isPast ? colors.textMuted : colors.textTertiary}
            />
            <Text style={[styles.metaText, isPast && styles.metaTextPast]}>
              {formatDate(item.slot_date || item.date)}
              {item.slot_time && ` - ${formatTime(item.slot_time)}`}
            </Text>
          </View>

          {/* Meta: Ville */}
          <View style={styles.metaRow}>
            <IconSymbol
              name="location.fill"
              size={14}
              color={isPast ? colors.textMuted : colors.textTertiary}
            />
            <Text style={[styles.metaText, isPast && styles.metaTextPast]}>
              {item.ville}
            </Text>
          </View>

          {/* Badge Terminé pour les passées */}
          {isPast && (
            <View style={styles.terminatedBadge}>
              <Text style={styles.terminatedBadgeText}>Terminé</Text>
            </View>
          )}
        </View>

        {/* Chevron */}
        <View style={styles.chevronContainer}>
          <IconSymbol
            name="chevron.right"
            size={16}
            color={isPast ? colors.textMuted : colors.textTertiary}
          />
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    const isOngoing = activeTab === 'ongoing';

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <IconSymbol
            name={isOngoing ? "calendar.badge.clock" : "clock.arrow.circlepath"}
            size={48}
            color={colors.primaryMuted}
          />
        </View>
        <Text style={styles.emptyTitle}>
          {isOngoing ? 'Aucune activité à venir' : 'Aucune activité passée'}
        </Text>
        <Text style={styles.emptyDescription}>
          {isOngoing
            ? 'Inscrivez-vous à des activités pour les voir apparaître ici'
            : 'Vos activités terminées apparaîtront ici'
          }
        </Text>
        {isOngoing && (
          <TouchableOpacity
            style={styles.exploreButton}
            onPress={() => router.replace('/(tabs)/browse')}
            activeOpacity={0.8}
          >
            <Text style={styles.exploreButtonText}>Explorer les activités</Text>
            <IconSymbol name="arrow.right" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <IconSymbol name="chevron.left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mes activités</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes activités</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Segmented Control Premium */}
      <View style={styles.segmentedControlContainer}>
        <View style={styles.segmentedControl}>
          {/* Tab En cours */}
          <TouchableOpacity
            style={[
              styles.segmentedTab,
              activeTab === 'ongoing' && styles.segmentedTabActive,
            ]}
            onPress={() => setActiveTab('ongoing')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.segmentedTabText,
                activeTab === 'ongoing' && styles.segmentedTabTextActive,
              ]}
            >
              En cours
            </Text>
            {ongoingActivities.length > 0 && (
              <View style={[
                styles.tabBadge,
                activeTab === 'ongoing' && styles.tabBadgeActive,
              ]}>
                <Text style={[
                  styles.tabBadgeText,
                  activeTab === 'ongoing' && styles.tabBadgeTextActive,
                ]}>
                  {ongoingActivities.length}
                </Text>
              </View>
            )}
            {activeTab === 'ongoing' && <View style={styles.activeIndicator} />}
          </TouchableOpacity>

          {/* Tab Passées */}
          <TouchableOpacity
            style={[
              styles.segmentedTab,
              activeTab === 'past' && styles.segmentedTabActive,
            ]}
            onPress={() => setActiveTab('past')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.segmentedTabText,
                activeTab === 'past' && styles.segmentedTabTextActive,
              ]}
            >
              Passées
            </Text>
            {pastActivities.length > 0 && (
              <View style={[
                styles.tabBadge,
                activeTab === 'past' && styles.tabBadgeActive,
              ]}>
                <Text style={[
                  styles.tabBadgeText,
                  activeTab === 'past' && styles.tabBadgeTextActive,
                ]}>
                  {pastActivities.length}
                </Text>
              </View>
            )}
            {activeTab === 'past' && <View style={styles.activeIndicator} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Liste des activités */}
      <FlatList
        data={currentActivities}
        renderItem={renderActivity}
        keyExtractor={(item) => `${item.id}-${item.slot_id || 'no-slot'}`}
        contentContainerStyle={[
          styles.listContent,
          currentActivities.length === 0 && styles.listContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={renderEmptyState}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Container principal
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.backgroundAlt,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
    letterSpacing: -0.3,
  },
  headerRight: {
    width: 40,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    fontFamily: 'Manrope_500Medium',
    color: colors.textTertiary,
  },

  // Segmented Control Premium
  segmentedControlContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: colors.backgroundAlt,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.borderSubtle,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  segmentedTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
    position: 'relative',
  },
  segmentedTabActive: {
    backgroundColor: '#FFFFFF',
    ...shadows.sm,
  },
  segmentedTabText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Manrope_500Medium',
    color: colors.textTertiary,
  },
  segmentedTabTextActive: {
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
  },

  // Badge discret dans les tabs
  tabBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  tabBadgeActive: {
    backgroundColor: colors.primaryLight,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: colors.textTertiary,
  },
  tabBadgeTextActive: {
    color: colors.primaryMuted,
  },

  // Indicateur actif (micro-accent orange)
  activeIndicator: {
    position: 'absolute',
    bottom: 2,
    left: '50%',
    marginLeft: -8,
    width: 16,
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: 1,
    opacity: 0.8,
  },

  // Liste
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 100 : 120,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  separator: {
    height: 12,
  },

  // Carte activité premium
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  activityCardPast: {
    opacity: 0.75,
    backgroundColor: colors.backgroundAccent,
  },

  // Image
  imageContainer: {
    position: 'relative',
  },
  activityImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: colors.borderSubtle,
  },
  activityImagePast: {
    opacity: 0.85,
  },
  pastOverlay: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Contenu
  activityContent: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
    gap: 4,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
    lineHeight: 20,
    marginBottom: 2,
  },
  activityTitlePast: {
    color: colors.textSecondary,
  },

  // Meta info
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
  },
  metaTextPast: {
    color: colors.textMuted,
  },

  // Badge Terminé
  terminatedBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: colors.borderSubtle,
  },
  terminatedBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Chevron
  chevronContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 14,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    ...shadows.sm,
  },
  exploreButtonText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: '#FFFFFF',
  },
});
