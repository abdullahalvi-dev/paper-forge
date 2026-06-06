/*
 * Roman Urdu comments:
 * Ye utility question text cleanup ke liye use hoti hai.
 * MCQ/SHORT/LONG prefixes aur numbering remove karke clean printable question text return karti hai.
 */
const cleanQuestionText = (value) => {
  let text = String(value || '').trim();
  const prefixes = [
    /^\s*\d+\s*[:.)-]\s*/i,
    /^\s*(?:mcqs?|short(?:\s+questions?)?|long(?:\s+questions?)?|questions?)\s*(?:no\.?|number|#)?\s*\d+\s*[:.)-]\s*/i
  ];

  let changed = true;
  while (changed) {
    changed = false;
    prefixes.forEach((pattern) => {
      const next = text.replace(pattern, '').trim();
      if (next !== text) {
        text = next;
        changed = true;
      }
    });
  }

  return text;
};

module.exports = {
  cleanQuestionText
};
