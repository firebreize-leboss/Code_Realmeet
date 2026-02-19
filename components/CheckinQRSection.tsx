import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkGroupsFormed();
  }, [slotId]);

  const checkGroupsFormed = async () => {
    try {
      const { data, error } = await supabase
        .from('activity_slots')
        .select('groups_formed')
        .eq('id', slotId)
        .single();

      if (error) throw error;
      setGroupsFormed(data?.groups_formed || false);
    } catch (err) {
      console.error('Erreur vérification groups_formed:', err);
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
});
