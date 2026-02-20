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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Check, Calendar, AlertTriangle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
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

      // Vérifier si l'utilisateur est déjà inscrit
      const { data: existingParticipation } = await supabase
        .from('slot_participants')
        .select('id')
        .eq('activity_id', activityId)
        .eq('user_id', currentUserId)
        .maybeSingle();

      if (existingParticipation) {
        Alert.alert('Info', 'Vous êtes déjà inscrit à cette activité.');
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
          Alert.alert('Info', 'Vous êtes déjà inscrit à cette activité.');
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
      Alert.alert(
        'Inscription réussie !',
        'Vous avez rejoint l\'activité ! Un groupe se créera 24 h avant le début de l\'activité.'
      );
    } catch (error: any) {
      console.error('Erreur inscription:', error);
      Alert.alert('Erreur', error.message || 'Une erreur est survenue lors de l\'inscription.');
    } finally {
      setIsInscribing(false);
    }
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
          Vous êtes inscrit à{'\n'}
          <Text style={styles.activityNameHighlight}>{activityName}</Text>
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
                  {inscriptionDone ? 'Inscription effectuée ✓' : 'Simuler l\'inscription (dev)'}
                </Text>
              </>
            )}
          </TouchableOpacity>

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
