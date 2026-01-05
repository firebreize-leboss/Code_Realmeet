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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';
import { intelligentGroupsService } from '@/services/intelligent-groups.service';
import { useAuth } from '@/contexts/AuthContext';

type TabType = 'ongoing' | 'past';
type BusinessTabType = 'created' | 'live';

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
  // Nouveau pour entreprises
  hasLiveSlots?: boolean; // A des créneaux futurs
  isPublished?: boolean; // status === 'active'
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

      // Récupérer toutes les activités créées par l'entreprise
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

      // Pour chaque activité, vérifier si elle a des créneaux futurs et compter les participants
      const activitiesWithSlotInfo = await Promise.all(
        (activities || []).map(async (activity) => {
          // Compter les créneaux futurs
          const { count: futureSlotsCount } = await supabase
            .from('activity_slots')
            .select('*', { count: 'exact', head: true })
            .eq('activity_id', activity.id)
            .gte('date', todayStr);

          // Compter le nombre TOTAL de participants inscrits (tous créneaux confondus)
          const { count: participantsCount } = await supabase
            .from('slot_participants')
            .select('*', { count: 'exact', head: true })
            .eq('activity_id', activity.id);

          const hasLiveSlots = (futureSlotsCount || 0) > 0;
          const isPublished = activity.status === 'active';

          return {
            ...activity,
            date_heure: activity.date ? `${activity.date}T${activity.time_start || '00:00'}` : now.toISOString(),
            hasLiveSlots,
            isPublished,
            participants: participantsCount || 0, // Nombre réel de participants inscrits
          };
        })
      );

      // Activités "en cours" = publiées ET ayant des créneaux futurs
      const live = activitiesWithSlotInfo.filter(a => a.isPublished && a.hasLiveSlots);
      setLiveActivities(live);

      // Activités "créées" = TOUTES SAUF celles qui sont en ligne
      const created = activitiesWithSlotInfo.filter(a => !(a.isPublished && a.hasLiveSlots));
      setCreatedActivities(created);

      // Pour compatibilité avec l'ancien code (utilisateurs)
      setOngoingActivities(live);
      setPastActivities([]);
    } catch (error) {
      console.error('Erreur chargement activités business:', error);
    } finally {
      setLoading(false);
    }
  };

  // Publier une activité (passer de draft à active)
  const handlePublishActivity = async (activityId: string) => {
    try {
      // Vérifier qu'il y a au moins un créneau futur
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
  // Mettre en pause une activité
  const handlePauseActivity = async (activityId: string) => {
    Alert.alert(
      'Mettre en pause',
      'Les utilisateurs ne pourront plus s\'inscrire. Continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Mettre en pause',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('activities')
                .update({ status: 'paused' })
                .eq('id', activityId);

              if (error) throw error;

              Alert.alert('Succès', 'Activité mise en pause');
              loadBusinessActivities();
            } catch (error) {
              console.error('Erreur pause:', error);
              Alert.alert('Erreur', 'Impossible de mettre en pause');
            }
          },
        },
      ]
    );
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
            {/* Badge "En ligne" si publiée et a des créneaux */}
            {isLive && (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveBadgeText}>En ligne</Text>
              </View>
            )}
            {/* Badge "Brouillon" si pas publiée */}
            {!activity.isPublished && (
              <View style={styles.draftBadge}>
                <Text style={styles.draftBadgeText}>Brouillon</Text>
              </View>
            )}
          </View>
          
          <View style={styles.activityMeta}>
            <View style={styles.metaItem}>
              <IconSymbol name="location.fill" size={14} color={colors.textSecondary} />
              <Text style={styles.metaText} numberOfLines={1}>
                {activity.ville}
              </Text>
            </View>
          </View>
          
          {activity.participants !== undefined && (
            <View style={styles.metaItem}>
              <IconSymbol name="person.2.fill" size={14} color={colors.primary} />
              <Text style={[styles.metaText, { color: colors.primary }]}>
                {activity.participants}/{activity.max_participants} inscrits
              </Text>
            </View>
          )}

          {/* Bouton Publier si brouillon (onglet Créées) */}
          {!activity.isPublished && businessTab === 'created' && (
            <>
              {activity.hasLiveSlots ? (
                <TouchableOpacity
                  style={styles.publishButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    handlePublishActivity(activity.id);
                  }}
                >
                  <IconSymbol name="paperplane.fill" size={14} color={colors.background} />
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

          {/* Bouton Mettre en pause si en ligne (onglet En cours) */}
          {activity.isPublished && businessTab === 'live' && (
            <TouchableOpacity
              style={styles.pauseButton}
              onPress={(e) => {
                e.stopPropagation();
                handlePauseActivity(activity.id);
              }}
            >
              <IconSymbol name="pause.circle.fill" size={14} color={colors.background} />
              <Text style={styles.pauseButtonText}>Mettre en pause</Text>
            </TouchableOpacity>
          )}
        </View>
        <IconSymbol name="chevron.right" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    );
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

      // Vérifier si des groupes doivent être formés (backup du cron)
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

  // ============================================
  // RENDU ENTREPRISE
  // ============================================
  if (isBusiness) {
    return (
      <SafeAreaView style={commonStyles.container} edges={['top']}>
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
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{liveActivities.length}</Text>
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
              <View style={[styles.badge, businessTab !== 'created' && styles.badgeInactive]}>
                <Text style={styles.badgeText}>{createdActivities.length}</Text>
              </View>
            )}
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
            {businessTab === 'live' ? (
              liveActivities.length > 0 ? (
                liveActivities.map(renderBusinessActivityItem)
              ) : (
                <View style={styles.emptyContainer}>
                  <IconSymbol name="calendar" size={64} color={colors.textSecondary} />
                  <Text style={styles.emptyTitle}>Aucune activité en cours</Text>
                  <Text style={styles.emptyText}>
                    Publiez une activité avec des créneaux futurs pour la voir ici
                  </Text>
                </View>
              )
            ) : (
              <>
                {/* Bouton créer une activité */}
                <TouchableOpacity
                  style={styles.createActivityCard}
                  onPress={() => router.push('/create-activity')}
                >
                  <View style={styles.createActivityIcon}>
                    <IconSymbol name="plus" size={32} color={colors.primary} />
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
                    <IconSymbol name="folder" size={64} color={colors.textSecondary} />
                    <Text style={styles.emptyTitle}>Aucune activité créée</Text>
                    <Text style={styles.emptyText}>
                      Créez votre première activité pour commencer
                    </Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  // ============================================
  // RENDU UTILISATEUR
  // ============================================
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
    backgroundColor: '#10b981' + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
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
    backgroundColor: '#f59e0b' + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  draftBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#f59e0b',
  },
  publishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  publishButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.background,
  },
  noSlotsMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b' + '20',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  noSlotsMessageText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f59e0b',
  },
  createActivityCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.primary + '30',
    borderStyle: 'dashed',
  },
  createActivityIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  createActivityText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  createActivitySubtext: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  badgeInactive: {
    backgroundColor: colors.textSecondary,
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
  pauseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  pauseButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.background,
  },
});