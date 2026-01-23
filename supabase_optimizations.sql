-- ============================================
-- OPTIMISATIONS PERFORMANCES REALMEET
-- Version: 2.0 - Patch Performance La Reunion
-- Date: 07/01/2026
-- ============================================
-- Ce fichier contient toutes les optimisations SQL pour reduire
-- drastiquement la latence percue en eliminant les patterns N+1
-- et en regroupant les requetes via des RPCs optimisees.
-- ============================================

-- ============================================
-- PARTIE 0: SCHEMA UPDATES
-- ============================================

-- Ajouter le champ is_hidden pour cacher des conversations
ALTER TABLE conversation_participants
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;

-- Index pour filtrer les conversations cachées
CREATE INDEX IF NOT EXISTS idx_conv_participants_hidden
ON conversation_participants(user_id, is_hidden)
WHERE is_hidden = false;

-- ============================================
-- PARTIE 1: INDEX MANQUANTS CRITIQUES
-- ============================================

-- Index pour optimiser le comptage des messages non lus
CREATE INDEX IF NOT EXISTS idx_messages_unread_count
ON messages(conversation_id, sender_id, created_at DESC)
WHERE deleted_at IS NULL;

-- Index pour les messages par conversation avec filtre deleted_at
CREATE INDEX IF NOT EXISTS idx_messages_conv_not_deleted
ON messages(conversation_id, created_at DESC)
WHERE deleted_at IS NULL;

-- Index pour conversation_participants avec last_read_at
CREATE INDEX IF NOT EXISTS idx_conv_participants_user_read
ON conversation_participants(user_id, conversation_id, last_read_at);

-- Index pour conversations par updated_at
CREATE INDEX IF NOT EXISTS idx_conversations_updated
ON conversations(updated_at DESC);

-- Index pour activity_slots futures
CREATE INDEX IF NOT EXISTS idx_activity_slots_future
ON activity_slots(activity_id, date, time)
WHERE date >= CURRENT_DATE;

-- Index pour slot_participants count
CREATE INDEX IF NOT EXISTS idx_slot_participants_slot_count
ON slot_participants(slot_id);

-- Index pour activities actives
CREATE INDEX IF NOT EXISTS idx_activities_active_created
ON activities(created_at DESC)
WHERE status = 'active';

-- Index pour reviews par activity
CREATE INDEX IF NOT EXISTS idx_reviews_activity_rating
ON reviews(activity_id, rating);

-- ============================================
-- PARTIE 2: RPC get_my_conversations_v2
-- Remplace loadConversations avec 0 pattern N+1
-- Retourne TOUT en une seule requete:
-- - conversations avec participants
-- - last message info
-- - unread count
-- - slot date/time si applicable
-- ============================================

