# RealMeet — Modèle de données

> **Pour Claude Code** : Ce fichier donne une vue macro. Pour le schéma complet (colonnes exactes, types, contraintes, index), utilise les outils MCP Supabase (`list_tables`, `execute_sql`, `generate_typescript_types`).

---

## 1. Diagramme complet

```mermaid
flowchart TD

  %% ─── AUTH & PROFIL ────────────────────────────────────────────
  subgraph AUTH["👤 Auth & Profil"]
    direction TB
    P["profiles\n─────────────\nid · username · full_name\naccount_type · intention\ninterests · personality_tags\nexpo_push_token\npenalty_count · is_banned"]
  end

  %% ─── ACTIVITÉS & CRÉNEAUX ──────────────────────────────────────
  subgraph ACT["📅 Activités & Créneaux"]
    direction TB
    A["activities\n─────────────\nid · host_id\ncategorie · prix\nstatus: active | cancelled"]
    AS["activity_slots\n─────────────\nid · activity_id\ndate · time\nmax_participants\ngroups_formed · is_locked\nregistration_closed"]
    SP["slot_participants\n─────────────\nid · slot_id · user_id\nstatus: active | cancelled | completed\nchecked_in_at · cancelled_at\nis_plus_one"]
    AP["activity_participants\n─────────────\nid · activity_id · user_id\n(dénormalisation historique)"]
  end

  %% ─── GROUPES ────────────────────────────────────────────────────
  subgraph GRP["🧩 Groupes"]
    direction TB
    SG["slot_groups\n─────────────\nid · slot_id\ngroup_number · group_name\nconversation_id"]
    SGM["slot_group_members\n─────────────\nid · group_id · user_id\ncompatibility_score 0→1"]
    GFL["group_formation_logs\n─────────────\nid · slot_id\nstatus: success | error | skipped\ngroups_created · avg_compatibility"]
  end

  %% ─── MESSAGERIE ─────────────────────────────────────────────────
  subgraph MSG["💬 Messagerie"]
    direction TB
    C["conversations\n─────────────\nid · activity_id · slot_id\nfriend_request_id\nis_group · is_closed\nlast_message_at"]
    CP["conversation_participants\n─────────────\nid · conversation_id · user_id\nlast_read_at · is_muted"]
    M["messages\n─────────────\nid · conversation_id · sender_id\ncontent · message_type\nis_admin_message\nreply_to_message_id · deleted_at"]
  end

  %% ─── SOCIAL ─────────────────────────────────────────────────────
  subgraph SOC["🤝 Social"]
    direction TB
    FR["friend_requests\n─────────────\nid · sender_id · receiver_id\nstatus: pending | accepted | rejected"]
    FS["friendships\n─────────────\nid · user_id · friend_id"]
    BU["blocked_users\n─────────────\nid · blocker_id · blocked_id"]
    MPH["met_people_hidden\n─────────────\nuser_id · hidden_user_id\n(clé composite, pas d'id)"]
  end

  %% ─── INVITATION +1 ──────────────────────────────────────────────
  subgraph PLUS["➕ Invitation +1"]
    direction TB
    POI["plus_one_invitations\n─────────────\nid · slot_id\ninviter_id · invitee_id\ntoken · status\nexpires_at"]
  end

  %% ─── CHECK-IN ───────────────────────────────────────────────────
  subgraph CHK["✅ Check-in"]
    direction TB
    CL["checkin_logs\n─────────────\nid · slot_participant_id\nperformed_by · action\nresult · ip_address · metadata"]
  end

  %% ─── BUSINESS ───────────────────────────────────────────────────
  subgraph BIZ["🏢 Business"]
    direction TB
    BS["business_stats\n─────────────\nid · business_id · date\nviews · total_participants\ntotal_revenue"]
    RV["reviews\n─────────────\nid · activity_id · reviewer_id\nrating 1-5 · comment"]
  end

  %% ─── PENALITES ────────────────────────────────────────────────
  subgraph PEN["⚠️ Penalites"]
    direction TB
    UP["user_penalties\n─────────────\nid · user_id\nslot_participant_id\npenalty_type: no_show\ncreated_at"]
    BP["banned_phones\n─────────────\nid · phone\nbanned_at · reason"]
  end

  %% ─── MODÉRATION ─────────────────────────────────────────────────
  subgraph MOD["🚨 Modération"]
    direction TB
    RP["reports\n─────────────\nid · reported_by\ntarget_type: profile|message|activity\ntarget_id · reason\nstatus: new|reviewing|resolved|dismissed"]
  end

  %% ════════════════════════════════════════════════════════════════
  %% RELATIONS
  %% ════════════════════════════════════════════════════════════════

  %% Profil → tout
  P -->|"organise"| A
  P -->|"s'inscrit"| SP
  P -->|"membre"| SGM
  P -->|"invite"| POI
  P -->|"demande amitié"| FR
  P -->|"bloque"| BU
  P -->|"stats business"| BS
  P -->|"rédige"| RV
  P -->|"signale"| RP
  P -->|"penalites"| UP

  %% Activités → créneaux
  A -->|"a des créneaux"| AS
  A -->|"historique participants"| AP
  A -->|"avis"| RV

  %% Créneaux → participants / groupes
  AS -->|"inscriptions"| SP
  AS -->|"groupes formés"| SG
  AS -->|"logs formation"| GFL
  AS -->|"+1 pour ce créneau"| POI

  %% Groupes
  SG -->|"membres"| SGM
  SG -->|"chat auto-créé"| C

  %% Participants → check-in / pénalités
  SP -->|"audit trail"| CL
  SP -->|"no-show detecte"| UP

  %% +1 → participant
  POI -->|"crée place si acceptée"| SP

  %% Messagerie
  C -->|"participants"| CP
  C -->|"messages"| M
  M -->|"reply"| M

  %% Social → messagerie
  FR -->|"si acceptée"| FS
  FR -->|"crée chat 1:1"| C
```

