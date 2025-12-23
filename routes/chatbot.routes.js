// baticlean/baticlean-backend/routes/chatbot.routes.js
const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { isAuthenticated } = require('../middleware/isAdmin.js');

// Initialisation sécurisée
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("⚠️ ATTENTION : La variable GEMINI_API_KEY est manquante dans Render !");
}
const genAI = new GoogleGenerativeAI(apiKey || "NO_KEY");

router.post('/ask', isAuthenticated, async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ message: 'Le message est vide ou invalide.' });
    }

    // 1. Configuration du Modèle
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const systemPrompt = `
      Tu es BATICleanBot, l'assistant virtuel expert de l'entreprise BATIClean en Côte d'Ivoire.
      
      TES DIRECTIVES :
      - Réponds TOUJOURS en français, de manière chaleureuse, polie et professionnelle.
      - Tes réponses doivent être concises (max 3-4 phrases sauf si nécessaire).
      - Tu es là pour aider sur : le nettoyage, l'entretien, la désinsectisation, et le fonctionnement du site.
      - PRIX & DEVIS : Ne donne JAMAIS de prix inventés. Dis : "Pour obtenir un tarif précis, veuillez consulter notre page Services ou créer une demande spécifique via un ticket."
      - SI TU NE SAIS PAS : Dis "Je ne suis pas sûr de cette information. Je vous invite à créer un ticket support pour parler à un de nos agents humains."
      - Ne sors JAMAIS du contexte des services de nettoyage/BTP.
    `;

    // 2. Nettoyage et Formatage de l'Historique (CRUCIAL pour éviter les crashs Gemini)
    // L'API Google plante si : message vide, ou si l'utilisateur parle 2 fois de suite sans réponse du modèle.
    let formattedHistory = [];
    if (Array.isArray(history)) {
      formattedHistory = history
        .filter(msg => msg.text && msg.text.trim() !== '') // Enlever messages vides
        .map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }]
        }));
    }

    // 3. Lancement du Chat
    const chat = model.startChat({
      history: formattedHistory,
      generationConfig: { 
        temperature: 0.7,
        maxOutputTokens: 500, // Limite la longueur pour éviter les longs monologues
      },
      systemInstruction: {
        role: "system",
        parts: [{ text: systemPrompt }]
      },
    });

    console.log(`🤖 IA : Traitement de la question "${message.substring(0, 20)}..."`);

    // 4. Envoi du message
    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.text();

    res.status(200).json({ reply: text });

  } catch (error) {
    console.error("❌ ERREUR CHATBOT (Gemini) :", error.message);
    
    // Gestion spécifique des erreurs
    if (error.message.includes('API key')) {
      return res.status(500).json({ message: "Erreur de configuration interne (API Key manquante)." });
    }
    
    res.status(500).json({ message: "Je rencontre une petite difficulté technique pour le moment. Essayez de reformuler ou revenez plus tard." });
  }
});

module.exports = router;