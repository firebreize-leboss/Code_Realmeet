import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { supabase } from '@/lib/supabase';
import { IconSymbol } from '@/components/IconSymbol';
import { CheckinQRCode } from '@/components/CheckinQRCode';

interface Props {
  slotParticipantId: string;
  slotId: string;
  activityName: string;
  slotDate: string;
  slotTime: string;
}

export function CheckinQRSection({ slotParticipantId, slotId, activityName, slotDate, slotTime }: Props) {
  const [groupsFormed, setGroupsFormed] = useState<boolean | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [showQRFallback, setShowQRFallback] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkStatus();
  }, [slotId, slotParticipantId]);

  const checkStatus = async () => {
    try {
      // Vérifier groups_formed et checked_in_at en parallèle
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
      setCheckedIn(!!participantResult.data?.checked_in_at);
    } catch (err) {
      console.error('Erreur vérification statut checkin:', err);
      setGroupsFormed(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#818CF8" />
      </View>
    );
  }

  // GROUPES PAS ENCORE FORMÉS → Message d'attente
  if (!groupsFormed) {
    return (
      <View style={styles.container}>
        <View style={styles.iconWrapper}>
          <IconSymbol name="clock.fill" size={28} color="#818CF8" />
        </View>
        <Text style={styles.title}>Votre billet d'entrée</Text>
        <Text style={styles.message}>
          Vous obtiendrez votre QR code 24h avant le début de l'activité, une fois votre groupe formé.
        </Text>
        {slotDate && slotTime && (
          <Text style={styles.slotInfo}>
            Créneau : {slotDate} à {slotTime}
          </Text>
        )}
      </View>
    );
  }

  // TICKET DÉJÀ VALIDÉ → Afficher l'état validé
  if (checkedIn && !showQRFallback) {
    return (
      <View style={styles.validatedContainer}>
        <View style={styles.validatedIconWrapper}>
          <IconSymbol name="checkmark.circle.fill" size={48} color="#34C759" />
        </View>
        <Text style={styles.validatedTitle}>Votre ticket a bien été validé</Text>
        <Text style={styles.validatedHint}>Votre QR code n'a pas été correctement scanné ?</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => setShowQRFallback(true)}>
          <Text style={styles.retryText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // GROUPES FORMÉS → Afficher le QR code
  return (
    <View style={styles.containerQR}>
      <CheckinQRCode
        slotParticipantId={slotParticipantId}
        activityName={activityName}
        slotDate={slotDate}
        slotTime={slotTime}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(129,140,248,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.15)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  containerQR: {
    backgroundColor: 'rgba(129,140,248,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.15)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  iconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(129,140,248,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  slotInfo: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 12,
    textAlign: 'center',
  },
  validatedContainer: {
    backgroundColor: 'rgba(242, 153, 74, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(242, 153, 74, 0.20)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  validatedIconWrapper: {
    marginBottom: 16,
  },
  validatedTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  validatedHint: {
    fontSize: 13,
    color: '#D4A574',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: 'rgba(242, 153, 74, 0.15)',
    borderRadius: 12,
  },
  retryText: {
    color: '#F2994A',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
  },
});
