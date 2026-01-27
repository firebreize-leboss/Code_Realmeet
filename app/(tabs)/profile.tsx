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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { PersonalityTagsBadges } from '@/components/PersonalityTagsBadges';
import { colors, commonStyles } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';
import { getIntentionInfo } from '@/lib/database.types';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

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
      const { data, error } = await supabase.rpc('get_user_profile_stats', {
        p_user_id: userId
      } as any) as { data: any; error: any };

      if (error) {
        console.error('RPC get_user_profile_stats error:', error);
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
            .in('slot_id', pastSlotIds);

          totalParticipants = count || 0;

          const slotActivityMap = new Map(pastSlots?.map((s: any) => [s.id, s.activity_id]) || []);
          const activityPrices = new Map(activities?.map((a: any) => [a.id, a.prix || 0]) || []);

          const { data: participantsData } = await supabase
            .from('slot_participants')
            .select('slot_id')
            .in('slot_id', pastSlotIds);

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
        colors={['#60A5FA', '#818CF8', '#C084FC']}
        style={styles.container}
      >
        <SafeAreaView style={styles.loadingContainer} edges={['top']}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Not connected state
  if (!profile) {
    return (
      <LinearGradient
        colors={['#60A5FA', '#818CF8', '#C084FC']}
        style={styles.container}
      >
        <SafeAreaView style={styles.notConnectedContainer} edges={['top']}>
          <IconSymbol name="person.crop.circle" size={80} color="rgba(255,255,255,0.9)" />
          <Text style={styles.notConnectedTitle}>Non connecté</Text>
          <Text style={styles.notConnectedText}>
            Connectez-vous pour accéder à votre profil
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/auth/account-type')}
            style={styles.connectButton}
            activeOpacity={0.8}
          >
            <Text style={styles.connectButtonText}>Se connecter</Text>
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

  // Render user profile (Glassmorphism design)
  return (
    <LinearGradient
      colors={['#60A5FA', '#818CF8', '#C084FC']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header minimaliste */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.push('/settings')}
            style={styles.headerButton}
          >
            <IconSymbol name="gear" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />
          }
        >
        {/* Carte Profil avec effet verre */}
        <View style={styles.glassCard}>
          <View style={styles.profileSection}>
            <View style={styles.avatarContainer}>
              <Image
                source={{ uri: profile.avatar_url || 'https://via.placeholder.com/90' }}
                style={styles.avatar}
              />
              <TouchableOpacity
                style={styles.editBadge}
                onPress={() => router.push('/edit-profile')}
              >
                <IconSymbol name="pencil" size={11} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.userName}>{profile.full_name || profile.username}</Text>

            {profile.city && (
              <View style={styles.locationRow}>
                <IconSymbol name="location.fill" size={13} color="rgba(255,255,255,0.95)" />
                <Text style={styles.locationText}>{profile.city}</Text>
              </View>
            )}
          </View>

          {/* Bouton modifier */}
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => router.push('/edit-profile')}
            activeOpacity={0.8}
          >
            <Text style={styles.editButtonText}>Modifier le profil</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Card Glass */}
        {loadingStats ? (
          <View style={styles.glassCard}>
            <ActivityIndicator size="small" color="#FFFFFF" />
          </View>
        ) : (
          <TouchableOpacity
            style={styles.glassCard}
            onPress={() => router.push('/my-participated-activities')}
            activeOpacity={0.7}
          >
            <View style={styles.statsRow}>
              <View style={styles.statsIcon}>
                <IconSymbol name="calendar" size={22} color="#FFFFFF" />
              </View>
              <View style={styles.statsContent}>
                <Text style={styles.statsValue}>{activitiesJoined}</Text>
                <Text style={styles.statsLabel}>Activités faites</Text>
              </View>
              <IconSymbol name="chevron.right" size={18} color="rgba(255,255,255,0.7)" />
            </View>
          </TouchableOpacity>
        )}

        {/* Bio */}
        {profile.bio && (
          <View style={styles.glassCard}>
            <Text style={styles.sectionTitle}>Ma Bio</Text>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </View>
        )}

        {/* Personnalité */}
        {profile.personality_tags && profile.personality_tags.length > 0 && (
          <View style={styles.glassCard}>
            <Text style={styles.sectionTitle}>Personnalité</Text>
            <View style={styles.tagsContainer}>
              {profile.personality_tags.map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Intention */}
        {profile.intention && (() => {
          const intentionInfo = getIntentionInfo(profile.intention);
          return intentionInfo ? (
            <View style={styles.glassCard}>
              <Text style={styles.sectionTitle}>Recherche</Text>
              <View style={styles.intentionRow}>
                <View style={styles.intentionIcon}>
                  <IconSymbol name={intentionInfo.icon as any} size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.intentionText}>{intentionInfo.label}</Text>
              </View>
            </View>
          ) : null;
        })()}

        {/* Intérêts */}
        {profile.interests && profile.interests.length > 0 && (
          <View style={styles.glassCard}>
            <Text style={styles.sectionTitle}>Centres d'intérêt</Text>
            <View style={styles.tagsContainer}>
              {profile.interests.map((interest, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{interest}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        </ScrollView>
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
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header avec dégradé */}
      <LinearGradient
        colors={['#60A5FA', '#818CF8', '#C084FC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              {profile.business_verified && (
                <View style={styles.verifiedBadge}>
                  <IconSymbol name="checkmark.seal.fill" size={12} color="#FFFFFF" />
                  <Text style={styles.verifiedText}>Vérifié</Text>
                </View>
              )}
            </View>
            <Text style={styles.headerTitle}>Dashboard</Text>
            <TouchableOpacity
              onPress={() => router.push('/settings')}
              style={styles.headerButton}
            >
              <IconSymbol name="gear" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818CF8" />
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
                <TouchableOpacity
                  style={styles.ratingRow}
                  onPress={() => router.push(`/business-reviews?id=${profile.id}&name=${encodeURIComponent(profile.business_name || '')}`)}
                >
                  <IconSymbol name="star.fill" size={14} color="#F59E0B" />
                  <Text style={styles.ratingText}>
                    {profile.business_rating.toFixed(1)} ({profile.business_review_count} avis)
                  </Text>
                  <IconSymbol name="chevron.right" size={12} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
          </View>
          <TouchableOpacity
            style={styles.editBusinessButton}
            onPress={() => router.push('/edit-business-profile')}
          >
            <LinearGradient
              colors={['#60A5FA', '#818CF8', '#C084FC']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.editBusinessGradient}
            >
              <IconSymbol name="pencil" size={14} color="#FFFFFF" />
              <Text style={styles.editBusinessText}>Modifier</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Quick Stats Grid */}
        <View style={styles.quickStatsGrid}>
          <View style={styles.quickStatCard}>
            <LinearGradient
              colors={['rgba(96, 165, 250, 0.15)', 'rgba(96, 165, 250, 0.05)']}
              style={styles.quickStatGradient}
            >
              <IconSymbol name="calendar" size={24} color="#60A5FA" />
              <Text style={styles.quickStatValue}>
                {dashboardData?.total_activities || 0}
              </Text>
              <Text style={styles.quickStatLabel}>Activités</Text>
            </LinearGradient>
          </View>
          <View style={styles.quickStatCard}>
            <LinearGradient
              colors={['rgba(129, 140, 252, 0.15)', 'rgba(129, 140, 252, 0.05)']}
              style={styles.quickStatGradient}
            >
              <IconSymbol name="person.2.fill" size={24} color="#818CF8" />
              <Text style={styles.quickStatValue}>
                {dashboardData?.total_participants || 0}
              </Text>
              <Text style={styles.quickStatLabel}>Participants</Text>
            </LinearGradient>
          </View>
          <TouchableOpacity
            style={styles.quickStatCard}
            onPress={() => router.push(`/business-reviews?id=${profile.id}&name=${encodeURIComponent(profile.business_name || '')}`)}
          >
            <LinearGradient
              colors={['rgba(192, 132, 252, 0.15)', 'rgba(192, 132, 252, 0.05)']}
              style={styles.quickStatGradient}
            >
              <IconSymbol name="message.fill" size={24} color="#C084FC" />
              <Text style={styles.quickStatValue}>
                {dashboardData?.review_count || 0}
              </Text>
              <Text style={styles.quickStatLabel}>Avis</Text>
            </LinearGradient>
          </TouchableOpacity>
          <View style={styles.quickStatCard}>
            <LinearGradient
              colors={['rgba(96, 165, 250, 0.15)', 'rgba(192, 132, 252, 0.15)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.quickStatGradient}
            >
              <IconSymbol name="dollarsign.circle.fill" size={24} color="#818CF8" />
              <Text style={styles.quickStatValue}>
                {(dashboardData?.total_revenue || 0).toFixed(0)}€
              </Text>
              <Text style={styles.quickStatLabel}>Revenus</Text>
            </LinearGradient>
          </View>
        </View>

        {/* Period Selector */}
        <View style={styles.periodSelector}>
          {(['7d', '30d', '90d'] as const).map((period) => (
            <TouchableOpacity
              key={period}
              onPress={() => setSelectedPeriod(period)}
              activeOpacity={0.7}
            >
              {selectedPeriod === period ? (
                <LinearGradient
                  colors={['#60A5FA', '#818CF8', '#C084FC']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.periodButtonActive}
                >
                  <Text style={styles.periodButtonTextActive}>
                    {period === '7d' ? '7 jours' : period === '30d' ? '30 jours' : '90 jours'}
                  </Text>
                </LinearGradient>
              ) : (
                <View style={styles.periodButton}>
                  <Text style={styles.periodButtonText}>
                    {period === '7d' ? '7 jours' : period === '30d' ? '30 jours' : '90 jours'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Performance Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Résumé des performances</Text>
          <LinearGradient
            colors={['#60A5FA', '#818CF8', '#C084FC']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sectionTitleBar}
          />
          {loadingStats ? (
            <View style={styles.statsLoading}>
              <ActivityIndicator size="small" color="#818CF8" />
            </View>
          ) : (
            <View style={styles.performanceCard}>
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

        {/* Bio Section */}
        {profile.business_description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ma Bio</Text>
            <LinearGradient
              colors={['#60A5FA', '#818CF8', '#C084FC']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sectionTitleBar}
            />
            <View style={styles.bioCard}>
              <Text style={styles.bioText}>{profile.business_description}</Text>
            </View>
          </View>
        )}

        {/* Contact Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact</Text>
          <LinearGradient
            colors={['#60A5FA', '#818CF8', '#C084FC']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.sectionTitleBar}
          />
          <View style={styles.contactCard}>
            {profile.business_address && (
              <View style={styles.contactRow}>
                <View style={styles.contactIconContainer}>
                  <IconSymbol name="location.fill" size={16} color="#818CF8" />
                </View>
                <Text style={styles.contactText}>{profile.business_address}</Text>
              </View>
            )}
            {profile.business_phone && (
              <View style={styles.contactRow}>
                <View style={styles.contactIconContainer}>
                  <IconSymbol name="phone.fill" size={16} color="#818CF8" />
                </View>
                <Text style={styles.contactText}>{profile.business_phone}</Text>
              </View>
            )}
            {profile.business_email && (
              <View style={styles.contactRow}>
                <View style={styles.contactIconContainer}>
                  <IconSymbol name="envelope.fill" size={16} color="#818CF8" />
                </View>
                <Text style={styles.contactText}>{profile.business_email}</Text>
              </View>
            )}
            {profile.business_website && (
              <View style={styles.contactRow}>
                <View style={styles.contactIconContainer}>
                  <IconSymbol name="globe" size={16} color="#818CF8" />
                </View>
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

  // Business Profile Styles
  businessProfileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
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
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
  },
  businessInfo: {
    flex: 1,
    paddingTop: 8,
  },
  businessName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  categoryBadge: {
    backgroundColor: 'rgba(129, 140, 252, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#818CF8',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    color: '#6B7280',
  },
  editBusinessButton: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  editBusinessGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  editBusinessText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Quick Stats Grid
  quickStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  quickStatCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    borderRadius: 16,
    overflow: 'hidden',
  },
  quickStatGradient: {
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  quickStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  quickStatLabel: {
    fontSize: 12,
    color: '#6B7280',
  },

  // Period Selector
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    gap: 4,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderRadius: 10,
  },
  periodButtonActive: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderRadius: 10,
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  periodButtonTextActive: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Performance Card
  performanceCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
  },
  performanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  performanceLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  performanceValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },

  // Contact Card
  contactCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  contactIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(129, 140, 252, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactText: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
  },
  linkText: {
    color: '#818CF8',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
});
