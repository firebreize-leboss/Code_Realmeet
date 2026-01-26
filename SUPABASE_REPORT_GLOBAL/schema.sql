--
-- PostgreSQL database dump
--

\restrict A7ThH8g8xsLppacE1dqjghpTZbXqCAcsD7QmyNHzEGPUShpVNxb7yvMVNbm4CzE

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7 (Ubuntu 17.7-0ubuntu0.25.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: accept_friend_request(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accept_friend_request(p_request_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: cleanup_slot_groups(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_slot_groups(p_slot_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: create_bidirectional_friendship(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_bidirectional_friendship(p_user_id uuid, p_friend_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Créer les deux relations d'amitié
  INSERT INTO friendships (user_id, friend_id)
  VALUES (p_user_id, p_friend_id)
  ON CONFLICT (user_id, friend_id) DO NOTHING;
  
  INSERT INTO friendships (user_id, friend_id)
  VALUES (p_friend_id, p_user_id)
  ON CONFLICT (user_id, friend_id) DO NOTHING;
END;
$$;


--
-- Name: form_groups_intelligent_v2(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.form_groups_intelligent_v2(p_slot_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  DECLARE
    v_slot RECORD;
    v_activity RECORD;
    v_num_groups INTEGER;
    v_total_participants INTEGER;
    v_base_size INTEGER;
    v_remainder INTEGER;
    v_group_size INTEGER;
    v_conv_id UUID;
    v_avg_score FLOAT;
    v_best_group INTEGER;
    v_best_score FLOAT;
    v_current_count INTEGER;
    v_participant RECORD;
    v_i INTEGER;
    v_participants_per_group INTEGER;
  BEGIN
    -- Récupérer le créneau
    SELECT * INTO v_slot FROM activity_slots WHERE id = p_slot_id;

    IF v_slot IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Créneau non trouvé');
    END IF;

    IF v_slot.is_locked THEN
      RETURN jsonb_build_object('success', false, 'error', 'Créneau déjà verrouillé');
    END IF;

    SELECT * INTO v_activity FROM activities WHERE id = v_slot.activity_id;
    -- Compter les participants
    SELECT COUNT(*) INTO v_total_participants
    FROM slot_participants WHERE slot_id = p_slot_id;

    IF v_total_participants = 0 THEN
      UPDATE activity_slots SET is_locked = true, locked_at = NOW() WHERE id = p_slot_id;
      RETURN jsonb_build_object('success', true, 'groups_created', 0, 'message', 'Aucun participant');
    END IF;

    -- ✅ NOUVEAU : Utiliser max_groups et participants_per_group
    v_num_groups := GREATEST(1, COALESCE(v_slot.max_groups, 1));
    v_participants_per_group := v_slot.participants_per_group;

    -- Si participants_per_group est défini, ajuster le nombre de groupes  
    IF v_participants_per_group IS NOT NULL AND v_participants_per_group > 
0 THEN
      v_num_groups := LEAST(
        v_num_groups,
        CEIL(v_total_participants::FLOAT / v_participants_per_group::FLOAT)      );
    END IF;

    -- Si moins de 5 participants, un seul groupe
    IF v_total_participants < 5 THEN
      v_num_groups := 1;
    END IF;

    -- Supprimer les anciennes données
    DELETE FROM slot_groups WHERE slot_id = p_slot_id;
    DELETE FROM conversation_participants WHERE conversation_id IN
      (SELECT id FROM conversations WHERE slot_id = p_slot_id);
    DELETE FROM conversations WHERE slot_id = p_slot_id;

    -- Créer une table temporaire pour les participants
    DROP TABLE IF EXISTS _temp_participants;
    CREATE TEMP TABLE _temp_participants (
      user_id UUID PRIMARY KEY,
      intention TEXT,
      personality_tags TEXT[],
      interests TEXT[],
      assigned_group INTEGER DEFAULT 0
    );

    -- ✅ NOUVEAU : Inclure les interests
    INSERT INTO _temp_participants (user_id, intention, personality_tags, interests)
    SELECT
      sp.user_id,
      COALESCE(p.intention, 'decouverte'),
      COALESCE(p.personality_tags, ARRAY[]::TEXT[]),
      COALESCE(p.interests, ARRAY[]::TEXT[])
    FROM slot_participants sp
    JOIN profiles p ON p.id = sp.user_id
    WHERE sp.slot_id = p_slot_id
    ORDER BY RANDOM();

    -- Si 1 seul groupe → tout le monde ensemble
    IF v_num_groups = 1 THEN
      UPDATE _temp_participants SET assigned_group = 1;
    ELSE
      -- Calculer les tailles de groupes pour distribution optimale        
      v_base_size := v_total_participants / v_num_groups;
      v_remainder := v_total_participants % v_num_groups;

      -- Créer une table pour tracker les tailles max par groupe
      DROP TABLE IF EXISTS _temp_group_sizes;
      CREATE TEMP TABLE _temp_group_sizes (
        group_index INTEGER PRIMARY KEY,
        max_size INTEGER,
        current_size INTEGER DEFAULT 0
      );

      -- ✅ NOUVEAU : Distribution optimale pour remplir tous les groupes   
      FOR v_i IN 1..v_num_groups LOOP
        INSERT INTO _temp_group_sizes (group_index, max_size)
        VALUES (v_i, v_base_size + CASE WHEN v_i <= v_remainder THEN 1 ELSE 0 END);
      END LOOP;

      -- Étape 1: Initialiser chaque groupe avec un membre (diversité)     
      FOR v_i IN 1..v_num_groups LOOP
        UPDATE _temp_participants
        SET assigned_group = v_i
        WHERE user_id = (
          SELECT tp.user_id
          FROM _temp_participants tp
          WHERE tp.assigned_group = 0
          ORDER BY
            CASE WHEN tp.intention IN (
              SELECT t2.intention FROM _temp_participants t2 WHERE t2.assigned_group > 0
            ) THEN 1 ELSE 0 END,
            RANDOM()
          LIMIT 1
        );

        UPDATE _temp_group_sizes SET current_size = 1 WHERE group_index = v_i;
      END LOOP;

      -- Étape 2: Assigner les participants restants au groupe le plus compatible
      WHILE EXISTS (SELECT 1 FROM _temp_participants WHERE assigned_group = 0) LOOP
        SELECT * INTO v_participant
        FROM _temp_participants
        WHERE assigned_group = 0
        ORDER BY RANDOM()
        LIMIT 1;

        IF v_participant IS NULL THEN
          EXIT;
        END IF;

        v_best_group := 1;
        v_best_score := -999;

        -- Trouver le meilleur groupe
        FOR v_i IN 1..v_num_groups LOOP
          SELECT current_size, max_size INTO v_current_count, v_group_size 
          FROM _temp_group_sizes WHERE group_index = v_i;

          IF v_current_count < v_group_size THEN
            -- Calculer le score moyen avec les membres actuels du groupe  
            SELECT COALESCE(AVG(
              calculate_compatibility_score(
                v_participant.intention,
                v_participant.personality_tags,
                t.intention,
                t.personality_tags
              )
            ), 50) INTO v_avg_score
            FROM _temp_participants t
            WHERE t.assigned_group = v_i;

            -- Bonus léger pour équilibrer les tailles
            v_avg_score := v_avg_score - (v_current_count * 2);

            IF v_avg_score > v_best_score THEN
              v_best_score := v_avg_score;
              v_best_group := v_i;
            END IF;
          END IF;
        END LOOP;

        -- Assigner au meilleur groupe
        UPDATE _temp_participants
        SET assigned_group = v_best_group
        WHERE user_id = v_participant.user_id;

        UPDATE _temp_group_sizes
        SET current_size = current_size + 1
        WHERE group_index = v_best_group;
      END LOOP;

      DROP TABLE IF EXISTS _temp_group_sizes;
    END IF;

    -- Insérer dans slot_groups
    INSERT INTO slot_groups (slot_id, user_id, group_index)
    SELECT p_slot_id, user_id, assigned_group
    FROM _temp_participants;

    -- Créer les conversations pour chaque groupe
    FOR v_i IN 1..v_num_groups LOOP
      IF EXISTS (SELECT 1 FROM _temp_participants WHERE assigned_group = v_i) THEN
        INSERT INTO conversations (slot_id, name, image_url, is_group, group_index)
        VALUES (
          p_slot_id,
          CASE WHEN v_num_groups = 1
            THEN v_activity.nom
            ELSE v_activity.nom || ' - Groupe ' || v_i
          END,
          v_activity.image_url,
          true,
          v_i
        )
        RETURNING id INTO v_conv_id;

        -- Ajouter les participants à la conversation
        INSERT INTO conversation_participants (conversation_id, user_id)   
        SELECT v_conv_id, user_id
        FROM _temp_participants
        WHERE assigned_group = v_i;

        -- Message système
        INSERT INTO messages (conversation_id, sender_id, content, message_type)
        SELECT
          v_conv_id,
          user_id,
          CASE WHEN v_num_groups = 1
            THEN 'Le groupe a été formé ! Bienvenue à tous 🎉'
            ELSE 'Groupe ' || v_i || ' formé ! Vous avez été réunis selon vos affinités 🎉'
          END,
          'system'
        FROM _temp_participants
        WHERE assigned_group = v_i
        LIMIT 1;
      END IF;
    END LOOP;

    DROP TABLE IF EXISTS _temp_participants;

    -- Verrouiller le créneau
    UPDATE activity_slots
    SET is_locked = true, locked_at = NOW()
    WHERE id = p_slot_id;

    RETURN jsonb_build_object(
      'success', true,
      'groups_created', v_num_groups,
      'total_participants', v_total_participants,
      'algorithm', 'compatibility_matching_v2_enhanced'
    );
  END;
  $$;


--
-- Name: form_slot_groups(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.form_slot_groups(p_slot_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_activity_id UUID;
  v_activity_name TEXT;
  v_activity_image TEXT;
  v_group_id UUID;
  v_conversation_id UUID;
  v_participant RECORD;
  v_participant_count INT;
  v_first_user_id UUID;
BEGIN
  -- 1. Vérifier si déjà formé (vérifier les DEUX flags)
  IF EXISTS (SELECT 1 FROM activity_slots WHERE id = p_slot_id AND (groups_formed = true OR is_locked = true)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Groupes déjà formés');
  END IF;

  -- 2. Récupérer l'activity_id et les infos
  SELECT activity_id INTO v_activity_id FROM activity_slots WHERE id = p_slot_id;
  
  IF v_activity_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Créneau non trouvé');
  END IF;

  SELECT nom, image_url INTO v_activity_name, v_activity_image 
  FROM activities WHERE id = v_activity_id;

  -- 3. Compter les participants
  SELECT COUNT(*) INTO v_participant_count 
  FROM slot_participants WHERE slot_id = p_slot_id;

  IF v_participant_count = 0 THEN
    -- Marquer comme formé même sans participants (synchroniser les deux flags)
    UPDATE activity_slots 
    SET groups_formed = true, 
        groups_formed_at = NOW(),
        is_locked = true,
        locked_at = NOW()
    WHERE id = p_slot_id;
    RETURN jsonb_build_object('success', true, 'groups_created', 0, 'message', 'Aucun participant');
  END IF;

  -- 4. Supprimer les anciens groupes et conversations pour ce créneau
  DELETE FROM slot_group_members WHERE group_id IN (SELECT id FROM slot_groups WHERE slot_id = p_slot_id);
  DELETE FROM conversation_participants WHERE conversation_id IN (SELECT id FROM conversations WHERE slot_id = p_slot_id AND is_group = true);
  DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE slot_id = p_slot_id AND is_group = true);
  DELETE FROM conversations WHERE slot_id = p_slot_id AND is_group = true;
  DELETE FROM slot_groups WHERE slot_id = p_slot_id;

  -- 5. Créer un seul groupe (simplifié)
  INSERT INTO slot_groups (slot_id, activity_id, group_number, group_name)
  VALUES (p_slot_id, v_activity_id, 1, 'Groupe 1')
  RETURNING id INTO v_group_id;

  -- 6. Ajouter tous les participants au groupe
  INSERT INTO slot_group_members (group_id, user_id, compatibility_score)
  SELECT v_group_id, sp.user_id, 0.5
  FROM slot_participants sp
  WHERE sp.slot_id = p_slot_id;

  -- 7. Récupérer le premier user pour le message système
  SELECT user_id INTO v_first_user_id
  FROM slot_participants WHERE slot_id = p_slot_id LIMIT 1;

  -- 8. Créer la conversation
  INSERT INTO conversations (slot_id, name, image_url, is_group)
  VALUES (p_slot_id, v_activity_name || ' - Groupe 1', v_activity_image, true)
  RETURNING id INTO v_conversation_id;

  -- 9. Ajouter les participants à la conversation
  INSERT INTO conversation_participants (conversation_id, user_id)
  SELECT v_conversation_id, sp.user_id
  FROM slot_participants sp
  WHERE sp.slot_id = p_slot_id;

  -- 10. Lier le groupe à la conversation
  UPDATE slot_groups SET conversation_id = v_conversation_id WHERE id = v_group_id;

  -- 11. Message système
  INSERT INTO messages (conversation_id, sender_id, content, message_type)
  VALUES (v_conversation_id, v_first_user_id, 
          '🎉 Groupe créé avec ' || v_participant_count || ' participant(s). L''activité commence bientôt !', 
          'system');

  -- 12. Marquer le créneau comme formé ET verrouillé (synchroniser les deux flags)
  UPDATE activity_slots 
  SET groups_formed = true, 
      groups_formed_at = NOW(),
      is_locked = true,
      locked_at = NOW()
  WHERE id = p_slot_id;

  RETURN jsonb_build_object(
    'success', true, 
    'groups_created', 1, 
    'participants', v_participant_count,
    'conversation_id', v_conversation_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


--
-- Name: get_activities_with_slots(character varying, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_activities_with_slots(p_status character varying, p_limit integer) RETURNS TABLE(activity_id uuid, nom character varying, description text, categorie character varying, categorie2 text, image_url text, date character varying, time_start time without time zone, adresse text, ville character varying, latitude double precision, longitude double precision, participants integer, max_participants integer, host_id uuid, prix numeric, status character varying, created_at timestamp with time zone, slot_count bigint, next_slot_date date, total_remaining_places bigint)
    LANGUAGE plpgsql STABLE
    AS $$
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
$$;


--
-- Name: get_all_constraints(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_all_constraints() RETURNS TABLE(schema_name text, table_name text, constraint_name text, constraint_type text, columns text[], ref_schema text, ref_table text, ref_columns text[], definition text)
    LANGUAGE sql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: get_business_dashboard(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_business_dashboard(p_business_id uuid) RETURNS TABLE(total_activities bigint, active_activities bigint, total_participants bigint, total_revenue numeric, avg_rating numeric, review_count bigint, top_activities jsonb)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: get_friends_with_profiles(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_friends_with_profiles(p_user_id uuid) RETURNS TABLE(friend_id uuid, full_name text, avatar_url text, city text, created_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: get_my_activities(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_activities(p_user_id uuid) RETURNS TABLE(activity_id uuid, nom character varying, description text, categorie character varying, image_url text, date character varying, adresse text, ville character varying, participants integer, max_participants integer, prix numeric, status character varying, created_at timestamp with time zone, slot_count bigint, next_slot_date date, total_participants bigint)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: get_my_conversations(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_conversations(p_user_id uuid) RETURNS TABLE(conversation_id uuid, last_message_at timestamp with time zone, last_message_content text, last_message_type text, last_message_sender_id uuid, last_message_sender_name text, participant_count bigint)
    LANGUAGE plpgsql STABLE
    AS $$
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
$$;


--
-- Name: get_my_conversations_v2(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_conversations_v2(p_user_id uuid) RETURNS TABLE(conversation_id uuid, conversation_name text, conversation_image text, is_group boolean, activity_id uuid, slot_id uuid, updated_at timestamp with time zone, is_closed boolean, last_message_content text, last_message_type text, last_message_at timestamp with time zone, last_message_sender_id uuid, last_message_sender_name text, participant_count bigint, other_participant_name text, other_participant_avatar text, unread_count bigint, slot_date date, slot_time time without time zone, is_past_activity boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    WITH user_conversations AS (
        SELECT
            cp.conversation_id,
            cp.last_read_at
        FROM conversation_participants cp
        WHERE cp.user_id = p_user_id
          AND cp.is_hidden = false  -- ✅ AJOUT DU FILTRE ICI
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
    unread_counts AS (
        SELECT
            m.conversation_id,
            COUNT(*) as unread
        FROM messages m
        INNER JOIN conversation_data cd ON m.conversation_id = cd.id
        WHERE m.sender_id != p_user_id
          AND m.deleted_at IS NULL
          AND m.message_type != 'system'
          AND (cd.last_read_at IS NULL OR m.created_at > cd.last_read_at)
        GROUP BY m.conversation_id
    ),
    slot_info AS (
        SELECT
            cd.id as conversation_id,
            s.date as slot_date,
            s.time as slot_time,
            CASE
                WHEN s.date < CURRENT_DATE THEN true
                WHEN s.date = CURRENT_DATE AND s.time < CURRENT_TIME THEN true
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
        COALESCE(cd.is_group, false) as is_group,
        cd.activity_id,
        cd.slot_id,
        cd.updated_at,
        COALESCE(cd.is_closed, false) as is_closed,
        lm.content as last_message_content,
        lm.message_type as last_message_type,
        lm.created_at as last_message_at,
        lm.sender_id as last_message_sender_id,
        lm.sender_name as last_message_sender_name,
        COALESCE(pc.cnt, 0)::BIGINT as participant_count,
        op.full_name as other_participant_name,
        op.avatar_url as other_participant_avatar,
        COALESCE(uc.unread, 0)::BIGINT as unread_count,
        si.slot_date,
        si.slot_time,
        COALESCE(si.is_past, false) as is_past_activity
    FROM conversation_data cd
    LEFT JOIN last_messages lm ON cd.id = lm.conversation_id
    LEFT JOIN participant_counts pc ON cd.id = pc.conversation_id
    LEFT JOIN other_participants op ON cd.id = op.conversation_id
    LEFT JOIN unread_counts uc ON cd.id = uc.conversation_id
    LEFT JOIN slot_info si ON cd.id = si.conversation_id
    ORDER BY cd.updated_at DESC;
END;
$$;


--
-- Name: get_slot_participant_count(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_slot_participant_count(p_slot_id uuid) RETURNS integer
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM slot_participants
  WHERE slot_id = p_slot_id;

  RETURN COALESCE(v_count, 0);
END;
$$;


--
-- Name: get_user_profile_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_profile_stats(p_user_id uuid) RETURNS TABLE(activities_joined bigint, activities_hosted bigint, friends_count bigint, pending_friend_requests bigint)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM slot_participants WHERE user_id = p_user_id)::BIGINT as activities_joined,
        (SELECT COUNT(*) FROM activities WHERE host_id = p_user_id)::BIGINT as activities_hosted,
        (SELECT COUNT(*) FROM friendships WHERE user_id = p_user_id)::BIGINT as friends_count,
        (SELECT COUNT(*) FROM friend_requests WHERE receiver_id = p_user_id AND status = 'pending')::BIGINT as pending_friend_requests;
END;
$$;


--
-- Name: get_user_push_token(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_push_token(user_id uuid) RETURNS text
    LANGUAGE sql SECURITY DEFINER
    AS $$
  SELECT expo_push_token 
  FROM public.profiles 
  WHERE id = user_id 
    AND notifications_enabled = true 
    AND expo_push_token IS NOT NULL;
$$;


--
-- Name: handle_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: notify_push(uuid, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_push(p_user_id uuid, p_title text, p_body text, p_data jsonb DEFAULT '{}'::jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: process_slots_due_for_grouping(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_slots_due_for_grouping() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_slot RECORD;
  v_count INTEGER := 0;
  v_result JSONB;
BEGIN
  FOR v_slot IN
    SELECT s.id, s.activity_id, s.date, s.time
    FROM activity_slots s
    JOIN activities a ON a.id = s.activity_id
    WHERE s.groups_formed = false
      AND a.status = 'active'
      AND (s.date || ' ' || COALESCE(s.time, '00:00'))::timestamp        
          BETWEEN NOW() + INTERVAL '23 hours'
          AND NOW() + INTERVAL '24 hours 30 minutes'
  LOOP
    BEGIN
      v_result := form_groups_intelligent_v2(v_slot.id);
      
      -- Logger le résultat
      INSERT INTO group_formation_logs (slot_id, activity_id, status, groups_created, participants_count, triggered_by)
      VALUES (
        v_slot.id, 
        v_slot.activity_id,
        CASE WHEN (v_result->>'success')::boolean THEN 'success' ELSE 'failed' END,
        COALESCE((v_result->>'groups_created')::integer, 0),
        COALESCE((v_result->>'total_participants')::integer, 0),
        'cron'
      );
      
      IF (v_result->>'success')::boolean THEN
        v_count := v_count + 1;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      -- Logger l'erreur
      INSERT INTO group_formation_logs (slot_id, activity_id, status, error_message, triggered_by)
      VALUES (v_slot.id, v_slot.activity_id, 'failed', SQLERRM, 'cron');
    END;
  END LOOP;

  RETURN v_count;
END;
$$;


--
-- Name: search_activities(text, text, text, numeric, numeric, double precision, double precision, numeric, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_activities(p_search_text text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_ville text DEFAULT NULL::text, p_min_price numeric DEFAULT NULL::numeric, p_max_price numeric DEFAULT NULL::numeric, p_user_lat double precision DEFAULT NULL::double precision, p_user_lng double precision DEFAULT NULL::double precision, p_max_distance_km numeric DEFAULT NULL::numeric, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS TABLE(id uuid, host_id uuid, nom character varying, titre character varying, description text, categorie character varying, categorie2 text, image_url text, ville character varying, latitude double precision, longitude double precision, prix numeric, max_participants integer, participants integer, places_restantes integer, status character varying, created_at timestamp with time zone, slot_count bigint, earliest_slot_date date, remaining_places bigint, distance_km numeric)
    LANGUAGE plpgsql STABLE
    AS $$
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
$$;


--
-- Name: submit_review(uuid, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_review(p_activity_id uuid, p_rating integer, p_comment text DEFAULT NULL::text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: trigger_friend_request_push(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_friend_request_push() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: trigger_message_push(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_message_push() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: trigger_update_business_rating(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_update_business_rating() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: update_activities_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_activities_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_business_rating(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_business_rating(p_host_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: update_business_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_business_stats() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


--
-- Name: update_conversation_last_message(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_conversation_last_message() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE conversations
  SET 
    last_message_at = NEW.created_at,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$;


--
-- Name: update_places_restantes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_places_restantes() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.places_restantes = NEW.max_participants - NEW.participants;
  RETURN NEW;
END;
$$;


--
-- Name: update_reports_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_reports_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nom character varying(255) NOT NULL,
    titre character varying(255),
    categorie character varying(100) NOT NULL,
    description text NOT NULL,
    image_url text,
    host_id uuid NOT NULL,
    host_type character varying(50) DEFAULT 'Particulier'::character varying,
    date character varying(255) NOT NULL,
    time_start time without time zone,
    time_end time without time zone,
    dates_supplementaires text,
    adresse text NOT NULL,
    ville character varying(255) NOT NULL,
    code_postal character varying(10),
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    participants integer DEFAULT 0,
    max_participants integer NOT NULL,
    places_restantes integer,
    prix numeric(10,2),
    prix_devise character varying(10) DEFAULT 'EUR'::character varying,
    inclusions text[],
    regles text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    status character varying(50) DEFAULT 'active'::character varying,
    categorie2 text
);


--
-- Name: activity_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    activity_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now()
);


--
-- Name: activity_revenue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_revenue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    activity_id uuid,
    business_id uuid,
    participant_id uuid,
    amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'EUR'::character varying,
    payment_status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT activity_revenue_payment_status_check CHECK (((payment_status)::text = ANY ((ARRAY['pending'::character varying, 'completed'::character varying, 'refunded'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: activity_slots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_slots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    activity_id uuid NOT NULL,
    date date NOT NULL,
    "time" time without time zone NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    duration integer DEFAULT 60,
    max_participants integer DEFAULT 10,
    max_groups integer DEFAULT 1,
    participants_per_group integer,
    groups_formed boolean DEFAULT false,
    groups_formed_at timestamp with time zone,
    is_locked boolean DEFAULT false,
    locked_at timestamp with time zone
);


--
-- Name: blocked_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blocked_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    blocker_id uuid NOT NULL,
    blocked_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT blocked_users_check CHECK ((blocker_id <> blocked_id))
);


--
-- Name: business_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_stats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid,
    date date NOT NULL,
    views integer DEFAULT 0,
    activity_views integer DEFAULT 0,
    total_participants integer DEFAULT 0,
    total_revenue numeric(10,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: conversation_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    last_read_at timestamp with time zone,
    is_muted boolean DEFAULT false,
    is_hidden boolean DEFAULT false
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_message_at timestamp with time zone,
    activity_id uuid,
    name text,
    image_url text,
    is_group boolean DEFAULT false,
    slot_id uuid,
    is_closed boolean DEFAULT false,
    closed_at timestamp with time zone,
    closed_reason text,
    friend_request_id uuid
);


--
-- Name: COLUMN conversations.friend_request_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.conversations.friend_request_id IS 'ID de la demande d''ami en attente. Si non null, la conversation est bloquée jusqu''à acceptation.';


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    content text,
    message_type text NOT NULL,
    media_url text,
    media_duration integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    is_admin_message boolean DEFAULT false,
    CONSTRAINT messages_message_type_check CHECK ((message_type = ANY (ARRAY['text'::text, 'image'::text, 'voice'::text, 'system'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    username text NOT NULL,
    full_name text,
    avatar_url text,
    bio text,
    city text,
    date_of_birth date,
    phone text,
    interests text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    activities_joined integer DEFAULT 0,
    activities_hosted integer DEFAULT 0,
    account_type character varying(20) DEFAULT 'user'::character varying,
    business_name character varying(255),
    business_description text,
    business_category character varying(100),
    business_website character varying(255),
    business_phone character varying(20),
    business_email character varying(255),
    business_address text,
    business_siret character varying(20),
    business_logo_url text,
    business_cover_url text,
    business_hours jsonb,
    business_social_links jsonb,
    business_verified boolean DEFAULT false,
    business_rating numeric(2,1) DEFAULT 0,
    business_review_count integer DEFAULT 0,
    intention text,
    personality_tags text[],
    expo_push_token text,
    notifications_enabled boolean DEFAULT false,
    CONSTRAINT intention_check CHECK (((intention IS NULL) OR (intention = ANY (ARRAY['amicaux'::text, 'rencontres'::text, 'reseau'::text, 'decouverte'::text])))),
    CONSTRAINT profiles_account_type_check CHECK (((account_type)::text = ANY ((ARRAY['user'::character varying, 'business'::character varying])::text[])))
);


--
-- Name: COLUMN profiles.intention; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.intention IS 'Intention de l''utilisateur: amicaux, rencontres, reseau, decouverte';


--
-- Name: COLUMN profiles.personality_tags; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.personality_tags IS 'Tags de personnalité/ambiance de l''utilisateur (max 5). Ex: Calme, Festif, Introverti, etc.';


--
-- Name: conversations_with_last_message; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.conversations_with_last_message AS
 SELECT c.id AS conversation_id,
    c.last_message_at,
    m.content AS last_message_content,
    m.message_type AS last_message_type,
    m.sender_id AS last_message_sender_id,
    sender.full_name AS last_message_sender_name,
    count(DISTINCT cp.user_id) AS participant_count
   FROM (((public.conversations c
     LEFT JOIN public.messages m ON ((m.id = ( SELECT messages.id
           FROM public.messages
          WHERE (messages.conversation_id = c.id)
          ORDER BY messages.created_at DESC
         LIMIT 1))))
     LEFT JOIN public.profiles sender ON ((sender.id = m.sender_id)))
     LEFT JOIN public.conversation_participants cp ON ((cp.conversation_id = c.id)))
  GROUP BY c.id, c.last_message_at, m.content, m.message_type, m.sender_id, sender.full_name;


--
-- Name: friend_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.friend_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sender_id uuid NOT NULL,
    receiver_id uuid NOT NULL,
    status text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT friend_requests_check CHECK ((sender_id <> receiver_id)),
    CONSTRAINT friend_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text])))
);


--
-- Name: friend_requests_with_profiles; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.friend_requests_with_profiles AS
 SELECT fr.id,
    fr.sender_id,
    fr.receiver_id,
    fr.status,
    fr.created_at,
    sender.full_name AS sender_name,
    sender.avatar_url AS sender_avatar,
    receiver.full_name AS receiver_name,
    receiver.avatar_url AS receiver_avatar
   FROM ((public.friend_requests fr
     JOIN public.profiles sender ON ((sender.id = fr.sender_id)))
     JOIN public.profiles receiver ON ((receiver.id = fr.receiver_id)));


--
-- Name: friendships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.friendships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    friend_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT friendships_check CHECK ((user_id <> friend_id))
);


--
-- Name: friends_with_profiles; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.friends_with_profiles AS
 SELECT f.user_id,
    f.friend_id,
    p.full_name,
    p.avatar_url,
    p.city,
    f.created_at
   FROM (public.friendships f
     JOIN public.profiles p ON ((p.id = f.friend_id)));


--
-- Name: group_formation_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_formation_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slot_id uuid,
    activity_id uuid,
    status text NOT NULL,
    groups_created integer DEFAULT 0,
    participants_count integer DEFAULT 0,
    error_message text,
    triggered_by text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: met_people_hidden; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.met_people_hidden (
    user_id uuid NOT NULL,
    hidden_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reported_by uuid NOT NULL,
    target_type text NOT NULL,
    target_id uuid NOT NULL,
    reason text NOT NULL,
    description text,
    status text DEFAULT 'new'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reports_reason_check CHECK ((reason = ANY (ARRAY['harassment'::text, 'spam'::text, 'fake_profile'::text, 'inappropriate_content'::text, 'hate_speech'::text, 'scam'::text, 'dangerous_behavior'::text, 'other'::text]))),
    CONSTRAINT reports_status_check CHECK ((status = ANY (ARRAY['new'::text, 'reviewing'::text, 'resolved'::text, 'dismissed'::text]))),
    CONSTRAINT reports_target_type_check CHECK ((target_type = ANY (ARRAY['profile'::text, 'message'::text, 'activity'::text])))
);


--
-- Name: TABLE reports; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.reports IS 'Table des signalements de profils, messages et activités';


--
-- Name: COLUMN reports.target_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reports.target_type IS 'Type de cible: profile, message, activity';


--
-- Name: COLUMN reports.reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reports.reason IS 'Raison du signalement';


--
-- Name: COLUMN reports.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reports.status IS 'Statut: new, reviewing, resolved, dismissed';


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    activity_id uuid NOT NULL,
    reviewer_id uuid NOT NULL,
    rating integer NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: slot_group_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.slot_group_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid,
    user_id uuid,
    compatibility_score numeric(3,2) DEFAULT 0.5,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: slot_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.slot_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slot_id uuid NOT NULL,
    activity_id uuid,
    group_number integer DEFAULT 1,
    group_name text,
    conversation_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: slot_groups_backup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.slot_groups_backup (
    slot_id uuid,
    user_id uuid,
    group_index integer,
    created_at timestamp with time zone,
    conversation_id uuid
);


--
-- Name: slot_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.slot_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slot_id uuid NOT NULL,
    activity_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now()
);


--
-- Name: v_slots_pending_group_formation; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_slots_pending_group_formation AS
 SELECT s.id AS slot_id,
    a.id AS activity_id,
    a.nom AS activity_name,
    s.date,
    s."time",
    (((s.date || ' '::text) || COALESCE(s."time", '00:00:00'::time without time zone)))::timestamp without time zone AS slot_datetime,
    ((((s.date || ' '::text) || COALESCE(s."time", '00:00:00'::time without time zone)))::timestamp without time zone - '24:00:00'::interval) AS formation_due_at,
    s.groups_formed,
    s.is_locked,
    s.max_groups,
    s.participants_per_group,
    ( SELECT count(*) AS count
           FROM public.slot_participants sp
          WHERE (sp.slot_id = s.id)) AS current_participants,
        CASE
            WHEN s.groups_formed THEN 'already_formed'::text
            WHEN ((((s.date || ' '::text) || COALESCE(s."time", '00:00:00'::time without time zone)))::timestamp without time zone < now()) THEN 'past'::text
            WHEN (((((s.date || ' '::text) || COALESCE(s."time", '00:00:00'::time without time zone)))::timestamp without time zone - '24:00:00'::interval) <= now()) THEN 'ready_to_form'::text
            ELSE 'waiting'::text
        END AS formation_status
   FROM (public.activity_slots s
     JOIN public.activities a ON ((a.id = s.activity_id)))
  WHERE ((a.status)::text = 'active'::text)
  ORDER BY s.date, s."time";


--
-- Name: v_slow_queries; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_slow_queries AS
 SELECT query,
    calls,
    total_exec_time,
    mean_exec_time,
    max_exec_time,
    rows
   FROM extensions.pg_stat_statements
  ORDER BY mean_exec_time DESC
 LIMIT 50;


--
-- Name: activities activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_pkey PRIMARY KEY (id);


--
-- Name: activity_participants activity_participants_activity_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_participants
    ADD CONSTRAINT activity_participants_activity_id_user_id_key UNIQUE (activity_id, user_id);


--
-- Name: activity_participants activity_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_participants
    ADD CONSTRAINT activity_participants_pkey PRIMARY KEY (id);


--
-- Name: activity_revenue activity_revenue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_revenue
    ADD CONSTRAINT activity_revenue_pkey PRIMARY KEY (id);


--
-- Name: activity_slots activity_slots_activity_id_date_time_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_slots
    ADD CONSTRAINT activity_slots_activity_id_date_time_key UNIQUE (activity_id, date, "time");


--
-- Name: activity_slots activity_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_slots
    ADD CONSTRAINT activity_slots_pkey PRIMARY KEY (id);


--
-- Name: blocked_users blocked_users_blocker_id_blocked_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocked_users
    ADD CONSTRAINT blocked_users_blocker_id_blocked_id_key UNIQUE (blocker_id, blocked_id);


--
-- Name: blocked_users blocked_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocked_users
    ADD CONSTRAINT blocked_users_pkey PRIMARY KEY (id);


--
-- Name: business_stats business_stats_business_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_stats
    ADD CONSTRAINT business_stats_business_id_date_key UNIQUE (business_id, date);


--
-- Name: business_stats business_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_stats
    ADD CONSTRAINT business_stats_pkey PRIMARY KEY (id);


--
-- Name: conversation_participants conversation_participants_conversation_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_conversation_id_user_id_key UNIQUE (conversation_id, user_id);


--
-- Name: conversation_participants conversation_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: friend_requests friend_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friend_requests
    ADD CONSTRAINT friend_requests_pkey PRIMARY KEY (id);


--
-- Name: friend_requests friend_requests_sender_id_receiver_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friend_requests
    ADD CONSTRAINT friend_requests_sender_id_receiver_id_key UNIQUE (sender_id, receiver_id);


--
-- Name: friendships friendships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_pkey PRIMARY KEY (id);


--
-- Name: friendships friendships_user_id_friend_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_user_id_friend_id_key UNIQUE (user_id, friend_id);


--
-- Name: group_formation_logs group_formation_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_formation_logs
    ADD CONSTRAINT group_formation_logs_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: met_people_hidden met_people_hidden_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.met_people_hidden
    ADD CONSTRAINT met_people_hidden_pkey PRIMARY KEY (user_id, hidden_user_id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: reports reports_reported_by_target_type_target_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reported_by_target_type_target_id_key UNIQUE (reported_by, target_type, target_id);


--
-- Name: reviews reviews_activity_id_reviewer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_activity_id_reviewer_id_key UNIQUE (activity_id, reviewer_id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: slot_group_members slot_group_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slot_group_members
    ADD CONSTRAINT slot_group_members_pkey PRIMARY KEY (id);


--
-- Name: slot_groups slot_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slot_groups
    ADD CONSTRAINT slot_groups_pkey PRIMARY KEY (id);


--
-- Name: slot_participants slot_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slot_participants
    ADD CONSTRAINT slot_participants_pkey PRIMARY KEY (id);


--
-- Name: slot_participants slot_participants_slot_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slot_participants
    ADD CONSTRAINT slot_participants_slot_id_user_id_key UNIQUE (slot_id, user_id);


--
-- Name: idx_activities_active_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_active_created ON public.activities USING btree (created_at DESC) WHERE ((status)::text = 'active'::text);


--
-- Name: idx_activities_categorie; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_categorie ON public.activities USING btree (categorie);


--
-- Name: idx_activities_categorie2; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_categorie2 ON public.activities USING btree (categorie2);


--
-- Name: idx_activities_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_created_at ON public.activities USING btree (created_at DESC);


--
-- Name: idx_activities_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_date ON public.activities USING btree (date);


--
-- Name: idx_activities_date_text; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_date_text ON public.activities USING btree (date);


--
-- Name: idx_activities_host; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_host ON public.activities USING btree (host_id);


--
-- Name: idx_activities_host_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_host_id ON public.activities USING btree (host_id);


--
-- Name: idx_activities_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_location ON public.activities USING btree (latitude, longitude);


--
-- Name: idx_activities_participants; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_participants ON public.activities USING btree (participants);


--
-- Name: idx_activities_prix; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_prix ON public.activities USING btree (prix);


--
-- Name: idx_activities_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_status ON public.activities USING btree (status);


--
-- Name: idx_activities_status_date_text; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_status_date_text ON public.activities USING btree (status, date);


--
-- Name: idx_activities_ville; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_ville ON public.activities USING btree (ville);


--
-- Name: idx_activity_participants_activity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_participants_activity ON public.activity_participants USING btree (activity_id);


--
-- Name: idx_activity_participants_activity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_participants_activity_id ON public.activity_participants USING btree (activity_id);


--
-- Name: idx_activity_participants_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_activity_participants_unique ON public.activity_participants USING btree (activity_id, user_id);


--
-- Name: idx_activity_participants_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_participants_user ON public.activity_participants USING btree (user_id);


--
-- Name: idx_activity_participants_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_participants_user_id ON public.activity_participants USING btree (user_id);


--
-- Name: idx_activity_revenue_activity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_revenue_activity_id ON public.activity_revenue USING btree (activity_id);


--
-- Name: idx_activity_revenue_business_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_revenue_business_id ON public.activity_revenue USING btree (business_id);


--
-- Name: idx_activity_revenue_business_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_revenue_business_status ON public.activity_revenue USING btree (business_id, payment_status);


--
-- Name: idx_activity_revenue_participant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_revenue_participant_id ON public.activity_revenue USING btree (participant_id);


--
-- Name: idx_activity_revenue_payment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_revenue_payment_status ON public.activity_revenue USING btree (payment_status);


--
-- Name: idx_activity_slots_activity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_slots_activity ON public.activity_slots USING btree (activity_id);


--
-- Name: idx_activity_slots_activity_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_slots_activity_date ON public.activity_slots USING btree (activity_id, date);


--
-- Name: idx_activity_slots_activity_date_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_slots_activity_date_time ON public.activity_slots USING btree (activity_id, date, "time");


--
-- Name: idx_activity_slots_activity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_slots_activity_id ON public.activity_slots USING btree (activity_id);


--
-- Name: idx_activity_slots_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_slots_created_by ON public.activity_slots USING btree (created_by);


--
-- Name: idx_activity_slots_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_slots_date ON public.activity_slots USING btree (date);


--
-- Name: idx_activity_slots_date_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_slots_date_time ON public.activity_slots USING btree (date, "time");


--
-- Name: idx_activity_slots_groups_formed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_slots_groups_formed ON public.activity_slots USING btree (groups_formed, date);


--
-- Name: idx_blocked_users_blocked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocked_users_blocked ON public.blocked_users USING btree (blocked_id);


--
-- Name: idx_blocked_users_blocked_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocked_users_blocked_id ON public.blocked_users USING btree (blocked_id);


--
-- Name: idx_blocked_users_blocker; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocked_users_blocker ON public.blocked_users USING btree (blocker_id);


--
-- Name: idx_blocked_users_blocker_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocked_users_blocker_id ON public.blocked_users USING btree (blocker_id);


--
-- Name: idx_blocked_users_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_blocked_users_unique ON public.blocked_users USING btree (blocker_id, blocked_id);


--
-- Name: idx_business_stats_business_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_business_stats_business_date ON public.business_stats USING btree (business_id, date DESC);


--
-- Name: idx_business_stats_business_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_business_stats_business_id ON public.business_stats USING btree (business_id);


--
-- Name: idx_business_stats_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_business_stats_date ON public.business_stats USING btree (date);


--
-- Name: idx_conv_participants_hidden; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conv_participants_hidden ON public.conversation_participants USING btree (user_id, is_hidden) WHERE (is_hidden = false);


--
-- Name: idx_conv_participants_user_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conv_participants_user_read ON public.conversation_participants USING btree (user_id, conversation_id, last_read_at);


--
-- Name: idx_conversation_participants_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_participants_conversation ON public.conversation_participants USING btree (conversation_id);


--
-- Name: idx_conversation_participants_conversation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_participants_conversation_id ON public.conversation_participants USING btree (conversation_id);


--
-- Name: idx_conversation_participants_muted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_participants_muted ON public.conversation_participants USING btree (user_id, is_muted) WHERE (is_muted = true);


--
-- Name: idx_conversation_participants_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_conversation_participants_unique ON public.conversation_participants USING btree (conversation_id, user_id);


--
-- Name: idx_conversation_participants_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_participants_user ON public.conversation_participants USING btree (user_id);


--
-- Name: idx_conversation_participants_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_participants_user_id ON public.conversation_participants USING btree (user_id);


--
-- Name: idx_conversations_activity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_activity_id ON public.conversations USING btree (activity_id);


--
-- Name: idx_conversations_friend_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_friend_request ON public.conversations USING btree (friend_request_id) WHERE (friend_request_id IS NOT NULL);


--
-- Name: idx_conversations_is_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_is_group ON public.conversations USING btree (is_group);


--
-- Name: idx_conversations_last_message_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_last_message_at ON public.conversations USING btree (last_message_at DESC);


--
-- Name: idx_conversations_slot_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_slot_id ON public.conversations USING btree (slot_id);


--
-- Name: idx_conversations_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_updated_at ON public.conversations USING btree (updated_at DESC);


--
-- Name: idx_friend_requests_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friend_requests_created_at ON public.friend_requests USING btree (created_at DESC);


--
-- Name: idx_friend_requests_receiver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friend_requests_receiver ON public.friend_requests USING btree (receiver_id, status);


--
-- Name: idx_friend_requests_receiver_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friend_requests_receiver_id ON public.friend_requests USING btree (receiver_id);


--
-- Name: idx_friend_requests_receiver_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friend_requests_receiver_status ON public.friend_requests USING btree (receiver_id, status);


--
-- Name: idx_friend_requests_sender; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friend_requests_sender ON public.friend_requests USING btree (sender_id, status);


--
-- Name: idx_friend_requests_sender_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friend_requests_sender_id ON public.friend_requests USING btree (sender_id);


--
-- Name: idx_friend_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friend_requests_status ON public.friend_requests USING btree (status);


--
-- Name: idx_friendships_friend; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friendships_friend ON public.friendships USING btree (friend_id);


--
-- Name: idx_friendships_friend_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friendships_friend_id ON public.friendships USING btree (friend_id);


--
-- Name: idx_friendships_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_friendships_unique ON public.friendships USING btree (user_id, friend_id);


--
-- Name: idx_friendships_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friendships_user ON public.friendships USING btree (user_id);


--
-- Name: idx_friendships_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_friendships_user_id ON public.friendships USING btree (user_id);


--
-- Name: idx_group_formation_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_group_formation_logs_created ON public.group_formation_logs USING btree (created_at DESC);


--
-- Name: idx_group_formation_logs_slot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_group_formation_logs_slot ON public.group_formation_logs USING btree (slot_id);


--
-- Name: idx_messages_admin_true; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_admin_true ON public.messages USING btree (is_admin_message) WHERE (is_admin_message = true);


--
-- Name: idx_messages_conv_not_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_conv_not_deleted ON public.messages USING btree (conversation_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_messages_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_conversation ON public.messages USING btree (conversation_id, created_at DESC);


--
-- Name: idx_messages_conversation_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_conversation_created ON public.messages USING btree (conversation_id, created_at DESC);


--
-- Name: idx_messages_conversation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_conversation_id ON public.messages USING btree (conversation_id);


--
-- Name: idx_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_created_at ON public.messages USING btree (created_at DESC);


--
-- Name: idx_messages_not_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_not_deleted ON public.messages USING btree (conversation_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_messages_sender; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_sender ON public.messages USING btree (sender_id);


--
-- Name: idx_messages_sender_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_sender_id ON public.messages USING btree (sender_id);


--
-- Name: idx_messages_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_type ON public.messages USING btree (message_type);


--
-- Name: idx_messages_unread_count; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_unread_count ON public.messages USING btree (conversation_id, sender_id, created_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_met_people_hidden_hidden_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_met_people_hidden_hidden_user_id ON public.met_people_hidden USING btree (hidden_user_id);


--
-- Name: idx_met_people_hidden_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_met_people_hidden_unique ON public.met_people_hidden USING btree (user_id, hidden_user_id);


--
-- Name: idx_met_people_hidden_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_met_people_hidden_user_id ON public.met_people_hidden USING btree (user_id);


--
-- Name: idx_profiles_account_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_account_type ON public.profiles USING btree (account_type);


--
-- Name: idx_profiles_business_verified_true; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_business_verified_true ON public.profiles USING btree (business_verified) WHERE (business_verified = true);


--
-- Name: idx_profiles_city; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_city ON public.profiles USING btree (city);


--
-- Name: idx_profiles_expo_push_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_expo_push_token ON public.profiles USING btree (expo_push_token) WHERE (expo_push_token IS NOT NULL);


--
-- Name: idx_profiles_full_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_full_name ON public.profiles USING btree (full_name);


--
-- Name: idx_profiles_full_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_full_name_trgm ON public.profiles USING gin (full_name public.gin_trgm_ops);


--
-- Name: idx_profiles_intention; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_intention ON public.profiles USING btree (intention);


--
-- Name: idx_profiles_personality_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_personality_tags ON public.profiles USING gin (personality_tags);


--
-- Name: idx_profiles_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_username ON public.profiles USING btree (username);


--
-- Name: idx_profiles_username_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_username_trgm ON public.profiles USING gin (username public.gin_trgm_ops);


--
-- Name: idx_reports_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_created ON public.reports USING btree (created_at DESC);


--
-- Name: idx_reports_reported_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_reported_by ON public.reports USING btree (reported_by);


--
-- Name: idx_reports_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_status ON public.reports USING btree (status);


--
-- Name: idx_reports_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_target ON public.reports USING btree (target_type, target_id);


--
-- Name: idx_reports_target_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_target_type ON public.reports USING btree (target_type);


--
-- Name: idx_reviews_activity_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_activity_created ON public.reviews USING btree (activity_id, created_at DESC);


--
-- Name: idx_reviews_activity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_activity_id ON public.reviews USING btree (activity_id);


--
-- Name: idx_reviews_activity_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_activity_rating ON public.reviews USING btree (activity_id, rating);


--
-- Name: idx_reviews_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_created_at ON public.reviews USING btree (created_at DESC);


--
-- Name: idx_reviews_reviewer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_reviewer_id ON public.reviews USING btree (reviewer_id);


--
-- Name: idx_slot_group_members_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slot_group_members_group_id ON public.slot_group_members USING btree (group_id);


--
-- Name: idx_slot_group_members_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_slot_group_members_unique ON public.slot_group_members USING btree (group_id, user_id);


--
-- Name: idx_slot_group_members_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slot_group_members_user_id ON public.slot_group_members USING btree (user_id);


--
-- Name: idx_slot_groups_activity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slot_groups_activity_id ON public.slot_groups USING btree (activity_id);


--
-- Name: idx_slot_groups_conversation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slot_groups_conversation_id ON public.slot_groups USING btree (conversation_id);


--
-- Name: idx_slot_groups_group_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slot_groups_group_number ON public.slot_groups USING btree (slot_id, group_number);


--
-- Name: idx_slot_groups_slot_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slot_groups_slot_id ON public.slot_groups USING btree (slot_id);


--
-- Name: idx_slot_participants_activity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slot_participants_activity ON public.slot_participants USING btree (activity_id);


--
-- Name: idx_slot_participants_activity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slot_participants_activity_id ON public.slot_participants USING btree (activity_id);


--
-- Name: idx_slot_participants_slot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slot_participants_slot ON public.slot_participants USING btree (slot_id);


--
-- Name: idx_slot_participants_slot_count; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slot_participants_slot_count ON public.slot_participants USING btree (slot_id);


--
-- Name: idx_slot_participants_slot_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slot_participants_slot_id ON public.slot_participants USING btree (slot_id);


--
-- Name: idx_slot_participants_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_slot_participants_unique ON public.slot_participants USING btree (slot_id, user_id);


--
-- Name: idx_slot_participants_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slot_participants_user ON public.slot_participants USING btree (user_id);


--
-- Name: idx_slot_participants_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slot_participants_user_id ON public.slot_participants USING btree (user_id);


--
-- Name: idx_unique_activity_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_unique_activity_conversation ON public.conversations USING btree (activity_id) WHERE (activity_id IS NOT NULL);


--
-- Name: idx_unique_slot_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_unique_slot_conversation ON public.conversations USING btree (slot_id) WHERE (slot_id IS NOT NULL);


--
-- Name: activities activities_places_restantes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER activities_places_restantes BEFORE INSERT OR UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION public.update_places_restantes();


--
-- Name: activities activities_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER activities_updated_at BEFORE UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION public.update_activities_updated_at();


--
-- Name: friend_requests on_friend_request_insert_push; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_friend_request_insert_push AFTER INSERT ON public.friend_requests FOR EACH ROW EXECUTE FUNCTION public.trigger_friend_request_push();


--
-- Name: messages on_message_insert_push; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_message_insert_push AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.trigger_message_push();


--
-- Name: reports reports_updated_at_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER reports_updated_at_trigger BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.update_reports_updated_at();


--
-- Name: reviews reviews_update_business_rating; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER reviews_update_business_rating AFTER INSERT OR DELETE OR UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.trigger_update_business_rating();


--
-- Name: profiles set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: slot_participants trigger_update_business_stats; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_business_stats AFTER INSERT ON public.slot_participants FOR EACH ROW EXECUTE FUNCTION public.update_business_stats();


--
-- Name: messages update_conversation_on_new_message; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_conversation_on_new_message AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();


--
-- Name: conversations update_conversations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: friend_requests update_friend_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_friend_requests_updated_at BEFORE UPDATE ON public.friend_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: messages update_messages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: activities activities_host_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_host_id_fkey FOREIGN KEY (host_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: activity_participants activity_participants_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_participants
    ADD CONSTRAINT activity_participants_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activities(id) ON DELETE CASCADE;


--
-- Name: activity_participants activity_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_participants
    ADD CONSTRAINT activity_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: activity_revenue activity_revenue_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_revenue
    ADD CONSTRAINT activity_revenue_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activities(id) ON DELETE CASCADE;


--
-- Name: activity_revenue activity_revenue_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_revenue
    ADD CONSTRAINT activity_revenue_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: activity_revenue activity_revenue_participant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_revenue
    ADD CONSTRAINT activity_revenue_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: activity_slots activity_slots_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_slots
    ADD CONSTRAINT activity_slots_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activities(id) ON DELETE CASCADE;


--
-- Name: activity_slots activity_slots_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_slots
    ADD CONSTRAINT activity_slots_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: blocked_users blocked_users_blocked_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocked_users
    ADD CONSTRAINT blocked_users_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: blocked_users blocked_users_blocker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocked_users
    ADD CONSTRAINT blocked_users_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: business_stats business_stats_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_stats
    ADD CONSTRAINT business_stats_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: conversation_participants conversation_participants_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: conversation_participants conversation_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: conversation_participants conversation_participants_user_id_profiles_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activities(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_friend_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_friend_request_id_fkey FOREIGN KEY (friend_request_id) REFERENCES public.friend_requests(id) ON DELETE SET NULL;


--
-- Name: conversations conversations_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_slot_id_fkey FOREIGN KEY (slot_id) REFERENCES public.activity_slots(id) ON DELETE CASCADE;


--
-- Name: friend_requests friend_requests_receiver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friend_requests
    ADD CONSTRAINT friend_requests_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: friend_requests friend_requests_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friend_requests
    ADD CONSTRAINT friend_requests_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: friendships friendships_friend_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_friend_id_fkey FOREIGN KEY (friend_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: friendships friendships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: group_formation_logs group_formation_logs_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_formation_logs
    ADD CONSTRAINT group_formation_logs_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activities(id) ON DELETE CASCADE;


--
-- Name: group_formation_logs group_formation_logs_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_formation_logs
    ADD CONSTRAINT group_formation_logs_slot_id_fkey FOREIGN KEY (slot_id) REFERENCES public.activity_slots(id) ON DELETE CASCADE;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_profiles_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_profiles_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: met_people_hidden met_people_hidden_hidden_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.met_people_hidden
    ADD CONSTRAINT met_people_hidden_hidden_user_id_fkey FOREIGN KEY (hidden_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: met_people_hidden met_people_hidden_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.met_people_hidden
    ADD CONSTRAINT met_people_hidden_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: reports reports_reported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activities(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: slot_group_members slot_group_members_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slot_group_members
    ADD CONSTRAINT slot_group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.slot_groups(id) ON DELETE CASCADE;


--
-- Name: slot_group_members slot_group_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slot_group_members
    ADD CONSTRAINT slot_group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: slot_groups slot_groups_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slot_groups
    ADD CONSTRAINT slot_groups_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activities(id);


--
-- Name: slot_groups slot_groups_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slot_groups
    ADD CONSTRAINT slot_groups_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id);


--
-- Name: slot_groups slot_groups_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slot_groups
    ADD CONSTRAINT slot_groups_slot_id_fkey FOREIGN KEY (slot_id) REFERENCES public.activity_slots(id) ON DELETE CASCADE;


--
-- Name: slot_participants slot_participants_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slot_participants
    ADD CONSTRAINT slot_participants_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activities(id) ON DELETE CASCADE;


--
-- Name: slot_participants slot_participants_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slot_participants
    ADD CONSTRAINT slot_participants_slot_id_fkey FOREIGN KEY (slot_id) REFERENCES public.activity_slots(id) ON DELETE CASCADE;


--
-- Name: slot_participants slot_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slot_participants
    ADD CONSTRAINT slot_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: activity_participants Anyone can view participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view participants" ON public.activity_participants FOR SELECT USING (true);


--
-- Name: slot_participants Anyone can view slot participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view slot participants" ON public.slot_participants FOR SELECT USING (true);


--
-- Name: activity_slots Anyone can view slots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view slots" ON public.activity_slots FOR SELECT USING (true);


--
-- Name: activity_slots Authenticated users can add slots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can add slots" ON public.activity_slots FOR INSERT WITH CHECK ((auth.uid() = created_by));


--
-- Name: group_formation_logs Authenticated users can view logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view logs" ON public.group_formation_logs FOR SELECT TO authenticated USING (true);


--
-- Name: messages Business can insert messages in their activity groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Business can insert messages in their activity groups" ON public.messages FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = messages.conversation_id) AND (cp.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM ((public.conversations c
     JOIN public.activity_slots s ON ((s.id = c.slot_id)))
     JOIN public.activities a ON ((a.id = s.activity_id)))
  WHERE ((c.id = messages.conversation_id) AND (a.host_id = auth.uid()))))));


--
-- Name: activity_revenue Business can insert own revenue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Business can insert own revenue" ON public.activity_revenue FOR INSERT WITH CHECK ((auth.uid() = business_id));


--
-- Name: business_stats Business can insert own stats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Business can insert own stats" ON public.business_stats FOR INSERT WITH CHECK ((auth.uid() = business_id));


--
-- Name: messages Business can read messages in their activity groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Business can read messages in their activity groups" ON public.messages FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = messages.conversation_id) AND (cp.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM ((public.conversations c
     JOIN public.activity_slots s ON ((s.id = c.slot_id)))
     JOIN public.activities a ON ((a.id = s.activity_id)))
  WHERE ((c.id = messages.conversation_id) AND (a.host_id = auth.uid()))))));


--
-- Name: business_stats Business can update own stats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Business can update own stats" ON public.business_stats FOR UPDATE USING ((auth.uid() = business_id));


--
-- Name: activity_revenue Business can view own revenue; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Business can view own revenue" ON public.activity_revenue FOR SELECT USING ((auth.uid() = business_id));


--
-- Name: business_stats Business can view own stats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Business can view own stats" ON public.business_stats FOR SELECT USING ((auth.uid() = business_id));


--
-- Name: slot_participants Business can view participants of their activities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Business can view participants of their activities" ON public.slot_participants FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.activities a
  WHERE ((a.id = slot_participants.activity_id) AND (a.host_id = auth.uid())))));


--
-- Name: activity_slots Creators can delete their slots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators can delete their slots" ON public.activity_slots FOR DELETE USING ((auth.uid() = created_by));


--
-- Name: activities Hosts can update own activities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Hosts can update own activities" ON public.activities FOR UPDATE USING ((auth.uid() = host_id)) WITH CHECK ((auth.uid() = host_id));


--
-- Name: activities Insertion authentifiée; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Insertion authentifiée" ON public.activities FOR INSERT TO authenticated WITH CHECK ((auth.uid() = host_id));


--
-- Name: activities Lecture publique des activités; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Lecture publique des activités" ON public.activities FOR SELECT USING ((((status)::text = 'active'::text) OR (auth.uid() = host_id)));


--
-- Name: profiles Profils publics en lecture; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profils publics en lecture" ON public.profiles FOR SELECT USING (true);


--
-- Name: slot_group_members Service can manage slot_group_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service can manage slot_group_members" ON public.slot_group_members USING (true);


--
-- Name: slot_groups Service can manage slot_groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service can manage slot_groups" ON public.slot_groups USING (true);


--
-- Name: activities Suppression par le créateur; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Suppression par le créateur" ON public.activities FOR DELETE TO authenticated USING ((auth.uid() = host_id));


--
-- Name: blocked_users Users can create blocks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create blocks" ON public.blocked_users FOR INSERT WITH CHECK ((auth.uid() = blocker_id));


--
-- Name: friend_requests Users can create friend requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create friend requests" ON public.friend_requests FOR INSERT WITH CHECK ((auth.uid() = sender_id));


--
-- Name: blocked_users Users can delete their own blocks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own blocks" ON public.blocked_users FOR DELETE USING ((auth.uid() = blocker_id));


--
-- Name: friend_requests Users can delete their own friend requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own friend requests" ON public.friend_requests FOR DELETE USING (((auth.uid() = sender_id) OR (auth.uid() = receiver_id)));


--
-- Name: friendships Users can delete their own friendships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own friendships" ON public.friendships FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: met_people_hidden Users can hide users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can hide users" ON public.met_people_hidden FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: friendships Users can insert friendships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert friendships" ON public.friendships FOR INSERT WITH CHECK (((auth.uid() IS NOT NULL) AND ((auth.uid() = user_id) OR (auth.uid() = friend_id))));


--
-- Name: activity_participants Users can join activities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can join activities" ON public.activity_participants FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: slot_participants Users can join slots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can join slots" ON public.slot_participants FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: activity_participants Users can leave activities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can leave activities" ON public.activity_participants FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: slot_participants Users can leave slots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can leave slots" ON public.slot_participants FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: messages Users can send messages in their conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can send messages in their conversations" ON public.messages FOR INSERT WITH CHECK (((auth.uid() = sender_id) AND (EXISTS ( SELECT 1
   FROM public.conversation_participants
  WHERE ((conversation_participants.conversation_id = messages.conversation_id) AND (conversation_participants.user_id = auth.uid()))))));


--
-- Name: met_people_hidden Users can unhide users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can unhide users" ON public.met_people_hidden FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: messages Users can update their own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own messages" ON public.messages FOR UPDATE USING ((auth.uid() = sender_id));


--
-- Name: friend_requests Users can update their received friend requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their received friend requests" ON public.friend_requests FOR UPDATE USING ((auth.uid() = receiver_id));


--
-- Name: messages Users can view messages in their conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view messages in their conversations" ON public.messages FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.conversation_participants
  WHERE ((conversation_participants.conversation_id = messages.conversation_id) AND (conversation_participants.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM (public.conversations c
     JOIN public.activities a ON (((c.activity_id = a.id) OR (EXISTS ( SELECT 1
           FROM public.activity_slots s
          WHERE ((s.id = c.slot_id) AND (s.activity_id = a.id)))))))
  WHERE ((c.id = messages.conversation_id) AND (a.host_id = auth.uid()))))));


--
-- Name: met_people_hidden Users can view own hidden users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own hidden users" ON public.met_people_hidden FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: slot_group_members Users can view slot_group_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view slot_group_members" ON public.slot_group_members FOR SELECT USING (true);


--
-- Name: slot_groups Users can view slot_groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view slot_groups" ON public.slot_groups FOR SELECT USING (true);


--
-- Name: friendships Users can view their friendships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their friendships" ON public.friendships FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: blocked_users Users can view their own blocks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own blocks" ON public.blocked_users FOR SELECT USING ((auth.uid() = blocker_id));


--
-- Name: friend_requests Users can view their own friend requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own friend requests" ON public.friend_requests FOR SELECT USING (((auth.uid() = sender_id) OR (auth.uid() = receiver_id)));


--
-- Name: profiles Utilisateurs peuvent insérer leur profil; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Utilisateurs peuvent insérer leur profil" ON public.profiles FOR INSERT WITH CHECK (true);


--
-- Name: profiles Utilisateurs peuvent mettre à jour leur profil; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Utilisateurs peuvent mettre à jour leur profil" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: activities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

--
-- Name: activity_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: activity_revenue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_revenue ENABLE ROW LEVEL SECURITY;

--
-- Name: activity_slots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_slots ENABLE ROW LEVEL SECURITY;

--
-- Name: blocked_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

--
-- Name: business_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.business_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations conversations_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversations_insert ON public.conversations FOR INSERT WITH CHECK (true);


--
-- Name: conversations conversations_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversations_select ON public.conversations FOR SELECT USING (true);


--
-- Name: conversations conversations_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversations_update ON public.conversations FOR UPDATE USING (true);


--
-- Name: friend_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: friendships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

--
-- Name: group_formation_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.group_formation_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: met_people_hidden; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.met_people_hidden ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_participants participants_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY participants_delete ON public.conversation_participants FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: conversation_participants participants_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY participants_insert ON public.conversation_participants FOR INSERT WITH CHECK (true);


--
-- Name: conversation_participants participants_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY participants_select ON public.conversation_participants FOR SELECT USING (true);


--
-- Name: conversation_participants participants_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY participants_update ON public.conversation_participants FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

--
-- Name: reports reports_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reports_insert_policy ON public.reports FOR INSERT WITH CHECK ((reported_by = auth.uid()));


--
-- Name: reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: reviews reviews_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reviews_delete_own ON public.reviews FOR DELETE USING ((reviewer_id = auth.uid()));


--
-- Name: reviews reviews_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reviews_insert_own ON public.reviews FOR INSERT WITH CHECK ((reviewer_id = auth.uid()));


--
-- Name: reviews reviews_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reviews_select_all ON public.reviews FOR SELECT USING (true);


--
-- Name: reviews reviews_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reviews_update_own ON public.reviews FOR UPDATE USING ((reviewer_id = auth.uid()));


--
-- Name: slot_group_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.slot_group_members ENABLE ROW LEVEL SECURITY;

--
-- Name: slot_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.slot_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: slot_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.slot_participants ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict A7ThH8g8xsLppacE1dqjghpTZbXqCAcsD7QmyNHzEGPUShpVNxb7yvMVNbm4CzE

