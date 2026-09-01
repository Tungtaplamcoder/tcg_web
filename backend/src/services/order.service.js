const prisma = require('../config/prisma');
const env = require('../config/env');
const { AppError, NotFoundError, PaymentError, ConflictError } = require('../utils/errors');
const sepayService = require('./sepay.service');

const SHIPPING_FEE = 20000; // VND
const MAX_TRANSFER_AMOUNT = 100000000; // Giới hạn 100 triệu VND

const normalizePaymentMethod = (method) => {
  if (method === 'SEPAY') return 'SEPAy';
  if (method === 'SEPA') return 'SEPAy';
  return method;
};

const generateUniqueOrderCode = async () => {
  let code = sepayService.generateOrderCode();
  let exists = await prisma.order.findUnique({ where: { orderCode: code } });
  while (exists) {
    code = sepayService.generateOrderCode();
    exists = await prisma.order.findUnique({ where: { orderCode: code } });
  }
  return code;
};

const createCheckout = async (userId, checkoutData) => {
  const { items, shippingAddress, paymentMethod } = checkoutData;
  const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);

  // Gom từng loại item: variant (sản phẩm theo tình trạng) và card (thẻ đơn lẻ)
  const variantQuantities = new Map(); // variantId -> quantity
  const fallbackProducts = new Map();   // productId -> quantity (cart cũ không có variantId)
  const cardItems = [];

  for (const item of items) {
    if (item.variantId) {
      variantQuantities.set(item.variantId, (variantQuantities.get(item.variantId) || 0) + item.quantity);
    } else if (item.productId) {
      fallbackProducts.set(item.productId, (fallbackProducts.get(item.productId) || 0) + item.quantity);
    }
    if (item.cardId) {
      cardItems.push({ cardId: item.cardId, quantity: item.quantity });
    }
  }

  const cardIds = cardItems.map(ci => ci.cardId);
  if (new Set(cardIds).size !== cardIds.length) {
    throw new ConflictError('Duplicate cardId in order items');
  }

  return prisma.$transaction(async (tx) => {
    const variantReservations = [];

    for (const [variantId, quantity] of variantQuantities.entries()) {
      const variant = await tx.$queryRaw`
        SELECT "id", "productId", "price", "stockQuantity"
        FROM "ProductVariant"
        WHERE "id" = ${variantId}
          AND "status" = 'ACTIVE'
          AND "stockQuantity" >= ${quantity}
        FOR UPDATE
      `;

      if (!variant || variant.length === 0) {
        throw new PaymentError(`Sản phẩm không còn hàng hoặc không tồn tại (variant ${variantId}). Vui lòng làm mới giỏ hàng.`);
      }

      await tx.productVariant.update({
        where: { id: variant[0].id },
        data: { stockQuantity: { decrement: quantity } }
      });

      variantReservations.push({ variantId: variant[0].id, quantity, variant: variant[0] });
    }

    // Fallback cho cart cũ không có variantId: chốt variant đầu tiên còn hàng của product
    for (const [productId, quantity] of fallbackProducts.entries()) {
      const variant = await tx.$queryRaw`
        SELECT "id", "productId", "price", "stockQuantity"
        FROM "ProductVariant"
        WHERE "productId" = ${productId}
          AND "status" = 'ACTIVE'
          AND "stockQuantity" >= ${quantity}
        ORDER BY "createdAt" ASC
        LIMIT 1
        FOR UPDATE
      `;

      if (!variant || variant.length === 0) {
        throw new PaymentError(`Sản phẩm không còn hàng hoặc không tồn tại (product ${productId}). Vui lòng làm mới giỏ hàng.`);
      }

      await tx.productVariant.update({
        where: { id: variant[0].id },
        data: { stockQuantity: { decrement: quantity } }
      });

      variantReservations.push({ variantId: variant[0].id, quantity, variant: variant[0] });
    }

    const cardReservations = [];
    for (const cardItem of cardItems) {
      const result = await tx.$queryRaw`
        UPDATE "Card"
        SET "status" = 'RESERVED'
        WHERE "id" = ${cardItem.cardId}
          AND "status" = 'AVAILABLE'
        RETURNING "id", "productId", "sku"
      `;
      if (!result || result.length === 0) {
        throw new PaymentError(`Card ${cardItem.cardId} is not available`);
      }
      cardReservations.push({ cardId: cardItem.cardId, quantity: cardItem.quantity, card: result[0] });
    }

    let totalAmount = 0;
    const orderItemsData = [];

    for (const reservation of variantReservations) {
      const unitPrice = Number(reservation.variant.price);
      totalAmount += unitPrice * reservation.quantity;
      orderItemsData.push({
        productId: reservation.variant.productId,
        variantId: reservation.variantId,
        quantity: reservation.quantity,
        unitPrice,
        totalPrice: unitPrice * reservation.quantity
      });
    }

    for (const reservation of cardReservations) {
      // Card là thẻ đơn lẻ — giá lấy từ variant NEAR_MINT của product cha
      const variantRow = await tx.$queryRaw`
        SELECT "price" FROM "ProductVariant"
        WHERE "productId" = ${reservation.card.productId} AND "status" = 'ACTIVE'
        ORDER BY "price" DESC
        LIMIT 1
      `;
      if (!variantRow || variantRow.length === 0) {
        throw new PaymentError(`No active variant price found for card ${reservation.cardId}`);
      }
      const unitPrice = Number(variantRow[0].price);
      totalAmount += unitPrice * reservation.quantity;
      orderItemsData.push({
        productId: reservation.card.productId,
        cardId: reservation.cardId,
        quantity: reservation.quantity,
        unitPrice,
        totalPrice: unitPrice * reservation.quantity
      });
    }

    const grandTotal = totalAmount + SHIPPING_FEE;

    if (grandTotal > MAX_TRANSFER_AMOUNT) {
      throw new PaymentError(`Số tiền vượt quá giới hạn thanh toán cho phép (${MAX_TRANSFER_AMOUNT} VND)`);
    }

    const orderCode = await generateUniqueOrderCode();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const order = await tx.order.create({
      data: {
        orderCode,
        userId,
        status: 'PENDING',
        totalAmount,
        shippingFee: SHIPPING_FEE,
        discountAmount: 0,
        grandTotal,
        shippingAddress,
        paymentMethod: normalizedPaymentMethod,
        paymentStatus: 'PENDING',
        expiresAt,
        items: { create: orderItemsData }
      },
      include: { items: true }
    });

    const { successUrl, errorUrl, cancelUrl } = sepayService.buildPaymentUrls(order.id);

    let sepaySession;
    try {
      sepaySession = sepayService.createCheckoutSession(
        orderCode,
        grandTotal,
        `Thanh toan don hang ${orderCode}`,
        { successUrl, errorUrl, cancelUrl }
      );
    } catch (sepayError) {
      // Lỗi cấu hình/SDK SePay không được phép sụp đổ cả transaction tạo đơn:
      // đơn vẫn được tạo (PENDING) và client nhận message lỗi rõ ràng để retry.
      console.error('SePay checkout session failed during checkout:', sepayError.message);
      throw sepayError;
    }

    const payment = await tx.payment.create({
      data: {
        orderId: order.id,
        paymentMethod: normalizedPaymentMethod,
        amount: grandTotal,
        status: 'PENDING',
        sepayOrderCode: orderCode,
        paymentUrl: sepaySession?.checkoutUrl || null,
        qrCodeUrl: null
      }
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        oldStatus: null,
        newStatus: 'PENDING',
        note: 'Order created'
      }
    });

    return {
      order: {
        id: order.id,
        orderCode: order.orderCode,
        status: order.status,
        totalAmount: order.totalAmount,
        shippingFee: order.shippingFee,
        grandTotal: order.grandTotal,
        createdAt: order.createdAt,
        expiresAt: order.expiresAt
      },
      payment: {
        checkoutUrl: sepaySession?.checkoutUrl || null,
        formFields: sepaySession?.formFields || null,
        paymentUrl: payment.paymentUrl,
        qrCodeUrl: payment.qrCodeUrl,
        webhookUrl: await sepayService.resolveWebhookUrl(),
        accountNumber: env.sepayAccountNumber,
        accountName: env.sepayAccountName,
        amount: grandTotal,
        transferContent: orderCode
      }
    };
  }, { isolationLevel: 'ReadCommitted' });
};


