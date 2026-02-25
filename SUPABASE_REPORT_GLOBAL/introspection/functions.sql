schema|name|definition
public|accept_friend_request|CREATE OR REPLACE FUNCTION public.accept_friend_request(p_request_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sender_id   UUID;
  v_receiver_id UUID;
BEGIN
  -- 1) On récupère la demande "pending"
  SELECT sender_id, receiver_id
  INTO v_sender_id, v_receiver_id
  FROM friend_requests
  WHERE id = p_request_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friend request not found or already processed';
  END IF;

  -- 2) On vérifie que c'est bien l'utilisateur connecté qui est le receiver
  IF v_receiver_id <> auth.uid() THEN
    RAISE EXCEPTION 'You are not allowed to accept this friend request';
  END IF;

  -- 3) On met la demande en "accepted"
  UPDATE friend_requests
  SET status = 'accepted',
      updated_at = NOW()
  WHERE id = p_request_id;

  -- 4) On crée l’amitié bidirectionnelle
  PERFORM create_bidirectional_friendship(v_sender_id, v_receiver_id);
END;
$function$

public|accept_plus_one_invitation|CREATE OR REPLACE FUNCTION public.accept_plus_one_invitation(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_id UUID;
  v_validation JSONB;
  v_invitation_id UUID;
  v_slot_id UUID;
  v_inviter_id UUID;
  v_slot_record RECORD;
  v_current_participants INTEGER;
  v_pending_invitations INTEGER;
BEGIN
  -- Recuperer l'utilisateur courant
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- Valider le token
  v_validation := validate_plus_one_token(p_token);
  IF NOT (v_validation->>'valid')::boolean THEN
    RETURN v_validation;
  END IF;

  -- Extraire les infos de l'invitation
  v_invitation_id := (v_validation->'invitation'->>'id')::UUID;
  v_slot_id := (v_validation->'invitation'->>'slot_id')::UUID;

  -- Recuperer l'inviteur
  SELECT inviter_id INTO v_inviter_id
  FROM plus_one_invitations WHERE id = v_invitation_id;

  -- Verifier que l'utilisateur n'est pas l'inviteur
  IF v_user_id = v_inviter_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANNOT_INVITE_SELF');
  END IF;

  -- Verifier que l'utilisateur n'est pas deja inscrit
  IF EXISTS (
    SELECT 1 FROM slot_participants
    WHERE slot_id = v_slot_id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_PARTICIPANT');
  END IF;

  -- Recuperer les infos du creneau et verifier la capacite
  SELECT s.*, a.max_participants, a.id as activity_id
  INTO v_slot_record
  FROM activity_slots s
  JOIN activities a ON a.id = s.activity_id
  WHERE s.id = v_slot_id;

  -- Compter les participants actuels
  SELECT COUNT(*) INTO v_current_participants
  FROM slot_participants WHERE slot_id = v_slot_id;

  -- [DUO] Compter les invitations pending (hors celle en cours d'acceptation)
  -- pour avoir une image reelle des places reservees
  SELECT COUNT(*) INTO v_pending_invitations
  FROM plus_one_invitations
  WHERE slot_id = v_slot_id
    AND status = 'pending'
    AND expires_at > NOW()
    AND id != v_invitation_id;

  -- Verifier la capacite en incluant les invitations pending
  IF (v_current_participants + v_pending_invitations) >= v_slot_record.max_participants THEN
    RETURN jsonb_build_object('success', false, 'error', 'SLOT_FULL');
  END IF;

  -- Inscrire le participant
  INSERT INTO slot_participants (
    slot_id,
    user_id,
    activity_id,
    is_plus_one,
    invited_by,
    plus_one_invitation_id
  ) VALUES (
    v_slot_id,
    v_user_id,
    v_slot_record.activity_id,
    true,
    v_inviter_id,
    v_invitation_id
  );

  -- Mettre a jour l'invitation
  UPDATE plus_one_invitations
  SET status = 'accepted',
      invitee_id = v_user_id,
      accepted_at = NOW()
  WHERE id = v_invitation_id;

  -- Ajouter au groupe de conversation (si existe)
  INSERT INTO conversation_participants (conversation_id, user_id)
  SELECT c.id, v_user_id
  FROM conversations c
  WHERE c.slot_id = v_slot_id
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'slot_id', v_slot_id,
    'activity_id', v_slot_record.activity_id
  );
END;
$function$

public|auto_expire_invitation|CREATE OR REPLACE FUNCTION public.auto_expire_invitation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status = 'pending' AND NEW.expires_at < NOW() THEN
    NEW.status := 'expired';
  END IF;
  RETURN NEW;
END;
$function$

public|cancel_plus_one_invitation|CREATE OR REPLACE FUNCTION public.cancel_plus_one_invitation(p_invitation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_id UUID;
  v_invitation RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- Recuperer l'invitation
  SELECT * INTO v_invitation
  FROM plus_one_invitations
  WHERE id = p_invitation_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVITATION_NOT_FOUND');
  END IF;

  -- Verifier les droits
  IF v_invitation.inviter_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHORIZED');
  END IF;

  -- Verifier le statut
  IF v_invitation.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'CANNOT_CANCEL');
  END IF;

  -- Annuler
  UPDATE plus_one_invitations
  SET status = 'cancelled'
  WHERE id = p_invitation_id;

  RETURN jsonb_build_object('success', true);
END;
$function$

public|cleanup_slot_groups|CREATE OR REPLACE FUNCTION public.cleanup_slot_groups(p_slot_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Supprimer les membres des groupes
  DELETE FROM slot_group_members 
  WHERE group_id IN (SELECT id FROM slot_groups WHERE slot_id = p_slot_id);
  
  -- Supprimer les conversations associées
  DELETE FROM conversations 
  WHERE slot_id = p_slot_id AND is_group = true;
  
  -- Supprimer les groupes
  DELETE FROM slot_groups WHERE slot_id = p_slot_id;
  
  -- Remettre groups_formed à false
  UPDATE activity_slots 
  SET groups_formed = false, groups_formed_at = NULL 
  WHERE id = p_slot_id;
END;
$function$

public|create_bidirectional_friendship|CREATE OR REPLACE FUNCTION public.create_bidirectional_friendship(p_user_id uuid, p_friend_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Créer les deux relations d'amitié
  INSERT INTO friendships (user_id, friend_id)
  VALUES (p_user_id, p_friend_id)
  ON CONFLICT (user_id, friend_id) DO NOTHING;
  
  INSERT INTO friendships (user_id, friend_id)
  VALUES (p_friend_id, p_user_id)
  ON CONFLICT (user_id, friend_id) DO NOTHING;
END;
$function$

public|create_plus_one_invitation|CREATE OR REPLACE FUNCTION public.create_plus_one_invitation(p_slot_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_id UUID;
  v_slot_record RECORD;
  v_existing_invitation RECORD;
  v_plus_one_count INTEGER;
  v_pending_invitations INTEGER;
  v_current_participants INTEGER;
  v_max_plus_one INTEGER := 2;
  v_token TEXT;
  v_invitation_id UUID;
BEGIN
  -- Recuperer l'utilisateur courant
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  -- Verifier que le creneau existe et recuperer ses infos
  SELECT s.*, a.max_participants
  INTO v_slot_record
  FROM activity_slots s
  JOIN activities a ON a.id = s.activity_id
  WHERE s.id = p_slot_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'SLOT_NOT_FOUND');
  END IF;

  -- Verifier que l'utilisateur est participant du creneau
  IF NOT EXISTS (
    SELECT 1 FROM slot_participants
    WHERE slot_id = p_slot_id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_PARTICIPANT');
  END IF;

  -- Verifier le mode Discover
  IF v_slot_record.discover_mode = true THEN
    RETURN jsonb_build_object('success', false, 'error', 'DISCOVER_MODE');
  END IF;

  -- Verifier si une invitation pending existe deja pour cet utilisateur/creneau
  SELECT * INTO v_existing_invitation
  FROM plus_one_invitations
  WHERE slot_id = p_slot_id
    AND inviter_id = v_user_id
    AND status = 'pending'
    AND expires_at > NOW();

  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_HAS_PENDING');
  END IF;

  -- Compter les +1 actuels pour ce creneau
  SELECT COUNT(*) INTO v_plus_one_count
  FROM slot_participants
  WHERE slot_id = p_slot_id AND is_plus_one = true;

  IF v_plus_one_count >= v_max_plus_one THEN
    RETURN jsonb_build_object('success', false, 'error', 'MAX_PLUS_ONE_REACHED');
  END IF;

  -- [DUO] Compter les invitations pending non expirees pour ce creneau
  -- Cela reserve virtuellement les places pour eviter le surbooking
  SELECT COUNT(*) INTO v_pending_invitations
  FROM plus_one_invitations
  WHERE slot_id = p_slot_id
    AND status = 'pending'
    AND expires_at > NOW();

  -- Compter les participants actuels
  SELECT COUNT(*) INTO v_current_participants
  FROM slot_participants
  WHERE slot_id = p_slot_id;

  -- Verifier que participants + invitations pending ne depassent pas la capacite
  IF (v_current_participants + v_pending_invitations) >= v_slot_record.max_participants THEN
    RETURN jsonb_build_object('success', false, 'error', 'SLOT_FULL_WITH_PENDING');
  END IF;

  -- Generer un token unique
  v_token := replace(gen_random_uuid()::text, '-', '') ||
             to_char(NOW(), 'YYMMDDHH24MISS');

  -- [DUO] Creer l'invitation avec expiration a 10 minutes
  INSERT INTO plus_one_invitations (slot_id, inviter_id, token, expires_at)
  VALUES (p_slot_id, v_user_id, v_token, NOW() + INTERVAL '10 minutes')
  RETURNING id INTO v_invitation_id;

  RETURN jsonb_build_object(
    'success', true,
    'token', v_token,
    'invitation_id', v_invitation_id,
    'expires_at', (NOW() + INTERVAL '10 minutes')
  );
END;
$function$

public|cube|CREATE OR REPLACE FUNCTION public.cube(cube, double precision)
 RETURNS cube
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$cube_c_f8$function$

public|cube|CREATE OR REPLACE FUNCTION public.cube(double precision[], double precision[])
 RETURNS cube
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$cube_a_f8_f8$function$

public|cube|CREATE OR REPLACE FUNCTION public.cube(double precision[])
 RETURNS cube
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$cube_a_f8$function$

public|cube|CREATE OR REPLACE FUNCTION public.cube(double precision)
 RETURNS cube
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$cube_f8$function$

public|cube|CREATE OR REPLACE FUNCTION public.cube(double precision, double precision)
 RETURNS cube
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$cube_f8_f8$function$

public|cube|CREATE OR REPLACE FUNCTION public.cube(cube, double precision, double precision)
 RETURNS cube
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$cube_c_f8_f8$function$

public|cube_cmp|CREATE OR REPLACE FUNCTION public.cube_cmp(cube, cube)
 RETURNS integer
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$cube_cmp$function$

public|cube_contained|CREATE OR REPLACE FUNCTION public.cube_contained(cube, cube)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$cube_contained$function$

public|cube_contains|CREATE OR REPLACE FUNCTION public.cube_contains(cube, cube)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$cube_contains$function$

public|cube_coord|CREATE OR REPLACE FUNCTION public.cube_coord(cube, integer)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$cube_coord$function$

public|cube_coord_llur|CREATE OR REPLACE FUNCTION public.cube_coord_llur(cube, integer)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$cube_coord_llur$function$

public|cube_dim|CREATE OR REPLACE FUNCTION public.cube_dim(cube)
 RETURNS integer
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$cube_dim$function$

public|cube_distance|CREATE OR REPLACE FUNCTION public.cube_distance(cube, cube)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$cube_distance$function$

public|cube_enlarge|CREATE OR REPLACE FUNCTION public.cube_enlarge(cube, double precision, integer)
 RETURNS cube
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$cube_enlarge$function$

public|cube_eq|CREATE OR REPLACE FUNCTION public.cube_eq(cube, cube)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$cube_eq$function$

public|cube_ge|CREATE OR REPLACE FUNCTION public.cube_ge(cube, cube)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$cube_ge$function$

public|cube_gt|CREATE OR REPLACE FUNCTION public.cube_gt(cube, cube)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$cube_gt$function$

public|cube_in|CREATE OR REPLACE FUNCTION public.cube_in(cstring)
 RETURNS cube
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$cube_in$function$

public|cube_inter|CREATE OR REPLACE FUNCTION public.cube_inter(cube, cube)
 RETURNS cube
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$cube_inter$function$

public|cube_is_point|CREATE OR REPLACE FUNCTION public.cube_is_point(cube)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$cube_is_point$function$

public|cube_le|CREATE OR REPLACE FUNCTION public.cube_le(cube, cube)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$cube_le$function$

public|cube_ll_coord|CREATE OR REPLACE FUNCTION public.cube_ll_coord(cube, integer)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$cube_ll_coord$function$

public|cube_lt|CREATE OR REPLACE FUNCTION public.cube_lt(cube, cube)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$cube_lt$function$

public|cube_ne|CREATE OR REPLACE FUNCTION public.cube_ne(cube, cube)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$cube_ne$function$

public|cube_out|CREATE OR REPLACE FUNCTION public.cube_out(cube)
 RETURNS cstring
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$cube_out$function$

public|cube_overlap|CREATE OR REPLACE FUNCTION public.cube_overlap(cube, cube)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$cube_overlap$function$

public|cube_recv|CREATE OR REPLACE FUNCTION public.cube_recv(internal)
 RETURNS cube
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$cube_recv$function$

public|cube_send|CREATE OR REPLACE FUNCTION public.cube_send(cube)
 RETURNS bytea
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$cube_send$function$

public|cube_size|CREATE OR REPLACE FUNCTION public.cube_size(cube)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$cube_size$function$

public|cube_subset|CREATE OR REPLACE FUNCTION public.cube_subset(cube, integer[])
 RETURNS cube
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$cube_subset$function$

public|cube_union|CREATE OR REPLACE FUNCTION public.cube_union(cube, cube)
 RETURNS cube
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$cube_union$function$

public|cube_ur_coord|CREATE OR REPLACE FUNCTION public.cube_ur_coord(cube, integer)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$cube_ur_coord$function$

public|distance_chebyshev|CREATE OR REPLACE FUNCTION public.distance_chebyshev(cube, cube)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$distance_chebyshev$function$

public|distance_taxicab|CREATE OR REPLACE FUNCTION public.distance_taxicab(cube, cube)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$distance_taxicab$function$

public|earth|CREATE OR REPLACE FUNCTION public.earth()
 RETURNS double precision
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
RETURN '6378168'::double precision

public|earth_box|CREATE OR REPLACE FUNCTION public.earth_box(earth, double precision)
 RETURNS cube
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE STRICT
RETURN cube_enlarge(($1)::cube, gc_to_sec($2), 3)

public|earth_distance|CREATE OR REPLACE FUNCTION public.earth_distance(earth, earth)
 RETURNS double precision
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE STRICT
RETURN sec_to_gc(cube_distance(($1)::cube, ($2)::cube))

public|form_groups_v3|CREATE OR REPLACE FUNCTION public.form_groups_v3(p_slot_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$DECLARE
  v_slot RECORD;
  v_activity RECORD;
  v_total_participants INTEGER;
  v_num_groups INTEGER;
  v_base_size INTEGER;
  v_remainder INTEGER;
  v_group_sizes INTEGER[];
  v_participant RECORD;
  v_duo_pair RECORD;
  v_group_id UUID;
  v_conversation_id UUID;
  v_first_user_id UUID;
  v_best_group INTEGER;
  v_best_score INTEGER;
  v_current_score INTEGER;
  v_current_size INTEGER;
  v_min_size INTEGER;
  v_i INTEGER;
  v_group_name TEXT;
  v_avg_compatibility FLOAT;
BEGIN
  -- ============================================
  -- 1. VALIDATIONS
  -- ============================================
  SELECT * INTO v_slot FROM activity_slots WHERE id = p_slot_id;
  IF v_slot IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Créneau non trouvé');
  END IF;
  IF v_slot.groups_formed = true OR v_slot.is_locked = true THEN
    RETURN jsonb_build_object('success', false, 'error', 'Groupes déjà formés ou créneau verrouillé');
  END IF;

  SELECT a.* INTO v_activity FROM activities a WHERE a.id = v_slot.activity_id;
  IF v_activity IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Activité non trouvée');
  END IF;

  SELECT COUNT(*) INTO v_total_participants
  FROM slot_participants WHERE slot_id = p_slot_id;

  -- ============================================
  -- 2. CHECK MINIMUM PARTICIPANTS → ANNULATION SI PAS ASSEZ
  -- (remplace l'ancien check < 2)
  -- ============================================
  IF v_total_participants < COALESCE(v_slot.min_participants_per_group, 4) THEN

    -- Envoyer un message système dans les conversations du slot
    FOR v_conversation_id IN
      SELECT c.id FROM conversations c WHERE c.slot_id = p_slot_id
    LOOP
      SELECT user_id INTO v_first_user_id
      FROM conversation_participants WHERE conversation_id = v_conversation_id LIMIT 1;

      IF v_first_user_id IS NOT NULL THEN
        INSERT INTO messages (conversation_id, sender_id, content, message_type)
        VALUES (v_conversation_id, v_first_user_id,
          '⚠️ Ce créneau a été annulé car il n''y avait pas assez de participants. Vous serez intégralement remboursé.',
          'system');
      END IF;
    END LOOP;

    -- NE PAS supprimer les slot_participants, mettre cancelled_notified = false
    UPDATE slot_participants
    SET cancelled_notified = false
    WHERE slot_id = p_slot_id;

    -- Décrémenter le compteur participants dans activities
    UPDATE activities
    SET participants = GREATEST(0, participants - v_total_participants)
    WHERE id = v_slot.activity_id;

    -- Marquer le créneau comme annulé
    UPDATE activity_slots
    SET is_cancelled = true,
        cancelled_reason = 'insufficient_participants',
        cancelled_at = NOW(),
        groups_formed = true,
        groups_formed_at = NOW(),
        is_locked = true,
        registration_closed = true
    WHERE id = p_slot_id;

    -- Logger
    INSERT INTO group_formation_logs (slot_id, activity_id, status, participants_count, error_message, triggered_by)
    VALUES (p_slot_id, v_slot.activity_id, 'cancelled', v_total_participants,
      'Pas assez de participants (' || v_total_participants || '/' || COALESCE(v_slot.min_participants_per_group, 4) || ')',
      'form_groups_v3');

    RETURN jsonb_build_object(
      'success', false,
      'error', 'SLOT_CANCELLED_INSUFFICIENT_PARTICIPANTS',
      'cancelled', true,
      'count', v_total_participants,
      'minimum', COALESCE(v_slot.min_participants_per_group, 4)
    );
  END IF;

  -- ============================================
  -- 3. CALCUL DU NOMBRE DE GROUPES
  -- ============================================
  v_num_groups := GREATEST(1, LEAST(
    COALESCE(v_slot.max_groups, 10),
    CEIL(v_total_participants::FLOAT / GREATEST(COALESCE(v_slot.participants_per_group, 5), 2))
  ));

  v_base_size := v_total_participants / v_num_groups;
  v_remainder := v_total_participants % v_num_groups;
  v_group_sizes := ARRAY[]::INTEGER[];
  FOR v_i IN 1..v_num_groups LOOP
    IF v_i <= v_remainder THEN
      v_group_sizes := v_group_sizes || (v_base_size + 1);
    ELSE
      v_group_sizes := v_group_sizes || v_base_size;
    END IF;
  END LOOP;

  -- ============================================
  -- 4. TABLE TEMPORAIRE
  -- ============================================
  DROP TABLE IF EXISTS _temp_group_assignment;
  CREATE TEMP TABLE _temp_group_assignment (
    user_id UUID PRIMARY KEY,
    interests TEXT[],
    assigned_group INTEGER DEFAULT 0
  );

  INSERT INTO _temp_group_assignment (user_id, interests)
  SELECT sp.user_id, COALESCE(p.interests, ARRAY[]::TEXT[])
  FROM slot_participants sp
  JOIN profiles p ON p.id = sp.user_id
  WHERE sp.slot_id = p_slot_id;

  -- ============================================
  -- 5. ASSIGNER LES PAIRES DUO D'ABORD
  -- ============================================
  FOR v_duo_pair IN
    SELECT
      sp_invitee.user_id AS invitee_id,
      sp_invitee.invited_by AS inviter_id
    FROM slot_participants sp_invitee
    WHERE sp_invitee.slot_id = p_slot_id
      AND sp_invitee.invited_by IS NOT NULL
      AND sp_invitee.is_plus_one = true
      AND EXISTS (
        SELECT 1 FROM slot_participants sp2
        WHERE sp2.slot_id = p_slot_id AND sp2.user_id = sp_invitee.invited_by
      )
      AND NOT EXISTS (
        SELECT 1 FROM _temp_group_assignment t
        WHERE t.user_id = sp_invitee.invited_by AND t.assigned_group > 0
      )
      AND NOT EXISTS (
        SELECT 1 FROM _temp_group_assignment t
        WHERE t.user_id = sp_invitee.user_id AND t.assigned_group > 0
      )
  LOOP
    v_best_group := 1;
    v_best_score := -1;
    v_min_size := v_total_participants + 1;

    FOR v_i IN 1..v_num_groups LOOP
      SELECT COUNT(*) INTO v_current_size
      FROM _temp_group_assignment WHERE assigned_group = v_i;

      IF v_current_size + 2 <= v_group_sizes[v_i] + 1 THEN
        SELECT COALESCE(SUM(
          COALESCE(array_length(
            ARRAY(
              SELECT unnest(inviter_t.interests) INTERSECT SELECT unnest(t.interests)
            ), 1
          ), 0)
          +
          COALESCE(array_length(
            ARRAY(
              SELECT unnest(invitee_t.interests) INTERSECT SELECT unnest(t.interests)
            ), 1
          ), 0)
        ), 0) INTO v_current_score
        FROM _temp_group_assignment t
        CROSS JOIN _temp_group_assignment inviter_t
        CROSS JOIN _temp_group_assignment invitee_t
        WHERE t.assigned_group = v_i
          AND inviter_t.user_id = v_duo_pair.inviter_id
          AND invitee_t.user_id = v_duo_pair.invitee_id;

        IF v_current_score > v_best_score OR (v_current_score = v_best_score AND v_current_size < v_min_size) THEN
          v_best_score := v_current_score;
          v_best_group := v_i;
          v_min_size := v_current_size;
        END IF;
      END IF;
    END LOOP;

    UPDATE _temp_group_assignment SET assigned_group = v_best_group WHERE user_id = v_duo_pair.inviter_id;
    UPDATE _temp_group_assignment SET assigned_group = v_best_group WHERE user_id = v_duo_pair.invitee_id;
  END LOOP;

  -- ============================================
  -- 6. ASSIGNER LES PARTICIPANTS SOLO
  -- ============================================
  FOR v_participant IN
    SELECT * FROM _temp_group_assignment WHERE assigned_group = 0 ORDER BY random()
  LOOP
    v_best_group := 1;
    v_best_score := -1;
    v_min_size := v_total_participants + 1;

    FOR v_i IN 1..v_num_groups LOOP
      SELECT COUNT(*) INTO v_current_size
      FROM _temp_group_assignment WHERE assigned_group = v_i;

      IF v_current_size < v_group_sizes[v_i] THEN
        SELECT COALESCE(SUM(
          COALESCE(array_length(
            ARRAY(SELECT unnest(v_participant.interests) INTERSECT SELECT unnest(t.interests)), 1
          ), 0)
        ), 0) INTO v_current_score
        FROM _temp_group_assignment t WHERE t.assigned_group = v_i;

        IF v_current_score > v_best_score OR (v_current_score = v_best_score AND v_current_size < v_min_size) THEN
          v_best_score := v_current_score;
          v_best_group := v_i;
          v_min_size := v_current_size;
        END IF;
      END IF;
    END LOOP;

    UPDATE _temp_group_assignment SET assigned_group = v_best_group WHERE user_id = v_participant.user_id;
  END LOOP;

  -- ============================================
  -- 7. CRÉER LES GROUPES, CONVERSATIONS, MESSAGES
  -- ============================================
  FOR v_i IN 1..v_num_groups LOOP
    IF EXISTS (SELECT 1 FROM _temp_group_assignment WHERE assigned_group = v_i) THEN
      v_group_name := v_activity.nom || ' - Groupe ' || v_i;

      INSERT INTO slot_groups (slot_id, activity_id, group_number, group_name)
      VALUES (p_slot_id, v_slot.activity_id, v_i, v_group_name)
      RETURNING id INTO v_group_id;

      INSERT INTO slot_group_members (group_id, user_id, compatibility_score)
      SELECT v_group_id, t.user_id,
        COALESCE((
          SELECT AVG(COALESCE(array_length(
            ARRAY(SELECT unnest(t.interests) INTERSECT SELECT unnest(t2.interests)), 1
          ), 0))::FLOAT
          FROM _temp_group_assignment t2
          WHERE t2.assigned_group = v_i AND t2.user_id != t.user_id
        ), 0)
      FROM _temp_group_assignment t WHERE t.assigned_group = v_i;

      INSERT INTO conversations (slot_id, activity_id, name, image_url, is_group)
      VALUES (p_slot_id, v_slot.activity_id, v_group_name, v_activity.image_url, true)
      RETURNING id INTO v_conversation_id;

      INSERT INTO conversation_participants (conversation_id, user_id)
      SELECT v_conversation_id, t.user_id
      FROM _temp_group_assignment t WHERE t.assigned_group = v_i;

      UPDATE slot_groups SET conversation_id = v_conversation_id WHERE id = v_group_id;

      SELECT user_id INTO v_first_user_id
      FROM _temp_group_assignment WHERE assigned_group = v_i LIMIT 1;

      INSERT INTO messages (conversation_id, sender_id, content, message_type)
      VALUES (v_conversation_id, v_first_user_id,
        '🎉 Votre groupe a été formé ! Vous partagez des centres d''intérêt communs. L''activité commence bientôt !',
        'system');
    END IF;
  END LOOP;

  -- ============================================
  -- 8. FINALISATION
  -- ============================================
  UPDATE activity_slots
  SET groups_formed = true,
      groups_formed_at = NOW(),
      is_locked = true,
      registration_closed = true
  WHERE id = p_slot_id;

  DROP TABLE IF EXISTS _temp_group_assignment;

  RETURN jsonb_build_object(
    'success', true,
    'groups_created', v_num_groups,
    'total_participants', v_total_participants
  );
END;$function$

public|g_cube_consistent|CREATE OR REPLACE FUNCTION public.g_cube_consistent(internal, cube, smallint, oid, internal)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$g_cube_consistent$function$

public|g_cube_distance|CREATE OR REPLACE FUNCTION public.g_cube_distance(internal, cube, smallint, oid, internal)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$g_cube_distance$function$

public|g_cube_penalty|CREATE OR REPLACE FUNCTION public.g_cube_penalty(internal, internal, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$g_cube_penalty$function$

public|g_cube_picksplit|CREATE OR REPLACE FUNCTION public.g_cube_picksplit(internal, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$g_cube_picksplit$function$

public|g_cube_same|CREATE OR REPLACE FUNCTION public.g_cube_same(cube, cube, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$g_cube_same$function$

public|g_cube_union|CREATE OR REPLACE FUNCTION public.g_cube_union(internal, internal)
 RETURNS cube
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/cube', $function$g_cube_union$function$

public|gc_to_sec|CREATE OR REPLACE FUNCTION public.gc_to_sec(double precision)
 RETURNS double precision
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE STRICT
RETURN CASE WHEN ($1 < '0'::double precision) THEN '0'::double precision WHEN (($1 / earth()) > pi()) THEN ('2'::double precision * earth()) ELSE (('2'::double precision * earth()) * sin(($1 / ('2'::double precision * earth())))) END

public|geo_distance|CREATE OR REPLACE FUNCTION public.geo_distance(point, point)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/earthdistance', $function$geo_distance$function$

public|get_activities_with_slots|CREATE OR REPLACE FUNCTION public.get_activities_with_slots(p_status character varying, p_limit integer)
 RETURNS TABLE(activity_id uuid, nom character varying, description text, categorie character varying, categorie2 text, image_url text, date character varying, time_start time without time zone, adresse text, ville character varying, latitude double precision, longitude double precision, participants integer, max_participants integer, host_id uuid, prix numeric, status character varying, created_at timestamp with time zone, slot_count bigint, next_slot_date date, total_remaining_places bigint)
 LANGUAGE plpgsql
 STABLE
AS $function$
begin
  return query
  with future_slots as (
    select
      s.activity_id,
      s.id as slot_id,
      s.date,
      s.max_participants as slot_max,
      count(sp.id)::bigint as slot_participants
    from activity_slots s
    left join slot_participants sp on s.id = sp.slot_id
    where s.date >= current_date
    group by s.activity_id, s.id, s.date, s.max_participants
  ),
  slot_aggregates as (
    select
      fs.activity_id,
      count(*)::bigint as slot_count,
      min(fs.date)::date as next_slot_date,

      -- ✅ CAST FINAL garanti bigint
      coalesce(
        (
          sum(
            greatest(
              0,
              (coalesce(fs.slot_max, 10) - fs.slot_participants)
            )
          )
        )::bigint,
        0::bigint
      ) as remaining_places

    from future_slots fs
    group by fs.activity_id
  )
  select
    a.id as activity_id,
    a.nom,
    a.description,
    a.categorie,
    a.categorie2,
    a.image_url,
    a.date,
    a.time_start,
    a.adresse,
    a.ville,
    a.latitude,
    a.longitude,
    a.participants,
    a.max_participants,
    a.host_id,
    a.prix,
    a.status,
    a.created_at,
    coalesce(sa.slot_count, 0::bigint) as slot_count,
    sa.next_slot_date,
    coalesce(sa.remaining_places, 0::bigint) as total_remaining_places
  from activities a
  inner join slot_aggregates sa on a.id = sa.activity_id
  where a.status = p_status
    and sa.slot_count > 0
  order by a.created_at desc
  limit p_limit;
end;
$function$

public|get_all_constraints|CREATE OR REPLACE FUNCTION public.get_all_constraints()
 RETURNS TABLE(schema_name text, table_name text, constraint_name text, constraint_type text, columns text[], ref_schema text, ref_table text, ref_columns text[], definition text)
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
select
  n.nspname::text as schema_name,
  c.relname::text as table_name,
  con.conname::text as constraint_name,
  case con.contype
    when 'p' then 'PRIMARY KEY'
    when 'f' then 'FOREIGN KEY'
    when 'u' then 'UNIQUE'
    when 'c' then 'CHECK'
    when 'x' then 'EXCLUSION'
    else con.contype::text
  end as constraint_type,
  -- colonnes de la contrainte (quand applicable)
  coalesce((
    select array_agg(att.attname::text order by u.ord)
    from unnest(con.conkey) with ordinality as u(attnum, ord)
    join pg_attribute att
      on att.attrelid = con.conrelid and att.attnum = u.attnum
  ), '{}'::text[]) as columns,
  -- référence (FK uniquement)
  rn.nspname::text as ref_schema,
  rc.relname::text as ref_table,
  coalesce((
    select array_agg(ratt.attname::text order by u.ord)
    from unnest(con.confkey) with ordinality as u(attnum, ord)
    join pg_attribute ratt
      on ratt.attrelid = con.confrelid and ratt.attnum = u.attnum
  ), '{}'::text[]) as ref_columns,
  pg_get_constraintdef(con.oid, true)::text as definition
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
left join pg_class rc on rc.oid = con.confrelid
left join pg_namespace rn on rn.oid = rc.relnamespace
where n.nspname not in ('pg_catalog','information_schema')
  and c.relkind in ('r','p') -- tables + partitioned tables
order by schema_name, table_name, constraint_type, constraint_name;
$function$

public|get_business_dashboard|CREATE OR REPLACE FUNCTION public.get_business_dashboard(p_business_id uuid)
 RETURNS TABLE(total_activities bigint, active_activities bigint, total_participants bigint, total_revenue numeric, avg_rating numeric, review_count bigint, top_activities jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
    v_activity_ids UUID[];
    v_past_slot_ids UUID[];
BEGIN
    SELECT ARRAY_AGG(id) INTO v_activity_ids
    FROM activities
    WHERE host_id = p_business_id;

    IF v_activity_ids IS NULL OR array_length(v_activity_ids, 1) IS NULL THEN
        RETURN QUERY SELECT
            0::BIGINT,
            0::BIGINT,
            0::BIGINT,
            0::NUMERIC,
            0::NUMERIC,
            0::BIGINT,
            '[]'::JSONB;
        RETURN;
    END IF;

    SELECT ARRAY_AGG(id) INTO v_past_slot_ids
    FROM activity_slots
    WHERE activity_id = ANY(v_activity_ids)
      AND (date < CURRENT_DATE OR (date = CURRENT_DATE AND time < CURRENT_TIME));

    RETURN QUERY
    WITH activity_stats AS (
        SELECT
            COUNT(*) as total_count,
            COUNT(*) FILTER (WHERE status = 'active') as active_count
        FROM activities
        WHERE host_id = p_business_id
    ),
    participant_stats AS (
        SELECT
            COALESCE(COUNT(*), 0) as participant_count,
            COALESCE(SUM(a.prix), 0) as revenue
        FROM slot_participants sp
        INNER JOIN activity_slots s ON sp.slot_id = s.id
        INNER JOIN activities a ON s.activity_id = a.id
        WHERE s.id = ANY(COALESCE(v_past_slot_ids, ARRAY[]::UUID[]))
          AND a.host_id = p_business_id
    ),
    review_stats AS (
        SELECT
            COALESCE(AVG(r.rating), 0) as avg_rating,
            COUNT(*) as review_count
        FROM reviews r
        WHERE r.activity_id = ANY(v_activity_ids)
    ),
    top_acts AS (
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', a.id,
                'nom', a.nom,
                'image_url', a.image_url,
                'participants', a.participants,
                'max_participants', a.max_participants,
                'prix', a.prix
            )
            ORDER BY a.participants DESC
        ) as activities
        FROM (
            SELECT id, nom, image_url, participants, max_participants, prix
            FROM activities
            WHERE host_id = p_business_id
            ORDER BY participants DESC
            LIMIT 5
        ) a
    )
    SELECT
        ast.total_count::BIGINT as total_activities,
        ast.active_count::BIGINT as active_activities,
        ps.participant_count::BIGINT as total_participants,
        ps.revenue::NUMERIC as total_revenue,
        ROUND(rs.avg_rating::NUMERIC, 1) as avg_rating,
        rs.review_count::BIGINT as review_count,
        COALESCE(ta.activities, '[]'::JSONB) as top_activities
    FROM activity_stats ast
    CROSS JOIN participant_stats ps
    CROSS JOIN review_stats rs
    CROSS JOIN top_acts ta;
END;
$function$

public|get_friends_with_profiles|CREATE OR REPLACE FUNCTION public.get_friends_with_profiles(p_user_id uuid)
 RETURNS TABLE(friend_id uuid, full_name text, avatar_url text, city text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        f.friend_id,
        p.full_name,
        p.avatar_url,
        p.city,
        f.created_at
    FROM friendships f
    INNER JOIN profiles p ON f.friend_id = p.id
    WHERE f.user_id = p_user_id
    ORDER BY f.created_at DESC;
END;
$function$

public|get_my_activities|CREATE OR REPLACE FUNCTION public.get_my_activities(p_user_id uuid)
 RETURNS TABLE(activity_id uuid, nom character varying, description text, categorie character varying, image_url text, date character varying, adresse text, ville character varying, participants integer, max_participants integer, prix numeric, status character varying, created_at timestamp with time zone, slot_count bigint, next_slot_date date, total_participants bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    WITH activity_slots_agg AS (
        SELECT
            s.activity_id,
            COUNT(*) as slot_count,
            MIN(CASE WHEN s.date >= CURRENT_DATE THEN s.date END) as next_slot_date,
            COUNT(sp.id) as total_participants
        FROM activity_slots s
        LEFT JOIN slot_participants sp ON s.id = sp.slot_id
        GROUP BY s.activity_id
    )
    SELECT
        a.id as activity_id,
        a.nom,
        a.description,
        a.categorie,
        a.image_url,
        a.date,
        a.adresse,
        a.ville,
        a.participants,
        a.max_participants,
        a.prix,
        a.status,
        a.created_at,
        COALESCE(asa.slot_count, 0) as slot_count,
        asa.next_slot_date,
        COALESCE(asa.total_participants, 0) as total_participants
    FROM activities a
    LEFT JOIN activity_slots_agg asa ON a.id = asa.activity_id
    WHERE a.host_id = p_user_id
    ORDER BY a.created_at DESC;
END;
$function$

public|get_my_conversations|CREATE OR REPLACE FUNCTION public.get_my_conversations(p_user_id uuid)
 RETURNS TABLE(conversation_id uuid, last_message_at timestamp with time zone, last_message_content text, last_message_type text, last_message_sender_id uuid, last_message_sender_name text, participant_count bigint)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    v.conversation_id,
    v.last_message_at,
    v.last_message_content,
    v.last_message_type,
    v.last_message_sender_id,
    v.last_message_sender_name,
    v.participant_count
  FROM conversations_with_last_message v
  JOIN conversation_participants cp
    ON cp.conversation_id = v.conversation_id
  WHERE cp.user_id = p_user_id
  ORDER BY v.last_message_at DESC NULLS LAST;
END;
$function$

public|get_my_conversations_v2|CREATE OR REPLACE FUNCTION public.get_my_conversations_v2(p_user_id uuid)
 RETURNS TABLE(conversation_id uuid, conversation_name text, conversation_image text, is_group boolean, activity_id uuid, slot_id uuid, updated_at timestamp with time zone, is_closed boolean, last_message_content text, last_message_type text, last_message_at timestamp with time zone, last_message_sender_id uuid, last_message_sender_name text, participant_count bigint, other_participant_name text, other_participant_avatar text, unread_count bigint, slot_date date, slot_time time without time zone, is_past_activity boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    WITH user_conversations AS (
        SELECT
            cp.conversation_id,
            cp.last_read_at
        FROM conversation_participants cp
        WHERE cp.user_id = p_user_id
          AND cp.is_hidden = false
    ),
    -- ✅ AJOUT : récupérer les IDs des utilisateurs bloqués par p_user_id
    blocked AS (
        SELECT blocked_id 
        FROM blocked_users 
        WHERE blocker_id = p_user_id
    ),
    conversation_data AS (
        SELECT
            c.id,
            c.name,
            c.image_url,
            c.is_group,
            c.activity_id,
            c.slot_id,
            c.updated_at,
            c.is_closed,
            uc.last_read_at
        FROM conversations c
        INNER JOIN user_conversations uc ON c.id = uc.conversation_id
    ),
    last_messages AS (
        SELECT DISTINCT ON (m.conversation_id)
            m.conversation_id,
            m.content,
            m.message_type,
            m.created_at,
            m.sender_id,
            p.full_name as sender_name
        FROM messages m
        INNER JOIN conversation_data cd ON m.conversation_id = cd.id
        LEFT JOIN profiles p ON m.sender_id = p.id
        WHERE m.deleted_at IS NULL
          -- ✅ AJOUT : exclure les messages des utilisateurs bloqués
          AND m.sender_id NOT IN (SELECT blocked_id FROM blocked)
        ORDER BY m.conversation_id, m.created_at DESC
    ),
    participant_counts AS (
        SELECT
            cp.conversation_id,
            COUNT(*) as cnt
        FROM conversation_participants cp
        INNER JOIN conversation_data cd ON cp.conversation_id = cd.id
        GROUP BY cp.conversation_id
    ),
    other_participants AS (
        SELECT DISTINCT ON (cp.conversation_id)
            cp.conversation_id,
            p.full_name,
            p.avatar_url
        FROM conversation_participants cp
        INNER JOIN conversation_data cd ON cp.conversation_id = cd.id
        INNER JOIN profiles p ON cp.user_id = p.id
        WHERE cp.user_id != p_user_id
          AND cd.is_group = false
        ORDER BY cp.conversation_id
    ),
    unread AS (
        SELECT
            m.conversation_id,
            COUNT(*) as cnt
        FROM messages m
        INNER JOIN conversation_data cd ON m.conversation_id = cd.id
        WHERE m.sender_id != p_user_id
          AND m.message_type != 'system'
          AND m.deleted_at IS NULL
          -- ✅ AJOUT : ne pas compter les messages des bloqués comme non lus
          AND m.sender_id NOT IN (SELECT blocked_id FROM blocked)
          AND (
              cd.last_read_at IS NULL
              OR m.created_at > cd.last_read_at
          )
        GROUP BY m.conversation_id
    ),
    slot_info AS (
        SELECT
            cd.id as conversation_id,
            s.date as slot_date,
            s."time" as slot_time,
            CASE 
                WHEN s.date < CURRENT_DATE THEN true
                WHEN s.date = CURRENT_DATE AND s."time" < CURRENT_TIME THEN true
                ELSE false
            END as is_past
        FROM conversation_data cd
        INNER JOIN activity_slots s ON cd.slot_id = s.id
        WHERE cd.slot_id IS NOT NULL
    )
    SELECT
        cd.id as conversation_id,
        cd.name as conversation_name,
        cd.image_url as conversation_image,
        cd.is_group,
        cd.activity_id,
        cd.slot_id,
        cd.updated_at,
        cd.is_closed,
        lm.content as last_message_content,
        lm.message_type as last_message_type,
        lm.created_at as last_message_at,
        lm.sender_id as last_message_sender_id,
        lm.sender_name as last_message_sender_name,
        COALESCE(pc.cnt, 0) as participant_count,
        op.full_name as other_participant_name,
        op.avatar_url as other_participant_avatar,
        COALESCE(u.cnt, 0) as unread_count,
        si.slot_date,
        si.slot_time,
        COALESCE(si.is_past, false) as is_past_activity
    FROM conversation_data cd
    LEFT JOIN last_messages lm ON cd.id = lm.conversation_id
    LEFT JOIN participant_counts pc ON cd.id = pc.conversation_id
    LEFT JOIN other_participants op ON cd.id = op.conversation_id
    LEFT JOIN unread u ON cd.id = u.conversation_id
    LEFT JOIN slot_info si ON cd.id = si.conversation_id
    ORDER BY COALESCE(lm.created_at, cd.updated_at) DESC NULLS LAST;
END;
$function$

public|get_pending_invitations|CREATE OR REPLACE FUNCTION public.get_pending_invitations(p_slot_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_id UUID;
  v_invitations JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN '[]'::JSONB;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', i.id,
      'token', i.token,
      'inviter_name', COALESCE(p.full_name, 'Utilisateur'),
      'created_at', i.created_at,
      'expires_at', i.expires_at
    ) ORDER BY i.created_at DESC
  ), '[]'::JSONB)
  INTO v_invitations
  FROM plus_one_invitations i
  JOIN profiles p ON p.id = i.inviter_id
  WHERE i.slot_id = p_slot_id
    AND i.status = 'pending'
    AND i.expires_at > NOW();

  RETURN v_invitations;
END;
$function$

public|get_slot_participant_count|CREATE OR REPLACE FUNCTION public.get_slot_participant_count(p_slot_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM slot_participants
  WHERE slot_id = p_slot_id;

  RETURN COALESCE(v_count, 0);
END;
$function$

public|get_unseen_cancellations|CREATE OR REPLACE FUNCTION public.get_unseen_cancellations()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_id UUID;
  v_result JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN '[]'::JSONB;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'slot_participant_id', sp.id,
      'slot_id', sp.slot_id,
      'activity_name', COALESCE(a.nom, a.titre, 'Activité'),
      'slot_date', s.date,
      'slot_time', s.time,
      'cancelled_reason', s.cancelled_reason
    )
  ), '[]'::JSONB)
  INTO v_result
  FROM slot_participants sp
  JOIN activity_slots s ON s.id = sp.slot_id
  JOIN activities a ON a.id = s.activity_id
  WHERE sp.user_id = v_user_id
    AND s.is_cancelled = true
    AND sp.cancelled_notified = false;

  RETURN v_result;
END;
$function$

public|get_user_profile_stats|CREATE OR REPLACE FUNCTION public.get_user_profile_stats(p_user_id uuid)
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
              AND (
                  s.date < CURRENT_DATE
                  OR (s.date = CURRENT_DATE AND s.time < CURRENT_TIME)
              )
        )::BIGINT as activities_joined,
        (SELECT COUNT(*) FROM activities WHERE host_id = p_user_id)::BIGINT as activities_hosted,
        (SELECT COUNT(*) FROM friendships WHERE user_id = p_user_id)::BIGINT as friends_count,
        (SELECT COUNT(*) FROM friend_requests WHERE receiver_id = p_user_id AND status = 'pending')::BIGINT as pending_friend_requests;
END;
$function$

public|get_user_push_token|CREATE OR REPLACE FUNCTION public.get_user_push_token(user_id uuid)
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT expo_push_token 
  FROM public.profiles 
  WHERE id = user_id 
    AND notifications_enabled = true 
    AND expo_push_token IS NOT NULL;
$function$

public|gin_extract_query_trgm|CREATE OR REPLACE FUNCTION public.gin_extract_query_trgm(text, internal, smallint, internal, internal, internal, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gin_extract_query_trgm$function$

public|gin_extract_value_trgm|CREATE OR REPLACE FUNCTION public.gin_extract_value_trgm(text, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gin_extract_value_trgm$function$

public|gin_trgm_consistent|CREATE OR REPLACE FUNCTION public.gin_trgm_consistent(internal, smallint, text, integer, internal, internal, internal, internal)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gin_trgm_consistent$function$

public|gin_trgm_triconsistent|CREATE OR REPLACE FUNCTION public.gin_trgm_triconsistent(internal, smallint, text, integer, internal, internal, internal)
 RETURNS "char"
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gin_trgm_triconsistent$function$

public|gtrgm_compress|CREATE OR REPLACE FUNCTION public.gtrgm_compress(internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_compress$function$

public|gtrgm_consistent|CREATE OR REPLACE FUNCTION public.gtrgm_consistent(internal, text, smallint, oid, internal)
 RETURNS boolean
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_consistent$function$

public|gtrgm_decompress|CREATE OR REPLACE FUNCTION public.gtrgm_decompress(internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_decompress$function$

public|gtrgm_distance|CREATE OR REPLACE FUNCTION public.gtrgm_distance(internal, text, smallint, oid, internal)
 RETURNS double precision
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_distance$function$

public|gtrgm_in|CREATE OR REPLACE FUNCTION public.gtrgm_in(cstring)
 RETURNS gtrgm
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_in$function$

public|gtrgm_options|CREATE OR REPLACE FUNCTION public.gtrgm_options(internal)
 RETURNS void
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE
AS '$libdir/pg_trgm', $function$gtrgm_options$function$

public|gtrgm_out|CREATE OR REPLACE FUNCTION public.gtrgm_out(gtrgm)
 RETURNS cstring
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_out$function$

public|gtrgm_penalty|CREATE OR REPLACE FUNCTION public.gtrgm_penalty(internal, internal, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_penalty$function$

public|gtrgm_picksplit|CREATE OR REPLACE FUNCTION public.gtrgm_picksplit(internal, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_picksplit$function$

public|gtrgm_same|CREATE OR REPLACE FUNCTION public.gtrgm_same(gtrgm, gtrgm, internal)
 RETURNS internal
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_same$function$

public|gtrgm_union|CREATE OR REPLACE FUNCTION public.gtrgm_union(internal, internal)
 RETURNS gtrgm
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$gtrgm_union$function$

public|handle_updated_at|CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$

public|latitude|CREATE OR REPLACE FUNCTION public.latitude(earth)
 RETURNS double precision
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE STRICT
RETURN CASE WHEN ((cube_ll_coord(($1)::cube, 3) / earth()) < '-1'::double precision) THEN '-90'::double precision WHEN ((cube_ll_coord(($1)::cube, 3) / earth()) > '1'::double precision) THEN '90'::double precision ELSE degrees(asin((cube_ll_coord(($1)::cube, 3) / earth()))) END

public|ll_to_earth|CREATE OR REPLACE FUNCTION public.ll_to_earth(double precision, double precision)
 RETURNS earth
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE STRICT
RETURN (cube(cube(cube(((earth() * cos(radians($1))) * cos(radians($2)))), ((earth() * cos(radians($1))) * sin(radians($2)))), (earth() * sin(radians($1)))))::earth

public|longitude|CREATE OR REPLACE FUNCTION public.longitude(earth)
 RETURNS double precision
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE STRICT
RETURN degrees(atan2(cube_ll_coord(($1)::cube, 2), cube_ll_coord(($1)::cube, 1)))

public|mark_cancellations_seen|CREATE OR REPLACE FUNCTION public.mark_cancellations_seen(p_slot_participant_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE slot_participants
  SET cancelled_notified = true
  WHERE id = ANY(p_slot_participant_ids)
    AND user_id = auth.uid();

  RETURN jsonb_build_object('success', true);
END;
$function$

public|notify_push|CREATE OR REPLACE FUNCTION public.notify_push(p_user_id uuid, p_title text, p_body text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_token text;
  v_enabled boolean;
BEGIN
  -- Vérifier si l'utilisateur a les notifications activées
  SELECT expo_push_token, notifications_enabled
  INTO v_token, v_enabled
  FROM public.profiles
  WHERE id = p_user_id;

  -- Ne rien faire si pas de token ou désactivé
  IF v_token IS NULL OR v_enabled = false THEN
    RETURN;
  END IF;

  -- Appeler l'Edge Function via pg_net (extension HTTP)
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object(
      'user_id', p_user_id,
      'title', p_title,
      'body', p_body,
      'data', p_data
    )
  );
END;
$function$

public|process_slots_for_grouping_v3|CREATE OR REPLACE FUNCTION public.process_slots_for_grouping_v3()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_slot RECORD;
  v_count INTEGER := 0;
  v_result JSONB;
  v_now TIMESTAMP := NOW() AT TIME ZONE 'Europe/Paris';
BEGIN
  FOR v_slot IN
    SELECT s.id, s.activity_id, s.date, s.time
    FROM activity_slots s
    JOIN activities a ON a.id = s.activity_id
    WHERE s.groups_formed = false
      AND s.is_locked = false
      AND a.status = 'active'
      AND (s.date || ' ' || COALESCE(s.time::TEXT, '00:00'))::TIMESTAMP
          BETWEEN v_now AND v_now + INTERVAL '24 hours'
  LOOP
    BEGIN
      v_result := form_groups_v3(v_slot.id);
      
      INSERT INTO group_formation_logs (
        slot_id, activity_id, status, groups_created, participants_count, triggered_by
      ) VALUES (
        v_slot.id, v_slot.activity_id,
        CASE WHEN (v_result->>'success')::BOOLEAN THEN 'success' ELSE 'failed' END,
        COALESCE((v_result->>'groups_created')::INTEGER, 0),
        COALESCE((v_result->>'total_participants')::INTEGER, 0),
        'cron_v3'
      );
      
      IF (v_result->>'success')::BOOLEAN THEN
        v_count := v_count + 1;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO group_formation_logs (
        slot_id, activity_id, status, error_message, triggered_by
      ) VALUES (
        v_slot.id, v_slot.activity_id, 'failed', SQLERRM, 'cron_v3'
      );
    END;
  END LOOP;

  RETURN v_count;
END;
$function$

public|search_activities|CREATE OR REPLACE FUNCTION public.search_activities(p_search_text text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_ville text DEFAULT NULL::text, p_min_price numeric DEFAULT NULL::numeric, p_max_price numeric DEFAULT NULL::numeric, p_user_lat double precision DEFAULT NULL::double precision, p_user_lng double precision DEFAULT NULL::double precision, p_max_distance_km numeric DEFAULT NULL::numeric, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, host_id uuid, nom character varying, titre character varying, description text, categorie character varying, categorie2 text, image_url text, ville character varying, latitude double precision, longitude double precision, prix numeric, max_participants integer, participants integer, places_restantes integer, status character varying, created_at timestamp with time zone, slot_count bigint, earliest_slot_date date, remaining_places bigint, distance_km numeric)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
  RETURN QUERY
  WITH future_slots AS (
    SELECT s.*
    FROM activity_slots s
    WHERE s.date >= CURRENT_DATE
  ),
  slot_counts AS (
    SELECT
      s.activity_id,
      COUNT(DISTINCT s.id) AS slot_count,
      MIN(s.date) AS earliest_slot_date
    FROM future_slots s
    GROUP BY s.activity_id
  ),
  slot_participant_counts AS (
    SELECT
      sp.slot_id,
      COUNT(*) AS cnt
    FROM slot_participants sp
    GROUP BY sp.slot_id
  ),
  remaining AS (
    SELECT
      s.activity_id,
      SUM(
        GREATEST(
          COALESCE(s.max_participants, a.max_participants, 0) - COALESCE(pc.cnt, 0),
          0
        )
      )::bigint AS remaining_places
    FROM future_slots s
    JOIN activities a ON a.id = s.activity_id
    LEFT JOIN slot_participant_counts pc ON pc.slot_id = s.id
    GROUP BY s.activity_id
  )
  SELECT
    a.id,
    a.host_id,
    a.nom,
    a.titre,
    a.description,
    a.categorie,
    a.categorie2,
    a.image_url,
    a.ville,
    a.latitude,
    a.longitude,
    a.prix,
    a.max_participants,
    a.participants,
    a.places_restantes,
    a.status,
    a.created_at,
    sc.slot_count,
    sc.earliest_slot_date,
    COALESCE(r.remaining_places, 0) AS remaining_places,
    CASE
      WHEN p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL
       AND a.latitude IS NOT NULL AND a.longitude IS NOT NULL
      THEN (
        earth_distance(
          ll_to_earth(p_user_lat, p_user_lng),
          ll_to_earth(a.latitude, a.longitude)
        ) / 1000.0
      )::numeric
      ELSE NULL
    END AS distance_km
  FROM activities a
  JOIN slot_counts sc ON sc.activity_id = a.id
  LEFT JOIN remaining r ON r.activity_id = a.id
  WHERE a.status = 'active'
    AND (
      p_search_text IS NULL OR
      a.nom ILIKE '%' || p_search_text || '%' OR
      a.titre ILIKE '%' || p_search_text || '%' OR
      a.description ILIKE '%' || p_search_text || '%' OR
      a.ville ILIKE '%' || p_search_text || '%'
    )
    AND (p_category IS NULL OR a.categorie = p_category OR a.categorie2 = p_category)
    AND (p_ville IS NULL OR a.ville = p_ville)
    AND (p_min_price IS NULL OR COALESCE(a.prix, 0) >= p_min_price)
    AND (p_max_price IS NULL OR COALESCE(a.prix, 0) <= p_max_price)
    AND (
      p_max_distance_km IS NULL OR p_user_lat IS NULL OR p_user_lng IS NULL OR a.latitude IS NULL OR a.longitude IS NULL OR
      (earth_distance(ll_to_earth(p_user_lat, p_user_lng), ll_to_earth(a.latitude, a.longitude)) / 1000.0) <= p_max_distance_km
    )
  ORDER BY
    CASE
      WHEN p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND a.latitude IS NOT NULL AND a.longitude IS NOT NULL
      THEN earth_distance(ll_to_earth(p_user_lat, p_user_lng), ll_to_earth(a.latitude, a.longitude))
      ELSE 0
    END ASC,
    sc.earliest_slot_date ASC,
    a.created_at DESC
  LIMIT p_limit OFFSET p_offset;

EXCEPTION WHEN undefined_function THEN
  -- earthdistance non dispo: on refait sans calcul distance
  RETURN QUERY
  WITH future_slots AS (
    SELECT s.*
    FROM activity_slots s
    WHERE s.date >= CURRENT_DATE
  ),
  slot_counts AS (
    SELECT
      s.activity_id,
      COUNT(DISTINCT s.id) AS slot_count,
      MIN(s.date) AS earliest_slot_date
    FROM future_slots s
    GROUP BY s.activity_id
  ),
  slot_participant_counts AS (
    SELECT sp.slot_id, COUNT(*) AS cnt
    FROM slot_participants sp
    GROUP BY sp.slot_id
  ),
  remaining AS (
    SELECT
      s.activity_id,
      SUM(
        GREATEST(
          COALESCE(s.max_participants, a.max_participants, 0) - COALESCE(pc.cnt, 0),
          0
        )
      )::bigint AS remaining_places
    FROM future_slots s
    JOIN activities a ON a.id = s.activity_id
    LEFT JOIN slot_participant_counts pc ON pc.slot_id = s.id
    GROUP BY s.activity_id
  )
  SELECT
    a.id,
    a.host_id,
    a.nom,
    a.titre,
    a.description,
    a.categorie,
    a.categorie2,
    a.image_url,
    a.ville,
    a.latitude,
    a.longitude,
    a.prix,
    a.max_participants,
    a.participants,
    a.places_restantes,
    a.status,
    a.created_at,
    sc.slot_count,
    sc.earliest_slot_date,
    COALESCE(r.remaining_places, 0) AS remaining_places,
    NULL::numeric AS distance_km
  FROM activities a
  JOIN slot_counts sc ON sc.activity_id = a.id
  LEFT JOIN remaining r ON r.activity_id = a.id
  WHERE a.status = 'active'
    AND (
      p_search_text IS NULL OR
      a.nom ILIKE '%' || p_search_text || '%' OR
      a.titre ILIKE '%' || p_search_text || '%' OR
      a.description ILIKE '%' || p_search_text || '%' OR
      a.ville ILIKE '%' || p_search_text || '%'
    )
    AND (p_category IS NULL OR a.categorie = p_category OR a.categorie2 = p_category)
    AND (p_ville IS NULL OR a.ville = p_ville)
    AND (p_min_price IS NULL OR COALESCE(a.prix, 0) >= p_min_price)
    AND (p_max_price IS NULL OR COALESCE(a.prix, 0) <= p_max_price)
  ORDER BY sc.earliest_slot_date ASC, a.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$function$

public|sec_to_gc|CREATE OR REPLACE FUNCTION public.sec_to_gc(double precision)
 RETURNS double precision
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE STRICT
RETURN CASE WHEN ($1 < '0'::double precision) THEN '0'::double precision WHEN (($1 / ('2'::double precision * earth())) > '1'::double precision) THEN (pi() * earth()) ELSE (('2'::double precision * earth()) * asin(($1 / ('2'::double precision * earth())))) END

public|set_limit|CREATE OR REPLACE FUNCTION public.set_limit(real)
 RETURNS real
 LANGUAGE c
 STRICT
AS '$libdir/pg_trgm', $function$set_limit$function$

public|show_limit|CREATE OR REPLACE FUNCTION public.show_limit()
 RETURNS real
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$show_limit$function$

public|show_trgm|CREATE OR REPLACE FUNCTION public.show_trgm(text)
 RETURNS text[]
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$show_trgm$function$

public|similarity|CREATE OR REPLACE FUNCTION public.similarity(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$similarity$function$

public|similarity_dist|CREATE OR REPLACE FUNCTION public.similarity_dist(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$similarity_dist$function$

public|similarity_op|CREATE OR REPLACE FUNCTION public.similarity_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$similarity_op$function$

public|strict_word_similarity|CREATE OR REPLACE FUNCTION public.strict_word_similarity(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$strict_word_similarity$function$

public|strict_word_similarity_commutator_op|CREATE OR REPLACE FUNCTION public.strict_word_similarity_commutator_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$strict_word_similarity_commutator_op$function$

public|strict_word_similarity_dist_commutator_op|CREATE OR REPLACE FUNCTION public.strict_word_similarity_dist_commutator_op(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$strict_word_similarity_dist_commutator_op$function$

public|strict_word_similarity_dist_op|CREATE OR REPLACE FUNCTION public.strict_word_similarity_dist_op(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$strict_word_similarity_dist_op$function$

public|strict_word_similarity_op|CREATE OR REPLACE FUNCTION public.strict_word_similarity_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$strict_word_similarity_op$function$

public|submit_review|CREATE OR REPLACE FUNCTION public.submit_review(p_activity_id uuid, p_rating integer, p_comment text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_id uuid;
  v_slot_id uuid;
  v_slot_date date;
  v_host_id uuid;
  v_review_id uuid;
BEGIN
  -- Récupérer l'utilisateur actuel
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'non_authenticated');
  END IF;

  -- Vérifier que l'utilisateur a participé à cette activité
  SELECT sp.slot_id, s.date INTO v_slot_id, v_slot_date
  FROM slot_participants sp
  JOIN activity_slots s ON s.id = sp.slot_id
  WHERE sp.activity_id = p_activity_id 
    AND sp.user_id = v_user_id
  ORDER BY s.date DESC
  LIMIT 1;

  IF v_slot_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'not_participant');
  END IF;

  -- Vérifier que le créneau est passé
  IF v_slot_date >= CURRENT_DATE THEN
    RETURN json_build_object('success', false, 'error', 'activity_not_past');
  END IF;

  -- Vérifier que l'utilisateur n'est pas l'hôte
  SELECT host_id INTO v_host_id FROM activities WHERE id = p_activity_id;
  IF v_host_id = v_user_id THEN
    RETURN json_build_object('success', false, 'error', 'cannot_review_own');
  END IF;

  -- Insérer l'avis (la contrainte UNIQUE gère les doublons)
  INSERT INTO reviews (activity_id, reviewer_id, rating, comment)
  VALUES (p_activity_id, v_user_id, p_rating, p_comment)
  RETURNING id INTO v_review_id;

  -- Mettre à jour les stats du business si l'hôte est une entreprise
  PERFORM update_business_rating(v_host_id);

  RETURN json_build_object('success', true, 'review_id', v_review_id);
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('success', false, 'error', 'already_reviewed');
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$

public|test_form_groups_now|CREATE OR REPLACE FUNCTION public.test_form_groups_now(p_slot_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Reset les flags pour permettre le test
  UPDATE activity_slots 
  SET groups_formed = false, 
      groups_formed_at = NULL,
      is_locked = false,
      locked_at = NULL
  WHERE id = p_slot_id;

  -- Appeler la fonction
  RETURN form_groups_v3(p_slot_id);
END;
$function$

public|trigger_friend_request_push|CREATE OR REPLACE FUNCTION public.trigger_friend_request_push()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_sender_name text;
BEGIN
  -- Seulement pour les nouvelles demandes pending
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  -- Récupérer le nom de l'expéditeur
  SELECT full_name INTO v_sender_name
  FROM public.profiles
  WHERE id = NEW.sender_id;

  -- Notifier le destinataire
  PERFORM notify_push(
    NEW.receiver_id,
    'Nouvelle demande d''ami',
    COALESCE(v_sender_name, 'Quelqu''un') || ' veut devenir votre ami',
    jsonb_build_object(
      'type', 'friend_request',
      'requestId', NEW.id
    )
  );

  RETURN NEW;
END;
$function$

public|trigger_message_push|CREATE OR REPLACE FUNCTION public.trigger_message_push()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_sender_name text;
  v_recipient_id uuid;
  v_is_muted boolean;
  v_conversation_name text;
BEGIN
  -- Récupérer le nom de l'expéditeur
  SELECT full_name INTO v_sender_name
  FROM public.profiles
  WHERE id = NEW.sender_id;

  -- Récupérer les infos de la conversation
  SELECT name INTO v_conversation_name
  FROM public.conversations
  WHERE id = NEW.conversation_id;

  -- Envoyer aux autres participants (pas à l'expéditeur)
  FOR v_recipient_id, v_is_muted IN
    SELECT cp.user_id, COALESCE(cp.is_muted, false)
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = NEW.conversation_id
      AND cp.user_id != NEW.sender_id
  LOOP
    -- Ne pas notifier si la conversation est en sourdine
    IF NOT v_is_muted THEN
      PERFORM notify_push(
        v_recipient_id,
        COALESCE(v_conversation_name, v_sender_name),
        CASE NEW.message_type
          WHEN 'text' THEN LEFT(NEW.content, 100)
          WHEN 'image' THEN '📷 Photo'
          WHEN 'voice' THEN '🎤 Message vocal'
          ELSE 'Nouveau message'
        END,
        jsonb_build_object(
          'type', 'message',
          'conversationId', NEW.conversation_id
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$

public|trigger_update_business_rating|CREATE OR REPLACE FUNCTION public.trigger_update_business_rating()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_host_id uuid;
BEGIN
  -- Récupérer le host_id selon l'opération
  IF TG_OP = 'DELETE' THEN
    SELECT host_id INTO v_host_id FROM activities WHERE id = OLD.activity_id;
  ELSE
    SELECT host_id INTO v_host_id FROM activities WHERE id = NEW.activity_id;
  END IF;

  -- Mettre à jour le rating
  PERFORM update_business_rating(v_host_id);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$

public|update_activities_updated_at|CREATE OR REPLACE FUNCTION public.update_activities_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$

public|update_business_rating|CREATE OR REPLACE FUNCTION public.update_business_rating(p_host_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_avg_rating numeric;
  v_review_count int;
  v_is_business boolean;
BEGIN
  -- Vérifier si c'est un compte business
  SELECT account_type = 'business' INTO v_is_business
  FROM profiles WHERE id = p_host_id;

  IF NOT v_is_business THEN
    RETURN;
  END IF;

  -- Calculer la moyenne et le nombre d'avis
  SELECT 
    COALESCE(AVG(r.rating), 0),
    COUNT(r.id)
  INTO v_avg_rating, v_review_count
  FROM reviews r
  JOIN activities a ON a.id = r.activity_id
  WHERE a.host_id = p_host_id;

  -- Mettre à jour le profil business
  UPDATE profiles
  SET 
    business_rating = ROUND(v_avg_rating, 1),
    business_review_count = v_review_count
  WHERE id = p_host_id;
END;
$function$

public|update_business_stats|CREATE OR REPLACE FUNCTION public.update_business_stats()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Insert or update daily stats when someone joins an activity
  INSERT INTO business_stats (business_id, date, total_participants, activity_views)
  SELECT 
    a.host_id,
    CURRENT_DATE,
    1,
    0
  FROM activities a
  WHERE a.id = NEW.activity_id
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = a.host_id AND p.account_type = 'business')
  ON CONFLICT (business_id, date)
  DO UPDATE SET 
    total_participants = business_stats.total_participants + 1;
  
  RETURN NEW;
END;
$function$

public|update_conversation_last_message|CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE conversations
  SET 
    last_message_at = NEW.created_at,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$function$

public|update_places_restantes|CREATE OR REPLACE FUNCTION public.update_places_restantes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.places_restantes = NEW.max_participants - NEW.participants;
  RETURN NEW;
END;
$function$

public|update_reports_updated_at|CREATE OR REPLACE FUNCTION public.update_reports_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$

public|update_updated_at_column|CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$

public|validate_plus_one_token|CREATE OR REPLACE FUNCTION public.validate_plus_one_token(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_invitation RECORD;
  v_inviter RECORD;
  v_slot RECORD;
  v_activity RECORD;
BEGIN
  -- Rechercher l'invitation
  SELECT * INTO v_invitation
  FROM plus_one_invitations
  WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'TOKEN_NOT_FOUND');
  END IF;

  -- Verifier le statut
  IF v_invitation.status = 'accepted' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'INVITATION_ALREADY_USED');
  END IF;

  IF v_invitation.status = 'cancelled' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'INVITATION_CANCELLED');
  END IF;

  IF v_invitation.status = 'expired' OR v_invitation.expires_at < NOW() THEN
    -- Mettre a jour le statut si necessaire
    UPDATE plus_one_invitations SET status = 'expired' WHERE id = v_invitation.id;
    RETURN jsonb_build_object('valid', false, 'error', 'INVITATION_EXPIRED');
  END IF;

  -- Recuperer les infos de l'inviteur
  SELECT full_name, avatar_url INTO v_inviter
  FROM profiles WHERE id = v_invitation.inviter_id;

  -- Recuperer les infos du creneau
  SELECT * INTO v_slot
  FROM activity_slots WHERE id = v_invitation.slot_id;

  -- [DUO] Recuperer les infos de l'activite avec le prix
  SELECT id, nom, titre, image_url, adresse, ville, prix INTO v_activity
  FROM activities WHERE id = v_slot.activity_id;

  RETURN jsonb_build_object(
    'valid', true,
    'invitation', jsonb_build_object(
      'id', v_invitation.id,
      'slot_id', v_invitation.slot_id,
      'inviter_name', COALESCE(v_inviter.full_name, 'Quelqu''un'),
      'inviter_avatar', COALESCE(v_inviter.avatar_url, ''),
      'activity_name', COALESCE(v_activity.nom, v_activity.titre, 'Activite'),
      'activity_image', COALESCE(v_activity.image_url, ''),
      'activity_id', v_activity.id,
      'price', COALESCE(v_activity.prix, 0),
      'slot_date', v_slot.date,
      'slot_time', v_slot.time,
      'location', COALESCE(v_activity.adresse || ', ' || v_activity.ville, ''),
      'expires_at', v_invitation.expires_at,
      'payment_mode', v_invitation.payment_mode
    )
  );
END;
$function$

public|word_similarity|CREATE OR REPLACE FUNCTION public.word_similarity(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$word_similarity$function$

public|word_similarity_commutator_op|CREATE OR REPLACE FUNCTION public.word_similarity_commutator_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$word_similarity_commutator_op$function$

public|word_similarity_dist_commutator_op|CREATE OR REPLACE FUNCTION public.word_similarity_dist_commutator_op(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$word_similarity_dist_commutator_op$function$

public|word_similarity_dist_op|CREATE OR REPLACE FUNCTION public.word_similarity_dist_op(text, text)
 RETURNS real
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$word_similarity_dist_op$function$

public|word_similarity_op|CREATE OR REPLACE FUNCTION public.word_similarity_op(text, text)
 RETURNS boolean
 LANGUAGE c
 STABLE PARALLEL SAFE STRICT
AS '$libdir/pg_trgm', $function$word_similarity_op$function$

(118 rows)
