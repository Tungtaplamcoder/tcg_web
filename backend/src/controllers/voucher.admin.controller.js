const prisma = require('../config/prisma');
const { NotFoundError, ConflictError, AppError } = require('../utils/errors');
const voucherService = require('../services/voucher.service');

// ==================== VOUCHER MANAGEMENT (ADMIN) ====================

const listVouchers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, isActive } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where = {};
    if (search) {
      where.OR = [
        { code: { contains: search } },
        { title: { contains: search } }
      ];
    }
    if (isActive === 'true') where.isActive = true;
    if (isActive === 'false') where.isActive = false;

    const [items, totalItems] = await Promise.all([
      prisma.voucher.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { users: true, orders: true } } }
      }),
      prisma.voucher.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: { items, meta: { page: Number(page), limit: take, totalItems, totalPages: Math.ceil(totalItems / take) } },
      message: 'Vouchers retrieved'
    });
  } catch (error) { next(error); }
};

const getVoucher = async (req, res, next) => {
  try {
    const { id } = req.params;
    const voucher = await prisma.voucher.findUnique({
      where: { id },
      include: { _count: { select: { users: true, orders: true } } }
    });
    if (!voucher) throw new NotFoundError('Voucher not found');
    res.status(200).json({ success: true, data: voucher, message: 'Voucher retrieved' });
  } catch (error) { next(error); }
};

const createVoucher = async (req, res, next) => {
  try {
    const data = req.body;
    const normalizedCode = voucherService.normalizeCode(data.code);

    const existing = await prisma.voucher.findUnique({ where: { code: normalizedCode } });
    if (existing) throw new ConflictError('Mã voucher đã tồn tại');

    const voucher = await prisma.voucher.create({
      data: {
        code: normalizedCode,
        title: data.title,
        discountType: data.discountType,
        discountValue: data.discountValue,
        maxDiscountAmount: data.discountType === 'PERCENT' ? (data.maxDiscountAmount ?? null) : null,
        minOrderAmount: data.minOrderAmount ?? 0,
        totalQuantity: data.totalQuantity ?? null,
        limitPerUser: data.limitPerUser ?? 1,
        startAt: data.startAt ?? null,
        endAt: data.endAt ?? null,
        isActive: data.isActive ?? true,
        scope: data.scope,
        // MariaDB: scopeIds lưu JSON array — ép về mảng trước khi ghi
        scopeIds: Array.isArray(data.scopeIds) ? data.scopeIds : []
      }
    });

    res.status(201).json({ success: true, data: voucher, message: 'Voucher created' });
  } catch (error) { next(error); }
};

const updateVoucher = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const existing = await prisma.voucher.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Voucher not found');

    // Không cho sửa code sau khi tạo — đơn cũ đã snapshot theo code cũ
    if (data.code && voucherService.normalizeCode(data.code) !== existing.code) {
      throw new AppError('Không thể đổi mã voucher sau khi tạo', 400, 'VALIDATION_ERROR');
    }

    const updateData = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.discountType !== undefined) updateData.discountType = data.discountType;
    if (data.discountValue !== undefined) updateData.discountValue = data.discountValue;
    if (data.maxDiscountAmount !== undefined) {
      const type = updateData.discountType || existing.discountType;
      updateData.maxDiscountAmount = type === 'PERCENT' ? (data.maxDiscountAmount ?? null) : null;
    }
    if (data.minOrderAmount !== undefined) updateData.minOrderAmount = data.minOrderAmount;
    if (data.totalQuantity !== undefined) {
      const newTotal = data.totalQuantity ?? null;
      if (newTotal != null && newTotal < existing.usedQuantity) {
        throw new ConflictError(`Không thể đặt tổng lượt dùng (${newTotal}) thấp hơn lượt đã dùng (${existing.usedQuantity})`);
      }
      updateData.totalQuantity = newTotal;
    }
    if (data.limitPerUser !== undefined) {
      updateData.limitPerUser = data.limitPerUser;
    }
    if (data.startAt !== undefined) updateData.startAt = data.startAt;
    if (data.endAt !== undefined) updateData.endAt = data.endAt;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.scope !== undefined) {
      updateData.scope = data.scope;
      if (data.scope !== 'ALL' && (!data.scopeIds || data.scopeIds.length === 0)) {
        throw new AppError('Cần chọn ít nhất một danh mục/sản phẩm khi scope khác ALL', 400, 'VALIDATION_ERROR');
      }
    }
    if (data.scopeIds !== undefined) updateData.scopeIds = data.scopeIds;

    const voucher = await prisma.voucher.update({ where: { id }, data: updateData });
    res.status(200).json({ success: true, data: voucher, message: 'Voucher updated' });
  } catch (error) { next(error); }
};

