/*
 * Roman Urdu comments:
 * Ye file student practice routes define karti hai.
 * Practice paper create karna, attempt submit karna aur practice history fetch karna yahan map hota hai.
 */
const express = require('express');
const {
  generatePractice,
  getMcqPracticePool,
  submitPractice
} = require('../controllers/studentController');
const protect = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(protect, allowRoles('student', 'admin'));

router.get('/mcq', getMcqPracticePool);
router.post('/generate', generatePractice);
router.post('/submit', (req, res, next) => {
  req.params.id = req.body.practiceId;
  return submitPractice(req, res, next);
});
router.post('/:id/submit', submitPractice);

module.exports = router;
