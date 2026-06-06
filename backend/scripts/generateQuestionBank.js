/*
 * Roman Urdu comments:
 * Ye script default syllabus ke liye sample chapter-wise question bank generate karti hai.
 * Physics, Chemistry aur Math ke MCQ, short aur long questions JSON files mein write hotay hain.
 */
const fs = require('fs');
const path = require('path');

const outputRoot = path.join(__dirname, '..', 'data', 'question-bank');
const combinedFile = path.join(__dirname, '..', 'data', 'questions.1000plus.json');

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

const conceptRules = {
  Physics: [
    [/kinematics|motion/i, ['distance', 'displacement', 'speed', 'velocity', 'acceleration', 'uniform motion', 'motion graph', 'equation of motion']],
    [/dynamics|force/i, ['force', 'mass', 'inertia', 'momentum', 'friction', 'Newton law', 'net force', 'action reaction']],
    [/work|energy|power/i, ['work', 'energy', 'power', 'kinetic energy', 'potential energy', 'efficiency', 'joule', 'conservation of energy']],
    [/waves|sound|oscillation/i, ['amplitude', 'frequency', 'time period', 'wavelength', 'wave speed', 'resonance', 'sound intensity', 'echo']],
    [/optics|light/i, ['reflection', 'refraction', 'lens', 'mirror', 'focal length', 'image formation', 'ray diagram', 'refractive index']],
    [/electric|electrostatic|current/i, ['charge', 'current', 'voltage', 'resistance', 'Ohm law', 'electric field', 'circuit', 'power loss']],
    [/magnet|induction/i, ['magnetic field', 'electromagnet', 'flux', 'induced current', 'generator', 'motor effect', 'transformer', 'Lenz law']],
    [/heat|thermal|temperature/i, ['temperature', 'heat', 'specific heat', 'thermal expansion', 'latent heat', 'conduction', 'convection', 'radiation']],
    [/measurement|quantities/i, ['physical quantity', 'unit', 'dimension', 'least count', 'significant figures', 'error', 'vernier caliper', 'scientific notation']]
  ],
  Chemistry: [
    [/atom|atomic|structure/i, ['atom', 'proton', 'neutron', 'electron', 'isotope', 'atomic number', 'mass number', 'electronic configuration']],
    [/periodic|classification|block|group/i, ['period', 'group', 'valence electron', 'atomic radius', 'ionization energy', 'metallic character', 'periodic trend', 'reactivity']],
    [/bond|molecule|structure/i, ['ionic bond', 'covalent bond', 'coordinate bond', 'valency', 'molecule', 'lone pair', 'bond polarity', 'Lewis structure']],
    [/solution|water|liquid|solid|gas/i, ['solution', 'solute', 'solvent', 'concentration', 'saturation', 'gas pressure', 'intermolecular force', 'phase change']],
    [/equilibrium|reactivity/i, ['reversible reaction', 'equilibrium constant', 'forward reaction', 'reverse reaction', 'Le Chatelier principle', 'rate of reaction', 'catalyst', 'dynamic equilibrium']],
    [/acid|base|salt/i, ['acid', 'base', 'salt', 'pH', 'neutralization', 'indicator', 'strong acid', 'weak base']],
    [/organic|hydrocarbon|macro/i, ['alkane', 'alkene', 'alkyne', 'functional group', 'polymer', 'isomerism', 'combustion', 'substitution reaction']],
    [/electrochemistry|industry|atmosphere/i, ['oxidation', 'reduction', 'electrolysis', 'anode', 'cathode', 'industrial process', 'pollutant', 'corrosion']]
  ],
  Math: [
    [/matrix|determinant/i, ['matrix order', 'row', 'column', 'determinant', 'minor', 'cofactor', 'inverse matrix', 'matrix multiplication']],
    [/number|complex/i, ['real number', 'complex number', 'modulus', 'conjugate', 'rational number', 'irrational number', 'number line', 'absolute value']],
    [/logarithm/i, ['logarithm', 'base', 'antilog', 'product rule', 'quotient rule', 'power rule', 'common log', 'natural log']],
    [/equation|quadratic|linear/i, ['variable', 'coefficient', 'root', 'solution set', 'quadratic formula', 'factorization', 'discriminant', 'graph']],
    [/trigonometry|triangle|projection/i, ['sine', 'cosine', 'tangent', 'angle', 'right triangle', 'identity', 'projection', 'trigonometric ratio']],
    [/function|limit|differentiation|integration/i, ['domain', 'range', 'limit', 'derivative', 'integral', 'slope', 'area under curve', 'continuity']],
    [/statistics|probability|permutation|combination/i, ['mean', 'median', 'mode', 'variance', 'event', 'sample space', 'permutation', 'combination']],
    [/geometry|conic|vector|analytic/i, ['coordinate', 'slope', 'distance formula', 'circle', 'parabola', 'vector magnitude', 'dot product', 'line equation']]
  ]
};

