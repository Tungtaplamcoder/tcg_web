const prisma = require('../config/prisma');
const { NotFoundError } = require('../utils/errors');
const { PRODUCT_CATEGORIES, resolveProductCategoryKey } = require('../constants/productCategories');

/* Multi-value query params ("a,b") → string arrays; single values stay
 * single-element arrays. Empty strings are dropped. */
const toList = (value) => {
  if (value === undefined || value === null) return null;
  const parts = String(value).split(',').map((v) => v.trim()).filter(Boolean);
  return parts.length > 0 ? parts : null;
};

/* Resolve a category filter value (semantic key BOX/CARD, any slug at any
 * level of the tree, or legacy alias) to the list of category ids it
 * covers — the category itself plus all descendants, so picking a Level 1
 * or Level 2 node also matches products filed under its children.
 * Returns null when the value matches nothing (caller treats as no-match). */
const resolveCategoryTreeIds = async (value) => {
  const key = resolveProductCategoryKey(value);
  const slug = key ? PRODUCT_CATEGORIES[key].slug : String(value);
  const category = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
  if (!category) return null;
  const children = await prisma.category.findMany({ where: { parentId: category.id }, select: { id: true } });
  let grandchildren = [];
  if (children.length > 0) {
    grandchildren = await prisma.category.findMany({
      where: { parentId: { in: children.map((c) => c.id) } },
      select: { id: true }
    });
  }
  return [category.id, ...children.map((c) => c.id), ...grandchildren.map((c) => c.id)];
};

/* Derive the storefront main type (SEALED_PRODUCT / SINGLE_CARD) from a
 * category's ancestry: walk parentId up to the root and treat anything
 * rooted under the sealed-products category as sealed. The public product
 * payload ships only the immediate category (e.g. "E2E Booster Box …" or a
 * bare "a5"), so the storefront cannot reconstruct the root itself — expose
 * the resolved type explicitly instead of relying on name heuristics. */
const SEALED_ROOT_SLUG = PRODUCT_CATEGORIES.BOX.slug;
const resolveMainTypeFromCategories = (categories) => {
  const byId = new Map(categories.map((c) => [c.id, c]));
  return (categoryId) => {
    let cur = categoryId ? byId.get(categoryId) : null;
    let guard = 0;
    while (cur?.parentId && guard++ < 20) cur = byId.get(cur.parentId);
    const root = cur;
    const isSealed = Boolean(root) && (
      root.slug === SEALED_ROOT_SLUG
      || String(root.slug || '').toLowerCase().includes('sealed')
      || String(root.name || '').toLowerCase().includes('sealed')
    );
    return isSealed ? 'SEALED_PRODUCT' : 'SINGLE_CARD';
  };
};

const getCategoryMainTypeResolver = async () => {
  const categories = await prisma.category.findMany({
    select: { id: true, slug: true, name: true, parentId: true }
  });
  return resolveMainTypeFromCategories(categories);
};

/* Shared where-builder for the public catalog and the facet counts —
 * every filter is combinable: category (hierarchical, descendants
 * included), set (slug or expansion code), language, rarity, card set,
 * artist, price, stock. Async because the category tree lookup hits the
 * database. */
const buildProductWhere = async (query = {}) => {
  const where = { status: 'ACTIVE' };

  if (query.search) {
    where.OR = [
      { name: { contains: query.search } },
      { shortName: { contains: query.search } },
      { description: { contains: query.search } },
      { cardNumber: { contains: query.search } },
      { cardSet: { contains: query.search } }
    ];
  }

  // Category: semantic key, canonical slug, legacy alias, or any tree
  // node slug (series/expansion). Unknown values → impossible match.
  if (query.category) {
    const ids = await resolveCategoryTreeIds(query.category);
    where.categoryId = ids ? (ids.length > 1 ? { in: ids } : ids[0]) : '__no_match__';
  }

  // Set: slug ("vivid-voltage") or expansion code ("SWSH04") — both
  // index-backed via the Set.slug unique key + Set.code index.
  if (query.set) {
    where.sets = { some: { OR: [{ slug: query.set }, { code: query.set }] } };
  }

  // Dynamic attributes — multi-value aware ("?language=JP,ENG").
  const languages = toList(query.language);
  if (languages) where.language = languages.length > 1 ? { in: languages } : languages[0];

  const rarities = toList(query.rarity);
  if (rarities) where.rarity = rarities.length > 1 ? { in: rarities } : rarities[0];

  // Illustrator facet — exact match per artist name ("Yuka Morii,…")
  const artists = toList(query.artist);
  if (artists) where.artist = artists.length > 1 ? { in: artists } : artists[0];

  if (query.cardSet) where.cardSet = { contains: query.cardSet };

  if (query.minPrice !== undefined) {
    where.variants = { some: { price: { gte: query.minPrice } } };
  }
  if (query.maxPrice !== undefined) {
    where.variants = { some: { price: { lte: query.maxPrice } } };
  }
  if (query.inStock === true) {
    where.variants = { some: { stockQuantity: { gt: 0 } } };
  }

  return where;
};

