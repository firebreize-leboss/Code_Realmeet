// app/(tabs)/activity.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  ActivityIndicator,
  Alert,
  RefreshControl,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTabIndex } from '@/contexts/TabIndexContext';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, spacing, borderRadius, shadows } from '@/styles/commonStyles';
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
  participants?: number;
  max_participants?: number;
  status?: string;
  user_slot_id?: string;
  hasLiveSlots?: boolean;
  isPublished?: boolean;
}

export default function ActivityScreen() {
  const router = useRouter();
  const { setCurrentTabIndex } = useTabIndex();
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
              .in('slot_id', futureSlotIds)
              .eq('status', 'active');
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

      for (const activity of activitiesWithSlotInfo) {
        if (activity.isPublished && !activity.hasLiveSlots) {
          await supabase
            .from('activities')
            .update({ status: 'draft' })
            .eq('id', activity.id);
          activity.isPublished = false;
          activity.status = 'draft';
        }
      }

      const live = activitiesWithSlotInfo.filter(a => a.isPublished && a.hasLiveSlots);
      setLiveActivities(live);

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
                // Groupes formés avec succès
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

  // Segmented control component
  const SegmentedControl = ({
    tabs,
    activeTab,
    onTabChange,
    counts
  }: {
    tabs: { key: string; label: string }[];
    activeTab: string;
    onTabChange: (key: string) => void;
    counts: Record<string, number>;
  }) => (
    <View style={styles.segmentedControl}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const count = counts[tab.key] || 0;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.segmentedTab, isActive && styles.segmentedTabActive]}
            onPress={() => onTabChange(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.segmentedTabText, isActive && styles.segmentedTabTextActive]}>
              {tab.label}
            </Text>
            {count > 0 && (
              <View style={[styles.segmentedBadge, isActive && styles.segmentedBadgeActive]}>
                <Text style={[styles.segmentedBadgeText, isActive && styles.segmentedBadgeTextActive]}>
                  {count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // Activity card for user view
  const renderUserActivityItem = ({ item, index }: { item: Activity; index: number }) => {
    const isPast = activeTab === 'past';

    return (
      <TouchableOpacity
        style={[styles.activityCard, isPast && styles.activityCardPast]}
        onPress={() => router.push(
          isPast
            ? `/activity-detail?id=${item.id}&from=past&slotId=${item.user_slot_id ?? ''}`
            : `/activity-detail?id=${item.id}&from=myActivities`
        )}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: item.image_url || 'https://via.placeholder.com/80' }}
          style={[styles.activityImage, isPast && styles.activityImagePast]}
        />
        <View style={styles.activityContent}>
          <View style={styles.activityHeader}>
            <Text style={[styles.activityTitle, isPast && styles.activityTitlePast]} numberOfLines={2}>
              {item.nom}
            </Text>
            {isPast && (
              <View style={styles.pastBadge}>
                <IconSymbol name="checkmark.circle.fill" size={12} color={colors.textTertiary} />
                <Text style={styles.pastBadgeText}>Terminé</Text>
              </View>
            )}
          </View>

          <View style={styles.activityMeta}>
            <View style={styles.metaRow}>
              <IconSymbol name="calendar" size={14} color={isPast ? colors.textMuted : colors.textTertiary} />
              <Text style={[styles.metaText, isPast && styles.metaTextPast]}>
                {formatDate(item.date_heure)}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <IconSymbol name="clock.fill" size={14} color={isPast ? colors.textMuted : colors.textTertiary} />
              <Text style={[styles.metaText, isPast && styles.metaTextPast]}>
                {formatTime(item.date_heure)}
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <IconSymbol name="location.fill" size={14} color={isPast ? colors.textMuted : colors.primary} />
            <Text style={[styles.metaTextLocation, isPast && styles.metaTextPast]} numberOfLines={1}>
              {item.ville}
            </Text>
          </View>
        </View>

        <IconSymbol name="chevron.right" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  // Activity card for business view
  const renderBusinessActivityItem = ({ item }: { item: Activity }) => {
    const isLive = item.isPublished && item.hasLiveSlots;

    return (
      <TouchableOpacity
        style={styles.activityCard}
        onPress={() => router.push(`/manage-activity?id=${item.id}`)}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: item.image_url || 'https://via.placeholder.com/80' }}
          style={styles.activityImage}
        />
        <View style={styles.activityContent}>
          <View style={styles.activityHeader}>
            <Text style={styles.activityTitle} numberOfLines={2}>
              {item.nom}
            </Text>
            {isLive && (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveBadgeText}>En ligne</Text>
              </View>
            )}
            {item.status === 'draft' && (
              <View style={styles.draftBadge}>
                <Text style={styles.draftBadgeText}>Brouillon</Text>
              </View>
            )}
          </View>

          <View style={styles.metaRow}>
            <IconSymbol name="location.fill" size={14} color={colors.textTertiary} />
            <Text style={styles.metaText} numberOfLines={1}>
              {item.ville}
            </Text>
          </View>

          {item.participants !== undefined && (
            <View style={styles.metaRow}>
              <IconSymbol name="person.2.fill" size={14} color={colors.textTertiary} />
              <Text style={styles.metaText}>
                {item.participants}/{item.max_participants} inscrits
              </Text>
            </View>
          )}

          {businessTab === 'created' && (
            <>
              {item.hasLiveSlots ? (
                <TouchableOpacity
                  style={styles.publishButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    handlePublishActivity(item.id);
                  }}
                >
                  <IconSymbol name="paperplane.fill" size={14} color={colors.primary} />
                  <Text style={styles.publishButtonText}>Publier</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.noSlotsMessage}>
                  <IconSymbol name="exclamationmark.triangle.fill" size={12} color={colors.primary} />
                  <Text style={styles.noSlotsMessageText}>
                    Ajoutez des créneaux pour publier
                  </Text>
                </View>
              )}
            </>
          )}

          {item.isPublished && businessTab === 'live' && (
            <TouchableOpacity
              style={styles.unpublishButton}
              onPress={(e) => {
                e.stopPropagation();
                handleUnpublishActivity(item.id);
              }}
            >
              <IconSymbol name="xmark.circle.fill" size={14} color={colors.error} />
              <Text style={styles.unpublishButtonText}>Retirer</Text>
            </TouchableOpacity>
          )}
        </View>
        <IconSymbol name="chevron.right" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  // Empty state component
  const EmptyState = ({
    title,
    description,
    showCTA = false,
    ctaLabel = 'Explorer',
    onCTAPress
  }: {
    title: string;
    description: string;
    showCTA?: boolean;
    ctaLabel?: string;
    onCTAPress?: () => void;
  }) => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <IconSymbol name="calendar" size={48} color={colors.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
      {showCTA && onCTAPress && (
        <TouchableOpacity style={styles.emptyCTA} onPress={onCTAPress}>
          <Text style={styles.emptyCTAText}>{ctaLabel}</Text>
          <IconSymbol name="arrow.right" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );

  // Create activity card for business
  const CreateActivityCard = () => (
    <TouchableOpacity
      style={styles.createActivityCard}
      onPress={() => router.push('/create-activity')}
      activeOpacity={0.7}
    >
      <View style={styles.createActivityIcon}>
        <IconSymbol name="plus" size={28} color={colors.primary} />
      </View>
      <View style={styles.createActivityContent}>
        <Text style={styles.createActivityTitle}>Créer une nouvelle activité</Text>
        <Text style={styles.createActivitySubtext}>
          Ajoutez des créneaux puis publiez-la
        </Text>
      </View>
      <IconSymbol name="chevron.right" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Mes activités</Text>
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Chargement...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Business view
  if (isBusiness) {
    const businessTabs = [
      { key: 'live', label: 'En cours' },
      { key: 'created', label: 'Créées' },
    ];
    const businessCounts = {
      live: liveActivities.length,
      created: createdActivities.length,
    };

    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Mes activités</Text>
              <View style={styles.headerAccent} />
            </View>
          </View>

          <View style={styles.tabsContainer}>
            <SegmentedControl
              tabs={businessTabs}
              activeTab={businessTab}
              onTabChange={(key) => setBusinessTab(key as BusinessTabType)}
              counts={businessCounts}
            />
          </View>

          <FlatList
            data={businessTab === 'live' ? liveActivities : createdActivities}
            renderItem={renderBusinessActivityItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.listContent,
              Platform.OS !== 'ios' && styles.listContentWithTabBar,
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
            }
            ListHeaderComponent={businessTab === 'created' ? <CreateActivityCard /> : null}
            ListEmptyComponent={
              businessTab === 'live' ? (
                <EmptyState
                  title="Aucune activité en cours"
                  description="Publiez une activité avec des créneaux futurs pour la voir apparaître ici"
                />
              ) : (
                <EmptyState
                  title="Aucune activité créée"
                  description="Créez votre première activité pour commencer"
                />
              )
            }
          />
        </SafeAreaView>
      </View>
    );
  }

  // User view
  const userTabs = [
    { key: 'ongoing', label: 'En cours' },
    { key: 'past', label: 'Passées' },
  ];
  const userCounts = {
    ongoing: ongoingActivities.length,
    past: pastActivities.length,
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Mes activités</Text>
            <View style={styles.headerAccent} />
          </View>
        </View>

        <View style={styles.tabsContainer}>
          <SegmentedControl
            tabs={userTabs}
            activeTab={activeTab}
            onTabChange={(key) => setActiveTab(key as TabType)}
            counts={userCounts}
          />
        </View>

        <FlatList
          data={activeTab === 'ongoing' ? ongoingActivities : pastActivities}
          renderItem={renderUserActivityItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            Platform.OS !== 'ios' && styles.listContentWithTabBar,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            activeTab === 'ongoing' ? (
              <EmptyState
                title="Aucune activité en cours"
                description="Découvrez des activités près de chez vous et inscrivez-vous !"
                showCTA
                ctaLabel="Explorer"
                onCTAPress={() => setCurrentTabIndex(1)}
              />
            ) : (
              <EmptyState
                title="Aucune activité passée"
                description="Vos activités terminées apparaîtront ici"
              />
            )
          }
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Container & Layout
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },

  // Header - Premium avec accent orange discret
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: colors.backgroundAlt,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
    letterSpacing: -0.3,
  },
  headerAccent: {
    width: 24,
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: 1,
    marginTop: 4,
    opacity: 0.7,
  },

  // Tabs container
  tabsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.backgroundAlt,
  },

  // Segmented Control - Premium sobre
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.borderSubtle,
    borderRadius: 10,
    padding: 3,
  },
  segmentedTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 7,
    gap: 6,
  },
  segmentedTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentedTabText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Manrope_500Medium',
    color: colors.textTertiary,
  },
  segmentedTabTextActive: {
    color: colors.text,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
  },
  segmentedBadge: {
    backgroundColor: colors.badge,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  segmentedBadgeActive: {
    backgroundColor: colors.primaryLight,
  },
  segmentedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: colors.textTertiary,
  },
  segmentedBadgeTextActive: {
    color: colors.primaryMuted,
  },

  // List content
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    flexGrow: 1,
  },
  listContentWithTabBar: {
    paddingBottom: 100,
  },

  // Activity Card - Premium avec hiérarchie claire
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: 14,
    marginBottom: 12,
    gap: 14,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  activityCardPast: {
    opacity: 0.85,
    backgroundColor: colors.backgroundAccent,
  },
  activityImage: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.md,
    backgroundColor: colors.borderSubtle,
  },
  activityImagePast: {
    opacity: 0.8,
  },
  activityContent: {
    flex: 1,
    gap: 4,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  activityTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
    lineHeight: 20,
  },
  activityTitlePast: {
    color: colors.textSecondary,
  },
  activityMeta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
  },
  metaTextPast: {
    color: colors.textMuted,
  },
  metaTextLocation: {
    fontSize: 13,
    fontFamily: 'Manrope_500Medium',
    color: colors.textSecondary,
    flex: 1,
  },

  // Past badge
  pastBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.borderSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  pastBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    fontFamily: 'Manrope_500Medium',
    color: colors.textTertiary,
  },

  // Live badge
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.success,
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: colors.success,
  },

  // Draft badge
  draftBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  draftBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: colors.primary,
  },

  // Action buttons
  publishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 5,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  publishButtonText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: colors.primary,
  },
  noSlotsMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 5,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  noSlotsMessageText: {
    fontSize: 11,
    fontWeight: '500',
    fontFamily: 'Manrope_500Medium',
    color: colors.primaryMuted,
  },
  unpublishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 5,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  unpublishButtonText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: colors.error,
  },

  // Create activity card
  createActivityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: 16,
    marginBottom: 16,
    gap: 14,
    borderWidth: 2,
    borderColor: colors.borderLight,
    borderStyle: 'dashed',
  },
  createActivityIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createActivityContent: {
    flex: 1,
  },
  createActivityTitle: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
    marginBottom: 2,
  },
  createActivitySubtext: {
    fontSize: 13,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
  },

  // Loading state
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

  // Empty state - Premium centered
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  emptyCTAText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: '#FFFFFF',
  },
});