const LOOKUP_ORDER_INCLUDE = {
  items: {
    include: {
      product: { select: { id: true, name: true, shortName: true, images: true } },
      card: { select: { id: true, sku: true } }
    }
  }
};

const lookupOrder = async (orderCode, identifier) => {
  const order = await prisma.order.findFirst({
    where: {
      orderCode,
      user: {
        OR: [
          { email: identifier },
          { phone: identifier }
        ]
      }
    },
    include: LOOKUP_ORDER_INCLUDE
  });

  if (!order) throw new NotFoundError('Order not found or information mismatch');
  return order;
};

// Guest-friendly lookup by order code only (order code acts as the tracking key)
const lookupByOrderCode = async (orderCode) => {
  const order = await prisma.order.findFirst({
    where: { orderCode },
    include: LOOKUP_ORDER_INCLUDE
  });

  if (!order) throw new NotFoundError('No active shipment found');
  return order;
};

// Guest-friendly lookup by contact (email or phone) — returns the most recent order.
// Shipping details are masked by the controller to protect privacy.
const lookupByContact = async (identifier) => {
  const isEmail = identifier.includes('@');
  const userFilter = isEmail
    ? { email: { equals: identifier, mode: 'insensitive' } }
    : { phone: identifier };

  const order = await prisma.order.findFirst({
    where: { user: userFilter },
    orderBy: { createdAt: 'desc' },
    include: LOOKUP_ORDER_INCLUDE
  });

  if (!order) throw new NotFoundError('No active shipment found');
  return order;
};

