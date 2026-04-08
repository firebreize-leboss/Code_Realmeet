# Findings: RealMeet Pre-Launch

## État actuel du projet

### Pages légales existantes
- `app/terms-of-use.tsx` : CGU complètes (18 articles), fonctionnel
- `app/privacy-policy.tsx` : existe (lien dans les CGU)
- `app/help-support.tsx` : à vérifier si existe
- `app/about.tsx` : à vérifier si existe

### Performance — Points d'attention connus
- DataCacheContext.tsx déjà optimisé avec RPC `get_my_conversations_v2` (élimine N+1)
- Cache global en place pour activities, conversations, friends
- Pattern "haute latence" déjà patché (commentaire dans le code)

### Deep link +1 — Architecture
- VPS : invite.html fait redirect vers deep link scheme
- App : app/invite/[token].tsx gère la réception
- RPC chain : validate_plus_one_token → preview → accept_plus_one_invitation
- Expiration : 10 min pour le token
- Cas edge : utilisateur non connecté → redirect login avec redirect_after

### Stack animations
- react-native-reanimated est en place
- Animations déjà utilisées dans : chat.tsx (scale, bgOpacity sur sélection)

## Phase 2 — Audit RLS (2026-04-08)

### 🔴 Critique — ✅ RÉSOLUS
1. ✅ **`public_profiles` view SECURITY DEFINER** → passée en `security_invoker = true` (migration `harden_conversations_rls_and_direct_conv_rpc`).
2. ✅ **`conversations` INSERT** → passée à `WITH CHECK (false)`. Toute création passe désormais via RPC `create_direct_conversation` (1:1 friends) ou edge function `form-groups-cron` (service_role).
3. ✅ **`conversations` UPDATE** → restreinte aux participants via `EXISTS (conversation_participants WHERE ...)`.
4. ✅ **`conversation_participants` INSERT** → assouplie à `WITH CHECK (user_id = auth.uid())` (couvre le cas re-join de groupe depuis activity-detail / confirm-join où l'user s'ajoute lui-même).
5. ✅ **`profiles` INSERT** → passée à `WITH CHECK (id = auth.uid())`.
6. ✅ **Trigger `trg_cleanup_empty_conversation`** créé → supprime auto la conversation quand son dernier participant part (évite les `.delete()` sur conversations côté client qui étaient cassés).

### Nouvelles RPC
- `create_direct_conversation(p_friend_id uuid, p_friend_request_id uuid DEFAULT NULL)` : idempotent, vérifie amitié/blocage, crée conv 1:1 + participants, met à jour `friend_request_id` si fourni, reset `is_hidden` sur conv existante.

### Refactors client
- `lib/supabase.ts:createConversation` → RPC
- `services/messaging.service.ts:createConversation` → RPC
- `hooks/useMessaging.ts:createConversation` → RPC
- `app/user-profile.tsx` (handleSendFriendRequest + handleStartConversation) → RPC
- `app/(tabs)/chat.tsx` (handleCreateConversation) → RPC
- `app/group-info.tsx` → retiré le `.delete()` conversations (trigger auto)
- `app/activity-detail.tsx` → retiré le `.delete()` conversations (trigger auto)

### 🟡 Warnings — ✅ RÉSOLUS
4. ✅ 45 fonctions custom : `SET search_path = public, pg_temp` appliqué (migration `harden_search_path_drop_backup_doc_banned_phones`).
5. 🔧 Extensions `pg_trgm`, `cube`, `earthdistance` dans `public` → procédure documentée dans `phase_2_notes.md` (à exécuter en maintenance window car risky).
6. 🔧 `leaked_password_protection` → toggle dashboard manuel, documenté dans `phase_2_notes.md`.
7. ✅ `slot_groups_backup` droppée.
8. ✅ `banned_phones` : policy explicite `FOR ALL TO authenticated, anon USING (false) WITH CHECK (false)` + COMMENT documentant l'accès via RPC.

### 🔴 VRAIES failles découvertes en cours d'audit — ✅ RÉSOLUES
**Important** : ce que je pensais être des faux positifs ("Service can manage" policies) étaient en réalité de **vraies failles** car les policies étaient sur `roles: {public}` et non `service_role`. N'importe quel user authentifié pouvait :
- Insérer/modifier/supprimer dans `slot_groups` et `slot_group_members` (manipuler la formation de groupes)
- Insérer dans `checkin_logs` (forger des check-ins)

✅ Fix : migration `remove_public_service_manage_policies` :
- DROP des 2 policies "Service can manage" sur slot_groups et slot_group_members. Le service_role bypasse RLS de toute façon, donc pg_cron / form-groups-cron continuent de fonctionner. Les SELECT publiques restent.
- Policy `service_role_inserts_checkin_logs` recréée avec `TO service_role` explicite.

### 📊 Bilan advisor sécurité
| Avant | Après |
|-------|-------|
| ~60 alertes | 4 warnings non-critiques (3 extensions + leaked_password) |

## Leaked Password Protection
  Celui-ci est toujours désactivé pour des raisons de développement. On utilise encore des e-mails factices pour tester les derniers user-flows critiques. Rappeler quand toutes les phases auront été implémenté de bien l'activer.
  
## À investiguer
- Quelles pages légales manquent exactement (ls app/about* app/help*)
- Performance réelle sur device Android bas de gamme
- État du deep link sur iOS vs Android (schemes différents ?)