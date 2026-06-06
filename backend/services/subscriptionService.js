/*
 * Roman Urdu comments:
 * Ye service subscription access rules handle karti hai.
 * Free trial consume karna, active plan validate karna, expiry calculate karna aur subscription snapshot banana yahan hota hai.
 */
const crypto = require('crypto');
const Stripe = require('stripe');
const PaymentTransaction = require('../models/PaymentTransaction');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const { getSettings } = require('./settingsService');

const dayMs = 24 * 60 * 60 * 1000;

const remainingDays = (date) => {
  if (!date) return 0;
  return Math.max(0, Math.ceil((new Date(date).getTime() - Date.now()) / dayMs));
};

const validateCardExpiry = (cardExpiry) => {
  const digits = String(cardExpiry || '').replace(/\D/g, '');
  if (digits.length !== 4) {
    const error = new Error('Card expiry date is required in MM / YY format.');
    error.statusCode = 400;
    throw error;
  }

  const month = Number(digits.slice(0, 2));
  const year = 2000 + Number(digits.slice(2));
  if (month < 1 || month > 12) {
    const error = new Error('Card expiry month must be between 01 and 12.');
    error.statusCode = 400;
    throw error;
  }

  const expiryEnd = new Date(year, month, 0, 23, 59, 59, 999);
  if (expiryEnd <= new Date()) {
    const error = new Error('Card expiry date must be greater than the current date.');
    error.statusCode = 400;
    throw error;
  }
};

const hasActiveSubscription = (user) =>
  user.role === 'admin' ||
  (user.subscriptionStatus === 'active' &&
    user.subscriptionEndDate &&
    new Date(user.subscriptionEndDate).getTime() > Date.now());

const getSubscriptionSnapshot = (user) => ({
  status: user.subscriptionStatus || null,
  plan: user.subscriptionPlan || null,
  startDate: user.subscriptionStartDate || null,
  endDate: user.subscriptionEndDate || null,
  remainingDays: remainingDays(user.subscriptionEndDate),
  trialUsedAt: user.trialUsedAt || null,
  active: hasActiveSubscription(user)
});

const syncSubscriptionDoc = async (user, extra = {}) => {
  await Subscription.findOneAndUpdate(
    { userId: user._id },
    {
      userId: user._id,
      plan: user.subscriptionPlan || extra.plan || 'free',
      status: user.subscriptionStatus || extra.status || 'pending',
      startDate: user.subscriptionStartDate,
      endDate: user.subscriptionEndDate,
      expiryDate: user.subscriptionEndDate,
      provider: extra.provider || null,
      amount: extra.amount || 0,
      currency: extra.currency || 'PKR',
      notes: extra.notes || ''
    },
    { upsert: true, new: true }
  );
};

const activateSubscription = async ({ userId, plan, provider = 'manual', transaction, startDate, endDate, notes }) => {
  const settings = await getSettings();
  const now = startDate ? new Date(startDate) : new Date();
  const duration = plan === 'yearly' ? 365 : 30;
  const end = endDate ? new Date(endDate) : new Date(now.getTime() + duration * dayMs);
  const amount = plan === 'yearly' ? settings.pricing.yearly : settings.pricing.monthly;

  const user = await User.findByIdAndUpdate(
    userId,
    {
      subscription: 'pro',
      subscriptionStatus: 'active',
      subscriptionPlan: plan,
      subscriptionStartDate: now,
      subscriptionEndDate: end
    },
    { new: true }
  );

  if (!user) throw new Error('User not found');

  await syncSubscriptionDoc(user, { provider, amount, notes, plan, status: 'active' });

  if (transaction) {
    transaction.status = 'succeeded';
    transaction.subscriptionStartDate = now;
    transaction.subscriptionEndDate = end;
    await transaction.save();
  }

  return user;
};

const consumeTrialOrRequireSubscription = async (user, feature) => {
  if (user.role === 'admin') return { allowed: true, reason: 'admin' };
  if (hasActiveSubscription(user)) return { allowed: true, reason: 'active_subscription' };

  if (!user.subscriptionStatus && !user.trialUsedAt) {
    user.subscriptionStatus = 'free_trial_used';
    user.subscription = 'free';
    user.trialUsedAt = new Date();
    await user.save();
    await syncSubscriptionDoc(user, { provider: 'trial', notes: `Trial used for ${feature}`, status: 'free_trial_used' });
    return { allowed: true, reason: 'trial_used' };
  }

  const error = new Error('Subscription required. Your one-time free trial has already been used.');
  error.statusCode = 402;
  error.code = 'SUBSCRIPTION_REQUIRED';
  error.subscription = getSubscriptionSnapshot(user);
  throw error;
};

