/*
 * Roman Urdu comments:
 * Ye controller paper aur question-bank APIs handle karta hai.
 * Is mein question filters, manual/bulk question CRUD, board paper generation, paper preview, PDF/DOC export aur paper history ka kaam hota hai.
 */
const Paper = require('../models/Paper');
const Question = require('../models/Question');
const { bulkCreateQuestions, createBoardPaper, createGeneratedPaper, createQuestion } = require('../services/paperService');
const { syncQuestionBankFiles } = require('../services/questionBankFileService');
const { createPdfBuffer, createWordBuffer } = require('../services/pdfService');
const { consumeTrialOrRequireSubscription } = require('../services/subscriptionService');
const { cleanQuestionText } = require('../utils/questionText');
const { isTrustedAdmin } = require('../config/security');

const countByType = (questions = []) => ({
  mcq: questions.filter((question) => question.type === 'mcq').length,
  short: questions.filter((question) => question.type === 'short').length,
  long: questions.filter((question) => question.type === 'long').length
});

const totalsByType = (questions = []) => ({
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

const getQuestionBank = async (req, res, next) => {
  try {
    const { subject, subjectId, classLevel, classId, chapter, chapterId, chapterName, chapterNumber, type, difficulty } = req.query;
    const chapterIds = req.query.chapterIds || req.query['chapterIds[]'];
    if ((classLevel || classId) && (subject || subjectId) && (chapter || chapterId || chapterIds)) {
      await syncQuestionBankFiles({
        classLevel: classLevel || classId,
        subject: subject || subjectId,
        chapter,
        chapterId,
        chapterIds,
        chapterName,
        chapterNumber
      });
    }
    const query = {};
    if (subject || subjectId) query.$or = [{ subject }, { subjectId: subjectId || subject }];
    if (classLevel || classId) {
      query.$and = query.$and || [];
      query.$and.push({ $or: [{ classLevel }, { classId: classId || classLevel }] });
    }
    if (chapter || chapterId || chapterIds || chapterName || chapterNumber) {
      const selected = []
        .concat(chapterIds || [])
        .concat(chapterId || [])
        .concat(chapter || [])
        .concat(chapterName || [])
        .flat()
        .filter(Boolean);
      const selectedNumbers = []
        .concat(chapterNumber || [])
        .flat()
        .map(Number)
        .filter((number) => Number.isInteger(number) && number > 0);
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { chapter: { $in: selected } },
          { chapterId: { $in: selected } },
          { chapterName: { $in: selected } },
          ...(selectedNumbers.length ? [{ chapterNumber: { $in: selectedNumbers } }] : [])
        ]
      });
    }
    if (type) query.type = type;
    if (difficulty) query.difficulty = difficulty;

    const requestedLimit = Number(req.query.limit || 500);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 5000) : 500;
    const questions = await Question.find(query).sort({ createdAt: -1 }).limit(limit);
    res.json({ questions });
  } catch (error) {
    next(error);
  }
};

const addQuestion = async (req, res, next) => {
  try {
    const question = await createQuestion(req.body, req.user._id);
    res.status(201).json({ question });
  } catch (error) {
    next(error);
  }
};

const bulkAddQuestions = async (req, res, next) => {
  try {
    const items = Array.isArray(req.body) ? req.body : req.body.questions;
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ message: 'Send an array of questions' });
    }

    const questions = await bulkCreateQuestions(items, req.user._id);
    res.status(201).json({ inserted: questions.length, questions });
  } catch (error) {
    next(error);
  }
};

const updateQuestion = async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) return res.status(404).json({ message: 'Question not found' });

    const allowed = [
      'classLevel',
      'classId',
      'subject',
      'subjectId',
      'chapter',
      'chapterNumber',
      'chapterName',
      'chapterId',
      'type',
      'question',
      'options',
      'correctAnswer',
      'difficulty',
      'marks',
      'explanation',
      'isImportant',
      'tags'
    ];
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) question[field] = req.body[field];
    });

    await question.save();
    res.json({ question });
  } catch (error) {
    next(error);
  }
};

