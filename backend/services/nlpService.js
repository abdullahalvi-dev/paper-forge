/*
 * Roman Urdu comments:
 * Ye service Gemini ko sirf natural-language command samjhane ke liye use karti hai.
 * Agar Gemini available na ho to deterministic parser Roman Urdu/English command se JSON nikalta hai.
 */
const {
  allQuestionTypes,
  allSubjects,
  chapterMatchKey,
  metadataSummary,
  normalizeKey: metadataKey,
  resolveClassLevel,
  resolveSubject,
  subjectEntry
} = require('./questionBankMetadataService');

const allowedIntents = [
  'generate_paper',
  'generate_practice',
  'explain_answer',
  'generate_answer_key',
  'generate_study_plan',
  'weak_topic_analysis',
  'unknown'
];

const allowedDifficulties = ['easy', 'medium', 'hard', 'mixed', 'board_style', 'conceptual', 'numerical'];
const allowedLanguages = ['english', 'urdu', 'roman_urdu'];
const allowedGenerationModes = ['question_bank', 'ai', 'hybrid'];

const defaultCommand = () => ({
  intent: 'unknown',
  classLevel: '',
  subject: '',
  chapters: [],
  chapterNumbers: [],
  chapterNames: [],
  chapterDetails: [],
  fullBook: false,
  firstHalf: false,
  secondHalf: false,
  chapterRange: false,
  mcqCount: 0,
  shortCount: 0,
  longCount: 0,
  questionCounts: {},
  questionTypes: [],
  marks: {
    mcq: 1,
    short: 2,
    long: 5
  },
  difficulty: 'mixed',
  language: 'english',
  generationMode: 'question_bank',
  missingFields: [],
  confirmationRequired: false
});

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
};

const positiveNumber = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
};

const arrayValue = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const titleCase = (value = '') =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const containsPhrase = (haystackKey, phraseKey) => {
  if (!haystackKey || !phraseKey) return false;
  return new RegExp(`(^| )${escapeRegex(phraseKey)}( |$)`).test(haystackKey);
};

const ordinalWordPattern =
  'first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth';
const classTokenPattern = `\\d{1,3}(?:st|nd|rd|th)?|${ordinalWordPattern}`;

