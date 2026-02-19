const express = require('express');
const jwt = require('jsonwebtoken');
const supabase = require('../lib/supabase');
const { hashToken } = require('../lib/crypto');
const { loginLimiter } = require('../middleware/rateLimit');
const partnerAuth = require('../middleware/partnerAuth');

const router = express.Router();

/**
 * POST /api/auth/login
 * Connexion partenaire. Retourne un cookie httpOnly persistant.
 */
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  try {
    // Auth Supabase
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: 'Identifiants invalides' });

    // Vérifier account_type = business
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, account_type, business_name, full_name')
      .eq('id', data.user.id)
      .eq('account_type', 'business')
      .single();

    if (!profile) {
      return res.status(403).json({ error: 'Accès réservé aux comptes partenaires' });
    }

    // Créer JWT session partenaire (12h)
    const sessionToken = jwt.sign(
      { partnerId: profile.id, type: 'partner_session' },
      process.env.JWT_PARTNER_SECRET,
      { expiresIn: '12h' }
    );

    // Stocker la session en BDD (audit + révocation possible)
    await supabase.from('partner_sessions').insert({
      partner_id: profile.id,
      token_hash: hashToken(sessionToken),
      device_info: req.headers['user-agent'],
      ip_address: req.ip,
      expires_at: new Date(Date.now() + 12 * 3600_000).toISOString()
    });

    // Cookie httpOnly — persiste entre les pages/scans
    res.cookie('partner_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 12 * 3600_000,
      path: '/'
    });

    res.json({
      success: true,
      partner: {
        id: profile.id,
        name: profile.full_name,
        businessName: profile.business_name
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', partnerAuth, async (req, res) => {
  const token = req.cookies?.partner_session;
  if (token) {
    await supabase.from('partner_sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('token_hash', hashToken(token));
  }
  res.clearCookie('partner_session');
  res.json({ success: true });
});

/**
 * GET /api/auth/me
 * Vérifie si la session est valide (appelé au chargement de /staff)
 */
router.get('/me', partnerAuth, (req, res) => {
  res.json({ partner: req.partner });
});

module.exports = router;