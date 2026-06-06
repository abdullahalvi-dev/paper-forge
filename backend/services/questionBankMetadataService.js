/*
 * Roman Urdu comments:
 * Ye service runtime par question-bank aur DB se available classes, subjects aur chapters read karti hai.
 * Is se chatbot kisi fixed syllabus file par depend nahi karta aur naye chapter JSON files automatic discover ho jati hain.
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Question = require('../models/Question');
const Catalog = require('../models/Catalog');
const { questionBankDir, slugify } = require('./questionBankFileService');

const CACHE_MS = 30 * 1000;
let cache = null;

const normalizeKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFKC')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const chapterMatchKey = (value) =>
  normalizeKey(value)
    .split(' ')
    .filter((token) => token && !['and', 'of', 'the', 'a', 'an'].includes(token))
    .join(' ');

const titleFromSlug = (value) =>
  String(value || '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const ordinalWords = {
  1: 'first',
  2: 'second',
  3: 'third',
  4: 'fourth',
  5: 'fifth',
  6: 'sixth',
  7: 'seventh',
  8: 'eighth',
  9: 'ninth',
  10: 'tenth',
  11: 'eleventh',
  12: 'twelfth',
  13: 'thirteenth',
  14: 'fourteenth',
  15: 'fifteenth',
  16: 'sixteenth',
  17: 'seventeenth',
  18: 'eighteenth',
  19: 'nineteenth',
  20: 'twentieth'
};

const ordinalSuffix = (number) => {
  const value = Number(number);
  const lastTwo = value % 100;
  if ([11, 12, 13].includes(lastTwo)) return 'th';
  const last = value % 10;
  if (last === 1) return 'st';
  if (last === 2) return 'nd';
  if (last === 3) return 'rd';
  return 'th';
};

const numbersFromText = (value = '') => {
  const key = normalizeKey(value);
  const numbers = new Set();
  for (const match of key.matchAll(/\b(\d{1,3})(?:st|nd|rd|th)?\b/g)) {
    numbers.add(Number(match[1]));
  }
  Object.entries(ordinalWords).forEach(([number, word]) => {
    if (new RegExp(`\\b${word}\\b`).test(key)) numbers.add(Number(number));
  });
  return [...numbers].filter((number) => Number.isFinite(number) && number > 0);
};

const classFromFolder = (folder) => {
  if (/^\d+(?:st|nd|rd|th)?-?year$/i.test(folder)) {
    return titleFromSlug(folder).replace(/\bYear\b/i, 'Year');
  }
  if (/^\d+(?:st|nd|rd|th)$/i.test(folder)) return folder;
  return titleFromSlug(folder);
};

const unique = (items) => [...new Set(items.filter(Boolean))];

const positiveInteger = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
};

const explicitChapterNumber = (source = {}) =>
  positiveInteger(source.chapterNumber || source.chapterNo || source.unitNumber || source.unitNo || source.number);

const addClassAliases = (classItem, folderName = '') => {
  const aliases = new Set(classItem.aliases || []);
  const nameKey = normalizeKey(classItem.name);
  [classItem.name, folderName, slugify(classItem.name)].filter(Boolean).forEach((item) => aliases.add(normalizeKey(item)));

  numbersFromText(`${classItem.name} ${folderName}`).forEach((number) => {
    const ordinal = `${number}${ordinalSuffix(number)}`;
    const ordinalWord = ordinalWords[number];
    [
      number,
      `${number} class`,
      `class ${number}`,
      `${ordinal} class`,
      `class ${ordinal}`,
      ordinal,
      `${number} grade`,
      `grade ${number}`,
      `${ordinal} grade`,
      `grade ${ordinal}`,
      `part ${number}`
    ].forEach((item) => aliases.add(normalizeKey(item)));

    if (nameKey.includes('year') || normalizeKey(folderName).includes('year')) {
      [`${number} year`, `${ordinal} year`, `year ${number}`].forEach((item) => aliases.add(normalizeKey(item)));
      if (ordinalWord) aliases.add(normalizeKey(`${ordinalWord} year`));
      const interClassNumber = number === 1 ? 11 : number === 2 ? 12 : 0;
      if (interClassNumber) {
        const interOrdinal = `${interClassNumber}${ordinalSuffix(interClassNumber)}`;
        [
          interClassNumber,
          interOrdinal,
          `${interClassNumber} year`,
          `year ${interClassNumber}`,
          `${interOrdinal} year`,
          `year ${interOrdinal}`,
          `${interClassNumber} class`,
          `class ${interClassNumber}`,
          `${interOrdinal} class`,
          `class ${interOrdinal}`,
          `inter part ${number}`,
          `part ${number} inter`
        ].forEach((item) => aliases.add(normalizeKey(item)));
      }
    }
  });

  classItem.aliases = [...aliases];
};

const addSubjectAliases = (subjectItem, folderName = '') => {
  const aliases = new Set(subjectItem.aliases || []);
  [subjectItem.name, folderName, slugify(subjectItem.name)].filter(Boolean).forEach((item) => aliases.add(normalizeKey(item)));

  [...aliases].forEach((alias) => {
    if (alias.endsWith('s')) aliases.add(alias.slice(0, -1));
    if (alias && !alias.endsWith('s')) aliases.add(`${alias}s`);
  });

  subjectItem.aliases = [...aliases];
};

const addChapterAliases = (chapterItem, fileBase = '') => {
  const aliases = new Set(chapterItem.aliases || []);
  [chapterItem.name, fileBase, slugify(chapterItem.name)].filter(Boolean).forEach((item) => aliases.add(normalizeKey(item)));
  [...numbersFromText(chapterItem.name), positiveInteger(chapterItem.chapterNumber)].forEach((number) => {
    if (!number) return;
    aliases.add(normalizeKey(`${number}`));
    aliases.add(normalizeKey(`chapter ${number}`));
    aliases.add(normalizeKey(`unit ${number}`));
    aliases.add(normalizeKey(`ch ${number}`));
  });
  chapterItem.aliases = [...aliases];
};

const sourceRank = (source = '') => {
  if (source === 'file') return 3;
  if (source === 'catalog') return 2;
  if (source === 'database') return 1;
  return 0;
};

const addQuestionType = (metadata, type) => {
  const key = normalizeKey(type);
  if (!key) return;
  if (!metadata.questionTypeMap.has(key)) {
    metadata.questionTypeMap.set(key, { name: type, key, aliases: new Set([key, normalizeKey(slugify(type))]) });
  }
  const item = metadata.questionTypeMap.get(key);
  item.aliases.add(key);
  if (key.endsWith('s')) item.aliases.add(key.slice(0, -1));
  if (!key.endsWith('s')) item.aliases.add(`${key}s`);
};

const ensureClass = (metadata, className, folderName = '') => {
  const key = normalizeKey(className || folderName);
  if (!key) return null;
  if (!metadata.classMap.has(key)) {
    metadata.classMap.set(key, {
      name: className || classFromFolder(folderName),
      key,
      aliases: [],
      subjectMap: new Map()
    });
  }
  const classItem = metadata.classMap.get(key);
  addClassAliases(classItem, folderName);
  return classItem;
};

const ensureSubject = (classItem, subjectName, folderName = '') => {
  const key = normalizeKey(subjectName || folderName);
  if (!classItem || !key) return null;
  if (!classItem.subjectMap.has(key)) {
    classItem.subjectMap.set(key, {
      name: subjectName || titleFromSlug(folderName),
      key,
      aliases: [],
      chapterMap: new Map()
    });
  }
  const subjectItem = classItem.subjectMap.get(key);
  addSubjectAliases(subjectItem, folderName);
  return subjectItem;
};

const ensureChapter = (subjectItem, chapterName, fileBase = '', order = 0, chapterNumber = 0, source = 'database') => {
  const key = normalizeKey(chapterName || fileBase);
  if (!subjectItem || !key) return null;
  const incomingRank = sourceRank(source);
  if (!subjectItem.chapterMap.has(key)) {
    subjectItem.chapterMap.set(key, {
      name: chapterName || titleFromSlug(fileBase),
      key,
      aliases: [],
      order,
      chapterNumber: positiveInteger(chapterNumber),
      sourceRank: incomingRank,
      hasFileMetadata: source === 'file'
    });
  }
  const chapterItem = subjectItem.chapterMap.get(key);
  const existingRank = positiveInteger(chapterItem.sourceRank);
  const incomingOrder = positiveInteger(order) || 9999;
  const existingOrder = positiveInteger(chapterItem.order) || 9999;

  if (incomingRank >= existingRank) {
    chapterItem.order = Math.min(existingOrder, incomingOrder);
    chapterItem.sourceRank = Math.max(existingRank, incomingRank);
  } else {
    chapterItem.order = existingOrder;
  }

  if (source === 'file') chapterItem.hasFileMetadata = true;

  const incomingChapterNumber = positiveInteger(chapterNumber);
  if (!chapterItem.hasFileMetadata || source === 'file') {
    chapterItem.chapterNumber = positiveInteger(chapterItem.chapterNumber) || incomingChapterNumber;
  }

  addChapterAliases(chapterItem, fileBase);
  return chapterItem;
};

const collectQuestionBankFiles = (directory) => {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  const stack = [directory];

  while (stack.length) {
    const current = stack.pop();
    fs.readdirSync(current, { withFileTypes: true }).forEach((entry) => {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        return;
      }
      if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'index.json') {
        files.push(fullPath);
      }
    });
  }

  return files.sort((left, right) => {
    const leftDir = path.dirname(path.relative(directory, left));
    const rightDir = path.dirname(path.relative(directory, right));
    const dirCompare = leftDir.localeCompare(rightDir, undefined, { numeric: true });
    if (dirCompare) return dirCompare;

    const leftStat = fs.statSync(left);
    const rightStat = fs.statSync(right);
    return leftStat.birthtimeMs - rightStat.birthtimeMs || left.localeCompare(right, undefined, { numeric: true });
  });
};

const readChapterFileHead = (file) => {
  try {
    const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(rows) && rows.length ? rows[0] : {};
  } catch (error) {
    return {};
  }
};

const addQuestionBankFileMetadata = (metadata) => {
  const files = collectQuestionBankFiles(questionBankDir);

  files.forEach((file, index) => {
    const relative = path.relative(questionBankDir, file);
    const parts = relative.split(path.sep);
    if (parts.length < 3) return;

    const [classFolder, subjectFolder, fileName] = parts;
    const fileBase = path.basename(fileName, '.json');
    const firstQuestion = readChapterFileHead(file);
    const className = firstQuestion.classLevel || firstQuestion.classId || classFromFolder(classFolder);
    const subjectName = firstQuestion.subject || firstQuestion.subjectId || titleFromSlug(subjectFolder);
    const chapterName = firstQuestion.chapter || firstQuestion.chapterId || titleFromSlug(fileBase);
    const classItem = ensureClass(metadata, className, classFolder);
    const subjectItem = ensureSubject(classItem, subjectName, subjectFolder);
    ensureChapter(subjectItem, chapterName, fileBase, index + 1, explicitChapterNumber(firstQuestion), 'file');

    try {
      const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (Array.isArray(rows)) rows.forEach((question) => addQuestionType(metadata, question.type));
    } catch (error) {
      // Invalid files are ignored here; import/build scripts do stricter validation.
    }
  });
};

const addQuestionRowsMetadata = (metadata, rows = []) => {
  rows.forEach((row, index) => {
    const classItem = ensureClass(metadata, row.classLevel || row.classId);
    const subjectItem = ensureSubject(classItem, row.subject || row.subjectId);
    ensureChapter(subjectItem, row.chapterName || row.chapter || row.chapterId, '', index + 1, explicitChapterNumber(row), 'database');
    addQuestionType(metadata, row.type);
  });
};

const addCatalogMetadata = async (metadata) => {
  if (mongoose.connection.readyState !== 1) return;
  const items = await Catalog.find({}).sort({ kind: 1, createdAt: 1, name: 1 }).lean();

  items
    .filter((item) => item.kind === 'class')
    .forEach((item) => ensureClass(metadata, item.name));

  items
    .filter((item) => item.kind === 'subject')
    .forEach((item) => {
      const targetClasses = item.classLevel ? [item.classLevel] : [...metadata.classMap.values()].map((classItem) => classItem.name);
      targetClasses.forEach((classLevel) => {
        const classItem = ensureClass(metadata, classLevel);
        ensureSubject(classItem, item.name);
      });
    });

  items
    .filter((item) => item.kind === 'chapter')
    .forEach((item, index) => {
      const classItem = ensureClass(metadata, item.classLevel);
      const subjectItem = ensureSubject(classItem, item.subject);
      ensureChapter(subjectItem, item.name, '', index + 1, explicitChapterNumber(item), 'catalog');
    });
};

const addDatabaseQuestionMetadata = async (metadata) => {
  if (mongoose.connection.readyState !== 1) return;
  const rows = await Question.aggregate([
    {
      $group: {
        _id: {
          classLevel: '$classLevel',
          classId: '$classId',
          subject: '$subject',
          subjectId: '$subjectId',
          chapter: '$chapter',
          chapterNumber: '$chapterNumber',
          chapterName: '$chapterName',
          chapterId: '$chapterId',
          type: '$type'
        }
      }
    }
  ]);

  addQuestionRowsMetadata(
    metadata,
    rows.map((row) => row._id || {})
  );
};

const serializeMetadata = (metadata) => {
  const questionTypes = [...metadata.questionTypeMap.values()]
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }))
    .map((item) => ({
      name: item.name,
      key: item.key,
      aliases: unique([...item.aliases])
    }));

  const classes = [...metadata.classMap.values()]
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }))
    .map((classItem) => ({
      name: classItem.name,
      key: classItem.key,
      aliases: unique(classItem.aliases),
      subjects: [...classItem.subjectMap.values()]
        .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }))
        .map((subjectItem) => ({
          name: subjectItem.name,
          key: subjectItem.key,
          aliases: unique(subjectItem.aliases),
          chapters: [...subjectItem.chapterMap.values()]
            .sort((left, right) => (left.order || 9999) - (right.order || 9999) || left.name.localeCompare(right.name))
            .map((chapterItem, index) => ({
              name: chapterItem.name,
              chapterName: chapterItem.name,
              chapterNumber: positiveInteger(chapterItem.chapterNumber) || index + 1,
              key: chapterItem.key,
              aliases: unique([
                ...chapterItem.aliases,
                `${positiveInteger(chapterItem.chapterNumber) || index + 1}`,
                `chapter ${positiveInteger(chapterItem.chapterNumber) || index + 1}`,
                `chapter no ${positiveInteger(chapterItem.chapterNumber) || index + 1}`,
                `chapter number ${positiveInteger(chapterItem.chapterNumber) || index + 1}`,
                `unit ${positiveInteger(chapterItem.chapterNumber) || index + 1}`,
                `ch ${positiveInteger(chapterItem.chapterNumber) || index + 1}`
              ]),
              number: positiveInteger(chapterItem.chapterNumber) || index + 1
            }))
        }))
    }));

  return { classes, questionTypes, generatedAt: new Date().toISOString() };
};

const getQuestionBankMetadata = async ({ forceRefresh = false } = {}) => {
  if (!forceRefresh && cache && Date.now() - cache.loadedAt < CACHE_MS) return cache.data;

  const metadata = { classMap: new Map(), questionTypeMap: new Map() };
  addQuestionBankFileMetadata(metadata);
  await addDatabaseQuestionMetadata(metadata);
  await addCatalogMetadata(metadata);

  const data = serializeMetadata(metadata);
  cache = { loadedAt: Date.now(), data };
  return data;
};

const matchesAlias = (aliases, value) => {
  const key = normalizeKey(value);
  if (!key) return false;
  return aliases.some((alias) => {
    const aliasKey = normalizeKey(alias);
    if (aliasKey === key) return true;
    if (!aliasKey || /^\d+$/.test(aliasKey) || aliasKey.length < 3) return false;
    if (/\d/.test(aliasKey) || /\d/.test(key)) return false;
    return key.includes(aliasKey) || aliasKey.includes(key);
  });
};

const editDistance = (left = '', right = '') => {
  const a = normalizeKey(left).replace(/\s+/g, '');
  const b = normalizeKey(right).replace(/\s+/g, '');
  if (!a || !b) return Math.max(a.length, b.length);
  if (a === b) return 0;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost
      );
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }

  return previous[b.length];
};

const closeAliasMatch = (aliases, value) => {
  const key = normalizeKey(value);
  const compactKey = key.replace(/\s+/g, '');
  if (compactKey.length < 4) return null;

  let best = null;
  (aliases || []).forEach((alias) => {
    const aliasKey = normalizeKey(alias);
    const compactAlias = aliasKey.replace(/\s+/g, '');
    if (compactAlias.length < 4) return;

    const distance = editDistance(compactKey, compactAlias);
    const longest = Math.max(compactKey.length, compactAlias.length);
    const allowedDistance = longest <= 6 ? 1 : 2;
    const similarity = 1 - distance / longest;

    if (distance <= allowedDistance || similarity >= 0.82) {
      const score = distance + Math.abs(compactKey.length - compactAlias.length) / 10;
      if (!best || score < best.score) best = { alias, score };
    }
  });

  return best;
};

const resolveClassLevel = (value, metadata) => {
  const key = normalizeKey(value);
  if (!key) return '';
  const classes = metadata?.classes || [];

  const exact = classes.find((classItem) => matchesAlias(classItem.aliases || [classItem.name], key));
  if (exact) return exact.name;

  const numbers = numbersFromText(key);
  for (const number of numbers) {
    const numberKey = String(number);
    const ordinalKey = `${number}${ordinalSuffix(number)}`;
    const byNumber = classes.find((classItem) => {
      const aliases = classItem.aliases?.length ? classItem.aliases : [classItem.name];
      return aliases.some((alias) => {
        const aliasKey = normalizeKey(alias);
        return aliasKey === numberKey || aliasKey === ordinalKey || normalizeKey(classItem.name).includes(numberKey);
      });
    });
    if (byNumber) return byNumber.name;
  }

  return '';
};

const classEntry = (classLevel, metadata) => {
  const resolved = resolveClassLevel(classLevel, metadata) || classLevel;
  return (metadata?.classes || []).find((classItem) => normalizeKey(classItem.name) === normalizeKey(resolved));
};

const allSubjects = (metadata, classLevel = '') => {
  const selectedClass = classEntry(classLevel, metadata);
  if (selectedClass) return selectedClass.subjects || [];

  const seen = new Map();
  (metadata?.classes || []).forEach((classItem) => {
    (classItem.subjects || []).forEach((subjectItem) => {
      if (!seen.has(normalizeKey(subjectItem.name))) seen.set(normalizeKey(subjectItem.name), subjectItem);
    });
  });
  return [...seen.values()];
};

const resolveSubject = (value, classLevel, metadata) => {
  const key = normalizeKey(value);
  if (!key) return '';
  const subjects = allSubjects(metadata, classLevel);

  const exact = subjects.find((subjectItem) => matchesAlias(subjectItem.aliases || [subjectItem.name], key));
  if (exact) return exact.name;

  const fuzzyMatches = subjects
    .map((subjectItem) => ({
      subject: subjectItem,
      match: closeAliasMatch(subjectItem.aliases || [subjectItem.name], key)
    }))
    .filter((item) => item.match)
    .sort((left, right) => left.match.score - right.match.score);

  if (fuzzyMatches.length === 1 || fuzzyMatches[0]?.match.score < fuzzyMatches[1]?.match.score) {
    return fuzzyMatches[0].subject.name;
  }

  return '';
};

const allQuestionTypes = (metadata) => metadata?.questionTypes || [];

const resolveQuestionType = (value, metadata) => {
  const key = normalizeKey(value);
  if (!key) return '';
  const exact = allQuestionTypes(metadata).find((typeItem) => matchesAlias(typeItem.aliases || [typeItem.name], key));
  return exact?.name || '';
};

const subjectEntry = (classLevel, subject, metadata) => {
  const selectedClass = classEntry(classLevel, metadata);
  const resolvedSubject = resolveSubject(subject, classLevel, metadata) || subject;
  return (selectedClass?.subjects || []).find(
    (subjectItem) => normalizeKey(subjectItem.name) === normalizeKey(resolvedSubject)
  );
};

const chapterNumber = (value) => {
  const match = String(value || '').match(/\b(?:chapter\s*)?(\d{1,2})(?:st|nd|rd|th)?\b/i);
  return match ? Number(match[1]) : 0;
};

const isChapterNumberRequest = (value) =>
  /^\s*(?:(?:chapter|unit|ch)\s*(?:number|no)?\s*)?\d{1,2}(?:st|nd|rd|th)?(?:\s*(?:chapter|unit|ch))?\s*$/i.test(
    String(value || '')
  );

const chapterDetail = (chapter) => ({
  chapterNumber: positiveInteger(chapter.chapterNumber || chapter.number),
  chapterName: chapter.chapterName || chapter.name,
  name: chapter.chapterName || chapter.name,
  number: positiveInteger(chapter.chapterNumber || chapter.number)
});

const resolveChapters = ({ classLevel, subject, chapters = [] }, metadata) => {
  const selectedSubject = subjectEntry(classLevel, subject, metadata);
  const available = selectedSubject?.chapters || [];
  const selected = Array.isArray(chapters) ? chapters.filter(Boolean) : [chapters].filter(Boolean);
  const resolvedDetails = [];
  const unresolved = [];
  const unresolvedNumbers = [];

  selected.forEach((chapter) => {
    const number = chapterNumber(chapter);
    if (number && isChapterNumberRequest(chapter)) {
      const numericMatch = available.find((item) => positiveInteger(item.chapterNumber || item.number) === number);
      if (numericMatch) {
        resolvedDetails.push(chapterDetail(numericMatch));
        return;
      }
      unresolvedNumbers.push(number);
      unresolved.push(String(chapter));
      return;
    }

    const key = normalizeKey(chapter);
    const matchKey = chapterMatchKey(chapter);
    const exact = available.find((item) =>
      (item.aliases || [item.name]).some((alias) => normalizeKey(alias) === key)
    );
    if (exact) {
      resolvedDetails.push(chapterDetail(exact));
      return;
    }

    const partialMatches = available.filter((item) => {
      const aliases = item.aliases?.length ? item.aliases : [item.name];
      return aliases.some((alias) => {
        const aliasKey = normalizeKey(alias);
        const aliasMatchKey = chapterMatchKey(alias);
        if (!matchKey || !aliasMatchKey) return false;
        return (
          aliasKey.includes(key) ||
          key.includes(aliasKey) ||
          aliasMatchKey.includes(matchKey) ||
          matchKey.includes(aliasMatchKey)
        );
      });
    });
    if (partialMatches.length === 1) {
      resolvedDetails.push(chapterDetail(partialMatches[0]));
      return;
    }

    unresolved.push(String(chapter));
  });

  const uniqueDetails = [];
  const detailKeys = new Set();
  resolvedDetails.forEach((detail) => {
    const key = `${detail.chapterNumber}:${normalizeKey(detail.chapterName)}`;
    if (detailKeys.has(key)) return;
    detailKeys.add(key);
    uniqueDetails.push(detail);
  });

  return {
    available: available.map((item) => item.name),
    availableNumbers: available.map((item) => positiveInteger(item.chapterNumber || item.number)).filter(Boolean),
    availableDetails: available.map(chapterDetail),
    chapters: uniqueDetails.map((item) => item.chapterName),
    chapterNames: uniqueDetails.map((item) => item.chapterName),
    chapterNumbers: uniqueDetails.map((item) => item.chapterNumber).filter(Boolean),
    chapterDetails: uniqueDetails,
    unresolved,
    unresolvedNumbers
  };
};

const metadataSummary = (metadata) => {
  const typeLine = `Question types: ${(metadata?.questionTypes || []).map((type) => type.name).join(', ') || 'none'}`;
  const academicLines = (metadata?.classes || [])
    .map((classItem) => {
      const subjects = (classItem.subjects || [])
        .map((subjectItem) => {
          const chapters = (subjectItem.chapters || [])
            .map((chapter) => `${chapter.chapterNumber || chapter.number}. ${chapter.chapterName || chapter.name}`)
            .join('; ');
          return `${subjectItem.name}: ${chapters}`;
        })
        .join(' | ');
      return `${classItem.name}: ${subjects}`;
    })
    .join('\n');
  return `${typeLine}\n${academicLines}`.trim();
};

module.exports = {
  getQuestionBankMetadata,
  metadataSummary,
  normalizeKey,
  chapterMatchKey,
  resolveClassLevel,
  resolveSubject,
  resolveChapters,
  resolveQuestionType,
  allQuestionTypes,
  allSubjects,
  classEntry,
  subjectEntry
};
