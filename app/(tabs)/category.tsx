// app/(tabs)/category.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { PREDEFINED_CATEGORIES } from '@/constants/categories';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useDataCache } from '@/contexts/DataCacheContext';

export default function CategoryScreen() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { cache } = useDataCache();

  // Compter le nombre d'activités par catégorie avec créneaux futurs
  const getActivityCountForCategory = (categoryName: string) => {
    return cache.activities.filter(activity => {
      const hasSlots = cache.slotDataByActivity[activity.id]?.slotCount > 0;
      return hasSlots && (activity.categorie === categoryName || activity.categorie2 === categoryName);
    }).length;
  };

  const handleCategoryPress = (categoryId: string) => {
    setSelectedCategory(categoryId);
    const category = PREDEFINED_CATEGORIES.find(cat => cat.id === categoryId);
    if (category) {
      router.push(`/category-activities?category=${encodeURIComponent(category.name)}`);
    }
  };

  return (
    <LinearGradient
      colors={['#60A5FA', '#818CF8', '#C084FC']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Catégories</Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.contentContainer,
            Platform.OS !== 'ios' && styles.contentContainerWithTabBar,
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.grid}>
            {PREDEFINED_CATEGORIES.map((category, index) => {
              const activityCount = getActivityCountForCategory(category.name);

              // Ne pas afficher si aucune activité avec créneaux futurs
              if (activityCount === 0) return null;

              return (
                <Animated.View
                  key={category.id}
                  entering={FadeInDown.delay(index * 50).springify()}
                  style={styles.categoryWrapper}
                >
                  <TouchableOpacity
                    style={[
                      styles.categoryCard,
                      selectedCategory === category.id && styles.categoryCardSelected,
                    ]}
                    onPress={() => handleCategoryPress(category.id)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.iconContainer,
                        { backgroundColor: 'rgba(255,255,255,0.3)' },
                      ]}
                    >
                      <IconSymbol name={category.icon} size={32} color="#FFFFFF" />
                    </View>
                    <Text style={styles.categoryName}>{category.name}</Text>
                    <View style={styles.countBadge}>
                      <Text style={styles.countText}>{activityCount}</Text>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>

          {/* Afficher un message si aucune catégorie n'a d'activités */}
          {PREDEFINED_CATEGORIES.every(cat => getActivityCountForCategory(cat.name) === 0) && (
            <View style={styles.emptyState}>
              <IconSymbol name="tray" size={64} color="rgba(255,255,255,0.7)" />
              <Text style={styles.emptyText}>Aucune activité disponible</Text>
              <Text style={styles.emptySubtext}>
                Revenez plus tard pour découvrir de nouvelles activités
              </Text>
            </View>
          )}

          <View style={styles.infoCard}>
            <IconSymbol name="info.circle.fill" size={24} color="#FFFFFF" />
            <Text style={styles.infoText}>
              Sélectionnez une catégorie pour découvrir les activités correspondantes
            </Text>
          </View>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  contentContainerWithTabBar: {
    paddingBottom: 120,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  categoryWrapper: {
    width: '50%',
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  categoryCard: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  categoryCardSelected: {
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderColor: 'rgba(255,255,255,0.5)',
  },
  iconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 20,
  },
  countBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    padding: 16,
    borderRadius: 16,
    marginTop: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
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
    marginTop: 8,
  },
});
