// backend/utils/email.js

const SibApiV3Sdk = require('sib-api-v3-sdk');

// Configuration de l'API Brevo
let defaultClient = SibApiV3Sdk.ApiClient.instance;
let apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

// --- MODÈLES D'EMAILS ---

// 1. Email envoyé au client lors d'une nouvelle réservation
const sendBookingConfirmationEmail = async (user, booking, service) => {
    const sendSmtpEmail = {
        to: [{ email: user.email, name: user.username }],
        sender: { name: 'BATIClean Support', email: 'baticlean225@gmail.com' },
        subject: `✅ Confirmation de votre demande de réservation #${booking._id.toString().slice(-6)}`,
        htmlContent: `
            <div style="font-family: Arial, sans-serif; text-align: center; color: #333;">
                <h2 style="color: #8A2387;">Réservation Reçue !</h2>
                <p>Bonjour ${user.username},</p>
                <p>Nous avons bien reçu votre demande de réservation pour le service <strong>"${service.title}"</strong>.</p>
                <p>Un administrateur va l'examiner sous peu et vous recevrez un nouvel email lorsque son statut changera.(Pensez à vérifier la section "spams" de votre boîte mail  (Pensez à vérifier la section "spams" de votre boîte mail car le prochain changement de statut pourrait être marqué comme spam pour des raisons de sécurité. Vous pouvez nous marquer comme "non-spam" pour une meilleur flexibilité.).</p>
                <p style="margin-top: 20px; font-size: 12px; color: #777;">Merci de votre confiance.</p>
            </div>
        `,
    };
    await apiInstance.sendTransacEmail(sendSmtpEmail);
};

// 2. Email envoyé au client quand le statut est mis à jour par un admin
const sendStatusUpdateEmail = async (user, booking, service) => {
    const sendSmtpEmail = {
        to: [{ email: user.email, name: user.username }],
        sender: { name: 'BATIClean Support', email: 'baticlean225@gmail.com' },
        subject: `🔄 Statut de votre réservation #${booking._id.toString().slice(-6)} mis à jour`,
        htmlContent: `
             <div style="font-family: Arial, sans-serif; text-align: center; color: #333;">
                <h2 style="color: #8A2387;">Mise à Jour de votre Réservation</h2>
                <p>Bonjour ${user.username},</p>
                <p>Le statut de votre réservation pour le service <strong>"${service.title}"</strong> est maintenant : <strong>${booking.status}</strong>.</p>
                <p style="margin-top: 20px; font-size: 12px; color: #777;">Vous pouvez suivre son évolution depuis votre espace client. (Pensez à vérifier la section "spams" de votre boîte mail car le prochain changement de statut pourrait être marqué comme spam pour des raisons de sécurité. Vous pouvez nous marquer comme "non-spam" pour une meilleur flexibilité. ).</p>
            </div>
        `,
    };
    await apiInstance.sendTransacEmail(sendSmtpEmail);
};

// 3. Email envoyé au client quand il annule sa réservation
const sendCancellationEmail = async (user, booking, service) => {
     const sendSmtpEmail = {
        to: [{ email: user.email, name: user.username }],
        sender: { name: 'BATIClean Support', email: 'baticlean225@gmail.com' },
        subject: `❌ Annulation de votre réservation #${booking._id.toString().slice(-6)}`,
        htmlContent: `
             <div style="font-family: Arial, sans-serif; text-align: center; color: #333;">
                <h2 style="color: #E94057;">Réservation Annulée</h2>
                <p>Bonjour ${user.username},</p>
                <p>Nous vous confirmons l'annulation de votre réservation pour le service <strong>"${service.title}"</strong>.</p>
                 <p style="margin-top: 20px; font-size: 12px; color: #777;">Nous espérons vous revoir bientôt.</p>
            </div>
        `,
    };
    await apiInstance.sendTransacEmail(sendSmtpEmail);
};

// 4. Email envoyé au client quand la prestation est terminée, pour demander un avis
const sendReviewRequestEmail = async (user, booking, service) => {
    const reviewUrl = `${process.env.FRONTEND_URL}/my-bookings?reviewBookingId=${booking._id}`;
    const sendSmtpEmail = {
        to: [{ email: user.email, name: user.username }],
        sender: { name: 'BATIClean Support', email: 'baticlean225@gmail.com' },
        subject: `⭐ Donnez votre avis sur la prestation "${service.title}"`,
        htmlContent: `
             <div style="font-family: Arial, sans-serif; text-align: center; color: #333;">
                <h2 style="color: #8A2387;">Votre avis compte !</h2>
                <p>Bonjour ${user.username},</p>
                <p>Votre prestation pour le service <strong>"${service.title}"</strong> est maintenant terminée. Nous espérons que tout s'est bien passé !</p>
                <p>Votre retour est précieux pour nous aider à nous améliorer. Pourriez-vous prendre un instant pour laisser un avis ?</p>
                <a href="${reviewUrl}" style="background-color: #E94057; color: white; padding: 15px 25px; text-decoration: none; border-radius: 50px; display: inline-block; font-weight: bold; margin-top: 20px;">Laisser un avis</a>
            </div>
        `,
    };
    await apiInstance.sendTransacEmail(sendSmtpEmail);
};


module.exports = {
    sendBookingConfirmationEmail,
    sendStatusUpdateEmail,
    sendCancellationEmail,
    sendReviewRequestEmail,
};