// app/user-profile.tsx
// Page de profil d'un autre utilisateur avec détection entreprise et intention

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
import { useAuth } from '@/contexts/AuthContext';
import { UserIntention, getIntentionInfo } from '@/lib/database.types';

interface UserProfile {
  id: string;
  full_name: string;
  avatar_url?: string;
  bio?: string;
  city?: string;
  interests: string[];
  intention: UserIntention;  // ✅ NOUVEAU
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

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);

  // Vérifier si l'utilisateur actuel est une entreprise
  const isCurrentUserBusiness = currentUserProfile?.account_type === 'business';

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

      // Récupérer le profil utilisateur complet (avec intention)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, bio, city, interests, account_type, intention')
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
        full_name: profileData.full_name,
        avatar_url: profileData.avatar_url || undefined,
        bio: profileData.bio || undefined,
        city: profileData.city || undefined,
        interests: profileData.interests || [],
        intention: profileData.intention || null,  // ✅ NOUVEAU
        is_friend: isFriend,
        request_sent: alreadyRequested,
        activities_joined: joinedCount ?? 0,
        activities_hosted: hostedCount ?? 0,
        account_type: profileData.account_type,
      };

      setProfile(userProfile);
    } catch (error) {
      console.error('Erreur chargement profil:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendFriendRequest = async () => {
    if (!profile || isCurrentUserBusiness) return;

    setSendingRequest(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) throw new Error('Non connecté');

      const { error } = await supabase.from('friend_requests').insert({
        sender_id: userData.user.id,
        receiver_id: profile.id,
        status: 'pending',
      });

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, request_sent: true } : null);
      Alert.alert('Succès', 'Demande d\'ami envoyée !');
    } catch (error) {
      console.error('Erreur envoi demande:', error);
      Alert.alert('Erreur', 'Impossible d\'envoyer la demande');
    } finally {
      setSendingRequest(false);
    }
  };

  const handleBlockUser = async () => {
    if (!profile) return;

    Alert.alert(
      'Bloquer cet utilisateur ?',
      'Vous ne pourrez plus voir ses messages ni interagir avec lui.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Bloquer',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockService.blockUser(profile.id);
              setIsBlocked(true);
              setShowOptionsModal(false);
              Alert.alert('Utilisateur bloqué', 'Cet utilisateur a été bloqué.');
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de bloquer cet utilisateur');
            }
          },
        },
      ]
    );
  };

  const handleUnblockUser = async () => {
    if (!profile) return;

    try {
      await blockService.unblockUser(profile.id);
      setIsBlocked(false);
      Alert.alert('Utilisateur débloqué', 'Vous pouvez à nouveau interagir avec cet utilisateur.');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de débloquer cet utilisateur');
    }
  };

  const handleStartConversation = async () => {
    if (!profile || isCurrentUserBusiness) return;

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) throw new Error('Non connecté');

      // Vérifier si une conversation existe déjà
      const { data: existingConv } = await supabase.rpc('get_or_create_conversation', {
        p_other_user_id: profile.id
      });

      if (existingConv) {
        router.push(`/conversation?id=${existingConv}`);
      }
    } catch (error) {
      console.error('Erreur conversation:', error);
      Alert.alert('Erreur', 'Impossible de démarrer la conversation');
    }
  };

  // ✅ NOUVEAU: Fonction pour obtenir les infos d'intention
  const intentionInfo = profile?.intention ? getIntentionInfo(profile.intention) : null;

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
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profil</Text>
        <TouchableOpacity
          style={styles.optionsButton}
          onPress={() => setShowOptionsModal(true)}
        >
          <IconSymbol name="ellipsis" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar et nom */}
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

        {/* ✅ NOUVEAU: Affichage de l'intention */}
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
                  <View style={styles.requestSentBadge}>
                    <IconSymbol name="clock" size={18} color={colors.textSecondary} />
                    <Text style={styles.requestSentText}>Demande envoyée</Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* Message pour les entreprises */}
        {isCurrentUserBusiness && (
          <View style={styles.businessNotice}>
            <IconSymbol name="info.circle.fill" size={20} color={colors.primary} />
            <Text style={styles.businessNoticeText}>
              En tant qu'entreprise, vous ne pouvez pas interagir directement avec les utilisateurs
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Modal options */}
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
            <TouchableOpacity style={styles.modalOption} onPress={handleBlockUser}>
              <IconSymbol name="hand.raised.fill" size={22} color="#EF4444" />
              <Text style={[styles.modalOptionText, { color: '#EF4444' }]}>Bloquer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => setShowOptionsModal(false)}
            >
              <IconSymbol name="xmark" size={22} color={colors.textSecondary} />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  backButtonLarge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: colors.background,
    fontWeight: '600',
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  optionsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: 15,
    color: colors.textSecondary,
  },
  friendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  friendBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
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
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  // ✅ NOUVEAU: Styles pour l'intention
  intentionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    gap: 12,
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
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  interestText: {
    fontSize: 14,
    fontWeight: '500',
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
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  messageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
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
    gap: 8,
    backgroundColor: colors.card,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  addFriendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  requestSentBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.card,
    paddingVertical: 14,
    borderRadius: 12,
  },
  requestSentText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  unblockButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.card,
    paddingVertical: 14,
    borderRadius: 12,
  },
  unblockButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  businessNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 24,
    padding: 16,
    backgroundColor: colors.primary + '15',
    borderRadius: 12,
  },
  businessNoticeText: {
    flex: 1,
    fontSize: 14,
    color: colors.primary,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 20,
    paddingBottom: 40,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalOptionText: {
    fontSize: 16,
    color: colors.text,
  },
});