const listProducts = async (query) => {
  const where = await buildProductWhere(query);
  const skip = (query.page - 1) * query.limit;
  const take = query.limit;

  const [items, totalItems, resolveMainType] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        sets: { select: { id: true, name: true, slug: true } },
        category: { select: { id: true, name: true, slug: true } },
        variants: {
          where: { status: 'ACTIVE' },
          select: { id: true, condition: true, variant: true, price: true, stockQuantity: true }
        }
      }
    }),
    prisma.product.count({ where }),
    getCategoryMainTypeResolver()
  ]);

  const normalizeProductImages = (p) => {
    let imgs = p.images;
    if (typeof imgs === 'string') {
      try { imgs = JSON.parse(imgs); } catch { imgs = []; }
    }
    if (!Array.isArray(imgs)) imgs = [];
    return {
      ...p,
      images: imgs,
      frontImage: imgs[0] || null,
      backImage: imgs[1] || p.backImage || null
    };
  };

  return {
    items: items.map((item) => ({ ...normalizeProductImages(item), mainType: resolveMainType(item.categoryId) })),
    meta: {
      page: query.page,
      limit: query.limit,
      totalItems,
      totalPages: Math.ceil(totalItems / query.limit)
    }
  };
};

const getProductById = async (id) => {
  const [product, resolveMainType] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        sets: true,
        category: { select: { id: true, name: true, slug: true, parentId: true } },
        variants: {
          where: { status: 'ACTIVE' },
          orderBy: [{ condition: 'asc' }, { variant: 'asc' }]
        }
      }
    }),
    getCategoryMainTypeResolver()
  ]);

  if (!product || product.status === 'DELETED') {
    throw new NotFoundError('Product not found');
  }

  // Nếu không có variant, tạo variant mặc định từ price/stock cũ (nếu có)
  if (product.variants.length === 0 && product.attributes?.legacyPrice) {
    // không xử lý ở đây, chỉ trả về
  }

  let imgs = product.images;
  if (typeof imgs === 'string') {
    try { imgs = JSON.parse(imgs); } catch { imgs = []; }
  }
  if (!Array.isArray(imgs)) imgs = [];

  return {
    ...product,
    images: imgs,
    frontImage: imgs[0] || null,
    backImage: imgs[1] || product.backImage || null,
    mainType: resolveMainType(product.categoryId)
  };
};

const listSets = async () => {
  // Dynamic pruning: only Expansion Sets with at least one ACTIVE product
  // appear in the storefront filter sidebar. Sets whose products have all
  // been deleted/reassigned drop out automatically — no manual cleanup.
  return prisma.set.findMany({
    where: { products: { some: { status: 'ACTIVE' } } },
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: { where: { status: 'ACTIVE' } } } } }
  });
};

/* Facet values for the storefront filter rail. Returns the distinct
 * languages, rarities, card sets and sets present in ACTIVE products,
 * each with a product count. The optional `query` carries the currently
 * applied filters EXCLUDING the facet's own attribute, so each facet
 * shows sibling counts (classic faceted-search semantics) instead of
 * collapsing to a single value once one filter is picked. */
/* Roll each category's direct ACTIVE product count up through its ancestors
 * so a series/root whose products all live on descendant leaves still owns
 * a non-zero count — and so any node (and only any node) with zero ACTIVE
 * products anywhere in its subtree can be pruned. Returns [{...row,
 * productCount}] with productCount = own + descendants. */
const withRolledProductCounts = (rows) => {
  const byId = new Map(rows.map((r) => [r.id, { ...r, productCount: r._count?.products ?? 0 }]));
  for (const row of rows) {
    const own = row._count?.products ?? 0;
    if (own === 0) continue;
    let cur = row.parentId ? byId.get(row.parentId) : null;
    let guard = 0;
    while (cur && guard++ < 20) {
      cur.productCount += own;
      cur = cur.parentId ? byId.get(cur.parentId) : null;
    }
  }
  return [...byId.values()];
};

