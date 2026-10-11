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

// Public read-only catalog browsing rate limit (relaxed to 1000 requests / 15 minutes)
// Prevents 429 throttling when users browse collections or open multiple browser tabs.
const catalogMax = Number(process.env.CATALOG_RATE_LIMIT_MAX) || 1000;

const catalogLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: catalogMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many catalog requests, please slow down.'
    },
    timestamp: new Date().toISOString()
  }
});

// Strict rate limit for checkout creation (protects MariaDB transactions and inventory locks)
const checkoutMax = Number(process.env.CHECKOUT_RATE_LIMIT_MAX) || (isDev ? 500 : 20);

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: checkoutMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Quá nhiều yêu cầu tạo đơn hàng, vui lòng thử lại sau.'
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
  catalogLimiter,
  checkoutLimiter,
  lookupLimiter,
  webhookLimiter
};