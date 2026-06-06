/*
 * Roman Urdu comments:
 * Ye service chatbot ke multi-turn memory ko manage karti hai.
 * New message me jo fields aati hain wo old pending context par overwrite hoti hain,
 * aur jo fields missing hoti hain wo old context se reuse hoti hain.
 */
const ChatbotContext = require('../models/ChatbotContext');
const { sanitizeCommand } = require('./nlpService');

const compact = (items) => [...new Set((items || []).filter(Boolean))];

const hasQuestionsCounts = (command = {}) =>
  Boolean(
    Number(command.mcqCount || 0) ||
      Number(command.shortCount || 0) ||
      Number(command.longCount || 0) ||
      Object.keys(command.questionCounts || {}).length
  );

const hasAcademicScope = (command = {}) =>
  Boolean(
    command.classLevel ||
      command.subject ||
      command.fullBook ||
      command.firstHalf ||
      command.secondHalf ||
      command.chapterRange ||
      (Array.isArray(command.chapters) && command.chapters.length)
  );

const inferIntentFromMessage = (message = '') => {
  const text = String(message || '').toLowerCase();
  const hasPaperWords = /\b(paper|exam|board)\b/i.test(text);
  const hasPracticeWords = /\b(practice|test|mcq|mcqs|objective)\b/i.test(text);
  const hasLongOrShort = /\b(short|long|ling)\b/i.test(text);

  if (hasPaperWords || hasLongOrShort) return 'generate_paper';
  if (hasPracticeWords) return 'generate_practice';
  return 'unknown';
};

const docToCommand = (context) => {
  if (!context) return null;
  const raw = context.toObject ? context.toObject() : context;
  return sanitizeCommand(raw);
};

const mergeParsedWithPending = ({ parsed, pendingContext, message, role }) => {
  const current = sanitizeCommand(parsed || {});
  const pending = docToCommand(pendingContext);
  if (!pending) {
    const roleIntent = inferIntentFromMessage(message);
    return sanitizeCommand({
      ...current,
      intent: current.intent !== 'unknown' ? current.intent : roleIntent
    });
  }

  const merged = sanitizeCommand({
    ...pending,
    intent: current.intent !== 'unknown' ? current.intent : pending.intent || inferIntentFromMessage(message),
    classLevel: current.classLevel || pending.classLevel,
    subject: current.subject || pending.subject,
    fullBook: Boolean(current.fullBook || (!current.firstHalf && !current.secondHalf && pending.fullBook && !current.chapters.length)),
    firstHalf: Boolean(current.firstHalf || (!current.fullBook && !current.secondHalf && pending.firstHalf && !current.chapters.length)),
    secondHalf: Boolean(current.secondHalf || (!current.fullBook && !current.firstHalf && pending.secondHalf && !current.chapters.length)),
    chapterRange: Boolean(current.chapterRange || (!current.fullBook && !current.firstHalf && !current.secondHalf && pending.chapterRange)),
    chapters:
      current.fullBook ||
      current.firstHalf ||
      current.secondHalf ||
      ((pending.fullBook || pending.firstHalf || pending.secondHalf) && !current.chapters.length)
        ? []
        : current.chapters.length
          ? current.chapters
          : pending.chapters,
    chapterNumbers: current.chapterNumbers?.length ? current.chapterNumbers : pending.chapterNumbers,
    chapterNames: current.chapterNames?.length ? current.chapterNames : pending.chapterNames,
    chapterDetails: current.chapterDetails?.length ? current.chapterDetails : pending.chapterDetails,
    mcqCount: current.mcqCount || pending.mcqCount,
    shortCount: current.shortCount || pending.shortCount,
    longCount: current.longCount || pending.longCount,
    questionCounts: Object.keys(current.questionCounts || {}).length ? current.questionCounts : pending.questionCounts,
    questionTypes: current.questionTypes?.length ? current.questionTypes : pending.questionTypes,
    marks: {
      mcq: current.marks?.mcq || pending.marks?.mcq || 1,
      short: current.marks?.short || pending.marks?.short || 2,
      long: current.marks?.long || pending.marks?.long || 5
    },
    difficulty: current.difficulty !== 'mixed' ? current.difficulty : pending.difficulty || current.difficulty,
    language: current.language || pending.language,
    generationMode: current.generationMode || pending.generationMode,
    missingFields: current.missingFields || []
  });

  if (current.intent === 'unknown' && pending.intent && pending.intent !== 'unknown') {
    merged.intent = pending.intent;
  }

  if (!hasAcademicScope(current) && hasQuestionsCounts(current)) {
    merged.classLevel = pending.classLevel;
    merged.subject = pending.subject;
    merged.chapters = pending.chapters;
    merged.chapterNumbers = pending.chapterNumbers;
    merged.chapterNames = pending.chapterNames;
    merged.chapterDetails = pending.chapterDetails;
    merged.fullBook = Boolean(pending.fullBook);
    merged.firstHalf = Boolean(pending.firstHalf);
    merged.secondHalf = Boolean(pending.secondHalf);
    merged.chapterRange = Boolean(pending.chapterRange);
    merged.intent = pending.intent || merged.intent;
  }

  const missingFields = new Set([...(pending.missingFields || []), ...(current.missingFields || [])]);
  if (merged.intent && merged.intent !== 'unknown') missingFields.delete('intent');
  if (merged.classLevel) missingFields.delete('classLevel');
  if (merged.subject) missingFields.delete('subject');
  if (merged.fullBook || merged.firstHalf || merged.secondHalf || merged.chapterRange || merged.chapters.length) missingFields.delete('chapters');
  if (hasQuestionsCounts(merged)) {
    ['question counts', 'mcqCount', 'shortCount', 'longCount'].forEach((field) => missingFields.delete(field));
  }
  merged.missingFields = [...missingFields];
  merged.confirmationRequired = Boolean(merged.missingFields.length);

  return sanitizeCommand(merged);
};

