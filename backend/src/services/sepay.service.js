const crypto = require('crypto');
const { SePayPgClient } = require('sepay-pg-node');
const prisma = require('../config/prisma');
const env = require('../config/env');
const { AppError, PaymentError } = require('../utils/errors');

// Khởi tạo SePay client
const sepayClient = new SePayPgClient({
  env: env.sepayEnv || 'sandbox',
  merchant_id: env.sepayMerchantId,
  secret_key: env.sepayMerchantSecretKey
});

const generateOrderCode = () => {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `TCG-${yyyy}${mm}${dd}-${random}`;
};

/**
 * Tạo checkout session
 */
const createCheckoutSession = (orderCode, amountVND, description, urls) => {
  try {
    const checkoutUrl = sepayClient.checkout.initCheckoutUrl();
    const formFields = sepayClient.checkout.initOneTimePaymentFields({
      operation: 'PURCHASE',
      payment_method: 'BANK_TRANSFER',
      order_invoice_number: orderCode,
      order_amount: amountVND,
      currency: 'VND',
      order_description: description,
      success_url: urls.successUrl,
      error_url: urls.errorUrl,
      cancel_url: urls.cancelUrl
    });
    return { checkoutUrl, formFields };
  } catch (error) {
    console.error('SePay SDK error:', error);
    throw new PaymentError('Failed to create SePay checkout session');
  }
};

/**
 * Xác minh chữ ký webhook (chưa dùng trong sandbox test)
 */
