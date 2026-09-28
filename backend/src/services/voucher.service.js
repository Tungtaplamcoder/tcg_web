const prisma = require('../config/prisma');
const { NotFoundError, ConflictError, PaymentError } = require('../utils/errors');

// ==================== HELPERS ====================

const normalizeCode = (code) => String(code || '').trim().toUpperCase();

// Làm tròn theo VND (không có số lẻ)
const roundVND = (amount) => Math.round(Number(amount) || 0);

/**
 * Tính số tiền được giảm cho một subtotal đủ điều kiện.
 * PERCENT: value% của subtotal, trần bởi maxDiscountAmount (nếu có).
 * FIXED:   giá trị cố định, không vượt quá subtotal (grandTotal không âm).
 */
const computeDiscountAmount = (voucher, eligibleSubtotal) => {
  const subtotal = roundVND(eligibleSubtotal);
  let discount = 0;
  if (voucher.discountType === 'PERCENT') {
    discount = (subtotal * Number(voucher.discountValue)) / 100;
    if (voucher.maxDiscountAmount != null) {
      discount = Math.min(discount, Number(voucher.maxDiscountAmount));
    }
  } else {
    discount = Number(voucher.discountValue);
  }
  return Math.max(0, Math.min(roundVND(discount), subtotal));
};

/**
 * Map productId -> categoryId phục vụ kiểm tra scope CATEGORY.
 * `db` là prisma hoặc client transaction (tx) để dùng được cả 2 ngữ cảnh.
 */
const getCategoryMap = async (db, productIds) => {
  const ids = [...new Set((productIds || []).filter(Boolean))];
  if (ids.length === 0) return {};
  const products = await db.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, categoryId: true }
  });
  const map = {};
  for (const p of products) map[p.id] = p.categoryId;
  return map;
};

// Items đủ điều kiện theo scope của voucher.
// ALL: mọi item; CATEGORY: item có product thuộc scopeIds; PRODUCT: productId thuộc scopeIds.
// scopeIds được lưu dạng JSON (MariaDB không có kiểu mảng native) nên phải
// normalize về Array trước khi dùng.
const filterScopedItems = (voucher, items, categoryMap) => {
  if (!voucher.scope || voucher.scope === 'ALL') return items;
  const rawScopeIds = voucher.scopeIds || [];
  const scopeIds = Array.isArray(rawScopeIds) ? rawScopeIds : [];
  const scopeSet = new Set(scopeIds);
  return (items || []).filter((item) => {
    if (!item.productId) return false;
    if (voucher.scope === 'PRODUCT') return scopeSet.has(item.productId);
    if (voucher.scope === 'CATEGORY') {
      const categoryId = categoryMap[item.productId];
      return categoryId != null && scopeSet.has(categoryId);
    }
    return false;
  });
};

/**
 * Đánh giá đầy đủ tính hợp lệ của voucher đối với một giỏ hàng.
 * Thuần read-only — dùng cho cả validate API và hiển thị lý do không dùng được.
 *
 * Trả về:
 *   { eligible, reasonCode, reason, missingAmount, discountAmount, eligibleSubtotal }
 */
