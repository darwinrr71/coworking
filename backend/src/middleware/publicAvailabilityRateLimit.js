const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 60;

const buckets = new Map();

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim() !== '') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

function cleanupExpiredBuckets(now) {
  buckets.forEach((bucket, key) => {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  });
}

export default function publicAvailabilityRateLimit(req, res, next) {
  const now = Date.now();
  cleanupExpiredBuckets(now);

  const ip = getClientIp(req);
  const current = buckets.get(ip);

  if (!current || current.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }

  if (current.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    res.set('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      message: 'Too many availability requests. Please try again shortly.',
    });
  }

  current.count += 1;
  buckets.set(ip, current);
  return next();
}
