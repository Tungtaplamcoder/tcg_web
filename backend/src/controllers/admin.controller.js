const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { NotFoundError, ConflictError, AppError } = require('../utils/errors');
const imageService = require('../services/image.service');
const settingsService = require('../services/settings.service');
const { PRODUCT_CATEGORIES, resolveProductCategoryKey } = require('../constants/productCategories');

const slugify = (text) => text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Resolve the binary product category (BOX | CARD) to a Category row id,
// creating the canonical Box/Card category if it does not exist yet.
const resolveCategoryId = async (categoryKey) => {
  const key = resolveProductCategoryKey(categoryKey);
  if (!key) {
    throw new AppError('Category must be either "Box" (Sealed Boxes) or "Card" (Single Cards)', 400, 'VALIDATION_ERROR');
  }
  const def = PRODUCT_CATEGORIES[key];
  const category = await prisma.category.upsert({
    where: { slug: def.slug },
    update: {},
    create: { name: def.name, slug: def.slug, description: def.description, isActive: true }
  });
  return category.id;
};

// ==================== USER MANAGEMENT ====================

const listUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, role, status, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);
    const where = {};
    if (role) where.role = role;
    if (status) where.status = status;
    if (search) where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { fullName: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } }
    ];

    const [items, totalItems] = await Promise.all([
      prisma.user.findMany({
        where, skip, take, orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, fullName: true, phone: true, avatarUrl: true, role: true,
          status: true, canManageInventory: true, canManagePosts: true, canAccessChat: true,
          createdAt: true, updatedAt: true }
      }),
      prisma.user.count({ where })
    ]);

    res.status(200).json({ success: true, data: { items, meta: { page: Number(page), limit: take, totalItems, totalPages: Math.ceil(totalItems / take) } }, message: 'Users retrieved' });
  } catch (error) { next(error); }
};

const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params; const { role } = req.body;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundError('User not found');
    const updated = await prisma.user.update({ where: { id }, data: { role },
      select: { id: true, email: true, fullName: true, role: true, status: true, canManageInventory: true, canManagePosts: true, canAccessChat: true, updatedAt: true } });
    res.status(200).json({ success: true, data: updated, message: 'User role updated' });
  } catch (error) { next(error); }
};

const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params; const { status } = req.body;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundError('User not found');
    if (user.role === 'ADMIN' && status !== 'ACTIVE') throw new ConflictError('Cannot ban or delete an admin user');
    const updated = await prisma.user.update({ where: { id }, data: { status },
      select: { id: true, email: true, fullName: true, role: true, status: true, canManageInventory: true, canManagePosts: true, canAccessChat: true, updatedAt: true } });
    res.status(200).json({ success: true, data: updated, message: 'User status updated' });
  } catch (error) { next(error); }
};

const updateUserPermissions = async (req, res, next) => {
  try {
    const { id } = req.params; const { canManageInventory, canManagePosts, canAccessChat } = req.body;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundError('User not found');
    const updated = await prisma.user.update({ where: { id },
      data: { canManageInventory: !!canManageInventory, canManagePosts: !!canManagePosts, canAccessChat: !!canAccessChat },
      select: { id: true, email: true, fullName: true, role: true, canManageInventory: true, canManagePosts: true, canAccessChat: true } });
    res.status(200).json({ success: true, data: updated, message: 'User permissions updated' });
  } catch (error) { next(error); }
};

const changeUserPassword = async (req, res, next) => {
  try {
    const { id } = req.params; const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) throw new AppError('Password must be at least 8 characters', 400, 'VALIDATION_ERROR');
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundError('User not found');
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id }, data: { passwordHash } });
    await prisma.refreshToken.updateMany({ where: { userId: id, revoked: false }, data: { revoked: true } });
    res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (error) { next(error); }
};

// ==================== PRODUCT MANAGEMENT ====================

const listProducts = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, status, setId, categoryId, category } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);
    const where = {};
    if (status) where.status = status;
    if (setId) where.sets = { some: { id: setId } };
    if (category) {
      const key = resolveProductCategoryKey(category);
      if (!key) throw new AppError('Category filter must be either "Box" or "Card"', 400, 'VALIDATION_ERROR');
      const existing = await prisma.category.findUnique({ where: { slug: PRODUCT_CATEGORIES[key].slug }, select: { id: true } });
      if (!existing) {
        return res.status(200).json({
          success: true,
          data: { items: [], meta: { page: Number(page), limit: take, totalItems: 0, totalPages: 0 } },
          message: 'Products retrieved'
        });
      }
      where.categoryId = existing.id;
    } else if (categoryId) {
      where.categoryId = categoryId;
    }
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { shortName: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
      { cardNumber: { contains: search, mode: 'insensitive' } }
    ];

    const [items, totalItems] = await Promise.all([
      prisma.product.findMany({
        where, skip, take, orderBy: { createdAt: 'desc' },
        include: { sets: true, variants: true, category: true }
      }),
      prisma.product.count({ where })
    ]);

    res.status(200).json({ success: true, data: { items, meta: { page: Number(page), limit: take, totalItems, totalPages: Math.ceil(totalItems / take) } }, message: 'Products retrieved' });
  } catch (error) { next(error); }
};

