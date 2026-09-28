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

// ==================== SHOP SETTINGS ====================

// Public shop identity & support contact info (storefront footer, admin portal).
// Priority: DB (AppSetting rows) -> built-in defaults. Same pattern as SePay:
// the first admin load returns defaults; saving persists overrides into the DB.
const SHOP_SETTING_KEYS = ['shop_name', 'shop_logo_url', 'support_email', 'support_phone', 'support_address'];

const SHOP_DEFAULTS = {
  shop_name: 'TCG Store',
  shop_logo_url: '',
  support_email: 'support@tcgstore.com',
  support_phone: '+84 123 456 789',
  support_address: '123 Main St, Hanoi, Vietnam'
};

const SHOP_DB_KEY_PREFIX = 'shop:';

const toShopDbKey = (key) => `${SHOP_DB_KEY_PREFIX}${key}`;

// Returns the effective shop config for both admin (edit form) and the
// public storefront endpoint (footer contact block).
const getShopSettings = async () => {
  const rows = await prisma.appSetting.findMany({
    where: { key: { startsWith: SHOP_DB_KEY_PREFIX } }
  });

  const stored = {};
  for (const row of rows) {
    stored[row.key.slice(SHOP_DB_KEY_PREFIX.length)] = row.value;
  }

  const settings = {};
  for (const key of SHOP_SETTING_KEYS) {
    settings[key] = stored[key] !== undefined ? stored[key] : SHOP_DEFAULTS[key];
  }

  return {
    ...settings,
    source: Object.keys(stored).length > 0 ? 'database' : 'defaults'
  };
};

const updateShopSettings = async (data) => {
  const errors = [];
  for (const key of SHOP_SETTING_KEYS) {
    if (key === 'shop_logo_url') continue; // logo is optional — empty means "no logo"
    const value = data[key];
    if (value === undefined || value === null || String(value).trim() === '') {
      errors.push({ field: key, message: `${key} is required` });
    }
  }
  if (errors.length > 0) {
    throw new AppError('Invalid shop settings', 400, 'VALIDATION_ERROR', errors);
  }

  await prisma.$transaction(
    SHOP_SETTING_KEYS.map((key) =>
      prisma.appSetting.upsert({
        where: { key: toShopDbKey(key) },
        update: { value: String(data[key] ?? '').trim() },
        create: { key: toShopDbKey(key), value: String(data[key] ?? '').trim() }
      })
    )
  );

  return getShopSettings();
};

// ==================== SHIPPING SETTINGS ====================

// Admin-editable default shipping fee (VND) applied at checkout.
// Priority: DB (AppSetting row) -> legacy hardcoded 20000 VND default.
// Stored as a plain integer string; order rows snapshot the fee at creation
// time so changing this value never rewrites historical orders.
const SHIPPING_DEFAULT_FEE = 20000; // VND — legacy fallback, must stay an integer >= 0
const SHIPPING_DB_KEY = 'shipping:default_fee';

const getShippingSettings = async () => {
  const row = await prisma.appSetting.findUnique({ where: { key: SHIPPING_DB_KEY } });
  const fee = row && Number.isInteger(Number(row.value)) && Number(row.value) >= 0
    ? Number(row.value)
    : SHIPPING_DEFAULT_FEE;
  return {
    defaultShippingFee: fee,
    source: row ? 'database' : 'default'
  };
};

// Effective fee for checkout/pricing flows — DB override > legacy default.
// Never throws: a settings read must not take checkout down, so any DB
// hiccup falls back to the default constant.
const getEffectiveShippingFee = async () => {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: SHIPPING_DB_KEY } });
    if (row) {
      const fee = Number(row.value);
      if (Number.isInteger(fee) && fee >= 0) return fee;
    }
  } catch (err) {
    console.error('Failed to read shipping fee from settings:', err.message);
  }
  return SHIPPING_DEFAULT_FEE;
};

