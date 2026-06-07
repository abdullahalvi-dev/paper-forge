/*
 * Roman Urdu comments:
 * Ye file Paper Forge API ka main server setup karti hai.
 * Is mein Express app, CORS, static frontend hosting, API routes, health check, 404 aur global error handling register hotay hain.
 */
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const selfsigned = require('selfsigned');
const connectDB = require('./config/db');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const httpsPort = process.env.HTTPS_PORT || 5443;
const frontendPath = path.join(__dirname, '..', 'frontend');
const certsPath = path.join(__dirname, 'certs');
const publicSeoPages = [
  { path: '/', priority: '1.0' },
  { path: '/index.html', priority: '1.0' },
  { path: '/pricing.html', priority: '0.8' },
  { path: '/about.html', priority: '0.7' },
  { path: '/news.html', priority: '0.7' },
  { path: '/contact.html', priority: '0.7' },
  { path: '/privacy-policy.html', priority: '0.4' },
  { path: '/terms-conditions.html', priority: '0.4' },
  { path: '/refund-policy.html', priority: '0.4' }
];
const clientOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const isLocalDevOrigin = (origin = '') => /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(origin);
const isProduction = process.env.NODE_ENV === 'production';
const httpsEnabled = process.env.ENABLE_HTTPS !== 'false';
const forceHttps = process.env.FORCE_HTTPS === 'true' || isProduction;
const hstsEnabled = process.env.ENABLE_HSTS === 'true' || isProduction;
const corsOptions = {
  origin(origin, callback) {
    if (!origin || origin === 'null') return callback(null, true);
    if (process.env.CORS_ALLOW_ALL === 'true') return callback(null, true);
    if (clientOrigins.includes(origin) || isLocalDevOrigin(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true
};

const ensureLocalHttpsCertificate = async () => {
  fs.mkdirSync(certsPath, { recursive: true });
  const keyPath = process.env.SSL_KEY_PATH || path.join(certsPath, 'localhost-key.pem');
  const certPath = process.env.SSL_CERT_PATH || path.join(certsPath, 'localhost-cert.pem');

  const hasUsableCert =
    fs.existsSync(keyPath) &&
    fs.existsSync(certPath) &&
    fs.statSync(keyPath).size > 0 &&
    fs.statSync(certPath).size > 0;

  if (!hasUsableCert) {
    const attrs = [{ name: 'commonName', value: 'localhost' }];
    const pems = await selfsigned.generate(attrs, {
      algorithm: 'sha256',
      days: 825,
      keySize: 2048,
      extensions: [
        { name: 'basicConstraints', cA: false },
        {
          name: 'keyUsage',
          digitalSignature: true,
          keyEncipherment: true
        },
        {
          name: 'extKeyUsage',
          serverAuth: true
        },
        {
          name: 'subjectAltName',
          altNames: [
            { type: 2, value: 'localhost' },
            { type: 7, ip: '127.0.0.1' },
            { type: 7, ip: '::1' }
          ]
        }
      ]
    });
    fs.writeFileSync(keyPath, pems.private || pems.privateKey, { mode: 0o600 });
    fs.writeFileSync(certPath, pems.cert, { mode: 0o644 });
  }

  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };
};

const getHttpsRedirectUrl = (req) => {
  const rawHost = req.get('host') || `localhost:${port}`;
  const hostname = rawHost.replace(/:\d+$/, '');
  const targetHost = rawHost.endsWith(`:${port}`) ? `${hostname}:${httpsPort}` : rawHost;
  return `https://${targetHost}${req.originalUrl}`;
};

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    hsts: hstsEnabled
      ? {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true
        }
      : false
  })
);
app.use((req, res, next) => {
  // Roman Urdu: Jab FORCE_HTTPS true ho to browser pages ko HTTP se HTTPS par redirect karta hai; API/health ko tooling ke liye stable rakhta hai.
  const forwardedProto = (req.get('x-forwarded-proto') || '').split(',')[0].trim();
  const alreadyHttps = req.secure || forwardedProto === 'https';
  const isApiRequest = req.path.startsWith('/api');
  if (forceHttps && !alreadyHttps && !isApiRequest && req.method === 'GET') {
    return res.redirect(301, getHttpsRedirectUrl(req));
  }
  return next();
});
// Roman Urdu: HTML, CSS aur JS responses ko gzip/brotli compatible compression deta hai taake page fast load ho.
app.use(compression());
app.use(
  '/api',
  rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 900000),
    limit: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 300),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later.' }
  })
);
app.use(
  '/api/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Number(process.env.AUTH_RATE_LIMIT_MAX || 40),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Too many auth attempts, please try again later.' }
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'Paper Forge API' });
});

