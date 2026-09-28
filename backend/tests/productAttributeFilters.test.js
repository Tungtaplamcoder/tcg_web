process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

/* Dynamic product attribute filtering contract:
 *   - /products supports combinable filters: category (semantic key,
 *     canonical slug, legacy alias), set (slug or expansion code),
 *     language, rarity, cardSet — language/rarity accept multi-values
 *     ("JP,ENG").
 *   - /products/facets returns sibling-count facet lists.
 *   - Categories NEVER encode language/rarity: the taxonomy resolves
 *     only BOX (sealed-products) / CARD (single-cards), everything else
 *     is a Product attribute.
 * Prisma is stubbed before any route loads, mirroring virtualBoxes.test.js. */

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const CATEGORIES = [
  { id: 'cat-sealed', name: 'Sealed Products', slug: 'sealed-products', description: 'Sealed booster boxes, ETBs and special collections', isActive: true },
  { id: 'cat-cards', name: 'Single Cards', slug: 'single-cards', description: 'Authenticated singles and chase cards', isActive: true }
];

const SETS = [
  { id: 'set-vv', name: 'Vivid Voltage', slug: 'vivid-voltage', code: 'SWSH04' },
  { id: 'set-vu', name: 'VSTAR Universe', slug: 'vstar-universe', code: 'S12a' }
];

const PRODUCTS = [
  { id: 'p1', name: 'Mew VMAX SAR', slug: 'mew-vmax-sar', status: 'ACTIVE', categoryId: 'cat-cards', language: 'JP', rarity: 'SAR', cardSet: 'VSTAR Universe', setIds: ['set-vu'], search: 'mew vstar universe' },
  { id: 'p2', name: 'Charizard ex SIR', slug: 'charizard-ex-sir', status: 'ACTIVE', categoryId: 'cat-cards', language: 'ENG', rarity: 'SIR', cardSet: 'Vivid Voltage', setIds: ['set-vv'], search: 'charizard vivid voltage' },
  { id: 'p3', name: 'Booster Box', slug: 'booster-box', status: 'ACTIVE', categoryId: 'cat-sealed', language: null, rarity: null, cardSet: null, setIds: [], search: 'booster' }
];

const prismaCalls = [];

const matchesProduct = (product, where) => {
  // Minimal where evaluator covering the filters the service builds
  if (where.status && product.status !== where.status) return false;
  if (where.categoryId && product.categoryId !== where.categoryId) return false;
  if (where.category && !CATEGORIES.some((c) => c.id === product.categoryId && c.slug === where.category.slug)) return false;
  if (where.language !== undefined) {
    if (typeof where.language === 'string' && product.language !== where.language) return false;
    if (where.language && where.language.in && !where.language.in.includes(product.language)) return false;
  }
  if (where.rarity !== undefined) {
    if (typeof where.rarity === 'string' && product.rarity !== where.rarity) return false;
    if (where.rarity && where.rarity.in && !where.rarity.in.includes(product.rarity)) return false;
  }
  if (where.cardSet && where.cardSet.contains && !(product.cardSet || '').includes(where.cardSet.contains)) return false;
  if (where.sets && where.sets.some) {
    const matched = SETS.some((s) => s.id !== undefined && product.setIds.includes(s.id));
    const setFilter = where.sets.some;
    const slugMatch = setFilter.OR && setFilter.OR.some((cond) => cond.slug && SETS.some((s) => s.slug === cond.slug && product.setIds.includes(s.id)));
    const codeMatch = setFilter.OR && setFilter.OR.some((cond) => cond.code && SETS.some((s) => s.code === cond.code && product.setIds.includes(s.id)));
    if (!slugMatch && !codeMatch) return false;
  }
  return true;
};