const normalizeUserPrompt = (message = '') =>
  String(message || '')
    .normalize('NFKC')
    .replace(/\bch(?:ap)?e?t(?:e|a)?rs?\b/gi, 'chapter')
    .replace(/\bchapetrs?\b/gi, 'chapter')
    .replace(/\bchepters?\b/gi, 'chapter')
    .replace(/\bchapters?\b/gi, 'chapter')
    .replace(/\bunits?\b/gi, 'chapter')
    .replace(/\bch\.?\s*(\d{1,2})\b/gi, 'chapter $1')
    .replace(/\bjamaat\b/gi, 'class')
    .replace(/\bmazmoon\b/gi, 'subject')
    .replace(/\bobjectives?\b/gi, 'mcq')
    .replace(/\bobj\b/gi, 'mcq')
    .replace(/\bmcqs\b/gi, 'mcq')
    .replace(/\bshorts\b/gi, 'short')
    .replace(/\blongs\b/gi, 'long')
    .replace(/\bling\b/gi, 'long')
    .replace(/\bnumbers?\b/gi, 'marks')
    .replace(/\basan\b/gi, 'easy')
    .replace(/\bmushkil\b/gi, 'hard')
    .replace(/\bdifficult\b/gi, 'hard')
    .replace(/\bdarmiyani\b/gi, 'medium')
    .replace(/\b(\d{1,2})(?:st|nd|rd|th)?\s+class\b/gi, 'class $1')
    .replace(/\bclass\s+(\d{1,2})(?:st|nd|rd|th)?\b/gi, 'class $1')
    .replace(/\b(\d{1,2})(?:st|nd|rd|th)?\s+chapter\b/gi, (match, number, offset, source) => {
      const before = source.slice(Math.max(0, offset - 8), offset);
      return /\bclass\s+$/i.test(before) ? match : `chapter ${number}`;
    })
    .replace(/\bchapter\s+(?:is|number|no\.?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/gi, 'chapter $1')
    .replace(/\bky\b/gi, 'ke')
    .replace(/\bkr\b/gi, 'kar')
    .replace(/\bkro\b/gi, 'karo')
    .replace(/\s+/g, ' ')
    .trim();

const isFullBookRequest = (message = '') => {
  const key = metadataKey(normalizeUserPrompt(message));
  return [
    'full book',
    'complete book',
    'all chapter',
    'all chapters',
    'full syllabus',
    'complete syllabus',
    'puri book',
    'poori book',
    'tamam chapter',
    'tamam chapters',
    'sari book',
    'saari book'
  ].some((phrase) => containsPhrase(key, metadataKey(phrase)));
};

const isFirstHalfRequest = (message = '') => {
  const key = metadataKey(normalizeUserPrompt(message));
  return [
    'first half',
    'first half book',
    'initial chapter',
    'initial chapters',
    'pehla half',
    'pehly half chapter',
    'pehly half chapters',
    'pehle half chapter',
    'pehle half chapters'
  ].some((phrase) => containsPhrase(key, metadataKey(phrase)));
};

const isSecondHalfRequest = (message = '') => {
  const key = metadataKey(normalizeUserPrompt(message));
  return [
    'second half',
    'last half',
    'remaining chapter',
    'remaining chapters',
    'dusra half',
    'doosra half',
    'last chapter',
    'last chapters'
  ].some((phrase) => containsPhrase(key, metadataKey(phrase)));
};

const chapterRangeRegex = /\bchapter\s+(\d{1,2})(?:st|nd|rd|th)?\s*(?:to|-|sy|se)\s*(\d{1,2})(?:st|nd|rd|th)?\s*(?:tak|tk)?\b/gi;

const isChapterRangeRequest = (message = '') => {
  const text = normalizeUserPrompt(message);
  chapterRangeRegex.lastIndex = 0;
  return chapterRangeRegex.test(text);
};

const normalizeParsedClassLevel = (value = '') => {
  return titleCase(value);
};

const sanitizeCommand = (raw = {}) => {
  const command = defaultCommand();
  const intent = allowedIntents.includes(raw.intent) ? raw.intent : 'unknown';
  const difficulty = allowedDifficulties.includes(raw.difficulty) ? raw.difficulty : 'mixed';
  const language = allowedLanguages.includes(raw.language) ? raw.language : 'english';
  const generationMode = allowedGenerationModes.includes(raw.generationMode) ? raw.generationMode : 'question_bank';
  const rawQuestionCounts = raw.questionCounts instanceof Map ? Object.fromEntries(raw.questionCounts) : raw.questionCounts;

  return {
    ...command,
    intent,
    classLevel: normalizeParsedClassLevel(raw.classLevel),
    subject: titleCase(raw.subject || ''),
    chapters: Array.isArray(raw.chapters) ? raw.chapters.map((item) => String(item).trim()).filter(Boolean) : [],
    chapterNumbers: arrayValue(raw.chapterNumbers || raw.chapterNumber).map(positiveNumber).filter(Boolean),
    chapterNames: arrayValue(raw.chapterNames || raw.chapterName).map((item) => String(item).trim()).filter(Boolean),
    chapterDetails: Array.isArray(raw.chapterDetails)
      ? raw.chapterDetails
          .map((item) => ({
            chapterNumber: positiveNumber(item?.chapterNumber || item?.number),
            chapterName: String(item?.chapterName || item?.name || '').trim()
          }))
          .filter((item) => item.chapterNumber || item.chapterName)
      : [],
    fullBook: Boolean(raw.fullBook),
    firstHalf: Boolean(raw.firstHalf),
    secondHalf: Boolean(raw.secondHalf),
    chapterRange: Boolean(raw.chapterRange),
    mcqCount: toNumber(raw.mcqCount),
    shortCount: toNumber(raw.shortCount),
    longCount: toNumber(raw.longCount),
    questionCounts:
      rawQuestionCounts && typeof rawQuestionCounts === 'object' && !Array.isArray(rawQuestionCounts)
        ? Object.fromEntries(
            Object.entries(rawQuestionCounts)
              .map(([key, value]) => [metadataKey(key), toNumber(value)])
              .filter(([key, value]) => key && value > 0)
          )
        : {},
    questionTypes: Array.isArray(raw.questionTypes)
      ? raw.questionTypes.map((item) => String(item).trim()).filter(Boolean)
      : [],
    marks: {
      mcq: toNumber(raw.marks?.mcq, 1) || 1,
      short: toNumber(raw.marks?.short, 2) || 2,
      long: toNumber(raw.marks?.long, 5) || 5
    },
    difficulty,
    language,
    generationMode,
    missingFields: Array.isArray(raw.missingFields) ? raw.missingFields.map((item) => String(item)) : [],
    confirmationRequired: Boolean(raw.confirmationRequired),
    awaitingConfirmation: Boolean(raw.awaitingConfirmation),
    state: String(raw.state || '')
  };
};

const extractJson = (text = '') => {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('Gemini returned empty response');
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return JSON.parse(trimmed);

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return JSON.parse(fenced[1].trim());

  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) return JSON.parse(trimmed.slice(first, last + 1));

  throw new Error('Gemini response was not valid JSON');
};

const geminiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || '';

const callGemini = async ({ prompt, temperature = 0.1, maxOutputTokens = 700 }) => {
  const apiKey = geminiKey();
  if (!apiKey) {
    const error = new Error('Gemini API key is not configured');
    error.code = 'GEMINI_KEY_MISSING';
    throw error;
  }

  if (typeof fetch !== 'function') {
    const error = new Error('Node.js fetch API is not available');
    error.code = 'FETCH_UNAVAILABLE';
    throw error;
  }

  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens,
        responseMimeType: 'application/json'
      }
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error?.message || 'Gemini request failed');
    error.statusCode = response.status;
    throw error;
  }

  return data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n') || '';
};

const detectLanguage = (message) => {
  if (/[\u0600-\u06FF]/.test(message)) return 'urdu';
  if (/\b(karo|bna|banao|bnao|banado|chahiye|class|chapter|sawal|jawab|samjhao|mujh|mujhe)\b/i.test(message)) {
    return 'roman_urdu';
  }
  return 'english';
};

const extractIntent = (message) => {
  const lower = message.toLowerCase();
  if (/\b(answer key|key)\b/.test(lower)) return 'generate_answer_key';
  if (/\b(study plan|schedule|timetable)\b/.test(lower)) return 'generate_study_plan';
  if (/\b(weak topic|weak topics|weakness|analysis|analyse|analyze)\b/.test(lower)) return 'weak_topic_analysis';
  if (/\b(explain|samjha|samjhao|explanation)\b/.test(lower)) return 'explain_answer';
  if (/\b(practice|test)\b/.test(lower)) return 'generate_practice';
  if (/\bpaper\b/.test(lower)) return 'generate_paper';
  return 'unknown';
};

const extractClassLevel = (message, metadata) => {
  const text = normalizeUserPrompt(message);
  const haystack = metadataKey(text);
  const matchedClass = (metadata?.classes || []).find((classItem) =>
    (classItem.aliases || [])
      .filter((alias) => !/^\d+$/.test(alias))
      .some((alias) => containsPhrase(haystack, alias))
  );

  if (matchedClass) return matchedClass.name;

  const directPatterns = [
    new RegExp(`\\bclass\\s+(${classTokenPattern})\\b`, 'i'),
    new RegExp(`\\bgrade\\s+(${classTokenPattern})\\b`, 'i'),
    new RegExp(`\\b(${classTokenPattern})\\s+(?:class|grade|year)\\b`, 'i'),
    new RegExp(`\\bpart\\s+(${classTokenPattern})\\b`, 'i')
  ];

  for (const pattern of directPatterns) {
    const match = text.match(pattern);
    if (match) {
      const candidate = match[0];
      return resolveClassLevel(candidate, metadata) || titleCase(candidate);
    }
  }

  return '';
};

const metadataSubjectMatch = (message, classLevel, metadata) => {
  const haystack = metadataKey(message);
  const subjects = allSubjects(metadata, classLevel)
    .flatMap((subjectItem) =>
      (subjectItem.aliases || [subjectItem.name]).map((alias) => ({
        subject: subjectItem.name,
        alias,
        length: alias.length
      }))
    )
    .sort((left, right) => right.length - left.length);

  const match = subjects.find((item) => containsPhrase(haystack, item.alias));
  return match?.subject || '';
};

