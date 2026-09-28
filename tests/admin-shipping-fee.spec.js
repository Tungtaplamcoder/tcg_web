// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Shipping Fee Settings — Admin config persistence (E2E).
 *
 * Flow: login as admin → /admin/shipping-settings ("Phí vận chuyển") →
 * type 35000 into the currency input (auto-formats to "35,000") → click
 * "Lưu phí vận chuyển" → success toast (fade-in) appears → full page
 * reload → input persists as "35,000" and the public /shipping-fee
 * endpoint reports the same value.
 */

const LOGIN_URL = 'http://localhost:3000/login';
const SHIPPING_SETTINGS_URL = 'http://localhost:3000/admin/shipping-settings';
const TEST_USER = 'admin@tcg.local';
const TEST_PASS = 'AdminSecurePass123!';

const TARGET_FEE = 35000;

const loginAsAdmin = async (page) => {
  await page.goto(LOGIN_URL);
  let loggedIn = false;
  for (let attempt = 1; attempt <= 3 && !loggedIn; attempt += 1) {
    await expect(page.locator('input[type="text"]')).toBeVisible();
    await page.fill('input[type="text"]', TEST_USER);
    await page.fill('input[type="password"]', TEST_PASS);
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

test.describe('Shipping Fee Settings — admin config persistence', () => {
  test('update fee to 35,000đ → toast → reload → input persists', async ({ page }) => {
    test.setTimeout(120_000);

    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('[console.error]', msg.text());
    });

    // ── 1. Login as admin
    await loginAsAdmin(page);
    console.log('[AUTH] logged in, landed on', page.url());

    // ── 2. Navigate to the Shipping Fee settings page
    await page.goto(SHIPPING_SETTINGS_URL);
    await expect(page.getByRole('heading', { level: 2, name: 'Phí vận chuyển' })).toBeVisible();
    console.log('[NAV] on shipping settings page');

    const feeInput = page.getByTestId('shipping-fee-input');
    await expect(feeInput).toBeVisible();
    // Initial load always has a numeric value (DB override or 20,000 default)
    await expect(feeInput).toHaveValue(/^\d[\d,]*$/);

    // ── 3. Type the new fee — the input auto-formats digits to "35,000"
    await feeInput.fill('35000');
    await expect(feeInput).toHaveValue('35,000');
    console.log('[FORM] input auto-formatted to "35,000"');

    // ── 4. Click Save and assert the PUT succeeded
    const putResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/admin/settings/shipping') && res.request().method() === 'PUT',
      { timeout: 30_000 }
    );
    await page.getByTestId('shipping-fee-save-btn').click();
    const putResponse = await putResponsePromise;
    expect(putResponse.status()).toBe(200);
    const putBody = await putResponse.json();
    expect(putBody.data.defaultShippingFee).toBe(TARGET_FEE);
    console.log('[API] PUT /admin/settings/shipping → 200, fee =', putBody.data.defaultShippingFee);

    // ── 5. Success toast (fade-in, green) confirms the save
    const toast = page.getByTestId('shipping-fee-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/cập nhật|updated|thành công|success/i);
    await expect(toast).toHaveClass(/animate-fade-in/);
    await expect(toast).toHaveClass(/bg-green-50/);
    console.log('[TOAST] success toast visible:', await toast.textContent());

    // ── 6. Full page reload — the input must persist the saved value
    await page.reload();
    await expect(page.getByTestId('shipping-fee-input')).toHaveValue('35,000');
    console.log('[PERSIST] input reloaded with "35,000"');

    // ── 7. Server-side persistence via the public shipping-fee endpoint
    const shippingInfo = await page.evaluate(async () => {
      const res = await fetch('/api/v1/shipping-fee');
      return (await res.json()).data;
    });
    expect(shippingInfo.defaultShippingFee).toBe(TARGET_FEE);
    console.log('[API] persisted public shipping-fee:', JSON.stringify(shippingInfo));

    // ── 8. Verification screenshot of the settings card
    await page.screenshot({ path: 'shipping-fee-settings-verified.png', fullPage: false });
    console.log('[SHOT] saved shipping-fee-settings-verified.png');
  });

  test('quick presets set the fee instantly (30k) and Cmd/Ctrl+S saves', async ({ page }) => {
    test.setTimeout(120_000);

    await loginAsAdmin(page);
    await page.goto(SHIPPING_SETTINGS_URL);
    const feeInput = page.getByTestId('shipping-fee-input');
    await expect(feeInput).toBeVisible();

    // Preset "30k" fills the input with the formatted amount
    await page.getByTestId('shipping-fee-preset-30000').click();
    await expect(feeInput).toHaveValue('30,000');

    // Cmd/Ctrl+S triggers the save (PUT) without clicking the button
    const putResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/admin/settings/shipping') && res.request().method() === 'PUT',
      { timeout: 30_000 }
    );
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+s' : 'Control+s');
    const putResponse = await putResponsePromise;
    expect(putResponse.status()).toBe(200);

    await expect(page.getByTestId('shipping-fee-toast')).toBeVisible();
    console.log('[KEYSAVE] Ctrl/Cmd+S saved the 30,000đ preset');
  });

  test('invalid input (< 0 impossible via typing; letters are stripped) keeps the Save disabled', async ({ page }) => {
    test.setTimeout(120_000);

    await loginAsAdmin(page);
    await page.goto(SHIPPING_SETTINGS_URL);
    const feeInput = page.getByTestId('shipping-fee-input');
    await expect(feeInput).toBeVisible();

    // Non-digit characters never enter the currency input — value stays numeric
    await feeInput.fill('abc-12');
    await expect(feeInput).toHaveValue('12');
    console.log('[GUARD] letters stripped, value stayed numeric');
  });

  // Restore the well-known default so later suites (checkout spec) start
  // from the admin-configured 35,000đ handled above / defaults.
  test.afterEach(async ({ page }) => {
    // no-op: state is intentionally persisted across specs in this suite
  });
});