const listUserOrders = async (userId, query) => {
  const where = { userId };
  if (query.status) where.status = query.status;

  const skip = (query.page - 1) * query.limit;
  const take = query.limit;

  const [items, totalItems] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, shortName: true, images: true } },
            card: { select: { id: true, sku: true } }
          }
        },
        payments: true
      }
    }),
    prisma.order.count({ where })
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

const getOrderById = async (orderId, userId = null) => {
  const where = { id: orderId };
  if (userId) where.userId = userId;

  const order = await prisma.order.findFirst({
    where,
    include: {
      items: {
        include: {
          product: true,
          card: true
        }
      },
      payments: true,
      statusHistory: true
    }
  });

  if (!order) throw new NotFoundError('Order not found');
  return order;
};

const cancelOrder = async (orderId, userId = null, note = 'Order cancelled by user') => {
  return prisma.$transaction(async (tx) => {
    const where = { id: orderId };
    if (userId) where.userId = userId;

    const order = await tx.order.findFirst({ where, include: { items: true, payments: true } });
    if (!order) throw new NotFoundError('Order not found');

    // Chỉ cho phép hủy khi PENDING hoặc PACKAGING
    if (!['PENDING', 'PACKAGING'].includes(order.status)) {
      throw new ConflictError(`Cannot cancel order in ${order.status} state`);
    }

    const oldStatus = order.status;

    for (const item of order.items) {
      // Hoàn stock về đúng variant đã đặt (nếu không có variantId thì bỏ qua —
      // không cộng thẳng vào Product vì bảng Product không có cột stock)
      if (item.variantId) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stockQuantity: { increment: item.quantity } }
        });
      }
      if (item.cardId) {
        if (oldStatus === 'PENDING') {
          await tx.card.updateMany({ where: { id: item.cardId, status: 'RESERVED' }, data: { status: 'AVAILABLE' } });
        } else if (oldStatus === 'PACKAGING') {
          await tx.card.updateMany({ where: { id: item.cardId, status: 'SOLD' }, data: { status: 'AVAILABLE' } });
        }
      }
    }

    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        version: { increment: 1 }
      }
    });

    if (oldStatus === 'PENDING') {
      await tx.payment.updateMany({ where: { orderId: order.id, status: 'PENDING' }, data: { status: 'FAILED' } });
    } else if (oldStatus === 'PACKAGING') {
      await tx.payment.updateMany({ where: { orderId: order.id, status: 'COMPLETED' }, data: { status: 'REFUNDED' } });
    }

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        oldStatus,
        newStatus: 'CANCELLED',
        note
      }
    });

    const io = global.io;
    if (io) {
      io.to(`user:${order.userId}`).emit('order:cancelled', {
        orderId: order.id,
        orderCode: order.orderCode,
        status: 'CANCELLED',
        cancelledAt: new Date().toISOString()
      });
      io.to(`user:${order.userId}`).emit('order:status_changed', {
        orderId: order.id,
        orderCode: order.orderCode,
        oldStatus,
        newStatus: 'CANCELLED'
      });
    }

    return updatedOrder;
  }, { isolationLevel: 'ReadCommitted' });
};

