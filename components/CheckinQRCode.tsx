import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
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

  useEffect(() => {
    generateQR(slotParticipantId);
  }, [slotParticipantId]);

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
      <ActivityIndicator size="large" color="#818CF8" />
      <Text style={s.loadingText}>Génération du billet...</Text>
    </View>
  );

  if (error) return (
    <View style={s.center}>
      <Text style={s.errorIcon}>⚠️</Text>
      <Text style={s.errorText}>{error}</Text>
      <TouchableOpacity style={s.retryBtn} onPress={() => generateQR(slotParticipantId)}>
        <Text style={s.retryText}>Réessayer</Text>
      </TouchableOpacity>
    </View>
  );

  if (!qr) return null;

  return (
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
        <TouchableOpacity style={s.retryBtn} onPress={() => generateQR(slotParticipantId)}>
          <Text style={s.retryText}>Régénérer le QR</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { alignItems:'center', padding:24 },
  center: { alignItems:'center', padding:40 },
  title: { fontSize:20, fontWeight:'700', color:'#fff', marginBottom:4 },
  activityName: { fontSize:14, color:'#94a3b8', marginBottom:2 },
  slotInfo: { fontSize:13, color:'#64748b', marginBottom:20 },
  qrWrapper: {
    padding:20, backgroundColor:'#fff', borderRadius:20,
    shadowColor:'#818CF8', shadowOffset:{width:0,height:4},
    shadowOpacity:0.3, shadowRadius:12, elevation:8
  },
  hint: { color:'#94a3b8', marginTop:20, fontSize:14, textAlign:'center' },
  expires: { color:'#64748b', marginTop:8, fontSize:13 },
  expiredText: { color:'#ef4444' },
  loadingText: { color:'#94a3b8', marginTop:12, fontSize:14 },
  errorIcon: { fontSize:32, marginBottom:8 },
  errorText: { color:'#fca5a5', textAlign:'center', fontSize:14 },
  retryBtn: {
    marginTop:16, paddingHorizontal:24, paddingVertical:12,
    backgroundColor:'rgba(129,140,248,0.15)', borderRadius:12
  },
  retryText: { color:'#818CF8', fontWeight:'600', fontSize:14 }
});