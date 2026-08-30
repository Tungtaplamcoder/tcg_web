const prisma = require('../config/prisma');
const { NotFoundError, AppError } = require('../utils/errors');
const { PRODUCT_CATEGORIES, resolveProductCategoryKey } = require('../constants/productCategories');

const buildProductWhere = (query) => {
  const where = { status: 'ACTIVE' };

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { shortName: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
      { cardNumber: { contains: query.search, mode: 'insensitive' } }
    ];
  }

  if (query.category) {
    const key = resolveProductCategoryKey(query.category);
    if (!key) throw new AppError('Category filter must be either "Box" or "Card"', 400, 'VALIDATION_ERROR');
    where.category = { slug: PRODUCT_CATEGORIES[key].slug };
  }

  if (query.set) {
    where.sets = { some: { slug: query.set } };
  }
  if (query.rarity) where.rarity = query.rarity;
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
  const where = buildProductWhere(query);
  const skip = (query.page - 1) * query.limit;
  const take = query.limit;

  const [items, totalItems] = await Promise.all([
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
    prisma.product.count({ where })
  ]);

  return {
    items,
    meta: {
      page: query.page,
      limit: query.limit,
      totalItems,
      totalPages: Math.ceil(totalItems / query.limit)
    }
  };
};

const getProductById = async (id) => {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      sets: true,
      variants: {
        where: { status: 'ACTIVE' },
        orderBy: [{ condition: 'asc' }, { variant: 'asc' }]
      }
    }
  });

  if (!product || product.status === 'DELETED') {
    throw new NotFoundError('Product not found');
  }

  // Nếu không có variant, tạo variant mặc định từ price/stock cũ (nếu có)
  if (product.variants.length === 0 && product.attributes?.legacyPrice) {
    // không xử lý ở đây, chỉ trả về
  }

  return product;
};

const listSets = async () => {
  return prisma.set.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: { where: { status: 'ACTIVE' } } } } }
  });
};

const getProductStock = async (id) => {
  const product = await prisma.product.findUnique({
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
  const where = activeOnly ? { isActive: true } : {};
  return prisma.category.findMany({
    where,
    orderBy: { name: 'asc' }
  });
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

module.exports = {
  listProducts,
  getProductById,
  listSets,
  getProductStock,
  listCategories,
  listCards,
  getCardById
};