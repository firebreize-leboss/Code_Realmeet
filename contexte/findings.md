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
  
## Phase 5 — Pages légales (2026-04-08)

### Pages légales — État final
- `app/terms-of-use.tsx` : CGU complètes, 18 articles, modèle gratuit + no-show/pénalités
- `app/privacy-policy.tsx` : Politique de confidentialité RGPD, 12 sections complètes
- `app/help-support.tsx` : FAQ actualisée (6 questions), liens vers toutes les pages légales
- `app/about.tsx` : CRÉÉE — concept, fonctionnement, liens
- `app/legal-mentions.tsx` : CRÉÉE — mentions légales LCEN complètes
- `app/settings.tsx` : Section "À propos" avec 5 liens (aide, à propos, CGU, confidentialité, mentions légales)

### Email uniformisé
- Tout est sur `contact@realmeet.fr` (ancien `realmeet.france@gmail.com` supprimé de privacy-policy)

### Note : BodyScrollView.tsx corrompu
- Le fichier `components/BodyScrollView.tsx` contient une commande bash au lieu de code TypeScript. Erreur pré-existante, non liée à la phase 5.

## Phase finale debuggage (2026-04-22)

### RPC validate_plus_one_token améliorée
- Ajout de `auth.uid()` check pour détecter auto-invitation et participation existante
- Les erreurs sont maintenant détectées dès la validation du token (avant la page confirm-join)
- La page confirm-join (+1) affiche le même contenu que l'inscription solo (prix estimé + rappel pénalités + "à régler sur place")

### InterestSelector
- Dédoublonnage défensif ajouté à 2 niveaux : chargement profil + toggleInterest
- Chips sélectionnés dans le picker modal ont maintenant une icône checkmark visible

## Phase finale test — Formation de groupes (2026-04-22)

### 8 cas de test exécutés sur `form_groups_v3`

| # | Scénario | Participants | per_group | min | Résultat attendu | Résultat | Status |
|---|----------|-------------|-----------|-----|-------------------|----------|--------|
| 1 | 2 clusters affinité | 6 (3 sport + 3 musique) | 3 | 4 | 2 groupes par affinité | 2 groupes (3+3), sport/musique séparés | PASS |
| 2 | Sous le minimum | 2 | 5 | 4 | Annulation | Annulé (insufficient_participants) | PASS |
| 3 | Duo +1 | 8 (1 duo inclus) | 4 | 4 | Duo dans le même groupe | 2 groupes (4+4), duo ensemble | PASS |
| 4 | Tous dans 1 groupe | 4 | 5 | 4 | 1 seul groupe de 4 | 1 groupe de 4 | PASS |
| 5 | Distribution impaire | 7 | 3 | 3 | 2 groupes (4+3) | **BUG trouvé** → 3 groupes (3+2+2) | FAIL → FIX |
| 6 | max_groups cap | 10 | 3 | 3 | 2 groupes de 5 (cap max_groups=2) | 2 groupes (5+5) | PASS |
| 7 | Intérêts identiques | 6 (tous même intérêts) | 3 | 3 | 2 groupes équilibrés | 2 groupes (3+3) | PASS |
| 8 | Aucun intérêt | 6 (interests=[]) | 3 | 3 | 2 groupes équilibrés | 2 groupes (3+3) | PASS |

### Bug trouvé et corrigé (Test 5)
- **Problème** : `CEIL(7/3) = 3` groupes → tailles 3+2+2, mais `min_participants_per_group=3` violé pour 2 groupes
- **Cause** : le rééquilibrage ne pouvait pas corriger car le plus grand groupe (3) ne pouvait pas céder de membre sans passer sous le minimum
- **Fix** : migration `fix_form_groups_v3_num_groups_floor` — ajout d'un WHILE loop après CEIL pour réduire `num_groups` quand `total/num_groups < min_per_group`
- **Vérification** : test 5 re-exécuté après fix → 2 groupes (4+3), PASS

## Phase finale changements finaux (2026-04-22)

