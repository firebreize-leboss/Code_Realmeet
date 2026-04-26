# Progress: RealMeet Pre-Launch

## Session Log

### 2026-04-06 — Setup environnement optimisé
- [x] Installé planning-with-files skill dans ~/.claude/skills/
- [x] Configuré Context7 MCP (connected)
- [x] Créé CLAUDE.md à la racine du projet
- [x] Créé les 3 fichiers planning-with-files (task_plan, findings, progress)
- [x] Identifié les 5 chantiers pré-launch
- [x] Démarrer le premier chantier
- [x] Faire la phase 0
- [x] Faire la phase 1
- [x] Faire la phase 2
- [] Faire la phase 3
- [] Faire la phase 4
- [] Faire la phase 5

### 2026-04-08 — Phase 1: Performance & Smoothness
- [x] A1-A3: DataCacheContext — useMemo provider value, shallow comparison, ref pour Realtime
- [x] A4-A5: React.memo sur ActivityCard et ChatItem (extrait au module scope)
- [x] A6-A7: FlatList virtualisée browse.tsx + props perf sur 5 autres FlatLists
- [x] B1: Migration expo-image (24 fichiers), placeholder-activity.png local, suppression via.placeholder.com
- [x] B2: FlatList conversations dans chat.tsx (all/friends)
- [x] B3: Debounce 500ms location postMessage vers WebView
- [x] C1: Clustering marqueurs MapLibre avec supercluster (CDN)
- [x] C2: React.memo TabItem FloatingTabBar + stable callbacks

### 2026-04-08 — Phase 2: Audit RLS & hardening
- [x] Audit Supabase advisors (security) → identification de 3 issues critiques
- [x] Migration `harden_conversations_rls_and_direct_conv_rpc` :
  - RPC `create_direct_conversation(friend_id, friend_request_id?)` SECURITY DEFINER
  - `conversations` INSERT → `WITH CHECK (false)` (forcé via RPC)
  - `conversations` UPDATE → check participant via EXISTS
  - `conversation_participants` INSERT → tightened
  - `profiles` INSERT → `WITH CHECK (id = auth.uid())`
  - `public_profiles` view → `security_invoker = true`
- [x] Migration `relax_cp_insert_and_auto_cleanup_conversations` :
  - `conversation_participants` INSERT → `WITH CHECK (user_id = auth.uid())` (pragmatisme re-join)
  - Extension RPC avec `p_friend_request_id` optionnel
  - Trigger `trg_cleanup_empty_conversation` auto-delete conversations vides
- [x] Refactors client : lib/supabase.ts, services/messaging.service.ts, hooks/useMessaging.ts, app/user-profile.tsx, app/(tabs)/chat.tsx, app/group-info.tsx, app/activity-detail.tsx
- [x] Migration `harden_search_path_drop_backup_doc_banned_phones` :
  - SET search_path = public, pg_temp sur 45 fonctions custom
  - DROP TABLE slot_groups_backup
  - COMMENT explicatif sur banned_phones
