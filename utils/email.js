// baticlean/baticlean-backend/baticlean-backend-7fb8ecb29682d81fea238ef7e2d5c58e262e55de/utils/email.js
const nodemailer = require("nodemailer");

// Création du transporteur avec une configuration plus permissive pour le débogage SSL
// et strictement alignée sur les recommandations Brevo (Port 587 + STARTTLS)
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp-relay.brevo.com",
  port: process.env.EMAIL_PORT || 587,
  secure: false, // false pour le port 587 (STARTTLS), true pour 465
  auth: {
    user: process.env.EMAIL_USER, // Ton login Brevo (souvent l'email du compte)
    pass: process.env.EMAIL_PASS, // Ta clé API SMTP (PAS le mot de passe de ton compte Brevo !)
  },
  tls: {
    ciphers: "SSLv3",
    rejectUnauthorized: false, // Aide à contourner certaines erreurs de certificat locales
  },
});

// Fonction de vérification au démarrage (Diagnostic)
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ ERREUR CRITIQUE EMAIL (Connection SMTP) :", error);
  } else {
    console.log("✅ Service Email (Brevo) prêt et connecté.");
  }
});

const sendEmail = async (options) => {
  try {
    // Vérification de sécurité des champs
    if (!options.email || !options.subject || !options.message) {
      throw new Error("Paramètres d'email manquants (email, sujet ou message).");
    }

    const mailOptions = {
      from: `BatiClean Support <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`, // IMPORTANT: Doit être un expéditeur validé
      to: options.email,
      subject: options.subject,
      text: options.message,
      html: options.html || `<div>${options.message.replace(/\n/g, '<br>')}</div>`, // Fallback HTML simple
    };

    console.log(`📩 Tentative d'envoi à : ${options.email} | Sujet : ${options.subject}`);

    const info = await transporter.sendMail(mailOptions);
    
    console.log(`✅ Email envoyé avec succès : ${info.messageId}`);
    return info;

  } catch (error) {
    console.error("❌ ÉCHEC D'ENVOI D'EMAIL :", error.message);
    // On renvoie l'erreur pour que le contrôleur sache que ça a échoué
    throw error;
  }
};

module.exports = sendEmail;