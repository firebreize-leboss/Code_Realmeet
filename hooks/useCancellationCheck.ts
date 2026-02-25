// hooks/useCancellationCheck.ts
// Vérifie au lancement si l'utilisateur a des créneaux annulés non vus

import { useEffect } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@/lib/supabase';

interface CancellationItem {
  slot_participant_id: string;
  slot_id: string;
  activity_name: string;
  slot_date: string;
  slot_time: string;
  cancelled_reason: string;
}

function formatDateLong(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function formatDateShort(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDate();
  const months = ['jan.', 'fév.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sep.', 'oct.', 'nov.', 'déc.'];
  return `${day} ${months[d.getMonth()]}`;
}

export function useCancellationCheck() {
  useEffect(() => {
    const check = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;

      const { data, error } = await supabase.rpc('get_unseen_cancellations');
      if (error || !data || data.length === 0) return;

      const cancellations = data as CancellationItem[];
      const ids = cancellations.map(c => c.slot_participant_id);

      if (cancellations.length === 1) {
        const c = cancellations[0];
        const dateFr = formatDateLong(c.slot_date);

        Alert.alert(
          'Créneau annulé',
          `Il n'y avait pas assez de participants pour "${c.activity_name}" le ${dateFr}.\n\nVous serez intégralement remboursé.`,
          [
            {
              text: 'Compris',
              onPress: async () => {
                try {
                  await supabase.rpc('mark_cancellations_seen', { p_slot_participant_ids: ids });
                } catch (err) {
                  console.error('Failed to mark cancellations as seen:', err);
                }
              },
            },
          ]
        );
      } else {
        const lines = cancellations
          .map(c => `\u2022 ${c.activity_name} (${formatDateShort(c.slot_date)})`)
          .join('\n');

        Alert.alert(
          `${cancellations.length} créneaux annulés`,
          `Les créneaux suivants n'avaient pas assez de participants :\n\n${lines}\n\nVous serez intégralement remboursé.`,
          [
            {
              text: 'Compris',
              onPress: async () => {
                try {
                  await supabase.rpc('mark_cancellations_seen', { p_slot_participant_ids: ids });
                } catch (err) {
                  console.error('Failed to mark cancellations as seen:', err);
                }
              },
            },
          ]
        );
      }
    };

    check();
  }, []);
}
