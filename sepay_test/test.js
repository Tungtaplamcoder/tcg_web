const { SePayPgClient } = require('sepay-pg-node');

const client = new SePayPgClient({
  env: 'sandbox',
  merchant_id: 'SP-TEST-LK2B88BA',
  secret_key: 'spsk_test_9BMx25GEgQLDWqSo2f85vehZMjXpRGUq'
});

try {
  const checkoutURL = client.checkout.initCheckoutUrl();
  console.log('Checkout URL:', checkoutURL);

  const checkoutFormfields = client.checkout.initOneTimePaymentFields({
    operation: 'PURCHASE',
    payment_method: 'BANK_TRANSFER',
    order_invoice_number: 'TEST123',
    order_amount: 10000,
    currency: 'VND',
    order_description: 'Thanh toan don hang TEST123',
    success_url: 'http://localhost:5173/payment/success',
    error_url: 'http://localhost:5173/payment/error',
    cancel_url: 'http://localhost:5173/payment/cancel'
  });

  console.log('Form fields:', checkoutFormfields);

  console.log('\nHTML form:\n');
  console.log(`<form action="${checkoutURL}" method="POST">`);
  for (const [key, value] of Object.entries(checkoutFormfields)) {
    console.log(`  <input type="hidden" name="${key}" value="${value}" />`);
  }
  console.log('  <button type="submit">Pay now</button>');
  console.log('</form>');
} catch (error) {
  console.error('Error:', error.message);
}