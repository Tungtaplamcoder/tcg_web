const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhook.controller');
const { webhookLimiter } = require('../middlewares/rateLimiters');

// Dùng express.json() để parse body tự động
router.post(
  '/sepay',
  webhookLimiter,
  express.json({ limit: '1mb' }),
  webhookController.handleSepayWebhook
);

module.exports = router;