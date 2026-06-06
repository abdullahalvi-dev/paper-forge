/*
 * Roman Urdu comments:
 * Ye script chapter-wise JSON question files ko combine karti hai.
 * Validation ke baad questions.1000plus.json aur question-bank index rebuild hota hai.
 */
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const questionBankDir = path.join(dataDir, 'question-bank');
const outputFile = path.join(dataDir, 'questions.1000plus.json');
const indexFile = path.join(questionBankDir, 'index.json');

const collectJsonFiles = (directory) => {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  entries.forEach((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJsonFiles(fullPath));
      return;
    }

    if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'index.json') {
      files.push(fullPath);
    }
  });

  return files.sort((left, right) => left.localeCompare(right));
};

const validateQuestion = (question, file, index) => {
  const required = ['classLevel', 'subject', 'chapter', 'type', 'question'];
  const missing = required.filter((field) => !question[field]);
  if (missing.length) {
    throw new Error(`${file} item ${index + 1} is missing: ${missing.join(', ')}`);
  }

  if (question.type === 'mcq') {
    if (!Array.isArray(question.options) || question.options.length < 2) {
      throw new Error(`${file} item ${index + 1} is an MCQ without enough options`);
    }
    if (!question.correctAnswer) {
      throw new Error(`${file} item ${index + 1} is an MCQ without correctAnswer`);
    }
  }
};

const run = () => {
  if (!fs.existsSync(questionBankDir)) {
    throw new Error(`Question bank folder not found: ${questionBankDir}`);
  }

  const files = collectJsonFiles(questionBankDir);
  const questions = [];
  const summary = {};
  const indexFiles = [];

  files.forEach((file) => {
    const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(rows)) {
      throw new Error(`${file} must contain a JSON array`);
    }

    rows.forEach((question, index) => {
      validateQuestion(question, file, index);
      questions.push({
        ...question,
        classId: question.classId || question.classLevel,
        subjectId: question.subjectId || question.subject,
        chapterId: question.chapterId || question.chapter,
        options: Array.isArray(question.options) ? question.options : [],
        tags: Array.isArray(question.tags) ? question.tags : [question.classLevel, question.subject, question.chapter, question.type],
        marks: Number(question.marks || (question.type === 'long' ? 5 : question.type === 'short' ? 2 : 1)),
        isImportant: Boolean(question.isImportant)
      });
    });

    const relative = path.relative(questionBankDir, file);
    const counts = rows.reduce((acc, question) => {
      acc[question.type] = (acc[question.type] || 0) + 1;
      return acc;
    }, {});
    summary[relative] = {
      total: rows.length,
      mcq: counts.mcq || 0,
      short: counts.short || 0,
      long: counts.long || 0
    };
    indexFiles.push({
      file: path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/'),
      total: rows.length,
      mcq: counts.mcq || 0,
      short: counts.short || 0,
      long: counts.long || 0
    });
  });

  fs.writeFileSync(outputFile, `${JSON.stringify(questions, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    indexFile,
    `${JSON.stringify(
      {
        totalQuestions: questions.length,
        totalFiles: files.length,
        generatedAt: new Date().toISOString(),
        files: indexFiles
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  console.log(`Built ${outputFile}`);
  console.log(`Updated ${indexFile}`);
  console.log(`Chapter files: ${files.length}`);
  console.log(`Questions: ${questions.length}`);
  const atomic = questions.filter(
    (question) =>
      question.classLevel === '1st Year' && question.subject === 'Chemistry' && question.chapter === 'Atomic Structure'
  );
  if (atomic.length) {
    console.log(`Atomic Structure questions: ${atomic.length}`);
    console.log(`Atomic Structure first question: ${atomic[0].question}`);
  }
};

try {
  run();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
