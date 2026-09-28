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
    // Ưu tiên req.rawBody — Buffer byte-gốc do express.json({ verify }) gắn vào
    // TRƯỚC khi parse (src/app.js). Chữ ký HMAC phải được tính trên đúng byte
    // gốc — dựng lại từ JSON.parse/stringify sẽ cho hash khác.
    // Fallback: req.body là Buffer (express.raw chạy) hoặc object đã parse.
    let payload = req.body || {};
    let rawBody;

    if (Buffer.isBuffer(req.rawBody)) {
      rawBody = req.rawBody.toString('utf8');
      try {
        payload = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        payload = {};
      }
    } else if (Buffer.isBuffer(req.body)) {
      rawBody = req.body.toString('utf8');
      try {
        payload = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        payload = {};
      }
    } else {
      rawBody = JSON.stringify(payload);
    }

    // SePay gửi chữ ký qua nhiều tên header — nhận tất cả để tương thích
    const signature = req.headers['x-sepay-signature']
      || req.headers['sepay-signature']
      || req.headers['x-signature']
      || req.headers['signature'];

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

// DEPRECATED middleware — giữ lại để tương thích ngược. Raw body giờ được gắn
// bởi express.json({ verify }) ở src/app.js (req.rawBody). Middleware này
// KHÔNG chạy nữa vì app-level parser đã set req._body = true (body-parser bỏ
// qua request đã parse) — nhưng nếu app-level bị bỏ, nó vẫn capture đúng.
const verifyRawBody = express.raw({ type: () => true, limit: '1mb' });

module.exports = {
  getSepayWebhookConfig,
  handleSepayWebhook,
  verifyRawBody
};
