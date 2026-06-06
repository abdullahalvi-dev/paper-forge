/*
 * Roman Urdu comments:
 * Ye file security constants aur admin trust logic handle karti hai.
 * Super Admin ab hardcoded email se nahi, balkay database role se verify hota hai.
 */

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const isSuperAdminEmail = () => false;

const isTrustedAdmin = (user) =>
  Boolean(
    user?.role === 'super_admin' ||
    (user?.role === 'admin' && user.adminApproved === true)
  );

module.exports = {
  isTrustedAdmin,
  isSuperAdminEmail,
  normalizeEmail
};