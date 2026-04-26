# Task Plan: RealMeet — Pre-Launch Sprint

## Goal
Paufinner et rendre le produit prêt pour le lancement une bonne fois pour toute.

## Phases

### Phase finale : debuggage

- [x] quand on veut edit le profil, et que l'on veut change des tags de centres d'intérêts, dans la liste que l'on peut dérouler on a pas de cocher les centres d'intérêts déjà choisit. Donc ça nous permet de sélectionner 2 fois un même centre d'intérêt (problèmatique)
- [x] Quand je clique sur  nouvelle conversation pour voir la liste des gens, le temps entre lequel je clique sur quelqu'un pour lancer cette discussion et le temps où la discussion s'affiche, il doit y avoir 2 secondes. Sur ce laps de temps, je peux spammer ce même bouton, et ça m'ouvre au final plusieurs fois la même page. Optimiser le temps de transition au maximum, et EMPECHER le multiple appui sur ce bouton.
- [x] Quand on veut écrire un message à quelqu'un d'invitation, le clavier qui s'ouvre cache quasiment tout le widget et on ne voit pas ce que l'on écrit. A corriger.
- [x] Quand on a un lien de +1 et que l'on clique dessus, ça nous redirige bien sur l'app. Cependant, si test@gmail.com a initié ce lien et clique lui-même dessus, ça ne dit rien alors que ça ne devrait pas marcher vu qu'il est déjà inscrit, et surtout qu'il est l'initiateur. Aussi, même si je prend un autre compte et clique dessus, quand je clique sur rejoindre l'activité, ça me remet la page de paiement alors que l'on avait dit que l'on payait plus sur l'app. Donc à la place, mettre une page similaire à quand on veut s'inscrire seul, avec simplement l'indication du prix et les rappels sur les pénalités !

### Phase finale : test

- [x] Testes la logique de fonctionnement de création de groupes — 8 cas testés, 1 bug trouvé et corrigé (migration `fix_form_groups_v3_num_groups_floor`)

### Phase finale : changements finaux :
- [x] Enleves la partie catégorie de la navbar
- [x] Enleves la partie dev tester un lien invitation de la partie profil (déjà fait en Phase 1)
- [x] Quand on envoie des vocaux, regardes la faisabilité de faire les sortes de barres vertical qui se module en fonction de l'intensité de la voix, comme sur insta. Aussi, quand on lit un vocal, que ce ces barres se remplissent de couleur comme pour signifier l'avancée du vocal (entièrement rempli quand on a atteint la fin du vocal)
- [x] Dans paramètres, enlèves la catégorie "PREFERENCE". Et enlève aussi le paramètre "confidentialité".


## Decisions Made
- Suppression de l'overload `create_direct_conversation(uuid)` pour résoudre l'ambiguïté PostgREST — la version avec `p_friend_request_id DEFAULT NULL` gère les deux cas.

## Errors Encountered
- (aucune)

## Status
**Phase actuelle** : Phase finale changements finaux terminée ✅
**Toutes les phases sont terminées.**

**Phase 1 terminée (2026-04-09)** : 7 tâches visuelles corrigées — navbar, profile épuré, dev invite removed, interest selector modal, RealMeetAlertModal brandé, icônes discussions terminées/annulées, titres activités entreprise sur gradient.
**Phase 4 terminée (2026-04-09)** : 5 bugs corrigés — multi-sélection chat, vérification manuelle sans caméra, duplicate conversation, latence discussion fermée, navbar Android overlap.