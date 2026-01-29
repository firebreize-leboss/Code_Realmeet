// app/my-participated-activities.tsx
// Page "Mes activités" - Uniquement les activités terminées
// Design premium: fond blanc/gris clair, cartes épurées
// Palette: Blanc, Gris, Noir/Charcoal, Orange désaturé (accent uniquement)

import React, { useState, useCallback, useMemo } from 'react';
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

  // Filtrer uniquement les activités terminées (passées)
  const pastActivities = useMemo(() =>
    allActivities.filter(a => a.isPast).sort((a, b) =>
      new Date(b.slot_date || b.date).getTime() - new Date(a.slot_date || a.date).getTime()
    ), [allActivities]);

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

  const renderActivity = ({ item }: { item: Activity }) => {
    return (
      <TouchableOpacity
        style={styles.activityCard}
        onPress={() => {
          router.push(`/activity-detail?id=${item.id}&from=past&slotId=${item.slot_id}`);
        }}
        activeOpacity={0.8}
      >
        {/* Image avec ratio stable 1:1 */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: item.image_url || 'https://via.placeholder.com/80' }}
            style={styles.activityImage}
          />
          {/* Indicateur visuel discret */}
          <View style={styles.pastImageOverlay}>
            <IconSymbol name="checkmark" size={14} color={colors.textMuted} />
          </View>
        </View>

        {/* Contenu principal */}
        <View style={styles.activityContent}>
          {/* Titre - Manrope SemiBold */}
          <Text
            style={styles.activityTitle}
            numberOfLines={2}
          >
            {item.nom}
          </Text>

          {/* Meta: Date & Heure */}
          <View style={styles.metaRow}>
            <IconSymbol
              name="calendar"
              size={13}
              color={colors.textMuted}
            />
            <Text style={styles.metaText}>
              {formatDate(item.slot_date || item.date)}
              {item.slot_time && ` · ${formatTime(item.slot_time)}`}
            </Text>
          </View>

          {/* Meta: Ville */}
          <View style={styles.metaRow}>
            <IconSymbol
              name="location.fill"
              size={13}
              color={colors.textMuted}
            />
            <Text style={styles.metaText} numberOfLines={1}>
              {item.ville}
            </Text>
          </View>

          {/* Badge Terminé discret */}
          <View style={styles.terminatedBadge}>
            <IconSymbol name="checkmark.circle.fill" size={10} color={colors.primaryMuted} />
            <Text style={styles.terminatedBadgeText}>Terminé</Text>
          </View>
        </View>

        {/* Chevron discret */}
        <View style={styles.chevronContainer}>
          <IconSymbol
            name="chevron.right"
            size={14}
            color={colors.borderLight}
          />
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    return (
      <View style={styles.emptyContainer}>
        {/* Illustration élégante */}
        <View style={styles.emptyIllustration}>
          <View style={styles.emptyIconCircle}>
            <IconSymbol
              name="sparkles"
              size={32}
              color={colors.primary}
            />
          </View>
        </View>

        <Text style={styles.emptyTitle}>
          Votre aventure commence ici
        </Text>
        <Text style={styles.emptyDescription}>
          Vous n'avez pas encore participé à une activité.{'\n'}
          Rejoignez une expérience et créez vos premiers souvenirs !
        </Text>

        <TouchableOpacity
          style={styles.exploreButton}
          onPress={() => router.replace('/(tabs)/browse')}
          activeOpacity={0.85}
        >
          <IconSymbol name="magnifyingglass" size={16} color="#FFFFFF" />
          <Text style={styles.exploreButtonText}>Découvrir les activités</Text>
        </TouchableOpacity>
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

      {/* Liste des activités terminées */}
      <FlatList
        data={pastActivities}
        renderItem={renderActivity}
        keyExtractor={(item) => `${item.id}-${item.slot_id || 'no-slot'}`}
        contentContainerStyle={[
          styles.listContent,
          pastActivities.length === 0 && styles.listContentEmpty,
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
  // ==========================================
  // Container principal - Fond blanc/gris premium
  // ==========================================
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // ==========================================
  // Header - Clean et minimal
  // ==========================================
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
    letterSpacing: -0.4,
  },
  headerRight: {
    width: 40,
  },

  // ==========================================
  // Loading state
  // ==========================================
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'Manrope_500Medium',
    color: colors.textMuted,
  },

  // ==========================================
  // Liste FlatList - Spacing régulier
  // ==========================================
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 100 : 110,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  separator: {
    height: 10,
  },

  // ==========================================
  // Carte activité premium
  // Image à gauche, titre SemiBold, meta gris
  // ==========================================
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F0F0F2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },

  // ==========================================
  // Image avec ratio stable
  // ==========================================
  imageContainer: {
    position: 'relative',
  },
  activityImage: {
    width: 68,
    height: 68,
    borderRadius: 10,
    backgroundColor: '#F2F2F4',
  },
  pastImageOverlay: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },

  // ==========================================
  // Contenu principal
  // ==========================================
  activityContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 6,
    gap: 3,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: colors.textSecondary,
    lineHeight: 19,
    marginBottom: 3,
  },

  // ==========================================
  // Meta info (date, lieu) - Icônes cohérentes
  // ==========================================
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 13,
    fontFamily: 'Manrope_400Regular',
    color: colors.textMuted,
    flex: 1,
  },

  // ==========================================
  // Badge Terminé discret (gris/orange très light)
  // ==========================================
  terminatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: '#F5F5F7',
    gap: 4,
  },
  terminatedBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },

  // ==========================================
  // Chevron discret
  // ==========================================
  chevronContainer: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5,
  },

  // ==========================================
  // Empty state premium - Design élégant
  // ==========================================
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyIllustration: {
    marginBottom: 28,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  emptyDescription: {
    fontSize: 15,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  exploreButtonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: '#FFFFFF',
  },
});
