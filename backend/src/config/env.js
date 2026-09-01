const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'SEPAY_ENV',
  'SEPAY_MERCHANT_ID',
  'SEPAY_MERCHANT_SECRET_KEY'
];

for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
}

/* ── URL normalization helpers ─────────────────────────────────
   Chuẩn hoá mọi URL cấu hình: strip trailing slash + khoảng trắng.
   Không bao giờ fallback về IP hay domain hardcode. */

const trimUrl = (value) => String(value || '').trim().replace(/\/+$/, '');

/** Public frontend origin: NEXT_PUBLIC_APP_URL > APP_URL > FRONTEND_URL */
const resolveAppUrl = () =>
  trimUrl(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || process.env.FRONTEND_URL) || null;

/** Public backend/API origin: NEXT_PUBLIC_API_URL > APP_BASE_URL > API_URL */
const resolveApiUrl = () =>
  trimUrl(process.env.NEXT_PUBLIC_API_URL || process.env.APP_BASE_URL || process.env.API_URL) || null;

/** Extra CORS origins (comma-separated), including legacy FRONTEND_URL. */
const resolveCorsOrigins = () => {
  const list = [
    process.env.CORS_ALLOWED_ORIGINS,
    process.env.FRONTEND_URL, // legacy name vẫn được tôn trọng
    process.env.NEXT_PUBLIC_APP_URL
  ]
    .filter(Boolean)
    .join(',')
    .split(',')
    .map((o) => trimUrl(o))
    .filter(Boolean);
  return [...new Set(list)];
};

const appUrl = resolveAppUrl();
const apiUrl = resolveApiUrl();

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: (process.env.NODE_ENV || 'development') === 'production',
  port: parseInt(process.env.PORT, 10) || 4000,
  databaseUrl: process.env.DATABASE_URL,
  databaseSslMode: process.env.DATABASE_SSL_MODE || 'disable',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  sepayApiUrl: process.env.SEPAY_API_URL || 'https://my.sepay.vn',
  sepayEnv: process.env.SEPAY_ENV || 'sandbox',
  sepayMerchantId: process.env.SEPAY_MERCHANT_ID,
  sepayMerchantSecretKey: process.env.SEPAY_MERCHANT_SECRET_KEY,
  sepayWebhookPath: '/api/v1/webhooks/sepay',
  sepayWebhookUrl: process.env.SEPAY_WEBHOOK_URL || null,
  sepayWebhookSecret: process.env.SEPAY_WEBHOOK_SECRET || '',
  sepayAccountNumber: process.env.SEPAY_ACCOUNT_NUMBER || '',
  sepayAccountName: process.env.SEPAY_ACCOUNT_NAME || '',
  // Public origins — resolved dynamically, never hardcoded
  appUrl,
  apiUrl,
  frontendUrl: appUrl, // legacy alias cho codebase cũ
  corsOrigins: resolveCorsOrigins(),
  smtpHost: process.env.SMTP_HOST,
  smtpPort: parseInt(process.env.SMTP_PORT, 10) || 587,
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  adminEmail: process.env.ADMIN_EMAIL || 'admin@tcg.com',
  adminPassword: process.env.ADMIN_PASSWORD || 'Admin@123',
  imgbbApiKey: process.env.IMGBB_API_KEY
};
