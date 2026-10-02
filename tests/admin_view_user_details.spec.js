// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Admin /admin/users — "View details" user profile drawer.
 *
 * Contract:
 *  1. Every user row exposes an Eye ("View details") action next to the
 *     password-reset and delete actions in the THAO TÁC column.
 *  2. Clicking it opens the read-only UserDetailModal which aggregates the
 *     target user's identity, saved shipping addresses (derived from order
 *     snapshots), order history summary and owned vouchers.
 *  3. The modal surfaces the account email, an address card with the default
 *     badge and an order summary with recent order codes + status badges.
 *
 * Screenshots:
 *   successful_test/17_admin_view_user_detail_modal_light.png
 *   successful_test/17_admin_view_user_detail_modal_dark.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const LIGHT_SHOT = path.join(SHOT_DIR, '17_admin_view_user_detail_modal_light.png');
const DARK_SHOT = path.join(SHOT_DIR, '17_admin_view_user_detail_modal_dark.png');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tcg.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminSecurePass123!';
const TARGET_EMAIL = process.env.TARGET_USER_EMAIL || 'customer@tcg.com';
const TARGET_ORDER_ADDRESS = '123 E2E Test Street';

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
  await page.goto('/admin/users', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
}

async function ensureLight(page) {
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  if (isDark) {
    await page.getByRole('button', { name: /chuyển sang chế độ sáng|switch to light mode/i }).first().click();
  }
  await expect(page.locator('html')).not.toHaveClass(/dark/);
}

async function ensureDark(page) {
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  if (!isDark) {
    await page.getByRole('button', { name: /chuyển sang chế độ tối|switch to dark mode/i }).first().click();
  }
  await expect(page.locator('html')).toHaveClass(/dark/);
}

async function openTargetRow(page) {
  await page.getByPlaceholder(/Tìm theo email/i).fill(TARGET_EMAIL);
  await page.waitForLoadState('networkidle').catch(() => {});
  const row = page.locator('tr', { hasText: TARGET_EMAIL });
  await expect(row).toBeVisible({ timeout: 15_000 });
  return row;
}

test.describe('Admin — view detailed user data modal', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
  });

  test('Eye action opens the aggregated user detail modal', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole('heading', { name: /Quản lý người dùng/i })).toBeVisible();

    // ── 1. The Eye action is present in the THAO TÁC column ─────────────
    const viewButtons = page.locator('[data-testid="view-user-btn"]');
    await expect(viewButtons.first()).toBeVisible({ timeout: 20_000 });
    const eyeSvgCount = await page.locator('[data-testid="view-user-btn"] svg[class*="eye"]').count();
    expect(eyeSvgCount, 'eye icons rendered').toBeGreaterThan(0);
    console.log(`[ACTIONS] view-detail buttons=${await viewButtons.count()} eye svgs=${eyeSvgCount}`);

    // ── 2. Classic / dark baseline before screenshots ───────────────────
    await ensureLight(page);

    // ── 3. Click the Eye action for the Customer User row ───────────────
    const row = await openTargetRow(page);
    await row.locator('[data-testid="view-user-btn"]').click();

    const modal = page.getByTestId('user-detail-modal');
    await expect(modal).toBeVisible();
    await expect(page.getByTestId('user-detail-email')).toContainText(TARGET_EMAIL);
    await expect(page.getByTestId('user-detail-summary')).toBeVisible();

    // ── 4. Shipping addresses tab (default highlighted) ─────────────────
    await page.getByTestId('detail-tab-addresses').click();
    const addressesPanel = page.getByTestId('detail-addresses-panel');
    await expect(addressesPanel).toBeVisible();
    await expect(addressesPanel).toContainText(TARGET_ORDER_ADDRESS);
    await expect(addressesPanel).toContainText(/Mặc định/i);
    console.log('[ADDRESSES] default shipping address rendered');

    // ── 5. Order history tab (summary + status badges) ──────────────────
    await page.getByTestId('detail-tab-orders').click();
    const ordersPanel = page.getByTestId('detail-orders-panel');
    await expect(ordersPanel).toBeVisible();
    await expect(ordersPanel).toContainText(/Tổng số đơn/i);
    await expect(ordersPanel).toContainText(/Tổng chi tiêu/i);
    const orderRows = page.getByTestId('detail-order-row');
    await expect(orderRows.first()).toBeVisible({ timeout: 15_000 });
    expect(await orderRows.count(), 'recent orders listed').toBeGreaterThan(0);
    await expect(ordersPanel).toContainText(/Chờ thanh toán|Đang đóng gói|Đang giao|Đã giao|Đã hủy/);
    console.log(`[ORDERS] summary rendered with ${await orderRows.count()} recent order rows`);

    // ── 6. Light screenshot (orders tab shows email + summary + badges) ──
    await page.waitForTimeout(350);
    await page.screenshot({ path: LIGHT_SHOT, fullPage: false });
    expect(fs.existsSync(LIGHT_SHOT)).toBe(true);
    console.log(`[SHOT] saved ${LIGHT_SHOT}`);

    // ── 7. Close, switch to dark mode, reopen for the dark shot ──────────
    await page.getByTestId('user-detail-close').click();
    await expect(modal).toBeHidden();

    await ensureDark(page);
    await page.waitForTimeout(300);

    await row.locator('[data-testid="view-user-btn"]').click();
    await expect(modal).toBeVisible();
    await page.getByTestId('detail-tab-orders').click();
    await expect(page.getByTestId('detail-order-row').first()).toBeVisible({ timeout: 15_000 });

    await page.waitForTimeout(350);
    await page.screenshot({ path: DARK_SHOT, fullPage: false });
    expect(fs.existsSync(DARK_SHOT)).toBe(true);
    console.log(`[SHOT] saved ${DARK_SHOT}`);

    await page.getByTestId('user-detail-close').click();
    await expect(modal).toBeHidden();
  });
});
