/*
 * Roman Urdu comments:
 * Ye middleware role-based access control handle karta hai.
 * Allowed roles ke ilawa user ko protected admin/teacher/student action perform nahi karne deta.
 */
const { isSuperAdminEmail, isTrustedAdmin } = require('../config/security');

const authorizeRoles = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: 'You do not have permission for this action' });
  }
  if (req.user.role === 'admin' && allowedRoles.includes('admin') && !isTrustedAdmin(req.user)) {
    return res.status(403).json({ message: 'Admin access is not approved by the super admin' });
  }

  next();
};

const requireSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin' || !isSuperAdminEmail(req.user.email)) {
    return res.status(403).json({ message: 'Only the super admin can perform this action' });
  }

  next();
};

module.exports = authorizeRoles;
module.exports.authorizeRoles = authorizeRoles;
module.exports.allowRoles = authorizeRoles;
module.exports.requireSuperAdmin = requireSuperAdmin;
