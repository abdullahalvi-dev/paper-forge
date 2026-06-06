/*
 * Roman Urdu comments:
 * Ye file AI chatbot routes define karti hai.
 * Route JWT protected hai, AI rate-limit use karta hai, aur role checks controller me hotay hain.
 */
const express = require('express');
const { handleChatbotMessage, resetChatbotContext } = require('../controllers/chatbotController');
const protect = require('../middleware/authMiddleware');
const aiRateLimit = require('../middleware/aiRateLimit');

const router = express.Router();

router.post('/message', protect, aiRateLimit, handleChatbotMessage);
router.post('/reset', protect, resetChatbotContext);

module.exports = router;
