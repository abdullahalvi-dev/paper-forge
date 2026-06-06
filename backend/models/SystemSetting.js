/*
 * Roman Urdu comments:
 * Ye Mongoose model system-wide settings store karta hai.
 * Paper limits, payment settings aur platform config ko admin panel se update karne ke liye use hota hai.
 */
const mongoose = require('mongoose');

const systemSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true
    },
    value: {
      type: Object,
      default: {}
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('SystemSetting', systemSettingSchema);
