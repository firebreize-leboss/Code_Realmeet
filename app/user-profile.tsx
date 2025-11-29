// app/user-profile.tsx
// Page de profil d'un autre utilisateur

import React, { useState, useEffect } from 'react';
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
import { supabase } from '@/lib/supabase';

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

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);

  // Charger les données du profil ciblé et déterminer l'état d'amitié
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        const targetId = id as string;
        
        // Récupérer le profil de l'utilisateur cible
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('full_name, avatar_url, bio, city, interests')
          .eq('id', targetId)
          .single();
        if (profileError) throw profileError;
        if (!profileData) throw new Error("Profil introuvable");

        // Récupérer l'utilisateur actuel pour vérifier amitié ou demande
        const { data: currentUserData } = await supabase.auth.getUser();
        const currentUser = currentUserData?.user;
        if (!currentUser) throw new Error("Utilisateur non connecté");

        // Vérifier si c'est le propre profil de l'utilisateur
        const isOwnProfile = currentUser.id === targetId;

        // Compter les activités RÉELLEMENT rejointes (depuis la table activity_participants)
        const { count: joinedCount } = await supabase
          .from('activity_participants')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', targetId);

        // Compter les activités RÉELLEMENT organisées (depuis la table activities)
        const { count: hostedCount } = await supabase
          .from('activities')
          .select('*', { count: 'exact', head: true })
          .eq('host_id', targetId);

        // Vérifier si déjà amis (relation dans les deux sens créée lors de l'acceptation)
        const { data: friendRows } = await supabase
          .from('friendships')
          .select('id')
          .eq('user_id', currentUser.id)
          .eq('friend_id', targetId);
        const isFriend = (friendRows && friendRows.length > 0);

        // Vérifier si une demande d'ami a déjà été envoyée par l'utilisateur actuel
        const { data: requestRows } = await supabase
          .from('friend_requests')
          .select('id')
          .eq('sender_id', currentUser.id)
          .eq('receiver_id', targetId)
          .eq('status', 'pending');
        const alreadyRequested = (requestRows && requestRows.length > 0);

        // Construire l'objet profil complet avec les VRAIS compteurs
        const userProfile: UserProfile = {
          id: targetId,
          full_name: profileData.full_name,
          avatar_url: profileData.avatar_url || undefined,
          bio: profileData.bio || undefined,
          city: profileData.city || undefined,
          interests: profileData.interests || [],
          is_friend: isFriend,
          request_sent: alreadyRequested,
          activities_joined: joinedCount ?? 0,
          activities_hosted: hostedCount ?? 0,
        };
        setProfile(userProfile);
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    };
    if (id) loadProfile();
  }, [id]);

  const handleSendFriendRequest = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const { data: currentUserData } = await supabase.auth.getUser();
      const currentUser = currentUserData?.user;
      if (!currentUser) throw new Error("Utilisateur non connecté");
      const { error } = await supabase.from('friend_requests').insert({
        sender_id: currentUser.id,
        receiver_id: profile.id,
        status: 'pending',
      });
      if (error && !error.message.toLowerCase().includes('duplicate')) {
        throw error;
      }
      // Marquer la demande comme envoyée dans l'état local
      setProfile(prev => prev ? { ...prev, request_sent: true } : prev);
    } catch (error) {
      console.error('Error sending friend request:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const { data: currentUserData } = await supabase.auth.getUser();
      const currentUser = currentUserData?.user;
      if (!currentUser) throw new Error("Utilisateur non connecté");
      const { error } = await supabase
        .from('friend_requests')
        .delete()
        .eq('sender_id', currentUser.id)
        .eq('receiver_id', profile.id)
        .eq('status', 'pending');
      if (error) throw error;
      // Marquer la demande comme annulée dans l'état local
      setProfile(prev => prev ? { ...prev, request_sent: false } : prev);
    } catch (error) {
      console.error('Error cancelling friend request:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartConversation = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const { data: currentUserData } = await supabase.auth.getUser();
      const currentUser = currentUserData?.user;
      if (!currentUser) throw new Error("Utilisateur non connecté");

      // Vérifier si une conversation existe déjà
      const { data: myParticipations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', currentUser.id);

      if (myParticipations && myParticipations.length > 0) {
        const myConvIds = myParticipations.map(p => p.conversation_id);

        // Vérifier si le profil participe à l'une de ces conversations
        const { data: friendParticipations } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', profile.id)
          .in('conversation_id', myConvIds);

        if (friendParticipations && friendParticipations.length > 0) {
          // Vérifier que c'est bien une conversation à 2 personnes
          for (const fp of friendParticipations) {
            const { count } = await supabase
              .from('conversation_participants')
              .select('*', { count: 'exact', head: true })
              .eq('conversation_id', fp.conversation_id);

            if (count === 2) {
              // Conversation existante trouvée, rediriger vers celle-ci
              router.push(`/chat-detail?id=${fp.conversation_id}`);
              setLoading(false);
              return;
            }
          }
        }
      }

      // Aucune conversation existante, en créer une nouvelle
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({})
        .select()
        .single();
      
      if (convError) throw convError;

      const participants = [
        { conversation_id: newConv.id, user_id: currentUser.id },
        { conversation_id: newConv.id, user_id: profile.id },
      ];
      
      const { error: partError } = await supabase
        .from('conversation_participants')
        .insert(participants);
      
      if (partError) throw partError;

      router.push(`/chat-detail?id=${newConv.id}`);
    } catch (error) {
      console.error('Error starting conversation:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* En-tête */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.placeholder} />
      </View>

      {/* Contenu du profil */}
      {profile === null ? (
        // État chargement : spinner centré
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.profileHeader}>
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
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
                {/* Bouton message (conversation) */}
                <TouchableOpacity
                  style={styles.messageButton}
                  onPress={handleStartConversation}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color={colors.background} />
                  ) : (
                    <>
                      <IconSymbol name="message.fill" size={20} color={colors.background} />
                      <Text style={styles.messageButtonText}>Message</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.moreButton}>
                  <IconSymbol name="ellipsis" size={20} color={colors.text} />
                </TouchableOpacity>
              </>
            ) : profile.request_sent ? (
              /* Bouton annuler la demande */
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
              /* Bouton envoyer une demande d'ami */
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleSendFriendRequest}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <>
                    <IconSymbol name="person.badge.plus.fill" size={20} color={colors.background} />
                    <Text style={styles.addButtonText}>Ajouter</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 100,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 12,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  city: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 16,
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
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  interestText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  messageButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  messageButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  moreButton: {
    width: 48,
    height: 48,
    backgroundColor: colors.card,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  pendingButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pendingButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});