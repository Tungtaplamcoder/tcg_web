const sepayService = require('../services/sepay.service');

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
    console.error('Webhook handler error:', error);
    res.status(200).json({
      success: true,
      data: { success: false, message: 'Webhook processing error' },
      message: 'Webhook acknowledged'
    });
  }
};

module.exports = {
  handleSepayWebhook
};