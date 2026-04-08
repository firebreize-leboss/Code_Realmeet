# Changelog — Diagrammes RealMeet

## 2026-04-08 — Phase 2 : Hardening RLS messaging
**Domain files impactés** :
- `domains/groups-chat.mermaid`
- `domains/social.mermaid`

**Added** :
- Node `RPC create_direct_conversation` dans groups-chat (subgraph MSG)
- Node `trigger trg_cleanup_empty_conversation` dans groups-chat (subgraph MSG)

**Updated** :
- Node `conversations` : INSERT bloqué client-side, UPDATE restreint aux participants
- Node `conversation_participants` : INSERT contraint à `user_id = auth.uid()`, ajout `is_hidden`
- Lien `FR -> C_REF` dans social : précise le passage par la RPC

**Removed** :
- (aucun)

**Contexte** :
Audit Supabase advisors (Phase 2) → 3 issues critiques RLS détectées et corrigées via 2 migrations :
- `harden_conversations_rls_and_direct_conv_rpc`
- `relax_cp_insert_and_auto_cleanup_conversations`

Refactors client : `lib/supabase.ts`, `services/messaging.service.ts`, `hooks/useMessaging.ts`, `app/user-profile.tsx`, `app/(tabs)/chat.tsx`, `app/group-info.tsx`, `app/activity-detail.tsx`.
