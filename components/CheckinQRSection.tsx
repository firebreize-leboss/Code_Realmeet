import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/IconSymbol';
import { CheckinQRCode } from '@/components/CheckinQRCode';

interface Props {
  slotParticipantId: string;
  slotId: string;
  activityName: string;
  slotDate: string;
  slotTime: string;
  organizerName?: string;
}

type ValidationStatus = 'loading' | 'waiting' | 'qr' | 'success' | 'error';

export function CheckinQRSection({
  slotParticipantId,
  slotId,
  activityName,
  slotDate,
  slotTime,
  organizerName,
}: Props) {
  const [groupsFormed, setGroupsFormed] = useState<boolean | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkedInAt, setCheckedInAt] = useState<string | null>(null);
  const [showQRFallback, setShowQRFallback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    checkStatus();
  }, [slotId, slotParticipantId]);

  // Trigger entrance animation when status resolves
  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [loading, checkedIn, errorMessage]);

  const checkStatus = async () => {
    try {
      setErrorMessage(null);
      const [slotResult, participantResult] = await Promise.all([
        supabase
          .from('activity_slots')
          .select('groups_formed')
          .eq('id', slotId)
          .single(),
        supabase
          .from('slot_participants')
          .select('checked_in_at')
          .eq('id', slotParticipantId)
          .single(),
      ]);

      if (slotResult.error) throw slotResult.error;
      setGroupsFormed(slotResult.data?.groups_formed || false);

      const checkedInTimestamp = participantResult.data?.checked_in_at;
      setCheckedIn(!!checkedInTimestamp);
      setCheckedInAt(checkedInTimestamp || null);
    } catch (err) {
      console.error('Erreur vérification statut checkin:', err);
      setGroupsFormed(false);
      setErrorMessage('Impossible de vérifier le statut de votre billet. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  };

  const formatCheckedInTime = (timestamp: string | null): string => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const getStatus = (): ValidationStatus => {
    if (loading) return 'loading';
    if (errorMessage) return 'error';
    if (checkedIn && !showQRFallback) return 'success';
    if (!groupsFormed) return 'waiting';
    return 'qr';
  };

  const status = getStatus();

  if (status === 'loading') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#F2994A" />
      </View>
    );
  }

  // GROUPES PAS ENCORE FORMÉS → Message d'attente
  if (status === 'waiting') {
    return (
      <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
        <View style={styles.waitingContainer}>
          <View style={styles.waitingIconWrapper}>
            <IconSymbol name="clock.fill" size={28} color="#F2994A" />
          </View>
          <Text style={styles.waitingTitle}>Votre billet d'entrée</Text>
          <Text style={styles.waitingMessage}>
            Vous obtiendrez votre QR code 24h avant le début de l'activité, une fois votre groupe formé.
          </Text>
          {slotDate && slotTime && (
            <Text style={styles.waitingSlotInfo}>
              Créneau : {slotDate} à {slotTime}
            </Text>
          )}
        </View>
      </Animated.View>
    );
  }

  // TICKET VALIDÉ → Success state
  if (status === 'success') {
    const scannedTime = formatCheckedInTime(checkedInAt);
    return (
      <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
        <LinearGradient
          colors={['#FFF6ED', '#FFE8D8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.validationBlock}
        >
          <View style={styles.successIconCircle}>
            <IconSymbol name="checkmark.circle.fill" size={40} color="#34C759" />
          </View>

          <Text style={styles.validationTitle}>Billet validé</Text>
          <Text style={styles.validationSubtitle}>Bienvenue à l'événement</Text>

          {scannedTime ? (
            <Text style={styles.validationMeta}>
              Scanné à {scannedTime}{organizerName ? ` par ${organizerName}` : ''}
            </Text>
          ) : null}

          <TouchableOpacity
            style={styles.ghostButton}
            onPress={() => setShowQRFallback(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.ghostButtonText}>Réessayer</Text>
          </TouchableOpacity>
        </LinearGradient>
      </Animated.View>
    );
  }

  // ERREUR → Error state
  if (status === 'error') {
    return (
      <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
        <LinearGradient
          colors={['#FFF4E5', '#FFE2C7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.validationBlock}
        >
          <View style={styles.errorIconCircle}>
            <IconSymbol name="exclamationmark.triangle.fill" size={40} color="#E8852E" />
          </View>

          <Text style={styles.validationTitle}>Problème de validation</Text>
          <Text style={styles.validationSubtitle}>{errorMessage}</Text>

          <TouchableOpacity
            style={styles.filledButton}
            onPress={() => {
              setLoading(true);
              fadeAnim.setValue(0);
              scaleAnim.setValue(0.92);
              checkStatus();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.filledButtonText}>Réessayer</Text>
          </TouchableOpacity>
        </LinearGradient>
      </Animated.View>
    );
  }

  // GROUPES FORMÉS → Afficher le QR code
  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
      <View style={styles.qrContainer}>
        <CheckinQRCode
          slotParticipantId={slotParticipantId}
          activityName={activityName}
          slotDate={slotDate}
          slotTime={slotTime}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Loading
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
  },

  // Waiting state (groups not formed)
  waitingContainer: {
    backgroundColor: 'rgba(242, 153, 74, 0.06)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  waitingIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(242, 153, 74, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  waitingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
    textAlign: 'center',
  },
  waitingMessage: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  waitingSlotInfo: {
    fontSize: 12,
    color: '#AEAEB2',
    marginTop: 12,
    textAlign: 'center',
  },

  // Shared validation block (success + error)
  validationBlock: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: 24,
    alignItems: 'center',
  },

  // Success icon
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  // Error icon
  errorIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(232, 133, 46, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  // Typography
  validationTitle: {
    fontSize: 21,
    fontWeight: '600',
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 6,
  },
  validationSubtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: '#48484A',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  validationMeta: {
    fontSize: 13,
    fontWeight: '400',
    color: '#AEAEB2',
    textAlign: 'center',
    marginTop: 10,
  },

  // Ghost button (success retry)
  ghostButton: {
    marginTop: 20,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(242, 153, 74, 0.4)',
    backgroundColor: 'transparent',
  },
  ghostButtonText: {
    color: '#F2994A',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
  },

  // Filled button (error retry)
  filledButton: {
    marginTop: 20,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F2994A',
  },
  filledButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
    textAlign: 'center',
  },

  // QR container
  qrContainer: {
    backgroundColor: 'rgba(242, 153, 74, 0.06)',
    borderRadius: 16,
    overflow: 'hidden',
  },
});
