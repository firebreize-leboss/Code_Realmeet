// app/confirm-join.tsx
// Écran de confirmation d'inscription à une activité (remplace le flow payment)

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Alert,
  ActivityIndicator,
  Share,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Check, Calendar, AlertTriangle, Users, Copy, Share2, Clock, Info, XCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '@/lib/supabase';
import { invitationService } from '@/services/invitation.service';
import { colors, typography, spacing, borderRadius, shadows } from '@/styles/commonStyles';
import { useFonts, Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';

export default function ConfirmJoinScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  const activityId = typeof params.activity_id === 'string' ? params.activity_id : '';
  const slotId = typeof params.slot_id === 'string' ? params.slot_id : '';
  const activityName = typeof params.activity_name === 'string' ? params.activity_name : '';
  const slotDate = typeof params.slot_date === 'string' ? params.slot_date : '';
  const slotTime = typeof params.slot_time === 'string' ? params.slot_time : '';
  const price = typeof params.price === 'string' ? params.price : '0€';
  const mode = typeof params.mode === 'string' ? params.mode : '';
  const isPlusOne = params.is_plus_one === 'true';
  const invitationToken = typeof params.invitation_token === 'string' ? params.invitation_token : '';

  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  const [isInscribing, setIsInscribing] = useState(false);
  const [inscriptionDone, setInscriptionDone] = useState(false);
  const checkmarkScale = useRef(new Animated.Value(0)).current;
  const checkmarkOpacity = useRef(new Animated.Value(0)).current;

  // Duo mode state
  const [duoInvitationToken, setDuoInvitationToken] = useState<string | null>(null);
  const [duoExpiresAt, setDuoExpiresAt] = useState<string | null>(null);
  const [duoCountdown, setDuoCountdown] = useState<string>('');
  const [duoExpired, setDuoExpired] = useState(false);
  const [copied, setCopied] = useState(false);

  // Countdown timer for duo mode
  useEffect(() => {
    if (!duoExpiresAt) return;

    const updateCountdown = () => {
      const now = new Date().getTime();
      const expires = new Date(duoExpiresAt).getTime();
      const diff = expires - now;

      if (diff <= 0) {
        setDuoCountdown('00:00');
        setDuoExpired(true);
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setDuoCountdown(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [duoExpiresAt]);

  const animateSuccess = () => {
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.spring(checkmarkScale, {
          toValue: 1,
          friction: 4,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(checkmarkOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  // Fonction pour envoyer un message système dans le groupe
  const sendSystemMessage = async (conversationId: string, content: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;

      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: userData.user.id,
        content,
        message_type: 'system',
      });
    } catch (error) {
      console.error('Erreur envoi message système:', error);
    }
  };

  // Fonction pour gérer l'ajout au groupe du créneau
  const handleSlotGroup = async (slotIdParam: string) => {
    try {
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .eq('slot_id', slotIdParam)
        .maybeSingle();

      if (existingConv) {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) return;

        const { data: existingParticipant } = await supabase
          .from('conversation_participants')
          .select('id')
          .eq('conversation_id', existingConv.id)
          .eq('user_id', userData.user.id)
          .maybeSingle();

        if (!existingParticipant) {
          await supabase
            .from('conversation_participants')
            .insert({
              conversation_id: existingConv.id,
              user_id: userData.user.id,
            });

          const { data: userProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', userData.user.id)
            .single();

          await sendSystemMessage(
            existingConv.id,
            `${userProfile?.full_name || 'Un utilisateur'} a rejoint le groupe`
          );
        }
      }
    } catch (error) {
      console.error('Erreur gestion groupe créneau:', error);
    }
  };

  const handleConfirm = async () => {
    if (isInscribing || inscriptionDone) return;

    // Mode +1 : accepter l'invitation
    if (isPlusOne && invitationToken) {
      setIsInscribing(true);
      try {
        const result = await invitationService.acceptInvitation(invitationToken);
        if (!result.success) {
          Alert.alert('Erreur', result.error || 'Impossible d\'accepter l\'invitation.');
          setIsInscribing(false);
          return;
        }
        setInscriptionDone(true);
        animateSuccess();
        Alert.alert('Bienvenue !', 'Tu as rejoint en tant que +1 !');
      } catch (error: any) {
        console.error('Erreur acceptation +1:', error);
        Alert.alert('Erreur', error.message || 'Une erreur est survenue.');
      } finally {
        setIsInscribing(false);
      }
      return;
    }

    // Mode normal : appeler la RPC join_activity_slot
    setIsInscribing(true);
    try {
      const { data, error } = await supabase.rpc('join_activity_slot', {
        p_slot_id: slotId,
        p_activity_id: activityId,
      });

      if (error) throw error;

      if (!data.success) {
        const errorMessages: Record<string, string> = {
          'NOT_AUTHENTICATED': 'Vous devez être connecté.',
          'USER_BANNED': 'Votre compte a été suspendu suite à des absences répétées.',
          'SLOT_NOT_FOUND': 'Créneau introuvable.',
          'SLOT_CANCELLED': 'Ce créneau a été annulé.',
          'REGISTRATION_CLOSED': 'Les inscriptions sont fermées pour ce créneau.',
          'TOO_LATE_TO_JOIN': 'L\'activité commence dans moins de 24h, inscription impossible.',
          'ALREADY_PARTICIPANT': 'Vous êtes déjà inscrit à ce créneau.',
          'SLOT_FULL': 'Ce créneau est complet.',
          'ACTIVITY_FULL': 'Cette activité est complète.',
        };
        Alert.alert('Erreur', errorMessages[data.error] || data.error);
        setIsInscribing(false);
        return;
      }

      // Gérer le groupe du créneau
      await handleSlotGroup(slotId);

      // Essayer de former les groupes intelligents si conditions remplies
      try {
        const { intelligentGroupsService } = await import('@/services/intelligent-groups.service');
        await intelligentGroupsService.checkAndFormGroupsIfNeeded(slotId, activityId);
      } catch (err) {
        console.error('Erreur formation groupes:', err);
      }

      setInscriptionDone(true);
      animateSuccess();

      // Mode duo : créer l'invitation après l'inscription
      if (mode === 'duo') {
        try {
          const invResult = await invitationService.createInvitation(slotId);
          if (invResult.success && invResult.token) {
            setDuoInvitationToken(invResult.token);
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
            setDuoExpiresAt(expiresAt);
          } else {
            Alert.alert('Attention', invResult.error || 'Impossible de créer l\'invitation duo.');
          }
        } catch (err) {
          console.error('Erreur création invitation duo:', err);
        }
      }
    } catch (error: any) {
      console.error('Erreur inscription:', error);
      Alert.alert('Erreur', error.message || 'Une erreur est survenue lors de l\'inscription.');
    } finally {
      setIsInscribing(false);
    }
  };

  const handleDuoCopyLink = async () => {
    if (!duoInvitationToken) return;
    try {
      const link = invitationService.generateShareLink(duoInvitationToken);
      await Clipboard.setStringAsync(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      Alert.alert('Erreur', 'Impossible de copier le lien');
    }
  };

  const handleDuoShare = async () => {
    if (!duoInvitationToken) return;
    await invitationService.shareInvitation(duoInvitationToken, activityName);
  };

  const handleViewActivities = () => {
    router.replace('/(tabs)/activity');
  };

  const formatTime = (time: string) => {
    if (!time) return '';
    return time.slice(0, 5);
  };

  // Vue succès après inscription
  if (inscriptionDone) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.successContent}>
          {/* Checkmark animé */}
          <Animated.View
            style={[
              styles.checkmarkContainer,
              {
                transform: [{ scale: checkmarkScale }],
                opacity: checkmarkOpacity,
              },
            ]}
          >
            <LinearGradient
              colors={['#34C759', '#30B350']}
              style={styles.checkmarkCircle}
            >
              <Check size={48} color="#FFFFFF" strokeWidth={3} />
            </LinearGradient>
          </Animated.View>

          <Text style={styles.successTitle}>Inscription confirmée !</Text>
          <Text style={styles.successSubtitle}>
            {isPlusOne
              ? 'Tu as rejoint en tant que +1 !'
              : `Tu es inscrit(e) pour ${activityName}.`
            }
          </Text>

          {/* Info prix sur place */}
          {!isPlusOne && (
            <View style={styles.infoBlock}>
              <Text style={styles.infoText}>Le paiement de l'activité ({price}) se fera sur place</Text>
            </View>
          )}

          {/* Section Duo */}
          {mode === 'duo' && duoInvitationToken && !duoExpired && (
            <View style={styles.duoSection}>
              <View style={styles.duoHeader}>
                <Users size={20} color={colors.primary} />
                <Text style={styles.duoTitle}>Invite ton ami</Text>
              </View>
              <Text style={styles.duoDescription}>
                Partage ce lien, ton ami a 10 minutes pour s'inscrire !
              </Text>

              <View style={styles.duoCountdownBox}>
                <Clock size={18} color={colors.warning} />
                <Text style={styles.duoCountdownText}>{duoCountdown}</Text>
              </View>

              <View style={styles.duoLinkBox}>
                <Text style={styles.duoLinkText} numberOfLines={1}>
                  {invitationService.generateShareLink(duoInvitationToken)}
                </Text>
              </View>

              <View style={styles.duoButtonsRow}>
                <TouchableOpacity style={styles.duoCopyButton} onPress={handleDuoCopyLink} activeOpacity={0.7}>
                  <Copy size={16} color={copied ? colors.success : colors.primary} />
                  <Text style={[styles.duoCopyText, copied && { color: colors.success }]}>
                    {copied ? 'Copié !' : 'Copier'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.duoShareButton} onPress={handleDuoShare} activeOpacity={0.7}>
                  <Share2 size={16} color="#FFFFFF" />
                  <Text style={styles.duoShareText}>Partager</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {mode === 'duo' && duoExpired && (
            <View style={styles.duoExpiredBox}>
              <Clock size={18} color={colors.textSecondary} />
              <Text style={styles.duoExpiredText}>
                Le délai est expiré, tu es inscrit seul.
              </Text>
            </View>
          )}

          {/* Bouton principal */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleViewActivities}
            activeOpacity={0.8}
          >
            <Calendar size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Voir mes activités</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Vue de confirmation avant inscription
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.confirmContent}>
        {/* Header */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>

        <Text style={styles.pageTitle}>Confirmer l'inscription</Text>

        {/* Récap activité */}
        <View style={styles.recapCard}>
          <Text style={styles.recapActivityName}>{activityName}</Text>
          <View style={styles.recapRow}>
            <Calendar size={16} color={colors.textSecondary} />
            <Text style={styles.recapText}>{slotDate}</Text>
          </View>
          {slotTime && (
            <View style={styles.recapRow}>
              <Clock size={16} color={colors.textSecondary} />
              <Text style={styles.recapText}>{formatTime(slotTime)}</Text>
            </View>
          )}
        </View>

        {/* Prix indicatif */}
        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>Prix estimé</Text>
          <Text style={styles.priceValue}>{price}</Text>
          <Text style={styles.priceNote}>A régler sur place le jour J</Text>
        </View>

        {/* Avertissement no-show */}
        <View style={styles.warningCard}>
          <AlertTriangle size={20} color={colors.warning} />
          <View style={styles.warningTextContainer}>
            <Text style={styles.warningTitle}>Politique de présence</Text>
            <Text style={styles.warningText}>
              2 absences non justifiées (no-show) entraînent la suspension du compte.
              Pensez à annuler si vous ne pouvez pas venir.
            </Text>
          </View>
        </View>

        {/* Info annulation */}
        <View style={styles.infoCard}>
          <Info size={18} color={colors.primary} />
          <Text style={styles.infoCardText}>
            Annulation gratuite jusqu'à 24h avant l'activité.
          </Text>
        </View>
      </ScrollView>

      {/* Footer avec bouton */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <TouchableOpacity
          style={[styles.confirmButton, isInscribing && styles.confirmButtonDisabled]}
          onPress={handleConfirm}
          disabled={isInscribing}
          activeOpacity={0.8}
        >
          {isInscribing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Check size={20} color="#FFFFFF" />
              <Text style={styles.confirmButtonText}>
                {isPlusOne ? 'Rejoindre en +1' : 'Confirmer l\'inscription'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Confirm view
  confirmContent: {
    padding: spacing.xl,
    paddingBottom: 120,
  },
  backButton: {
    marginBottom: spacing.lg,
  },
  backButtonText: {
    fontSize: typography.base,
    fontFamily: 'Manrope_500Medium',
    color: colors.primary,
  },
  pageTitle: {
    fontSize: typography.xxl,
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
    marginBottom: spacing.xxl,
  },

  // Recap card
  recapCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  recapActivityName: {
    fontSize: typography.lg,
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  recapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  recapText: {
    fontSize: typography.base,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
  },

  // Price card
  priceCard: {
    backgroundColor: '#F0F4FF',
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_500Medium',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  priceValue: {
    fontSize: 32,
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  priceNote: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_400Regular',
    color: colors.primary,
  },

  // Warning card
  warningCard: {
    flexDirection: 'row',
    backgroundColor: colors.warningLight,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  warningText: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
    lineHeight: 18,
  },

  // Info card
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4FF',
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  infoCardText: {
    flex: 1,
    fontSize: typography.sm,
    fontFamily: 'Manrope_400Regular',
    color: colors.text,
    lineHeight: 20,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.xl,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  confirmButtonDisabled: {
    opacity: 0.7,
  },
  confirmButtonText: {
    fontSize: typography.base,
    fontFamily: 'Manrope_600SemiBold',
    color: '#FFFFFF',
  },

  // Success view
  successContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  checkmarkContainer: {
    marginBottom: spacing.xxxl,
  },
  checkmarkCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
  successTitle: {
    fontSize: typography.xxl,
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: typography.base,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xxl,
  },

  // Info block
  infoBlock: {
    backgroundColor: '#F5F5F7',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: spacing.xxl,
  },
  infoText: {
    fontSize: 13,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
  },

  // Primary button
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    borderRadius: borderRadius.md,
    width: '100%',
    ...shadows.sm,
  },
  primaryButtonText: {
    fontSize: typography.base,
    fontFamily: 'Manrope_600SemiBold',
    color: '#FFFFFF',
  },

  // Duo section
  duoSection: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: spacing.md,
    width: '100%',
    marginBottom: spacing.xl,
  },
  duoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  duoTitle: {
    fontSize: typography.lg,
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
  },
  duoDescription: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  duoCountdownBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warningLight,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.sm,
  },
  duoCountdownText: {
    fontSize: typography.xl,
    fontFamily: 'Manrope_700Bold',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  duoLinkBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  duoLinkText: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
  },
  duoButtonsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  duoCopyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: '#FFFFFF',
  },
  duoCopyText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_600SemiBold',
    color: colors.primary,
  },
  duoShareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
  },
  duoShareText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_600SemiBold',
    color: '#FFFFFF',
  },
  duoExpiredBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.backgroundAccent,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    width: '100%',
    marginBottom: spacing.xl,
  },
  duoExpiredText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_500Medium',
    color: colors.textSecondary,
  },
});
