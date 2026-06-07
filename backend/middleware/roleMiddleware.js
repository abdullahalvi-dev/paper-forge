/*
 * Roman Urdu comments:
 * Ye middleware role-based access control handle karta hai.
 * Allowed roles ke ilawa user ko protected admin/teacher/student action perform nahi karne deta.
 */
const { isSuperAdmin, isTrustedAdmin } = require('../config/security');

const authorizeRoles = (...allowedRoles) => (req, res, next) => {
  const hasAllowedRole =
    req.user &&
    (allowedRoles.includes(req.user.role) || (isSuperAdmin(req.user) && allowedRoles.includes('admin')));

  if (!hasAllowedRole) {
    return res.status(403).json({ message: 'You do not have permission for this action' });
  }
  if ((req.user.role === 'admin' || isSuperAdmin(req.user)) && allowedRoles.includes('admin') && !isTrustedAdmin(req.user)) {
    return res.status(403).json({ message: 'Admin access is not approved by the super admin' });
  }

  next();
};

const requireSuperAdmin = (req, res, next) => {
  if (!req.user || !isSuperAdmin(req.user)) {
    return res.status(403).json({ message: 'Only the super admin can perform this action' });
  }

  next();
};

module.exports = authorizeRoles;
module.exports.authorizeRoles = authorizeRoles;
module.exports.allowRoles = authorizeRoles;
module.exports.requireSuperAdmin = requireSuperAdmin;
