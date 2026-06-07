/*
 * Roman Urdu comments:
 * Ye controller authentication flow handle karta hai.
 * Register, login, current user profile, forgot password PIN, verify PIN aur reset password yahin se perform hotay hain.
 */
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const { sendRegistrationCode, sendResetPin } = require('../services/mailService');
const { getSubscriptionSnapshot } = require('../services/subscriptionService');
const { isSuperAdmin, isSuperAdminEmail, isTrustedAdmin, normalizeEmail } = require('../config/security');
const { assertEmailCanReceiveMail } = require('../services/emailSecurityService');

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const isValidEmail = (value) => emailPattern.test(normalizeEmail(value));
const registrationCodeTtlMinutes = () => Number(process.env.REGISTRATION_CODE_TTL_MINUTES || 10);
const registrationResendSeconds = () => Number(process.env.REGISTRATION_CODE_RESEND_SECONDS || 60);
const maxRegistrationVerifyAttempts = () => Number(process.env.REGISTRATION_MAX_VERIFY_ATTEMPTS || 5);
const isStrongPassword = (value) => /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/.test(String(value || ''));
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
const createPin = () => String(crypto.randomInt(100000, 1000000));
const hashCode = (email, code) =>
  crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(`${normalizeEmail(email)}:${String(code)}`)
    .digest('hex');
const hashChallenge = (token) => crypto.createHash('sha256').update(String(token || '')).digest('hex');
const safeEqual = (left, right) => {
  const a = Buffer.from(String(left || ''), 'hex');
  const b = Buffer.from(String(right || ''), 'hex');
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
};
const createRegistrationChallenge = (email) => {
  const code = createPin();
  const challengeToken = crypto.randomBytes(32).toString('hex');
  const ttlMinutes = registrationCodeTtlMinutes();
  return {
    code,
    challengeToken,
    ttlMinutes,
    codeHash: hashCode(email, code),
    challengeHash: hashChallenge(challengeToken),
    expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000)
  };
};
const pendingRegistrationSelect =
  '+emailVerificationCodeHash +emailVerificationChallengeHash +emailVerificationExpiresAt +emailVerificationSentAt +emailVerificationAttempts';
const ensureRegistrationCooldownPassed = (user) => {
  if (!user.emailVerificationSentAt) return;
  const retryAfterMs = registrationResendSeconds() * 1000 - (Date.now() - user.emailVerificationSentAt.getTime());
  if (retryAfterMs > 0) {
    const error = new Error(`Verification code already sent. Please retry after ${Math.ceil(retryAfterMs / 1000)} seconds.`);
    error.statusCode = 429;
    throw error;
  }
};
const buildVerificationResponse = ({ email, challengeToken, delivery, message }) => ({
  message,
  verificationRequired: true,
  email,
  challengeToken,
  expiresInSeconds: registrationCodeTtlMinutes() * 60,
  ...(delivery.devCode ? { devCode: delivery.devCode } : {})
});

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
  emailVerified: user.emailVerified !== false,
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
    const { email } = await assertEmailCanReceiveMail(req.body.email);
    const { password } = req.body;
    const role = resolveRegistrationRole(email, req.body.role);

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }
    if (name.length < 2 || name.length > 80) {
      return res.status(400).json({ message: 'Name must be between 2 and 80 characters.' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({ message: 'Password must be 8-72 characters and include at least one letter and one number.' });
    }
    if (isSuperAdminEmail(email) && !hasValidSuperAdminBootstrapKey(req.body.superAdminKey)) {
      return res.status(403).json({ message: 'Super admin registration is locked by server security' });
    }

    const existingUser = await User.findOne({ email }).select(pendingRegistrationSelect);
    if (existingUser && existingUser.emailVerified !== false) {
      return res.status(409).json({ message: 'Email already registered' });
    }
    if (existingUser) ensureRegistrationCooldownPassed(existingUser);

    const challenge = createRegistrationChallenge(email);
    const user = existingUser || new User({ email });
    user.name = name;
    user.password = password;
    user.role = role;
    user.status = 'inactive';
    user.emailVerified = false;
    user.emailVerifiedAt = undefined;
    user.adminApproved = ['admin', 'super_admin'].includes(role);
    user.roleAssignedAt = ['admin', 'super_admin'].includes(role) ? new Date() : undefined;
    user.emailVerificationCodeHash = challenge.codeHash;
    user.emailVerificationChallengeHash = challenge.challengeHash;
    user.emailVerificationExpiresAt = challenge.expiresAt;
    user.emailVerificationSentAt = new Date();
    user.emailVerificationAttempts = 0;

    await user.save();

    let delivery;
    try {
      delivery = await sendRegistrationCode(email, challenge.code, challenge.ttlMinutes);
    } catch (error) {
      await User.deleteOne({ _id: user._id, emailVerified: false });
      throw error;
    }

    res
      .status(202)
      .json(
        buildVerificationResponse({
          email,
          challengeToken: challenge.challengeToken,
          delivery,
          message: 'Verification code sent to your email. Please verify to activate your account.'
        })
      );
  } catch (error) {
    next(error);
  }
};