const getPendingContext = (userId) => ChatbotContext.findOne({ userId }).lean();

const savePendingContext = (user, command, missingFields = []) =>
  ChatbotContext.findOneAndUpdate(
    { userId: user._id },
    {
      $set: {
        userId: user._id,
        role: user.role,
        intent: command.intent || 'unknown',
        classLevel: command.classLevel || '',
        subject: command.subject || '',
        chapters: Array.isArray(command.chapters) ? command.chapters : [],
        chapterNumbers: Array.isArray(command.chapterNumbers) ? command.chapterNumbers : [],
        chapterNames: Array.isArray(command.chapterNames) ? command.chapterNames : [],
        chapterDetails: Array.isArray(command.chapterDetails) ? command.chapterDetails : [],
        fullBook: Boolean(command.fullBook),
        firstHalf: Boolean(command.firstHalf),
        secondHalf: Boolean(command.secondHalf),
        chapterRange: Boolean(command.chapterRange),
        mcqCount: Number(command.mcqCount || 0),
        shortCount: Number(command.shortCount || 0),
        longCount: Number(command.longCount || 0),
        questionCounts: command.questionCounts || {},
        questionTypes: Array.isArray(command.questionTypes) ? command.questionTypes : [],
        marks: {
          mcq: Number(command.marks?.mcq || 1),
          short: Number(command.marks?.short || 2),
          long: Number(command.marks?.long || 5)
        },
        difficulty: command.difficulty || 'mixed',
        language: command.language || 'english',
        generationMode: command.generationMode || 'question_bank',
        missingFields: compact(missingFields),
        awaitingConfirmation: Boolean(command.awaitingConfirmation),
        state:
          command.state ||
          (command.awaitingConfirmation
            ? 'awaiting_confirmation'
            : compact(missingFields).length
              ? 'collecting_details'
              : ''),
        updatedAt: new Date()
      }
    },
    { upsert: true, new: true }
  );

const clearPendingContext = (userId) => ChatbotContext.deleteOne({ userId });

module.exports = {
  getPendingContext,
  savePendingContext,
  clearPendingContext,
  mergeParsedWithPending,
  inferIntentFromMessage
};
