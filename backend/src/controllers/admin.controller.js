const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { NotFoundError, ConflictError, AppError } = require('../utils/errors');
const imageService = require('../services/image.service');
const settingsService = require('../services/settings.service');
const { PRODUCT_CATEGORIES, resolveProductCategoryKey } = require('../constants/productCategories');
const { permissionSelect, withPermissions, extractPermissionUpdate } = require('../utils/permissions');
const { clearCatalogCache } = require('../utils/cache');

const slugify = (text) => text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Resolve a category by slug, name or id (exact match, case-insensitive
// collation). Used for both category refs and parent refs.
const findCategoryRef = async (ref) => {
  const input = String(ref).trim();
  if (!input) return null;
  return prisma.category.findFirst({
    where: { OR: [{ id: input }, { slug: input }, { name: input }] }
  });
};


// Resolve a category reference to a Category row id. Accepts, in order:
//  1. A semantic merchandising bucket (BOX | CARD) — upserted by slug;
//  2. An existing category id, slug or name at ANY level of the tree
//     (Level 1 root, Level 2 series, Level 3 expansion set);
//  3. A brand-new name from the admin's creatable-select — created on the
//     fly AS A CHILD of `parentRef` when one is supplied, so the tree stays
//     navigable: Expansion Sets nest under their Series, Sealed Types under
//     "Sealed Products". Without the link, the storefront accordion can't
//     roll counts up to parents and the edit form can't re-derive the
//     cascading selection (the "Series resets" hydration bug).
// The DB is the source of truth for the whole tree.
const resolveCategoryId = async (categoryInput, parentRef = null) => {
  if (categoryInput === undefined || categoryInput === null) return null;
  const key = resolveProductCategoryKey(categoryInput);
  if (key) {
    const def = PRODUCT_CATEGORIES[key];
    const category = await prisma.category.upsert({
      where: { slug: def.slug },
      update: {},
      create: { name: def.name, slug: def.slug, description: def.description, isActive: true }
    });
    return category.id;
  }

  const input = String(categoryInput).trim();
  const existing = await findCategoryRef(input);
  if (existing) return existing.id;

  // Creatable select: admin typed a brand-new category name.
  const baseSlug = slugify(input) || `category-${Date.now()}`;
  const slugTaken = await prisma.category.findUnique({ where: { slug: baseSlug } });
  const finalSlug = slugTaken ? `${baseSlug}-${Date.now()}` : baseSlug;
  const parent = parentRef ? await findCategoryRef(parentRef) : null;
  const created = await prisma.category.create({
    data: { name: input, slug: finalSlug, isActive: true, parentId: parent ? parent.id : null }
  });
  return created.id;
};

// Find-or-create ONE tree segment under `parentId`. Bucket keys
// (CARD/BOX and their slugs) always resolve to the canonical root rows.
// An existing row that is still detached (parentId null from the old
// root-creation behaviour) is healed onto the given parent, so the
// hierarchy repairs itself on the next product save.
const ensureCategorySegment = async (input, parentId) => {
  const key = resolveProductCategoryKey(input);
  if (key) {
    const def = PRODUCT_CATEGORIES[key];
    return prisma.category.upsert({
      where: { slug: def.slug },
      update: {},
      create: { name: def.name, slug: def.slug, description: def.description, isActive: true }
    });
  }
  const value = String(input).trim();
  if (!value) return null;
  const existing = await findCategoryRef(value);
  if (existing) {
    if (parentId && !existing.parentId) {
      return prisma.category.update({ where: { id: existing.id }, data: { parentId } });
    }
    return existing;
  }
  const baseSlug = slugify(value) || `category-${Date.now()}`;
  const slugTaken = await prisma.category.findUnique({ where: { slug: baseSlug } });
  return prisma.category.create({
    data: { name: value, slug: slugTaken ? `${baseSlug}-${Date.now()}` : baseSlug, isActive: true, parentId: parentId || null }
  });
};

// Resolve a `categoryPath` — [bucket | series, expansion?] name/slug/id
// segments top-down — into the leaf Category. Guarantees the whole chain
// exists and is correctly nested, which is what the storefront accordion
// (roll-up counts) and the admin cascading form (edit hydration) both need.
const resolveCategoryPath = async (path) => {
  const segments = (Array.isArray(path) ? path : [path])
    .map((s) => (s === undefined || s === null ? '' : String(s).trim()))
    .filter(Boolean);
  if (segments.length === 0) return null;
  let parentId = null;
  let leaf = null;
  for (const seg of segments) {
    leaf = await ensureCategorySegment(seg, parentId);
    if (!leaf) return null;
    parentId = leaf.id;
  }
  return leaf;
};

// Resolve the "create new set on the fly" flow: find an existing Set by
// slug/name (case-insensitive collation) or create it. Returns the Set id.
const resolveOrCreateSetId = async (setName) => {
  const name = String(setName).trim();
  const slug = slugify(name);
  const existing = await prisma.set.findFirst({ where: { OR: [{ slug }, { name }] } });
  if (existing) return existing.id;
  const baseSlug = slug || `set-${Date.now()}`;
  const slugTaken = await prisma.set.findUnique({ where: { slug: baseSlug } });
  const created = await prisma.set.create({
    data: { name, slug: slugTaken ? `${baseSlug}-${Date.now()}` : baseSlug }
  });
  return created.id;
};

// Resolve any client-supplied category value (semantic key, canonical
// slug or legacy alias like `box`/`card`) to the canonical Category row.
// Returns null when the value doesn't match the taxonomy so callers can
// decide between "empty result" (filter) and a 400 (payload).
const resolveCategoryRow = async (categoryInput) => {
  const key = resolveProductCategoryKey(categoryInput);
  if (!key) return null;
  return prisma.category.upsert({
    where: { slug: PRODUCT_CATEGORIES[key].slug },
    update: {},
    create: { name: PRODUCT_CATEGORIES[key].name, slug: PRODUCT_CATEGORIES[key].slug, description: PRODUCT_CATEGORIES[key].description, isActive: true }
  });
};

// Resolve a category filter value (semantic key BOX/CARD, any slug
// at any level of the tree, or legacy alias) to the list of category
// ids it covers — the category itself plus all descendants, so picking
// a Level 1 or Level 2 node also matches products filed under its
// children. Returns null when the value matches nothing.
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
      { email: { contains: search } },
      { fullName: { contains: search } },
      { phone: { contains: search } }
    ];

    const [items, totalItems] = await Promise.all([
      prisma.user.findMany({
        where, skip, take, orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, fullName: true, phone: true, avatarUrl: true, role: true,
          status: true, ...permissionSelect,
          createdAt: true, updatedAt: true }
      }),
      prisma.user.count({ where })
    ]);

    res.status(200).json({ success: true, data: { items: items.map(withPermissions), meta: { page: Number(page), limit: take, totalItems, totalPages: Math.ceil(totalItems / take) } }, message: 'Users retrieved' });
  } catch (error) { next(error); }
};

const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params; const { role } = req.body;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundError('User not found');
    const updated = await prisma.user.update({ where: { id }, data: { role },
      select: { id: true, email: true, fullName: true, role: true, status: true, ...permissionSelect, updatedAt: true } });
    res.status(200).json({ success: true, data: withPermissions(updated), message: 'User role updated' });
  } catch (error) { next(error); }
};

const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params; const { status } = req.body;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundError('User not found');
    if (user.role === 'ADMIN' && status !== 'ACTIVE') throw new ConflictError('Cannot ban or delete an admin user');
    const updated = await prisma.user.update({ where: { id }, data: { status },
      select: { id: true, email: true, fullName: true, role: true, status: true, ...permissionSelect, updatedAt: true } });
    res.status(200).json({ success: true, data: withPermissions(updated), message: 'User status updated' });
  } catch (error) { next(error); }
};

const updateUserPermissions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundError('User not found');
    const data = extractPermissionUpdate(req.body);
    const updated = await prisma.user.update({ where: { id },
      data,
      select: { id: true, email: true, fullName: true, role: true, ...permissionSelect } });
    res.status(200).json({ success: true, data: withPermissions(updated), message: 'User permissions updated' });
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

