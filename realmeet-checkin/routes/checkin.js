const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../lib/supabase');
const { isWithinCheckinWindow, getCheckinTokenExpiry } = require('../lib/timeWindow');
const partnerAuth = require('../middleware/partnerAuth');
const { validateLimiter, tokenLimiter } = require('../middleware/rateLimit');

const router = express.Router();

/**
 * POST /api/checkin/generate-token
 * Appelé par l'app mobile. Génère un JWT QR pour un slot_participant.
 * Auth : JWT Supabase de l'utilisateur.
 */
router.post('/generate-token', tokenLimiter, async (req, res) => {
  const { slot_participant_id } = req.body;
  const authHeader = req.headers.authorization?.replace('Bearer ', '');

  if (!authHeader || !slot_participant_id) {
    return res.status(400).json({ error: 'Paramètres manquants' });
  }

  try {
    // Vérifier le user Supabase
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader);
    if (authError || !user) return res.status(401).json({ error: 'Non authentifié' });

    // Récupérer la réservation + infos slot
    const { data: sp, error: spError } = await supabase
      .from('slot_participants')
      .select(`
        id, user_id, checked_in_at,
        activity_slots!inner(date, time, duration),
        activities!inner(nom, host_id)
      `)
      .eq('id', slot_participant_id)
      .single();

    if (spError || !sp) {
      return res.status(404).json({ error: 'Réservation introuvable' });
    }

    // Vérif propriétaire
    if (sp.user_id !== user.id) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    // Déjà check-in ?
    if (sp.checked_in_at) {
      return res.status(409).json({ error: 'Déjà enregistré', checked_in_at: sp.checked_in_at });
    }

    // Calculer expiration basée sur le slot
    const slot = sp.activity_slots;
    const expiresAt = getCheckinTokenExpiry(slot.date, slot.time);

    // Créneau déjà passé ?
    if (expiresAt < new Date()) {
      return res.status(410).json({ error: 'Créneau expiré' });
    }

    // Générer nonce unique
    const nonce = uuidv4();

    // Stocker nonce en BDD (écrase l'ancien → invalide ancien QR)
    const { error: updateError } = await supabase
      .from('slot_participants')
      .update({
        checkin_nonce: nonce,
        checkin_token_expires_at: expiresAt.toISOString()
      })
      .eq('id', slot_participant_id);

    if (updateError) {
      console.error('Nonce update error:', updateError);
      return res.status(500).json({ error: 'Erreur serveur' });
    }

    // Créer JWT QR — payload minimal
    const checkinToken = jwt.sign(
      {
        t: 'ck',                    // type: checkin (compact)
        sp: slot_participant_id,    // slot_participant_id
        n: nonce,                   // nonce
        a: sp.activities.host_id    // activity host (pour vérif rapide)
      },
      process.env.JWT_CHECKIN_SECRET,
      { expiresIn: Math.max(60, Math.floor((expiresAt - Date.now()) / 1000)) }
    );

    // Log
    await supabase.from('checkin_logs').insert({
      slot_participant_id,
      slot_id: sp.activity_slots?.id,
      activity_id: sp.activities?.id,
      action: 'token_generated',
      performed_by: user.id,
      result: 'success',
      ip_address: req.ip,
      metadata: { nonce, expires_at: expiresAt.toISOString() }
    }).catch(() => {});

    res.json({
      token: checkinToken,
      expires_at: expiresAt.toISOString()
    });

  } catch (err) {
    console.error('Token generation error:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

/**
 * POST /api/checkin/verify
 * Appelé par l'interface staff après scan.
 * Retourne les infos du participant SANS valider.
 */
router.post('/verify', partnerAuth, validateLimiter, async (req, res) => {
  const { token } = req.body;
  const partnerId = req.partner.id;
  const ip = req.ip;
  const ua = req.headers['user-agent'] || '';

  if (!token) return res.status(400).json({ error: 'Token manquant' });

  try {
    // 1. Vérifier JWT
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_CHECKIN_SECRET);
    } catch (jwtErr) {
      const result = jwtErr.name === 'TokenExpiredError' ? 'expired' : 'invalid_token';
      await logCheckin(null, null, null, 'scan', result, null, ip, ua);
      return res.status(jwtErr.name === 'TokenExpiredError' ? 410 : 400)
        .json({ error: result === 'expired' ? 'QR expiré' : 'QR invalide' });
    }

    if (payload.t !== 'ck') {
      return res.status(400).json({ error: 'Token invalide' });
    }

    // 2. Récupérer la réservation complète
    const { data: sp } = await supabase
      .from('slot_participants')
      .select(`
        id, user_id, checked_in_at, checkin_nonce, activity_id, slot_id,
        activity_slots!inner(id, date, time, duration),
        activities!inner(id, nom, adresse, ville, image_url, host_id, prix),
        profiles!slot_participants_user_id_fkey(full_name, avatar_url)
      `)
      .eq('id', payload.sp)
      .single();

    if (!sp) {
      await logCheckin(payload.sp, null, null, 'scan', 'not_found', partnerId, ip, ua);
      return res.status(404).json({ error: 'Réservation introuvable' });
    }

    // 3. Vérifier que le staff est host de cette activité
    if (sp.activities.host_id !== partnerId) {
      await logCheckin(sp.id, sp.slot_id, sp.activity_id, 'scan', 'invalid_host', partnerId, ip, ua);
      return res.status(403).json({ 
        error: 'Cette réservation ne concerne pas vos activités' 
      });
    }

    // 4. Vérifier nonce
    if (sp.checkin_nonce !== payload.n) {
      await logCheckin(sp.id, sp.slot_id, sp.activity_id, 'scan', 'invalid_token', partnerId, ip, ua);
      return res.status(403).json({ 
        error: 'QR obsolète — le participant doit régénérer son QR' 
      });
    }

    // 5. Déjà check-in ?
    if (sp.checked_in_at) {
      await logCheckin(sp.id, sp.slot_id, sp.activity_id, 'scan', 'already_checked_in', partnerId, ip, ua);
      return res.status(409).json({
        error: 'Déjà enregistré',
        status: 'already_checked_in',
        checked_in_at: sp.checked_in_at,
        participant: {
          name: sp.profiles.full_name,
          avatar: sp.profiles.avatar_url
        }
      });
    }

    // 6. Fenêtre horaire
    const window = isWithinCheckinWindow(
      sp.activity_slots.date, sp.activity_slots.time, sp.activity_slots.duration
    );
    if (!window.allowed) {
      await logCheckin(sp.id, sp.slot_id, sp.activity_id, 'scan', 'invalid_window', partnerId, ip, ua);
      return res.status(403).json({
        error: 'Hors créneau autorisé',
        window: {
          start: window.windowStart.toISOString(),
          end: window.windowEnd.toISOString()
        }
      });
    }

    // 7. Log scan OK
    await logCheckin(sp.id, sp.slot_id, sp.activity_id, 'scan', 'success', partnerId, ip, ua);

    // 8. Retourner les infos — PAS de validation
    res.json({
      status: 'ready',
      participant: {
        id: sp.id,
        name: sp.profiles.full_name,
        avatar: sp.profiles.avatar_url
      },
      activity: {
        name: sp.activities.nom,
        address: `${sp.activities.adresse}, ${sp.activities.ville}`,
        price: sp.activities.prix,
        image: sp.activities.image_url
      },
      slot: {
        date: sp.activity_slots.date,
        time: sp.activity_slots.time,
        duration: sp.activity_slots.duration
      },
      // Token renvoyé pour la validation
      token: token
    });

  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/checkin/validate
 * Validation effective. Uniquement par le staff authentifié.
 */
router.post('/validate', partnerAuth, validateLimiter, async (req, res) => {
  const { token } = req.body;
  const partnerId = req.partner.id;
  const ip = req.ip;
  const ua = req.headers['user-agent'] || '';

  if (!token) return res.status(400).json({ error: 'Token manquant' });

  try {
    // 1. Re-vérifier JWT (le staff aurait pu attendre)
    const payload = jwt.verify(token, process.env.JWT_CHECKIN_SECRET);
    if (payload.t !== 'ck') {
      return res.status(400).json({ error: 'Token invalide' });
    }

    // 2. Récupérer la réservation
    const { data: sp } = await supabase
      .from('slot_participants')
      .select(`
        id, checked_in_at, checkin_nonce, activity_id, slot_id,
        activity_slots!inner(date, time, duration),
        activities!inner(host_id),
        profiles!slot_participants_user_id_fkey(full_name)
      `)
      .eq('id', payload.sp)
      .single();

    if (!sp) {
      return res.status(404).json({ error: 'Réservation introuvable' });
    }

    // 3. Vérifier host
    if (sp.activities.host_id !== partnerId) {
      await logCheckin(sp.id, sp.slot_id, sp.activity_id, 'reject', 'unauthorized', partnerId, ip, ua);
      return res.status(403).json({ error: 'Non autorisé pour cette activité' });
    }

    // 4. Nonce
    if (sp.checkin_nonce !== payload.n) {
      await logCheckin(sp.id, sp.slot_id, sp.activity_id, 'reject', 'invalid_token', partnerId, ip, ua);
      return res.status(403).json({ error: 'Token obsolète' });
    }

    // 5. Double check-in guard
    if (sp.checked_in_at) {
      await logCheckin(sp.id, sp.slot_id, sp.activity_id, 'reject', 'already_checked_in', partnerId, ip, ua);
      return res.status(409).json({ error: 'Déjà enregistré', checked_in_at: sp.checked_in_at });
    }

    // 6. Fenêtre
    const window = isWithinCheckinWindow(
      sp.activity_slots.date, sp.activity_slots.time, sp.activity_slots.duration
    );
    if (!window.allowed) {
      await logCheckin(sp.id, sp.slot_id, sp.activity_id, 'reject', 'invalid_window', partnerId, ip, ua);
      return res.status(403).json({ error: 'Hors créneau' });
    }

    // 7. VALIDATION ATOMIQUE
    const { data: updated, error: updateError } = await supabase
      .from('slot_participants')
      .update({
        checked_in_at: new Date().toISOString(),
        checked_in_by: partnerId,
        checkin_nonce: null  // Invalide le nonce définitivement
      })
      .eq('id', sp.id)
      .is('checked_in_at', null)  // Protection atomique anti-double
      .select('id, checked_in_at')
      .single();

    if (updateError || !updated) {
      await logCheckin(sp.id, sp.slot_id, sp.activity_id, 'reject', 'already_checked_in', partnerId, ip, ua);
      return res.status(409).json({ error: 'Validation impossible — course condition' });
    }

    // 8. Log succès
    await logCheckin(sp.id, sp.slot_id, sp.activity_id, 'validate', 'success', partnerId, ip, ua);

    res.json({
      success: true,
      message: `${sp.profiles.full_name} enregistré(e)`,
      checked_in_at: updated.checked_in_at
    });

  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(410).json({ error: 'Token expiré' });
    }
    console.error('Validate error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/checkin/slot-status/:slotId
 * Statut live d'un créneau — combien de check-ins.
 * Pensé pour le futur dashboard temps réel.
 */
router.get('/slot-status/:slotId', partnerAuth, async (req, res) => {
  const { slotId } = req.params;
  const partnerId = req.partner.id;

  // Vérifier que le slot appartient au partenaire
  const { data: slot } = await supabase
    .from('activity_slots')
    .select('id, date, time, max_participants, activities!inner(host_id, nom)')
    .eq('id', slotId)
    .single();

  if (!slot || slot.activities.host_id !== partnerId) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const { data: participants } = await supabase
    .from('slot_participants')
    .select('id, user_id, checked_in_at, profiles!slot_participants_user_id_fkey(full_name, avatar_url)')
    .eq('slot_id', slotId);

  const total = participants?.length || 0;
  const checkedIn = participants?.filter(p => p.checked_in_at).length || 0;

  res.json({
    slot: { id: slotId, date: slot.date, time: slot.time, maxParticipants: slot.max_participants },
    activity: { name: slot.activities.nom },
    stats: { total, checkedIn, remaining: total - checkedIn },
    participants: participants?.map(p => ({
      id: p.id,
      name: p.profiles.full_name,
      avatar: p.profiles.avatar_url,
      checkedIn: !!p.checked_in_at,
      checkedInAt: p.checked_in_at
    })) || []
  });
});

/**
 * GET /api/checkin/today-slots
 * Liste des créneaux du jour pour ce partenaire.
 */
router.get('/today-slots', partnerAuth, async (req, res) => {
  const partnerId = req.partner.id;
  const today = new Date().toISOString().split('T')[0];

  const { data: slots } = await supabase
    .from('activity_slots')
    .select(`
      id, date, time, duration, max_participants,
      activities!inner(id, nom, image_url, host_id, adresse)
    `)
    .eq('activities.host_id', partnerId)
    .gte('date', today)
    .lte('date', today)
    .order('time', { ascending: true });

  if (!slots || slots.length === 0) {
    return res.json({ slots: [] });
  }

  // Compter check-ins par slot
  const enriched = await Promise.all(slots.map(async (slot) => {
    const { count: totalParticipants } = await supabase
      .from('slot_participants')
      .select('*', { count: 'exact', head: true })
      .eq('slot_id', slot.id);

    const { count: checkedInCount } = await supabase
      .from('slot_participants')
      .select('*', { count: 'exact', head: true })
      .eq('slot_id', slot.id)
      .not('checked_in_at', 'is', null);

    return {
      id: slot.id,
      date: slot.date,
      time: slot.time,
      duration: slot.duration,
      activity: {
        id: slot.activities.id,
        name: slot.activities.nom,
        image: slot.activities.image_url,
        address: slot.activities.adresse
      },
      stats: {
        total: totalParticipants || 0,
        checkedIn: checkedInCount || 0,
        max: slot.max_participants
      }
    };
  }));

  res.json({ slots: enriched });
});

// Helper de log
async function logCheckin(spId, slotId, activityId, action, result, performedBy, ip, ua, metadata = {}) {
  await supabase.from('checkin_logs').insert({
    slot_participant_id: spId,
    slot_id: slotId,
    activity_id: activityId,
    action,
    result,
    performed_by: performedBy,
    ip_address: ip,
    user_agent: ua,
    metadata
  }).catch(err => console.error('Log error:', err));
}

module.exports = router;