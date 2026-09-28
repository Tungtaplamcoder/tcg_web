process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.SEPAY_ENV = 'sandbox';
process.env.SEPAY_MERCHANT_ID = 'SP-TEST';
process.env.SEPAY_MERCHANT_SECRET_KEY = 'spk_test_secret';
process.env.SEPAY_WEBHOOK_SECRET = 'whsec_test_secret';
process.env.NEXT_PUBLIC_APP_URL = 'https://shop.example.com';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

let idCounter = 0;
const nextId = (prefix) => `${prefix}-${++idCounter}`;

const createPrismaStub = () => {
  const calls = [];
  const state = {
    orders: [],
    payments: [],
    paymentLogs: [],
    statusHistory: [],
    appSettings: {}
  };

  const record = (name, args) => calls.push({ name, args });

  const stub = {
    __calls: calls,
    __state: state,
    $transaction: async (operations) => {
      if (typeof operations === 'function') return operations(stub);
      return Promise.all(operations);
    },
    $queryRaw: async () => {
      const order = state.orders[0];
      return order ? [order] : [];
    },
    order: {
      findUnique: async ({ where }) => {
        record('order.findUnique', where);
        return state.orders.find((o) => o.orderCode === where.orderCode || o.id === where.id) || null;
      },
      findFirst: async ({ where }) => {
        record('order.findFirst', where);
        return state.orders.find(
          (o) => (!where.id || o.id === where.id) && (!where.userId || o.userId === where.userId)
        ) || null;
      },
      update: async ({ where, data }) => {
        record('order.update', { where, data });
        const order = state.orders.find((o) => o.id === where.id);
        if (!order) throw Object.assign(new Error('Record not found'), { code: 'P2025' });
        Object.assign(order, data, { updatedAt: new Date() });
        return order;
      }
    },
    payment: {
      update: async ({ where, data }) => {
        record('payment.update', { where, data });
        const payment = state.payments.find((p) => p.id === where.id);
        if (payment) Object.assign(payment, data);
        return payment;
      },
      create: async ({ data }) => {
        record('payment.create', data);
        const created = { id: nextId('payment'), status: 'PENDING', ...data };
        state.payments.push(created);
        return created;
      }
    },
    paymentLog: {
      findUnique: async ({ where }) => {
        record('paymentLog.findUnique', where);
        return state.paymentLogs.find((l) => l.sepayTransactionId === where.sepayTransactionId) || null;
      },
      findFirst: async ({ where }) => {
        record('paymentLog.findFirst', where);
        return state.paymentLogs.find((l) => (!where.orderId || l.orderId === where.orderId) && l.status === where.status) || null;
      },
      create: async ({ data }) => {
        record('paymentLog.create', data);
        const created = { id: nextId('log'), createdAt: new Date(), ...data };
        state.paymentLogs.push(created);
        return created;
      },
      update: async ({ where, data }) => {
        record('paymentLog.update', { where, data });
        const log = state.paymentLogs.find(
          (l) => l.id === where.id || l.sepayTransactionId === where.sepayTransactionId
        );
        if (log) Object.assign(log, data);
        return log;
      },
      upsert: async ({ where, update, create }) => {
        record('paymentLog.upsert', { where, update, create });
        const existing = state.paymentLogs.find((l) => l.sepayTransactionId === where.sepayTransactionId);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const created = { id: nextId('log'), createdAt: new Date(), ...create };
        state.paymentLogs.push(created);
        return created;
      }
    },
    orderStatusHistory: {
      create: async ({ data }) => {
        record('orderStatusHistory.create', data);
        const created = { id: nextId('history'), ...data };
        state.statusHistory.push(created);
        return created;
      }
    },
    card: {
      updateMany: async () => ({ count: 0 })
    },
    appSetting: {
      findMany: async () => []
    }
  };

  return stub;
};

const prismaPath = require.resolve('../src/config/prisma');
const prismaStub = createPrismaStub();
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prismaStub };

// Reset DB state (stub) after all tests & keep tests independent
const resetState = () => {
  prismaStub.__state.orders = [];
  prismaStub.__state.payments = [];
  prismaStub.__state.paymentLogs = [];
  prismaStub.__state.statusHistory = [];
};

const sepayService = require('../src/services/sepay.service');

