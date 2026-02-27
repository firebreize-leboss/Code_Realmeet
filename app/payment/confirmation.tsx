// app/payment/confirmation.tsx
// Page de confirmation de paiement avec bouton dev pour inscription réelle

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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Check, Calendar, AlertTriangle, Users, Copy, Share2, Clock } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '@/lib/supabase';
import { invitationService } from '@/services/invitation.service';
import { colors, typography, spacing, borderRadius, shadows } from '@/styles/commonStyles';
import { useFonts, Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';

export default function ConfirmationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  const activityId = typeof params.activity_id === 'string' ? params.activity_id : '';
  const slotId = typeof params.slot_id === 'string' ? params.slot_id : '';
  const activityName = typeof params.activity_name === 'string' ? params.activity_name : '';
  const hostId = typeof params.host_id === 'string' ? params.host_id : '';
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

  // Plus one acceptance state
  const [plusOneAccepted, setPlusOneAccepted] = useState(false);

  useEffect(() => {
    // Animation d'apparition du checkmark
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
  }, []);

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
  const handleSlotGroup = async (
    slotIdParam: string,
    activityTitle: string,
    slotDate: string
  ) => {
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

  // LOGIQUE D'INSCRIPTION RÉELLE (copiée depuis activity-detail.tsx)
  const handleDevInscription = async () => {
    if (isInscribing || inscriptionDone) return;

    // Mode +1 : accepter l'invitation au lieu de l'inscription classique
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
        setPlusOneAccepted(true);
        Alert.alert('Bienvenue !', 'Tu as rejoint en tant que +1 !');
      } catch (error: any) {
        console.error('Erreur acceptation +1:', error);
        Alert.alert('Erreur', error.message || 'Une erreur est survenue.');
      } finally {
        setIsInscribing(false);
      }
      return;
    }

    setIsInscribing(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        Alert.alert('Erreur', 'Utilisateur non connecté.');
        setIsInscribing(false);
        return;
      }

      const currentUserId = userData.user.id;

      // Récupérer les infos de l'activité
      const { data: activityData, error: activityError } = await supabase
        .from('activities')
        .select('participants, max_participants, nom, titre, image_url')
        .eq('id', activityId)
        .single();

      if (activityError || !activityData) {
        Alert.alert('Erreur', 'Activité introuvable.');
        setIsInscribing(false);
        return;
      }

      // Récupérer les infos du slot
      const { data: slotData, error: slotError } = await supabase
        .from('activity_slots')
        .select('date, time')
        .eq('id', slotId)
        .single();

      if (slotError || !slotData) {
        Alert.alert('Erreur', 'Créneau introuvable.');
        setIsInscribing(false);
        return;
      }

      // Vérifier si l'utilisateur est déjà inscrit à ce créneau
      const { data: existingParticipation } = await supabase
        .from('slot_participants')
        .select('id')
        .eq('slot_id', slotId)
        .eq('user_id', currentUserId)
        .eq('status', 'active')
        .maybeSingle();

      if (existingParticipation) {
        Alert.alert('Info', 'Vous êtes déjà inscrit à ce créneau.');
        setInscriptionDone(true);
        setIsInscribing(false);
        return;
      }

      // Vérifier si l'activité est complète
      const currentParticipants = activityData.participants || 0;
      const maxParticipants = activityData.max_participants || 0;

      if (maxParticipants > 0 && currentParticipants >= maxParticipants) {
        Alert.alert('Complet', 'Cette activité est complète.');
        setIsInscribing(false);
        return;
      }

      // Insérer dans slot_participants
      const { error: insertError } = await supabase
        .from('slot_participants')
        .insert({
          slot_id: slotId,
          activity_id: activityId,
          user_id: currentUserId,
        });

      if (insertError) {
        if (insertError.code === '23505') {
          Alert.alert('Info', 'Vous êtes déjà inscrit à ce créneau.');
          setInscriptionDone(true);
          setIsInscribing(false);
          return;
        }
        throw insertError;
      }

      // Mettre à jour le compteur de participants
      const newCount = currentParticipants + 1;
      await supabase
        .from('activities')
        .update({ participants: newCount })
        .eq('id', activityId);

      // Gérer le groupe du créneau
      const activityTitle = activityData.nom || activityData.titre || '';
      const slotDateFormatted = new Date(slotData.date).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });

      await handleSlotGroup(slotId, activityTitle, slotDateFormatted);

      // Essayer de former les groupes intelligents si conditions remplies
      try {
        const { intelligentGroupsService } = await import('@/services/intelligent-groups.service');
        await intelligentGroupsService.checkAndFormGroupsIfNeeded(slotId, activityId);
      } catch (err) {
        console.error('Erreur formation groupes:', err);
      }

      setInscriptionDone(true);

      // Mode duo : créer l'invitation après l'inscription
      if (mode === 'duo') {
        try {
          const invResult = await invitationService.createInvitation(slotId);
          if (invResult.success && invResult.token) {
            setDuoInvitationToken(invResult.token);
            // L'expiration est NOW + 10 minutes
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
            setDuoExpiresAt(expiresAt);
          } else {
            Alert.alert('Attention', invResult.error || 'Impossible de créer l\'invitation duo.');
          }
        } catch (err) {
          console.error('Erreur création invitation duo:', err);
        }
        Alert.alert(
          'Inscription réussie !',
          'Partage le lien avec ton ami, il a 10 minutes pour s\'inscrire !'
        );
      } else {
        Alert.alert(
          'Inscription réussie !',
          'Vous avez rejoint l\'activité ! Un groupe se créera 24 h avant le début de l\'activité.'
        );
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
    // Naviguer vers l'onglet activités
    router.replace('/(tabs)/activity');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
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

        {/* Texte de confirmation */}
        <Text style={styles.successTitle}>Paiement réussi !</Text>
        <Text style={styles.successSubtitle}>
          {plusOneAccepted
            ? 'Tu as rejoint en tant que +1 !'
            : <>Vous êtes inscrit à{'\n'}<Text style={styles.activityNameHighlight}>{activityName}</Text></>
          }
        </Text>

        {/* Boutons d'action */}
        <View style={styles.actionsContainer}>
          {/* Bouton principal */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleViewActivities}
            activeOpacity={0.8}
          >
            <Calendar size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Voir mes activités</Text>
          </TouchableOpacity>

          {/* Bouton dev temporaire */}
          <TouchableOpacity
            style={[
              styles.devButton,
              inscriptionDone && styles.devButtonDone,
            ]}
            onPress={handleDevInscription}
            disabled={isInscribing || inscriptionDone}
            activeOpacity={0.8}
          >
            {isInscribing ? (
              <ActivityIndicator size="small" color="#F59E0B" />
            ) : (
              <>
                <AlertTriangle size={18} color={inscriptionDone ? colors.success : '#F59E0B'} />
                <Text style={[
                  styles.devButtonText,
                  inscriptionDone && styles.devButtonTextDone,
                ]}>
                  {inscriptionDone
                    ? (plusOneAccepted ? 'Rejoint en +1 ✓' : 'Inscription effectuée ✓')
                    : (isPlusOne ? 'Rejoindre en +1 (dev)' : 'Simuler l\'inscription (dev)')
                  }
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Section Duo - Invite ton ami */}
          {mode === 'duo' && inscriptionDone && duoInvitationToken && !duoExpired && (
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

          {/* Duo expired message */}
          {mode === 'duo' && inscriptionDone && duoExpired && (
            <View style={styles.duoExpiredBox}>
              <Clock size={18} color={colors.textSecondary} />
              <Text style={styles.duoExpiredText}>
                Le délai est expiré, tu es inscrit seul.
              </Text>
            </View>
          )}

          {/* Note explicative */}
          <View style={styles.devNote}>
            <Text style={styles.devNoteText}>
              Le bouton ci-dessus est temporaire.{'\n'}
              Il permet de déclencher l'inscription réelle{'\n'}
              en attendant l'intégration de Stripe.
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },

  // Checkmark
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

  // Success text
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
    marginBottom: spacing.xxxxl,
  },
  activityNameHighlight: {
    fontFamily: 'Manrope_600SemiBold',
    color: colors.text,
  },

  // Actions
  actionsContainer: {
    width: '100%',
    gap: spacing.lg,
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
    ...shadows.sm,
  },
  primaryButtonText: {
    fontSize: typography.base,
    fontFamily: 'Manrope_600SemiBold',
    color: '#FFFFFF',
  },

  // Dev button
  devButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: 'transparent',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: '#F59E0B',
    borderStyle: 'dashed',
  },
  devButtonDone: {
    borderColor: colors.success,
    borderStyle: 'solid',
    backgroundColor: colors.successLight,
  },
  devButtonText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_600SemiBold',
    color: '#F59E0B',
  },
  devButtonTextDone: {
    color: colors.success,
  },

  // Duo section
  duoSection: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: spacing.md,
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
  },
  duoExpiredText: {
    fontSize: typography.sm,
    fontFamily: 'Manrope_500Medium',
    color: colors.textSecondary,
  },

  // Dev note
  devNote: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.warningLight,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  devNoteText: {
    fontSize: typography.xs,
    fontFamily: 'Manrope_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