const prismaStub = {
  product: {
    findMany: async ({ where, include }) => {
      prismaCalls.push({ model: 'product', op: 'findMany', where });
      return PRODUCTS
        .filter((p) => matchesProduct(p, where || {}))
        .map((p) => ({
          ...p,
          sets: SETS.filter((s) => p.setIds.includes(s.id)),
          category: CATEGORIES.find((c) => c.id === p.categoryId),
          variants: []
        }));
    },
    count: async ({ where }) => {
      prismaCalls.push({ model: 'product', op: 'count', where });
      return PRODUCTS.filter((p) => matchesProduct(p, where || {})).length;
    },
    groupBy: async ({ by, where, _count }) => {
      prismaCalls.push({ model: 'product', op: 'groupBy', by, where });
      const attribute = by[0];
      const rows = {};
      for (const product of PRODUCTS) {
        if (!matchesProduct(product, where || {})) continue;
        const key = product[attribute];
        if (key === null || key === undefined || key === '') continue;
        rows[key] = (rows[key] || 0) + 1;
      }
      return Object.entries(rows).map(([value, count]) => ({ [attribute]: value, _count: { _all: count } }));
    },
    findUnique: async ({ where }) => {
      prismaCalls.push({ model: 'product', op: 'findUnique', where });
      const product = PRODUCTS.find((p) => p.id === where.id) || null;
      if (!product) return null;
      return { ...product, sets: SETS.filter((s) => product.setIds.includes(s.id)), category: CATEGORIES.find((c) => c.id === product.categoryId), variants: [] };
    }
  },
  set: {
    findMany: async ({ where, select, orderBy }) => {
      prismaCalls.push({ model: 'set', op: 'findMany', where });
      return SETS.map((s) => ({
        id: s.id, name: s.name, slug: s.slug, code: s.code,
        _count: { products: PRODUCTS.filter((p) => p.setIds.includes(s.id)).length }
      }));
    }
  },
  category: {
    findMany: async ({ where }) => {
      prismaCalls.push({ model: 'category', op: 'findMany', where });
      return CATEGORIES.filter((c) => !where?.isActive || c.isActive).map((c) => ({ ...c, _count: { products: PRODUCTS.filter((p) => p.categoryId === c.id).length } }));
    }
  }
};