const createProduct = async (req, res, next) => {
  try {
    const data = req.body;
    const slug = data.slug || slugify(data.name);
    const existing = await prisma.product.findUnique({ where: { slug } });
    if (existing) throw new ConflictError('Slug already exists');

    // Resolve the binary category (Box | Card) to its Category row
    const { variants, setIds, shortName, backImage, tcgplayerId, category, ...restData } = data;
    const resolvedCategoryId = await resolveCategoryId(category);

    const product = await prisma.product.create({
      data: {
        ...restData,
        slug,
        categoryId: resolvedCategoryId,
        shortName: shortName || null,
        backImage: backImage || null,
        tcgplayerId: tcgplayerId || null,
        ...(setIds && setIds.length > 0 && { sets: { connect: setIds.map(id => ({ id })) } }),
        ...(variants && variants.length > 0 && {
          variants: {
            create: variants.map(v => ({
              condition: v.condition || 'NEAR_MINT',
              variant: v.variant || 'Normal',
              price: Number(v.price),
              stockQuantity: Number(v.stockQuantity) || 0
            }))
          }
        })
      },
      include: { variants: true, sets: true, category: true }
    });

    res.status(201).json({ success: true, data: product, message: 'Product created' });
  } catch (error) { next(error); }
};

const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = { ...req.body };
    const product = await prisma.product.findUnique({ where: { id }, include: { variants: true, sets: true } });
    if (!product) throw new NotFoundError('Product not found');

    let slug = product.slug;
    if (data.slug) slug = data.slug;
    else if (data.name && data.name !== product.name) slug = slugify(data.name);
    if (slug !== product.slug) {
      const existing = await prisma.product.findUnique({ where: { slug } });
      if (existing && existing.id !== id) throw new ConflictError('Slug already exists');
    }

    const { variants, setIds, shortName, backImage, tcgplayerId, category, ...restData } = data;

    // Resolve the binary category (Box | Card) if it is being changed
    const resolvedCategoryId = (category !== undefined && category !== null)
      ? await resolveCategoryId(category)
      : product.categoryId;

    // Xử lý variants: xóa cũ, tạo mới (đơn giản và an toàn)
    await prisma.productVariant.deleteMany({ where: { productId: id } });

    const updateData = {
      ...restData,
      slug,
      categoryId: resolvedCategoryId,
      shortName: shortName !== undefined ? (shortName || null) : product.shortName,
      backImage: backImage !== undefined ? (backImage || null) : product.backImage,
      tcgplayerId: tcgplayerId !== undefined ? (tcgplayerId || null) : product.tcgplayerId,
    };

    if (setIds !== undefined) {
      updateData.sets = { set: setIds.map(setId => ({ id: setId })) };
    }

    await prisma.product.update({
      where: { id },
      data: updateData,
    });

    if (variants && variants.length > 0) {
      await prisma.productVariant.createMany({
        data: variants.map(v => ({
          productId: id,
          condition: v.condition || 'NEAR_MINT',
          variant: v.variant || 'Normal',
          price: Number(v.price),
          stockQuantity: Number(v.stockQuantity) || 0
        }))
      });
    }

    const updated = await prisma.product.findUnique({ where: { id }, include: { variants: true, sets: true, category: true } });
    res.status(200).json({ success: true, data: updated, message: 'Product updated' });
  } catch (error) { next(error); }
};

const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundError('Product not found');

    await prisma.productVariant.deleteMany({ where: { productId: id } });
    await prisma.product.delete({ where: { id } });
    res.status(200).json({ success: true, message: 'Product deleted permanently' });
  } catch (error) { next(error); }
};

// ==================== CATEGORY MANAGEMENT ====================

const listAdminCategories = async (req, res, next) => {
  try {
    const { activeOnly } = req.query;
    const where = {};
    if (activeOnly !== 'false') where.isActive = true;
    const categories = await prisma.category.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } }
    });
    res.status(200).json({ success: true, data: categories, message: 'Categories retrieved' });
  } catch (error) { next(error); }
};

const createCategory = async (req, res, next) => {
  try {
    const { name, slug, description, imageUrl, isActive } = req.body;
    const finalSlug = slug || slugify(name);
    const existing = await prisma.category.findUnique({ where: { slug: finalSlug } });
    if (existing) throw new ConflictError('Category slug already exists');
    const category = await prisma.category.create({
      data: {
        name,
        slug: finalSlug,
        description: description || null,
        imageUrl: imageUrl || null,
        isActive: isActive ?? true
      }
    });
    res.status(201).json({ success: true, data: category, message: 'Category created' });
  } catch (error) { next(error); }
};

