// app/(tabs)/profile.tsx
// Profile screen with conditional rendering for user/business accounts
// MODIFIÉ: Ajout de personality_tags

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { PersonalityTagsBadges } from '@/components/PersonalityTagsBadges'; // NOUVEAU
import { colors, commonStyles } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface UserProfile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  interests: string[] | null;
  personality_tags: string[] | null; // NOUVEAU
  account_type: 'user' | 'business';
  business_name?: string;
  business_description?: string;
  business_category?: string;
  business_website?: string;
  business_phone?: string;
  business_email?: string;
  business_address?: string;
  business_logo_url?: string;
  business_cover_url?: string;
  business_verified?: boolean;
  business_rating?: number;
  business_review_count?: number;
  business_hours?: Record<string, { open: string; close: string }>;
  business_social_links?: { instagram?: string; facebook?: string; twitter?: string };
}

interface DashboardData {
  total_activities: number;
  active_activities: number;
  total_participants: number;
  total_revenue: number;
  avg_rating: number;
  review_count: number;
  monthly_stats: Array<{
    date: string;
    views: number;
    activity_views: number;
    total_participants: number;
    total_revenue: number;
  }>;
  top_activities: Array<{
    id: string;
    nom: string;
    image_url: string;
    participants: number;
    max_participants: number;
    prix: number;
    date: string;
  }>;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activitiesJoined, setActivitiesJoined] = useState(0);
  const [activitiesHosted, setActivitiesHosted] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setProfile(data);

      if (data?.account_type === 'business') {
        await loadBusinessDashboard(user.id);
      } else {
        await loadUserStats(user.id);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserStats = async (userId: string) => {
    setLoadingStats(true);
    try {
      const { count: joined } = await supabase
        .from('slot_participants')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      const { count: hosted } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('host_id', userId);

      setActivitiesJoined(joined || 0);
      setActivitiesHosted(hosted || 0);
    } catch (error) {
      console.error('Error loading user stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const loadBusinessDashboard = async (businessId: string) => {
    setLoadingStats(true);
    try {
      // Charger les stats de base
      const { count: totalActivities } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('host_id', businessId);

      const { count: activeActivities } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('host_id', businessId)
        .eq('status', 'active');

      // Récupérer les activités pour calculer les participants
      const { data: activities } = await supabase
        .from('activities')
        .select('id, participants, prix')
        .eq('host_id', businessId);

      const totalParticipants = activities?.reduce((sum, a) => sum + (a.participants || 0), 0) || 0;
      const totalRevenue = activities?.reduce((sum, a) => sum + ((a.participants || 0) * (a.prix || 0)), 0) || 0;

      // Top activités
      const { data: topActivities } = await supabase
        .from('activities')
        .select('id, titre, image_url, participants, max_participants, prix, date')
        .eq('host_id', businessId)
        .order('participants', { ascending: false })
        .limit(5);

      setDashboardData({
        total_activities: totalActivities || 0,
        active_activities: activeActivities || 0,
        total_participants: totalParticipants,
        total_revenue: totalRevenue,
        avg_rating: profile?.business_rating || 0,
        review_count: profile?.business_review_count || 0,
        monthly_stats: [],
        top_activities: topActivities || [],
      });
    } catch (error) {
      console.error('Error loading basic business stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={commonStyles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Not connected state
  if (!profile) {
    return (
      <SafeAreaView style={commonStyles.container} edges={['top']}>
        <View style={styles.notConnectedContainer}>
          <IconSymbol name="person.crop.circle" size={80} color={colors.textSecondary} />
          <Text style={styles.notConnectedTitle}>Non connecté</Text>
          <Text style={styles.notConnectedText}>
            Connectez-vous pour accéder à votre profil et rejoindre des activités
          </Text>
          <TouchableOpacity
            style={styles.connectButton}
            onPress={() => router.push('/auth/account-type')}
          >
            <Text style={styles.connectButtonText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Render business profile
  if (profile.account_type === 'business') {
    return (
      <BusinessProfileView
        profile={profile}
        dashboardData={dashboardData}
        loadingStats={loadingStats}
        selectedPeriod={selectedPeriod}
        setSelectedPeriod={setSelectedPeriod}
        refreshing={refreshing}
        onRefresh={onRefresh}
        router={router}
      />
    );
  }

  // Render user profile
  return (
    <SafeAreaView style={commonStyles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity
          onPress={() => router.push('/settings')}
          style={styles.settingsButton}
        >
          <IconSymbol name="gear" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.profileHeader}>
          <Image
            source={{ uri: profile.avatar_url || 'https://via.placeholder.com/120' }}
            style={styles.avatar}
          />
          <Text style={styles.name}>{profile.full_name || profile.username}</Text>
          <View style={styles.locationRow}>
            <IconSymbol name="location.fill" size={16} color={colors.textSecondary} />
            <Text style={styles.city}>{profile.city || 'Ville non renseignée'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <Text style={styles.bio}>{profile.bio || 'Aucune bio renseignée'}</Text>
          </View>
        </View>

        {/* NOUVEAU: Section Personnalité */}
        {profile.personality_tags && profile.personality_tags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personnalité</Text>
            <PersonalityTagsBadges tags={profile.personality_tags} />
          </View>
        )}

        {profile.interests && profile.interests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Interests</Text>
            <View style={styles.interestsContainer}>
              {profile.interests.map((interest, index) => (
                <View key={index} style={styles.interestBadge}>
                  <Text style={styles.interestText}>{interest}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stats</Text>
          {loadingStats ? (
            <View style={styles.statsLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : (
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{activitiesJoined}</Text>
                <Text style={styles.statLabel}>Activities Joined</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{activitiesHosted}</Text>
                <Text style={styles.statLabel}>Activities Hosted</Text>
              </View>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.editButton}
          onPress={() => router.push('/edit-profile')}
        >
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================
// BUSINESS PROFILE VIEW COMPONENT
// ============================================

interface BusinessProfileViewProps {
  profile: UserProfile;
  dashboardData: DashboardData | null;
  loadingStats: boolean;
  selectedPeriod: '7d' | '30d' | '90d';
  setSelectedPeriod: (period: '7d' | '30d' | '90d') => void;
  refreshing: boolean;
  onRefresh: () => void;
  router: any;
}

function BusinessProfileView({
  profile,
  dashboardData,
  loadingStats,
  selectedPeriod,
  setSelectedPeriod,
  refreshing,
  onRefresh,
  router,
}: BusinessProfileViewProps) {

  return (
    <SafeAreaView style={commonStyles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.businessHeader}>
        <View style={styles.businessHeaderLeft}>
          <Text style={styles.headerTitle}>Dashboard</Text>
          {profile.business_verified && (
            <View style={styles.verifiedBadge}>
              <IconSymbol name="checkmark.seal.fill" size={14} color="#10B981" />
              <Text style={styles.verifiedText}>Vérifié</Text>
            </View>
          )}
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => router.push('/create-activity')}
          >
            <IconSymbol name="plus" size={20} color={colors.background} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/settings')}
            style={styles.settingsButton}
          >
            <IconSymbol name="gear" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.businessContentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Business Profile Card */}
        <View style={styles.businessProfileCard}>
          {profile.business_cover_url && (
            <Image
              source={{ uri: profile.business_cover_url }}
              style={styles.coverImage}
            />
          )}
          <View style={styles.businessProfileContent}>
            <Image
              source={{ uri: profile.business_logo_url || profile.avatar_url || 'https://via.placeholder.com/80' }}
              style={styles.businessLogo}
            />
            <View style={styles.businessInfo}>
              <Text style={styles.businessName}>
                {profile.business_name || profile.full_name}
              </Text>
              {profile.business_category && (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{profile.business_category}</Text>
                </View>
              )}
              {profile.business_rating !== undefined && profile.business_rating > 0 && (
                <View style={styles.ratingRow}>
                  <IconSymbol name="star.fill" size={16} color="#F59E0B" />
                  <Text style={styles.ratingText}>
                    {profile.business_rating.toFixed(1)} ({profile.business_review_count} avis)
                  </Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity
            style={styles.editBusinessButton}
            onPress={() => router.push('/edit-business-profile')}
          >
            <IconSymbol name="pencil" size={16} color={colors.primary} />
            <Text style={styles.editBusinessText}>Modifier</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Stats Cards */}
        <View style={styles.quickStatsGrid}>
          <View style={[styles.quickStatCard, { backgroundColor: '#6366F120' }]}>
            <IconSymbol name="calendar" size={24} color="#6366F1" />
            <Text style={styles.quickStatValue}>
              {dashboardData?.active_activities || 0}
            </Text>
            <Text style={styles.quickStatLabel}>Activités actives</Text>
          </View>
          <View style={[styles.quickStatCard, { backgroundColor: '#10B98120' }]}>
            <IconSymbol name="person.2.fill" size={24} color="#10B981" />
            <Text style={styles.quickStatValue}>
              {dashboardData?.total_participants || 0}
            </Text>
            <Text style={styles.quickStatLabel}>Participants</Text>
          </View>
          <View style={[styles.quickStatCard, { backgroundColor: '#F59E0B20' }]}>
            <IconSymbol name="star.fill" size={24} color="#F59E0B" />
            <Text style={styles.quickStatValue}>
              {dashboardData?.avg_rating?.toFixed(1) || '0.0'}
            </Text>
            <Text style={styles.quickStatLabel}>Note moyenne</Text>
          </View>
          <View style={[styles.quickStatCard, { backgroundColor: '#EC489920' }]}>
            <IconSymbol name="dollarsign.circle.fill" size={24} color="#EC4899" />
            <Text style={styles.quickStatValue}>
              {(dashboardData?.total_revenue || 0).toFixed(0)}€
            </Text>
            <Text style={styles.quickStatLabel}>Revenus</Text>
          </View>
        </View>

        {/* Period Selector */}
        <View style={styles.periodSelector}>
          {(['7d', '30d', '90d'] as const).map((period) => (
            <TouchableOpacity
              key={period}
              style={[
                styles.periodButton,
                selectedPeriod === period && styles.periodButtonActive,
              ]}
              onPress={() => setSelectedPeriod(period)}
            >
              <Text
                style={[
                  styles.periodButtonText,
                  selectedPeriod === period && styles.periodButtonTextActive,
                ]}
              >
                {period === '7d' ? '7 jours' : period === '30d' ? '30 jours' : '90 jours'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Stats Summary Card */}
        <View style={styles.chartSection}>
          <Text style={styles.chartTitle}>Résumé des performances</Text>
          {loadingStats ? (
            <View style={styles.chartLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : (
            <View style={styles.performanceSummary}>
              <View style={styles.performanceRow}>
                <Text style={styles.performanceLabel}>Total activités</Text>
                <Text style={styles.performanceValue}>{dashboardData?.total_activities || 0}</Text>
              </View>
              <View style={styles.performanceRow}>
                <Text style={styles.performanceLabel}>Activités actives</Text>
                <Text style={styles.performanceValue}>{dashboardData?.active_activities || 0}</Text>
              </View>
              <View style={styles.performanceRow}>
                <Text style={styles.performanceLabel}>Total participants</Text>
                <Text style={styles.performanceValue}>{dashboardData?.total_participants || 0}</Text>
              </View>
              <View style={[styles.performanceRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.performanceLabel}>Revenus totaux</Text>
                <Text style={styles.performanceValue}>{(dashboardData?.total_revenue || 0).toFixed(0)}€</Text>
              </View>
            </View>
          )}
        </View>

        {/* About Section */}
        {profile.business_description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>À propos</Text>
            <View style={styles.card}>
              <Text style={styles.businessDescription}>{profile.business_description}</Text>
            </View>
          </View>
        )}

        {/* Contact Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact</Text>
          <View style={styles.card}>
            {profile.business_address && (
              <View style={styles.contactRow}>
                <IconSymbol name="location.fill" size={18} color={colors.primary} />
                <Text style={styles.contactText}>{profile.business_address}</Text>
              </View>
            )}
            {profile.business_phone && (
              <View style={styles.contactRow}>
                <IconSymbol name="phone.fill" size={18} color={colors.primary} />
                <Text style={styles.contactText}>{profile.business_phone}</Text>
              </View>
            )}
            {profile.business_email && (
              <View style={styles.contactRow}>
                <IconSymbol name="envelope.fill" size={18} color={colors.primary} />
                <Text style={styles.contactText}>{profile.business_email}</Text>
              </View>
            )}
            {profile.business_website && (
              <View style={styles.contactRow}>
                <IconSymbol name="globe" size={18} color={colors.primary} />
                <Text style={[styles.contactText, styles.linkText]}>{profile.business_website}</Text>
              </View>
            )}
            {!profile.business_address && !profile.business_phone && !profile.business_email && !profile.business_website && (
              <Text style={styles.emptyText}>Aucune information de contact</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  // Loading & Empty States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  notConnectedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  notConnectedTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  notConnectedText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  connectButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },

  // Header
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
  settingsButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ScrollView
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 100 : 120,
  },

  // User Profile
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  city: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
  },
  bio: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  interestText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  statsLoading: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  editButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },

  // Business Profile Styles
  businessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  businessHeaderLeft: {
    flexDirection: 'column',
    gap: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  createButton: {
    backgroundColor: colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10B98120',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  businessContentContainer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 100 : 120,
  },
  businessProfileCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  coverImage: {
    width: '100%',
    height: 100,
  },
  businessProfileContent: {
    flexDirection: 'row',
    padding: 16,
    gap: 16,
  },
  businessLogo: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  businessInfo: {
    flex: 1,
    paddingTop: 8,
  },
  businessName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  categoryBadge: {
    backgroundColor: colors.secondary + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.secondary,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  editBusinessButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.background,
  },
  editBusinessText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  quickStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  quickStatCard: {
    width: (SCREEN_WIDTH - 52) / 2,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  quickStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  quickStatLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  periodButtonActive: {
    backgroundColor: colors.primary,
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  periodButtonTextActive: {
    color: colors.background,
  },
  chartSection: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  chartLoading: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  performanceSummary: {
    gap: 12,
  },
  performanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  performanceLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  performanceValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  businessDescription: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  contactText: {
    fontSize: 15,
    color: colors.text,
    flex: 1,
  },
  linkText: {
    color: colors.primary,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
});