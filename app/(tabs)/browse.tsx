import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Platform,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import { mockActivities } from '@/data/mockData';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function BrowseScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredActivities = mockActivities.filter(activity =>
    activity.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    activity.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          {/* Image de l'activité */}
          <View style={styles.imageContainer}>
            <Image source={{ uri: activity.image }} style={styles.activityImage} />
            <View style={styles.hostBadge}>
              <Image source={{ uri: activity.host.avatar }} style={styles.hostAvatarSmall} />
              <Text style={styles.hostBadgeText}>{activity.host.name}</Text>
            </View>
          </View>

          {/* Contenu de la card */}
          <View style={styles.cardContent}>
            {/* Titre de l'activité */}
            <Text style={styles.activityTitle}>{activity.title}</Text>

            {/* Badge catégorie */}
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{activity.category}</Text>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Prochains événements */}
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

            {/* Groupe de participants */}
            <View style={styles.infoRowCentered}>
              <View style={styles.infoHeader}>
                <IconSymbol name="person.2.fill" size={18} color={colors.text} />
                <Text style={styles.infoLabel}>groupe de {activity.participants.length} participants</Text>
              </View>
            </View>

            {/* Lieu */}
            <View style={styles.infoRowCentered}>
              <View style={styles.infoHeader}>
                <IconSymbol name="location.fill" size={18} color={colors.text} />
                <Text style={styles.infoValue}>{activity.location}</Text>
              </View>
            </View>

            {/* Boutons d'action */}
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

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Découvrir</Text>
        <TouchableOpacity
          onPress={() => router.push('/create-activity')}
          style={styles.createButton}
        >
          <IconSymbol name="plus" size={24} color={colors.background} />
        </TouchableOpacity>
      </View>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  createButton: {
    backgroundColor: colors.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
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
    paddingVertical: 12,
    borderRadius: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
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
    marginBottom: 20,
    overflow: 'hidden',
    elevation: 4,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 180,
  },
  activityImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.border,
  },
  hostBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 8,
  },
  hostAvatarSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.border,
  },
  hostBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  cardContent: {
    padding: 16,
  },
  activityTitle: {
    fontSize: 22,
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
    alignItems: 'center',
    marginBottom: 12,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 12,
  },
  infoTextContainer: {
    flex: 1,
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
    textAlign: 'center',
  },
  infoValue: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
  },
  infoExtra: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'column',
    gap: 10,
    marginTop: 16,
  },
  detailButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  detailButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  proposeButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  proposeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.background,
  },
});