const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, slug, description, imageUrl, isActive } = req.body;
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundError('Category not found');

    const data = {};
    if (name !== undefined) data.name = name;
    if (slug !== undefined) data.slug = slug;
    if (description !== undefined) data.description = description;
    if (imageUrl !== undefined) data.imageUrl = imageUrl || null;
    if (isActive !== undefined) data.isActive = isActive;

    const updated = await prisma.category.update({ where: { id }, data });
    res.status(200).json({ success: true, data: updated, message: 'Category updated' });
  } catch (error) { next(error); }
};

const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } }
    });
    if (!category) throw new NotFoundError('Category not found');

    // Block deletion if the category still contains products (prevents orphaned products)
    if (category._count.products > 0) {
      throw new ConflictError('Cannot delete category because it still contains products. Reassign or delete those products first.');
    }

    await prisma.category.delete({ where: { id } });
    res.status(200).json({ success: true, message: 'Category deleted' });
  } catch (error) { next(error); }
};

// ==================== CARD MANAGEMENT (legacy) ====================

const addCards = async (req, res, next) => {
  try {
    const { id: productId } = req.params;
    const { cards: cardsData } = req.body;
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError('Product not found');

    const skus = cardsData.map(c => c.sku);
    const existingSkus = await prisma.card.findMany({ where: { sku: { in: skus } }, select: { sku: true } });
    if (existingSkus.length > 0) throw new ConflictError(`SKUs already exist: ${existingSkus.map(s => s.sku).join(', ')}`);

    const cards = await prisma.$transaction(
      cardsData.map(card => prisma.card.create({
        data: { sku: card.sku, productId, condition: card.condition, purchasePrice: card.purchasePrice, notes: card.notes, status: 'AVAILABLE' }
      }))
    );

    res.status(201).json({ success: true, data: cards, message: 'Cards added' });
  } catch (error) { next(error); }
};

const updateCard = async (req, res, next) => {
  try {
    const { id } = req.params; const data = req.body;
    const card = await prisma.card.findUnique({ where: { id } });
    if (!card) throw new NotFoundError('Card not found');
    const updated = await prisma.card.update({ where: { id }, data: { ...data, updatedAt: new Date() } });
    res.status(200).json({ success: true, data: updated, message: 'Card updated' });
  } catch (error) { next(error); }
};

// ==================== IMAGE UPLOAD ====================

const uploadImage = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No image file provided' } });
    const imageUrl = await imageService.uploadImage(req.file.buffer, req.file.originalname);
    res.status(200).json({ success: true, data: { url: imageUrl }, message: 'Image uploaded successfully' });
  } catch (error) { next(error); }
};

// ==================== SET MANAGEMENT (Sản phẩm) ====================

const listSets = async (req, res, next) => {
  try {
    const sets = await prisma.set.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { products: true } } } });
    res.status(200).json({ success: true, data: sets, message: 'Sets retrieved' });
  } catch (error) { next(error); }
};

const createSet = async (req, res, next) => {
  try {
    const { name } = req.body;
    const slug = slugify(name);
    const existing = await prisma.set.findUnique({ where: { slug } });
    if (existing) throw new ConflictError('Slug already exists');
    const set = await prisma.set.create({ data: { name, slug } });
    res.status(201).json({ success: true, data: set, message: 'Set created' });
  } catch (error) { next(error); }
};

const updateSet = async (req, res, next) => {
  try {
    const { id } = req.params; const { name } = req.body;
    const set = await prisma.set.findUnique({ where: { id } });
    if (!set) throw new NotFoundError('Set not found');
    const slug = slugify(name || set.name);
    if (slug !== set.slug) {
      const existing = await prisma.set.findUnique({ where: { slug } });
      if (existing && existing.id !== id) throw new ConflictError('Slug already exists');
    }
    const updated = await prisma.set.update({ where: { id }, data: { name, slug, updatedAt: new Date() } });
    res.status(200).json({ success: true, data: updated, message: 'Set updated' });
  } catch (error) { next(error); }
};

const deleteSet = async (req, res, next) => {
  try {
    const { id } = req.params;
    const set = await prisma.set.findUnique({ where: { id }, include: { products: true } });
    if (!set) throw new NotFoundError('Set not found');
    const hasStock = set.products.some(p => p.variants && p.variants.some(v => v.stockQuantity > 0));
    if (hasStock) throw new ConflictError('Cannot delete set with products still in stock.');
    await prisma.$transaction(async (tx) => {
      await tx.product.deleteMany({ where: { sets: { some: { id } } } });
      await tx.set.delete({ where: { id } });
    });
    res.status(200).json({ success: true, message: 'Set and its products deleted' });
  } catch (error) { next(error); }
};

// ==================== POST MANAGEMENT ====================

