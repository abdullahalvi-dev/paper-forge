/*
 * Roman Urdu comments:
 * Ye service paper exports generate karti hai.
 * Generated paper ko PDF aur Word/DOCX format mein section-wise layout ke sath convert karta hai.
 */
const PDFDocument = require('pdfkit');
const {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun
} = require('docx');
const { cleanQuestionText } = require('../utils/questionText');

const collectPdfBuffer = (doc) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

const formatMarks = (value) => {
  const number = Number(value || 0);
  return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/\.?0+$/, '');
};

const sectionStats = (paper, type, questions) => {
  const marksEach = Number(paper.marksPerQuestion?.[type] || questions[0]?.marks || 0);
  const total = questions.reduce((sum, question) => sum + Number(question.marks || 0), 0);
  const allSame = questions.every((question) => Number(question.marks || 0) === marksEach);
  return questions.length && marksEach && allSame
    ? `${questions.length}*${formatMarks(marksEach)}=${formatMarks(total)} marks`
    : `Total = ${formatMarks(total)} marks`;
};

const importantPrefix = (question) => (question.isImportant ? '* ' : '');

const renderQuestionText = (question, index) =>
  `${index + 1}. ${importantPrefix(question)}${cleanQuestionText(question.question)}`;

const groupedQuestions = (paper) => ({
  mcq: paper.questions.filter((question) => question.type === 'mcq'),
  short: paper.questions.filter((question) => question.type === 'short'),
  long: paper.questions.filter((question) => question.type === 'long')
});

const paperChapterDetails = (paper) => {
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

const chapterNoText = (paper) => paperChapterDetails(paper).map((detail) => detail.chapterNumber).filter(Boolean).join(', ') || '-';

const chapterNameText = (paper) =>
  paperChapterDetails(paper).map((detail) => detail.chapterName).filter(Boolean).join(', ') || 'All';

const createPdfBuffer = async (paper) => {
  const doc = new PDFDocument({ margin: 48, size: 'A4' });
  const bufferPromise = collectPdfBuffer(doc);
  const groups = groupedQuestions(paper);

  const drawBorder = () => doc.rect(32, 32, 531, 778).stroke();
  doc.on('pageAdded', () => {
    drawBorder();
    doc.font('Times-Roman');
  });

  drawBorder();
  doc.font('Times-Bold').fontSize(16).text(paper.schoolName || 'School / College Name', { align: 'center' });
  doc.font('Times-Roman').fontSize(13).text(paper.examTitle || paper.title, { align: 'center' });
  doc.moveDown(0.4);
  doc.fontSize(10).text(`Class: ${paper.classLevel}    Subject: ${paper.subject}`, { align: 'center' });
  doc.text(`Chapter No: ${chapterNoText(paper)}    Chapter Name: ${chapterNameText(paper)}`, { align: 'center' });
  doc.text(`Time Allowed: ${paper.timeAllowed || '3 Hours'}    Total Marks: ${formatMarks(paper.marks)}`, { align: 'center' });
  doc.moveDown(0.8);
  doc.font('Times-Bold').fontSize(10).text('Instructions:', { underline: true });
  doc.font('Times-Roman');
  (paper.instructions || []).forEach((instruction) => doc.text(`- ${instruction}`));
  doc.moveDown(0.8);

  const renderSection = (title, type, questions, withOptions = false) => {
    if (!questions.length) return;
    doc.moveDown(0.5);
    doc.font('Times-Bold').fontSize(12).text(`${title} (${sectionStats(paper, type, questions)})`, { underline: true });
    doc.font('Times-Roman');
    doc.moveDown(0.4);
    questions.forEach((question, index) => {
      doc.fontSize(10.5).text(`${index + 1}. ${importantPrefix(question)}${cleanQuestionText(question.question)}`);
      if (withOptions && question.options && question.options.length) {
        question.options.slice(0, 4).forEach((option, optionIndex) => {
          doc.fontSize(9.5).text(`(${String.fromCharCode(65 + optionIndex)}) ${option}`, { indent: 16 });
        });
      }
      doc.moveDown(0.55);
    });
  };

  renderSection('SECTION A - MCQs', 'mcq', groups.mcq, true);
  renderSection('SECTION B - Short Questions', 'short', groups.short);
  renderSection('SECTION C - Long Questions', 'long', groups.long);

  if (groups.mcq.length) {
    doc.addPage();
    doc.font('Times-Bold').fontSize(16).text('MCQ Answer Key', { align: 'center' });
    doc.font('Times-Roman');
    doc.moveDown();

    groups.mcq.forEach((question, index) => {
      const optionIndex = (question.options || []).findIndex((option) => option === question.correctAnswer);
      const label = optionIndex >= 0 ? `${String.fromCharCode(65 + optionIndex)}. ` : '';
      doc.fontSize(11).text(`${index + 1}. ${label}${question.correctAnswer || 'Teacher review required'}`);
      doc.moveDown(0.35);
    });
  }

  doc.end();
  return bufferPromise;
};

const createWordBuffer = async (paper) => {
  const groups = groupedQuestions(paper);
  const run = (text, options = {}) => new TextRun({ text, font: 'Times New Roman', ...options });
  const children = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [run(paper.schoolName || 'School / College Name', { bold: true, size: 32 })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        run(`${paper.examTitle || paper.title} | Class: ${paper.classLevel} | Subject: ${paper.subject} | Total Marks: ${formatMarks(paper.marks)}`)
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [run(`Chapter No: ${chapterNoText(paper)} | Chapter Name: ${chapterNameText(paper)}`)]
    }),
    new Paragraph({ text: '' })
  ];

  const pushSection = (title, type, questions) => {
    if (!questions.length) return;
    children.push(
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [run(`${title} (${sectionStats(paper, type, questions)})`, { bold: true })] })
    );
    questions.forEach((question, index) => {
      children.push(
        new Paragraph({
          children: [run(renderQuestionText(question, index), { bold: true })]
        })
      );
      (question.options || []).forEach((option, optionIndex) => {
        children.push(new Paragraph({ children: [run(`   ${String.fromCharCode(65 + optionIndex)}. ${option}`)] }));
      });
      children.push(new Paragraph({ text: '' }));
    });
  };

  pushSection('SECTION A - MCQs', 'mcq', groups.mcq);
  pushSection('SECTION B - Short Questions', 'short', groups.short);
  pushSection('SECTION C - Long Questions', 'long', groups.long);

  if (groups.mcq.length) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [run('MCQ Answer Key', { bold: true })] }));
    groups.mcq.forEach((question, index) => {
      const optionIndex = (question.options || []).findIndex((option) => option === question.correctAnswer);
      const label = optionIndex >= 0 ? `${String.fromCharCode(65 + optionIndex)}. ` : '';
      children.push(new Paragraph({ children: [run(`${index + 1}. ${label}${question.correctAnswer || 'Teacher review required'}`)] }));
    });
  }

  const document = new Document({
    sections: [{ properties: {}, children }]
  });

  return Packer.toBuffer(document);
};

module.exports = {
  createPdfBuffer,
  createWordBuffer
};
