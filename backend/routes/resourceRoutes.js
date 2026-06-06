/*
 * Roman Urdu comments:
 * Ye file resources/PDF upload routes define karti hai.
 * Multer upload middleware ke through files save hoti hain aur resource APIs protected roles ke sath chalti hain.
 */
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { createResource, deleteResource, listResources, uploadDir } = require('../controllers/resourceController');
const protect = require('../middleware/authMiddleware');
const allowRoles = require('../middleware/roleMiddleware');

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '-');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf' && path.extname(file.originalname).toLowerCase() !== '.pdf') {
      return cb(new Error('Only PDF files are allowed'));
    }
    cb(null, true);
  },
  limits: { fileSize: 20 * 1024 * 1024 }
});

const router = express.Router();

router.use(protect);
router.get('/past-papers', (req, res, next) => {
  req.query.type = 'past-paper';
  return listResources(req, res, next);
});
router.get('/books', (req, res, next) => {
  req.query.type = 'book';
  return listResources(req, res, next);
});
router.get('/', listResources);
router.post('/past-papers', allowRoles('admin', 'teacher'), upload.single('file'), createResource);
router.post('/', allowRoles('admin', 'teacher'), upload.single('file'), createResource);
router.delete('/:id', allowRoles('admin', 'teacher'), deleteResource);

module.exports = router;
