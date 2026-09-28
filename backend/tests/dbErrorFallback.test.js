process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

/* Safe error handling for controllers — DB failure degradation contract:
 *   - list endpoints -> 200 + empty data (array / empty page)
 *   - single reads / writes -> clean 400 JSON
 *   - operational errors (404/409/validation) keep their original status
 * A raw Prisma error must NEVER surface as an unhandled 500.
 *
 * Prisma is stubbed before any controller loads, mirroring virtualBoxes.test.js. */

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

// ── Prisma stub: every model method throws a raw Prisma error ──────────────
const createPrismaError = (message = 'Connection refused', code = 'P1001') =>
  Object.assign(new Error(message), {
    code,
    clientVersion: '5.22.0',
    name: 'PrismaClientInitializationError'
  });

const makeThrowingModel = (name) => new Proxy({}, {
  get: (_target, method) => {
    if (method === 'then' || method === 'catch') return undefined; // not a thenable
    return async () => { throw createPrismaError(`${name}.${String(method)} failed`); };
  }
});

const prismaStub = {
  $transaction: async () => { throw createPrismaError('$transaction failed'); },
  product: makeThrowingModel('product'),
  productVariant: makeThrowingModel('productVariant'),
  card: makeThrowingModel('card'),
  set: makeThrowingModel('set'),
  category: makeThrowingModel('category'),
  order: makeThrowingModel('order'),
  payment: makeThrowingModel('payment'),
  virtualBox: makeThrowingModel('virtualBox'),
  virtualBoxOpening: makeThrowingModel('virtualBoxOpening'),
  userCard: makeThrowingModel('userCard'),
  user: makeThrowingModel('user'),
  gachaCard: makeThrowingModel('gachaCard'),
  appSetting: makeThrowingModel('appSetting'),
  voucher: makeThrowingModel('voucher')
};

const prismaPath = require.resolve('../src/config/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prismaStub };

// Stub the auth middleware BEFORE routes load: the real `authenticate` queries
// prisma.user, which would throw a DB error before the controller under test runs.
const authPath = require.resolve('../src/middlewares/auth');
const user = { id: '00000000-0000-0000-0000-000000000001', role: 'CUSTOMER', status: 'ACTIVE' };
require.cache[authPath] = {
  id: authPath,
  filename: authPath,
  loaded: true,
  exports: {
    authenticate: (req, res, next) => {
      const header = req.headers.authorization;
      if (!header?.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: { code: 'AUTHENTICATION_ERROR', message: 'No token provided' } });
      }
      req.user = user;
      next();
    },
    authorize: (...roles) => (req, res, next) =>
      roles.includes(req.user?.role) ? next() : res.status(403).json({ success: false, error: { code: 'AUTHORIZATION_ERROR', message: 'forbidden' } }),
    requirePermission: () => (req, res, next) => next()
  }
};

const express = require('express');
const errorHandler = require('../src/middlewares/errorHandler');
const productRoutes = require('../src/routes/product.routes');
const orderRoutes = require('../src/routes/order.routes');
const settingsRoutes = require('../src/routes/settings.routes');
const gachaRoutes = require('../src/routes/gacha.routes');
const { NotFoundError } = require('../src/utils/errors');

