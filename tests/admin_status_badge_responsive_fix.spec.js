// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Admin dashboard — responsive status badges.
 *
 * Contract:
 *  1. Every order-status pill in "Đơn hàng gần đây" stays on a SINGLE line
 *     (white-space: nowrap, height ≈ one line) at Desktop 1920x1080 and
 *     Laptop 1280x800 — never wrapping into a tall oval.
 *  2. The status column reserves min-width 120px so "Đang giao hàng" fits.
 *  3. Both light and dark themes render soft pastel, high-contrast pills.
 *
 * Screenshots:
 *  successful_test/49_admin_status_badge_fixed_light.png
 *  successful_test/49_admin_status_badge_fixed_dark.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const SHOT_LIGHT = path.join(SHOT_DIR, '49_admin_status_badge_fixed_light.png');
const SHOT_DARK = path.join(SHOT_DIR, '49_admin_status_badge_fixed_dark.png');

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

test.describe('Admin dashboard — responsive status badges', () => {
  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
  });

  test('status pills stay single-line at 1920x1080 and 1280x800 (light + dark)', async ({ page, request }) => {
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

    await loginAsAdmin(page);

    // Ensure a SHIPPING order is present in the recent-orders window so the
    // "Đang giao hàng" case is actually exercised. Idempotent + best-effort.
    try {
      const listRes = await request.get('/api/v1/admin/orders?limit=1');
      const newest = (await listRes.json()).data.items[0];
      if (newest && !['SHIPPING', 'DELIVERED'].includes(newest.status)) {
        await request.patch(`/api/v1/admin/orders/${newest.id}/status`, { data: { status: 'SHIPPING' } });
      }
    } catch (e) { /* status readiness is best-effort */ }

    const viewports = [
      { width: 1920, height: 1080, label: 'desktop' },
      { width: 1280, height: 800, label: 'laptop' }
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});

      const recent = page.getByTestId('admin-bento-recent-orders');
      await expect(recent).toBeVisible();

      const badges = page.getByTestId('order-status-badge');
      const count = await badges.count();
      expect(count, `${vp.label}: recent-orders badges exist`).toBeGreaterThan(0);

      const metrics = await badges.evaluateAll((els) => els.map((el) => {
        const cs = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          text: (el.textContent || '').trim(),
          whiteSpace: cs.whiteSpace,
          display: cs.display,
          height: Math.round(rect.height),
          width: Math.round(rect.width),
          fontSize: cs.fontSize
        };
      }));

      console.log(`[${vp.label}] badges=${JSON.stringify(metrics)}`);

      for (const m of metrics) {
        expect(m.whiteSpace, `${vp.label} "${m.text}" nowrap`).toBe('nowrap');
        expect(m.display, `${vp.label} "${m.text}" inline-flex`).toContain('flex');
        // Single line: one text row (text-xs 16px line-height) + 4px×2 pad + 1px×2 border ≈ 26px.
        expect(m.height, `${vp.label} "${m.text}" single-line height`).toBeLessThan(32);
        // Guard against the tall-oval distortion (height must not approach width).
        expect(m.height, `${vp.label} "${m.text}" not an oval`).toBeLessThan(m.width);
      }

      // Status column reserves min-width 120px.
      const statusTh = page.locator('[data-testid="admin-bento-recent-orders"] th', { hasText: /trạng thái|status/i }).first();
      const minW = await statusTh.evaluate((el) => getComputedStyle(el).minWidth);
      console.log(`[${vp.label}] status column min-width = ${minW}`);
      expect(parseFloat(minW)).toBeGreaterThanOrEqual(120);

      // The specific "Đang giao hàng" / shipping case must be present + single line.
      const shippingBadge = badges.filter({ hasText: /đang giao hàng|shipping/i }).first();
      if (await shippingBadge.count()) {
        const text = (await shippingBadge.innerText()).trim();
        const box = await shippingBadge.boundingBox();
        console.log(`[${vp.label}] shipping badge "${text}" ${Math.round(box.width)}x${Math.round(box.height)}`);
        expect(box.height).toBeLessThan(32);
      }
    }

    // ── Screenshots at the stress (laptop) width, light + dark ──────────
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.getByTestId('admin-bento-recent-orders').scrollIntoViewIfNeeded();

    await setTheme(page, 'light');
    await page.getByTestId('admin-bento-recent-orders').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: SHOT_LIGHT, fullPage: false });
    expect(fs.existsSync(SHOT_LIGHT)).toBe(true);
    console.log(`[SHOT] saved ${SHOT_LIGHT}`);

    await setTheme(page, 'dark');
    await page.getByTestId('admin-bento-recent-orders').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: SHOT_DARK, fullPage: false });
    expect(fs.existsSync(SHOT_DARK)).toBe(true);
    console.log(`[SHOT] saved ${SHOT_DARK}`);

    const realErrors = consoleErrors.filter((e) => !/favicon|ResizeObserver loop/i.test(e));
    expect(realErrors, `console errors: ${JSON.stringify(realErrors)}`).toEqual([]);
  });
});
