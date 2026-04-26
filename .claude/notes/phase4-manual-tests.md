# Phase 4 — Tests manuels Expo Go restants

Tout ce qui a pu être fait sans device a été corrigé dans le code. Les tests
ci-dessous nécessitent un téléphone réel + Expo Go (ou build dev) pour valider
le flow deep link complet.

## Pré-requis
- App installée (Expo Go ou dev build) sur iOS et Android
- VPS `realmeet.fr` qui sert `invite.html` sur la route `/invite/{token}`
- Compte hôte inscrit à un créneau (mode duo) → token frais en BDD
- Compte invité (différent du host) avec numéro non banni

## Cas à valider

### 1. Lien réel → app installée
1. L'hôte clique "Inviter +1" depuis `confirm-join` (mode duo) → un lien
   `https://realmeet.fr/invite/<token>` est généré.
2. Partager le lien sur WhatsApp/SMS vers le device de l'invité.
3. Tap sur le lien → ouvre Safari/Chrome → `invite.html` s'affiche → après
   ~800ms, redirige automatiquement vers `natively://invite/<token>`.
4. ✅ L'app s'ouvre directement sur l'écran preview de l'invitation.

### 2. Cas "app non installée"
- Vérifier que `invite.html` reste lisible si la redirection deep link échoue.
- Idéalement ajouter un fallback "Télécharger l'app" (TODO post-launch quand
  les liens stores existent).

### 3. Utilisateur non connecté
1. Logout sur l'app.
2. Tap sur lien invite → app s'ouvre sur écran "Invitation +1" → tap "Se
   connecter".
3. ✅ Le token est stocké en AsyncStorage (`@realmeet:pending_invite_token`).
4. Login → ✅ redirection automatique vers `/invite/<token>` (au lieu de
   `(tabs)/profile`).
5. Variante : depuis l'écran login, créer un nouveau compte via signup →
   ✅ même redirection auto après création du profil.

### 4. Token expiré (>10min)
1. Générer une invitation, attendre 11 minutes.
2. Tap sur le lien.
3. ✅ Écran "Invitation invalide" avec message "Cette invitation a expiré".
4. ✅ Bouton "Découvrir les activités" → redirige sur browse.

### 5. Utilisateur déjà inscrit au créneau
1. L'invité est déjà participant du slot ciblé.
2. Tap sur le lien → preview s'affiche → tap "Rejoindre l'activité" →
   `confirm-join` → tap "Rejoindre en +1".
3. ✅ Erreur traduite : "Vous êtes déjà inscrit à ce créneau" (code
   `ALREADY_PARTICIPANT` dans `invitation.service.translateError`).

### 6. Utilisateur tente d'accepter sa propre invitation
- ✅ Code `CANNOT_INVITE_SELF` géré, doit afficher : "Vous ne pouvez pas
  accepter votre propre invitation".

### 7. Slot complet entre validate et accept
- Difficile à reproduire manuellement. La RPC `accept_plus_one_invitation`
  doit retourner `SLOT_FULL` → message traduit OK.

### 8. Conversation groupe rejointe par le +1
- Après acceptation +1 réussie, l'invité doit voir la conversation du créneau
  apparaître dans `(tabs)/chat` (correctif appliqué dans `confirm-join.tsx` :
  `handleSlotGroup` est désormais appelé dans la branche +1).

### 9. iOS vs Android
- Vérifier que `natively://invite/<token>` fonctionne sur les deux.
- Sur iOS, la première redirection peut nécessiter un tap sur "Ouvrir dans
  RealMeet" (Safari bloque les auto-redirections cross-scheme).
- Sur Android, vérifier qu'il n'y a pas de Disambiguation Dialog avec d'autres
  apps qui captureraient `natively://`.

## Notes scheme
- L'app expose le scheme `natively` (cf. `app.json:52`). À renommer en
  `realmeet` post-launch + mettre à jour `invite.html` en conséquence.
- Le bundle id est `realmeet.entreprise` mais le slug Expo est `Natively`.
  Cohérence à revoir avant publication stores.

## Bugs corrigés en phase 4 (sans device)
1. `app/invite/[token].tsx:142` — token désormais persisté en AsyncStorage via
   `setPendingInviteToken` avant redirect login.
2. `app/auth/login.tsx` — restauration du token pending via
   `consumePendingInviteToken`, redirect automatique vers `/invite/<token>`
   après authentification réussie.
3. `app/auth/signup-individual.tsx` — même restauration après création de
   compte (pour les invités qui n'ont pas encore de compte RealMeet).
4. `app/confirm-join.tsx:169` — la branche +1 appelait `acceptInvitation`
   mais n'ajoutait pas l'utilisateur à la conversation du groupe du créneau.
   `handleSlotGroup(acceptedSlotId)` est désormais appelé après acceptation.
5. Helper partagé créé : `lib/pendingInvite.ts`.
