/*
 * Roman Urdu comments:
 * Ye service local chapter JSON files ko MongoDB question bank se sync karti hai.
 * Selected class/subject/chapter ke file path resolve hotay hain, JSON read hoti hai aur matching DB scope replace hota hai.
 */
const fs = require('fs');
const path = require('path');
const Question = require('../models/Question');

const questionBankDir = path.join(__dirname, '..', 'data', 'question-bank');

const normalizeArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const positiveInteger = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
};

const slugify = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

const classFolder = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === '1st year') return '1st-year';
  if (normalized === '2nd year') return '2nd-year';
  return slugify(value);
};

const chapterFilePath = ({ classLevel, subject, chapter }) =>
  path.join(questionBankDir, classFolder(classLevel), slugify(subject), `${slugify(chapter)}.json`);

const normalizeQuestion = (question, fallback) => ({
  classLevel: question.classLevel || fallback.classLevel,
  classId: question.classId || question.classLevel || fallback.classLevel,
  subject: question.subject || fallback.subject,
  subjectId: question.subjectId || question.subject || fallback.subject,
  chapter: question.chapter || fallback.chapterName || fallback.chapter,
  chapterNumber: positiveInteger(question.chapterNumber || question.chapterNo || question.unitNumber || fallback.chapterNumber) || undefined,
  chapterName: question.chapterName || question.chapter || fallback.chapterName || fallback.chapter,
  chapterId: question.chapterId || question.chapter || fallback.chapterName || fallback.chapter,
  type: question.type,
  question: question.question,
  options: Array.isArray(question.options) ? question.options : [],
  correctAnswer: question.correctAnswer || '',
  explanation: question.explanation || '',
  difficulty: question.difficulty || 'medium',
  marks: Number(question.marks || (question.type === 'long' ? 5 : question.type === 'short' ? 2 : 1)),
  isImportant: Boolean(question.isImportant),
  tags: Array.isArray(question.tags)
    ? question.tags
    : [fallback.classLevel, fallback.subject, fallback.chapter, question.type].filter(Boolean)
});

const selectedChapters = (filters) => {
  const chapters = normalizeArray(filters.chapters || filters.chapter);
  const chapterIds = normalizeArray(filters.chapterIds || filters.chapterId || chapters);
  return [...new Set(chapters.length ? chapters : chapterIds)];
};

const detailKey = (value) => slugify(value);

const selectedChapterDetails = (filters = {}) => {
  const details = Array.isArray(filters.chapterDetails) ? filters.chapterDetails : [];
  const byName = new Map();
  details.forEach((detail) => {
    const chapterName = detail?.chapterName || detail?.name;
    if (!chapterName) return;
    byName.set(detailKey(chapterName), {
      chapterNumber: positiveInteger(detail.chapterNumber || detail.number),
      chapterName
    });
  });
  return byName;
};

const syncQuestionBankFiles = async (filters = {}) => {
  const classLevel = filters.classLevel || filters.class || filters.classId;
  const subject = filters.subject || filters.subjectId;
  const chapters = selectedChapters(filters);
  const chapterDetailsByName = selectedChapterDetails(filters);

  if (!classLevel || !subject || !chapters.length) {
    return { syncedFiles: 0, inserted: 0, skipped: true };
  }

  let syncedFiles = 0;
  let inserted = 0;

  for (const chapter of chapters) {
    const chapterDetail = chapterDetailsByName.get(detailKey(chapter)) || {
      chapterNumber: positiveInteger(filters.chapterNumber),
      chapterName: chapter
    };
    const file = chapterFilePath({ classLevel, subject, chapter: chapterDetail.chapterName || chapter });
    if (!fs.existsSync(file)) continue;

    const raw = fs.readFileSync(file, 'utf8');
    const rows = JSON.parse(raw);
    if (!Array.isArray(rows) || !rows.length) continue;

    const docs = rows.map((question) =>
      normalizeQuestion(question, {
        classLevel,
        subject,
        chapter,
        chapterName: chapterDetail.chapterName || chapter,
        chapterNumber: chapterDetail.chapterNumber
      })
    );
    const scope = {
      classLevel: docs[0].classLevel,
      subject: docs[0].subject,
      chapter: docs[0].chapter
    };

    await Question.deleteMany({
      $or: [
        scope,
        {
          classId: scope.classLevel,
          subjectId: scope.subject,
          chapterId: scope.chapter
        }
      ]
    });
    await Question.insertMany(docs, { ordered: false });

    syncedFiles += 1;
    inserted += docs.length;
  }

  return { syncedFiles, inserted, skipped: false };
};

module.exports = {
  chapterFilePath,
  syncQuestionBankFiles,
  questionBankDir,
  slugify,
  classFolder
};
