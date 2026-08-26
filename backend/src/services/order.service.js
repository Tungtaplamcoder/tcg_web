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

  const productItemsMap = new Map();
  const cardItems = [];

  for (const item of items) {
    if (item.productId) {
      const current = productItemsMap.get(item.productId) || 0;
      productItemsMap.set(item.productId, current + item.quantity);
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
    const productReservations = [];
    for (const [productId, quantity] of productItemsMap.entries()) {
      const result = await tx.$queryRaw`
        UPDATE "Product"
        SET "reservedStock" = "reservedStock" + ${quantity},
            "version" = "version" + 1
        WHERE "id" = ${productId}
          AND "stockQuantity" - "reservedStock" >= ${quantity}
          AND "status" = 'ACTIVE'
        RETURNING "id", "name", "price", "stockQuantity", "reservedStock"
      `;
      if (!result || result.length === 0) {
        throw new PaymentError(`Insufficient stock for product ${productId}`);
      }
      productReservations.push({ productId, quantity, product: result[0] });
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

    for (const reservation of productReservations) {
      const product = reservation.product;
      const unitPrice = Number(product.price);
      totalAmount += unitPrice * reservation.quantity;
      orderItemsData.push({
        productId: reservation.productId,
        quantity: reservation.quantity,
        unitPrice,
        totalPrice: unitPrice * reservation.quantity
      });
    }

    for (const reservation of cardReservations) {
      const cardProduct = await tx.product.findUnique({
        where: { id: reservation.card.productId },
        select: { price: true }
      });
      if (!cardProduct) throw new PaymentError(`Product not found for card ${reservation.cardId}`);
      const unitPrice = Number(cardProduct.price);
      totalAmount += unitPrice * reservation.quantity;
      orderItemsData.push({
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

    const successUrl = `${env.frontendUrl}/payment/success?orderId=${order.id}`;
    const errorUrl = `${env.frontendUrl}/payment/error?orderId=${order.id}`;
    const cancelUrl = `${env.frontendUrl}/payment/cancel?orderId=${order.id}`;

    const sepaySession = sepayService.createCheckoutSession(
      orderCode,
      grandTotal,
      `Thanh toan don hang ${orderCode}`,
      { successUrl, errorUrl, cancelUrl }
    );

    const payment = await tx.payment.create({
      data: {
        orderId: order.id,
        paymentMethod: normalizedPaymentMethod,
        amount: grandTotal,
        status: 'PENDING',
        sepayOrderCode: orderCode,
        paymentUrl: sepaySession.checkoutUrl,
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
        checkoutUrl: sepaySession.checkoutUrl,
        formFields: sepaySession.formFields,
        paymentUrl: payment.paymentUrl,
        qrCodeUrl: payment.qrCodeUrl,
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
      if (item.productId) {
        if (oldStatus === 'PENDING') {
          await tx.$executeRaw`
            UPDATE "Product"
            SET "reservedStock" = "reservedStock" - ${item.quantity},
                "version" = "version" + 1
            WHERE "id" = ${item.productId}
          `;
        } else if (oldStatus === 'PACKAGING') {
          await tx.$executeRaw`
            UPDATE "Product"
            SET "stockQuantity" = "stockQuantity" + ${item.quantity},
                "reservedStock" = "reservedStock" - ${item.quantity},
                "version" = "version" + 1
            WHERE "id" = ${item.productId}
          `;
        }
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

const regeneratePayment = async (orderId, userId) => {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: { payments: { where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' } } }
  });

  if (!order) throw new NotFoundError('Order not found');
  if (order.status !== 'PENDING') {
    throw new ConflictError(`Cannot regenerate payment for order in ${order.status} state`);
  }
  if (order.expiresAt && order.expiresAt < new Date()) {
    throw new PaymentError('Order has expired');
  }

  const payment = order.payments[0];
  if (!payment) throw new PaymentError('No pending payment found');

  return {
    paymentUrl: payment.paymentUrl,
    qrCodeUrl: payment.qrCodeUrl,
    accountNumber: env.sepayAccountNumber,
    accountName: env.sepayAccountName,
    amount: payment.amount,
    transferContent: order.orderCode
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
  cancelExpiredOrders
};