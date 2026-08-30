const { AppError, PaymentError, ConflictError } = require('../utils/errors');
const orderService = require('../services/order.service');

// Chuyển lỗi Prisma thành AppError có message rõ ràng thay vì để lỗi 500 mơ hồ
const mapDatabaseError = (error) => {
  if (error?.code === 'P2002') {
    return new ConflictError('Dữ liệu bị trùng lặp (unique constraint). Vui lòng thử lại.');
  }
  if (error?.code === 'P2025') {
    return new AppError('Bản ghi không tồn tại hoặc đã bị thay đổi. Vui lòng làm mới và thử lại.', 409, 'CONFLICT');
  }
  return new AppError(
    `Lỗi hệ thống khi xử lý đơn hàng: ${error?.message || 'Unknown database error'}`,
    500,
    'CHECKOUT_DB_ERROR'
  );
};

const checkout = async (req, res, next) => {
  try {
    const result = await orderService.createCheckout(req.user.id, req.body);
    res.status(201).json({
      success: true,
      data: result,
      message: 'Order created successfully'
    });
  } catch (error) {
    // Lỗi thanh toán/SePay (PaymentError) và nghiệp vụ -> trả message gốc cho client
    if (error instanceof PaymentError || error instanceof ConflictError || error instanceof AppError) {
      console.error('Checkout failed:', error.code, error.message);
      return next(error);
    }
    // Lỗi Prisma/SQL không định dạng -> map để tránh 500 không rõ nguyên nhân
    console.error('Checkout unexpected error:', error);
    return next(mapDatabaseError(error));
  }
};

const listOrders = async (req, res, next) => {
  try {
    const result = await orderService.listUserOrders(req.user.id, req.query);
    res.status(200).json({
      success: true,
      data: result,
      message: 'Orders retrieved'
    });
  } catch (error) {
    next(error);
  }
};

const getOrder = async (req, res, next) => {
  try {
    const order = await orderService.getOrderById(req.params.id, req.user.id);
    res.status(200).json({
      success: true,
      data: order,
      message: 'Order retrieved'
    });
  } catch (error) {
    next(error);
  }
};

const cancelOrder = async (req, res, next) => {
  try {
    const order = await orderService.cancelOrder(req.params.id, req.user.id, 'Order cancelled by customer');
    res.status(200).json({
      success: true,
      data: order,
      message: 'Order cancelled successfully'
    });
  } catch (error) {
    next(error);
  }
};

const regeneratePayment = async (req, res, next) => {
  try {
    const result = await orderService.regeneratePayment(req.params.id, req.user.id);
    res.status(200).json({
      success: true,
      data: result,
      message: 'Payment URL regenerated'
    });
  } catch (error) {
    next(error);
  }
};

const getPaymentStatus = async (req, res, next) => {
  try {
    const result = await orderService.getPaymentStatus(req.params.id, req.user.id);
    res.status(200).json({
      success: true,
      data: result,
      message: 'Payment status retrieved'
    });
  } catch (error) {
    next(error);
  }
};

const lookupOrder = async (req, res, next) => {
  try {
    const { orderCode, identifier, email, phone, query } = req.body;

    // Chấp nhận cả `identifier`, `email`, `phone`
    const lookupValue = identifier || email || phone;

    // ── Frictionless mode: a single value can identify an order ─────────────
    // Priority: orderCode+contact > lone tracking code > lone email/phone.
    const single = (query || identifier || '').toString().trim();

    if (!orderCode && !lookupValue && single) {
      const isOrderCode = /^tcg-/i.test(single);
      const masked = (v) => `${v?.slice(0, 3) ?? ''}•••••${v?.slice(-2) ?? ''}`;

      const order = isOrderCode
        ? await orderService.lookupByOrderCode(single.toUpperCase())
        : await orderService.lookupByContact(single);

      // Privacy-safe projection for guest lookups: never expose raw PII or street address
      const sa = order.shippingAddress || {};
      const safeOrder = {
        ...order,
        shippingAddress: {
          fullName: masked(sa.fullName),
          phone: masked(sa.phone),
          wardName: sa.wardName || sa.state || '',
          provinceName: sa.provinceName || sa.city || ''
        }
      };

      return res.status(200).json({ success: true, data: safeOrder, message: 'Order found' });
    }

    // ── Legacy two-factor mode: orderCode + verified contact ────────────────
    if (!orderCode || !lookupValue) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'orderCode and email/phone are required'
        },
        timestamp: new Date().toISOString()
      });
    }

    const order = await orderService.lookupOrder(orderCode, lookupValue);
    res.status(200).json({
      success: true,
      data: order,
      message: 'Order found'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  checkout,
  listOrders,
  getOrder,
  cancelOrder,
  regeneratePayment,
  getPaymentStatus,
  lookupOrder
};
