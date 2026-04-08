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

## À investiguer
- Quelles pages légales manquent exactement (ls app/about* app/help*)
- Performance réelle sur device Android bas de gamme
- État du deep link sur iOS vs Android (schemes différents ?)