process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

/* Site settings contract — site_title, site_favicon_url, support_chat_url:
 *   - stored as AppSetting key-value rows under the `site:` prefix
 *   - public endpoint GET /api/v1/settings/public returns the effective
 *     config (DB override > defaults) WITHOUT the `source` field
 *   - admin endpoints GET/PUT /api/v1/admin/settings/site require ADMIN
 *
 * Prisma is stubbed before any module loads, mirroring shippingSettings.test.js. */

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

// ==================== PRISMA STUB ====================
const createPrismaStub = () => {
  const state = {
    appSettings: {},
    userRole: 'ADMIN'
  };

  const stub = {
    __state: state,
    $transaction: async (operations) => {
      if (typeof operations === 'function') return operations(stub);
      return Promise.all(operations);
    },
    appSetting: {
      findMany: async ({ where = {} } = {}) => {
        const prefix = where.key?.startsWith || '';
        return Object.entries(state.appSettings)
          .filter(([key]) => key.startsWith(prefix))
          .map(([key, value]) => ({ key, value, updatedAt: new Date() }));
      },
      upsert: async ({ where, update, create }) => {
        if (state.appSettings[where.key] !== undefined) state.appSettings[where.key] = update.value;
        else state.appSettings[create.key] = create.value;
        return { key: where.key, value: (update || create).value, updatedAt: new Date() };
      }
    },
    user: {
      findUnique: async ({ where }) => ({
        id: where.id, email: 'admin@test.local', fullName: 'Test Admin',
        role: state.userRole, status: 'ACTIVE',
        createdAt: new Date(), updatedAt: new Date()
      })
    }
  };
  return stub;
};

const prismaPath = require.resolve('../src/config/prisma');
const prismaStub = createPrismaStub();
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prismaStub };

const express = require('express');
const errorHandler = require('../src/middlewares/errorHandler');
const adminRoutes = require('../src/routes/admin.routes');
const settingsRoutes = require('../src/routes/settings.routes');
const settingsService = require('../src/services/settings.service');
const { siteSettingsSchema } = require('../src/schemas/admin.schema');

const app = express();
app.use(express.json());
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1', settingsRoutes);
app.use(errorHandler);

