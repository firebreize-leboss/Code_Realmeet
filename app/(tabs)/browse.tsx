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
import { PREDEFINED_CATEGORIES } from '@/constants/categories';
import { useDataCache } from '@/contexts/DataCacheContext';
import ActivityCard from '@/components/ActivityCard';
import { useMapView } from '@/contexts/MapViewContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/FloatingTabBar';


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
  allDates?: string[];
  totalParticipants?: number;
  totalMaxPlaces?: number;
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
  const { setIsMapViewActive } = useMapView();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('liste');

  // Notifier le contexte quand le mode de vue change
  useEffect(() => {
    setIsMapViewActive(viewMode === 'maps');
  }, [viewMode, setIsMapViewActive]);
  const [selectedActivity, setSelectedActivity] = useState<SelectedActivity | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const webViewRef = useRef<WebView>(null);
  const hasHandledParams = useRef(false);
  const hasCenteredOnActivity = useRef(false);
  const isFirstFocus = useRef(true);
  const hasAnimated = useRef(false);
  const refreshDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLatestSlotDateByActivity = useRef<Record<string, string | null>>({});
  const [isBusiness, setIsBusiness] = useState(false);

  // Utiliser les données du cache
  const activities = cache.activities;
  const latestSlotDateByActivity = useMemo(() => {
    const newValue = Object.fromEntries(
      Object.entries(cache.slotDataByActivity).map(([id, data]) => [id, data.latestDate])
    );
    // Comparaison profonde pour éviter les re-renders inutiles sur iOS
    if (JSON.stringify(newValue) === JSON.stringify(lastLatestSlotDateByActivity.current)) {
      return lastLatestSlotDateByActivity.current;
    }
    lastLatestSlotDateByActivity.current = newValue;
    return newValue;
  }, [cache.slotDataByActivity]);
  const slotCountByActivity = useMemo(() => Object.fromEntries(
    Object.entries(cache.slotDataByActivity).map(([id, data]) => [id, data.slotCount])
  ), [cache.slotDataByActivity]);
  const remainingPlacesByActivity = useMemo(() => Object.fromEntries(
    Object.entries(cache.slotDataByActivity).map(([id, data]) => [id, data.remainingPlaces])
  ), [cache.slotDataByActivity]);
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
      // Debounce de 500ms pour éviter les appels multiples rapides sur iOS
      if (refreshDebounceTimer.current) {
        clearTimeout(refreshDebounceTimer.current);
      }
      refreshDebounceTimer.current = setTimeout(() => {
        refreshActivities();
      }, 500);
      return () => {
        if (refreshDebounceTimer.current) {
          clearTimeout(refreshDebounceTimer.current);
        }
      };
    }, [refreshActivities])
  );


  useEffect(() => {
    console.log('[SCROLL DEBUG] useEffect params triggered', {
      hasHandledParams: hasHandledParams.current,
      activitiesLength: activities.length,
      viewMode: params.viewMode,
      selectedActivityId: params.selectedActivityId,
    });

    if (hasHandledParams.current) {
      console.log('[SCROLL DEBUG] Already handled params, returning');
      return;
    }
    if (activities.length === 0) {
      console.log('[SCROLL DEBUG] No activities, returning');
      return;
    }

    if (params.viewMode === 'maps') {
      console.log('[SCROLL DEBUG] Setting viewMode to maps');
      setViewMode('maps');
    }

    if (params.selectedActivityId) {
      console.log('[SCROLL DEBUG] Looking for activity with id:', params.selectedActivityId);
      const activity = activities.find(a => a.id === params.selectedActivityId);
      console.log('[SCROLL DEBUG] Found activity:', activity ? { id: activity.id, nom: activity.nom, lat: activity.latitude, lng: activity.longitude } : 'NOT FOUND');

      if (activity && activity.latitude && activity.longitude) {
        hasHandledParams.current = true;
        hasCenteredOnActivity.current = true;
        console.log('[SCROLL DEBUG] Setting timeout to center on activity');
        setTimeout(() => {
          console.log('[SCROLL DEBUG] Inside timeout, webViewRef.current:', !!webViewRef.current);
          if (webViewRef.current) {
            const message = JSON.stringify({
              type: 'centerOnActivity',
              activityId: activity.id,
              latitude: activity.latitude,
              longitude: activity.longitude,
            });
            console.log('[SCROLL DEBUG] Posting message to WebView:', message);
            webViewRef.current.postMessage(message);
          }
          console.log('[SCROLL DEBUG] Setting selectedActivity');
          const slotData = cache.slotDataByActivity[activity.id];
          setSelectedActivity({
            id: activity.id,
            nom: activity.nom,
            categorie: activity.categorie,
            date: slotData?.latestDate || activity.date,
            adresse: activity.adresse,
            participants: activity.participants || 0,
            max_participants: activity.max_participants,
            image_url: activity.image_url,
            latitude: activity.latitude,
            longitude: activity.longitude,
            allDates: slotData?.allDates || [],
            totalParticipants: slotData ? (slotData.totalMaxPlaces - slotData.remainingPlaces) : activity.participants,
            totalMaxPlaces: slotData?.totalMaxPlaces || activity.max_participants,
          });
          console.log('[SCROLL DEBUG] selectedActivity set successfully');
        }, 1500);
      } else {
        console.log('[SCROLL DEBUG] Activity not found or missing coordinates');
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

  // Mettre à jour la carte avec les activités filtrées
  useEffect(() => {
    if (viewMode === 'maps' && !params.selectedActivityId) {
      // Toujours envoyer les activités filtrées, pas toutes les activités
      const shouldCenter = !hasCenteredOnActivity.current && filteredActivities.length > 0;
      sendActivitiesToMap(filteredActivities, latestSlotDateByActivity, shouldCenter);
      if (shouldCenter) {
        hasCenteredOnActivity.current = true;
      }
    }
  }, [filteredActivities, viewMode, params.selectedActivityId]);

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
    console.log('[SCROLL DEBUG] sendActivitiesToMap called', {
      activitiesCount: activitiesData.length,
      shouldCenter,
      webViewRefExists: !!webViewRef.current,
    });

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
    console.log('[SCROLL DEBUG] closeActivity called');
    setSelectedActivity(null);
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({ type: 'deselectMarker' }));
    }
  };


  const handleWebViewMessage = (event: any) => {
    console.log('[SCROLL DEBUG] handleWebViewMessage received:', event.nativeEvent.data);
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('[SCROLL DEBUG] Parsed message data:', data);
      if (data.type === 'markerClicked') {
        // Guard pour éviter les appels redondants sur iOS
        if (selectedActivity?.id === data.activity.id) return;
        console.log('[SCROLL DEBUG] markerClicked - setting selectedActivity:', data.activity);
        const slotData = cache.slotDataByActivity[data.activity.id];
        setSelectedActivity({
          ...data.activity,
          allDates: slotData?.allDates || [],
          totalParticipants: slotData ? (slotData.totalMaxPlaces - slotData.remainingPlaces) : data.activity.participants,
          totalMaxPlaces: slotData?.totalMaxPlaces || data.activity.max_participants,
        });
      }
    } catch (e) {
      console.error('[SCROLL DEBUG] Error parsing message:', e);
    }
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
      width: 28px; height: 28px;
      background: #F2994A;
      border: 3px solid white; border-radius: 50%; cursor: pointer;
      box-shadow: 0 2px 6px rgba(242, 153, 74, 0.35);
    }
    .custom-marker.selected {
      background: #D97B2F;
      box-shadow: 0 3px 10px rgba(217, 123, 47, 0.45);
      border-width: 4px;
      transform: scale(1.15);
    }
    .user-marker {
      width: 16px; height: 16px; background: #48484A;
      border: 3px solid white; border-radius: 50%;
      box-shadow: 0 0 0 5px rgba(72, 72, 74, 0.2);
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
      console.log('[MAP DEBUG] handleMessage received:', event.data);
      try {
        const data = JSON.parse(event.data);
        console.log('[MAP DEBUG] Parsed data type:', data.type);

        if (data.type === 'updateUserLocation') {
          console.log('[MAP DEBUG] Updating user location');
          if (userMarker) userMarker.remove();
          const userEl = document.createElement('div');
          userEl.className = 'user-marker';
          userMarker = new maplibregl.Marker({ element: userEl, anchor: 'center' })
            .setLngLat([data.userLocation.longitude, data.userLocation.latitude])
            .addTo(map);
        }

        if (data.type === 'loadActivities') {
          const activities = data.activities || [];
          console.log('[MAP DEBUG] loadActivities - count:', activities.length);
          Object.values(markers).forEach(m => m.remove());
          markers = {};

          activities.forEach(a => {
            const el = document.createElement('div');
            el.className = 'custom-marker';
            el.id = 'marker-' + a.id;
            el.onclick = () => {
              console.log('[MAP DEBUG] Marker clicked:', a.id, a.nom);
              if (selectedMarkerId) {
                const prev = document.getElementById('marker-' + selectedMarkerId);
                if (prev) prev.classList.remove('selected');
              }
              el.classList.add('selected');
              selectedMarkerId = a.id;
              sendMessage('markerClicked', { activity: a });
            };
            markers[a.id] = new maplibregl.Marker({ element: el, anchor: 'center' })
              .setLngLat([a.longitude, a.latitude])
              .addTo(map);
          });
          console.log('[MAP DEBUG] Created', Object.keys(markers).length, 'markers');

          if (data.userLocation) {
            if (userMarker) userMarker.remove();
            const userEl = document.createElement('div');
            userEl.className = 'user-marker';
            userMarker = new maplibregl.Marker({ element: userEl, anchor: 'center' })
              .setLngLat([data.userLocation.longitude, data.userLocation.latitude])
              .addTo(map);
          }

          if (data.shouldCenter !== false) {
            if (data.userLocation) {
              console.log('[MAP DEBUG] Centering on user location');
              map.setCenter([data.userLocation.longitude, data.userLocation.latitude]);
            } else if (activities.length > 0) {
              console.log('[MAP DEBUG] Centering on first activity');
              map.setCenter([activities[0].longitude, activities[0].latitude]);
            }
          }
        } else if (data.type === 'deselectMarker' && selectedMarkerId) {
          console.log('[MAP DEBUG] Deselecting marker:', selectedMarkerId);
          const m = document.getElementById('marker-' + selectedMarkerId);
          if (m) m.classList.remove('selected');
          selectedMarkerId = null;
        } else if (data.type === 'centerOnUser') {
          console.log('[MAP DEBUG] centerOnUser:', data.longitude, data.latitude);
          map.flyTo({ center: [data.longitude, data.latitude], zoom: 15, duration: 1000 });
        } else if (data.type === 'centerOnActivity') {
          console.log('[MAP DEBUG] centerOnActivity:', data.activityId, data.longitude, data.latitude);
          map.flyTo({ center: [data.longitude, data.latitude], zoom: 15, duration: 1000 });
          // Sélectionner visuellement le marker
          if (data.activityId) {
            if (selectedMarkerId) {
              const prev = document.getElementById('marker-' + selectedMarkerId);
              if (prev) prev.classList.remove('selected');
            }
            const targetMarker = document.getElementById('marker-' + data.activityId);
            if (targetMarker) {
              console.log('[MAP DEBUG] Selecting marker visually:', data.activityId);
              targetMarker.classList.add('selected');
              selectedMarkerId = data.activityId;
            } else {
              console.log('[MAP DEBUG] Target marker not found:', data.activityId);
            }
          }
        }
      } catch(e) { console.error('[MAP DEBUG] Error:', e); }
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

  // Fonction pour formater une date courte
  const formatDateShort = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short'
    }).replace('.', '');
  };

  // Calculer la distance entre l'utilisateur et une activité
  const getDistanceText = (activityLat: number, activityLng: number) => {
    if (!userLocation) return null;
    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      activityLat,
      activityLng
    );
    if (distance < 1) {
      return `${Math.round(distance * 1000)} m`;
    }
    return `${distance.toFixed(1)} km`;
  };

  const renderSelectedActivity = () => {
    if (!selectedActivity) return null;

    const participants = selectedActivity.totalParticipants ?? selectedActivity.participants;
    const maxPlaces = selectedActivity.totalMaxPlaces ?? selectedActivity.max_participants;
    const isFull = participants >= maxPlaces;
    const distanceText = getDistanceText(selectedActivity.latitude, selectedActivity.longitude);
    const dates = selectedActivity.allDates?.slice(0, 3) || [];

    // Calculer le bottom dynamiquement: hauteur de la tab bar + safe area bottom + marge
    const activityPreviewBottom = FLOATING_TAB_BAR_HEIGHT + Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 0) + 16;

    return (
      <Animated.View entering={FadeInDown} exiting={FadeOutDown} style={[styles.activityPreview, { bottom: activityPreviewBottom }]}>
        <TouchableOpacity
          activeOpacity={0.95}
          onPress={() => { closeActivity(); router.push(`/activity-detail?id=${selectedActivity.id}`); }}
          style={styles.activityPreviewTouchable}
        >
          {/* Image */}
          <Image
            source={{ uri: selectedActivity.image_url || 'https://via.placeholder.com/400' }}
            style={styles.previewImage}
          />

          {/* Contenu */}
          <View style={styles.previewContent}>
            {/* Titre */}
            <Text style={styles.previewTitle} numberOfLines={1}>{selectedActivity.nom}</Text>

            {/* Distance */}
            {distanceText && (
              <View style={styles.previewDistanceRow}>
                <IconSymbol name="location.fill" size={14} color={colors.primary} />
                <Text style={styles.previewDistanceText}>{distanceText}</Text>
              </View>
            )}

            {/* Dates */}
            {dates.length > 0 ? (
              <View style={styles.previewDatesRow}>
                <IconSymbol name="calendar" size={14} color={colors.textTertiary} />
                <View style={styles.previewDateBubbles}>
                  {dates.map((dateStr, index) => (
                    <View key={index} style={styles.previewDateBubble}>
                      <Text style={styles.previewDateBubbleText}>{formatDateShort(dateStr)}</Text>
                    </View>
                  ))}
                  {selectedActivity.allDates && selectedActivity.allDates.length > 3 && (
                    <Text style={styles.previewMoreDates}>+{selectedActivity.allDates.length - 3}</Text>
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.previewDatesRow}>
                <IconSymbol name="calendar" size={14} color={colors.textTertiary} />
                <Text style={styles.previewSingleDate}>{selectedActivity.date || 'Date à définir'}</Text>
              </View>
            )}

            {/* Participants */}
            <View style={styles.previewParticipantsRow}>
              <IconSymbol name="person.2.fill" size={14} color={isFull ? colors.error : colors.textTertiary} />
              <Text style={[styles.previewParticipantsText, isFull && styles.previewParticipantsFull]}>
                {participants}/{maxPlaces} inscrits
              </Text>
              {isFull && (
                <View style={styles.previewFullBadge}>
                  <Text style={styles.previewFullBadgeText}>Complet</Text>
                </View>
              )}
            </View>
          </View>

          {/* Bouton fermer */}
          <TouchableOpacity
            style={styles.previewCloseButton}
            onPress={(e) => { e.stopPropagation(); closeActivity(); }}
          >
            <IconSymbol name="xmark" size={16} color={colors.textTertiary} />
          </TouchableOpacity>

          {/* Indicateur cliquable */}
          <View style={styles.previewArrow}>
            <IconSymbol name="chevron.right" size={20} color={colors.textTertiary} />
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.loadingContainer} edges={['top']}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement des activités...</Text>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Découvrir</Text>
            <View style={styles.headerTitleAccent} />
          </View>
          <View style={styles.headerActions}>
            <View style={styles.toggleContainer}>
              <TouchableOpacity style={[styles.toggleButton, viewMode === 'liste' && styles.toggleButtonActive]} onPress={() => setViewMode('liste')}>
                <IconSymbol name="list.bullet" size={16} color={viewMode === 'liste' ? colors.primary : colors.textMuted} />
                <Text style={[styles.toggleText, viewMode === 'liste' && styles.toggleTextActive]}>Liste</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toggleButton, viewMode === 'maps' && styles.toggleButtonActive]} onPress={() => setViewMode('maps')}>
                <IconSymbol name="map.fill" size={16} color={viewMode === 'maps' ? colors.primary : colors.textMuted} />
                <Text style={[styles.toggleText, viewMode === 'maps' && styles.toggleTextActive]}>Maps</Text>
              </TouchableOpacity>
            </View>
            {isBusiness && (
              <TouchableOpacity onPress={() => router.push('/create-activity')} style={styles.createButton}>
                <IconSymbol name="plus" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {viewMode === 'liste' ? (
          <>
            <View style={styles.searchRow}>
              <View style={styles.searchContainer}>
                <IconSymbol name="magnifyingglass" size={18} color={colors.textSecondary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Rechercher des activités..."
                  placeholderTextColor={colors.textTertiary}
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
                <IconSymbol name="line.3.horizontal.decrease.circle" size={20} color={activeFiltersCount > 0 ? colors.primary : colors.textTertiary} />
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
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
            >
              {filteredActivities.length > 0 ? (
                <View style={styles.gridContainer}>
                  {filteredActivities.map((activity, index) => (
                    <Animated.View
                      key={activity.id}
                      entering={hasAnimated.current ? undefined : FadeInDown.delay(index * 80).springify()}
                      style={styles.cardWrapper}
                    >
                      <ActivityCard
                        activity={mapActivityForCard(activity)}
                        variant="compact"
                      />
                    </Animated.View>
                  ))}
                  {!hasAnimated.current && (() => { hasAnimated.current = true; return null; })()}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <IconSymbol name="calendar" size={64} color={colors.primary} />
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
                console.log('[SCROLL DEBUG] WebView onLoadEnd triggered', {
                  filteredActivitiesCount: filteredActivities.length,
                  hasCenteredOnActivity: hasCenteredOnActivity.current,
                });
                if (filteredActivities.length > 0) {
                  const shouldCenter = !hasCenteredOnActivity.current;
                  console.log('[SCROLL DEBUG] Calling sendActivitiesToMap from onLoadEnd, shouldCenter:', shouldCenter);
                  sendActivitiesToMap(filteredActivities, latestSlotDateByActivity, shouldCenter);
                  if (shouldCenter) {
                    hasCenteredOnActivity.current = true;
                  }
                }
              }}
              javaScriptEnabled
              domStorageEnabled
              scrollEnabled={false}
              bounces={false}
            />
            {userLocation && (
              <TouchableOpacity style={styles.locationButton} onPress={centerOnUser}>
                <IconSymbol name="location.fill" size={20} color={colors.primary} />
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
    </View>
  );
}

// =====================================================
// STYLES PREMIUM - Design calme, cohérent, orange accent
// =====================================================
const styles = StyleSheet.create({
  // CONTAINER & LAYOUT
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },

  // HEADER - Premium avec micro-accent orange discret
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
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
  headerTitleAccent: {
    width: 24,
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: 1,
    marginTop: 4,
    opacity: 0.7,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  // TOGGLE LISTE/MAPS - Premium secondaire (fond blanc/gris très clair, contour léger)
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
    gap: 4,
  },
  toggleButtonActive: {
    backgroundColor: colors.borderSubtle,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Manrope_500Medium',
    color: colors.textMuted,
  },
  toggleTextActive: {
    color: colors.primary,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
  },
  toggleIconInactive: {
    opacity: 0.5,
  },

  // BOUTON CREATE - Seul élément CTA fort
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },

  // SEARCH & FILTERS - Champ de recherche plus actif/invitant
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 14,
    backgroundColor: colors.backgroundAlt,
    gap: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Manrope_400Regular',
    color: colors.text,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.borderSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: colors.primaryLight,
  },
  filterBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Manrope_700Bold',
  },

  // SCROLL & CONTENT
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },
  contentContainerWithTabBar: {
    paddingBottom: 100,
  },

  // LOADING & EMPTY
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: colors.textTertiary,
    fontWeight: '500',
    fontFamily: 'Manrope_500Medium',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 4,
  },

  // GRID
  gridContainer: {
    flexDirection: 'column',
    gap: 12,
  },
  cardWrapper: {
    width: '100%',
  },

  // MAP VIEW
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  locationButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.backgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },

  // ACTIVITY PREVIEW - Design premium calme
  activityPreview: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: colors.backgroundAlt,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    zIndex: 1001,
  },
  activityPreviewTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  previewImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: colors.borderSubtle,
  },
  previewContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
    gap: 3,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
    marginBottom: 2,
  },
  previewDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  previewDistanceText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: colors.primary,
  },
  previewDatesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  previewDateBubbles: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
    flex: 1,
  },
  previewDateBubble: {
    backgroundColor: colors.borderSubtle,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  previewDateBubbleText: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: colors.textSecondary,
  },
  previewMoreDates: {
    fontSize: 10,
    fontWeight: '500',
    fontFamily: 'Manrope_500Medium',
    color: colors.textMuted,
  },
  previewSingleDate: {
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
  },
  previewParticipantsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  previewParticipantsText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Manrope_500Medium',
    color: colors.textTertiary,
  },
  previewParticipantsFull: {
    color: colors.error,
  },
  previewFullBadge: {
    backgroundColor: colors.errorLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  previewFullBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'Manrope_700Bold',
    color: colors.error,
  },
  previewCloseButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.borderSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewArrow: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // FILTER MODAL - Design premium cohérent
  filterModalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  filterModalContent: {
    backgroundColor: colors.backgroundAlt,
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
    borderBottomColor: colors.borderLight,
  },
  filterModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
  },
  filterScrollView: {
    maxHeight: 500,
  },
  filterSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  filterSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
    marginBottom: 14,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.borderSubtle,
    gap: 6,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'Manrope_500Medium',
    color: colors.textSecondary,
  },
  distanceOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  distanceChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.borderSubtle,
  },
  distanceChipActive: {
    backgroundColor: colors.primaryLight,
  },
  distanceChipText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Manrope_500Medium',
    color: colors.textSecondary,
  },
  distanceChipTextActive: {
    color: colors.primary,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
  },
  filterWarning: {
    marginTop: 10,
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
    color: colors.primary,
    fontStyle: 'italic',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  priceInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.borderSubtle,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
    gap: 8,
  },
  priceLabel: {
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
  },
  priceInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
    paddingVertical: 10,
    textAlign: 'center',
  },
  priceCurrency: {
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'Manrope_500Medium',
    color: colors.textTertiary,
  },
  priceSeparator: {
    fontSize: 16,
    color: colors.textMuted,
    marginHorizontal: 12,
  },
  quickPriceButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  quickPriceBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.borderSubtle,
    alignItems: 'center',
  },
  quickPriceBtnActive: {
    backgroundColor: colors.primaryLight,
  },
  quickPriceBtnText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Manrope_500Medium',
    color: colors.textSecondary,
  },
  quickPriceBtnTextActive: {
    color: colors.primary,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
  },
  dateQuickButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateQuickBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.borderSubtle,
  },
  dateQuickBtnActive: {
    backgroundColor: colors.primaryLight,
  },
  dateQuickBtnText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Manrope_500Medium',
    color: colors.textSecondary,
  },
  dateQuickBtnTextActive: {
    color: colors.primary,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
  },
  placesOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  placesChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.borderSubtle,
  },
  placesChipActive: {
    backgroundColor: colors.primaryLight,
  },
  placesChipText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Manrope_500Medium',
    color: colors.textSecondary,
  },
  placesChipTextActive: {
    color: colors.primary,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
  },
  filterActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  resetButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.borderSubtle,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: colors.textSecondary,
  },
  applyButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: '#FFFFFF',
  },
});