const prismaPath = require.resolve('../src/config/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prismaStub };

const productRoutes = require('../src/routes/product.routes');
const { resolveProductCategoryKey, PRODUCT_CATEGORIES } = require('../src/constants/productCategories');
const { productQuerySchema, productFacetQuerySchema } = require('../src/schemas/product.schema');
const productService = require('../src/services/product.service');
const errorHandler = require('../src/middlewares/errorHandler');

const app = express();
app.use(express.json());
app.use('/api/v1', productRoutes);
app.use(errorHandler);

let server;
let baseUrl;

const request = async (method, path, { query } = {}) => {
  const url = new URL(`${baseUrl}${path}`);
  if (query) Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, { method });
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

// ---------- category taxonomy ----------

test('category taxonomy stays minimal — no language/rarity hardcoded', () => {
  const keys = Object.keys(PRODUCT_CATEGORIES);
  assert.deepEqual(keys.sort(), ['BOX', 'CARD']);
  assert.equal(PRODUCT_CATEGORIES.BOX.slug, 'sealed-products');
  assert.equal(PRODUCT_CATEGORIES.CARD.slug, 'single-cards');
  // Language/rarity values never appear in the category tree
  const serialized = JSON.stringify(PRODUCT_CATEGORIES);
  for (const forbidden of ['JP', 'ENG', 'SAR', 'SIR', 'AR', 'IR', 'SR', 'RR']) {
    assert.equal(serialized.includes(`:"${forbidden}"`), false, `rarity/language ${forbidden} leaked into categories`);
  }
});

test('resolveProductCategoryKey accepts keys, canonical slugs and legacy aliases', () => {
  assert.equal(resolveProductCategoryKey('BOX'), 'BOX');
  assert.equal(resolveProductCategoryKey('CARD'), 'CARD');
  assert.equal(resolveProductCategoryKey('sealed-products'), 'BOX');
  assert.equal(resolveProductCategoryKey('single-cards'), 'CARD');
  // legacy aliases keep old deep links working
  assert.equal(resolveProductCategoryKey('box'), 'BOX');
  assert.equal(resolveProductCategoryKey('card'), 'CARD');
  assert.equal(resolveProductCategoryKey('SingleCards'), 'CARD');
  // unknown values never resolve
  assert.equal(resolveProductCategoryKey('JP'), null);
  assert.equal(resolveProductCategoryKey('SAR'), null);
  assert.equal(resolveProductCategoryKey('pokemon'), null);
});

// ---------- query schema ----------

test('productQuerySchema accepts multi-value language/rarity', () => {
  const parsed = productQuerySchema.safeParse({
    category: 'single-cards',
    language: 'JP,ENG',
    rarity: 'SAR',
    set: 'S12a',
    page: '1'
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.language, 'JP,ENG');
  assert.equal(parsed.data.rarity, 'SAR');
  assert.equal(parsed.data.set, 'S12a');
});

test('productFacetQuerySchema accepts sibling filters', () => {
  const parsed = productFacetQuerySchema.safeParse({ category: 'single-cards', rarity: 'SAR' });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.category, 'single-cards');
});

// ---------- where builder (service contract) ----------

test('buildProductWhere combines category + language + rarity + set', () => {
  const where = productService.buildProductWhere({
    category: 'single-cards',
    language: 'JP',
    rarity: 'SAR',
    set: 'S12a'
  });
  assert.equal(where.category.slug, 'single-cards');
  assert.equal(where.language, 'JP');
  assert.equal(where.rarity, 'SAR');
  assert.equal(where.sets.some.OR.length, 2); // slug OR code lookup
  // The provided value is matched against BOTH the slug and the code
  assert.deepEqual(
    where.sets.some.OR.map((cond) => cond.slug ? `slug:${cond.slug}` : `code:${cond.code}`).sort(),
    ['code:S12a', 'slug:S12a']
  );
});

test('buildProductWhere resolves legacy category aliases', () => {
  assert.equal(productService.buildProductWhere({ category: 'card' }).category.slug, 'single-cards');
  assert.equal(productService.buildProductWhere({ category: 'box' }).category.slug, 'sealed-products');
  assert.equal(productService.buildProductWhere({ category: 'CARD' }).category.slug, 'single-cards');
});

test('buildProductWhere passes unknown categories through instead of throwing', () => {
  const where = productService.buildProductWhere({ category: 'some-future-slug' });
  assert.equal(where.category.slug, 'some-future-slug');
});

test('buildProductWhere expands multi-value language lists', () => {
  const where = productService.buildProductWhere({ language: 'JP, ENG' });
  assert.deepEqual(where.language.in, ['JP', 'ENG']);
  const single = productService.buildProductWhere({ language: 'JP' });
  assert.equal(single.language, 'JP');
});

// ---------- HTTP endpoints (stubbed prisma) ----------

test('GET /products filters by category + language + rarity combination', async () => {
  const { status, payload } = await request('GET', '/api/v1/products', {
    query: { category: 'single-cards', language: 'JP', rarity: 'SAR' }
  });
  assert.equal(status, 200);
  assert.equal(payload.success, true);
  const names = payload.data.items.map((p) => p.name);
  assert.deepEqual(names, ['Mew VMAX SAR']);
});

test('GET /products multi-value language filter matches both values', async () => {
  const { payload } = await request('GET', '/api/v1/products', { query: { language: 'JP,ENG' } });
  const names = payload.data.items.map((p) => p.name).sort();
  assert.deepEqual(names, ['Charizard ex SIR', 'Mew VMAX SAR']);
});

test('GET /products filters by set expansion code', async () => {
  const { payload } = await request('GET', '/api/v1/products', { query: { set: 'S12a' } });
  assert.deepEqual(payload.data.items.map((p) => p.name), ['Mew VMAX SAR']);
});

test('GET /products filters by set slug', async () => {
  const { payload } = await request('GET', '/api/v1/products', { query: { set: 'vivid-voltage' } });
  assert.deepEqual(payload.data.items.map((p) => p.name), ['Charizard ex SIR']);
});

test('GET /products legacy category alias still resolves', async () => {
  const { payload } = await request('GET', '/api/v1/products', { query: { category: 'card' } });
  const names = payload.data.items.map((p) => p.name).sort();
  assert.deepEqual(names, ['Charizard ex SIR', 'Mew VMAX SAR']);
});

test('GET /products unknown category matches nothing (no 500)', async () => {
  const { status, payload } = await request('GET', '/api/v1/products', { query: { category: 'JP-only' } });
  assert.equal(status, 200);
  assert.deepEqual(payload.data.items, []);
});

test('GET /products/facets returns attribute values with counts', async () => {
  const { status, payload } = await request('GET', '/api/v1/products/facets');
  assert.equal(status, 200);
  const { languages, rarities, cardSets, sets, categories } = payload.data;
  assert.deepEqual(languages.map((l) => l.value).sort(), ['ENG', 'JP']);
  assert.deepEqual(rarities.map((r) => r.value).sort(), ['SAR', 'SIR']);
  assert.deepEqual(cardSets.map((c) => c.value).sort(), ['VSTAR Universe', 'Vivid Voltage']);
  assert.ok(sets.some((s) => s.code === 'S12a'));
  assert.deepEqual(categories.map((c) => c.slug).sort(), ['sealed-products', 'single-cards']);
  // counts are sibling-aware: language facet unaffected by a rarity filter
  const { payload: filtered } = await request('GET', '/api/v1/products/facets', { query: { rarity: 'SAR' } });
  assert.deepEqual(filtered.data.languages.map((l) => l.value), ['JP']);
});

test('GET /products/facets is not captured by /products/:id', async () => {
  const { status, payload } = await request('GET', '/api/v1/products/facets');
  assert.equal(status, 200);
  assert.ok(payload.data.languages, 'facets route must be registered before /products/:id');
});
