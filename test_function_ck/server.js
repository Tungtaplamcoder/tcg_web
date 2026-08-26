import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PayOS } from '@payos/node';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Configuration from environment
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Khởi tạo PayOS SDK v2.x
const payos = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID,
  apiKey: process.env.PAYOS_API_KEY,
  checksumKey: process.env.PAYOS_CHECKSUM_KEY,
});

// CSDL tạm thời trên RAM để lưu trạng thái đơn
const dbOrders = {};

// 1. POST /api/payment/create - Tạo đơn hàng & mã VietQR
app.post('/api/payment/create', async (req, res) => {
  try {
    const orderCode = Number(String(Date.now()).slice(-6));
    const amount = req.body.amount || 2000;
    const description = req.body.description || `DH${orderCode}`;

    const paymentData = {
      orderCode,
      amount,
      description,
      cancelUrl: req.body.cancelUrl || `${FRONTEND_URL}/cancel`,
      returnUrl: req.body.returnUrl || `${FRONTEND_URL}/success`,
    };

    // Gọi API v2 tạo link thanh toán
    const paymentLink = await payos.paymentRequests.create(paymentData);

    // Bọc chuỗi EMVCo thô (paymentLink.qrCode) thành URL hiển thị ảnh QR
    const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
      paymentLink.qrCode
    )}`;

    dbOrders[orderCode] = {
      orderCode,
      amount,
      status: 'PENDING',
      paymentLinkId: paymentLink.paymentLinkId,
    };

    return res.json({
      success: true,
      data: {
        orderCode,
        checkoutUrl: paymentLink.checkoutUrl,
        qrCodeUrl: qrCodeImageUrl,
      },
    });
  } catch (error) {
    console.error('[CREATE ERROR]:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 2. POST /api/payos-webhook - Nhận tín hiệu chuyển khoản từ payOS
app.post('/api/payos-webhook', async (req, res) => {
  try {
    const verifiedData = await payos.webhooks.verify(req.body);

    if (verifiedData) {
      const orderCode = verifiedData.orderCode;
      console.log(`\n========================================`);
      console.log(`[PAYOS WEBHOOK] NHẬN TIỀN THÀNH CÔNG!`);
      console.log(`- Mã đơn: ${orderCode}`);
      console.log(`- Số tiền: ${verifiedData.amount} VNĐ`);
      console.log(`- Mã GD Ngân hàng: ${verifiedData.reference}`);
      console.log(`========================================\n`);

      if (dbOrders[orderCode]) {
        dbOrders[orderCode].status = 'PAID';
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[WEBHOOK VERIFY WARNING]:', error.message);
    return res.status(200).json({ success: false, warning: error.message });
  }
});

app.get('/api/payos-webhook', (req, res) => {
  res.send('Webhook Endpoint sẵn sàng nhận tín hiệu POST.');
});

// 3. GET /api/payment/:orderCode - Kiểm tra trạng thái thanh toán (Polling)
app.get('/api/payment/:orderCode', async (req, res) => {
  try {
    const { orderCode } = req.params;
    const payosInfo = await payos.paymentRequests.get(orderCode);

    if (payosInfo && payosInfo.status === 'PAID' && dbOrders[orderCode]) {
      dbOrders[orderCode].status = 'PAID';
    }

    return res.json({
      success: true,
      localStatus: dbOrders[orderCode]?.status || payosInfo?.status || 'NOT_FOUND',
      payosInfo,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 4. POST /api/payment/:orderCode/cancel - Hủy link thanh toán
app.post('/api/payment/:orderCode/cancel', async (req, res) => {
  try {
    const { orderCode } = req.params;
    const reason = req.body.cancellationReason || 'Khách hủy đơn';
    const result = await payos.paymentRequests.cancel(orderCode, reason);

    if (dbOrders[orderCode]) dbOrders[orderCode].status = 'CANCELLED';

    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});