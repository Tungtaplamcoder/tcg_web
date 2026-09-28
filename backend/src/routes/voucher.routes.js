const express = require('express');
const router = express.Router();
const voucherController = require('../controllers/voucher.controller');
const validate = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth');
const { apiLimiter } = require('../middlewares/rateLimiters');
const { claimVoucherSchema, validateVoucherSchema } = require('../schemas/voucher.schema');

// ==================== AUTHENTICATED ROUTES ====================
router.use(authenticate);

router.get('/wallet', apiLimiter, voucherController.getWallet);
router.post('/claim', apiLimiter, validate(claimVoucherSchema), voucherController.claim);
router.post('/validate', apiLimiter, validate(validateVoucherSchema), voucherController.validateVoucher);

module.exports = router;
