const { expressjwt: jwt } = require('express-jwt');

// On vérifie le token
const isAuthenticated = jwt({
  secret: process.env.JWT_SECRET,
  algorithms: ['HS256'],
  requestProperty: 'auth',
  getToken: (req) => {
    if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
      return req.headers.authorization.split(' ')[1];
    }
    return null;
  },
});

// --- CORRECTION ICI ---
// On vérifie si l'utilisateur est un admin OU un superAdmin
const isAdmin = (req, res, next) => {
  if (req.auth && (req.auth.role === 'admin' || req.auth.role === 'superAdmin')) {
    next();
  } else {
    res.status(403).json({ message: 'Accès refusé. Droits administrateur requis.' });
  }
};

// On vérifie si l'utilisateur est un superAdmin
const isSuperAdmin = (req, res, next) => {
  if (req.auth && req.auth.role === 'superAdmin') {
    next();
  } else {
    res.status(403).json({ message: 'Accès refusé. Droits super-administrateur requis.' });
  }
};

module.exports = { isAuthenticated, isAdmin, isSuperAdmin };