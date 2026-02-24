-- Migration: Ajouter colonne status à slot_participants
-- Date: 2026-02-23
-- Description: Permet de gérer les désinscriptions sans perdre l'historique.
--   'active' = inscrit, 'completed' = slot passé, 'cancelled' = désinscrit.

ALTER TABLE slot_participants ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Index pour les requêtes filtrées par status
CREATE INDEX IF NOT EXISTS idx_slot_participants_status ON slot_participants(status);

-- Marquer automatiquement les participations passées comme 'completed'
UPDATE slot_participants sp
SET status = 'completed'
FROM activity_slots s
WHERE sp.slot_id = s.id
  AND sp.status = 'active'
  AND (s.date < CURRENT_DATE OR (s.date = CURRENT_DATE AND s.time < CURRENT_TIME));

-- Fonction appelable pour marquer les slots passés comme completed
CREATE OR REPLACE FUNCTION mark_completed_participations()
RETURNS void AS $$
  UPDATE slot_participants sp
  SET status = 'completed'
  FROM activity_slots s
  WHERE sp.slot_id = s.id
    AND sp.status = 'active'
    AND (s.date < CURRENT_DATE OR (s.date = CURRENT_DATE AND s.time < CURRENT_TIME));
$$ LANGUAGE sql;

-- Mettre à jour get_user_profile_stats pour filtrer par status
CREATE OR REPLACE FUNCTION public.get_user_profile_stats(p_user_id uuid)
 RETURNS TABLE(activities_joined bigint, activities_hosted bigint, friends_count bigint, pending_friend_requests bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        (
            SELECT COUNT(DISTINCT sp.slot_id)
            FROM slot_participants sp
            INNER JOIN activity_slots s ON s.id = sp.slot_id
            WHERE sp.user_id = p_user_id
              AND sp.status IN ('active', 'completed')
              AND (
                  s.date < CURRENT_DATE
                  OR (s.date = CURRENT_DATE AND s.time < CURRENT_TIME)
              )
        )::BIGINT as activities_joined,
        (SELECT COUNT(*) FROM activities WHERE host_id = p_user_id)::BIGINT as activities_hosted,
        (SELECT COUNT(*) FROM friendships WHERE user_id = p_user_id)::BIGINT as friends_count,
        (SELECT COUNT(*) FROM friend_requests WHERE receiver_id = p_user_id AND status = 'pending')::BIGINT as pending_friend_requests;
END;
$function$;
