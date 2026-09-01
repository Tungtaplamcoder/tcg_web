const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhook.controller');
const { webhookLimiter } = require('../middlewares/rateLimiters');

// GET /sepay — discovery endpoint: trả về webhook/IPN URL đang cấu hình
// (SEPAY_WEBHOOK_URL > APP_BASE_URL + path > FRONTEND_URL + path > relative path)
router.get('/sepay', webhookController.getSepayWebhookConfig);

// Dùng express.raw() để giữ nguyên raw body (verify chữ ký HMAC-SHA256),
// controller tự parse JSON từ raw body.
router.post(
  '/sepay',
  webhookLimiter,
  webhookController.verifyRawBody,
  webhookController.handleSepayWebhook
);

module.exports = router;