const chapterCandidates = (metadata, classLevel = '', subject = '') => {
  const selectedSubject = subjectEntry(classLevel, subject, metadata);
  if (selectedSubject) return selectedSubject.chapters || [];

  const resolvedClass = resolveClassLevel(classLevel, metadata) || classLevel;
  const classKey = metadataKey(resolvedClass);
  const subjectKey = metadataKey(subject);
  const seen = new Map();

  (metadata?.classes || []).forEach((classItem) => {
    if (classKey && metadataKey(classItem.name) !== classKey) return;

    (classItem.subjects || []).forEach((subjectItem) => {
      const aliases = subjectItem.aliases?.length ? subjectItem.aliases : [subjectItem.name];
      if (subjectKey && !aliases.some((alias) => metadataKey(alias) === subjectKey)) return;

      (subjectItem.chapters || []).forEach((chapter) => {
        const key = metadataKey(chapter.name);
        if (key && !seen.has(key)) seen.set(key, chapter);
      });
    });
  });

  return [...seen.values()];
};

const matchingChapterNames = (message, classLevel = '', subject = '', metadata = null) => {
  const text = normalizeUserPrompt(message);
  const haystack = metadataKey(text);
  const haystackMatchKey = chapterMatchKey(haystack);
  const matched = [];

  chapterCandidates(metadata, classLevel, subject).forEach((chapter) => {
    const aliases = chapter.aliases?.length ? chapter.aliases : [chapter.name];
    const isMatch = aliases.some((alias) => {
      const aliasKey = metadataKey(alias);
      if (!aliasKey || !/\D/.test(aliasKey)) return false;
      if (/^(?:chapter|unit|ch)(?: number| no)? \d{1,3}$/.test(aliasKey)) return false;

      const aliasMatchKey = chapterMatchKey(alias);
      return (
        containsPhrase(haystack, aliasKey) ||
        (aliasMatchKey && containsPhrase(haystackMatchKey, aliasMatchKey))
      );
    });

    if (isMatch) addChapter(matched, chapter.name);
  });

  return matched;
};

const cleanSubjectPhrase = (value = '') => {
  const stopWords = new Set([
    'mujh',
    'mujhe',
    'ko',
    'ka',
    'ke',
    'ki',
    'se',
    'paper',
    'practice',
    'test',
    'mcq',
    'objective',
    'obj',
    'aur',
    'generate',
    'karo',
    'bna',
    'bnao',
    'banao',
    'banado',
    'kar',
    'do',
    'class',
    'year',
    'st',
    'nd',
    'rd',
    'th',
    'first',
    'second',
    'inter',
    'part',
    'chapter',
    'with',
    'for',
    'of',
    'a',
    'an',
    'the',
    'and',
    'easy',
    'medium',
    'hard',
    'mixed',
    'board',
    'style',
    'conceptual',
    'numerical'
  ]);

  return metadataKey(value)
    .split(' ')
    .filter((word) => word && !stopWords.has(word) && !/^\d+(?:st|nd|rd|th)?$/.test(word))
    .join(' ')
    .trim();
};

const phraseSubjectFallback = (message) => {
  const text = normalizeUserPrompt(message);
  const explicit = text.match(/\b(?:subject|mazmoon)\s+(?:is\s+)?([a-z][a-z\s&-]{1,60})/i);
  if (explicit) {
    const cleaned = cleanSubjectPhrase(explicit[1]);
    if (cleaned) return titleCase(cleaned);
  }

  const beforeClass = text.match(
    new RegExp(`^\\s*([a-z][a-z\\s&-]{1,80})\\s+(?:class\\s+${classTokenPattern}|${classTokenPattern}\\s+(?:class|grade|year)|grade\\s+${classTokenPattern})`, 'i')
  );
  if (beforeClass) {
    const cleaned = cleanSubjectPhrase(beforeClass[1]);
    if (cleaned) return titleCase(cleaned);
  }

  const beforeChapter = text.match(/([a-z][a-z\s&-]{1,90})\s+(?:ka|ke|ki|se)?\s*chapter\s*(?:\d{1,2}|[a-z])/i);
  if (beforeChapter) {
    const cleaned = cleanSubjectPhrase(beforeChapter[1]);
    if (cleaned) return titleCase(cleaned);
  }

  const beforeTask = text.match(
    /^\s*([a-z][a-z\s&-]{1,80})\s+(?:ka|ke|ki)?\s*(?:paper|practice|test|mcq|short|long|fill|viva|practical|numerical|conceptual)\b/i
  );
  if (beforeTask) {
    const cleaned = cleanSubjectPhrase(beforeTask[1]);
    if (cleaned) return titleCase(cleaned);
  }

  return '';
};

