const orderService = require('../services/order.service');

const checkout = async (req, res, next) => {
  try {
    const result = await orderService.createCheckout(req.user.id, req.body);
    res.status(201).json({
      success: true,
      data: result,
      message: 'Order created successfully'
    });
  } catch (error) {
    next(error);
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