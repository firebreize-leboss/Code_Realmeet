const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  message: { error: 'Trop de tentatives. Réessayez dans 15 minutes.' }
});

const validateLimiter = rateLimit({
  windowMs: 60_000,
  max: 60, // 60 validations/min = 1/sec, suffisant pour queue d'entrée
  message: { error: 'Trop de requêtes. Ralentissez.' }
});

const tokenLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  message: { error: 'Trop de demandes de token.' }
});

module.exports = { loginLimiter, validateLimiter, tokenLimiter };