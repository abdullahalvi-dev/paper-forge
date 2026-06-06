/*
 * Roman Urdu comments:
 * Ye file admin APIs ke routes define karti hai.
 * Dashboard, users, payments, subscriptions, catalog, settings aur analytics endpoints yahan map hotay hain.
 */
const express = require('express');
const {
  adminStats,
  analytics,
  createChapter,
  createClass,
  createSubject,
  deleteCatalog,
  deleteUser,
  downloadReportPdf,
  expireNow,
  getAdminSettings,
  listSubscriptions,
  listUsers,
  listCatalog,
  listChatbotLogs,
  listPaperLogs,
  listPayments,
  manualOverride,
  saveAdminSettings,
  updateCatalog,
  updateSubscription,
  updateUserRole,
  updateUser
} = require('../controllers/adminController');
const { bulkAddQuestions } = require('../controllers/paperController');
const protect = require('../middleware/authMiddleware');
const { authorizeRoles, requireSuperAdmin } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(protect, authorizeRoles('admin'));

router.get('/stats', adminStats);
router.get('/users', listUsers);
router.put('/update-role/:userId', requireSuperAdmin, updateUserRole);
router.patch('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.get('/analytics', analytics);
router.get('/subscriptions', requireSuperAdmin, listSubscriptions);
router.patch('/subscriptions/:id', requireSuperAdmin, updateSubscription);
router.put('/users/:id/subscription', requireSuperAdmin, manualOverride);
router.post('/subscriptions/expire-now', requireSuperAdmin, expireNow);
router.post('/class', createClass);
router.post('/subject', createSubject);
router.post('/chapter', createChapter);
router.get('/catalog', listCatalog);
router.put('/catalog/:id', updateCatalog);
router.delete('/catalog/:id', deleteCatalog);
router.post('/questions/bulk-json', bulkAddQuestions);
router.get('/paper-logs', listPaperLogs);
router.get('/chatbot-logs', listChatbotLogs);
router.get('/payments', requireSuperAdmin, listPayments);
router.get('/reports/pdf', requireSuperAdmin, downloadReportPdf);
router.get('/settings', requireSuperAdmin, getAdminSettings);
router.put('/settings', requireSuperAdmin, saveAdminSettings);

module.exports = router;
