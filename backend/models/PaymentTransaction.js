/*
 * Roman Urdu comments:
 * Ye Mongoose model payment transactions store karta hai.
 * Manual/card payment requests, amount, plan, provider, reference aur approval status yahan track hota hai.
 */
const mongoose = require('mongoose');

const paymentTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    provider: {
      type: String,
      enum: ['stripe', 'jazzcash', 'manual', 'demo'],
      default: 'demo'
    },
    plan: {
      type: String,
      enum: ['monthly', 'yearly', 'manual'],
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'PKR'
    },
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'cancelled'],
      default: 'pending',
      index: true
    },
    orderId: {
      type: String,
      index: true
    },
    paymentIntentId: {
      type: String,
      index: true
    },
    rawPayload: {
      type: Object,
      default: {}
    },
    subscriptionStartDate: Date,
    subscriptionEndDate: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model('PaymentTransaction', paymentTransactionSchema);
