// app/(tabs)/category-activities.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { PREDEFINED_CATEGORIES } from '@/constants/categories';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useDataCache } from '@/contexts/DataCacheContext';

interface Activity {
  id: string;
  nom: string;
  description: string;
  categorie: string;
  categorie2?: string;
  date: string;
  time_start?: string;
  adresse: string;
  ville: string;
  image_url?: string;
  participants: number;
  max_participants: number;
  prix?: number;
}

export default function CategoryActivitiesScreen() {
  const router = useRouter();
  const { category } = useLocalSearchParams();
  const { cache, loading: cacheLoading, refreshActivities } = useDataCache();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const categoryName = decodeURIComponent(category as string);
  const categoryInfo = PREDEFINED_CATEGORIES.find(cat => cat.name === categoryName);

  // Filtrer les activités par catégorie avec créneaux futurs
  const filteredActivities = useMemo(() => {
    return cache.activities.filter((activity: Activity) => {
      // Vérifier que l'activité a des créneaux futurs
      const slotData = cache.slotDataByActivity[activity.id];
      if (!slotData || slotData.slotCount === 0) return false;

      // Vérifier la catégorie
      const matchesCategory = activity.categorie === categoryName || activity.categorie2 === categoryName;
      if (!matchesCategory) return false;

      // Vérifier la recherche
      if (searchQuery === '') return true;

      const query = searchQuery.toLowerCase();
      return (
        activity.nom.toLowerCase().includes(query) ||
        (activity.description?.toLowerCase().includes(query) || false) ||
        activity.ville.toLowerCase().includes(query) ||
        activity.adresse.toLowerCase().includes(query)
      );
    });
  }, [cache.activities, cache.slotDataByActivity, categoryName, searchQuery]);

  const handleActivityPress = (activityId: string) => {
    router.push(`/activity-detail?id=${activityId}&from=browse`);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshActivities();
    setRefreshing(false);
  };

  const renderActivityCard = (activity: Activity, index: number) => {
    const slotData = cache.slotDataByActivity[activity.id];
    const remainingPlaces = slotData?.remainingPlaces ?? 0;
    const slotCount = slotData?.slotCount ?? 0;
    const isAlmostFull = remainingPlaces <= 3 && remainingPlaces > 0;
    const isFull = remainingPlaces === 0;

    const formattedDate = (() => {
      const latest = slotData?.latestDate;
      if (!latest) return 'Aucune date disponible';
      try {
        return new Date(latest).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      } catch {
        return latest;
      }
    })();

    return (
      <Animated.View
        key={activity.id}
        entering={FadeInDown.delay(index * 100).springify()}
      >
        <TouchableOpacity
          style={styles.activityCard}
          onPress={() => handleActivityPress(activity.id)}
          activeOpacity={0.9}
        >
          <Image
            source={{ uri: activity.image_url || 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800' }}
            style={styles.activityImage}
          />

          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.85)']}
            style={styles.activityGradient}
            start={{ x: 0, y: 0.3 }}
            end={{ x: 0, y: 1 }}
          />

          {/* Badge catégorie */}
          <View style={styles.topRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{activity.categorie}</Text>
            </View>
            {isFull ? (
              <View style={styles.fullBadge}>
                <Text style={styles.fullBadgeText}>COMPLET</Text>
              </View>
            ) : isAlmostFull ? (
              <View style={styles.almostFullBadge}>
                <Text style={styles.almostFullBadgeText}>{remainingPlaces} places</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.activityInfo}>
            <Text style={styles.activityTitle} numberOfLines={2}>
              {activity.nom}
            </Text>

            <View style={styles.activityMeta}>
              <View style={styles.metaRow}>
                <IconSymbol name="location.fill" size={14} color="#FFFFFF" />
                <Text style={styles.metaText} numberOfLines={1}>{activity.ville}</Text>
              </View>

              <View style={styles.metaRow}>
                <IconSymbol name="calendar.badge.clock" size={14} color="#FFFFFF" />
                <Text style={styles.metaText}>
                  {slotCount} créneau{slotCount > 1 ? 'x' : ''} dispo
                </Text>
              </View>
            </View>

            {activity.prix !== undefined && activity.prix > 0 && (
              <View style={styles.priceRow}>
                <IconSymbol name="eurosign.circle.fill" size={14} color="#FFFFFF" />
                <Text style={styles.priceText}>{activity.prix.toFixed(0)} €</Text>
              </View>
            )}

            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min((activity.participants / activity.max_participants) * 100, 100)}%`,
                      backgroundColor: isFull ? '#E74C3C' : '#FFFFFF'
                    }
                  ]}
                />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (cacheLoading) {
    return (
      <LinearGradient
        colors={['#60A5FA', '#818CF8', '#C084FC']}
        style={styles.container}
      >
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <IconSymbol name="chevron.left" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              {categoryInfo && (
                <View style={styles.headerIcon}>
                  <IconSymbol name={categoryInfo.icon} size={20} color="#FFFFFF" />
                </View>
              )}
              <Text style={styles.headerTitle}>{categoryName}</Text>
            </View>
            <View style={styles.placeholder} />
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingText}>Chargement des activités...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#60A5FA', '#818CF8', '#C084FC']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconSymbol name="chevron.left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            {categoryInfo && (
              <View style={styles.headerIcon}>
                <IconSymbol name={categoryInfo.icon} size={20} color="#FFFFFF" />
              </View>
            )}
            <Text style={styles.headerTitle}>{categoryName}</Text>
          </View>
          <View style={styles.placeholder} />
        </View>

        {/* Barre de recherche */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <IconSymbol name="magnifyingglass" size={20} color="rgba(255,255,255,0.9)" />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher une activité..."
              placeholderTextColor="rgba(255,255,255,0.6)"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery !== '' && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <IconSymbol name="xmark.circle.fill" size={20} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            )}
          </View>
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
          {filteredActivities.length === 0 ? (
            <View style={styles.emptyContainer}>
              <IconSymbol
                name={searchQuery ? "magnifyingglass" : "tray"}
                size={64}
                color="rgba(255,255,255,0.7)"
              />
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'Aucun résultat' : 'Aucune activité'}
              </Text>
              <Text style={styles.emptyText}>
                {searchQuery
                  ? 'Aucune activité ne correspond à votre recherche'
                  : "Il n'y a pas encore d'activités dans cette catégorie."
                }
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.countText}>
                {filteredActivities.length} activité{filteredActivities.length > 1 ? 's' : ''}
                {searchQuery && ` trouvée${filteredActivities.length > 1 ? 's' : ''}`}
              </Text>
              {filteredActivities.map((activity, index) => renderActivityCard(activity, index))}
            </>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 40,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    paddingVertical: 0,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
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
  countText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 15,
  },

  // Activity Card Styles (Glassmorphism)
  activityCard: {
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  activityImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  activityGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  topRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  categoryBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fullBadge: {
    backgroundColor: 'rgba(231, 76, 60, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  fullBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  almostFullBadge: {
    backgroundColor: 'rgba(241, 196, 15, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  almostFullBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  activityInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    gap: 8,
  },
  activityTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    lineHeight: 26,
  },
  activityMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  metaText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignSelf: 'flex-start',
  },
  priceText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  progressContainer: {
    marginTop: 4,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 22,
  },
});
