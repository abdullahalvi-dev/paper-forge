/*
 * Roman Urdu comments:
 * Ye service email sending handle karti hai.
 * Password reset aur registration verification codes ke liye SMTP transporter banata hai.
 * Production mein SMTP missing ho to code response mein expose nahi hota aur request fail hoti hai.
 */
const nodemailer = require('nodemailer');

const hasSmtpConfig = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
const isProductionRuntime = () =>
  process.env.NODE_ENV === 'production' ||
  process.env.VERCEL === '1' ||
  ['production', 'preview'].includes(String(process.env.VERCEL_ENV || '').toLowerCase());
const canExposeDevelopmentCode = () =>
  !isProductionRuntime() && process.env.ALLOW_DEV_EMAIL_CODES === 'true';

const createTransport = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

const sendCodeEmail = async ({ to, code, subject, text, html }) => {
  if (!hasSmtpConfig()) {
    if (!canExposeDevelopmentCode()) {
      const error = new Error('Email service is not configured. Please contact support.');
      error.statusCode = 503;
      throw error;
    }
    console.log(`[DEV EMAIL] To: ${to} | ${subject} | ${text}`);
    return { delivered: false, devCode: code };
  }

  const transport = createTransport();
  await transport.sendMail({
    from: process.env.SMTP_FROM || 'Paper Forge <no-reply@paperforge.local>',
    to,
    subject,
    text,
    html
  });

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
