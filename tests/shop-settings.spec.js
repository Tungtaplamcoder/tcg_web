// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Shop Settings — persistence + global dynamic binding (E2E, verified).
 *
 * Flow: login as admin → /admin/shop-settings ("Cấu hình cửa hàng") →
 * change "Tên cửa hàng" to "TCGStore Pro Test" and "Email hỗ trợ" to
 * "test-support@tcgstore.com" → "Lưu cấu hình" → success toast appears →
 * storefront home (/) → footer shows the updated shop name + email →
 * verification screenshot.
 *
 * Also verifies the ShopContext global sync: Navbar + Footer read the
 * same shared state, so the save from the admin panel is instantly
 * visible on the storefront without a full page reload of the app shell.
 */

const LOGIN_URL = 'http://localhost:3000/login';
const SHOP_SETTINGS_URL = 'http://localhost:3000/admin/shop-settings';
const HOME_URL = 'http://localhost:3000/';
const TEST_USER = 'admin@tcg.local';
const TEST_PASS = 'AdminSecurePass123!';

const NEW_SHOP_NAME = 'TCGStore Pro Test';
const NEW_SUPPORT_EMAIL = 'test-support@tcgstore.com';

test.describe('Shop Settings — persistence + global dynamic binding', () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  test('save settings → toast → footer reflects updates on storefront', async ({ page }) => {
    test.setTimeout(120_000);

    // ── Diagnostics: surface PUT payload + console errors when debugging
    page.on('response', async (response) => {
      if (response.url().includes('/admin/settings/shop')) {
        console.log(`[API] ${response.request().method()} /admin/settings/shop → ${response.status()}`);
      }
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('[console.error]', msg.text());
    });

    // ── 1. Login as admin (retry — auth limiter allows 10 logins / 15 min)
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
        console.log(`[AUTH] login attempt ${attempt} failed — retrying`);
        await page.goto(LOGIN_URL);
      }
    }
    console.log('[AUTH] logged in, landed on', page.url());

    // ── 2. Navigate to /admin/shop-settings ("Cấu hình cửa hàng")
    await page.goto(SHOP_SETTINGS_URL);
    // The settings page card title (h2) — the layout header (h1) shares the same text
    await expect(page.getByRole('heading', { level: 2, name: 'Cấu hình cửa hàng' })).toBeVisible();
    console.log('[NAV] on shop settings page');

    // ── 3. Modify "Tên cửa hàng" and "Email hỗ trợ"
    //    Locators are scoped to the settings form (sidebar shares text).
    const shopNameInput = page.locator('form input[name="shop_name"]');
    const supportEmailInput = page.locator('form input[name="support_email"]');
    await expect(shopNameInput).toBeVisible();
    await shopNameInput.fill(NEW_SHOP_NAME);
    await supportEmailInput.fill(NEW_SUPPORT_EMAIL);
    console.log(`[FORM] set shop_name="${NEW_SHOP_NAME}", support_email="${NEW_SUPPORT_EMAIL}"`);

    // ── 4. Click "Lưu cấu hình" and assert the success toast
    const putResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/admin/settings/shop') && res.request().method() === 'PUT',
      { timeout: 30_000 }
    );
    await page.locator('form').getByRole('button', { name: 'Lưu cấu hình' }).click();
    const putResponse = await putResponsePromise;
    expect(putResponse.status()).toBe(200);

    const toast = page.getByTestId('shop-settings-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/cập nhật|updated|thành công|success/i);
    console.log('[TOAST] success toast visible:', await toast.textContent());

    // Toast clears itself after 3s — make sure it was rendered as success (green)
    await expect(toast).toHaveClass(/bg-green-50/);

    // ── 4b. INSTANT global sync — Navbar re-renders with the new shop name
    //    while still on the admin page (no navigation, no page refresh):
    //    this proves ShopContext.updateShopInfo() pushed the saved values
    //    into global state the moment the PUT succeeded.
    await expect(page.getByTestId('navbar-shop-name')).toContainText(NEW_SHOP_NAME);
    console.log(`[INSTANT-SYNC] navbar shows "${NEW_SHOP_NAME}" while still on /admin/shop-settings`);

    // ── 5. SPA-navigate to the storefront home (client-side routing — no
    //    full page reload) via the admin header "← Cửa hàng" link, then
    //    scroll to the Footer.
    await page.getByRole('link', { name: '← Cửa hàng' }).click();
    await page.waitForURL((url) => url.pathname === '/');
    const footer = page.getByTestId('site-footer');
    await expect(footer).toBeVisible();
    await footer.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300); // let animations settle

    // ── 6. Verify updated shop name + email in the Footer DOM
    await expect(page.getByTestId('footer-shop-name')).toHaveText(NEW_SHOP_NAME);
    await expect(page.getByTestId('footer-support-email')).toHaveText(NEW_SUPPORT_EMAIL);

    // Navbar brand must carry the same dynamically-bound shop name; when a
    // logo URL is configured, both Navbar + Footer must render it as <img>.
    await expect(page.getByTestId('navbar-shop-name')).toContainText(NEW_SHOP_NAME);
    const logoImgs = await page.getByTestId('navbar-shop-logo').count().catch(() => 0);
    if (logoImgs > 0) {
      const navbarLogoSrc = await page.getByTestId('navbar-shop-logo').getAttribute('src');
      const footerLogoSrc = await page.getByTestId('footer-shop-logo').getAttribute('src');
      expect(footerLogoSrc).toBeTruthy();
      expect(navbarLogoSrc).toBe(footerLogoSrc);
      console.log('[LOGO] navbar + footer logo bound to:', navbarLogoSrc);
    }
    console.log(`[BINDING] footer + navbar both show "${NEW_SHOP_NAME}" / "${NEW_SUPPORT_EMAIL}"`);

    // ── 6b. Server-side persistence check via the public endpoint
    const shopInfo = await page.evaluate(async () => {
      const res = await fetch('/api/v1/shop-info');
      return (await res.json()).data;
    });
    expect(shopInfo.shop_name).toBe(NEW_SHOP_NAME);
    expect(shopInfo.support_email).toBe(NEW_SUPPORT_EMAIL);
    console.log('[API] persisted shop-info:', JSON.stringify(shopInfo));

    // ── 7. Verification screenshot of the updated footer
    await footer.screenshot({ path: 'shop-settings-footer-verified.png' });
    await page.screenshot({ path: 'shop-settings-storefront-verified.png', fullPage: false });
    console.log('[SHOT] saved shop-settings-footer-verified.png + shop-settings-storefront-verified.png');
  });
});
