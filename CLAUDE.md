# RealMeet

Application mobile de rencontres sociales par activités. Les utilisateurs s'inscrivent à des activités, sont répartis en groupes par affinité, et se retrouvent IRL.

## Stack technique

- **Client** : Expo / React Native (Expo Router v6)
- **Backend** : Supabase (PostgreSQL, Auth, Realtime, Storage, Edge Functions)
- **Serveur check-in** : Node.js / Express sur VPS OVH (checkin.realmeet.fr)
- **Carte** : MapLibre via WebView + Protomaps
- **Paiement** : Stripe (en cours d'intégration)
- **Notifications** : Expo Push Notifications
- **Animations** : react-native-reanimated

## Structure du projet

```
app/                    # Écrans (Expo Router file-based routing)
  (tabs)/               # Tab navigator (browse, chat, categories, activities, profile)
  auth/                 # Flow authentification (login, register, account-type)
  invite/[token].tsx    # Deep link invitation +1
components/             # Composants réutilisables
contexts/               # React Contexts (Auth, DataCache, TabIndex, Location, Widget)
services/               # Services métier (auth, user, invitation, phone-verification)
lib/                    # Config Supabase, database types, notifications
hooks/                  # Custom hooks
styles/                 # Styles partagés (commonStyles.ts)
diagrammes/             # Diagrammes Mermaid — SOURCE DE VÉRITÉ
supabase/               # Config Supabase locale, migrations, seed
realmeet-checkin/       # Serveur check-in Node.js (déployé sur VPS)
sql/                    # Scripts SQL manuels
```

## Diagrammes — Source de vérité (OBLIGATOIRE)

Les diagrammes dans `diagrammes/` sont la source de vérité du projet.

Toute modification impactant :
- un flow utilisateur
- une logique backend
- une structure de données
- une feature
- un état métier

DOIT être répercutée dans les diagrammes.

Une tâche n'est PAS terminée tant que les diagrammes ne sont pas synchronisés.

Les diagrammes de travail sont situés dans :
`diagrammes/domains/`

Les modifications doivent :
- être appliquées directement dans les fichiers (pas seulement proposées)
- utiliser les conventions de diff visuel (added / updated / removed)
- rester localisées au domaine concerné

| Fichier | Contenu | Quand le lire |
|---------|---------|---------------|
| `realmeet-user-flows.mermaid` | des parcours critiques (inscription, groupes, check-in, +1, social, ...) | Avant de toucher à un flow utilisateur |
| `realmeet-domain-flow.mermaid` | Carte des domaines + statut de chaque feature (✅/🔧/🔜) | Pour savoir ce qui est fait et ce qui reste |
| `realmeet-erd.md` | ERD macro + mini ERDs par feature + règles data. Pour le schéma complet, utiliser MCP Supabase. | Avant toute migration ou nouvelle RPC |

## Conventions de code

### Nommage
- **Tables SQL** : snake_case pluriel (`slot_participants`, `checkin_logs`)
- **RPC Supabase** : snake_case (`create_plus_one_invitation`, `form_groups_v3`)
- **Fonctions TS** : camelCase (`joinSlot`, `loadConversations`)
- **Composants React** : PascalCase (`InvitePlusOneModal`, `AddressAutocomplete`)
- **Services** : `nom.service.ts` avec classe exportée en singleton (`authService`, `userService`)

### Patterns obligatoires
- Toute RPC = `SECURITY DEFINER` avec vérification `auth.uid()` interne
- Tout INSERT/UPDATE sensible = via RPC (jamais de mutation directe côté client)
- RLS activé sur toutes les tables
- Animations = `react-native-reanimated` (pas Animated de React Native)
- Navigation = Expo Router `push` / `replace` (pas de `navigate`)
- Soft delete partout (pas de DELETE physique sur les données utilisateur)

### Gestion des timezones
- PostgreSQL stocke tout en UTC (`timestamptz`)
- Logique métier (groupes, check-in) = conversion en heure Paris (`Europe/Paris`)
- pg_cron tourne en UTC, les RPC convertissent

## Architecture des 5 flows critiques

### Flow 1 — Inscription activité + Paiement
`browse → activity-detail → payment/select-method → card-form → confirmation → INSERT slot_participants → conversation groupe`

### Flow 2 — Formation automatique de groupes
`pg_cron (15min) → process_slots_for_grouping_v3 → form_groups_v3 → slot_groups + slot_group_members → conversation auto + message système`

### Flow 3 — Check-in QR jour J
`App génère QR JWT → staff scanne → POST /api/checkin/verify → preview → POST /api/checkin/validate → UPDATE slot_participants.checked_in_at`

### Flow 4 — Invitation +1 Duo
`RPC create_plus_one_invitation → lien realmeet.fr/invite/token → deep link → validate_plus_one_token → accept_plus_one_invitation → INSERT slot_participants (is_plus_one: true)`

### Flow 5 — Cycle social
`Personnes rencontrées → demande d'ami → acceptation → conversation privée 1:1 | blocage → blocked_users`

## RPC principales

| Fonction | Tables | Usage |
|----------|--------|-------|
| `form_groups_v3` | slot_groups, slot_group_members, conversations | Formation de groupes par affinité |
| `get_my_conversations_v2` | conversations, messages, conversation_participants | Liste conversations optimisée (élimine N+1) |
| `create_plus_one_invitation` | plus_one_invitations | Créer une invitation +1 avec token |
| `validate_plus_one_token` | plus_one_invitations, activities, activity_slots | Valider et prévisualiser une invitation |
| `accept_plus_one_invitation` | slot_participants, plus_one_invitations | Accepter une invitation +1 |
| `process_slots_for_grouping_v3` | activity_slots | Identifier les créneaux éligibles au grouping |

## Serveur check-in (realmeet-checkin/)

Serveur Node.js/Express déployé sur VPS OVH derrière Nginx + SSL.
- URL : `checkin.realmeet.fr`
- Auth : JWT vérifié avec la clé Supabase
- Endpoints : `/api/checkin/verify` (scan QR) et `/api/checkin/validate` (confirmation)
- Sécurité : rate limiting, helmet, CORS, nonce anti-replay
- Process manager : PM2

## Fin de session

Avant de terminer une session de travail :
1. Mets à jour `task_plan.md` avec les phases terminées
2. Si un flow ou une feature a changé de statut, propose la mise à jour du diagramme `domain-flow`
3. Liste les fichiers modifiés et les éventuels impacts sur d'autres parties du code
4. Si le code est modifié mais que les diagrammes ne sont pas mis à jour, la tâche est considérée comme incomplète.