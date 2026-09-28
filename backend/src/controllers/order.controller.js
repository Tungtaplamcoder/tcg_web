const { AppError, PaymentError, ConflictError } = require('../utils/errors');
const orderService = require('../services/order.service');
const { isDatabaseError, emptyPage, sendDbEmpty, sendDbError, logDatabaseError } = require('../utils/dbGuard');

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
    // Lỗi Prisma/SQL thô -> 400 sạch (không 500), đơn đã rollback
    if (isDatabaseError(error)) {
      return sendDbError(res, 'order.checkout', error);
    }
    // Lỗi bất ngờ khác (TypeError, bug code) -> global handler
    logDatabaseError('order.checkout unexpected', error);
    return next(error);
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
    // DB failure on the order-history list: empty page keeps pagination UI
    // stable (OrderHistory reads data.items / data.meta).
    if (isDatabaseError(error)) {
      return sendDbEmpty(res, 'order.listOrders', error, emptyPage(req.query?.page, req.query?.limit));
    }
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
    if (isDatabaseError(error)) {
      // Single read: clean 400 — the frontend shows a retryable message
      // instead of an unhandled 500.
      return sendDbError(res, 'order.getOrder', error);
    }
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
    if (isDatabaseError(error)) {
      // Write: transaction rolled back — clean 400 so the UI can retry.
      return sendDbError(res, 'order.cancelOrder', error);
    }
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
    if (isDatabaseError(error)) {
      return sendDbError(res, 'order.regeneratePayment', error);
    }
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
    if (isDatabaseError(error)) {
      // Polling endpoint (Checkout/PaymentSuccess): null data is handled by
      // the frontend as "try again" — never crash the polling loop.
      return sendDbEmpty(res, 'order.getPaymentStatus', error, null);
    }
    next(error);
  }
};

// POST /api/v1/orders/:id/sync-payment — fallback: đối soát thanh toán với SePay
// (reconcile payment log local + verify qua SePay API) khi webhook lỗi/không tới.
const syncOrderPayment = async (req, res, next) => {
  try {
    const result = await orderService.syncOrderPayment(req.params.id, req.user.id);
    res.status(200).json({
      success: true,
      data: result,
      message: result.synced
        ? 'Payment verified — order updated'
        : 'No paid transaction found for this order'
    });
  } catch (error) {
    if (isDatabaseError(error)) {
      return sendDbError(res, 'order.syncOrderPayment', error);
    }
    next(error);
  }
};

// POST /api/v1/orders/lookup — guest order lookup (no auth) by tracking code
// or contact. DB failures degrade to a clean 400, not an unhandled 500.
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
    if (isDatabaseError(error)) {
      // Guest lookup: clean 400 with retry guidance — never an open 500.
      return sendDbError(res, 'order.lookupOrder', error);
    }
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
  syncOrderPayment,
  lookupOrder
};
