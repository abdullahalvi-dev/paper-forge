/*
 * Roman Urdu comments:
 * Ye controller chatbot API handle karta hai.
 * Secure flow: user message -> AI/fallback JSON parser -> backend validation -> confirmation -> existing generator.
 */
const Paper = require('../models/Paper');
const ChatbotLog = require('../models/ChatbotLog');
const { parseUserCommand, generateExplanation, sanitizeCommand, fallbackParse } = require('../services/nlpService');
const { createBoardPaper } = require('../services/paperService');
const { createPracticeAttempt, hidePracticeAnswers } = require('../services/practiceService');
const { getSettings } = require('../services/settingsService');
const { consumeTrialOrRequireSubscription } = require('../services/subscriptionService');
const {
  getQuestionBankMetadata,
  allSubjects,
  resolveClassLevel,
  resolveSubject,
  resolveChapters,
  subjectEntry
} = require('../services/questionBankMetadataService');
const {
  clearPendingContext,
  getPendingContext,
  mergeParsedWithPending,
  savePendingContext
} = require('../services/chatbotContextService');
const {
  getQuestionCountLimitViolations,
  formatQuestionLimitMessage,
  formatPracticeQuestionLimitMessage
} = require('../utils/questionLimits');
const { isTrustedAdmin } = require('../config/security');

const roleCan = {
  generate_paper: ['teacher', 'admin'],
  generate_practice: ['student', 'admin'],
  explain_answer: ['student', 'admin'],
  generate_answer_key: ['teacher', 'admin'],
  generate_study_plan: ['student', 'teacher', 'admin'],
  weak_topic_analysis: ['student', 'teacher', 'admin'],
  unknown: ['student', 'teacher', 'admin']
};