const deleteQuestion = async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) return res.status(404).json({ message: 'Question not found' });
    await question.deleteOne();
    res.json({ message: 'Question deleted' });
  } catch (error) {
    next(error);
  }
};

const generatePaper = async (req, res, next) => {
  try {
    await consumeTrialOrRequireSubscription(req.user, 'paper_generation');
    const paper =
      req.body.mode || req.body.type === 'full' || req.body.mcqCount || req.body.shortCount || req.body.longCount
        ? await createBoardPaper(req.user._id, req.body)
        : await createGeneratedPaper(req.user._id, req.body);
    res.status(201).json({ paper });
  } catch (error) {
    next(error);
  }
};

const createPaper = async (req, res, next) => {
  try {
    const paper = await Paper.create({
      teacherId: req.user._id,
      title: req.body.title || 'Manual Paper',
      subject: req.body.subject,
      classLevel: req.body.classLevel || req.body.class,
      chapters: req.body.chapters || [],
      chapterNumbers: req.body.chapterNumbers || [],
      chapterNames: req.body.chapterNames || [],
      chapterDetails: req.body.chapterDetails || [],
      chapterNumber: req.body.chapterNumber,
      chapterName: req.body.chapterName,
      fullBook: Boolean(req.body.fullBook),
      firstHalf: Boolean(req.body.firstHalf),
      secondHalf: Boolean(req.body.secondHalf),
      chapterRange: Boolean(req.body.chapterRange),
      chapterMode:
        req.body.chapterMode ||
        (req.body.fullBook
          ? 'Full Book'
          : req.body.firstHalf
            ? 'First Half Book'
            : req.body.secondHalf
              ? 'Second Half Book'
              : req.body.chapterRange
                ? 'Chapter Range'
                : 'Selected Chapters'),
      difficulty: req.body.difficulty || 'mixed',
      questions: req.body.questions || [],
      marks: req.body.marks || 100,
      marksPerQuestion: req.body.marksPerQuestion,
      sectionTotals: req.body.sectionTotals,
      typeCounts: req.body.typeCounts,
      questionCounts: req.body.questionCounts || req.body.typeCounts,
      generatedByAI: false
    });

    res.status(201).json({ paper });
  } catch (error) {
    next(error);
  }
};

const listPapers = async (req, res, next) => {
  try {
    const query = isTrustedAdmin(req.user) ? {} : { teacherId: req.user._id };
    const papers = await Paper.find(query).sort({ createdAt: -1 }).populate('teacherId', 'name email');
    res.json({ papers });
  } catch (error) {
    next(error);
  }
};

const getPaper = async (req, res, next) => {
  try {
    const paper = await Paper.findById(req.params.id).populate('teacherId', 'name email');
    if (!paper) return res.status(404).json({ message: 'Paper not found' });

    const ownsPaper = String(paper.teacherId._id || paper.teacherId) === String(req.user._id);
    if (!ownsPaper && !isTrustedAdmin(req.user)) {
      return res.status(403).json({ message: 'You cannot access this paper' });
    }

    res.json({ paper });
  } catch (error) {
    next(error);
  }
};

const updatePaper = async (req, res, next) => {
  try {
    const paper = await Paper.findById(req.params.id);
    if (!paper) return res.status(404).json({ message: 'Paper not found' });

    if (String(paper.teacherId) !== String(req.user._id) && !isTrustedAdmin(req.user)) {
      return res.status(403).json({ message: 'You cannot update this paper' });
    }

    const allowed = [
      'title',
      'subject',
      'classLevel',
      'chapters',
      'chapterNumbers',
      'chapterNames',
      'chapterDetails',
      'chapterNumber',
      'chapterName',
      'fullBook',
      'firstHalf',
      'secondHalf',
      'chapterRange',
      'chapterMode',
      'difficulty',
      'questions',
      'marks',
      'marksPerQuestion',
      'sectionTotals',
      'typeCounts',
      'questionCounts'
    ];
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) paper[field] = req.body[field];
    });

    if (req.body.questions !== undefined) {
      paper.typeCounts = countByType(paper.questions);
      paper.sectionTotals = totalsByType(paper.questions);
      paper.marks = paper.sectionTotals.mcq + paper.sectionTotals.short + paper.sectionTotals.long;
    }

    await paper.save();
    res.json({ paper });
  } catch (error) {
    next(error);
  }
};