app.use('/api', async (req, res, next) => {
  // Roman Urdu: Vercel/serverless cold start par pehle MongoDB ready karta hai, phir API controller chalata hai.
  if (req.path === '/health') return next();
  try {
    await connectDB();
    return next();
  } catch (error) {
    error.statusCode = error.statusCode || 503;
    error.message = error.message || 'Database connection is not ready. Please try again.';
    return next(error);
  }
});

const getSiteBaseUrl = (req) => {
  const configured = (process.env.PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  const protocol = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim();
  const host = req.get('host') || `localhost:${port}`;
  return `${protocol}://${host}`.replace(/\/+$/, '');
};

const escapeXml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

app.get('/robots.txt', (req, res) => {
  // Roman Urdu: Search engines ko valid crawling rules aur dynamic sitemap URL deta hai.
  const baseUrl = getSiteBaseUrl(req);
  res.type('text/plain').send(`User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml
`);
});

app.get('/sitemap.xml', (req, res) => {
  // Roman Urdu: Public pages ka XML sitemap generate karta hai jo localhost aur live domain dono par sahi URL banata hai.
  const baseUrl = getSiteBaseUrl(req);
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = publicSeoPages
    .map(
      (page) => `  <url>
    <loc>${escapeXml(`${baseUrl}${page.path}`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${page.priority}</priority>
  </url>`
    )
    .join('\n');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`);
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/teacher', require('./routes/teacherRoutes'));
app.use('/api/student', require('./routes/studentRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/papers', require('./routes/paperRoutes'));
app.use('/api/paper', require('./routes/paperRoutes'));
app.use('/api/questions', require('./routes/questionRoutes'));
app.use('/api/resources', require('./routes/resourceRoutes'));
app.use('/api/subscription', require('./routes/subscriptionRoutes'));
app.use('/api/practice', require('./routes/practiceRoutes'));
app.use('/api/chatbot', require('./routes/chatbotRoutes'));

app.use(
  express.static(frontendPath, {
    etag: true,
    maxAge: '7d',
    setHeaders(res, filePath) {
      // Roman Urdu: HTML aur main app assets bilkul store nahi hotay taa ke latest UI fixes foran load hon.
      if (
        filePath.endsWith('.html') ||
        filePath.endsWith(`${path.sep}app.js`) ||
        filePath.endsWith(`${path.sep}dashboard.css`)
      ) {
        res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    }
  })
);
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  return res.sendFile(path.join(frontendPath, 'index.html'));
});

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((error, req, res, next) => {
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    message: error.message || 'Server error'
  });
});

if (process.env.VERCEL !== '1') {
  connectDB()
    .then(async () => {
      http.createServer(app).listen(port, () => {
        console.log(`Paper Forge running on http://localhost:${port}`);
      });

      if (httpsEnabled) {
        const httpsOptions = await ensureLocalHttpsCertificate();
        https.createServer(httpsOptions, app).listen(httpsPort, () => {
          console.log(`Paper Forge secure server running on https://localhost:${httpsPort}`);
        });
      }
    })
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}

module.exports = app;
