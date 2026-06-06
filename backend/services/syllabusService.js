/*
 * Roman Urdu comments:
 * Ye service supported classes, subjects aur chapter order ko normalize/resolve karti hai.
 * Chatbot agar "chapter 2" jaisi command samjhe to yahan se actual chapter name milta hai.
 */
const syllabus = {
  '9th': {
    Physics: [
      'Physical Quantities and Measurement',
      'Kinematics',
      'Dynamics',
      'Turning Effect of Forces',
      'Gravitation',
      'Work and Energy',
      'Properties of Matter',
      'Thermal Properties'
    ],
    Chemistry: [
      'Fundamentals of Chemistry',
      'Structure of Atoms',
      'Periodic Table',
      'Structure of Molecules',
      'Physical States of Matter',
      'Solutions',
      'Electrochemistry',
      'Chemical Reactivity'
    ],
    Math: [
      'Matrices and Determinants',
      'Real and Complex Numbers',
      'Logarithms',
      'Algebraic Expressions',
      'Factorization',
      'Linear Equations',
      'Coordinate Geometry',
      'Congruent Triangles'
    ]
  },
  '10th': {
    Physics: [
      'Simple Harmonic Motion and Waves',
      'Sound',
      'Geometrical Optics',
      'Electrostatics',
      'Current Electricity',
      'Electromagnetism',
      'Basic Electronics',
      'Information Technology'
    ],
    Chemistry: [
      'Chemical Equilibrium',
      'Acids Bases and Salts',
      'Organic Chemistry',
      'Hydrocarbons',
      'Biochemistry',
      'Atmosphere',
      'Water',
      'Chemical Industries'
    ],
    Math: [
      'Quadratic Equations',
      'Theory of Quadratic Equations',
      'Variations',
      'Partial Fractions',
      'Sets and Functions',
      'Basic Statistics',
      'Introduction to Trigonometry',
      'Projection of a Side of a Triangle'
    ]
  },
  '1st Year': {
    Physics: [
      'Measurements',
      'Vectors and Equilibrium',
      'Motion and Force',
      'Work and Energy',
      'Circular Motion',
      'Fluid Dynamics',
      'Oscillations',
      'Waves'
    ],
    Chemistry: [
      'Basic Concepts',
      'Experimental Techniques',
      'Gases',
      'Liquids and Solids',
      'Atomic Structure',
      'Chemical Bonding',
      'Thermochemistry',
      'Chemical Equilibrium'
    ],
    Math: [
      'Number Systems',
      'Sets Functions and Groups',
      'Matrices and Determinants',
      'Quadratic Equations',
      'Sequences and Series',
      'Permutations Combinations and Probability',
      'Mathematical Induction',
      'Trigonometric Functions'
    ]
  },
  '2nd Year': {
    Physics: [
      'Electrostatics',
      'Current Electricity',
      'Electromagnetism',
      'Electromagnetic Induction',
      'Alternating Current',
      'Physics of Solids',
      'Electronics',
      'Modern Physics'
    ],
    Chemistry: [
      'Periodic Classification',
      's Block Elements',
      'Group IIIA and IVA Elements',
      'Group VA and VIA Elements',
      'Transition Elements',
      'Organic Chemistry',
      'Hydrocarbons',
      'Macromolecules'
    ],
    Math: [
      'Functions and Limits',
      'Differentiation',
      'Integration',
      'Introduction to Analytic Geometry',
      'Linear Programming',
      'Conic Sections',
      'Vectors',
      'Probability'
    ]
  }
};

const normalizeKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeClassLevel = (value) => {
  const key = normalizeKey(value);
  if (!key) return '';
  if (['9', '9th', 'class 9', 'class 9th', 'nine', 'ninth'].includes(key)) return '9th';
  if (['10', '10th', 'class 10', 'class 10th', 'ten', 'tenth', 'matric'].includes(key)) return '10th';
  if (['11', '11th', '1st year', 'first year', 'class 11', 'class 11th', 'inter part 1'].includes(key)) return '1st Year';
  if (['12', '12th', '2nd year', 'second year', 'class 12', 'class 12th', 'inter part 2'].includes(key)) return '2nd Year';
  return Object.keys(syllabus).find((level) => normalizeKey(level) === key) || value;
};

const normalizeSubject = (value) => {
  const key = normalizeKey(value);
  if (!key) return '';
  if (['physics', 'phy'].includes(key)) return 'Physics';
  if (['chemistry', 'chem'].includes(key)) return 'Chemistry';
  if (['math', 'maths', 'mathematics'].includes(key)) return 'Math';
  return ['Physics', 'Chemistry', 'Math'].find((subject) => normalizeKey(subject) === key) || value;
};

const getChapters = (classLevel, subject) => {
  const normalizedClass = normalizeClassLevel(classLevel);
  const normalizedSubject = normalizeSubject(subject);
  return syllabus[normalizedClass]?.[normalizedSubject] || [];
};

const chapterNumber = (value) => {
  const match = String(value || '').match(/\b(?:chapter|chap)?\s*(\d{1,2})(?:st|nd|rd|th)?\b/i);
  return match ? Number(match[1]) : 0;
};

const resolveChapters = ({ classLevel, subject, chapters = [] }) => {
  const available = getChapters(classLevel, subject);
  const selected = Array.isArray(chapters) ? chapters.filter(Boolean) : [chapters].filter(Boolean);
  const resolved = [];
  const unresolved = [];

  selected.forEach((chapter) => {
    const number = chapterNumber(chapter);
    if (number && available[number - 1]) {
      resolved.push(available[number - 1]);
      return;
    }

    const key = normalizeKey(chapter);
    const exact = available.find((item) => normalizeKey(item) === key);
    if (exact) {
      resolved.push(exact);
      return;
    }

    const partial = available.find((item) => normalizeKey(item).includes(key) || key.includes(normalizeKey(item)));
    if (partial) {
      resolved.push(partial);
      return;
    }

    unresolved.push(String(chapter));
  });

  return {
    available,
    chapters: [...new Set(resolved)],
    unresolved
  };
};

module.exports = {
  getChapters,
  normalizeClassLevel,
  normalizeSubject,
  normalizeKey,
  resolveChapters,
  syllabus
};
