const express = require('express');
const { SePayPgClient } = require('sepay-pg-node');

const app = express();
app.use(express.urlencoded({ extended: true }));

// Khởi tạo SePay client
const client = new SePayPgClient({
  env: 'sandbox',
  merchant_id: 'SP-TEST-LK2B88BA',
  secret_key: 'spsk_test_9BMx25GEgQLDWqSo2f85vehZMjXpRGUq'
});

// Trang chủ hiển thị nút Pay now
app.get('/', (req, res) => {
  const checkoutURL = client.checkout.initCheckoutUrl();
  const checkoutFormfields = client.checkout.initOneTimePaymentFields({
    operation: 'PURCHASE',
    payment_method: 'BANK_TRANSFER',
    order_invoice_number: 'TEST_' + Date.now(), // unique order invoice
    order_amount: 10000, // 10,000 VND
    currency: 'VND',
    order_description: 'Thanh toan don hang test',
    success_url: 'http://localhost:3001/success',
    error_url: 'http://localhost:3001/error',
    cancel_url: 'http://localhost:3001/cancel'
  });

  // Tạo form HTML
  let formHtml = `<form action="${checkoutURL}" method="POST">`;
  for (const [key, value] of Object.entries(checkoutFormfields)) {
    formHtml += `<input type="hidden" name="${key}" value="${value}" />`;
  }
  formHtml += '<button type="submit">Pay now</button></form>';

  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>SePay Test</title></head>
    <body>
      <h1>SePay Payment Test</h1>
      ${formHtml}
    </body>
    </html>
  `);
});

// Trang nhận redirect sau thanh toán
app.get('/success', (req, res) => {
  res.send('<h1 style="color:green">✅ Payment Success</h1>');
});

app.get('/error', (req, res) => {
  res.send('<h1 style="color:red">❌ Payment Error</h1>');
});

app.get('/cancel', (req, res) => {
  res.send('<h1 style="color:orange">⚠️ Payment Cancelled</h1>');
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Test server running at http://localhost:${PORT}`);
});