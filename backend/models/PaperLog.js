/*
 * Roman Urdu comments:
 * Ye Mongoose model paper generation audit logs store karta hai.
 * Kis user ne kis mode, class, subject aur chapter se paper generate kiya, ye activity tracking ke liye save hota hai.
 */
const mongoose = require('mongoose');

const paperLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    paperId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Paper'
    },
    action: {
      type: String,
      default: 'generated'
    },
    mode: String,
    classLevel: String,
    subject: String,
    chapters: [String],
    chapterNumbers: [Number],
    chapterNames: [String],
    chapterDetails: [
      {
        chapterNumber: Number,
        chapterName: String
      }
    ],
    typeCounts: {
      mcq: Number,
      short: Number,
      long: Number
    },
    marksPerQuestion: {
      mcq: Number,
      short: Number,
      long: Number
    },
    sectionTotals: {
      mcq: Number,
      short: Number,
      long: Number
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('PaperLog', paperLogSchema);
