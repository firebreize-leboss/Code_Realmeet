// components/ActivityCard.tsx
// Carte d'activité moderne avec 3 variantes : compact, full, list

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
import { Calendar, MapPin, Users, Heart } from 'lucide-react-native';
import { colors, borderRadius, spacing, shadows, typography } from '@/styles/commonStyles';
import { LinearGradient } from 'expo-linear-gradient';
import { useBusinessRestrictions } from '@/hooks/useBusinessRestrictions';
import { PREDEFINED_CATEGORIES } from '@/constants/categories';
import { IconSymbol } from '@/components/IconSymbol';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Aurora Glow colors
const AURORA_BLUE = '#60A5FA';
const AURORA_VIOLET = '#818CF8';
const AURORA_PURPLE = '#C084FC';

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
  allDates?: string[];
}

interface ActivityCardProps {
  activity: Activity;
  variant?: 'full' | 'compact' | 'list';
  showHost?: boolean;
  showCompetitorBadge?: boolean;
  onLikePress?: () => void;
  isLiked?: boolean;
}

export default function ActivityCard({
  activity,
  variant = 'full',
  showHost = true,
  showCompetitorBadge = false,
  onLikePress,
  isLiked = false,
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

  const formatDateShort = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short'
    }).replace('.', '');
  };

  const formatPrice = (prix: number | undefined) => {
    if (prix === undefined || prix === 0) return 'Gratuit';
    return `${prix}€`;
  };

  const spotsLeft = activity.max_participants - activity.participants;
  const isFull = spotsLeft <= 0;
  const isAlmostFull = spotsLeft <= 3 && spotsLeft > 0;

  // =============================================
  // VARIANT: COMPACT (pour liste catégorie)
  // Design inspiré TooGoodToGo : image large + contenu en bas
  // =============================================
  if (variant === 'compact') {
    return (
      <TouchableOpacity
        style={styles.compactCard}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        {/* Zone image large */}
        <View style={styles.compactImageContainer}>
          <Image
            source={{ uri: activity.image_url || 'https://via.placeholder.com/400' }}
            style={styles.compactImage}
          />

          {/* Gradient overlay pour lisibilité */}
          <LinearGradient
            colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.3)']}
            style={styles.compactImageGradient}
          />

          {/* Badge places restantes - top left */}
          {spotsLeft <= 5 && spotsLeft > 0 && (
            <View style={styles.compactSpotsLeftBadge}>
              <Text style={styles.compactSpotsLeftText}>
                {spotsLeft === 1 ? '1 place' : `${spotsLeft} places`}
              </Text>
            </View>
          )}

          {/* Badge complet - top left */}
          {isFull && (
            <View style={styles.compactFullBadge}>
              <Text style={styles.compactFullText}>Complet</Text>
            </View>
          )}

          {/* Bouton like - top right */}
          {onLikePress && (
            <TouchableOpacity
              style={styles.compactLikeButton}
              onPress={onLikePress}
              activeOpacity={0.8}
            >
              <Heart
                size={18}
                color={isLiked ? '#EF4444' : '#6B7280'}
                fill={isLiked ? '#EF4444' : 'transparent'}
              />
            </TouchableOpacity>
          )}

          {/* Badge concurrent (pour entreprises) */}
          {showCompetitorBadge && isBusiness && canViewCompetitors && (
            <View style={styles.compactCompetitorBadge}>
              <IconSymbol name="eye.fill" size={10} color="#FFFFFF" />
              <Text style={styles.compactCompetitorText}>Concurrent</Text>
            </View>
          )}

          {/* Avatar host + nom en bas de l'image */}
          {showHost && (activity.host_avatar || activity.host_name) && (
            <TouchableOpacity
              style={styles.compactHostRow}
              onPress={handleHostPress}
              activeOpacity={0.8}
            >
              {activity.host_avatar && (
                <Image
                  source={{ uri: activity.host_avatar }}
                  style={styles.compactHostAvatar}
                />
              )}
              <Text style={styles.compactHostName} numberOfLines={1}>
                {activity.host_name || 'Organisateur'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Zone contenu blanche */}
        <View style={styles.compactContent}>
          {/* Titre de l'activité */}
          <Text style={styles.compactTitle} numberOfLines={1}>
            {activity.nom}
          </Text>

          {/* Dates en bulles */}
          {activity.allDates && activity.allDates.length > 0 ? (
            <View style={styles.compactDatesContainer}>
              <View style={styles.compactDateBubbles}>
                {activity.allDates.slice(0, 3).map((dateStr, index) => (
                  <View key={index} style={styles.compactDateBubble}>
                    <Calendar size={12} color={AURORA_VIOLET} />
                    <Text style={styles.compactDateBubbleText}>{formatDateShort(dateStr)}</Text>
                  </View>
                ))}
              </View>
              {activity.allDates.length > 3 && (
                <Text style={styles.compactMoreDates}>
                  +{activity.allDates.length - 3} autre{activity.allDates.length - 3 > 1 ? 's' : ''} date{activity.allDates.length - 3 > 1 ? 's' : ''}
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.compactDateRow}>
              <Calendar size={14} color="#6B7280" />
              <Text style={styles.compactDateText}>
                {activity.date ? formatDate(activity.date) : 'Date à définir'}
                {activity.time_start && ` · ${activity.time_start}`}
              </Text>
            </View>
          )}

          {/* Ligne du bas : lieu + participants | prix */}
          <View style={styles.compactBottomRow}>
            <View style={styles.compactLeftInfo}>
              {activity.ville && (
                <View style={styles.compactLocationRow}>
                  <MapPin size={13} color="#9CA3AF" />
                  <Text style={styles.compactLocationText} numberOfLines={1}>{activity.ville}</Text>
                </View>
              )}
              <View style={styles.compactParticipantsRow}>
                <Users size={13} color={AURORA_VIOLET} />
                <Text style={styles.compactParticipantsText}>
                  {activity.participants}/{activity.max_participants}
                </Text>
              </View>
            </View>

            {/* Prix à droite */}
            <View style={styles.compactPriceContainer}>
              <Text style={styles.compactPrice}>{formatPrice(activity.prix)}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // =============================================
  // VARIANT: LIST (overlay immersif)
  // Image full background + card flottante en bas
  // =============================================
  if (variant === 'list') {
    return (
      <TouchableOpacity
        style={styles.listCard}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        {/* Image full background */}
        <Image
          source={{ uri: activity.image_url || 'https://via.placeholder.com/400' }}
          style={styles.listImage}
        />

        {/* Gradient overlay */}
        <LinearGradient
          colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.2)', 'transparent']}
          style={styles.listGradient}
        />

        {/* Badge catégorie top */}
        <View style={styles.listCategoryBadge}>
          <Text style={styles.listCategoryText}>{activity.categorie}</Text>
        </View>

        {/* Bouton like top right */}
        {onLikePress && (
          <TouchableOpacity
            style={styles.listLikeButton}
            onPress={onLikePress}
            activeOpacity={0.8}
          >
            <Heart
              size={20}
              color={isLiked ? '#EF4444' : '#374151'}
              fill={isLiked ? '#EF4444' : 'transparent'}
            />
          </TouchableOpacity>
        )}

        {/* Card flottante bottom */}
        <View style={styles.listFloatingCard}>
          <Text style={styles.listTitle} numberOfLines={1}>{activity.nom}</Text>

          <View style={styles.listInfoLayout}>
            {/* Colonne gauche : date + lieu */}
            <View style={styles.listLeftColumn}>
              {activity.date && (
                <View style={styles.listMetaRow}>
                  <Calendar size={12} color="#374151" />
                  <Text style={styles.listMetaText}>{formatDate(activity.date)}</Text>
                </View>
              )}
              {activity.ville && (
                <View style={styles.listMetaRow}>
                  <MapPin size={12} color="#374151" />
                  <Text style={styles.listMetaText} numberOfLines={1}>{activity.ville}</Text>
                </View>
              )}
            </View>

            {/* Colonne droite : participants + prix */}
            <View style={styles.listRightColumn}>
              <View style={styles.listParticipantsBadge}>
                <Users size={12} color={AURORA_VIOLET} />
                <Text style={styles.listParticipantsText}>
                  {activity.participants}/{activity.max_participants}
                </Text>
              </View>
              <Text style={styles.listPrice}>{formatPrice(activity.prix)}</Text>
            </View>
          </View>
        </View>

        {/* Badge complet */}
        {isFull && (
          <View style={styles.listFullBadge}>
            <Text style={styles.listFullBadgeText}>Complet</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  // =============================================
  // VARIANT: FULL (feed principal)
  // Layout vertical : image 4/3 + contenu en bas
  // =============================================
  return (
    <TouchableOpacity
      style={styles.fullCard}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      {/* Image avec aspect ratio 4/3 */}
      <View style={styles.fullImageContainer}>
        <Image
          source={{ uri: activity.image_url || 'https://via.placeholder.com/400' }}
          style={styles.fullImage}
        />

        {/* Gradient subtil en bas de l'image */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.3)']}
          style={styles.fullImageGradient}
        />

        {/* Badges top */}
        <View style={styles.fullTopBadges}>
          {/* Badge catégorie */}
          <View style={styles.fullCategoryBadge}>
            <Text style={styles.fullCategoryText}>{activity.categorie}</Text>
          </View>

          {/* Badge prix */}
          <View style={styles.fullPriceBadge}>
            <Text style={styles.fullPriceBadgeText}>{formatPrice(activity.prix)}</Text>
          </View>
        </View>

        {/* Bouton like */}
        {onLikePress && (
          <TouchableOpacity
            style={styles.fullLikeButton}
            onPress={onLikePress}
            activeOpacity={0.8}
          >
            <Heart
              size={20}
              color={isLiked ? '#EF4444' : '#374151'}
              fill={isLiked ? '#EF4444' : 'transparent'}
            />
          </TouchableOpacity>
        )}

        {/* Badge complet */}
        {isFull && (
          <View style={styles.fullFullBadge}>
            <Text style={styles.fullFullBadgeText}>Complet</Text>
          </View>
        )}

        {/* Badge concurrent (pour entreprises) */}
        {showCompetitorBadge && isBusiness && canViewCompetitors && (
          <View style={styles.fullCompetitorBadge}>
            <IconSymbol name="eye.fill" size={12} color="#FFFFFF" />
            <Text style={styles.fullCompetitorText}>Veille</Text>
          </View>
        )}
      </View>

      {/* Zone contenu bas */}
      <View style={styles.fullContent}>
        {/* Titre */}
        <Text style={styles.fullTitle} numberOfLines={1}>{activity.nom}</Text>

        {/* Métadonnées en ligne */}
        <View style={styles.fullMeta}>
          {activity.date && (
            <View style={styles.fullMetaItem}>
              <Calendar size={12} color="#4B5563" />
              <Text style={styles.fullMetaText}>{formatDate(activity.date)}</Text>
            </View>
          )}
          {activity.ville && (
            <View style={styles.fullMetaItem}>
              <MapPin size={12} color="#4B5563" />
              <Text style={styles.fullMetaText} numberOfLines={1}>{activity.ville}</Text>
            </View>
          )}
          <View style={[styles.fullMetaItem, styles.fullMetaParticipants]}>
            <Users size={12} color={AURORA_PURPLE} />
            <Text style={styles.fullMetaParticipantsText}>
              {activity.participants}/{activity.max_participants}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // =============================================
  // COMPACT VARIANT STYLES (Design TooGoodToGo)
  // =============================================
  compactCard: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  compactImageContainer: {
    width: '100%',
    height: 140,
    position: 'relative',
  },
  compactImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  compactImageGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  compactSpotsLeftBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#111827',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  compactSpotsLeftText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  compactFullBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  compactFullText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  compactLikeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  compactCompetitorBadge: {
    position: 'absolute',
    top: 12,
    left: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  compactCompetitorText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  compactHostRow: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactHostAvatar: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  compactHostName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  compactContent: {
    padding: 14,
  },
  compactTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  compactDatesContainer: {
    marginBottom: 10,
  },
  compactDateBubbles: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
  },
  compactDateBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  compactDateBubbleText: {
    fontSize: 12,
    fontWeight: '600',
    color: AURORA_VIOLET,
  },
  compactMoreDates: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 6,
    fontStyle: 'italic',
  },
  compactDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  compactDateText: {
    fontSize: 13,
    color: '#6B7280',
  },
  compactBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactLeftInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  compactLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactLocationText: {
    fontSize: 12,
    color: '#9CA3AF',
    maxWidth: 100,
  },
  compactParticipantsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactParticipantsText: {
    fontSize: 12,
    fontWeight: '600',
    color: AURORA_VIOLET,
  },
  compactPriceContainer: {
    alignItems: 'flex-end',
  },
  compactPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: AURORA_VIOLET,
  },

  // =============================================
  // LIST VARIANT STYLES
  // =============================================
  listCard: {
    height: 208,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  listImage: {
    ...StyleSheet.absoluteFillObject,
    resizeMode: 'cover',
  },
  listGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  listCategoryBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  listCategoryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  listLikeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listFloatingCard: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 14,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  listInfoLayout: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  listLeftColumn: {
    flexDirection: 'column',
    gap: 6,
    flex: 1,
  },
  listMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  listMetaText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  listRightColumn: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 6,
  },
  listParticipantsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  listParticipantsText: {
    fontSize: 12,
    fontWeight: '700',
    color: AURORA_VIOLET,
  },
  listPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  listFullBadge: {
    position: 'absolute',
    top: 16,
    left: 100,
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  listFullBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // =============================================
  // FULL VARIANT STYLES
  // =============================================
  fullCard: {
    width: SCREEN_WIDTH - 32,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  fullImageContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    position: 'relative',
  },
  fullImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  fullImageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
  },
  fullTopBadges: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    gap: 8,
  },
  fullCategoryBadge: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  fullCategoryText: {
    fontSize: 12,
    fontWeight: '700',
    color: AURORA_VIOLET,
  },
  fullPriceBadge: {
    backgroundColor: AURORA_VIOLET,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  fullPriceBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  fullLikeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullFullBadge: {
    position: 'absolute',
    top: 12,
    right: 56,
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  fullFullBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  fullCompetitorBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  fullCompetitorText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  fullContent: {
    padding: 16,
  },
  fullTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  fullMeta: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  fullMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fullMetaText: {
    fontSize: 12,
    color: '#4B5563',
  },
  fullMetaParticipants: {
    marginLeft: 'auto',
  },
  fullMetaParticipantsText: {
    fontSize: 12,
    fontWeight: '600',
    color: AURORA_PURPLE,
  },
});
