/*
 * Roman Urdu comments:
 * Ye script existing generated papers ke MCQ answers sync/fix karti hai.
 * Question bank se matching MCQ correctAnswer dhoondh kar paper documents update karta hai.
 */
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const Paper = require('../models/Paper');
const Question = require('../models/Question');

dotenv.config();

const normalize = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();

const makeKey = (question) =>
  [
    normalize(question.classLevel || question.classId),
    normalize(question.subject || question.subjectId),
    normalize(question.chapter || question.chapterId),
    normalize(question.question)
  ].join('|');

const syncPaperMcqAnswers = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/paper_forge';
  await mongoose.connect(uri);
  console.log('MongoDB connected');

  const bankMcqs = await Question.find({ type: 'mcq' }).lean();
  const bankByKey = new Map(bankMcqs.map((question) => [makeKey(question), question]));

  let papersScanned = 0;
  let papersUpdated = 0;
  let questionsSynced = 0;

  const cursor = Paper.find({ 'questions.type': 'mcq' }).cursor();
  for await (const paper of cursor) {
    papersScanned += 1;
    let changed = false;

    paper.questions.forEach((paperQuestion) => {
      if (paperQuestion.type !== 'mcq') return;
      const source = bankByKey.get(makeKey(paperQuestion));
      if (!source) return;

      const sameOptions = JSON.stringify(paperQuestion.options || []) === JSON.stringify(source.options || []);
      const sameAnswer = paperQuestion.correctAnswer === source.correctAnswer;
      if (sameOptions && sameAnswer) return;

      paperQuestion.options = source.options || [];
      paperQuestion.correctAnswer = source.correctAnswer || '';
      paperQuestion.explanation = source.explanation || paperQuestion.explanation || '';
      changed = true;
      questionsSynced += 1;
    });

    if (changed) {
      paper.markModified('questions');
      await paper.save();
      papersUpdated += 1;
    }
  }

  console.log(`Papers scanned: ${papersScanned}`);
  console.log(`Papers updated: ${papersUpdated}`);
  console.log(`MCQ answers synced: ${questionsSynced}`);

  await mongoose.disconnect();
};

syncPaperMcqAnswers().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