// Bật/tắt nhanh từ switch trên bảng — không đụng các trường khác
const toggleVoucher = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const existing = await prisma.voucher.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Voucher not found');

    const voucher = await prisma.voucher.update({ where: { id }, data: { isActive } });
    res.status(200).json({ success: true, data: voucher, message: `Voucher ${isActive ? 'activated' : 'deactivated'}` });
  } catch (error) { next(error); }
};

const deleteVoucher = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await prisma.voucher.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } }
    });
    if (!existing) throw new NotFoundError('Voucher not found');

    // Đã có đơn dùng voucher thì không xóa cứng — giữ code để bảo toàn lịch sử
    if (existing._count.orders > 0) {
      const deactivated = await prisma.voucher.update({ where: { id }, data: { isActive: false } });
      return res.status(200).json({
        success: true,
        data: deactivated,
        message: 'Voucher đã được sử dụng — đã vô hiệu hóa thay vì xóa'
      });
    }

    await prisma.voucher.delete({ where: { id } });
    res.status(200).json({ success: true, data: { deleted: true }, message: 'Voucher deleted' });
  } catch (error) { next(error); }
};

// ==================== DIRECT ALLOCATION ====================

// Cấp voucher thẳng vào ví của user: theo danh sách ID hoặc toàn bộ ACTIVE users
const allocateVoucher = async (req, res, next) => {
  try {
    const { voucherId, userIds, allUsers } = req.body;

    const voucher = await prisma.voucher.findUnique({ where: { id: voucherId } });
    if (!voucher) throw new NotFoundError('Voucher not found');

    const targetUserIds = allUsers
      ? (await prisma.user.findMany({
          where: { status: 'ACTIVE' },
          select: { id: true }
        })).map((u) => u.id)
      : userIds;

    if (targetUserIds.length === 0) {
      throw new AppError('Không tìm thấy user nào để cấp voucher', 400, 'VALIDATION_ERROR');
    }

    // Xác minh tất cả user id tồn tại (tránh silently skip user bị xóa)
    const foundUsers = await prisma.user.findMany({
      where: { id: { in: targetUserIds } },
      select: { id: true }
    });
    const foundIds = new Set(foundUsers.map((u) => u.id));
    const missing = targetUserIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new NotFoundError(`Không tìm thấy ${missing.length} user id trong danh sách cấp`);
    }

    // createMany + skipDuplicates: idempotent, không ghi đè usage_count hiện có
    const result = await prisma.userVoucher.createMany({
      data: targetUserIds.map((userId) => ({ userId, voucherId })),
      skipDuplicates: true
    });

    res.status(200).json({
      success: true,
      data: {
        requested: targetUserIds.length,
        newlyAllocated: result.count,
        alreadyOwned: targetUserIds.length - result.count
      },
      message: `Đã cấp voucher cho ${result.count} user mới`
    });
  } catch (error) { next(error); }
};

// Danh sách user đang sở hữu voucher (phục vụ form cấp allocation)
const listVoucherHolders = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const voucher = await prisma.voucher.findUnique({ where: { id } });
    if (!voucher) throw new NotFoundError('Voucher not found');

    const [items, totalItems] = await Promise.all([
      prisma.userVoucher.findMany({
        where: { voucherId: id },
        skip, take,
        orderBy: { claimedAt: 'desc' },
        include: { user: { select: { id: true, email: true, fullName: true, phone: true, status: true } } }
      }),
      prisma.userVoucher.count({ where: { voucherId: id } })
    ]);

    res.status(200).json({
      success: true,
      data: { items, meta: { page: Number(page), limit: take, totalItems, totalPages: Math.ceil(totalItems / take) } },
      message: 'Voucher holders retrieved'
    });
  } catch (error) { next(error); }
};

module.exports = {
  listVouchers,
  getVoucher,
  createVoucher,
  updateVoucher,
  toggleVoucher,
  deleteVoucher,
  allocateVoucher,
  listVoucherHolders
};
