/*
 * Roman Urdu comments:
 * Ye service email sending handle karti hai.
 * Password reset aur registration verification codes ke liye SMTP transporter banata hai.
 * Production mein SMTP missing ho to code response mein expose nahi hota aur request fail hoti hai.
 */
const nodemailer = require('nodemailer');

const isProductionRuntime = () =>
  process.env.NODE_ENV === 'production' ||
  process.env.VERCEL === '1' ||
  ['production', 'preview'].includes(String(process.env.VERCEL_ENV || '').toLowerCase());
const canExposeDevelopmentCode = () =>
  !isProductionRuntime() && process.env.ALLOW_DEV_EMAIL_CODES === 'true';

const firstEnv = (...keys) => keys.map((key) => process.env[key]).find((value) => String(value || '').trim());

const getSmtpConfig = () => {
  const user = firstEnv('SMTP_USER', 'EMAIL_SERVER_USER', 'MAIL_USER', 'MAIL_USERNAME', 'GMAIL_USER');
  const pass = firstEnv('SMTP_PASS', 'SMTP_PASSWORD', 'EMAIL_SERVER_PASSWORD', 'MAIL_PASS', 'MAIL_PASSWORD', 'GMAIL_APP_PASSWORD');
  let host = firstEnv('SMTP_HOST', 'EMAIL_SERVER_HOST', 'MAIL_HOST');
  let port = Number(firstEnv('SMTP_PORT', 'EMAIL_SERVER_PORT', 'MAIL_PORT') || 587);

  if (!host && user && /@gmail\.com$/i.test(user)) {
    host = 'smtp.gmail.com';
    port = 465;
  }

  return {
    host,
    port,
    secure: String(firstEnv('SMTP_SECURE', 'EMAIL_SERVER_SECURE', 'MAIL_SECURE') || '').toLowerCase() === 'true' || port === 465,
    user,
    pass,
    from: firstEnv('SMTP_FROM', 'EMAIL_FROM', 'MAIL_FROM') || 'Paper Forge <no-reply@paperforge.local>'
  };
};

const hasSmtpConfig = () => {
  const config = getSmtpConfig();
  return Boolean(config.host && config.user && config.pass);
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
    }
  });
};

const createEmailConfigError = () => {
  const error = new Error(
    'Email verification is not configured. Add SMTP_HOST, SMTP_USER and SMTP_PASS in Vercel Environment Variables, then redeploy.'
  );
  error.statusCode = 503;
  return error;
};

const sendCodeEmail = async ({ to, code, subject, text, html }) => {
  if (!hasSmtpConfig()) {
    if (!canExposeDevelopmentCode()) {
      throw createEmailConfigError();
    }
    console.log(`[DEV EMAIL] To: ${to} | ${subject} | ${text}`);
    return { delivered: false, devCode: code };
  }

  const config = getSmtpConfig();
  const transport = createTransport();
  try {
    await transport.sendMail({
      from: config.from,
      to,
      subject,
      text,
      html
    });
  } catch (error) {
    console.error('[EMAIL_SEND_FAILED]', {
      code: error.code,
      command: error.command,
      responseCode: error.responseCode,
      message: error.message
    });
    const deliveryError = new Error('Verification email could not be sent. Please check SMTP settings and try again.');
    deliveryError.statusCode = 502;
    throw deliveryError;
  }

  return { delivered: true };
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
  sendRegistrationCode,
  sendResetPin
};
