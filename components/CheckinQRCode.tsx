import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import { IconSymbol } from '@/components/IconSymbol';
import { useCheckinQR } from '@/hooks/useCheckinQR';

interface Props {
  slotParticipantId: string;
  activityName?: string;
  slotDate?: string;
  slotTime?: string;
}

export function CheckinQRCode({ slotParticipantId, activityName, slotDate, slotTime }: Props) {
  const { qr, loading, error, generateQR } = useCheckinQR();
  const [countdown, setCountdown] = useState('');

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    generateQR(slotParticipantId);
  }, [slotParticipantId]);

  // Entrance animation
  useEffect(() => {
    if (!loading) {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.92);
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
  }, [loading, error, qr]);

  // Countdown timer
  useEffect(() => {
    if (!qr?.expiresAt) return;
    const interval = setInterval(() => {
      const diff = new Date(qr.expiresAt).getTime() - Date.now();
      if (diff <= 0) { setCountdown('Expiré'); clearInterval(interval); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${m}:${s.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [qr?.expiresAt]);

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color="#F2994A" />
      <Text style={s.loadingText}>Génération du billet...</Text>
    </View>
  );

  if (error) return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
      <LinearGradient
        colors={['#FFF4E5', '#FFE2C7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={s.errorBlock}
      >
        <View style={s.errorIconCircle}>
          <IconSymbol name="exclamationmark.triangle.fill" size={36} color="#E8852E" />
        </View>
        <Text style={s.errorTitle}>Problème de validation</Text>
        <Text style={s.errorSubtitle}>{error}</Text>
        <TouchableOpacity
          style={s.filledButton}
          onPress={() => generateQR(slotParticipantId)}
          activeOpacity={0.8}
        >
          <Text style={s.filledButtonText}>Réessayer</Text>
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );

  if (!qr) return null;

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
      <View style={s.container}>
        <Text style={s.title}>Mon billet d'entrée</Text>
        {activityName && <Text style={s.activityName}>{activityName}</Text>}
        {slotDate && slotTime && (
          <Text style={s.slotInfo}>{slotDate} à {slotTime}</Text>
        )}

        <View style={s.qrWrapper}>
          <QRCode value={qr.token} size={240} backgroundColor="#FFFFFF" color="#0f172a" />
        </View>

        <Text style={s.hint}>Présentez ce QR au staff à l'entrée</Text>
        <Text style={[s.expires, countdown === 'Expiré' && s.expiredText]}>
          {countdown === 'Expiré' ? '⏰ QR expiré' : `Expire dans ${countdown}`}
        </Text>

        {countdown === 'Expiré' && (
          <TouchableOpacity
            style={s.filledButton}
            onPress={() => generateQR(slotParticipantId)}
            activeOpacity={0.8}
          >
            <Text style={s.filledButtonText}>Régénérer le QR</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: { alignItems: 'center', padding: 24 },
  center: { alignItems: 'center', padding: 40 },
  title: { fontSize: 20, fontWeight: '700', color: '#1C1C1E', marginBottom: 4 },
  activityName: { fontSize: 14, color: '#8E8E93', marginBottom: 2 },
  slotInfo: { fontSize: 13, color: '#AEAEB2', marginBottom: 20 },
  qrWrapper: {
    padding: 20, backgroundColor: '#fff', borderRadius: 20,
    shadowColor: '#F2994A', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
  },
  hint: { color: '#8E8E93', marginTop: 20, fontSize: 14, textAlign: 'center' },
  expires: { color: '#AEAEB2', marginTop: 8, fontSize: 13 },
  expiredText: { color: '#E8852E' },
  loadingText: { color: '#8E8E93', marginTop: 12, fontSize: 14 },

  // Error block (gradient)
  errorBlock: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: 24,
    alignItems: 'center',
  },
  errorIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(232, 133, 46, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 21,
    fontWeight: '600',
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 6,
  },
  errorSubtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: '#48484A',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },

  // Filled orange button
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
});
