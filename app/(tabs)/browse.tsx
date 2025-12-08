// app/(tabs)/browse.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { WebView } from 'react-native-webview';
import { activityService } from '@/services/activity.service';
import * as Location from 'expo-location';

const PROTOMAPS_KEY = process.env.EXPO_PUBLIC_PROTOMAPS_KEY || '';


type ViewMode = 'liste' | 'maps';

interface Activity {
  id: string;
  nom: string;
  titre?: string;
  description: string;
  categorie: string;
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

export default function BrowseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('liste');
  const [selectedActivity, setSelectedActivity] = useState<SelectedActivity | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const webViewRef = useRef<WebView>(null);
  const hasHandledParams = useRef(false);
  const hasCenteredOnActivity = useRef(false);
  
  // Obtenir la position utilisateur
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

  // Gérer les paramètres de navigation
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
    return () => { hasHandledParams.current = false; 
                    hasCenteredOnActivity.current = false; // ← Ajouter
    };
  }, []);

  // Charger les activités
  const loadActivities = async () => {
    try {
      const result = await activityService.getActivities();
      if (result.success && result.data) {
        setActivities(result.data);
        if (viewMode === 'maps' && result.data.length > 0) {
          setTimeout(() => sendActivitiesToMap(result.data), 1000);
        }
      }
    } catch (error) {
      console.error('Erreur chargement activités:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadActivities(); }, []);

  
  useEffect(() => {
    if (viewMode === 'maps' && activities.length > 0 && !params.selectedActivityId) {
      // Si on n’a pas encore centré sur une activité spécifique,
      // on laisse shouldCenter décider si on recadre ou pas
      sendActivitiesToMap(activities, !hasCenteredOnActivity.current);
    }
  }, [viewMode, activities, params.selectedActivityId]);


  const handleRefresh = () => {
    setRefreshing(true);
    loadActivities();
  };

 const sendActivitiesToMap = (activitiesData: Activity[], shouldCenter: boolean = true) => {
  if (webViewRef.current) {
    const activitiesWithCoords = activitiesData.filter(a => a.latitude && a.longitude);
    webViewRef.current.postMessage(JSON.stringify({
      type: 'loadActivities',
      activities: activitiesWithCoords.map(a => ({
        id: a.id, nom: a.nom, categorie: a.categorie, date: a.date,
        adresse: a.adresse, latitude: a.latitude, longitude: a.longitude,
        participants: a.participants || 0, max_participants: a.max_participants,
        image_url: a.image_url,
      })),
      userLocation, // ← Toujours envoyer userLocation (pour afficher le point bleu)
      shouldCenter, // ← Ce flag contrôle seulement si on doit centrer
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

  const filteredActivities = activities.filter(activity =>
    activity.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
    activity.categorie.toLowerCase().includes(searchQuery.toLowerCase()) ||
    activity.ville?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      transition: all 0.3s ease;
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
      center: [2.3522, 48.8566], // centre fixe au départ
      zoom: 13
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    function sendMessage(type, data) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...data }));
      }
    }

    function createMarker(activity) {
      const el = document.createElement('div');
      el.className = 'custom-marker';
      el.id = 'marker-' + activity.id;
      el.addEventListener('click', () => {
        if (selectedMarkerId && selectedMarkerId !== activity.id) {
          const old = document.getElementById('marker-' + selectedMarkerId);
          if (old) old.classList.remove('selected');
        }
        el.classList.add('selected');
        selectedMarkerId = activity.id;
        map.flyTo({ center: [activity.longitude, activity.latitude], zoom: 15, duration: 1000 });
        sendMessage('markerClicked', { activity });
      });
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([activity.longitude, activity.latitude]).addTo(map);
      markers[activity.id] = { element: el, marker };
    }

    function createUserMarker(lat, lng) {
      if (userMarker) userMarker.remove();
      const el = document.createElement('div');
      el.className = 'user-marker';
      userMarker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
    }

    function handleMessage(event) {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'loadActivities') {
          const activities = data.activities || [];
          Object.values(markers).forEach(m => m.marker.remove());
          markers = {};
          activities.forEach(a => { if (a.longitude && a.latitude) createMarker(a); });
          if (data.userLocation) createUserMarker(data.userLocation.latitude, data.userLocation.longitude);
          
          if (data.shouldCenter && !selectedMarkerId) {
            if (data.userLocation) {
              map.flyTo({ center: [data.userLocation.longitude, data.userLocation.latitude], zoom: 13, duration: 1000 });
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


  const renderActivityCard = (activity: Activity, index: number) => (
    <TouchableOpacity
      key={activity.id}
      style={styles.activityCard}
      onPress={() => router.push(`/activity-detail?id=${activity.id}`)}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: activity.image_url || 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400' }}
        style={styles.activityImage}
      />
      <View style={styles.activityOverlay}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{activity.categorie}</Text>
        </View>
        <View style={styles.activityInfo}>
          <Text style={styles.activityTitle} numberOfLines={2}>{activity.nom}</Text>
          <View style={styles.activityMeta}>
            <View style={styles.metaRow}>
              <IconSymbol name="calendar" size={14} color={colors.background} />
              <Text style={styles.metaText}>{activity.date}</Text>
            </View>
            <View style={styles.metaRow}>
              <IconSymbol name="location.fill" size={14} color={colors.background} />
              <Text style={styles.metaText}>{activity.ville}</Text>
            </View>
          </View>
          <View style={styles.participantsRow}>
            <IconSymbol name="person.2.fill" size={14} color={colors.background} />
            <Text style={styles.participantsText}>
              {activity.participants || 0}/{activity.max_participants}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderSelectedActivity = () => {
    if (!selectedActivity) return null;
    const isFull = selectedActivity.participants >= selectedActivity.max_participants;
    return (
      <Animated.View entering={FadeInDown} exiting={FadeOutDown} style={styles.activityDetail} {...panResponder.panHandlers}>
        <View style={styles.dragHandle} />
        <ScrollView showsVerticalScrollIndicator={false}>
          <Image source={{ uri: selectedActivity.image_url || 'https://via.placeholder.com/400' }} style={styles.detailImage} />
          <View style={styles.detailContent}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>{selectedActivity.nom}</Text>
              <View style={[styles.detailBadge, isFull && styles.fullBadge]}>
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
            <View style={styles.detailDivider} />
            <TouchableOpacity style={styles.viewDetailButton} onPress={() => { closeActivity(); router.push(`/activity-detail?id=${selectedActivity.id}`); }}>
              <Text style={styles.viewDetailButtonText}>Voir les détails complets</Text>
              <IconSymbol name="arrow.right" size={20} color={colors.background} />
            </TouchableOpacity>
          </View>
        </ScrollView>
        <TouchableOpacity style={styles.closeButton} onPress={closeActivity}>
          <IconSymbol name="xmark" size={20} color={colors.text} />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={commonStyles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement des activités...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Découvrir</Text>
        <View style={styles.headerActions}>
          <View style={styles.toggleContainer}>
            <TouchableOpacity style={[styles.toggleButton, viewMode === 'liste' && styles.toggleButtonActive]} onPress={() => setViewMode('liste')}>
              <IconSymbol name="list.bullet" size={20} color={viewMode === 'liste' ? colors.background : colors.textSecondary} />
              <Text style={[styles.toggleText, viewMode === 'liste' && styles.toggleTextActive]}>Liste</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleButton, viewMode === 'maps' && styles.toggleButtonActive]} onPress={() => setViewMode('maps')}>
              <IconSymbol name="map.fill" size={20} color={viewMode === 'maps' ? colors.background : colors.textSecondary} />
              <Text style={[styles.toggleText, viewMode === 'maps' && styles.toggleTextActive]}>Maps</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => router.push('/create-activity')} style={styles.createButton}>
            <IconSymbol name="plus" size={24} color={colors.background} />
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === 'liste' ? (
        <>
          <View style={styles.searchContainer}>
            <IconSymbol name="magnifyingglass" size={20} color={colors.textSecondary} />
            <TextInput style={styles.searchInput} placeholder="Rechercher des activités..." placeholderTextColor={colors.textSecondary} value={searchQuery} onChangeText={setSearchQuery} />
          </View>
          <ScrollView style={styles.scrollView} contentContainerStyle={[styles.contentContainer, Platform.OS !== 'ios' && styles.contentContainerWithTabBar]} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}>
            {filteredActivities.length > 0 ? filteredActivities.map((a, i) => renderActivityCard(a, i)) : (
              <View style={styles.emptyState}>
                <IconSymbol name="calendar" size={64} color={colors.textSecondary} />
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
    // La carte vient de (re)charger → on renvoie les activités
    if (activities.length > 0) {
      sendActivitiesToMap(activities, !hasCenteredOnActivity.current);
    }
  }}
  javaScriptEnabled
  domStorageEnabled
  scrollEnabled={false}
  bounces={false}
/>{userLocation && (
            <TouchableOpacity style={styles.locationButton} onPress={centerOnUser}>
              <IconSymbol name="location.fill" size={22} color={colors.primary} />
            </TouchableOpacity>
          )}
          {renderSelectedActivity()}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontSize: 28, fontWeight: '700', color: colors.text },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleContainer: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 12, padding: 4 },
  toggleButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 6 },
  toggleButtonActive: { backgroundColor: colors.primary },
  toggleText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  toggleTextActive: { color: colors.background },
  createButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, marginHorizontal: 20, marginBottom: 16, paddingHorizontal: 16, gap: 12 },
  searchInput: { flex: 1, paddingVertical: 14, fontSize: 16, color: colors.text },
  scrollView: { flex: 1 },
  contentContainer: { paddingHorizontal: 20, paddingBottom: 20 },
  contentContainerWithTabBar: { paddingBottom: 100 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 16, color: colors.textSecondary },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 20, fontWeight: '600', color: colors.text, marginTop: 16 },
  emptySubtext: { fontSize: 16, color: colors.textSecondary, textAlign: 'center' },
  activityCard: { height: 200, borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  activityImage: { width: '100%', height: '100%' },
  activityOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', padding: 16, justifyContent: 'space-between' },
  categoryBadge: { alignSelf: 'flex-start', backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  categoryText: { color: colors.background, fontSize: 12, fontWeight: '600' },
  activityInfo: { gap: 8 },
  activityTitle: { fontSize: 20, fontWeight: '700', color: colors.background },
  activityMeta: { flexDirection: 'row', gap: 16 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 13, color: colors.background },
  participantsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  participantsText: { fontSize: 13, color: colors.background, fontWeight: '600' },
  mapContainer: { flex: 1 },
  map: { flex: 1 },
  locationButton: { position: 'absolute', top: 16, right: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  activityDetail: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '60%', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8 },
  dragHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  detailImage: { width: '100%', height: 150 },
  detailContent: { padding: 20, gap: 12 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  detailTitle: { fontSize: 20, fontWeight: '700', color: colors.text, flex: 1 },
  detailBadge: { backgroundColor: colors.primary + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  fullBadge: { backgroundColor: '#FF6B6B20' },
  detailBadgeText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailText: { fontSize: 15, color: colors.textSecondary, flex: 1 },
  detailDivider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  viewDetailButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 12, gap: 8 },
  viewDetailButtonText: { fontSize: 16, fontWeight: '600', color: colors.background },
  closeButton: { position: 'absolute', top: 20, right: 20, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' },
});