const seedOrder = ({
  orderCode = 'TCG-20260909-ABCDEF01',
  grandTotal = 20249.99,
  status = 'PENDING',
  paymentStatus = 'PENDING'
} = {}) => {
  const order = {
    id: nextId('order'),
    orderCode,
    userId: nextId('user'),
    status,
    paymentStatus,
    grandTotal,
    paidAt: null,
    items: [],
    payments: []
  };
  const payment = {
    id: nextId('payment'),
    orderId: order.id,
    status: 'PENDING',
    amount: grandTotal
  };
  order.payments.push(payment);
  prismaStub.__state.orders.push(order);
  prismaStub.__state.payments.push(payment);
  return order;
};

// Real SePay PG IPN payload shape (captured from production PaymentLog)
const makeIpnPayload = ({ orderCode, amount = '20249', txnId = '6aa0d045de716' } = {}) => ({
  timestamp: 1788923973,
  notification_type: 'ORDER_PAID',
  order: {
    id: '94a3a78f-abfd-11f1-b21a-a6006ab65aca',
    order_id: 'PAY90376AA0D03FA10DC',
    order_status: 'CAPTURED',
    order_currency: 'VND',
    order_amount: '20249.00',
    order_invoice_number: orderCode,
    custom_data: [],
    order_description: `Thanh toan don hang ${orderCode}`
  },
  transaction: {
    id: '985d3808-abfd-11f1-b21a-a6006ab65aca',
    payment_method: 'BANK_TRANSFER',
    transaction_id: txnId,
    transaction_type: 'PAYMENT',
    transaction_date: '2026-09-09 10:19:33',
    transaction_status: 'APPROVED',
    transaction_amount: amount,
    transaction_currency: 'VND',
    authentication_status: 'AUTHENTICATION_SUCCESSFUL',
    card_number: null,
    card_holder_name: null,
    card_expiry: null,
    card_funding_method: null,
    card_brand: null
  },
  customer: null,
  agreement: null
});

const hmac = (secret, body) =>
  crypto.createHmac('sha256', secret).update(body).digest('hex');

test.before(() => {
  // sepay.service requires env config at load — already set above
});

test('isAmountMatched accepts VND rounding differences of <= 1 VND', () => {
  assert.equal(sepayService.isAmountMatched(20249, 20249.99), true);   // production bug case
  assert.equal(sepayService.isAmountMatched('20249', '20249.99'), true); // string amounts from SePay
  assert.equal(sepayService.isAmountMatched(20250, 20249.99), true);  // rounds up: diff 0.01
  assert.equal(sepayService.isAmountMatched(20248.99, 20249.99), true); // diff exactly 1.0
  assert.equal(sepayService.isAmountMatched(20248, 20249.99), false); // diff 1.99 — more than 1 VND
  assert.equal(sepayService.isAmountMatched(20200, 20249.99), false); // thiếu tiền rõ ràng
  assert.equal(sepayService.isAmountMatched('abc', 20249.99), false);  // non-numeric
  assert.equal(sepayService.isAmountMatched(undefined, 20249.99), false);
});

test('isAmountMatched rejects clearly underpaid amounts', () => {
  assert.equal(sepayService.isAmountMatched(20000, 20249.99), false);
  assert.equal(sepayService.isAmountMatched(20249.5, 20249.99), true);
  assert.equal(sepayService.isAmountMatched(20251, 20249.99), false);
});

test('PAID_TRANSACTION_STATUSES includes CAPTURED (SePay PG order_status)', () => {
  assert.ok(sepayService.PAID_TRANSACTION_STATUSES.includes('CAPTURED'));
  assert.ok(sepayService.PAID_TRANSACTION_STATUSES.includes('APPROVED'));
});

test('processWebhook updates order to PACKAGING when SePay sends integer VND (the production bug)', async () => {
  resetState();
  const order = seedOrder({ orderCode: 'TCG-20260909-AAAA0001', grandTotal: 20249.99 });

  const payload = makeIpnPayload({ orderCode: order.orderCode, amount: '20249', txnId: 'txn-1' });
  const result = await sepayService.processWebhook(payload, JSON.stringify(payload), null, {});

  assert.equal(result.success, true);
  assert.match(result.message, /processed successfully/i);

  // Order must now be PACKAGING / payment COMPLETED
  const updated = prismaStub.__state.orders.find((o) => o.id === order.id);
  assert.equal(updated.status, 'PACKAGING');
  assert.equal(updated.paymentStatus, 'COMPLETED');
  assert.ok(updated.paidAt instanceof Date);

  // Payment record completed too
  const payment = prismaStub.__state.payments.find((p) => p.orderId === order.id);
  assert.equal(payment.status, 'COMPLETED');
});