const deletePaper = async (req, res, next) => {
  try {
    const paper = await Paper.findById(req.params.id);
    if (!paper) return res.status(404).json({ message: 'Paper not found' });

    if (String(paper.teacherId) !== String(req.user._id) && !isTrustedAdmin(req.user)) {
      return res.status(403).json({ message: 'You cannot delete this paper' });
    }

    await paper.deleteOne();
    res.json({ message: 'Paper deleted' });
  } catch (error) {
    next(error);
  }
};

const downloadPaper = async (req, res, next) => {
  try {
    const { format } = req.params;
    const paper = await Paper.findById(req.params.id);
    if (!paper) return res.status(404).json({ message: 'Paper not found' });

    if (String(paper.teacherId) !== String(req.user._id) && !isTrustedAdmin(req.user)) {
      return res.status(403).json({ message: 'You cannot download this paper' });
    }

    const buffer = format === 'word' ? await createWordBuffer(paper) : await createPdfBuffer(paper);
    paper.downloads[format === 'word' ? 'word' : 'pdf'] += 1;
    await paper.save();

    const extension = format === 'word' ? 'docx' : 'pdf';
    const contentType =
      format === 'word'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/pdf';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="paper-forge-${paper._id}.${extension}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

const printPaper = async (req, res, next) => {
  try {
    const paper = await Paper.findById(req.params.id);
    if (!paper) return res.status(404).send('Paper not found');

    if (String(paper.teacherId) !== String(req.user._id) && !isTrustedAdmin(req.user)) {
      return res.status(403).send('You cannot print this paper');
    }

    const groups = {
      mcq: paper.questions.filter((question) => question.type === 'mcq'),
      short: paper.questions.filter((question) => question.type === 'short'),
      long: paper.questions.filter((question) => question.type === 'long')
    };

    const escape = (value) =>
      String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const formatMarks = (value) => {
      const number = Number(value || 0);
      return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/\.?0+$/, '');
    };

    const paperChapterDetails = () => {
      const details = Array.isArray(paper.chapterDetails) ? paper.chapterDetails : [];
      if (details.length) {
        return details.map((detail) => ({
          chapterNumber: detail.chapterNumber,
          chapterName: detail.chapterName
        }));
      }
      const names = paper.chapterNames?.length ? paper.chapterNames : paper.chapters || [];
      const numbers = paper.chapterNumbers || [];
      return names.map((name, index) => ({
        chapterNumber: numbers[index],
        chapterName: name
      }));
    };

    const chapterDetails = paperChapterDetails();
    const chapterNoText = chapterDetails.map((detail) => detail.chapterNumber).filter(Boolean).join(', ') || '-';
    const chapterNameText = chapterDetails.map((detail) => detail.chapterName).filter(Boolean).join(', ') || 'All';

    const sectionStats = (type, questions) => {
      const marksEach = Number(paper.marksPerQuestion?.[type] || questions[0]?.marks || 0);
      const total = questions.reduce((sum, question) => sum + Number(question.marks || 0), 0);
      const allSame = questions.every((question) => Number(question.marks || 0) === marksEach);
      return questions.length && marksEach && allSame
        ? `${questions.length}*${formatMarks(marksEach)}=${formatMarks(total)} marks`
        : `Total = ${formatMarks(total)} marks`;
    };

    const importantPrefix = (question) => (question.isImportant ? '* ' : '');

    const renderSection = (title, type, questions, options = false) => {
      if (!questions.length) return '';
      return `
        <section>
          <h2 class="section-heading"><span>${title}</span><span>${sectionStats(type, questions)}</span></h2>
          ${questions
            .map(
              (question, index) => `
                <div class="question">
                  <p><strong>${index + 1}.</strong> ${escape(importantPrefix(question))}${escape(cleanQuestionText(question.question))}</p>
                  ${
                    options
                      ? `<div class="options">${(question.options || [])
                          .slice(0, 4)
                          .map((option, optionIndex) => `<span>(${String.fromCharCode(65 + optionIndex)}) ${escape(option)}</span>`)
                          .join('')}</div>`
                      : ''
                  }
                </div>
              `
            )
            .join('')}
        </section>
      `;
    };

    const renderMcqAnswerKey = () => {
      if (!groups.mcq.length) return '';
      return `
        <section class="answer-key">
          <h2>MCQ Answer Key</h2>
          <ol>
            ${groups.mcq
              .map((question) => {
                const optionIndex = (question.options || []).findIndex((option) => option === question.correctAnswer);
                const label = optionIndex >= 0 ? `${String.fromCharCode(65 + optionIndex)}. ` : '';
                return `<li>${escape(label)}${escape(question.correctAnswer || 'Teacher review required')}</li>`;
              })
              .join('')}
          </ol>
        </section>
      `;
    };

    res.send(`<!doctype html>
      <html>
        <head>
          <title>${escape(paper.title)}</title>
          <style>
            @page { size: A4; margin: 16mm; }
            body { font-family: "Times New Roman", Times, serif; color: #000; background: #fff; }
            .paper { border: 2px solid #000; padding: 18px; min-height: 260mm; }
            header { text-align: center; border-bottom: 1px solid #000; margin-bottom: 14px; padding-bottom: 10px; }
            h1 { font-size: 20px; margin: 0 0 4px; }
            h2 { font-size: 15px; text-decoration: underline; margin-top: 18px; }
            .meta { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; }
            .instructions { font-size: 12px; margin: 8px 0; }
            .section-heading { display: flex; justify-content: space-between; gap: 16px; align-items: baseline; }
            .section-heading span:last-child { font-size: 13px; white-space: nowrap; }
            .question { break-inside: avoid; margin: 8px 0 12px; }
            .question p { margin: 0 0 6px; }
            .options { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px 18px; }
            .answer-key { break-before: page; }
            .answer-key li { margin-bottom: 6px; }
            .actions { position: fixed; right: 16px; top: 16px; }
            button { padding: 8px 12px; }
            @media print { .actions { display: none; } }
          </style>
        </head>
        <body>
          <div class="actions"><button onclick="window.print()">Print</button></div>
          <main class="paper">
            <header>
              <h1>${escape(paper.schoolName || 'School / College Name')}</h1>
              <div>${escape(paper.examTitle || paper.title)}</div>
              <div class="meta"><span>Class: ${escape(paper.classLevel)}</span><span>Subject: ${escape(paper.subject)}</span></div>
              <div class="meta"><span>Chapter No: ${escape(chapterNoText)}</span><span>Chapter Name: ${escape(chapterNameText)}</span></div>
              <div class="meta"><span>Time: ${escape(paper.timeAllowed || '3 Hours')}</span><span>Total Marks: ${formatMarks(paper.marks)}</span></div>
            </header>
            <div class="instructions"><strong>Instructions:</strong> ${(paper.instructions || []).map(escape).join(' ')}</div>
            ${renderSection('SECTION A - MCQs', 'mcq', groups.mcq, true)}
            ${renderSection('SECTION B - Short Questions', 'short', groups.short)}
            ${renderSection('SECTION C - Long Questions', 'long', groups.long)}
            ${renderMcqAnswerKey()}
          </main>
        </body>
      </html>`);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getQuestionBank,
  addQuestion,
  bulkAddQuestions,
  updateQuestion,
  deleteQuestion,
  generatePaper,
  createPaper,
  listPapers,
  getPaper,
  updatePaper,
  deletePaper,
  downloadPaper,
  printPaper
};
