# 🔧 Correction de l'erreur RPC get_activities_with_slots

## ❌ Erreur rencontrée
```
RPC get_activities_with_slots error: {
  "code": "42804",
  "details": "Returned type numeric does not match expected type bigint in column 21.",
  "hint": null,
  "message": "structure of query does not match function result type"
}
```

## 🔍 Cause
La fonction `get_activities_with_slots` déclare que la colonne 21 (`total_remaining_places`) est de type `BIGINT`, mais le calcul SQL utilise `SUM()` qui retourne un type `NUMERIC`. PostgreSQL est strict sur les types et refuse la conversion implicite.

## ✅ Solution
Ajouter des casts explicites `::BIGINT` pour forcer la conversion des types NUMERIC vers BIGINT.

## 📝 Instructions pour appliquer la correction

### Option 1: Via le Dashboard Supabase (RECOMMANDÉ)

1. **Ouvrez le dashboard Supabase**
   - Allez sur https://supabase.com/dashboard
   - Sélectionnez votre projet RealMeet

2. **Ouvrez l'éditeur SQL**
   - Dans le menu de gauche, cliquez sur "SQL Editor"
   - Cliquez sur "New query" (Nouvelle requête)

3. **Exécutez le fichier de correction**
   - Copiez le contenu COMPLET du fichier `supabase_optimizations.sql`
   - Collez-le dans l'éditeur SQL
   - Cliquez sur "Run" (Exécuter)

4. **Vérifiez que tout s'est bien passé**
   - Vous devriez voir un message de succès
   - Les 3 fonctions suivantes ont été corrigées:
     - ✅ `get_activities_with_slots`
     - ✅ `get_my_activities`
     - ✅ `get_my_conversations_v2`

### Option 2: Via Supabase CLI (si installé)

```bash
# Si vous avez Supabase CLI installé
supabase db reset
# OU
supabase db push
```

## 🔍 Détails des corrections

### 1. get_activities_with_slots (ligne 442-444)
```sql
-- AVANT (causait l'erreur)
COALESCE(sa.slot_count, 0) as slot_count,
sa.next_slot_date,
COALESCE(sa.remaining_places, 0) as total_remaining_places

-- APRÈS (corrigé)
COALESCE(sa.slot_count, 0)::BIGINT as slot_count,
sa.next_slot_date,
COALESCE(sa.remaining_places, 0)::BIGINT as total_remaining_places
```

### 2. get_my_activities (ligne 512-514)
```sql
-- AVANT
COALESCE(asa.slot_count, 0) as slot_count,
asa.next_slot_date,
COALESCE(asa.total_participants, 0) as total_participants

-- APRÈS (corrigé)
COALESCE(asa.slot_count, 0)::BIGINT as slot_count,
asa.next_slot_date,
COALESCE(asa.total_participants, 0)::BIGINT as total_participants
```

### 3. get_my_conversations_v2 (ligne 198-202)
```sql
-- AVANT
COALESCE(pc.cnt, 0) as participant_count,
op.full_name as other_participant_name,
op.avatar_url as other_participant_avatar,
COALESCE(uc.unread, 0) as unread_count,

-- APRÈS (corrigé)
COALESCE(pc.cnt, 0)::BIGINT as participant_count,
op.full_name as other_participant_name,
op.avatar_url as other_participant_avatar,
COALESCE(uc.unread, 0)::BIGINT as unread_count,
```

## 🧪 Test de la correction

Après avoir appliqué les corrections, testez en appelant la fonction RPC:

```javascript
// Dans votre app React Native
const { data, error } = await supabase.rpc('get_activities_with_slots', {
  p_status: 'active',
  p_limit: 100
});

if (error) {
  console.error('Erreur:', error);
} else {
  console.log('✅ Succès! Activités chargées:', data.length);
}
```

## 📊 Impact
- ✅ L'erreur `structure of query does not match function result type` est résolue
- ✅ Les fonctions RPC retournent maintenant les bons types
- ✅ Les pages Browse, Chat et Profile fonctionneront correctement
- ✅ Pas d'impact sur les performances
- ✅ Pas de changement dans le code TypeScript/React

## 🎯 Résultat attendu
Après correction, l'application devrait charger les activités sans erreur et afficher correctement:
- La liste des activités avec créneaux disponibles
- Le nombre de places restantes
- Les conversations avec compteurs de messages non lus
- Les statistiques utilisateur

---

**Note:** Ces corrections sont déjà incluses dans le fichier `supabase_optimizations.sql`.
Il suffit d'exécuter ce fichier une seule fois pour appliquer TOUTES les corrections.
