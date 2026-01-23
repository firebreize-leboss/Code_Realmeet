// components/ActivityCard.tsx
// Carte d'activité avec adaptation pour comptes entreprise

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, borderRadius, spacing, shadows, typography } from '@/styles/commonStyles';
import { LinearGradient } from 'expo-linear-gradient';
import { useBusinessRestrictions } from '@/hooks/useBusinessRestrictions';
import { PREDEFINED_CATEGORIES } from '@/constants/categories';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Activity {
  id: string;
  nom: string;
  description?: string;
  categorie: string;
  image_url?: string;
  date?: string;
  time_start?: string;
  adresse?: string;
  ville?: string;
  participants: number;
  max_participants: number;
  prix?: number;
  host_id: string;
  host_name?: string;
  host_avatar?: string;
  host_is_business?: boolean;
}

interface ActivityCardProps {
  activity: Activity;
  variant?: 'full' | 'compact' | 'list';
  showHost?: boolean;
  showCompetitorBadge?: boolean;
}

export default function ActivityCard({ 
  activity, 
  variant = 'full',
  showHost = true,
  showCompetitorBadge = false,
}: ActivityCardProps) {
  const router = useRouter();
  const { isBusiness, canViewCompetitors } = useBusinessRestrictions();

  const handlePress = () => {
    router.push(`/activity-detail?id=${activity.id}`);
  };

  const handleHostPress = () => {
    if (activity.host_is_business) {
      router.push(`/business-profile?id=${activity.host_id}`);
    } else {
      router.push(`/user-profile?id=${activity.host_id}`);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'short' 
    });
  };

  const spotsLeft = activity.max_participants - activity.participants;
  const isFull = spotsLeft <= 0;
  const isAlmostFull = spotsLeft <= 3 && spotsLeft > 0;

  // Get category color
  const getCategoryColor = (categoryName: string) => {
    const category = PREDEFINED_CATEGORIES.find(
      cat => cat.name.toLowerCase() === categoryName.toLowerCase()
    );
    return category?.color || colors.primary;
  };

  const categoryColor = getCategoryColor(activity.categorie);

  // Variante compacte pour grille
  if (variant === 'compact') {
    return (
      <TouchableOpacity
        style={styles.compactCard}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: activity.image_url || 'https://via.placeholder.com/160' }}
          style={styles.compactImage}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.compactGradient}
        />
        
        {/* Badge catégorie */}
        <View style={[styles.compactBadge, { backgroundColor: categoryColor }]}>
          <Text style={styles.compactBadgeText}>{activity.categorie}</Text>
        </View>

        {/* Badge concurrent (pour entreprises) */}
        {showCompetitorBadge && isBusiness && canViewCompetitors && (
          <View style={styles.competitorBadge}>
            <IconSymbol name="eye.fill" size={10} color={colors.background} />
            <Text style={styles.competitorBadgeText}>Concurrent</Text>
          </View>
        )}

        <View style={styles.compactContent}>
          <Text style={styles.compactTitle} numberOfLines={2}>{activity.nom}</Text>
          
          <View style={styles.compactMeta}>
            {activity.date && (
              <View style={styles.metaItem}>
                <IconSymbol name="calendar" size={12} color={colors.text} />
                <Text style={styles.metaText}>{formatDate(activity.date)}</Text>
              </View>
            )}
            <View style={styles.metaItem}>
              <IconSymbol name="person.2.fill" size={12} color={isFull ? colors.error : colors.text} />
              <Text style={[styles.metaText, isFull && styles.fullText]}>
                {activity.participants}/{activity.max_participants}
              </Text>
            </View>
          </View>
        </View>

        {activity.prix !== undefined && activity.prix > 0 && (
          <View style={styles.priceTag}>
            <Text style={styles.priceText}>{activity.prix}€</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  // Variante liste
  if (variant === 'list') {
    return (
      <TouchableOpacity
        style={styles.listCard}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: activity.image_url || 'https://via.placeholder.com/80' }}
          style={styles.listImage}
        />
        
        <View style={styles.listContent}>
          <View style={styles.listHeader}>
            <View style={[styles.listCategoryBadge, { backgroundColor: categoryColor + '30' }]}>
              <Text style={[styles.listCategoryText, { color: categoryColor }]}>{activity.categorie}</Text>
            </View>
            {isAlmostFull && (
              <View style={styles.urgentBadge}>
                <Text style={styles.urgentText}>Dernières places</Text>
              </View>
            )}
          </View>
          
          <Text style={styles.listTitle} numberOfLines={1}>{activity.nom}</Text>
          
          <View style={styles.listMeta}>
            {activity.date && (
              <View style={styles.metaItem}>
                <IconSymbol name="calendar" size={14} color={colors.textSecondary} />
                <Text style={styles.listMetaText}>{formatDate(activity.date)}</Text>
              </View>
            )}
            {activity.ville && (
              <View style={styles.metaItem}>
                <IconSymbol name="location.fill" size={14} color={colors.textSecondary} />
                <Text style={styles.listMetaText}>{activity.ville}</Text>
              </View>
            )}
          </View>

          {showHost && activity.host_name && (
            <TouchableOpacity style={styles.hostRow} onPress={handleHostPress}>
              <Image
                source={{ uri: activity.host_avatar || 'https://via.placeholder.com/24' }}
                style={styles.hostAvatar}
              />
              <Text style={styles.hostName}>{activity.host_name}</Text>
              {activity.host_is_business && (
                <IconSymbol name="checkmark.seal.fill" size={14} color={colors.primary} />
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.listRight}>
          <View style={styles.participantsCircle}>
            <Text style={[styles.participantsText, isFull && styles.fullText]}>
              {activity.participants}/{activity.max_participants}
            </Text>
          </View>
          {activity.prix !== undefined && activity.prix > 0 && (
            <Text style={styles.listPrice}>{activity.prix}€</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  // Variante full (carte complète)
  return (
    <TouchableOpacity
      style={styles.fullCard}
      onPress={handlePress}
      activeOpacity={0.9}
    >
      <Image
        source={{ uri: activity.image_url || 'https://via.placeholder.com/400' }}
        style={styles.fullImage}
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        style={styles.fullGradient}
      />

      {/* Badges en haut */}
      <View style={styles.topBadges}>
        <View style={[styles.categoryBadge, { backgroundColor: categoryColor }]}>
          <Text style={styles.categoryBadgeText}>{activity.categorie}</Text>
        </View>
        
        {showCompetitorBadge && isBusiness && (
          <View style={styles.competitorBadgeLarge}>
            <IconSymbol name="eye.fill" size={14} color={colors.background} />
            <Text style={styles.competitorBadgeLargeText}>Veille concurrentielle</Text>
          </View>
        )}

        {isFull && (
          <View style={styles.fullBadge}>
            <Text style={styles.fullBadgeText}>Complet</Text>
          </View>
        )}
      </View>

      {/* Prix */}
      {activity.prix !== undefined && activity.prix > 0 && (
        <View style={styles.fullPriceTag}>
          <Text style={styles.fullPriceText}>{activity.prix}€</Text>
        </View>
      )}

      {/* Contenu en bas */}
      <View style={styles.fullContent}>
        <Text style={styles.fullTitle} numberOfLines={2}>{activity.nom}</Text>
        
        <View style={styles.fullMeta}>
          {activity.date && (
            <View style={styles.fullMetaItem}>
              <IconSymbol name="calendar" size={16} color={colors.text} />
              <Text style={styles.fullMetaText}>
                {formatDate(activity.date)} {activity.time_start && `à ${activity.time_start}`}
              </Text>
            </View>
          )}
          {activity.ville && (
            <View style={styles.fullMetaItem}>
              <IconSymbol name="location.fill" size={16} color={colors.text} />
              <Text style={styles.fullMetaText}>{activity.ville}</Text>
            </View>
          )}
        </View>

        <View style={styles.fullBottom}>
          {showHost && activity.host_name && (
            <TouchableOpacity style={styles.fullHostRow} onPress={handleHostPress}>
              <Image
                source={{ uri: activity.host_avatar || 'https://via.placeholder.com/32' }}
                style={styles.fullHostAvatar}
              />
              <Text style={styles.fullHostName}>{activity.host_name}</Text>
              {activity.host_is_business && (
                <IconSymbol name="checkmark.seal.fill" size={16} color={colors.primary} />
              )}
            </TouchableOpacity>
          )}

          <View style={styles.fullParticipants}>
            <IconSymbol 
              name="person.2.fill" 
              size={16} 
              color={isFull ? colors.error : colors.primary} 
            />
            <Text style={[styles.fullParticipantsText, isFull && styles.fullText]}>
              {activity.participants}/{activity.max_participants}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Compact variant styles - Modern light theme
  compactCard: {
    width: (SCREEN_WIDTH - 52) / 2,
    height: 220,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.card,
    ...shadows.md,
  },
  compactImage: {
    width: '100%',
    height: '60%',
  },
  compactGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  compactBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  compactBadgeText: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    color: colors.textOnPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  competitorBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  competitorBadgeText: {
    fontSize: typography.xs - 1,
    fontWeight: typography.semibold,
    color: colors.textOnPrimary,
  },
  compactContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
    padding: spacing.md,
    backgroundColor: colors.card,
    justifyContent: 'space-between',
  },
  compactTitle: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  compactMeta: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    fontSize: typography.xs,
    color: colors.textSecondary,
  },
  priceTag: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    ...shadows.sm,
  },
  priceText: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
    color: colors.textOnPrimary,
  },

  // List variant styles - Modern light theme
  listCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  listImage: {
    width: 90,
    height: 90,
    borderRadius: borderRadius.md,
    backgroundColor: colors.borderLight,
  },
  listContent: {
    flex: 1,
    marginLeft: spacing.md,
    justifyContent: 'space-between',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  listCategoryBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  listCategoryText: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  urgentBadge: {
    backgroundColor: colors.errorLight + '40',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  urgentText: {
    fontSize: typography.xs - 1,
    fontWeight: typography.semibold,
    color: colors.error,
    textTransform: 'uppercase',
  },
  listTitle: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: colors.text,
    marginTop: spacing.xs,
  },
  listMeta: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  listMetaText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  hostAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.borderLight,
  },
  hostName: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  listRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginLeft: spacing.sm,
  },
  participantsCircle: {
    backgroundColor: colors.backgroundAccent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  participantsText: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.primary,
  },
  listPrice: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.primary,
    marginTop: spacing.sm,
  },

  // Full variant styles - Modern light theme with prominent image hero
  fullCard: {
    width: SCREEN_WIDTH - 32,
    height: 320,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    backgroundColor: colors.card,
    marginBottom: spacing.lg,
    ...shadows.lg,
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  fullGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  topBadges: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  categoryBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    ...shadows.sm,
  },
  categoryBadgeText: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.textOnPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  competitorBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    ...shadows.sm,
  },
  competitorBadgeLargeText: {
    fontSize: typography.xs,
    fontWeight: typography.semibold,
    color: colors.textOnPrimary,
  },
  fullBadge: {
    backgroundColor: colors.error,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    ...shadows.sm,
  },
  fullBadgeText: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.textOnPrimary,
    textTransform: 'uppercase',
  },
  fullPriceTag: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  fullPriceText: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    color: colors.textOnPrimary,
  },
  fullContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.98)', // Light semi-transparent background
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
  },
  fullTitle: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  fullMeta: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  fullMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fullMetaText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
  },
  fullBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  fullHostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fullHostAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.borderLight,
    borderWidth: 2,
    borderColor: colors.backgroundAlt,
  },
  fullHostName: {
    fontSize: typography.sm,
    color: colors.text,
    fontWeight: typography.medium,
  },
  fullParticipants: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.backgroundAccent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  fullParticipantsText: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.primary,
  },
  fullText: {
    color: colors.error,
  },
});