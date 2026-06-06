/*
 * Roman Urdu comments:
 * Ye Mongoose model catalog records store karta hai.
 * Classes, subjects, chapters ya catalog type content ko parent-child structure ke sath save karta hai.
 */
const mongoose = require('mongoose');

const catalogSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ['class', 'subject', 'chapter'],
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    classLevel: {
      type: String,
      trim: true
    },
    subject: {
      type: String,
      trim: true
    },
    parentId: {
      type: String,
      trim: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

catalogSchema.index({ kind: 1, name: 1, classLevel: 1, subject: 1 }, { unique: false });

module.exports = mongoose.model('Catalog', catalogSchema);
