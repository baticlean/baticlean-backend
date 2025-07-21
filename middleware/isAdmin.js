// middleware/isAdmin.js
const jwt = require('jsonwebtoken');

const isAuthenticated = (req, res, next) => {
  try {
    // On vérifie si le token est dans les en-têtes
    const token = req.headers.authorization.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Aucun token fourni.' });
    }

    // On vérifie la validité du token
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'super-secret');
    req.auth = payload; // On attache les infos de l'utilisateur à la requête
    next(); // On passe à la suite
  } catch (error) {
    // Si le token est invalide ou expiré
    res.status(401).json({ message: 'Token invalide.' });
  }
};

const isAdmin = (req, res, next) => {
  // On vérifie le rôle stocké dans le token
  if (req.auth.role !== 'admin' && req.auth.role !== 'superAdmin') {
    return res.status(403).json({ message: 'Accès refusé. Droits administrateur requis.' });
  }
  next();
};

module.exports = { isAuthenticated, isAdmin };