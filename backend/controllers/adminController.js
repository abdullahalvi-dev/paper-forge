/*
 * Roman Urdu comments:
 * Ye controller admin dashboard ki core functionality handle karta hai.
 * Is mein users, payments, subscriptions, paper logs, catalog, settings, analytics aur bulk question import ke responses bante hain.
 */
const PDFDocument = require('pdfkit');
const Paper = require('../models/Paper');
const Practice = require('../models/Practice');
const Question = require('../models/Question');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const Catalog = require('../models/Catalog');
const PaperLog = require('../models/PaperLog');
const PaymentTransaction = require('../models/PaymentTransaction');
const ChatbotLog = require('../models/ChatbotLog');
const { manualOverride, expireNow } = require('./subscriptionController');
const { getSettings, updateSettings } = require('../services/settingsService');
const { isSuperAdminEmail } = require('../config/security');

const collectPdfBuffer = (doc) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

const money = (value) => `PKR ${Number(value || 0).toLocaleString()}`;
const label = (value, fallback = '-') =>
  String(value || fallback)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const shortDate = (value) => (value ? new Date(value).toLocaleDateString() : 'No date');
const personName = (user, fallback = 'System record') => user?.name || user?.email || fallback;
const allowedUserRoles = ['student', 'teacher', 'admin'];
const normalizeRole = (role) => String(role || '').trim().toLowerCase();

const applyUserRoleChange = async ({ actor, targetUserId, role }) => {
  const normalizedRole = normalizeRole(role);

  if (!allowedUserRoles.includes(normalizedRole)) {
    const error = new Error('Role must be student, teacher, or admin');
    error.statusCode = 400;
    throw error;
  }
  if (!isSuperAdminEmail(actor.email)) {
    const error = new Error('Only the super admin can change user roles');
    error.statusCode = 403;
    throw error;
  }
  if (String(actor._id) === String(targetUserId)) {
    const error = new Error('Super admin own role is locked');
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findById(targetUserId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }
  if (isSuperAdminEmail(user.email) && normalizedRole !== 'admin') {
    const error = new Error('Super admin role cannot be downgraded');
    error.statusCode = 403;
    throw error;
  }

  user.role = normalizedRole;
  user.adminApproved = normalizedRole === 'admin';
  user.roleAssignedBy = actor._id;
  user.roleAssignedAt = new Date();
  await user.save();

  return user;
};

const buildAdminReport = async () => {
  const [
    totalUsers,
    activeUsers,
    papers,
    questions,
    practices,
    subscriptions,
    succeededPayments,
    paperBySubject,
    practiceBySubject,
    userByRole,
    recentPayments,
    recentPaperLogs
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ status: 'active' }),
    Paper.countDocuments(),
    Question.countDocuments(),
    Practice.countDocuments(),
    Subscription.find().populate('userId', 'name email role subscription'),
    PaymentTransaction.find({ status: 'succeeded' }),
    Paper.aggregate([{ $group: { _id: '$subject', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Practice.aggregate([{ $group: { _id: '$filters.subject', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    PaymentTransaction.find().sort({ createdAt: -1 }).limit(50).populate('userId', 'name email role'),
    PaperLog.find().sort({ createdAt: -1 }).limit(50).populate('userId', 'name email role')
  ]);

  const proUsers = subscriptions.filter((subscription) => subscription.status === 'active').length;
  const revenue = succeededPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  return {
    generatedAt: new Date(),
    stats: {
      totalUsers,
      activeUsers,
      papers,
      questions,
      practices,
      proUsers,
      revenue
    },
    analytics: {
      paperBySubject,
      practiceBySubject,
      userByRole
    },
    recentPayments,
    recentPaperLogs
  };
};

const adminStats = async (req, res, next) => {
  try {
    const canViewFinance = isSuperAdminEmail(req.user.email);
    const [totalUsers, activeUsers, papers, questions, practices] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: 'active' }),
      Paper.countDocuments(),
      Question.countDocuments(),
      Practice.countDocuments()
    ]);

    const [subscriptions, payments] = canViewFinance
      ? await Promise.all([Subscription.find().populate('userId', 'name email role subscription'), PaymentTransaction.find({ status: 'succeeded' })])
      : [[], []];
    const proUsers = canViewFinance ? subscriptions.filter((subscription) => subscription.status === 'active').length : 0;
    const revenue = canViewFinance ? payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0) : 0;

    res.json({
      stats: {
        totalUsers,
        activeUsers,
        papers,
        questions,
        practices,
        proUsers,
        revenue
      }
    });
  } catch (error) {
    next(error);
  }
};

const listUsers = async (req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ users });
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    if (req.body.role) {
      const user = await applyUserRoleChange({
        actor: req.user,
        targetUserId: req.params.id,
        role: req.body.role
      });
      return res.json({ message: 'User role updated', user });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (req.body.status) user.status = req.body.status;
    if (req.body.subscription) user.subscription = req.body.subscription;

    await user.save();
    res.json({ user });
  } catch (error) {
    next(error);
  }
};

