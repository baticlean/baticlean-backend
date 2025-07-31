// middleware/isAdmin.js
const jwt = require('jsonwebtoken');

const isAuthenticated = (req, res, next) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Aucun token fourni.' });
    }

    // On spécifie l'algorithme pour être 100% cohérent avec la création du token
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    req.auth = payload;
    next();
  } catch (error) {
    // Cette erreur se déclenche si le token est expiré ou si la clé secrète ne correspond pas
    return res.status(401).json({ message: 'Token invalide.' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.auth.role !== 'admin' && req.auth.role !== 'superAdmin') {
    return res.status(403).json({ message: 'Accès refusé. Droits administrateur requis.' });
  }
  next();
};

const isSuperAdmin = (req, res, next) => {
  if (req.auth.role !== 'superAdmin') {
    return res.status(403).json({ message: 'Accès refusé. Droits Super Administrateur requis.' });
  }
  next();
};

module.exports = { isAuthenticated, isAdmin, isSuperAdmin };