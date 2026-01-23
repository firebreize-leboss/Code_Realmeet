// PROTOTYPE 1 : Fond coloré dégradé, ultra épuré sans bordures
// Style moderne avec fusion des éléments dans le fond

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

  // Fonction de chargement simplifiée (à compléter selon votre logique)
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

      // Charger les stats
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
            <IconSymbol name="gear" size={22} color="rgba(255,255,255,0.95)" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FFFFFF"
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
                <IconSymbol name="pencil" size={12} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.userName}>{profile.full_name || profile.username}</Text>

            {profile.city && (
              <View style={styles.locationRow}>
                <IconSymbol name="location.fill" size={14} color="rgba(255,255,255,0.9)" />
                <Text style={styles.locationText}>{profile.city}</Text>
              </View>
            )}

            {/* Bouton modifier profil */}
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => router.push('/edit-profile')}
              activeOpacity={0.8}
            >
              <Text style={styles.editButtonText}>Modifier le profil</Text>
            </TouchableOpacity>
          </View>

          {/* Stats - design épuré */}
          <TouchableOpacity
            style={styles.statsCard}
            onPress={() => router.push('/my-participated-activities')}
            activeOpacity={0.7}
          >
            <View style={styles.statsIcon}>
              <IconSymbol name="calendar" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.statsContent}>
              <Text style={styles.statsValue}>{activitiesJoined}</Text>
              <Text style={styles.statsLabel}>Activités rejointes</Text>
            </View>
            <IconSymbol name="chevron.right" size={18} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>

          {/* Bio */}
          {profile.bio && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Bio</Text>
              <Text style={styles.bioText}>{profile.bio}</Text>
            </View>
          )}

          {/* Personnalité */}
          {profile.personality_tags && profile.personality_tags.length > 0 && (
            <View style={styles.section}>
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
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recherche</Text>
                <View style={styles.intentionCard}>
                  <IconSymbol name={intentionInfo.icon as any} size={20} color="#FFFFFF" />
                  <Text style={styles.intentionText}>{intentionInfo.label}</Text>
                </View>
              </View>
            ) : null;
          })()}

          {/* Intérêts */}
          {profile.interests && profile.interests.length > 0 && (
            <View style={styles.section}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
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

  // Header
  header: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'flex-end',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ScrollView
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 100 : 120,
  },

  // Profile Section
  profileSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  userName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 20,
  },
  locationText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  editButton: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 20,
    marginTop: 4,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Stats Card
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 14,
  },
  statsIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContent: {
    flex: 1,
  },
  statsValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statsLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },

  // Section
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },

  // Bio
  bioText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Intention
  intentionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  intentionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
