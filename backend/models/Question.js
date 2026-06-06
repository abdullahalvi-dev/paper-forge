/*
 * Roman Urdu comments:
 * Ye Mongoose model question bank ka main schema hai.
 * Class, subject, chapter, type, options, correct answer, marks, difficulty aur important flag yahan define hotay hain.
 */
const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    subjectId: {
      type: String,
      trim: true,
      index: true
    },
    classLevel: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    classId: {
      type: String,
      trim: true,
      index: true
    },
    chapter: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    chapterNumber: {
      type: Number,
      min: 1,
      index: true
    },
    chapterName: {
      type: String,
      trim: true,
      index: true
    },
    chapterId: {
      type: String,
      trim: true,
      index: true
    },
    type: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    question: {
      type: String,
      required: true,
      trim: true
    },
    options: {
      type: [String],
      default: []
    },
    correctAnswer: {
      type: String,
      trim: true,
      default: ''
    },
    explanation: {
      type: String,
      trim: true,
      default: ''
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
      index: true
    },
    marks: {
      type: Number,
      default: 1,
      min: 0
    },
    isImportant: {
      type: Boolean,
      default: false
    },
    tags: {
      type: [String],
      default: []
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

questionSchema.index({
    subject: 1,
    classLevel: 1,
    chapter: 1,
    chapterNumber: 1,
    chapterName: 1,
    classId: 1,
    subjectId: 1,
    chapterId: 1,
    type: 1,
    difficulty: 1
});

module.exports = mongoose.model('Question', questionSchema);
