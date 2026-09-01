const crypto = require('crypto');
const { SePayPgClient } = require('sepay-pg-node');
const prisma = require('../config/prisma');
const env = require('../config/env');
const { AppError, PaymentError, ConflictError, NotFoundError } = require('../utils/errors');

// Khởi tạo SePay client một cách an toàn — nếu cấu hình thiếu/dư thì vẫn không crash app
let sepayClient = null;
try {
  sepayClient = new SePayPgClient({
    env: env.sepayEnv || 'sandbox',
    merchant_id: env.sepayMerchantId,
    secret_key: env.sepayMerchantSecretKey
  });
} catch (error) {
  console.error('SePay SDK init failed:', error.message);
}

/**
 * URL Webhook/IPN mà SePay sẽ gọi về.
 * Ưu tiên: AppSetting DB (admin override) > SEPAY_WEBHOOK_URL > NEXT_PUBLIC_API_URL/APP_BASE_URL + path > NEXT_PUBLIC_APP_URL/FRONTEND_URL + path.
 * Không hardcode domain — mọi domain đặt qua biến môi trường hoặc admin panel.
 * `req` (optional): request hiện tại — dùng Host/X-Forwarded-Host header
 * để suy ra domain công khai khi env không cấu hình (deploy sau Nginx).
 */
