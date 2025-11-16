
import React, { useState } from 'react';
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
import { mockActivities } from '@/data/mockData';

export default function ActivityDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const activity = mockActivities.find(a => a.id === id);
  const [isJoined, setIsJoined] = useState(false);

  if (!activity) {
    return (
      <SafeAreaView style={commonStyles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Activity not found</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const spotsLeft = activity.capacity - activity.participants.length;
  const isFull = spotsLeft === 0;

  const handleJoinLeave = () => {
    setIsJoined(!isJoined);
  };

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
        >
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerButton}>
          <IconSymbol name="square.and.arrow.up" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Image source={{ uri: activity.image }} style={styles.heroImage} />

        <View style={styles.content}>
          <View style={styles.titleSection}>
            <Text style={styles.title}>{activity.title}</Text>
            <View style={[styles.categoryBadge, { backgroundColor: colors.primary + '20' }]}>
              <Text style={styles.categoryText}>{activity.category}</Text>
            </View>
          </View>

          <View style={styles.hostSection}>
            <Image source={{ uri: activity.host.avatar }} style={styles.hostAvatar} />
            <View style={styles.hostInfo}>
              <Text style={styles.hostLabel}>Hosted by</Text>
              <Text style={styles.hostName}>{activity.host.name}</Text>
            </View>
          </View>

          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <IconSymbol name="calendar" size={20} color={colors.primary} />
              <View style={styles.detailInfo}>
                <Text style={styles.detailLabel}>Date</Text>
                <Text style={styles.detailValue}>{activity.date}</Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <IconSymbol name="clock.fill" size={20} color={colors.primary} />
              <View style={styles.detailInfo}>
                <Text style={styles.detailLabel}>Time</Text>
                <Text style={styles.detailValue}>{activity.time}</Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <IconSymbol name="location.fill" size={20} color={colors.primary} />
              <View style={styles.detailInfo}>
                <Text style={styles.detailLabel}>Location</Text>
                <Text style={styles.detailValue}>{activity.location}</Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <IconSymbol name="person.2.fill" size={20} color={colors.primary} />
              <View style={styles.detailInfo}>
                <Text style={styles.detailLabel}>Capacity</Text>
                <Text style={styles.detailValue}>
                  {activity.participants.length} / {activity.capacity} joined
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.description}>{activity.description}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Participants ({activity.participants.length})
            </Text>
            <View style={styles.participantsGrid}>
              {activity.participants.map(participant => (
                <View key={participant.id} style={styles.participantItem}>
                  <Image
                    source={{ uri: participant.avatar }}
                    style={styles.participantAvatar}
                  />
                  <Text style={styles.participantName} numberOfLines={1}>
                    {participant.name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            isJoined && styles.actionButtonLeave,
            isFull && !isJoined && styles.actionButtonDisabled,
          ]}
          onPress={handleJoinLeave}
          disabled={isFull && !isJoined}
        >
          <Text style={styles.actionButtonText}>
            {isFull && !isJoined ? 'Full' : isJoined ? 'Leave' : 'Join Activity'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 100,
  },
  heroImage: {
    width: '100%',
    height: 300,
    backgroundColor: colors.border,
  },
  content: {
    padding: 20,
  },
  titleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 34,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  hostSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  hostAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.border,
  },
  hostInfo: {
    flex: 1,
  },
  hostLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  hostName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  detailsCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailInfo: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  participantsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  participantItem: {
    alignItems: 'center',
    width: 70,
  },
  participantAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.border,
    marginBottom: 6,
  },
  participantName: {
    fontSize: 12,
    color: colors.text,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  actionButtonLeave: {
    backgroundColor: colors.error,
  },
  actionButtonDisabled: {
    backgroundColor: colors.textSecondary,
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
});
