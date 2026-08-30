process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

let idCounter = 0;
const nextId = (prefix) => `${prefix}-${++idCounter}`;

const serialize = (value) => JSON.parse(JSON.stringify(value));

const createPrismaStub = () => {
  const calls = [];
  const state = {
    boxes: [],
    products: [
      { id: '11111111-1111-1111-1111-111111111111' },
      { id: '22222222-2222-2222-2222-222222222222' }
    ],
    cards: [{ id: '33333333-3333-3333-3333-333333333333' }],
    userRole: 'ADMIN',
    appSettings: {}
  };

  const record = (name, args) => calls.push({ name, args });

  const findBox = (where) => state.boxes.find(
    (box) => (where.id !== undefined && box.id === where.id) || (where.slug !== undefined && box.slug === where.slug)
  );

  const applyVirtualBoxData = (box, data) => {
    const { dropRates, pool, ...scalar } = data;
    Object.assign(box, scalar);
    if (dropRates && dropRates.create) box.dropRates = dropRates.create.map((entry) => ({ id: nextId('dr'), boxId: box.id, ...entry }));
    if (pool && pool.create) {
      box.pool = pool.create.map((entry) => ({ id: nextId('pool'), boxId: box.id, createdAt: new Date(), ...entry }));
      // Mirror into poolItems like the real controller does
      const seen = new Set();
      box.poolItems = box.pool
        .filter((entry) => entry.productId && !seen.has(entry.productId) && seen.add(entry.productId))
        .map((entry) => ({ id: nextId('poolItem'), boxId: box.id, productId: entry.productId, rarity: entry.rarity || 'COMMON' }));
    }
    box.updatedAt = new Date();
    return box;
  };

  const toResponse = (box) => serialize({
    ...box,
    dropRates: box.dropRates || [],
    pool: box.pool || [],
    poolItems: box.poolItems || [],
    openings: box.openings || [],
    _count: { pool: (box.pool || []).length, openings: (box.openings || []).length, poolItems: (box.poolItems || []).length }
  });

  const stub = {
    __calls: calls,
    __state: state,
    $transaction: async (operations) => {
      if (typeof operations === 'function') return operations(stub);
      return Promise.all(operations);
    },
    appSetting: {
      findMany: async ({ where = {} }) => {
        record('appSetting.findMany', where);
        const prefix = where.key?.startsWith || 'sepay:';
        return Object.entries(state.appSettings)
          .filter(([key]) => key.startsWith(prefix))
          .map(([key, value]) => ({ key, value, updatedAt: new Date() }));
      },
      upsert: async ({ where, update, create }) => {
        record('appSetting.upsert', { where, update, create });
        if (state.appSettings[where.key]) state.appSettings[where.key] = update.value;
        else state.appSettings[create.key] = create.value;
        return { key: where.key, value: (update || create).value, updatedAt: new Date() };
      }
    },
    user: {
      findUnique: async ({ where }) => {
        record('user.findUnique', where);
        return {
          id: where.id, email: 'admin@test.local', fullName: 'Test Admin',
          role: state.userRole, status: 'ACTIVE', avatarUrl: null,
          canManageInventory: true, canManagePosts: true, canAccessChat: true,
          createdAt: new Date(), updatedAt: new Date()
        };
      }
    },
    product: {
      findUnique: async ({ where }) => {
        record('product.findUnique', where);
        return state.products.find((p) => p.id === where.id) || null;
      },
      findMany: async ({ where }) => {
        record('product.findMany', where);
        return state.products.filter((p) => where?.id?.in?.includes(p.id)).map((p) => ({ id: p.id }));
      },
      create: async ({ data }) => {
        record('product.create', data);
        const created = { id: nextId('product'), ...data };
        state.products.push(created);
        return created;
      }
    },
    card: {
      findMany: async ({ where }) => {
        record('card.findMany', where);
        return state.cards.filter((c) => where?.id?.in?.includes(c.id)).map((c) => ({ id: c.id }));
      }
    },
    virtualBox: {
      findUnique: async ({ where }) => {
        record('virtualBox.findUnique', where);
        const box = findBox(where);
        return box ? toResponse(box) : null;
      },
      findMany: async ({ where = {}, skip = 0, take = 20 }) => {
        record('virtualBox.findMany', { where, skip, take });
        let list = [...state.boxes];
        if (where.status) list = list.filter((box) => box.status === where.status);
        if (where.OR) {
          const terms = where.OR.map((clause) => clause.name?.contains || clause.slug?.contains).filter(Boolean).map((s) => s.toLowerCase());
          list = list.filter((box) => terms.some((term) => box.name.toLowerCase().includes(term) || box.slug.toLowerCase().includes(term)));
        }
        list.sort((a, b) => b.createdAt - a.createdAt);
        return list.slice(skip, skip + take).map(toResponse);
      },
      count: async ({ where = {} }) => {
        record('virtualBox.count', where);
        let list = [...state.boxes];
        if (where.status) list = list.filter((box) => box.status === where.status);
        return list.length;
      },
      create: async ({ data }) => {
        record('virtualBox.create', data);
        const box = {
          id: nextId('box'),
          name: data.name,
          slug: data.slug,
          description: data.description ?? null,
          imageUrl: data.imageUrl ?? null,
          gradient: data.gradient ?? null,
          price: data.price,
          status: data.status || 'DRAFT',
          dropRates: [],
          pool: [],
          poolItems: [],
          openings: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };
        applyVirtualBoxData(box, data);
        state.boxes.push(box);
        return toResponse(box);
      },
      update: async ({ where, data }) => {
        record('virtualBox.update', { where, data });
        const box = findBox(where);
        if (!box) throw Object.assign(new Error('Record not found'), { code: 'P2025' });
        applyVirtualBoxData(box, data);
        return toResponse(box);
      },
      delete: async ({ where }) => {
        record('virtualBox.delete', where);
        const index = state.boxes.findIndex((box) => box.id === where.id);
        const [removed] = state.boxes.splice(index, 1);
        return toResponse(removed);
      }
    },
    virtualBoxDropRate: {
      deleteMany: async ({ where }) => {
        record('virtualBoxDropRate.deleteMany', where);
        const box = findBox({ id: where.boxId });
        if (box) box.dropRates = [];
        return { count: 0 };
      }
    },
    virtualBoxPool: {
      deleteMany: async ({ where }) => {
        record('virtualBoxPool.deleteMany', where);
        const box = findBox({ id: where.boxId });
        if (box) box.pool = [];
        return { count: 0 };
      }
    },
    virtualBoxPoolItem: {
      deleteMany: async ({ where }) => {
        record('virtualBoxPoolItem.deleteMany', where);
        const box = findBox({ id: where.boxId });
        if (box) box.poolItems = [];
        return { count: 0 };
      },
      createMany: async ({ data }) => {
        record('virtualBoxPoolItem.createMany', data);
        const box = findBox({ id: data[0].boxId });
        if (box) box.poolItems = data.map((item) => ({ id: nextId('poolItem'), ...item }));
        return { count: data.length };
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
const {
  createVirtualBoxSchema,
  updateVirtualBoxSchema,
  listVirtualBoxesQuerySchema
} = require('../src/schemas/admin.schema');

const app = express();
app.use(express.json());
app.use('/api/v1/admin', adminRoutes);
app.use(errorHandler);

let server;
let baseUrl;
const adminToken = jwt.sign({ sub: 'admin-user-id' }, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' });

const request = async (method, path, { body, token = adminToken, query } = {}) => {
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

const VALID_BOX = {
  name: 'Genesis Starter Box',
  description: 'First virtual box',
  imageUrl: 'https://cdn.example.com/genesis.png',
  gradient: 'from-violet-500 to-fuchsia-500',
  price: 24.99,
  status: 'ACTIVE',
  dropRates: [
    { rarity: 'COMMON', rate: 60 },
    { rarity: 'RARE', rate: 25 },
    { rarity: 'EPIC', rate: 10 },
    { rarity: 'LEGENDARY', rate: 5 }
  ],
  pool: [
    { productId: '11111111-1111-1111-1111-111111111111', rarity: 'COMMON', weight: 3 },
    { cardId: '33333333-3333-3333-3333-333333333333', rarity: 'LEGENDARY', weight: 1 }
  ]
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

test('createVirtualBoxSchema accepts a valid payload', () => {
  const result = createVirtualBoxSchema.safeParse(VALID_BOX);
  assert.equal(result.success, true);
  assert.equal(result.data.slug, undefined);
  assert.equal(result.data.pool[1].weight, 1);
});

test('createVirtualBoxSchema rejects invalid name, price, status and rarity', () => {
  assert.equal(createVirtualBoxSchema.safeParse({ ...VALID_BOX, name: 'X' }).success, false);
  assert.equal(createVirtualBoxSchema.safeParse({ ...VALID_BOX, price: -1 }).success, false);
  assert.equal(createVirtualBoxSchema.safeParse({ ...VALID_BOX, status: 'LIVE' }).success, false);
  const badRarity = createVirtualBoxSchema.safeParse({ ...VALID_BOX, dropRates: [{ rarity: 'MYTHIC', rate: 100 }] });
  assert.equal(badRarity.success, false);
  assert.equal(createVirtualBoxSchema.safeParse({ ...VALID_BOX }).error, undefined);
});

test('createVirtualBoxSchema requires drop rates to total 100%', () => {
  const result = createVirtualBoxSchema.safeParse({
    ...VALID_BOX,
    dropRates: [
      { rarity: 'COMMON', rate: 60 },
      { rarity: 'RARE', rate: 30 }
    ]
  });
  assert.equal(result.success, false);
  assert.ok(result.error.errors.some((issue) => issue.path.join('.') === 'dropRates'));
});

test('createVirtualBoxSchema rejects pool entries without productId, cardId or name', () => {
  const result = createVirtualBoxSchema.safeParse({ ...VALID_BOX, pool: [{ rarity: 'COMMON', weight: 2 }] });
  assert.equal(result.success, false);
});

test('createVirtualBoxSchema accepts free-form pool entries with name and imageUrl', () => {
  const result = createVirtualBoxSchema.safeParse({
    ...VALID_BOX,
    pool: [
      { name: 'Charizard VMAX', imageUrl: 'https://cdn.example.com/charizard.png', rarity: 'Legendary', weight: 1 },
      { name: 'Pikachu', rarity: 'Common' }
    ]
  });
  assert.equal(result.success, true);
  assert.equal(result.data.pool[0].weight, 1);
  assert.equal(result.data.pool[1].name, 'Pikachu');
});

test('updateVirtualBoxSchema allows partial payloads but still validates drop rates', () => {
  assert.equal(updateVirtualBoxSchema.safeParse({ status: 'ACTIVE' }).success, true);
  assert.equal(updateVirtualBoxSchema.safeParse({ price: 9.99 }).success, true);
  assert.equal(updateVirtualBoxSchema.safeParse({}).success, true);
  const badRates = updateVirtualBoxSchema.safeParse({ dropRates: [{ rarity: 'RARE', rate: 90 }] });
  assert.equal(badRates.success, false);
});

test('listVirtualBoxesQuerySchema coerces numbers and validates enum filters', () => {
  const ok = listVirtualBoxesQuerySchema.safeParse({ page: '2', limit: '5', status: 'DRAFT', search: 'gen' });
  assert.equal(ok.success, true);
  assert.equal(ok.data.page, 2);
  assert.equal(ok.data.limit, 5);
  assert.equal(listVirtualBoxesQuerySchema.safeParse({ status: 'LIVE' }).success, false);
  assert.equal(listVirtualBoxesQuerySchema.safeParse({ limit: '500' }).success, false);
});

test('rejects unauthenticated requests', async () => {
  const { status } = await request('GET', '/api/v1/admin/virtual-boxes', { token: null });
  assert.equal(status, 401);
});

test('POST /virtual-boxes rejects invalid input with validation details', async () => {
  const { status, payload } = await request('POST', '/api/v1/admin/virtual-boxes', {
    body: { name: 'X', price: -5, status: 'LIVE' }
  });
  assert.equal(status, 400);
  assert.equal(payload.success, false);
  assert.equal(payload.error.code, 'VALIDATION_ERROR');
  assert.ok(Array.isArray(payload.error.details));
  const fields = payload.error.details.map((detail) => detail.field);
  assert.ok(fields.includes('name'));
  assert.ok(fields.includes('price'));
});

test('POST /virtual-boxes accepts a payload without price (defaults to 0)', () => {
  const result = createVirtualBoxSchema.safeParse({
    name: 'Free Pool Box',
    dropRates: [{ rarity: 'COMMON', rate: 100 }]
  });
  assert.equal(result.success, true);
  assert.equal(result.data.price, 0);
});

test('POST /virtual-boxes rejects drop rates that do not total 100%', async () => {
  const { status, payload } = await request('POST', '/api/v1/admin/virtual-boxes', {
    body: {
      ...VALID_BOX,
      dropRates: [
        { rarity: 'COMMON', rate: 50 },
        { rarity: 'RARE', rate: 49 }
      ]
    }
  });
  assert.equal(status, 400);
  assert.ok(payload.error.details.some((detail) => detail.field === 'dropRates'));
});

test('POST /virtual-boxes rejects unknown pool references', async () => {
  const { status, payload } = await request('POST', '/api/v1/admin/virtual-boxes', {
    body: {
      name: 'Broken Pool Box',
      price: 10,
      pool: [{ productId: '99999999-9999-9999-9999-999999999999', weight: 1 }]
    }
  });
  assert.equal(status, 400);
  assert.equal(payload.error.code, 'VALIDATION_ERROR');
  assert.match(payload.error.message, /Unknown product\/card references/);
});

test('POST /virtual-boxes creates a box with drop rates and pool', async () => {
  const { status, payload } = await request('POST', '/api/v1/admin/virtual-boxes', { body: VALID_BOX });
  assert.equal(status, 201);
  assert.equal(payload.success, true);
  assert.equal(payload.data.name, VALID_BOX.name);
  assert.equal(payload.data.slug, 'genesis-starter-box');
  assert.equal(payload.data.status, 'ACTIVE');
  assert.equal(payload.data.dropRates.length, 4);
  assert.equal(payload.data.pool.length, 2);
  assert.equal(payload.data.pool[0].productId, VALID_BOX.pool[0].productId);
  assert.equal(payload.data.pool[1].cardId, VALID_BOX.pool[1].cardId);
});

test('POST /virtual-boxes rejects a duplicate slug as conflict', async () => {
  const { status, payload } = await request('POST', '/api/v1/admin/virtual-boxes', { body: VALID_BOX });
  assert.equal(status, 409);
  assert.equal(payload.error.code, 'CONFLICT');
});

test('GET /virtual-boxes returns paginated items and meta', async () => {
  const { status, payload } = await request('GET', '/api/v1/admin/virtual-boxes', { query: { page: 1, limit: 10 } });
  assert.equal(status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data.meta.totalItems, 1);
  assert.equal(payload.data.meta.totalPages, 1);
  assert.equal(payload.data.items.length, 1);
  assert.equal(payload.data.items[0].dropRates.length, 4);
});

test('GET /virtual-boxes rejects an invalid status filter', async () => {
  const { status, payload } = await request('GET', '/api/v1/admin/virtual-boxes', { query: { status: 'LIVE' } });
  assert.equal(status, 400);
  assert.equal(payload.error.code, 'VALIDATION_ERROR');
});

test('PUT /virtual-boxes/:id updates scalar fields and replaces drop rates/pool', async () => {
  const box = prismaStub.__state.boxes[0];
  const { status, payload } = await request('PUT', `/api/v1/admin/virtual-boxes/${box.id}`, {
    body: {
      price: 29.99,
      dropRates: [
        { rarity: 'COMMON', rate: 70 },
        { rarity: 'LEGENDARY', rate: 30 }
      ],
      pool: [{ productId: '22222222-2222-2222-2222-222222222222', rarity: 'EPIC', weight: 5 }]
    }
  });
  assert.equal(status, 200);
  assert.equal(payload.success, true);
  assert.equal(Number(payload.data.price), 29.99);
  assert.equal(payload.data.dropRates.length, 2);
  assert.equal(payload.data.pool.length, 1);
  assert.equal(payload.data.pool[0].weight, 5);
  const deleteCalls = prismaStub.__calls.filter((call) => call.name === 'virtualBoxDropRate.deleteMany');
  assert.equal(deleteCalls.length, 1);
});

test('PUT /virtual-boxes/:id rejects invalid drop rates', async () => {
  const box = prismaStub.__state.boxes[0];
  const { status } = await request('PUT', `/api/v1/admin/virtual-boxes/${box.id}`, {
    body: { dropRates: [{ rarity: 'COMMON', rate: 10 }] }
  });
  assert.equal(status, 400);
});

test('PUT /virtual-boxes/:id returns 404 for unknown box', async () => {
  const { status, payload } = await request('PUT', '/api/v1/admin/virtual-boxes/00000000-0000-0000-0000-000000000000', {
    body: { price: 15 }
  });
  assert.equal(status, 404);
  assert.equal(payload.error.code, 'NOT_FOUND');
});

test('DELETE /virtual-boxes/:id archives the box by default', async () => {
  const box = prismaStub.__state.boxes[0];
  const { status, payload } = await request('DELETE', `/api/v1/admin/virtual-boxes/${box.id}`);
  assert.equal(status, 200);
  assert.match(payload.message, /archived/i);
  assert.equal(box.status, 'ARCHIVED');
});

test('DELETE /virtual-boxes/:id conflicts when already archived', async () => {
  const box = prismaStub.__state.boxes[0];
  const { status, payload } = await request('DELETE', `/api/v1/admin/virtual-boxes/${box.id}`);
  assert.equal(status, 409);
  assert.equal(payload.error.code, 'CONFLICT');
});

test('DELETE /virtual-boxes/:id?permanent=true is blocked when openings exist', async () => {
  const box = prismaStub.__state.boxes[0];
  box.openings = [{ id: 'opening-1' }];
  const { status, payload } = await request('DELETE', `/api/v1/admin/virtual-boxes/${box.id}`, {
    query: { permanent: 'true' }
  });
  assert.equal(status, 409);
  assert.match(payload.error.message, /opening history/i);
});

test('DELETE /virtual-boxes/:id?permanent=true hard deletes when no openings', async () => {
  const box = prismaStub.__state.boxes[0];
  box.openings = [];
  const before = prismaStub.__state.boxes.length;
  const { status, payload } = await request('DELETE', `/api/v1/admin/virtual-boxes/${box.id}`, {
    query: { permanent: 'true' }
  });
  assert.equal(status, 200);
  assert.match(payload.message, /deleted permanently/i);
  assert.equal(prismaStub.__state.boxes.length, before - 1);
});

test('non-admin roles cannot manage virtual boxes', async () => {
  prismaStub.__state.userRole = 'CUSTOMER';
  const list = await request('GET', '/api/v1/admin/virtual-boxes');
  assert.equal(list.status, 403);
  const create = await request('POST', '/api/v1/admin/virtual-boxes', { body: VALID_BOX });
  assert.equal(create.status, 403);
  prismaStub.__state.userRole = 'ADMIN';
});

// ==================== CARD POOL MANAGER (name-based pool) ====================

test('POST /virtual-boxes creates products for free-form pool entries and mirrors them into poolItems', async () => {
  const { status, payload } = await request('POST', '/api/v1/admin/virtual-boxes', {
    body: {
      name: 'Card Pool Manager Box',
      price: 19.99,
      dropRates: [
        { rarity: 'COMMON', rate: 70 },
        { rarity: 'LEGENDARY', rate: 30 }
      ],
      pool: [
        { name: 'Charizard VMAX', imageUrl: 'https://cdn.example.com/charizard.png', rarity: 'Legendary' },
        { name: 'Pikachu', rarity: 'Common' }
      ]
    }
  });
  assert.equal(status, 201);
  assert.equal(payload.success, true);
  // Products created on demand for each free-form entry
  const productCreates = prismaStub.__calls.filter((call) => call.name === 'product.create');
  assert.equal(productCreates.length, 2);
  assert.equal(productCreates[0].args.name, 'Charizard VMAX');
  assert.ok(String(productCreates[0].args.slug).includes('charizard'));
  // Pool mirrored into poolItems for the gacha opener
  const box = prismaStub.__state.boxes.find((b) => b.name === 'Card Pool Manager Box');
  assert.ok(box);
  assert.equal(box.pool.length, 2);
  assert.equal(box.poolItems.length, 2);
  assert.equal(box.poolItems[0].rarity, 'LEGENDARY');
  // cardPoolCount reported back equals distinct products in pool
  assert.equal(payload.data.cardPoolCount, 2);
});

test('PUT /virtual-boxes replaces the pool and re-syncs poolItems', async () => {
  const box = prismaStub.__state.boxes.find((b) => b.name === 'Card Pool Manager Box');
  const { status, payload } = await request('PUT', `/api/v1/admin/virtual-boxes/${box.id}`, {
    body: {
      pool: [{ name: 'Mewtwo', rarity: 'Epic' }]
    }
  });
  assert.equal(status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data.pool.length, 1);
  assert.equal(payload.data.poolItems.length, 1);
  assert.equal(payload.data.poolItems[0].rarity, 'EPIC');
  assert.equal(payload.data.cardPoolCount, 1);
});

// ==================== SEPAY SETTINGS ====================

test('GET /settings/sepay returns env defaults when no DB record exists', async () => {
  const { status, payload } = await request('GET', '/api/v1/admin/settings/sepay');
  assert.equal(status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data.source, 'env-defaults');
  assert.equal(typeof payload.data.apiUrl, 'string');
  assert.ok(payload.data.apiUrl.length > 0);
});

test('PUT /settings/sepay saves overrides to the database and reports source=database', async () => {
  const { status, payload } = await request('PUT', '/api/v1/admin/settings/sepay', {
    body: {
      apiUrl: 'https://sepay.example.com',
      webhookSecret: 'whsec_test_123',
      accountNumber: '123456789',
      accountName: 'TCG SHOP'
    }
  });
  assert.equal(status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data.source, 'database');
  assert.equal(payload.data.apiUrl, 'https://sepay.example.com');
  assert.equal(payload.data.accountNumber, '123456789');

  const stored = prismaStub.__state.appSettings['sepay:accountName'];
  assert.equal(stored, 'TCG SHOP');

  const reloaded = await request('GET', '/api/v1/admin/settings/sepay');
  assert.equal(reloaded.payload.data.source, 'database');
  assert.equal(reloaded.payload.data.accountName, 'TCG SHOP');
});

test('PUT /settings/sepay rejects invalid payloads with validation details', async () => {
  const { status, payload } = await request('PUT', '/api/v1/admin/settings/sepay', {
    body: { apiUrl: 'not-a-url', webhookSecret: '', accountNumber: '', accountName: '' }
  });
  assert.equal(status, 400);
  assert.equal(payload.error.code, 'VALIDATION_ERROR');
});

test('changeUserPasswordSchema only enforces the 8-character minimum', () => {
  const { changeUserPasswordSchema } = require('../src/schemas/admin.schema');
  assert.equal(changeUserPasswordSchema.safeParse({ newPassword: 'simplepass' }).success, true);
  assert.equal(changeUserPasswordSchema.safeParse({ newPassword: 'short' }).success, false);
});
