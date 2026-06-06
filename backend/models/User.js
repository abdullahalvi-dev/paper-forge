/*
 * Roman Urdu comments:
 * Ye Mongoose model users store karta hai.
 * Name, email, hashed password, role, status aur subscription fields ke sath login/profile data manage hota hai.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      match: [emailPattern, 'Please enter a valid email address'],
      trim: true
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false
    },
    role: {
      type: String,
      enum: ['student', 'teacher', 'admin'],
      default: 'student'
    },
    adminApproved: {
      type: Boolean,
      default: false
    },
    roleAssignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    roleAssignedAt: {
      type: Date
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    },
    subscription: {
      type: String,
      enum: ['free', 'pro'],
      default: 'free'
    },
    subscriptionStatus: {
      type: String,
      enum: ['free_trial_used', 'active', 'expired', 'cancelled', 'pending', null],
      default: null
    },
    subscriptionPlan: {
      type: String,
      enum: ['monthly', 'yearly', 'manual', null],
      default: null
    },
    subscriptionStartDate: {
      type: Date
    },
    subscriptionEndDate: {
      type: Date
    },
    trialUsedAt: {
      type: Date
    },
    resetPin: {
      type: String,
      select: false
    },
    pinExpiry: {
      type: Date,
      select: false
    },
    resetTempToken: {
      type: String,
      select: false
    },
    resetTempTokenExpiry: {
      type: Date,
      select: false
    },
    assignedSubjects: {
      type: [String],
      default: []
    },
    assignedChapters: {
      type: [String],
      default: []
    }
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