const extractSubject = (message, classLevel, metadata) => {
  const fromMetadata = metadataSubjectMatch(message, classLevel, metadata);
  if (fromMetadata) return fromMetadata;
  const fallback = phraseSubjectFallback(message);
  const resolvedFallback = resolveSubject(fallback, classLevel, metadata);
  if (resolvedFallback) return resolvedFallback;
  if (fallback && matchingChapterNames(fallback, classLevel, '', metadata).length) return '';
  const cleaned = cleanSubjectPhrase(message);
  const resolvedCleaned = resolveSubject(cleaned, classLevel, metadata);
  if (resolvedCleaned) return resolvedCleaned;
  const tokenMatch = cleaned
    .split(' ')
    .map((token) => resolveSubject(token, classLevel, metadata))
    .find(Boolean);
  if (tokenMatch) return tokenMatch;
  return fallback;
};

const extractNumberNear = (message, labels) => {
  const joined = labels.join('|');
  const patterns = [
    new RegExp(`\\b(\\d{1,3})\\s*(?:${joined})\\b`, 'i'),
    new RegExp(`\\b(?:${joined})\\D{0,16}(\\d{1,3})\\b`, 'i')
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && !isChapterNumberMatch(message, match.index)) return Number(match[1]);
  }
  return 0;
};

const isChapterNumberMatch = (message, index = 0) => {
  const before = String(message || '').slice(Math.max(0, index - 12), index);
  return /\bchapter\s*$/i.test(before);
};

const genericQuestionTypeAliases = {
  mcq: ['mcq', 'multiple choice', 'obj', 'objective'],
  short: ['short', 'short question'],
  long: ['long', 'long question', 'ling'],
  fill: ['fill', 'fill in the blank', 'fill in the blanks', 'blank'],
  true_false: ['true false', 'true/false', 'true or false', 'tf'],
  practical: ['practical'],
  viva: ['viva'],
  numerical: ['numerical', 'numeric'],
  conceptual: ['conceptual', 'concept']
};

const questionTypeCandidates = (metadata) => {
  const dynamic = allQuestionTypes(metadata).flatMap((typeItem) =>
    (typeItem.aliases || [typeItem.name]).map((alias) => ({
      canonical: typeItem.name,
      alias: metadataKey(alias)
    }))
  );

  const generic = Object.entries(genericQuestionTypeAliases).flatMap(([canonical, aliases]) =>
    aliases.map((alias) => ({ canonical, alias: metadataKey(alias) }))
  );

  return [...dynamic, ...generic]
    .filter((item) => item.alias)
    .sort((left, right) => right.alias.length - left.alias.length);
};

const extractQuestionCounts = (message, metadata) => {
  const counts = {};
  questionTypeCandidates(metadata).forEach(({ canonical, alias }) => {
    if (counts[canonical]) return;
    const patterns = [
      new RegExp(`\\b(\\d{1,3})\\s*(?:${escapeRegex(alias)})\\b`, 'i'),
      new RegExp(`\\b(?:${escapeRegex(alias)})\\D{0,18}(\\d{1,3})\\b`, 'i')
    ];
    const match = patterns.map((pattern) => message.match(pattern)).find((item) => item && !isChapterNumberMatch(message, item.index));
    if (match) counts[canonical] = Number(match[1]);
  });
  return counts;
};

const extractQuestionTypes = (message, metadata) => {
  const haystack = metadataKey(message);
  return [
    ...new Set(
      questionTypeCandidates(metadata)
        .filter(({ alias }) => containsPhrase(haystack, alias))
        .map(({ canonical }) => canonical)
    )
  ];
};

const cleanChapterPhrase = (value = '') => {
  const raw = String(value || '')
    .split(/\b(?:mcq|short|long|marks|paper|practice|test|with|se|ka|ke|ki|bna|bnao|banao|generate|karo)\b/i)[0]
    .replace(/[.,;:]+$/g, '')
    .trim();
  return raw ? titleCase(raw) : '';
};

const addChapter = (chapters, value) => {
  const chapter = String(value || '').trim();
  if (chapter && !chapters.includes(chapter)) chapters.push(chapter);
};

