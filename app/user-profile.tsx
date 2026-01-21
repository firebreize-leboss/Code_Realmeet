// app/user-profile.tsx
// Page de profil d'un autre utilisateur avec intention, personality_tags et signalement

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
import { PersonalityTagsBadges } from '@/components/PersonalityTagsBadges';
import ReportModal from '@/components/ReportModal';
import { colors } from '@/styles/commonStyles';
import { supabase, removeFriend } from '@/lib/supabase';
import { blockService } from '@/services/block.service';
import { useAuth } from '@/contexts/AuthContext';
import { useDataCache } from '@/contexts/DataCacheContext';
import { UserIntention, getIntentionInfo } from '@/lib/database.types';

interface UserProfile {
  id: string;
  full_name: string;
  avatar_url?: string;
  bio?: string;
  city?: string;
  interests: string[];
  intention: UserIntention;
  personality_tags: string[];
  is_friend: boolean;
  request_sent: boolean;
  activities_joined: number;
  activities_hosted: number;
  account_type: 'user' | 'business';
}

export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { profile: currentUserProfile } = useAuth();
  const { refreshFriends } = useDataCache();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [removingFriend, setRemovingFriend] = useState(false);

  // Vérifier si l'utilisateur actuel est une entreprise
  const isCurrentUserBusiness = currentUserProfile?.account_type === 'business';

  // Récupérer les infos de l'intention
  const intentionInfo = profile?.intention ? getIntentionInfo(profile.intention) : null;

  useEffect(() => {
    loadProfile();
  }, [id]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const targetId = id as string;

      // D'abord, vérifier le type de compte
      const { data: accountData, error: accountError } = await supabase
        .from('profiles')
        .select('account_type')
        .eq('id', targetId)
        .single();

      if (accountError) throw accountError;

      // Si c'est un compte entreprise, rediriger vers la page business-profile
      if (accountData?.account_type === 'business') {
        router.replace(`/business-profile?id=${targetId}`);
        return;
      }

      // Récupérer le profil utilisateur complet
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, bio, city, interests, intention, personality_tags, account_type')
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
        .from('slot_participants')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', targetId);

      // Compter les activités organisées
      const { count: hostedCount } = await supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('host_id', targetId);

      // Vérifier si déjà amis (seulement si l'utilisateur actuel n'est pas une entreprise)
      let isFriend = false;
      let alreadyRequested = false;

      if (!isCurrentUserBusiness) {
        const { data: friendRows } = await supabase
          .from('friendships')
          .select('id')
          .eq('user_id', currentUser.id)
          .eq('friend_id', targetId);
        isFriend = friendRows && friendRows.length > 0;

        // Vérifier si une demande d'ami a été envoyée
        const { data: requestRows } = await supabase
          .from('friend_requests')
          .select('id')
          .eq('sender_id', currentUser.id)
          .eq('receiver_id', targetId)
          .eq('status', 'pending');
        alreadyRequested = requestRows && requestRows.length > 0;
      }

      // Vérifier si bloqué
      const blocked = await blockService.isUserBlocked(targetId);
      setIsBlocked(blocked);

      const userProfile: UserProfile = {
        id: targetId,
        full_name: profileData.full_name || 'Utilisateur',
        avatar_url: profileData.avatar_url || undefined,
        bio: profileData.bio || undefined,
        city: profileData.city || undefined,
        interests: profileData.interests || [],
        intention: profileData.intention || null,
        personality_tags: profileData.personality_tags || [],
        is_friend: isFriend,
        request_sent: alreadyRequested,
        activities_joined: joinedCount ?? 0,
        activities_hosted: hostedCount ?? 0,
        account_type: profileData.account_type,
      };

      setProfile(userProfile);
    } catch (error: any) {
      console.error('Error loading profile:', error);
      Alert.alert('Erreur', error.message || 'Impossible de charger le profil');
    } finally {
      setLoading(false);
    }
  };

  const handleSendFriendRequest = async () => {
    if (!profile) return;
    setSendingRequest(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      const { error } = await supabase.from('friend_requests').insert({
        sender_id: user.id,
        receiver_id: profile.id,
        status: 'pending',
      });

      if (error && !error.message.toLowerCase().includes('duplicate')) {
        throw error;
      }

      setProfile(prev => prev ? { ...prev, request_sent: true } : null);
      Alert.alert('Succès', 'Demande d\'ami envoyée !');
    } catch (error: any) {
      console.error('Error sending friend request:', error);
      Alert.alert('Erreur', error.message || 'Impossible d\'envoyer la demande');
    } finally {
      setSendingRequest(false);
    }
  };

  const handleStartConversation = () => {
    if (profile) {
      router.push(`/chat?recipientId=${profile.id}`);
    }
  };

  const handleBlockUser = async () => {
    if (!profile) return;
    setShowOptionsModal(false);

    Alert.alert(
      'Bloquer cet utilisateur ?',
      'Vous ne pourrez plus voir ses messages ni ses activités.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Bloquer',
          style: 'destructive',
          onPress: async () => {
            const result = await blockService.blockUser(profile.id);
            if (result.success) {
              setIsBlocked(true);
              Alert.alert('Succès', 'Utilisateur bloqué');
            } else {
              Alert.alert('Erreur', result.error || 'Impossible de bloquer');
            }
          },
        },
      ]
    );
  };

  const handleUnblockUser = async () => {
    if (!profile) return;

    const result = await blockService.unblockUser(profile.id);
    if (result.success) {
      setIsBlocked(false);
      Alert.alert('Succès', 'Utilisateur débloqué');
    } else {
      Alert.alert('Erreur', result.error || 'Impossible de débloquer');
    }
  };

  // Ouvrir la modal de signalement
  const handleReportUser = () => {
    setShowOptionsModal(false);
    // Petit délai pour éviter le chevauchement des modals
    setTimeout(() => {
      setShowReportModal(true);
    }, 300);
  };

  // Retirer de ses amis
  const handleRemoveFriend = async () => {
    if (!profile) return;
    setShowOptionsModal(false);

    Alert.alert(
      'Retirer de ses amis ?',
      `${profile.full_name} ne sera plus dans votre liste d'amis. Vous devrez renvoyer une demande d'ami pour redevenir amis.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            setRemovingFriend(true);
            const result = await removeFriend(profile.id);
            setRemovingFriend(false);

            if (result.success) {
              // Mettre à jour l'état local
              setProfile(prev => prev ? { ...prev, is_friend: false, request_sent: false } : null);
              // Rafraîchir le cache des amis
              refreshFriends();
              Alert.alert('Succès', `${profile.full_name} a été retiré de vos amis`);
            } else {
              Alert.alert('Erreur', 'Impossible de retirer cet ami');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Profil introuvable</Text>
          <TouchableOpacity style={styles.backButtonLarge} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profil</Text>
        <TouchableOpacity onPress={() => setShowOptionsModal(true)} style={styles.optionsButton}>
          <IconSymbol name="ellipsis" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <Image
            source={{ uri: profile.avatar_url || 'https://via.placeholder.com/120' }}
            style={styles.avatar}
          />
          <Text style={styles.name}>{profile.full_name}</Text>
          {profile.city && (
            <View style={styles.locationRow}>
              <IconSymbol name="location.fill" size={16} color={colors.textSecondary} />
              <Text style={styles.city}>{profile.city}</Text>
            </View>
          )}
          {profile.is_friend && (
            <View style={styles.friendBadge}>
              <IconSymbol name="checkmark" size={14} color={colors.primary} />
              <Text style={styles.friendBadgeText}>Ami</Text>
            </View>
          )}
        </View>

        {/* Intention */}
        {intentionInfo && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recherche</Text>
            <View style={[styles.intentionCard, { borderColor: intentionInfo.color }]}>
              <View style={[styles.intentionIcon, { backgroundColor: intentionInfo.color + '20' }]}>
                <IconSymbol name={intentionInfo.icon as any} size={22} color={intentionInfo.color} />
              </View>
              <Text style={[styles.intentionText, { color: intentionInfo.color }]}>
                {intentionInfo.label}
              </Text>
            </View>
          </View>
        )}

        {/* Bio */}
        {profile.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>À propos</Text>
            <View style={styles.card}>
              <Text style={styles.bio}>{profile.bio}</Text>
            </View>
          </View>
        )}

        {/* Personality Tags */}
        {profile.personality_tags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personnalité</Text>
            <PersonalityTagsBadges tags={profile.personality_tags} />
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
          <TouchableOpacity 
            style={styles.activitiesCard}
            onPress={() => router.push(`/user-activities?id=${profile.id}&name=${encodeURIComponent(profile.full_name)}`)}
            activeOpacity={0.7}
          >
            <View style={styles.activitiesCardContent}>
              <IconSymbol name="figure.run" size={24} color={colors.primary} />
              <View style={styles.activitiesCardText}>
                <Text style={styles.activitiesCardValue}>{profile.activities_joined}</Text>
                <Text style={styles.activitiesCardLabel}>Activités rejointes</Text>
              </View>
            </View>
            <IconSymbol name="chevron.right" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Boutons d'action - seulement pour les utilisateurs, pas les entreprises */}
        {!isCurrentUserBusiness && (
          <View style={styles.actionButtons}>
            {isBlocked ? (
              <TouchableOpacity style={styles.unblockButton} onPress={handleUnblockUser}>
                <IconSymbol name="hand.raised.slash" size={20} color={colors.text} />
                <Text style={styles.unblockButtonText}>Débloquer</Text>
              </TouchableOpacity>
            ) : (
              <>
                {/* Bouton Message */}
                <TouchableOpacity style={styles.messageButton} onPress={handleStartConversation}>
                  <IconSymbol name="message.fill" size={20} color={colors.background} />
                  <Text style={styles.messageButtonText}>Message</Text>
                </TouchableOpacity>

                {/* Bouton Ajouter en ami */}
                {!profile.is_friend && !profile.request_sent && (
                  <TouchableOpacity
                    style={styles.addFriendButton}
                    onPress={handleSendFriendRequest}
                    disabled={sendingRequest}
                  >
                    {sendingRequest ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <IconSymbol name="person.badge.plus" size={20} color={colors.primary} />
                        <Text style={styles.addFriendButtonText}>Ajouter</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {/* Badge demande envoyée */}
                {profile.request_sent && (
                  <View style={styles.pendingBadge}>
                    <IconSymbol name="clock" size={16} color={colors.textSecondary} />
                    <Text style={styles.pendingText}>Demande envoyée</Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* Modal Options */}
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

            {/* Option Retirer de ses amis - seulement si c'est un ami */}
            {profile.is_friend && (
              <TouchableOpacity
                style={styles.modalOption}
                onPress={handleRemoveFriend}
                disabled={removingFriend}
              >
                <IconSymbol name="person.badge.minus" size={20} color={colors.error} />
                <Text style={[styles.modalOptionText, { color: colors.error }]}>
                  {removingFriend ? 'Suppression...' : 'Retirer de ses amis'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Option Signaler */}
            <TouchableOpacity style={styles.modalOption} onPress={handleReportUser}>
              <IconSymbol name="flag.fill" size={20} color={colors.error} />
              <Text style={[styles.modalOptionText, { color: colors.error }]}>
                Signaler cet utilisateur
              </Text>
            </TouchableOpacity>

            {/* Option Bloquer */}
            {!isBlocked && (
              <TouchableOpacity style={styles.modalOption} onPress={handleBlockUser}>
                <IconSymbol name="hand.raised.fill" size={20} color={colors.textSecondary} />
                <Text style={styles.modalOptionText}>Bloquer</Text>
              </TouchableOpacity>
            )}

            {/* Option Débloquer */}
            {isBlocked && (
              <TouchableOpacity style={styles.modalOption} onPress={handleUnblockUser}>
                <IconSymbol name="hand.raised.slash" size={20} color={colors.primary} />
                <Text style={[styles.modalOptionText, { color: colors.primary }]}>Débloquer</Text>
              </TouchableOpacity>
            )}

            {/* Bouton Annuler */}
            <TouchableOpacity
              style={[styles.modalOption, styles.cancelOption]}
              onPress={() => setShowOptionsModal(false)}
            >
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal Signalement */}
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        targetType="profile"
        targetId={profile.id}
        targetName={profile.full_name}
      />
    </SafeAreaView>
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
    gap: 16,
  },
  errorText: {
    fontSize: 18,
    color: colors.text,
  },
  backButtonLarge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: colors.background,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  optionsButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
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
    backgroundColor: colors.card,
    marginBottom: 16,
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
    fontSize: 15,
    color: colors.textSecondary,
  },
  friendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
  },
  friendBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  intentionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 16,
    gap: 14,
    borderWidth: 1,
  },
  intentionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  intentionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
  },
  bio: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestBadge: {
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  interestText: {
    fontSize: 14,
    color: colors.text,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
  },
  statLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
  },
  messageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  messageButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  addFriendButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    padding: 14,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  addFriendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  unblockButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  unblockButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.card,
    borderRadius: 12,
  },
  pendingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  activitiesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
  },
  activitiesCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  activitiesCardText: {
    gap: 2,
  },
  activitiesCardValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
  },
  activitiesCardLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
    borderRadius: 12,
    backgroundColor: colors.card,
    marginBottom: 10,
  },
  modalOptionText: {
    fontSize: 16,
    color: colors.text,
  },
  cancelOption: {
    justifyContent: 'center',
    backgroundColor: 'transparent',
    marginTop: 10,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});