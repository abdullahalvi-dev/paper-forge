/*
 * Roman Urdu comments:
 * Ye service practice test create karne ka reusable logic rakhti hai.
 * Student controller aur chatbot dono isi service ko use karte hain taa ke behavior same rahe.
 */
const Practice = require('../models/Practice');
const { generateQuestions, normalizeArray } = require('./aiEngine');
const { getSettings } = require('./settingsService');

const hidePracticeAnswers = (practice) => {
  const practiceObject = practice.toObject ? practice.toObject() : practice;
  if (practiceObject.status === 'submitted') return practiceObject;

  practiceObject.questions = practiceObject.questions.map((question) => ({
    ...question,
    correctAnswer: undefined,
    explanation: undefined
  }));

  return practiceObject;
};

const createPracticeAttempt = async (userId, payload = {}) => {
  const settings = await getSettings();
  const filters = {
    subject: payload.subject,
    subjectId: payload.subjectId || payload.subject,
    classLevel: payload.classLevel || payload.class,
    classId: payload.classId || payload.classLevel || payload.class,
    chapters: normalizeArray(payload.chapters || payload.chapter),
    chapterIds: normalizeArray(payload.chapterIds || payload.chapterId || payload.chapters || payload.chapter),
    chapterNames: normalizeArray(payload.chapterNames || payload.chapterName || payload.chapters || payload.chapter),
    chapterNumbers: normalizeArray(payload.chapterNumbers || payload.chapterNumber),
    chapterDetails: Array.isArray(payload.chapterDetails) ? payload.chapterDetails : [],
    fullBook: Boolean(payload.fullBook),
    firstHalf: Boolean(payload.firstHalf),
    secondHalf: Boolean(payload.secondHalf),
    chapterRange: Boolean(payload.chapterRange),
    chapterMode:
      payload.chapterMode ||
      (payload.fullBook
        ? 'Full Book'
        : payload.firstHalf
          ? 'First Half Book'
          : payload.secondHalf
            ? 'Second Half Book'
            : payload.chapterRange
              ? 'Chapter Range'
              : 'Selected Chapters'),
    difficulty: payload.difficulty || 'mixed',
    questionTypes: ['mcq'],
    count: Number(payload.count || payload.mcqCount || payload.limit || payload.numberOfQuestions || settings.paperLimits.practiceMcqLimit || 20)
  };

  const questions = await generateQuestions(filters);
  if (!questions.length) {
    const error = new Error('No practice questions found for the selected filters');
    error.statusCode = 404;
    error.code = 'NO_QUESTIONS_FOUND';
    throw error;
  }
  if (questions.length < filters.count) {
    const error = new Error(
      `Only ${questions.length} MCQ questions are available for selected filters, but ${filters.count} were requested.`
    );
    error.statusCode = 400;
    error.code = 'INSUFFICIENT_QUESTIONS';
    error.available = questions.length;
    error.requested = filters.count;
    error.questionType = 'mcq';
    throw error;
  }

  const totalMarks = questions.reduce((sum, question) => sum + Number(question.marks || 0), 0);
  const durationSeconds = questions.length * 60;
  return Practice.create({
    studentId: userId,
    filters,
    questions,
    totalMarks,
    durationSeconds,
    durationPerQuestion: settings.paperLimits.durationPerMcqSeconds || 60
  });
};

module.exports = {
  createPracticeAttempt,
  hidePracticeAnswers
};
