const rateLimit = require('express-rate-limit');

const isDev = process.env.NODE_ENV !== 'production';

// Test/CI convenience: AUTH_RATE_LIMIT_MAX raises the login window cap
// without flipping NODE_ENV (E2E suites log in once per spec, which easily
// exceeds the production hardening default of 10/15min).
const authMax = Number(process.env.AUTH_RATE_LIMIT_MAX) || (isDev ? 1000 : 10);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: authMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.'
    },
    timestamp: new Date().toISOString()
  }
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.'
    },
    timestamp: new Date().toISOString()
  }
});

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many webhook requests.'
    },
    timestamp: new Date().toISOString()
  }
});

const lookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many lookup attempts, please try again later.'
    },
    timestamp: new Date().toISOString()
  }
});

module.exports = {
  authLimiter,
  apiLimiter,
  lookupLimiter,
  webhookLimiter
};