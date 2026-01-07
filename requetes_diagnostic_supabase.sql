-- ============================================
-- REQUÊTES DE DIAGNOSTIC SUPABASE
-- ============================================
-- Exécutez ces requêtes dans le SQL Editor de Supabase
-- pour récupérer toutes les informations sur votre schéma actuel
-- ============================================

-- ============================================
-- 1. LISTER TOUTES LES TABLES EXISTANTES
-- ============================================
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ============================================
-- 2. STRUCTURE DÉTAILLÉE DE CHAQUE TABLE
-- ============================================

-- Table: activities
SELECT
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'activities'
ORDER BY ordinal_position;

-- Table: activity_slots
SELECT
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'activity_slots'
ORDER BY ordinal_position;

-- Table: slot_participants
SELECT
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'slot_participants'
ORDER BY ordinal_position;

-- Table: conversations
SELECT
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'conversations'
ORDER BY ordinal_position;

-- Table: conversation_participants
SELECT
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'conversation_participants'
ORDER BY ordinal_position;

-- Table: messages
SELECT
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'messages'
ORDER BY ordinal_position;

-- Table: friendships
SELECT
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'friendships'
ORDER BY ordinal_position;

-- Table: friend_requests
SELECT
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'friend_requests'
ORDER BY ordinal_position;

-- Table: profiles
SELECT
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- ============================================
-- 3. INDEX EXISTANTS SUR TOUTES LES TABLES
-- ============================================
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ============================================
-- 4. CONTRAINTES ET CLÉS ÉTRANGÈRES
-- ============================================
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;

-- ============================================
-- 5. VÉRIFIER ROW LEVEL SECURITY (RLS)
-- ============================================
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================
-- 6. POLITIQUES RLS EXISTANTES
-- ============================================
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================
-- 7. EXTENSIONS INSTALLÉES
-- ============================================
SELECT
  extname as extension_name,
  extversion as version
FROM pg_extension
ORDER BY extname;

-- ============================================
-- 8. FONCTIONS PERSONNALISÉES EXISTANTES
-- ============================================
SELECT
  routine_name,
  routine_type,
  data_type as return_type,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- ============================================
-- 9. VUES EXISTANTES
-- ============================================
SELECT
  table_name as view_name,
  view_definition
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- ============================================
-- 10. STATISTIQUES SUR LES DONNÉES
-- ============================================

-- Nombre de lignes par table (approximatif)
SELECT
  schemaname,
  relname as table_name,
  n_live_tup as estimated_row_count,
  n_dead_tup as dead_rows,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- ============================================
-- 11. TAILLE DES TABLES ET INDEX
-- ============================================
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================
-- 12. VÉRIFIER LES COLONNES GÉOGRAPHIQUES
-- ============================================
-- Important pour savoir si les fonctions de géolocalisation peuvent être utilisées
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (column_name ILIKE '%lat%' OR column_name ILIKE '%long%' OR column_name ILIKE '%location%')
ORDER BY table_name, column_name;

-- ============================================
-- 13. TRIGGERS EXISTANTS
-- ============================================
SELECT
  event_object_table as table_name,
  trigger_name,
  event_manipulation as event,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ============================================
-- 14. VÉRIFIER SI pg_stat_statements EST DISPONIBLE
-- ============================================
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_available_extensions
      WHERE name = 'pg_stat_statements'
    ) THEN 'Available'
    ELSE 'Not available'
  END as pg_stat_statements_status,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_extension
      WHERE extname = 'pg_stat_statements'
    ) THEN 'Installed'
    ELSE 'Not installed'
  END as installation_status;

-- ============================================
-- 15. ÉCHANTILLON DE DONNÉES (optionnel)
-- ============================================
-- Décommentez ces lignes si vous voulez voir des exemples de données

-- SELECT * FROM activities LIMIT 3;
-- SELECT * FROM activity_slots LIMIT 3;
-- SELECT * FROM slot_participants LIMIT 3;
-- SELECT * FROM conversations LIMIT 3;
-- SELECT * FROM messages LIMIT 3;
-- SELECT * FROM profiles LIMIT 3;