const verifyRegistrationEmail = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const pin = String(req.body.pin || req.body.code || '').trim();
    const challengeToken = String(req.body.challengeToken || '').trim();

    if (!email || !pin || !challengeToken) {
      return res.status(400).json({ message: 'Email, verification code and challenge token are required' });
    }
    if (!/^\d{6}$/.test(pin)) {
      return res.status(400).json({ message: 'Please enter the 6-digit verification code.' });
    }

    const user = await User.findOne({ email }).select(pendingRegistrationSelect);
    if (!user || user.emailVerified !== false) {
      return res.status(400).json({ message: 'No pending registration found for this email.' });
    }
    if (!safeEqual(hashChallenge(challengeToken), user.emailVerificationChallengeHash)) {
      return res.status(400).json({ message: 'Invalid verification session. Please register again.' });
    }
    if (!user.emailVerificationExpiresAt || user.emailVerificationExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: 'Verification code expired. Please request a new code.' });
    }
    if (Number(user.emailVerificationAttempts || 0) >= maxRegistrationVerifyAttempts()) {
      return res.status(429).json({ message: 'Too many wrong verification attempts. Please register again.' });
    }

    if (!safeEqual(hashCode(email, pin), user.emailVerificationCodeHash)) {
      user.emailVerificationAttempts = Number(user.emailVerificationAttempts || 0) + 1;
      await user.save();
      return res.status(400).json({ message: 'Invalid verification code.' });
    }

    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    user.status = 'active';
    user.emailVerificationCodeHash = undefined;
    user.emailVerificationChallengeHash = undefined;
    user.emailVerificationExpiresAt = undefined;
    user.emailVerificationSentAt = undefined;
    user.emailVerificationAttempts = 0;
    await user.save();

    await Subscription.findOneAndUpdate(
      { userId: user._id },
      { $setOnInsert: { plan: 'free', status: 'pending' } },
      { upsert: true, new: true }
    );

    res.json({
      token: signToken(user),
      user: publicUser(user),
      message: 'Email verified. Account activated.'
    });
  } catch (error) {
    next(error);
  }
};

const resendRegistrationCode = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const challengeToken = String(req.body.challengeToken || '').trim();
    if (!email || !challengeToken) {
      return res.status(400).json({ message: 'Email and challenge token are required' });
    }

    const user = await User.findOne({ email }).select(pendingRegistrationSelect);
    if (!user || user.emailVerified !== false) {
      return res.status(400).json({ message: 'No pending registration found for this email.' });
    }
    if (!safeEqual(hashChallenge(challengeToken), user.emailVerificationChallengeHash)) {
      return res.status(400).json({ message: 'Invalid verification session. Please register again.' });
    }
    ensureRegistrationCooldownPassed(user);

    const challenge = createRegistrationChallenge(email);
    user.emailVerificationCodeHash = challenge.codeHash;
    user.emailVerificationChallengeHash = challenge.challengeHash;
    user.emailVerificationExpiresAt = challenge.expiresAt;
    user.emailVerificationSentAt = new Date();
    user.emailVerificationAttempts = 0;
    await user.save();

    let delivery;
    try {
      delivery = await sendRegistrationCode(email, challenge.code, challenge.ttlMinutes);
    } catch (error) {
      user.emailVerificationSentAt = new Date(0);
      await user.save();
      throw error;
    }
    res.json(
      buildVerificationResponse({
        email,
        challengeToken: challenge.challengeToken,
        delivery,
        message: 'New verification code sent to your email.'
      })
    );
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

    if (user.emailVerified === false) {
      return res.status(403).json({ message: 'Please verify your email before login.' });
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
    if (!user || user.emailVerified === false) {
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
  resendRegistrationCode,
  verifyRegistrationEmail,
  login,
  me,
  forgotPassword,
  verifyPin,
  resetPassword
};
