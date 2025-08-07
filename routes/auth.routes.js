

router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;
    if (!login || !password) { return res.status(400).json({ message: 'Tous les champs sont requis.' }); }

    const user = await User.findOne({ $or: [{ email: login }, { phoneNumber: login }] });
    if (!user) { return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect.' }); }

    const isPasswordCorrect = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordCorrect) { return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect.' }); }

    const { _id, username, role, email, status, profilePicture } = user;
    const payload = { _id, email, username, role, status, profilePicture };
    const authToken = jwt.sign(payload, process.env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '6h',
    });

    // Si l'utilisateur n'est pas actif, on envoie quand même le token avec une erreur
    if (user.status !== 'active') {
        return res.status(403).json({ 
            message: 'Votre compte a été suspendu ou banni.',
            authToken: authToken // On fournit le token pour garder l'écouteur actif
        });
    }

    res.status(200).json({ authToken });
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

module.exports = router;