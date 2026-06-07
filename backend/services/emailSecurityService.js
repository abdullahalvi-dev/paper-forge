/*
 * Roman Urdu comments:
 * Ye service registration email ka strict format aur mail receiving domain verify karti hai.
 * MX record check fake/non-existent domains ko account bananay se pehlay reject karta hai.
 */
const dns = require('dns').promises;
const { domainToASCII } = require('url');

const emailPattern =
  /^(?!\.)(?!.*\.\.)[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

const disposableDomains = new Set([
  '10minutemail.com',
  'dispostable.com',
  'guerrillamail.com',
  'mailinator.com',
  'maildrop.cc',
  'sharklasers.com',
  'temp-mail.org',
  'tempmail.com',
  'throwawaymail.com',
  'yopmail.com'
]);

const commonDomainTypos = new Map([
  ['gamil.com', 'gmail.com'],
  ['gmai.com', 'gmail.com'],
  ['gmail.co', 'gmail.com'],
  ['gmial.com', 'gmail.com'],
  ['hotmai.com', 'hotmail.com'],
  ['hotmal.com', 'hotmail.com'],
  ['outlok.com', 'outlook.com'],
  ['yaho.com', 'yahoo.com'],
  ['yahooo.com', 'yahoo.com']
]);

const createValidationError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const createMxTimeoutError = () => {
  const error = createValidationError('Email domain verification timed out.', 503);
  error.code = 'MX_TIMEOUT';
  return error;
};

const normalizeStrictEmail = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  const atIndex = normalized.lastIndexOf('@');
  if (atIndex <= 0) return normalized;

  const localPart = normalized.slice(0, atIndex);
  const asciiDomain = domainToASCII(normalized.slice(atIndex + 1));
  return `${localPart}@${asciiDomain}`;
};

const validateEmailFormat = (value) => {
  const email = normalizeStrictEmail(value);
  if (!email || email.length > 254 || !emailPattern.test(email)) {
    throw createValidationError('Please enter a valid official email address.');
  }

  const domain = email.slice(email.lastIndexOf('@') + 1);
  if (disposableDomains.has(domain)) {
    throw createValidationError('Temporary or disposable email addresses are not allowed.');
  }
  if (commonDomainTypos.has(domain)) {
    throw createValidationError(`Email domain looks incorrect. Did you mean ${commonDomainTypos.get(domain)}?`);
  }

  return { email, domain };
};

const isProductionRuntime = () =>
  process.env.NODE_ENV === 'production' ||
  process.env.VERCEL === '1' ||
  ['production', 'preview'].includes(String(process.env.VERCEL_ENV || '').toLowerCase());
const canSkipDomainCheck = () => !isProductionRuntime() && process.env.SKIP_EMAIL_DOMAIN_CHECK === 'true';

const assertEmailCanReceiveMail = async (value) => {
  const result = validateEmailFormat(value);
  if (canSkipDomainCheck()) return result;

  try {
    const mxRecords = await Promise.race([
      dns.resolveMx(result.domain),
      new Promise((_, reject) =>
        setTimeout(() => reject(createMxTimeoutError()), 5000)
      )
    ]);

    if (!Array.isArray(mxRecords) || !mxRecords.some((record) => String(record.exchange || '').trim())) {
      throw createValidationError('This email domain cannot receive email. Please use an official email address.');
    }
  } catch (error) {
    if (error.code === 'MX_TIMEOUT') {
      return result;
    }
    if (error.statusCode) throw error;
    if (['ENODATA', 'ENOTFOUND', 'ESERVFAIL', 'EREFUSED'].includes(error.code)) {
      throw createValidationError('This email domain cannot receive email. Please use an official email address.');
    }
    throw createValidationError('Email domain could not be verified. Please try again.', 503);
  }

  return result;
};

module.exports = {
  assertEmailCanReceiveMail,
  normalizeStrictEmail,
  validateEmailFormat
};