const listPosts = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit); const take = Number(limit);
    const [items, totalItems] = await Promise.all([
      prisma.post.findMany({ skip, take, orderBy: { createdAt: 'desc' }, include: { author: { select: { id: true, email: true, fullName: true } } } }),
      prisma.post.count()
    ]);
    res.status(200).json({ success: true, data: { items, meta: { page: Number(page), limit: take, totalItems, totalPages: Math.ceil(totalItems / take) } }, message: 'Posts retrieved' });
  } catch (error) { next(error); }
};

const createPost = async (req, res, next) => {
  try {
    const { title, content, excerpt, thumbnailUrl } = req.body;
    const authorId = req.user.id;
    const post = await prisma.post.create({ data: { title, content, excerpt, thumbnailUrl, authorId }, include: { author: { select: { id: true, email: true, fullName: true } } } });
    res.status(201).json({ success: true, data: post, message: 'Post created' });
  } catch (error) { next(error); }
};

const updatePost = async (req, res, next) => {
  try {
    const { id } = req.params; const { title, content, excerpt, thumbnailUrl } = req.body;
    const existing = await prisma.post.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Post not found');
    const post = await prisma.post.update({ where: { id }, data: { title, content, excerpt, thumbnailUrl }, include: { author: { select: { id: true, email: true, fullName: true } } } });
    res.status(200).json({ success: true, data: post, message: 'Post updated' });
  } catch (error) { next(error); }
};

const deletePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await prisma.post.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Post not found');
    await prisma.post.delete({ where: { id } });
    res.status(200).json({ success: true, data: { success: true }, message: 'Post deleted' });
  } catch (error) { next(error); }
};

// ==================== ORDER MANAGEMENT ====================

const listOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, userId, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit); const take = Number(limit);
    const where = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (search) where.orderCode = { contains: search, mode: 'insensitive' };

    const [items, totalItems] = await Promise.all([
      prisma.order.findMany({ where, skip, take, orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, email: true, fullName: true } }, items: { include: { product: { select: { id: true, name: true, shortName: true } }, variant: true, card: { select: { id: true, sku: true } } } }, payments: true } }),
      prisma.order.count({ where })
    ]);
    res.status(200).json({ success: true, data: { items, meta: { page: Number(page), limit: take, totalItems, totalPages: Math.ceil(totalItems / take) } }, message: 'Orders retrieved' });
  } catch (error) { next(error); }
};

const updateOrderStatus = async (req, res, next) => {
  try {
    const { id: orderId } = req.params; const { status: newStatus, note } = req.body;
    const adminUserId = req.user.id;

    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, payments: { where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' } } } });
    if (!order) throw new NotFoundError('Order not found');

    const oldStatus = order.status;
    if (oldStatus === newStatus) throw new ConflictError(`Order already in ${newStatus} status`);

    const allowedTransitions = {
      PENDING: ['PACKAGING', 'CANCELLED'],
      PACKAGING: ['SHIPPING', 'CANCELLED'],
      SHIPPING: ['DELIVERED'],
      DELIVERED: []
    };
    if (!allowedTransitions[oldStatus]?.includes(newStatus)) throw new ConflictError(`Cannot change status from ${oldStatus} to ${newStatus}`);

    if (newStatus === 'PACKAGING' && oldStatus === 'PENDING') {
      await prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw`SELECT * FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`;
        if (!locked || locked.length === 0) throw new NotFoundError('Order not found');
        if (locked[0].status !== 'PENDING') throw new ConflictError('Order no longer pending');

        const now = new Date();
        await tx.order.update({ where: { id: orderId }, data: { status: 'PACKAGING', paymentStatus: 'COMPLETED', paidAt: now, version: { increment: 1 } } });
        if (order.payments.length > 0) {
          await tx.payment.update({ where: { id: order.payments[0].id }, data: { status: 'COMPLETED', paidAt: now } });
        }
        // Stock đã được trừ ngay khi tạo đơn (reserve variant), KHÔNG trừ lần nữa ở đây
        // để tránh giảm tồn kho kép.
        await tx.orderStatusHistory.create({ data: { orderId, oldStatus, newStatus, note: note || `Thanh toán xác nhận bởi ${adminUserId}`, changedByUserId: adminUserId } });
      });
    } else if (newStatus === 'SHIPPING' && oldStatus === 'PACKAGING') {
      await prisma.$transaction(async (tx) => {
        await tx.order.update({ where: { id: orderId }, data: { status: 'SHIPPING', version: { increment: 1 } } });
        await tx.orderStatusHistory.create({ data: { orderId, oldStatus, newStatus, note: note || `Bắt đầu vận chuyển bởi ${adminUserId}`, changedByUserId: adminUserId } });
      });
    } else if (newStatus === 'DELIVERED' && oldStatus === 'SHIPPING') {
      await prisma.$transaction(async (tx) => {
        await tx.order.update({ where: { id: orderId }, data: { status: 'DELIVERED', completedAt: new Date(), version: { increment: 1 } } });
        await tx.orderStatusHistory.create({ data: { orderId, oldStatus, newStatus, note: note || `Đã giao hàng bởi ${adminUserId}`, changedByUserId: adminUserId } });
      });
    } else if (newStatus === 'CANCELLED' && ['PENDING', 'PACKAGING'].includes(oldStatus)) {
      await prisma.$transaction(async (tx) => {
        // Hoàn stock về variant đã đặt; hoàn status card về AVAILABLE
        for (const item of order.items) {
          if (item.variantId) {
            await tx.productVariant.update({ where: { id: item.variantId }, data: { stockQuantity: { increment: item.quantity } } });
          }
          if (item.cardId) {
            const cardStatus = oldStatus === 'PENDING' ? 'RESERVED' : 'SOLD';
            await tx.card.updateMany({ where: { id: item.cardId, status: cardStatus }, data: { status: 'AVAILABLE' } });
          }
        }
        await tx.order.update({ where: { id: orderId }, data: { status: 'CANCELLED', cancelledAt: new Date(), version: { increment: 1 } } });
        if (oldStatus === 'PENDING') await tx.payment.updateMany({ where: { orderId, status: 'PENDING' }, data: { status: 'FAILED' } });
        else if (oldStatus === 'PACKAGING') await tx.payment.updateMany({ where: { orderId, status: 'COMPLETED' }, data: { status: 'REFUNDED' } });
        await tx.orderStatusHistory.create({ data: { orderId, oldStatus, newStatus, note: note || `Hủy bởi ${adminUserId}`, changedByUserId: adminUserId } });
      });
    }

    const io = global.io;
    if (io) {
      io.to(`user:${order.userId}`).emit('order:status_changed', { orderId: order.id, orderCode: order.orderCode, oldStatus, newStatus });
      if (newStatus === 'PACKAGING') io.to(`user:${order.userId}`).emit('order:paid', { orderId: order.id, orderCode: order.orderCode, status: 'PACKAGING', paidAt: new Date().toISOString() });
    }

    const updatedOrder = await prisma.order.findUnique({ where: { id: orderId } });
    res.status(200).json({ success: true, data: updatedOrder, message: 'Order status updated' });
  } catch (error) { next(error); }
};

