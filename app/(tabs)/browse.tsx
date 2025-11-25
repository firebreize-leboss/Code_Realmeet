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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import { mockActivities } from '@/data/mockData';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { WebView } from 'react-native-webview';

// Configuration Supabase et Protomaps
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const PROTOMAPS_KEY = process.env.EXPO_PUBLIC_PROTOMAPS_KEY || ''; // Votre clé Protomaps

type ViewMode = 'liste' | 'maps';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('liste');
  const [selectedActivity, setSelectedActivity] = useState<SelectedActivity | null>(null);
  const webViewRef = useRef<WebView>(null);

  const filteredActivities = mockActivities.filter(activity =>
    activity.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    activity.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Gérer la fermeture de l'activité
  const closeActivity = () => {
    setSelectedActivity(null);
    // Envoyer un message à la WebView pour désélectionner le marqueur
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({ type: 'deselectMarker' }));
    }
  };

  // PanResponder pour le swipe vers le bas
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Activer le pan responder uniquement si on swipe vers le bas
        return gestureState.dy > 5;
      },
      onPanResponderRelease: (_, gestureState) => {
        // Si on swipe vers le bas de plus de 50px, fermer
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

  // HTML pour la carte avec interaction
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
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .custom-marker:hover {
      transform: scale(1.2);
      box-shadow: 0 6px 16px rgba(239, 68, 68, 0.6);
    }
    .custom-marker.selected {
      background: #10b981;
      transform: scale(1.3);
      box-shadow: 0 6px 20px rgba(16, 185, 129, 0.6);
      border-color: #fff;
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

    // Écouter les messages de React Native
    if (window.ReactNativeWebView) {
      document.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'deselectMarker' && selectedMarkerId) {
            const marker = document.getElementById('marker-' + selectedMarkerId);
            if (marker) {
              marker.classList.remove('selected');
            }
            selectedMarkerId = null;
          }
        } catch (e) {
          console.error('Error parsing message:', e);
        }
      });
      
      // Pour Android
      window.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'deselectMarker' && selectedMarkerId) {
            const marker = document.getElementById('marker-' + selectedMarkerId);
            if (marker) {
              marker.classList.remove('selected');
            }
            selectedMarkerId = null;
          }
        } catch (e) {
          console.error('Error parsing message:', e);
        }
      });
    }

    // Données d'activités
    const activities = [
      {
        id: '1',
        nom: 'Laser Quest Adventure',
        categorie: 'Laser game',
        date: '17 mai',
        adresse: '7 Allée André Malraux, Le Plessis-Trevise 94420',
        latitude: 48.8099,
        longitude: 2.5719,
        participants: 27,
        max_participants: 40,
        image_url: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400'
      }
    ];

    // Initialiser la carte avec Protomaps
    const map = new maplibregl.Map({
      container: 'map',
      style: 'https://api.protomaps.com/styles/v2/light.json?key=${PROTOMAPS_KEY}',
      center: [2.5719, 48.8099],
      zoom: 13
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    // Fonction pour envoyer un message à React Native
    function sendMessage(type, data) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...data }));
      }
    }

    // Fonction pour créer un marqueur
    function createMarker(activity) {
      const el = document.createElement('div');
      el.className = 'custom-marker';
      el.id = 'marker-' + activity.id;
      
      el.addEventListener('click', () => {
        // Désélectionner l'ancien marqueur
        if (selectedMarkerId && selectedMarkerId !== activity.id) {
          const oldMarker = document.getElementById('marker-' + selectedMarkerId);
          if (oldMarker) {
            oldMarker.classList.remove('selected');
          }
        }
        
        // Sélectionner le nouveau marqueur
        el.classList.add('selected');
        selectedMarkerId = activity.id;
        
        // Centrer la carte sur le marqueur
        map.flyTo({
          center: [activity.longitude, activity.latitude],
          zoom: 15,
          duration: 1000
        });
        
        // Envoyer les données à React Native
        sendMessage('markerClicked', { activity });
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([activity.longitude, activity.latitude])
        .addTo(map);

      markers[activity.id] = { element: el, marker };
    }

    map.on('load', () => {
      // Ajouter les marqueurs
      activities.forEach(activity => {
        createMarker(activity);
      });
    });

    // Charger les données depuis Supabase (optionnel)
    async function loadFromSupabase() {
      try {
        const response = await fetch('${SUPABASE_URL}/rest/v1/activities?select=*', {
          headers: {
            'apikey': '${SUPABASE_KEY}',
            'Authorization': 'Bearer ${SUPABASE_KEY}'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('Activités Supabase:', data);
          data.forEach(activity => {
            if (activity.longitude && activity.latitude) {
              createMarker(activity);
            }
          });
        }
      } catch (error) {
        console.error('Erreur Supabase:', error);
      }
    }

    // Décommenter pour charger depuis Supabase
    // loadFromSupabase();
  </script>
</body>
</html>
  `;

  const renderActivityCard = (activity: typeof mockActivities[0], index: number) => {
    const spotsLeft = activity.capacity - activity.participants.length;
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
            <Image source={{ uri: activity.image }} style={styles.activityImage} />
            <View style={styles.hostBadge}>
              <Image source={{ uri: activity.host.avatar }} style={styles.hostAvatarSmall} />
              <Text style={styles.hostBadgeText}>{activity.host.name}</Text>
            </View>
          </View>

          <View style={styles.cardContent}>
            <Text style={styles.activityTitle}>{activity.title}</Text>

            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{activity.category}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRowCentered}>
              <View style={styles.infoHeader}>
                <IconSymbol name="calendar" size={18} color={colors.text} />
                <Text style={styles.infoLabel}>Prochains événements :</Text>
              </View>
              <Text style={styles.infoValue}>
                {activity.date} - {activity.time}
              </Text>
              <Text style={styles.infoExtra}>et 5 autres...</Text>
            </View>

            <View style={styles.infoRowCentered}>
              <View style={styles.infoHeader}>
                <IconSymbol name="person.2.fill" size={18} color={colors.text} />
                <Text style={styles.infoLabel}>groupe de {activity.participants.length} participants</Text>
              </View>
            </View>

            <View style={styles.infoRowCentered}>
              <View style={styles.infoHeader}>
                <IconSymbol name="location.fill" size={18} color={colors.text} />
                <Text style={styles.infoValue}>{activity.location}</Text>
              </View>
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.detailButton}
                onPress={() => router.push(`/activity-detail?id=${activity.id}`)}
              >
                <Text style={styles.detailButtonText}>Détail de l'activité</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.proposeButton}
                onPress={() => router.push('/create-activity')}
              >
                <Text style={styles.proposeButtonText}>Proposer l'activité</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Carte détaillée de l'activité sélectionnée (bottom sheet)
  const renderActivityDetailCard = () => {
    if (!selectedActivity) return null;

    return (
      <Animated.View 
        style={styles.bottomSheet}
        entering={FadeInDown.duration(300)}
        exiting={FadeOutDown.duration(200)}
        {...panResponder.panHandlers}
      >
        <View style={styles.bottomSheetHandle} />
        
        <ScrollView 
          style={styles.bottomSheetContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.detailHeader}>
            {selectedActivity.image_url && (
              <Image 
                source={{ uri: selectedActivity.image_url }} 
                style={styles.detailImage}
              />
            )}
            
            <View style={styles.detailInfo}>
              <Text style={styles.detailName}>{selectedActivity.nom}</Text>
              <Text style={styles.detailDistance}>
                {/* Calculer la distance ici si nécessaire */}
                1.2 km
              </Text>
            </View>
          </View>

          <View style={styles.detailSection}>
            <View style={styles.detailBadge}>
              <Text style={styles.detailBadgeText}>{selectedActivity.categorie}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <IconSymbol name="calendar" size={16} color={colors.textSecondary} />
              <Text style={styles.detailText}>Today {selectedActivity.date}</Text>
            </View>

            <View style={styles.detailRow}>
              <IconSymbol name="location.fill" size={16} color={colors.textSecondary} />
              <Text style={styles.detailText} numberOfLines={2}>
                {selectedActivity.adresse}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <IconSymbol name="person.2.fill" size={16} color={colors.textSecondary} />
              <Text style={styles.detailText}>
                {selectedActivity.participants}/{selectedActivity.max_participants} participants
              </Text>
            </View>
          </View>

          <TouchableOpacity 
            style={styles.viewDetailsButton}
            onPress={() => {
              closeActivity();
              router.push(`/activity-detail?id=${selectedActivity.id}`);
            }}
          >
            <Text style={styles.viewDetailsButtonText}>Voir les détails</Text>
            <IconSymbol name="chevron.right" size={20} color={colors.background} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.closeButton}
            onPress={closeActivity}
          >
            <Text style={styles.closeButtonText}>Fermer</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Découvrir</Text>
        <View style={styles.headerActions}>
          {/* Toggle Liste/Maps */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleButton, viewMode === 'liste' && styles.toggleButtonActive]}
              onPress={() => setViewMode('liste')}
            >
              <IconSymbol 
                name="square.grid.2x2.fill" 
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
          >
            {filteredActivities.map((activity, index) => renderActivityCard(activity, index))}
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
          
          {/* Bottom sheet avec détails de l'activité */}
          {renderActivityDetailCard()}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 90 : 80, // Plus d'espace pour éviter la navbar
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    maxHeight: '40%',
    paddingBottom: 10,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  bottomSheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  detailImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: colors.border,
  },
  detailInfo: {
    flex: 1,
  },
  detailName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  detailDistance: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  detailSection: {
    gap: 12,
    marginBottom: 16,
  },
  detailBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  detailBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
  },
  viewDetailsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  closeButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  activityCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  imageContainer: {
    position: 'relative',
  },
  activityImage: {
    width: '100%',
    height: 180,
    backgroundColor: colors.border,
  },
  hostBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 8,
  },
  hostAvatarSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  hostBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  cardContent: {
    padding: 16,
  },
  activityTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
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
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  infoRowCentered: {
    marginBottom: 10,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  infoValue: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 26,
  },
  infoExtra: {
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 26,
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  detailButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  detailButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.background,
  },
  proposeButton: {
    flex: 1,
    backgroundColor: colors.card,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  proposeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
});