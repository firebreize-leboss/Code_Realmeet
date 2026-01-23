// app/(tabs)/browse.tsx
import React, { useState, useEffect, useRef, useMemo, useContext, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Platform,
  TextInput,
  PanResponder,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { WebView } from 'react-native-webview';
import { supabase } from '@/lib/supabase';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { PREDEFINED_CATEGORIES } from '@/constants/categories';
import { useDataCache } from '@/contexts/DataCacheContext';
import ActivityCard from '@/components/ActivityCard';


const PROTOMAPS_KEY = process.env.EXPO_PUBLIC_PROTOMAPS_KEY || '';

type ViewMode = 'liste' | 'maps';

// Options de filtrage
interface FilterOptions {
  maxDistance: number | null; // en km, null = pas de limite
  maxPrice: number | null; // en euros, null = pas de limite
  minPrice: number | null; // en euros, null = pas de minimum
  dateFrom: string | null; // format YYYY-MM-DD
  dateTo: string | null; // format YYYY-MM-DD
  minRemainingPlaces: number | null; // places restantes minimum
  categories: string[]; // catégories sélectionnées (vide = toutes)
}

const DEFAULT_FILTERS: FilterOptions = {
  maxDistance: null,
  maxPrice: null,
  minPrice: null,
  dateFrom: null,
  dateTo: null,
  minRemainingPlaces: null,
  categories: [],
};

interface Activity {
  id: string;
  nom: string;
  titre?: string;
  description: string;
  categorie: string;
  categorie2?: string;
  image_url?: string;
  date: string;
  time_start: string;
  adresse: string;
  ville: string;
  latitude: number;
  longitude: number;
  participants: number;
  max_participants: number;
  host_id: string;
  prix?: number;
}

interface SelectedActivity {
  id: string;
  nom: string;
  categorie: string;
  date: string;
  adresse: string;
  participants: number;
  max_participants: number;
  image_url?: string;
  latitude: number;
  longitude: number;
}

interface UserLocation {
  latitude: number;
  longitude: number;
}


// Fonction pour calculer la distance entre deux points GPS (formule Haversine)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function BrowseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { cache, loading: cacheLoading, refreshActivities } = useDataCache();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('liste');
  const [selectedActivity, setSelectedActivity] = useState<SelectedActivity | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const webViewRef = useRef<WebView>(null);
  const hasHandledParams = useRef(false);
  const hasCenteredOnActivity = useRef(false);
  const isFirstFocus = useRef(true);
  const [isBusiness, setIsBusiness] = useState(false);
  const [detailFooterHeight, setDetailFooterHeight] = useState(0);
  const insets = useSafeAreaInsets();
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;

  // Utiliser les données du cache
  const activities = cache.activities;
  const latestSlotDateByActivity = Object.fromEntries(
    Object.entries(cache.slotDataByActivity).map(([id, data]) => [id, data.latestDate])
  );
  const slotCountByActivity = Object.fromEntries(
    Object.entries(cache.slotDataByActivity).map(([id, data]) => [id, data.slotCount])
  );
  const remainingPlacesByActivity = Object.fromEntries(
    Object.entries(cache.slotDataByActivity).map(([id, data]) => [id, data.remainingPlaces])
  );
  const loading = cacheLoading;

  // États pour les filtres
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>(DEFAULT_FILTERS);
  const [tempFilters, setTempFilters] = useState<FilterOptions>(DEFAULT_FILTERS);

  // Compteur de filtres actifs
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.maxDistance !== null) count++;
    if (filters.maxPrice !== null || filters.minPrice !== null) count++;
    if (filters.dateFrom !== null || filters.dateTo !== null) count++;
    if (filters.minRemainingPlaces !== null) count++;
    if (filters.categories.length > 0) count++;
    return count;
  }, [filters]);


  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    })();
  }, []);
  // Mettre à jour le marker utilisateur quand la localisation change
  useEffect(() => {
    if (userLocation && webViewRef.current && viewMode === 'maps') {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'updateUserLocation',
        userLocation,
      }));
    }
  }, [userLocation, viewMode]);

  useEffect(() => {
  supabase.auth.getUser().then(({ data }) => {
    setIsBusiness(data.user?.user_metadata?.role === 'business');
  });
  }, []);

  // Rafraîchir les activités quand l'écran reprend le focus (retour depuis les détails)
  useFocusEffect(
    useCallback(() => {
      // Ne pas rafraîchir lors du premier focus (le cache initial suffit)
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      // Rafraîchir les données quand on revient sur l'écran
      refreshActivities();
    }, [refreshActivities])
  );


  useEffect(() => {
    if (hasHandledParams.current) return;
    if (activities.length === 0) return;

    if (params.viewMode === 'maps') {
      setViewMode('maps');
    }

    if (params.selectedActivityId) {
      const activity = activities.find(a => a.id === params.selectedActivityId);
      if (activity && activity.latitude && activity.longitude) {
        hasHandledParams.current = true;
        hasCenteredOnActivity.current = true;
        setTimeout(() => {
          if (webViewRef.current) {
            webViewRef.current.postMessage(JSON.stringify({
              type: 'centerOnActivity',
              activityId: activity.id,
              latitude: activity.latitude,
              longitude: activity.longitude,
            }));
          }
          setSelectedActivity({
            id: activity.id,
            nom: activity.nom,
            categorie: activity.categorie,
            date: activity.date,
            adresse: activity.adresse,
            participants: activity.participants || 0,
            max_participants: activity.max_participants,
            image_url: activity.image_url,
            latitude: activity.latitude,
            longitude: activity.longitude,
          });
        }, 1500);
      }
    }
  }, [params.viewMode, params.selectedActivityId, activities]);

  useEffect(() => {
    return () => {
      hasHandledParams.current = false;
      hasCenteredOnActivity.current = false;
    };
  }, []);

  // Les données viennent du cache, pas besoin de loadActivities
  // Le cache est géré globalement par DataCacheProvider

  useEffect(() => {
    if (viewMode === 'maps' && activities.length > 0 && !params.selectedActivityId) {
      sendActivitiesToMap(activities, !hasCenteredOnActivity.current);
    }
  }, [viewMode, activities, params.selectedActivityId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshActivities();
    setRefreshing(false);
  };

  const sendActivitiesToMap = (
  activitiesData: Activity[],
  latestMap: Record<string, string | null> = latestSlotDateByActivity,
  shouldCenter: boolean = true
) => {

    if (webViewRef.current) {
      const activitiesWithCoords = activitiesData.filter(a => a.latitude && a.longitude);
      webViewRef.current.postMessage(JSON.stringify({
        type: 'loadActivities',
        activities: activitiesWithCoords.map(a => ({
  id: a.id,
  nom: a.nom,
  categorie: a.categorie,
  date: latestMap[a.id] || 'Aucune date disponible',
  adresse: a.adresse,
  latitude: a.latitude,
  longitude: a.longitude,
  participants: a.participants || 0,
  max_participants: a.max_participants,
  image_url: a.image_url,
})),

        userLocation,
        shouldCenter,
      }));
    }
  };

  const centerOnUser = () => {
    if (userLocation && webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'centerOnUser',
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      }));
    }
  };

  // Fonction de filtrage réutilisable
  const applyFilters = (activitiesToFilter: Activity[], filtersToApply: FilterOptions) => {
    return activitiesToFilter.filter(activity => {
      // Filtre de recherche textuelle
      const matchesSearch = searchQuery === '' ||
        activity.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
        activity.categorie.toLowerCase().includes(searchQuery.toLowerCase()) ||
        activity.ville?.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      // Filtre par catégorie
      if (filtersToApply.categories.length > 0) {
        const activityCategories = [activity.categorie, activity.categorie2].filter(Boolean);
        const matchesCategory = filtersToApply.categories.some(cat =>
          activityCategories.some(ac => ac?.toLowerCase() === cat.toLowerCase())
        );
        if (!matchesCategory) return false;
      }

      // Filtre par prix
      const activityPrice = activity.prix ?? 0;
      if (filtersToApply.minPrice !== null && activityPrice < filtersToApply.minPrice) return false;
      if (filtersToApply.maxPrice !== null && activityPrice > filtersToApply.maxPrice) return false;

      // Filtre par distance (nécessite la localisation de l'utilisateur)
      if (filtersToApply.maxDistance !== null && userLocation && activity.latitude && activity.longitude) {
        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          activity.latitude,
          activity.longitude
        );
        if (distance > filtersToApply.maxDistance) return false;
      }

      // Filtre par date
      const activityDate = latestSlotDateByActivity[activity.id];
      if (activityDate) {
        if (filtersToApply.dateFrom !== null && activityDate < filtersToApply.dateFrom) return false;
        if (filtersToApply.dateTo !== null && activityDate > filtersToApply.dateTo) return false;
      }

      // Filtre par places restantes
      if (filtersToApply.minRemainingPlaces !== null) {
        const remaining = remainingPlacesByActivity[activity.id] ?? 0;
        if (remaining < filtersToApply.minRemainingPlaces) return false;
      }

      return true;
    });
  };

  // Logique de filtrage complète (avec les filtres appliqués)
  const filteredActivities = useMemo(() => {
    return applyFilters(activities, filters);
  }, [activities, searchQuery, filters, userLocation, latestSlotDateByActivity, remainingPlacesByActivity]);

  // Nombre de résultats en temps réel basé sur les filtres temporaires (pour le bouton Appliquer)
  const previewResultsCount = useMemo(() => {
    return applyFilters(activities, tempFilters).length;
  }, [activities, searchQuery, tempFilters, userLocation, latestSlotDateByActivity, remainingPlacesByActivity]);

  const closeActivity = () => {
    setSelectedActivity(null);
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({ type: 'deselectMarker' }));
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 5,
      onPanResponderRelease: (_, g) => { if (g.dy > 50) closeActivity(); },
    })
  ).current;

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'markerClicked') {
        setSelectedActivity(data.activity);
      }
    } catch (e) { console.error('Error parsing message:', e); }
  };

  const defaultCenter = userLocation
    ? [userLocation.longitude, userLocation.latitude]
    : [2.3522, 48.8566];

  const mapHTML = useMemo(() => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css">
  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body, html { height: 100%; overflow: hidden; }
    #map { position: absolute; top: 0; left: 0; right: 0; bottom: 0; }
    .custom-marker {
      width: 40px; height: 40px; background: #ef4444;
      border: 4px solid white; border-radius: 50%; cursor: pointer;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.5);
      transition: transform 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
    }
    .custom-marker:hover { transform: scale(1.2); }
    .custom-marker.selected {
      background: #10b981; transform: scale(1.3);
      box-shadow: 0 6px 20px rgba(16, 185, 129, 0.6);
    }
    .user-marker {
      width: 20px; height: 20px; background: #3B82F6;
      border: 3px solid white; border-radius: 50%;
      box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.3);
    }
    .maplibregl-ctrl-bottom-left, .maplibregl-ctrl-bottom-right { display: none; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    let selectedMarkerId = null, markers = {}, userMarker = null, map;
    
    map = new maplibregl.Map({
      container: 'map',
      style: 'https://api.protomaps.com/styles/v2/light.json?key=${PROTOMAPS_KEY}',
      center: [2.3522, 48.8566],
      zoom: 13
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    function sendMessage(type, data) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...data }));
      }
    }

    function handleMessage(event) {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'updateUserLocation') {
          if (userMarker) userMarker.remove();
          const userEl = document.createElement('div');
          userEl.className = 'user-marker';
          userMarker = new maplibregl.Marker({ element: userEl })
            .setLngLat([data.userLocation.longitude, data.userLocation.latitude])
            .addTo(map);
        }
        
        if (data.type === 'loadActivities') {
          const activities = data.activities || [];
          Object.values(markers).forEach(m => m.remove());
          markers = {};

          activities.forEach(a => {
            const el = document.createElement('div');
            el.className = 'custom-marker';
            el.id = 'marker-' + a.id;
            el.onclick = () => {
              if (selectedMarkerId) {
                const prev = document.getElementById('marker-' + selectedMarkerId);
                if (prev) prev.classList.remove('selected');
              }
              el.classList.add('selected');
              selectedMarkerId = a.id;
              sendMessage('markerClicked', { activity: a });
            };
            markers[a.id] = new maplibregl.Marker({ element: el })
              .setLngLat([a.longitude, a.latitude])
              .addTo(map);
          });

          if (data.userLocation) {
            if (userMarker) userMarker.remove();
            const userEl = document.createElement('div');
            userEl.className = 'user-marker';
            userMarker = new maplibregl.Marker({ element: userEl })
              .setLngLat([data.userLocation.longitude, data.userLocation.latitude])
              .addTo(map);
          }

          if (data.shouldCenter !== false) {
            if (data.userLocation) {
              map.setCenter([data.userLocation.longitude, data.userLocation.latitude]);
            } else if (activities.length > 0) {
              map.setCenter([activities[0].longitude, activities[0].latitude]);
            }
          }
        } else if (data.type === 'deselectMarker' && selectedMarkerId) {
          const m = document.getElementById('marker-' + selectedMarkerId);
          if (m) m.classList.remove('selected');
          selectedMarkerId = null;
        } else if (data.type === 'centerOnUser') {
          map.flyTo({ center: [data.longitude, data.latitude], zoom: 15, duration: 1000 });
        } else if (data.type === 'centerOnActivity') {
          map.flyTo({ center: [data.longitude, data.latitude], zoom: 15, duration: 1000 });
        }
      } catch(e) { console.error(e); }
    }
    document.addEventListener('message', handleMessage);
    window.addEventListener('message', handleMessage);
  </script>
