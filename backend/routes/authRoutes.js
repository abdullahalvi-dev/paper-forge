/*
 * Roman Urdu comments:
 * Ye file authentication routes define karti hai.
 * Register, login, me/profile, forgot password, verify PIN aur reset password endpoints yahan map hotay hain.
 */
const express = require('express');
const { forgotPassword, login, me, register, resetPassword, verifyPin } = require('../controllers/authController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/verify-pin', verifyPin);
router.post('/reset-password', resetPassword);
router.get('/me', protect, me);

module.exports = router;
