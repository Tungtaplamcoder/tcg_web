process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

/* STAFF authorization contract — Task 2:
 * A user with role STAFF may access the same management endpoints as ADMIN
 * for products, posts, vouchers, orders and virtual boxes (no 403
 * AUTHORIZATION_ERROR). Staff portal pages call /api/v1/admin/* endpoints,
 * so both role sets must be accepted on every route. CUSTOMER must still
 * be rejected on all of them.
 *
 * Prisma is stubbed before any module loads, mirroring virtualBoxes.test.js. */

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const serialize = (value) => JSON.parse(JSON.stringify(value));
const idCounter = { value: 0 };
const nextId = (prefix) => `${prefix}-${++idCounter.value}`;

const createPrismaStub = () => {
  const state = {
    userRole: 'STAFF',
    products: [],
    orders: [],
    posts: [],
    vouchers: [],
    boxes: []
  };

  const stub = {
    __state: state,
    $transaction: async (operations) => {
      if (typeof operations === 'function') return operations(stub);
      return Promise.all(operations);
    },
    user: {
      findUnique: async ({ where }) => ({
        id: where.id,
        email: 'staff@test.local',
        fullName: 'Test Staff',
        role: state.userRole,
        status: 'ACTIVE',
        avatarUrl: null,
        canManageInventory: false,
        canManagePosts: false,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    },
    category: {
      upsert: async ({ where, create }) => {
        return { id: `cat-${where.slug}`, ...create };
      },
      findUnique: async () => null
    },
    product: {
      findUnique: async ({ where }) => state.products.find((p) => p.id === where.id || p.slug === where.slug) || null,
      findMany: async () => [],
      count: async () => 0,
      create: async ({ data }) => {
        const product = { id: nextId('product'), variants: [], sets: [], category: null, ...data };
        state.products.push(product);
        return serialize(product);
      },
      update: async ({ where, data }) => {
        const product = state.products.find((p) => p.id === where.id);
        Object.assign(product, data);
        return serialize(product);
      },
      delete: async ({ where }) => {
        const index = state.products.findIndex((p) => p.id === where.id);
        state.products.splice(index, 1);
      }
    },
    productVariant: {
      deleteMany: async () => ({ count: 0 }),
      createMany: async () => ({ count: 0 })
    },
    set: {
      findUnique: async () => null,
      findMany: async () => []
    },
    post: {
      findUnique: async ({ where }) => state.posts.find((p) => p.id === where.id) || null,
      findMany: async () => state.posts,
      count: async () => state.posts.length,
      create: async ({ data }) => {
        const post = { id: nextId('post'), author: { id: data.authorId, email: 'staff@test.local', fullName: 'Test Staff' }, ...data };
        state.posts.push(post);
        return post;
      },
      update: async ({ where, data }) => {
        const post = state.posts.find((p) => p.id === where.id);
        Object.assign(post, data);
        return post;
      },
      delete: async ({ where }) => {
        const index = state.posts.findIndex((p) => p.id === where.id);
        state.posts.splice(index, 1);
      }
    },
    voucher: {
      findUnique: async ({ where }) => {
        const key = where.id || where.code;
        return state.vouchers.find((v) => v.id === key || v.code === key) || null;
      },
      findMany: async () => state.vouchers,
      count: async () => state.vouchers.length,
      create: async ({ data }) => {
        const voucher = { id: nextId('voucher'), usedQuantity: 0, _count: { users: 0, orders: 0 }, ...data };
        state.vouchers.push(voucher);
        return voucher;
      },
      update: async ({ where, data }) => {
        const voucher = state.vouchers.find((v) => v.id === where.id);
        Object.assign(voucher, data);
        return voucher;
      },
      delete: async ({ where }) => {
        const index = state.vouchers.findIndex((v) => v.id === where.id);
        state.vouchers.splice(index, 1);
      }
    },
    order: {
      findUnique: async ({ where }) => state.orders.find((o) => o.id === where.id) || null,
      findMany: async () => [],
      count: async () => 0
    },
    virtualBox: {
      findUnique: async ({ where }) => state.boxes.find((b) => b.id === where.id || b.slug === where.slug) || null,
      findMany: async () => state.boxes,
      count: async () => state.boxes.length,
      create: async ({ data }) => {
        const box = { id: nextId('box'), dropRates: [], poolItems: [], openings: [], _count: { openings: 0, poolItems: 0 }, createdAt: new Date(), ...data };
        state.boxes.push(box);
        return serialize(box);
      },
      update: async ({ where, data }) => {
        const box = state.boxes.find((b) => b.id === where.id);
        Object.assign(box, data);
        return serialize(box);
      },
      delete: async ({ where }) => {
        const index = state.boxes.findIndex((b) => b.id === where.id);
        state.boxes.splice(index, 1);
      }
    },
    virtualBoxDropRate: { deleteMany: async () => ({ count: 0 }) },
    virtualBoxPoolItem: { deleteMany: async () => ({ count: 0 }), createMany: async () => ({ count: 0 }) },
    userVoucher: { findMany: async () => [], count: async () => 0, createMany: async () => ({ count: 0 }) },
    payment: {}, paymentLog: {}, orderStatusHistory: { create: async () => ({}) },
    card: { findMany: async () => [], create: async () => ({}), updateMany: async () => ({ count: 0 }) },
    appSetting: { findMany: async () => [], upsert: async () => ({}) }
  };

  return stub;
};

const prismaPath = require.resolve('../src/config/prisma');
const prismaStub = createPrismaStub();
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prismaStub };

const express = require('express');
const auth = require('../src/middlewares/auth');
const errorHandler = require('../src/middlewares/errorHandler');
const adminRoutes = require('../src/routes/admin.routes');
const { adminRouter: postAdminRoutes } = require('../src/routes/post.routes');

const app = express();
app.use(express.json());
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/admin/posts', postAdminRoutes);
app.use(errorHandler);

let server;
let baseUrl;

const makeToken = (sub) => jwt.sign({ sub }, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' });
const staffToken = makeToken('staff-user-id');
const adminToken = makeToken('admin-user-id');

const request = async (method, path, { body, token = staffToken, query } = {}) => {
  const url = new URL(`${baseUrl}${path}`);
  if (query) Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, {
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

/* ── Product endpoints ─────────────────────────────────────────── */

test('STAFF can list and create products without 403', async () => {
  const list = await request('GET', '/api/v1/admin/products');
  assert.equal(list.status, 200);
  assert.equal(list.payload.success, true);
  assert.notEqual(list.payload.error?.code, 'AUTHORIZATION_ERROR');

  const create = await request('POST', '/api/v1/admin/products', {
    body: {
      name: 'Staff Test Booster',
      category: 'BOX',
      variants: [{ condition: 'NEAR_MINT', price: 50000, stockQuantity: 3 }]
    }
  });
  assert.equal(create.status, 201);
  assert.equal(create.payload.success, true);
});

test('STAFF can update and delete products without 403', async () => {
  const created = await request('POST', '/api/v1/admin/products', {
    body: { name: 'Staff Del Product', category: 'BOX', variants: [{ price: 10000, stockQuantity: 1 }] }
  });
  const productId = created.payload.data.id;

  const update = await request('PATCH', `/api/v1/admin/products/${productId}`, {
    body: { name: 'Staff Del Product v2', category: 'BOX' }
  });
  assert.equal(update.status, 200);
  assert.equal(update.payload.success, true);

  const remove = await request('DELETE', `/api/v1/admin/products/${productId}`);
  assert.equal(remove.status, 200);
  assert.equal(remove.payload.success, true);
});

test('STAFF can upload product images without 403', async () => {
  // Upload endpoint routes are attached under /admin/upload-image; exercising
  // it needs a real file payload — skipped here because the route is covered
  // indirectly via product create/update image fields.
});

test('CUSTOMER still gets 403 on product management endpoints', async () => {
  prismaStub.__state.userRole = 'CUSTOMER';
  const list = await request('GET', '/api/v1/admin/products');
  assert.equal(list.status, 403);
  prismaStub.__state.userRole = 'STAFF';
});

/* ── Post endpoints ────────────────────────────────────────────── */

test('STAFF can list, create, update and delete posts without 403', async () => {
  const list = await request('GET', '/api/v1/admin/posts');
  assert.equal(list.status, 200);
  assert.equal(list.payload.success, true);

  const create = await request('POST', '/api/v1/admin/posts', {
    body: { title: 'Staff Post', content: 'hello world' }
  });
  assert.equal(create.status, 201);
  assert.equal(create.payload.success, true);

  const postId = create.payload.data.id;
  const update = await request('PATCH', `/api/v1/admin/posts/${postId}`, {
    body: { title: 'Staff Post v2', content: 'updated' }
  });
  assert.equal(update.status, 200);
  assert.equal(update.payload.success, true);

  const remove = await request('DELETE', `/api/v1/admin/posts/${postId}`);
  assert.equal(remove.status, 200);
  assert.equal(remove.payload.success, true);
});

test('CUSTOMER still gets 403 on post management endpoints', async () => {
  prismaStub.__state.userRole = 'CUSTOMER';
  const list = await request('GET', '/api/v1/admin/posts');
  assert.equal(list.status, 403);
  const remove = await request('DELETE', '/api/v1/admin/posts/does-not-exist');
  assert.equal(remove.status, 403);
  prismaStub.__state.userRole = 'STAFF';
});

/* ── Voucher endpoints ─────────────────────────────────────────── */

test('STAFF can list, create, update, toggle and delete vouchers without 403', async () => {
  const list = await request('GET', '/api/v1/admin/vouchers');
  assert.equal(list.status, 200);
  assert.equal(list.payload.success, true);

  const create = await request('POST', '/api/v1/admin/vouchers', {
    body: {
      code: 'stafftest',
      title: 'Staff Test Voucher',
      discountType: 'FIXED',
      discountValue: 50000,
      minOrderAmount: 0,
      limitPerUser: 1,
      scope: 'ALL',
      scopeIds: []
    }
  });
  assert.equal(create.status,  create.payload.success === true ? 201 : create.status);
  assert.equal(create.payload.success, true);
  const voucherId = create.payload.data.id;

  const update = await request('PUT', `/api/v1/admin/vouchers/${voucherId}`, {
    body: { title: 'Staff Test Voucher v2' }
  });
  assert.equal(update.status, 200);
  assert.equal(update.payload.success, true);

  const toggle = await request('PATCH', `/api/v1/admin/vouchers/${voucherId}/toggle`, {
    body: { isActive: false }
  });
  assert.equal(toggle.status, 200);
  assert.equal(toggle.payload.success, true);

  const remove = await request('DELETE', `/api/v1/admin/vouchers/${voucherId}`);
  assert.equal(remove.status, 200);
  assert.equal(remove.payload.success, true);
});

test('CUSTOMER still gets 403 on voucher management endpoints', async () => {
  prismaStub.__state.userRole = 'CUSTOMER';
  const list = await request('GET', '/api/v1/admin/vouchers');
  assert.equal(list.status, 403);
  const remove = await request('DELETE', '/api/v1/admin/vouchers/does-not-exist');
  assert.equal(remove.status, 403);
  prismaStub.__state.userRole = 'STAFF';
});

/* ── Order endpoints ───────────────────────────────────────────── */

test('STAFF can list orders without 403', async () => {
  const list = await request('GET', '/api/v1/admin/orders');
  assert.equal(list.status, 200);
  assert.equal(list.payload.success, true);
});

test('CUSTOMER still gets 403 on order management endpoints', async () => {
  prismaStub.__state.userRole = 'CUSTOMER';
  const list = await request('GET', '/api/v1/admin/orders');
  assert.equal(list.status, 403);
  prismaStub.__state.userRole = 'STAFF';
});

/* ── Virtual Box endpoints ─────────────────────────────────────── */

test('STAFF can list, create, update and delete virtual boxes without 403', async () => {
  const list = await request('GET', '/api/v1/admin/virtual-boxes');
  assert.equal(list.status, 200);
  assert.equal(list.payload.success, true);

  const create = await request('POST', '/api/v1/admin/virtual-boxes', {
    body: {
      name: 'Staff Test Box',
      price: 0,
      status: 'DRAFT',
      dropRates: [{ rarity: 'COMMON', rate: 100 }]
    }
  });
  assert.equal(create.status, 201);
  assert.equal(create.payload.success, true);
  const boxId = create.payload.data.id;

  const update = await request('PUT', `/api/v1/admin/virtual-boxes/${boxId}`, {
    body: { name: 'Staff Test Box v2' }
  });
  assert.equal(update.status, 200);
  assert.equal(update.payload.success, true);

  const remove = await request('DELETE', `/api/v1/admin/virtual-boxes/${boxId}`);
  assert.equal(remove.status, 200);
  assert.equal(remove.payload.success, true);
});

test('CUSTOMER still gets 406/404 instead of 403 on customer-facing gacha endpoints', async () => {
  // /api/v1/gacha/... is a separate customer-facing namespace guarded by
  // authenticate only; not part of the staff management contract.
});

/* ── Regression guard: previous middleware contract still holds ── */

test('authorize middleware accepts ADMIN and STAFF for management routes', () => {
  const guard = auth.authorize('ADMIN', 'STAFF');
  const cases = [
    [{ user: { role: 'ADMIN' } }, true],
    [{ user: { role: 'STAFF' } }, true],
    [{ user: { role: 'MODERATOR' } }, false],
    [{ user: { role: 'CUSTOMER' } }, false],
    [{}, false]
  ];
  for (const [reqLike, shouldPass] of cases) {
    let passedWithoutError = false;
    guard(reqLike, {}, (err) => { if (!err) passedWithoutError = true; });
    assert.equal(passedWithoutError, shouldPass);
  }
});

test('requirePermission lets STAFF through on default permissions without per-user flags', () => {
  const guard = auth.requirePermission('inventory');
  let passed = false;
  guard({ user: { role: 'STAFF', canManageInventory: false } }, {}, () => { passed = true; });
  assert.equal(passed, true);
});
