/*
 * Roman Urdu comments:
 * Ye file direct question-bank CRUD routes define karti hai.
 * Question listing, create, bulk import, update aur delete ke endpoints yahan available hain.
 */
const express = require('express');
const {
  addQuestion,
  bulkAddQuestions,
  deleteQuestion,
  getQuestionBank,
  updateQuestion
} = require('../controllers/paperController');
const protect = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(protect);
router.get('/', getQuestionBank);
router.post('/', allowRoles('teacher', 'admin'), addQuestion);
router.post('/bulk-json', allowRoles('teacher', 'admin'), bulkAddQuestions);
router.put('/:id', allowRoles('teacher', 'admin'), updateQuestion);
router.delete('/:id', allowRoles('teacher', 'admin'), deleteQuestion);

module.exports = router;
