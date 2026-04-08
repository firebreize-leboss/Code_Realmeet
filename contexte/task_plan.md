# Task Plan: RealMeet — Pre-Launch Sprint

## Goal
Préparer RealMeet pour le lancement en production. 6 chantiers parallèles à finaliser.

## Phases

### Phase 0 : retirer le système de paiement

- [ ] on va rentrer dans un système où les gens ne paient pas à l'avance
- [ ] les gens vont juste avoir un ordre de prix que ça coutera.
- [ ] pas de stripe
- [ ] Ce sera basé sur du show / no-show : système de QR CODE pour justifier de la présence
- [ ] Si la personne ne vient pas 2 fois (2 pénalités), alors il est banni (compte associé au numéro de téléphone)
- [ ] Si la personne annule 24h avant : c'est ok et pas de pénalité.

### Phase 1: Performance & Smoothness
- [ ] Auditer les re-renders inutiles (React DevTools profiler)
- [ ] Optimiser les FlatList (windowSize, maxToRenderPerBatch, removeClippedSubviews)
- [ ] Vérifier le lazy loading des images (cache + placeholder)
- [ ] Profiler les requêtes Supabase lentes (RPC, joins N+1 restants)
- [ ] Tester la fluidité des transitions entre écrans (Expo Router)
- [ ] Optimiser le chargement initial (splash → premier écran interactif)
- [ ] Vérifier les performances de la carte MapLibre (tuiles, markers clustering)
- [ ] S'assurer que DataCacheContext ne trigger pas de renders en cascade
**Fichiers concernés** : contexts/DataCacheContext.tsx, app/(tabs)/*.tsx, composants avec FlatList
**Flows impactés** : Tous (smoothness générale)
**Status** : NOT STARTED

### Phase 2: Tests pré-production
- [ ] Tests du Flow 1 complet (inscription → paiement → conversation groupe)
- [ ] Tests du Flow 2 (formation de groupes — vérifier pg_cron + form_groups_v3)
- [ ] Tests du Flow 3 (check-in QR — scan → verify → validate sur checkin.realmeet.fr)
- [ ] Tests du Flow 4 (invitation +1 — création → lien → deep link → acceptation)
- [ ] Tests du Flow 5 (social — demande ami → acceptation → chat privé → block)
- [ ] Tests auth (inscription, login, session refresh, logout)
- [ ] Tests edge cases (réseau lent, double-tap, back navigation, token expiré)
- [ ] Vérifier les RLS policies sur toutes les tables
**Fichiers concernés** : Tous les flows, services/*.service.ts, RPC Supabase
**Flows impactés** : Flow 1-5
**Status** : NOT STARTED

### Phase 3: Design & Identité visuelle
- [ ] Définir la DA RealMeet (palette, typographie, spacing, border-radius)
- [ ] Refactorer commonStyles.ts avec les nouveaux tokens de design
- [ ] Retravailler les animations (transitions écrans, micro-interactions boutons)
- [ ] Ajouter des animations de feedback (like, inscription réussie, envoi message)
- [ ] Revoir les cartes d'activité (ombres, images, layout)
- [ ] Rendre le tab bar plus distinctif
- [ ] Harmoniser les modals et bottom sheets
- [ ] S'assurer de la cohérence dark mode si applicable
**Fichiers concernés** : styles/commonStyles.ts, components/*.tsx, app/(tabs)/*.tsx
**Flows impactés** : Tous (visuel)
**Status** : NOT STARTED

### Phase 4: Lien +1 (Deep Link)
- [ ] Tester le flow complet : création lien → partage → ouverture dans navigateur → redirect deep link → app
- [ ] Vérifier invite.html sur VPS (redirect vers le bon scheme)
- [ ] Tester le cas "utilisateur non connecté" (redirect login → retour invite)
- [ ] Tester le cas "token expiré" (message d'erreur clair)
- [ ] Tester le cas "utilisateur déjà inscrit au créneau"
- [ ] Vérifier le flow paiement duo (host_pays / guest_pays)
- [ ] Tester sur iOS et Android réels
**Fichiers concernés** : app/invite/[token].tsx, services/invitation.service.ts, invite.html (VPS)
**Flows impactés** : Flow 4
**Diagramme** : realmeet-user-flows.mermaid > FLOW4
**Status** : NOT STARTED

### Phase 5: Pages légales & administratives
- [ ] Vérifier que terms-of-use.tsx est complet et à jour
- [ ] Vérifier que privacy-policy.tsx est complet et à jour
- [ ] Créer la page "À propos" si pas encore faite
- [ ] Créer la page "Aide & Support" (contact@realmeet.fr)
- [ ] Vérifier que les liens vers ces pages sont accessibles depuis le profil/settings
- [ ] Mentions légales (éditeur, hébergeur, CNIL)
**Fichiers concernés** : app/terms-of-use.tsx, app/privacy-policy.tsx, app/about.tsx, app/help-support.tsx
**Flows impactés** : Aucun flow critique
**Status** : NOT STARTED

## Decisions Made
- (aucune pour l'instant)

## Errors Encountered
- (aucune pour l'instant)

## Status
**Phase actuelle** : Planification terminée, prêt à démarrer Phase 1 ou Phase 4
**Ordre recommandé** : Phase 4 (rapide, bloquant) → Phase 1 (fondamental) → Phase 2 (validation) → Phase 3 (polish) → Phase 5 (administratif)