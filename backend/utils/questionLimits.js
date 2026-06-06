/*
 * Roman Urdu comments:
 * Ye helper paper/question count ki hard safety limits define karta hai.
 * Chatbot, API aur paper generation sab isi se max counts validate karte hain.
 */
const PAPER_QUESTION_LIMITS = {
  mcq: 100,
  short: 50,
  long: 20
};

const QUESTION_TYPE_LABELS = {
  mcq: 'MCQs',
  short: 'short questions',
  long: 'long questions'
};

const getQuestionCountLimitViolations = (counts = {}, limits = PAPER_QUESTION_LIMITS) =>
  Object.entries(limits)
    .map(([type, limit]) => ({
      type,
      limit,
      requested: Number(counts[type] || 0)
    }))
    .filter((item) => item.requested > item.limit);

const formatQuestionLimitMessage = (violations = []) => {
  const maxText = `Maximum limit: ${PAPER_QUESTION_LIMITS.mcq} MCQs, ${PAPER_QUESTION_LIMITS.short} short questions, ${PAPER_QUESTION_LIMITS.long} long questions.`;
  if (!violations.length) return maxText;

  const requestedText = violations
    .map((item) => `${QUESTION_TYPE_LABELS[item.type] || item.type} ${item.requested}/${item.limit}`)
    .join(', ');

  return `${maxText} Aap ne ${requestedText} request kiye hain. Please count kam karein.`;
};

const formatPracticeQuestionLimitMessage = (violations = []) => {
  const mcqViolation = violations.find((item) => item.type === 'mcq');
  if (!mcqViolation) return `Maximum limit: ${PAPER_QUESTION_LIMITS.mcq} MCQs.`;
  return `Maximum limit: ${PAPER_QUESTION_LIMITS.mcq} MCQs. Aap ne MCQs ${mcqViolation.requested}/${mcqViolation.limit} request kiye hain. Please count kam karein.`;
};

module.exports = {
  PAPER_QUESTION_LIMITS,
  getQuestionCountLimitViolations,
  formatQuestionLimitMessage,
  formatPracticeQuestionLimitMessage
};