// ==================== PAYMENT LOGS ====================

const listPaymentLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit); const take = Number(limit);
    const where = {};
    if (status) where.status = status;
    const [items, totalItems] = await Promise.all([
      prisma.paymentLog.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: { order: { select: { id: true, orderCode: true, grandTotal: true } }, payment: true } }),
      prisma.paymentLog.count({ where })
    ]);
    res.status(200).json({ success: true, data: { items, meta: { page: Number(page), limit: take, totalItems, totalPages: Math.ceil(totalItems / take) } }, message: 'Payment logs retrieved' });
  } catch (error) { next(error); }
};

const reconcilePayment = async (req, res, next) => {
  try {
    const { paymentLogId, action, note } = req.body;
    const adminUserId = req.user.id;

    const log = await prisma.paymentLog.findUnique({ where: { id: paymentLogId }, include: { order: true, payment: true } });
    if (!log) throw new NotFoundError('Payment log not found');

    if (action === 'MARK_AS_COMPLETED') {
      if (!log.order) throw new ConflictError('No order associated');
      const order = log.order;
      if (order.status !== 'PENDING') throw new ConflictError('Order is not pending');

      await prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw`SELECT * FROM "Order" WHERE "id" = ${order.id} FOR UPDATE`;
        if (!locked || locked.length === 0) throw new NotFoundError('Order not found');
        if (locked[0].status !== 'PENDING') throw new ConflictError('Order no longer pending');

        const now = new Date();
        await tx.order.update({ where: { id: order.id }, data: { status: 'PACKAGING', paymentStatus: 'COMPLETED', paidAt: now, version: { increment: 1 } } });
        if (log.paymentId) await tx.payment.update({ where: { id: log.paymentId }, data: { status: 'COMPLETED', paidAt: now } });
        // Stock đã được reserve ngay khi tạo đơn — không trừ thêm khi confirm thanh toán
        await tx.orderStatusHistory.create({ data: { orderId: order.id, oldStatus: 'PENDING', newStatus: 'PACKAGING', note: note || `Manual reconciliation by admin ${adminUserId}` } });
        await tx.paymentLog.update({ where: { id: paymentLogId }, data: { status: 'COMPLETED', processedAt: now, errorMessage: null } });
      });

      const io = global.io;
      if (io) io.to(`user:${log.order.userId}`).emit('order:paid', { orderId: log.order.id, orderCode: log.order.orderCode, status: 'PACKAGING', paidAt: new Date().toISOString() });
    } else if (action === 'MARK_AS_MISMATCH') {
      await prisma.paymentLog.update({ where: { id: paymentLogId }, data: { status: 'MISMATCH', errorMessage: note || 'Marked as mismatch by admin' } });
    } else {
      throw new AppError('Invalid action', 400, 'INVALID_ACTION');
    }

    res.status(200).json({ success: true, message: 'Payment reconciled' });
  } catch (error) { next(error); }
};

