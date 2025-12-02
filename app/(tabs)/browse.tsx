// app/(tabs)/browse.tsx
import React, { useState, useEffect, useRef } from 'react';
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

// Configuration Protomaps
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

export default function BrowseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('liste');
  const [selectedActivity, setSelectedActivity] = useState<SelectedActivity | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const hasHandledParams = useRef(false);

// ✅ Gérer les paramètres de navigation (SANS BOUCLE)

// ✅ DEBUG : Afficher les activités chargées
useEffect(() => {
  console.log('📦 Activités chargées:', activities.length);
  console.log('📦 Params:', params);
  activities.forEach(a => {
    console.log(`  - ${a.nom}: lat=${a.latitude}, lng=${a.longitude}`);
  });
}, [activities]);

// ✅ Gérer les paramètres de navigation (SANS BOUCLE)
useEffect(() => {
  console.log('🔄 useEffect déclenché - hasHandled:', hasHandledParams.current, 'activities:', activities.length);
  
  // Si on a déjà traité les paramètres OU si les activités ne sont pas encore chargées, ne rien faire
  if (hasHandledParams.current) {
    console.log('⏭️ Déjà traité, on skip');
    return;
  }
  
  if (activities.length === 0) {
    console.log('⏳ En attente du chargement des activités...');
    return;
  }
  
  if (params.viewMode === 'maps') {
    console.log('🗺️ Passage en mode carte');
    setViewMode('maps');
  }
  
  if (params.selectedActivityId) {
    console.log('🔍 Recherche de l\'activité:', params.selectedActivityId);
    const activity = activities.find(a => a.id === params.selectedActivityId);
    console.log('🔍 Activité trouvée:', activity?.nom);
    
    if (activity) {
      console.log('📍 Coordonnées:', activity.latitude, activity.longitude);
      
      if (activity.latitude && activity.longitude) {
        console.log('✅ Centrage en cours...');
        
        hasHandledParams.current = true; // Marquer comme traité
        
        setTimeout(() => {
          if (webViewRef.current) {
            const message = {
              type: 'centerOnActivity',
              activityId: activity.id,
              latitude: activity.latitude,
              longitude: activity.longitude,
              // ✅ AJOUT : Envoyer toutes les données de l'activité
              nom: activity.nom,
              categorie: activity.categorie,
              adresse: activity.adresse,
              date: activity.date,
              participants: activity.participants || 0,
              max_participants: activity.max_participants,
              image_url: activity.image_url
            };
            console.log('📨 Message envoyé à la carte:', message);
            webViewRef.current.postMessage(JSON.stringify(message));
          }
          setSelectedActivity(activity);
        }, 1500);
      } else {
        console.log('❌ Pas de coordonnées pour cette activité');
      }
    } else {
      console.log('❌ Activité non trouvée dans la liste');
    }
  }
}, [params.viewMode, params.selectedActivityId, activities]);

// ✅ AJOUT : Quand on quitte la page, réinitialiser le flag
useEffect(() => {
  return () => {
    console.log('🔄 Nettoyage - reset du flag');
    hasHandledParams.current = false;
  };
}, []);

// ✅ AJOUT : Quand on quitte la page, réinitialiser le flag
useEffect(() => {
  return () => {
    hasHandledParams.current = false;
  };
}, []);