const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) {
      throw new AppError('Bạn không thể xóa tài khoản của chính mình', 400, 'SELF_DELETE_FORBIDDEN');
    }
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundError('User not found');

    await prisma.$transaction(async (tx) => {
      // Users who placed orders can't be hard-deleted without erasing
      // financial history (Order.userId is onDelete: Restrict). Surface a
      // clear conflict instead of a raw FK error.
      const orderCount = await tx.order.count({ where: { userId: id } });
      if (orderCount > 0) {
        throw new ConflictError('Không thể xóa người dùng đã có đơn hàng. Hãy chuyển trạng thái sang "Đã xóa" thay vì xóa vĩnh viễn.');
      }
      // Posts reference the author with onDelete: Restrict — remove them so
      // the user row can be deleted. All other relations cascade.
      await tx.post.deleteMany({ where: { authorId: id } });
      await tx.user.delete({ where: { id } });
    });

    res.status(200).json({ success: true, message: 'User deleted permanently' });
  } catch (error) { next(error); }
};

// Aggregated read-only profile for the admin "View details" drawer: user
// identity + saved shipping addresses + order history summary + owned
// vouchers. Addresses are NOT a first-class table — they live in the
// client-side address book — so the backend derives them from the
// `shippingAddress` JSON snapshot stored on each order (unique by
// name/phone/street/ward/province, most recently used first).
const getUserDetail = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, fullName: true, phone: true, address: true,
        avatarUrl: true, role: true, status: true, emailVerified: true,
        ...permissionSelect, balance: true,
        createdAt: true, updatedAt: true
      }
    });
    if (!user) throw new NotFoundError('User not found');

    const [orders, userVouchers] = await Promise.all([
      prisma.order.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, orderCode: true, status: true, paymentStatus: true,
          paymentMethod: true, grandTotal: true, createdAt: true,
          shippingAddress: true,
          _count: { select: { items: true } }
        }
      }),
      prisma.userVoucher.findMany({
        where: { userId: id },
        orderBy: { claimedAt: 'desc' },
        include: {
          voucher: {
            select: {
              id: true, code: true, title: true, discountType: true,
              discountValue: true, maxDiscountAmount: true, minOrderAmount: true,
              startAt: true, endAt: true, isActive: true, scope: true
            }
          }
        }
      })
    ]);

    const addressKey = (a) => [
      a.fullName, a.phone, a.addressLine1, a.wardName || a.state, a.provinceName || a.city
    ].map((v) => String(v || '').trim().toLowerCase()).join('|');

    const addressMap = new Map();
    for (const order of orders) {
      const sa = order.shippingAddress;
      if (!sa || typeof sa !== 'object') continue;
      const key = addressKey(sa);
      if (addressMap.has(key)) {
        addressMap.get(key).orderCount += 1;
        continue;
      }
      addressMap.set(key, {
        fullName: sa.fullName || '',
        phone: sa.phone || '',
        addressLine1: sa.addressLine1 || '',
        addressLine2: sa.addressLine2 || '',
        provinceCode: sa.provinceCode || '',
        provinceName: sa.provinceName || sa.city || '',
        wardCode: sa.wardCode || '',
        wardName: sa.wardName || sa.state || '',
        country: sa.country || 'Vietnam',
        isDefault: false,
        orderCount: 1,
        lastUsedAt: order.createdAt
      });
    }

    const addresses = [...addressMap.values()]
      .sort((a, b) => new Date(b.lastUsedAt) - new Date(a.lastUsedAt));

    // The most recently used address is surfaced as the default when the
    // user's own address book never marked one (snapshots don't carry it).
    if (addresses.length > 0) addresses[0].isDefault = true;

    const PAID = ['PACKAGING', 'SHIPPING', 'DELIVERED'];
    const statusCounts = orders.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {});
    const totalSpent = orders
      .filter((o) => PAID.includes(o.status))
      .reduce((sum, o) => sum + Number(o.grandTotal || 0), 0);
    const totalOrderValue = orders
      .filter((o) => o.status !== 'CANCELLED')
      .reduce((sum, o) => sum + Number(o.grandTotal || 0), 0);

    const recentOrders = orders.slice(0, 10).map((o) => ({
      id: o.id,
      orderCode: o.orderCode,
      status: o.status,
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      grandTotal: o.grandTotal,
      createdAt: o.createdAt,
      itemCount: o._count?.items || 0
    }));

    const now = Date.now();
    const vouchers = userVouchers.map((uv) => {
      const v = uv.voucher || {};
      const expired = v.endAt ? new Date(v.endAt).getTime() < now : false;
      let voucherStatus = 'ACTIVE';
      if (!v.isActive || expired) voucherStatus = 'EXPIRED';
      if (uv.usageCount > 0) voucherStatus = 'USED';
      return {
        id: uv.id,
        voucherId: uv.voucherId,
        usageCount: uv.usageCount,
        claimedAt: uv.claimedAt,
        status: voucherStatus,
        code: v.code,
        title: v.title,
        discountType: v.discountType,
        discountValue: v.discountValue,
        maxDiscountAmount: v.maxDiscountAmount,
        minOrderAmount: v.minOrderAmount,
        scope: v.scope,
        startAt: v.startAt,
        endAt: v.endAt
      };
    });

    res.status(200).json({
      success: true,
      data: {
        user,
        addresses,
        orderSummary: {
          totalOrders: orders.length,
          totalSpent,
          totalOrderValue,
          statusCounts
        },
        recentOrders,
        vouchers
      },
      message: 'User detail retrieved'
    });
  } catch (error) { next(error); }
};

// ==================== PRODUCT MANAGEMENT ====================

const listProducts = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, status, setId, categoryId, category, language, rarity, cardSet } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);
    const where = {};
    if (status) where.status = status;
    if (setId) where.sets = { some: { id: setId } };
    if (category) {
      const ids = await resolveCategoryTreeIds(category);
      if (!ids) {
        where.categoryId = '__no_match__';
      } else {
        where.categoryId = ids.length > 1 ? { in: ids } : ids[0];
      }
    } else if (categoryId) {
      where.categoryId = categoryId;
    }
    // Dynamic TCG attribute filters (single cards) — any combination
    if (language) where.language = language;
    if (rarity) where.rarity = rarity;
    if (cardSet) where.cardSet = { contains: cardSet };
    if (search) where.OR = [
      { name: { contains: search } },
      { shortName: { contains: search } },
      { slug: { contains: search } },
      { cardNumber: { contains: search } },
      { cardSet: { contains: search } }
    ];

    const [items, totalItems] = await Promise.all([
      prisma.product.findMany({
        where, skip, take, orderBy: { createdAt: 'desc' },
        include: { sets: true, variants: true, category: true }
      }),
      prisma.product.count({ where })
    ]);

    const formatProductOutput = (p) => {
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

    res.status(200).json({
      success: true,
      data: {
        items: items.map(formatProductOutput),
        meta: { page: Number(page), limit: take, totalItems, totalPages: Math.ceil(totalItems / take) }
      },
      message: 'Products retrieved'
    });
  } catch (error) { next(error); }
};