const compact = (items) => [...new Set((items || []).filter(Boolean))];
const cancelResponseMessage = 'Request cancel ho gayi. New details likhein.';
const normalizeReply = (message = '') =>
  String(message || '')
    .toLowerCase()
    .replace(/[.,!?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const affirmativeReplies = new Set([
  'yes',
  'y',
  'ok',
  'okay',
  'confirm',
  'confirmed',
  'generate',
  'generate now',
  'yes generate',
  'go ahead',
  'haan',
  'han',
  'ha',
  'ji',
  'theek',
  'theek hai',
  'bna do',
  'bana do',
  'kar do',
  'chalo'
]);
const negativeReplies = new Set([
  'no',
  'n',
  'cancel',
  'no cancel',
  'cancel karo',
  'cancel kro',
  'cancel kar do',
  'cancel kr do',
  'cancel krdo',
  'stop',
  'nope',
  'nahi',
  'nahin',
  'mat karo',
  'mat kro'
]);
const editReplies = new Set([
  'edit',
  'edit details',
  'change',
  'change details',
  'modify',
  'update',
  'badal do',
  'tabdeel',
  'edit karo',
  'change karo'
]);
const resetReplies = new Set([
  'reset',
  'clear',
  'clear chat',
  'clear context',
  'new chat',
  'new paper',
  'restart',
  'start over',
  'fresh start'
]);

const isAffirmativeCommand = (message) => affirmativeReplies.has(normalizeReply(message));
const isNegativeCommand = (message) => negativeReplies.has(normalizeReply(message));
const isEditCommand = (message) => editReplies.has(normalizeReply(message));
const isResetCommand = (message) => resetReplies.has(normalizeReply(message));
const isCancelOrResetCommand = (message) => isNegativeCommand(message) || isResetCommand(message);

const buildCancelResponse = (parsed = sanitizeCommand({ intent: 'unknown' })) => ({
  intent: parsed.intent || 'unknown',
  parsed: { ...parsed, confirmationRequired: false, awaitingConfirmation: false },
  needsFollowUp: false,
  confirmationRequired: false,
  state: 'cancelled',
  cancelled: true,
  reset: true,
  message: cancelResponseMessage
});

const writeChatbotLog = async (req, payload = {}) => {
  try {
    await ChatbotLog.create({
      userId: req.user?._id,
      role: req.user?.role,
      message: payload.message || '',
      intent: payload.intent || payload.parsed?.intent || 'unknown',
      parsed: payload.parsed || {},
      responseMessage: payload.responseMessage || payload.messageToUser || '',
      needsFollowUp: Boolean(payload.needsFollowUp),
      confirmationRequired: Boolean(payload.confirmationRequired),
      action: payload.action || 'message',
      status: payload.status || 'info',
      paperId: payload.paperId,
      practiceId: payload.practiceId,
      summary: payload.summary || {},
      error: payload.error || ''
    });
  } catch (error) {
    console.error('chatbotLogError', error.message);
  }
};

const sendWithLog = async (req, res, statusCode, response, logPayload = {}) => {
  await writeChatbotLog(req, {
    ...logPayload,
    intent: logPayload.intent || response.intent,
    parsed: logPayload.parsed || response.parsed,
    responseMessage: logPayload.responseMessage || response.message,
    needsFollowUp: response.needsFollowUp,
    confirmationRequired: response.confirmationRequired
  });
  return res.status(statusCode).json(response);
};

const requireAllowedRole = (intent, role) => {
  const effectiveRole = role === 'super_admin' ? 'admin' : role;
  if ((roleCan[intent] || []).includes(effectiveRole)) return null;
  const error = new Error('Your role is not allowed to use this chatbot command.');
  error.statusCode = 403;
  return error;
};

const followUpMessage = (missing = []) => {
  const fields = compact(missing);
  if (fields.length === 1 && fields.includes('subject')) return 'Subject ka naam bata dein.';
  if (fields.length === 1 && fields.includes('chapters')) return 'Chapter number ya chapter name bata dein.';
  if (fields.includes('question counts')) return 'MCQs, short aur long questions kitne chahiye?';
  if (fields.includes('mcqCount')) return 'MCQs kitne chahiye?';
  if (fields.length === 1 && fields.includes('classLevel')) return 'Class ka naam bata dein.';

  const labels = [];
  if (fields.includes('classLevel')) labels.push('class');
  if (fields.includes('subject')) labels.push('subject');
  if (fields.includes('chapters')) labels.push('chapter');
  if (labels.length) return `${labels.join(', ')} bata dein.`;

  return 'Missing details bata dein taake request complete ho sake.';
};

const hasAnyQuestionCounts = (parsed) =>
  Boolean(
    Number(parsed.mcqCount || 0) ||
      Number(parsed.shortCount || 0) ||
      Number(parsed.longCount || 0) ||
      Object.keys(parsed.questionCounts || {}).length
  );

const countsForLimitValidation = (parsed = {}) => ({
  mcq: Number(parsed.questionCounts?.mcq ?? parsed.mcqCount ?? 0),
  short: Number(parsed.questionCounts?.short ?? parsed.shortCount ?? 0),
  long: Number(parsed.questionCounts?.long ?? parsed.longCount ?? 0)
});

const validateQuestionCountLimits = (parsed = {}) => {
  const violations = getQuestionCountLimitViolations(countsForLimitValidation(parsed));
  if (!violations.length) return { ok: true };
  const message =
    parsed.intent === 'generate_practice'
      ? formatPracticeQuestionLimitMessage(violations)
      : formatQuestionLimitMessage(violations);

  return {
    ok: false,
    missing: ['question counts'],
    message
  };
};

const generationDifficulty = (difficulty) =>
  ['easy', 'medium', 'hard', 'board_style', 'conceptual', 'numerical'].includes(difficulty) ? difficulty : 'mixed';

const chapterModeFromFlags = (source = {}) => {
  if (source.fullBook) return 'Full Book';
  if (source.firstHalf) return 'First Half Book';
  if (source.secondHalf) return 'Second Half Book';
  if (source.chapterRange) return 'Chapter Range';
  return 'Selected Chapters';
};

const positiveInteger = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
};

const positiveMark = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

const metadataChapterDetail = (chapter) => ({
  chapterNumber: positiveInteger(chapter?.chapterNumber || chapter?.number),
  chapterName: chapter?.chapterName || chapter?.name || ''
});

const applyMarksOverride = (parsed, body = {}) => {
  const override = body.marks || body.context?.marks || body.marksPerQuestion || body.context?.marksPerQuestion || {};
  if (!override || typeof override !== 'object') return parsed;

  return {
    ...parsed,
    marks: {
      mcq: positiveMark(override.mcq, parsed.marks?.mcq || 1),
      short: positiveMark(override.short, parsed.marks?.short || 2),
      long: positiveMark(override.long, parsed.marks?.long || 5)
    }
  };
};

const validateCommonAcademicFields = (parsed, metadata) => {
  const missing = [];
  const requestedSubject = String(parsed.subject || '').trim();
  const classLevel = resolveClassLevel(parsed.classLevel, metadata);
  const subject = resolveSubject(requestedSubject, classLevel, metadata);

  if (!classLevel) missing.push('classLevel');
  if (classLevel && requestedSubject && !subject) {
    const availableSubjects = compact(allSubjects(metadata, classLevel).map((item) => item.name));
    return {
      ok: false,
      missing: ['subject'],
      invalidField: 'subject',
      message: availableSubjects.length
        ? `Subject "${requestedSubject}" ${classLevel} class ke liye available nahi hai. Available subjects: ${availableSubjects.join(', ')}.`
        : `${classLevel} class ke liye koi subject question-bank me available nahi hai.`
    };
  }
  if (!subject) missing.push('subject');
  if (!parsed.fullBook && !parsed.firstHalf && !parsed.secondHalf && !parsed.chapterRange && !parsed.chapters.length) missing.push('chapters');

  if (missing.length) {
    return {
      ok: false,
      missing,
      message: followUpMessage(missing)
    };
  }

  if (parsed.fullBook || parsed.firstHalf || parsed.secondHalf) {
    const availableChapterDetails = (subjectEntry(classLevel, subject, metadata)?.chapters || []).map(metadataChapterDetail);
    if (!availableChapterDetails.length) {
      return {
        ok: false,
        missing: ['chapters'],
        message: 'Is class aur subject ke liye question-bank me chapters nahi mile. Pehle chapter data add karein.'
      };
    }
    const selectedChapterDetails = parsed.firstHalf
      ? availableChapterDetails.slice(0, Math.ceil(availableChapterDetails.length / 2))
      : parsed.secondHalf
        ? availableChapterDetails.slice(Math.floor(availableChapterDetails.length / 2))
        : availableChapterDetails;
    const chapters = selectedChapterDetails.map((chapter) => chapter.chapterName);

    return {
      ok: true,
      classLevel,
      subject,
      chapters,
      chapterNames: chapters,
      chapterNumbers: selectedChapterDetails.map((chapter) => chapter.chapterNumber).filter(Boolean),
      chapterDetails: selectedChapterDetails,
      fullBook: Boolean(parsed.fullBook),
      firstHalf: Boolean(parsed.firstHalf),
      secondHalf: Boolean(parsed.secondHalf),
      chapterRange: false,
      chapterMode: chapterModeFromFlags(parsed)
    };
  }

  const chapterResolution = resolveChapters({ classLevel, subject, chapters: parsed.chapters }, metadata);
  if (!chapterResolution.chapters.length || chapterResolution.unresolved.length) {
    if (chapterResolution.unresolvedNumbers?.length) {
      const requested = chapterResolution.unresolvedNumbers.join(', ');
      const availableNumbers = chapterResolution.availableNumbers.join(', ');
      return {
        ok: false,
        missing: ['chapters'],
        message: `Chapter ${requested} is not available. Available chapters are: ${availableNumbers}.`
      };
    }

    return {
      ok: false,
      missing: ['chapters'],
      message: chapterResolution.available.length
        ? `Chapter samajh nahi aya. Available chapters: ${chapterResolution.available.join(', ')}.`
        : 'Is class aur subject ke liye chapter data nahi mila. Pehle question-bank me chapter add karein.'
    };
  }

  return {
    ok: true,
    classLevel,
    subject,
    chapters: chapterResolution.chapters,
    chapterNames: chapterResolution.chapterNames,
    chapterNumbers: chapterResolution.chapterNumbers,
    chapterDetails: chapterResolution.chapterDetails,
    fullBook: false,
    firstHalf: false,
    secondHalf: false,
    chapterRange: Boolean(parsed.chapterRange),
    chapterMode: chapterModeFromFlags(parsed)
  };
};

const validatePaperCommand = (parsed, metadata) => {
  const academic = validateCommonAcademicFields(parsed, metadata);
  if (!academic.ok) return academic;

  if (!hasAnyQuestionCounts(parsed)) {
    return {
      ok: false,
      missing: ['question counts'],
      message: followUpMessage(['question counts'])
    };
  }

  const limitValidation = validateQuestionCountLimits(parsed);
  if (!limitValidation.ok) return limitValidation;

  return academic;
};

const validatePracticeCommand = (parsed, metadata) => {
  const academic = validateCommonAcademicFields(parsed, metadata);
  if (!academic.ok) return academic;

  const hasMultiChapterSelection =
    parsed.fullBook ||
    parsed.firstHalf ||
    parsed.secondHalf ||
    parsed.chapterRange ||
    Number(academic.chapters?.length || 0) > 1;

  if (!hasMultiChapterSelection && !parsed.mcqCount) {
    return {
      ok: false,
      missing: ['mcqCount'],
      message: followUpMessage(['mcqCount'])
    };
  }

  const limitValidation = validateQuestionCountLimits(parsed);
  if (!limitValidation.ok) return limitValidation;

  return academic;
};

const withMissing = (parsed, missing) => ({
  ...parsed,
  missingFields: compact([...(parsed.missingFields || []), ...missing]),
  confirmationRequired: true,
  awaitingConfirmation: false
});

const normalizedParsed = (parsed, validation, confirmationRequired = false) => ({
  ...parsed,
  classLevel: validation.classLevel,
  subject: validation.subject,
  chapters: validation.chapters,
  chapterNames: validation.chapterNames || validation.chapters || [],
  chapterNumbers: validation.chapterNumbers || [],
  chapterDetails: validation.chapterDetails || [],
  fullBook: Boolean(validation.fullBook || parsed.fullBook),
  firstHalf: Boolean(validation.firstHalf || parsed.firstHalf),
  secondHalf: Boolean(validation.secondHalf || parsed.secondHalf),
  chapterRange: Boolean(validation.chapterRange || parsed.chapterRange),
  missingFields: [],
  confirmationRequired,
  awaitingConfirmation: confirmationRequired
});

const confirmationQuestionFor = (intent = '') =>
  intent === 'generate_practice' ? 'Generate this practice test?' : 'Generate this paper?';

const buildQuestionCounts = (parsed = {}, options = {}) => {
  const counts = {
    mcq: Number(parsed.mcqCount || 0),
    short: Number(parsed.shortCount || 0),
    long: Number(parsed.longCount || 0),
    ...(parsed.questionCounts || {})
  };

  if (parsed.intent === 'generate_practice' && !counts.mcq) {
    counts.mcq = Number(options.practiceMcqLimit || 20);
  }

  return Object.fromEntries(Object.entries(counts).filter(([, value]) => Number(value || 0) > 0));
};

const buildSummary = (parsed, validation, options = {}) => {
  const isPractice = parsed.intent === 'generate_practice';
  return {
    intent: parsed.intent,
    classLevel: validation.classLevel,
    subject: validation.subject,
    chapters: validation.chapters,
    chapterNames: validation.chapterNames || validation.chapters || [],
    chapterNumbers: validation.chapterNumbers || [],
    chapterDetails: validation.chapterDetails || [],
    chapterName: (validation.chapterNames || validation.chapters || []).length === 1 ? (validation.chapterNames || validation.chapters)[0] : '',
    chapterNumber: (validation.chapterNumbers || []).length === 1 ? validation.chapterNumbers[0] : 0,
    fullBook: Boolean(validation.fullBook || parsed.fullBook),
    firstHalf: Boolean(validation.firstHalf || parsed.firstHalf),
    secondHalf: Boolean(validation.secondHalf || parsed.secondHalf),
    chapterRange: Boolean(validation.chapterRange || parsed.chapterRange),
    chapterMode: chapterModeFromFlags({ ...parsed, ...validation }),
    counts: buildQuestionCounts(parsed, options),
    marks: isPractice
      ? { mcq: Number(parsed.marks?.mcq || 1) }
      : {
          mcq: Number(parsed.marks?.mcq || 1),
          short: Number(parsed.marks?.short || 2),
          long: Number(parsed.marks?.long || 5)
        },
    difficulty: generationDifficulty(parsed.difficulty),
    generationMode: parsed.generationMode || 'question_bank'
  };
};

const displaySubjectName = (subject = '') => {
  const normalized = String(subject || '').trim().toLowerCase();
  if (normalized === 'math' || normalized === 'maths') return 'Mathematics';
  return String(subject || '').trim();
};

const buildFinalPaperPayload = (parsed, validation) => {
  const questionCounts = buildQuestionCounts(parsed);
  const title = `${validation.classLevel} ${displaySubjectName(validation.subject)} Paper`;

  return {
    title,
    examTitle: title,
    classLevel: validation.classLevel,
    classId: validation.classLevel,
    subject: validation.subject,
    subjectId: validation.subject,
    chapters: validation.chapters,
    chapterIds: validation.chapters,
    chapterNames: validation.chapterNames || validation.chapters,
    chapterNumbers: validation.chapterNumbers || [],
    chapterDetails: validation.chapterDetails || [],
    chapterName: (validation.chapterNames || validation.chapters || []).length === 1 ? (validation.chapterNames || validation.chapters)[0] : undefined,
    chapterNumber: (validation.chapterNumbers || []).length === 1 ? validation.chapterNumbers[0] : undefined,
    fullBook: Boolean(validation.fullBook || parsed.fullBook),
    firstHalf: Boolean(validation.firstHalf || parsed.firstHalf),
    secondHalf: Boolean(validation.secondHalf || parsed.secondHalf),
    chapterRange: Boolean(validation.chapterRange || parsed.chapterRange),
    chapterMode: chapterModeFromFlags({ ...parsed, ...validation }),
    mode: 'custom',
    mcqCount: Number(parsed.mcqCount || questionCounts.mcq || 0),
    shortCount: Number(parsed.shortCount || questionCounts.short || 0),
    longCount: Number(parsed.longCount || questionCounts.long || 0),
    counts: questionCounts,
    questionCounts,
    marksPerQuestion: {
      mcq: Number(parsed.marks?.mcq || 1),
      short: Number(parsed.marks?.short || 2),
      long: Number(parsed.marks?.long || 5)
    },
    difficulty: generationDifficulty(parsed.difficulty)
  };
};

const buildEditDetailsResponse = (parsed) => ({
  intent: parsed.intent,
  parsed: { ...parsed, confirmationRequired: false, awaitingConfirmation: false, state: 'collecting_details' },
  needsFollowUp: true,
  confirmationRequired: false,
  state: 'collecting_details',
  message: 'Kya change karna hai? Class, subject, chapter ya question counts bata dein.'
});

const editFieldAliases = {
  classLevel: ['class', 'class level', 'grade', 'jamaat'],
  subject: ['subject', 'mazmoon'],
  chapters: ['chapter', 'chapters', 'chapter number', 'chapter name', 'unit', 'chepter'],
  counts: ['count', 'counts', 'question count', 'question counts', 'mcq count', 'mcqs', 'questions']
};

const detectEditFieldRequest = (message = '') => {
  const normalized = normalizeReply(message)
    .replace(/\b(edit|change|update|modify|details|detail|badal|tabdeel|karo|kro|kar|kr|do)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return '';

  return (
    Object.entries(editFieldAliases).find(([, aliases]) => aliases.includes(normalized))?.[0] || ''
  );
};

const resetParsedForEditField = (parsed = {}, field = '') => {
  const next = sanitizeCommand(parsed);
  next.confirmationRequired = false;
  next.awaitingConfirmation = false;
  next.state = 'collecting_details';

  if (field === 'classLevel') {
    next.classLevel = '';
    next.chapters = [];
    next.chapterNumbers = [];
    next.chapterNames = [];
    next.chapterDetails = [];
    next.fullBook = false;
    next.firstHalf = false;
    next.secondHalf = false;
    next.chapterRange = false;
    next.missingFields = ['classLevel'];
    return next;
  }

  if (field === 'subject') {
    next.subject = '';
    next.chapters = [];
    next.chapterNumbers = [];
    next.chapterNames = [];
    next.chapterDetails = [];
    next.fullBook = false;
    next.firstHalf = false;
    next.secondHalf = false;
    next.chapterRange = false;
    next.missingFields = ['subject'];
    return next;
  }

  if (field === 'chapters') {
    next.chapters = [];
    next.chapterNumbers = [];
    next.chapterNames = [];
    next.chapterDetails = [];
    next.fullBook = false;
    next.firstHalf = false;
    next.secondHalf = false;
    next.chapterRange = false;
    next.missingFields = ['chapters'];
    return next;
  }

  if (field === 'counts') {
    next.mcqCount = 0;
    next.shortCount = 0;
    next.longCount = 0;
    next.questionCounts = {};
    next.questionTypes = [];
    next.missingFields = next.intent === 'generate_practice' ? ['mcqCount'] : ['question counts'];
    return next;
  }

  return next;
};

const editFieldFollowUpMessage = (field = '', parsed = {}) => {
  if (field === 'classLevel') return 'Class ka naam bata dein.';
  if (field === 'subject') return 'Subject ka naam bata dein.';
  if (field === 'chapters') return 'Chapter number ya chapter name bata dein.';
  if (field === 'counts') {
    return parsed.intent === 'generate_practice' ? 'MCQs kitne chahiye?' : 'MCQs, short aur long questions kitne chahiye?';
  }
  return 'Kya change karna hai? Class, subject, chapter ya question counts bata dein.';
};

const buildEditFieldResponse = (parsed, field) => ({
  intent: parsed.intent,
  parsed,
  needsFollowUp: true,
  confirmationRequired: false,
  state: 'collecting_details',
  message: editFieldFollowUpMessage(field, parsed)
});

const objectHasKeys = (value = {}) => Boolean(value && typeof value === 'object' && Object.keys(value).length);

const isWaitingForQuestionCounts = (pendingContext) => {
  if (!pendingContext) return false;
  const pending = sanitizeCommand(pendingContext);
  const missing = new Set(pending.missingFields || []);
  return (
    missing.has('question counts') ||
    missing.has('mcqCount') ||
    missing.has('shortCount') ||
    missing.has('longCount') ||
    (pending.intent === 'generate_paper' && !hasAnyQuestionCounts(pending))
  );
};

const parseCompactQuestionCounts = (message = '', pendingContext = null) => {
  if (!isWaitingForQuestionCounts(pendingContext)) return null;
  const trimmed = String(message || '').trim();
  if (!/^\d{1,3}(?:\s*,\s*\d{1,3}){1,2}$/.test(trimmed) && !/^\d{1,3}(?:\s+\d{1,3}){1,2}$/.test(trimmed)) {
    return null;
  }

  const numbers = trimmed.split(/[,\s]+/).map(Number).filter((value) => Number.isFinite(value) && value > 0);
  if (numbers.length < 2 || numbers.length > 3) return null;

  return {
    mcqCount: numbers[0] || 0,
    shortCount: numbers[1] || 0,
    longCount: numbers[2] || 0,
    questionCounts: {
      ...(numbers[0] ? { mcq: numbers[0] } : {}),
      ...(numbers[1] ? { short: numbers[1] } : {}),
      ...(numbers[2] ? { long: numbers[2] } : {})
    },
    questionTypes: ['mcq', 'short', ...(numbers[2] ? ['long'] : [])]
  };
};

const isWaitingForOnlyMcqCount = (pendingContext) => {
  if (!pendingContext) return false;
  const pending = sanitizeCommand(pendingContext);
  const missing = new Set(pending.missingFields || []);
  const hasAcademicSelection =
    Boolean(pending.classLevel && pending.subject) &&
    Boolean(
      pending.fullBook ||
        pending.firstHalf ||
        pending.secondHalf ||
        pending.chapterRange ||
        pending.chapters?.length
    );

  return pending.intent === 'generate_practice' && hasAcademicSelection && missing.has('mcqCount');
};

const parseSingleMcqCountFollowUp = (message = '', pendingContext = null) => {
  if (!isWaitingForOnlyMcqCount(pendingContext)) return null;
  const trimmed = String(message || '').trim();
  const match = trimmed.match(/^(\d{1,3})(?:\s*(?:mcq|mcqs|objective))?$/i);
  if (!match) return null;

  const mcqCount = Number(match[1]);
  if (!Number.isInteger(mcqCount) || mcqCount <= 0) return null;

  return {
    mcqCount,
    shortCount: 0,
    longCount: 0,
    questionCounts: { mcq: mcqCount },
    questionTypes: ['mcq']
  };
};

const isWaitingForClassAndChapter = (pendingContext) => {
  if (!pendingContext) return false;
  const pending = sanitizeCommand(pendingContext);
  const missing = new Set(pending.missingFields || []);
  return missing.has('classLevel') && missing.has('chapters') && Boolean(pending.subject);
};

const parseCompactAcademicFollowUp = (message = '', pendingContext = null, metadata = null) => {
  if (!pendingContext) return null;

  const pending = sanitizeCommand(pendingContext);
  const missing = new Set(pending.missingFields || []);
  const isCollectingAcademicDetails = ['classLevel', 'subject', 'chapters'].some((field) => missing.has(field));
  if (!isCollectingAcademicDetails) return null;

  const parts = String(message || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (parts.length !== 3) return null;

  const [classToken, subjectToken, chapterToken] = parts;
  if (
    !classToken ||
    !subjectToken ||
    !chapterToken ||
    /^\d+$/.test(subjectToken) ||
    subjectToken.length > 80 ||
    chapterToken.length > 100
  ) {
    return null;
  }

  const classLevel =
    resolveClassLevel(classToken, metadata) ||
    resolveClassLevel(`${classToken} class`, metadata) ||
    resolveClassLevel(`class ${classToken}`, metadata);
  if (!classLevel) return null;

  const cleanedSubject = subjectToken
    .replace(/^(?:subject|mazmoon)\s*(?:is|ka|ki|ke|:|-)?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  const subject =
    resolveSubject(cleanedSubject, classLevel, metadata) ||
    cleanedSubject.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());

  const chapter = chapterToken
    .replace(/^(?:chapter|unit|ch)\s*(?:number|no)?\s*/i, '')
    .replace(/(?:st|nd|rd|th)$/i, '')
    .trim();
  if (!subject || !chapter) return null;

  return {
    classLevel,
    subject,
    chapters: [chapter]
  };
};

const parseCompactClassChapterFollowUp = (message = '', pendingContext = null, metadata = null) => {
  if (!isWaitingForClassAndChapter(pendingContext)) return null;
  const trimmed = String(message || '').trim();
  if (!/^\d{1,2}(?:st|nd|rd|th)?\s*,\s*\d{1,2}(?:st|nd|rd|th)?$/i.test(trimmed)) return null;

  const [classToken, chapterToken] = trimmed.split(',').map((item) => item.trim());
  const classLevel =
    resolveClassLevel(classToken, metadata) ||
    resolveClassLevel(`${classToken} class`, metadata) ||
    resolveClassLevel(`class ${classToken}`, metadata);

  if (!classLevel) return null;

  return {
    classLevel,
    chapters: [chapterToken.replace(/(?:st|nd|rd|th)$/i, '')]
  };
};

const isWaitingForClassLevel = (pendingContext) => {
  if (!pendingContext) return false;
  const pending = sanitizeCommand(pendingContext);
  const missing = new Set(pending.missingFields || []);
  return missing.has('classLevel') && !pending.classLevel;
};

const parseBareClassFollowUp = (message = '', pendingContext = null, metadata = null) => {
  if (!isWaitingForClassLevel(pendingContext)) return '';
  const trimmed = String(message || '').trim();
  if (!/^(?:class\s+)?\d{1,2}(?:st|nd|rd|th)?(?:\s+(?:class|grade|year))?$|^(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth)\s+year$/i.test(trimmed)) {
    return '';
  }

  return (
    resolveClassLevel(trimmed, metadata) ||
    resolveClassLevel(`class ${trimmed}`, metadata) ||
    resolveClassLevel(`${trimmed} class`, metadata) ||
    ''
  );
};

const isWaitingForSubject = (pendingContext) => {
  if (!pendingContext) return false;
  const pending = sanitizeCommand(pendingContext);
  const missing = new Set(pending.missingFields || []);
  return missing.has('subject') && Boolean(pending.classLevel);
};

const parseBareSubjectFollowUp = (message = '', pendingContext = null, metadata = null) => {
  if (!isWaitingForSubject(pendingContext)) return '';

  const pending = sanitizeCommand(pendingContext);
  const cleaned = String(message || '')
    .trim()
    .replace(/^(?:subject|mazmoon)\s*(?:is|ka|ki|ke|:|-)?\s*/i, '')
    .replace(/[.,;:!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (
    !cleaned ||
    cleaned.length > 80 ||
    /^\d+$/.test(cleaned) ||
    /\b(?:paper|practice|test|chapter|mcq|short|long|marks?|generate|cancel|reset|edit)\b/i.test(cleaned)
  ) {
    return '';
  }

  const resolved = resolveSubject(cleaned, pending.classLevel, metadata);
  if (resolved) return resolved;

  // Roman Urdu: Invalid naam bhi preserve hota hai taa ke validator repeat prompt ke bajaye clear unavailable message de.
  return cleaned.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
};

const parseBareChapterFollowUp = (message = '', pendingContext = null, current = {}) => {
  const pending = pendingContext ? sanitizeCommand(pendingContext) : null;
  const missing = new Set(pending?.missingFields || []);
  const waitingForChapter =
    missing.has('chapters') ||
    Boolean(
      pending &&
        (pending.classLevel || current.classLevel) &&
        (pending.subject || current.subject) &&
        !pending.chapters?.length &&
        !current.chapters?.length
    );
  if (!waitingForChapter) return [];

  const text = String(message || '').trim();
  if (!text || /\b(mcq|mcqs|objective|short|long|marks?|questions?)\b/i.test(text)) return [];

  const matches = [...text.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?\b/gi)];
  if (matches.length !== 1) return [];

  const match = matches[0];
  const before = text.slice(Math.max(0, match.index - 14), match.index);
  const after = text.slice(match.index + match[0].length, match.index + match[0].length + 14);
  if (/\b(class|grade|part|year)\s*$/i.test(before) || /^\s*(class|grade|year)\b/i.test(after)) return [];

  return [match[1]];
};

const isFreshFullRequest = (message = '', role = 'student', metadata = null) => {
  const parsed = fallbackParse(message, role, metadata);
  return Boolean(parsed.intent && parsed.intent !== 'unknown' && (parsed.classLevel || parsed.subject));
};

const shouldClearPendingForFreshRequest = (pendingContext, message = '', role = 'student', metadata = null) =>
  Boolean(pendingContext && isFreshFullRequest(message, role, metadata));

const enrichParsedWithPendingScope = ({ parsedMessage, pendingContext, message, role, metadata }) => {
  const current = sanitizeCommand(parsedMessage || {});
  const pending = pendingContext ? sanitizeCommand(pendingContext) : null;
  const compactCounts = parseCompactQuestionCounts(message, pendingContext);
  const singleMcqCount = parseSingleMcqCountFollowUp(message, pendingContext);
  const compactAcademic =
    parseCompactAcademicFollowUp(message, pendingContext, metadata) ||
    parseCompactClassChapterFollowUp(message, pendingContext, metadata);
  const bareClassLevel = compactAcademic ? '' : parseBareClassFollowUp(message, pendingContext, metadata);
  const bareSubject = compactAcademic ? '' : parseBareSubjectFollowUp(message, pendingContext, metadata);
  if (compactAcademic) {
    current.classLevel = compactAcademic.classLevel;
    if (compactAcademic.subject) current.subject = compactAcademic.subject;
    current.chapters = compactAcademic.chapters;
    if (current.intent === 'unknown' && pending?.intent) current.intent = pending.intent;
  }
  if (bareClassLevel) {
    current.classLevel = bareClassLevel;
    if (current.intent === 'unknown' && pending?.intent) current.intent = pending.intent;
  }
  if (bareSubject) {
    current.subject = bareSubject;
    if (current.intent === 'unknown' && pending?.intent) current.intent = pending.intent;
  }
  const parsedCounts = compactCounts || singleMcqCount;
  if (parsedCounts) {
    current.mcqCount = parsedCounts.mcqCount;
    current.shortCount = parsedCounts.shortCount;
    current.longCount = parsedCounts.longCount;
    current.questionCounts = parsedCounts.questionCounts;
    current.questionTypes = parsedCounts.questionTypes;
    if (current.intent === 'unknown' && pending?.intent) current.intent = pending.intent;
  }
  if (!pending?.classLevel && !pending?.subject) return current;

  const contextualScope = [pending.classLevel || current.classLevel, current.subject || pending.subject, message]
    .filter(Boolean)
    .join(' ');
  const contextual = fallbackParse(contextualScope, role, metadata);
  const contextualCounts = parsedCounts || {};
  const contextualChapters = contextual.chapters.length
    ? contextual.chapters
    : bareClassLevel
      ? []
      : parseBareChapterFollowUp(message, pendingContext, { ...current, subject: current.subject || contextual.subject });
  return sanitizeCommand({
    ...current,
    intent: current.intent !== 'unknown' ? current.intent : contextual.intent,
    classLevel: current.classLevel || contextual.classLevel,
    subject: current.subject || contextual.subject,
    fullBook: Boolean(
      current.fullBook ||
        contextual.fullBook ||
        (!current.firstHalf && !current.secondHalf && pending.fullBook && !current.chapters.length)
    ),
    firstHalf: Boolean(
      current.firstHalf ||
        contextual.firstHalf ||
        (!current.fullBook && !current.secondHalf && pending.firstHalf && !current.chapters.length)
    ),
    secondHalf: Boolean(
      current.secondHalf ||
        contextual.secondHalf ||
        (!current.fullBook && !current.firstHalf && pending.secondHalf && !current.chapters.length)
    ),
    chapterRange: Boolean(current.chapterRange || contextual.chapterRange || pending.chapterRange),
    chapters:
      current.fullBook ||
      current.firstHalf ||
      current.secondHalf ||
      contextual.fullBook ||
      contextual.firstHalf ||
      contextual.secondHalf ||
      ((pending.fullBook || pending.firstHalf || pending.secondHalf) && !current.chapters.length)
        ? []
        : current.chapters.length
          ? current.chapters
          : contextualChapters,
    mcqCount: contextualCounts.mcqCount || current.mcqCount || contextual.mcqCount,
    shortCount: contextualCounts.shortCount || current.shortCount || contextual.shortCount,
    longCount: contextualCounts.longCount || current.longCount || contextual.longCount,
    questionCounts: objectHasKeys(contextualCounts.questionCounts)
      ? contextualCounts.questionCounts
      : objectHasKeys(current.questionCounts)
        ? current.questionCounts
        : contextual.questionCounts,
    questionTypes: contextualCounts.questionTypes?.length
      ? contextualCounts.questionTypes
      : current.questionTypes.length
        ? current.questionTypes
        : contextual.questionTypes,
    marks: {
      mcq: current.marks?.mcq || contextual.marks?.mcq || 1,
      short: current.marks?.short || contextual.marks?.short || 2,
      long: current.marks?.long || contextual.marks?.long || 5
    },
    difficulty: current.difficulty !== 'mixed' ? current.difficulty : contextual.difficulty,
    language: current.language || contextual.language,
    generationMode: current.generationMode || contextual.generationMode,
    missingFields: current.missingFields || []
  });
};

const paperAnswerKey = (paper) =>
  paper.questions
    .filter((question) => question.type === 'mcq')
    .map((question, index) => ({
      number: index + 1,
      question: question.question,
      answer: question.correctAnswer || 'Teacher review required'
    }));

const generateStudyPlan = (parsed, academic) => {
  const chapters = academic?.chapters?.length ? academic.chapters : parsed.chapters;
  const subject = academic?.subject || parsed.subject || 'Subject';
  const classLevel = academic?.classLevel || parsed.classLevel || 'Class';
  return [
    `Day 1: ${classLevel} ${subject} ka syllabus overview aur formulas/key terms revise karein.`,
    `Day 2: ${chapters[0] || 'selected chapter'} ke basic concepts aur definitions cover karein.`,
    'Day 3: MCQs practice karein aur wrong answers ki short notes list banayein.',
    'Day 4: Short questions likh kar timing improve karein.',
    'Day 5: Long questions ke headings, diagrams, and examples prepare karein.',
    'Day 6: Mixed practice paper attempt karein.',
    'Day 7: Weak topics revise karein aur final answer key review karein.'
  ];
};

const handlePendingFollowUp = async (req, res, parsed, validation, originalMessage) => {
  const pendingParsed = withMissing(parsed, validation.missing);
  await savePendingContext(req.user, pendingParsed, pendingParsed.missingFields);
  return sendWithLog(
    req,
    res,
    200,
    {
      intent: pendingParsed.intent,
      parsed: pendingParsed,
      needsFollowUp: true,
      confirmationRequired: false,
      message: validation.message
    },
    {
      message: originalMessage,
      parsed: pendingParsed,
      action: 'follow_up',
      status: 'follow_up'
    }
  );
};

const queueGenerationConfirmation = async (req, res, parsed, validation, originalMessage) => {
  const pendingParsed = normalizedParsed(parsed, validation, true);
  const settings = await getSettings();
  const summary = buildSummary(pendingParsed, validation, {
    practiceMcqLimit: settings.paperLimits?.practiceMcqLimit || 20
  });
  const confirmationQuestion = confirmationQuestionFor(pendingParsed.intent);
  await savePendingContext(req.user, pendingParsed, []);

  return sendWithLog(
    req,
    res,
    200,
    {
      intent: pendingParsed.intent,
      parsed: pendingParsed,
      needsFollowUp: true,
      confirmationRequired: true,
      action: 'confirm_generation',
      summary,
      confirmationQuestion,
      message: confirmationQuestion
    },
    {
      message: originalMessage,
      parsed: pendingParsed,
      action: 'awaiting_confirmation',
      status: 'awaiting_confirmation',
      summary
    }
  );
};

const executeGeneration = async (req, res, parsed, validation, originalMessage) => {
  const finalParsed = normalizedParsed(parsed, validation, false);
  const settings = await getSettings();
  const summary = buildSummary(finalParsed, validation, {
    practiceMcqLimit: settings.paperLimits?.practiceMcqLimit || 20
  });

  if (finalParsed.intent === 'generate_paper') {
    await consumeTrialOrRequireSubscription(req.user, 'paper_generation');
    const finalPayload = buildFinalPaperPayload(finalParsed, validation);
    console.log('FINAL PAPER PAYLOAD:', finalPayload);
    const paper = await createBoardPaper(req.user._id, finalPayload);
    await clearPendingContext(req.user._id);

    return sendWithLog(
      req,
      res,
      201,
      {
        intent: finalParsed.intent,
        parsed: finalParsed,
        needsFollowUp: false,
        confirmationRequired: false,
        summary,
        message: 'Paper generated successfully from question bank.',
        paper
      },
      {
        message: originalMessage,
        parsed: finalParsed,
        action: 'generated',
        status: 'generated',
        summary,
        paperId: paper._id
      }
    );
  }

  await consumeTrialOrRequireSubscription(req.user, 'practice_session');
  const practice = await createPracticeAttempt(req.user._id, {
    classLevel: validation.classLevel,
    subject: validation.subject,
    chapters: validation.chapters,
    chapterIds: validation.chapters,
    chapterNames: validation.chapterNames || validation.chapters,
    chapterNumbers: validation.chapterNumbers || [],
    chapterDetails: validation.chapterDetails || [],
    chapterName: (validation.chapterNames || validation.chapters || []).length === 1 ? (validation.chapterNames || validation.chapters)[0] : undefined,
    chapterNumber: (validation.chapterNumbers || []).length === 1 ? validation.chapterNumbers[0] : undefined,
    fullBook: Boolean(validation.fullBook || finalParsed.fullBook),
    firstHalf: Boolean(validation.firstHalf || finalParsed.firstHalf),
    secondHalf: Boolean(validation.secondHalf || finalParsed.secondHalf),
    chapterRange: Boolean(validation.chapterRange || finalParsed.chapterRange),
    chapterMode: chapterModeFromFlags({ ...finalParsed, ...validation }),
    count: finalParsed.mcqCount,
    difficulty: generationDifficulty(finalParsed.difficulty)
  });
  await clearPendingContext(req.user._id);

  return sendWithLog(
    req,
    res,
    201,
    {
      intent: finalParsed.intent,
      parsed: finalParsed,
      needsFollowUp: false,
      confirmationRequired: false,
      summary,
      message: 'Practice paper generated successfully.',
      practice: hidePracticeAnswers(practice)
    },
    {
      message: originalMessage,
      parsed: finalParsed,
      action: 'generated',
      status: 'generated',
      summary,
      practiceId: practice._id
    }
  );
};

const validateGenerationIntent = (parsed, metadata) =>
  parsed.intent === 'generate_paper' ? validatePaperCommand(parsed, metadata) : validatePracticeCommand(parsed, metadata);

const friendlyQuestionBankMessage = (error) => {
  if (error.code === 'INSUFFICIENT_QUESTIONS' || /Only\s+\d+\s+.+questions are available/i.test(error.message || '')) {
    const available = Number(error.available ?? (error.message.match(/Only\s+(\d+)/i) || [])[1] ?? 0);
    const requested = Number(error.requested ?? (error.message.match(/but\s+(\d+)\s+were requested/i) || [])[1] ?? 0);
    const type = String(error.questionType || (error.message.match(/Only\s+\d+\s+([A-Z_]+)/i) || [])[1] || 'questions').toUpperCase();
    return `Question bank me selected class/subject/chapter ke liye sirf ${available} ${type} questions available hain, lekin request ${requested} ki hai. Count kam karein ya question bank me aur ${type} questions add karein.`;
  }

  if (error.code === 'NO_QUESTIONS_FOUND' || /No .*questions found/i.test(error.message || '')) {
    return 'Selected class/subject/chapter ke liye question bank me questions nahi mile. Pehle question bank me data add karein ya filters change karein.';
  }

  return '';
};

const handleChatbotMessage = async (req, res, next) => {
  const message = String(req.body.message || '').trim();

  try {
    if (!message) return res.status(400).json({ message: 'Chat message is required.' });
    if (message.length > 2000) return res.status(400).json({ message: 'Chat message is too long.' });

    if (isCancelOrResetCommand(message)) {
      await clearPendingContext(req.user._id);
      return sendWithLog(
        req,
        res,
        200,
        buildCancelResponse(),
        {
          message,
          action: 'cancelled',
          status: 'cancelled'
        }
      );
    }

    const pendingContext = await getPendingContext(req.user._id);
    let activePendingContext = pendingContext;

    if (pendingContext?.awaitingConfirmation && isEditCommand(message)) {
      const parsed = sanitizeCommand(pendingContext);
      const editParsed = { ...parsed, confirmationRequired: false, awaitingConfirmation: false, state: 'collecting_details' };
      await savePendingContext(req.user, editParsed, editParsed.missingFields || []);
      return sendWithLog(
        req,
        res,
        200,
        buildEditDetailsResponse(editParsed),
        {
          message,
          parsed: editParsed,
          action: 'edit_requested',
          status: 'collecting_details'
        }
      );
    }

    if (pendingContext?.awaitingConfirmation && isNegativeCommand(message)) {
      const parsed = sanitizeCommand(pendingContext);
      await clearPendingContext(req.user._id);
      return sendWithLog(
        req,
        res,
        200,
        buildCancelResponse(parsed),
        {
          message,
          parsed,
          action: 'cancelled',
          status: 'cancelled'
        }
      );
    }

    const metadata = await getQuestionBankMetadata();

    const requestedEditField = activePendingContext?.state === 'collecting_details' ? detectEditFieldRequest(message) : '';
    if (requestedEditField) {
      const editParsed = resetParsedForEditField(activePendingContext, requestedEditField);
      await savePendingContext(req.user, editParsed, editParsed.missingFields || []);
      return sendWithLog(
        req,
        res,
        200,
        buildEditFieldResponse(editParsed, requestedEditField),
        {
          message,
          parsed: editParsed,
          action: 'edit_field_requested',
          status: 'collecting_details'
        }
      );
    }

    if (shouldClearPendingForFreshRequest(activePendingContext, message, req.user.role, metadata)) {
      await clearPendingContext(req.user._id);
      activePendingContext = null;
    }

    if (activePendingContext?.awaitingConfirmation && isAffirmativeCommand(message)) {
      const parsed = applyMarksOverride(sanitizeCommand(activePendingContext), req.body);
      const roleError = requireAllowedRole(parsed.intent, req.user.role);
      if (roleError) throw roleError;
      const validation = validateGenerationIntent(parsed, metadata);
      if (!validation.ok) return handlePendingFollowUp(req, res, parsed, validation, message);
      return executeGeneration(req, res, parsed, validation, message);
    }

    const parsedMessage = enrichParsedWithPendingScope({
      parsedMessage: await parseUserCommand(message, req.user.role, metadata),
      pendingContext: activePendingContext,
      message,
      role: req.user.role,
      metadata
    });
    const parsed = mergeParsedWithPending({
      parsed: parsedMessage,
      pendingContext: activePendingContext,
      message,
      role: req.user.role
    });

    const roleError = requireAllowedRole(parsed.intent, req.user.role);
    if (roleError) throw roleError;

    if (parsed.intent === 'unknown') {
      const pendingParsed = withMissing(parsed, ['intent']);
      await savePendingContext(req.user, pendingParsed, pendingParsed.missingFields);
      return sendWithLog(
        req,
        res,
        200,
        {
          intent: pendingParsed.intent,
          parsed: pendingParsed,
          needsFollowUp: true,
          confirmationRequired: false,
          message: 'Please tell me what you want: generate paper, generate practice, explain answer, answer key, or study plan.'
        },
        {
          message,
          parsed: pendingParsed,
          action: 'follow_up',
          status: 'follow_up'
        }
      );
    }

    if (parsed.intent === 'generate_paper' || parsed.intent === 'generate_practice') {
      const validation = validateGenerationIntent(parsed, metadata);
      if (!validation.ok) return handlePendingFollowUp(req, res, parsed, validation, message);
      return queueGenerationConfirmation(req, res, parsed, validation, message);
    }

    if (parsed.intent === 'explain_answer') {
      await clearPendingContext(req.user._id);
      const explanation = await generateExplanation(message, parsed);
      return sendWithLog(
        req,
        res,
        200,
        {
          intent: parsed.intent,
          parsed,
          needsFollowUp: false,
          confirmationRequired: false,
          message: explanation,
          explanation
        },
        {
          message,
          parsed,
          action: 'answered',
          status: 'generated'
        }
      );
    }

    if (parsed.intent === 'generate_answer_key') {
      const paperId = req.body.paperId || req.body.context?.paperId;
      if (!paperId) {
        const pendingParsed = withMissing(parsed, ['paperId']);
        await savePendingContext(req.user, pendingParsed, pendingParsed.missingFields);
        return sendWithLog(
          req,
          res,
          200,
          {
            intent: pendingParsed.intent,
            parsed: pendingParsed,
            needsFollowUp: true,
            confirmationRequired: false,
            message: 'Please select or generate a paper first, then I can create the answer key.'
          },
          {
            message,
            parsed: pendingParsed,
            action: 'follow_up',
            status: 'follow_up'
          }
        );
      }

      const paper = await Paper.findById(paperId);
      if (!paper) return res.status(404).json({ message: 'Paper not found.' });
      const ownsPaper = String(paper.teacherId) === String(req.user._id);
      if (!ownsPaper && !isTrustedAdmin(req.user)) return res.status(403).json({ message: 'You cannot access this paper.' });

      await clearPendingContext(req.user._id);
      return sendWithLog(
        req,
        res,
        200,
        {
          intent: parsed.intent,
          parsed,
          needsFollowUp: false,
          confirmationRequired: false,
          message: 'Answer key generated.',
          answerKey: paperAnswerKey(paper)
        },
        {
          message,
          parsed,
          action: 'answer_key',
          status: 'generated',
          paperId: paper._id
        }
      );
    }

    if (parsed.intent === 'generate_study_plan') {
      const academic = validateCommonAcademicFields(parsed, metadata);
      if (!academic.ok) return handlePendingFollowUp(req, res, parsed, academic, message);

      await clearPendingContext(req.user._id);
      return sendWithLog(
        req,
        res,
        200,
        {
          intent: parsed.intent,
          parsed,
          needsFollowUp: false,
          confirmationRequired: false,
          message: 'Study plan generated.',
          studyPlan: generateStudyPlan(parsed, academic)
        },
        {
          message,
          parsed,
          action: 'study_plan',
          status: 'generated'
        }
      );
    }

    if (parsed.intent === 'weak_topic_analysis') {
      const academic = validateCommonAcademicFields(parsed, metadata);
      if (!academic.ok) return handlePendingFollowUp(req, res, parsed, academic, message);

      await clearPendingContext(req.user._id);
      return sendWithLog(
        req,
        res,
        200,
        {
          intent: parsed.intent,
          parsed,
          needsFollowUp: false,
          confirmationRequired: false,
          message: 'Weak topic analysis ready.',
          analysis: [
            `${academic.subject} me ${academic.chapters.join(', ')} ke MCQs, short answers, aur long answers separately attempt karein.`,
            'Jis type me score kam aaye us chapter ke definitions, formulas, aur board-style examples revise karein.',
            'Next practice me wrong-answer notebook maintain karein taake repeated mistakes clear ho saken.'
          ]
        },
        {
          message,
          parsed,
          action: 'weak_topic_analysis',
          status: 'generated'
        }
      );
    }

    return sendWithLog(
      req,
      res,
      200,
      {
        intent: parsed.intent,
        parsed,
        needsFollowUp: true,
        confirmationRequired: false,
        message: 'Please rephrase your request with class, subject, chapters, and counts.'
      },
      {
        message,
        parsed,
        action: 'follow_up',
        status: 'follow_up'
      }
    );
  } catch (error) {
    const friendlyMessage = friendlyQuestionBankMessage(error);
    if (friendlyMessage) {
      await writeChatbotLog(req, {
        message,
        responseMessage: friendlyMessage,
        action: 'error',
        status: 'error',
        error: error.message
      });
      return res.status(error.statusCode || 400).json({
        message: friendlyMessage,
        code: error.code || 'QUESTION_BANK_ERROR'
      });
    }

    await writeChatbotLog(req, {
      message,
      responseMessage: error.message,
      action: 'error',
      status: 'error',
      error: error.message
    });
    return next(error);
  }
};

const resetChatbotContext = async (req, res, next) => {
  try {
    await clearPendingContext(req.user._id);
    return sendWithLog(
      req,
      res,
      200,
      buildCancelResponse(),
      {
        message: 'reset',
        action: 'cancelled',
        status: 'cancelled'
      }
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  handleChatbotMessage,
  resetChatbotContext,
  __private: {
    isCancelOrResetCommand,
    buildCancelResponse,
    buildEditDetailsResponse,
    buildEditFieldResponse,
    buildFinalPaperPayload,
    buildSummary,
    confirmationQuestionFor,
    detectEditFieldRequest,
    displaySubjectName,
    enrichParsedWithPendingScope,
    applyMarksOverride,
    resetParsedForEditField,
    isEditCommand,
    isFreshFullRequest,
    shouldClearPendingForFreshRequest,
    isNegativeCommand,
    parseBareChapterFollowUp,
    parseBareClassFollowUp,
    parseBareSubjectFollowUp,
    parseCompactAcademicFollowUp,
    parseCompactClassChapterFollowUp,
    parseCompactQuestionCounts,
    parseSingleMcqCountFollowUp,
    isResetCommand,
    normalizeReply,
    validateCommonAcademicFields,
    validateGenerationIntent
  }
};
