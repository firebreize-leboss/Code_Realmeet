-- Migration: Remplace current_setting('app.settings.xxx') par Supabase Vault
--
-- Contexte : sur Supabase Cloud, ALTER DATABASE ... SET "app.settings.xxx" est interdit (erreur 42501).
-- Les fonctions notify_push et notify_participants_on_cancel lisent désormais
-- supabase_url et service_role_key depuis vault.decrypted_secrets.
--
-- Prérequis : les secrets doivent avoir été créés manuellement dans le Vault via le SQL Editor :
--   SELECT vault.create_secret('https://VOTRE_REF.supabase.co', 'supabase_url');
--   SELECT vault.create_secret('VOTRE_SERVICE_ROLE_KEY', 'service_role_key');

-- Fonction 1 : notify_push
CREATE OR REPLACE FUNCTION public.notify_push(p_user_id uuid, p_title text, p_body text, p_data jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_token text;
  v_enabled boolean;
  v_supabase_url text;
  v_service_key text;
BEGIN
  SELECT expo_push_token, notifications_enabled
  INTO v_token, v_enabled
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_token IS NULL OR v_enabled = false THEN
    RETURN;
  END IF;

  SELECT decrypted_secret INTO v_supabase_url FROM vault.decrypted_secrets WHERE name = 'supabase_url';
  SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'service_role_key';

  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := jsonb_build_object(
      'user_id', p_user_id,
      'title', p_title,
      'body', p_body,
      'data', p_data
    )
  );
END;
$$;

-- Fonction 2 : notify_participants_on_cancel
CREATE OR REPLACE FUNCTION public.notify_participants_on_cancel() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_participant RECORD;
  v_activity_name TEXT;
  v_request_id BIGINT;
  v_supabase_url text;
  v_service_key text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_activity_name := OLD.nom;
  ELSE
    v_activity_name := NEW.nom;
  END IF;

  SELECT decrypted_secret INTO v_supabase_url FROM vault.decrypted_secrets WHERE name = 'supabase_url';
  SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'service_role_key';

  FOR v_participant IN
    SELECT DISTINCT sp.user_id
    FROM slot_participants sp
    JOIN activity_slots asl ON asl.id = sp.slot_id
    WHERE asl.activity_id = COALESCE(OLD.id, NEW.id)
      AND sp.status = 'confirmed'
  LOOP
    SELECT net.http_post(
      url := v_supabase_url || '/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body := jsonb_build_object(
        'user_id', v_participant.user_id,
        'title', '😔 Activité annulée',
        'body', v_activity_name || ' a été annulée par l''organisateur.',
        'data', jsonb_build_object(
          'type', 'activity_cancelled',
          'activityId', COALESCE(OLD.id, NEW.id)::text
        )
      )
    ) INTO v_request_id;
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;
