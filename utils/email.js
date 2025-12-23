// baticlean/baticlean-backend/utils/email.js
const nodemailer = require("nodemailer");

// Vérification préventive pour éviter le crash au démarrage
const isEmailConfigured = process.env.EMAIL_USER && process.env.EMAIL_PASS;

if (!isEmailConfigured) {
  console.warn("⚠️ ATTENTION : Configuration Email manquante (EMAIL_USER ou EMAIL_PASS). Les emails ne seront pas envoyés.");
}

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp-relay.brevo.com",
  port: process.env.EMAIL_PORT || 587,
  secure: false, 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    ciphers: "SSLv3",
    rejectUnauthorized: false, 
  },
});

// Vérification silencieuse (ne plante pas l'app, juste un log)
if (isEmailConfigured) {
  transporter.verify((error, success) => {
    if (error) {
      console.error("❌ ERREUR SMTP (Non bloquante) :", error.message);
    } else {
      console.log("✅ Service Email (Brevo) connecté et prêt.");
    }
  });
}

const sendEmail = async (options) => {
  if (!isEmailConfigured) {
    console.error("❌ Envoi annulé : Configuration Email manquante.");
    return; // On arrête là sans faire planter
  }

  try {
    const mailOptions = {
      from: `BatiClean Support <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: options.email,
      subject: options.subject,
      text: options.message,
      html: options.html || `<div>${options.message.replace(/\n/g, '<br>')}</div>`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📩 Email envoyé : ${info.messageId}`);
    return info;

  } catch (error) {
    console.error("❌ ECHEC ENVOI EMAIL :", error.message);
    throw error; // L'appelant (Frontend) saura qu'il y a eu une erreur
  }
};

module.exports = sendEmail;