process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

// ==================== PRISMA STUB ====================
// AppSetting-backed stub: enough surface for settings.service + admin routes.
const createPrismaStub = () => {
  const state = {
    appSettings: {},
    userRole: 'ADMIN'
  };
  const calls = [];
  const record = (name, args) => calls.push({ name, args });

  const stub = {
    __calls: calls,
    __state: state,
    $transaction: async (operations) => {
      if (typeof operations === 'function') return operations(stub);
      return Promise.all(operations);
    },
    appSetting: {
      findUnique: async ({ where }) => {
        record('appSetting.findUnique', where);
        const value = state.appSettings[where.key];
        return value === undefined ? null : { key: where.key, value, updatedAt: new Date() };
      },
      findMany: async ({ where = {} } = {}) => {
        record('appSetting.findMany', where);
        const prefix = where.key?.startsWith || '';
        return Object.entries(state.appSettings)
          .filter(([key]) => key.startsWith(prefix))
          .map(([key, value]) => ({ key, value, updatedAt: new Date() }));
      },
      upsert: async ({ where, update, create }) => {
        record('appSetting.upsert', { where, update, create });
        if (state.appSettings[where.key] !== undefined) state.appSettings[where.key] = update.value;
        else state.appSettings[create.key] = create.value;
        return { key: where.key, value: (update || create).value, updatedAt: new Date() };
      }
    },
    user: {
      findUnique: async ({ where }) => {
        record('user.findUnique', where);
        return {
          id: where.id, email: 'admin@test.local', fullName: 'Test Admin',
          role: state.userRole, status: 'ACTIVE',
          createdAt: new Date(), updatedAt: new Date()
        };
      }
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
const settingsService = require('../src/services/settings.service');
const { shippingSettingsSchema } = require('../src/schemas/admin.schema');

const app = express();
app.use(express.json());
app.use('/api/v1/admin', adminRoutes);
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

test('shippingSettingsSchema accepts a non-negative integer', () => {
  assert.equal(shippingSettingsSchema.safeParse({ defaultShippingFee: 35000 }).success, true);
  assert.equal(shippingSettingsSchema.safeParse({ defaultShippingFee: 0 }).success, true);
  assert.equal(shippingSettingsSchema.safeParse({ defaultShippingFee: '35000' }).success, false);
});

test('shippingSettingsSchema rejects negative, fractional and missing fees', () => {
  assert.equal(shippingSettingsSchema.safeParse({ defaultShippingFee: -1 }).success, false);
  assert.equal(shippingSettingsSchema.safeParse({ defaultShippingFee: 2000.5 }).success, false);
  assert.equal(shippingSettingsSchema.safeParse({}).success, false);
  assert.equal(shippingSettingsSchema.safeParse({ defaultShippingFee: 'abc' }).success, false);
});

// ==================== SERVICE ====================

test('getShippingSettings returns the legacy 20000 default with source=default when no DB row exists', async () => {
  const settings = await settingsService.getShippingSettings();
  assert.equal(settings.defaultShippingFee, 20000);
  assert.equal(settings.source, 'default');
});

test('getEffectiveShippingFee mirrors the stored DB value', async () => {
  prismaStub.__state.appSettings['shipping:default_fee'] = '35000';
  assert.equal(await settingsService.getEffectiveShippingFee(), 35000);
  delete prismaStub.__state.appSettings['shipping:default_fee'];
});

test('getEffectiveShippingFee falls back to default on a malformed stored value', async () => {
  prismaStub.__state.appSettings['shipping:default_fee'] = 'not-a-number';
  assert.equal(await settingsService.getEffectiveShippingFee(), 20000);
  delete prismaStub.__state.appSettings['shipping:default_fee'];
});

// ==================== ADMIN API ====================

test('GET /settings/shipping returns the default fee for an admin', async () => {
  const { status, payload } = await request('GET', '/api/v1/admin/settings/shipping');
  assert.equal(status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data.defaultShippingFee, 20000);
  assert.equal(payload.data.source, 'default');
});

test('PUT /settings/shipping saves the fee and reports source=database', async () => {
  const { status, payload } = await request('PUT', '/api/v1/admin/settings/shipping', {
    body: { defaultShippingFee: 35000 }
  });
  assert.equal(status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data.defaultShippingFee, 35000);
  assert.equal(payload.data.source, 'database');
  assert.equal(prismaStub.__state.appSettings['shipping:default_fee'], '35000');

  const reloaded = await request('GET', '/api/v1/admin/settings/shipping');
  assert.equal(reloaded.payload.data.defaultShippingFee, 35000);
  assert.equal(reloaded.payload.data.source, 'database');
});

test('PUT /settings/shipping accepts 0 (free shipping)', async () => {
  const { status, payload } = await request('PUT', '/api/v1/admin/settings/shipping', {
    body: { defaultShippingFee: 0 }
  });
  assert.equal(status, 200);
  assert.equal(payload.data.defaultShippingFee, 0);
});

test('PUT /settings/shipping rejects negative and fractional fees with validation details', async () => {
  const negative = await request('PUT', '/api/v1/admin/settings/shipping', {
    body: { defaultShippingFee: -5000 }
  });
  assert.equal(negative.status, 400);
  assert.equal(negative.payload.error.code, 'VALIDATION_ERROR');

  const fractional = await request('PUT', '/api/v1/admin/settings/shipping', {
    body: { defaultShippingFee: 2000.5 }
  });
  assert.equal(fractional.status, 400);
  assert.equal(fractional.payload.error.code, 'VALIDATION_ERROR');
});

test('PUT /settings/shipping rejects non-numeric payloads', async () => {
  const { status } = await request('PUT', '/api/v1/admin/settings/shipping', {
    body: { defaultShippingFee: 'thirty-five thousand' }
  });
  assert.equal(status, 400);
});

test('shipping settings endpoints require authentication', async () => {
  const get = await request('GET', '/api/v1/admin/settings/shipping', { token: null });
  assert.equal(get.status, 401);
  const put = await request('PUT', '/api/v1/admin/settings/shipping', {
    body: { defaultShippingFee: 35000 }, token: null
  });
  assert.equal(put.status, 401);
});

test('non-admin roles cannot read or write shipping settings', async () => {
  prismaStub.__state.userRole = 'CUSTOMER';
  const get = await request('GET', '/api/v1/admin/settings/shipping');
  assert.equal(get.status, 403);
  const put = await request('PUT', '/api/v1/admin/settings/shipping', {
    body: { defaultShippingFee: 35000 }
  });
  assert.equal(put.status, 403);
  prismaStub.__state.userRole = 'ADMIN';
});

// Cleanup any stored value so suite ordering never leaks between tests
test('cleanup stored shipping setting', async () => {
  delete prismaStub.__state.appSettings['shipping:default_fee'];
  assert.equal(await settingsService.getEffectiveShippingFee(), 20000);
});