CREATE OR REPLACE FUNCTION get_my_conversations_v2(p_user_id UUID)
RETURNS TABLE (
    conversation_id UUID,
    conversation_name TEXT,
    conversation_image TEXT,
    is_group BOOLEAN,
    activity_id UUID,
    slot_id UUID,
    updated_at TIMESTAMPTZ,
    is_closed BOOLEAN,
    -- Last message info
    last_message_content TEXT,
    last_message_type TEXT,
    last_message_at TIMESTAMPTZ,
    last_message_sender_id UUID,
    last_message_sender_name TEXT,
    -- Participant info
    participant_count BIGINT,
    other_participant_name TEXT,
    other_participant_avatar TEXT,
    -- Unread count
    unread_count BIGINT,
    -- Slot info (si applicable)
    slot_date DATE,
    slot_time TIME,
    is_past_activity BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH user_conversations AS (
        -- Recuperer toutes les conversations de l'utilisateur avec last_read_at
        -- Exclure les conversations cachées (supprimées par l'utilisateur)
        SELECT
            cp.conversation_id,
            cp.last_read_at
        FROM conversation_participants cp
        WHERE cp.user_id = p_user_id
          AND COALESCE(cp.is_hidden, false) = false
    ),
    conversation_data AS (
        -- Joindre avec les donnees de conversation
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
        -- Recuperer le dernier message de chaque conversation en une seule requete
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
        -- Compter les participants par conversation
        SELECT
            cp.conversation_id,
            COUNT(*) as cnt
        FROM conversation_participants cp
        INNER JOIN conversation_data cd ON cp.conversation_id = cd.id
        GROUP BY cp.conversation_id
    ),
    other_participants AS (
        -- Pour les conversations 1-1, recuperer l'autre participant
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
        -- Compter les messages non lus en une seule requete
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
        -- Recuperer les infos de slot pour les conversations liees
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
        -- Last message
        lm.content as last_message_content,
        lm.message_type as last_message_type,
        lm.created_at as last_message_at,
        lm.sender_id as last_message_sender_id,
        lm.sender_name as last_message_sender_name,
        -- Participants
        COALESCE(pc.cnt, 0)::BIGINT as participant_count,
        op.full_name as other_participant_name,
        op.avatar_url as other_participant_avatar,
        -- Unread
        COALESCE(uc.unread, 0)::BIGINT as unread_count,
        -- Slot
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

-- Accorder les permissions
GRANT EXECUTE ON FUNCTION get_my_conversations_v2(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_conversations_v2(UUID) TO anon;


-- ============================================
-- PARTIE 3: RPC get_user_profile_stats
-- Recupere les stats utilisateur en 1 requete
-- ============================================

CREATE OR REPLACE FUNCTION get_user_profile_stats(p_user_id UUID)
RETURNS TABLE (
    activities_joined BIGINT,
    activities_hosted BIGINT,
    friends_count BIGINT,
    pending_friend_requests BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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

GRANT EXECUTE ON FUNCTION get_user_profile_stats(UUID) TO authenticated;


-- ============================================
-- PARTIE 4: RPC get_business_dashboard
-- Recupere TOUT le dashboard business en 1 requete
-- ============================================

CREATE OR REPLACE FUNCTION get_business_dashboard(p_business_id UUID)
RETURNS TABLE (
    total_activities BIGINT,
    active_activities BIGINT,
    total_participants BIGINT,
    total_revenue NUMERIC,
    avg_rating NUMERIC,
    review_count BIGINT,
    top_activities JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_activity_ids UUID[];
    v_past_slot_ids UUID[];
BEGIN
    -- Recuperer les IDs des activites du business
    SELECT ARRAY_AGG(id) INTO v_activity_ids
    FROM activities
    WHERE host_id = p_business_id;

    -- Si aucune activite, retourner des valeurs vides
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

    -- Recuperer les slots passes
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

GRANT EXECUTE ON FUNCTION get_business_dashboard(UUID) TO authenticated;


-- ============================================
-- PARTIE 5: RPC get_activities_with_slots
-- Recupere les activites avec slots et places restantes en 1 requete
-- ============================================

CREATE OR REPLACE FUNCTION get_activities_with_slots(
    p_status TEXT DEFAULT 'active',
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    activity_id UUID,
    nom VARCHAR,
    description TEXT,
    categorie VARCHAR,
    categorie2 TEXT,
    image_url TEXT,
    date VARCHAR,
    time_start TIME,
    adresse TEXT,
    ville VARCHAR,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    participants INTEGER,
    max_participants INTEGER,
    host_id UUID,
    prix NUMERIC,
    status VARCHAR,
    created_at TIMESTAMPTZ,
    -- Slot aggregated data
    slot_count BIGINT,
    next_slot_date DATE,
    total_remaining_places BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH future_slots AS (
        -- Recuperer tous les slots futurs avec leur count de participants
        SELECT
            s.activity_id,
            s.id as slot_id,
            s.date,
            s.max_participants as slot_max,
            COUNT(sp.id) as slot_participants
        FROM activity_slots s
        LEFT JOIN slot_participants sp ON s.id = sp.slot_id
        WHERE s.date >= CURRENT_DATE
        GROUP BY s.activity_id, s.id, s.date, s.max_participants
    ),
    slot_aggregates AS (
        -- Agreger les donnees de slots par activite
        SELECT
            fs.activity_id,
            COUNT(*) as slot_count,
            MIN(fs.date) as next_slot_date,
            SUM(GREATEST(0, COALESCE(fs.slot_max, 10) - fs.slot_participants)) as remaining_places
        FROM future_slots fs
        GROUP BY fs.activity_id
    )
    SELECT
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
        COALESCE(sa.slot_count, 0)::BIGINT as slot_count,
        sa.next_slot_date,
        COALESCE(sa.remaining_places, 0)::BIGINT as total_remaining_places
    FROM activities a
    INNER JOIN slot_aggregates sa ON a.id = sa.activity_id
    WHERE a.status = p_status
      AND sa.slot_count > 0  -- Seulement les activites avec des slots futurs
    ORDER BY a.created_at DESC
    LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION get_activities_with_slots(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_activities_with_slots(TEXT, INTEGER) TO anon;


-- ============================================
-- PARTIE 6: RPC get_my_activities
-- Recupere les activites de l'utilisateur (host)
-- ============================================

CREATE OR REPLACE FUNCTION get_my_activities(p_user_id UUID)
RETURNS TABLE (
    activity_id UUID,
    nom VARCHAR,
    description TEXT,
    categorie VARCHAR,
    image_url TEXT,
    date VARCHAR,
    adresse TEXT,
    ville VARCHAR,
    participants INTEGER,
    max_participants INTEGER,
    prix NUMERIC,
    status VARCHAR,
    created_at TIMESTAMPTZ,
    slot_count BIGINT,
    next_slot_date DATE,
    total_participants BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
        COALESCE(asa.slot_count, 0)::BIGINT as slot_count,
        asa.next_slot_date,
        COALESCE(asa.total_participants, 0)::BIGINT as total_participants
    FROM activities a
    LEFT JOIN activity_slots_agg asa ON a.id = asa.activity_id
    WHERE a.host_id = p_user_id
    ORDER BY a.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_activities(UUID) TO authenticated;


-- ============================================
-- PARTIE 7: RPC get_friends_with_profiles
-- Recupere les amis avec leurs profils en 1 requete
-- ============================================

CREATE OR REPLACE FUNCTION get_friends_with_profiles(p_user_id UUID)
RETURNS TABLE (
    friend_id UUID,
    full_name TEXT,
    avatar_url TEXT,
    city TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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

GRANT EXECUTE ON FUNCTION get_friends_with_profiles(UUID) TO authenticated;


-- ============================================
-- PARTIE 8: Mettre a jour les statistiques
-- ============================================

ANALYZE messages;
ANALYZE conversations;
ANALYZE conversation_participants;
ANALYZE activities;
ANALYZE activity_slots;
ANALYZE slot_participants;
ANALYZE profiles;
ANALYZE friendships;
ANALYZE friend_requests;
ANALYZE reviews;


-- ============================================
-- PARTIE 9: SYSTEME D'INVITATION AVEC MESSAGE
-- Ajoute friend_request_id aux conversations pour lier
-- une conversation à une demande d'ami en attente
-- ============================================

-- Ajouter la colonne friend_request_id à conversations
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS friend_request_id UUID REFERENCES friend_requests(id) ON DELETE SET NULL;

-- Index pour trouver rapidement les conversations liées à une demande d'ami
CREATE INDEX IF NOT EXISTS idx_conversations_friend_request
ON conversations(friend_request_id)
WHERE friend_request_id IS NOT NULL;

-- Commentaire pour documentation
COMMENT ON COLUMN conversations.friend_request_id IS
'ID de la demande d''ami en attente. Si non null, la conversation est bloquée jusqu''à acceptation.';


-- ============================================
-- FIN DU SCRIPT D'OPTIMISATION
-- ============================================
--
-- Resume des optimisations:
-- 1. get_my_conversations_v2: Elimine N+1 sur unread count et slot date
-- 2. get_user_profile_stats: 4 stats en 1 requete
-- 3. get_business_dashboard: Dashboard complet en 1 requete
-- 4. get_activities_with_slots: Activites + slots + places en 1 requete
-- 5. get_my_activities: Activites hostees en 1 requete
-- 6. get_friends_with_profiles: Amis + profils en 1 requete
-- 7. Systeme d'invitation: friend_request_id sur conversations
--
-- Objectif atteint:
-- - Browse: 1 requete (get_activities_with_slots)
-- - Chat: 1 requete (get_my_conversations_v2)
-- - Profile user: 2 requetes (profile + get_user_profile_stats)
-- - Profile business: 2 requetes (profile + get_business_dashboard)
-- - Global loadAllData: ~5 requetes max
-- ============================================