const evaluateVoucher = async (db, {
  voucher,
  wallet = null,
  requireWallet = true,
  items = [],
  subtotal = 0,
  now = new Date()
}) => {
  const fail = (reasonCode, reason, extra = {}) => ({
    eligible: false, reasonCode, reason, discountAmount: 0, eligibleSubtotal: 0, ...extra
  });

  if (!voucher) return fail('NOT_FOUND', 'Voucher không tồn tại');
  if (!voucher.isActive) return fail('INACTIVE', 'Voucher đã bị vô hiệu hóa');
  if (voucher.startAt && voucher.startAt > now) {
    return fail('NOT_STARTED', 'Voucher chưa bắt đầu');
  }
  if (voucher.endAt && voucher.endAt < now) {
    return fail('EXPIRED', 'Voucher đã hết hạn sử dụng');
  }
  if (voucher.totalQuantity != null && voucher.usedQuantity >= voucher.totalQuantity) {
    return fail('OUT_OF_STOCK', 'Voucher đã hết lượt dùng');
  }
  if (requireWallet && !wallet) {
    return fail('NO_WALLET', 'Bạn cần nhận voucher vào ví trước khi sử dụng');
  }
  if (wallet && voucher.limitPerUser > 0 && wallet.usageCount >= voucher.limitPerUser) {
    return fail('USER_LIMIT_REACHED', 'Bạn đã dùng hết lượt sử dụng của voucher này');
  }
  if ((items || []).length === 0) {
    return fail('EMPTY_CART', 'Giỏ hàng đang trống');
  }

  const categoryMap = await getCategoryMap(db, items.map((i) => i.productId));
  const scopedItems = filterScopedItems(voucher, items, categoryMap);
  if (scopedItems.length === 0) {
    const scopeLabel = voucher.scope === 'CATEGORY' ? 'danh mục' : 'sản phẩm';
    return fail('NO_ELIGIBLE_ITEMS', `Đơn hàng không có ${scopeLabel} nào được áp dụng voucher này`);
  }

  const orderSubtotal = roundVND(subtotal);
  const minOrder = roundVND(voucher.minOrderAmount);
  if (orderSubtotal < minOrder) {
    return fail('MIN_ORDER', `Đơn hàng cần tối thiểu ${minOrder.toLocaleString('vi-VN')}₫ để dùng voucher`, {
      missingAmount: minOrder - orderSubtotal
    });
  }

  const eligibleSubtotal = scopedItems.reduce(
    (sum, item) => sum + roundVND(item.subtotal != null ? item.subtotal : 0),
    0
  );
  const fallbackSubtotal = scopedItems.length === (items || []).length
    ? orderSubtotal
    : eligibleSubtotal;
  const base = eligibleSubtotal > 0 ? eligibleSubtotal : fallbackSubtotal;
  const discountAmount = computeDiscountAmount(voucher, base);

  return {
    eligible: true,
    reasonCode: null,
    reason: null,
    discountAmount,
    eligibleSubtotal: base
  };
};

// ==================== WALLET (USER) ====================

// Trạng thái hiển thị trên ví: ACTIVE | USED | EXPIRED
const computeWalletStatus = (voucher, usageCount, now = new Date()) => {
  if (!voucher.isActive) return { status: 'EXPIRED', note: 'Voucher đã bị tắt' };
  if (voucher.endAt && voucher.endAt < now) return { status: 'EXPIRED', note: 'Đã hết hạn' };
  if (voucher.totalQuantity != null && voucher.usedQuantity >= voucher.totalQuantity) {
    return { status: 'EXPIRED', note: 'Đã hết lượt dùng' };
  }
  if (voucher.limitPerUser > 0 && usageCount >= voucher.limitPerUser) {
    return { status: 'USED', note: 'Bạn đã dùng hết lượt' };
  }
  if (voucher.startAt && voucher.startAt > now) {
    return { status: 'ACTIVE', note: 'Chưa bắt đầu' };
  }
  return { status: 'ACTIVE', note: null };
};

const listWallet = async (userId) => {
  const rows = await prisma.userVoucher.findMany({
    where: { userId },
    include: { voucher: true },
    orderBy: { claimedAt: 'desc' }
  });
  const now = new Date();
  return rows.map((row) => {
    const { status, note } = computeWalletStatus(row.voucher, row.usageCount, now);
    return {
      id: row.id,
      claimedAt: row.claimedAt,
      usageCount: row.usageCount,
      remainingUses: Math.max(0, row.voucher.limitPerUser - row.usageCount),
      status,
      statusNote: note,
      voucher: row.voucher
    };
  });
};

/**
 * Nhận voucher vào ví bằng mã. Idempotent: đã sở hữu thì trả về entry cũ.
 * Lock FOR UPDATE voucher để tránh tình trạng hết stock giữa chừng.
 */
const claimVoucher = async (userId, code) => {
  const normalized = normalizeCode(code);

  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw`SELECT * FROM \`Voucher\` WHERE \`code\` = ${normalized} FOR UPDATE`;
    if (!locked || locked.length === 0) throw new NotFoundError('Mã voucher không tồn tại');
    const voucher = locked[0];

    if (!voucher.isActive) throw new ConflictError('Voucher đã bị vô hiệu hóa');
    if (voucher.endAt && voucher.endAt < new Date()) throw new ConflictError('Voucher đã hết hạn sử dụng');
    if (voucher.totalQuantity != null && voucher.usedQuantity >= voucher.totalQuantity) {
      throw new ConflictError('Voucher đã hết lượt dùng');
    }

    const existing = await tx.userVoucher.findUnique({
      where: { userId_voucherId: { userId, voucherId: voucher.id } },
      include: { voucher: true }
    });
    if (existing) {
      return { alreadyOwned: true, entry: existing, voucher: existing.voucher };
    }

    const entry = await tx.userVoucher.create({
      data: { userId, voucherId: voucher.id },
      include: { voucher: true }
    });
    return { alreadyOwned: false, entry, voucher: entry.voucher };
  }, { isolationLevel: 'ReadCommitted' });
};

