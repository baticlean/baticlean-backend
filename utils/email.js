// backend/utils/email.js (Version Professionnelle)

const SibApiV3Sdk = require('sib-api-v3-sdk');

// Configuration de l'API Brevo
let defaultClient = SibApiV3Sdk.ApiClient.instance;
let apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

// --- MODÈLE DE BASE POUR TOUS LES EMAILS ---
// On centralise le style pour ne pas le répéter
const generateHtmlTemplate = (title, preheader, content) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Poppins', Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(45deg, #8A2387 30%, #E94057 90%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; }
        .content { padding: 30px; color: #333333; line-height: 1.6; }
        .content p { margin-bottom: 20px; }
        .button { display: inline-block; background-color: #E94057; color: white; padding: 12px 25px; text-decoration: none; border-radius: 50px; font-weight: bold; }
        .footer { background-color: #f8f8f8; padding: 20px; text-align: center; font-size: 12px; color: #777; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header"><h1>${title}</h1></div>
        <div class="content">
            <p style="font-size: 18px;">Bonjour ${preheader},</p>
            ${content}
        </div>
        <div class="footer">
            <p>BATIClean © ${new Date().getFullYear()}<br>Merci de votre confiance.</p>
        </div>
    </div>
</body>
</html>
`;

// --- FONCTIONS D'ENVOI D'EMAILS ---

// 1. Email de confirmation de réservation
const sendBookingConfirmationEmail = async (user, booking, service) => {
    const title = "✅ Réservation Reçue !";
    const content = `
        <p>Nous avons bien reçu votre demande de réservation pour le service <strong>"${service.title}"</strong>.</p>
        <p>Un administrateur va l'examiner sous peu. Vous recevrez un nouvel email lorsque son statut changera.</p>
        <p style="text-align:center; margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL}/my-bookings" class="button">Voir mes réservations</a>
        </p>
        <p style="font-size: 12px; color: #777; margin-top: 30px;">Pensez à vérifier votre dossier "Spam", les prochaines notifications pourraient s'y trouver.</p>
    `;
    const htmlContent = generateHtmlTemplate(title, user.username, content);
    
    await apiInstance.sendTransacEmail({
        to: [{ email: user.email, name: user.username }],
        sender: { name: 'BATIClean Support', email: 'baticlean225@gmail.com' },
        subject: `${title} - #${booking._id.toString().slice(-6)}`,
        htmlContent,
    });
};

// 2. Email de mise à jour de statut
const sendStatusUpdateEmail = async (user, booking, service) => {
    const title = `🔄 Statut Mis à Jour`;
    const content = `
        <p>Le statut de votre réservation pour le service <strong>"${service.title}"</strong> est maintenant : <strong>${booking.status}</strong>.</p>
        <p style="text-align:center; margin-top: 30px;">
             <a href="${process.env.FRONTEND_URL}/my-bookings" class="button">Suivre l'évolution</a>
        </p>
    `;
    const htmlContent = generateHtmlTemplate(title, user.username, content);

    await apiInstance.sendTransacEmail({
        to: [{ email: user.email, name: user.username }],
        sender: { name: 'BATIClean Support', email: 'baticlean225@gmail.com' },
        subject: `${title} - Réservation #${booking._id.toString().slice(-6)}`,
        htmlContent,
    });
};

// 3. Email d'annulation
const sendCancellationEmail = async (user, booking, service) => {
    const title = `❌ Réservation Annulée`;
    const content = `
        <p>Nous vous confirmons l'annulation de votre réservation pour le service <strong>"${service.title}"</strong>.</p>
        <p>Nous espérons vous revoir bientôt sur BATIClean.</p>
    `;
    const htmlContent = generateHtmlTemplate(title, user.username, content);

    await apiInstance.sendTransacEmail({
        to: [{ email: user.email, name: user.username }],
        sender: { name: 'BATIClean Support', email: 'baticlean225@gmail.com' },
        subject: `${title} - #${booking._id.toString().slice(-6)}`,
        htmlContent,
    });
};

// 4. Email pour laisser un avis
const sendReviewRequestEmail = async (user, booking, service) => {
    const reviewUrl = `${process.env.FRONTEND_URL}/my-bookings?reviewBookingId=${booking._id}`;
    const title = `⭐ Votre Avis Compte !`;
    const content = `
        <p>Votre prestation pour le service <strong>"${service.title}"</strong> est maintenant terminée. Nous espérons que tout s'est bien passé !</p>
        <p>Votre retour est précieux pour nous. Pourriez-vous prendre un instant pour laisser un avis ?</p>
        <p style="text-align:center; margin-top: 30px;">
            <a href="${reviewUrl}" class="button">Laisser un avis</a>
        </p>
    `;
    const htmlContent = generateHtmlTemplate(title, user.username, content);
    
    await apiInstance.sendTransacEmail({
        to: [{ email: user.email, name: user.username }],
        sender: { name: 'BATIClean Support', email: 'baticlean225@gmail.com' },
        subject: `Donnez votre avis sur la prestation "${service.title}"`,
        htmlContent,
    });
};

module.exports = {
    sendBookingConfirmationEmail,
    sendStatusUpdateEmail,
    sendCancellationEmail,
    sendReviewRequestEmail,
};