
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import { mockActivities, mockCategories } from '@/data/mockData';

export default function CategoryActivitiesScreen() {
  const router = useRouter();
  const { category } = useLocalSearchParams();
  
  const selectedCategory = mockCategories.find(c => c.id === category);
  const filteredActivities = mockActivities.filter(
    activity => activity.category === selectedCategory?.name
  );

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{selectedCategory?.name || 'Activities'}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          Platform.OS !== 'ios' && styles.contentContainerWithTabBar,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {filteredActivities.length > 0 ? (
          filteredActivities.map(activity => {
            const spotsLeft = activity.capacity - activity.participants.length;
            const isFull = spotsLeft === 0;

            return (
              <TouchableOpacity
                key={activity.id}
                style={styles.activityCard}
                onPress={() => router.push(`/activity-detail?id=${activity.id}`)}
                activeOpacity={0.8}
              >
                <Image source={{ uri: activity.image }} style={styles.activityImage} />
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle} numberOfLines={2}>
                    {activity.title}
                  </Text>
                  <View style={styles.detailsRow}>
                    <View style={styles.detailItem}>
                      <IconSymbol name="calendar" size={14} color={colors.textSecondary} />
                      <Text style={styles.detailText}>{activity.date}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <IconSymbol name="location.fill" size={14} color={colors.textSecondary} />
                      <Text style={styles.detailText}>{activity.location}</Text>
                    </View>
                  </View>
                  <View style={[styles.spotsIndicator, isFull && styles.spotsIndicatorFull]}>
                    <Text style={[styles.spotsText, isFull && styles.spotsTextFull]}>
                      {isFull ? 'Full' : `${spotsLeft} spots left`}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <IconSymbol name="magnifyingglass" size={64} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No activities found</Text>
            <Text style={styles.emptySubtext}>
              Check back later for new activities in this category
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  placeholder: {
    width: 40,
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
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.3)',
    elevation: 4,
  },
  activityImage: {
    width: '100%',
    height: 180,
    backgroundColor: colors.border,
  },
  activityContent: {
    padding: 16,
  },
  activityTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    lineHeight: 24,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  detailText: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  spotsIndicator: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.primary + '20',
  },
  spotsIndicatorFull: {
    backgroundColor: colors.textSecondary + '20',
  },
  spotsText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  spotsTextFull: {
    color: colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
});
