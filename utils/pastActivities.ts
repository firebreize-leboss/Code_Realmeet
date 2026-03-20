// utils/pastActivities.ts
// Shared logic for loading past participated activities.
// Used by profile.tsx (count), activity.tsx (list), and my-participated-activities.tsx (list).
// Source of truth: activity.tsx loadUserActivities logic.

import { supabase } from '@/lib/supabase';

export interface PastActivity {
  id: string;
  nom: string;
  image_url: string;
  adresse?: string;
  ville: string;
  categorie?: string;
  date: string;
  time_start?: string;
  date_heure: string;
  slot_id?: string;
  slot_date?: string;
  slot_time?: string;
  isCancelled: boolean;
}

export interface UserParticipatedActivities {
  ongoing: PastActivity[];
  past: PastActivity[];
}

/**
 * Loads user's participated activities split into ongoing and past,
 * using the exact same filtering logic everywhere:
 *
 * 1. Fetch participations with status IN ('active', 'completed', 'cancelled')
 * 2. For each participation, fetch the slot (date, time, is_cancelled)
 * 3. Exclude voluntary unsubscriptions (status === 'cancelled' && !is_cancelled)
 * 4. Mark as "past" if is_cancelled === true OR slotDateTime < now
 */
export async function loadUserParticipatedActivities(
  userId: string
): Promise<UserParticipatedActivities> {
  const now = new Date();
  const nowISO = now.toISOString();

  const { data: participations, error: partError } = await supabase
    .from('slot_participants')
    .select('activity_id, slot_id, status')
    .eq('user_id', userId)
    .in('status', ['active', 'completed', 'cancelled']);

  if (partError) {
    console.error('Erreur chargement participations:', partError);
    return { ongoing: [], past: [] };
  }

  const validParticipations = participations || [];

  if (validParticipations.length === 0) {
    return { ongoing: [], past: [] };
  }

  const activityIds = [...new Set(validParticipations.map(p => p.activity_id))];

  const { data: activities, error: actError } = await supabase
    .from('activities')
    .select('id, nom, image_url, adresse, ville, categorie, date, time_start')
    .in('id', activityIds);

  if (actError) {
    console.error('Erreur chargement activités:', actError);
    return { ongoing: [], past: [] };
  }

  const activitiesMap = new Map((activities || []).map(a => [a.id, a]));

  const activitiesWithSlotDates = (await Promise.all(
    validParticipations.map(async (participation) => {
      const activity = activitiesMap.get(participation.activity_id);
      if (!activity) return null;

      if (participation.slot_id) {
        const { data: slotData } = await supabase
          .from('activity_slots')
          .select('date, time, is_cancelled')
          .eq('id', participation.slot_id)
          .single();

        if (slotData) {
          // Voluntary unsubscription: participation cancelled but slot not cancelled → exclude
          if (participation.status === 'cancelled' && !slotData.is_cancelled) {
            return null;
          }

          const slotDateTime = `${slotData.date}T${slotData.time || '00:00'}`;
          return {
            ...activity,
            date_heure: slotDateTime,
            slot_id: participation.slot_id,
            slot_date: slotData.date,
            slot_time: slotData.time,
            isCancelled: slotData.is_cancelled || false,
          } as PastActivity;
        }
      }

      const activityDateTime = activity.date
        ? `${activity.date}T${activity.time_start || '00:00'}`
        : nowISO;

      return {
        ...activity,
        date_heure: activityDateTime,
        slot_id: participation.slot_id,
        slot_date: activity.date,
        slot_time: activity.time_start,
        isCancelled: false,
      } as PastActivity;
    })
  )).filter(Boolean) as PastActivity[];

  const ongoing: PastActivity[] = [];
  const past: PastActivity[] = [];

  activitiesWithSlotDates.forEach(activity => {
    const activityDate = new Date(activity.date_heure);

    if (activity.isCancelled || activityDate < new Date()) {
      past.push(activity);
    } else {
      ongoing.push(activity);
    }
  });

  ongoing.sort((a, b) => new Date(a.date_heure).getTime() - new Date(b.date_heure).getTime());
  past.sort((a, b) => new Date(b.date_heure).getTime() - new Date(a.date_heure).getTime());

  return { ongoing, past };
}
