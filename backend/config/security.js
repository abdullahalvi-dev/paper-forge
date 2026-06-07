/*
 * Roman Urdu comments:
 * Ye file security constants aur admin trust logic handle karti hai.
 * Super Admin ab hardcoded email se nahi, balkay database role se verify hota hai.
 */

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const normalizeRole = (value) => String(value || '').trim().toLowerCase();

const superAdminEmails = () =>
  String(process.env.SUPER_ADMIN_EMAILS || process.env.SUPER_ADMIN_EMAIL || '')
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean);

const isSuperAdminEmail = (value) => {
  const emails = superAdminEmails();
  if (!emails.length) return false;
  return emails.includes(normalizeEmail(value));
};

const isSuperAdmin = (user) => normalizeRole(user?.role) === 'super_admin';

const isTrustedAdmin = (user) =>
  Boolean(
    isSuperAdmin(user) ||
    (normalizeRole(user?.role) === 'admin' && user.adminApproved === true)
  );

module.exports = {
  isSuperAdmin,
  isTrustedAdmin,
  isSuperAdminEmail,
  normalizeRole,
  normalizeEmail
};
