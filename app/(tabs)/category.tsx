
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
import { colors, commonStyles } from '@/styles/commonStyles';
import { mockCategories } from '@/data/mockData';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function CategoryScreen() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const handleCategoryPress = (categoryId: string) => {
    setSelectedCategory(categoryId);
    router.push(`/category-activities?category=${categoryId}`);
  };

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Categories</Text>
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
          {mockCategories.map((category, index) => (
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
                    { backgroundColor: category.color + '20' },
                  ]}
                >
                  <IconSymbol name={category.icon} size={32} color={category.color} />
                </View>
                <Text style={styles.categoryName}>{category.name}</Text>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>

        <View style={styles.infoCard}>
          <IconSymbol name="info.circle.fill" size={24} color={colors.primary} />
          <Text style={styles.infoText}>
            Select a category to discover activities that match your interests
          </Text>
        </View>
      </ScrollView>
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  categoryWrapper: {
    width: '48%',
  },
  categoryCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 12,
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.3)',
    elevation: 4,
  },
  categoryCardSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
