/*
 * Roman Urdu comments:
 * Ye Mongoose model student practice attempts store karta hai.
 * Selected filters, attempted questions, answers, score aur timing details yahan save hotay hain.
 */
const mongoose = require('mongoose');

const practiceQuestionSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question'
    },
    subject: String,
    classId: String,
    subjectId: String,
    chapterId: String,
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
    marks: Number
  },
  { _id: true }
);

const practiceSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    filters: {
      subject: String,
      classId: String,
      subjectId: String,
      chapterIds: [String],
      chapterNumbers: [Number],
      chapterNames: [String],
      chapterDetails: [
        {
          chapterNumber: Number,
          chapterName: String
        }
      ],
      classLevel: String,
      chapters: [String],
      fullBook: Boolean,
      firstHalf: Boolean,
      secondHalf: Boolean,
      chapterRange: Boolean,
      chapterMode: String,
      difficulty: String,
      questionTypes: [String],
      count: Number
    },
    questions: {
      type: [practiceQuestionSchema],
      default: []
    },
    answers: {
      type: [
        {
          questionId: String,
          answer: String,
          isCorrect: Boolean,
          marksAwarded: Number
        }
      ],
      default: []
    },
    score: {
      type: Number,
      default: 0
    },
    totalMarks: {
      type: Number,
      default: 0
    },
    timeTaken: {
      type: Number,
      default: 0
    },
    durationSeconds: {
      type: Number,
      default: 0
    },
    durationPerQuestion: {
      type: Number,
      default: 60
    },
    startedAt: {
      type: Date,
      default: Date.now
    },
    submittedAt: {
      type: Date
    },
    status: {
      type: String,
      enum: ['in-progress', 'submitted'],
      default: 'in-progress'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Practice', practiceSchema);
