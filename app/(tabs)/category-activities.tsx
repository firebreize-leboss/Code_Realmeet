// app/(tabs)/category-activities.tsx
import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import { activityService } from '@/services/activity.service';
import { PREDEFINED_CATEGORIES } from '@/constants/categories';
import Animated, { FadeInDown } from 'react-native-reanimated';

interface Activity {
  id: string;
  nom: string;
  description: string;
  categorie: string;
  categorie2?: string;
  date: string;
  time_start: string;
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
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const categoryName = decodeURIComponent(category as string);
  const categoryInfo = PREDEFINED_CATEGORIES.find(cat => cat.name === categoryName);

  useEffect(() => {
    loadActivities();
  }, [category]);

  const loadActivities = async () => {
    try {
      setLoading(true);
      
      // Récupérer toutes les activités
      const result = await activityService.getActivities();
      
      if (result.success && result.data) {
        // Filtrer les activités qui ont cette catégorie (en categorie ou categorie2)
        const filtered = result.data.filter((activity: Activity) => 
          activity.categorie === categoryName || activity.categorie2 === categoryName
        );
        setActivities(filtered);
      }
    } catch (error) {
      console.error('Erreur chargement activités:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleActivityPress = (activityId: string) => {
    router.push(`/activity-detail?id=${activityId}`);
  };

  // Filtrage des activités selon la recherche
  const filteredActivities = activities.filter((activity: Activity) => {
    if (searchQuery === '') return true;
    
    const query = searchQuery.toLowerCase();
    return (
      activity.nom.toLowerCase().includes(query) ||
      activity.description.toLowerCase().includes(query) ||
      activity.ville.toLowerCase().includes(query) ||
      activity.adresse.toLowerCase().includes(query)
    );
  });

  const renderActivityCard = (activity: Activity, index: number) => {
    const placesRestantes = activity.max_participants - activity.participants;
    const isAlmostFull = placesRestantes <= 3 && placesRestantes > 0;
    const isFull = placesRestantes === 0;

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
          
          {/* Badge catégorie */}
          <View style={styles.categoryBadge}>
            <View style={[styles.categoryDot, { backgroundColor: categoryInfo?.color || colors.primary }]} />
            <Text style={styles.categoryBadgeText}>{activity.categorie}</Text>
            {activity.categorie2 && (
              <>
                <Text style={styles.categoryBadgeText}> • </Text>
                <Text style={styles.categoryBadgeText}>{activity.categorie2}</Text>
              </>
            )}
          </View>

          {/* Statut des places */}
          {isFull ? (
            <View style={[styles.statusBadge, styles.fullBadge]}>
              <Text style={styles.statusBadgeText}>Complet</Text>
            </View>
          ) : isAlmostFull ? (
            <View style={[styles.statusBadge, styles.almostFullBadge]}>
              <Text style={styles.statusBadgeText}>{placesRestantes} places</Text>
            </View>
          ) : null}

          <View style={styles.activityInfo}>
            <Text style={styles.activityTitle} numberOfLines={2}>
              {activity.nom}
            </Text>
            
            <View style={styles.activityDetails}>
              <View style={styles.detailRow}>
                <IconSymbol name="calendar" size={16} color={colors.textSecondary} />
                <Text style={styles.detailText}>
                  {new Date(activity.date).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                  })} à {activity.time_start.slice(0, 5)}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <IconSymbol name="location.fill" size={16} color={colors.textSecondary} />
                <Text style={styles.detailText} numberOfLines={1}>
                  {activity.ville}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <IconSymbol name="person.2.fill" size={16} color={colors.textSecondary} />
                <Text style={styles.detailText}>
                  {activity.participants}/{activity.max_participants} participants
                </Text>
              </View>

              {activity.prix && activity.prix > 0 && (
                <View style={styles.detailRow}>
                  <IconSymbol name="eurosign.circle.fill" size={16} color={colors.primary} />
                  <Text style={[styles.detailText, { color: colors.primary, fontWeight: '600' }]}>
                    {activity.prix.toFixed(2)} €
                  </Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={commonStyles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconSymbol name="chevron.left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{categoryName}</Text>
          <View style={styles.placeholder} />
        </View>
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
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          {categoryInfo && (
            <View style={[styles.headerIcon, { backgroundColor: categoryInfo.color + '20' }]}>
              <IconSymbol name={categoryInfo.icon} size={20} color={categoryInfo.color} />
            </View>
          )}
          <Text style={styles.headerTitle}>{categoryName}</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      {/* Barre de recherche */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <IconSymbol name="magnifyingglass" size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher une activité..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <IconSymbol name="xmark.circle.fill" size={20} color={colors.textSecondary} />
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
      >
        {filteredActivities.length === 0 ? (
          <View style={styles.emptyContainer}>
            <IconSymbol 
              name={searchQuery ? "magnifyingglass" : "tray"} 
              size={64} 
              color={colors.textSecondary} 
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
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 0,
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
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  countText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 15,
  },
  activityCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  activityImage: {
    width: '100%',
    height: 200,
    backgroundColor: colors.background,
  },
  categoryBadge: {
    position: 'absolute',
    top: 15,
    left: 15,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    position: 'absolute',
    top: 15,
    right: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  fullBadge: {
    backgroundColor: 'rgba(231, 76, 60, 0.9)',
  },
  almostFullBadge: {
    backgroundColor: 'rgba(241, 196, 15, 0.9)',
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  activityInfo: {
    padding: 15,
  },
  activityTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  activityDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
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
    color: colors.text,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 22,
  },
});