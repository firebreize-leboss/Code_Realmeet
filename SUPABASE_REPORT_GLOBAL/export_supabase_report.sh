#!/bin/bash
set -euo pipefail

# ============ CONFIG ============
# Utilise DATABASE_URL (recommandé) ou lis un fichier local non commité.
# Exemple attendu:
# postgresql://postgres:PASS@aws-1-xxx.pooler.supabase.com:6543/postgres?sslmode=require

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ DATABASE_URL n'est pas défini."
  echo "➡️ Fais: export DATABASE_URL='postgresql://...?...'"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="${ROOT_DIR}"                           # SUPABASE_REPORT_GLOBAL
INTROSPECTION_DIR="${OUT_DIR}/introspection"
EDGE_DIR="${OUT_DIR}/edge_functions"
MIGRATIONS_DIR="${OUT_DIR}/migrations"
META_DIR="${OUT_DIR}/meta"

PROJECT_ROOT="$(cd "${ROOT_DIR}/.." && pwd)"     # racine realmeet
LOCAL_SUPABASE_DIR="${PROJECT_ROOT}/supabase"

# ============ PRE-FLIGHT ============
command -v psql >/dev/null 2>&1 || { echo "❌ psql manquant. Installe: sudo apt-get install -y postgresql-client"; exit 1; }
command -v pg_dump >/dev/null 2>&1 || { echo "❌ pg_dump manquant. Installe: sudo apt-get install -y postgresql-client"; exit 1; }

echo "🔎 Test connexion DB..."
psql "$DATABASE_URL" -c "select now();" >/dev/null

# ============ CLEAN / CREATE ============
echo "🧹 Nettoyage du dossier snapshot (en gardant le script)..."
mkdir -p "$INTROSPECTION_DIR" "$EDGE_DIR" "$MIGRATIONS_DIR" "$META_DIR"

# On supprime tout sauf le script lui-même
find "$OUT_DIR" -mindepth 1 -maxdepth 1 \
  ! -name "export_supabase_report.sh" \
  ! -name "introspection" \
  ! -name "edge_functions" \
  ! -name "migrations" \
  ! -name "meta" \
  -exec rm -rf {} +

rm -rf "$INTROSPECTION_DIR"/* "$EDGE_DIR"/* "$MIGRATIONS_DIR"/* "$META_DIR"/* 2>/dev/null || true

# ============ EXPORTS ============
echo "🧱 Dump schéma (schema-only, public)..."
pg_dump "$DATABASE_URL" \
  --schema=public \
  --schema-only \
  --no-owner \
  --no-privileges \
  > "${OUT_DIR}/schema.sql"

echo "🔐 Export RLS policies..."
psql "$DATABASE_URL" -X -A -F $'\t' -c "
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
ORDER BY schemaname, tablename, policyname;
" > "${OUT_DIR}/policies.tsv"

echo "📋 Export tables..."
psql "$DATABASE_URL" -X -A -F $'\t' -c "
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
" > "${INTROSPECTION_DIR}/tables.tsv"

echo "🧬 Export columns..."
psql "$DATABASE_URL" -X -A -F $'\t' -c "
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
" > "${INTROSPECTION_DIR}/columns.tsv"

echo "🧠 Export fonctions SQL (définitions)..."
psql "$DATABASE_URL" -X -A -c "
SELECT n.nspname AS schema,
       p.proname AS name,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY 1,2;
" > "${INTROSPECTION_DIR}/functions.sql"

echo "🪝 Export triggers (définitions)..."
psql "$DATABASE_URL" -X -A -c "
SELECT tgname,
       c.relname AS table_name,
       pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE NOT t.tgisinternal
ORDER BY 2,1;
" > "${INTROSPECTION_DIR}/triggers.sql"

echo "👀 Export views..."
psql "$DATABASE_URL" -X -A -F $'\t' -c "
SELECT table_schema, table_name
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;
" > "${INTROSPECTION_DIR}/views.tsv"

echo "🧩 Export extensions..."
psql "$DATABASE_URL" -X -A -F $'\t' -c "
SELECT extname, extversion
FROM pg_extension
ORDER BY extname;
" > "${INTROSPECTION_DIR}/extensions.tsv"

echo "🗺️ Export types..."
psql "$DATABASE_URL" -X -A -F $'\t' -c "
SELECT n.nspname AS schema, t.typname AS type
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
ORDER BY 1,2;
" > "${INTROSPECTION_DIR}/types.tsv"

# ============ COPY LOCAL ARTIFACTS ============
echo "📦 Copie migrations locales (si présentes)..."
if [[ -d "${LOCAL_SUPABASE_DIR}/migrations" ]]; then
  cp -r "${LOCAL_SUPABASE_DIR}/migrations/"* "$MIGRATIONS_DIR/" 2>/dev/null || true
fi

echo "⚡ Copie Edge Functions locales (si présentes)..."
if [[ -d "${LOCAL_SUPABASE_DIR}/functions" ]]; then
  cp -r "${LOCAL_SUPABASE_DIR}/functions/"* "$EDGE_DIR/" 2>/dev/null || true
fi

# ============ META ============
echo "📝 Ecriture meta..."
{
  echo "snapshot_utc=$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "project_root=${PROJECT_ROOT}"
  echo "database_host=$(python3 - <<'PY'
import os, urllib.parse
u=os.environ.get("DATABASE_URL","")
p=urllib.parse.urlparse(u)
print(p.hostname or "")
PY
)"
  echo "database_port=$(python3 - <<'PY'
import os, urllib.parse
u=os.environ.get("DATABASE_URL","")
p=urllib.parse.urlparse(u)
print(p.port or "")
PY
)"
} > "${META_DIR}/snapshot.meta"

echo "✅ Snapshot régénéré dans: ${OUT_DIR}"
echo "➡️ Fichiers clés:"
echo "   - schema.sql"
echo "   - policies.tsv"
echo "   - introspection/*"