/**
 * Tái tạo phiên thanh toán SePay cho đơn PENDING (nút "Thanh toán ngay" trong
 * Lịch sử đơn hàng). Trả về signed form fields + checkoutUrl để frontend POST
 * (auto-submit form) sang trang thanh toán SePay — KHÔNG phải GET link trực
 * tiếp vì /checkout/init yêu cầu payload có chữ ký HMAC.
 */
const regeneratePayment = async (orderId, userId) => {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: { payments: { orderBy: { createdAt: 'desc' } } }
  });

  if (!order) throw new NotFoundError('Order not found');
  if (order.status !== 'PENDING') {
    throw new ConflictError(`Cannot regenerate payment for order in ${order.status} state`);
  }
  if (order.expiresAt && order.expiresAt < new Date()) {
    throw new PaymentError('Đơn hàng đã quá hạn thanh toán. Vui lòng đặt lại đơn hàng mới.');
  }

  // Dựng signed checkout session mới với đúng metadata của đơn
  // (orderCode, grandTotal, description, return URLs).
  const { successUrl, errorUrl, cancelUrl } = sepayService.buildPaymentUrls(order.id);
  const session = sepayService.createCheckoutSession(
    order.orderCode,
    Number(order.grandTotal),
    `Thanh toan don hang ${order.orderCode}`,
    { successUrl, errorUrl, cancelUrl }
  );

  // Persist URL mới nhất vào payment record (PENDING hoặc bản ghi gần nhất)
  const targetPayment = order.payments.find((p) => p.status === 'PENDING') || order.payments[0];
  if (targetPayment) {
    await prisma.payment.update({
      where: { id: targetPayment.id },
      data: {
        paymentUrl: session.checkoutUrl,
        amount: order.grandTotal,
        ...(targetPayment.status === 'FAILED' ? { status: 'PENDING' } : {})
      }
    });
  } else {
    await prisma.payment.create({
      data: {
        orderId: order.id,
        paymentMethod: order.paymentMethod || 'SEPAy',
        amount: order.grandTotal,
        status: 'PENDING',
        sepayOrderCode: order.orderCode,
        paymentUrl: session.checkoutUrl,
        qrCodeUrl: null
      }
    });
  }

  return {
    orderId: order.id,
    orderCode: order.orderCode,
    amount: Number(order.grandTotal),
    checkoutUrl: session.checkoutUrl,
    formFields: session.formFields,
    webhookUrl: await sepayService.resolveWebhookUrl(),
    accountNumber: env.sepayAccountNumber,
    accountName: env.sepayAccountName,
    transferContent: order.orderCode,
    expiresAt: order.expiresAt
  };
};

const getPaymentStatus = async (orderId, userId) => {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: {
      id: true,
      orderCode: true,
      status: true,
      paymentStatus: true,
      paidAt: true,
      updatedAt: true
    }
  });

  if (!order) throw new NotFoundError('Order not found');
  return order;
};

// Fallback sync: đối soát thanh toán với SePay khi webhook lỗi/không tới.
// Ưu tiên reconcile từ PaymentLog local, sau đó hỏi trực tiếp SePay PG API.
const syncOrderPayment = async (orderId, userId) => {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: { id: true, status: true }
  });
  if (!order) throw new NotFoundError('Order not found');

  if (order.status !== 'PENDING') {
    return {
      synced: false,
      reason: 'ORDER_ALREADY_PROCESSED',
      orderId: order.id,
      status: order.status
    };
  }

  return sepayService.syncOrderPaymentFromSepay(orderId, userId);
};

const cancelExpiredOrders = async () => {
  const now = new Date();
  const expiredOrders = await prisma.order.findMany({
    where: {
      status: 'PENDING',
      expiresAt: { lt: now }
    },
    select: { id: true }
  });

  let cancelledCount = 0;
  for (const order of expiredOrders) {
    try {
      await cancelOrder(order.id, null, 'Order cancelled due to expiration');
      cancelledCount++;
    } catch (error) {
      console.error(`Failed to cancel expired order ${order.id}:`, error.message);
    }
  }
  return cancelledCount;
};

module.exports = {
  createCheckout,
  lookupOrder,
  lookupByOrderCode,
  lookupByContact,
  listUserOrders,
  getOrderById,
  cancelOrder,
  regeneratePayment,
  getPaymentStatus,
  syncOrderPayment,
  cancelExpiredOrders
};
