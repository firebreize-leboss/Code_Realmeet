// app/(tabs)/activity.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type TabType = 'ongoing' | 'past';

interface Activity {
  id: string;
  nom: string;
  image_url: string;
  date_heure: string;
  adresse: string;
  ville: string;
  // Pour les entreprises
  participants?: number;
  max_participants?: number;
  status?: string;
  user_slot_id?: string;
}

export default function ActivityScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('ongoing');
  const [ongoingActivities, setOngoingActivities] = useState<Activity[]>([]);
  const [pastActivities, setPastActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const isBusiness = profile?.account_type === 'business';

  useFocusEffect(
    useCallback(() => {
      if (isBusiness) {
        loadBusinessActivities();
      } else {
        loadUserActivities();
      }
    }, [isBusiness])
  );

  // ✅ Charger les activités CRÉÉES par l'entreprise
  const loadBusinessActivities = async () => {
    try {
      setLoading(true);
      const { data: currentUserData } = await supabase.auth.getUser();
      const currentUser = currentUserData?.user;

      if (!currentUser) {
        setLoading(false);
        return;
      }

      // Récupérer les activités créées par l'entreprise
      const { data: activities, error } = await supabase
        .from('activities')
        .select('id, nom, image_url, adresse, ville, date, time_start, participants, max_participants, status')
        .eq('host_id', currentUser.id)
        .order('date', { ascending: false });

      if (error) {
        console.error('Erreur chargement activités business:', error);
        setLoading(false);
        return;
      }

      const now = new Date();
      const ongoing: Activity[] = [];
      const past: Activity[] = [];

      (activities || []).forEach(activity => {
        const activityDateTime = activity.date
          ? `${activity.date}T${activity.time_start || '00:00'}`
          : now.toISOString();

        const activityWithDateTime = {
          ...activity,
          date_heure: activityDateTime,
          user_slot_id: participation?.slot_id,
        };

        const activityDate = new Date(activityDateTime);
        if (activityDate >= now) {
          ongoing.push(activityWithDateTime);
        } else {
          past.push(activityWithDateTime);
        }
      });

      // Trier par date
      ongoing.sort((a, b) => new Date(a.date_heure).getTime() - new Date(b.date_heure).getTime());
      past.sort((a, b) => new Date(b.date_heure).getTime() - new Date(a.date_heure).getTime());

      setOngoingActivities(ongoing);
      setPastActivities(past);
    } catch (error) {
      console.error('Erreur chargement activités business:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Charger les activités auxquelles l'utilisateur PARTICIPE
  const loadUserActivities = async () => {
    try {
      setLoading(true);
      const { data: currentUserData } = await supabase.auth.getUser();
      const currentUser = currentUserData?.user;

      if (!currentUser) {
        setLoading(false);
        return;
      }

      const now = new Date().toISOString();

      // Récupérer depuis slot_participants
      const { data: participations, error: partError } = await supabase
        .from('slot_participants')
        .select('activity_id, slot_id')
        .eq('user_id', currentUser.id);

      if (partError) {
        console.error('Erreur chargement participations:', partError);
      }

      const activityIds = [...new Set(participations?.map(p => p.activity_id) || [])];

      if (activityIds.length === 0) {
        setOngoingActivities([]);
        setPastActivities([]);
        setLoading(false);
        return;
      }

      const { data: activities, error: actError } = await supabase
        .from('activities')
        .select('id, nom, image_url, adresse, ville, date, time_start')
        .in('id', activityIds);

      if (actError) {
        console.error('Erreur chargement activités:', actError);
      }

      // Pour chaque activité, récupérer la date du créneau
      const activitiesWithSlotDates = await Promise.all(
        (activities || []).map(async (activity) => {
          const participation = participations?.find(p => p.activity_id === activity.id);
          
          if (participation?.slot_id) {
            const { data: slotData } = await supabase
              .from('activity_slots')
              .select('date, time')
              .eq('id', participation.slot_id)
              .single();

            if (slotData) {
              const slotDateTime = `${slotData.date}T${slotData.time || '00:00'}`;
              return {
                ...activity,
                date_heure: slotDateTime,
                user_slot_id: participation?.slot_id,
              };
            }
          }

          const activityDateTime = activity.date
            ? `${activity.date}T${activity.time_start || '00:00'}`
            : now;

          return {
            ...activity,
            date_heure: activityDateTime,
            user_slot_id: participation?.slot_id,
          };
        })
      );

      const ongoing: Activity[] = [];
      const past: Activity[] = [];

      activitiesWithSlotDates.forEach(activity => {
        const activityDate = new Date(activity.date_heure);

        if (activityDate >= new Date()) {
          ongoing.push(activity);
        } else {
          past.push(activity);
        }
      });

      ongoing.sort((a, b) => new Date(a.date_heure).getTime() - new Date(b.date_heure).getTime());
      past.sort((a, b) => new Date(b.date_heure).getTime() - new Date(a.date_heure).getTime());

      setOngoingActivities(ongoing);
      setPastActivities(past);
    } catch (error) {
      console.error('Erreur chargement activités utilisateur:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderActivityItem = (activity: Activity) => (
    <TouchableOpacity
      key={activity.id}
      style={styles.activityItem}
      onPress={() => router.push(
  isBusiness
    ? `/manage-activity?id=${activity.id}`
    : activeTab === 'past'
      ? `/activity-detail?id=${activity.id}&from=past&slotId=${activity.user_slot_id ?? ''}`
      : `/activity-detail?id=${activity.id}&from=myActivities`
)}

      activeOpacity={0.8}
    >
      <Image
        source={{ uri: activity.image_url || 'https://via.placeholder.com/80' }}
        style={styles.activityImage}
      />
      <View style={styles.activityInfo}>
        <Text style={styles.activityTitle} numberOfLines={2}>
          {activity.nom}
        </Text>
        <View style={styles.activityMeta}>
          <View style={styles.metaItem}>
            <IconSymbol name="calendar" size={14} color={colors.textSecondary} />
            <Text style={styles.metaText}>{formatDate(activity.date_heure)}</Text>
          </View>
          <View style={styles.metaItem}>
            <IconSymbol name="clock.fill" size={14} color={colors.textSecondary} />
            <Text style={styles.metaText}>{formatTime(activity.date_heure)}</Text>
          </View>
        </View>
        <View style={styles.metaItem}>
          <IconSymbol name="location.fill" size={14} color={colors.textSecondary} />
          <Text style={styles.metaText} numberOfLines={1}>
            {activity.ville}
          </Text>
        </View>
        {/* Afficher les participants pour les entreprises */}
        {isBusiness && activity.participants !== undefined && (
          <View style={styles.metaItem}>
            <IconSymbol name="person.2.fill" size={14} color={colors.primary} />
            <Text style={[styles.metaText, { color: colors.primary }]}>
              {activity.participants}/{activity.max_participants} inscrits
            </Text>
          </View>
        )}
      </View>
      <IconSymbol name="chevron.right" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <IconSymbol
        name={isBusiness ? "calendar.badge.plus" : "calendar"}
        size={64}
        color={colors.textSecondary}
      />
      <Text style={styles.emptyTitle}>
        {activeTab === 'ongoing'
          ? isBusiness
            ? 'Aucune activité à venir'
            : 'Aucune activité en cours'
          : 'Aucune activité passée'}
      </Text>
      <Text style={styles.emptyText}>
        {isBusiness
          ? 'Créez votre première activité pour attirer des participants !'
          : 'Inscrivez-vous à des activités pour les voir apparaître ici'}
      </Text>
      {isBusiness && activeTab === 'ongoing' && (
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

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {isBusiness ? 'Mes activités' : 'My Activities'}
        </Text>
        {isBusiness && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push('/create-activity')}
          >
            <IconSymbol name="plus" size={24} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'ongoing' && styles.tabActive]}
          onPress={() => setActiveTab('ongoing')}
        >
          <Text style={[styles.tabText, activeTab === 'ongoing' && styles.tabTextActive]}>
            {isBusiness ? 'À venir' : 'Ongoing'}
          </Text>
          {ongoingActivities.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{ongoingActivities.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'past' && styles.tabActive]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>
            {isBusiness ? 'Passées' : 'Past'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.contentContainer,
            Platform.OS !== 'ios' && styles.contentContainerWithTabBar,
          ]}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'ongoing' ? (
            ongoingActivities.length > 0 ? (
              ongoingActivities.map(renderActivityItem)
            ) : (
              renderEmptyState()
            )
          ) : pastActivities.length > 0 ? (
            pastActivities.map(renderActivityItem)
          ) : (
            renderEmptyState()
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 10,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.surface,
    gap: 6,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.background,
  },
  badge: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  contentContainerWithTabBar: {
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  activityImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  activityInfo: {
    flex: 1,
    gap: 4,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  activityMeta: {
    flexDirection: 'row',
    gap: 12,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 10,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginTop: 16,
    gap: 8,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
});