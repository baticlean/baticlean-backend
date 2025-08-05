const jwt = require('jsonwebtoken');

const isAuthenticated = (req, res, next) => {
  try {
    // Le token est envoyé dans l'en-tête "Authorization: Bearer <TOKEN>"
    const token = req.headers.authorization.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Aucun token fourni.' });
    }

    // On vérifie que le token est valide avec notre clé secrète
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.auth = payload; // On attache les infos de l'utilisateur à la requête
    next();
  } catch (error) {
    // Si jwt.verify échoue (token invalide, expiré, etc.), on renvoie une erreur
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