const updateShippingSettings = async (data) => {
  const fee = data.defaultShippingFee;
  const errors = [];
  if (!Number.isInteger(fee)) {
    errors.push({ field: 'defaultShippingFee', message: 'Shipping fee must be an integer (VND)' });
  } else if (fee < 0) {
    errors.push({ field: 'defaultShippingFee', message: 'Shipping fee must be >= 0' });
  } else if (fee > 1000000000) {
    errors.push({ field: 'defaultShippingFee', message: 'Shipping fee is unreasonably large' });
  }
  if (errors.length > 0) {
    throw new AppError('Invalid shipping settings', 400, 'VALIDATION_ERROR', errors);
  }

  await prisma.appSetting.upsert({
    where: { key: SHIPPING_DB_KEY },
    update: { value: String(fee) },
    create: { key: SHIPPING_DB_KEY, value: String(fee) }
  });

  return getShippingSettings();
};

// ==================== SITE SETTINGS ====================

// Site identity & support chat config (browser tab title, favicon, external
// support chat link). Priority: DB (AppSetting rows) -> built-in defaults,
// same pattern as SePay/Shop settings.
const SITE_SETTING_KEYS = ['site_title', 'site_favicon_url', 'support_chat_url'];

const SITE_DEFAULTS = {
  site_title: 'TCG Store',
  site_favicon_url: '',
  support_chat_url: 'https://m.me/1251937284677510'
};

const SITE_DB_KEY_PREFIX = 'site:';

const toSiteDbKey = (key) => `${SITE_DB_KEY_PREFIX}${key}`;

// Effective site config for the admin edit form and the public endpoint
// GET /api/settings/public. `source` is stripped on the public payload.
const getSiteSettings = async () => {
  const rows = await prisma.appSetting.findMany({
    where: { key: { startsWith: SITE_DB_KEY_PREFIX } }
  });

  const stored = {};
  for (const row of rows) {
    stored[row.key.slice(SITE_DB_KEY_PREFIX.length)] = row.value;
  }

  const settings = {};
  for (const key of SITE_SETTING_KEYS) {
    settings[key] = stored[key] !== undefined ? stored[key] : SITE_DEFAULTS[key];
  }

  return {
    ...settings,
    source: Object.keys(stored).length > 0 ? 'database' : 'defaults'
  };
};

// Public payload for the storefront: title/favicon/support chat URL only.
// Never throws — the storefront bootstraps from this endpoint, so any DB
// hiccup falls back to the built-in defaults instead of a 500.
const getPublicSiteSettings = async () => {
  try {
    const settings = await getSiteSettings();
    const { source, ...publicSettings } = settings;
    return publicSettings;
  } catch (err) {
    console.error('Failed to read site settings:', err.message);
    return { ...SITE_DEFAULTS };
  }
};

const updateSiteSettings = async (data) => {
  const errors = [];
  for (const key of SITE_SETTING_KEYS) {
    if (key === 'site_title') {
      const value = data[key];
      if (value === undefined || value === null || String(value).trim() === '') {
        errors.push({ field: key, message: 'site_title is required' });
      }
    }
  }
  if (data.site_favicon_url !== undefined && data.site_favicon_url !== null && String(data.site_favicon_url).trim() !== '' &&
      !/^(https?:\/\/|\/)/i.test(String(data.site_favicon_url).trim())) {
    errors.push({ field: 'site_favicon_url', message: 'Favicon must be an absolute http(s) URL or a relative path starting with /' });
  }
  if (data.support_chat_url !== undefined && data.support_chat_url !== null && String(data.support_chat_url).trim() !== '' &&
      !/^(https?:\/\/|\/)/i.test(String(data.support_chat_url).trim())) {
    errors.push({ field: 'support_chat_url', message: 'Support chat URL must be an absolute http(s) URL or a relative path starting with /' });
  }
  if (errors.length > 0) {
    throw new AppError('Invalid site settings', 400, 'VALIDATION_ERROR', errors);
  }

  await prisma.$transaction(
    SITE_SETTING_KEYS.map((key) =>
      prisma.appSetting.upsert({
        where: { key: toSiteDbKey(key) },
        update: { value: String(data[key] ?? '').trim() },
        create: { key: toSiteDbKey(key), value: String(data[key] ?? '').trim() }
      })
    )
  );

  return getSiteSettings();
};

module.exports = {
  getSepaySettings,
  updateSepaySettings,
  resolveWebhookUrl,
  getShopSettings,
  updateShopSettings,
  getShippingSettings,
  updateShippingSettings,
  getEffectiveShippingFee,
  getSiteSettings,
  getPublicSiteSettings,
  updateSiteSettings
};
