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
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';
import { intelligentGroupsService } from '@/services/intelligent-groups.service';
import { useAuth } from '@/contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';

type TabType = 'ongoing' | 'past';
type BusinessTabType = 'created' | 'live';

interface Activity {
  id: string;
  nom: string;
  image_url: string;
  date_heure: string;
  adresse: string;
  ville: string;
  participants?: number;
  max_participants?: number;
  status?: string;
  user_slot_id?: string;
  hasLiveSlots?: boolean;
  isPublished?: boolean;
}

export default function ActivityScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('ongoing');
  const [businessTab, setBusinessTab] = useState<BusinessTabType>('live');
  const [createdActivities, setCreatedActivities] = useState<Activity[]>([]);
  const [liveActivities, setLiveActivities] = useState<Activity[]>([]);
  const [ongoingActivities, setOngoingActivities] = useState<Activity[]>([]);
  const [pastActivities, setPastActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erreur chargement activités business:', error);
        setLoading(false);
        return;
      }

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      const activitiesWithSlotInfo = await Promise.all(
        (activities || []).map(async (activity) => {
          const { data: futureSlots } = await supabase
            .from('activity_slots')
            .select('id, max_participants')
            .eq('activity_id', activity.id)
            .gte('date', todayStr);

          const futureSlotIds = (futureSlots || []).map(s => s.id);
          const futureSlotsCount = futureSlotIds.length;

          const totalMaxParticipants = (futureSlots || []).reduce(
            (sum, slot) => sum + (slot.max_participants || 10),
            0
          );

          let participantsCount = 0;
          if (futureSlotIds.length > 0) {
            const { count } = await supabase
              .from('slot_participants')
              .select('*', { count: 'exact', head: true })
              .in('slot_id', futureSlotIds);
            participantsCount = count || 0;
          }

          const hasLiveSlots = futureSlotsCount > 0;
          const isPublished = activity.status === 'active';

          return {
            ...activity,
            date_heure: activity.date ? `${activity.date}T${activity.time_start || '00:00'}` : now.toISOString(),
            hasLiveSlots,
            isPublished,
            participants: participantsCount,
            max_participants: totalMaxParticipants > 0 ? totalMaxParticipants : activity.max_participants,
          };
        })
      );

      // Remettre en draft les activités publiées qui n'ont plus de créneaux futurs
      // Cela empêche qu'elles repassent automatiquement en "live" quand on ajoute des créneaux
      for (const activity of activitiesWithSlotInfo) {
        if (activity.isPublished && !activity.hasLiveSlots) {
          // L'activité était publiée mais n'a plus de créneaux futurs -> la remettre en draft
          await supabase
            .from('activities')
            .update({ status: 'draft' })
            .eq('id', activity.id);
          activity.isPublished = false;
          activity.status = 'draft';
        }
      }

      // Une activité est "en cours" (live) uniquement si elle est publiée (status='active') ET a des créneaux futurs
      const live = activitiesWithSlotInfo.filter(a => a.isPublished && a.hasLiveSlots);
      setLiveActivities(live);

      // Une activité est "créée" si elle n'est PAS publiée (status='draft')
      const created = activitiesWithSlotInfo.filter(a => !a.isPublished);
      setCreatedActivities(created);

      setOngoingActivities(live);
      setPastActivities([]);
    } catch (error) {
      console.error('Erreur chargement activités business:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePublishActivity = async (activityId: string) => {
    try {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      const { count } = await supabase
        .from('activity_slots')
        .select('*', { count: 'exact', head: true })
        .eq('activity_id', activityId)
        .gte('date', todayStr);

      if (!count || count === 0) {
        Alert.alert(
          'Impossible de publier',
          'Vous devez ajouter au moins un créneau horaire futur pour publier cette activité. Accédez à l\'activité pour ajouter des créneaux.'
        );
        return;
      }

      const { error } = await supabase
        .from('activities')
        .update({ status: 'active' })
        .eq('id', activityId);

      if (error) throw error;

      Alert.alert('Succès', 'Activité publiée !');
      loadBusinessActivities();
    } catch (error) {
      console.error('Erreur publication:', error);
      Alert.alert('Erreur', 'Impossible de publier l\'activité');
    }
  };

  const handleUnpublishActivity = async (activityId: string) => {
    Alert.alert(
      'Retirer de la publication',
      'L\'activité ne sera plus visible par les utilisateurs. Elle retournera dans vos activités créées. Continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('activities')
                .update({ status: 'draft' })
                .eq('id', activityId);

              if (error) throw error;

              Alert.alert('Succès', 'Activité retirée de la publication');
              loadBusinessActivities();
            } catch (error) {
              console.error('Erreur retrait publication:', error);
              Alert.alert('Erreur', 'Impossible de retirer la publication');
            }
          },
        },
      ]
    );
  };

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

      for (const activity of ongoing) {
        if (activity.user_slot_id) {
          try {
            const { data: slotData } = await supabase
              .from('activity_slots')
              .select('groups_formed, activity_id')
              .eq('id', activity.user_slot_id)
              .single();

            if (slotData && !slotData.groups_formed) {
              const formed = await intelligentGroupsService.checkAndFormGroupsIfNeeded(
                activity.user_slot_id,
                slotData.activity_id
              );
              if (formed) {
                console.log(`Groupes formés pour le créneau ${activity.user_slot_id}`);
              }
            }
          } catch (err) {
            console.error('Erreur vérification groupes:', err);
          }
        }
      }

    } catch (error) {
      console.error('Erreur chargement activités utilisateur:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    if (isBusiness) {
      await loadBusinessActivities();
    } else {
      await loadUserActivities();
    }
    setRefreshing(false);
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

  const renderBusinessActivityItem = (activity: Activity) => {
    const isLive = activity.isPublished && activity.hasLiveSlots;

    return (
      <TouchableOpacity
        key={activity.id}
        style={styles.activityItem}
        onPress={() => router.push(`/manage-activity?id=${activity.id}`)}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: activity.image_url || 'https://via.placeholder.com/80' }}
          style={styles.activityImage}
        />
        <View style={styles.activityInfo}>
          <View style={styles.activityTitleRow}>
            <Text style={styles.activityTitle} numberOfLines={2}>
              {activity.nom}
            </Text>
            {isLive && (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveBadgeText}>En ligne</Text>
              </View>
            )}
            {activity.status === 'draft' && (
              <View style={styles.draftBadge}>
                <Text style={styles.draftBadgeText}>Brouillon</Text>
              </View>
            )}
          </View>

          <View style={styles.activityMeta}>
            <View style={styles.metaItem}>
              <IconSymbol name="location.fill" size={14} color="rgba(255,255,255,0.9)" />
              <Text style={styles.metaText} numberOfLines={1}>
                {activity.ville}
              </Text>
            </View>
          </View>

          {activity.participants !== undefined && (
            <View style={styles.metaItem}>
              <IconSymbol name="person.2.fill" size={14} color="#FFFFFF" />
              <Text style={[styles.metaText, { color: '#FFFFFF', fontWeight: '600' }]}>
                {activity.participants}/{activity.max_participants} inscrits
              </Text>
            </View>
          )}

          {businessTab === 'created' && (
            <>
              {activity.hasLiveSlots ? (
                <TouchableOpacity
                  style={styles.publishButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    handlePublishActivity(activity.id);
                  }}
                >
                  <IconSymbol name="paperplane.fill" size={14} color="#818CF8" />
                  <Text style={styles.publishButtonText}>Publier</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.noSlotsMessage}>
                  <IconSymbol name="exclamationmark.triangle.fill" size={12} color="#f59e0b" />
                  <Text style={styles.noSlotsMessageText}>
                    Ajoutez des créneaux pour publier
                  </Text>
                </View>
              )}
            </>
          )}

          {activity.isPublished && businessTab === 'live' && (
            <TouchableOpacity
              style={styles.unpublishButton}
              onPress={(e) => {
                e.stopPropagation();
                handleUnpublishActivity(activity.id);
              }}
            >
              <IconSymbol name="xmark.circle.fill" size={14} color="#ef4444" />
              <Text style={styles.unpublishButtonText}>Retirer</Text>
            </TouchableOpacity>
          )}
        </View>
        <IconSymbol name="chevron.right" size={20} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>
    );
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
            <IconSymbol name="calendar" size={14} color="rgba(255,255,255,0.9)" />
            <Text style={styles.metaText}>{formatDate(activity.date_heure)}</Text>
          </View>
          <View style={styles.metaItem}>
            <IconSymbol name="clock.fill" size={14} color="rgba(255,255,255,0.9)" />
            <Text style={styles.metaText}>{formatTime(activity.date_heure)}</Text>
          </View>
        </View>
        <View style={styles.metaItem}>
          <IconSymbol name="location.fill" size={14} color="rgba(255,255,255,0.9)" />
          <Text style={styles.metaText} numberOfLines={1}>
            {activity.ville}
          </Text>
        </View>
        {isBusiness && activity.participants !== undefined && (
          <View style={styles.metaItem}>
            <IconSymbol name="person.2.fill" size={14} color="#FFFFFF" />
            <Text style={[styles.metaText, { color: '#FFFFFF', fontWeight: '600' }]}>
              {activity.participants}/{activity.max_participants} inscrits
            </Text>
          </View>
        )}
      </View>
      <IconSymbol name="chevron.right" size={20} color="rgba(255,255,255,0.7)" />
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <IconSymbol
        name={isBusiness ? "calendar.badge.plus" : "calendar"}
        size={64}
        color="rgba(255,255,255,0.7)"
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
          <IconSymbol name="plus" size={20} color="#818CF8" />
          <Text style={styles.createButtonText}>Créer une activité</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // Loading state
  if (loading) {
    return (
      <LinearGradient
        colors={['#60A5FA', '#818CF8', '#C084FC']}
        style={styles.container}
      >
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{isBusiness ? 'Mes activités' : 'My Activities'}</Text>
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingText}>Chargement...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Business view
  if (isBusiness) {
    return (
      <LinearGradient
        colors={['#60A5FA', '#818CF8', '#C084FC']}
        style={styles.container}
      >
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Mes activités</Text>
          </View>

          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, businessTab === 'live' && styles.tabActive]}
              onPress={() => setBusinessTab('live')}
            >
              <Text style={[styles.tabText, businessTab === 'live' && styles.tabTextActive]}>
                En cours
              </Text>
              {liveActivities.length > 0 && (
                <View style={[styles.badge, businessTab === 'live' && styles.badgeActive]}>
                  <Text style={[styles.badgeText, businessTab === 'live' && styles.badgeTextActive]}>
                    {liveActivities.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, businessTab === 'created' && styles.tabActive]}
              onPress={() => setBusinessTab('created')}
            >
              <Text style={[styles.tabText, businessTab === 'created' && styles.tabTextActive]}>
                Créées
              </Text>
              {createdActivities.length > 0 && (
                <View style={[styles.badge, businessTab === 'created' && styles.badgeActive]}>
                  <Text style={[styles.badgeText, businessTab === 'created' && styles.badgeTextActive]}>
                    {createdActivities.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.contentContainer,
              Platform.OS !== 'ios' && styles.contentContainerWithTabBar,
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#FFFFFF" />
            }
          >
            {businessTab === 'live' ? (
              liveActivities.length > 0 ? (
                liveActivities.map(renderBusinessActivityItem)
              ) : (
                <View style={styles.emptyContainer}>
                  <IconSymbol name="calendar" size={64} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.emptyTitle}>Aucune activité en cours</Text>
                  <Text style={styles.emptyText}>
                    Publiez une activité avec des créneaux futurs pour la voir ici
                  </Text>
                </View>
              )
            ) : (
              <>
                <TouchableOpacity
                  style={styles.createActivityCard}
                  onPress={() => router.push('/create-activity')}
                >
                  <View style={styles.createActivityIcon}>
                    <IconSymbol name="plus" size={32} color="#FFFFFF" />
                  </View>
                  <Text style={styles.createActivityText}>Créer une nouvelle activité</Text>
                  <Text style={styles.createActivitySubtext}>
                    Ajoutez des créneaux puis publiez-la
                  </Text>
                </TouchableOpacity>

                {createdActivities.length > 0 ? (
                  createdActivities.map(renderBusinessActivityItem)
                ) : (
                  <View style={styles.emptyContainer}>
                    <IconSymbol name="folder" size={64} color="rgba(255,255,255,0.7)" />
                    <Text style={styles.emptyTitle}>Aucune activité créée</Text>
                    <Text style={styles.emptyText}>
                      Créez votre première activité pour commencer
                    </Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // User view
  return (
    <LinearGradient
      colors={['#60A5FA', '#818CF8', '#C084FC']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mes activités</Text>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'ongoing' && styles.tabActive]}
            onPress={() => setActiveTab('ongoing')}
          >
            <Text style={[styles.tabText, activeTab === 'ongoing' && styles.tabTextActive]}>
              En cours
            </Text>
            {ongoingActivities.length > 0 && (
              <View style={[styles.badge, activeTab === 'ongoing' && styles.badgeActive]}>
                <Text style={[styles.badgeText, activeTab === 'ongoing' && styles.badgeTextActive]}>
                  {ongoingActivities.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'past' && styles.tabActive]}
            onPress={() => setActiveTab('past')}
          >
            <Text style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>
              Passées
            </Text>
            {pastActivities.length > 0 && (
              <View style={[styles.badge, activeTab === 'past' && styles.badgeActive]}>
                <Text style={[styles.badgeText, activeTab === 'past' && styles.badgeTextActive]}>
                  {pastActivities.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.contentContainer,
            Platform.OS !== 'ios' && styles.contentContainerWithTabBar,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#FFFFFF" />
          }
        >
          {activeTab === 'ongoing' ? (
            ongoingActivities.length > 0 ? (
              ongoingActivities.map(renderActivityItem)
            ) : (
              renderEmptyState()
            )
          ) : (
            pastActivities.length > 0 ? (
              pastActivities.map(renderActivityItem)
            ) : (
              renderEmptyState()
            )
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
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
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  tabActive: {
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderColor: 'rgba(255,255,255,0.5)',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeActive: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  badgeTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  contentContainerWithTabBar: {
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  activityImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  activityInfo: {
    flex: 1,
    gap: 6,
  },
  activityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.5)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  liveBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10b981',
  },
  draftBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.5)',
  },
  draftBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#f59e0b',
  },
  publishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  publishButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#818CF8',
  },
  noSlotsMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.5)',
  },
  noSlotsMessageText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f59e0b',
  },
  createActivityCard: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    borderStyle: 'dashed',
  },
  createActivityIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  createActivityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  createActivitySubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
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
    color: 'rgba(255,255,255,0.9)',
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
    color: '#FFFFFF',
    marginTop: 10,
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    marginTop: 16,
    gap: 8,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#818CF8',
  },
  unpublishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
  },
  unpublishButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ef4444',
  },
});
