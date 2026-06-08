/*
 * Roman Urdu comments:
 * Ye service OTP aur reset email SMTP ke zariye send karti hai.
 * External email API remove kar di gayi hai; ab sirf Nodemailer SMTP transporter use hota hai.
 * Production mein SMTP settings missing hon to OTP code expose nahi hota aur request fail hoti hai.
 */
const nodemailer = require('nodemailer');

const isProductionRuntime = () =>
  process.env.NODE_ENV === 'production' ||
  process.env.VERCEL === '1' ||
  ['production', 'preview'].includes(String(process.env.VERCEL_ENV || '').toLowerCase());
const canExposeDevelopmentCode = () =>
  !isProductionRuntime() && process.env.ALLOW_DEV_EMAIL_CODES === 'true';

const firstEnv = (...keys) =>
  keys.map((key) => process.env[key]).find((value) => String(value || '').trim());

const getSmtpConfig = () => {
  const user = firstEnv('SMTP_USER', 'EMAIL_SERVER_USER', 'MAIL_USER', 'MAIL_USERNAME', 'GMAIL_USER');
  const pass = firstEnv(
    'SMTP_PASS',
    'SMTP_PASSWORD',
    'EMAIL_SERVER_PASSWORD',
    'MAIL_PASS',
    'MAIL_PASSWORD',
    'GMAIL_APP_PASSWORD'
  );
  let host = firstEnv('SMTP_HOST', 'EMAIL_SERVER_HOST', 'MAIL_HOST');
  let port = Number(firstEnv('SMTP_PORT', 'EMAIL_SERVER_PORT', 'MAIL_PORT') || 587);

  // Roman Urdu: Gmail user diya ho aur host missing ho to Gmail SMTP auto-set ho jata hai.
  if (!host && user && /@gmail\.com$/i.test(user)) {
    host = 'smtp.gmail.com';
    port = 465;
  }

  return {
    host,
    port,
    secure:
      String(firstEnv('SMTP_SECURE', 'EMAIL_SERVER_SECURE', 'MAIL_SECURE') || '').toLowerCase() ===
        'true' || port === 465,
    user,
    pass,
    from:
      firstEnv('SMTP_FROM', 'EMAIL_FROM', 'MAIL_FROM') ||
      (user ? `Paper Forge <${user}>` : 'Paper Forge <no-reply@paperforge.local>')
  };
};

const hasSmtpConfig = () => {
  const config = getSmtpConfig();
  return Boolean(config.host && config.user && config.pass && config.from);
};

const createTransport = () => {
  const config = getSmtpConfig();
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass
    },
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 20000
  });
};

const createEmailConfigError = () => {
  const error = new Error(
    'Email verification is not configured. Add valid SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM in Vercel Environment Variables, then redeploy.'
  );
  error.statusCode = 503;
  error.code = 'EMAIL_CONFIG_MISSING';
  return error;
};

const createDeliveryError = (message, code = 'EMAIL_DELIVERY_FAILED', statusCode = 502) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const getSmtpDeliveryError = (error) => {
  const responseCode = Number(error.responseCode || 0);
  const message = String(error.message || '');
  const isAuthError = error.code === 'EAUTH' || responseCode === 535 || /invalid login|auth/i.test(message);

  if (isAuthError) {
    return createDeliveryError(
      'SMTP authentication failed. Please check SMTP_USER and SMTP_PASS exactly as provided by your email provider.',
      'SMTP_AUTH_FAILED',
      502
    );
  }

  if (['ETIMEDOUT', 'ECONNECTION', 'ESOCKET'].includes(error.code)) {
    return createDeliveryError(
      'SMTP server connection failed. Please check SMTP_HOST, SMTP_PORT, SMTP_SECURE and whether your provider allows SMTP from Vercel.',
      'SMTP_CONNECTION_FAILED',
      502
    );
  }

  return createDeliveryError(
    'Verification email could not be sent through SMTP. Please check SMTP settings and try again.',
    'EMAIL_DELIVERY_FAILED',
    502
  );
};

const sendWithSmtp = async ({ to, subject, text, html }) => {
  const config = getSmtpConfig();
  const transport = createTransport();

  try {
    const result = await transport.sendMail({
      from: config.from,
      to,
      subject,
      text,
      html
    });
    return {
      delivered: true,
      provider: 'smtp',
      messageId: result.messageId || null
    };
  } catch (error) {
    console.error('[EMAIL_SEND_FAILED]', {
      provider: 'smtp',
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.user,
      code: error.code,
      command: error.command,
      responseCode: error.responseCode,
      message: error.message
    });
    throw getSmtpDeliveryError(error);
  }
};

const sendCodeEmail = async ({ to, code, subject, text, html }) => {
  if (hasSmtpConfig()) {
    return sendWithSmtp({ to, subject, text, html });
  }
  if (!canExposeDevelopmentCode()) {
    throw createEmailConfigError();
  }

  console.log(`[DEV EMAIL] To: ${to} | ${subject} | ${text}`);
  return {
    delivered: false,
    devCode: code,
    provider: 'development'
  };
};

const sendResetPin = async (to, pin) => {
  const subject = 'Paper Forge password reset PIN';
  const text = `Your Paper Forge password reset PIN is ${pin}. It is valid for 10 minutes.`;
  const delivery = await sendCodeEmail({ to, code: pin, subject, text });
  return { ...delivery, devPin: delivery.devCode };
};

const sendRegistrationCode = (to, code, ttlMinutes) => {
  const subject = 'Verify your Paper Forge email';
  const text = `Your Paper Forge verification code is ${code}. It expires in ${ttlMinutes} minutes. If you did not request this account, ignore this email.`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#172033">
      <h2 style="color:#ff6200">Verify your Paper Forge email</h2>
      <p>Use this code to complete your account registration:</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:24px 0">${code}</p>
      <p>This code expires in ${ttlMinutes} minutes. Never share it with anyone.</p>
      <p style="color:#667085">If you did not request this account, you can safely ignore this email.</p>
    </div>
  `;
  return sendCodeEmail({ to, code, subject, text, html });
};

module.exports = {
  hasSmtpConfig,
  sendRegistrationCode,
  sendResetPin
};
