/*
 * Roman Urdu comments:
 * Ye service question selection/generation engine ke helper functions provide karti hai.
 * Filters normalize karna, question query banana, random selection aur fallback generation yahan handle hota hai.
 */
const Question = require('../models/Question');
const { syncQuestionBankFiles } = require('./questionBankFileService');
const { cleanQuestionText } = require('../utils/questionText');

const normalizeArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const shuffle = (items) => [...items].sort(() => Math.random() - 0.5);

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const positiveInteger = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
};

const uniqueByQuestionText = (questions) => {
  const seen = new Set();
  return questions.filter((question) => {
    const key = normalizeText(question.question);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const buildQuery = ({
  classLevel,
  classId,
  subject,
  subjectId,
  chapters,
  chapterIds,
  chapterId,
  chapterNames,
  chapterName,
  chapterNumbers,
  chapterNumber,
  questionTypes,
  difficulty
}) => {
  const query = {};

  if (classLevel || classId) {
    query.$and = query.$and || [];
    query.$and.push({ $or: [{ classLevel }, { classId: classId || classLevel }] });
  }
  if (subject || subjectId) {
    query.$and = query.$and || [];
    query.$and.push({ $or: [{ subject }, { subjectId: subjectId || subject }] });
  }

  const chapterList = normalizeArray(chapters);
  const chapterIdList = normalizeArray(chapterIds || chapterId);
  const chapterNameList = normalizeArray(chapterNames || chapterName || chapterList);
  const chapterNumberList = normalizeArray(chapterNumbers || chapterNumber)
    .map(positiveInteger)
    .filter(Boolean);
  if (chapterList.length || chapterIdList.length || chapterNameList.length || chapterNumberList.length) {
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { chapter: { $in: chapterList.length ? chapterList : chapterIdList } },
        { chapterId: { $in: chapterIdList.length ? chapterIdList : chapterList } },
        { chapterName: { $in: chapterNameList.length ? chapterNameList : chapterList } },
        ...(chapterNumberList.length ? [{ chapterNumber: { $in: chapterNumberList } }] : [])
      ]
    });
  }

  const typeList = normalizeArray(questionTypes);
  if (typeList.length) query.type = { $in: typeList };

  if (difficulty && difficulty !== 'mixed') {
    query.difficulty = difficulty;
  }

  return query;
};

const prioritizeQuestions = (questions) => {
  const important = shuffle(questions.filter((question) => question.isImportant));
  const regular = shuffle(questions.filter((question) => !question.isImportant));
  return [...important, ...regular];
};

const spreadByType = (questions, count) => {
  const buckets = questions.reduce((acc, question) => {
    acc[question.type] = acc[question.type] || [];
    acc[question.type].push(question);
    return acc;
  }, {});

  const selected = [];
  const types = Object.keys(buckets);

  while (selected.length < count && types.some((type) => buckets[type].length)) {
    for (const type of types) {
      const next = buckets[type].shift();
      if (next) selected.push(next);
      if (selected.length === count) break;
    }
  }

  return selected;
};

const assignMarks = (questions, totalMarks) => {
  if (!totalMarks || Number(totalMarks) <= 0 || questions.length === 0) {
    return questions.map((question) => ({ ...question, marks: question.marks || 1 }));
  }

  const baseMarks = Math.floor(Number(totalMarks) / questions.length);
  let remaining = Number(totalMarks) - baseMarks * questions.length;

  return questions.map((question) => {
    const marks = baseMarks + (remaining > 0 ? 1 : 0);
    remaining -= remaining > 0 ? 1 : 0;
    return { ...question, marks };
  });
};

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
  marks: question.marks || 1,
  isImportant: false
});

const generateQuestions = async (filters) => {
  await syncQuestionBankFiles(filters);
  const count = Math.max(Number(filters.count || filters.numberOfQuestions || 10), 1);
  const query = buildQuery(filters);
  const rawQuestions = await Question.find(query).lean();
  const uniqueQuestions = uniqueByQuestionText(rawQuestions);
  const prioritized = prioritizeQuestions(uniqueQuestions);
  const selected = spreadByType(prioritized, count);
  const formatted = selected.map(toPaperQuestion);

  return assignMarks(formatted, filters.marks);
};

module.exports = {
  generateQuestions,
  normalizeArray
};
