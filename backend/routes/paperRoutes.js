/*
 * Roman Urdu comments:
 * Ye file paper generation aur question-bank routes define karti hai.
 * Teacher/admin paper create, list, preview, download aur question APIs yahan protected routes ke sath map hoti hain.
 */
const express = require('express');
const {
  addQuestion,
  bulkAddQuestions,
  createPaper,
  deletePaper,
  downloadPaper,
  generatePaper,
  getPaper,
  getQuestionBank,
  listPapers,
  printPaper,
  updatePaper
} = require('../controllers/paperController');
const protect = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(protect);

router.get('/questions', allowRoles('teacher', 'admin'), getQuestionBank);
router.post('/questions', allowRoles('teacher', 'admin'), addQuestion);
router.post('/questions/bulk', allowRoles('teacher', 'admin'), bulkAddQuestions);

router.post('/generate', allowRoles('teacher', 'student', 'admin'), generatePaper);
router.route('/').get(allowRoles('teacher', 'student', 'admin'), listPapers).post(allowRoles('teacher'), createPaper);
router
  .route('/:id')
  .get(allowRoles('teacher', 'student', 'admin'), getPaper)
  .put(allowRoles('teacher', 'admin'), updatePaper)
  .delete(allowRoles('teacher', 'admin'), deletePaper);
router.get('/:id/download/:format', allowRoles('teacher', 'student', 'admin'), downloadPaper);
router.get('/:id/print', allowRoles('teacher', 'student', 'admin'), printPaper);

module.exports = router;
