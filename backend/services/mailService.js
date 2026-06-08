/*
 * Roman Urdu comments:
 * Ye service email sending handle karti hai.
 * Resend configured ho to Vercel-friendly HTTPS API use hoti hai, warna SMTP fallback chalta hai.
 * Production mein email provider missing ho to code response mein expose nahi hota aur request fail hoti hai.
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
      'Paper Forge <no-reply@paperforge.local>'
  };
};

const getResendConfig = () => {
  const smtp = getSmtpConfig();
  const smtpUsesResend =
    String(smtp.host || '').toLowerCase() === 'smtp.resend.com' &&
    String(smtp.user || '').toLowerCase() === 'resend';

  return {
    // Roman Urdu: Purani Resend SMTP settings ko bhi API setup ke taur par accept kiya jata hai.
    apiKey: firstEnv('RESEND_API_KEY', 'RESEND_KEY') || (smtpUsesResend ? smtp.pass : ''),
    from: firstEnv('RESEND_FROM', 'SMTP_FROM', 'EMAIL_FROM', 'MAIL_FROM') || '',
    testRecipient: String(firstEnv('RESEND_TEST_RECIPIENT') || '')
      .trim()
      .toLowerCase()
  };
};

const hasSmtpConfig = () => {
  const config = getSmtpConfig();
  return Boolean(config.host && config.user && config.pass);
};

const hasResendConfig = () => {
  const config = getResendConfig();
  return Boolean(config.apiKey && config.from);
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
    'Email verification is not configured. Add RESEND_API_KEY and RESEND_FROM, or valid SMTP settings, in Vercel Environment Variables and redeploy.'
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

const getResendError = ({ status, providerMessage, from }) => {
  const message = String(providerMessage || '');
  const usingTestSender = /@resend\.dev\b/i.test(String(from || ''));

  if (
    status === 403 &&
    (usingTestSender || /only send testing emails|verify a domain|own email address/i.test(message))
  ) {
    return createDeliveryError(
      'Resend testing sender can only email the address used for your Resend account. To send OTPs to all users, verify your own domain in Resend and set RESEND_FROM to Paper Forge <verify@your-domain.com>.',
      'EMAIL_SENDER_DOMAIN_REQUIRED',
      503
    );
  }

  if (status === 401 || /api key is invalid|invalid api key/i.test(message)) {
    return createDeliveryError(
      'Resend API key is invalid. Create a new Sending access API key, update RESEND_API_KEY in Vercel, and redeploy.',
      'EMAIL_API_KEY_INVALID',
      503
    );
  }

  if (/domain.*not verified|from.*not verified|sender.*not verified/i.test(message)) {
    return createDeliveryError(
      'The Resend sender domain is not verified. Verify the domain in Resend and use an address from that domain in RESEND_FROM.',
      'EMAIL_SENDER_NOT_VERIFIED',
      503
    );
  }

  return createDeliveryError(
    message
      ? `Verification email could not be sent by Resend: ${message}`
      : 'Verification email could not be sent by Resend. Please check the API key and sender domain.',
    'EMAIL_DELIVERY_FAILED',
    status >= 400 && status < 500 ? 503 : 502
  );
};

const sendWithResendApi = async ({ to, subject, text, html }) => {
  const config = getResendConfig();
  const normalizedRecipient = String(to || '').trim().toLowerCase();

  if (
    config.testRecipient &&
    /@resend\.dev\b/i.test(config.from) &&
    normalizedRecipient !== config.testRecipient
  ) {
    throw getResendError({
      status: 403,
      providerMessage: 'The resend.dev testing sender can only send to the configured Resend account email.',
      from: config.from
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'paper-forge/1.0'
      },
      body: JSON.stringify({
        from: config.from,
        to: [to],
        subject,
        text,
        ...(html ? { html } : {})
      }),
      signal: controller.signal
    });

    const responseText = await response.text();
    let responseBody = {};
    try {
      responseBody = responseText ? JSON.parse(responseText) : {};
    } catch {
      responseBody = { message: responseText };
    }

    if (!response.ok) {
      throw getResendError({
        status: response.status,
        providerMessage: responseBody.message || responseBody.error,
        from: config.from
      });
    }

    return {
      delivered: true,
      provider: 'resend',
      messageId: responseBody.id || null
    };
  } catch (error) {
    if (error.statusCode) throw error;
    const timedOut = error.name === 'AbortError';
    throw createDeliveryError(
      timedOut
        ? 'Resend email request timed out. Please try again.'
        : 'Could not connect to the Resend email service. Please try again.',
      timedOut ? 'EMAIL_PROVIDER_TIMEOUT' : 'EMAIL_PROVIDER_UNAVAILABLE',
      503
    );
  } finally {
    clearTimeout(timeout);
  }
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
      code: error.code,
      command: error.command,
      responseCode: error.responseCode,
      message: error.message
    });
    throw createDeliveryError(
      'Verification email could not be sent through SMTP. Please check the SMTP host, port, username, password and sender.',
      'EMAIL_DELIVERY_FAILED',
      502
    );
  }
};

const sendCodeEmail = async ({ to, code, subject, text, html }) => {
  if (hasResendConfig()) {
    return sendWithResendApi({ to, subject, text, html });
  }
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
  hasResendConfig,
  hasSmtpConfig,
  sendRegistrationCode,
  sendResetPin
};
