/*
 * Roman Urdu comments:
 * Ye Mongoose model uploaded study resources store karta hai.
 * PDF/file metadata, class, subject, chapter aur uploader reference yahan save hotay hain.
 */
const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['past-paper', 'book'],
      required: true,
      index: true
    },
    classLevel: {
      type: String,
      trim: true,
      index: true
    },
    subject: {
      type: String,
      trim: true,
      index: true
    },
    chapter: {
      type: String,
      trim: true
    },
    fileUrl: {
      type: String,
      required: true
    },
    fileName: {
      type: String,
      default: ''
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Resource', resourceSchema);