// ==================== VALIDATION (PREVIEW, KHÔNG GHI DB) ====================

const validateForUser = async (userId, { code, items, subtotal }) => {
  const normalized = normalizeCode(code);
  const voucher = await prisma.voucher.findUnique({ where: { code: normalized } });
  if (!voucher) {
    return { eligible: false, reasonCode: 'NOT_FOUND', reason: 'Mã voucher không tồn tại', discountAmount: 0 };
  }
  const wallet = await prisma.userVoucher.findUnique({
    where: { userId_voucherId: { userId, voucherId: voucher.id } }
  });

  const evaluation = await evaluateVoucher(prisma, {
    voucher,
    wallet,
    requireWallet: true,
    items,
    subtotal
  });

  return {
    eligible: evaluation.eligible,
    reasonCode: evaluation.reasonCode,
    reason: evaluation.reason,
    missingAmount: evaluation.missingAmount || null,
    discountAmount: evaluation.discountAmount,
    voucher: {
      id: voucher.id,
      code: voucher.code,
      title: voucher.title,
      discountType: voucher.discountType,
      discountValue: Number(voucher.discountValue),
      maxDiscountAmount: voucher.maxDiscountAmount != null ? Number(voucher.maxDiscountAmount) : null,
      minOrderAmount: Number(voucher.minOrderAmount),
      limitPerUser: voucher.limitPerUser,
      endAt: voucher.endAt,
      scope: voucher.scope,
      usedCount: wallet ? wallet.usageCount : 0
    }
  };
};

// ==================== REDEMPTION (TRONG CHECKOUT TX) ====================

/**
 * Redeem voucher BÊN TRONG transaction của checkout.
 * - Lock FOR UPDATE voucher: serialize các claim đồng thời, không bao giờ âm stock.
 * - items: [{ productId, subtotal }] (subtotal = unitPrice * quantity của item đó)
 * Trả về { code, discountAmount }; ném PaymentError kèm lý do nếu không hợp lệ.
 */
const redeemVoucherTx = async (tx, { userId, code, items, subtotal }) => {
  const normalized = normalizeCode(code);

  const locked = await tx.$queryRaw`SELECT * FROM \`Voucher\` WHERE \`code\` = ${normalized} FOR UPDATE`;
  if (!locked || locked.length === 0) {
    throw new PaymentError('Mã voucher không tồn tại hoặc đã bị xóa');
  }
  const voucher = locked[0];

  const wallet = await tx.userVoucher.findUnique({
    where: { userId_voucherId: { userId, voucherId: voucher.id } }
  });

  const evaluation = await evaluateVoucher(tx, {
    voucher,
    wallet,
    requireWallet: true,
    items,
    subtotal
  });
  if (!evaluation.eligible) {
    throw new PaymentError(evaluation.reason || 'Voucher không thể áp dụng cho đơn hàng này');
  }

  await tx.voucher.update({
    where: { id: voucher.id },
    data: { usedQuantity: { increment: 1 } }
  });
  await tx.userVoucher.update({
    where: { id: wallet.id },
    data: { usageCount: { increment: 1 } }
  });

  return { code: voucher.code, discountAmount: evaluation.discountAmount };
};

/**
 * Hoàn lượt dùng khi đơn bị hủy — gọi BÊN TRONG transaction hủy đơn.
 * GREATEST(... - 1, 0) đảm bảo không bao giờ âm kể cả dữ liệu lệch.
 */
const rollbackVoucherTx = async (tx, { userId, voucherCode }) => {
  const normalized = normalizeCode(voucherCode);
  const locked = await tx.$queryRaw`SELECT \`id\` FROM \`Voucher\` WHERE \`code\` = ${normalized} FOR UPDATE`;
  if (!locked || locked.length === 0) return; // voucher đã bị xóa — bỏ qua an toàn

  await tx.$executeRaw`
    UPDATE \`Voucher\`
    SET \`usedQuantity\` = GREATEST(\`usedQuantity\` - 1, 0), \`updatedAt\` = NOW()
    WHERE \`id\` = ${locked[0].id}
  `;
  await tx.$executeRaw`
    UPDATE \`UserVoucher\`
    SET \`usageCount\` = GREATEST(\`usageCount\` - 1, 0)
    WHERE \`userId\` = ${userId} AND \`voucherId\` = ${locked[0].id}
  `;
};

module.exports = {
  normalizeCode,
  computeDiscountAmount,
  evaluateVoucher,
  computeWalletStatus,
  listWallet,
  claimVoucher,
  validateForUser,
  redeemVoucherTx,
  rollbackVoucherTx
};