### Waveform audio — Architecture
- **Metering** : expo-av supporte `isMeteringEnabled: true` dans les options d'enregistrement + callback `onRecordingStatusUpdate` avec `status.metering` (valeur en dB, -160 à 0)
- **Normalisation** : plage pratique -50 dB à 0 dB, normalisé en 0.05-1.0
- **Waveform déterministe** : pour les messages stockés, une fonction de hash génère une forme en cloche naturelle à partir du message ID (pas besoin de stocker les données audio)
- **Progression lecture** : `Audio.Sound` avec `progressUpdateIntervalMillis: 80ms` + callback `setOnPlaybackStatusUpdate` pour `positionMillis/durationMillis`
- **Composant** : `VoiceWaveform.tsx` — 20 barres de 3px, gap 2px, hauteur 4-22px, remplissage progressif barre par barre

### Tab Catégories
- Retiré des deux configs (user 5→4, business 5→4). La page `app/(tabs)/category.tsx` reste accessible via navigation directe si besoin.

## Phase finale — Réduction des lags (2026-04-22)

### Architecture multi-région Supabase
- **Primary** : AWS EU (IPv6 `2a05:d018:*`)
- **Read Replica** : `ap-south-1` (Mumbai) — créée via dashboard Supabase
- **Load Balancer** : `nccjibufpzttcnqxgvhs-all.supabase.co` — geo-routing automatique
  - GET requests → routées vers la DB la plus proche (Mumbai pour La Réunion)
  - Non-GET requests → routées vers Primary (EU)
  - Auth → toujours Primary
  - Realtime → toujours Primary (limitation Supabase)
- **Latence estimée** : La Réunion → Mumbai ~80-120ms (vs ~180-250ms vers EU)

### Limitations connues
- Supabase Realtime (WebSocket `postgres_changes`) ne supporte pas le multi-région — les messages live transitent toujours par le Primary EU
- Les updates optimistes côté client compensent : l'utilisateur voit son message immédiatement
- Le replication lag (Primary → Replica) est généralement < 1s, acceptable pour des reads

### Prérequis Read Replica
- Plan Pro minimum ✅
- Small compute add-on minimum ✅
- AWS ✅
- Postgres 15+ (17) ✅

## Phase finale — Debuggage compteur + centrage carte (2026-04-25)

### Bug compteur participants (`ActivityCalendar`)
- **Cause** : `cancel_slot_participation` met `slot_participants.status = 'cancelled'` mais ne touche pas `slot_group_members`. Idem pour `detect_no_shows` qui passe les participants à `completed`. Les loaders du calendrier additionnaient les deux sources avec dédoublonnage par `(user_id, slot_id)`, donc tout user post-formation qui annulait/no-showait restait compté.
- **Vérification** : 3 slots passés (2026-04-20, 21, 24) avaient `active_participants=0` mais `slot_group_members` retournait 5–6 utilisateurs. Le calendrier affichait `5/X` au lieu de `0/X`.
- **Fix** : la source de vérité du calendrier est désormais `slot_participants WHERE status='active'` uniquement, dans les deux modes (`edit` business et `select` user). `slot_group_members` reste utile pour la formation/affichage des groupes mais ne sert plus pour le compteur d'inscrits.

