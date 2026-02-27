// hooks/useActivityCancellationListener.ts
// Écoute en temps réel les annulations d'activités via Supabase Realtime
// Notifie l'utilisateur immédiatement (Alert en foreground, notification locale en background)

import { useEffect } from 'react';
import { Alert, AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export function useActivityCancellationListener() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user?.id) return;

    let currentAppState: AppStateStatus = AppState.currentState;

    const appStateListener = AppState.addEventListener('change', (nextState) => {
      currentAppState = nextState;
    });

    // Vérifie si l'utilisateur est inscrit à l'activité donnée
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

    // Notifie l'utilisateur selon l'état de l'app
    function notifyUser(activityId: string, activityName: string) {
      if (currentAppState === 'active') {
        Alert.alert(
          '😔 Activité annulée',
          `L'activité "${activityName}" a été annulée.`,
          [
            { text: 'Fermer', style: 'cancel' },
            {
              text: 'Voir détails',
              onPress: () => router.push(`/activity-detail?id=${activityId}`),
            },
          ]
        );
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

    // Écouter les UPDATE sur activities (status -> paused ou ended)
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

          // Ne réagir que si le status vient de changer vers paused ou ended
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
}
