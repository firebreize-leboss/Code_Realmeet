// app/user-profile.tsx
// Page de profil d'un autre utilisateur avec options ami/bloquer

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@/lib/supabase';
import { blockService } from '@/services/block.service';

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
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  // Charger les données du profil
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
        if (!profileData) throw new Error('Profil introuvable');

        // Récupérer l'utilisateur actuel
        const { data: currentUserData } = await supabase.auth.getUser();
        const currentUser = currentUserData?.user;
        if (!currentUser) throw new Error('Utilisateur non connecté');

        // Compter les activités rejointes
        const { count: joinedCount } = await supabase
          .from('activity_participants')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', targetId);

        // Compter les activités organisées
        const { count: hostedCount } = await supabase
          .from('activities')
          .select('*', { count: 'exact', head: true })
          .eq('host_id', targetId);

        // Vérifier si déjà amis
        const { data: friendRows } = await supabase
          .from('friendships')
          .select('id')
          .eq('user_id', currentUser.id)
          .eq('friend_id', targetId);
        const isFriend = friendRows && friendRows.length > 0;

        // Vérifier si une demande d'ami a été envoyée
        const { data: requestRows } = await supabase
          .from('friend_requests')
          .select('id')
          .eq('sender_id', currentUser.id)
          .eq('receiver_id', targetId)
          .eq('status', 'pending');
        const alreadyRequested = requestRows && requestRows.length > 0;

        // Vérifier si bloqué
        const blocked = await blockService.isUserBlocked(targetId);
        setIsBlocked(blocked);

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

  // Envoyer une demande d'ami
  const handleSendFriendRequest = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const { data: currentUserData } = await supabase.auth.getUser();
      const currentUser = currentUserData?.user;
      if (!currentUser) throw new Error('Utilisateur non connecté');

      const { error } = await supabase.from('friend_requests').insert({
        sender_id: currentUser.id,
        receiver_id: profile.id,
        status: 'pending',
      });

      if (error && !error.message.toLowerCase().includes('duplicate')) {
        throw error;
      }

      setProfile(prev => (prev ? { ...prev, request_sent: true } : prev));
      Alert.alert('Succès', 'Demande d\'ami envoyée !');
    } catch (error) {
      console.error('Error sending friend request:', error);
      Alert.alert('Erreur', 'Impossible d\'envoyer la demande');
    } finally {
      setLoading(false);
    }
  };

  // Annuler une demande d'ami
  const handleCancelRequest = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const { data: currentUserData } = await supabase.auth.getUser();
      const currentUser = currentUserData?.user;
      if (!currentUser) throw new Error('Utilisateur non connecté');

      const { error } = await supabase
        .from('friend_requests')
        .delete()
        .eq('sender_id', currentUser.id)
        .eq('receiver_id', profile.id)
        .eq('status', 'pending');

      if (error) throw error;

      setProfile(prev => (prev ? { ...prev, request_sent: false } : prev));
    } catch (error) {
      console.error('Error cancelling friend request:', error);
    } finally {
      setLoading(false);
    }
  };

  // Supprimer un ami
  const handleRemoveFriend = async () => {
    if (!profile) return;

    Alert.alert(
      'Supprimer cet ami',
      `Voulez-vous vraiment retirer ${profile.full_name} de vos amis ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const { data: currentUserData } = await supabase.auth.getUser();
              const currentUser = currentUserData?.user;
              if (!currentUser) throw new Error('Utilisateur non connecté');

              // Supprimer dans les deux sens
              await supabase
                .from('friendships')
                .delete()
                .eq('user_id', currentUser.id)
                .eq('friend_id', profile.id);

              await supabase
                .from('friendships')
                .delete()
                .eq('user_id', profile.id)
                .eq('friend_id', currentUser.id);

              setProfile(prev => (prev ? { ...prev, is_friend: false } : prev));
              setShowOptionsModal(false);
              Alert.alert('Succès', 'Ami supprimé');
            } catch (error) {
              console.error('Error removing friend:', error);
              Alert.alert('Erreur', 'Impossible de supprimer cet ami');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // Bloquer un utilisateur
  const handleBlockUser = async () => {
    if (!profile) return;

    Alert.alert(
      'Bloquer cet utilisateur',
      `${profile.full_name} ne pourra plus vous contacter ni voir votre profil.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Bloquer',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const result = await blockService.blockUser(profile.id);
              if (result.success) {
                setIsBlocked(true);
                setShowOptionsModal(false);
                Alert.alert('Succès', 'Utilisateur bloqué');
              } else {
                throw new Error(result.error);
              }
            } catch (error) {
              console.error('Error blocking user:', error);
              Alert.alert('Erreur', 'Impossible de bloquer cet utilisateur');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // Débloquer un utilisateur
  const handleUnblockUser = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const result = await blockService.unblockUser(profile.id);
      if (result.success) {
        setIsBlocked(false);
        setShowOptionsModal(false);
        Alert.alert('Succès', 'Utilisateur débloqué');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error unblocking user:', error);
      Alert.alert('Erreur', 'Impossible de débloquer cet utilisateur');
    } finally {
      setLoading(false);
    }
  };

  // Démarrer une conversation
  const handleStartConversation = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const { data: currentUserData } = await supabase.auth.getUser();
      const currentUser = currentUserData?.user;
      if (!currentUser) throw new Error('Utilisateur non connecté');

      // Vérifier si une conversation existe déjà
      const { data: myParticipations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', currentUser.id);

      if (myParticipations && myParticipations.length > 0) {
        const myConvIds = myParticipations.map(p => p.conversation_id);

        const { data: friendParticipations } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', profile.id)
          .in('conversation_id', myConvIds);

        if (friendParticipations && friendParticipations.length > 0) {
          for (const fp of friendParticipations) {
            const { count } = await supabase
              .from('conversation_participants')
              .select('*', { count: 'exact', head: true })
              .eq('conversation_id', fp.conversation_id);

            if (count === 2) {
              router.push(`/chat-detail?id=${fp.conversation_id}`);
              setLoading(false);
              return;
            }
          }
        }
      }

      // Créer une nouvelle conversation
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
      Alert.alert('Erreur', 'Impossible de démarrer la conversation');
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
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Header du profil */}
          <View style={styles.profileHeader}>
            <Image
              source={{ uri: profile.avatar_url || 'https://via.placeholder.com/100' }}
              style={styles.avatar}
            />
            <Text style={styles.name}>{profile.full_name}</Text>
            {profile.city && (
              <View style={styles.locationRow}>
                <IconSymbol name="location.fill" size={16} color={colors.textSecondary} />
                <Text style={styles.city}>{profile.city}</Text>
              </View>
            )}

            {/* Badge ami */}
            {profile.is_friend && (
              <View style={styles.friendBadge}>
                <IconSymbol name="checkmark.circle.fill" size={16} color={colors.primary} />
                <Text style={styles.friendBadgeText}>Ami</Text>
              </View>
            )}
          </View>

          {/* Bio */}
          {profile.bio && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>À propos</Text>
              <View style={styles.card}>
                <Text style={styles.bio}>{profile.bio}</Text>
              </View>
            </View>
          )}

          {/* Centres d'intérêt */}
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

          {/* Statistiques */}
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

          {/* Boutons d'action */}
          <View style={styles.actionButtons}>
            {isBlocked ? (
              // Utilisateur bloqué
              <TouchableOpacity
                style={[styles.actionButton, styles.blockedButton]}
                onPress={handleUnblockUser}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <>
                    <IconSymbol name="hand.raised.slash.fill" size={20} color={colors.error} />
                    <Text style={styles.blockedButtonText}>Débloquer</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : profile.is_friend ? (
              // Déjà ami
              <>
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

                <TouchableOpacity
                  style={styles.moreButton}
                  onPress={() => setShowOptionsModal(true)}
                >
                  <IconSymbol name="ellipsis" size={20} color={colors.text} />
                </TouchableOpacity>
              </>
            ) : profile.request_sent ? (
              // Demande envoyée
              <TouchableOpacity
                style={[styles.actionButton, styles.pendingButton]}
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
              // Pas encore ami
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleSendFriendRequest}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <>
                    <IconSymbol name="person.badge.plus.fill" size={20} color={colors.background} />
                    <Text style={styles.addButtonText}>Ajouter en ami</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}

      {/* Modal Options pour les amis */}
      <Modal
        visible={showOptionsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOptionsModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowOptionsModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Options</Text>

            {/* Supprimer ami */}
            <TouchableOpacity style={styles.modalOption} onPress={handleRemoveFriend}>
              <IconSymbol name="person.badge.minus.fill" size={20} color={colors.warning} />
              <Text style={styles.modalOptionText}>Supprimer des amis</Text>
            </TouchableOpacity>

            {/* Bloquer */}
            <TouchableOpacity style={styles.modalOption} onPress={handleBlockUser}>
              <IconSymbol name="hand.raised.fill" size={20} color={colors.error} />
              <Text style={[styles.modalOptionText, { color: colors.error }]}>Bloquer</Text>
            </TouchableOpacity>

            {/* Annuler */}
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => setShowOptionsModal(false)}
            >
              <IconSymbol name="xmark" size={20} color={colors.textSecondary} />
              <Text style={styles.modalOptionText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
    borderWidth: 3,
    borderColor: colors.primary,
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
  friendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
    gap: 6,
  },
  friendBadgeText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
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
    fontSize: 14,
    color: colors.textSecondary,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  messageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  messageButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  moreButton: {
    width: 50,
    height: 50,
    backgroundColor: colors.card,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
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
  blockedButton: {
    backgroundColor: colors.error + '20',
    borderWidth: 1,
    borderColor: colors.error,
  },
  blockedButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.error,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalOptionText: {
    fontSize: 16,
    color: colors.text,
  },
});