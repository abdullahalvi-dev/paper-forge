/*
 * Roman Urdu comments:
 * Ye service paper generation ka core business logic handle karti hai.
 * Question normalize/create, chapter-wise file sync, custom/full paper selection, round-robin chapter distribution, marks aur logs yahan manage hotay hain.
 */
const Paper = require('../models/Paper');
const Question = require('../models/Question');
const { generateQuestions, normalizeArray } = require('./aiEngine');
const PaperLog = require('../models/PaperLog');
const { getSettings } = require('./settingsService');
const { syncQuestionBankFiles } = require('./questionBankFileService');
const { cleanQuestionText } = require('../utils/questionText');
const {
  PAPER_QUESTION_LIMITS,
  getQuestionCountLimitViolations,
  formatQuestionLimitMessage
} = require('../utils/questionLimits');

const normalizeQuestionPayload = (payload, userId) => ({
  subject: payload.subject,
  subjectId: payload.subjectId || payload.subject,
  classLevel: payload.classLevel || payload.class,
  classId: payload.classId || payload.classLevel || payload.class,
  chapter: payload.chapter,
  chapterNumber: positiveInteger(payload.chapterNumber || payload.chapterNo || payload.unitNumber) || undefined,
  chapterName: payload.chapterName || payload.chapter,
  chapterId: payload.chapterId || payload.chapter,
  type: payload.type,
  question: payload.question,
  options: normalizeArray(payload.options),
  correctAnswer: payload.correctAnswer || '',
  explanation: payload.explanation || '',
  difficulty: payload.difficulty || 'medium',
  marks: Number(payload.marks || 1),
  isImportant: Boolean(payload.isImportant),
  tags: normalizeArray(payload.tags),
  createdBy: userId
});

const createQuestion = async (payload, userId) => {
  const questionPayload = normalizeQuestionPayload(payload, userId);
  return Question.create(questionPayload);
};

const bulkCreateQuestions = async (items, userId) => {
  const questions = items.map((item) => normalizeQuestionPayload(item, userId));
  return Question.insertMany(questions, { ordered: false });
};

const shuffle = (items) => [...items].sort(() => Math.random() - 0.5);

const defaultMarksPerQuestion = {
  mcq: 1,
  short: 3,
  long: 5
};

const positiveNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

const positiveInteger = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
};

const getMarksPerQuestion = (payload = {}) => ({
  mcq: positiveNumber(payload.marksPerQuestion?.mcq ?? payload.mcqMarks, defaultMarksPerQuestion.mcq),
  short: positiveNumber(payload.marksPerQuestion?.short ?? payload.shortMarks, defaultMarksPerQuestion.short),
  long: positiveNumber(payload.marksPerQuestion?.long ?? payload.longMarks, defaultMarksPerQuestion.long)
});

const defaultFullPaperCounts = {
  mcq: 100,
  short: 50,
  long: 20
};

const getFullPaperCounts = (settings = {}) => ({
  mcq: Math.min(positiveNumber(settings.paperLimits?.fullPaper?.mcq, defaultFullPaperCounts.mcq), PAPER_QUESTION_LIMITS.mcq),
  short: Math.min(positiveNumber(settings.paperLimits?.fullPaper?.short, defaultFullPaperCounts.short), PAPER_QUESTION_LIMITS.short),
  long: Math.min(positiveNumber(settings.paperLimits?.fullPaper?.long, defaultFullPaperCounts.long), PAPER_QUESTION_LIMITS.long)
});

const selectedChaptersFromPayload = (payload = {}) => {
  const chapters = normalizeArray(payload.chapters || payload.chapter);
  const chapterIds = normalizeArray(payload.chapterIds || payload.chapterId || chapters);
  return [...new Set(chapters.length ? chapters : chapterIds)];
};

