/*
 * Roman Urdu comments:
 * Ye file student dashboard routes define karti hai.
 * Student role ke liye dashboard summary aur related data endpoint yahan map hota hai.
 */
const express = require('express');
const {
  generatePractice,
  getMcqPracticePool,
  getPractice,
  practiceHistory,
  studentStats,
  submitPractice
} = require('../controllers/studentController');
const protect = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(protect, allowRoles('student', 'admin'));

router.get('/stats', studentStats);
router.get('/practice/mcq', getMcqPracticePool);
router.get('/practice/history', practiceHistory);
router.post('/practice/generate', generatePractice);
router.get('/practice/:id', getPractice);
router.post('/practice/:id/submit', submitPractice);

module.exports = router;
