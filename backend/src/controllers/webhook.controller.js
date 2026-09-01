const express = require('express');
const sepayService = require('../services/sepay.service');

// GET /api/v1/webhooks/sepay — trả về URL webhook/IPN hiện tại để cấu hình SePay dashboard
const getSepayWebhookConfig = async (req, res, next) => {
  try {
    const webhookUrl = await sepayService.resolveWebhookUrl(req);
    res.status(200).json({
      success: true,
      data: {
        webhookUrl,
        webhookPath: '/api/v1/webhooks/sepay',
        source: process.env.SEPAY_WEBHOOK_URL
          ? 'SEPAY_WEBHOOK_URL'
          : (process.env.NEXT_PUBLIC_API_URL || process.env.APP_BASE_URL)
            ? 'API_URL'
            : (process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_URL)
              ? 'APP_URL'
              : 'REQUEST_HOST'
      },
      message: 'SePay webhook configuration'
    });
  } catch (error) {
    next(error);
  }
};

const handleSepayWebhook = async (req, res, next) => {
  try {
    // verifyRawBody (express.raw) gắn Buffer gốc vào req.body — parse JSON
    // thủ công từ buffer đó; fallback cho trường hợp middleware không chạy.
    let payload = req.body || {};
    let rawBody;
    if (Buffer.isBuffer(req.body)) {
      rawBody = req.body.toString('utf8');
      try {
        payload = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        payload = {};
      }
    } else if (Buffer.isBuffer(req.rawBody)) {
      rawBody = req.rawBody.toString('utf8');
    } else {
      rawBody = JSON.stringify(payload);
    }

    const signature = req.headers['x-sepay-signature'] || req.headers['sepay-signature'];

    const result = await sepayService.processWebhook(payload, rawBody, signature, req.headers);

    res.status(200).json({
      success: true,
      data: result,
      message: 'Webhook received'
    });
  } catch (error) {
    // Webhook KHÔNG BAO GIỜ trả lỗi 5xx cho SePay: lỗi nội bộ phải được nuốt
    // và acknowledge 200 để SePay không retry vô hạn, nhưng vẫn log rõ ràng.
    console.error('Webhook handler error:', error);
    res.status(200).json({
      success: true,
      data: { success: false, message: 'Webhook processing error' },
      message: 'Webhook acknowledged'
    });
  }
};

// Middleware gắn raw body vào req.rawBody TRƯỚC khi express.json() parse,
// dùng cho verify chữ ký HMAC của SePay.
const verifyRawBody = express.raw({ type: 'application/json', limit: '1mb' });

module.exports = {
  getSepayWebhookConfig,
  handleSepayWebhook,
  verifyRawBody
};
