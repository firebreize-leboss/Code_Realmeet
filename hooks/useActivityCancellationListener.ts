// hooks/useActivityCancellationListener.ts
// Écoute en temps réel les annulations d'activités via Supabase Realtime.
// En foreground, retourne un état à afficher dans un modal brandé RealMeet.
// En background, envoie une notification locale.

import { useCallback, useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface ActivityCancellationAlertState {
  visible: boolean;
  title: string;
  message: string;
  activityId: string | null;
}

export function useActivityCancellationListener() {
  const { user } = useAuth();
  const router = useRouter();
  const [alert, setAlert] = useState<ActivityCancellationAlertState>({
    visible: false,
    title: '',
    message: '',
    activityId: null,
  });

  useEffect(() => {
    if (!user?.id) return;

    let currentAppState: AppStateStatus = AppState.currentState;

    const appStateListener = AppState.addEventListener('change', (nextState) => {
      currentAppState = nextState;
    });

    async function isUserParticipant(activityId: string): Promise<boolean> {
      const { data, error } = await supabase
        .from('slot_participants')
        .select('id, activity_slots!inner(activity_id)')
        .eq('user_id', user!.id)
        .eq('activity_slots.activity_id', activityId)
        .limit(1);

      if (error) {
        console.error('[CancellationListener] Error checking participation:', error);
        return false;
      }
      return data !== null && data.length > 0;
    }

    function notifyUser(activityId: string, activityName: string) {
      if (currentAppState === 'active') {
        setAlert({
          visible: true,
          title: 'Activité annulée',
          message: `L'activité « ${activityName} » a été annulée. Vous serez intégralement remboursé.`,
          activityId,
        });
      } else {
        Notifications.scheduleNotificationAsync({
          content: {
            title: '😔 Activité annulée',
            body: `L'activité "${activityName}" a été annulée.`,
            data: { type: 'activity', activityId },
          },
          trigger: null,
        }).catch((err) => {
          console.error('[CancellationListener] Error scheduling notification:', err);
        });
      }
    }

    const channel = supabase
      .channel(`activity-cancellations-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'activities',
        },
        async (payload) => {
          const newRecord = payload.new as { id: string; nom: string; status: string };
          const oldRecord = payload.old as { id: string; status: string };

          if (
            (newRecord.status === 'paused' || newRecord.status === 'ended') &&
            oldRecord.status !== newRecord.status
          ) {
            const isParticipant = await isUserParticipant(newRecord.id);
            if (isParticipant) {
              notifyUser(newRecord.id, newRecord.nom);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'activities',
        },
        async (payload) => {
          const oldRecord = payload.old as { id: string; nom?: string };
          const activityId = oldRecord.id;
          if (!activityId) return;

          const isParticipant = await isUserParticipant(activityId);
          if (isParticipant) {
            notifyUser(activityId, oldRecord.nom || 'Activité supprimée');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      appStateListener.remove();
    };
  }, [user?.id]);

  const dismiss = useCallback(() => {
    setAlert((prev) => ({ ...prev, visible: false }));
  }, []);

  const viewDetails = useCallback(() => {
    const activityId = alert.activityId;
    setAlert((prev) => ({ ...prev, visible: false }));
    if (activityId) {
      router.push(`/activity-detail?id=${activityId}`);
    }
  }, [alert.activityId, router]);

  return { alert, dismiss, viewDetails };
}
