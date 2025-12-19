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
  slot_id?: string; // ID du créneau auquel l'utilisateur est inscrit
  // Pour les entreprises
  participants?: number;
  max_participants?: number;
  status?: string;
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
        };

        const activityDate = new Date(activityDateTime);
        if (activityDate >= now) {
          ongoing.push(activityWithDateTime);
        } else {
          past.push(activityWithDateTime);
        }
      });

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

      // Récupérer depuis slot_participants avec le slot_id
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

      const { data: activities, error: actErr } = await supabase
        .from('activities')
        .select('id, nom, image_url, adresse, ville, date, time_start')
        .in('id', activityIds);

      if (actErr) {
        console.error('Erreur chargement activités:', actErr);
      }

      // Pour chaque activité, récupérer la date du créneau et garder le slot_id
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
                slot_id: participation.slot_id, // Garder le slot_id
              };
            }
          }

          const activityDateTime = activity.date
            ? `${activity.date}T${activity.time_start || '00:00'}`
            : new Date().toISOString();

          return {
            ...activity,
            date_heure: activityDateTime,
            slot_id: participation?.slot_id,
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

  // ✅ Navigation avec source et slot_id pour les activités passées
  const handleActivityPress = (activity: Activity, isPast: boolean) => {
    if (isBusiness) {
      router.push(`/manage-activity?id=${activity.id}`);
    } else {
      // Pour les utilisateurs normaux
      let url = `/activity-detail?id=${activity.id}`;
      
      if (isPast && activity.slot_id) {
        // Activité passée : on passe source=past et le slot_id pour afficher les participants du créneau
        url += `&source=past&slotId=${activity.slot_id}`;
      } else {
        // Activité en cours : on passe source=ongoing (pas de participants visibles)
        url += `&source=ongoing`;
      }
      
      router.push(url);
    }
  };

  const renderActivityItem = (activity: Activity, isPast: boolean = false) => (
    <TouchableOpacity
      key={activity.id}
      style={styles.activityItem}
      onPress={() => handleActivityPress(activity, isPast)}
      activeOpacity={0.7}
    >
      <Image
        source={{ uri: activity.image_url || 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400' }}
        style={styles.activityImage}
      />
      <View style={styles.activityInfo}>
        <Text style={styles.activityName} numberOfLines={1}>{activity.nom}</Text>
        <View style={styles.activityMeta}>
          <IconSymbol name="calendar" size={14} color={colors.textSecondary} />
          <Text style={styles.activityMetaText}>{formatDate(activity.date_heure)}</Text>
        </View>
        <View style={styles.activityMeta}>
          <IconSymbol name="clock" size={14} color={colors.textSecondary} />
          <Text style={styles.activityMetaText}>{formatTime(activity.date_heure)}</Text>
        </View>
        <View style={styles.activityMeta}>
          <IconSymbol name="location.fill" size={14} color={colors.textSecondary} />
          <Text style={styles.activityMetaText} numberOfLines={1}>{activity.ville}</Text>
        </View>
        {isBusiness && activity.participants !== undefined && (
          <View style={styles.activityMeta}>
            <IconSymbol name="person.2.fill" size={14} color={colors.primary} />
            <Text style={[styles.activityMetaText, { color: colors.primary }]}>
              {activity.participants}/{activity.max_participants} participants
            </Text>
          </View>
        )}
      </View>
      <IconSymbol name="chevron.right" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <IconSymbol 
        name={isBusiness ? "calendar.badge.plus" : "calendar"} 
        size={64} 
        color={colors.textSecondary} 
      />
      <Text style={styles.emptyTitle}>
        {activeTab === 'ongoing' 
          ? (isBusiness ? 'Aucune activité à venir' : 'Aucune activité en cours')
          : 'Aucune activité passée'
        }
      </Text>
      <Text style={styles.emptySubtitle}>
        {isBusiness 
          ? 'Créez votre première activité pour la voir apparaître ici'
          : 'Explorez les activités disponibles pour participer'
        }
      </Text>
      {isBusiness ? (
        <TouchableOpacity
          style={styles.emptyButton}
          onPress={() => router.push('/create-activity')}
        >
          <Text style={styles.emptyButtonText}>Créer une activité</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.emptyButton}
          onPress={() => router.push('/(tabs)/browse')}
        >
          <Text style={styles.emptyButtonText}>Explorer</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={commonStyles.safeArea} edges={['top']}>
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
              ongoingActivities.map(activity => renderActivityItem(activity, false))
            ) : (
              renderEmptyState()
            )
          ) : pastActivities.length > 0 ? (
            pastActivities.map(activity => renderActivityItem(activity, true))
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
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    gap: 12,
    paddingBottom: 100,
  },
  contentContainerWithTabBar: {
    paddingBottom: 120,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 12,
    gap: 12,
  },
  activityImage: {
    width: 70,
    height: 70,
    borderRadius: 12,
    backgroundColor: colors.border,
  },
  activityInfo: {
    flex: 1,
    gap: 4,
  },
  activityName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activityMetaText: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyButton: {
    marginTop: 24,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
  },
  emptyButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
});