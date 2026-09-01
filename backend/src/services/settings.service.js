const prisma = require('../config/prisma');
const env = require('../config/env');
const { AppError } = require('../utils/errors');

// Admin-editable SePay gateway settings.
// Priority: DB (AppSetting rows) -> .env defaults -> empty strings.
// This makes the admin panel work out of the box: the first load returns
// the .env values, and saving persists overrides into the database.

const SEPAY_SETTING_KEYS = ['apiUrl', 'webhookUrl', 'webhookSecret', 'accountNumber', 'accountName'];

// Giá trị mặc định suy ra từ env (SEPAY_WEBHOOK_URL > NEXT_PUBLIC_API_URL/APP_BASE_URL > NEXT_PUBLIC_APP_URL/FRONTEND_URL)
const envWebhookUrl = () =>
  process.env.SEPAY_WEBHOOK_URL ||
  (process.env.NEXT_PUBLIC_API_URL || process.env.APP_BASE_URL
    ? `${(process.env.NEXT_PUBLIC_API_URL || process.env.APP_BASE_URL).replace(/\/+$/, '')}/api/v1/webhooks/sepay`
    : (process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_URL
      ? `${(process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_URL).replace(/\/+$/, '')}/api/v1/webhooks/sepay`
      : '/api/v1/webhooks/sepay'));

const SEPAY_ENV_DEFAULTS = {
  apiUrl: env.sepayApiUrl || 'https://my.sepay.vn',
  webhookUrl: envWebhookUrl(),
  webhookSecret: env.sepayWebhookSecret || '',
  accountNumber: env.sepayAccountNumber || '',
  accountName: env.sepayAccountName || ''
};

const DB_KEY_PREFIX = 'sepay:';

const toDbKey = (key) => `${DB_KEY_PREFIX}${key}`;

const getSepaySettings = async () => {
  const rows = await prisma.appSetting.findMany({
    where: { key: { startsWith: DB_KEY_PREFIX } }
  });

  const stored = {};
  for (const row of rows) {
    stored[row.key.slice(DB_KEY_PREFIX.length)] = row.value;
  }

  const settings = {};
  for (const key of SEPAY_SETTING_KEYS) {
    settings[key] = stored[key] !== undefined ? stored[key] : SEPAY_ENV_DEFAULTS[key];
  }

  return {
    ...settings,
    source: Object.keys(stored).length > 0 ? 'database' : 'env-defaults'
  };
};

// URL webhook/IPN hiệu dụng: DB override > env fallback.
// Dùng cho các luồng async (checkout, regenerate, config endpoint).
// `req` optional — forwarded cho caller để suy ra URL từ Host header khi
// env không cấu hình domain (deploy sau Nginx reverse proxy).
const resolveWebhookUrl = async (req) => {
  try {
    const rows = await prisma.appSetting.findMany({
      where: { key: { startsWith: DB_KEY_PREFIX } }
    });
    const stored = {};
    for (const row of rows) {
      stored[row.key.slice(DB_KEY_PREFIX.length)] = row.value;
    }
    const dbUrl = (stored.webhookUrl || '').trim();
    if (dbUrl) return dbUrl;
  } catch (err) {
    console.error('Failed to read webhook URL from settings:', err.message);
  }
  // env chain đã ổn định (SEPAY_WEBHOOK_URL > API_URL > APP_URL); nếu
  // các biến đó trống và có req thì suy ra từ Host header công khai.
  const envDefault = SEPAY_ENV_DEFAULTS.webhookUrl;
  if (envDefault && envDefault !== '/api/v1/webhooks/sepay') return envDefault;
  if (req) {
    const forwardedHost = req.headers?.['x-forwarded-host'] || req.headers?.host;
    const forwardedProto = req.headers?.['x-forwarded-proto'] ||
      (String(req.headers?.host || '').startsWith('localhost') || String(req.headers?.host || '').startsWith('127.0.0.1') ? 'http' : 'https');
    if (forwardedHost) return `${forwardedProto}://${forwardedHost}/api/v1/webhooks/sepay`;
  }
  return envDefault;
};

const updateSepaySettings = async (data) => {
  const errors = [];
  for (const key of SEPAY_SETTING_KEYS) {
    if (key === 'webhookUrl') continue; // webhookUrl là tùy chọn — cho phép rỗng để dùng mặc định env
    const value = data[key];
    if (value === undefined || value === null || String(value).trim() === '') {
      errors.push({ field: key, message: `${key} is required` });
    }
  }
  if (data.apiUrl !== undefined && !/^https?:\/\//.test(String(data.apiUrl).trim())) {
    errors.push({ field: 'apiUrl', message: 'API URL must start with http:// or https://' });
  }
  if (data.webhookUrl !== undefined && data.webhookUrl !== null && String(data.webhookUrl).trim() !== '' &&
      !/^(https?:\/\/|\/)/.test(String(data.webhookUrl).trim())) {
    errors.push({ field: 'webhookUrl', message: 'Webhook URL must be an absolute http(s) URL or a relative path starting with /' });
  }
  if (errors.length > 0) {
    throw new AppError('Invalid SePay settings', 400, 'VALIDATION_ERROR', errors);
  }

  await prisma.$transaction(
    SEPAY_SETTING_KEYS.map((key) =>
      prisma.appSetting.upsert({
        where: { key: toDbKey(key) },
        update: { value: String(data[key] ?? '').trim() },
        create: { key: toDbKey(key), value: String(data[key] ?? '').trim() }
      })
    )
  );

  return getSepaySettings();
};

module.exports = {
  getSepaySettings,
  updateSepaySettings,
  resolveWebhookUrl
};
