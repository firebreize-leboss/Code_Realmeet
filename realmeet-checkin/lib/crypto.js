const crypto = require('crypto');

/** Hash un token pour stockage sécurisé en BDD */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { hashToken };