</body>
</html>`, []);

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

  const renderSelectedActivity = () => {
    if (!selectedActivity) return null;
    const isFull = selectedActivity.participants >= selectedActivity.max_participants;
    return (
      <Animated.View entering={FadeInDown} exiting={FadeOutDown} style={styles.activityDetail}>
        <View style={styles.dragHandleArea} {...panResponder.panHandlers}>
  <View style={styles.dragHandle} />
</View>
       <ScrollView
  showsVerticalScrollIndicator={false}
  nestedScrollEnabled
  contentContainerStyle={{
    paddingBottom: detailFooterHeight + insets.bottom+tabBarHeight+20,
  }}
>
          <Image source={{ uri: selectedActivity.image_url || 'https://via.placeholder.com/400' }} style={styles.detailImage} />
          <View style={styles.detailContent}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>{selectedActivity.nom}</Text>
              <View style={[styles.detailBadge, isFull && styles.detailFullBadge]}>
                <Text style={styles.detailBadgeText}>{selectedActivity.categorie}</Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <IconSymbol name="calendar" size={18} color={colors.textSecondary} />
              <Text style={styles.detailText}>{selectedActivity.date}</Text>
            </View>
            <View style={styles.detailRow}>
              <IconSymbol name="location.fill" size={18} color={colors.textSecondary} />
              <Text style={styles.detailText}>{selectedActivity.adresse}</Text>
            </View>
            <View style={styles.detailRow}>
              <IconSymbol name="person.2.fill" size={18} color={colors.textSecondary} />
              <Text style={styles.detailText}>
                {selectedActivity.participants}/{selectedActivity.max_participants} participants
                {isFull && ' (Complet)'}
              </Text>
            </View>
            <View onLayout={e => setDetailFooterHeight(e.nativeEvent.layout.height)}>
  <TouchableOpacity
    style={styles.viewDetailButton}
    onPress={() => { closeActivity(); router.push(`/activity-detail?id=${selectedActivity.id}`); }}
  >
    <Text style={styles.viewDetailButtonText}>Voir les détails complets</Text>
    <IconSymbol name="arrow.right" size={20} color="#FFFFFF" />
  </TouchableOpacity>
</View>
</View>

        </ScrollView>
        <TouchableOpacity
  style={styles.closeButton}
  onPress={closeActivity}
>

          <IconSymbol name="xmark" size={20} color={colors.text} />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <LinearGradient
        colors={['#60A5FA', '#818CF8', '#C084FC']}
        style={styles.container}
      >
        <SafeAreaView style={styles.loadingContainer} edges={['top']}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Chargement des activités...</Text>
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
          <Text style={styles.headerTitle}>Découvrir</Text>
          <View style={styles.headerActions}>
            <View style={styles.toggleContainer}>
              <TouchableOpacity style={[styles.toggleButton, viewMode === 'liste' && styles.toggleButtonActive]} onPress={() => setViewMode('liste')}>
                <IconSymbol name="list.bullet" size={20} color={viewMode === 'liste' ? '#FFFFFF' : 'rgba(255,255,255,0.7)'} />
                <Text style={[styles.toggleText, viewMode === 'liste' && styles.toggleTextActive]}>Liste</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toggleButton, viewMode === 'maps' && styles.toggleButtonActive]} onPress={() => setViewMode('maps')}>
                <IconSymbol name="map.fill" size={20} color={viewMode === 'maps' ? '#FFFFFF' : 'rgba(255,255,255,0.7)'} />
                <Text style={[styles.toggleText, viewMode === 'maps' && styles.toggleTextActive]}>Maps</Text>
              </TouchableOpacity>
            </View>
            {isBusiness && (
              <TouchableOpacity onPress={() => router.push('/create-activity')} style={styles.createButton}>
                <IconSymbol name="plus" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {viewMode === 'liste' ? (
          <>
            <View style={styles.searchRow}>
              <View style={styles.searchContainer}>
                <IconSymbol name="magnifyingglass" size={20} color="rgba(255,255,255,0.9)" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Rechercher des activités..."
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
              <TouchableOpacity
                style={[styles.filterButton, activeFiltersCount > 0 && styles.filterButtonActive]}
                onPress={() => {
                  setTempFilters(filters);
                  setShowFilters(true);
                }}
              >
                <IconSymbol name="line.3.horizontal.decrease.circle" size={22} color={activeFiltersCount > 0 ? '#FFFFFF' : 'rgba(255,255,255,0.9)'} />
                {activeFiltersCount > 0 && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={[styles.contentContainer, Platform.OS !== 'ios' && styles.contentContainerWithTabBar]}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#FFFFFF" />}
            >
              {filteredActivities.length > 0 ? (
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
              ) : (
                <View style={styles.emptyState}>
                  <IconSymbol name="calendar" size={64} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.emptyText}>Aucune activité trouvée</Text>
                  <Text style={styles.emptySubtext}>{searchQuery ? 'Essayez une autre recherche' : 'Créez la première activité !'}</Text>
                </View>
              )}
            </ScrollView>
          </>
        ) : (
          <View style={styles.mapContainer}>
            <WebView
              ref={webViewRef}
              source={{ html: mapHTML }}
              style={styles.map}
              onMessage={handleWebViewMessage}
              onLoadEnd={() => {
                if (activities.length > 0) {
                  sendActivitiesToMap(activities, !hasCenteredOnActivity.current);
                }
              }}
              javaScriptEnabled
              domStorageEnabled
              scrollEnabled={false}
              bounces={false}
            />
            {userLocation && (
              <TouchableOpacity style={styles.locationButton} onPress={centerOnUser}>
                <IconSymbol name="location.fill" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            {renderSelectedActivity()}
          </View>
        )}

        {/* Modal de filtres */}
        <Modal
          visible={showFilters}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowFilters(false)}
        >
          <View style={styles.filterModalOverlay}>
            <View style={styles.filterModalContent}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>Filtres</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <IconSymbol name="xmark" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.filterScrollView} showsVerticalScrollIndicator={false}>
              {/* Filtre par catégorie */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Catégories</Text>
                <View style={styles.categoryGrid}>
                  {PREDEFINED_CATEGORIES.map((cat) => {
                    const isSelected = tempFilters.categories.includes(cat.name);
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[styles.categoryChip, isSelected && { backgroundColor: cat.color }]}
                        onPress={() => {
                          setTempFilters(prev => ({
                            ...prev,
                            categories: isSelected
                              ? prev.categories.filter(c => c !== cat.name)
                              : [...prev.categories, cat.name]
                          }));
                        }}
                      >
                        <IconSymbol name={cat.icon} size={16} color={isSelected ? '#FFFFFF' : cat.color} />
                        <Text style={[styles.categoryChipText, isSelected && { color: '#FFFFFF' }]}>
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Filtre par distance */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Distance maximum</Text>
                <View style={styles.distanceOptions}>
                  {[null, 5, 10, 20, 50].map((distance) => (
                    <TouchableOpacity
                      key={distance ?? 'all'}
                      style={[
                        styles.distanceChip,
                        tempFilters.maxDistance === distance && styles.distanceChipActive
                      ]}
                      onPress={() => setTempFilters(prev => ({ ...prev, maxDistance: distance }))}
                    >
                      <Text style={[
                        styles.distanceChipText,
                        tempFilters.maxDistance === distance && styles.distanceChipTextActive
                      ]}>
                        {distance === null ? 'Tous' : `${distance} km`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {!userLocation && tempFilters.maxDistance !== null && (
                  <Text style={styles.filterWarning}>
                    Activez la localisation pour utiliser ce filtre
                  </Text>
                )}
              </View>

              {/* Filtre par prix */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Prix</Text>
                <View style={styles.priceRow}>
                  <View style={styles.priceInputContainer}>
                    <Text style={styles.priceLabel}>Min</Text>
                    <TextInput
                      style={styles.priceInput}
                      placeholder="0"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                      value={tempFilters.minPrice?.toString() ?? ''}
                      onChangeText={(text) => {
                        const num = parseInt(text, 10);
                        setTempFilters(prev => ({
                          ...prev,
                          minPrice: isNaN(num) ? null : num
                        }));
                      }}
                    />
                    <Text style={styles.priceCurrency}>€</Text>
                  </View>
                  <Text style={styles.priceSeparator}>—</Text>
                  <View style={styles.priceInputContainer}>
                    <Text style={styles.priceLabel}>Max</Text>
                    <TextInput
                      style={styles.priceInput}
                      placeholder="∞"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                      value={tempFilters.maxPrice?.toString() ?? ''}
                      onChangeText={(text) => {
                        const num = parseInt(text, 10);
                        setTempFilters(prev => ({
                          ...prev,
                          maxPrice: isNaN(num) ? null : num
                        }));
                      }}
                    />
                    <Text style={styles.priceCurrency}>€</Text>
                  </View>
                </View>
                <View style={styles.quickPriceButtons}>
                  <TouchableOpacity
                    style={[styles.quickPriceBtn, tempFilters.maxPrice === 0 && styles.quickPriceBtnActive]}
                    onPress={() => setTempFilters(prev => ({ ...prev, minPrice: null, maxPrice: 0 }))}
                  >
                    <Text style={[styles.quickPriceBtnText, tempFilters.maxPrice === 0 && styles.quickPriceBtnTextActive]}>Gratuit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.quickPriceBtn, tempFilters.maxPrice === 20 && tempFilters.minPrice === null && styles.quickPriceBtnActive]}
                    onPress={() => setTempFilters(prev => ({ ...prev, minPrice: null, maxPrice: 20 }))}
                  >
                    <Text style={[styles.quickPriceBtnText, tempFilters.maxPrice === 20 && tempFilters.minPrice === null && styles.quickPriceBtnTextActive]}>≤ 20€</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.quickPriceBtn, tempFilters.maxPrice === 50 && tempFilters.minPrice === null && styles.quickPriceBtnActive]}
                    onPress={() => setTempFilters(prev => ({ ...prev, minPrice: null, maxPrice: 50 }))}
                  >
                    <Text style={[styles.quickPriceBtnText, tempFilters.maxPrice === 50 && tempFilters.minPrice === null && styles.quickPriceBtnTextActive]}>≤ 50€</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Filtre par date */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Date de l'activité</Text>
                <View style={styles.dateQuickButtons}>
                  <TouchableOpacity
                    style={[styles.dateQuickBtn, tempFilters.dateFrom === null && tempFilters.dateTo === null && styles.dateQuickBtnActive]}
                    onPress={() => setTempFilters(prev => ({ ...prev, dateFrom: null, dateTo: null }))}
                  >
                    <Text style={[styles.dateQuickBtnText, tempFilters.dateFrom === null && tempFilters.dateTo === null && styles.dateQuickBtnTextActive]}>Toutes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dateQuickBtn, tempFilters.dateFrom === new Date().toISOString().split('T')[0] && tempFilters.dateTo === new Date().toISOString().split('T')[0] && styles.dateQuickBtnActive]}
                    onPress={() => {
                      const today = new Date().toISOString().split('T')[0];
                      setTempFilters(prev => ({ ...prev, dateFrom: today, dateTo: today }));
                    }}
                  >
                    <Text style={[styles.dateQuickBtnText, tempFilters.dateFrom === new Date().toISOString().split('T')[0] && tempFilters.dateTo === new Date().toISOString().split('T')[0] && styles.dateQuickBtnTextActive]}>Aujourd'hui</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dateQuickBtn, (() => {
                      const today = new Date();
                      const weekEnd = new Date(today);
                      weekEnd.setDate(today.getDate() + 7);
                      return tempFilters.dateFrom === today.toISOString().split('T')[0] && tempFilters.dateTo === weekEnd.toISOString().split('T')[0];
                    })() && styles.dateQuickBtnActive]}
                    onPress={() => {
                      const today = new Date();
                      const weekEnd = new Date(today);
                      weekEnd.setDate(today.getDate() + 7);
                      setTempFilters(prev => ({
                        ...prev,
                        dateFrom: today.toISOString().split('T')[0],
                        dateTo: weekEnd.toISOString().split('T')[0]
                      }));
                    }}
                  >
                    <Text style={[styles.dateQuickBtnText, (() => {
                      const today = new Date();
                      const weekEnd = new Date(today);
                      weekEnd.setDate(today.getDate() + 7);
                      return tempFilters.dateFrom === today.toISOString().split('T')[0] && tempFilters.dateTo === weekEnd.toISOString().split('T')[0];
                    })() && styles.dateQuickBtnTextActive]}>7 jours</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dateQuickBtn, (() => {
                      const today = new Date();
                      const monthEnd = new Date(today);
                      monthEnd.setDate(today.getDate() + 30);
                      return tempFilters.dateFrom === today.toISOString().split('T')[0] && tempFilters.dateTo === monthEnd.toISOString().split('T')[0];
                    })() && styles.dateQuickBtnActive]}
                    onPress={() => {
                      const today = new Date();
                      const monthEnd = new Date(today);
                      monthEnd.setDate(today.getDate() + 30);
                      setTempFilters(prev => ({
                        ...prev,
                        dateFrom: today.toISOString().split('T')[0],
                        dateTo: monthEnd.toISOString().split('T')[0]
                      }));
                    }}
                  >
                    <Text style={[styles.dateQuickBtnText, (() => {
                      const today = new Date();
                      const monthEnd = new Date(today);
                      monthEnd.setDate(today.getDate() + 30);
                      return tempFilters.dateFrom === today.toISOString().split('T')[0] && tempFilters.dateTo === monthEnd.toISOString().split('T')[0];
                    })() && styles.dateQuickBtnTextActive]}>30 jours</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Filtre par places restantes */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Places restantes minimum</Text>
                <View style={styles.placesOptions}>
                  {[null, 1, 5, 10, 20].map((places) => (
                    <TouchableOpacity
                      key={places ?? 'all'}
                      style={[
                        styles.placesChip,
                        tempFilters.minRemainingPlaces === places && styles.placesChipActive
                      ]}
                      onPress={() => setTempFilters(prev => ({ ...prev, minRemainingPlaces: places }))}
                    >
                      <Text style={[
                        styles.placesChipText,
                        tempFilters.minRemainingPlaces === places && styles.placesChipTextActive
                      ]}>
                        {places === null ? 'Tous' : `≥ ${places}`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            {/* Boutons d'action */}
            <View style={styles.filterActions}>
              <TouchableOpacity
                style={styles.resetButton}
                onPress={() => setTempFilters(DEFAULT_FILTERS)}
              >
                <Text style={styles.resetButtonText}>Réinitialiser</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyButton}
                onPress={() => {
                  setFilters(tempFilters);
                  setShowFilters(false);
                }}
              >
                <Text style={styles.applyButtonText}>
                  Appliquer ({previewResultsCount} résultat{previewResultsCount > 1 ? 's' : ''})
                </Text>
              </TouchableOpacity>
            </View>
            </View>
          </View>
        </Modal>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 4,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  toggleButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  createButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 12,
    paddingHorizontal: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFFFFF',
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  filterButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  filterBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  scrollView: { 
    flex: 1 
  },
  contentContainer: { 
    paddingHorizontal: 20, 
    paddingBottom: 20 
  },
  contentContainerWithTabBar: { 
    paddingBottom: 100 
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  gridContainer: {
    flexDirection: 'column',
    gap: 12,
  },
  cardWrapper: {
    width: '100%',
  },

  // =====================================================
  // STYLES POUR LA VUE MAP
  // =====================================================
  mapContainer: { 
    flex: 1 
  },
  map: { 
    flex: 1 
  },
  locationButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  activityDetail: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '60%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  dragHandle: { 
    width: 40, 
    height: 4, 
    backgroundColor: colors.border, 
    borderRadius: 2, 
    alignSelf: 'center', 
    marginTop: 12 
  },
  detailImage: { 
    width: '100%', 
    height: 150 
  },
  detailContent: { 
    padding: 20, 
    gap: 12 
  },
  detailHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start' 
  },
  detailTitle: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: colors.text, 
    flex: 1 
  },
  detailBadge: { 
    backgroundColor: colors.primary + '20', 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 8 
  },
  detailFullBadge: { 
    backgroundColor: '#FF6B6B20' 
  },
  detailBadgeText: { 
    fontSize: 12, 
    fontWeight: '600', 
    color: colors.primary 
  },
  detailRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10 
  },
  detailText: { 
    fontSize: 15, 
    color: colors.textSecondary, 
    flex: 1 
  },
  detailDivider: { 
    height: 1, 
    backgroundColor: colors.border, 
    marginVertical: 8 
  },
  viewDetailButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: colors.primary, 
    paddingVertical: 14, 
    borderRadius: 12, 
    gap: 8 
  },
  dragHandleArea: {
  paddingTop: 12,
  paddingBottom: 8,
  alignItems: 'center',
},
  viewDetailButtonText: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#FFFFFF' 
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center'
  },

  // =====================================================
  // STYLES POUR LE MODAL DE FILTRES
  // =====================================================
  filterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  filterModalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  filterScrollView: {
    maxHeight: 500,
  },
  filterSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.card,
    gap: 8,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  distanceOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  distanceChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.card,
  },
  distanceChipActive: {
    backgroundColor: colors.primary,
  },
  distanceChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  distanceChipTextActive: {
    color: colors.background,
  },
  filterWarning: {
    marginTop: 10,
    fontSize: 12,
    color: colors.accent,
    fontStyle: 'italic',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  priceInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
    gap: 8,
  },
  priceLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  priceInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    paddingVertical: 10,
    textAlign: 'center',
  },
  priceCurrency: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  priceSeparator: {
    fontSize: 16,
    color: colors.textSecondary,
    marginHorizontal: 12,
  },
  quickPriceButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  quickPriceBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  quickPriceBtnActive: {
    backgroundColor: colors.primary,
  },
  quickPriceBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  quickPriceBtnTextActive: {
    color: colors.background,
  },
  dateQuickButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  dateQuickBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.card,
  },
  dateQuickBtnActive: {
    backgroundColor: colors.primary,
  },
  dateQuickBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  dateQuickBtnTextActive: {
    color: colors.background,
  },
  placesOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  placesChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.card,
  },
  placesChipActive: {
    backgroundColor: colors.primary,
  },
  placesChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  placesChipTextActive: {
    color: colors.background,
  },
  filterActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  resetButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  applyButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
});