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
import { colors } from '@/styles/commonStyles';
import { LinearGradient } from 'expo-linear-gradient';
import { useBusinessRestrictions } from '@/hooks/useBusinessRestrictions';

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
        <View style={styles.compactBadge}>
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
            <View style={styles.listCategoryBadge}>
              <Text style={styles.listCategoryText}>{activity.categorie}</Text>
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
        <View style={styles.categoryBadge}>
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
  // Compact variant styles
  compactCard: {
    width: (SCREEN_WIDTH - 52) / 2,
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  compactImage: {
    width: '100%',
    height: '100%',
  },
  compactGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  compactBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  compactBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.background,
  },
  competitorBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FF9500',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  competitorBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.background,
  },
  compactContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  compactMeta: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: colors.text,
  },
  priceTag: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priceText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.background,
  },

  // List variant styles
  listCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  listImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: colors.border,
  },
  listContent: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listCategoryBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  listCategoryText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary,
  },
  urgentBadge: {
    backgroundColor: colors.error + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  urgentText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.error,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 4,
  },
  listMeta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  listMetaText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  hostAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.border,
  },
  hostName: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  listRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 8,
  },
  participantsCircle: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  participantsText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  listPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 8,
  },

  // Full variant styles
  fullCard: {
    width: SCREEN_WIDTH - 40,
    height: 280,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.card,
    marginBottom: 16,
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
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    gap: 8,
  },
  categoryBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.background,
  },
  competitorBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FF9500',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  competitorBadgeLargeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.background,
  },
  fullBadge: {
    backgroundColor: colors.error,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  fullBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.background,
  },
  fullPriceTag: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  fullPriceText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.background,
  },
  fullContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  fullTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  fullMeta: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
  },
  fullMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fullMetaText: {
    fontSize: 13,
    color: colors.text,
  },
  fullBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  fullHostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fullHostAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
  },
  fullHostName: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },
  fullParticipants: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  fullParticipantsText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  fullText: {
    color: colors.error,
  },
});