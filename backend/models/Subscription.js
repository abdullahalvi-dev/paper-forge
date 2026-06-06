/*
 * Roman Urdu comments:
 * Ye Mongoose model user subscription records store karta hai.
 * Plan, status, expiry, trial state aur payment relation yahan maintain hotay hain.
 */
const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    plan: {
      type: String,
      enum: ['free', 'pro', 'monthly', 'yearly', 'manual'],
      default: 'free'
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'pending', 'free_trial_used'],
      default: 'active'
    },
    startDate: {
      type: Date
    },
    endDate: {
      type: Date
    },
    expiryDate: {
      type: Date
    },
    provider: {
      type: String,
      enum: ['manual', 'stripe', 'jazzcash', 'trial', 'demo', null],
      default: null
    },
    amount: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: 'PKR'
    },
    notes: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Subscription', subscriptionSchema);
