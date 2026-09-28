const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const requiredEnvVars = [
  'DB_HOST',
  'DB_USER',
  'DB_PASS',
  'DB_NAME',
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

/* ── MariaDB connection ─────────────────────────────────────
   Build the MySQL connection string dynamically from .env vars.
   NEVER hardcoded — credentials live only in the environment.
   Pool params (connection_limit / pool_timeout) keep the pool small
   for cPanel shared hosting (limited entry processes). */

const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = parseInt(process.env.DB_PORT, 10) || 3306;
const dbUser = process.env.DB_USER;
const dbPass = process.env.DB_PASS;
const dbName = process.env.DB_NAME;
const dbPoolLimit = parseInt(process.env.DB_POOL_LIMIT, 10) || 5;
const dbPoolTimeout = parseInt(process.env.DB_POOL_TIMEOUT, 10) || 10;
// Retry knobs consumed by src/server.js (see connectWithRetry there)
const dbConnectRetries = parseInt(process.env.DB_CONNECT_RETRIES, 10) || 10;
const dbConnectRetryDelayMs = parseInt(process.env.DB_CONNECT_RETRY_DELAY_MS, 10) || 2000;

// encodeURIComponent leaves ! ' ( ) * unescaped — escape those too so the
// URL is safe for every consumer (Prisma engine, mysql2, shells).
const encodeCred = (value) =>
  encodeURIComponent(String(value ?? '')).replace(
    /[!'()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()
  );

const buildDatabaseUrl = () => {
  if (!dbUser || !dbName) return null;
  const auth = `${encodeCred(dbUser)}:${encodeCred(dbPass || '')}`;
  return `mysql://${auth}@${dbHost}:${dbPort}/${dbName}?connection_limit=${dbPoolLimit}&pool_timeout=${dbPoolTimeout}`;
};

// The URL composed from DB_* parts is AUTHORITATIVE: it is always correctly
// URL-encoded (special chars in DB_PASS) and always targets the right host
// (the compose service name `mariadb` inside Docker — never localhost).
// A raw DATABASE_URL string in .env is only a fallback for setups that
// don't provide the DB_* parts, and it must still be a mysql:// URL.
const composeUrl = buildDatabaseUrl();
let databaseUrl = composeUrl || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'Database URL resolution failed: provide DB_HOST/DB_USER/DB_PASS/DB_NAME ' +
      '(or a mysql:// DATABASE_URL) in the environment.'
  );
}
if (!/^mysql:\/\//.test(databaseUrl)) {
  // Fail fast with an actionable message instead of a confusing P1001/P1012
  // deep inside Prisma. Common cause: a stale DATABASE_URL from an old
  // Postgres setup, or the container was not recreated after .env changed.
  throw new Error(
    `DATABASE_URL must start with mysql:// (got: ${databaseUrl.split(':')[0]}://…). ` +
      'Set DB_HOST/DB_USER/DB_PASS/DB_NAME correctly, or fix DATABASE_URL in .env, ' +
      'then recreate the containers: docker compose up -d --force-recreate backend'
  );
}

// Reject the classic Docker mistake: pointing at localhost/127.0.0.1 from
// inside a container. That address is the container itself — MariaDB is
// reachable only via its service name/alias (mariadb / db) on tcg-network.
const databaseUrlHost = /^mysql:\/\/[^@]+@([^:/?]+)/.exec(databaseUrl)?.[1];
if (env_inDocker() && /^(localhost|127\.0\.0\.1)$/.test(databaseUrlHost)) {
  throw new Error(
    `DATABASE_URL targets ${databaseUrlHost} — inside Docker the database host ` +
      'must be the compose service name (mariadb or db), not localhost. ' +
      'Fix DB_HOST in .env and recreate the containers.'
  );
}

function env_inDocker() {
  return Boolean(process.env.DB_CONNECT_RETRIES !== undefined || fs.existsSync('/.dockerenv'));
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: (process.env.NODE_ENV || 'development') === 'production',
  port: parseInt(process.env.PORT, 10) || 4000,
  databaseUrl,
  dbHost,
  dbPort,
  dbUser,
  dbName,
  dbPoolLimit,
  dbPoolTimeout,
  dbConnectRetries,
  dbConnectRetryDelayMs,
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
