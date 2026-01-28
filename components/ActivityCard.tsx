// components/ActivityCard.tsx
// Carte d'activité premium - Design calme, hiérarchie claire
// Palette: Blanc, Gris, Noir, Orange désaturé

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

// Design tokens - Orange uniquement comme accent
const ACCENT_ORANGE = colors.primary; // #D97B4A
const ACCENT_MUTED = colors.primaryMuted; // #C4886A (prix, non-aguicheur)
const TEXT_PRIMARY = colors.text; // #1C1C1E (titres)
const TEXT_SECONDARY = colors.textSecondary; // #48484A (descriptions)
const TEXT_TERTIARY = colors.textTertiary; // #8E8E93 (lieu, participants)
const TEXT_MUTED = colors.textMuted; // #AEAEB2 (dates, hints)
const BG_SUBTLE = colors.borderSubtle; // #F2F2F7 (badges discrets)

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
  // VARIANT: COMPACT - Design Premium Calme
  // Hiérarchie: Titre (noir) > Prix (orange muted) > Date (gris) > Lieu (gris clair)
  // =============================================
  if (variant === 'compact') {
    return (
      <TouchableOpacity
        style={styles.compactCard}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        {/* Zone image avec overlay uniforme */}
        <View style={styles.compactImageContainer}>
          <Image
            source={{ uri: activity.image_url || 'https://via.placeholder.com/400' }}
            style={styles.compactImage}
          />

          {/* Overlay uniforme noir 25% pour calmer l'image */}
          <View style={styles.compactImageOverlay} />

          {/* Badge places restantes - discret */}
          {spotsLeft <= 5 && spotsLeft > 0 && (
            <View style={styles.compactSpotsLeftBadge}>
              <Text style={styles.compactSpotsLeftText}>
                {spotsLeft === 1 ? '1 place' : `${spotsLeft} places`}
              </Text>
            </View>
          )}

          {/* Badge complet */}
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
                size={16}
                color={isLiked ? colors.error : TEXT_TERTIARY}
                fill={isLiked ? colors.error : 'transparent'}
              />
            </TouchableOpacity>
          )}

          {/* Badge concurrent */}
          {showCompetitorBadge && isBusiness && canViewCompetitors && (
            <View style={styles.compactCompetitorBadge}>
              <IconSymbol name="eye.fill" size={10} color="#FFFFFF" />
              <Text style={styles.compactCompetitorText}>Concurrent</Text>
            </View>
          )}

          {/* Host en bas de l'image */}
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

        {/* Zone contenu - hiérarchie claire */}
        <View style={styles.compactContent}>
          {/* 1. Titre - noir/gris foncé, le plus important */}
          <Text style={styles.compactTitle} numberOfLines={1}>
            {activity.nom}
          </Text>

          {/* 2. Prix - orange désaturé, second niveau */}
          <Text style={styles.compactPrice}>{formatPrice(activity.prix)}</Text>

          {/* 3. Dates - badges discrets gris très clair */}
          {activity.allDates && activity.allDates.length > 0 ? (
            <View style={styles.compactDatesContainer}>
              <View style={styles.compactDateBubbles}>
                {activity.allDates.slice(0, 3).map((dateStr, index) => (
                  <View key={index} style={styles.compactDateBubble}>
                    <Text style={styles.compactDateBubbleText}>{formatDateShort(dateStr)}</Text>
                  </View>
                ))}
                {activity.allDates.length > 3 && (
                  <Text style={styles.compactMoreDates}>+{activity.allDates.length - 3}</Text>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.compactDateRow}>
              <Calendar size={12} color={TEXT_MUTED} />
              <Text style={styles.compactDateText}>
                {activity.date ? formatDate(activity.date) : 'Date à définir'}
              </Text>
            </View>
          )}

          {/* 4. Lieu + participants - gris clair, niveau tertiaire */}
          <View style={styles.compactBottomRow}>
            {activity.ville && (
              <View style={styles.compactLocationRow}>
                <MapPin size={12} color={TEXT_MUTED} />
                <Text style={styles.compactLocationText} numberOfLines={1}>{activity.ville}</Text>
              </View>
            )}
            <View style={styles.compactParticipantsRow}>
              <Users size={12} color={TEXT_MUTED} />
              <Text style={styles.compactParticipantsText}>
                {activity.participants}/{activity.max_participants}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // =============================================
  // VARIANT: LIST - Design Premium avec overlay
  // =============================================
  if (variant === 'list') {
    return (
      <TouchableOpacity
        style={styles.listCard}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        {/* Image full background */}
        <Image
          source={{ uri: activity.image_url || 'https://via.placeholder.com/400' }}
          style={styles.listImage}
        />

        {/* Overlay uniforme noir 25% */}
        <View style={styles.listOverlay} />

        {/* Badge catégorie - discret */}
        <View style={styles.listCategoryBadge}>
          <Text style={styles.listCategoryText}>{activity.categorie}</Text>
        </View>

        {/* Bouton like */}
        {onLikePress && (
          <TouchableOpacity
            style={styles.listLikeButton}
            onPress={onLikePress}
            activeOpacity={0.8}
          >
            <Heart
              size={18}
              color={isLiked ? colors.error : TEXT_SECONDARY}
              fill={isLiked ? colors.error : 'transparent'}
            />
          </TouchableOpacity>
        )}

        {/* Card flottante - hiérarchie claire */}
        <View style={styles.listFloatingCard}>
          <Text style={styles.listTitle} numberOfLines={1}>{activity.nom}</Text>

          <View style={styles.listInfoLayout}>
            <View style={styles.listLeftColumn}>
              {activity.date && (
                <View style={styles.listMetaRow}>
                  <Calendar size={11} color={TEXT_MUTED} />
                  <Text style={styles.listMetaText}>{formatDate(activity.date)}</Text>
                </View>
              )}
              {activity.ville && (
                <View style={styles.listMetaRow}>
                  <MapPin size={11} color={TEXT_MUTED} />
                  <Text style={styles.listMetaText} numberOfLines={1}>{activity.ville}</Text>
                </View>
              )}
            </View>

            <View style={styles.listRightColumn}>
              <View style={styles.listParticipantsBadge}>
                <Users size={11} color={TEXT_TERTIARY} />
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
  // VARIANT: FULL - Design Premium Feed
  // =============================================
  return (
    <TouchableOpacity
      style={styles.fullCard}
      onPress={handlePress}
      activeOpacity={0.9}
    >
      {/* Image avec overlay uniforme */}
      <View style={styles.fullImageContainer}>
        <Image
          source={{ uri: activity.image_url || 'https://via.placeholder.com/400' }}
          style={styles.fullImage}
        />

        {/* Overlay uniforme noir 25% */}
        <View style={styles.fullImageOverlay} />

        {/* Badges top - discrets */}
        <View style={styles.fullTopBadges}>
          <View style={styles.fullCategoryBadge}>
            <Text style={styles.fullCategoryText}>{activity.categorie}</Text>
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
              size={18}
              color={isLiked ? colors.error : TEXT_SECONDARY}
              fill={isLiked ? colors.error : 'transparent'}
            />
          </TouchableOpacity>
        )}

        {/* Badge complet */}
        {isFull && (
          <View style={styles.fullFullBadge}>
            <Text style={styles.fullFullBadgeText}>Complet</Text>
          </View>
        )}

        {/* Badge concurrent */}
        {showCompetitorBadge && isBusiness && canViewCompetitors && (
          <View style={styles.fullCompetitorBadge}>
            <IconSymbol name="eye.fill" size={11} color="#FFFFFF" />
            <Text style={styles.fullCompetitorText}>Veille</Text>
          </View>
        )}
      </View>

      {/* Zone contenu - hiérarchie claire */}
      <View style={styles.fullContent}>
        {/* 1. Titre - noir */}
        <Text style={styles.fullTitle} numberOfLines={1}>{activity.nom}</Text>

        {/* 2. Prix - orange désaturé */}
        <Text style={styles.fullPrice}>{formatPrice(activity.prix)}</Text>

        {/* 3. Métadonnées - gris */}
        <View style={styles.fullMeta}>
          {activity.date && (
            <View style={styles.fullMetaItem}>
              <Calendar size={11} color={TEXT_MUTED} />
              <Text style={styles.fullMetaText}>{formatDate(activity.date)}</Text>
            </View>
          )}
          {activity.ville && (
            <View style={styles.fullMetaItem}>
              <MapPin size={11} color={TEXT_MUTED} />
              <Text style={styles.fullMetaText} numberOfLines={1}>{activity.ville}</Text>
            </View>
          )}
          <View style={[styles.fullMetaItem, styles.fullMetaParticipants]}>
            <Users size={11} color={TEXT_MUTED} />
            <Text style={styles.fullMetaParticipantsText}>
              {activity.participants}/{activity.max_participants}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// =====================================================
// STYLES PREMIUM - Design calme, cohérent, orange accent
// =====================================================
const styles = StyleSheet.create({
  // =============================================
  // COMPACT VARIANT - Premium Design
  // =============================================
  compactCard: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.backgroundAlt,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  compactImageContainer: {
    width: '100%',
    height: 130,
    position: 'relative',
  },
  compactImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  compactImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  compactSpotsLeftBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  compactSpotsLeftText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  compactFullBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: colors.error,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  compactFullText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  compactLikeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactCompetitorBadge: {
    position: 'absolute',
    top: 10,
    left: 90,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: ACCENT_MUTED,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
  },
  compactCompetitorText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  compactHostRow: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactHostAvatar: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: BG_SUBTLE,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  compactHostName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  compactContent: {
    padding: 12,
  },
  // 1. Titre - noir/gris foncé (priorité 1)
  compactTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  // 2. Prix - orange désaturé (priorité 2)
  compactPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: ACCENT_MUTED,
    marginBottom: 8,
  },
  // 3. Dates - badges discrets (priorité 3)
  compactDatesContainer: {
    marginBottom: 8,
  },
  compactDateBubbles: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 6,
    alignItems: 'center',
  },
  compactDateBubble: {
    backgroundColor: BG_SUBTLE,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  compactDateBubbleText: {
    fontSize: 11,
    fontWeight: '500',
    color: TEXT_TERTIARY,
  },
  compactMoreDates: {
    fontSize: 11,
    color: TEXT_MUTED,
    fontWeight: '500',
  },
  compactDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  compactDateText: {
    fontSize: 12,
    color: TEXT_TERTIARY,
  },
  // 4. Lieu + participants - gris clair (priorité 4)
  compactBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  compactLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  compactLocationText: {
    fontSize: 12,
    color: TEXT_MUTED,
    maxWidth: 120,
  },
  compactParticipantsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  compactParticipantsText: {
    fontSize: 12,
    fontWeight: '500',
    color: TEXT_MUTED,
  },

  // =============================================
  // LIST VARIANT - Premium Design
  // =============================================
  listCard: {
    height: 200,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  listImage: {
    ...StyleSheet.absoluteFillObject,
    resizeMode: 'cover',
  },
  listOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  listCategoryBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  listCategoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  listLikeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listFloatingCard: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 12,
    borderRadius: 10,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  listInfoLayout: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  listLeftColumn: {
    flexDirection: 'column',
    gap: 4,
    flex: 1,
  },
  listMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listMetaText: {
    fontSize: 11,
    fontWeight: '500',
    color: TEXT_TERTIARY,
  },
  listRightColumn: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
  },
  listParticipantsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: BG_SUBTLE,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  listParticipantsText: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_TERTIARY,
  },
  listPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: ACCENT_MUTED,
  },
  listFullBadge: {
    position: 'absolute',
    top: 12,
    left: 90,
    backgroundColor: colors.error,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  listFullBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // =============================================
  // FULL VARIANT - Premium Design
  // =============================================
  fullCard: {
    width: SCREEN_WIDTH - 32,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.backgroundAlt,
    marginBottom: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
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
  fullImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  fullTopBadges: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    gap: 6,
  },
  fullCategoryBadge: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  fullCategoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  fullLikeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullFullBadge: {
    position: 'absolute',
    top: 12,
    right: 52,
    backgroundColor: colors.error,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  fullFullBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  fullCompetitorBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ACCENT_MUTED,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  fullCompetitorText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  fullContent: {
    padding: 14,
  },
  // 1. Titre - priorité 1
  fullTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  // 2. Prix - priorité 2
  fullPrice: {
    fontSize: 17,
    fontWeight: '700',
    color: ACCENT_MUTED,
    marginBottom: 10,
  },
  // 3. Métadonnées - priorité 3
  fullMeta: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  fullMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  fullMetaText: {
    fontSize: 12,
    color: TEXT_TERTIARY,
  },
  fullMetaParticipants: {
    marginLeft: 'auto',
  },
  fullMetaParticipantsText: {
    fontSize: 12,
    fontWeight: '500',
    color: TEXT_MUTED,
  },
});
