// PROTOTYPE 3 : Fond blanc minimaliste avec accents de couleur subtils
// Design épuré sans bordures, tout en douceur

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
}

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activitiesJoined, setActivitiesJoined] = useState(0);

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

      const { count: joined } = await supabase
        .from('slot_participants')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      setActivitiesJoined(joined || 0);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <LinearGradient
          colors={['#60A5FA', '#818CF8', '#C084FC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Profil</Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#818CF8" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <LinearGradient
          colors={['#60A5FA', '#818CF8', '#C084FC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Profil</Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
        <View style={styles.notConnectedContainer}>
          <IconSymbol name="person.crop.circle" size={70} color="#818CF8" />
          <Text style={styles.notConnectedTitle}>Non connecté</Text>
          <Text style={styles.notConnectedText}>
            Connectez-vous pour accéder à votre profil
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/auth/account-type')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#60A5FA', '#818CF8', '#C084FC']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.connectButton}
            >
              <Text style={styles.connectButtonText}>Se connecter</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header avec dégradé */}
      <LinearGradient
        colors={['#60A5FA', '#818CF8', '#C084FC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
          <View style={styles.headerContent}>
            <View style={styles.headerLeft} />
            <Text style={styles.headerTitle}>Profil</Text>
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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#818CF8"
          />
        }
      >
        {/* Profil - Avatar et nom */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: profile.avatar_url || 'https://via.placeholder.com/100' }}
              style={styles.avatar}
            />
            <TouchableOpacity
              style={styles.editBadge}
              onPress={() => router.push('/edit-profile')}
            >
              <LinearGradient
                colors={['#60A5FA', '#818CF8', '#C084FC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.editBadgeGradient}
              >
                <IconSymbol name="pencil" size={12} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <Text style={styles.userName}>{profile.full_name || profile.username}</Text>

          {profile.city && (
            <View style={styles.locationRow}>
              <IconSymbol name="location.fill" size={13} color="#818CF8" />
              <Text style={styles.locationText}>{profile.city}</Text>
            </View>
          )}

          {/* Bouton modifier profil */}
          <TouchableOpacity
            style={styles.editButtonContainer}
            onPress={() => router.push('/edit-profile')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#60A5FA', '#818CF8', '#C084FC']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.editButton}
            >
              <IconSymbol name="pencil" size={14} color="#FFFFFF" />
              <Text style={styles.editButtonText}>Modifier</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Stats - design épuré */}
        <TouchableOpacity
          style={styles.statsCard}
          onPress={() => router.push('/my-participated-activities')}
          activeOpacity={0.7}
        >
          <View style={styles.statsIcon}>
            <LinearGradient
              colors={['rgba(96, 165, 250, 0.1)', 'rgba(129, 140, 252, 0.1)', 'rgba(192, 132, 252, 0.1)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.statsIconGradient}
            >
              <IconSymbol name="calendar" size={22} color="#818CF8" />
            </LinearGradient>
          </View>
          <View style={styles.statsContent}>
            <Text style={styles.statsValue}>{activitiesJoined}</Text>
            <Text style={styles.statsLabel}>Activités rejointes</Text>
          </View>
          <IconSymbol name="chevron.right" size={18} color="#D1D5DB" />
        </TouchableOpacity>

        {/* Bio */}
        {profile.bio && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Bio</Text>
            </View>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </View>
        )}

        {/* Personnalité */}
        {profile.personality_tags && profile.personality_tags.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Personnalité</Text>
            </View>
            <View style={styles.tagsContainer}>
              {profile.personality_tags.map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <LinearGradient
                    colors={['rgba(96, 165, 250, 0.12)', 'rgba(129, 140, 252, 0.12)', 'rgba(192, 132, 252, 0.12)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.tagGradient}
                  >
                    <Text style={styles.tagText}>{tag}</Text>
                  </LinearGradient>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Intention */}
        {profile.intention && (() => {
          const intentionInfo = getIntentionInfo(profile.intention);
          return intentionInfo ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recherche</Text>
              </View>
              <View style={styles.intentionCard}>
                <View style={styles.intentionIcon}>
                  <LinearGradient
                    colors={['rgba(96, 165, 250, 0.12)', 'rgba(129, 140, 252, 0.12)', 'rgba(192, 132, 252, 0.12)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.intentionIconGradient}
                  >
                    <IconSymbol name={intentionInfo.icon as any} size={20} color="#818CF8" />
                  </LinearGradient>
                </View>
                <Text style={styles.intentionText}>{intentionInfo.label}</Text>
              </View>
            </View>
          ) : null;
        })()}

        {/* Intérêts */}
        {profile.interests && profile.interests.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Centres d'intérêt</Text>
            </View>
            <View style={styles.tagsContainer}>
              {profile.interests.map((interest, index) => (
                <View key={index} style={styles.tag}>
                  <LinearGradient
                    colors={['rgba(96, 165, 250, 0.12)', 'rgba(129, 140, 252, 0.12)', 'rgba(192, 132, 252, 0.12)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.tagGradient}
                  >
                    <Text style={styles.tagText}>{interest}</Text>
                  </LinearGradient>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // Header
  headerGradient: {},
  headerSafeArea: {
    width: '100%',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: {
    width: 36,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
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
    color: '#6B7280',
  },

  // Not Connected
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
    color: '#1F2937',
    marginTop: 12,
  },
  notConnectedText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  connectButton: {
    borderRadius: 22,
    paddingHorizontal: 30,
    paddingVertical: 13,
    marginTop: 8,
  },
  connectButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // ScrollView
  scrollView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 100 : 120,
  },

  // Profile Section
  profileSection: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 14,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  editBadgeGradient: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  userName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  locationText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  editButtonContainer: {
    marginTop: 4,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 18,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Stats Card
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFBFC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 14,
  },
  statsIcon: {},
  statsIconGradient: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContent: {
    flex: 1,
  },
  statsValue: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1F2937',
  },
  statsLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },

  // Section
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
  },

  // Bio
  bioText: {
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 23,
  },

  // Tags
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  tagGradient: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tagText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#818CF8',
  },

  // Intention
  intentionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  intentionIcon: {},
  intentionIconGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  intentionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
});
