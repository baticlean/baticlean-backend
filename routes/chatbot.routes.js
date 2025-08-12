// backend/routes/chatbot.routes.js

const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { isAuthenticated } = require('../middleware/isAdmin.js');

// On configure l'accès à l'API avec notre clé secrète
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.post('/ask', isAuthenticated, async (req, res) => {
  try {
    const { message, history } = req.body; // On reçoit le message et l'historique

    if (!message) {
      return res.status(400).json({ message: 'Le message ne peut être vide.' });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // On donne ses instructions au bot !
    const systemPrompt = `
      Tu es un assistant virtuel pour BATIClean, une entreprise de services de nettoyage en Côte d'Ivoire.
      Ton nom est BATICleanBot.
      - Réponds toujours en français, de manière amicale et professionnelle.
      - Sois concis et va droit au but.
      - Ton but principal est d'aider les utilisateurs. Si tu ne connais pas la réponse, propose de créer un ticket pour parler à un humain.
      - Si on te demande les prix, les tarifs ou un devis, réponds que les informations sont sur la page des services et qu'un devis personnalisé peut être demandé en créant un ticket.
      - Ne réponds JAMAIS à des questions qui n'ont rien à voir avec BATIClean ou les services de nettoyage.
    `;

    // On reconstruit l'historique pour donner du contexte à l'IA
    const chatHistory = history.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    const chat = model.startChat({
      history: chatHistory,
      generationConfig: { temperature: 0.7 },
      systemInstruction: {
        role: "system",
        parts: [{text: systemPrompt}]
      },
    });

    const result = await chat.sendMessage(message);
    const response = result.response;
    const text = response.text();

    res.status(200).json({ reply: text });

  } catch (error) {
    console.error("Erreur de l'API Gemini:", error);
    res.status(500).json({ message: "Désolé, une erreur s'est produite avec notre assistant." });
  }
});

module.exports = router;