const updateUserRole = async (req, res, next) => {
  try {
    const user = await applyUserRoleChange({
      actor: req.user,
      targetUserId: req.params.userId,
      role: req.body.role
    });
    res.json({ message: 'User role updated', user });
  } catch (error) {
    next(error);
  }
};

const analytics = async (req, res, next) => {
  try {
    const [paperBySubject, practiceBySubject, userByRole] = await Promise.all([
      Paper.aggregate([{ $group: { _id: '$subject', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Practice.aggregate([{ $group: { _id: '$filters.subject', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }])
    ]);

    res.json({
      analytics: {
        paperBySubject,
        practiceBySubject,
        userByRole
      }
    });
  } catch (error) {
    next(error);
  }
};

const listSubscriptions = async (req, res, next) => {
  try {
    const subscriptions = await Subscription.find().populate('userId', 'name email role status subscription');
    res.json({ subscriptions });
  } catch (error) {
    next(error);
  }
};

const updateSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findById(req.params.id);
    if (!subscription) return res.status(404).json({ message: 'Subscription not found' });

    if (req.body.plan) subscription.plan = req.body.plan;
    if (req.body.status) subscription.status = req.body.status;
    if (req.body.expiryDate !== undefined) {
      subscription.expiryDate = req.body.expiryDate ? new Date(req.body.expiryDate) : undefined;
    }

    await subscription.save();
    await User.findByIdAndUpdate(subscription.userId, { subscription: subscription.plan });

    res.json({ subscription });
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    await user.deleteOne();
    res.json({ message: 'User deleted' });
  } catch (error) {
    next(error);
  }
};

const createCatalog = (kind) => async (req, res, next) => {
  try {
    const item = await Catalog.create({
      kind,
      name: req.body.name,
      classLevel: req.body.classLevel,
      subject: req.body.subject,
      parentId: req.body.parentId,
      createdBy: req.user._id
    });
    res.status(201).json({ item });
  } catch (error) {
    next(error);
  }
};

const listCatalog = async (req, res, next) => {
  try {
    const query = {};
    if (req.query.kind) query.kind = req.query.kind;
    if (req.query.classLevel) query.classLevel = req.query.classLevel;
    if (req.query.subject) query.subject = req.query.subject;
    const items = await Catalog.find(query).sort({ kind: 1, name: 1 });
    res.json({ items });
  } catch (error) {
    next(error);
  }
};

const updateCatalog = async (req, res, next) => {
  try {
    const item = await Catalog.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Catalog item not found' });

    ['name', 'classLevel', 'subject', 'parentId'].forEach((field) => {
      if (req.body[field] !== undefined) item[field] = req.body[field];
    });

    await item.save();
    res.json({ item });
  } catch (error) {
    next(error);
  }
};

const deleteCatalog = async (req, res, next) => {
  try {
    const item = await Catalog.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Catalog item not found' });
    await item.deleteOne();
    res.json({ message: 'Catalog item deleted' });
  } catch (error) {
    next(error);
  }
};

const listPaperLogs = async (req, res, next) => {
  try {
    const logs = await PaperLog.find().sort({ createdAt: -1 }).limit(200).populate('userId', 'name email role');
    res.json({ logs });
  } catch (error) {
    next(error);
  }
};

const listChatbotLogs = async (req, res, next) => {
  try {
    const logs = await ChatbotLog.find().sort({ createdAt: -1 }).limit(300).populate('userId', 'name email role');
    res.json({ logs });
  } catch (error) {
    next(error);
  }
};

const listPayments = async (req, res, next) => {
  try {
    const payments = await PaymentTransaction.find().sort({ createdAt: -1 }).populate('userId', 'name email role');
    res.json({ payments });
  } catch (error) {
    next(error);
  }
};

const getAdminSettings = async (req, res, next) => {
  try {
    res.json({ settings: await getSettings() });
  } catch (error) {
    next(error);
  }
};

const saveAdminSettings = async (req, res, next) => {
  try {
    res.json({ settings: await updateSettings(req.body) });
  } catch (error) {
    next(error);
  }
};

const downloadReportPdf = async (req, res, next) => {
  try {
    const report = await buildAdminReport();
    const doc = new PDFDocument({ margin: 42, size: 'A4' });
    const bufferPromise = collectPdfBuffer(doc);

    const drawSection = (title) => {
      doc.moveDown(0.8);
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#101828').text(title);
      doc.moveDown(0.35);
      doc.moveTo(doc.x, doc.y).lineTo(553, doc.y).strokeColor('#e6ebf2').stroke();
      doc.moveDown(0.55);
    };

    const row = (left, right) => {
      if (doc.y > 740) doc.addPage();
      const y = doc.y;
      doc.font('Helvetica').fontSize(10).fillColor('#344054').text(left, 48, y, { width: 345 });
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#101828').text(right, 405, y, { width: 140, align: 'right' });
      doc.moveDown(0.45);
    };

    doc.font('Helvetica-Bold').fontSize(20).fillColor('#101828').text('Paper Forge Admin Report', { align: 'center' });
    doc.font('Helvetica').fontSize(10).fillColor('#667085').text(`Generated: ${shortDate(report.generatedAt)}`, { align: 'center' });
    doc.moveDown(1);

    drawSection('Platform Summary');
    row('Total users', String(report.stats.totalUsers));
    row('Active users', String(report.stats.activeUsers));
    row('Active subscriptions', String(report.stats.proUsers));
    row('Successful revenue', money(report.stats.revenue));
    row('Generated papers', String(report.stats.papers));
    row('Practice sessions', String(report.stats.practices));
    row('Question bank items', String(report.stats.questions));

    drawSection('Papers by Subject');
    if (report.analytics.paperBySubject.length) {
      report.analytics.paperBySubject.forEach((item) => row(item._id || 'Unknown', String(item.count)));
    } else {
      row('No paper activity', '0');
    }

    drawSection('Practice by Subject');
    if (report.analytics.practiceBySubject.length) {
      report.analytics.practiceBySubject.forEach((item) => row(item._id || 'Unknown', String(item.count)));
    } else {
      row('No practice activity', '0');
    }

    drawSection('User Roles');
    report.analytics.userByRole.forEach((item) => row(label(item._id, 'Unknown'), String(item.count)));

    doc.addPage();
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#101828').text('Recent Payments');
    doc.moveDown(0.7);
    if (report.recentPayments.length) {
      report.recentPayments.slice(0, 20).forEach((payment) => {
        row(
          `${personName(payment.userId, 'Guest payment')} | ${label(payment.provider, 'Manual')} / ${label(payment.plan, 'Plan')} | ${label(payment.status, 'Recorded')}`,
          money(payment.amount)
        );
      });
    } else {
      row('No recent payments', '0');
    }

    drawSection('Recent Paper Logs');
    if (report.recentPaperLogs.length) {
      report.recentPaperLogs.slice(0, 24).forEach((log) => {
        row(
          `${log.subject || 'Paper'} | ${personName(log.userId, 'Teacher record')} | ${label(log.mode, 'Mode')}`,
          shortDate(log.createdAt)
        );
      });
    } else {
      row('No recent paper logs', '0');
    }

    doc.end();
    const buffer = await bufferPromise;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="paper-forge-admin-report.pdf"',
      'Content-Length': buffer.length
    });
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  adminStats,
  listUsers,
  updateUserRole,
  updateUser,
  deleteUser,
  analytics,
  listSubscriptions,
  updateSubscription,
  manualOverride,
  expireNow,
  createClass: createCatalog('class'),
  createSubject: createCatalog('subject'),
  createChapter: createCatalog('chapter'),
  listCatalog,
  updateCatalog,
  deleteCatalog,
  listPaperLogs,
  listChatbotLogs,
  listPayments,
  downloadReportPdf,
  getAdminSettings,
  saveAdminSettings
};
