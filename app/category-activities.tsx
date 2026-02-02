// app/category-activities.tsx
// Category activities page - Premium Clean Design
// White/Gray with Orange accent only

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
import { useDataCache } from '@/contexts/DataCacheContext';
import ActivityCard from '@/components/ActivityCard';
import { useFonts, Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';

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
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

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
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <IconSymbol name="chevron.left" size={20} color="#1F2937" />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              {categoryInfo && (
                <View style={styles.headerIconContainer}>
                  <IconSymbol name={categoryInfo.icon} size={16} color={colors.primary} />
                </View>
              )}
              <Text style={styles.headerTitle}>{categoryName}</Text>
            </View>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Chargement des activités...</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconSymbol name="chevron.left" size={20} color="#1F2937" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            {categoryInfo && (
              <View style={styles.headerIconContainer}>
                <IconSymbol name={categoryInfo.icon} size={16} color={colors.primary} />
              </View>
            )}
            <Text style={styles.headerTitle}>{categoryName}</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <IconSymbol name="magnifyingglass" size={18} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher une activité..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery !== '' && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <IconSymbol name="xmark.circle.fill" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
        >
          {filteredActivities.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <IconSymbol
                  name={searchQuery ? "magnifyingglass" : "tray"}
                  size={40}
                  color="#D1D5DB"
                />
              </View>
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
              <View style={styles.activitiesList}>
                {filteredActivities.map((activity, index) => (
                  <Animated.View
                    key={activity.id}
                    entering={FadeInDown.delay(index * 60).springify()}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: '#1F2937',
  },
  headerSpacer: {
    width: 36,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Manrope_400Regular',
    color: '#1F2937',
    paddingVertical: 0,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 100 : 120,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    fontFamily: 'Manrope_500Medium',
    color: '#6B7280',
  },
  countText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Manrope_500Medium',
    color: '#6B7280',
    marginBottom: 12,
  },
  activitiesList: {
    gap: 10,
  },
  cardWrapper: {
    width: '100%',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Manrope_400Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 32,
  },
});