const createProduct = async (req, res, next) => {
  try {
    const data = req.body;
    const slug = data.slug || slugify(data.name);
    const existing = await prisma.product.findUnique({ where: { slug } });
    if (existing) throw new ConflictError('Slug already exists');

    // Resolve the category reference. When the frontend sends a `categoryPath`
    // (cascading series → expansion from the creatable selects) the whole
    // nested chain is created/healed and the leaf row is used; otherwise the
    // single free-form `category` value is resolved as before.
    const { variants, setIds, newSetName, shortName, frontImage, backImage, tcgplayerId, category, categoryPath, images, language, cardSet, artist, ...restData } = data;
    const leafCategory = categoryPath?.length
      ? await resolveCategoryPath(categoryPath)
      : null;
    const resolvedCategoryId = leafCategory
      ? leafCategory.id
      : await resolveCategoryId(category);

    // Creatable Expansion Set — create/link the Set row before connecting
    const finalSetIds = [...(setIds || [])];
    if (newSetName && String(newSetName).trim()) {
      finalSetIds.push(await resolveOrCreateSetId(newSetName));
    }

    let sanitizedImages = [];
    if (Array.isArray(images)) {
      sanitizedImages = images.filter((img) => typeof img === 'string' && img.trim().length > 0);
    } else if (typeof images === 'string') {
      try {
        const parsed = JSON.parse(images);
        if (Array.isArray(parsed)) sanitizedImages = parsed.filter((img) => typeof img === 'string' && img.trim().length > 0);
      } catch {
        if (images.trim()) sanitizedImages = [images.trim()];
      }
    }
    if (sanitizedImages.length === 0 && frontImage && String(frontImage).trim()) {
      sanitizedImages.push(String(frontImage).trim());
    }
    if (sanitizedImages.length <= 1 && backImage && String(backImage).trim()) {
      sanitizedImages.push(String(backImage).trim());
    }

    const finalBackImage = sanitizedImages[1] || (backImage && String(backImage).trim()) || null;

    const product = await prisma.product.create({
      data: {
        ...restData,
        slug,
        categoryId: resolvedCategoryId,
        // MariaDB: images là JSON — lưu mảng URL
        images: sanitizedImages,
        shortName: shortName || null,
        backImage: finalBackImage,
        tcgplayerId: tcgplayerId || null,
        // TCG metadata (single cards)
        language: language || null,
        cardSet: cardSet || null,
        artist: artist || null,
        ...(finalSetIds.length > 0 && { sets: { connect: finalSetIds.map(id => ({ id })) } }),
        ...(variants && variants.length > 0 && {
          variants: {
            create: variants.map(v => ({
              condition: (v.condition === '' || v.condition === null || v.condition === undefined)
                ? 'NEAR_MINT'
                : v.condition,
              variant: v.variant || 'Normal',
              price: Number(v.price),
              stockQuantity: Number(v.stockQuantity) || 0
            }))
          }
        })
      },
      include: { variants: true, sets: true, category: true }
    });

    const responseData = {
      ...product,
      images: sanitizedImages,
      frontImage: sanitizedImages[0] || null,
      backImage: finalBackImage
    };

    clearCatalogCache();
    res.status(201).json({ success: true, data: responseData, message: 'Product created' });
  } catch (error) { next(error); }
};

const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = { ...req.body };
    const product = await prisma.product.findUnique({ where: { id }, include: { variants: true, sets: true, category: true } });
    if (!product) throw new NotFoundError('Product not found');

    let slug = product.slug;
    if (data.slug) slug = data.slug;
    else if (data.name && data.name !== product.name) slug = slugify(data.name);
    if (slug !== product.slug) {
      const existing = await prisma.product.findUnique({ where: { slug } });
      if (existing && existing.id !== id) throw new ConflictError('Slug already exists');
    }

    const { variants, setIds, newSetName, shortName, frontImage, backImage, tcgplayerId, category, categoryPath, images, language, cardSet, artist, ...restData } = data;

    // Resolve the category reference if it is being changed
    let resolvedCategoryId = product.categoryId;
    if (categoryPath?.length) {
      const leafCategory = await resolveCategoryPath(categoryPath);
      if (leafCategory) resolvedCategoryId = leafCategory.id;
    } else if (category !== undefined && category !== null && String(category).trim() !== '') {
      resolvedCategoryId = await resolveCategoryId(category);
    }

    // Creatable Expansion Set — append the freshly created/linked Set id
    let finalSetIds = setIds;
    if (newSetName && String(newSetName).trim()) {
      finalSetIds = [...(setIds || []), await resolveOrCreateSetId(newSetName)];
    }

    // Xử lý variants: xóa cũ, tạo mới (đơn giản và an toàn)
    await prisma.productVariant.deleteMany({ where: { productId: id } });

    let updatedImages = product.images || [];
    if (typeof updatedImages === 'string') {
      try { updatedImages = JSON.parse(updatedImages); } catch { updatedImages = []; }
    }
    if (!Array.isArray(updatedImages)) updatedImages = [];

    let hasImageUpdate = false;
    if (images !== undefined) {
      hasImageUpdate = true;
      updatedImages = Array.isArray(images)
        ? images.filter((img) => typeof img === 'string' && img.trim().length > 0)
        : [];
    }
    if (frontImage !== undefined && String(frontImage).trim()) {
      hasImageUpdate = true;
      if (updatedImages.length === 0) updatedImages.push(String(frontImage).trim());
      else updatedImages[0] = String(frontImage).trim();
    }
    if (backImage !== undefined && String(backImage).trim()) {
      hasImageUpdate = true;
      if (updatedImages.length <= 1) {
        if (updatedImages.length === 0) updatedImages.push('');
        updatedImages[1] = String(backImage).trim();
      } else {
        updatedImages[1] = String(backImage).trim();
      }
    }

    const finalBackImage = updatedImages[1] || (backImage !== undefined ? (backImage || null) : product.backImage);

    const updateData = {
      ...restData,
      slug,
      categoryId: resolvedCategoryId,
      ...(hasImageUpdate && { images: updatedImages }),
      shortName: shortName !== undefined ? (shortName || null) : product.shortName,
      backImage: finalBackImage,
      tcgplayerId: tcgplayerId !== undefined ? (tcgplayerId || null) : product.tcgplayerId,
      // TCG metadata (single cards) — null clears, undefined keeps existing
      language: language !== undefined ? (language || null) : product.language,
      cardSet: cardSet !== undefined ? (cardSet || null) : product.cardSet,
      artist: artist !== undefined ? (artist || null) : product.artist,
    };

    if (finalSetIds !== undefined) {
      updateData.sets = { set: finalSetIds.map(setId => ({ id: setId })) };
    }

    await prisma.product.update({
      where: { id },
      data: updateData,
    });

    // Auto-purge rule: if the product was re-tagged away from its previous
    // category and no products remain there, archive the empty sealed
    // category (opt-in via AUTO_CLEAN_EMPTY_CATEGORIES=true).
    if (product.category?.slug && product.categoryId !== resolvedCategoryId) {
      await autoArchiveEmptySealedCategory(product.category.slug);
    }

    if (variants && variants.length > 0) {
      await prisma.productVariant.createMany({
        data: variants.map(v => ({
          productId: id,
          condition: (v.condition === '' || v.condition === null || v.condition === undefined)
            ? 'NEAR_MINT'
            : v.condition,
          variant: v.variant || 'Normal',
          price: Number(v.price),
          stockQuantity: Number(v.stockQuantity) || 0
        }))
      });
    }

    const updated = await prisma.product.findUnique({ where: { id }, include: { variants: true, sets: true, category: true } });
    let finalImgs = updated.images;
    if (typeof finalImgs === 'string') {
      try { finalImgs = JSON.parse(finalImgs); } catch { finalImgs = []; }
    }
    if (!Array.isArray(finalImgs)) finalImgs = [];

    const responseData = {
      ...updated,
      images: finalImgs,
      frontImage: finalImgs[0] || null,
      backImage: finalImgs[1] || updated.backImage || null
    };

    clearCatalogCache();
    res.status(200).json({ success: true, data: responseData, message: 'Product updated' });
  } catch (error) { next(error); }
};

const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({ where: { id }, include: { category: true } });
    if (!product) throw new NotFoundError('Product not found');

    await prisma.productVariant.deleteMany({ where: { productId: id } });
    await prisma.product.delete({ where: { id } });

    // Auto-purge rule: if this was the last product tagged with a sealed
    // category, archive the now-empty catalogue entry (opt-in).
    await autoArchiveEmptySealedCategory(product.category?.slug);

    clearCatalogCache();
    res.status(200).json({ success: true, message: 'Product deleted permanently' });
  } catch (error) { next(error); }
};

