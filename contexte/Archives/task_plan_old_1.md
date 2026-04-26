# Task Plan: RealMeet — Pre-Launch Sprint

## Goal
Préparer RealMeet pour le lancement en production. 6 chantiers parallèles à finaliser.

## Phases

### Phase 0 : retirer le système de paiement ✅

- [x] on va rentrer dans un système où les gens ne paient pas à l'avance
- [x] les gens vont juste avoir un ordre de prix que ça coutera.
- [x] pas de stripe
- [x] Ce sera basé sur du show / no-show : système de QR CODE pour justifier de la présence
- [x] Si la personne ne vient pas 2 fois (2 pénalités), alors il est banni (compte associé au numéro de téléphone)
- [x] Si la personne annule 24h avant : c'est ok et pas de pénalité.
- [x] Diagrammes synchronisés (user-flows, domain-flow, ERD, domaines)
- [x] CLAUDE.md mis à jour (Flow 1 + nouvelles RPCs)

### Phase 1: Performance & Smoothness ✅
- [x] A1: Memoize DataCacheContext provider value (useMemo sur contextValue)
- [x] A2: Remplacer JSON.stringify par shallow comparison dans browse.tsx
- [x] A3: Stabiliser la subscription Realtime (ref pour blockedUserIds)
- [x] A4: React.memo sur ActivityCard avec comparateur custom
- [x] A5: Extraire ChatItem au scope module + React.memo
- [x] A6: Convertir browse.tsx de .map() à FlatList virtualisée
- [x] A7: Props de perf sur tous les FlatList (activity, blocked-users, met-people, friend-requests, business-group-view)
- [x] B1: Migration expo-image sur 24 fichiers + placeholder local + suppression via.placeholder.com
- [x] B2: Convertir chat.tsx conversations en FlatList (all/friends filters)
- [x] B3: Debounce 500ms du postMessage location vers WebView
- [x] C1: Clustering des marqueurs MapLibre avec supercluster
- [x] C2: React.memo sur FloatingTabBar TabItem + useCallback handleTabPress + useMemo tabPressHandlers
**Fichiers concernés** : contexts/DataCacheContext.tsx, app/(tabs)/*.tsx, components/*.tsx, 24 fichiers pour expo-image
**Flows impactés** : Tous (smoothness générale)
**Status** : DONE

### Phase 2: Tests pré-production ✅
- [x] Tests du Flow 1 complet (inscription → paiement → conversation groupe)
- [x] Tests du Flow 2 (formation de groupes — vérifier pg_cron + form_groups_v3)
- [x] Tests du Flow 3 (check-in QR — scan → verify → validate sur checkin.realmeet.fr)
- [x] Tests du Flow 4 (invitation +1 — création → lien → deep link → acceptation)
- [x] Tests du Flow 5 (social — demande ami → acceptation → chat privé → block)
- [x] Tests auth (inscription, login, session refresh, logout)
- [x] Tests edge cases (réseau lent, double-tap, back navigation, token expiré)
- [x] Vérifier les RLS policies sur toutes les tables — audit complet + hardening (45 fonctions, 3 migrations critiques)
- [x] Diagrammes synchronisés (groups-chat.mermaid, social.mermaid, CHANGELOG-DIAGRAMS.md créé)
**Fichiers concernés** : Tous les flows, services/*.service.ts, RPC Supabase
**Flows impactés** : Flow 1-5
**Status** : DONE ✅

### Phase 3: Design & Identité visuelle
- [x] Définir la DA RealMeet (palette, typographie, spacing, border-radius, motion, opacity, zIndex, hitSlop, layout) — fait avec Opus
- [x] Refactorer commonStyles.ts avec les nouveaux tokens de design — fait avec Opus (fontFamily Manrope canonisé, motion tokens Reanimated, typographyPresets, theme groupé, alignement React Navigation theme dans `_layout.tsx`)
- [x] Retravailler les animations (transitions écrans, micro-interactions boutons) — pressScale sur boutons confirm-join + send chat
- [x] Ajouter des animations de feedback (like, inscription réussie, envoi message) — success animation Reanimated (confirm-join + StepSuccess), send button pressScale
- [x] Revoir les cartes d'activité (ombres, images, layout) — cartes déjà polished (ActivityCard.tsx), pas de modification nécessaire
- [x] Rendre le tab bar plus distinctif — Manrope 700 label actif, Manrope 500 inactif, indicateur orange-teinté
- [x] Harmoniser les modals et bottom sheets — scrim DA sur tous les backdrops, animation Reanimated dans LeaveReviewModal
- [x] S'assurer de la cohérence dark mode si applicable — light theme intentionnel (DA chaleureux sobre)
**Fichiers concernés** : styles/commonStyles.ts, app/_layout.tsx, components/*.tsx, app/(tabs)/*.tsx
**Flows impactés** : Tous (visuel)
**Status** : DONE ✅
**Migrations Animated → Reanimated** : confirm-join.tsx, StepSuccess.tsx, CheckinQRSection.tsx, CheckinQRCode.tsx, LeaveReviewModal.tsx, ReviewsCarousel.tsx, chat.tsx (dead import supprimé)

### Phase 4: Lien +1 (Deep Link) ✅ (code) — tests device en attente
- [x] Audit du flow complet (création → invite.html → preview → confirm-join → accept)
- [x] Vérifier invite.html (scheme `natively://invite/<token>`, cohérent avec app.json)
- [x] Bug corrigé : utilisateur non connecté → token désormais persisté en AsyncStorage (`lib/pendingInvite.ts`) et restauré après login/signup → redirect auto vers `/invite/<token>`
- [x] Cas "token expiré" : géré par `validate_plus_one_token` + countdown temps réel + message traduit
- [x] Cas "utilisateur déjà inscrit" : géré via code `ALREADY_PARTICIPANT` traduit dans `invitation.service`
- [x] Bug corrigé : flow +1 ne rejoignait pas la conversation du groupe du créneau (`confirm-join.tsx` appelle désormais `handleSlotGroup` dans la branche +1)
- [x] Note flow paiement duo : OBSOLÈTE (paiement retiré en phase 0, mode duo conserve uniquement le lien d'invitation 10 min)
- [ ] **À tester sur device réel** : voir `.claude/notes/phase4-manual-tests.md`
**Fichiers concernés** : app/invite/[token].tsx, app/auth/login.tsx, app/auth/signup-individual.tsx, app/confirm-join.tsx, lib/pendingInvite.ts (NEW), services/invitation.service.ts, invite.html (VPS)
**Flows impactés** : Flow 4
**Diagramme** : realmeet-user-flows.mermaid > FLOW4
**Status** : DONE (code) — manual device tests pending
**Notes** : Tous les fixes possibles sans device sont appliqués. Tests Expo Go restants documentés dans `.claude/notes/phase4-manual-tests.md`.

### Phase 5: Pages légales & administratives ✅
- [x] Vérifier que terms-of-use.tsx est complet et à jour (supprimé refs paiement/Stripe/CGV, ajouté article 11 no-show/pénalités/QR)
- [x] Vérifier que privacy-policy.tsx est complet et à jour (réécriture complète RGPD : 12 sections, bases légales, durées conservation, sous-traitants, droits, CNIL)
- [x] Créer la page "À propos" (app/about.tsx créée)
- [x] Vérifier/mettre à jour "Aide & Support" (FAQ actualisée pour modèle gratuit, ajout FAQ no-show et QR, liens vers about + mentions légales)
- [x] Vérifier que les liens vers ces pages sont accessibles depuis le profil/settings (ajout liens "À propos" et "Mentions légales" dans settings.tsx)
- [x] Mentions légales (app/legal-mentions.tsx créée : éditeur, hébergeurs Supabase/OVH/Expo, propriété intellectuelle, CNIL)
**Fichiers concernés** : app/terms-of-use.tsx, app/privacy-policy.tsx, app/about.tsx, app/help-support.tsx, app/legal-mentions.tsx, app/settings.tsx
**Flows impactés** : Aucun flow critique
**Status** : DONE ✅
**Notes** : Email uniformisé à contact@realmeet.fr partout. privacy-policy.tsx passé de 5 sections superficielles à 12 sections conformes RGPD.

## Decisions Made
- (aucune pour l'instant)

## Errors Encountered
- (aucune pour l'instant)

## Status
**Phase actuelle** : Phases 3, 4, 5 DONE ✅
**Prochaines étapes** : Tests device Phase 4 (+1 deep link) + activer leaked_password_protection (auth dashboard)