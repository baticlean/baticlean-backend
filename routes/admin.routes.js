// middleware/isAdmin.js
const { expressjwt: jwt } = require('express-jwt');

// Ce middleware vérifie le token et le stocke dans req.auth
const isAuthenticated = jwt({
  secret: process.env.JWT_SECRET || 'super-secret',
  algorithms: ['HS256'],
});

// Ce middleware vérifie si l'utilisateur est un admin ou superAdmin
const isAdmin = (req, res, next) => {
  if (req.auth.role !== 'admin' && req.auth.role !== 'superAdmin') {
    return res.status(403).json({ message: 'Accès refusé. Droits administrateur requis.' });
  }
  next();
};

module.exports = { isAuthenticated, isAdmin };