// ✅ AJOUT : Quand on quitte la page, réinitialiser le flag
useEffect(() => {
  return () => {
    hasHandledParams.current = false;
  };
}, []);



  // Gérer les paramètres de navigation
  useEffect(() => {
    if (params.viewMode === 'maps') {
      setViewMode('maps');
    }
    if (params.selectedActivityId && activities.length > 0) {
      const activity = activities.find(a => a.id === params.selectedActivityId);
      if (activity && !selectedActivity) { // Ajouter cette condition pour éviter la boucle
        setTimeout(() => {
          setSelectedActivity({
            id: activity.id,
            nom: activity.nom,
            categorie: activity.categorie,
            date: activity.date,
            adresse: activity.adresse,
            participants: activity.participants,
            max_participants: activity.max_participants,
            image_url: activity.image_url,
            latitude: activity.latitude,
            longitude: activity.longitude,
          });
        }, 1500);
      }
    }
  }, [params.selectedActivityId, activities.length]); // Modifier les dépendances

  // Charger les activités depuis Supabase
  const loadActivities = async () => {
    try {
      const result = await activityService.getActivities();
      if (result.success && result.data) {
        setActivities(result.data);
        
        // Si on est en mode carte, envoyer les activités à la WebView
        if (viewMode === 'maps' && result.data.length > 0) {
          setTimeout(() => {
            sendActivitiesToMap(result.data);
          }, 1000); // Attendre que la carte soit chargée
        }
      }
    } catch (error) {
      console.error('Erreur chargement activités:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Charger au montage
  useEffect(() => {
    loadActivities();
  }, []);

  // Recharger quand on change de mode
  useEffect(() => {
    if (viewMode === 'maps' && activities.length > 0) {
      setTimeout(() => {
        sendActivitiesToMap(activities);
      }, 1000);
    }
  }, [viewMode]);

  // Rafraîchir
  const handleRefresh = () => {
    setRefreshing(true);
    loadActivities();
  };

  // Envoyer les activités à la carte
  const sendActivitiesToMap = (activitiesData: Activity[]) => {
    if (webViewRef.current) {
      const activitiesWithCoords = activitiesData.filter(
        (act) => act.latitude && act.longitude
      );

      const message = JSON.stringify({
        type: 'loadActivities',
        activities: activitiesWithCoords.map((act) => ({
          id: act.id,
          nom: act.nom,
          categorie: act.categorie,
          date: act.date,
          adresse: act.adresse,
          latitude: act.latitude,
          longitude: act.longitude,
          participants: act.participants || 0,
          max_participants: act.max_participants,
          image_url: act.image_url,
        })),
      });

      webViewRef.current.postMessage(message);
      console.log('📍 Activités envoyées à la carte:', activitiesWithCoords.length);
    }
  };

  // Filtrer les activités
  const filteredActivities = activities.filter(activity =>
    activity.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
    activity.categorie.toLowerCase().includes(searchQuery.toLowerCase()) ||
    activity.ville?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Gérer la fermeture de l'activité
  const closeActivity = () => {
    setSelectedActivity(null);
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({ type: 'deselectMarker' }));
    }
  };

  // PanResponder pour le swipe
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 50) {
          closeActivity();
        }
      },
    })
  ).current;

  // Gérer les messages de la WebView
  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'markerClicked') {
        setSelectedActivity(data.activity);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  };

  // HTML pour la carte
