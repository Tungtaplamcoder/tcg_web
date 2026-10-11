// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Admin dashboard — restructured top row + real-time Top-3 Viewed rectangle.
 *
 * Contract:
 *  1. Opening a product detail page increments its `view_count`.
 *  2. The top row is: Revenue & Orders (top-left, col-span-5) + the merged
 *     wide "Top Most-Viewed" rectangle (top-right, col-span-7).
 *  3. The right rectangle renders the Top 3 items with real view counters.
 *  4. The empty "Góc nhìn hệ thống" widget and the duplicate top sidebar
 *     profile card are gone.
 *
 * Screenshots:
 *  successful_test/47_admin_dashboard_top_viewed_rectangle_light.png
 *  successful_test/47_admin_dashboard_top_viewed_rectangle_dark.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const SHOT_LIGHT = path.join(SHOT_DIR, '47_admin_dashboard_top_viewed_rectangle_light.png');
const SHOT_DARK = path.join(SHOT_DIR, '47_admin_dashboard_top_viewed_rectangle_dark.png');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tcg.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminSecurePass123!';

async function loginAsAdmin(page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.locator('input[type="text"]').first().fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
  await Promise.all([
    page.waitForURL((url) => url.pathname !== '/login', { timeout: 30_000 }),
    page.getByRole('button', { name: /đăng nhập|login|logging/i }).first().click()
  ]);
  await page.waitForLoadState('networkidle').catch(() => {});
}

async function setTheme(page, theme) {
  const header = page.getByTestId('admin-header-banner');
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  if (theme === 'dark' && !isDark) await header.getByRole('button', { name: /chuyển sang chế độ tối|switch to dark/i }).first().click();
  if (theme === 'light' && isDark) await header.getByRole('button', { name: /chuyển sang chế độ sáng|switch to light/i }).first().click();
  if (theme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/);
  else await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.waitForTimeout(350);
}

test.describe('Admin dashboard — top row + Top-3 Viewed rectangle', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
  });

  test('view tracking increments and the merged Top-3 rectangle renders', async ({ page, request }) => {
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

    await loginAsAdmin(page);

    // ── 1. Pick a product and increment its view counter ───────────────
    const listRes = await request.get('/api/v1/products?limit=1');
    const product = (await listRes.json()).data.items[0];
    expect(product && product.id).toBeTruthy();

    const beforeRes = await request.get(`/api/v1/products/${product.id}`);
    const before = (await beforeRes.json()).data.viewCount;

    const visits = 4;
    for (let i = 0; i < visits; i++) {
      await page.goto(`/product/${product.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});
    }

    const afterRes = await request.get(`/api/v1/products/${product.id}`);
    const after = (await afterRes.json()).data.viewCount;
    console.log(`[VIEWS] product="${product.name}" before=${before} after=${after}`);
    expect(after).toBeGreaterThanOrEqual(before + visits);

    // ── 2. Open the admin dashboard ─────────────────────────────────────
    await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page).toHaveURL(/\/admin\/dashboard$/);

    // ── 3. Sidebar cleanup + empty insight widget removed ───────────────
    const sidebar = page.getByTestId('admin-sidebar');
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByTestId('admin-sidebar-welcome')).toHaveCount(0);
    await expect(page.getByTestId('admin-sidebar-profile')).toBeVisible();
    await expect(page.getByTestId('admin-bento-widget-1')).toHaveCount(0);
    await expect(page.getByText(/góc nhìn hệ thống|system insight/i)).toHaveCount(0);
    console.log('[CLEANUP] no duplicate profile card / no insight widget');

    // ── 4. Revenue & Orders sits at the top-left ────────────────────────
    const revenue = page.getByTestId('admin-bento-revenue');
    const topViewed = page.getByTestId('admin-top-viewed-widget');
    await expect(revenue).toBeVisible();
    await expect(topViewed).toBeVisible();
    await expect(revenue.getByText(/doanh thu & đơn hàng|revenue & orders/i)).toBeVisible();

    const boxRev = await revenue.boundingBox();
    const boxTop = await topViewed.boundingBox();
    expect(boxRev.x).toBeLessThan(boxTop.x);
    expect(boxRev.y).toBeLessThan(boxTop.y + 4);
    expect(boxTop.width).toBeGreaterThan(boxRev.width);
    console.log(`[GEOMETRY] revenue=(${Math.round(boxRev.x)},${Math.round(boxRev.y)}) topViewed=(${Math.round(boxTop.x)},${Math.round(boxTop.y)})`);

    // ── 5. Merged rectangle renders the Top 3 with real view counts ─────
    const list = page.getByTestId('top-viewed-list');
    await expect(list).toBeVisible();
    for (let n = 1; n <= 3; n++) {
      await expect(page.getByTestId(`top-viewed-item-${n}`)).toBeVisible();
    }
    const firstText = await page.getByTestId('top-viewed-item-1').innerText();
    const firstCount = parseInt((/(\d[\d.,]*)\s*(lượt xem|views)/i.exec(firstText) || [])[1]?.replace(/[.,]/g, '') || '0', 10);
    console.log(`[TOP-VIEWED] #1="${firstText.replace(/\n/g, ' | ')}" count=${firstCount}`);
    expect(firstText).toContain('#1');
    expect(firstCount).toBeGreaterThanOrEqual(after);
    expect(firstText).toMatch(/lượt xem|views/i);

    // ── 6. Light + dark screenshots ─────────────────────────────────────
    await setTheme(page, 'light');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({ path: SHOT_LIGHT, fullPage: false });
    expect(fs.existsSync(SHOT_LIGHT)).toBe(true);
    console.log(`[SHOT] saved ${SHOT_LIGHT}`);

    await setTheme(page, 'dark');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({ path: SHOT_DARK, fullPage: false });
    expect(fs.existsSync(SHOT_DARK)).toBe(true);
    console.log(`[SHOT] saved ${SHOT_DARK}`);

    const realErrors = consoleErrors.filter((e) => !/favicon|ResizeObserver loop/i.test(e));
    expect(realErrors, `console errors: ${JSON.stringify(realErrors)}`).toEqual([]);
  });
});