test('processWebhook still rejects a genuinely underpaid transfer', async () => {
  resetState();
  const order = seedOrder({ orderCode: 'TCG-20260909-AAAA0002', grandTotal: 20249.99 });

  const payload = makeIpnPayload({ orderCode: order.orderCode, amount: '15000', txnId: 'txn-2' });
  const result = await sepayService.processWebhook(payload, JSON.stringify(payload), null, {});

  assert.match(result.message, /Amount mismatch/i);

  const updated = prismaStub.__state.orders.find((o) => o.id === order.id);
  assert.equal(updated.status, 'PENDING');

  const log = prismaStub.__state.paymentLogs.find((l) => l.sepayTransactionId === 'txn-2');
  assert.equal(log.status, 'AMOUNT_MISMATCH');
});

test('processWebhook accepts CAPTURED order_status (SePay PG real shape)', async () => {
  resetState();
  const order = seedOrder({ orderCode: 'TCG-20260909-AAAA0003', grandTotal: 20249.99 });

  const payload = makeIpnPayload({ orderCode: order.orderCode, amount: '20249', txnId: 'txn-3' });
  const result = await sepayService.processWebhook(payload, JSON.stringify(payload), null, {});

  assert.match(result.message, /processed successfully/i);
  assert.equal(prismaStub.__state.orders.find((o) => o.id === order.id).status, 'PACKAGING');
});

test('processWebhook reprocesses a retried webhook whose first attempt logged MISMATCH (stuck-order recovery)', async () => {
  resetState();
  const order = seedOrder({ orderCode: 'TCG-20260909-AAAA0004', grandTotal: 20249.99 });

  // First attempt: amount mismatch was logged (old bug, or stale amount)
  const payload = makeIpnPayload({ orderCode: order.orderCode, amount: '15000', txnId: 'txn-4' });
  await sepayService.processWebhook(payload, JSON.stringify(payload), null, {});
  assert.equal(prismaStub.__state.orders.find((o) => o.id === order.id).status, 'PENDING');

  // SePay retries the SAME transaction id — now with the corrected amount
  const retryPayload = makeIpnPayload({ orderCode: order.orderCode, amount: '20249', txnId: 'txn-4' });
  const result = await sepayService.processWebhook(retryPayload, JSON.stringify(retryPayload), null, {});

  assert.match(result.message, /processed successfully/i);
  const updated = prismaStub.__state.orders.find((o) => o.id === order.id);
  assert.equal(updated.status, 'PACKAGING');

  // The MISMATCH log entry must be updated to COMPLETED, not duplicated
  const logs = prismaStub.__state.paymentLogs.filter((l) => l.sepayTransactionId === 'txn-4');
  assert.equal(logs.length, 1);
  assert.equal(logs[0].status, 'COMPLETED');
});

test('processWebhook is idempotent for a duplicate COMPLETED webhook', async () => {
  resetState();
  const order = seedOrder({ orderCode: 'TCG-20260909-AAAA0005', grandTotal: 20249.99 });

  const payload = makeIpnPayload({ orderCode: order.orderCode, amount: '20249', txnId: 'txn-5' });
  await sepayService.processWebhook(payload, JSON.stringify(payload), null, {});
  assert.equal(prismaStub.__state.orders.find((o) => o.id === order.id).status, 'PACKAGING');

  // Duplicate arrives — must ack without error and without re-marking
  const result = await sepayService.processWebhook(payload, JSON.stringify(payload), null, {});
  assert.match(result.message, /Duplicate/i);

  const histories = prismaStub.__state.statusHistory.filter((h) => h.orderId === order.id);
  assert.equal(histories.filter((h) => h.newStatus === 'PACKAGING').length, 1);
});

