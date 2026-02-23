-- =============================================================================
-- MIGRATION DUO MODE - Fonctions SQL modifiees pour le mode duo
-- =============================================================================
-- Modifications par rapport aux fonctions originales :
-- 1. create_plus_one_invitation : expires_at = NOW() + 10 minutes,
--    comptage des invitations pending dans la verification de capacite
-- 2. accept_plus_one_invitation : comptage des invitations pending
--    pour verifier les places disponibles reelles
-- 3. validate_plus_one_token : activity_id et price (prix) dans le retour
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. create_plus_one_invitation (mode duo)
-- -----------------------------------------------------------------------------
-- Modifications :
--   - expires_at = NOW() + INTERVAL '10 minutes' (au lieu du defaut de la table)
--   - Comptage des invitations pending en plus des participants actuels
--     pour verifier la capacite reelle du creneau
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION create_plus_one_invitation(p_slot_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;


-- -----------------------------------------------------------------------------
-- 2. accept_plus_one_invitation (mode duo)
-- -----------------------------------------------------------------------------
-- Modifications :
--   - Comptage des invitations pending (hors celle en cours d'acceptation)
--     pour verifier les places disponibles reelles avant d'inscrire
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION accept_plus_one_invitation(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;


-- -----------------------------------------------------------------------------
-- 3. validate_plus_one_token (mode duo)
-- -----------------------------------------------------------------------------
-- Modifications :
--   - Ajout de activity_id dans le retour
--   - Ajout de price (prix de l'activite) dans le retour
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION validate_plus_one_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;
