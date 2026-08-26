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
router.post('/:id/pay', apiLimiter, validate(idParamSchema, 'params'), orderController.regeneratePayment);
router.get('/:id/payment-status', apiLimiter, validate(idParamSchema, 'params'), orderController.getPaymentStatus);

module.exports = router;