/*
 * Roman Urdu comments:
 * Ye script JSON question bank ko MongoDB mein import/upsert karti hai.
 * --replace use karne par selected class/subject/chapter scopes ke purane questions delete karke naye save hotay hain.
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const connectDB = require('../config/db');
const Question = require('../models/Question');
const User = require('../models/User');
const { normalizeQuestionPayload } = require('../services/paperService');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const args = process.argv.slice(2);
const replaceExisting = args.includes('--replace');
const positional = args.filter((arg) => arg !== '--replace');
const inputFile = positional[0] || path.join(__dirname, '..', 'data', 'questions.1000plus.json');
const ownerEmail = positional[1];

const run = async () => {
  await connectDB();

  const absolutePath = path.isAbsolute(inputFile) ? inputFile : path.join(process.cwd(), inputFile);
  const raw = fs.readFileSync(absolutePath, 'utf8');
  const parsed = JSON.parse(raw);
  const items = Array.isArray(parsed) ? parsed : parsed.questions;

  if (!Array.isArray(items) || !items.length) {
    throw new Error('Question file must contain an array or { "questions": [] }');
  }

  const owner = ownerEmail ? await User.findOne({ email: ownerEmail }) : null;
  const docs = items.map((item) => normalizeQuestionPayload(item, owner?._id));

  if (replaceExisting) {
    const scopes = docs.reduce((acc, doc) => {
      acc.set(`${doc.classLevel}|||${doc.subject}|||${doc.chapter}`, {
        classLevel: doc.classLevel,
        subject: doc.subject,
        chapter: doc.chapter
      });
      return acc;
    }, new Map());

    await Question.deleteMany({ $or: Array.from(scopes.values()) });
    console.log(`Deleted existing questions for ${scopes.size} class/subject/chapter scopes.`);
  }

  const operations = docs.map((doc) => ({
    updateOne: {
      filter: {
        classLevel: doc.classLevel,
        subject: doc.subject,
        chapter: doc.chapter,
        type: doc.type,
        question: doc.question
      },
      update: {
        $set: {
          options: doc.options,
          correctAnswer: doc.correctAnswer,
          explanation: doc.explanation,
          difficulty: doc.difficulty,
          marks: doc.marks,
          isImportant: doc.isImportant,
          tags: doc.tags,
          createdBy: doc.createdBy
        },
        $setOnInsert: {
          classLevel: doc.classLevel,
          subject: doc.subject,
          chapter: doc.chapter,
          type: doc.type,
          question: doc.question
        }
      },
      upsert: true
    }
  }));

  const result = await Question.bulkWrite(operations, { ordered: false });

  console.log(`Processed ${docs.length} questions from ${absolutePath}`);
  console.log(`Inserted: ${result.upsertedCount || 0}`);
  console.log(`Updated existing: ${result.modifiedCount || 0}`);
  process.exit(0);
};

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
