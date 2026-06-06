/*
 * Roman Urdu comments:
 * Ye service email sending handle karti hai.
 * Password reset PIN ke liye SMTP transporter banata hai aur dev mode mein PIN console par show karta hai.
 */
const nodemailer = require('nodemailer');

const hasSmtpConfig = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

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

const sendResetPin = async (to, pin) => {
  const subject = 'Paper Forge password reset PIN';
  const text = `Your Paper Forge password reset PIN is ${pin}. It is valid for 10 minutes.`;

  if (!hasSmtpConfig()) {
    console.log(`[DEV EMAIL] To: ${to} | ${subject} | ${text}`);
    return { delivered: false, devPin: pin };
  }

  const transport = createTransport();
  await transport.sendMail({
    from: process.env.SMTP_FROM || 'Paper Forge <no-reply@paperforge.local>',
    to,
    subject,
    text
  });

  return { delivered: true };
};

module.exports = {
  sendResetPin
};