const getProductFacets = async (query = {}) => {
  const baseWhere = (facet) => {
    const partial = { ...query };
    delete partial[facet];
    return buildProductWhere(partial);
  };
  const [languages, rarities, cardSets, artists, sets, categories] = await Promise.all([
    prisma.product.groupBy({
      by: ['language'],
      where: await baseWhere('language'),
      _count: { _all: true },
      orderBy: { _count: { language: 'desc' } }
    }),
    prisma.product.groupBy({
      by: ['rarity'],
      where: await baseWhere('rarity'),
      _count: { _all: true },
      orderBy: { _count: { rarity: 'desc' } }
    }),
    prisma.product.groupBy({
      by: ['cardSet'],
      where: await baseWhere('cardSet'),
      _count: { _all: true },
      orderBy: { _count: { cardSet: 'desc' } }
    }),
    prisma.product.groupBy({
      by: ['artist'],
      where: await baseWhere('artist'),
      _count: { _all: true },
      orderBy: { _count: { artist: 'desc' } }
    }),
    prisma.set.findMany({
      where: { products: { some: await buildProductWhere({ ...query, set: undefined }) } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, code: true, _count: { select: { products: { where: await buildProductWhere({ ...query, set: undefined }) } } } }
    }),
    // Full active category tree (roots + children) — the storefront builds
    // the nested accordion from this flat parent/child list. Every node is
    // fetched (not just ones with direct products) so ancestors can be
    // assembled, then counted up through the subtree and zero-product
    // branches pruned below.
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, parentId: true, _count: { select: { products: { where: await buildProductWhere({ ...query, category: undefined }) } } } }
    })
  ]);

  const countedCategories = withRolledProductCounts(categories)
    // Dynamic pruning: a Series / Expansion Set / Sealed Type with zero
    // ACTIVE products anywhere in its subtree must not be offered as a
    // storefront filter.
    .filter((c) => c.productCount > 0);

  return {
    languages: languages.filter((row) => row.language != null && row.language !== '')
      .map((row) => ({ value: row.language, count: row._count._all })),
    rarities: rarities.filter((row) => row.rarity != null && row.rarity !== '')
      .map((row) => ({ value: row.rarity, count: row._count._all })),
    cardSets: cardSets.filter((row) => row.cardSet != null && row.cardSet !== '')
      .map((row) => ({ value: row.cardSet, count: row._count._all })),
    artists: artists.filter((row) => row.artist != null && row.artist !== '')
      .map((row) => ({ value: row.artist, count: row._count._all })),
    sets: sets.map((s) => ({ id: s.id, name: s.name, slug: s.slug, code: s.code, count: s._count.products })),
    categories: countedCategories.map((c) => ({ id: c.id, name: c.name, slug: c.slug, parentId: c.parentId, count: c.productCount }))
  };
};

const getProductStock = async (id) => {  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      variants: { where: { status: 'ACTIVE' }, select: { stockQuantity: true } }
    }
  });
  if (!product) throw new NotFoundError('Product not found');
  const stockQuantity = product.variants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);
  return { productId: id, stockQuantity };
};

const listCategories = async (activeOnly = false) => {
  // Storefront mode (activeOnly=true, the default): dynamic pruning by
  // ROLLED-UP product count — a Series/Expansion Set/Sealed Type is kept only
  // when it has ACTIVE products in its own subtree, and ancestors inherit their
  // descendants' counts so a category whose cards all live on deeper leaves
  // still shows up with the right total. Deleting/reassigning the last product
  // in a branch automatically drops that tag from the filter sidebar.
  // Admin mode (activeOnly=false): return the full tree unchanged (master data
  // for the product form's creatable selects).
  if (!activeOnly) {
    return prisma.category.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  }
  const rows = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: { where: { status: 'ACTIVE' } } } } }
  });
  return withRolledProductCounts(rows)
    .filter((c) => c.productCount > 0)
    .map(({ _count, productCount, ...category }) => category);
};

const listCards = async (query = {}) => {
  const where = {};
  if (query.productId) where.productId = query.productId;
  if (query.status) where.status = query.status;
  if (query.condition) where.condition = query.condition;

  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const [items, totalItems] = await Promise.all([
    prisma.card.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.card.count({ where })
  ]);

  return {
    items,
    meta: { page, limit, totalItems, totalPages: Math.ceil(totalItems / limit) }
  };
};

const getCardById = async (id) => {
  const card = await prisma.card.findUnique({ where: { id } });
  if (!card) throw new NotFoundError('Card not found');
  return card;
};

/* Active rarity options for the public/admin product modal. Ordered by name
 * so the dropdown reads consistently regardless of creation order. */
const listRarities = async () => {
  return prisma.rarity.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' }
  });
};

/* Active sealed-product categories ("Danh mục Sealed Product") for the
 * public/admin product modal. Ordered by name for a stable dropdown. */
const listSealedCategories = async () => {
  return prisma.sealedCategory.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' }
  });
};

/* Active product languages ("Ngôn ngữ") for the admin product modal's
 * "Ngôn ngữ (Language)" dropdown and the inventory filter. Ordered by name
 * for a stable dropdown. */
const listLanguages = async () => {
  return prisma.cardLanguage.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' }
  });
};

module.exports = {
  listProducts,
  getProductById,
  listSets,
  listRarities,
  listSealedCategories,
  listLanguages,
  getProductStock,
  listCategories,
  getProductFacets,
  buildProductWhere,
  listCards,
  getCardById
};