const addChapterRange = (chapters, start, end) => {
  const first = Number(start);
  const last = Number(end);
  if (!Number.isFinite(first) || !Number.isFinite(last) || first <= 0 || last <= 0) return;
  const direction = first <= last ? 1 : -1;
  for (let number = first; direction > 0 ? number <= last : number >= last; number += direction) {
    addChapter(chapters, String(number));
  }
};

const extractChapters = (message, classLevel, subject, metadata) => {
  const chapters = [];
  const text = normalizeUserPrompt(message);

  chapterRangeRegex.lastIndex = 0;
  for (const match of text.matchAll(chapterRangeRegex)) {
    addChapterRange(chapters, match[1], match[2]);
  }

  for (const match of text.matchAll(/\bchapter\s+((?:\d{1,2}(?:st|nd|rd|th)?)(?:\s*(?:,|and|aur|&)\s*\d{1,2}(?:st|nd|rd|th)?){0,12})\b/gi)) {
    for (const numberMatch of match[1].matchAll(/\d{1,2}/g)) {
      addChapter(chapters, numberMatch[0]);
    }
  }

  for (const match of text.matchAll(/\bchapter\s*(\d{1,2})(?:st|nd|rd|th)?\b/gi)) {
    const before = text.slice(Math.max(0, match.index - 6), match.index);
    if (/\b\d{1,2}\s+$/.test(before)) continue;
    addChapter(chapters, match[1]);
  }

  for (const match of text.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?\s+chapter\b/gi)) {
    const before = text.slice(Math.max(0, match.index - 8), match.index);
    if (/\bclass\s+$/i.test(before)) continue;
    addChapter(chapters, match[1]);
  }

  for (const match of text.matchAll(/\bchapter\s+([a-z][a-z0-9\s&-]{1,80})/gi)) {
    const cleaned = cleanChapterPhrase(match[1]);
    if (cleaned) addChapter(chapters, cleaned);
  }

  matchingChapterNames(text, classLevel, subject, metadata).forEach((chapter) => addChapter(chapters, chapter));

  return chapters;
};

const marksFor = (message, labels, fallback) => {
  const joined = labels.join('|');
  const patterns = [
    new RegExp(`\\beach\\s+(?:${joined})\\D{0,24}(\\d{1,2})\\s*marks?`, 'i'),
    new RegExp(`\\b(?:${joined})\\D{0,18}(\\d{1,2})\\s*marks?\\s*(?:each)?`, 'i')
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) return Number(match[1]);
  }
  return fallback;
};

const extractDifficulty = (message) => {
  const lower = message.toLowerCase();
  if (/\beasy\b/.test(lower)) return 'easy';
  if (/\bmedium\b/.test(lower)) return 'medium';
  if (/\bhard\b/.test(lower)) return 'hard';
  if (/\bboard\s*style\b/.test(lower)) return 'board_style';
  if (/\bconceptual\b/.test(lower)) return 'conceptual';
  if (/\bnumerical\b/.test(lower)) return 'numerical';
  return 'mixed';
};

const extractGenerationMode = (message) => {
  const lower = message.toLowerCase();
  if (/\bhybrid\b/.test(lower)) return 'hybrid';
  if (/\bai\b/.test(lower)) return 'ai';
  return 'question_bank';
};

const fallbackParse = (message = '', userRole = 'student', metadata = null) => {
  const text = normalizeUserPrompt(message);
  const lower = text.toLowerCase();
  const command = defaultCommand();

  command.intent = extractIntent(lower);
  command.classLevel = extractClassLevel(lower, metadata);
  command.subject = extractSubject(lower, command.classLevel, metadata);
  command.fullBook = isFullBookRequest(lower);
  command.firstHalf = !command.fullBook && isFirstHalfRequest(lower);
  command.secondHalf = !command.fullBook && !command.firstHalf && isSecondHalfRequest(lower);
  command.chapterRange = !command.fullBook && !command.firstHalf && !command.secondHalf && isChapterRangeRequest(lower);
  command.chapters =
    command.fullBook || command.firstHalf || command.secondHalf
      ? []
      : extractChapters(lower, command.classLevel, command.subject, metadata);
  command.questionCounts = extractQuestionCounts(lower, metadata);
  command.questionTypes = extractQuestionTypes(lower, metadata);
  command.mcqCount = command.questionCounts.mcq || extractNumberNear(lower, ['mcq', 'multiple choice', 'objective']);
  command.shortCount = command.questionCounts.short || extractNumberNear(lower, ['short']);
  command.longCount = command.questionCounts.long || extractNumberNear(lower, ['long']);
  if (command.intent === 'unknown' && command.questionTypes.length) {
    command.intent = command.questionTypes.some((type) => ['short', 'long'].includes(metadataKey(type)))
      ? 'generate_paper'
      : 'generate_practice';
  }
  if (
    command.intent === 'unknown' &&
    (command.classLevel || command.subject || command.chapters.length) &&
    (command.mcqCount || command.shortCount || command.longCount)
  ) {
    command.intent = command.shortCount || command.longCount ? 'generate_paper' : 'generate_practice';
  }
  command.marks.mcq = marksFor(lower, ['mcq', 'multiple choice'], 1);
  command.marks.short = marksFor(lower, ['short'], 2);
  command.marks.long = marksFor(lower, ['long'], 5);
  command.difficulty = extractDifficulty(lower);
  command.language = detectLanguage(text);
  command.generationMode = extractGenerationMode(lower);

  return sanitizeCommand(command);
};

