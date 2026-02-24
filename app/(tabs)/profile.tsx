// app/(tabs)/profile.tsx
// Profile screen with modern Tinder-like design
// Uses same design system as chat.tsx (gradient header, modern cards)

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
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { PersonalityTagsBadges } from '@/components/PersonalityTagsBadges';
import { colors, commonStyles } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';
import { getIntentionInfo } from '@/lib/database.types';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface UserProfile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  interests: string[] | null;
  personality_tags: string[] | null;
  intention?: string;
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
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activitiesJoined, setActivitiesJoined] = useState(0);
  const [activitiesHosted, setActivitiesHosted] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [devInviteCode, setDevInviteCode] = useState('');

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
      const { data, error } = await supabase.rpc('get_user_profile_stats', {
        p_user_id: userId
      } as any) as { data: any; error: any };

      if (error) {
        console.error('RPC get_user_profile_stats error:', error);
        // Fallback: compter uniquement les activités PASSÉES (slot terminé)
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const nowTime = now.toTimeString().slice(0, 5);

        // Récupérer les participations de l'utilisateur
        const { data: participations } = await supabase
          .from('slot_participants')
          .select('slot_id')
          .eq('user_id', userId)
          .in('status', ['active', 'completed']);

        let pastActivitiesCount = 0;
        if (participations && participations.length > 0) {
          const slotIds = participations.map(p => p.slot_id);

          // Compter les slots passés
          const { count } = await supabase
            .from('activity_slots')
            .select('*', { count: 'exact', head: true })
            .in('id', slotIds)
            .or(`date.lt.${todayStr},and(date.eq.${todayStr},time.lt.${nowTime})`);

          pastActivitiesCount = count || 0;
        }

        const { count: hosted } = await supabase
          .from('activities')
          .select('*', { count: 'exact', head: true })
          .eq('host_id', userId);

        setActivitiesJoined(pastActivitiesCount);
        setActivitiesHosted(hosted || 0);
      } else if (data && data.length > 0) {
        setActivitiesJoined(data[0].activities_joined || 0);
        setActivitiesHosted(data[0].activities_hosted || 0);
      }
    } catch (error) {
      console.error('Error loading user stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const loadBusinessDashboard = async (businessId: string) => {
    setLoadingStats(true);
    try {
      const { data, error } = await supabase.rpc('get_business_dashboard', {
        p_business_id: businessId
      } as any) as { data: any; error: any };

      if (error) {
        console.error('RPC get_business_dashboard error:', error);
        await loadBusinessDashboardFallback(businessId);
        return;
      }

      if (data && data.length > 0) {
        const dashboardRow = data[0];
        setDashboardData({
          total_activities: dashboardRow.total_activities || 0,
          active_activities: dashboardRow.active_activities || 0,
          total_participants: dashboardRow.total_participants || 0,
          total_revenue: dashboardRow.total_revenue || 0,
          avg_rating: dashboardRow.avg_rating || 0,
          review_count: dashboardRow.review_count || 0,
          monthly_stats: [],
          top_activities: dashboardRow.top_activities || [],
        });
      }
    } catch (error) {
      console.error('Error loading business dashboard:', error);
      await loadBusinessDashboardFallback(businessId);
    } finally {
      setLoadingStats(false);
    }
  };

  const loadBusinessDashboardFallback = async (businessId: string) => {
    try {
      const { count: totalActivities } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('host_id', businessId);

      const { count: activeActivities } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('host_id', businessId)
        .eq('status', 'active');

      const { data: activities } = await supabase
        .from('activities')
        .select('id, participants, prix')
        .eq('host_id', businessId);

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const nowTime = now.toTimeString().slice(0, 5);

      const activityIdsForStats = activities?.map((a: any) => a.id) || [];
      let totalParticipants = 0;
      let totalRevenue = 0;

      if (activityIdsForStats.length > 0) {
        const { data: pastSlots } = await supabase
          .from('activity_slots')
          .select('id, activity_id')
          .in('activity_id', activityIdsForStats)
          .or(`date.lt.${todayStr},and(date.eq.${todayStr},time.lt.${nowTime})`);

        const pastSlotIds = pastSlots?.map((s: any) => s.id) || [];

        if (pastSlotIds.length > 0) {
          const { count } = await supabase
            .from('slot_participants')
            .select('*', { count: 'exact', head: true })
            .in('slot_id', pastSlotIds)
            .in('status', ['active', 'completed']);

          totalParticipants = count || 0;

          const slotActivityMap = new Map(pastSlots?.map((s: any) => [s.id, s.activity_id]) || []);
          const activityPrices = new Map(activities?.map((a: any) => [a.id, a.prix || 0]) || []);

          const { data: participantsData } = await supabase
            .from('slot_participants')
            .select('slot_id')
            .in('slot_id', pastSlotIds)
            .in('status', ['active', 'completed']);

          totalRevenue = (participantsData || []).reduce((sum: number, p: any) => {
            const activityId = slotActivityMap.get(p.slot_id);
            const price = activityId ? activityPrices.get(activityId) || 0 : 0;
            return sum + price;
          }, 0);
        }
      }

      const { data: topActivities } = await supabase
        .from('activities')
        .select('id, titre, image_url, participants, max_participants, prix, date')
        .eq('host_id', businessId)
        .order('participants', { ascending: false })
        .limit(5);

      const activityIds = activities?.map((a: any) => a.id) || [];
      let reviewCount = 0;
      let avgRating = 0;

      if (activityIds.length > 0) {
        const { data: reviewsData } = await supabase
          .from('reviews')
          .select('rating')
          .in('activity_id', activityIds);

        reviewCount = reviewsData?.length || 0;
        if (reviewCount > 0) {
          avgRating = reviewsData!.reduce((sum: number, r: any) => sum + r.rating, 0) / reviewCount;
        }
      }

      setDashboardData({
        total_activities: totalActivities || 0,
        active_activities: activeActivities || 0,
        total_participants: totalParticipants,
        total_revenue: totalRevenue,
        avg_rating: avgRating,
        review_count: reviewCount,
        monthly_stats: [],
        top_activities: topActivities || [],
      });
    } catch (error) {
      console.error('Error loading business dashboard fallback:', error);
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
      <LinearGradient
        colors={['#FFFFFF', '#FFFFFF', '#FFFBF7', colors.primaryLight]}
        style={styles.container}
      >
        <SafeAreaView style={styles.loadingContainer} edges={['top']}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.userLoadingText}>Chargement...</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Not connected state
  if (!profile) {
    return (
      <LinearGradient
        colors={['#FFFFFF', '#FFFFFF', '#FFFBF7', colors.primaryLight]}
        style={styles.container}
      >
        <SafeAreaView style={styles.notConnectedContainer} edges={['top']}>
          <IconSymbol name="person.crop.circle" size={80} color={colors.primary} />
          <Text style={styles.userNotConnectedTitle}>Non connecté</Text>
          <Text style={styles.userNotConnectedText}>
            Connectez-vous pour accéder à votre profil
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/auth/account-type')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.userConnectButton}
            >
              <Text style={styles.userConnectButtonText}>Se connecter</Text>
            </LinearGradient>
          </TouchableOpacity>
        </SafeAreaView>
      </LinearGradient>
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

  // Render user profile (Clean peach gradient design)
  const intentionInfo = profile.intention ? getIntentionInfo(profile.intention) : null;

  return (
    <LinearGradient
      colors={['#FFFFFF', '#FFFFFF', '#FFFBF7', colors.primaryLight]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header minimaliste */}
        <View style={styles.userHeader}>
          <TouchableOpacity
            onPress={() => router.push('/settings')}
            style={styles.userHeaderButton}
          >
            <IconSymbol name="gear" size={22} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <View
          style={[styles.scrollView, styles.userContentContainer]}
        >
          {/* Profile Header Section */}
          <View style={styles.userProfileHeader}>
            <View style={styles.userAvatarContainer}>
              <Image
                source={{ uri: profile.avatar_url || 'https://via.placeholder.com/100' }}
                style={styles.userAvatar}
              />
              <TouchableOpacity
                style={styles.userEditBadge}
                onPress={() => router.push('/edit-profile')}
              >
                <IconSymbol name="pencil" size={12} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.userProfileName}>{profile.full_name || profile.username}</Text>

            {profile.city && (
              <View style={styles.userLocationRow}>
                <IconSymbol name="location.fill" size={14} color="#6B7280" />
                <Text style={styles.userLocationText}>{profile.city}</Text>
              </View>
            )}

            {/* Bouton modifier le profil */}
            <TouchableOpacity
              style={styles.userEditProfileButton}
              onPress={() => router.push('/edit-profile')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.userEditProfileGradient}
              >
                <Text style={styles.userEditProfileText}>Modifier le profil</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Stats & Intention Row */}
          {loadingStats ? (
            <View style={styles.userStatsIntentionRow}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : (
            <TouchableOpacity
              style={styles.userStatsIntentionRow}
              onPress={() => router.push('/my-participated-activities')}
              activeOpacity={0.7}
            >
              <View style={styles.userStatItem}>
                <Text style={styles.userStatValue}>{activitiesJoined}</Text>
                <Text style={styles.userStatLabel}>Activités</Text>
              </View>

              <View style={styles.userStatSeparator} />

              {intentionInfo && (
                <View style={styles.userIntentionItem}>
                  <IconSymbol name={intentionInfo.icon as any} size={18} color={colors.primary} />
                  <Text style={styles.userIntentionLabel}>{intentionInfo.label}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          {/* Bio Card */}
          {profile.bio && (
            <View style={styles.userBioCard}>
              <Text style={styles.userBioTitle}>Ma Bio</Text>
              <Text style={styles.userBioText}>{profile.bio}</Text>
            </View>
          )}

          {/* Intérêts */}
          {profile.interests && profile.interests.length > 0 && (
            <View style={styles.userInterestsContainer}>
              {profile.interests.map((interest, index) => (
                <View key={index} style={styles.userInterestTag}>
                  <Text style={styles.userInterestText}>{interest}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ===== DEV: Tester invitation — À SUPPRIMER ===== */}
          <View style={styles.devInviteContainer}>
            <Text style={styles.devInviteLabel}>Dev - Tester un lien invitation</Text>
            <View style={styles.devInviteRow}>
              <TextInput
                style={styles.devInviteInput}
                placeholder="Code invitation..."
                placeholderTextColor="#9CA3AF"
                value={devInviteCode}
                onChangeText={setDevInviteCode}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.devInviteButton}
                onPress={() => {
                  if (devInviteCode.trim()) {
                    router.push(`/invite/${devInviteCode.trim()}`);
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.devInviteButtonText}>Tester</Text>
              </TouchableOpacity>
            </View>
          </View>
          {/* ===== FIN DEV ===== */}
        </View>
      </SafeAreaView>
    </LinearGradient>
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
    <View style={styles.bizContainer}>
      <SafeAreaView style={styles.bizSafeArea} edges={['top']}>
        {/* Header minimaliste blanc */}
        <View style={styles.bizHeader}>
          <View style={styles.bizHeaderLeft}>
            {profile.business_verified && (
              <View style={styles.bizVerifiedBadge}>
                <IconSymbol name="checkmark.seal.fill" size={12} color={colors.primary} />
                <Text style={styles.bizVerifiedText}>Vérifié</Text>
              </View>
            )}
          </View>
          <Text style={styles.bizHeaderTitle}>Dashboard</Text>
          <TouchableOpacity
            onPress={() => router.push('/settings')}
            style={styles.bizHeaderButton}
          >
            <IconSymbol name="gear" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.bizScrollView}
          contentContainerStyle={styles.bizContentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {/* Business Profile Section */}
          <View style={styles.bizProfileSection}>
            <Image
              source={{ uri: profile.business_logo_url || profile.avatar_url || 'https://via.placeholder.com/80' }}
              style={styles.bizLogo}
            />
            <Text style={styles.bizName}>
              {profile.business_name || profile.full_name}
            </Text>
            {profile.business_category && (
              <View style={styles.bizCategoryBadge}>
                <Text style={styles.bizCategoryText}>{profile.business_category}</Text>
              </View>
            )}
            {profile.business_rating !== undefined && profile.business_rating > 0 && (
              <TouchableOpacity
                style={styles.bizRatingRow}
                onPress={() => router.push(`/business-reviews?id=${profile.id}&name=${encodeURIComponent(profile.business_name || '')}`)}
              >
                <IconSymbol name="star.fill" size={14} color={colors.primary} />
                <Text style={styles.bizRatingText}>
                  {profile.business_rating.toFixed(1)} ({profile.business_review_count} avis)
                </Text>
                <IconSymbol name="chevron.right" size={12} color="#9CA3AF" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.bizEditButton}
              onPress={() => router.push('/edit-business-profile')}
              activeOpacity={0.8}
            >
              <Text style={styles.bizEditButtonText}>Modifier le profil</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Stats Row */}
          <View style={styles.bizStatsRow}>
            <View style={styles.bizStatItem}>
              <Text style={styles.bizStatValue}>{dashboardData?.total_activities || 0}</Text>
              <Text style={styles.bizStatLabel}>Activités</Text>
            </View>
            <View style={styles.bizStatDivider} />
            <View style={styles.bizStatItem}>
              <Text style={styles.bizStatValue}>{dashboardData?.total_participants || 0}</Text>
              <Text style={styles.bizStatLabel}>Participants</Text>
            </View>
            <View style={styles.bizStatDivider} />
            <TouchableOpacity
              style={styles.bizStatItem}
              onPress={() => router.push(`/business-reviews?id=${profile.id}&name=${encodeURIComponent(profile.business_name || '')}`)}
            >
              <Text style={styles.bizStatValue}>{dashboardData?.review_count || 0}</Text>
              <Text style={styles.bizStatLabel}>Avis</Text>
            </TouchableOpacity>
            <View style={styles.bizStatDivider} />
            <View style={styles.bizStatItem}>
              <Text style={styles.bizStatValueAccent}>{(dashboardData?.total_revenue || 0).toFixed(0)}€</Text>
              <Text style={styles.bizStatLabel}>Revenus</Text>
            </View>
          </View>

          {/* Period Selector */}
          <View style={styles.bizPeriodSelector}>
            {(['7d', '30d', '90d'] as const).map((period) => (
              <TouchableOpacity
                key={period}
                onPress={() => setSelectedPeriod(period)}
                style={[
                  styles.bizPeriodButton,
                  selectedPeriod === period && styles.bizPeriodButtonActive
                ]}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.bizPeriodButtonText,
                  selectedPeriod === period && styles.bizPeriodButtonTextActive
                ]}>
                  {period === '7d' ? '7 jours' : period === '30d' ? '30 jours' : '90 jours'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Performance Summary */}
          <View style={styles.bizSection}>
            <Text style={styles.bizSectionTitle}>PERFORMANCES</Text>
            {loadingStats ? (
              <View style={styles.bizStatsLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : (
              <View style={styles.bizPerformanceCard}>
                <View style={styles.bizPerformanceRow}>
                  <Text style={styles.bizPerformanceLabel}>Total activités</Text>
                  <Text style={styles.bizPerformanceValue}>{dashboardData?.total_activities || 0}</Text>
                </View>
                <View style={styles.bizPerformanceSeparator} />
                <View style={styles.bizPerformanceRow}>
                  <Text style={styles.bizPerformanceLabel}>Activités actives</Text>
                  <Text style={styles.bizPerformanceValue}>{dashboardData?.active_activities || 0}</Text>
                </View>
                <View style={styles.bizPerformanceSeparator} />
                <View style={styles.bizPerformanceRow}>
                  <Text style={styles.bizPerformanceLabel}>Total participants</Text>
                  <Text style={styles.bizPerformanceValue}>{dashboardData?.total_participants || 0}</Text>
                </View>
                <View style={styles.bizPerformanceSeparator} />
                <View style={styles.bizPerformanceRow}>
                  <Text style={styles.bizPerformanceLabel}>Revenus totaux</Text>
                  <Text style={styles.bizPerformanceValueAccent}>{(dashboardData?.total_revenue || 0).toFixed(0)}€</Text>
                </View>
              </View>
            )}
          </View>

          {/* Bio Section */}
          {profile.business_description && (
            <View style={styles.bizSection}>
              <Text style={styles.bizSectionTitle}>À PROPOS</Text>
              <Text style={styles.bizBioText}>{profile.business_description}</Text>
            </View>
          )}

          {/* Contact Section */}
          <View style={styles.bizSection}>
            <Text style={styles.bizSectionTitle}>CONTACT</Text>
            <View style={styles.bizContactCard}>
              {profile.business_address && (
                <View style={styles.bizContactRow}>
                  <View style={styles.bizContactIcon}>
                    <IconSymbol name="location.fill" size={16} color={colors.primary} />
                  </View>
                  <Text style={styles.bizContactText}>{profile.business_address}</Text>
                </View>
              )}
              {profile.business_phone && (
                <>
                  {profile.business_address && <View style={styles.bizContactSeparator} />}
                  <View style={styles.bizContactRow}>
                    <View style={styles.bizContactIcon}>
                      <IconSymbol name="phone.fill" size={16} color={colors.primary} />
                    </View>
                    <Text style={styles.bizContactText}>{profile.business_phone}</Text>
                  </View>
                </>
              )}
              {profile.business_email && (
                <>
                  {(profile.business_address || profile.business_phone) && <View style={styles.bizContactSeparator} />}
                  <View style={styles.bizContactRow}>
                    <View style={styles.bizContactIcon}>
                      <IconSymbol name="envelope.fill" size={16} color={colors.primary} />
                    </View>
                    <Text style={styles.bizContactText}>{profile.business_email}</Text>
                  </View>
                </>
              )}
              {profile.business_website && (
                <>
                  {(profile.business_address || profile.business_phone || profile.business_email) && <View style={styles.bizContactSeparator} />}
                  <View style={styles.bizContactRow}>
                    <View style={styles.bizContactIcon}>
                      <IconSymbol name="globe" size={16} color={colors.primary} />
                    </View>
                    <Text style={styles.bizContactTextLink}>{profile.business_website}</Text>
                  </View>
                </>
              )}
              {!profile.business_address && !profile.business_phone && !profile.business_email && !profile.business_website && (
                <Text style={styles.bizEmptyText}>Aucune information de contact</Text>
              )}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  // Main container
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'flex-end',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSafeArea: {
    width: '100%',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // ScrollView
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 100 : 120,
    gap: 16,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Not Connected
  notConnectedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  notConnectedIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(192, 132, 252, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  notConnectedTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
  },
  notConnectedText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 24,
  },
  connectButton: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 24,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginTop: 8,
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Glass Card (effet verre)
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },

  // Profile Section
  profileSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 14,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  userName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '500',
  },
  editButton: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingVertical: 11,
    paddingHorizontal: 28,
    borderRadius: 18,
    alignSelf: 'center',
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  statsIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContent: {
    flex: 1,
  },
  statsValue: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statsLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },

  // Section
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  sectionTitleBar: {
    width: 40,
    height: 3,
    borderRadius: 2,
    marginBottom: 16,
  },

  // Bio
  bioText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.95)',
    lineHeight: 22,
  },

  // Tags
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 14,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Intention
  intentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  intentionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  intentionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // ============================================
  // BUSINESS PROFILE STYLES - Premium Clean Design
  // ============================================
  bizContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  bizSafeArea: {
    flex: 1,
  },
  bizHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  bizHeaderLeft: {
    width: 80,
    alignItems: 'flex-start',
  },
  bizHeaderTitle: {
    fontSize: 17,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: '#1F2937',
  },
  bizHeaderButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bizVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bizVerifiedText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: colors.primary,
  },
  bizScrollView: {
    flex: 1,
  },
  bizContentContainer: {
    paddingBottom: Platform.OS === 'ios' ? 100 : 120,
  },
  bizProfileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
  },
  bizLogo: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#F3F4F6',
    borderWidth: 3,
    borderColor: colors.primary,
    marginBottom: 12,
  },
  bizName: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: 'Manrope_700Bold',
    color: '#1F2937',
    marginBottom: 6,
    textAlign: 'center',
  },
  bizCategoryBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    marginBottom: 8,
  },
  bizCategoryText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: colors.primary,
  },
  bizRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  bizRatingText: {
    fontSize: 13,
    fontFamily: 'Manrope_500Medium',
    color: '#6B7280',
  },
  bizEditButton: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  bizEditButtonText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: '#FFFFFF',
  },
  bizStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F2F2F7',
  },
  bizStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  bizStatValue: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Manrope_700Bold',
    color: '#1F2937',
  },
  bizStatValueAccent: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Manrope_700Bold',
    color: colors.primary,
  },
  bizStatLabel: {
    fontSize: 11,
    fontFamily: 'Manrope_500Medium',
    color: '#9CA3AF',
    marginTop: 2,
  },
  bizStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E5E7EB',
  },
  bizPeriodSelector: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    padding: 4,
  },
  bizPeriodButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  bizPeriodButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  bizPeriodButtonText: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'Manrope_500Medium',
    color: '#9CA3AF',
  },
  bizPeriodButtonTextActive: {
    color: '#1F2937',
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
  },
  bizSection: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  bizSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: '#9CA3AF',
    letterSpacing: 0.8,
    marginBottom: 12,
    marginLeft: 4,
  },
  bizStatsLoading: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  bizPerformanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F2F2F7',
    overflow: 'hidden',
  },
  bizPerformanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  bizPerformanceSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    marginLeft: 16,
  },
  bizPerformanceLabel: {
    fontSize: 15,
    fontFamily: 'Manrope_400Regular',
    color: '#6B7280',
  },
  bizPerformanceValue: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: '#1F2937',
  },
  bizPerformanceValueAccent: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: colors.primary,
  },
  bizBioText: {
    fontSize: 15,
    fontFamily: 'Manrope_400Regular',
    color: '#4B5563',
    lineHeight: 22,
  },
  bizContactCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F2F2F7',
    overflow: 'hidden',
  },
  bizContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  bizContactSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    marginLeft: 52,
  },
  bizContactIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bizContactText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Manrope_400Regular',
    color: '#374151',
  },
  bizContactTextLink: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Manrope_500Medium',
    color: colors.primary,
  },
  bizEmptyText: {
    fontSize: 14,
    fontFamily: 'Manrope_400Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 16,
  },

  // Legacy styles kept for compatibility
  coverImage: {
    width: '100%',
    height: 100,
  },
  bioCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  statsLoading: {
    paddingVertical: 24,
    alignItems: 'center',
  },

  // ============================================
  // USER PROFILE STYLES (Clean Peach Design)
  // ============================================
  userHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'flex-end',
  },
  userHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(107, 114, 128, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userContentContainer: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: Platform.OS === 'ios' ? 100 : 120,
    alignItems: 'center',
  },
  userProfileHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  userAvatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  userAvatar: {
    width: 175,
    height: 175,
    borderRadius: 88,
    backgroundColor: '#F3F4F6',
    borderWidth: 3,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  userEditBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  userProfileName: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Manrope_700Bold',
    color: '#1F2937',
    marginBottom: 4,
    textAlign: 'center',
  },
  userLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  userLocationText: {
    fontSize: 14,
    fontFamily: 'Manrope_500Medium',
    color: '#6B7280',
  },
  userEditProfileButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  userEditProfileGradient: {
    paddingVertical: 8,
    paddingHorizontal: 22,
    borderRadius: 18,
  },
  userEditProfileText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: '#FFFFFF',
  },
  userStatsIntentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    width: '100%',
    minHeight: 44,
  },
  userStatItem: {
    alignItems: 'center',
    paddingHorizontal: 9,
  },
  userStatValue: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Manrope_700Bold',
    color: colors.primary,
  },
  userStatLabel: {
    fontSize: 11,
    fontFamily: 'Manrope_500Medium',
    color: '#6B7280',
    marginTop: 1,
  },
  userStatSeparator: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 12,
  },
  userIntentionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  userIntentionLabel: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Manrope_500Medium',
    color: colors.primary,
  },
  userBioCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 8,
    marginBottom: 14,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.primaryDesaturated.replace('0.70', '0.12'),
  },
  userBioTitle: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: '#1F2937',
    marginBottom: 10,
  },
  userBioText: {
    fontSize: 14,
    fontFamily: 'Manrope_400Regular',
    color: '#4B5563',
    lineHeight: 22,
  },
  userInterestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  userInterestTag: {
    backgroundColor: colors.primaryLight,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  userInterestText: {
    fontSize: 13,
    fontFamily: 'Manrope_500Medium',
    color: '#6B7280',
  },
  userLoadingText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
  },
  userNotConnectedTitle: {
    fontSize: 26,
    fontWeight: '700',
    fontFamily: 'Manrope_700Bold',
    color: '#1F2937',
    marginTop: 16,
  },
  userNotConnectedText: {
    fontSize: 16,
    fontFamily: 'Manrope_400Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  userConnectButton: {
    borderRadius: 24,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginTop: 8,
  },
  userConnectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Manrope_600SemiBold',
    color: '#FFFFFF',
  },

  // ===== DEV: À SUPPRIMER =====
  devInviteContainer: {
    width: '100%',
    marginTop: 24,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    backgroundColor: '#F9FAFB',
  },
  devInviteLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  devInviteRow: {
    flexDirection: 'row',
    gap: 8,
  },
  devInviteInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  devInviteButton: {
    backgroundColor: '#6B7280',
    paddingHorizontal: 14,
    borderRadius: 6,
    justifyContent: 'center',
  },
  devInviteButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // ===== FIN DEV =====
});
