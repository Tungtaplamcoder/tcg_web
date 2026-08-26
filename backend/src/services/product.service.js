const prisma = require('../config/prisma');
const { NotFoundError, AppError } = require('../utils/errors');

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

module.exports = {
  listProducts,
  getProductById,
  listSets
};