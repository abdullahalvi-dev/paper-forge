/*
 * Roman Urdu comments:
 * Ye controller authentication flow handle karta hai.
 * Register, login, current user profile, forgot password PIN, verify PIN aur reset password yahin se perform hotay hain.
 */
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const { sendResetPin } = require('../services/mailService');
const { getSubscriptionSnapshot } = require('../services/subscriptionService');
const { isSuperAdmin, isSuperAdminEmail, isTrustedAdmin, normalizeEmail } = require('../config/security');

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const isValidEmail = (value) => emailPattern.test(normalizeEmail(value));
const hasValidSuperAdminBootstrapKey = (providedKey) => {
  const expectedKey = String(process.env.SUPER_ADMIN_BOOTSTRAP_KEY || '').trim();
  const candidateKey = String(providedKey || '').trim();

  if (!expectedKey || !candidateKey || expectedKey.length !== candidateKey.length) return false;
  return crypto.timingSafeEqual(Buffer.from(candidateKey), Buffer.from(expectedKey));
};
const resolveRegistrationRole = (email, requestedRole) => {
  if (isSuperAdminEmail(email)) return 'super_admin';
  const safeRequestedRole = String(requestedRole || '').trim().toLowerCase();
  return ['student', 'teacher'].includes(safeRequestedRole) ? safeRequestedRole : 'student';
};

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  adminApproved: isTrustedAdmin(user),
  isSuperAdmin: isSuperAdmin(user),
  status: user.status,
  subscription: user.subscription,
  subscriptionStatus: user.subscriptionStatus || null,
  subscriptionPlan: user.subscriptionPlan || null,
  subscriptionEndDate: user.subscriptionEndDate || null,
  subscriptionRemainingDays: getSubscriptionSnapshot(user).remainingDays
});

const signResetToken = (user) =>
  jwt.sign({ id: user._id, purpose: 'password_reset' }, process.env.JWT_SECRET, {
    expiresIn: '10m'
  });

const register = async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    const role = resolveRegistrationRole(email, req.body.role);

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }
    if (isSuperAdminEmail(email) && !hasValidSuperAdminBootstrapKey(req.body.superAdminKey)) {
      return res.status(403).json({ message: 'Super admin registration is locked by server security' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role,
      adminApproved: ['admin', 'super_admin'].includes(role),
      roleAssignedAt: ['admin', 'super_admin'].includes(role) ? new Date() : undefined
    });
    await Subscription.create({ userId: user._id, plan: 'free', status: 'pending' });

    res.status(201).json({
      token: signToken(user),
      user: publicUser(user)
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Your account is inactive' });
    }

    res.json({
      token: signToken(user),
      user: publicUser(user)
    });
  } catch (error) {
    next(error);
  }
};

const me = async (req, res) => {
  res.json({ user: publicUser(req.user) });
};

const forgotPassword = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.status(400).json({ message: 'Email is required' });
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }

    const user = await User.findOne({ email }).select('+resetPin +pinExpiry');
    if (!user) {
      return res.json({ message: 'If this email exists, a PIN has been sent.' });
    }

    const pin = String(Math.floor(100000 + Math.random() * 900000));
    user.resetPin = pin;
    user.pinExpiry = new Date(Date.now() + 10 * 60 * 1000);
    user.resetTempToken = undefined;
    user.resetTempTokenExpiry = undefined;
    await user.save();

    const delivery = await sendResetPin(user.email, pin);
    res.json({
      message: 'Password reset PIN sent. It is valid for 10 minutes.',
      devPin: delivery.devPin
    });
  } catch (error) {
    next(error);
  }
};

const verifyPin = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { pin } = req.body;
    if (!email || !pin) return res.status(400).json({ message: 'Email and PIN are required' });
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }

    const user = await User.findOne({ email }).select('+resetPin +pinExpiry +resetTempToken +resetTempTokenExpiry');
    if (!user || user.resetPin !== String(pin) || !user.pinExpiry || user.pinExpiry.getTime() < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired PIN' });
    }

    const token = signResetToken(user);
    user.resetTempToken = crypto.createHash('sha256').update(token).digest('hex');
    user.resetTempTokenExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    res.json({ tempToken: token, message: 'PIN verified. You can reset your password now.' });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { tempToken, password } = req.body;
    if (!tempToken || !password) return res.status(400).json({ message: 'Temp token and password are required' });

    const decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    if (decoded.purpose !== 'password_reset') {
      return res.status(400).json({ message: 'Invalid reset token' });
    }

    const hashedToken = crypto.createHash('sha256').update(tempToken).digest('hex');
    const user = await User.findById(decoded.id).select('+resetTempToken +resetTempTokenExpiry +resetPin +pinExpiry +password');
    if (!user || user.resetTempToken !== hashedToken || user.resetTempTokenExpiry.getTime() < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    user.password = password;
    user.resetPin = undefined;
    user.pinExpiry = undefined;
    user.resetTempToken = undefined;
    user.resetTempTokenExpiry = undefined;
    await user.save();

    res.json({ message: 'Password reset successful. Please login.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  me,
  forgotPassword,
  verifyPin,
  resetPassword
};