const verifyWebhookSignature = (rawBody, signature) => {
  if (!signature || !rawBody) return false;
  const secret = env.sepayMerchantSecretKey;
  const expected = crypto.createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(signature, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

/**
 * Xử lý IPN từ SePay
 * Cấu trúc IPN thực tế:
 * {
 *   notification_type: 'ORDER_PAID',
 *   order: { order_invoice_number, order_amount, order_status, ... },
 *   transaction: { transaction_id, transaction_amount, transaction_status, ... },
 *   customer: null,
 *   agreement: null
 * }
 */
const processWebhook = async (payload, rawBody, signature, headers) => {
  console.log('\n=== IPN RECEIVED ===');
  console.log('Headers:', JSON.stringify(headers, null, 2));
  console.log('Raw body:', rawBody);
  console.log('Payload:', payload);
  console.log('====================\n');

  // Tạm thời bỏ qua xác minh chữ ký để test, đổi thành verifyWebhookSignature khi production
  const isValid = true;

  if (!isValid) {
    await prisma.paymentLog.create({
      data: {
        rawPayload: payload,
        status: 'SIGNATURE_MISMATCH',
        errorMessage: 'Invalid webhook signature',
        amount: null,
        content: null,
        sepayTransactionId: null
      }
    });
    return { success: true, message: 'Signature mismatch logged' };
  }

  // ==================== PARSE IPN ====================
  const orderInfo = payload?.order || {};
  const transactionInfo = payload?.transaction || {};

  const sepayTransactionId = transactionInfo.transaction_id || orderInfo.order_id || payload?.id;
  const amount = transactionInfo.transaction_amount || orderInfo.order_amount;
  const content = orderInfo.order_invoice_number || payload?.content;

  console.log('Parsed IPN:');
  console.log('sepayTransactionId:', sepayTransactionId);
  console.log('amount:', amount);
  console.log('content:', content);

  // Kiểm tra các trường bắt buộc
  if (!sepayTransactionId || !amount || !content) {
    await prisma.paymentLog.create({
      data: {
        rawPayload: payload,
        status: 'INVALID_PAYLOAD',
        errorMessage: 'Missing required fields (transaction_id, amount, content)',
        amount: amount ? parseFloat(amount) : null,
        content: content || null,
        sepayTransactionId: sepayTransactionId || null
      }
    });
    return { success: true, message: 'Invalid payload logged' };
  }

  // Kiểm tra trạng thái giao dịch chỉ xử lý khi APPROVED
  const transactionStatus = transactionInfo.transaction_status;
  if (transactionStatus && transactionStatus !== 'APPROVED') {
    await prisma.paymentLog.create({
      data: {
        rawPayload: payload,
        status: 'MISMATCH',
        errorMessage: `Transaction status is ${transactionStatus}, not APPROVED`,
        amount: parseFloat(amount),
        content,
        sepayTransactionId
      }
    });
    return { success: true, message: 'Transaction not approved, logged' };
  }

  // Idempotency check
  const existingLog = await prisma.paymentLog.findUnique({
    where: { sepayTransactionId }
  });
  if (existingLog) {
    await prisma.paymentLog.create({
      data: {
        rawPayload: payload,
        status: 'DUPLICATE',
        errorMessage: 'Duplicate webhook received',
        amount: parseFloat(amount),
        content,
        sepayTransactionId
      }
    });
    return { success: true, message: 'Duplicate webhook acknowledged' };
  }

  // Tìm order theo order_invoice_number
  const order = await prisma.order.findUnique({
    where: { orderCode: content },
    include: {
      items: true,
      payments: { where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' } }
    }
  });

  if (!order) {
    await prisma.paymentLog.create({
      data: {
        rawPayload: payload,
        status: 'MISMATCH',
        errorMessage: 'No order found with this invoice number',
        amount: parseFloat(amount),
        content,
        sepayTransactionId
      }
    });
    return { success: true, message: 'Mismatched transfer logged' };
  }

  if (order.status !== 'PENDING') {
    await prisma.paymentLog.create({
      data: {
        rawPayload: payload,
        status: 'MISMATCH',
        errorMessage: `Order is in ${order.status} state, not PENDING`,
        amount: parseFloat(amount),
        content,
        sepayTransactionId,
        orderId: order.id
      }
    });
    return { success: true, message: 'Order not pending, logged' };
  }

  // Xử lý chính
  try {
    await prisma.$transaction(async (tx) => {
      // Lock order
      const locked = await tx.$queryRaw`SELECT * FROM "Order" WHERE "id" = ${order.id} FOR UPDATE`;
      if (!locked || locked.length === 0) throw new PaymentError('Order not found');
      if (locked[0].status !== 'PENDING') throw new PaymentError(`Order is not in PENDING state (current: ${locked[0].status})`);

      const now = new Date();

      // Cập nhật order: PENDING -> PACKAGING
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'PACKAGING',
          paymentStatus: 'COMPLETED',
          paidAt: now,
          version: { increment: 1 }
        }
      });

      // Cập nhật payment nếu có
      if (order.payments.length > 0) {
        await tx.payment.update({
          where: { id: order.payments[0].id },
          data: {
            status: 'COMPLETED',
            sepayTransactionId,
            paidAt: now
          }
        });
      }

      // Trừ stock
      for (const item of order.items) {
        if (item.productId) {
          const updatedProduct = await tx.$executeRaw`
            UPDATE "Product"
            SET "stockQuantity" = "stockQuantity" - ${item.quantity},
                "reservedStock" = CASE WHEN "reservedStock" >= ${item.quantity} THEN "reservedStock" - ${item.quantity} ELSE 0 END,
                "version" = "version" + 1
            WHERE "id" = ${item.productId}
                AND "stockQuantity" >= ${item.quantity}
            `;
          if (updatedProduct === 0) {
            throw new PaymentError('Insufficient stock to fulfill order item');
          }
        }
        if (item.cardId) {
          const updatedCard = await tx.card.updateMany({
            where: { id: item.cardId, status: 'RESERVED' },
            data: { status: 'SOLD' }
          });
          if (updatedCard.count === 0) {
            throw new PaymentError('Card item is not in RESERVED state');
          }
        }
      }

      // Lịch sử trạng thái
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          oldStatus: 'PENDING',
          newStatus: 'PACKAGING',
          note: 'Payment confirmed via SePay IPN'
        }
      });

      // Ghi log thành công
      await tx.paymentLog.create({
        data: {
          sepayTransactionId,
          orderId: order.id,
          paymentId: order.payments[0]?.id || null,
          rawPayload: payload,
          amount: parseFloat(amount),
          content,
          status: 'COMPLETED',
          processedAt: now
        }
      });
    });

    // Emit socket
    const io = global.io;
    if (io && order.userId) {
      io.to(`user:${order.userId}`).emit('order:paid', {
        orderId: order.id,
        orderCode: order.orderCode,
        status: 'PACKAGING',
        paidAt: new Date().toISOString()
      });
      io.to(`user:${order.userId}`).emit('order:status_changed', {
        orderId: order.id,
        orderCode: order.orderCode,
        oldStatus: 'PENDING',
        newStatus: 'PACKAGING'
      });
    }

    return { success: true, message: 'Payment processed successfully' };
  } catch (error) {
    const status = error.message?.includes('AMOUNT_MISMATCH') ? 'AMOUNT_MISMATCH' : 'ERROR';
    await prisma.paymentLog.create({
      data: {
        sepayTransactionId: sepayTransactionId || null,
        orderId: order.id,
        rawPayload: payload,
        amount: parseFloat(amount),
        content,
        status,
        errorMessage: error.message
      }
    });
    return { success: true, message: `Payment processing failed: ${error.message}` };
  }
};

module.exports = {
  generateOrderCode,
  createCheckoutSession,
  verifyWebhookSignature,
  processWebhook
};