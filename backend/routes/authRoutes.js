/*
 * Roman Urdu comments:
 * Ye file authentication routes define karti hai.
 * Register, login, me/profile, forgot password, verify PIN aur reset password endpoints yahan map hotay hain.
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  forgotPassword,
  login,
  me,
  register,
  resendRegistrationCode,
  resetPassword,
  verifyPin,
  verifyRegistrationEmail
} = require('../controllers/authController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();
const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many registration attempts. Please try again later.' }
});
const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 25,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many verification attempts. Please try again later.' }
});

router.post('/register', registrationLimiter, register);
router.post('/verify-registration-email', verificationLimiter, verifyRegistrationEmail);
router.post('/resend-registration-code', registrationLimiter, resendRegistrationCode);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/verify-pin', verifyPin);
router.post('/reset-password', resetPassword);
router.get('/me', protect, me);

module.exports = router;
