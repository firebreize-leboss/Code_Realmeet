// app/business-reviews.tsx
// Page de tous les avis d'une entreprise avec filtrage par étoiles

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  activity_id: string;
  activity_name: string;
  reviewer_id: string;
  reviewer_name: string;
  reviewer_avatar: string | null;
}

interface RatingStats {
  average: number;
  total: number;
  distribution: { [key: number]: number };
}

export default function BusinessReviewsScreen() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams();
  const businessId = id as string;
  const businessName = name ? decodeURIComponent(name as string) : 'Entreprise';

  const [reviews, setReviews] = useState<Review[]>([]);
  const [filteredReviews, setFilteredReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<number | null>(null);
  const [ratingStats, setRatingStats] = useState<RatingStats>({
    average: 0,
    total: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  });

  useEffect(() => {
    loadReviews();
  }, [businessId]);

  useEffect(() => {
    if (selectedFilter === null) {
      setFilteredReviews(reviews);
    } else {
      setFilteredReviews(reviews.filter(r => r.rating === selectedFilter));
    }
  }, [selectedFilter, reviews]);

  const loadReviews = async () => {
    try {
      setLoading(true);

      // Récupérer toutes les activités de l'entreprise
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

      // Récupérer tous les avis
      const { data: reviewsData, error } = await supabase
        .from('reviews')
        .select(`
          id,
          rating,
          comment,
          created_at,
          activity_id,
          reviewer_id,
          profiles:reviewer_id (
            full_name,
            avatar_url
          )
        `)
        .in('activity_id', activityIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedReviews: Review[] = (reviewsData || []).map((r: any) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        created_at: r.created_at,
        activity_id: r.activity_id,
        activity_name: activityNames.get(r.activity_id) || 'Activité',
        reviewer_id: r.reviewer_id,
        reviewer_name: r.profiles?.full_name || 'Utilisateur',
        reviewer_avatar: r.profiles?.avatar_url,
      }));

      setReviews(formattedReviews);
      setFilteredReviews(formattedReviews);

      // Calculer les statistiques
      const distribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let totalRating = 0;

      formattedReviews.forEach(r => {
        distribution[r.rating] = (distribution[r.rating] || 0) + 1;
        totalRating += r.rating;
      });

      setRatingStats({
        average: formattedReviews.length > 0 ? totalRating / formattedReviews.length : 0,
        total: formattedReviews.length,
        distribution,
      });
    } catch (error) {
      console.error('Erreur chargement avis:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number, size: number = 16) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <IconSymbol
          key={i}
          name={i <= rating ? 'star.fill' : 'star'}
          size={size}
          color={i <= rating ? '#F59E0B' : colors.border}
        />
      );
    }
    return stars;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const renderFilterButton = (stars: number | null, label: string) => {
    const count = stars === null ? ratingStats.total : ratingStats.distribution[stars] || 0;
    const isSelected = selectedFilter === stars;

    return (
      <TouchableOpacity
        key={stars}
        style={[styles.filterButton, isSelected && styles.filterButtonSelected]}
        onPress={() => setSelectedFilter(stars)}
        disabled={count === 0 && stars !== null}
      >
        {stars !== null && (
          <IconSymbol name="star.fill" size={14} color={isSelected ? colors.background : '#F59E0B'} />
        )}
        <Text style={[
          styles.filterButtonText,
          isSelected && styles.filterButtonTextSelected,
          count === 0 && stars !== null && styles.filterButtonTextDisabled,
        ]}>
          {label}
        </Text>
        <View style={[styles.filterCount, isSelected && styles.filterCountSelected]}>
          <Text style={[styles.filterCountText, isSelected && styles.filterCountTextSelected]}>
            {count}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderReview = ({ item }: { item: Review }) => (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <TouchableOpacity
          style={styles.reviewerInfo}
          onPress={() => router.push(`/user-profile?id=${item.reviewer_id}`)}
        >
          <Image
            source={{ uri: item.reviewer_avatar || 'https://via.placeholder.com/40' }}
            style={styles.reviewerAvatar}
          />
          <View>
            <Text style={styles.reviewerName}>{item.reviewer_name}</Text>
            <Text style={styles.reviewDate}>{formatDate(item.created_at)}</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.reviewRating}>
          {renderStars(item.rating, 14)}
        </View>
      </View>

      {item.comment && (
        <Text style={styles.reviewComment}>{item.comment}</Text>
      )}

      <TouchableOpacity
        style={styles.activityLink}
        onPress={() => router.push(`/activity-detail?id=${item.activity_id}`)}
      >
        <IconSymbol name="figure.run" size={14} color={colors.primary} />
        <Text style={styles.activityLinkText}>{item.activity_name}</Text>
        <IconSymbol name="chevron.right" size={14} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.headerContent}>
      {/* Résumé des notes */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryLeft}>
          <Text style={styles.averageRating}>{ratingStats.average.toFixed(1)}</Text>
          <View style={styles.averageStars}>
            {renderStars(Math.round(ratingStats.average), 20)}
          </View>
          <Text style={styles.totalReviews}>{ratingStats.total} avis</Text>
        </View>

        <View style={styles.summaryRight}>
          {[5, 4, 3, 2, 1].map(stars => {
            const count = ratingStats.distribution[stars] || 0;
            const percentage = ratingStats.total > 0 ? (count / ratingStats.total) * 100 : 0;

            return (
              <View key={stars} style={styles.distributionRow}>
                <Text style={styles.distributionStars}>{stars}</Text>
                <IconSymbol name="star.fill" size={12} color="#F59E0B" />
                <View style={styles.distributionBarContainer}>
                  <View style={[styles.distributionBar, { width: `${percentage}%` }]} />
                </View>
                <Text style={styles.distributionCount}>{count}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Filtres */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersContainer}
      >
        {renderFilterButton(null, 'Tous')}
        {renderFilterButton(5, '5')}
        {renderFilterButton(4, '4')}
        {renderFilterButton(3, '3')}
        {renderFilterButton(2, '2')}
        {renderFilterButton(1, '1')}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : reviews.length === 0 ? (
        <View style={styles.emptyContainer}>
          <IconSymbol name="star" size={64} color={colors.textSecondary} />
          <Text style={styles.emptyText}>Aucun avis pour le moment</Text>
        </View>
      ) : (
        <FlatList
          data={filteredReviews}
          renderItem={renderReview}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.noResultsContainer}>
              <Text style={styles.noResultsText}>
                Aucun avis avec {selectedFilter} étoile{selectedFilter !== 1 ? 's' : ''}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  listContent: {
    paddingBottom: 40,
  },
  headerContent: {
    paddingBottom: 16,
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    margin: 16,
    borderRadius: 16,
    padding: 20,
    gap: 24,
  },
  summaryLeft: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 20,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  averageRating: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.text,
  },
  averageStars: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 4,
  },
  totalReviews: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
  },
  summaryRight: {
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  distributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  distributionStars: {
    fontSize: 12,
    color: colors.textSecondary,
    width: 12,
    textAlign: 'right',
  },
  distributionBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  distributionBar: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 4,
  },
  distributionCount: {
    fontSize: 12,
    color: colors.textSecondary,
    width: 24,
    textAlign: 'right',
  },
  filtersContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  filterButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  filterButtonTextSelected: {
    color: colors.background,
  },
  filterButtonTextDisabled: {
    color: colors.textSecondary,
  },
  filterCount: {
    backgroundColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  filterCountSelected: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  filterCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterCountTextSelected: {
    color: colors.background,
  },
  reviewCard: {
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  reviewerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.border,
  },
  reviewerName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  reviewDate: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  reviewRating: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewComment: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
    marginBottom: 12,
  },
  activityLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary + '10',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  activityLinkText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.primary,
    flex: 1,
  },
  noResultsContainer: {
    padding: 40,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
});