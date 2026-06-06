/*
 * Roman Urdu comments:
 * Ye smoke tests chatbot NLP parser aur multi-turn merge ko verify karte hain.
 * Tests DB ke baghair local question-bank metadata se run ho sakte hain.
 */
const assert = require('assert');
const { fallbackParse } = require('../services/nlpService');
const { mergeParsedWithPending } = require('../services/chatbotContextService');
const { getQuestionBankMetadata, resolveChapters, resolveClassLevel, resolveSubject } = require('../services/questionBankMetadataService');
const { __private: chatbotControllerTestHooks } = require('../controllers/chatbotController');

const hasValue = (value) => Boolean(String(value || '').trim());

const run = async () => {
  const metadata = await getQuestionBankMetadata({ forceRefresh: true });
  assert.strictEqual(resolveClassLevel('10th', metadata), '10th');
  assert.strictEqual(resolveClassLevel('10 class', metadata), '10th');
  assert.strictEqual(resolveClassLevel('class 12', metadata), '2nd Year');
  assert.strictEqual(resolveClassLevel('12', metadata), '2nd Year');
  assert.strictEqual(resolveClassLevel('class 11', metadata), '1st Year');
  assert.strictEqual(resolveClassLevel('11st year', metadata), '1st Year');
  assert.strictEqual(resolveClassLevel('11 year', metadata), '1st Year');
  assert.strictEqual(resolveSubject('pysics', '9th', metadata), 'Physics');
  const typoSubject = fallbackParse('generate 9th pysics paper', 'teacher', metadata);
  assert.strictEqual(typoSubject.classLevel, '9th');
  assert.strictEqual(resolveSubject(typoSubject.subject, typoSubject.classLevel, metadata), 'Physics');
  const malformedInterPrompt = fallbackParse('make the practice paper of 11st year math chapter 3 with 34 mcq', 'student', metadata);
  assert.strictEqual(malformedInterPrompt.intent, 'generate_practice');
  assert.strictEqual(malformedInterPrompt.classLevel, '1st Year');
  assert.strictEqual(malformedInterPrompt.subject, 'Math');
  assert.deepStrictEqual(malformedInterPrompt.chapters, ['3']);
  assert.strictEqual(malformedInterPrompt.mcqCount, 34);
  const pendingMissingClass = {
    intent: 'generate_practice',
    subject: 'Math',
    chapters: ['3'],
    mcqCount: 34,
    questionCounts: { mcq: 34 },
    questionTypes: ['mcq'],
    missingFields: ['classLevel']
  };
  const classOnlyFollowUp = chatbotControllerTestHooks.enrichParsedWithPendingScope({
    parsedMessage: fallbackParse('11', 'student', metadata),
    pendingContext: pendingMissingClass,
    message: '11',
    role: 'student',
    metadata
  });
  const numericClassFollowUpMerged = mergeParsedWithPending({
    parsed: classOnlyFollowUp,
    pendingContext: pendingMissingClass,
    message: '11',
    role: 'student'
  });
  assert.strictEqual(numericClassFollowUpMerged.classLevel, '1st Year');
  assert.strictEqual(numericClassFollowUpMerged.subject, 'Math');
  assert.deepStrictEqual(numericClassFollowUpMerged.chapters, ['3']);
  assert.strictEqual(numericClassFollowUpMerged.mcqCount, 34);
  assert(!numericClassFollowUpMerged.missingFields.includes('classLevel'));

  const chapterAt = (classLevel, subject, chapterNumber) => {
    const selectedClass = metadata.classes.find((classItem) => classItem.name === classLevel);
    const selectedSubject = selectedClass?.subjects.find((subjectItem) => subjectItem.name === subject);
    const chapter = selectedSubject?.chapters.find((item) => item.chapterNumber === chapterNumber || item.number === chapterNumber);
    assert(chapter, `${classLevel} ${subject} chapter ${chapterNumber}`);
    return {
      chapterNumber: chapter.chapterNumber || chapter.number,
      chapterName: chapter.chapterName || chapter.name
    };
  };

  const expectExactChapterNumber = ({ message, role = 'teacher', classLevel, subject, chapterNumber }) => {
    const parsed = fallbackParse(`${message} 1 mcq 1 short 1 long`, role, metadata);
    const validation = chatbotControllerTestHooks.validateGenerationIntent(parsed, metadata);
    const expected = chapterAt(classLevel, subject, chapterNumber);
    assert.strictEqual(validation.ok, true, validation.message || message);
    assert.deepStrictEqual(validation.chapterNumbers, [expected.chapterNumber], message);
    assert.deepStrictEqual(validation.chapterNames, [expected.chapterName], message);
    assert.strictEqual(validation.chapterDetails[0]?.chapterNumber, expected.chapterNumber, message);
    assert.strictEqual(validation.chapterDetails[0]?.chapterName, expected.chapterName, message);
    assert.deepStrictEqual(validation.chapters, [expected.chapterName], message);
    const payload = chatbotControllerTestHooks.buildFinalPaperPayload(parsed, validation);
    assert.strictEqual(payload.chapterNumber, expected.chapterNumber, message);
    assert.strictEqual(payload.chapterName, expected.chapterName, message);
    assert.strictEqual(payload.chapterDetails[0]?.chapterNumber, expected.chapterNumber, message);
    assert.strictEqual(payload.chapterDetails[0]?.chapterName, expected.chapterName, message);
  };

  expectExactChapterNumber({
    message: '9th Physics chapter 1',
    classLevel: '9th',
    subject: 'Physics',
    chapterNumber: 1
  });
  expectExactChapterNumber({
    message: '9th Physics chapter 2',
    classLevel: '9th',
    subject: 'Physics',
    chapterNumber: 2
  });
  expectExactChapterNumber({
    message: '10th Chemistry chapter 3',
    classLevel: '10th',
    subject: 'Chemistry',
    chapterNumber: 3
  });
  expectExactChapterNumber({
    message: '1st Year Math chapter 5',
    classLevel: '1st Year',
    subject: 'Math',
    chapterNumber: 5
  });

  const invalidChapter = fallbackParse('9th Physics chapter 99 paper 1 mcq 1 short 1 long', 'teacher', metadata);
  const invalidValidation = chatbotControllerTestHooks.validateGenerationIntent(invalidChapter, metadata);
  const physicsNumbers = metadata.classes
    .find((classItem) => classItem.name === '9th')
    ?.subjects.find((subjectItem) => subjectItem.name === 'Physics')?.chapters.map((chapter) => chapter.chapterNumber || chapter.number);
  assert.strictEqual(invalidValidation.ok, false);
  assert.strictEqual(invalidValidation.message, `Chapter 99 is not available. Available chapters are: ${physicsNumbers.join(', ')}.`);

  metadata.classes.forEach((classItem) => {
    classItem.subjects.forEach((subjectItem) => {
      if (!subjectItem.chapters.length) return;
      const parsed = fallbackParse(
        `${classItem.name} ${subjectItem.name} chapter 1 paper 2 mcq 1 short 1 long`,
        'teacher',
        metadata
      );
      assert.strictEqual(parsed.intent, 'generate_paper', `${classItem.name} ${subjectItem.name}`);
      assert.strictEqual(parsed.classLevel, classItem.name, `${classItem.name} ${subjectItem.name}`);
      assert.strictEqual(parsed.subject, subjectItem.name, `${classItem.name} ${subjectItem.name}`);
      assert(parsed.chapters.includes('1'), `${classItem.name} ${subjectItem.name}`);
      assert.strictEqual(parsed.mcqCount, 2, `${classItem.name} ${subjectItem.name}`);
      assert.strictEqual(parsed.shortCount, 1, `${classItem.name} ${subjectItem.name}`);
      assert.strictEqual(parsed.longCount, 1, `${classItem.name} ${subjectItem.name}`);
    });
  });

  metadata.questionTypes.forEach((typeItem) => {
    const parsed = fallbackParse(`computer science ${typeItem.name} 3`, 'student', metadata);
    assert(parsed.questionTypes.includes(typeItem.name), typeItem.name);
    assert.strictEqual(parsed.questionCounts[typeItem.name], 3, typeItem.name);
  });

  const cases = [
    {
      role: 'teacher',
      message: 'mujh ko 9 class ka chemistry chapter 1 ka paper bna do',
      expect: { intent: 'generate_paper', classLevel: '9th', subject: 'Chemistry', chapter: '1' }
    },
    {
      role: 'teacher',
      message: '10 class math 5 chapter 10 mcq 5 short 2 long',
      expect: { intent: 'generate_paper', classLevel: '10th', subject: 'Math', chapter: '5', mcqCount: 10, shortCount: 5, longCount: 2 }
    },
    {
      role: 'teacher',
      message: '1st year physics chapter 2 ka paper bna do',
      expect: { intent: 'generate_paper', classLevel: '1st Year', subject: 'Physics', chapter: '2' }
    },
    {
      role: 'student',
      message: '2nd year biology chapter 4 se 20 mcqs practice test bna do',
      expect: { intent: 'generate_practice', classLevel: '2nd Year', subject: 'Biology', chapter: '4', mcqCount: 20 }
    },
    {
      role: 'teacher',
      message: 'computer science 10th class chapter database se paper bnao',
      expect: { intent: 'generate_paper', classLevel: '10th', subject: 'Computer Science', chapter: 'Database' }
    }
  ];

  cases.forEach((item) => {
    const parsed = fallbackParse(item.message, item.role, metadata);
    assert.strictEqual(parsed.intent, item.expect.intent, item.message);
    assert.strictEqual(parsed.classLevel, item.expect.classLevel, item.message);
    assert.strictEqual(parsed.subject, item.expect.subject, item.message);
    assert(parsed.chapters.includes(item.expect.chapter), item.message);
    if (item.expect.mcqCount !== undefined) assert.strictEqual(parsed.mcqCount, item.expect.mcqCount, item.message);
    if (item.expect.shortCount !== undefined) assert.strictEqual(parsed.shortCount, item.expect.shortCount, item.message);
    if (item.expect.longCount !== undefined) assert.strictEqual(parsed.longCount, item.expect.longCount, item.message);
  });

  const first = fallbackParse('mujh ko 9 class ka paper bna kr do chemistry ky 1 chapter ka', 'teacher', metadata);
  const second = fallbackParse('5 mcq, 3 short, 1 long', 'teacher', metadata);
  const merged = mergeParsedWithPending({
    parsed: second,
    pendingContext: first,
    message: '5 mcq, 3 short, 1 long',
    role: 'teacher'
  });

  assert.strictEqual(merged.intent, 'generate_paper');
  assert.strictEqual(merged.classLevel, '9th');
  assert.strictEqual(merged.subject, 'Chemistry');
  assert(merged.chapters.includes('1'));
  assert.strictEqual(merged.mcqCount, 5);
  assert.strictEqual(merged.shortCount, 3);
  assert.strictEqual(merged.longCount, 1);
  assert(hasValue(merged.subject));

  const cancelCommands = ['no', 'cancel', 'No, cancel.', 'no cancel', 'cancel karo', 'cancel kro', 'cancel kr do', 'cancel krdo', 'reset', 'clear', 'start over', 'new paper'];
  cancelCommands.forEach((command) => {
    assert.strictEqual(chatbotControllerTestHooks.isCancelOrResetCommand(command), true, command);
  });
  assert.strictEqual(chatbotControllerTestHooks.isCancelOrResetCommand('5 mcq 3 short'), false);

  const editCommands = ['edit', 'Edit details', 'change', 'change details', 'update', 'modify'];
  editCommands.forEach((command) => {
    assert.strictEqual(chatbotControllerTestHooks.isEditCommand(command), true, command);
  });
  assert.strictEqual(chatbotControllerTestHooks.isEditCommand('chapter 2'), false);
  const pendingConfirmation = {
    intent: 'generate_paper',
    classLevel: '9th',
    subject: 'Chemistry',
    chapters: ['1'],
    mcqCount: 5,
    shortCount: 3,
    longCount: 1,
    marks: { mcq: 1, short: 2, long: 5 },
    confirmationRequired: true,
    awaitingConfirmation: true
  };
  const cancelResponse = chatbotControllerTestHooks.buildCancelResponse(pendingConfirmation);
  assert.strictEqual(cancelResponse.message, 'Request cancel ho gayi. New details likhein.');
  assert.strictEqual(cancelResponse.state, 'cancelled');
  assert.strictEqual(cancelResponse.confirmationRequired, false);
  assert.strictEqual(cancelResponse.parsed.awaitingConfirmation, false);
  const editResponse = chatbotControllerTestHooks.buildEditDetailsResponse(pendingConfirmation);
  assert.strictEqual(editResponse.state, 'collecting_details');
  assert.strictEqual(editResponse.confirmationRequired, false);
  assert.strictEqual(editResponse.parsed.confirmationRequired, false);
  assert.strictEqual(editResponse.parsed.awaitingConfirmation, false);
  assert.strictEqual(editResponse.message, 'Kya change karna hai? Class, subject, chapter ya question counts bata dein.');
  assert.strictEqual(chatbotControllerTestHooks.detectEditFieldRequest('subject'), 'subject');
  assert.strictEqual(chatbotControllerTestHooks.detectEditFieldRequest('change subject'), 'subject');
  assert.strictEqual(chatbotControllerTestHooks.detectEditFieldRequest('chapter'), 'chapters');
  assert.strictEqual(chatbotControllerTestHooks.detectEditFieldRequest('counts'), 'counts');
  assert.strictEqual(chatbotControllerTestHooks.detectEditFieldRequest('subject chemistry'), '');
  const editSubjectParsed = chatbotControllerTestHooks.resetParsedForEditField(
    { ...pendingConfirmation, state: 'collecting_details' },
    'subject'
  );
  assert.strictEqual(editSubjectParsed.subject, '');
  assert.deepStrictEqual(editSubjectParsed.chapters, []);
  assert.deepStrictEqual(editSubjectParsed.missingFields, ['subject']);
  const editSubjectResponse = chatbotControllerTestHooks.buildEditFieldResponse(editSubjectParsed, 'subject');
  assert.strictEqual(editSubjectResponse.message, 'Subject ka naam bata dein.');
  assert.strictEqual(chatbotControllerTestHooks.confirmationQuestionFor('generate_paper'), 'Generate this paper?');
  assert.strictEqual(chatbotControllerTestHooks.confirmationQuestionFor('generate_practice'), 'Generate this practice test?');

  const chapterNameCases = [
    ['Dynamics', 'Dynamics'],
    ['dynamics', 'Dynamics'],
    ['Work and Energy', 'Work and Energy'],
    ['work energy', 'Work and Energy'],
    ['physical quantities measurement', 'Physical Quantities and Measurement']
  ];
  chapterNameCases.forEach(([input, expected]) => {
    const resolved = resolveChapters({ classLevel: '9th', subject: 'Physics', chapters: [input] }, metadata);
    assert.deepStrictEqual(resolved.chapters, [expected], input);
    assert.deepStrictEqual(resolved.unresolved, [], input);
  });
  const parsedDirectChapter = fallbackParse('9 class physics dynamics 5 mcq paper bna do', 'teacher', metadata);
  assert(parsedDirectChapter.chapters.includes('Dynamics'));

  const firstPaperPrompt = fallbackParse('generate paper of 9th class physics', 'teacher', metadata);
  const secondPaperPrompt = fallbackParse('dynamics, 4 mcqs, 3 short, 1 long', 'teacher', metadata);
  const enrichedSecondPrompt = chatbotControllerTestHooks.enrichParsedWithPendingScope({
    parsedMessage: secondPaperPrompt,
    pendingContext: firstPaperPrompt,
    message: 'dynamics, 4 mcqs, 3 short, 1 long',
    role: 'teacher',
    metadata
  });
  const mergedPaperPrompt = mergeParsedWithPending({
    parsed: enrichedSecondPrompt,
    pendingContext: firstPaperPrompt,
    message: 'dynamics, 4 mcqs, 3 short, 1 long',
    role: 'teacher'
  });
  assert.strictEqual(mergedPaperPrompt.intent, 'generate_paper');
  assert.strictEqual(mergedPaperPrompt.classLevel, '9th');
  assert.strictEqual(mergedPaperPrompt.subject, 'Physics');
  assert(mergedPaperPrompt.chapters.includes('Dynamics'));
  assert.strictEqual(mergedPaperPrompt.mcqCount, 4);
  assert.strictEqual(mergedPaperPrompt.shortCount, 3);
  assert.strictEqual(mergedPaperPrompt.longCount, 1);
  assert.strictEqual(mergedPaperPrompt.questionCounts.mcq, 4);
  assert.strictEqual(mergedPaperPrompt.questionCounts.short, 3);
  assert.strictEqual(mergedPaperPrompt.questionCounts.long, 1);
  const mergedPaperValidation = chatbotControllerTestHooks.validateGenerationIntent(mergedPaperPrompt, metadata);
  assert.strictEqual(mergedPaperValidation.ok, true);
  const confirmationSummary = chatbotControllerTestHooks.buildSummary(mergedPaperPrompt, mergedPaperValidation);
  assert.deepStrictEqual(confirmationSummary.chapters, ['Dynamics']);
  assert.deepStrictEqual(confirmationSummary.counts, { mcq: 4, short: 3, long: 1 });
  ['classLevel', 'subject', 'chapterMode', 'chapters', 'counts', 'marks', 'difficulty'].forEach((field) => {
    assert(Object.prototype.hasOwnProperty.call(confirmationSummary, field), field);
  });

  const practiceConfirmationSummary = chatbotControllerTestHooks.buildSummary(
    { intent: 'generate_practice', marks: { mcq: 1, short: 2, long: 5 }, difficulty: 'mixed' },
    { classLevel: '9th', subject: 'Physics', chapters: ['Dynamics'], chapterMode: 'Selected Chapters' },
    { practiceMcqLimit: 15 }
  );
  assert.deepStrictEqual(practiceConfirmationSummary.counts, { mcq: 15 });
  assert.deepStrictEqual(practiceConfirmationSummary.marks, { mcq: 1 });

  const pendingCountsOnly = {
    intent: 'generate_paper',
    classLevel: '9th',
    subject: 'Physics',
    chapters: ['Dynamics'],
    missingFields: ['question counts']
  };
  [
    ['2,3,5', { mcqCount: 2, shortCount: 3, longCount: 5 }],
    ['10,5,2', { mcqCount: 10, shortCount: 5, longCount: 2 }],
    ['7 3 1', { mcqCount: 7, shortCount: 3, longCount: 1 }]
  ].forEach(([message, expected]) => {
    const parsedCounts = chatbotControllerTestHooks.parseCompactQuestionCounts(message, pendingCountsOnly);
    assert.deepStrictEqual(
      {
        mcqCount: parsedCounts.mcqCount,
        shortCount: parsedCounts.shortCount,
        longCount: parsedCounts.longCount
      },
      expected,
      message
    );
    const enrichedCounts = chatbotControllerTestHooks.enrichParsedWithPendingScope({
      parsedMessage: fallbackParse(message, 'teacher', metadata),
      pendingContext: pendingCountsOnly,
      message,
      role: 'teacher',
      metadata
    });
    const mergedCounts = mergeParsedWithPending({
      parsed: enrichedCounts,
      pendingContext: pendingCountsOnly,
      message,
      role: 'teacher'
    });
    assert.strictEqual(mergedCounts.mcqCount, expected.mcqCount, message);
    assert.strictEqual(mergedCounts.shortCount, expected.shortCount, message);
    assert.strictEqual(mergedCounts.longCount, expected.longCount, message);
  });

  const overLimitCounts = {
    intent: 'generate_paper',
    classLevel: '9th',
    subject: 'Physics',
    chapters: ['7'],
    mcqCount: 89,
    shortCount: 66,
    longCount: 54,
    questionCounts: { mcq: 89, short: 66, long: 54 }
  };
  const overLimitValidation = chatbotControllerTestHooks.validateGenerationIntent(overLimitCounts, metadata);
  assert.strictEqual(overLimitValidation.ok, false);
  assert.deepStrictEqual(overLimitValidation.missing, ['question counts']);
  assert(overLimitValidation.message.includes('100 MCQs'), overLimitValidation.message);
  assert(overLimitValidation.message.includes('50 short'), overLimitValidation.message);
  assert(overLimitValidation.message.includes('20 long'), overLimitValidation.message);
  assert(overLimitValidation.message.includes('short questions 66/50'), overLimitValidation.message);
  assert(overLimitValidation.message.includes('long questions 54/20'), overLimitValidation.message);
  const overLimitPractice = {
    intent: 'generate_practice',
    classLevel: '2nd Year',
    subject: 'Chemistry',
    chapters: ['7'],
    mcqCount: 112,
    questionCounts: { mcq: 112 }
  };
  const overLimitPracticeValidation = chatbotControllerTestHooks.validateGenerationIntent(overLimitPractice, metadata);
  assert.strictEqual(overLimitPracticeValidation.ok, false);
  assert.strictEqual(
    overLimitPracticeValidation.message,
    'Maximum limit: 100 MCQs. Aap ne MCQs 112/100 request kiye hain. Please count kam karein.'
  );
  assert(!overLimitPracticeValidation.message.includes('short questions'), overLimitPracticeValidation.message);
  assert(!overLimitPracticeValidation.message.includes('long questions'), overLimitPracticeValidation.message);

  const pendingPracticeScope = {
    intent: 'generate_practice',
    subject: 'Physics',
    missingFields: ['classLevel', 'chapters']
  };
  const compactAcademic = chatbotControllerTestHooks.parseCompactClassChapterFollowUp('12, 3', pendingPracticeScope, metadata);
  assert.deepStrictEqual(compactAcademic, { classLevel: '2nd Year', chapters: ['3'] });
  const compactAcademicEnriched = chatbotControllerTestHooks.enrichParsedWithPendingScope({
    parsedMessage: fallbackParse('12, 3', 'student', metadata),
    pendingContext: pendingPracticeScope,
    message: '12, 3',
    role: 'student',
    metadata
  });
  const compactAcademicMerged = mergeParsedWithPending({
    parsed: compactAcademicEnriched,
    pendingContext: pendingPracticeScope,
    message: '12, 3',
    role: 'student'
  });
  assert.strictEqual(compactAcademicMerged.classLevel, '2nd Year');
  assert.strictEqual(compactAcademicMerged.subject, 'Physics');
  assert.deepStrictEqual(compactAcademicMerged.chapters, ['3']);
  const compactAcademicValidation = chatbotControllerTestHooks.validateGenerationIntent(compactAcademicMerged, metadata);
  assert.strictEqual(compactAcademicValidation.ok, false);
  assert.deepStrictEqual(compactAcademicValidation.missing, ['mcqCount']);
  assert.strictEqual(compactAcademicValidation.message, 'MCQs kitne chahiye?');
  const pendingPracticeCount = {
    ...compactAcademicMerged,
    missingFields: ['mcqCount']
  };
  assert.deepStrictEqual(chatbotControllerTestHooks.parseSingleMcqCountFollowUp('33', pendingPracticeCount), {
    mcqCount: 33,
    shortCount: 0,
    longCount: 0,
    questionCounts: { mcq: 33 },
    questionTypes: ['mcq']
  });
  const singleMcqEnriched = chatbotControllerTestHooks.enrichParsedWithPendingScope({
    parsedMessage: fallbackParse('33', 'student', metadata),
    pendingContext: pendingPracticeCount,
    message: '33',
    role: 'student',
    metadata
  });
  const singleMcqMerged = mergeParsedWithPending({
    parsed: singleMcqEnriched,
    pendingContext: pendingPracticeCount,
    message: '33',
    role: 'student'
  });
  assert.strictEqual(singleMcqMerged.intent, 'generate_practice');
  assert.strictEqual(singleMcqMerged.classLevel, '2nd Year');
  assert.strictEqual(singleMcqMerged.subject, 'Physics');
  assert.deepStrictEqual(singleMcqMerged.chapters, ['3']);
  assert.strictEqual(singleMcqMerged.mcqCount, 33);
  assert.deepStrictEqual(singleMcqMerged.questionCounts, { mcq: 33 });
  const singleMcqValidation = chatbotControllerTestHooks.validateGenerationIntent(singleMcqMerged, metadata);
  assert.strictEqual(singleMcqValidation.ok, true, singleMcqValidation.message || 'single mcq count follow-up');

  const oldPendingRequest = fallbackParse('generate paper of 9th class physics', 'teacher', metadata);
  const freshRequestMessage = 'generate the paper of 10th class math chapter 2 8 mcq 4 short 3 long';
  assert.strictEqual(chatbotControllerTestHooks.isFreshFullRequest(freshRequestMessage, 'teacher', metadata), true);
  const freshRawParsed = fallbackParse(freshRequestMessage, 'teacher', metadata);
  const freshActivePending = chatbotControllerTestHooks.isFreshFullRequest(freshRequestMessage, 'teacher', metadata)
    ? null
    : oldPendingRequest;
  const freshEnriched = chatbotControllerTestHooks.enrichParsedWithPendingScope({
    parsedMessage: freshRawParsed,
    pendingContext: freshActivePending,
    message: freshRequestMessage,
    role: 'teacher',
    metadata
  });
  const freshMerged = mergeParsedWithPending({
    parsed: freshEnriched,
    pendingContext: freshActivePending,
    message: freshRequestMessage,
    role: 'teacher'
  });
  assert.strictEqual(freshMerged.classLevel, '10th');
  assert.strictEqual(freshMerged.subject, 'Math');
  assert(!freshMerged.subject.includes('Physics'));
  assert.strictEqual(freshMerged.mcqCount, 8);
  assert.strictEqual(freshMerged.shortCount, 4);
  assert.strictEqual(freshMerged.longCount, 3);
  const freshValidation = chatbotControllerTestHooks.validateGenerationIntent(freshMerged, metadata);
  assert.strictEqual(freshValidation.ok, true, freshValidation.message || freshRequestMessage);
  const finalPaperPayload = chatbotControllerTestHooks.buildFinalPaperPayload(freshMerged, freshValidation);
  assert.strictEqual(finalPaperPayload.title, '10th Mathematics Paper');
  assert.strictEqual(finalPaperPayload.examTitle, '10th Mathematics Paper');
  assert.strictEqual(finalPaperPayload.classLevel, '10th');
  assert.strictEqual(finalPaperPayload.subject, 'Math');
  assert.deepStrictEqual(finalPaperPayload.questionCounts, { mcq: 8, short: 4, long: 3 });

  const oldPhysicsPending = {
    ...oldPendingRequest,
    classLevel: '9th',
    subject: 'Physics',
    chapters: ['Dynamics'],
    mcqCount: 9,
    shortCount: 4,
    longCount: 2,
    missingFields: ['question counts'],
    confirmationRequired: true
  };
  const freshNoCountMessage = 'generate 10th math paper chapter 2';
  assert.strictEqual(chatbotControllerTestHooks.isFreshFullRequest(freshNoCountMessage, 'teacher', metadata), true);
  assert.strictEqual(
    chatbotControllerTestHooks.shouldClearPendingForFreshRequest(oldPhysicsPending, freshNoCountMessage, 'teacher', metadata),
    true
  );
  const freshNoCountActivePending = chatbotControllerTestHooks.shouldClearPendingForFreshRequest(
    oldPhysicsPending,
    freshNoCountMessage,
    'teacher',
    metadata
  )
    ? null
    : oldPhysicsPending;
  const freshNoCountParsed = fallbackParse(freshNoCountMessage, 'teacher', metadata);
  const freshNoCountEnriched = chatbotControllerTestHooks.enrichParsedWithPendingScope({
    parsedMessage: freshNoCountParsed,
    pendingContext: freshNoCountActivePending,
    message: freshNoCountMessage,
    role: 'teacher',
    metadata
  });
  const freshNoCountMerged = mergeParsedWithPending({
    parsed: freshNoCountEnriched,
    pendingContext: freshNoCountActivePending,
    message: freshNoCountMessage,
    role: 'teacher'
  });
  assert.strictEqual(freshNoCountMerged.classLevel, '10th');
  assert.strictEqual(freshNoCountMerged.subject, 'Math');
  assert.deepStrictEqual(freshNoCountMerged.chapters, ['2']);
  assert.strictEqual(freshNoCountMerged.mcqCount, 0);
  assert.strictEqual(freshNoCountMerged.shortCount, 0);
  assert.strictEqual(freshNoCountMerged.longCount, 0);
  assert(!freshNoCountMerged.subject.includes('Physics'));

  const oldChemistryWithCounts = {
    intent: 'generate_paper',
    classLevel: '10th',
    subject: 'Chemistry',
    chapters: ['Chemical Equilibrium'],
    mcqCount: 5,
    shortCount: 3,
    longCount: 1,
    questionCounts: { mcq: 5, short: 3, long: 1 },
    missingFields: [],
    confirmationRequired: true
  };
  const classOnlyFreshMessage = 'mujh ko 9th class ka paper bna kr do';
  assert.strictEqual(
    chatbotControllerTestHooks.shouldClearPendingForFreshRequest(oldChemistryWithCounts, classOnlyFreshMessage, 'teacher', metadata),
    true
  );
  const classOnlyMerged = mergeParsedWithPending({
    parsed: fallbackParse(classOnlyFreshMessage, 'teacher', metadata),
    pendingContext: null,
    message: classOnlyFreshMessage,
    role: 'teacher'
  });
  assert.strictEqual(classOnlyMerged.classLevel, '9th');
  assert.strictEqual(classOnlyMerged.subject, '');
  assert.strictEqual(classOnlyMerged.mcqCount, 0);
  assert.strictEqual(classOnlyMerged.shortCount, 0);
  assert.strictEqual(classOnlyMerged.longCount, 0);

  const scopedNoCountMessage = 'mujh ko 9th class ka chemistry Structure of Molecules ka paper bna do';
  assert.strictEqual(
    chatbotControllerTestHooks.shouldClearPendingForFreshRequest(oldChemistryWithCounts, scopedNoCountMessage, 'teacher', metadata),
    true
  );
  const scopedNoCountMerged = mergeParsedWithPending({
    parsed: fallbackParse(scopedNoCountMessage, 'teacher', metadata),
    pendingContext: null,
    message: scopedNoCountMessage,
    role: 'teacher'
  });
  const scopedNoCountValidation = chatbotControllerTestHooks.validateGenerationIntent(scopedNoCountMerged, metadata);
  assert.strictEqual(scopedNoCountValidation.ok, false);
  assert.deepStrictEqual(scopedNoCountValidation.missing, ['question counts']);

  const classOnlyPending = {
    intent: 'generate_paper',
    classLevel: '9th',
    subject: '',
    chapters: [],
    missingFields: ['subject', 'chapters'],
    confirmationRequired: true
  };
  const subjectAndChapterFollowUp = 'chemistry, 3';
  const subjectChapterEnriched = chatbotControllerTestHooks.enrichParsedWithPendingScope({
    parsedMessage: fallbackParse(subjectAndChapterFollowUp, 'teacher', metadata),
    pendingContext: classOnlyPending,
    message: subjectAndChapterFollowUp,
    role: 'teacher',
    metadata
  });
  const subjectChapterMerged = mergeParsedWithPending({
    parsed: subjectChapterEnriched,
    pendingContext: classOnlyPending,
    message: subjectAndChapterFollowUp,
    role: 'teacher'
  });
  assert.strictEqual(subjectChapterMerged.classLevel, '9th');
  assert.strictEqual(subjectChapterMerged.subject, 'Chemistry');
  assert.deepStrictEqual(subjectChapterMerged.chapters, ['3']);
  const subjectChapterValidation = chatbotControllerTestHooks.validateGenerationIntent(subjectChapterMerged, metadata);
  assert.strictEqual(subjectChapterValidation.ok, false);
  assert.deepStrictEqual(subjectChapterValidation.missing, ['question counts']);

  const subjectOnlyPending = {
    intent: 'generate_paper',
    classLevel: '9th',
    subject: 'Chemistry',
    chapters: [],
    missingFields: ['chapters'],
    confirmationRequired: true
  };
  assert.deepStrictEqual(chatbotControllerTestHooks.parseBareChapterFollowUp('3', subjectOnlyPending, {}), ['3']);
  const chapterOnlyEnriched = chatbotControllerTestHooks.enrichParsedWithPendingScope({
    parsedMessage: fallbackParse('3', 'teacher', metadata),
    pendingContext: subjectOnlyPending,
    message: '3',
    role: 'teacher',
    metadata
  });
  const chapterOnlyMerged = mergeParsedWithPending({
    parsed: chapterOnlyEnriched,
    pendingContext: subjectOnlyPending,
    message: '3',
    role: 'teacher'
  });
  assert.deepStrictEqual(chapterOnlyMerged.chapters, ['3']);
  const chapterOnlyValidation = chatbotControllerTestHooks.validateGenerationIntent(chapterOnlyMerged, metadata);
  assert.strictEqual(chapterOnlyValidation.ok, false);
  assert.deepStrictEqual(chapterOnlyValidation.missing, ['question counts']);

  const fullBookPaper = fallbackParse('generate full book chemistry paper of 10th class', 'teacher', metadata);
  assert.strictEqual(fullBookPaper.intent, 'generate_paper');
  assert.strictEqual(fullBookPaper.classLevel, '10th');
  assert.strictEqual(fullBookPaper.subject, 'Chemistry');
  assert.strictEqual(fullBookPaper.fullBook, true);
  assert.deepStrictEqual(fullBookPaper.chapters, []);
  const fullBookMissingCounts = chatbotControllerTestHooks.validateGenerationIntent(fullBookPaper, metadata);
  assert.strictEqual(fullBookMissingCounts.ok, false);
  assert.deepStrictEqual(fullBookMissingCounts.missing, ['question counts']);

  const fullBookPhysics = fallbackParse('9th physics ki puri book ka paper bna do', 'teacher', metadata);
  assert.strictEqual(fullBookPhysics.intent, 'generate_paper');
  assert.strictEqual(fullBookPhysics.classLevel, '9th');
  assert.strictEqual(fullBookPhysics.subject, 'Physics');
  assert.strictEqual(fullBookPhysics.fullBook, true);
  assert.deepStrictEqual(chatbotControllerTestHooks.validateGenerationIntent(fullBookPhysics, metadata).missing, ['question counts']);

  const fullSyllabusPractice = fallbackParse('full syllabus math practice test', 'student', metadata);
  assert.strictEqual(fullSyllabusPractice.intent, 'generate_practice');
  assert.strictEqual(fullSyllabusPractice.subject, 'Math');
  assert.strictEqual(fullSyllabusPractice.fullBook, true);
  assert(!chatbotControllerTestHooks.validateGenerationIntent(fullSyllabusPractice, metadata).missing.includes('chapters'));

  ['complete syllabus test', 'all chapters MCQs test', 'puri book ka practice test'].forEach((message) => {
    assert.strictEqual(fallbackParse(message, 'student', metadata).fullBook, true, message);
  });

  const fullBookPracticeNoClass = fallbackParse('full book chemistry practice test', 'student', metadata);
  assert.strictEqual(fullBookPracticeNoClass.intent, 'generate_practice');
  assert.strictEqual(fullBookPracticeNoClass.subject, 'Chemistry');
  assert.strictEqual(fullBookPracticeNoClass.fullBook, true);
  const fullBookPracticeNoClassValidation = chatbotControllerTestHooks.validateGenerationIntent(fullBookPracticeNoClass, metadata);
  assert.strictEqual(fullBookPracticeNoClassValidation.ok, false);
  assert(fullBookPracticeNoClassValidation.missing.includes('classLevel'));
  assert(!fullBookPracticeNoClassValidation.missing.includes('chapters'));
  assert(!fullBookPracticeNoClassValidation.missing.includes('mcqCount'));

  const fullBookMathPractice = fallbackParse('10th math puri book ka mcqs test', 'student', metadata);
  assert.strictEqual(fullBookMathPractice.intent, 'generate_practice');
  assert.strictEqual(fullBookMathPractice.classLevel, '10th');
  assert.strictEqual(fullBookMathPractice.subject, 'Math');
  assert.strictEqual(fullBookMathPractice.fullBook, true);
  const fullBookMathPracticeValidation = chatbotControllerTestHooks.validateGenerationIntent(fullBookMathPractice, metadata);
  assert.strictEqual(fullBookMathPracticeValidation.ok, true, fullBookMathPracticeValidation.message || 'full book practice validation');
  assert.strictEqual(fullBookMathPracticeValidation.chapterMode, 'Full Book');
  assert(fullBookMathPracticeValidation.chapters.length > 1);

  const fullBookWithCounts = fallbackParse('generate full book chemistry paper of 10th class 2 mcq 1 short 1 long', 'teacher', metadata);
  const fullBookValidation = chatbotControllerTestHooks.validateGenerationIntent(fullBookWithCounts, metadata);
  assert.strictEqual(fullBookValidation.ok, true, fullBookValidation.message || 'full book validation');
  assert.strictEqual(fullBookValidation.chapterMode, 'Full Book');
  assert(fullBookValidation.chapters.length > 1);
  const fullBookSummary = chatbotControllerTestHooks.buildSummary(fullBookWithCounts, fullBookValidation);
  assert.strictEqual(fullBookSummary.fullBook, true);
  assert.strictEqual(fullBookSummary.chapterMode, 'Full Book');

  const firstHalfPaper = fallbackParse('generate first half chemistry paper', 'teacher', metadata);
  assert.strictEqual(firstHalfPaper.intent, 'generate_paper');
  assert.strictEqual(firstHalfPaper.subject, 'Chemistry');
  assert.strictEqual(firstHalfPaper.firstHalf, true);
  assert.deepStrictEqual(firstHalfPaper.chapters, []);
  assert(!chatbotControllerTestHooks.validateGenerationIntent(firstHalfPaper, metadata).missing.includes('chapters'));

  const firstHalfPractice = fallbackParse('physics first half practice test', 'student', metadata);
  assert.strictEqual(firstHalfPractice.intent, 'generate_practice');
  assert.strictEqual(firstHalfPractice.subject, 'Physics');
  assert.strictEqual(firstHalfPractice.firstHalf, true);
  assert(!chatbotControllerTestHooks.validateGenerationIntent(firstHalfPractice, metadata).missing.includes('chapters'));

  const firstHalfRoman = fallbackParse('10th chemistry ky pehly half chapters ka paper bna do', 'teacher', metadata);
  assert.strictEqual(firstHalfRoman.intent, 'generate_paper');
  assert.strictEqual(firstHalfRoman.classLevel, '10th');
  assert.strictEqual(firstHalfRoman.subject, 'Chemistry');
  assert.strictEqual(firstHalfRoman.firstHalf, true);
  assert.deepStrictEqual(chatbotControllerTestHooks.validateGenerationIntent(firstHalfRoman, metadata).missing, ['question counts']);

  const firstHalfWithCounts = fallbackParse('10th chemistry ky pehly half chapters ka paper bna do 2 mcq 1 short 1 long', 'teacher', metadata);
  const firstHalfValidation = chatbotControllerTestHooks.validateGenerationIntent(firstHalfWithCounts, metadata);
  const allChemistryChapters = metadata.classes
    .find((classItem) => classItem.name === '10th')
    ?.subjects.find((subjectItem) => subjectItem.name === 'Chemistry')?.chapters || [];
  const allPhysicsChapters = metadata.classes
    .find((classItem) => classItem.name === '9th')
    ?.subjects.find((subjectItem) => subjectItem.name === 'Physics')?.chapters || [];

  const multipleChaptersNoClass = fallbackParse('generate chemistry chapters 1,2,3 paper', 'teacher', metadata);
  assert.strictEqual(multipleChaptersNoClass.intent, 'generate_paper');
  assert.strictEqual(multipleChaptersNoClass.subject, 'Chemistry');
  assert.deepStrictEqual(multipleChaptersNoClass.chapters, ['1', '2', '3']);
  assert(!chatbotControllerTestHooks.validateGenerationIntent(multipleChaptersNoClass, metadata).missing.includes('chapters'));

  const multipleChemistryChapters = fallbackParse('10th chemistry chapters 1,2,3 paper 3 mcq 1 short 1 long', 'teacher', metadata);
  const multipleChemistryValidation = chatbotControllerTestHooks.validateGenerationIntent(multipleChemistryChapters, metadata);
  assert.strictEqual(multipleChemistryValidation.ok, true, multipleChemistryValidation.message || 'multiple chapter validation');
  assert.deepStrictEqual(
    multipleChemistryValidation.chapters,
    allChemistryChapters.slice(0, 3).map((chapter) => chapter.name)
  );

  const multiplePhysicsNames = fallbackParse('9 class physics dynamics and gravitation paper 4 mcq 2 short 1 long', 'teacher', metadata);
  const multiplePhysicsValidation = chatbotControllerTestHooks.validateGenerationIntent(multiplePhysicsNames, metadata);
  assert.strictEqual(multiplePhysicsValidation.ok, true, multiplePhysicsValidation.message || 'multiple named chapter validation');
  assert.deepStrictEqual(multiplePhysicsValidation.chapters, ['Dynamics', 'Gravitation']);

  const practiceChaptersNoScope = fallbackParse('chapter 1,2,3 practice test', 'student', metadata);
  assert.strictEqual(practiceChaptersNoScope.intent, 'generate_practice');
  assert.deepStrictEqual(practiceChaptersNoScope.chapters, ['1', '2', '3']);
  const practiceChaptersNoScopeValidation = chatbotControllerTestHooks.validateGenerationIntent(practiceChaptersNoScope, metadata);
  assert(practiceChaptersNoScopeValidation.missing.includes('classLevel'));
  assert(practiceChaptersNoScopeValidation.missing.includes('subject'));
  assert(!practiceChaptersNoScopeValidation.missing.includes('chapters'));

  const practiceChaptersWithScope = fallbackParse('9th physics chapter 1,2,3 practice test', 'student', metadata);
  const practiceChaptersValidation = chatbotControllerTestHooks.validateGenerationIntent(practiceChaptersWithScope, metadata);
  assert.strictEqual(practiceChaptersValidation.ok, true, practiceChaptersValidation.message || 'multi chapter practice validation');
  assert.deepStrictEqual(
    practiceChaptersValidation.chapters,
    allPhysicsChapters.slice(0, 3).map((chapter) => chapter.name)
  );

  const practiceNamedNoScope = fallbackParse('dynamics aur gravitation ka mcqs test', 'student', metadata);
  assert.strictEqual(practiceNamedNoScope.intent, 'generate_practice');
  assert.strictEqual(practiceNamedNoScope.subject, '');
  assert.deepStrictEqual(practiceNamedNoScope.chapters, ['Dynamics', 'Gravitation']);
  const practiceNamedNoScopeValidation = chatbotControllerTestHooks.validateGenerationIntent(practiceNamedNoScope, metadata);
  assert(practiceNamedNoScopeValidation.missing.includes('classLevel'));
  assert(practiceNamedNoScopeValidation.missing.includes('subject'));
  assert(!practiceNamedNoScopeValidation.missing.includes('chapters'));

  const practiceNamedWithScope = fallbackParse('9th physics dynamics aur gravitation ka mcqs test', 'student', metadata);
  const practiceNamedValidation = chatbotControllerTestHooks.validateGenerationIntent(practiceNamedWithScope, metadata);
  assert.strictEqual(practiceNamedValidation.ok, true, practiceNamedValidation.message || 'named chapter practice validation');
  assert.deepStrictEqual(practiceNamedValidation.chapters, ['Dynamics', 'Gravitation']);

  const chapterAurPrompt = fallbackParse('chapter 2 aur 5 ka paper bna do', 'teacher', metadata);
  assert.deepStrictEqual(chapterAurPrompt.chapters, ['2', '5']);
  assert(!chatbotControllerTestHooks.validateGenerationIntent(chapterAurPrompt, metadata).missing.includes('chapters'));

  const chapterAurWithScope = fallbackParse('10th chemistry chapter 2 aur 5 ka paper bna do 2 mcq 1 short 1 long', 'teacher', metadata);
  const chapterAurValidation = chatbotControllerTestHooks.validateGenerationIntent(chapterAurWithScope, metadata);
  assert.strictEqual(chapterAurValidation.ok, true, chapterAurValidation.message || 'aur chapter validation');
  assert.deepStrictEqual(
    chapterAurValidation.chapters,
    [allChemistryChapters[1]?.name, allChemistryChapters[4]?.name].filter(Boolean)
  );

  const chapterRangePrompt = fallbackParse('generate chemistry chapter 1 to 4 paper', 'teacher', metadata);
  assert.strictEqual(chapterRangePrompt.intent, 'generate_paper');
  assert.strictEqual(chapterRangePrompt.subject, 'Chemistry');
  assert.strictEqual(chapterRangePrompt.chapterRange, true);
  assert.deepStrictEqual(chapterRangePrompt.chapters, ['1', '2', '3', '4']);
  assert(!chatbotControllerTestHooks.validateGenerationIntent(chapterRangePrompt, metadata).missing.includes('chapters'));

  const chapterRangeWithScope = fallbackParse('10th chemistry chapter 1 to 4 paper 4 mcq 2 short 1 long', 'teacher', metadata);
  const chapterRangeValidation = chatbotControllerTestHooks.validateGenerationIntent(chapterRangeWithScope, metadata);
  assert.strictEqual(chapterRangeValidation.ok, true, chapterRangeValidation.message || 'chapter range validation');
  assert.strictEqual(chapterRangeValidation.chapterMode, 'Chapter Range');
  assert.deepStrictEqual(
    chapterRangeValidation.chapters,
    allChemistryChapters.slice(0, 4).map((chapter) => chapter.name)
  );
  const chapterRangeSummary = chatbotControllerTestHooks.buildSummary(chapterRangeWithScope, chapterRangeValidation);
  assert.strictEqual(chapterRangeSummary.chapterRange, true);
  assert.strictEqual(chapterRangeSummary.chapterMode, 'Chapter Range');

  const physicsRangePrompt = fallbackParse('physics chapter 2 se 5 tak paper bna do', 'teacher', metadata);
  assert.strictEqual(physicsRangePrompt.subject, 'Physics');
  assert.strictEqual(physicsRangePrompt.chapterRange, true);
  assert.deepStrictEqual(physicsRangePrompt.chapters, ['2', '3', '4', '5']);
  assert(!chatbotControllerTestHooks.validateGenerationIntent(physicsRangePrompt, metadata).missing.includes('chapters'));

  const practiceRangePrompt = fallbackParse('physics chapters 2 to 5 practice paper', 'student', metadata);
  assert.strictEqual(practiceRangePrompt.intent, 'generate_practice');
  assert.strictEqual(practiceRangePrompt.subject, 'Physics');
  assert.strictEqual(practiceRangePrompt.chapterRange, true);
  assert.deepStrictEqual(practiceRangePrompt.chapters, ['2', '3', '4', '5']);
  assert.deepStrictEqual(chatbotControllerTestHooks.validateGenerationIntent(practiceRangePrompt, metadata).missing, ['classLevel']);

  const practiceRangeWithScope = fallbackParse('9th physics chapters 2 to 5 practice paper', 'student', metadata);
  const practiceRangeValidation = chatbotControllerTestHooks.validateGenerationIntent(practiceRangeWithScope, metadata);
  assert.strictEqual(practiceRangeValidation.ok, true, practiceRangeValidation.message || 'practice range validation');
  assert.strictEqual(practiceRangeValidation.chapterMode, 'Chapter Range');
  assert.deepStrictEqual(
    practiceRangeValidation.chapters,
    allPhysicsChapters.slice(1, 5).map((chapter) => chapter.name)
  );

  assert.strictEqual(firstHalfValidation.ok, true, firstHalfValidation.message || 'first half validation');
  assert.strictEqual(firstHalfValidation.chapterMode, 'First Half Book');
  assert.strictEqual(firstHalfValidation.chapters.length, Math.ceil(allChemistryChapters.length / 2));
  const firstHalfSummary = chatbotControllerTestHooks.buildSummary(firstHalfWithCounts, firstHalfValidation);
  assert.strictEqual(firstHalfSummary.firstHalf, true);
  assert.strictEqual(firstHalfSummary.chapterMode, 'First Half Book');

  const secondHalfPaper = fallbackParse('generate second half chemistry paper', 'teacher', metadata);
  assert.strictEqual(secondHalfPaper.intent, 'generate_paper');
  assert.strictEqual(secondHalfPaper.subject, 'Chemistry');
  assert.strictEqual(secondHalfPaper.secondHalf, true);
  assert.deepStrictEqual(secondHalfPaper.chapters, []);
  assert(!chatbotControllerTestHooks.validateGenerationIntent(secondHalfPaper, metadata).missing.includes('chapters'));

  const secondHalfPractice = fallbackParse('last half physics practice test', 'student', metadata);
  assert.strictEqual(secondHalfPractice.intent, 'generate_practice');
  assert.strictEqual(secondHalfPractice.subject, 'Physics');
  assert.strictEqual(secondHalfPractice.secondHalf, true);
  assert(!chatbotControllerTestHooks.validateGenerationIntent(secondHalfPractice, metadata).missing.includes('chapters'));

  const secondHalfRoman = fallbackParse('10th chemistry ky last half chapters ka paper bna do', 'teacher', metadata);
  assert.strictEqual(secondHalfRoman.intent, 'generate_paper');
  assert.strictEqual(secondHalfRoman.classLevel, '10th');
  assert.strictEqual(secondHalfRoman.subject, 'Chemistry');
  assert.strictEqual(secondHalfRoman.secondHalf, true);
  assert.deepStrictEqual(chatbotControllerTestHooks.validateGenerationIntent(secondHalfRoman, metadata).missing, ['question counts']);

  const secondHalfWithCounts = fallbackParse('10th chemistry ky last half chapters ka paper bna do 2 mcq 1 short 1 long', 'teacher', metadata);
  const secondHalfValidation = chatbotControllerTestHooks.validateGenerationIntent(secondHalfWithCounts, metadata);
  assert.strictEqual(secondHalfValidation.ok, true, secondHalfValidation.message || 'second half validation');
  assert.strictEqual(secondHalfValidation.chapterMode, 'Second Half Book');
  assert.strictEqual(secondHalfValidation.chapters.length, Math.ceil(allChemistryChapters.length / 2));
  assert.deepStrictEqual(
    secondHalfValidation.chapters,
    allChemistryChapters.slice(Math.floor(allChemistryChapters.length / 2)).map((chapter) => chapter.name)
  );
  const secondHalfSummary = chatbotControllerTestHooks.buildSummary(secondHalfWithCounts, secondHalfValidation);
  assert.strictEqual(secondHalfSummary.secondHalf, true);
  assert.strictEqual(secondHalfSummary.chapterMode, 'Second Half Book');

  console.log('Chatbot NLP tests passed');
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
