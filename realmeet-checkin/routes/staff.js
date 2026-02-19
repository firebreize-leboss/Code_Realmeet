const express = require('express');
const path = require('path');
const partnerAuth = require('../middleware/partnerAuth');

const router = express.Router();

/**
 * GET /staff
 * Sert la SPA de l'interface staff.
 * Si pas connecté → redirige vers /staff/login.
 */
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'staff', 'index.html'));
});

router.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'staff', 'login.html'));
});

module.exports = router;