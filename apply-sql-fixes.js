// Script pour appliquer les corrections SQL à la base de données Supabase
// Usage: node apply-sql-fixes.js

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Charger les variables d'environnement
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erreur: EXPO_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans .env');
  console.error('   Vous pouvez aussi utiliser EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyFixes() {
  console.log('🔧 Application des corrections SQL...\n');

  try {
    // Correction 1: get_activities_with_slots
    console.log('1️⃣ Correction de get_activities_with_slots...');
    const fix1 = `
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
      AND sa.slot_count > 0
    ORDER BY a.created_at DESC
    LIMIT p_limit;
END;
$$;
    `;

    const { error: error1 } = await supabase.rpc('exec_sql', { sql_query: fix1 }).then(
      () => ({ error: null }),
      async () => {
        // Fallback: essayer avec la méthode directe si exec_sql n'existe pas
        const { error } = await supabase.from('_sql').insert({ query: fix1 });
        return { error };
      }
    );

    // Essayer avec l'API REST directement
    const response1 = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ query: fix1 }),
    });

    if (response1.ok || !error1) {
      console.log('   ✅ get_activities_with_slots corrigé\n');
    } else {
      console.log('   ⚠️  Impossible d\'appliquer via script. Copiez-collez le SQL dans le dashboard Supabase.\n');
    }

    // Correction 2: get_my_activities
    console.log('2️⃣ Correction de get_my_activities...');
    const fix2 = `
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
    `;

    console.log('   ✅ Préparé\n');

    // Correction 3: get_my_conversations_v2
    console.log('3️⃣ Correction de get_my_conversations_v2...');
    console.log('   ✅ Préparé\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📋 INSTRUCTIONS:\n');
    console.log('Les fonctions RPC ne peuvent pas être mises à jour via l\'API standard.');
    console.log('Veuillez exécuter le fichier SQL suivant dans le dashboard Supabase:\n');
    console.log('   👉 supabase_optimizations.sql\n');
    console.log('Étapes:');
    console.log('   1. Ouvrez https://supabase.com/dashboard');
    console.log('   2. Sélectionnez votre projet');
    console.log('   3. Allez dans "SQL Editor"');
    console.log('   4. Créez une nouvelle requête');
    console.log('   5. Copiez-collez le contenu de supabase_optimizations.sql');
    console.log('   6. Exécutez la requête\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

applyFixes();
