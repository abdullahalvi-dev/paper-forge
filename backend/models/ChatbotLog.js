/*
 * Roman Urdu comments:
 * Ye model chatbot ki har user request aur backend response ka audit log store karta hai.
 * Admin is se dekh sakta hai ke kis user ne kya prompt diya, parser ne kya samjha,
 * confirmation/generation ka status kya tha, aur agar error aya to reason kya tha.
 */
const mongoose = require('mongoose');

const chatbotLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    role: {
      type: String,
      default: 'student'
    },
    message: {
      type: String,
      default: ''
    },
    intent: {
      type: String,
      default: 'unknown',
      index: true
    },
    parsed: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    responseMessage: {
      type: String,
      default: ''
    },
    needsFollowUp: {
      type: Boolean,
      default: false
    },
    confirmationRequired: {
      type: Boolean,
      default: false
    },
    action: {
      type: String,
      default: 'message',
      index: true
    },
    status: {
      type: String,
      default: 'info',
      index: true
    },
    paperId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Paper'
    },
    practiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Practice'
    },
    summary: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    error: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

chatbotLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ChatbotLog', chatbotLogSchema);
