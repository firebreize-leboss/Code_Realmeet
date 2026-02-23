-- Migration: Mettre à jour get_user_profile_stats pour ne compter que les activités PASSÉES
-- Date: 2026-01-27
-- Description: Le compteur "activities_joined" ne doit inclure que les activités
--              dont le slot est passé (date/heure < maintenant), pas toutes les inscriptions.

CREATE OR REPLACE FUNCTION public.get_user_profile_stats(p_user_id uuid)
 RETURNS TABLE(activities_joined bigint, activities_hosted bigint, friends_count bigint, pending_friend_requests bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        -- Compter uniquement les activités dont le slot est PASSÉ
        (
            SELECT COUNT(DISTINCT sp.slot_id)
            FROM slot_participants sp
            INNER JOIN activity_slots s ON s.id = sp.slot_id
            WHERE sp.user_id = p_user_id
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

-- Commentaire pour documenter la modification
COMMENT ON FUNCTION public.get_user_profile_stats(uuid) IS
'Retourne les statistiques du profil utilisateur.
activities_joined: compte uniquement les activités dont le slot est passé (terminées).
activities_hosted: compte toutes les activités créées par l''utilisateur.
friends_count: compte les amis de l''utilisateur.
pending_friend_requests: compte les demandes d''amis en attente.';
