const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');
const { apiLimiter, lookupLimiter } = require('../middlewares/rateLimiters');
const {
  checkoutSchema,
  orderQuerySchema,
  idParamSchema
} = require('../schemas/order.schema');

// ==================== PUBLIC ROUTE: Order Lookup (no auth) ====================
router.post('/lookup', lookupLimiter, orderController.lookupOrder);

// ==================== AUTHENTICATED ROUTES ====================
router.use(authenticate);

router.post('/checkout', apiLimiter, validate(checkoutSchema), orderController.checkout);
router.get('/', apiLimiter, validate(orderQuerySchema, 'query'), orderController.listOrders);
router.get('/:id', apiLimiter, validate(idParamSchema, 'params'), orderController.getOrder);
router.post('/:id/cancel', apiLimiter, validate(idParamSchema, 'params'), orderController.cancelOrder);
// Tái tạo phiên thanh toán SePay cho đơn PENDING — trả về signed form fields
// để frontend auto-submit POST sang SePay (GET link trực tiếp gây 404).
router.post('/:id/repay', apiLimiter, validate(idParamSchema, 'params'), orderController.regeneratePayment);
router.post('/:id/pay', apiLimiter, validate(idParamSchema, 'params'), orderController.regeneratePayment);
router.get('/:id/payment-status', apiLimiter, validate(idParamSchema, 'params'), orderController.getPaymentStatus);
router.post('/:id/sync-payment', apiLimiter, validate(idParamSchema, 'params'), orderController.syncOrderPayment);

module.exports = router;