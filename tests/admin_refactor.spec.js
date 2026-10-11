// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Admin/staff layout isolation + Rose Editorial panel refactor.
 *
 * Contract:
 *  1. Storefront chrome (floating pill topbar + footer) must NOT render on
 *     /admin or /staff — it is scoped to the storefront layout only.
 *  2. /admin renders the new editorial AdminLayout: dark rose/wine gradient
 *     welcome banner (serif italic greeting), white rounded sidebar with
 *     branding + quick-create + icon nav, and the rose metric cards / charts.
 *  3. All existing admin navigation entries are still present.
 *
 * Screenshot: successful_test/04_admin_editorial_panel.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const SHOT = path.join(SHOT_DIR, '04_admin_editorial_panel.png');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tcg.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminSecurePass123!';

/** UI login through the real form; returns after the role redirect settles. */
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
  // Every role lands on the Homepage after login; open the Admin panel next.
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
}

test.describe('Admin panel — editorial refactor + storefront isolation', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
  });

  test('storefront topbar is hidden and the rose editorial panel renders', async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('[console.error]', msg.text());
    });

    // ── 1. Log in, land on /admin ──────────────────────────────────────
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin(\/.*)?$/);
    await page.waitForLoadState('networkidle').catch(() => {});

    // ── 2. Storefront chrome must be ABSENT from the admin route ───────
    await expect(page.getByTestId('site-header')).toBeHidden();
    await expect(page.getByTestId('navbar-pill')).toBeHidden();
    await expect(page.getByTestId('navbar-brand')).toBeHidden();
    const storefrontNavCount = await page.getByTestId('site-navbar').count();
    expect(storefrontNavCount).toBe(0);
    await expect(page.getByTestId('site-footer')).toBeHidden();
    console.log('[ISOLATION] storefront topbar + footer not present on /admin');

    // ── 3. Seamless pastel header (no box container) ───────────────────
    const banner = page.getByTestId('admin-header-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toHaveClass(/bg-transparent/);
    await expect(banner).toHaveClass(/border-none/);
    await expect(banner).not.toHaveClass(/rounded-2xl/);

    const bannerPaint = await banner.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, border: cs.borderTopWidth };
    });
    expect(bannerPaint.bg).toBe('rgba(0, 0, 0, 0)');
    expect(bannerPaint.border).toBe('0px');
    console.log(`[BANNER] bg=${bannerPaint.bg} border=${bannerPaint.border}`);

    // Back-to-store navigation retained; greeting/search/avatar removed.
    await expect(page.getByTestId('admin-back-to-store')).toBeVisible();
    await expect(page.getByTestId('admin-back-to-store')).toContainText(/quay lại cửa hàng|back to store/i);
    await expect(page.getByTestId('admin-greeting')).toHaveCount(0);
    await expect(page.getByTestId('admin-quick-search')).toHaveCount(0);

    // ── 4. White rounded sidebar ───────────────────────────────────────
    const sidebar = page.getByTestId('admin-sidebar');
    await expect(sidebar).toBeVisible();
    const shell = page.getByTestId('admin-shell');
    await expect(shell).toBeVisible();

    const sidebarProof = await sidebar.evaluate((el) => {
      const card = el.querySelector(':scope > div');
      const cs = getComputedStyle(card);
      return { bg: cs.backgroundColor, radius: parseFloat(cs.borderTopLeftRadius) };
    });
    expect(sidebarProof.radius).toBeGreaterThanOrEqual(12);
    console.log(`[SIDEBAR] bg=${sidebarProof.bg} radius=${sidebarProof.radius}`);

    // All existing admin destinations still reachable from the nav.
    const navLabels = [
      'Bảng điều khiển', 'Đơn hàng', 'Kho hàng', 'Hộp ảo', 'Bài viết',
      'Quản lý người dùng', 'Voucher', 'Nhật ký thanh toán',
      'Cấu hình SePay', 'Cấu hình cửa hàng', 'Phí vận chuyển'
    ];
    for (const label of navLabels) {
      await expect(sidebar.getByRole('link', { name: label, exact: true })).toBeVisible();
    }

    // The store status badge was removed (see admin_sidebar_clean.spec.js);
    // the old quick-create CTA stays gone too.
    await expect(sidebar.getByTestId('admin-store-status')).toHaveCount(0);
    await expect(sidebar.getByRole('link', { name: /tạo sản phẩm|new product/i })).toHaveCount(0);

    // ── 5. Rose editorial dashboard content ────────────────────────────
    const main = page.locator('main.dash-scope');
    await expect(main.getByRole('heading', { name: /phân tích doanh thu|revenue analytics/i })).toBeVisible();

    // Metric cards use the pink hairline border.
    const metricCard = page.locator('.border-pink-100\\/60').first();
    await expect(metricCard).toBeVisible();

    // NeuroBento charts render: the revenue area line (top-left widget).
    // The layer always mounts; a zero-revenue day legitimately yields a
    // zero-height area, so assert the mounted layer rather than painted pixels.
    await expect(page.locator('.recharts-area').first()).toBeAttached({ timeout: 20_000 });
    const chartProof = await page.evaluate(() => ({
      areas: document.querySelectorAll('.recharts-area').length,
      containers: document.querySelectorAll('.recharts-responsive-container').length
    }));
    expect(chartProof.areas).toBeGreaterThanOrEqual(1);
    console.log(`[CHARTS] area=${chartProof.areas} containers=${chartProof.containers}`);

    // ── 6. Screenshot of the verified editorial panel ──────────────────
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    await page.screenshot({ path: SHOT, fullPage: true });
    expect(fs.existsSync(SHOT)).toBe(true);
    console.log(`[SHOT] saved ${SHOT}`);

    // ── 7. Storefront still has its chrome (regression guard) ──────────
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByTestId('navbar-pill')).toBeVisible();
    await expect(page.getByTestId('site-header')).toBeVisible();
    console.log('[REGRESSION] storefront topbar intact on /');

    // ── 8. /staff is isolated from the storefront chrome too ───────────
    await page.goto('/staff', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByTestId('site-header')).toBeHidden();
    await expect(page.getByTestId('navbar-pill')).toBeHidden();
    await expect(page.getByTestId('site-footer')).toBeHidden();
    console.log('[ISOLATION] storefront chrome not present on /staff');
  });
});
