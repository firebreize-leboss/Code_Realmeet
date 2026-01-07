// Script de test pour vérifier que les corrections RPC sont appliquées
// Usage: node test-rpc-fixes.js

const { createClient } = require('@supabase/supabase-js');

// Charger les variables d'environnement
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Erreur: Variables d\'environnement manquantes');
  console.error('   EXPO_PUBLIC_SUPABASE_URL ou EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRpcFunctions() {
  console.log('\n🧪 TEST DES FONCTIONS RPC CORRIGÉES\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let allPassed = true;

  // Test 1: get_activities_with_slots
  console.log('1️⃣ Test de get_activities_with_slots...');
  try {
    const { data, error } = await supabase.rpc('get_activities_with_slots', {
      p_status: 'active',
      p_limit: 10
    });

    if (error) {
      console.error('   ❌ ÉCHEC:', error.message);
      console.error('   Détails:', error);
      allPassed = false;
    } else {
      console.log('   ✅ SUCCÈS');
      console.log(`   📊 ${data?.length || 0} activités retournées`);

      if (data && data.length > 0) {
        const sample = data[0];
        console.log('   📝 Exemple de données:');
        console.log(`      - ID: ${sample.activity_id}`);
        console.log(`      - Nom: ${sample.nom}`);
        console.log(`      - Créneaux: ${sample.slot_count}`);
        console.log(`      - Places restantes: ${sample.total_remaining_places}`);
        console.log(`      - Type slot_count: ${typeof sample.slot_count}`);
        console.log(`      - Type total_remaining_places: ${typeof sample.total_remaining_places}`);

        // Vérifier que les types sont corrects (number, pas string)
        if (typeof sample.slot_count === 'number' && typeof sample.total_remaining_places === 'number') {
          console.log('   ✅ Types corrects (number)');
        } else {
          console.log('   ⚠️  Attention: types inattendus');
        }
      }
    }
  } catch (err) {
    console.error('   ❌ ERREUR:', err.message);
    allPassed = false;
  }
  console.log('');

  // Test 2: get_my_conversations_v2
  console.log('2️⃣ Test de get_my_conversations_v2...');
  try {
    // Récupérer l'utilisateur actuel
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.log('   ⚠️  IGNORÉ: Aucun utilisateur connecté');
      console.log('   💡 Connectez-vous pour tester cette fonction');
    } else {
      const { data, error } = await supabase.rpc('get_my_conversations_v2', {
        p_user_id: user.id
      });

      if (error) {
        console.error('   ❌ ÉCHEC:', error.message);
        allPassed = false;
      } else {
        console.log('   ✅ SUCCÈS');
        console.log(`   📊 ${data?.length || 0} conversations retournées`);

        if (data && data.length > 0) {
          const sample = data[0];
          console.log('   📝 Exemple de données:');
          console.log(`      - Participant count: ${sample.participant_count}`);
          console.log(`      - Unread count: ${sample.unread_count}`);
          console.log(`      - Type participant_count: ${typeof sample.participant_count}`);
          console.log(`      - Type unread_count: ${typeof sample.unread_count}`);
        }
      }
    }
  } catch (err) {
    console.error('   ❌ ERREUR:', err.message);
    allPassed = false;
  }
  console.log('');

  // Test 3: get_my_activities
  console.log('3️⃣ Test de get_my_activities...');
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.log('   ⚠️  IGNORÉ: Aucun utilisateur connecté');
      console.log('   💡 Connectez-vous pour tester cette fonction');
    } else {
      const { data, error } = await supabase.rpc('get_my_activities', {
        p_user_id: user.id
      });

      if (error) {
        console.error('   ❌ ÉCHEC:', error.message);
        allPassed = false;
      } else {
        console.log('   ✅ SUCCÈS');
        console.log(`   📊 ${data?.length || 0} activités retournées`);

        if (data && data.length > 0) {
          const sample = data[0];
          console.log('   📝 Exemple de données:');
          console.log(`      - Slot count: ${sample.slot_count}`);
          console.log(`      - Total participants: ${sample.total_participants}`);
          console.log(`      - Type slot_count: ${typeof sample.slot_count}`);
          console.log(`      - Type total_participants: ${typeof sample.total_participants}`);
        }
      }
    }
  } catch (err) {
    console.error('   ❌ ERREUR:', err.message);
    allPassed = false;
  }
  console.log('');

  // Résumé
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  if (allPassed) {
    console.log('✅ TOUS LES TESTS SONT PASSÉS!\n');
    console.log('Les corrections SQL ont été appliquées avec succès.');
    console.log('Votre application devrait maintenant fonctionner correctement.\n');
  } else {
    console.log('❌ CERTAINS TESTS ONT ÉCHOUÉ\n');
    console.log('Les corrections SQL n\'ont pas encore été appliquées.');
    console.log('Veuillez suivre les instructions dans CORRECTION_SQL.md\n');
  }
}

testRpcFunctions().catch(console.error);