// ==================== DASHBOARD ====================

const getDashboardStats = async (req, res, next) => {
  try {
    const [totalRevenue, totalOrders, totalCustomers, totalProducts, totalStock, pendingOrders, packagingOrders, shippingOrders, deliveredOrders, cancelledOrders, recentOrders, revenueByDay] = await Promise.all([
      prisma.order.aggregate({ _sum: { grandTotal: true }, where: { status: { in: ['PACKAGING', 'SHIPPING', 'DELIVERED'] } } }),
      prisma.order.count(),
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.product.count({ where: { status: 'ACTIVE' } }),
      prisma.productVariant.aggregate({ _sum: { stockQuantity: true } }),
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.order.count({ where: { status: 'PACKAGING' } }),
      prisma.order.count({ where: { status: 'SHIPPING' } }),
      prisma.order.count({ where: { status: 'DELIVERED' } }),
      prisma.order.count({ where: { status: 'CANCELLED' } }),
      prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: 5, include: { user: { select: { email: true, fullName: true } } } }),
      prisma.$queryRaw`
        SELECT DATE("paidAt") as date, SUM("grandTotal") as revenue
        FROM "Order"
        WHERE "paidAt" IS NOT NULL AND "paidAt" >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY DATE("paidAt") ORDER BY date DESC
      `
    ]);

    res.status(200).json({ success: true, data: {
      totalRevenue: totalRevenue._sum.grandTotal || 0,
      totalOrders,
      totalCustomers,
      totalProducts,
      totalStock: totalStock._sum.stockQuantity || 0,
      pendingOrders,
      packagingOrders,
      shippingOrders,
      deliveredOrders,
      cancelledOrders,
      recentOrders,
      revenueByDay: revenueByDay.map(r => ({ date: r.date, revenue: Number(r.revenue) }))
    }, message: 'Dashboard stats retrieved' });
  } catch (error) { next(error); }
};

// ==================== CHAT MANAGEMENT ====================

const listChatRooms = async (req, res, next) => {
  try {
    const rooms = await prisma.chatRoom.findMany({ orderBy: { updatedAt: 'desc' }, include: { user: { select: { id: true, email: true, fullName: true } }, order: { select: { id: true, orderCode: true, status: true } }, _count: { select: { messages: true } } } });
    res.status(200).json({ success: true, data: rooms, message: 'Chat rooms retrieved' });
  } catch (error) { next(error); }
};

const getChatRoomMessages = async (req, res, next) => {
  try {
    const { id } = req.params;
    const room = await prisma.chatRoom.findUnique({ where: { id } });
    if (!room) throw new NotFoundError('Chat room not found');
    const messages = await prisma.chatMessage.findMany({ where: { roomId: id }, orderBy: { createdAt: 'asc' }, include: { sender: { select: { id: true, fullName: true, avatarUrl: true, role: true } } } });
    res.status(200).json({ success: true, data: { room, messages }, message: 'Chat room messages retrieved' });
  } catch (error) { next(error); }
};

// ==================== VIRTUAL BOX MANAGEMENT ====================

// Pool entries submitted by the admin UI. Two accepted shapes:
//  1. { productId | cardId, rarity, weight }  — direct references
//  2. { name, imageUrl, rarity }               — free-form card definitions,
//     resolved to Product rows (created on demand with the given image).
const RARITY_TO_ENUM = {
  common: 'COMMON',
  rare: 'RARE',
  epic: 'EPIC',
  legendary: 'LEGENDARY'
};

const normalizeRarity = (rarity) => {
  const key = String(rarity || '').trim().toLowerCase();
  return RARITY_TO_ENUM[key] || 'COMMON';
};

const ensurePoolProduct = async (entry) => {
  const name = String(entry.name || '').trim();
  if (!name) throw new AppError('Pool card name is required', 400, 'VALIDATION_ERROR');
  const rarity = normalizeRarity(entry.rarity);
  const slug = slugify(name);

  const existing = await prisma.product.findUnique({ where: { slug } });
  if (existing) return existing;

  const created = await prisma.product.create({
    data: {
      name,
      slug,
      shortName: name.length > 100 ? name.slice(0, 100) : name,
      rarity,
      status: 'ACTIVE',
      images: entry.imageUrl ? [String(entry.imageUrl).trim()] : []
    }
  });
  return created;
};

