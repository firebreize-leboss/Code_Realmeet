// app/(tabs)/category.tsx
// Design Premium - Fond sobre, orange comme accent
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { PREDEFINED_CATEGORIES } from '@/constants/categories';
import Animated, { FadeInDown } from 'react-native-reanimated';
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
    <View style={styles.container}>
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
                    activeOpacity={0.85}
                  >
                    <View style={styles.iconContainer}>
                      <IconSymbol name={category.icon} size={28} color={colors.primaryDesaturated} />
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
              <IconSymbol name="tray" size={56} color={colors.textMuted} />
              <Text style={styles.emptyText}>Aucune activité disponible</Text>
              <Text style={styles.emptySubtext}>
                Revenez plus tard pour découvrir de nouvelles activités
              </Text>
            </View>
          )}

          <View style={styles.infoCard}>
            <IconSymbol name="info.circle.fill" size={20} color={colors.primaryDesaturated} />
            <Text style={styles.infoText}>
              Sélectionnez une catégorie pour découvrir les activités
            </Text>
          </View>
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: colors.backgroundAlt,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 100,
  },
  contentContainerWithTabBar: {
    paddingBottom: 120,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  categoryWrapper: {
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  categoryCard: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  categoryCardSelected: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.borderSubtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 18,
  },
  countBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: colors.borderSubtle,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
    minWidth: 22,
    alignItems: 'center',
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.borderSubtle,
    padding: 14,
    borderRadius: 12,
    marginTop: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 6,
  },
});