test('verifyWebhookSignature accepts HMAC computed with SEPAY_WEBHOOK_SECRET over exact raw body', () => {
  const rawBody = '{"transaction":{"transaction_amount":20249}}';
  const sig = hmac('whsec_test_secret', rawBody);
  assert.equal(sepayService.verifyWebhookSignature(rawBody, `sha256=${sig}`), true);
  assert.equal(sepayService.verifyWebhookSignature(rawBody, sig), true);
});

test('verifyWebhookSignature accepts HMAC computed with SEPAY_MERCHANT_SECRET_KEY (secret rotation fallback)', () => {
  const rawBody = '{"transaction":{"transaction_amount":20249}}';
  const sig = hmac('spk_test_secret', rawBody);
  assert.equal(sepayService.verifyWebhookSignature(rawBody, `sha256=${sig}`), true);
});

test('verifyWebhookSignature rejects a tampered body or wrong signature', () => {
  const rawBody = '{"transaction":{"transaction_amount":20249}}';
  const sig = hmac('whsec_test_secret', rawBody);
  assert.equal(sepayService.verifyWebhookSignature('{"tampered":true}', `sha256=${sig}`), false);
  assert.equal(sepayService.verifyWebhookSignature(rawBody, 'sha256=deadbeef'), false);
  assert.equal(sepayService.verifyWebhookSignature(rawBody, null), false);
});

test('processWebhook rejects an INVALID signature (security)', async () => {
  resetState();
  const order = seedOrder({ orderCode: 'TCG-20260909-AAAA0006', grandTotal: 20249.99 });

  const payload = makeIpnPayload({ orderCode: order.orderCode, amount: '20249', txnId: 'txn-6' });
  const result = await sepayService.processWebhook(
    payload,
    JSON.stringify(payload),
    'sha256=' + hmac('attacker-secret', JSON.stringify(payload)),
    {}
  );

  assert.match(result.message, /Signature mismatch/i);
  assert.equal(prismaStub.__state.orders.find((o) => o.id === order.id).status, 'PENDING');
});

test('processWebhook processes a correctly-signed IPN end-to-end (raw body integrity)', async () => {
  resetState();
  const order = seedOrder({ orderCode: 'TCG-20260909-AAAA0007', grandTotal: 20249.99 });

  const rawBody = JSON.stringify(makeIpnPayload({ orderCode: order.orderCode, amount: '20249', txnId: 'txn-7' }));
  const signature = `sha256=${hmac('whsec_test_secret', rawBody)}`;
  // Signature over the EXACT raw string — the raw-body capture path must
  // deliver these exact bytes, else this test would fail with mismatch.
  const payload = JSON.parse(rawBody);

  const result = await sepayService.processWebhook(payload, rawBody, signature, {});
  assert.match(result.message, /processed successfully/i);
  assert.equal(prismaStub.__state.orders.find((o) => o.id === order.id).status, 'PACKAGING');
});

test('processWebhook handles flat bank-transfer webhooks (traditional SePay shape)', async () => {
  resetState();
  const order = seedOrder({ orderCode: 'TCG-20260909-AAAA0008', grandTotal: 20249.99 });

  const payload = {
    id: 12345,
    gateway: 'ACB',
    transaction_date: '2026-09-09 10:19:33',
    account_number: '12345678',
    amount: 20249, // integer VND — the production case
    transaction_content: `Chuyen tien thanh toan don hang ${order.orderCode}`,
    reference_number: 'FT260909123'
  };
  const rawBody = JSON.stringify(payload);
  const result = await sepayService.processWebhook(payload, rawBody, null, {});

  assert.match(result.message, /processed successfully/i);
  assert.equal(prismaStub.__state.orders.find((o) => o.id === order.id).status, 'PACKAGING');
});

test('extractOrderCode finds TCG codes in nested and flat payloads', () => {
  assert.equal(
    sepayService.extractOrderCode({ order: { order_invoice_number: 'TCG-20260909-ABCDEF12' } } ),
    'TCG-20260909-ABCDEF12'
  );
  assert.equal(
    sepayService.extractOrderCode({ transaction_content: 'chuyen tien TCG-20260908-12345678 nhe' }),
    'TCG-20260908-12345678'
  );
  assert.equal(sepayService.extractOrderCode({ foo: { bar: 'nothing here' } }), null);
});
