# 🚀 CORRECTION RAPIDE - Erreur RPC

## ⚡ Solution en 3 étapes

### Étape 1: Ouvrir le dashboard Supabase
1. Allez sur https://supabase.com/dashboard
2. Sélectionnez votre projet RealMeet
3. Cliquez sur "SQL Editor" dans le menu de gauche

### Étape 2: Exécuter le script SQL
1. Cliquez sur "New query"
2. Ouvrez le fichier `supabase_optimizations.sql` dans votre éditeur
3. Copiez TOUT le contenu (Ctrl+A puis Ctrl+C)
4. Collez-le dans l'éditeur SQL Supabase
5. Cliquez sur "Run" (ou appuyez sur Ctrl+Enter)
6. Attendez quelques secondes

### Étape 3: Vérifier que ça fonctionne
```bash
# Dans votre terminal
npm install dotenv @supabase/supabase-js
node test-rpc-fixes.js
```

Vous devriez voir:
```
✅ TOUS LES TESTS SONT PASSÉS!
```

---

## 🎯 C'est tout !

Votre application devrait maintenant fonctionner sans l'erreur:
```
RPC get_activities_with_slots error: structure of query does not match function result type
```

---

## 🔍 Que fait cette correction ?

Elle ajoute des casts explicites `::BIGINT` dans 3 fonctions SQL:
- ✅ `get_activities_with_slots` (corrige la colonne 21)
- ✅ `get_my_activities`
- ✅ `get_my_conversations_v2`

Cela force PostgreSQL à convertir les types NUMERIC en BIGINT, éliminant l'erreur de type.

---

## 🆘 Besoin d'aide ?

Si vous avez encore des erreurs après avoir suivi ces étapes:

1. Vérifiez que le script SQL s'est exécuté sans erreur
2. Relancez votre application React Native
3. Consultez le fichier `CORRECTION_SQL.md` pour plus de détails
4. Testez avec: `node test-rpc-fixes.js`

---

**Durée estimée:** 2-3 minutes ⏱️