// ==================== CATEGORY MANAGEMENT ====================

  const listAdminCategories = async (req, res, next) => {
    try {
      const { activeOnly } = req.query;
      // Admin mode returns ALL categories regardless of product count —
      // newly created tags (Series, Expansion Set, Sealed Type) must
      // appear in the options list immediately after creation, even
      // before any product is assigned to them. Pruning by product
      // count would hide them and cause the Options Fetch API to
      // return empty lists. `activeOnly=false` is also kept for the
      // Category Management page which needs the full tree.
      const where = activeOnly === 'false'
        ? {}
        : { isActive: true };
      const categories = await prisma.category.findMany({
        where,
        orderBy: { name: 'asc' },
        include: {
          parent: { select: { id: true, name: true, slug: true } },
          _count: { select: { products: { where: { status: 'ACTIVE' } } } }
        }
      });
      res.status(200).json({ success: true, data: categories, message: 'Categories retrieved' });
    } catch (error) { next(error); }
  };

const createCategory = async (req, res, next) => {
  try {
    const { name, slug, description, imageUrl, isActive, parentId } = req.body;
    const finalSlug = slug || slugify(name);
    const existing = await prisma.category.findUnique({ where: { slug: finalSlug } });
    if (existing) throw new ConflictError('Category slug already exists');
    if (parentId) {
      const parent = await prisma.category.findUnique({ where: { id: parentId } });
      if (!parent) throw new NotFoundError('Parent category not found');
    }
    const category = await prisma.category.create({
      data: {
        name,
        slug: finalSlug,
        description: description || null,
        imageUrl: imageUrl || null,
        isActive: isActive ?? true,
        parentId: parentId || null
      },
      include: { parent: { select: { id: true, name: true, slug: true } } }
    });
    clearCatalogCache();
    res.status(201).json({ success: true, data: category, message: 'Category created' });
  } catch (error) { next(error); }
};

const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, slug, description, imageUrl, isActive, parentId } = req.body;
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundError('Category not found');

    const data = {};
    if (name !== undefined) data.name = name;
    if (slug !== undefined) data.slug = slug;
    if (description !== undefined) data.description = description;
    if (imageUrl !== undefined) data.imageUrl = imageUrl || null;
    if (isActive !== undefined) data.isActive = isActive;
    // Re-parent within the tree; null moves the node back to root level.
    if (parentId !== undefined) {
      if (parentId) {
        if (parentId === id) throw new AppError('A category cannot be its own parent', 400, 'VALIDATION_ERROR');
        const parent = await prisma.category.findUnique({ where: { id: parentId } });
        if (!parent) throw new NotFoundError('Parent category not found');
      }
      data.parentId = parentId || null;
    }

    const updated = await prisma.category.update({ where: { id }, data });
    clearCatalogCache();
    res.status(200).json({ success: true, data: updated, message: 'Category updated' });
  } catch (error) { next(error); }
};

const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true, children: true } } }
    });
    if (!category) throw new NotFoundError('Category not found');

    // Block deletion of tree nodes with children (prevents orphaned subtrees)
    if (category._count.children > 0) {
      throw new ConflictError('Cannot delete a category that still has sub-categories. Remove or reassign them first.');
    }

    // Block deletion if the category still contains products (prevents orphaned products)
    if (category._count.products > 0) {
      throw new ConflictError('Cannot delete category because it still contains products. Reassign or delete those products first.');
    }

    await prisma.category.delete({ where: { id } });
    clearCatalogCache();
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
    // Master data for the admin Set Management page is always the full
    // catalogue. Consumers that render a FILTER dropdown (or the product
    // form's expansion-set matcher, where the edited product itself keeps
    // its set non-empty) pass ?prune=active to hide expansion sets that
    // currently have zero ACTIVE products — dynamic pruning parity with
    // the storefront sidebar.
    const prune = req.query.prune === 'active';
    const sets = await prisma.set.findMany({
      where: prune ? { products: { some: { status: 'ACTIVE' } } } : {},
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: { where: { status: 'ACTIVE' } } } } }
    });
    res.status(200).json({ success: true, data: sets, message: 'Sets retrieved' });
  } catch (error) { next(error); }
};

const createSet = async (req, res, next) => {
  try {
    const { name, code } = req.body;
    const slug = slugify(name);
    const existing = await prisma.set.findUnique({ where: { slug } });
    if (existing) throw new ConflictError('Slug already exists');
    if (code) {
      const codeTaken = await prisma.set.findFirst({ where: { code } });
      if (codeTaken) throw new ConflictError(`Set code "${code}" is already used by "${codeTaken.name}"`);
    }
    const set = await prisma.set.create({ data: { name, slug, code: code || null } });
    clearCatalogCache();
    res.status(201).json({ success: true, data: set, message: 'Set created' });
  } catch (error) { next(error); }
};

const updateSet = async (req, res, next) => {
  try {
    const { id } = req.params; const { name, code } = req.body;
    const set = await prisma.set.findUnique({ where: { id } });
    if (!set) throw new NotFoundError('Set not found');
    const slug = slugify(name || set.name);
    if (slug !== set.slug) {
      const existing = await prisma.set.findUnique({ where: { slug } });
      if (existing && existing.id !== id) throw new ConflictError('Slug already exists');
    }
    const nextCode = code !== undefined ? (code || null) : set.code;
    if (nextCode) {
      const codeTaken = await prisma.set.findFirst({ where: { code: nextCode, id: { not: id } } });
      if (codeTaken) throw new ConflictError(`Set code "${nextCode}" is already used by "${codeTaken.name}"`);
    }
    const updated = await prisma.set.update({ where: { id }, data: { name: name ?? set.name, slug, code: nextCode, updatedAt: new Date() } });
    clearCatalogCache();
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
    clearCatalogCache();
    res.status(200).json({ success: true, message: 'Set and its products deleted' });
  } catch (error) { next(error); }
};

// ==================== RARITY MANAGEMENT (Độ hiếm) ====================

// Batch usage counts for a list of rarity options — one grouped product scan
// instead of N queries. Product.rarity stores the rarity `name`. Returns
// Map(rarityId -> non-deleted product count).
const rarityUsageCounts = async (rarities) => {
  const counts = new Map();
  if (!rarities.length) return counts;

  const groups = await prisma.product.groupBy({
    by: ['rarity'],
    where: { deletedAt: null, rarity: { not: null } },
    _count: { _all: true }
  });

  const byRarityValue = new Map();
  for (const group of groups) {
    const key = String(group.rarity || '').trim().toLowerCase();
    if (!key) continue;
    byRarityValue.set(key, (byRarityValue.get(key) || 0) + group._count._all);
  }

  for (const rarity of rarities) {
    const key = String(rarity.name || '').trim().toLowerCase();
    counts.set(rarity.id, key ? (byRarityValue.get(key) || 0) : 0);
  }
  return counts;
};

// Dynamic rarity options — managed like Series/Era + Expansion Sets.
// `activeOnly=false` returns disabled rarities too (catalog settings page).
const listRarities = async (req, res, next) => {
  try {
    const activeOnly = req.query.activeOnly !== 'false';
    const rarities = await prisma.rarity.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: [{ name: 'asc' }]
    });
    const usageCounts = await rarityUsageCounts(rarities);
    const data = rarities.map((r) => ({ ...r, productCount: usageCounts.get(r.id) || 0 }));
    res.status(200).json({ success: true, data, message: 'Rarities retrieved' });
  } catch (error) { next(error); }
};

const createRarity = async (req, res, next) => {
  try {
    const { name, isActive } = req.body;
    const finalName = String(name).trim();
    const dupe = await prisma.rarity.findFirst({ where: { name: finalName } });
    if (dupe) throw new ConflictError(`Rarity "${dupe.name}" already exists`);
    const rarity = await prisma.rarity.create({
      data: { name: finalName, isActive: isActive ?? true }
    });
    res.status(201).json({ success: true, data: rarity, message: 'Rarity created' });
  } catch (error) { next(error); }
};