### Centrage automatique Maps
- Priorité de centre : (1) `userLocation` (`useLocation` — géoloc instantanée), (2) ville `profile.city` géocodée via Nominatim (`geocodingService.geocodeAddress`) et mise en cache dans un state de session, (3) première activité visible (comportement précédent).
- Le géocodage de la ville profil ne s'exécute qu'une fois par session (ref `profileCityGeocodedRef`) pour ne pas spammer Nominatim.
- Le centrage WebView est appliqué à 3 endroits cohérents : (a) `loadActivities` (charge initial du jeu d'activités, prend `preferredCenter` en fallback), (b) `centerOnUser` button (utilise `profileCityCoords` quand `userLocation` est null), (c) effet ré-actif quand l'utilisateur ouvre la carte → envoie un `centerOnUser` postMessage avec le centre préféré.
- Les coordonnées de la ville profil sont uniquement *centrage* — aucun marker user n'est dessiné dessus (réservé à la vraie géoloc).

## Phase finale — Mise en pause QR check-in (2026-04-24)

### Décision
Feature QR check-in désormais **opt-in par activité** via flag `activities.requires_checkin boolean NOT NULL DEFAULT false`. Le code et l'infra (VPS checkin.realmeet.fr, JWT, `useCheckinQR`, `CheckinQRSection`, `CheckinQRCode`, endpoints `/api/checkin/verify`/`/api/checkin/validate`) sont intacts mais ne s'activent que si l'organisateur a coché le toggle sur l'activité.

### Changements clés
- **DB** : migration `add_requires_checkin_flag_and_gate_no_shows` — nouvelle colonne + `detect_no_shows` filtre `WHERE a.requires_checkin = true` pour la création de pénalités. Le passage `active → completed` reste automatique pour tous les slots terminés (indépendant du flag), donc la logique review continue de marcher.
- **Pénalités** : aucune pénalité `no_show` ne peut être créée si `requires_checkin = false`. Le bannissement à 2 strikes reste en place pour les activités opt-in.
- **UI inscrit** : sur `app/activity-detail.tsx`, bloc vert simple "Vous êtes inscrit !" quand le flag est off, `<CheckinQRSection>` classique sinon. Bouton "Inviter un ami (+1)" conservé dans les deux cas (non lié au check-in).
- **Formulaires** : `Switch` RN natif (slide gauche/droite, trackColor orange primary quand on, off par défaut) avec helper text "À réserver aux activités payantes où la présence est critique". Ajouté sur `create-activity.tsx` et `edit-activity.tsx`.

### Points d'attention
- Le serveur check-in `realmeet-checkin/` n'a pas été touché : il reste en place, mais n'est sollicité que par les activités qui activent le flag. Si plus tard on voulait totalement désarmer le QR (ex. endpoint `/generate-token` côté Supabase), ce serait un cran supplémentaire de pause.
- `CheckinQRSection` et `CheckinQRCode` sont toujours importés dans `activity-detail.tsx` — volontairement, pour ne pas casser la feature quand elle est réactivée.
- Le bloc "Vous êtes inscrit !" formate la date via `toLocaleDateString('fr-FR')`. Si jamais `selectedSlot.date` arrive dans un format non-ISO, il y a un fallback sur la string brute.

## À investiguer
- Performance réelle sur device Android bas de gamme
- État du deep link sur iOS vs Android (schemes différents ?)
- BodyScrollView.tsx à corriger (contenu corrompu)

## Phase 3 — Fondations DA (2026-04-08, Opus)

### Décisions DA actées
- **Police officielle** : Manrope (déjà chargée dans `app/_layout.tsx` via `@expo-google-fonts/manrope`). Canonisée via `fontFamily.{regular,medium,semibold,bold}`. À appliquer partout.
- **Couleur primaire** : `#F2994A` (orange premium intermédiaire). PAS de couleur secondaire — orange seul comme guide visuel. Confirmation : c'était déjà la palette en place, on conserve.
- **Conflit corrigé** : `app/_layout.tsx` définissait un `CustomDefaultTheme` React Navigation avec `primary: rgb(255, 107, 157)` (coral pink #FF6B9D) — incohérent avec la DA. Réaligné sur `colors.primary` du commonStyles.
- **7 principes de design** documentés en tête de `styles/commonStyles.ts` (chaleureux mais sobre, whitespace généreux, typo expressive, animations sensibles, profondeur subtile, rayons généreux, accessibilité).

### Nouveaux tokens ajoutés (sans casser l'existant)
| Token | Description |
|-------|-------------|
| `fontFamily` | 4 graisses Manrope canoniques |
| `letterSpacing` | tighter / tight / normal / wide / wider / widest |
| `typographyPresets` | 14 presets prêts à l'emploi (display, heading1-4, subtitle, body*, caption, label, buttonLabel, link) |
| `motion.duration` | instant/fast/base/slow/slower/page (100→480ms) |
| `motion.easing` | standard, decelerate, accelerate, sharp, emphasized (Reanimated `Easing.bezier`) |
| `motion.spring` | snappy / gentle / bouncy / stiff (configs `withSpring`) |
| `motion.pressScale` | subtle/normal/strong (0.94→0.98) |
| `opacity` | disabled/pressed/inactive/hover/full |
| `zIndex` | base→topmost (9 niveaux canoniques) |
| `hitSlop` | sm/md/lg/xl pour accessibilité tactile |
| `layout` | maxContentWidth, inputHeight, buttonHeight, tabBarHeight, headerHeight, minTouchTarget |
| `shadows.primaryGlow` | Ombre orange subtile pour CTA hero |
| `shadows.none` | Pour reset explicite |
| `borderRadius.{none,xs,xxxl}` | Compléments d'échelle |
| `spacing.{xxs,xxxxxl}` | Compléments d'échelle |
| `theme` | Export groupé pour `import { theme }` partout |

### Backwards compat
- TOUS les tokens existants restent accessibles avec leur nom et valeur d'origine. Les 50+ fichiers qui importent `colors`, `typography`, `spacing`, `borderRadius`, `shadows`, `commonStyles` continuent de fonctionner sans modification.
- Les styles `commonStyles.{title,subtitle,heading,text,...}` sont enrichis avec `fontFamily` Manrope (au lieu de la font système) — changement visuel mais pas de breaking API.

### Phase 3 — Animations & Design (2026-04-08, Sonnet)

#### Migrations Animated (RN) → Reanimated terminées
- `app/confirm-join.tsx` : success animation migrated + pressScale bouton confirmer
- `components/signup/steps/StepSuccess.tsx` : 3 animations migrées (scale, fade, slide)
- `components/CheckinQRSection.tsx` : entrance animation migrated
- `components/CheckinQRCode.tsx` : entrance animation migrated
- `components/LeaveReviewModal.tsx` : slide-in content animation migrated + scrim DA
- `components/ReviewsCarousel.tsx` : cross-fade autoscroll migrated (runOnJS + currentIndexRef pattern)
- `app/(tabs)/chat.tsx` : dead import `Animated as RNAnimated` supprimé

#### FloatingTabBar amélioré
- Label actif : `Manrope_700Bold` (était `fontWeight: '600'` sans fontFamily)
- Label inactif : `Manrope_500Medium` canonisé
- Indicateur glissant : `rgba(242, 153, 74, 0.13)` (orange-teinté DA) au lieu de blanc translucide

#### Harmonisation modals
- Tous les backdrops maintenant sur `colors.scrim = 'rgba(28, 28, 30, 0.55)'`
- `InvitePlusOneModal`, `ReportModal`, `LeaveReviewModal` harmonisés

#### chat-detail.tsx
- Bouton envoi : pressScale Reanimated (`motion.scale.press` / `motion.spring.snappy`)

#### Note sur les cartes d'activité
- `ActivityCard.tsx` déjà très polished (4 variants, animations spring, Manrope). Pas de modification nécessaire.

## Phase 4 — Deep Link +1 (2026-04-08)

### Bugs trouvés en lecture de code et corrigés
1. **Token perdu après login** : `app/invite/[token].tsx:142` faisait
   `router.push('/auth/login')` avec un commentaire "Stocker le token..." mais
   ne stockait rien. Le user authentifié se retrouvait sur `(tabs)/profile`
   au lieu de retourner à l'invitation.
   - ✅ Helper créé : `lib/pendingInvite.ts` (set/consume via AsyncStorage,
     clé `@realmeet:pending_invite_token`).
   - ✅ `app/auth/login.tsx` : check `consumePendingInviteToken` après auth
     réussie, redirect vers `/invite/<token>` si présent.
   - ✅ `app/auth/signup-individual.tsx` : même restauration après création
     de compte (cas où l'invité n'a pas encore de compte RealMeet).

2. **+1 ne rejoignait pas la conversation groupe** : la branche `isPlusOne`
   de `confirm-join.tsx:169` appelait `acceptInvitation` mais sautait
   `handleSlotGroup` (qui ajoute l'user à la conv groupe + envoie un message
   système). L'invité +1 était inscrit au slot mais invisible dans la conv.
   - ✅ Fix : appel à `handleSlotGroup(result.slotId || slotId)` après succès.

3. **Tâche obsolète** : "Vérifier le flow paiement duo (host_pays /
   guest_pays)" — paiement Stripe retiré en phase 0. Le mode duo conserve
   uniquement le mécanisme de lien 10 minutes.

### Tests device restants
Documentés dans `.claude/notes/phase4-manual-tests.md` (9 cas de test
nécessitant Expo Go + téléphone réel iOS/Android).

### Notes scheme
- App scheme : `natively` (cf. `app.json:52`).
- `invite.html` redirect vers `natively://invite/<token>` → cohérent.
- À renommer en `realmeet` post-launch + bundle id à harmoniser
  (`realmeet.entreprise` vs slug Expo `Natively`).

## Phase 1 — Problèmes visuels (2026-04-09)

### Correctifs visuels
1. **FloatingTabBar** (`components/FloatingTabBar.tsx`) : l'indicateur orange
   était calé à gauche du slot (left: 8) avec une largeur `(100/n) - 3 %`,
   donc visuellement décalé. Refactor pour calculer `tabWidth`,
   `indicatorWidthPx = tabWidth - 8` et positionner `left: 12` → centré
   pixel-perfect sur chaque icône/label.
2. **profile.tsx** : suppression du bloc "DEV - tester un lien invitation"
   (JSX + styles + import TextInput + state). Stats refaites en inline
   (value + label + chevron, sans carte blanche pleine largeur).
   Label dynamique : `Activité faite` / `Activités faites`. Bio et
   intérêts affichés en blocs texte épurés avec label majuscule orange,
   plus de cartes blanches.
3. **business-profile.tsx** : `activityTitle` et `activityMetaText`
   passés en blanc + textShadow (la carte utilise une image avec
   overlay dégradé sombre, donc le noir était invisible). Icônes
   `calendar` / `person.2.fill` passées en blanc aussi.
4. **chat.tsx** : badge "Terminée" / "Annulée" désormais avec icône
   (`checkmark.circle.fill` / `xmark.circle.fill`) dans un mini badge
   teinté.
5. **RealMeetAlertModal** (nouveau composant) : modal brandé avec
   header "REALMEET" orange, icône teintée, gradient CTA, support
   optional secondary button.
6. **useCancellationCheck** / **useActivityCancellationListener** :
   refactorés pour exposer un état `{alert, dismiss(, viewDetails)}`
   au lieu d'appeler `Alert.alert`. `(tabs)/_layout.tsx` rend deux
   `RealMeetAlertModal` avec les états de ces hooks.
7. **InterestSelector** : réécriture complète. Avant : grille de 32
   interests pleine page. Après : chips sélectionnées inline + bouton
   "+ Ajouter" qui ouvre un bottom-sheet modal avec search + grille
   compacte. API inchangée (selectedInterests/onInterestsChange/
   maxSelection) → compat signup-individual + edit-profile.
8. **IconSymbol** : ajouts de mappings `xmark.circle.fill` → cancel,
   `calendar.badge.exclamationmark` → event-busy.

### Fichiers modifiés phase 1
- `components/FloatingTabBar.tsx`
- `app/(tabs)/profile.tsx`
- `app/business-profile.tsx`
- `app/(tabs)/chat.tsx`
- `app/(tabs)/_layout.tsx`
- `hooks/useCancellationCheck.ts`
- `hooks/useActivityCancellationListener.ts`
- `components/InterestSelector.tsx`
- `components/IconSymbol.tsx`

### Fichiers créés phase 1
- `components/RealMeetAlertModal.tsx`