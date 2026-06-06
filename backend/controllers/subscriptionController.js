/*
 * Roman Urdu comments:
 * Ye controller subscription aur payment related APIs handle karta hai.
 * Plans, checkout/manual payment request, admin approval aur user subscription status ka flow yahin manage hota hai.
 */
const PaymentTransaction = require('../models/PaymentTransaction');
const User = require('../models/User');
const {
  activateSubscription,
  confirmStripePayment,
  createOrder,
  expireSubscriptions,
  getSubscriptionSnapshot,
  handleStripeWebhook
} = require('../services/subscriptionService');
const { getSettings } = require('../services/settingsService');
const { isSuperAdminEmail } = require('../config/security');

const status = async (req, res, next) => {
  try {
    const settings = await getSettings();
    res.json({
      subscription: getSubscriptionSnapshot(req.user),
      plans: {
        monthly: settings.pricing.monthly,
        yearly: settings.pricing.yearly
      },
      jazzcash: settings.jazzcash,
      stripe: {
        enabled: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY),
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || ''
      }
    });
  } catch (error) {
    next(error);
  }
};

const confirmStripe = async (req, res, next) => {
  try {
    const user = await confirmStripePayment(req.body.paymentIntentId);
    res.json({ user, subscription: getSubscriptionSnapshot(user), message: 'Stripe payment confirmed.' });
  } catch (error) {
    next(error);
  }
};

const createSubscriptionOrder = async (req, res, next) => {
  try {
    const order = await createOrder(req.user, {
      plan: req.body.plan || 'monthly',
      provider: req.body.provider || 'demo',
      cardExpiry: req.body.cardExpiry
    });
    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
};

const webhook = async (req, res, next) => {
  try {
    const user = await handleStripeWebhook(req.body);
    res.json({ received: true, activatedUserId: user?._id || null });
  } catch (error) {
    next(error);
  }
};

const listPayments = async (req, res, next) => {
  try {
    const query = isSuperAdminEmail(req.user.email) ? {} : { userId: req.user._id };
    const payments = await PaymentTransaction.find(query).sort({ createdAt: -1 }).populate('userId', 'name email role');
    res.json({ payments });
  } catch (error) {
    next(error);
  }
};

const manualOverride = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const activated = await activateSubscription({
      userId: user._id,
      plan: req.body.plan || 'manual',
      provider: 'manual',
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      notes: req.body.notes || 'Manual admin override'
    });

    res.json({ user: activated, subscription: getSubscriptionSnapshot(activated) });
  } catch (error) {
    next(error);
  }
};

const expireNow = async (req, res, next) => {
  try {
    const expired = await expireSubscriptions();
    res.json({ expired });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSubscriptionOrder,
  confirmStripe,
  expireNow,
  listPayments,
  manualOverride,
  status,
  webhook
};