const expireSubscriptions = async () => {
  const now = new Date();
  const users = await User.updateMany(
    { subscriptionStatus: 'active', subscriptionEndDate: { $lt: now } },
    { subscriptionStatus: 'expired', subscription: 'free' }
  );
  await Subscription.updateMany({ status: 'active', endDate: { $lt: now } }, { status: 'expired' });
  return users.modifiedCount || 0;
};

const createOrder = async (user, { plan = 'monthly', provider = 'stripe', cardExpiry } = {}) => {
  const settings = await getSettings();
  const amount = plan === 'yearly' ? settings.pricing.yearly : settings.pricing.monthly;
  const orderId = `PF-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  if (provider === 'demo') validateCardExpiry(cardExpiry);

  if (provider === 'stripe' && !process.env.STRIPE_SECRET_KEY) {
    const error = new Error('Stripe is not configured. Add STRIPE_SECRET_KEY or use demo/Jazzcash mode.');
    error.statusCode = 503;
    throw error;
  }

  const transaction = await PaymentTransaction.create({
    userId: user._id,
    provider: provider === 'jazzcash' ? 'jazzcash' : provider === 'stripe' ? 'stripe' : 'demo',
    plan,
    amount,
    orderId,
    currency: 'PKR'
  });

  if (provider === 'stripe' && process.env.STRIPE_SECRET_KEY) {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100,
      currency: 'pkr',
      metadata: {
        orderId,
        userId: String(user._id),
        plan
      },
      automatic_payment_methods: { enabled: true }
    });
    transaction.paymentIntentId = paymentIntent.id;
    transaction.rawPayload = { clientSecret: paymentIntent.client_secret };
    await transaction.save();

    return {
      provider: 'stripe',
      mode: 'stripe',
      orderId,
      clientSecret: paymentIntent.client_secret,
      amount,
      plan,
      subscription: getSubscriptionSnapshot(user)
    };
  }

  if (provider === 'jazzcash') {
    return {
      provider: 'jazzcash',
      mode: 'manual_jazzcash',
      orderId,
      amount,
      plan,
      jazzcash: settings.jazzcash,
      message: `Send ${amount} PKR to Jazzcash ${settings.jazzcash.number} (${settings.jazzcash.accountName}), then admin can activate manually.`
    };
  }

  const activated = await activateSubscription({ userId: user._id, plan, provider: 'demo', transaction });
  return {
    provider: 'demo',
    mode: 'instant_dev_payment',
    orderId,
    amount,
    plan,
    subscription: getSubscriptionSnapshot(activated),
    message: 'Development mode: payment marked successful instantly.'
  };
};

const handleStripeWebhook = async (payload) => {
  const object = payload?.data?.object || payload || {};
  if (object.status && object.status !== 'succeeded') return null;

  const metadata = object.metadata || payload?.metadata || {};
  const paymentIntentId = object.id || payload?.paymentIntentId;
  const transaction = await PaymentTransaction.findOne({
    $or: [{ orderId: metadata.orderId }, { paymentIntentId }]
  });

  if (!transaction) return null;
  if (transaction.status === 'succeeded') return User.findById(transaction.userId);

  return activateSubscription({
    userId: transaction.userId,
    plan: transaction.plan,
    provider: 'stripe',
    transaction
  });
};

const confirmStripePayment = async (paymentIntentId) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    const error = new Error('Stripe is not configured.');
    error.statusCode = 503;
    throw error;
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (paymentIntent.status !== 'succeeded') {
    const error = new Error(`Stripe payment is ${paymentIntent.status}.`);
    error.statusCode = 402;
    throw error;
  }

  const transaction = await PaymentTransaction.findOne({ paymentIntentId });
  if (!transaction) {
    const error = new Error('Payment transaction not found.');
    error.statusCode = 404;
    throw error;
  }
  if (transaction.status === 'succeeded') return User.findById(transaction.userId);

  return activateSubscription({
    userId: transaction.userId,
    plan: transaction.plan,
    provider: 'stripe',
    transaction
  });
};

module.exports = {
  activateSubscription,
  confirmStripePayment,
  consumeTrialOrRequireSubscription,
  createOrder,
  expireSubscriptions,
  getSubscriptionSnapshot,
  handleStripeWebhook,
  hasActiveSubscription,
  remainingDays
};