let server;
let baseUrl;
const adminToken = jwt.sign({ sub: 'admin-user-id' }, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' });

const request = async (method, path, { body, token = adminToken } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let payload = null;
  try { payload = await response.json(); } catch { /* empty body */ }
  return { status: response.status, payload };
};

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

// ==================== SCHEMA VALIDATION ====================

test('siteSettingsSchema accepts a full valid payload', () => {
  assert.equal(siteSettingsSchema.safeParse({
    site_title: 'TCG Store',
    site_favicon_url: 'https://example.com/favicon.ico',
    support_chat_url: 'https://m.me/1251937284677510'
  }).success, true);
});

test('siteSettingsSchema accepts relative favicon paths and empty optional URLs', () => {
  assert.equal(siteSettingsSchema.safeParse({
    site_title: 'TCG Store',
    site_favicon_url: '/uploads/favicon.png',
    support_chat_url: ''
  }).success, true);
});

test('siteSettingsSchema rejects an empty title and malformed URLs', () => {
  assert.equal(siteSettingsSchema.safeParse({ site_title: '' }).success, false);
  assert.equal(siteSettingsSchema.safeParse({
    site_title: 'TCG Store',
    site_favicon_url: 'javascript:alert(1)'
  }).success, false);
  assert.equal(siteSettingsSchema.safeParse({
    site_title: 'TCG Store',
    support_chat_url: 'not a url'
  }).success, false);
});

// ==================== SERVICE ====================

test('getSiteSettings returns built-in defaults (incl. m.me support chat URL) when no DB rows exist', async () => {
  const settings = await settingsService.getSiteSettings();
  assert.equal(settings.site_title, 'TCG Store');
  assert.equal(settings.site_favicon_url, '');
  assert.equal(settings.support_chat_url, 'https://m.me/1251937284677510');
  assert.equal(settings.source, 'defaults');
});

test('getPublicSiteSettings strips the source field and reflects DB overrides', async () => {
  prismaStub.__state.appSettings['site:site_title'] = 'Card Shop VN';
  prismaStub.__state.appSettings['site:support_chat_url'] = 'https://m.me/other-page';
  const settings = await settingsService.getPublicSiteSettings();
  assert.equal(settings.site_title, 'Card Shop VN');
  assert.equal(settings.support_chat_url, 'https://m.me/other-page');
  assert.equal('source' in settings, false);
  delete prismaStub.__state.appSettings['site:site_title'];
  delete prismaStub.__state.appSettings['site:support_chat_url'];
});

test('updateSiteSettings persists all keys as site: prefixed rows', async () => {
  const settings = await settingsService.updateSiteSettings({
    site_title: 'Card Shop VN',
    site_favicon_url: '/uploads/favicon.png',
    support_chat_url: 'https://m.me/1251937284677510'
  });
  assert.equal(settings.source, 'database');
  assert.equal(prismaStub.__state.appSettings['site:site_title'], 'Card Shop VN');
  assert.equal(prismaStub.__state.appSettings['site:site_favicon_url'], '/uploads/favicon.png');
  assert.equal(prismaStub.__state.appSettings['site:support_chat_url'], 'https://m.me/1251937284677510');
});

test('updateSiteSettings rejects an empty title', async () => {
  await assert.rejects(
    () => settingsService.updateSiteSettings({ site_title: '' }),
    (err) => err.code === 'VALIDATION_ERROR'
  );
});

// ==================== PUBLIC API ====================

test('GET /settings/public returns the effective config without auth', async () => {
  prismaStub.__state.appSettings['site:site_title'] = 'Card Shop VN';
  const { status, payload } = await request('GET', '/api/v1/settings/public', { token: null });
  assert.equal(status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data.site_title, 'Card Shop VN');
  assert.equal(payload.data.support_chat_url, 'https://m.me/1251937284677510');
  assert.equal('source' in payload.data, false);
  delete prismaStub.__state.appSettings['site:site_title'];
});

test('GET /settings/public falls back to defaults when no rows are stored', async () => {
  for (const key of Object.keys(prismaStub.__state.appSettings)) {
    if (key.startsWith('site:')) delete prismaStub.__state.appSettings[key];
  }
  const { status, payload } = await request('GET', '/api/v1/settings/public', { token: null });
  assert.equal(status, 200);
  assert.equal(payload.data.site_title, 'TCG Store');
  assert.equal(payload.data.support_chat_url, 'https://m.me/1251937284677510');
});

// ==================== ADMIN API ====================

test('GET /settings/site returns the config for an admin', async () => {
  const { status, payload } = await request('GET', '/api/v1/admin/settings/site');
  assert.equal(status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data.support_chat_url, 'https://m.me/1251937284677510');
  assert.equal(payload.data.source, 'defaults');
});

test('PUT /settings/site saves the key-value pairs and reports source=database', async () => {
  const { status, payload } = await request('PUT', '/api/v1/admin/settings/site', {
    body: {
      site_title: 'Card Shop VN',
      site_favicon_url: 'https://example.com/favicon.ico',
      support_chat_url: 'https://m.me/1251937284677510'
    }
  });
  assert.equal(status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data.site_title, 'Card Shop VN');
  assert.equal(payload.data.source, 'database');
  assert.equal(prismaStub.__state.appSettings['site:site_title'], 'Card Shop VN');

  const reloaded = await request('GET', '/api/v1/admin/settings/site');
  assert.equal(reloaded.payload.data.site_title, 'Card Shop VN');
  assert.equal(reloaded.payload.data.source, 'database');
});

test('PUT /settings/site rejects an empty title with VALIDATION_ERROR', async () => {
  const { status, payload } = await request('PUT', '/api/v1/admin/settings/site', {
    body: { site_title: '' }
  });
  assert.equal(status, 400);
  assert.equal(payload.error.code, 'VALIDATION_ERROR');
});

test('site settings endpoints require authentication', async () => {
  const get = await request('GET', '/api/v1/admin/settings/site', { token: null });
  assert.equal(get.status, 401);
  const put = await request('PUT', '/api/v1/admin/settings/site', {
    body: { site_title: 'Nope' }, token: null
  });
  assert.equal(put.status, 401);
});

test('non-admin roles cannot read or write site settings', async () => {
  prismaStub.__state.userRole = 'CUSTOMER';
  const get = await request('GET', '/api/v1/admin/settings/site');
  assert.equal(get.status, 403);
  const put = await request('PUT', '/api/v1/admin/settings/site', {
    body: { site_title: 'Nope' }
  });
  assert.equal(put.status, 403);
  prismaStub.__state.userRole = 'ADMIN';
});

// Cleanup any stored rows so suite ordering never leaks between tests
test('cleanup stored site settings', async () => {
  for (const key of Object.keys(prismaStub.__state.appSettings)) {
    if (key.startsWith('site:')) delete prismaStub.__state.appSettings[key];
  }
  const settings = await settingsService.getSiteSettings();
  assert.equal(settings.source, 'defaults');
});