---

## 2. Règles data

### Identifiants & clés
- Toutes les PKs sont `uuid` généré par `gen_random_uuid()`
- `profiles.id` = même UUID que `auth.users.id` (pas de FK déclarée, synchronisé via trigger)
- Unicités déclarées : `profiles.username`, `slot_participants.checkin_nonce`, `plus_one_invitations.token`

### Suppression
- **Soft delete partout** sur les données utilisateur : `status = 'cancelled'` ou `deleted_at`
- Exception : `met_people_hidden` — suppression physique OK
- Jamais de `DELETE` direct côté client

### Sécurité
- **RLS activé** sur toutes les tables
- Tout INSERT/UPDATE sensible passe par une **RPC `SECURITY DEFINER`** qui vérifie `auth.uid()` en interne
- Jamais de mutation directe depuis le client sur les tables sensibles

### Timezones
- PostgreSQL stocke tout en **UTC** (`timestamptz`)
- Logique métier (groupes, check-in) convertit en **`Europe/Paris`**
- `pg_cron` tourne en UTC → les RPC font la conversion

### Statuts importants
| Table | Colonne | Valeurs |
|-------|---------|---------|
| `activities` | `status` | `active`, `cancelled` |
| `activity_slots` | `is_locked`, `is_cancelled`, `registration_closed`, `groups_formed` | booleans |
| `slot_participants` | `status` | `active`, `cancelled`, `completed` |
| `plus_one_invitations` | `status` | `pending`, `accepted`, `expired`, `cancelled` |
| `messages` | `message_type` | `text`, `image`, `voice`, `system` |
| `friend_requests` | `status` | `pending`, `accepted`, `rejected` |
| `checkin_logs` | `action` | `token_generated`, `scan`, `validate`, `reject`, `expire` |

### Conversations — 3 types
| Type | `is_group` | `activity_id` | `friend_request_id` |
|------|-----------|--------------|-------------------|
| Chat de groupe (slot) | `true` | ✓ | null |
| Chat 1:1 ami | `false` | null | ✓ |
| Chat futur / autre | — | — | — |

---

## 3. Pour aller plus loin

**Ce fichier est intentionnellement macro.** Pour les détails exacts :

```
→ Colonnes complètes      : MCP Supabase → list_tables(verbose: true)
→ Types PostgreSQL exacts : MCP Supabase → generate_typescript_types
→ Index & contraintes     : MCP Supabase → execute_sql("SELECT ...")
→ Migrations appliquées   : MCP Supabase → list_migrations
→ Logs & erreurs runtime  : MCP Supabase → get_logs(service)
```