- [x] Migration `banned_phones_explicit_deny_policy` : policy NO ACCESS pour authenticated/anon
- [x] Migration `remove_public_service_manage_policies` : DROP des policies "Service can manage" qui étaient sur PUBLIC role (vraies failles découvertes pendant l'audit). Recréation policy checkin_logs INSERT restreinte à service_role.
- **Bilan** : ~60 alertes → 4 warnings non-critiques (3 extensions in public + leaked_password)
- **Restant Phase 2** : tests fonctionnels des 5 flows + 2 actions manuelles dashboard/DBA (cf. phase_2_notes.md)

### 2026-04-08 — Phase 5: Pages légales & administratives
- [x] terms-of-use.tsx : supprimé refs paiement/Stripe/CGV, ajouté article 11 (inscription gratuite, check-in QR, annulation, no-show/pénalités/bannissement), MAJ article 6 + 14.2, date MAJ 08/04/2026
- [x] privacy-policy.tsx : réécriture complète RGPD (12 sections) — responsable traitement, données collectées détaillées (tel, géoloc, QR), bases légales par finalité, durées conservation, sous-traitants (Supabase/OVH/Expo/Protomaps), transferts hors UE, traceurs, sécurité, droits complets, réclamation CNIL
- [x] help-support.tsx : FAQ mise à jour (inscription gratuite, annulation pénalité, no-show, QR check-in), ajout liens "À propos" et "Mentions légales" dans liens utiles
- [x] about.tsx : CRÉÉ — concept RealMeet, fonctionnement en 3 étapes, liens vers toutes les pages légales, version, footer
- [x] legal-mentions.tsx : CRÉÉ — éditeur (Alexandre PEMBE), hébergeurs (Supabase, OVH, Expo), propriété intellectuelle, données personnelles/CNIL, droit applicable
- [x] settings.tsx : ajout liens "À propos de REALMEET" et "Mentions légales" dans section "À PROPOS"
- Email uniformisé à contact@realmeet.fr partout (ancien realmeet.france@gmail.com supprimé)

### 2026-04-08 — Phase 3 (partiel) : Fondations DA avec Opus
- [x] Définition de la DA RealMeet (7 principes documentés en tête de `styles/commonStyles.ts`)
- [x] Refonte de `styles/commonStyles.ts` :
  - `fontFamily` (Manrope canonisé : regular/medium/semibold/bold)
  - `letterSpacing` (6 niveaux)
  - `typographyPresets` (14 presets prêts à l'emploi : display, heading1-4, subtitle, body*, caption, label, buttonLabel, link)
  - `motion` : duration (6 valeurs), easing (5 courbes Reanimated), spring (4 configs), pressScale
  - `opacity` (disabled/pressed/inactive/hover/full)
  - `zIndex` (9 niveaux canoniques)
  - `hitSlop` (sm/md/lg/xl)
  - `layout` (max widths, hauteurs canoniques)
  - `shadows.primaryGlow` (CTA hero) + `shadows.none`
  - `borderRadius.{none,xs,xxxl}` + `spacing.{xxs,xxxxxl}`
  - Export `theme` groupé + type `Theme`
  - Manrope appliqué aux styles `commonStyles.{title,subtitle,heading,text,button*,...}` existants
- [x] Correction conflit React Navigation theme dans `app/_layout.tsx` : remplacement de `primary: rgb(255, 107, 157)` (coral pink résiduel) par `colors.primary` (#F2994A) pour cohérence avec la DA.
- [x] Backwards compat : TOUS les tokens existants conservés (50+ fichiers consommateurs intacts).
- **Fichiers modifiés** : `styles/commonStyles.ts`, `app/_layout.tsx`
- **Restant Phase 3** : application des tokens sur les composants/écrans (à faire dans une session Sonnet — voir notes dans task_plan.md).

### 2026-04-08 — Phase 4: Lien +1 (Deep Link)
- [x] Audit du flow complet `invite/[token].tsx → confirm-join.tsx → invitation.service`
- [x] Lecture de `invite.html` et `app.json` → scheme `natively://invite/<token>` cohérent
- [x] **Bug 1 corrigé** : token désormais persisté en AsyncStorage avant redirection vers login. Helper partagé créé : `lib/pendingInvite.ts` (set / consume).
- [x] **Bug 2 corrigé** : `app/auth/login.tsx` restaure le token pending et redirige vers `/invite/<token>` au lieu de `(tabs)/profile`.
- [x] **Bug 3 corrigé** : `app/auth/signup-individual.tsx` fait pareil après création de compte (nouvel utilisateur invité).
- [x] **Bug 4 corrigé** : `app/confirm-join.tsx` branche +1 appelle désormais `handleSlotGroup(acceptedSlotId)` après acceptation pour rejoindre la conversation du groupe du créneau.
- [x] Tâche obsolète "paiement duo (host_pays/guest_pays)" supprimée (paiement retiré phase 0).
- [x] Manual test plan documenté dans `.claude/notes/phase4-manual-tests.md` (9 cas Expo Go + iOS/Android).
- **Restant** : tests sur device réel (Expo Go ou dev build).
- **Fichiers modifiés** : `app/invite/[token].tsx`, `app/auth/login.tsx`, `app/auth/signup-individual.tsx`, `app/confirm-join.tsx`, `lib/pendingInvite.ts` (NEW), `.claude/notes/phase4-manual-tests.md` (NEW).

### 2026-04-09 — Phase 4 (Pre-Launch Sprint): Bugs rencontrés
- [x] **Bug 1** : Multi-sélection chat — Passage de `selectedConversation: Conversation | null` à `selectedIds: Set<string>` pour supporter la sélection multiple. Tap = toggle, long press = ajouter. Action bar affiche le nombre sélectionné. Actions (mute, delete) opèrent sur tous les éléments sélectionnés.
- [x] **Bug 2** : Vérification manuelle sans caméra — Quand la caméra échoue sur `checkin.realmeet.fr/staff`, le scanner box affiche un message "Caméra non disponible" au lieu de remplacer tout le conteneur (ce qui supprimait le bouton "Validation manuelle").
- [x] **Bug 3** : Duplicate conversation — Ajout d'une vérification client-side dans `handleCreateConversation` qui cherche une conversation existante avant d'appeler la RPC. Suppression de l'overload `create_direct_conversation(uuid)` qui causait une ambiguïté PostgREST (migration `drop_single_param_create_direct_conversation`). Reset `is_hidden` pour les conversations retrouvées.
- [x] **Bug 4** : Latence discussion fermée — `setConversationStatus({ isClosed: true })` est maintenant appelé immédiatement après lecture de `convData.is_closed`, avant les requêtes parallèles (slots, participants). L'input est bloqué dès le premier render avec les données DB.
- [x] **Bug 5** : Navbar Android overlap sur user-profile — Ajout de `useSafeAreaInsets()` et padding bottom dynamique `Math.max(20, insets.bottom + 8)` sur le `bottomBar`.
- **Fichiers modifiés** : `app/(tabs)/chat.tsx`, `realmeet-checkin/public/staff/index.html`, `app/chat-detail.tsx`, `app/user-profile.tsx`
- **Migration** : `drop_single_param_create_direct_conversation`

### 2026-04-22 — Phase finale : debuggage
- [x] **Bug 1** : InterestSelector — ajout de dédoublonnage des intérêts au chargement du profil + dédoublonnage défensif dans `toggleInterest` + icône checkmark sur les chips sélectionnés dans le picker modal pour un feedback visuel clair.
- [x] **Bug 2** : Spam click nouvelle conversation — ajout d'un guard `isCreatingConversation` (useRef) pour bloquer les appuis multiples + indicateur de chargement (ActivityIndicator) sur l'ami sélectionné + désactivation de tous les items pendant le traitement.
- [x] **Bug 3** : Clavier masquant le widget d'invitation — wrapping du contenu de la modal dans un `ScrollView` avec `keyboardShouldPersistTaps="handled"` + activation du `behavior="height"` sur Android pour `KeyboardAvoidingView` + `maxHeight: '80%'` sur le container modal.
- [x] **Bug 4** : Lien +1 auto-invitation — migration `validate_plus_one_token_self_invite_check` : ajout de vérifications `auth.uid()` dans la RPC `validate_plus_one_token` pour détecter l'auto-invitation (`CANNOT_INVITE_SELF`) et la participation existante (`ALREADY_PARTICIPANT`) dès la validation du token, avec messages d'erreur contextuels et écran d'erreur adapté (icône warning au lieu d'erreur).
- **Fichiers modifiés** : `components/InterestSelector.tsx`, `app/edit-profile.tsx`, `app/(tabs)/chat.tsx`, `app/user-profile.tsx`, `app/invite/[token].tsx`
- **Migration** : `validate_plus_one_token_self_invite_check`

### 2026-04-22 — Phase finale : test (formation de groupes)
- [x] 8 cas de test exécutés sur `form_groups_v3` avec comptes test@gmail.com à test10@gmail.com
- [x] 7/8 tests passés du premier coup, 1 bug trouvé et corrigé
- [x] **Bug trouvé (Test 5)** : `CEIL(7/3)=3` créait 3 groupes (3+2+2) violant `min_participants_per_group=3`. Fix via migration `fix_form_groups_v3_num_groups_floor` — WHILE loop pour réduire num_groups quand base_size < min.
- [x] Test 5 re-vérifié après fix → 2 groupes (4+3) ✅
- **Migration** : `fix_form_groups_v3_num_groups_floor`

### 2026-04-22 — Phase finale : changements finaux
- [x] **Tab Catégories supprimé** : Retiré de `userTabs` (5→4 tabs) et `businessTabs` (5→4 tabs) dans `_layout.tsx`. `CategoryScreen` retiré des `tabScreens` et import supprimé.
- [x] **Dev tester lien invitation** : Déjà supprimé en Phase 1, confirmé absent de `profile.tsx`.
- [x] **Waveform audio style Instagram** : Implémentation complète de la visualisation audio.
  - `voice-message.service.ts` : metering activé pendant l'enregistrement (`isMeteringEnabled: true`, callback 100ms), tracking de progression pendant la lecture (`progressUpdateIntervalMillis: 80ms`, callbacks `onProgress`/`onFinish`).
  - `components/VoiceWaveform.tsx` (NEW) : composant réutilisable avec 20 barres, hauteurs basées sur les niveaux audio, remplissage progressif coloré (orange pour reçu, blanc pour envoyé).
  - `chat-detail.tsx` : recording live avec waveform temps réel basée sur le metering, lecture avec progression, waveform déterministe par message ID (fonction `generateWaveformFromId` avec forme en cloche naturelle).
- [x] **Section PRÉFÉRENCES supprimée** de `settings.tsx` (Distance + Catégories). Paramètre **Confidentialité** supprimé de la section COMPTE.
- **Fichiers modifiés** : `app/(tabs)/_layout.tsx`, `app/settings.tsx`, `app/chat-detail.tsx`, `services/voice-message.service.ts`
- **Fichiers créés** : `components/VoiceWaveform.tsx`

### 2026-04-25 — Phase finale : debuggage compteur + auto-centrage Maps
- [x] **Bug compteur participants/total** sur la page activité : `components/ActivityCalendar.tsx` additionnait `slot_group_members` en plus de `slot_participants` (status='active'), avec une dédup par `(user_id, slot_id)`. Mais `slot_group_members` n'est jamais nettoyé après `cancel_slot_participation` ni `detect_no_shows`, donc tout user qui avait été regroupé puis avait annulé/no-show restait dans la maille → over-count visible sur les badges `X/Y` du calendrier (3 slots passés mesurés à 5–6 group_members vs 0 actifs). Fix : suppression du chemin `slot_group_members` dans les deux loaders (modes `edit` et `select`). La source de vérité est désormais `slot_participants WHERE status='active'`.
- [x] **Auto-centrage Maps** : `app/(tabs)/browse.tsx` centre désormais selon une priorité explicite : (1) `userLocation` (géoloc instantanée), (2) ville du profil géocodée via `geocodingService.geocodeAddress` (cache de session, exécuté une seule fois par valeur de `profile.city`), (3) première activité (fallback historique). Trois points d'application synchronisés : effet de centrage à l'ouverture du tab `maps`, `defaultCenter` initial de la WebView, message `loadActivities` (nouveau champ `preferredCenter`), et bouton "centrer sur moi" (utilise la ville profil quand la géoloc est absente). Aucun marker user n'est dessiné sur la ville profil.
- **Fichiers modifiés** : `components/ActivityCalendar.tsx`, `app/(tabs)/browse.tsx`, `contexte/task_plan.md`, `contexte/findings.md`.

### 2026-04-24 — Phase finale : mettre en pause le check-in QR (opt-in)
- [x] **Migration `add_requires_checkin_flag_and_gate_no_shows`** : ajout de `activities.requires_checkin boolean NOT NULL DEFAULT false` + réécriture de `detect_no_shows` pour ne créer des pénalités que sur les activités où `requires_checkin = true`. Le passage `active → completed` reste global pour ne pas casser la logique de review post-activité.
- [x] **Types** : `lib/database.types.ts` mis à jour (Row / Insert / Update sur `activities`).
- [x] **Service** : `services/activity.service.ts` — `CreateActivityData` expose `requires_checkin?: boolean`, `createActivity` le passe à l'INSERT (default `false`).
- [x] **Create activity** : `app/create-activity.tsx` — ajout d'un composant natif `Switch` (slide orange→droite quand on), helper text explicite, off par défaut. Envoyé à `activityService.createActivity`.
- [x] **Edit activity** : `app/edit-activity.tsx` — chargement de `requires_checkin`, même Switch, persistence sur l'UPDATE.
- [x] **Activity detail** : `app/activity-detail.tsx` — nouveau champ `requiresCheckin` sur l'interface `ActivityDetail`, rendu conditionnel : `<CheckinQRSection>` si `true`, sinon un bloc simple "Vous êtes inscrit !" (icône check verte, date formatée `fr-FR`, sous-titre "On se retrouve le …"). Le bouton "Inviter un ami (+1)" est conservé dans les deux cas.
- [x] **Diagrammes synchronisés** : `realmeet-domain-flow.mermaid` (ACT_F9 + mention "uniquement si requires_checkin" sur PEN_F1 + nœud `CHK_F0` opt-in + libellés des arrêtes `ACTIVITIES ==>|requires_checkin| …`), `realmeet-user-flows.mermaid` (Flow 3 avec gate `F3_GATE` → `F3_SIMPLE` ou `F3_QR`, note `detect_no_shows` ignore le flag off), `diagrammes/domains/checkin.mermaid` (sous-graphe "opt-in par activité" avec nœud GATE), `diagrammes/domains/activities-slots.mermaid` (champ `requires_checkin` sur la carte `activities`).
- **Impact** : par défaut les utilisateurs ne voient plus jamais de QR code, et aucune pénalité no-show ne peut être appliquée. Seuls les organisateurs qui activent explicitement le flag (pour activités coûteuses où la présence est critique) retrouvent le flow complet QR + pénalités. Le serveur `realmeet-checkin/` reste inchangé et opérationnel pour les activités opt-in.
- **Fichiers modifiés** : `lib/database.types.ts`, `services/activity.service.ts`, `app/create-activity.tsx`, `app/edit-activity.tsx`, `app/activity-detail.tsx`, `diagrammes/realmeet-domain-flow.mermaid`, `diagrammes/realmeet-user-flows.mermaid`, `diagrammes/domains/checkin.mermaid`, `diagrammes/domains/activities-slots.mermaid`.
- **Migration** : `add_requires_checkin_flag_and_gate_no_shows`.

### 2026-04-22 — Phase finale : réduction des lags
- [x] **Analyse latence La Réunion** : projet Supabase hébergé en AWS EU (~180-250ms RTT depuis La Réunion). Mumbai (`ap-south-1`) est la région la plus proche (~80-120ms RTT).
- [x] **Solution : Read Replica + Load Balancer** : Supabase Read Replica en `ap-south-1` (Mumbai) créée par l'utilisateur. Load balancer avec geo-routing activé.
- [x] **Migration config** : `EXPO_PUBLIC_SUPABASE_URL` changée de `nccjibufpzttcnqxgvhs.supabase.co` vers `nccjibufpzttcnqxgvhs-all.supabase.co` (endpoint load balancer avec geo-routing automatique).
- **Impact** : toutes les requêtes GET/SELECT (conversations, messages, profils, activités) sont automatiquement routées vers la réplique la plus proche. Les écritures et Realtime restent sur le Primary EU.
- **Fichiers modifiés** : `.env`, `eas.json`, `COMMANDE.txt`
- **Note** : Realtime (WebSocket pour messages live) ne supporte pas encore le multi-région chez Supabase — les updates optimistes déjà en place compensent cette limitation.

### Résumé des chantiers
| Phase | Chantier | Priorité | Status |
|-------|----------|----------|--------|
| 0 | retirer le système de paiement | — | Finished |
| 1 | Performance & Smoothness | Haute | Done |
| 2 | Tests pré-production | Haute | Done |
| 3 | Design & Identité visuelle | Moyenne | Foundations done (Opus) — application pending (Sonnet) |
| 4 | Lien +1 Deep Link | Haute (bloquant) | Code Done — device tests pending |
| 5 | Pages légales | Basse | Done ✅ |