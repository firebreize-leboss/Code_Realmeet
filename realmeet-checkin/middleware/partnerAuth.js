const jwt = require('jsonwebtoken');
const supabase = require('../lib/supabase');

/**
 * Authentifie le staff partenaire.
 * Vérifie le cookie httpOnly OU le header Authorization.
 * Charge le profil et les activités autorisées.
 */
async function partnerAuth(req, res, next) {
  const token = req.cookies?.partner_session
    || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Authentification requise' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_PARTNER_SECRET);
    if (payload.type !== 'partner_session') {
      return res.status(401).json({ error: 'Type de token invalide' });
    }

    // Charger le profil business
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, account_type, business_name, business_logo_url')
      .eq('id', payload.partnerId)
      .eq('account_type', 'business')
      .single();

    if (!profile) {
      return res.status(403).json({ error: 'Compte partenaire introuvable' });
    }

    req.partner = {
      id: profile.id,
      name: profile.full_name,
      businessName: profile.business_name,
      logoUrl: profile.business_logo_url
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      res.clearCookie('partner_session');
      return res.status(401).json({ error: 'Session expirée' });
    }
    return res.status(401).json({ error: 'Token invalide' });
  }
}

module.exports = partnerAuth;