const mergeWithDeterministicFallback = (parsed, message, userRole, metadata) => {
  const fallback = fallbackParse(message, userRole, metadata);
  const merged = {
    ...parsed,
    classLevel: parsed.classLevel || fallback.classLevel,
    subject: parsed.subject || fallback.subject,
    fullBook: Boolean(parsed.fullBook || fallback.fullBook),
    firstHalf: Boolean(parsed.firstHalf || fallback.firstHalf),
    secondHalf: Boolean(parsed.secondHalf || fallback.secondHalf),
    chapterRange: Boolean(parsed.chapterRange || fallback.chapterRange),
    chapters:
      parsed.fullBook || fallback.fullBook || parsed.firstHalf || fallback.firstHalf || parsed.secondHalf || fallback.secondHalf
        ? []
        : parsed.chapters.length
          ? parsed.chapters
          : fallback.chapters,
    chapterNumbers: parsed.chapterNumbers?.length ? parsed.chapterNumbers : fallback.chapterNumbers,
    chapterNames: parsed.chapterNames?.length ? parsed.chapterNames : fallback.chapterNames,
    chapterDetails: parsed.chapterDetails?.length ? parsed.chapterDetails : fallback.chapterDetails,
    mcqCount: parsed.mcqCount || fallback.mcqCount,
    shortCount: parsed.shortCount || fallback.shortCount,
    longCount: parsed.longCount || fallback.longCount,
    questionCounts: Object.keys(parsed.questionCounts || {}).length ? parsed.questionCounts : fallback.questionCounts,
    questionTypes: parsed.questionTypes?.length ? parsed.questionTypes : fallback.questionTypes,
    language: parsed.language || fallback.language,
    intent: parsed.intent !== 'unknown' ? parsed.intent : fallback.intent,
    difficulty: parsed.difficulty !== 'mixed' ? parsed.difficulty : fallback.difficulty,
    generationMode: parsed.generationMode || fallback.generationMode,
    marks: {
      mcq: parsed.marks?.mcq || fallback.marks.mcq,
      short: parsed.marks?.short || fallback.marks.short,
      long: parsed.marks?.long || fallback.marks.long
    }
  };

  const missingFields = new Set(parsed.missingFields || []);
  if (merged.intent !== 'unknown') missingFields.delete('intent');
  if (merged.classLevel) missingFields.delete('classLevel');
  if (merged.subject) missingFields.delete('subject');
  if (merged.fullBook || merged.firstHalf || merged.secondHalf || merged.chapterRange || merged.chapters.length) missingFields.delete('chapters');
  if (merged.mcqCount || merged.shortCount || merged.longCount || Object.keys(merged.questionCounts || {}).length) {
    ['mcqCount', 'shortCount', 'longCount', 'question counts'].forEach((field) => missingFields.delete(field));
  }
  merged.missingFields = [...missingFields];
  merged.confirmationRequired = Boolean(merged.missingFields.length && parsed.confirmationRequired);

  return sanitizeCommand(merged);
};

