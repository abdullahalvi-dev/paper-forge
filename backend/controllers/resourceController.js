/*
 * Roman Urdu comments:
 * Ye controller learning resources upload aur listing handle karta hai.
 * Teacher/admin PDF upload kar sakte hain aur users available resources fetch kar sakte hain.
 */
const path = require('path');
const fs = require('fs');
const Resource = require('../models/Resource');

const uploadDir = path.join(__dirname, '..', 'uploads', 'resources');

const ensureUploadDir = () => {
  fs.mkdirSync(uploadDir, { recursive: true });
};

const listResources = async (req, res, next) => {
  try {
    const query = {};
    if (req.query.type) query.type = req.query.type;
    if (req.query.classLevel) query.classLevel = req.query.classLevel;
    if (req.query.subject) query.subject = req.query.subject;
    const resources = await Resource.find(query).sort({ createdAt: -1 }).populate('uploadedBy', 'name email role');
    res.json({ resources });
  } catch (error) {
    next(error);
  }
};

const createResource = async (req, res, next) => {
  try {
    ensureUploadDir();
    const fileUrl = req.file ? `/uploads/resources/${req.file.filename}` : req.body.fileUrl;
    if (!fileUrl) return res.status(400).json({ message: 'PDF file or fileUrl is required' });

    const resource = await Resource.create({
      title: req.body.title,
      type: req.body.type || 'past-paper',
      classLevel: req.body.classLevel,
      subject: req.body.subject,
      chapter: req.body.chapter,
      fileUrl,
      fileName: req.file?.originalname || req.body.fileName || '',
      uploadedBy: req.user._id
    });

    res.status(201).json({ resource });
  } catch (error) {
    next(error);
  }
};

const deleteResource = async (req, res, next) => {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) return res.status(404).json({ message: 'Resource not found' });
    await resource.deleteOne();
    res.json({ message: 'Resource deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createResource,
  deleteResource,
  listResources,
  uploadDir
};
