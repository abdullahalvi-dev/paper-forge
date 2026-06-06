/*
 * Roman Urdu comments:
 * Ye file teacher dashboard routes define karti hai.
 * Teacher role ke liye dashboard summary aur activity data endpoint yahan map hota hai.
 */
const express = require('express');
const { teacherStats } = require('../controllers/teacherController');
const protect = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(protect, allowRoles('teacher', 'admin'));

router.get('/stats', teacherStats);

module.exports = router;