const fallbackConcepts = {
  Physics: ['formula', 'unit', 'graph', 'law', 'experiment', 'measurement', 'calculation', 'application'],
  Chemistry: ['definition', 'reaction', 'property', 'formula', 'trend', 'laboratory method', 'example', 'application'],
  Math: ['rule', 'formula', 'method', 'example', 'solution', 'graph', 'calculation', 'proof']
};

const slug = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
};

const getConcepts = (subject, chapter) => {
  const rule = conceptRules[subject].find(([pattern]) => pattern.test(chapter));
  return rule ? rule[1] : fallbackConcepts[subject];
};

const correctAnswerTemplates = {
  Physics: [
    (concept, chapter, index) => `${concept} explains the correct physical relation in ${chapter} case ${index + 1}.`,
    (concept, chapter, index) => `The best answer is to apply ${concept} with proper units in ${chapter} example ${index + 1}.`,
    (concept, chapter, index) => `${concept} is the useful principle for solving this ${chapter} situation ${index + 1}.`,
    (concept, chapter, index) => `This statement correctly links ${concept} with measurement and change in ${chapter} item ${index + 1}.`
  ],
  Chemistry: [
    (concept, chapter, index) => `${concept} correctly describes the matter or reaction idea in ${chapter} case ${index + 1}.`,
    (concept, chapter, index) => `The correct choice applies ${concept} to particles and properties in ${chapter} example ${index + 1}.`,
    (concept, chapter, index) => `${concept} gives the valid chemical explanation for ${chapter} item ${index + 1}.`,
    (concept, chapter, index) => `This answer properly connects ${concept} with composition or change in ${chapter} question ${index + 1}.`
  ],
  Math: [
    (concept, chapter, index) => `Use ${concept} step by step to reach the correct result in ${chapter} question ${index + 1}.`,
    (concept, chapter, index) => `The correct method is to apply ${concept} and verify each step in ${chapter} item ${index + 1}.`,
    (concept, chapter, index) => `${concept} is the rule needed to solve this ${chapter} problem ${index + 1}.`,
    (concept, chapter, index) => `This choice correctly uses ${concept} to complete the ${chapter} calculation ${index + 1}.`
  ]
};

const distractorTemplates = {
  Physics: [
    (concept, chapter, index) => `It ignores the role of ${concept} in ${chapter} situation ${index + 1}.`,
    (concept, chapter, index) => `It treats ${concept} as a constant without checking the ${chapter} data ${index + 1}.`,
    (concept, chapter, index) => `It mixes ${concept} with an unrelated chemistry idea in ${chapter} example ${index + 1}.`
  ],
  Chemistry: [
    (concept, chapter, index) => `It gives a physical measurement only and misses ${concept} in ${chapter} case ${index + 1}.`,
    (concept, chapter, index) => `It says ${concept} has no effect on the ${chapter} reaction or property ${index + 1}.`,
    (concept, chapter, index) => `It changes the given ${chapter} condition instead of explaining ${concept} ${index + 1}.`
  ],
  Math: [
    (concept, chapter, index) => `It skips the rule of ${concept} and guesses the ${chapter} answer ${index + 1}.`,
    (concept, chapter, index) => `It changes the given values before applying ${concept} in ${chapter} problem ${index + 1}.`,
    (concept, chapter, index) => `It uses a diagram only and avoids the needed ${concept} calculation ${index + 1}.`
  ]
};

const buildMcqOptions = ({ subject, chapter, concept, index }) => {
  const correctTemplates = correctAnswerTemplates[subject];
  const wrongTemplates = distractorTemplates[subject];
  const correctAnswer = correctTemplates[index % correctTemplates.length](concept, chapter, index);
  const distractors = wrongTemplates.map((template, offset) => template(concept, chapter, index + offset));
  const options = [...distractors];
  options.splice(index % 4, 0, correctAnswer);
  return { options, correctAnswer };
};