const updateRarity = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await prisma.rarity.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Rarity not found');
    const { name, isActive } = req.body;

    const data = {};
    if (name !== undefined) {
      const nextName = String(name).trim();
      if (nextName !== existing.name) {
        const taken = await prisma.rarity.findFirst({ where: { name: nextName, id: { not: id } } });
        if (taken) throw new ConflictError(`Rarity name "${nextName}" already exists`);
      }
      data.name = nextName;
    }
    if (isActive !== undefined) data.isActive = isActive;

    const updated = await prisma.rarity.update({ where: { id }, data });
    res.status(200).json({ success: true, data: updated, message: 'Rarity updated' });
  } catch (error) { next(error); }
};

const deleteRarity = async (req, res, next) => {
  try {
    const { id } = req.params;
    const rarity = await prisma.rarity.findUnique({ where: { id } });
    if (!rarity) throw new NotFoundError('Rarity not found');
    await prisma.rarity.delete({ where: { id } });
    res.status(200).json({ success: true, message: 'Rarity deleted' });
  } catch (error) { next(error); }
};

// ==================== CARD CONDITION MANAGEMENT (Tình trạng thẻ) ===========

// Batch usage counts for a list of card-condition options — one grouped
// ProductVariant scan instead of N queries. ProductVariant.condition stores
// the condition `name`. Returns Map(conditionId -> non-deleted product count).
const conditionUsageCounts = async (conditions) => {
  const counts = new Map();
  if (!conditions.length) return counts;

  const groups = await prisma.productVariant.groupBy({
    by: ['condition'],
    where: { product: { deletedAt: null } },
    _count: { _all: true }
  });

  const byValue = new Map();
  for (const group of groups) {
    const key = String(group.condition || '').trim().toLowerCase();
    if (!key) continue;
    byValue.set(key, (byValue.get(key) || 0) + group._count._all);
  }

  for (const condition of conditions) {
    const key = String(condition.name || '').trim().toLowerCase();
    counts.set(condition.id, key ? (byValue.get(key) || 0) : 0);
  }
  return counts;
};

// Dynamic card-condition options ("Tình trạng thẻ") — managed like Rarities /
// Sealed Categories. `activeOnly=false` returns disabled rows too (catalog
// settings); the inventory modal reads the default active-only list.
const listCardConditions = async (req, res, next) => {
  try {
    const activeOnly = req.query.activeOnly !== 'false';
    const conditions = await prisma.cardConditionOption.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: [{ name: 'asc' }]
    });
    const usageCounts = await conditionUsageCounts(conditions);
    const data = conditions.map((c) => ({ ...c, productCount: usageCounts.get(c.id) || 0 }));
    res.status(200).json({ success: true, data, message: 'Card conditions retrieved' });
  } catch (error) { next(error); }
};

const createCardCondition = async (req, res, next) => {
  try {
    const { name, isActive } = req.body;
    const finalName = String(name).trim();
    const dupe = await prisma.cardConditionOption.findFirst({ where: { name: finalName } });
    if (dupe) throw new ConflictError(`Card condition "${dupe.name}" already exists`);
    const condition = await prisma.cardConditionOption.create({
      data: { name: finalName, isActive: isActive ?? true }
    });
    res.status(201).json({ success: true, data: condition, message: 'Card condition created' });
  } catch (error) { next(error); }
};

const updateCardCondition = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await prisma.cardConditionOption.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Card condition not found');
    const { name, isActive } = req.body;

    const data = {};
    if (name !== undefined) {
      const nextName = String(name).trim();
      if (nextName !== existing.name) {
        const taken = await prisma.cardConditionOption.findFirst({ where: { name: nextName, id: { not: id } } });
        if (taken) throw new ConflictError(`Card condition name "${nextName}" already exists`);
      }
      data.name = nextName;
    }
    if (isActive !== undefined) data.isActive = isActive;

    const updated = await prisma.cardConditionOption.update({ where: { id }, data });
    res.status(200).json({ success: true, data: updated, message: 'Card condition updated' });
  } catch (error) { next(error); }
};

const deleteCardCondition = async (req, res, next) => {
  try {
    const { id } = req.params;
    const condition = await prisma.cardConditionOption.findUnique({ where: { id } });
    if (!condition) throw new NotFoundError('Card condition not found');
    await prisma.cardConditionOption.delete({ where: { id } });
    res.status(200).json({ success: true, message: 'Card condition deleted' });
  } catch (error) { next(error); }
};

// ==================== CARD LANGUAGE MANAGEMENT (Ngôn ngữ) ==================

// Batch usage counts for a list of language options — one grouped product scan
// instead of N queries. Product.language stores the language `name` as a free
// string. Returns Map(languageId -> non-deleted product count).
const languageUsageCounts = async (languages) => {
  const counts = new Map();
  if (!languages.length) return counts;

  const groups = await prisma.product.groupBy({
    by: ['language'],
    where: { deletedAt: null, language: { not: null } },
    _count: { _all: true }
  });

  const byValue = new Map();
  for (const group of groups) {
    const key = String(group.language || '').trim().toLowerCase();
    if (!key) continue;
    byValue.set(key, (byValue.get(key) || 0) + group._count._all);
  }

  for (const language of languages) {
    const key = String(language.name || '').trim().toLowerCase();
    counts.set(language.id, key ? (byValue.get(key) || 0) : 0);
  }
  return counts;
};

// Dynamic product-language options ("Ngôn ngữ") — managed like Rarities /
// Sealed Categories / Card Conditions. `activeOnly=false` returns disabled
// rows too (catalog settings page). Aggregates the linked product count as
// `productCount` (equivalent to `_count.products`) for the "SỐ SẢN PHẨM" column.
const listLanguages = async (req, res, next) => {
  try {
    const activeOnly = req.query.activeOnly !== 'false';
    const languages = await prisma.cardLanguage.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: [{ name: 'asc' }]
    });
    const usageCounts = await languageUsageCounts(languages);
    const data = languages.map((l) => ({ ...l, productCount: usageCounts.get(l.id) || 0 }));
    res.status(200).json({ success: true, data, message: 'Languages retrieved' });
  } catch (error) { next(error); }
};

const createLanguage = async (req, res, next) => {
  try {
    const { name, isActive } = req.body;
    const finalName = String(name).trim();
    const dupe = await prisma.cardLanguage.findFirst({ where: { name: finalName } });
    if (dupe) throw new ConflictError(`Language "${dupe.name}" already exists`);
    const language = await prisma.cardLanguage.create({
      data: { name: finalName, isActive: isActive ?? true }
    });
    res.status(201).json({ success: true, data: language, message: 'Language created' });
  } catch (error) { next(error); }
};

const updateLanguage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await prisma.cardLanguage.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Language not found');
    const { name, isActive } = req.body;

    const data = {};
    if (name !== undefined) {
      const nextName = String(name).trim();
      if (nextName !== existing.name) {
        const taken = await prisma.cardLanguage.findFirst({ where: { name: nextName, id: { not: id } } });
        if (taken) throw new ConflictError(`Language name "${nextName}" already exists`);
      }
      data.name = nextName;
    }
    if (isActive !== undefined) data.isActive = isActive;

    const updated = await prisma.cardLanguage.update({ where: { id }, data });
    res.status(200).json({ success: true, data: updated, message: 'Language updated' });
  } catch (error) { next(error); }
};

const deleteLanguage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const language = await prisma.cardLanguage.findUnique({ where: { id } });
    if (!language) throw new NotFoundError('Language not found');

    const usageCounts = await languageUsageCounts([language]);
    const productCount = usageCounts.get(language.id) || 0;
    if (productCount > 0) {
      throw new ConflictError('Không thể xoá khi còn sản phẩm liên kết');
    }

    await prisma.cardLanguage.delete({ where: { id } });
    res.status(200).json({ success: true, message: 'Language deleted' });
  } catch (error) { next(error); }
};

// ==================== SEALED CATEGORY MANAGEMENT (Danh mục Sealed Product) ==

// Dynamic sealed-product categories — CRUD parity with Rarities. GET returns
// all rows so catalog settings can manage disabled options too; the product
// modal reads the public /sealed-categories endpoint (active only).
const listSealedCategories = async (req, res, next) => {
  try {
    const activeOnly = req.query.activeOnly !== 'false';
    const categories = await prisma.sealedCategory.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: [{ name: 'asc' }]
    });
    const usageCounts = await sealedCategoryUsageCounts(categories);
    const data = categories.map((c) => ({ ...c, productCount: usageCounts.get(c.id) || 0 }));
    res.status(200).json({ success: true, data, message: 'Sealed categories retrieved' });
  } catch (error) { next(error); }
};