const getWebhookUrl = (req) => {
  const path = env.sepayWebhookPath || '/api/v1/webhooks/sepay';

  if (env.sepayWebhookUrl) return env.sepayWebhookUrl;
  if (env.apiUrl) return `${env.apiUrl}${path}`;

  // Suy ra từ request đến (chạy sau reverse proxy: Host đã là domain công khai)
  const forwardedHost = req?.headers?.['x-forwarded-host'] || req?.headers?.host;
  const forwardedProto = req?.headers?.['x-forwarded-proto'] ||
    (req?.socket?.encrypted ? 'https' : null) ||
    (req?.headers?.host?.startsWith('localhost') || req?.headers?.host?.startsWith('127.0.0.1') ? 'http' : 'https');
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}${path}`;

  // Fallback: suy ra từ APP_URL nếu API và frontend cùng domain
  if (env.appUrl) return `${env.appUrl}${path}`;

  // Không cấu hình domain nào -> trả về relative path để client/SePay tự gắn domain
  return path;
};

// Bản async: đọc override từ AppSetting DB (admin panel) trước khi rơi về env.
// `req` optional — forwarded để suy ra URL từ Host header khi env trống.
const resolveWebhookUrl = async (req) => {
  try {
    const settingsService = require('./settings.service');
    return await settingsService.resolveWebhookUrl(req);
  } catch (err) {
    console.error('resolveWebhookUrl fallback to env:', err.message);
    return getWebhookUrl(req);
  }
};

const generateOrderCode = () => {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `TCG-${yyyy}${mm}${dd}-${random}`;
};

/**
 * Base URL công khai của frontend, đọc ĐỘNG từ biến môi trường tại thời điểm gọi:
 *   NEXT_PUBLIC_APP_URL (chuẩn hoá production) > APP_URL > FRONTEND_URL (legacy).
 * Trong production URL này PHẢI là domain thật (https://yourdomain.com);
 * http://localhost chỉ còn hợp lệ khi NODE_ENV=development (dev server).
 * Không fallback về IP hay domain hardcode — nếu thiếu thì ném lỗi cấu hình
 * rõ ràng thay vì redirect người dùng vào localhost của server.
 */
const getFrontendBaseUrl = () => {
  const raw = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || process.env.FRONTEND_URL || '';
  const base = String(raw).replace(/\/+$/, '');

  if (!base) {
    throw new PaymentError(
      'Thiếu cấu hình domain frontend (NEXT_PUBLIC_APP_URL). Không thể dựng URL chuyển hướng thanh toán.'
    );
  }

  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(base);
  if (isLocal && env.nodeEnv === 'production') {
    throw new PaymentError(
      'NEXT_PUBLIC_APP_URL đang trỏ về localhost trong production — hãy cấu hình domain công khai.'
    );
  }

  return base;
};

/**
 * Xây các URL điều hướng sau thanh toán (return/success/cancel) cho SePay:
 *   ${NEXT_PUBLIC_APP_URL}/payment/success?orderId=...
 *   ${NEXT_PUBLIC_APP_URL}/payment/error?orderId=...
 *   ${NEXT_PUBLIC_APP_URL}/payment/cancel?orderId=...
 * Đọc động tại mỗi lần gọi để đổi domain không cần redeploy.
 */
const buildPaymentUrls = (orderId) => {
  const base = getFrontendBaseUrl();
  return {
    successUrl: `${base}/payment/success?orderId=${orderId}`,
    errorUrl: `${base}/payment/error?orderId=${orderId}`,
    cancelUrl: `${base}/payment/cancel?orderId=${orderId}`
  };
};

/**
 * Tạo checkout session. Ném PaymentError (mã 400, có message rõ ràng) thay vì
 * để lỗi SDK bắn lên thành 500 Internal Server Error.
 */
const createCheckoutSession = (orderCode, amountVND, description, urls) => {
  if (!sepayClient) {
    throw new PaymentError('SePay chưa được cấu hình (thiếu SEPAY_MERCHANT_ID / SEPAY_MERCHANT_SECRET_KEY). Vui lòng kiểm tra cấu hình thanh toán.');
  }

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
    throw new PaymentError(`Không tạo được phiên thanh toán SePay: ${error.message}`);
  }
};

/**
 * Xác minh chữ ký webhook (HMAC-SHA256 của raw body).
 * Ưu tiên SEPAY_WEBHOOK_SECRET, fallback SEPAY_MERCHANT_SECRET_KEY.
 */
const verifyWebhookSignature = (rawBody, signature) => {
  if (!signature || !rawBody) return false;
  const secret = env.sepayWebhookSecret || env.sepayMerchantSecretKey;
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(String(signature).replace(/^sha256=/, ''), 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

/**
 * Ghi payment log an toàn: không để lỗi DB làm hỏng toàn bộ luồng webhook.
 */
const logPayment = async (data) => {
  try {
    await prisma.paymentLog.create({ data });
  } catch (err) {
    console.error('Failed to write payment log:', err.message);
  }
};

// ==================== WEBHOOK PARSING ====================

// Mã đơn hàng do generateOrderCode sinh ra: TCG-YYYYMMDD-HEX8 (vd: TCG-20260830-C1E64803)
const ORDER_CODE_REGEX = /TCG-\d{8}-[A-F0-9]{8}/i;

/**
 * Trích mã đơn hàng từ payload webhook/IPN của SePay.
 * SePay gửi 2 định dạng:
 *  1) IPN checkout: { order: { order_invoice_number, ... }, transaction: {...} }
 *  2) Webhook ngân hàng truyền thống (flat): { transaction_content / content, ... }
 * Tìm kiếm mã đơn (TCG-...) trong mọi trường có thể chứa nội dung chuyển khoản
 * để khớp bất kể định dạng nào.
 */
const extractOrderCode = (payload) => {
  const candidates = [
    payload?.order?.order_invoice_number,
    payload?.transaction?.transaction_content,
    payload?.transaction?.content,
    payload?.transaction?.description,
    payload?.transaction_content,
    payload?.content,
    payload?.description,
    payload?.order_description,
    payload?.order_invoice_number,
    payload?.code,
    payload?.reference_code,
    payload?.message
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const match = String(candidate).match(ORDER_CODE_REGEX);
    if (match) return match[0].toUpperCase();
  }
  // Fallback: quét sâu 1 tầng object cho các biến thể payload lạ
  const stack = [payload];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') continue;
    for (const value of Object.values(current)) {
      if (typeof value === 'string') {
        const match = value.match(ORDER_CODE_REGEX);
        if (match) return match[0].toUpperCase();
      } else if (value && typeof value === 'object') {
        stack.push(value);
      }
    }
  }
  return null;
};

// Trạng thái được coi là "đã thanh toán thành công"
const PAID_TRANSACTION_STATUSES = ['APPROVED', 'PAID', 'COMPLETED', 'SUCCESS'];

/**
 * Chuyển đơn PENDING -> PACKAGING (Đã thanh toán / Đang đóng gói) trong MỘT
 * transaction an toàn (lock FOR UPDATE), dùng chung cho cả webhook IPN và
 * fallback sync API. Idempotent: đơn đã xử lý thì ném ConflictError, log
 * SePay transaction chỉ tạo khi chưa tồn tại (unique).
 */
const markOrderPaid = async (order, {
  sepayTransactionId = null,
  amount = null,
  content = null,
  rawPayload = null,
  paymentId = null,
  note = 'Payment confirmed via SePay'
} = {}) => {
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // Lock order để tránh race giữa webhook / sync / admin
    const locked = await tx.$queryRaw`SELECT * FROM "Order" WHERE "id" = ${order.id} FOR UPDATE`;
    if (!locked || locked.length === 0) throw new NotFoundError('Order not found');
    if (locked[0].status !== 'PENDING') {
      throw new ConflictError(`Order is not in PENDING state (current: ${locked[0].status})`);
    }

    // Cập nhật order: PENDING -> PACKAGING (Đã thanh toán -> Đóng gói)
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'PACKAGING',
        paymentStatus: 'COMPLETED',
        paidAt: now,
        version: { increment: 1 }
      }
    });

    // Cập nhật payment record nếu có
    const targetPaymentId = paymentId
      || order.payments?.find((p) => p.status === 'PENDING')?.id
      || order.payments?.[0]?.id
      || null;
    if (targetPaymentId) {
      await tx.payment.update({
        where: { id: targetPaymentId },
        data: {
          status: 'COMPLETED',
          ...(sepayTransactionId ? { sepayTransactionId } : {}),
          paidAt: now
        }
      });
    }

    // Tồn kho variant ĐÃ được trừ (reserve) ngay khi tạo đơn ở checkout —
    // KHÔNG trừ lần nữa ở đây để tránh giảm tồn kho kép.
    // Chỉ chốt thẻ đơn lẻ: RESERVED -> SOLD (idempotent, bỏ qua nếu đã SOLD).
    for (const item of order.items || []) {
      if (item.cardId) {
        await tx.card.updateMany({
          where: { id: item.cardId, status: 'RESERVED' },
          data: { status: 'SOLD' }
        });
      }
    }

    // Lịch sử trạng thái
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        oldStatus: 'PENDING',
        newStatus: 'PACKAGING',
        note
      }
    });

    // Ghi log thành công — chỉ tạo khi chưa có log với transaction id này (idempotent)
    const existingLog = sepayTransactionId
      ? await tx.paymentLog.findUnique({ where: { sepayTransactionId } })
      : null;
    if (!existingLog) {
      await tx.paymentLog.create({
        data: {
          sepayTransactionId,
          orderId: order.id,
          paymentId: targetPaymentId,
          rawPayload: rawPayload ?? { note, source: 'markOrderPaid' },
          amount: amount != null ? Number(amount) : null,
          content: content || null,
          status: 'COMPLETED',
          processedAt: now
        }
      });
    }
  });

  // Emit socket để frontend tự cập nhật trạng thái không cần F5
  const io = global.io;
  if (io && order.userId) {
    io.to(`user:${order.userId}`).emit('order:paid', {
      orderId: order.id,
      orderCode: order.orderCode,
      status: 'PACKAGING',
      paidAt: now.toISOString()
    });
    io.to(`user:${order.userId}`).emit('order:status_changed', {
      orderId: order.id,
      orderCode: order.orderCode,
      oldStatus: 'PENDING',
      newStatus: 'PACKAGING'
    });
  }

  return {
    orderId: order.id,
    orderCode: order.orderCode,
    status: 'PACKAGING',
    paymentStatus: 'COMPLETED',
    paidAt: now.toISOString()
  };
};

/**
 * Truy vấn SePay PG API để xác minh trạng thái thanh toán của một order code.
 * Trả về { paid, transactionId, amount, raw } hoặc null nếu không gọi được API.
 * Parsing phòng thủ: cấu trúc response có thể là { data: {...} } hoặc flat.
 */
const querySepayOrderStatus = async (orderCode) => {
  if (!sepayClient) return null;

  let raw = null;
  try {
    const res = await sepayClient.order.retrieve(orderCode);
    raw = res?.data ?? res ?? null;
  } catch (err) {
    console.warn(`SePay order retrieve failed for ${orderCode}: ${err.message}`);
  }

  if (!raw) {
    // Fallback: tìm kiếm theo từ khoá
    try {
      const res = await sepayClient.order.all({ q: orderCode, per_page: 10 });
      const body = res?.data ?? res;
      const list = body?.orders ?? body?.data ?? (Array.isArray(body) ? body : []);
      if (Array.isArray(list) && list.length > 0) {
        raw = list.find(
          (o) => String(o?.order_invoice_number ?? '').toUpperCase() === orderCode.toUpperCase()
        ) || list[0] || null;
      }
    } catch (err) {
      console.warn(`SePay order search failed for ${orderCode}: ${err.message}`);
    }
  }

  if (!raw) return null;

  const node = raw?.data ?? raw;
  const ord = node?.order ?? node ?? {};
  const txn = node?.transaction ?? ord?.transaction ?? null;
  const orderStatus = String(ord?.order_status ?? ord?.status ?? '').toUpperCase();
  const txnStatus = String(txn?.transaction_status ?? '').toUpperCase();

  const paid = PAID_TRANSACTION_STATUSES.includes(orderStatus)
    || PAID_TRANSACTION_STATUSES.includes(txnStatus);
  if (!paid) return { paid: false, raw };

  return {
    paid: true,
    transactionId: txn?.transaction_id ?? ord?.transaction_id ?? ord?.id ?? null,
    amount: txn?.transaction_amount ?? ord?.order_amount ?? ord?.amount ?? null,
    raw
  };
};

/**
 * Fallback sync: đối soát trạng thái thanh toán của đơn hàng khi webhook lỗi.
 * 1) Nếu đơn đã xử lý -> trả trạng thái hiện tại.
 * 2) Reconcile từ PaymentLog COMPLETED local (webhook ghi log nhưng update order fail).
 * 3) Hỏi trực tiếp SePay PG API; nếu SePay xác nhận PAID -> markOrderPaid.
 */
const syncOrderPaymentFromSepay = async (orderId, userId = null) => {
  const order = await prisma.order.findFirst({
    where: userId ? { id: orderId, userId } : { id: orderId },
    include: {
      items: true,
      payments: { orderBy: { createdAt: 'desc' } }
    }
  });

  if (!order) throw new NotFoundError('Order not found');

  const currentStatus = {
    orderId: order.id,
    orderCode: order.orderCode,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paidAt: order.paidAt
  };

  if (order.status !== 'PENDING') {
    return { synced: false, reason: 'ORDER_ALREADY_PROCESSED', ...currentStatus };
  }

  // 1) Reconcile từ payment log local đã COMPLETED nhưng order chưa được cập nhật
  const completedLog = await prisma.paymentLog.findFirst({
    where: { orderId: order.id, status: 'COMPLETED' },
    orderBy: { createdAt: 'desc' }
  }).catch(() => null);
  if (completedLog) {
    const result = await markOrderPaid(order, {
      sepayTransactionId: completedLog.sepayTransactionId,
      amount: completedLog.amount != null ? Number(completedLog.amount) : null,
      content: completedLog.content,
      rawPayload: completedLog.rawPayload,
      paymentId: completedLog.paymentId,
      note: 'Payment reconciled from existing payment log (webhook fallback)'
    });
    return { synced: true, source: 'PAYMENT_LOG', ...result };
  }

  // 2) Xác minh trực tiếp với SePay
  const sepayResult = await querySepayOrderStatus(order.orderCode);
  if (sepayResult?.paid) {
    const result = await markOrderPaid(order, {
      sepayTransactionId: sepayResult.transactionId,
      amount: sepayResult.amount != null ? Number(sepayResult.amount) : Number(order.grandTotal),
      content: order.orderCode,
      rawPayload: sepayResult.raw,
      note: 'Payment verified against SePay API (webhook fallback)'
    });
    return { synced: true, source: 'SEPAY_API', ...result };
  }

  return { synced: false, reason: 'NO_PAID_TRANSACTION_FOUND', ...currentStatus };
};

/**
 * Xử lý IPN/webhook từ SePay
 * Hỗ trợ 2 cấu trúc payload:
 * 1) IPN checkout:
 * {
 *   notification_type: 'ORDER_PAID',
 *   order: { order_invoice_number, order_amount, order_status, ... },
 *   transaction: { transaction_id, transaction_amount, transaction_status, ... },
 *   customer: null,
 *   agreement: null
 * }
 * 2) Webhook ngân hàng (flat — nội dung chuyển khoản chứa mã đơn):
 * {
 *   id, gateway, transaction_date, account_number,
 *   amount, transaction_content: '...TCG-20260830-C1E64803...',
 *   reference_number, ...
 * }
 */
const processWebhook = async (payload, rawBody, signature, headers) => {
  console.log('\n=== IPN RECEIVED ===');
  console.log('Headers:', JSON.stringify(headers, null, 2));
  console.log('Raw body:', rawBody);
  console.log('Payload:', payload);
  console.log('====================\n');

  // Xác minh chữ ký khi có ĐỦ cả signature header và secret cấu hình.
  // Sandbox/test thường không kèm signature — vẫn chấp nhận như trước.
  if (signature && (env.sepayWebhookSecret || env.sepayMerchantSecretKey)) {
    const valid = verifyWebhookSignature(rawBody, signature);
    if (!valid) {
      await logPayment({
        rawPayload: payload,
        status: 'SIGNATURE_MISMATCH',
        errorMessage: 'Invalid webhook signature',
        amount: null,
        content: null,
        sepayTransactionId: null
      });
      return { success: true, message: 'Signature mismatch logged' };
    }
  }

  // ==================== PARSE IPN ====================
  const orderInfo = payload?.order || {};
  const transactionInfo = payload?.transaction || {};

  // Trích mã đơn hàng từ mọi trường nội dung chuyển khoản có thể có
  const content = extractOrderCode(payload);

  const sepayTransactionId = transactionInfo.transaction_id
    || payload?.transaction_id
    || orderInfo.order_id
    || payload?.id
    || payload?.reference_number
    || (content ? `webhook-${content}` : null);

  const amount = transactionInfo.transaction_amount
    ?? transactionInfo.amount
    ?? orderInfo.order_amount
    ?? payload?.amount
    ?? null;

  console.log('Parsed IPN:');
  console.log('sepayTransactionId:', sepayTransactionId);
  console.log('amount:', amount);
  console.log('content (order code):', content);

  // Kiểm tra các trường bắt buộc
  if (!content || amount === null || amount === undefined || !sepayTransactionId) {
    await logPayment({
      rawPayload: payload,
      status: 'INVALID_PAYLOAD',
      errorMessage: 'Missing required fields (order code in transfer content, amount, transaction id)',
      amount: amount != null ? parseFloat(amount) : null,
      content: content || null,
      sepayTransactionId: sepayTransactionId || null
    });
    return { success: true, message: 'Invalid payload logged' };
  }

  // Kiểm tra trạng thái giao dịch — chỉ xử lý khi APPROVED/PAID
  const transactionStatus = String(
    transactionInfo.transaction_status ?? transactionInfo.status ?? ''
  ).toUpperCase();
  if (transactionStatus && !PAID_TRANSACTION_STATUSES.includes(transactionStatus)) {
    await logPayment({
      rawPayload: payload,
      status: 'MISMATCH',
      errorMessage: `Transaction status is ${transactionStatus}, not APPROVED/PAID`,
      amount: parseFloat(amount),
      content,
      sepayTransactionId
    });
    return { success: true, message: 'Transaction not approved, logged' };
  }

  // Idempotency check
  const existingLog = await prisma.paymentLog.findUnique({
    where: { sepayTransactionId }
  }).catch((err) => {
    console.error('PaymentLog lookup failed:', err.message);
    return null;
  });
  if (existingLog) {
    await logPayment({
      rawPayload: payload,
      status: 'DUPLICATE',
      errorMessage: 'Duplicate webhook received',
      amount: parseFloat(amount),
      content,
      sepayTransactionId
    });
    return { success: true, message: 'Duplicate webhook acknowledged' };
  }

  // Tìm order theo order code trích từ nội dung chuyển khoản
  const order = await prisma.order.findUnique({
    where: { orderCode: content },
    include: {
      items: true,
      payments: { where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' } }
    }
  }).catch((err) => {
    console.error('Order lookup failed:', err.message);
    return null;
  });

  if (!order) {
    await logPayment({
      rawPayload: payload,
      status: 'MISMATCH',
      errorMessage: 'No order found with this order code',
      amount: parseFloat(amount),
      content,
      sepayTransactionId
    });
    return { success: true, message: 'Mismatched transfer logged' };
  }

  if (order.status !== 'PENDING') {
    await logPayment({
      rawPayload: payload,
      status: 'MISMATCH',
      errorMessage: `Order is in ${order.status} state, not PENDING`,
      amount: parseFloat(amount),
      content,
      sepayTransactionId,
      orderId: order.id
    });
    return { success: true, message: 'Order not pending, logged' };
  }

  // Kiểm tra số tiền khớp với đơn hàng
  const paidAmount = parseFloat(amount);
  if (!Number.isFinite(paidAmount) || Math.abs(paidAmount - Number(order.grandTotal)) > 0.01) {
    await logPayment({
      rawPayload: payload,
      status: 'AMOUNT_MISMATCH',
      errorMessage: `Paid amount ${amount} does not match order grandTotal ${order.grandTotal}`,
      amount: paidAmount,
      content,
      sepayTransactionId,
      orderId: order.id
    });
    return { success: true, message: 'Amount mismatch logged' };
  }

  // Xử lý chính: PENDING -> PACKAGING (Đã thanh toán / Đang đóng gói)
  try {
    await markOrderPaid(order, {
      sepayTransactionId,
      amount: paidAmount,
      content,
      rawPayload: payload,
      paymentId: order.payments[0]?.id || null,
      note: 'Payment confirmed via SePay IPN'
    });

    return { success: true, message: 'Payment processed successfully' };
  } catch (error) {
    const status = error.message?.includes('AMOUNT_MISMATCH') ? 'AMOUNT_MISMATCH' : 'ERROR';
    await logPayment({
      sepayTransactionId: sepayTransactionId || null,
      orderId: order.id,
      rawPayload: payload,
      amount: parseFloat(amount),
      content,
      status,
      errorMessage: error.message
    });
    return { success: true, message: `Payment processing failed: ${error.message}` };
  }
};

module.exports = {
  generateOrderCode,
  createCheckoutSession,
  verifyWebhookSignature,
  getWebhookUrl,
  resolveWebhookUrl,
  processWebhook,
  markOrderPaid,
  syncOrderPaymentFromSepay,
  extractOrderCode,
  getFrontendBaseUrl,
  buildPaymentUrls
};
