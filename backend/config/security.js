/*
 * Roman Urdu comments:
 * Ye file security constants rakhti hai.
 * Super admin email yahin se verify hoti hai taake admin role sirf trusted account ko mil sake.
 */
const SUPER_ADMIN_EMAIL = 'aalvi8494@gmail.com';

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const isSuperAdminEmail = (email) => normalizeEmail(email) === SUPER_ADMIN_EMAIL;
const isTrustedAdmin = (user) =>
  Boolean(user?.role === 'admin' && (isSuperAdminEmail(user.email) || user.adminApproved === true));

module.exports = {
  SUPER_ADMIN_EMAIL,
  isTrustedAdmin,
  isSuperAdminEmail,
  normalizeEmail
};
