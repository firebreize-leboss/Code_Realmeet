// app/user-profile.tsx
// Page de profil d'un autre utilisateur

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';

interface UserProfile {
  id: string;
  full_name: string;
  avatar_url?: string;
  bio?: string;
  city?: string;
  interests: string[];
  is_friend: boolean;
  request_sent: boolean;
  activities_joined: number;
  activities_hosted: number;
}

export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({
    id: id as string,
    full_name: 'Marie Dubois',
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
    bio: "Passionnée d'aventures en plein air et de découvertes culturelles. Toujours partante pour de nouvelles expériences !",
    city: 'Paris',
    interests: ['Randonnée', 'Photographie', 'Cuisine', 'Voyages'],
    is_friend: false,
    request_sent: false,
    activities_joined: 15,
    activities_hosted: 8,
  });

  const handleSendFriendRequest = async () => {
    setLoading(true);
    try {
      // TODO: Implémenter avec Supabase
      // await supabase.from('friend_requests').insert(...)
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setProfile(prev => ({ ...prev, request_sent: true }));
    } catch (error) {
      console.error('Error sending friend request:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    setLoading(true);
    try {
      // TODO: Implémenter avec Supabase
      // await supabase.from('friend_requests').delete()...
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setProfile(prev => ({ ...prev, request_sent: false }));
    } catch (error) {
      console.error('Error cancelling friend request:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartConversation = () => {
    // TODO: Créer ou trouver une conversation existante
    router.push(`/chat-detail?id=conv_${profile.id}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHeader}>
          <Image
            source={{ uri: profile.avatar_url }}
            style={styles.avatar}
          />
          <Text style={styles.name}>{profile.full_name}</Text>
          {profile.city && (
            <View style={styles.locationRow}>
              <IconSymbol name="location.fill" size={16} color={colors.textSecondary} />
              <Text style={styles.city}>{profile.city}</Text>
            </View>
          )}
        </View>

        {profile.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>À propos</Text>
            <View style={styles.card}>
              <Text style={styles.bio}>{profile.bio}</Text>
            </View>
          </View>
        )}

        {profile.interests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Centres d'intérêt</Text>
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
          <Text style={styles.sectionTitle}>Activités</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{profile.activities_joined}</Text>
              <Text style={styles.statLabel}>Participations</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{profile.activities_hosted}</Text>
              <Text style={styles.statLabel}>Organisées</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionButtons}>
          {profile.is_friend ? (
            <>
              <TouchableOpacity
                style={styles.messageButton}
                onPress={handleStartConversation}
              >
                <IconSymbol name="message.fill" size={20} color={colors.background} />
                <Text style={styles.messageButtonText}>Message</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.moreButton}>
                <IconSymbol name="ellipsis" size={20} color={colors.text} />
              </TouchableOpacity>
            </>
          ) : profile.request_sent ? (
            <TouchableOpacity
              style={[styles.addButton, styles.pendingButton]}
              onPress={handleCancelRequest}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.textSecondary} />
              ) : (
                <>
                  <IconSymbol name="clock.fill" size={20} color={colors.textSecondary} />
                  <Text style={styles.pendingButtonText}>Demande envoyée</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleSendFriendRequest}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <>
                  <IconSymbol name="plus" size={20} color={colors.background} />
                  <Text style={styles.addButtonText}>Ajouter</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
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
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  pendingButton: {
    backgroundColor: colors.textSecondary + '20',
  },
  pendingButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  messageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  messageButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  moreButton: {
    width: 54,
    backgroundColor: colors.card,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});