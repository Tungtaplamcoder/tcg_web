const sepayService = require('../services/sepay.service');

// GET /api/v1/webhooks/sepay — trả về URL webhook/IPN hiện tại để cấu hình SePay dashboard
const getSepayWebhookConfig = async (req, res, next) => {
  try {
    const webhookUrl = await sepayService.resolveWebhookUrl();
    res.status(200).json({
      success: true,
      data: {
        webhookUrl,
        webhookPath: '/api/v1/webhooks/sepay',
        source: process.env.SEPAY_WEBHOOK_URL
          ? 'SEPAY_WEBHOOK_URL'
          : process.env.APP_BASE_URL
            ? 'APP_BASE_URL'
            : 'FALLBACK'
      },
      message: 'SePay webhook configuration'
    });
  } catch (error) {
    next(error);
  }
};

const handleSepayWebhook = async (req, res, next) => {
  try {
    const payload = req.body || {};
    const signature = req.headers['x-sepay-signature'] || req.headers['authorization'];
    // rawBody để verify chữ ký sau này; hiện tại chưa dùng
    const rawBody = JSON.stringify(payload);

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

module.exports = {
  getSepayWebhookConfig,
  handleSepayWebhook
};
