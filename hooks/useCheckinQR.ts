import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const CHECKIN_API = 'https://checkin.realmeet.fr'; // Domaine VPS

export interface CheckinQR {
  token: string;
  expiresAt: string;
}

export function useCheckinQR() {
  const [qr, setQR] = useState<CheckinQR | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateQR = useCallback(async (slotParticipantId: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Non connecté');

      const resp = await fetch(`${CHECKIN_API}/api/checkin/generate-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ slot_participant_id: slotParticipantId })
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Erreur');

      setQR({ token: data.token, expiresAt: data.expires_at });
      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { qr, loading, error, generateQR };
}