const buildParserPrompt = (message, userRole, metadata) => {
  const available = metadataSummary(metadata).slice(0, 9000);
  return `You are a strict command parser for Paper Forge.
Return only one JSON object. No markdown. No explanation.

User role: ${userRole}

Available question-bank metadata:
${available || 'No question-bank metadata loaded.'}

Rules:
- Do not hard-code any class, subject, book, or chapter. Use the metadata above when possible.
- Keep chapter numbers as strings like "5"; backend will resolve them dynamically.
- If user writes a chapter name, put that name in chapters.
- If user asks for full book, complete book, all chapters, full syllabus, puri book, tamam chapters, or sari book, set fullBook true and keep chapters empty.
- If user asks for first half, first half book, initial chapters, pehla half, or pehly half chapters, set firstHalf true and keep chapters empty.
- If user asks for second half, last half, remaining chapters, dusra half, or last chapters, set secondHalf true and keep chapters empty.
- If user asks for chapter ranges like chapter 1 to 4, chapters 2-5, chapter 1 sy 4 tk, or chapter 2 se 5 tak, set chapterRange true and put all chapter numbers in chapters.
- If a field is missing, keep it empty/0 and add its name in missingFields.
- Do not invent question counts, marks, classes, subjects, or chapters.
- Understand Roman Urdu words like bna do, generate karo, class/jamaat, subject/mazmoon, chapter/unit/ch/chepter/chapetr, mcq/objective/obj, short, long/ling, marks/number, easy/asan, hard/mushkil, medium/darmiyani.
- Detect dynamic question types from metadata, and also keep unknown future types in questionTypes/questionCounts if the user asks for them.

JSON schema exactly:
{
  "intent": "generate_paper | generate_practice | explain_answer | generate_answer_key | generate_study_plan | weak_topic_analysis | unknown",
  "classLevel": "",
  "subject": "",
  "chapters": [],
  "chapterNumbers": [],
  "chapterNames": [],
  "chapterDetails": [],
  "fullBook": false,
  "firstHalf": false,
  "secondHalf": false,
  "chapterRange": false,
  "mcqCount": 0,
  "shortCount": 0,
  "longCount": 0,
  "questionTypes": [],
  "questionCounts": {},
  "marks": {
    "mcq": 1,
    "short": 2,
    "long": 5
  },
  "difficulty": "easy | medium | hard | mixed | board_style | conceptual | numerical",
  "language": "english | urdu | roman_urdu",
  "generationMode": "question_bank | ai | hybrid",
  "missingFields": [],
  "confirmationRequired": false
}

User message:
${message}`;
};

const parseUserCommand = async (message, userRole = 'student', metadata = null) => {
  const safeMessage = normalizeUserPrompt(message);
  if (!safeMessage) return { ...defaultCommand(), missingFields: ['message'], confirmationRequired: true };

  try {
    const text = await callGemini({
      prompt: buildParserPrompt(safeMessage, userRole, metadata),
      temperature: 0,
      maxOutputTokens: 700
    });
    const parsedIntent = mergeWithDeterministicFallback(sanitizeCommand(extractJson(text)), safeMessage, userRole, metadata);
    console.log('parsedIntent', parsedIntent);
    return parsedIntent;
  } catch (error) {
    const parsedIntent = fallbackParse(safeMessage, userRole, metadata);
    console.log('parsedIntent', parsedIntent);
    return parsedIntent;
  }
};

const generateExplanation = async (message, parsedCommand = {}) => {
  const language = parsedCommand.language || detectLanguage(message);
  try {
    const text = await callGemini({
      prompt: `Return only JSON: {"explanation":"..."}.
Explain the answer for this study question in ${language}. Keep it clear, short, and exam-focused.

${message}`,
      temperature: 0.35,
      maxOutputTokens: 900
    });
    const parsed = extractJson(text);
    return parsed.explanation || parsed.answer || JSON.stringify(parsed);
  } catch (error) {
    if (error.code === 'GEMINI_KEY_MISSING') {
      return 'Gemini API key backend .env me configure nahi hai. GEMINI_API_KEY add karne ke baad AI explanation active ho jayegi.';
    }
    return 'AI explanation abhi generate nahi ho saki. Question ko thora clear likh kar dobara try karein.';
  }
};

module.exports = {
  parseUserCommand,
  normalizeUserPrompt,
  isFullBookRequest,
  isFirstHalfRequest,
  isSecondHalfRequest,
  isChapterRangeRequest,
  generateExplanation,
  sanitizeCommand,
  fallbackParse
};