const shortAnswers = {
  Physics: (concept, chapter) => `${concept} is an important quantity or idea in ${chapter} used to describe, measure, or predict physical behavior.`,
  Chemistry: (concept, chapter) => `${concept} is an important idea in ${chapter} used to explain matter, particles, properties, or chemical change.`,
  Math: (concept, chapter) => `${concept} is a mathematical idea in ${chapter} used to form a method, relation, rule, or solution.`
};

const longAnswers = {
  Physics: (concept, chapter) =>
    `Explain the definition of ${concept}, write the related formula or rule where needed, mention units, and show how it is applied in ${chapter} with one example.`,
  Chemistry: (concept, chapter) =>
    `Explain ${concept}, describe its role in ${chapter}, include one reaction, trend, property, or example, and mention any important condition if required.`,
  Math: (concept, chapter) =>
    `State the rule for ${concept}, write the step-by-step method, solve using the given relation, and verify the answer according to ${chapter}.`
};

const mcqTemplates = {
  Physics: [
    (classLevel, chapter, concept) => `In ${classLevel} Physics chapter "${chapter}", which option best describes ${concept}?`,
    (classLevel, chapter, concept) => `While solving a numerical from "${chapter}", what should be checked first for ${concept}?`,
    (classLevel, chapter, concept) => `Which statement is correct about ${concept} in "${chapter}"?`,
    (classLevel, chapter, concept) => `In an experiment related to "${chapter}", why is ${concept} important?`
  ],
  Chemistry: [
    (classLevel, chapter, concept) => `In ${classLevel} Chemistry chapter "${chapter}", which statement about ${concept} is correct?`,
    (classLevel, chapter, concept) => `Which option is most closely related to ${concept} in "${chapter}"?`,
    (classLevel, chapter, concept) => `For "${chapter}", why do students study ${concept}?`,
    (classLevel, chapter, concept) => `Which statement correctly explains the use of ${concept}?`
  ],
  Math: [
    (classLevel, chapter, concept) => `In ${classLevel} Math chapter "${chapter}", what is the correct approach for ${concept}?`,
    (classLevel, chapter, concept) => `Which option is a valid step when using ${concept} in "${chapter}"?`,
    (classLevel, chapter, concept) => `For problems from "${chapter}", why is ${concept} useful?`,
    (classLevel, chapter, concept) => `Which statement is correct about ${concept}?`
  ]
};

const shortTemplates = {
  Physics: [
    (chapter, concept) => `Define ${concept} in the context of "${chapter}".`,
    (chapter, concept) => `Write two key points about ${concept} from "${chapter}".`,
    (chapter, concept) => `State the role of ${concept} in solving questions from "${chapter}".`,
    (chapter, concept) => `Give one daily-life example related to ${concept}.`
  ],
  Chemistry: [
    (chapter, concept) => `Define ${concept} in "${chapter}".`,
    (chapter, concept) => `Write two important points about ${concept}.`,
    (chapter, concept) => `Explain why ${concept} is important in "${chapter}".`,
    (chapter, concept) => `Give one example related to ${concept}.`
  ],
  Math: [
    (chapter, concept) => `Define or state ${concept} in "${chapter}".`,
    (chapter, concept) => `Write the main rule used for ${concept}.`,
    (chapter, concept) => `Mention two steps for solving a question involving ${concept}.`,
    (chapter, concept) => `Give one example where ${concept} is applied.`
  ]
};

const longTemplates = {
  Physics: [
    (chapter, concept) => `Explain ${concept} from "${chapter}" with formula, unit, and one example.`,
    (chapter, concept) => `Describe an experiment or numerical method based on ${concept} in "${chapter}".`,
    (chapter, concept) => `Write a detailed note on ${concept} and its applications in "${chapter}".`,
    (chapter, concept) => `Compare ${concept} with a related idea from "${chapter}" and explain both.`
  ],
  Chemistry: [
    (chapter, concept) => `Explain ${concept} from "${chapter}" with one example and important conditions.`,
    (chapter, concept) => `Write a detailed note on ${concept} and its role in "${chapter}".`,
    (chapter, concept) => `Describe the process, reaction, or trend related to ${concept}.`,
    (chapter, concept) => `Compare ${concept} with a related concept from "${chapter}".`
  ],
  Math: [
    (chapter, concept) => `Solve a detailed question involving ${concept} from "${chapter}" and show all steps.`,
    (chapter, concept) => `Explain the method of ${concept} with a worked example from "${chapter}".`,
    (chapter, concept) => `Prove or verify the main result related to ${concept}.`,
    (chapter, concept) => `Write a detailed solution strategy for questions based on ${concept}.`
  ]
};

