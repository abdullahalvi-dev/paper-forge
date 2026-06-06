/*
 * Roman Urdu comments:
 * Ye middleware AI chatbot requests ko rate limit karta hai.
 * Is se Gemini API abuse aur accidental spam se backend safe rehta hai.
 */
const buckets = new Map();

const aiRateLimit = (req, res, next) => {
  const windowMs = Number(process.env.AI_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
  const maxRequests = Number(process.env.AI_RATE_LIMIT_MAX || 30);
  const now = Date.now();
  const key = String(req.user?._id || req.ip || 'anonymous');
  const current = buckets.get(key) || { count: 0, resetAt: now + windowMs };

  if (current.resetAt <= now) {
    current.count = 0;
    current.resetAt = now + windowMs;
  }

  current.count += 1;
  buckets.set(key, current);

  if (current.count > maxRequests) {
    return res.status(429).json({
      message: 'AI chatbot rate limit reached. Please try again after a few minutes.'
    });
  }

  return next();
};

module.exports = aiRateLimit;