const app = express();
app.use(express.json());
app.use('/api/v1', productRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1', settingsRoutes);
app.use('/api/v1', gachaRoutes);
app.use(errorHandler);

let server;
let baseUrl;
const token = jwt.sign({ sub: '00000000-0000-0000-0000-000000000001' }, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' });

const request = async (method, path, { body, query, auth = true } = {}) => {
  const url = new URL(`${baseUrl}${path}`);
  if (query) Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: `Bearer ${token}` } : {})
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

// ── Product endpoints ───────────────────────────────────────────────────────

test('GET /products degrades to 200 + empty page on DB failure', async () => {
  const { status, payload } = await request('GET', '/api/v1/products', { auth: false });
  assert.equal(status, 200);
  assert.equal(payload.success, true);
  assert.deepEqual(payload.data.items, []);
  assert.equal(payload.data.meta.totalItems, 0);
});

test('GET /products/:id degrades to 200 + null on DB failure (not 500)', async () => {
  const { status, payload } = await request('GET', '/api/v1/products/00000000-0000-0000-0000-000000000009', { auth: false });
  assert.equal(status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data, null);
});

test('GET /products/:id/stock degrades to 200 + zero stock on DB failure', async () => {
  const { status, payload } = await request('GET', '/api/v1/products/00000000-0000-0000-0000-000000000009/stock', { auth: false });
  assert.equal(status, 200);
  assert.equal(payload.data.stockQuantity, 0);
});

test('GET /categories degrades to 200 + empty array on DB failure', async () => {
  const { status, payload } = await request('GET', '/api/v1/categories', { auth: false });
  assert.equal(status, 200);
  assert.deepEqual(payload.data, []);
});

test('GET /sets degrades to 200 + empty array on DB failure', async () => {
  const { status, payload } = await request('GET', '/api/v1/sets', { auth: false });
  assert.equal(status, 200);
  assert.deepEqual(payload.data, []);
});

test('GET /cards degrades to 200 + empty page on DB failure', async () => {
  const { status, payload } = await request('GET', '/api/v1/cards', { auth: false });
  assert.equal(status, 200);
  assert.deepEqual(payload.data.items, []);
});

// ── Gacha / virtual box endpoints ────────────────────────────────────────────

test('GET /virtual-boxes degrades to 200 + empty page on DB failure', async () => {
  const { status, payload } = await request('GET', '/api/v1/virtual-boxes', { auth: false });
  assert.equal(status, 200);
  assert.equal(payload.success, true);
  assert.deepEqual(payload.data.items, []);
  assert.equal(payload.data.meta.totalItems, 0);
});

test('POST /virtual-boxes/:id/open returns clean 400 on DB failure (not 500)', async () => {
  const { status, payload } = await request('POST', '/api/v1/virtual-boxes/00000000-0000-0000-0000-000000000009/open');
  assert.equal(status, 400);
  assert.equal(payload.success, false);
  assert.equal(payload.error.code, 'DATABASE_ERROR');
  assert.ok(payload.error.message.length > 0);
});

// ── Order endpoints ─────────────────────────────────────────────────────────

test('GET /orders degrades to 200 + empty page on DB failure', async () => {
  const { status, payload } = await request('GET', '/api/v1/orders');
  assert.equal(status, 200);
  assert.deepEqual(payload.data.items, []);
  assert.equal(payload.data.meta.totalItems, 0);
});

test('POST /orders/checkout returns clean 400 on DB failure (not 500)', async () => {
  const { status, payload } = await request('POST', '/api/v1/orders/checkout', {
    body: {
      items: [{ productId: '00000000-0000-0000-0000-000000000002', quantity: 1 }],
      shippingAddress: {
        fullName: 'Test User', phone: '0123456789', addressLine1: '123 Test Street',
        city: 'Hanoi', country: 'Vietnam'
      },
      paymentMethod: 'SEPAY'
    }
  });
  assert.equal(status, 400);
  assert.equal(payload.success, false);
  assert.equal(payload.error.code, 'DATABASE_ERROR');
});

test('GET /orders/:id returns clean 400 on DB failure (not 500)', async () => {
  const { status, payload } = await request('GET', '/api/v1/orders/00000000-0000-0000-0000-000000000003');
  assert.equal(status, 400);
  assert.equal(payload.error.code, 'DATABASE_ERROR');
});

test('GET /orders/:id/payment-status degrades to 200 + null on DB failure', async () => {
  const { status, payload } = await request('GET', '/api/v1/orders/00000000-0000-0000-0000-000000000003/payment-status');
  assert.equal(status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data, null);
});

test('POST /orders/lookup returns clean 400 on DB failure (not 500)', async () => {
  const { status, payload } = await request('POST', '/api/v1/orders/lookup', {
    body: { query: 'TCG-20250101-ABCD1234' },
    auth: false
  });
  assert.equal(status, 400);
  assert.equal(payload.error.code, 'DATABASE_ERROR');
});

// ── Public settings endpoint ────────────────────────────────────────────────

test('GET /settings/public degrades to 200 + built-in defaults on DB failure', async () => {
  const { status, payload } = await request('GET', '/api/v1/settings/public', { auth: false });
  assert.equal(status, 200);
  assert.equal(payload.success, true);
});

// ── Operational errors keep their original statuses ─────────────────────────

test('Operational NotFoundError still returns 404 (not swallowed as DB failure)', async () => {
  // Point one stub at a NotFoundError-throwing implementation
  const originalProduct = prismaStub.product;
  prismaStub.product = new Proxy({}, {
    get: (_t, method) => {
      if (method === 'then' || method === 'catch') return undefined;
      return async () => { throw new NotFoundError('Product not found'); };
    }
  });
  try {
    const { status, payload } = await request('GET', '/api/v1/products/00000000-0000-0000-0000-000000000009', { auth: false });
    assert.equal(status, 404);
    assert.equal(payload.error.code, 'NOT_FOUND');
  } finally {
    prismaStub.product = originalProduct;
  }
});

test('Non-database unexpected errors still reach the global error handler as 500', async () => {
  const originalOrder = prismaStub.order;
  prismaStub.order = new Proxy({}, {
    get: (_t, method) => {
      if (method === 'then' || method === 'catch') return undefined;
      return async () => { throw new TypeError('unexpected bug'); };
    }
  });
  try {
    const { status, payload } = await request('GET', '/api/v1/orders');
    assert.equal(status, 500);
    assert.equal(payload.error.code, 'INTERNAL_SERVER_ERROR');
  } finally {
    prismaStub.order = originalOrder;
  }
});
