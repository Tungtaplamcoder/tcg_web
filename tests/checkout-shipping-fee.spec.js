// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Shipping Fee — dynamic checkout binding (E2E).
 *
 * Preconditions: run tests/admin-shipping-fee.spec.js first so the fee is
 * persisted to 35,000đ (the suite also works with any stored value — it
 * reads the live /shipping-fee endpoint and asserts Checkout matches it).
 *
 * Flow: login as customer → open a product with stock → select the first
 * available condition variant → "Thêm vào giỏ" → navigate to /cart →
 * proceed to /checkout → the Order Summary must show the dynamically
 * configured shipping fee (35.000 ₫ when formatted vi-VN) and the grand
 * total must equal products + shipping fee.
 */

const LOGIN_URL = 'http://localhost:3000/login';
const TEST_CUSTOMER = 'customer@tcg.com';
const TEST_CUSTOMER_PASS = 'Customer@123';

const formatVndVi = (amount) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })
    .format(Number(amount) || 0);

const loginAs = async (page, identifier, password) => {
  await page.goto(LOGIN_URL);
  let loggedIn = false;
  for (let attempt = 1; attempt <= 3 && !loggedIn; attempt += 1) {
    await expect(page.locator('input[type="text"]')).toBeVisible();
    await page.fill('input[type="text"]', identifier);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    try {
      await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });
      loggedIn = true;
    } catch {
      if (attempt === 3) throw new Error('Login never redirected after 3 attempts');
      await page.goto(LOGIN_URL);
    }
  }
};

test.describe('Shipping Fee — dynamic checkout binding', () => {
  test('add item to cart → checkout shows dynamic shipping fee in grand total', async ({ page }) => {
    test.setTimeout(180_000);

    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('[console.error]', msg.text());
    });

    // ── 0. Read the live configured fee first (set by the admin spec)
    const feeResponse = await page.request.get('http://localhost:3000/api/v1/shipping-fee');
    expect(feeResponse.ok()).toBe(true);
    const feeData = (await feeResponse.json()).data;
    const shippingFee = Number(feeData.defaultShippingFee);
    expect(Number.isInteger(shippingFee)).toBe(true);
    expect(shippingFee).toBeGreaterThan(0);
    console.log('[FEE] live configured shipping fee:', shippingFee, 'VND');

    // ── 1. Login as customer (fresh cart context)
    await loginAs(page, TEST_CUSTOMER, TEST_CUSTOMER_PASS);
    console.log('[AUTH] logged in, landed on', page.url());

    // Clean slate: make sure the cart does not leak from previous runs
    await page.evaluate(() => localStorage.removeItem('tcg_cart'));

    // ── 2. Find an in-stock product via the public API
    //    (public list API omits variant.status — stockQuantity is the signal)
    const productsResponse = await page.request.get('http://localhost:3000/api/v1/products?limit=50');
    const products = (await productsResponse.json()).data.items;
    const product = products.find((p) =>
      (p.variants || []).some((v) => Number(v.stockQuantity) > 0)
    );
    expect(product, 'Need at least one product with stock').toBeTruthy();
    const variant = product.variants.find((v) => Number(v.stockQuantity) > 0);
    const unitPrice = Number(variant.price);
    console.log(`[PICK] product "${product.name}" variant ${variant.condition} @ ${unitPrice}`);

    // ── 3. Product detail → select the in-stock variant → add to cart
    await page.goto(`http://localhost:3000/product/${product.id}`);
    await expect(page.getByRole('heading', { level: 1, name: product.name })).toBeVisible();

    // Click the variant chip that matches the in-stock variant's condition
    const variantButton = page.locator('button', { hasText: new RegExp(variant.condition.replace(/_/g, ' '), 'i') })
      .filter({ has: page.locator('span', { hasText: /sẵn có|available/i }) })
      .first();
    await variantButton.click();

    await page.getByRole('button', { name: /Thêm vào giỏ|Add to cart/i }).click();
    await expect(page.getByRole('button', { name: /Đã thêm|Added/i })).toBeVisible({ timeout: 15_000 });
    console.log('[CART] item added to cart');

    // ── 4. Navigate to Checkout (via cart summary shortcut)
    await page.goto('http://localhost:3000/cart');
    await expect(page.getByText('Tóm tắt đơn hàng')).toBeVisible();
    await page.goto('http://localhost:3000/checkout');
    await expect(page.getByRole('heading', { level: 1, name: 'Thanh toán' })).toBeVisible();

    // ── 5. Order Summary must reflect the DYNAMIC shipping fee
    const shippingFeeCell = page.getByTestId('checkout-shipping-fee');
    await expect(shippingFeeCell).toBeVisible();
    await expect(shippingFeeCell).toHaveText(formatVndVi(shippingFee));
    console.log('[SUMMARY] shipping fee cell shows:', await shippingFeeCell.textContent());

    // ── 6. grandTotal = unitPrice + shippingFee (no voucher applied)
    const expectedGrandTotal = unitPrice + shippingFee;
    const grandTotalCell = page.getByTestId('checkout-grand-total');
    await expect(grandTotalCell).toBeVisible();
    await expect(grandTotalCell).toHaveText(formatVndVi(expectedGrandTotal));
    console.log(`[SUMMARY] grand total shows ${expectedGrandTotal} = ${unitPrice} + ${shippingFee}`);

    // ── 7. Fill the shipping form to prove the backend accepts the order
    //      at the same dynamic fee (server-side snapshot check).
    await page.fill('input[name="fullName"]', 'E2E Shipping Test');
    await page.fill('input[name="phone"]', '0987654321');

    const provinceSelect = page.locator('select').first();
    await provinceSelect.selectOption({ label: 'Thành phố Hà Nội' });
    const wardSelect = page.locator('select').nth(1);
    await wardSelect.selectOption({ index: 1 });

    await page.fill('input[name="addressLine1"]', '123 E2E Test Street');

    const orderResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/v1/orders/checkout') && res.request().method() === 'POST' && res.status() === 201,
      { timeout: 30_000 }
    ).catch(() => null);

    await page.getByRole('button', { name: /Đặt hàng & Thanh toán|Place Order/i }).click();

    const orderResponse = await orderResponsePromise;
    expect(orderResponse, 'Order creation POST /orders must complete').toBeTruthy();
    expect(orderResponse.status()).toBe(201);

    const orderBody = await orderResponse.json();
    expect(Number(orderBody.data.order.shippingFee)).toBe(shippingFee);
    expect(Number(orderBody.data.order.grandTotal)).toBe(expectedGrandTotal);
    console.log('[ORDER] backend snapshot — shippingFee:', orderBody.data.order.shippingFee,
      'grandTotal:', orderBody.data.order.grandTotal);

    // ── 8. Screenshot of the checkout summary with the dynamic fee
    await page.screenshot({ path: 'checkout-shipping-fee-verified.png', fullPage: false });
    console.log('[SHOT] saved checkout-shipping-fee-verified.png');
  });
});
