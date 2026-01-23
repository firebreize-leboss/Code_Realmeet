// app/business-profile.tsx
// Profil public d'une entreprise visible par les utilisateurs

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Linking,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import ReviewsCarousel from '@/components/ReviewsCarousel';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COVER_HEIGHT = 180;

interface BusinessProfile {
  id: string;
  business_name: string;
  business_description: string;
  business_category: string;
  business_logo_url: string;
  business_cover_url: string;
  business_address: string;
  business_phone: string;
  business_email: string;
  business_website: string;
  business_verified: boolean;
  business_rating: number;
  business_review_count: number;
  business_hours: Record<string, { open: string; close: string; closed?: boolean }>;
  business_social_links: { instagram?: string; facebook?: string; twitter?: string };
}

interface Activity {
  id: string;
  nom: string;
  description: string;
  image_url: string;
  categorie: string;
  prix: number;
  participants: number;
  max_participants: number;
  next_date?: string;
}

export default function BusinessPublicProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'activities' | 'info'>('activities');

  useEffect(() => {
    loadBusinessProfile();
  }, [id]);

  const loadBusinessProfile = async () => {
    try {
      // Charger le profil entreprise
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select(`
          id,
          business_name,
          business_description,
          business_category,
          business_logo_url,
          business_cover_url,
          business_address,
          business_phone,
          business_email,
          business_website,
          business_verified,
          business_rating,
          business_review_count,
          business_hours,
          business_social_links,
          avatar_url
        `)
        .eq('id', id)
        .eq('account_type', 'business')
        .single();

      if (profileError) throw profileError;

      setBusiness({
        ...profileData,
        business_logo_url: profileData.business_logo_url || profileData.avatar_url || '',
      });

      // Charger les activités de l'entreprise
      const { data: activitiesData } = await supabase
        .from('activities')
        .select(`
          id,
          nom,
          description,
          image_url,
          categorie,
          prix,
          participants,
          max_participants
        `)
        .eq('host_id', id)
        .order('created_at', { ascending: false });

      // Pour chaque activité, récupérer le prochain créneau disponible
      const activitiesWithDates = await Promise.all(
        (activitiesData || []).map(async (activity) => {
          const { data: nextSlot } = await supabase
            .from('activity_slots')
            .select('date')
            .eq('activity_id', activity.id)
            .gte('date', new Date().toISOString().split('T')[0])
            .order('date', { ascending: true })
            .limit(1)
            .maybeSingle();

          return {
            ...activity,
            next_date: nextSlot?.date,
          };
        })
      );

      setActivities(activitiesWithDates);
    } catch (error) {
      console.error('Erreur chargement profil entreprise:', error);
    } finally {
      setLoading(false);
    }
  };

  const openLink = (url: string) => {
    if (url) {
      const fullUrl = url.startsWith('http') ? url : `https://${url}`;
      Linking.openURL(fullUrl);
    }
  };

  const callPhone = (phone: string) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  };

  const sendEmail = (email: string) => {
    if (email) {
      Linking.openURL(`mailto:${email}`);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <IconSymbol
          key={i}
          name={i <= rating ? 'star.fill' : 'star'}
          size={16}
          color={i <= rating ? '#FFD700' : colors.textSecondary}
        />
      );
    }
    return stars;
  };

  const renderActivityCard = ({ item }: { item: Activity }) => (
    <TouchableOpacity
      style={styles.activityCard}
      onPress={() => router.push(`/activity-detail?id=${item.id}`)}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: item.image_url || 'https://via.placeholder.com/160' }}
        style={styles.activityImage}
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={styles.activityGradient}
      />
      <View style={styles.activityContent}>
        <View style={styles.activityBadge}>
          <Text style={styles.activityBadgeText}>{item.categorie}</Text>
        </View>
        <Text style={styles.activityTitle} numberOfLines={2}>{item.nom}</Text>
        <View style={styles.activityMeta}>
          {item.next_date && (
            <View style={styles.activityMetaItem}>
              <IconSymbol name="calendar" size={12} color={colors.text} />
              <Text style={styles.activityMetaText}>{formatDate(item.next_date)}</Text>
            </View>
          )}
          <View style={styles.activityMetaItem}>
            <IconSymbol name="person.2.fill" size={12} color={colors.text} />
            <Text style={styles.activityMetaText}>
              {item.participants}/{item.max_participants}
            </Text>
          </View>
        </View>
        {item.prix > 0 && (
          <Text style={styles.activityPrice}>{item.prix}€</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!business) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <IconSymbol name="exclamationmark.triangle" size={48} color={colors.error} />
          <Text style={styles.errorText}>Entreprise introuvable</Text>
          <TouchableOpacity style={styles.backButtonAlt} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Cover Image */}
        <View style={styles.coverContainer}>
          <Image
            source={{ uri: business.business_cover_url || 'https://via.placeholder.com/400x180' }}
            style={styles.coverImage}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.3)', 'transparent', 'rgba(0,0,0,0.5)']}
            style={styles.coverGradient}
          />
          <SafeAreaView style={styles.headerOverlay} edges={['top']}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <IconSymbol name="chevron.left" size={24} color={colors.text} />
            </TouchableOpacity>
          </SafeAreaView>
        </View>

        {/* Profile Info */}
        <View style={styles.profileSection}>
          <View style={styles.logoContainer}>
            <Image
              source={{ uri: business.business_logo_url || 'https://via.placeholder.com/100' }}
              style={styles.logo}
            />
            {business.business_verified && (
              <View style={styles.verifiedBadge}>
                <IconSymbol name="checkmark.seal.fill" size={20} color={colors.primary} />
              </View>
            )}
          </View>

          <Text style={styles.businessName}>{business.business_name}</Text>
          
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{business.business_category}</Text>
          </View>

          {/* Rating */}
          <View style={styles.ratingContainer}>
            <View style={styles.stars}>
              {renderStars(Math.round(business.business_rating || 0))}
            </View>
            <Text style={styles.ratingText}>
              {business.business_rating?.toFixed(1) || '0.0'} ({business.business_review_count || 0} avis)
            </Text>
          </View>

          {/* Carrousel d'avis */}
          {business.business_review_count > 0 && (
            <TouchableOpacity
              onPress={() => router.push(`/business-reviews?id=${business.id}&name=${encodeURIComponent(business.business_name || '')}`)}
              activeOpacity={0.9}
            >
              <ReviewsCarousel 
                businessId={business.id}
              />
            </TouchableOpacity>
          )}

          {/* Quick Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{activities.length}</Text>
              <Text style={styles.statLabel}>Activités</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {activities.reduce((sum, a) => sum + a.participants, 0)}
              </Text>
              <Text style={styles.statLabel}>Participants</Text>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.actionsRow}>
            {business.business_phone && (
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => callPhone(business.business_phone)}
              >
                <IconSymbol name="phone.fill" size={20} color={colors.primary} />
                <Text style={styles.actionText}>Appeler</Text>
              </TouchableOpacity>
            )}
            {business.business_email && (
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => sendEmail(business.business_email)}
              >
                <IconSymbol name="envelope.fill" size={20} color={colors.primary} />
                <Text style={styles.actionText}>Email</Text>
              </TouchableOpacity>
            )}
            {business.business_website && (
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => openLink(business.business_website)}
              >
                <IconSymbol name="globe" size={20} color={colors.primary} />
                <Text style={styles.actionText}>Site web</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'activities' && styles.activeTab]}
            onPress={() => setActiveTab('activities')}
          >
            <Text style={[styles.tabText, activeTab === 'activities' && styles.activeTabText]}>
              Activités ({activities.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'info' && styles.activeTab]}
            onPress={() => setActiveTab('info')}
          >
            <Text style={[styles.tabText, activeTab === 'info' && styles.activeTabText]}>
              Informations
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'activities' ? (
          <View style={styles.activitiesGrid}>
            {activities.length === 0 ? (
              <View style={styles.emptyActivities}>
                <IconSymbol name="calendar.badge.exclamationmark" size={48} color={colors.textSecondary} />
                <Text style={styles.emptyText}>Aucune activité proposée</Text>
              </View>
            ) : (
              <FlatList
                data={activities}
                renderItem={renderActivityCard}
                keyExtractor={item => item.id}
                numColumns={2}
                scrollEnabled={false}
                columnWrapperStyle={styles.activitiesRow}
                contentContainerStyle={styles.activitiesContent}
              />
            )}
          </View>
        ) : (
          <View style={styles.infoSection}>
            {/* Description */}
            {business.business_description && (
              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>À propos</Text>
                <Text style={styles.infoDescription}>{business.business_description}</Text>
              </View>
            )}

            {/* Adresse */}
            {business.business_address && (
              <TouchableOpacity 
                style={styles.infoRow}
                onPress={() => openLink(`https://maps.google.com/?q=${encodeURIComponent(business.business_address)}`)}
              >
                <View style={styles.infoIcon}>
                  <IconSymbol name="location.fill" size={20} color={colors.primary} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Adresse</Text>
                  <Text style={styles.infoValue}>{business.business_address}</Text>
                </View>
                <IconSymbol name="arrow.up.right" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            )}

            {/* Réseaux sociaux */}
            {business.business_social_links && Object.keys(business.business_social_links).length > 0 && (
              <View style={styles.socialSection}>
                <Text style={styles.socialTitle}>Réseaux sociaux</Text>
                <View style={styles.socialLinks}>
                  {business.business_social_links.instagram && (
                    <TouchableOpacity 
                      style={styles.socialButton}
                      onPress={() => openLink(`https://instagram.com/${business.business_social_links.instagram}`)}
                    >
                      <Text style={styles.socialIcon}>📷</Text>
                      <Text style={styles.socialText}>Instagram</Text>
                    </TouchableOpacity>
                  )}
                  {business.business_social_links.facebook && (
                    <TouchableOpacity 
                      style={styles.socialButton}
                      onPress={() => openLink(`https://facebook.com/${business.business_social_links.facebook}`)}
                    >
                      <Text style={styles.socialIcon}>👤</Text>
                      <Text style={styles.socialText}>Facebook</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Bottom Spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: colors.text,
    marginTop: 16,
  },
  backButtonAlt: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 20,
  },
  backButtonText: {
    color: colors.background,
    fontWeight: '600',
  },
  coverContainer: {
    height: COVER_HEIGHT,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: -50,
  },
  logoContainer: {
    position: 'relative',
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: colors.background,
    backgroundColor: colors.card,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 2,
  },
  businessName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: 12,
    textAlign: 'center',
  },
  categoryBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
    marginHorizontal: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginTop: 24,
    marginHorizontal: 20,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.background,
  },
  activitiesGrid: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  activitiesRow: {
    justifyContent: 'space-between',
  },
  activitiesContent: {
    gap: 12,
  },
  activityCard: {
    width: (SCREEN_WIDTH - 52) / 2,
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  activityImage: {
    width: '100%',
    height: '100%',
  },
  activityGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  activityContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
  },
  activityBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 6,
  },
  activityBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.background,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  activityMeta: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  activityMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activityMetaText: {
    fontSize: 11,
    color: colors.text,
  },
  activityPrice: {
    position: 'absolute',
    top: -160,
    right: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: '700',
    color: colors.background,
  },
  emptyActivities: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 12,
  },
  infoSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  infoDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 15,
    color: colors.text,
    marginTop: 2,
  },
  socialSection: {
    marginTop: 8,
  },
  socialTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  socialLinks: {
    flexDirection: 'row',
    gap: 12,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  socialIcon: {
    fontSize: 18,
  },
  socialText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
});