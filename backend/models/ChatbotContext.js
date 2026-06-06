/*
 * Roman Urdu comments:
 * Ye model har user ka pending chatbot context save karta hai.
 * Agar user pehle class/subject/chapter bataye aur next message me counts de,
 * to chatbot isi context ko merge karke paper/practice generate karta hai.
 */
const mongoose = require('mongoose');

const chatbotContextSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    role: {
      type: String,
      enum: ['student', 'teacher', 'admin'],
      default: 'student'
    },
    intent: {
      type: String,
      default: 'unknown'
    },
    classLevel: {
      type: String,
      default: ''
    },
    subject: {
      type: String,
      default: ''
    },
    chapters: {
      type: [String],
      default: []
    },
    chapterNumbers: {
      type: [Number],
      default: []
    },
    chapterNames: {
      type: [String],
      default: []
    },
    chapterDetails: {
      type: [
        {
          chapterNumber: Number,
          chapterName: String
        }
      ],
      default: []
    },
    fullBook: {
      type: Boolean,
      default: false
    },
    firstHalf: {
      type: Boolean,
      default: false
    },
    secondHalf: {
      type: Boolean,
      default: false
    },
    chapterRange: {
      type: Boolean,
      default: false
    },
    mcqCount: {
      type: Number,
      default: 0
    },
    shortCount: {
      type: Number,
      default: 0
    },
    longCount: {
      type: Number,
      default: 0
    },
    questionCounts: {
      type: Map,
      of: Number,
      default: {}
    },
    questionTypes: {
      type: [String],
      default: []
    },
    marks: {
      mcq: {
        type: Number,
        default: 1
      },
      short: {
        type: Number,
        default: 2
      },
      long: {
        type: Number,
        default: 5
      }
    },
    difficulty: {
      type: String,
      default: 'mixed'
    },
    language: {
      type: String,
      default: 'english'
    },
    generationMode: {
      type: String,
      default: 'question_bank'
    },
    missingFields: {
      type: [String],
      default: []
    },
    awaitingConfirmation: {
      type: Boolean,
      default: false
    },
    state: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

chatbotContextSchema.index({ updatedAt: 1 });

module.exports = mongoose.model('ChatbotContext', chatbotContextSchema);
