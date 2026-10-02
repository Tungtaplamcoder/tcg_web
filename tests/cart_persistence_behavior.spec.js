// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Add-to-cart stay-on-page + cart persistence.
 *
 * Contract:
 *  1. Clicking "Thêm vào giỏ" on a product detail page updates the cart and
 *     shows a success toast — it must NOT redirect to /cart.
 *  2. The Topbar cart badge (data-testid="cart-badge") shows the correct count.
 *  3. The cart survives a full page reload (F5): the badge still shows the
 *     same count after reload, hydrated from localStorage.
 *
 * Screenshots:
 *   successful_test/16_add_to_cart_stay_on_page.png
 *   successful_test/16_cart_persisted_after_reload.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const STAY_SHOT = path.join(SHOT_DIR, '16_add_to_cart_stay_on_page.png');
const RELOAD_SHOT = path.join(SHOT_DIR, '16_cart_persisted_after_reload.png');

const CART_KEY = 'tcg_cart';

/** Pick an in-stock product so the Add-to-Cart button is enabled. */
async function findInStockProduct(request) {
  const res = await request.get('/api/v1/products?limit=50');
  expect(res.ok(), 'fetch products').toBeTruthy();
  const body = await res.json();
  const items = body?.data?.items || [];
  const product = items.find((p) =>
    Array.isArray(p.variants) && p.variants.some((v) => Number(v.stockQuantity) > 0)
  );
  expect(product, 'an in-stock product exists').toBeTruthy();
  return product;
}

test.describe('Cart — stay on page + persist across reload', () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
  });

  test('add to cart stays on product page and persists after F5', async ({ page, request }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('[console.error]', msg.text());
    });

    const product = await findInStockProduct(request);

    // Start from a clean cart. Clear once on an initial load, then do a real
    // navigation so the app boots with an empty cart. (Using addInitScript
    // would re-run on the F5 we later rely on and wrongly wipe the cart.)
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate((key) => {
      try { window.localStorage.removeItem(key); } catch { /* noop */ }
    }, CART_KEY);

    await page.goto(`/product/${product.id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    // No badge is shown for an empty cart.
    await expect(page.getByTestId('cart-badge')).toHaveCount(0);

    const productPath = new URL(page.url()).pathname;
    expect(productPath).toMatch(/^\/product\//);

    // ── Add to cart ───────────────────────────────────────────────────────
    const addBtn = page.getByRole('button', { name: /Thêm vào giỏ|Add to Cart/i }).first();
    await expect(addBtn).toBeEnabled();
    await addBtn.click();

    // 1. STILL on the product page — no /cart redirect.
    await expect(page).toHaveURL((url) => url.pathname === productPath, { timeout: 5000 });
    expect(new URL(page.url()).pathname, 'URL after add to cart').toBe(productPath);
    expect(new URL(page.url()).pathname).not.toBe('/cart');

    // 2. Success toast appears.
    const toast = page.getByTestId('cart-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/giỏ hàng|cart/i);

    // 3. Topbar badge shows 1.
    const badge = page.getByTestId('cart-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('1');
    console.log(`[CART] added "${product.name}" → badge=${(await badge.textContent())?.trim()}`);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({ path: STAY_SHOT, fullPage: false });
    expect(fs.existsSync(STAY_SHOT)).toBe(true);
    console.log(`[SHOT] saved ${STAY_SHOT}`);

    // 4. Reload (F5) — badge must still show 1, hydrated from localStorage.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    const badgeAfter = page.getByTestId('cart-badge');
    await expect(badgeAfter).toBeVisible();
    await expect(badgeAfter).toHaveText('1');

    const stored = await page.evaluate((key) => window.localStorage.getItem(key), CART_KEY);
    expect(stored, 'cart persisted in localStorage').toBeTruthy();
    const parsed = JSON.parse(stored || '[]');
    expect(Array.isArray(parsed) && parsed.length).toBeGreaterThan(0);
    expect(new URL(page.url()).pathname, 'still on product page after reload').toBe(productPath);
    console.log(`[CART] after reload → badge=${(await badgeAfter.textContent())?.trim()}, stored items=${parsed.length}`);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({ path: RELOAD_SHOT, fullPage: false });
    expect(fs.existsSync(RELOAD_SHOT)).toBe(true);
    console.log(`[SHOT] saved ${RELOAD_SHOT}`);
  });
});
