// app/category-activities.tsx
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
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
import ActivityCard from '@/components/ActivityCard';

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
  host_id?: string;
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

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshActivities();
    setRefreshing(false);
  };

  // Transformer l'activité pour le composant ActivityCard
  const mapActivityForCard = (activity: Activity) => {
    const slotData = cache.slotDataByActivity[activity.id];
    // Calculer le total des places de tous les créneaux
    const totalMaxPlaces = slotData?.totalMaxPlaces || activity.max_participants;
    const totalParticipants = totalMaxPlaces - (slotData?.remainingPlaces || 0);
    return {
      ...activity,
      host_id: activity.host_id || '',
      date: slotData?.latestDate || activity.date,
      allDates: slotData?.allDates || [],
      // Utiliser les totaux calculés pour afficher les places correctement
      participants: totalParticipants,
      max_participants: totalMaxPlaces,
    };
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
              <View style={styles.gridContainer}>
                {filteredActivities.map((activity, index) => (
                  <Animated.View
                    key={activity.id}
                    entering={FadeInDown.delay(index * 80).springify()}
                    style={styles.cardWrapper}
                  >
                    <ActivityCard
                      activity={mapActivityForCard(activity)}
                      variant="compact"
                    />
                  </Animated.View>
                ))}
              </View>
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
  gridContainer: {
    flexDirection: 'column',
    gap: 12,
  },
  cardWrapper: {
    width: '100%',
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