const difficultyFor = (index) => ['easy', 'medium', 'hard'][index % 3];

const buildMcq = ({ classLevel, subject, chapter, concept, index }) => {
  const { options, correctAnswer } = buildMcqOptions({ subject, chapter, concept, index });
  return {
    classLevel,
    classId: classLevel,
    subject,
    subjectId: subject,
    chapter,
    chapterId: chapter,
    type: 'mcq',
    question: `MCQ ${index + 1}: ${mcqTemplates[subject][index % mcqTemplates[subject].length](classLevel, chapter, concept)}`,
    options,
    correctAnswer,
    explanation: `The correct option connects ${concept} with the main learning point of ${chapter}.`,
    difficulty: difficultyFor(index),
    marks: 1,
    isImportant: index % 5 === 0,
    tags: [classLevel, subject, chapter, concept]
  };
};

const buildShort = ({ classLevel, subject, chapter, concept, index }) => ({
  classLevel,
  classId: classLevel,
  subject,
  subjectId: subject,
  chapter,
  chapterId: chapter,
  type: 'short',
  question: `Short Question ${index + 1}: ${shortTemplates[subject][index % shortTemplates[subject].length](chapter, concept)}`,
  options: [],
  correctAnswer: shortAnswers[subject](concept, chapter),
  explanation: `A complete short answer should include the key definition and one relevant point about ${concept}.`,
  difficulty: difficultyFor(index),
  marks: index % 2 === 0 ? 2 : 3,
  isImportant: index % 5 === 0,
  tags: [classLevel, subject, chapter, concept]
});

const buildLong = ({ classLevel, subject, chapter, concept, index }) => ({
  classLevel,
  classId: classLevel,
  subject,
  subjectId: subject,
  chapter,
  chapterId: chapter,
  type: 'long',
  question: `Long Question ${index + 1}: ${longTemplates[subject][index % longTemplates[subject].length](chapter, concept)}`,
  options: [],
  correctAnswer: longAnswers[subject](concept, chapter),
  explanation: `A strong long answer should include definition, steps, example, and final conclusion for ${concept}.`,
  difficulty: difficultyFor(index),
  marks: index % 2 === 0 ? 5 : 6,
  isImportant: index % 5 === 0,
  tags: [classLevel, subject, chapter, concept]
});

const buildQuestionsForChapter = (classLevel, subject, chapter) => {
  const concepts = getConcepts(subject, chapter);
  const questions = [];

  for (let index = 0; index < 100; index += 1) {
    const concept = concepts[index % concepts.length];
    const payload = { classLevel, subject, chapter, concept, index };
    questions.push(buildMcq(payload));
  }

  for (let index = 0; index < 50; index += 1) {
    const concept = concepts[index % concepts.length];
    const payload = { classLevel, subject, chapter, concept, index };
    questions.push(buildShort(payload));
  }

  for (let index = 0; index < 20; index += 1) {
    const concept = concepts[index % concepts.length];
    const payload = { classLevel, subject, chapter, concept, index };
    questions.push(buildLong(payload));
  }

  return questions;
};

const writeJson = (file, data) => {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
};

const run = () => {
  if (fs.existsSync(outputRoot)) {
    fs.rmSync(outputRoot, { recursive: true, force: true });
  }

  ensureDir(outputRoot);

  const combined = [];
  const index = [];

  Object.entries(syllabus).forEach(([classLevel, subjects]) => {
    Object.entries(subjects).forEach(([subject, chapters]) => {
      chapters.forEach((chapter) => {
        const questions = buildQuestionsForChapter(classLevel, subject, chapter);
        const chapterDir = path.join(outputRoot, slug(classLevel), slug(subject));
        const file = path.join(chapterDir, `${slug(chapter)}.json`);

        ensureDir(chapterDir);
        writeJson(file, questions);

        combined.push(...questions);
        index.push({
          classLevel,
          subject,
          chapter,
          file: path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/'),
          count: questions.length
        });
      });
    });
  });

  writeJson(combinedFile, combined);
  writeJson(path.join(outputRoot, 'index.json'), {
    totalQuestions: combined.length,
    totalFiles: index.length,
    generatedAt: new Date().toISOString(),
    files: index
  });

  console.log(`Generated ${combined.length} questions in ${index.length} chapter files.`);
  console.log(`Combined import file: ${combinedFile}`);
};

run();