const chapterDetailsFromPayload = (payload = {}) => {
  const details = Array.isArray(payload.chapterDetails) ? payload.chapterDetails : [];
  const chapters = selectedChaptersFromPayload(payload);
  const chapterNames = normalizeArray(payload.chapterNames || payload.chapterName || chapters);
  const chapterNumbers = normalizeArray(payload.chapterNumbers || payload.chapterNumber)
    .map(positiveInteger)
    .filter(Boolean);

  const candidates = details.length
    ? details.map((detail) => ({
        chapterNumber: positiveInteger(detail.chapterNumber || detail.number),
        chapterName: detail.chapterName || detail.name || ''
      }))
    : (chapterNames.length ? chapterNames : chapters).map((chapterName, index) => ({
        chapterNumber: chapterNumbers[index] || 0,
        chapterName
      }));

  const seen = new Set();
  return candidates
    .map((detail) => ({
      chapterNumber: positiveInteger(detail.chapterNumber),
      chapterName: String(detail.chapterName || '').trim()
    }))
    .filter((detail) => detail.chapterNumber || detail.chapterName)
    .filter((detail) => {
      const key = `${detail.chapterNumber}:${detail.chapterName.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const chapterDetailFor = (payload = {}, chapter = '', index = 0) => {
  const details = chapterDetailsFromPayload(payload);
  return (
    details.find((detail) => detail.chapterName === chapter) ||
    details.find((detail) => detail.chapterName.toLowerCase() === String(chapter || '').toLowerCase()) ||
    details[index] ||
    { chapterNumber: 0, chapterName: chapter }
  );
};

const applyMarksPerQuestion = (questions, marksPerQuestion) =>
  questions.map((question) => ({
    ...question,
    marks: marksPerQuestion[question.type] || question.marks || defaultMarksPerQuestion[question.type] || 1
  }));

const toPaperQuestion = (question) => ({
  questionId: question._id,
  classId: question.classId,
  subjectId: question.subjectId,
  chapterId: question.chapterId,
  subject: question.subject,
  classLevel: question.classLevel,
  chapter: question.chapter,
  chapterNumber: question.chapterNumber,
  chapterName: question.chapterName || question.chapter,
  type: question.type,
  question: cleanQuestionText(question.question),
  options: question.options || [],
  correctAnswer: question.correctAnswer || '',
  explanation: question.explanation || '',
  difficulty: question.difficulty,
  marks: question.marks || (question.type === 'long' ? 5 : question.type === 'short' ? 2 : 1),
  isImportant: false
});

const buildQuestionQuery = (payload, type) => {
  const classLevel = payload.classLevel || payload.class;
  const classId = payload.classId || classLevel;
  const subject = payload.subject;
  const subjectId = payload.subjectId || subject;
  const chapters = normalizeArray(payload.chapters || payload.chapter);
  const chapterIds = normalizeArray(payload.chapterIds || payload.chapterId || chapters);
  const chapterNames = normalizeArray(payload.chapterNames || payload.chapterName || chapters);
  const chapterNumbers = normalizeArray(payload.chapterNumbers || payload.chapterNumber)
    .map(positiveInteger)
    .filter(Boolean);
  const query = { type };

  if (classId || classLevel) query.$or = [{ classId }, { classLevel }];
  if (subjectId || subject) {
    query.$and = query.$and || [];
    query.$and.push({ $or: [{ subjectId }, { subject }] });
  }
  if (chapterIds.length || chapters.length || chapterNames.length || chapterNumbers.length) {
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { chapterId: { $in: chapterIds.length ? chapterIds : chapters } },
        { chapter: { $in: chapters.length ? chapters : chapterIds } },
        { chapterName: { $in: chapterNames.length ? chapterNames : chapters } },
        ...(chapterNumbers.length ? [{ chapterNumber: { $in: chapterNumbers } }] : [])
      ]
    });
  }

  return query;
};

const selectFullModeQuestions = async (payload) => {
  const settings = await getSettings();
  const counts = getFullPaperCounts(settings);
  const selected = [];

  for (const type of ['mcq', 'short', 'long']) {
    const questions = await selectCustomTypeQuestions(payload, type, counts[type]);
    selected.push(...questions.map(toPaperQuestion));
  }

  return selected;
};

const takeRoundRobinFromChapters = (buckets, count) => {
  const selected = [];
  const activeBuckets = shuffle(buckets.filter((bucket) => bucket.questions.length));

  while (selected.length < count && activeBuckets.some((bucket) => bucket.questions.length)) {
    for (const bucket of activeBuckets) {
      const question = bucket.questions.shift();
      if (question) selected.push(question);
      if (selected.length === count) break;
    }
  }

  return selected;
};

const selectCustomTypeQuestions = async (payload, type, count) => {
  const selectedChapters = selectedChaptersFromPayload(payload);

  if (!selectedChapters.length) {
    const questions = await Question.find(buildQuestionQuery(payload, type)).lean();
    return shuffle(questions).slice(0, count);
  }

  const buckets = [];

  for (const [index, chapter] of selectedChapters.entries()) {
    const detail = chapterDetailFor(payload, chapter, index);
    const queryPayload = {
      ...payload,
      chapters: [detail.chapterName || chapter],
      chapterIds: [detail.chapterName || chapter],
      chapterNames: [detail.chapterName || chapter],
      chapterNumbers: detail.chapterNumber ? [detail.chapterNumber] : []
    };
    const questions = await Question.find(buildQuestionQuery(queryPayload, type)).lean();
    buckets.push({ chapter, questions: shuffle(questions) });
  }

  const available = buckets.reduce((sum, bucket) => sum + bucket.questions.length, 0);
  if (available < count) {
    const error = new Error(
      `Only ${available} ${type.toUpperCase()} questions are available for selected filters, but ${count} were requested.`
    );
    error.statusCode = 400;
    error.code = 'INSUFFICIENT_QUESTIONS';
    error.available = available;
    error.requested = count;
    error.questionType = type;
    throw error;
  }

  return takeRoundRobinFromChapters(buckets, count);
};

const selectCustomModeQuestions = async (payload) => {
  const counts = {
    mcq: Number(payload.mcqCount || payload.counts?.mcq || 0),
    short: Number(payload.shortCount || payload.counts?.short || 0),
    long: Number(payload.longCount || payload.counts?.long || 0)
  };

  if (!counts.mcq && !counts.short && !counts.long) {
    const error = new Error('Custom paper needs at least one MCQ, short, or long question count.');
    error.statusCode = 400;
    throw error;
  }

  const limitViolations = getQuestionCountLimitViolations(counts);
  if (limitViolations.length) {
    const error = new Error(formatQuestionLimitMessage(limitViolations));
    error.statusCode = 400;
    error.code = 'QUESTION_LIMIT_EXCEEDED';
    error.violations = limitViolations;
    throw error;
  }

  const selected = [];

  for (const type of ['mcq', 'short', 'long']) {
    if (!counts[type]) continue;
    const questions = await selectCustomTypeQuestions(payload, type, counts[type]);
    selected.push(...questions.map(toPaperQuestion));
  }

  return selected;
};

const orderedQuestions = (questions) => {
  const order = { mcq: 1, short: 2, long: 3 };
  return [...questions].sort((a, b) => order[a.type] - order[b.type]);
};

const countByType = (questions) => ({
  mcq: questions.filter((question) => question.type === 'mcq').length,
  short: questions.filter((question) => question.type === 'short').length,
  long: questions.filter((question) => question.type === 'long').length
});

const totalsByType = (questions) => ({
  mcq: questions
    .filter((question) => question.type === 'mcq')
    .reduce((sum, question) => sum + Number(question.marks || 0), 0),
  short: questions
    .filter((question) => question.type === 'short')
    .reduce((sum, question) => sum + Number(question.marks || 0), 0),
  long: questions
    .filter((question) => question.type === 'long')
    .reduce((sum, question) => sum + Number(question.marks || 0), 0)
});

const createBoardPaper = async (userId, payload) => {
  const mode = payload.mode === 'full' || payload.type === 'full' ? 'full' : 'custom';
  await syncQuestionBankFiles(payload);
  const marksPerQuestion = getMarksPerQuestion(payload);
  const questions = applyMarksPerQuestion(
    orderedQuestions(mode === 'full' ? await selectFullModeQuestions(payload) : await selectCustomModeQuestions(payload)),
    marksPerQuestion
  );

  if (!questions.length) {
    const error = new Error('No questions found for the selected chapters and paper settings.');
    error.statusCode = 404;
    throw error;
  }

  const typeCounts = countByType(questions);
  const sectionTotals = totalsByType(questions);
  const marks = questions.reduce((sum, question) => sum + Number(question.marks || 0), 0);
  const classLevel = payload.classLevel || payload.class || payload.classId;
  const subject = payload.subject || payload.subjectId;
  const chapters = normalizeArray(payload.chapters || payload.chapter);
  const chapterIds = normalizeArray(payload.chapterIds || payload.chapterId || chapters);
  const chapterDetails = chapterDetailsFromPayload(payload);
  const chapterNames = chapterDetails.map((detail) => detail.chapterName).filter(Boolean);
  const chapterNumbers = chapterDetails.map((detail) => detail.chapterNumber).filter(Boolean);
  const questionCounts = {
    mcq: Number(payload.questionCounts?.mcq ?? payload.counts?.mcq ?? payload.mcqCount ?? typeCounts.mcq ?? 0),
    short: Number(payload.questionCounts?.short ?? payload.counts?.short ?? payload.shortCount ?? typeCounts.short ?? 0),
    long: Number(payload.questionCounts?.long ?? payload.counts?.long ?? payload.longCount ?? typeCounts.long ?? 0)
  };
  const paper = await Paper.create({
    teacherId: userId,
    title: payload.title || `${subject} Board Style Paper`,
    examTitle: payload.examTitle || payload.title || 'Board Examination',
    schoolName: payload.schoolName || 'School / College Name',
    timeAllowed: payload.timeAllowed || '3 Hours',
    instructions: payload.instructions || undefined,
    subject,
    subjectId: payload.subjectId || subject,
    classLevel,
    classId: payload.classId || classLevel,
    chapters: chapterNames.length ? chapterNames : chapters,
    chapterIds,
    chapterNames,
    chapterNumbers,
    chapterDetails,
    chapterName: chapterNames.length === 1 ? chapterNames[0] : undefined,
    chapterNumber: chapterNumbers.length === 1 ? chapterNumbers[0] : undefined,
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
    questions,
    marks,
    marksPerQuestion,
    sectionTotals,
    generatedByAI: true,
    mode,
    typeCounts,
    questionCounts
  });

  await PaperLog.create({
    userId,
    paperId: paper._id,
    mode,
    classLevel,
    subject,
    chapters: chapterNames.length ? chapterNames : chapters,
    chapterNames,
    chapterNumbers,
    chapterDetails,
    typeCounts,
    marksPerQuestion,
    sectionTotals
  });

  return paper;
};

const createGeneratedPaper = async (teacherId, payload) => {
  const questions = await generateQuestions(payload);

  if (!questions.length) {
    const error = new Error('No questions found for the selected filters. Add questions to the question bank first.');
    error.statusCode = 404;
    throw error;
  }

  const chapterDetails = chapterDetailsFromPayload(payload);
  const chapterNames = chapterDetails.map((detail) => detail.chapterName).filter(Boolean);
  const chapterNumbers = chapterDetails.map((detail) => detail.chapterNumber).filter(Boolean);

  return Paper.create({
    teacherId,
    title: payload.title || `${payload.subject} ${payload.classLevel || payload.class} Paper`,
    subject: payload.subject,
    classLevel: payload.classLevel || payload.class,
    chapters: chapterNames.length ? chapterNames : normalizeArray(payload.chapters || payload.chapter),
    chapterNames,
    chapterNumbers,
    chapterDetails,
    chapterName: chapterNames.length === 1 ? chapterNames[0] : undefined,
    chapterNumber: chapterNumbers.length === 1 ? chapterNumbers[0] : undefined,
    difficulty: payload.difficulty || 'mixed',
    questions,
    marks: Number(payload.marks || questions.reduce((sum, question) => sum + Number(question.marks || 0), 0)),
    generatedByAI: true
  });
};

module.exports = {
  createQuestion,
  bulkCreateQuestions,
  createBoardPaper,
  createGeneratedPaper,
  normalizeQuestionPayload
};
