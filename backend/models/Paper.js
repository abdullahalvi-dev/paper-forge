/*
 * Roman Urdu comments:
 * Ye Mongoose model generated papers store karta hai.
 * Paper metadata, selected chapters, marks, section totals, questions aur teacher reference is schema mein save hotay hain.
 */
const mongoose = require('mongoose');

const paperQuestionSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question'
    },
    classId: String,
    subjectId: String,
    chapterId: String,
    subject: String,
    classLevel: String,
    chapter: String,
    chapterNumber: Number,
    chapterName: String,
    type: String,
    question: String,
    options: [String],
    correctAnswer: String,
    explanation: String,
    difficulty: String,
    marks: Number,
    isImportant: Boolean
  },
  { _id: true }
);

const paperSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      default: 'Untitled Paper',
      trim: true
    },
    subject: {
      type: String,
      required: true,
      trim: true
    },
    classLevel: {
      type: String,
      required: true,
      trim: true
    },
    classId: String,
    subjectId: String,
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
    chapterNumber: Number,
    chapterName: String,
    chapterIds: {
      type: [String],
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
    chapterMode: {
      type: String,
      default: 'Selected Chapters'
    },
    examTitle: {
      type: String,
      default: 'Board Examination'
    },
    schoolName: {
      type: String,
      default: 'School / College Name'
    },
    timeAllowed: {
      type: String,
      default: '3 Hours'
    },
    instructions: {
      type: [String],
      default: [
        'Read all questions carefully.',
        'Attempt sections in the given order.',
        'Write answers neatly and show working where required.'
      ]
    },
    mode: {
      type: String,
      enum: ['full', 'custom', 'legacy'],
      default: 'legacy'
    },
    typeCounts: {
      mcq: {
        type: Number,
        default: 0
      },
      short: {
        type: Number,
        default: 0
      },
      long: {
        type: Number,
        default: 0
      }
    },
    questionCounts: {
      mcq: {
        type: Number,
        default: 0
      },
      short: {
        type: Number,
        default: 0
      },
      long: {
        type: Number,
        default: 0
      }
    },
    marksPerQuestion: {
      mcq: {
        type: Number,
        default: 1
      },
      short: {
        type: Number,
        default: 3
      },
      long: {
        type: Number,
        default: 5
      }
    },
    sectionTotals: {
      mcq: {
        type: Number,
        default: 0
      },
      short: {
        type: Number,
        default: 0
      },
      long: {
        type: Number,
        default: 0
      }
    },
    difficulty: {
      type: String,
      default: 'mixed'
    },
    questions: {
      type: [paperQuestionSchema],
      default: []
    },
    marks: {
      type: Number,
      default: 100
    },
    generatedByAI: {
      type: Boolean,
      default: true
    },
    downloads: {
      pdf: {
        type: Number,
        default: 0
      },
      word: {
        type: Number,
        default: 0
      }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Paper', paperSchema);