// Build the canonical pool payload: direct refs are validated, free-form
// entries are resolved/created as Products. Returns entries suitable for
// VirtualBoxPool writes AND flat poolItems used by the gacha opener.
const resolvePoolEntries = async (pool) => {
  if (!pool || pool.length === 0) return [];

  const resolved = [];
  for (const entry of pool) {
    if (entry.productId || entry.cardId) {
      resolved.push({
        productId: entry.productId || null,
        cardId: entry.cardId || null,
        rarity: entry.rarity || null,
        weight: Number(entry.weight) || 1
      });
    } else {
      const product = await ensurePoolProduct(entry);
      resolved.push({
        productId: product.id,
        cardId: null,
        rarity: normalizeRarity(entry.rarity),
        weight: Number(entry.weight) || 1
      });
    }
  }

  await assertVirtualBoxReferences(resolved);
  return resolved;
};

// Mirror the pool into VirtualBoxPoolItem so the storefront gacha opener
// (which reads poolItems) stays in sync with the admin-managed pool.
const syncPoolItems = async (tx, boxId, resolvedPool) => {
  await tx.virtualBoxPoolItem.deleteMany({ where: { boxId } });
  const seenProductIds = new Set();
  const items = [];
  for (const entry of resolvedPool) {
    if (!entry.productId || seenProductIds.has(entry.productId)) continue;
    seenProductIds.add(entry.productId);
    items.push({
      boxId,
      productId: entry.productId,
      rarity: entry.rarity || 'COMMON'
    });
  }
  if (items.length > 0) await tx.virtualBoxPoolItem.createMany({ data: items });
};

const assertVirtualBoxReferences = async (pool) => {
  if (!pool || pool.length === 0) return;
  const productIds = [...new Set(pool.filter((entry) => entry.productId).map((entry) => entry.productId))];
  const cardIds = [...new Set(pool.filter((entry) => entry.cardId).map((entry) => entry.cardId))];
  const [products, cards] = await Promise.all([
    productIds.length > 0 ? prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true } }) : Promise.resolve([]),
    cardIds.length > 0 ? prisma.card.findMany({ where: { id: { in: cardIds } }, select: { id: true } }) : Promise.resolve([])
  ]);
  const existingProducts = new Set(products.map((p) => p.id));
  const existingCards = new Set(cards.map((c) => c.id));
  const missing = [
    ...productIds.filter((id) => !existingProducts.has(id)),
    ...cardIds.filter((id) => !existingCards.has(id))
  ];
  if (missing.length > 0) {
    throw new AppError(`Unknown product/card references: ${missing.join(', ')}`, 400, 'VALIDATION_ERROR');
  }
};

const mapVirtualBoxPoolPayload = (pool) => pool.map((entry) => ({
  productId: entry.productId || null,
  cardId: entry.cardId || null,
  rarity: entry.rarity || null,
  weight: Number(entry.weight) || 1
}));

const virtualBoxInclude = {
  dropRates: { orderBy: { rate: 'desc' } },
  pool: {
    orderBy: { weight: 'desc' },
    include: {
      product: { select: { id: true, name: true, shortName: true, rarity: true, images: true } },
      card: { select: { id: true, sku: true, condition: true, status: true } }
    }
  },
  poolItems: {
    include: {
      product: { select: { id: true, name: true, shortName: true, rarity: true, images: true } }
    }
  }
};

const listVirtualBoxes = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);
    const where = {};
    if (status) where.status = status;
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } }
    ];

    const [items, totalItems] = await Promise.all([
      prisma.virtualBox.findMany({
        where, skip, take, orderBy: { createdAt: 'desc' },
        include: { ...virtualBoxInclude, _count: { select: { pool: true, openings: true, poolItems: true } } }
      }),
      prisma.virtualBox.count({ where })
    ]);

    const mapped = items.map((box) => ({
      ...box,
      cardPoolCount: box._count?.poolItems || box._count?.pool || 0
    }));

    res.status(200).json({ success: true, data: { items: mapped, meta: { page: Number(page), limit: take, totalItems, totalPages: Math.ceil(totalItems / take) } }, message: 'Virtual boxes retrieved' });
  } catch (error) { next(error); }
};

const createVirtualBox = async (req, res, next) => {
  try {
    const { name, slug, description, imageUrl, gradient, price, status, dropRates, pool } = req.body;
    const finalSlug = slug || slugify(name);
    const existing = await prisma.virtualBox.findUnique({ where: { slug: finalSlug } });
    if (existing) throw new ConflictError('Virtual box slug already exists');

    const resolvedPool = await resolvePoolEntries(pool);
    const poolProductIds = [...new Set(resolvedPool.filter((entry) => entry.productId).map((entry) => entry.productId))];

    const box = await prisma.$transaction(async (tx) => {
      const created = await tx.virtualBox.create({
        data: {
          name,
          slug: finalSlug,
          description: description || null,
          imageUrl: imageUrl || null,
          gradient: gradient || null,
          price: price !== undefined ? Number(price) : 0,
          status: status || 'DRAFT',
          ...(dropRates && dropRates.length > 0 && { dropRates: { create: dropRates.map((d) => ({ rarity: d.rarity, rate: Number(d.rate) })) } }),
          ...(resolvedPool.length > 0 && { pool: { create: mapVirtualBoxPoolPayload(resolvedPool) } })
        },
        include: virtualBoxInclude
      });
      await syncPoolItems(tx, created.id, resolvedPool);
      return tx.virtualBox.findUnique({ where: { id: created.id }, include: { ...virtualBoxInclude, _count: { select: { pool: true, openings: true, poolItems: true } } } });
    });

    res.status(201).json({
      success: true,
      data: { ...box, cardPoolCount: poolProductIds.length || box.pool.length },
      message: 'Virtual box created'
    });
  } catch (error) { next(error); }
};

