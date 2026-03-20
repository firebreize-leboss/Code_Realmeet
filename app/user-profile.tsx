// app/user-profile.tsx
// Page de profil d'un autre utilisateur — Prototype 3 "Bandeau éditorial"

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
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import ReportModal from '@/components/ReportModal';
import { colors } from '@/styles/commonStyles';
import { supabase, removeFriend } from '@/lib/supabase';
import { blockService } from '@/services/block.service';
import { useAuth } from '@/contexts/AuthContext';
import { useDataCache } from '@/contexts/DataCacheContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';

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
  const [showInvitationModal, setShowInvitationModal] = useState(false);
  const [invitationMessage, setInvitationMessage] = useState('');

  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

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

      // Récupérer le profil utilisateur complet
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, bio, city, interests, account_type')
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
        .eq('user_id', targetId)
        .in('status', ['active', 'completed']);

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
        is_friend: isFriend,
        request_sent: alreadyRequested,
        activities_joined: joinedCount ?? 0,
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

  const handleOpenInvitationModal = () => {
    setInvitationMessage('');
    setShowInvitationModal(true);
  };

  const handleSendInvitation = async () => {
    if (!profile || !invitationMessage.trim()) {
      Alert.alert('Erreur', 'Veuillez écrire un message d\'invitation');
      return;
    }

    setSendingRequest(true);
    setShowInvitationModal(false);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      // 1. Créer la demande d'ami
      const { data: friendRequest, error: requestError } = await supabase
        .from('friend_requests')
        .insert({
          sender_id: user.id,
          receiver_id: profile.id,
          status: 'pending',
        })
        .select()
        .single();

      if (requestError) {
        if (requestError.message.toLowerCase().includes('duplicate')) {
          Alert.alert('Info', 'Une demande d\'ami est déjà en attente');
          return;
        }
        throw requestError;
      }

      // 2. Vérifier si une conversation existe déjà
      const { data: myParticipations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      let existingConvId: string | null = null;

      if (myParticipations && myParticipations.length > 0) {
        const myConvIds = myParticipations.map(p => p.conversation_id);
        const { data: friendParticipations } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', profile.id)
          .in('conversation_id', myConvIds);

        if (friendParticipations && friendParticipations.length > 0) {
          for (const fp of friendParticipations) {
            const { data: convData } = await supabase
              .from('conversations')
              .select('is_group')
              .eq('id', fp.conversation_id)
              .single();

            if (convData?.is_group) continue;

            const { count } = await supabase
              .from('conversation_participants')
              .select('*', { count: 'exact', head: true })
              .eq('conversation_id', fp.conversation_id);

            if (count === 2) {
              existingConvId = fp.conversation_id;

              // Réinitialiser is_hidden si la conversation était cachée
              await supabase
                .from('conversation_participants')
                .update({ is_hidden: false })
                .eq('conversation_id', fp.conversation_id)
                .eq('user_id', user.id);

              break;
            }
          }
        }
      }

      let conversationId: string;

      if (existingConvId) {
        // Mettre à jour la conversation existante avec le friend_request_id
        await supabase
          .from('conversations')
          .update({ friend_request_id: friendRequest.id })
          .eq('id', existingConvId);
        conversationId = existingConvId;
      } else {
        // 3. Créer une nouvelle conversation liée à la demande d'ami
        const { data: conversation, error: convError } = await supabase
          .from('conversations')
          .insert({
            is_group: false,
            friend_request_id: friendRequest.id,
          })
          .select()
          .single();

        if (convError) throw convError;
        conversationId = conversation.id;

        // 4. Ajouter les participants
        const { error: partError } = await supabase
          .from('conversation_participants')
          .insert([
            { conversation_id: conversationId, user_id: user.id },
            { conversation_id: conversationId, user_id: profile.id },
          ]);

        if (partError) throw partError;
      }

      // 5. Envoyer le message d'invitation
      const { error: msgError } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: invitationMessage.trim(),
        message_type: 'text',
      });

      if (msgError) throw msgError;

      setProfile(prev => prev ? { ...prev, request_sent: true } : null);
      Alert.alert('Succès', 'Invitation envoyée ! En attente de réponse.');
    } catch (error: any) {
      console.error('Error sending invitation:', error);
      Alert.alert('Erreur', error.message || 'Impossible d\'envoyer l\'invitation');
    } finally {
      setSendingRequest(false);
    }
  };

  const handleStartConversation = async () => {
    if (!profile) return;

    try {
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser?.user?.id) throw new Error('User not authenticated');

      const { data: myParticipations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', currentUser.user.id);

      if (myParticipations && myParticipations.length > 0) {
        const myConvIds = myParticipations.map(p => p.conversation_id);
        const { data: friendParticipations } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', profile.id)
          .in('conversation_id', myConvIds);

        if (friendParticipations && friendParticipations.length > 0) {
          for (const fp of friendParticipations) {
            const { data: convData } = await supabase
              .from('conversations')
              .select('is_group')
              .eq('id', fp.conversation_id)
              .single();

            if (convData?.is_group) continue;

            const { count } = await supabase
              .from('conversation_participants')
              .select('*', { count: 'exact', head: true })
              .eq('conversation_id', fp.conversation_id);

            if (count === 2) {
              // Réinitialiser is_hidden si la conversation était cachée
              await supabase
                .from('conversation_participants')
                .update({ is_hidden: false })
                .eq('conversation_id', fp.conversation_id)
                .eq('user_id', currentUser.user.id);

              router.push(`/chat-detail?id=${fp.conversation_id}`);
              return;
            }
          }
        }
      }

      // Si aucune conversation n'existe, en créer une nouvelle
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({ is_group: false })
        .select()
        .single();

      if (convError) throw convError;

      const participants = [currentUser.user.id, profile.id].map(userId => ({
        conversation_id: conversation.id,
        user_id: userId,
      }));

      const { error: partError } = await supabase
        .from('conversation_participants')
        .insert(participants);

      if (partError) throw partError;

      router.push(`/chat-detail?id=${conversation.id}`);
    } catch (error) {
      console.error('Error creating conversation:', error);
      Alert.alert('Erreur', 'Impossible de démarrer la conversation');
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

  if (loading || !fontsLoaded) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Profil introuvable</Text>
          <TouchableOpacity style={styles.backButtonLarge} onPress={() => router.back()}>
            <Text style={styles.backButtonLargeText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Bandeau gradient orange */}
        <LinearGradient
          colors={['#F2994A', '#F5C47A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBanner}
        >
          <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => router.back()}
              >
                <IconSymbol name="chevron.left" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => setShowOptionsModal(true)}
              >
                <IconSymbol name="ellipsis" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* 2. Avatar chevauchant */}
        <View style={styles.avatarWrapper}>
          <View style={styles.avatarBorder}>
            <Image
              source={{ uri: profile.avatar_url || 'https://via.placeholder.com/100' }}
              style={styles.avatar}
            />
          </View>
        </View>

        {/* 3. Nom + Localisation + Badge ami */}
        <View style={styles.identitySection}>
          <Text style={styles.name}>{profile.full_name}</Text>
          <View style={styles.locationFriendRow}>
            {profile.city && (
              <View style={styles.locationRow}>
                <IconSymbol name="location.fill" size={13} color={colors.textTertiary} />
                <Text style={styles.cityText}>{profile.city}</Text>
              </View>
            )}
            {profile.is_friend && (
              <>
                {profile.city && <Text style={styles.dotSeparator}>·</Text>}
                <View style={styles.friendBadge}>
                  <IconSymbol name="checkmark" size={11} color="#166534" />
                  <Text style={styles.friendBadgeText}>Ami</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* 4. Stats rapides */}
        <View style={styles.statsRow}>
          <View style={styles.statBlock}>
            <Text style={styles.statValue}>{profile.activities_joined}</Text>
            <Text style={styles.statLabel}>Activités rejointes</Text>
          </View>
        </View>

        {/* 5. Bio (style citation) */}
        {profile.bio ? (
          <View style={styles.section}>
            <View style={styles.bioQuote}>
              <Text style={styles.bioText}>{profile.bio}</Text>
            </View>
          </View>
        ) : null}

        {/* 6. Centres d'intérêt */}
        {profile.interests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Centres d'intérêt</Text>
            <View style={styles.tagsContainer}>
              {profile.interests.map((interest, index) => (
                <View key={index} style={styles.interestTag}>
                  <Text style={styles.interestTagText}>{interest}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 7. Voir ses activités */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.activitiesCard}
            onPress={() => router.push(`/user-activities?id=${profile.id}&name=${encodeURIComponent(profile.full_name)}`)}
            activeOpacity={0.7}
          >
            <View style={styles.activitiesCardLeft}>
              <IconSymbol name="calendar" size={20} color="#F2994A" />
              <View>
                <Text style={styles.activitiesCardTitle}>Voir ses activités</Text>
                <Text style={styles.activitiesCardSub}>
                  {profile.activities_joined} activités rejointes
                </Text>
              </View>
            </View>
            <IconSymbol name="chevron.right" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 8. Barre d'action fixe en bas */}
      {!isCurrentUserBusiness && (
        <View style={styles.bottomBar}>
          {isBlocked ? (
            <TouchableOpacity style={styles.bottomButtonSecondary} onPress={handleUnblockUser}>
              <IconSymbol name="hand.raised.slash" size={18} color={colors.text} />
              <Text style={styles.bottomButtonSecondaryText}>Débloquer</Text>
            </TouchableOpacity>
          ) : profile.is_friend ? (
            <TouchableOpacity style={styles.bottomButtonPrimary} onPress={handleStartConversation}>
              <IconSymbol name="message.fill" size={18} color="#FFFFFF" />
              <Text style={styles.bottomButtonPrimaryText}>Message</Text>
            </TouchableOpacity>
          ) : profile.request_sent ? (
            <View style={styles.bottomPendingBadge}>
              <IconSymbol name="clock" size={16} color={colors.textTertiary} />
              <Text style={styles.bottomPendingText}>Invitation envoyée</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.bottomButtonPrimary}
              onPress={handleOpenInvitationModal}
              disabled={sendingRequest}
            >
              {sendingRequest ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <IconSymbol name="person.badge.plus" size={18} color="#FFFFFF" />
                  <Text style={styles.bottomButtonPrimaryText}>Ajouter</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

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

            <TouchableOpacity style={styles.modalOption} onPress={handleReportUser}>
              <IconSymbol name="flag.fill" size={20} color={colors.error} />
              <Text style={[styles.modalOptionText, { color: colors.error }]}>
                Signaler cet utilisateur
              </Text>
            </TouchableOpacity>

            {!isBlocked && (
              <TouchableOpacity style={styles.modalOption} onPress={handleBlockUser}>
                <IconSymbol name="hand.raised.fill" size={20} color={colors.textSecondary} />
                <Text style={styles.modalOptionText}>Bloquer</Text>
              </TouchableOpacity>
            )}

            {isBlocked && (
              <TouchableOpacity style={styles.modalOption} onPress={handleUnblockUser}>
                <IconSymbol name="hand.raised.slash" size={20} color={colors.primary} />
                <Text style={[styles.modalOptionText, { color: colors.primary }]}>Débloquer</Text>
              </TouchableOpacity>
            )}

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

      {/* Modal d'invitation */}
      <Modal
        visible={showInvitationModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowInvitationModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.invitationModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={styles.invitationModalBackdrop}
            activeOpacity={1}
            onPress={() => setShowInvitationModal(false)}
          />
          <View style={styles.invitationModalContent}>
            <View style={styles.invitationModalHeader}>
              <Text style={styles.invitationModalTitle}>Envoyer une invitation</Text>
              <TouchableOpacity onPress={() => setShowInvitationModal(false)}>
                <IconSymbol name="xmark" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.invitationRecipient}>
              <Image
                source={{ uri: profile.avatar_url || 'https://via.placeholder.com/40' }}
                style={styles.invitationRecipientAvatar}
              />
              <Text style={styles.invitationRecipientName}>{profile.full_name}</Text>
            </View>

            <Text style={styles.invitationHint}>
              Écrivez un message pour vous présenter. {profile.full_name} devra accepter votre invitation pour pouvoir discuter.
            </Text>

            <TextInput
              style={styles.invitationInput}
              placeholder="Bonjour ! J'aimerais faire votre connaissance..."
              placeholderTextColor={colors.textMuted}
              value={invitationMessage}
              onChangeText={setInvitationMessage}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />

            <View style={styles.invitationCharCount}>
              <Text style={styles.invitationCharCountText}>
                {invitationMessage.length}/500
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.invitationSendButton,
                !invitationMessage.trim() && styles.invitationSendButtonDisabled,
              ]}
              onPress={handleSendInvitation}
              disabled={!invitationMessage.trim() || sendingRequest}
            >
              {sendingRequest ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.invitationSendButtonText}>Envoyer l'invitation</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
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
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
  },
  backButtonLarge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonLargeText: {
    color: '#FFFFFF',
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 15,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 100,
  },

  // 1. Bandeau gradient
  gradientBanner: {
    height: 180,
  },
  headerSafeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // 2. Avatar chevauchant
  avatarWrapper: {
    alignItems: 'center',
    marginTop: -56,
  },
  avatarBorder: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },

  // 3. Identité
  identitySection: {
    alignItems: 'center',
    paddingTop: 12,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  name: {
    fontSize: 24,
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
    marginBottom: 6,
  },
  locationFriendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cityText: {
    fontSize: 13,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
  },
  dotSeparator: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  friendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  friendBadgeText: {
    fontSize: 12,
    fontFamily: 'Manrope_600SemiBold',
    color: '#166534',
  },

  // 4. Stats rapides
  statsRow: {
    paddingHorizontal: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  statBlock: {
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontFamily: 'Manrope_700Bold',
    color: '#F2994A',
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Manrope_500Medium',
    color: '#993C1D',
    marginTop: 2,
  },

  // 5. Bio citation
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  bioQuote: {
    paddingLeft: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#F2994A',
  },
  bioText: {
    fontSize: 14,
    fontFamily: 'Manrope_400Regular',
    fontStyle: 'italic',
    lineHeight: 22,
    color: colors.textSecondary,
  },

  // 6. Sections tags
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
    marginBottom: 10,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestTag: {
    backgroundColor: '#F5F5F7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  interestTagText: {
    fontSize: 13,
    fontFamily: 'Manrope_500Medium',
    color: colors.text,
  },

  // 7. Voir ses activités
  activitiesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  activitiesCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activitiesCardTitle: {
    fontSize: 14,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
  },
  activitiesCardSub: {
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
    marginTop: 2,
  },

  // 8. Barre d'action fixe
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  bottomButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2994A',
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  bottomButtonPrimaryText: {
    fontSize: 16,
    fontFamily: 'Manrope_600SemiBold',
    color: '#FFFFFF',
  },
  bottomButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  bottomButtonSecondaryText: {
    fontSize: 16,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
  },
  bottomPendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  bottomPendingText: {
    fontSize: 15,
    fontFamily: 'Manrope_500Medium',
    color: colors.textTertiary,
  },

  // Modals
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
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 20,
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
    fontFamily: 'Manrope_500Medium',
    color: colors.text,
  },
  cancelOption: {
    justifyContent: 'center',
    backgroundColor: 'transparent',
    marginTop: 10,
  },
  cancelText: {
    fontSize: 16,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Modal invitation
  invitationModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  invitationModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  invitationModalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  invitationModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  invitationModalTitle: {
    fontSize: 18,
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
  },
  invitationRecipient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    padding: 12,
    backgroundColor: colors.card,
    borderRadius: 12,
  },
  invitationRecipientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.border,
  },
  invitationRecipientName: {
    fontSize: 16,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
  },
  invitationHint: {
    fontSize: 14,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  invitationInput: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    fontFamily: 'Manrope_400Regular',
    color: colors.text,
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
  },
  invitationCharCount: {
    alignItems: 'flex-end',
    marginTop: 8,
    marginBottom: 16,
  },
  invitationCharCountText: {
    fontSize: 12,
    fontFamily: 'Manrope_400Regular',
    color: colors.textTertiary,
  },
  invitationSendButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  invitationSendButtonDisabled: {
    backgroundColor: colors.border,
  },
  invitationSendButtonText: {
    fontSize: 16,
    fontFamily: 'Manrope_600SemiBold',
    color: '#FFFFFF',
  },
});