const createSealedCategory = async (req, res, next) => {
  try {
    const { name, isActive } = req.body;
    const finalName = String(name).trim();
    const dupe = await prisma.sealedCategory.findFirst({ where: { name: finalName } });
    if (dupe) throw new ConflictError(`Sealed category "${dupe.name}" already exists`);
    const category = await prisma.sealedCategory.create({
      data: { name: finalName, isActive: isActive ?? true }
    });
    res.status(201).json({ success: true, data: category, message: 'Sealed category created' });
  } catch (error) { next(error); }
};

const updateSealedCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await prisma.sealedCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Sealed category not found');
    const { name, isActive } = req.body;

    const data = {};
    if (name !== undefined) {
      const nextName = String(name).trim();
      if (nextName !== existing.name) {
        const taken = await prisma.sealedCategory.findFirst({ where: { name: nextName, id: { not: id } } });
        if (taken) throw new ConflictError(`Sealed category name "${nextName}" already exists`);
      }
      data.name = nextName;
    }
    if (isActive !== undefined) data.isActive = isActive;

    const updated = await prisma.sealedCategory.update({ where: { id }, data });
    res.status(200).json({ success: true, data: updated, message: 'Sealed category updated' });
  } catch (error) { next(error); }
};

// The product form stores a SealedCategory `name` as the leaf Category slug
// (categoryPath ["BOX", name]) and, for legacy rows, the category name. So a
// sealed category's usage count is the number of non-deleted products whose
// leaf Category slug matches any normalized variant of name / slugified name.
const sealedCategoryProductSlugs = (category) => {
  const slugs = new Set();
  const raw = category?.name;
  if (raw !== undefined && raw !== null) {
    const value = String(raw).trim();
    if (value) {
      slugs.add(value);
      const slug = slugify(value);
      if (slug) slugs.add(slug);
    }
  }
  return [...slugs];
};

const countProductsForSealedCategory = async (category) => {
  const slugs = sealedCategoryProductSlugs(category);
  if (slugs.length === 0) return 0;
  return prisma.product.count({
    where: { deletedAt: null, category: { slug: { in: slugs } } }
  });
};

// Batch usage counts for a list of sealed categories — a single product scan
// instead of N queries. Returns Map(sealedCategoryId -> linked product count),
// used by the Catalog Settings "Số sản phẩm" column.
const sealedCategoryUsageCounts = async (categories) => {
  const slugToCategoryIds = new Map();
  for (const category of categories) {
    for (const slug of sealedCategoryProductSlugs(category)) {
      const ids = slugToCategoryIds.get(slug) || [];
      if (!ids.includes(category.id)) ids.push(category.id);
      slugToCategoryIds.set(slug, ids);
    }
  }
  const slugs = [...slugToCategoryIds.keys()];
  const counts = new Map();
  if (slugs.length === 0) return counts;

  const rows = await prisma.product.findMany({
    where: { deletedAt: null, category: { slug: { in: slugs } } },
    select: { category: { select: { slug: true } } }
  });
  for (const row of rows) {
    const slug = row.category?.slug;
    for (const id of (slugToCategoryIds.get(slug) || [])) {
      counts.set(id, (counts.get(id) || 0) + 1);
    }
  }
  return counts;
};

// Optional dynamic rule: when enabled via AUTO_CLEAN_EMPTY_CATEGORIES=true,
// deleting/unlinking the last product of a sealed category archives (soft
// disables) the now-empty catalogue entry instead of leaving it dangling.
const isAutoCleanEmptyCategoriesEnabled = () =>
  String(process.env.AUTO_CLEAN_EMPTY_CATEGORIES || '').toLowerCase() === 'true';

const autoArchiveEmptySealedCategory = async (categorySlug) => {
  const slug = categorySlug ? String(categorySlug).trim() : '';
  if (!isAutoCleanEmptyCategoriesEnabled() || !slug) return null;
  const sealed = await prisma.sealedCategory.findFirst({
    where: { OR: [{ name: slug }, { name: slugify(slug) }] }
  });
  if (!sealed || !sealed.isActive) return null;
  const remaining = await countProductsForSealedCategory(sealed);
  if (remaining > 0) return null;
  return prisma.sealedCategory.update({ where: { id: sealed.id }, data: { isActive: false } });
};

const deleteSealedCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await prisma.sealedCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundError('Sealed category not found');

    // Safeguard: never orphan products that are still tagged with this
    // category. Admin must unlink/re-tag them first.
    const usageCount = await countProductsForSealedCategory(category);
    if (usageCount > 0) {
      throw new ConflictError(
        `Không thể xóa danh mục này vì còn ${usageCount} sản phẩm đang sử dụng. Vui lòng gỡ tag sản phẩm trước.`
      );
    }

    await prisma.sealedCategory.delete({ where: { id } });
    res.status(200).json({ success: true, message: 'Sealed category deleted' });
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
    if (search) where.orderCode = { contains: search };

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
    const { id: orderId } = req.params; const { status: newStatus, note, trackingNumber } = req.body;
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
        const locked = await tx.$queryRaw`SELECT * FROM \`Order\` WHERE \`id\` = ${orderId} FOR UPDATE`;
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
      if (!trackingNumber || !trackingNumber.trim()) {
        throw new AppError('Mã vận đơn là bắt buộc để bắt đầu vận chuyển', 400, 'VALIDATION_ERROR');
      }
      await prisma.$transaction(async (tx) => {
        await tx.order.update({ where: { id: orderId }, data: { status: 'SHIPPING', trackingNumber: trackingNumber.trim(), version: { increment: 1 } } });
        await tx.orderStatusHistory.create({ data: { orderId, oldStatus, newStatus, note: note || `Bắt đầu vận chuyển bởi ${adminUserId} — Mã vận đơn: ${trackingNumber.trim()}`, changedByUserId: adminUserId } });
      });
    } else if (newStatus === 'DELIVERED' && oldStatus === 'SHIPPING') {
      await prisma.$transaction(async (tx) => {
        await tx.order.update({ where: { id: orderId }, data: { status: 'DELIVERED', completedAt: new Date(), version: { increment: 1 } } });
        await tx.orderStatusHistory.create({ data: { orderId, oldStatus, newStatus, note: note || `Đã giao hàng bởi ${adminUserId}`, changedByUserId: adminUserId } });
      });
    } else if (newStatus === 'CANCELLED' && ['PENDING', 'PACKAGING'].includes(oldStatus)) {
      const voucherService = require('../services/voucher.service');
      await prisma.$transaction(async (tx) => {
        // Hoàn lượt dùng voucher chỉ khi đơn PENDING chưa thanh toán
        if (order.voucherCode && oldStatus === 'PENDING') {
          await voucherService.rollbackVoucherTx(tx, { userId: order.userId, voucherCode: order.voucherCode });
        }
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
        const locked = await tx.$queryRaw`SELECT * FROM \`Order\` WHERE \`id\` = ${order.id} FOR UPDATE`;
        if (!locked || locked.length === 0) throw new NotFoundError('Order not found');
        if (locked[0].status !== 'PENDING') throw new ConflictError('Order no longer pending');

        const now = new Date();
        await tx.order.update({ where: { id: order.id }, data: { status: 'PACKAGING', paymentStatus: 'COMPLETED', paidAt: now, version: { increment: 1 } } });
        if (log.paymentId) await tx.payment.update({ where: { id: log.paymentId }, data: { status: 'COMPLETED', paidAt: now } });
        // Stock đã được reserve ngay khi tạo đơn — không trừ thêm khi confirm thanh toán
        await tx.orderStatusHistory.create({ data: { orderId: order.id, oldStatus: 'PENDING', newStatus: 'PACKAGING', note: note || `Manual reconciliation by admin ${adminUserId}` } });
        await tx.paymentLog.update({ where: { id: paymentLogId }, data: { status: 'COMPLETED', processedAt: now, errorMessage: null } });
      });
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
        WITH RECURSIVE days(d) AS (
          SELECT CURRENT_DATE - INTERVAL 6 DAY
          UNION ALL
          SELECT d + INTERVAL 1 DAY FROM days WHERE d < CURRENT_DATE
        )
        SELECT DATE_FORMAT(d, '%Y-%m-%d') AS date,
               COALESCE(SUM(o.\`grandTotal\`), 0) AS revenue,
               CAST(COUNT(o.\`id\`) AS SIGNED) AS orders
        FROM days
        LEFT JOIN \`Order\` o
          ON o.\`paidAt\` >= d
         AND o.\`paidAt\` < d + INTERVAL 1 DAY
         AND o.\`status\` IN ('PACKAGING', 'SHIPPING', 'DELIVERED')
        GROUP BY d
        ORDER BY d ASC
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
      revenueByDay: revenueByDay.map(r => ({ date: r.date, revenue: Number(r.revenue), orders: Number(r.orders) }))
    }, message: 'Dashboard stats retrieved' });
  } catch (error) { next(error); }
};

// ==================== VIRTUAL BOX MANAGEMENT ====================

// Pool entries submitted by the admin UI. Two accepted shapes:
//  1. { gachaCardId, rarity?, setCode?, dropRate? } — reference to an
//     existing GachaCard
//  2. { name, imageUrl?, rarity, setCode?, dropRate? } — free-form card
//     definition, created (or updated) as a dedicated GachaCard row.
// The gacha pool is fully decoupled from the retail shop inventory:
// Product/Card (shop) references are never used here.
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

// Resolve an inline card definition to a GachaCard row: find-or-create by
// slug, refreshing artwork/set metadata when the entry carries it so
// re-saving a box never silently drops uploaded card images.
const ensureGachaCard = async (entry) => {
  const name = String(entry.name || '').trim();
  if (!name) throw new AppError('Pool card name is required', 400, 'VALIDATION_ERROR');
  const rarity = normalizeRarity(entry.rarity);
  const slug = `gacha-${slugify(name)}`;
  // `image` is accepted as an alias of `imageUrl` on pool entries
  const imageUrl = String(entry.imageUrl || entry.image || '').trim() || null;
  const setCode = String(entry.setCode || '').trim() || null;
  const dropRate = Number.isFinite(Number(entry.dropRate)) && Number(entry.dropRate) > 0
    ? Number(entry.dropRate)
    : 1;

  const existing = await prisma.gachaCard.findUnique({ where: { slug } });
  if (existing) {
    // Persist newly uploaded artwork: keep the existing image only when the
    // entry carries no image, otherwise prefer the submitted one. Without
    // this, re-saving a box silently drops uploaded card images.
    const patch = {};
    if (imageUrl && imageUrl !== existing.imageUrl) patch.imageUrl = imageUrl;
    if (setCode && setCode !== existing.setCode) patch.setCode = setCode;
    if (entry.rarity && existing.rarity !== rarity) patch.rarity = rarity;
    if (Number(entry.dropRate) > 0) patch.dropRate = dropRate;
    if (Object.keys(patch).length > 0) {
      return prisma.gachaCard.update({ where: { id: existing.id }, data: patch });
    }
    return existing;
  }

  return prisma.gachaCard.create({
    data: { name, slug, imageUrl, rarity, setCode, dropRate }
  });
};

// Build the canonical pool payload: direct GachaCard refs are validated,
// free-form entries are resolved/created as GachaCards.
const resolvePoolEntries = async (pool) => {
  if (!pool || pool.length === 0) return [];

  const resolved = [];
  for (const entry of pool) {
    if (entry.gachaCardId) {
      resolved.push({
        gachaCardId: entry.gachaCardId,
        rarity: normalizeRarity(entry.rarity),
        setCode: entry.setCode ?? null,
        dropRate: entry.dropRate
      });
    } else {
      const card = await ensureGachaCard(entry);
      resolved.push({
        gachaCardId: card.id,
        rarity: card.rarity,
        setCode: card.setCode,
        dropRate: card.dropRate
      });
    }
  }

  await assertVirtualBoxReferences(resolved);
  return resolved;
};

// Replace the box's pool items. The opener reads poolItems (with the
// joined GachaCard), so this is the single source of truth for the pool.
const syncPoolItems = async (tx, boxId, resolvedPool) => {
  await tx.virtualBoxPoolItem.deleteMany({ where: { boxId } });
  const seenCardIds = new Set();
  const items = [];
  for (const entry of resolvedPool) {
    if (!entry.gachaCardId || seenCardIds.has(entry.gachaCardId)) continue;
    seenCardIds.add(entry.gachaCardId);
    items.push({
      boxId,
      gachaCardId: entry.gachaCardId,
      rarity: entry.rarity || 'COMMON'
    });
  }
  if (items.length > 0) await tx.virtualBoxPoolItem.createMany({ data: items });
};

const assertVirtualBoxReferences = async (pool) => {
  if (!pool || pool.length === 0) return;
  const cardIds = [...new Set(pool.filter((entry) => entry.gachaCardId).map((entry) => entry.gachaCardId))];
  const cards = cardIds.length > 0
    ? await prisma.gachaCard.findMany({ where: { id: { in: cardIds } }, select: { id: true } })
    : [];
  const existingCards = new Set(cards.map((c) => c.id));
  const missing = cardIds.filter((id) => !existingCards.has(id));
  if (missing.length > 0) {
    throw new AppError(`Unknown gacha card references: ${missing.join(', ')}`, 400, 'VALIDATION_ERROR');
  }
};

const virtualBoxInclude = {
  dropRates: { orderBy: { rate: 'desc' } },
  poolItems: {
    include: {
      gachaCard: {
        select: { id: true, name: true, slug: true, imageUrl: true, rarity: true, setCode: true, dropRate: true }
      }
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
      { name: { contains: search } },
      { slug: { contains: search } }
    ];

    const [items, totalItems] = await Promise.all([
      prisma.virtualBox.findMany({
        where, skip, take, orderBy: { createdAt: 'desc' },
        include: { ...virtualBoxInclude, _count: { select: { openings: true, poolItems: true } } }
      }),
      prisma.virtualBox.count({ where })
    ]);

    const mapped = items.map((box) => ({
      ...box,
      cardPoolCount: box._count?.poolItems || 0
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
    const poolCardIds = [...new Set(resolvedPool.filter((entry) => entry.gachaCardId).map((entry) => entry.gachaCardId))];

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
          ...(dropRates && dropRates.length > 0 && { dropRates: { create: dropRates.map((d) => ({ rarity: d.rarity, rate: Number(d.rate) })) } })
        },
        include: virtualBoxInclude
      });
      await syncPoolItems(tx, created.id, resolvedPool);
      return tx.virtualBox.findUnique({ where: { id: created.id }, include: { ...virtualBoxInclude, _count: { select: { openings: true, poolItems: true } } } });
    });

    res.status(201).json({
      success: true,
      data: { ...box, cardPoolCount: poolCardIds.length || box.poolItems.length },
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
    const poolCardIds = resolvedPool ? [...new Set(resolvedPool.filter((entry) => entry.gachaCardId).map((entry) => entry.gachaCardId))] : [];

    const updated = await prisma.$transaction(async (tx) => {
      if (dropRates) await tx.virtualBoxDropRate.deleteMany({ where: { boxId: id } });
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
          ...(dropRates && dropRates.length > 0 && { dropRates: { create: dropRates.map((d) => ({ rarity: d.rarity, rate: Number(d.rate) })) } })
        }
      });
      if (resolvedPool) await syncPoolItems(tx, id, resolvedPool);
      return tx.virtualBox.findUnique({ where: { id }, include: { ...virtualBoxInclude, _count: { select: { openings: true, poolItems: true } } } });
    });

    res.status(200).json({
      success: true,
      data: { ...updated, cardPoolCount: poolCardIds.length || updated.poolItems.length },
      message: 'Virtual box updated'
    });
  } catch (error) { next(error); }
};

const deleteVirtualBox = async (req, res, next) => {
  try {
    const { id } = req.params;
    const box = await prisma.virtualBox.findUnique({ where: { id }, select: { id: true } });
    if (!box) throw new NotFoundError('Virtual box not found');

    // Hard delete: purge the card pool mappings first, then the box record.
    // Drop rates / openings are removed by the schema's ON DELETE CASCADE.
    await prisma.$transaction(async (tx) => {
      await tx.virtualBoxPoolItem.deleteMany({ where: { boxId: id } });
      await tx.virtualBox.delete({ where: { id } });
    });

    res.status(200).json({ success: true, message: 'Virtual box deleted permanently' });
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

const getShopSettings = async (req, res, next) => {
  try {
    const settings = await settingsService.getShopSettings();
    res.status(200).json({ success: true, data: settings, message: 'Shop settings retrieved' });
  } catch (error) { next(error); }
};

const updateShopSettings = async (req, res, next) => {
  try {
    const settings = await settingsService.updateShopSettings(req.body);
    res.status(200).json({ success: true, data: settings, message: 'Shop settings updated' });
  } catch (error) { next(error); }
};

const getShippingSettings = async (req, res, next) => {
  try {
    const settings = await settingsService.getShippingSettings();
    res.status(200).json({ success: true, data: settings, message: 'Shipping settings retrieved' });
  } catch (error) { next(error); }
};

const updateShippingSettings = async (req, res, next) => {
  try {
    const settings = await settingsService.updateShippingSettings(req.body);
    res.status(200).json({ success: true, data: settings, message: 'Shipping settings updated' });
  } catch (error) { next(error); }
};

const getSiteSettings = async (req, res, next) => {
  try {
    const settings = await settingsService.getSiteSettings();
    res.status(200).json({ success: true, data: settings, message: 'Site settings retrieved' });
  } catch (error) { next(error); }
};

const updateSiteSettings = async (req, res, next) => {
  try {
    const settings = await settingsService.updateSiteSettings(req.body);
    res.status(200).json({ success: true, data: settings, message: 'Site settings updated' });
  } catch (error) { next(error); }
};

// ==================== TOP VIEWED ANALYTICS ====================

const firstImage = (images) => (Array.isArray(images) ? images.find(Boolean) || null : null);

const mapOrderRow = (order) => ({
  id: order.id,
  orderCode: order.orderCode,
  status: order.status,
  grandTotal: order.grandTotal,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
  customer: order.user?.fullName || order.user?.email || null
});

// GET /api/v1/admin/analytics/top-viewed
// Merges the most-viewed ACTIVE products and virtual boxes (by the monotonic
// `view_count` column) into one ranked list for the admin dashboard widget.
const getTopViewed = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 3, 1), 20);
    const [products, boxes] = await Promise.all([
      prisma.product.findMany({
        where: { status: 'ACTIVE' },
        orderBy: [{ viewCount: 'desc' }, { updatedAt: 'desc' }],
        take: limit,
        include: { category: { select: { name: true, slug: true } } }
      }),
      prisma.virtualBox.findMany({
        where: { status: 'ACTIVE' },
        orderBy: [{ viewCount: 'desc' }, { updatedAt: 'desc' }],
        take: limit
      })
    ]);

    const items = [
      ...products.map((p) => ({
        id: p.id,
        name: p.name,
        type: 'PRODUCT',
        href: `/product/${p.id}`,
        imageUrl: firstImage(p.images),
        category: p.category?.name || 'Single Card',
        tag: p.rarity || p.cardSet || null,
        viewCount: p.viewCount || 0
      })),
      ...boxes.map((b) => ({
        id: b.id,
        name: b.name,
        type: 'VIRTUAL_BOX',
        href: `/virtual-boxes/${b.id}`,
        imageUrl: b.imageUrl || null,
        category: 'Virtual Box',
        tag: 'Hộp ảo',
        viewCount: b.viewCount || 0
      }))
    ]
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, limit);

    res.status(200).json({ success: true, data: { items }, message: 'Top viewed items retrieved' });
  } catch (error) { next(error); }
};

// ==================== STAFF OPERATIONAL DASHBOARD ====================

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// GET /api/v1/admin/staff-dashboard
// 100% operational payload: packing queue, daily fulfillment progress, active
// virtual boxes with real-time daily unboxing counts, recent completions.
const getStaffDashboard = async (req, res, next) => {
  try {
    const today = startOfToday();
    const PROCESSED = ['PACKAGING', 'SHIPPING', 'DELIVERED'];

    const [
      packingQueue,
      packingTotal,
      todayTotal,
      todayProcessed,
      activeBoxes,
      todayOpenings,
      totalOpenings,
      recentlyCompleted
    ] = await Promise.all([
      prisma.order.findMany({
        where: { status: 'PACKAGING' },
        orderBy: { createdAt: 'asc' },
        take: 8,
        include: { user: { select: { fullName: true, email: true } } }
      }),
      prisma.order.count({ where: { status: 'PACKAGING' } }),
      prisma.order.count({ where: { createdAt: { gte: today } } }),
      prisma.order.count({ where: { createdAt: { gte: today }, status: { in: PROCESSED } } }),
      prisma.virtualBox.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
        take: 6,
        select: { id: true, name: true, slug: true, imageUrl: true, gradient: true, price: true, viewCount: true }
      }),
      prisma.virtualBoxOpening.groupBy({
        by: ['boxId'],
        where: { createdAt: { gte: today } },
        _count: { _all: true }
      }),
      prisma.virtualBoxOpening.groupBy({ by: ['boxId'], _count: { _all: true } }),
      prisma.order.findMany({
        where: { status: { in: ['SHIPPING', 'DELIVERED'] } },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        include: { user: { select: { fullName: true, email: true } } }
      })
    ]);

    const todayMap = new Map(todayOpenings.map((r) => [r.boxId, r._count?._all || 0]));
    const totalMap = new Map(totalOpenings.map((r) => [r.boxId, r._count?._all || 0]));

    res.status(200).json({
      success: true,
      data: {
        packingQueue: packingQueue.map(mapOrderRow),
        packingTotal,
        todayTotal,
        todayProcessed,
        processedRate: todayTotal > 0 ? Math.round((todayProcessed / todayTotal) * 100) : 0,
        activeBoxes: activeBoxes.map((b) => ({
          id: b.id,
          name: b.name,
          slug: b.slug,
          imageUrl: b.imageUrl || null,
          gradient: b.gradient || null,
          price: b.price,
          viewCount: b.viewCount || 0,
          todayOpenings: todayMap.get(b.id) || 0,
          totalOpenings: totalMap.get(b.id) || 0
        })),
        recentlyCompleted: recentlyCompleted.map(mapOrderRow)
      },
      message: 'Staff dashboard retrieved'
    });
  } catch (error) { next(error); }
};

// ==================== EXPORT ====================

module.exports = {
  listUsers, getUserDetail, updateUserRole, updateUserStatus, updateUserPermissions, changeUserPassword, deleteUser,
  listProducts, createProduct, updateProduct, deleteProduct, addCards, updateCard, uploadImage,
  listSets, createSet, updateSet, deleteSet,
  listRarities, createRarity, updateRarity, deleteRarity,
  listCardConditions, createCardCondition, updateCardCondition, deleteCardCondition,
  listLanguages, createLanguage, updateLanguage, deleteLanguage,
  listSealedCategories, createSealedCategory, updateSealedCategory, deleteSealedCategory,
  listCategories: listAdminCategories, createCategory, updateCategory, deleteCategory,
  listPosts, createPost, updatePost, deletePost,
  listOrders, updateOrderStatus,
  listPaymentLogs, reconcilePayment,
  getDashboardStats,
  getTopViewed, getStaffDashboard,
  listVirtualBoxes, createVirtualBox, updateVirtualBox, deleteVirtualBox,
  getSepaySettings, updateSepaySettings,
  getShopSettings, updateShopSettings,
  getShippingSettings, updateShippingSettings,
  getSiteSettings, updateSiteSettings
};