const updateVirtualBox = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, slug, description, imageUrl, gradient, price, status, dropRates, pool } = req.body;
    const box = await prisma.virtualBox.findUnique({ where: { id } });
    if (!box) throw new NotFoundError('Virtual box not found');

    let finalSlug = box.slug;
    if (slug) finalSlug = slug;
    else if (name && name !== box.name) finalSlug = slugify(name);
    if (finalSlug !== box.slug) {
      const existing = await prisma.virtualBox.findUnique({ where: { slug: finalSlug } });
      if (existing && existing.id !== id) throw new ConflictError('Virtual box slug already exists');
    }

    const resolvedPool = pool !== undefined ? await resolvePoolEntries(pool) : null;
    const poolProductIds = resolvedPool ? [...new Set(resolvedPool.filter((entry) => entry.productId).map((entry) => entry.productId))] : [];

    const updated = await prisma.$transaction(async (tx) => {
      if (dropRates) await tx.virtualBoxDropRate.deleteMany({ where: { boxId: id } });
      if (pool !== undefined) await tx.virtualBoxPool.deleteMany({ where: { boxId: id } });
      await tx.virtualBox.update({
        where: { id },
        data: {
          slug: finalSlug,
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description: description || null }),
          ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
          ...(gradient !== undefined && { gradient: gradient || null }),
          ...(price !== undefined && { price: Number(price) }),
          ...(status !== undefined && { status }),
          ...(dropRates && dropRates.length > 0 && { dropRates: { create: dropRates.map((d) => ({ rarity: d.rarity, rate: Number(d.rate) })) } }),
          ...(resolvedPool && resolvedPool.length > 0 && { pool: { create: mapVirtualBoxPoolPayload(resolvedPool) } })
        }
      });
      if (resolvedPool) await syncPoolItems(tx, id, resolvedPool);
      return tx.virtualBox.findUnique({ where: { id }, include: { ...virtualBoxInclude, _count: { select: { pool: true, openings: true, poolItems: true } } } });
    });

    res.status(200).json({
      success: true,
      data: { ...updated, cardPoolCount: poolProductIds.length || updated.pool.length },
      message: 'Virtual box updated'
    });
  } catch (error) { next(error); }
};

const deleteVirtualBox = async (req, res, next) => {
  try {
    const { id } = req.params;
    const permanent = req.query.permanent === 'true';
    const box = await prisma.virtualBox.findUnique({ where: { id }, include: { _count: { select: { openings: true } } } });
    if (!box) throw new NotFoundError('Virtual box not found');

    if (permanent) {
      if (box._count.openings > 0) {
        throw new ConflictError('Cannot permanently delete a virtual box with opening history. Archive it instead.');
      }
      await prisma.virtualBox.delete({ where: { id } });
      return res.status(200).json({ success: true, message: 'Virtual box deleted permanently' });
    }

    if (box.status === 'ARCHIVED') throw new ConflictError('Virtual box is already archived');
    await prisma.virtualBox.update({ where: { id }, data: { status: 'ARCHIVED' } });
    res.status(200).json({ success: true, message: 'Virtual box archived' });
  } catch (error) { next(error); }
};

// ==================== SETTINGS ====================

const getSepaySettings = async (req, res, next) => {
  try {
    const settings = await settingsService.getSepaySettings();
    res.status(200).json({ success: true, data: settings, message: 'SePay settings retrieved' });
  } catch (error) { next(error); }
};

const updateSepaySettings = async (req, res, next) => {
  try {
    const settings = await settingsService.updateSepaySettings(req.body);
    res.status(200).json({ success: true, data: settings, message: 'SePay settings updated' });
  } catch (error) { next(error); }
};

// ==================== EXPORT ====================

module.exports = {
  listUsers, updateUserRole, updateUserStatus, updateUserPermissions, changeUserPassword,
  listProducts, createProduct, updateProduct, deleteProduct, addCards, updateCard, uploadImage,
  listSets, createSet, updateSet, deleteSet,
  listCategories: listAdminCategories, createCategory, updateCategory, deleteCategory,
  listPosts, createPost, updatePost, deletePost,
  listOrders, updateOrderStatus,
  listPaymentLogs, reconcilePayment,
  getDashboardStats,
  listChatRooms, getChatRoomMessages,
  listVirtualBoxes, createVirtualBox, updateVirtualBox, deleteVirtualBox,
  getSepaySettings, updateSepaySettings
};