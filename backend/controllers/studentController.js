/*
 * Roman Urdu comments:
 * Ye controller student dashboard ka data provide karta hai.
 * Practice attempts, recent scores aur student progress summary yahan se return hoti hai.
 */
const Practice = require('../models/Practice');
const { generateQuestions, normalizeArray } = require('../services/aiEngine');
const { consumeTrialOrRequireSubscription } = require('../services/subscriptionService');
const { getSettings } = require('../services/settingsService');
const { createPracticeAttempt, hidePracticeAnswers } = require('../services/practiceService');

const normalizeAnswer = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const generatePractice = async (req, res, next) => {
  try {
    await consumeTrialOrRequireSubscription(req.user, 'practice_session');
    const practice = await createPracticeAttempt(req.user._id, req.body);
    res.status(201).json({ practice: hidePracticeAnswers(practice) });
  } catch (error) {
    next(error);
  }
};

const getPractice = async (req, res, next) => {
  try {
    const practice = await Practice.findById(req.params.id);
    if (!practice) return res.status(404).json({ message: 'Practice not found' });
    if (String(practice.studentId) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'You cannot access this practice test' });
    }

    res.json({ practice: hidePracticeAnswers(practice) });
  } catch (error) {
    next(error);
  }
};

const submitPractice = async (req, res, next) => {
  try {
    const practice = await Practice.findById(req.params.id);
    if (!practice) return res.status(404).json({ message: 'Practice not found' });
    if (String(practice.studentId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'You cannot submit this practice test' });
    }

    const submittedAnswers = Array.isArray(req.body.answers) ? req.body.answers : [];
    const answers = practice.questions.map((question) => {
      const submitted = submittedAnswers.find((item) => String(item.questionId) === String(question._id));
      const isCorrect =
        normalizeAnswer(submitted?.answer) !== '' &&
        normalizeAnswer(submitted?.answer) === normalizeAnswer(question.correctAnswer);

      return {
        questionId: String(question._id),
        answer: submitted?.answer || '',
        isCorrect,
        marksAwarded: isCorrect ? Number(question.marks || 0) : 0
      };
    });

    practice.answers = answers;
    practice.score = answers.reduce((sum, answer) => sum + Number(answer.marksAwarded || 0), 0);
    practice.timeTaken = Number(req.body.timeTaken || 0);
    practice.status = 'submitted';
    practice.submittedAt = new Date();
    await practice.save();

    res.json({ practice });
  } catch (error) {
    next(error);
  }
};

const getMcqPracticePool = async (req, res, next) => {
  try {
    const settings = await getSettings();
    const filters = {
      subject: req.query.subject,
      subjectId: req.query.subjectId || req.query.subject,
      classLevel: req.query.classLevel || req.query.classId,
      classId: req.query.classId || req.query.classLevel,
      chapters: normalizeArray(req.query.chapters || req.query.chapter),
      chapterIds: normalizeArray(req.query.chapterIds || req.query['chapterIds[]'] || req.query.chapters || req.query.chapter),
      questionTypes: ['mcq'],
      count: Number(req.query.limit || settings.paperLimits.practiceMcqLimit || 20)
    };
    const questions = await generateQuestions(filters);
    const durationSeconds = questions.length * 60;
    res.json({
      questions: questions.map((question) => ({
        ...question,
        correctAnswer: undefined,
        explanation: undefined
      })),
      durationSeconds,
      durationPerQuestion: settings.paperLimits.durationPerMcqSeconds || 60
    });
  } catch (error) {
    next(error);
  }
};

const practiceHistory = async (req, res, next) => {
  try {
    const practices = await Practice.find({ studentId: req.user._id }).sort({ createdAt: -1 }).limit(50);
    res.json({ practices });
  } catch (error) {
    next(error);
  }
};

const studentStats = async (req, res, next) => {
  try {
    const practices = await Practice.find({ studentId: req.user._id }).sort({ createdAt: -1 }).limit(20);
    const submitted = practices.filter((practice) => practice.status === 'submitted');
    const averageScore = submitted.length
      ? Math.round(
          submitted.reduce((sum, practice) => {
            const percent = practice.totalMarks ? (practice.score / practice.totalMarks) * 100 : 0;
            return sum + percent;
          }, 0) / submitted.length
        )
      : 0;

    res.json({
      stats: {
        attempts: submitted.length,
        inProgress: practices.length - submitted.length,
        averageScore,
        recentAttempts: practices.slice(0, 5)
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  generatePractice,
  getPractice,
  submitPractice,
  practiceHistory,
  studentStats,
  getMcqPracticePool
};
