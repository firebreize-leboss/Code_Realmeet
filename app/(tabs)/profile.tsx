import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';
import { Keyboard } from 'react-native';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [activitiesJoined, setActivitiesJoined] = useState(0);
  const [activitiesHosted, setActivitiesHosted] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);

  // Fermer le clavier à chaque fois que l'écran est focus
  useFocusEffect(
    React.useCallback(() => {
      Keyboard.dismiss();
    }, [])
  );

  // Charger les vraies statistiques d'activités
  useEffect(() => {
    if (user?.id) {
      loadActivityStats();
    }
  }, [user?.id]);

  const loadActivityStats = async () => {
    if (!user?.id) return;
    
    try {
      setLoadingStats(true);

      // Compter les activités RÉELLEMENT rejointes
      const { count: joinedCount } = await supabase
        .from('activity_participants')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Compter les activités RÉELLEMENT organisées
      const { count: hostedCount } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('host_id', user.id);

      setActivitiesJoined(joinedCount ?? 0);
      setActivitiesHosted(hostedCount ?? 0);
    } catch (error) {
      console.error('Error loading activity stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={commonStyles.container} edges={['top','bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement du profil...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user || !profile) {
    return (
      <SafeAreaView style={commonStyles.container} edges={['top','bottom']}>
        <View style={styles.notConnectedContainer}>
          <IconSymbol name="person.fill" size={64} color={colors.textSecondary} style={styles.notConnectedIcon} />
          <Text style={styles.notConnectedTitle}>Non connecté</Text>
          <Text style={styles.notConnectedText}>
            Vous devez être connecté pour voir votre profil
          </Text>
          <TouchableOpacity
            style={styles.connectButton}
            onPress={() => router.push('/')}
          >
            <Text style={styles.connectButtonText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={commonStyles.container} edges={['top','bottom']}>
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
            <Text style={styles.bio}>
              {profile.bio || 'Aucune bio renseignée'}
            </Text>
          </View>
        </View>

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

const styles = StyleSheet.create({
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
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 100 : 120,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
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
  },
  notConnectedIcon: {
    marginBottom: 24,
  },
  notConnectedTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  notConnectedText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  connectButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.border,
    marginBottom: 16,
    borderWidth: 4,
    borderColor: colors.primary,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
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
});