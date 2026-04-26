# Task Plan: RealMeet — Pre-Launch Sprint

## Goal
Paufinner et rendre le produit prêt pour le lancement une bonne fois pour toute.

## Phases

### Phase finale : Inscription téléphone

- [ ] le message de vérification ne s'envoie pas comme voulu, voici le bug sur twilio :
SMa3210c8fade406f265f2e0e384cdda09
2026-04-22 21:03:49.67 UTC	FAILED	+14783752290	+26269347XXXX	Telco OI	
From: United States
To: Réunion
Error code : 21408	
MG5e8214130365b4d4a813e9b876829853
RealMeet

SM1c6ef240fc1c60457267e14f15ceaac7
2026-04-22 21:01:39.54 UTC	FAILED	+14783752290	+26269347XXXX	Telco OI	
From: United States
To: Réunion
Error code : 21408	
MG5e8214130365b4d4a813e9b876829853
RealMeet

SM3535e674f8ac9aeba664049299c55d2c
2026-04-22 21:00:58.59 UTC	FAILED	+14783752290	+26269347XXXX	Unknown	
From: United States
To: Réunion
Error code : 21408	
MG5e8214130365b4d4a813e9b876829853
RealMeet


### Phase finale : debuggage

- [x] Compteur participants cohérent sur la page activité. Cause : `ActivityCalendar` additionnait `slot_group_members` (jamais nettoyé après `cancel_slot_participation` ou `detect_no_shows`) en plus des `slot_participants`. Fix : la source de vérité est désormais `slot_participants WHERE status='active'` uniquement (les deux chemins de chargement du calendrier).


### Phase finale : ajouts de fonctionnalité
- [x] La carte Maps centre désormais en priorité sur la géoloc instantanée, sinon sur la ville du profil (géocodée via Nominatim, mise en cache pour la session), sinon sur la première activité. Le bouton "centrer sur moi" et le centre par défaut de la WebView suivent la même priorité.

### Phase finale : mettre en pause une fonctionnalité
- [x] Mise en pause du mode QR / validation. Flag opt-in `activities.requires_checkin` (défaut `false`) : toggle Switch sur create-activity et edit-activity, bloc "Vous êtes inscrit !" par défaut sur la page activité, QR conservé uniquement pour les activités qui l'activent. `detect_no_shows` ignore désormais les activités sans check-in → aucune pénalité possible quand le flag est off.




## Status
**Phase actuelle** : Phase finale réduction des lags terminée ✅
**Toutes les phases sont terminées.**

**Phase 1 terminée (2026-04-09)** : 7 tâches visuelles corrigées — navbar, profile épuré, dev invite removed, interest selector modal, RealMeetAlertModal brandé, icônes discussions terminées/annulées, titres activités entreprise sur gradient.
**Phase 4 terminée (2026-04-09)** : 5 bugs corrigés — multi-sélection chat, vérification manuelle sans caméra, duplicate conversation, latence discussion fermée, navbar Android overlap.