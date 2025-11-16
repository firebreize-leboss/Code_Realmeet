
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import { mockActivities } from '@/data/mockData';

type TabType = 'ongoing' | 'past';

export default function ActivityScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('ongoing');

  const ongoingActivities = mockActivities.slice(0, 3);
  const pastActivities = mockActivities.slice(3);

  const renderActivityItem = (activity: typeof mockActivities[0]) => (
    <TouchableOpacity
      key={activity.id}
      style={styles.activityItem}
      onPress={() => router.push(`/activity-detail?id=${activity.id}`)}
      activeOpacity={0.8}
    >
      <Image source={{ uri: activity.image }} style={styles.activityImage} />
      <View style={styles.activityInfo}>
        <Text style={styles.activityTitle} numberOfLines={2}>
          {activity.title}
        </Text>
        <View style={styles.activityMeta}>
          <View style={styles.metaItem}>
            <IconSymbol name="calendar" size={14} color={colors.textSecondary} />
            <Text style={styles.metaText}>{activity.date}</Text>
          </View>
          <View style={styles.metaItem}>
            <IconSymbol name="clock.fill" size={14} color={colors.textSecondary} />
            <Text style={styles.metaText}>{activity.time}</Text>
          </View>
        </View>
        <View style={styles.metaItem}>
          <IconSymbol name="location.fill" size={14} color={colors.textSecondary} />
          <Text style={styles.metaText} numberOfLines={1}>
            {activity.location}
          </Text>
        </View>
      </View>
      <IconSymbol name="chevron.right" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Activities</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'ongoing' && styles.tabActive]}
          onPress={() => setActiveTab('ongoing')}
        >
          <Text style={[styles.tabText, activeTab === 'ongoing' && styles.tabTextActive]}>
            Ongoing
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'past' && styles.tabActive]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>
            Past
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          Platform.OS !== 'ios' && styles.contentContainerWithTabBar,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'ongoing' ? (
          ongoingActivities.length > 0 ? (
            ongoingActivities.map(renderActivityItem)
          ) : (
            <View style={styles.emptyState}>
              <IconSymbol name="calendar" size={64} color={colors.textSecondary} />
              <Text style={styles.emptyText}>No ongoing activities</Text>
              <Text style={styles.emptySubtext}>
                Browse activities to join your first event!
              </Text>
              <TouchableOpacity
                style={styles.browseButton}
                onPress={() => router.push('/(tabs)/browse')}
              >
                <Text style={styles.browseButtonText}>Browse Activities</Text>
              </TouchableOpacity>
            </View>
          )
        ) : (
          pastActivities.length > 0 ? (
            pastActivities.map(renderActivityItem)
          ) : (
            <View style={styles.emptyState}>
              <IconSymbol name="clock.fill" size={64} color={colors.textSecondary} />
              <Text style={styles.emptyText}>No past activities</Text>
              <Text style={styles.emptySubtext}>
                Your completed activities will appear here
              </Text>
            </View>
          )
        )}
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
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.background,
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
  activityItem: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
    gap: 12,
  },
  activityImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  activityInfo: {
    flex: 1,
    gap: 6,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 22,
  },
  activityMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
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
  browseButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 24,
  },
  browseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
});