const mapHTML = `
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
      width: 40px;
      height: 40px;
      background: #ef4444;
      border: 4px solid white;
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.5);
      transition: all 0.3s ease;
    }
    .custom-marker:hover {
      transform: scale(1.2);
      box-shadow: 0 6px 16px rgba(239, 68, 68, 0.6);
    }
    .custom-marker.selected {
      background: #10b981;
      transform: scale(1.3);
      box-shadow: 0 6px 20px rgba(16, 185, 129, 0.6);
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1.3); }
      50% { transform: scale(1.4); }
    }
    .maplibregl-ctrl-bottom-left,
    .maplibregl-ctrl-bottom-right {
      display: none;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    let selectedMarkerId = null;
    let markers = {};
    let map;

    // Initialiser la carte
    map = new maplibregl.Map({
      container: 'map',
      style: 'https://api.protomaps.com/styles/v2/light.json?key=${PROTOMAPS_KEY}',
      center: [2.5719, 48.8099],
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
          const oldMarker = document.getElementById('marker-' + selectedMarkerId);
          if (oldMarker) oldMarker.classList.remove('selected');
        }
        
        el.classList.add('selected');
        selectedMarkerId = activity.id;
        
        map.flyTo({
          center: [activity.longitude, activity.latitude],
          zoom: 15,
          duration: 1000
        });
        
        sendMessage('markerClicked', { activity });
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([activity.longitude, activity.latitude])
        .addTo(map);

      markers[activity.id] = { element: el, marker };
    }

    function loadActivities(activities) {
      console.log('🗺️ Chargement de', activities.length, 'activités');
      
      Object.values(markers).forEach(m => m.marker.remove());
      markers = {};

      activities.forEach(activity => {
        if (activity.longitude && activity.latitude) {
          createMarker(activity);
        }
      });

      if (activities.length > 0 && activities[0].longitude) {
        map.setCenter([activities[0].longitude, activities[0].latitude]);
      }
    }

    // Fonction pour gérer tous les messages
    function handleMessage(event) {
      try {
        const data = JSON.parse(event.data);
        console.log('🗺️ Message reçu:', data.type);
        
        if (data.type === 'loadActivities') {
          loadActivities(data.activities);
        } 
        else if (data.type === 'deselectMarker' && selectedMarkerId) {
          const marker = document.getElementById('marker-' + selectedMarkerId);
          if (marker) marker.classList.remove('selected');
          selectedMarkerId = null;
        }
        else if (data.type === 'centerOnActivity') {
  console.log('📍 Centrage sur:', data.activityId, data.latitude, data.longitude);
  
  // Créer l'objet activité complet
  const activity = {
    id: data.activityId,
    latitude: data.latitude,
    longitude: data.longitude,
    nom: data.nom,
    categorie: data.categorie,
    adresse: data.adresse,
    date: data.date,
    participants: data.participants,
    max_participants: data.max_participants,
    image_url: data.image_url
  };
  
  // Créer le marqueur s'il n'existe pas
  if (!markers[data.activityId]) {
    console.log('🆕 Création du marqueur pour', data.activityId);
    createMarker(activity);
  }
  
  // Centrer la carte
  map.flyTo({
    center: [data.longitude, data.latitude],
    zoom: 15,
    duration: 1500
  });
  
  // Désélectionner l'ancien marqueur
  if (selectedMarkerId && selectedMarkerId !== data.activityId) {
    const oldMarker = document.getElementById('marker-' + selectedMarkerId);
    if (oldMarker) oldMarker.classList.remove('selected');
  }
  
  // Sélectionner le nouveau marqueur
  const newMarker = document.getElementById('marker-' + data.activityId);
  if (newMarker) {
    newMarker.classList.add('selected');
    selectedMarkerId = data.activityId;
  }
  
  // ✅ AJOUT : Envoyer les données à React Native pour afficher le bottom sheet
  sendMessage('markerClicked', { activity: activity });
}
      } catch (e) {
        console.error('Erreur parsing message:', e);
      }
    }

    // Écouter sur les deux événements (iOS et Android)
    window.addEventListener('message', handleMessage);
    document.addEventListener('message', handleMessage);
  </script>
</body>
</html>
`;

  const renderActivityCard = (activity: Activity, index: number) => {
    const spotsLeft = activity.max_participants - activity.participants;
    const isFull = spotsLeft === 0;

    return (
      <Animated.View
        key={activity.id}
        entering={FadeInDown.delay(index * 100).springify()}
      >
        <TouchableOpacity
          style={styles.activityCard}
          onPress={() => router.push(`/activity-detail?id=${activity.id}`)}
          activeOpacity={0.8}
        >
          <View style={styles.imageContainer}>
            <Image 
              source={{ uri: activity.image_url || 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800' }} 
              style={styles.activityImage} 
            />
          </View>

          <View style={styles.cardContent}>
            <Text style={styles.activityTitle}>{activity.nom}</Text>

            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{activity.categorie}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <IconSymbol name="calendar" size={16} color={colors.textSecondary} />
              <Text style={styles.infoText}>{activity.date} - {activity.time_start}</Text>
            </View>

            <View style={styles.infoRow}>
              <IconSymbol name="location.fill" size={16} color={colors.textSecondary} />
              <Text style={styles.infoText}>{activity.ville}</Text>
            </View>

            <View style={styles.infoRow}>
              <IconSymbol name="person.2.fill" size={16} color={colors.textSecondary} />
              <Text style={styles.infoText}>
                {activity.participants}/{activity.max_participants} participants
                {isFull && ' (Complet)'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderActivityDetailCard = () => {
    if (!selectedActivity) return null;

    const spotsLeft = selectedActivity.max_participants - selectedActivity.participants;
    const isFull = spotsLeft === 0;

    return (
      <Animated.View 
        style={styles.bottomSheet}
        entering={FadeInDown.duration(300)}
        exiting={FadeOutDown.duration(200)}
      >
        <View style={styles.bottomSheetHandle} {...panResponder.panHandlers} />
        
        <ScrollView 
          style={styles.bottomSheetContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {selectedActivity.image_url && (
            <Image 
              source={{ uri: selectedActivity.image_url }} 
              style={styles.detailImage}
            />
          )}
          
          <View style={styles.detailInfo}>
            <Text style={styles.detailName}>{selectedActivity.nom}</Text>
            
            <View style={styles.detailCategoryBadge}>
              <Text style={styles.detailCategoryText}>{selectedActivity.categorie}</Text>
            </View>

            <View style={styles.detailDivider} />

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
            
            <TouchableOpacity
              style={styles.viewDetailButton}
              onPress={() => {
                closeActivity();
                router.push(`/activity-detail?id=${selectedActivity.id}`);
              }}
            >
              <Text style={styles.viewDetailButtonText}>Voir les détails complets</Text>
              <IconSymbol name="arrow.right" size={20} color={colors.background} />
            </TouchableOpacity>
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
            <TouchableOpacity
              style={[styles.toggleButton, viewMode === 'liste' && styles.toggleButtonActive]}
              onPress={() => setViewMode('liste')}
            >
              <IconSymbol 
                name="list.bullet" 
                size={20} 
                color={viewMode === 'liste' ? colors.background : colors.textSecondary} 
              />
              <Text style={[styles.toggleText, viewMode === 'liste' && styles.toggleTextActive]}>
                Liste
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.toggleButton, viewMode === 'maps' && styles.toggleButtonActive]}
              onPress={() => setViewMode('maps')}
            >
              <IconSymbol 
                name="map.fill" 
                size={20} 
                color={viewMode === 'maps' ? colors.background : colors.textSecondary} 
              />
              <Text style={[styles.toggleText, viewMode === 'maps' && styles.toggleTextActive]}>
                Maps
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => router.push('/create-activity')}
            style={styles.createButton}
          >
            <IconSymbol name="plus" size={24} color={colors.background} />
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === 'liste' ? (
        <>
          <View style={styles.searchContainer}>
            <IconSymbol name="magnifyingglass" size={20} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher des activités..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.contentContainer,
              Platform.OS !== 'ios' && styles.contentContainerWithTabBar,
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
              />
            }
          >
            {filteredActivities.length > 0 ? (
              filteredActivities.map((activity, index) => renderActivityCard(activity, index))
            ) : (
              <View style={styles.emptyState}>
                <IconSymbol name="calendar" size={64} color={colors.textSecondary} />
                <Text style={styles.emptyText}>Aucune activité trouvée</Text>
                <Text style={styles.emptySubtext}>
                  {searchQuery ? 'Essayez une autre recherche' : 'Créez la première activité !'}
                </Text>
              </View>
            )}
          </ScrollView>
        </>
      ) : (
        <View style={styles.mapContainer}>
          {Platform.OS === 'web' ? (
            <iframe
              srcDoc={mapHTML}
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          ) : (
            <WebView
              ref={webViewRef}
              source={{ html: mapHTML }}
              style={styles.webview}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              onMessage={handleWebViewMessage}
            />
          )}
          
          {renderActivityDetailCard()}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 4,
    flex: 1,
    marginRight: 12,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: colors.background,
  },
  createButton: {
    width: 44,
    height: 44,
    backgroundColor: colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
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
  activityCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    height: 200,
  },
  activityImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  cardContent: {
    padding: 16,
  },
  activityTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 12,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%', // Augmenté de 50% à 70%
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -3,
    },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
    elevation: 6,
  },
  bottomSheetHandle: {
    width: 40,
    height: 5,
    backgroundColor: colors.border,
    borderRadius: 3,
    alignSelf: 'center',
    marginVertical: 12,
  },
  bottomSheetContent: {
    flex: 1,
    marginBottom: Platform.OS === 'ios' ? 80 : 60, // Espace pour la navbar
  },
  detailImage: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
  detailInfo: {
    padding: 20,
    paddingBottom: 24,
  },
  detailName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    lineHeight: 30,
  },
  detailCategoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 16,
  },
  detailCategoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  detailDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  detailText: {
    fontSize: 15,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 22,
  },
  viewDetailButton: {
  backgroundColor: colors.primary,
  borderRadius: 12,
  paddingVertical: 14,
  paddingHorizontal: 20,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  marginTop: 16,
  marginBottom: Platform.OS === 'android' ? 55 : 16, // ✅ Ajout d'un espace en bas pour Android
},
  viewDetailButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 8,
  },
});