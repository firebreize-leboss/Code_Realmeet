// components/ReviewsCarousel.tsx
// Carrousel d'avis qui défile automatiquement

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 80;
const AUTO_SCROLL_INTERVAL = 4000; // 4 secondes

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  activity_id: string;
  activity_name?: string;
  reviewer_name?: string;
  reviewer_avatar?: string;
}

interface ReviewsCarouselProps {
  businessId: string;
  onPressReview?: (activityId: string) => void;
}

export default function ReviewsCarousel({ businessId, onPressReview }: ReviewsCarouselProps) {
  const router = useRouter();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadReviews();
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [businessId]);

  useEffect(() => {
    if (reviews.length > 1) {
      startAutoScroll();
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [reviews]);

  const loadReviews = async () => {
    try {
      // Récupérer les avis des activités de ce business
      const { data: activitiesData } = await supabase
        .from('activities')
        .select('id, nom')
        .eq('host_id', businessId);

      if (!activitiesData || activitiesData.length === 0) {
        setLoading(false);
        return;
      }

      const activityIds = activitiesData.map(a => a.id);
      const activityNames = new Map(activitiesData.map(a => [a.id, a.nom]));

      const { data: reviewsData, error } = await supabase
        .from('reviews')
        .select(`
          id,
          rating,
          comment,
          created_at,
          activity_id,
          profiles:reviewer_id (
            full_name,
            avatar_url
          )
        `)
        .in('activity_id', activityIds)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const formattedReviews: Review[] = (reviewsData || []).map((r: any) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        created_at: r.created_at,
        activity_id: r.activity_id,
        activity_name: activityNames.get(r.activity_id) || 'Activité',
        reviewer_name: r.profiles?.full_name || 'Utilisateur',
        reviewer_avatar: r.profiles?.avatar_url,
      }));

      setReviews(formattedReviews);
    } catch (error) {
      console.error('Erreur chargement avis:', error);
    } finally {
      setLoading(false);
    }
  };

  const startAutoScroll = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      // Animation de fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        // Changer l'index
        setCurrentIndex(prev => (prev + 1) % reviews.length);
        
        // Animation de fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }, AUTO_SCROLL_INTERVAL);
  };

  const handlePress = () => {
    if (reviews[currentIndex]) {
      if (onPressReview) {
        onPressReview(reviews[currentIndex].activity_id);
      } else {
        router.push(`/activity-detail?id=${reviews[currentIndex].activity_id}`);
      }
    }
  };

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <IconSymbol
          key={i}
          name={i <= rating ? 'star.fill' : 'star'}
          size={14}
          color={i <= rating ? '#FFD700' : colors.textSecondary}
        />
      );
    }
    return stars;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return null;
  }

  if (reviews.length === 0) {
    return null;
  }

  const currentReview = reviews[currentIndex];

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.9}
    >
      <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
        {/* Header avec étoiles */}
        <View style={styles.header}>
          <View style={styles.stars}>
            {renderStars(currentReview.rating)}
          </View>
          <Text style={styles.date}>{formatDate(currentReview.created_at)}</Text>
        </View>

        {/* Commentaire */}
        {currentReview.comment ? (
          <Text style={styles.comment} numberOfLines={3}>
            "{currentReview.comment}"
          </Text>
        ) : (
          <Text style={styles.noComment}>Aucun commentaire</Text>
        )}

        {/* Footer avec nom et activité */}
        <View style={styles.footer}>
          <Text style={styles.reviewerName}>— {currentReview.reviewer_name}</Text>
          <Text style={styles.activityName} numberOfLines={1}>
            {currentReview.activity_name}
          </Text>
        </View>

        {/* Indicateurs de pagination */}
        {reviews.length > 1 && (
          <View style={styles.pagination}>
            {reviews.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.paginationDot,
                  index === currentIndex && styles.paginationDotActive,
                ]}
              />
            ))}
          </View>
        )}

        {/* Lien vers plus d'avis */}
        <View style={styles.linkRow}>
          <Text style={styles.linkText}>Voir tous les avis</Text>
          <IconSymbol name="chevron.right" size={14} color={colors.primary} />
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  date: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  comment: {
    fontSize: 15,
    color: colors.text,
    fontStyle: 'italic',
    lineHeight: 22,
    marginBottom: 12,
  },
  noComment: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewerName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  activityName: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  paginationDotActive: {
    backgroundColor: colors.primary,
    width: 18,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
});