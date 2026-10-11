// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Admin + Staff dashboards — final restructure.
 *
 * Contract:
 *  1. Admin `/admin/dashboard`: merged Top-3 Viewed rectangle renders; the
 *     bottom-left "Quay lại Cửa hàng" card is deleted from the sidebar DOM
 *     (only the top-right header button remains).
 *  2. Staff `/staff/dashboard`: 0 revenue/financial widgets; a 100% operational
 *     layout (packing queue, daily fulfillment gauge, active virtual boxes with
 *     daily unboxing counts, recently completed orders).
 *
 * Screenshots:
 *  successful_test/48_admin_dashboard_final_light.png
 *  successful_test/48_admin_dashboard_final_dark.png
 *  successful_test/48_staff_dashboard_operational_light.png
 *  successful_test/48_staff_dashboard_operational_dark.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const SHOT_ADMIN_LIGHT = path.join(SHOT_DIR, '48_admin_dashboard_final_light.png');
const SHOT_ADMIN_DARK = path.join(SHOT_DIR, '48_admin_dashboard_final_dark.png');
const SHOT_STAFF_LIGHT = path.join(SHOT_DIR, '48_staff_dashboard_operational_light.png');
const SHOT_STAFF_DARK = path.join(SHOT_DIR, '48_staff_dashboard_operational_dark.png');

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

async function setTheme(page, headerTestId, theme) {
  const header = page.getByTestId(headerTestId);
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  if (theme === 'dark' && !isDark) await header.getByRole('button', { name: /chuyển sang chế độ tối|switch to dark/i }).first().click();
  if (theme === 'light' && isDark) await header.getByRole('button', { name: /chuyển sang chế độ sáng|switch to light/i }).first().click();
  if (theme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/);
  else await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.waitForTimeout(350);
}

test.describe('Admin + Staff dashboards — final restructure', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
  });

  test('admin dashboard: Top-3 rectangle + sidebar cleanup', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    await loginAsAdmin(page);
    await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    await expect(page.getByTestId('admin-top-viewed-widget')).toBeVisible();
    await expect(page.getByTestId('top-viewed-list')).toBeVisible();
    for (let n = 1; n <= 3; n++) await expect(page.getByTestId(`top-viewed-item-${n}`)).toBeVisible();

    const revenue = page.getByTestId('admin-bento-revenue');
    const boxRev = await revenue.boundingBox();
    const boxTop = await (page.getByTestId('admin-top-viewed-widget')).boundingBox();
    expect(boxRev.x).toBeLessThan(boxTop.x);

    // Bottom-left back button + duplicate profile card deleted.
    await expect(page.getByTestId('admin-storefront-banner')).toHaveCount(0);
    await expect(page.getByTestId('admin-sidebar-welcome')).toHaveCount(0);
    // Only the header back-link remains.
    await expect(page.getByTestId('admin-back-to-store')).toBeVisible();

    await setTheme(page, 'admin-header-banner', 'light');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({ path: SHOT_ADMIN_LIGHT, fullPage: false });
    expect(fs.existsSync(SHOT_ADMIN_LIGHT)).toBe(true);
    console.log(`[SHOT] saved ${SHOT_ADMIN_LIGHT}`);

    await setTheme(page, 'admin-header-banner', 'dark');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({ path: SHOT_ADMIN_DARK, fullPage: false });
    expect(fs.existsSync(SHOT_ADMIN_DARK)).toBe(true);
    console.log(`[SHOT] saved ${SHOT_ADMIN_DARK}`);

    const realErrors = errors.filter((e) => !/favicon|ResizeObserver loop/i.test(e));
    expect(realErrors, `console errors: ${JSON.stringify(realErrors)}`).toEqual([]);
  });

  test('staff dashboard: operational layout with 0 revenue widgets', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    await loginAsAdmin(page);
    await page.goto('/staff/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page).toHaveURL(/\/staff\/dashboard$/);

    // ── Operational widgets present ─────────────────────────────────────
    await expect(page.getByTestId('staff-bento-grid')).toBeVisible();
    await expect(page.getByTestId('staff-packing-queue')).toBeVisible();
    await expect(page.getByTestId('staff-fulfillment')).toBeVisible();
    await expect(page.getByTestId('staff-active-boxes')).toBeVisible();
    await expect(page.getByTestId('staff-recent-completed')).toBeVisible();

    // Packing queue quick action is rendered.
    await expect(page.getByTestId('staff-packing-queue').getByRole('button', { name: /xác nhận đóng gói|confirm packed/i }).first()).toBeVisible();

    // Active virtual boxes with daily unboxing counters.
    const activeBoxes = page.getByTestId('staff-active-box');
    expect(await activeBoxes.count()).toBeGreaterThanOrEqual(1);
    await expect(page.getByTestId('staff-active-boxes').getByText(/lượt mở hôm nay|opens today/i).first()).toBeVisible();

    // ── 0 revenue / financial widgets ───────────────────────────────────
    // (Recharts renders a `.recharts-area` layer inside the radial gauge, so
    //  the revenue check keys off the removed widget testids + labels, not
    //  generic SVG classes.)
    await expect(page.getByTestId('staff-bento-revenue')).toHaveCount(0);
    await expect(page.getByTestId('admin-bento-revenue')).toHaveCount(0);
    await expect(page.getByTestId('staff-bento-widget-2')).toHaveCount(0);
    await expect(page.getByTestId('admin-bento-stock-status')).toHaveCount(0);
    await expect(page.locator('.recharts-bar')).toHaveCount(0);
    await expect(page.getByText(/doanh thu & đơn hàng|revenue & orders/i)).toHaveCount(0);
    await expect(page.getByText(/phân bổ danh mục|category & stock/i)).toHaveCount(0);
    console.log('[STAFF] 0 revenue/financial widgets, operational widgets present');

    // ── Light + dark screenshots ────────────────────────────────────────
    await setTheme(page, 'staff-header-banner', 'light');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({ path: SHOT_STAFF_LIGHT, fullPage: false });
    expect(fs.existsSync(SHOT_STAFF_LIGHT)).toBe(true);
    console.log(`[SHOT] saved ${SHOT_STAFF_LIGHT}`);

    await setTheme(page, 'staff-header-banner', 'dark');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({ path: SHOT_STAFF_DARK, fullPage: false });
    expect(fs.existsSync(SHOT_STAFF_DARK)).toBe(true);
    console.log(`[SHOT] saved ${SHOT_STAFF_DARK}`);

    const realErrors = errors.filter((e) => !/favicon|ResizeObserver loop/i.test(e));
    expect(realErrors, `console errors: ${JSON.stringify(realErrors)}`).toEqual([]);
  });
});
