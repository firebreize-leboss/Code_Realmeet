import React, { useState, useEffect } from 'react';
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
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

type TabType = 'ongoing' | 'past';

interface Activity {
  id: string;
  nom: string;
  image_url: string;
  date_heure: string;
  adresse: string;
  ville: string;
}

export default function ActivityScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('ongoing');
  const [ongoingActivities, setOngoingActivities] = useState<Activity[]>([]);
  const [pastActivities, setPastActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
  useCallback(() => {
    loadUserActivities();
  }, [])
);

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

    // ✅ CORRECTION: Récupérer depuis slot_participants au lieu de activity_participants
    const { data: participations, error: partError } = await supabase
      .from('slot_participants')
      .select('activity_id, slot_id')
      .eq('user_id', currentUser.id);

    if (partError) {
      console.error('Erreur chargement participations:', partError);
    }

    // Extraire les IDs d'activités uniques
    const activityIds = [...new Set(participations?.map(p => p.activity_id) || [])];

    if (activityIds.length === 0) {
      setOngoingActivities([]);
      setPastActivities([]);
      setLoading(false);
      return;
    }

    // Récupérer les activités avec les infos des créneaux
    const { data: activities, error: actError } = await supabase
      .from('activities')
      .select('id, nom, image_url, adresse, ville, date, time_start')
      .in('id', activityIds);

    if (actError) {
      console.error('Erreur chargement activités:', actError);
    }

    // Pour chaque activité, récupérer la date du créneau auquel l'utilisateur est inscrit
    const activitiesWithSlotDates = await Promise.all(
      (activities || []).map(async (activity) => {
        // Trouver le slot_id pour cette activité
        const participation = participations?.find(p => p.activity_id === activity.id);
        
        if (participation?.slot_id) {
          // Récupérer les infos du créneau
          const { data: slotData } = await supabase
            .from('activity_slots')
            .select('date, time')
            .eq('id', participation.slot_id)
            .single();
          
          if (slotData) {
            // Combiner date et heure du créneau
            const slotDateTime = `${slotData.date}T${slotData.time || '00:00'}`;
            return {
              ...activity,
              date_heure: slotDateTime,
            };
          }
        }
        
        // Fallback sur la date de l'activité si pas de créneau
        const activityDateTime = activity.date 
          ? `${activity.date}T${activity.time_start || '00:00'}`
          : now;
        
        return {
          ...activity,
          date_heure: activityDateTime,
        };
      })
    );

    // Séparer les activités en cours et passées
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

    // Trier par date
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
      year: 'numeric' 
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const renderActivityItem = (activity: Activity) => (
    <TouchableOpacity
      key={activity.id}
      style={styles.activityItem}
      onPress={() => router.push(`/activity-detail?id=${activity.id}`)}
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
      </View>
      <IconSymbol name="chevron.right" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Activities</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'ongoing' && styles.tabActive]}
          onPress={() => setActiveTab('ongoing')}
        >
          <Text style={[styles.tabText, activeTab === 'ongoing' && styles.tabTextActive]}>
            Ongoing
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'past' && styles.tabActive]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>
            Past
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
              <View style={styles.emptyState}>
                <IconSymbol name="calendar" size={64} color={colors.textSecondary} />
                <Text style={styles.emptyText}>No ongoing activities</Text>
                <Text style={styles.emptySubtext}>
                  Browse activities to join your first event!
                </Text>
                <TouchableOpacity
                  style={styles.browseButton}
                  onPress={() => router.push('/(tabs)/browse')}
                >
                  <Text style={styles.browseButtonText}>Browse Activities</Text>
                </TouchableOpacity>
              </View>
            )
          ) : (
            pastActivities.length > 0 ? (
              pastActivities.map(renderActivityItem)
            ) : (
              <View style={styles.emptyState}>
                <IconSymbol name="clock.fill" size={64} color={colors.textSecondary} />
                <Text style={styles.emptyText}>No past activities</Text>
                <Text style={styles.emptySubtext}>
                  Your completed activities will appear here
                </Text>
              </View>
            )
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
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
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  contentContainerWithTabBar: {
    paddingBottom: 100,
  },
  activityItem: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
    gap: 12,
  },
  activityImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  activityInfo: {
    flex: 1,
    gap: 6,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 22,
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
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
  browseButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 24,
  },
  browseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
});