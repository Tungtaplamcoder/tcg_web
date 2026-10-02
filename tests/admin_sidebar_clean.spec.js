// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Admin sidebar — badge removed, clean navigation rhythm.
 *
 * Contract:
 *  1. The "🟢 Cửa hàng: Đang mở cửa" Store Status Badge is gone entirely
 *     (and so is the old "+ Tạo sản phẩm" quick-create CTA).
 *  2. The nav menu keeps a comfortable gap below the logo block and flows
 *     from "Bảng điều khiển" down to "Phí vận chuyển" in both themes.
 *
 * Screenshots:
 *  successful_test/04_admin_sidebar_clean_light.png
 *  successful_test/04_admin_sidebar_clean_dark.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const LIGHT_SHOT = path.join(SHOT_DIR, '04_admin_sidebar_clean_light.png');
const DARK_SHOT = path.join(SHOT_DIR, '04_admin_sidebar_clean_dark.png');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tcg.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminSecurePass123!';

async function loginAsAdmin(page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.locator('input[type="text"]').first().fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
  await Promise.all([
    page.waitForURL(/\/admin(\/.*)?$/, { timeout: 30_000 }),
    page.getByRole('button', { name: /đăng nhập|login|logging/i }).first().click()
  ]);
}

/** sRGB relative luminance (0 = black, 1 = white). */
const luminance = ([r, g, b]) => {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

const parseRgb = (value) => {
  const m = /rgba?\(([^)]+)\)/.exec(value || '');
  if (!m) return null;
  return m[1].split(',').map((n) => parseFloat(n.trim())).slice(0, 3);
};

const contrastRatio = (fg, bg) => {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

test.describe('Admin sidebar — clean, no status badge', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
  });

  test('badge is absent and nav rhythm holds in light + dark', async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('[console.error]', msg.text());
    });

    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin(\/.*)?$/);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.evaluate(() => window.scrollTo(0, 0));

    const sidebar = page.getByTestId('admin-sidebar');
    await expect(sidebar).toBeVisible();

    // ── 1. No status badge, no quick-create CTA ─────────────────────────
    await expect(page.getByTestId('admin-store-status')).toHaveCount(0);
    await expect(sidebar.getByText(/đang mở cửa|open now/i)).toHaveCount(0);
    await expect(sidebar.getByText(/cửa hàng:\s*đang mở cửa/i)).toHaveCount(0);
    await expect(sidebar.getByRole('link', { name: /tạo sản phẩm|new product/i })).toHaveCount(0);

    // ── 2. Nav flows Bảng điều khiển → Phí vận chuyển ───────────────────
    const first = sidebar.getByRole('link', { name: 'Bảng điều khiển' });
    const last = sidebar.getByRole('link', { name: 'Phí vận chuyển' });
    await expect(first).toBeVisible();
    await expect(last).toBeVisible();

    // Comfortable gap between the logo block and the first menu item.
    const gap = await page.evaluate(() => {
      const nav = document.querySelector('[data-testid="admin-sidebar"] nav');
      return nav ? parseFloat(getComputedStyle(nav).marginTop) : 0;
    });
    console.log(`[GAP] nav marginTop=${gap}px`);
    expect(gap).toBeGreaterThanOrEqual(16);

    // Active state must be visibly highlighted on the dashboard link.
    const activeProof = await first.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { color: cs.color, bgImage: cs.backgroundImage };
    });
    console.log(`[ACTIVE] color=${activeProof.color} bgImage=${activeProof.bgImage.slice(0, 60)}`);

    // ── 3. Light mode screenshot ────────────────────────────────────────
    const ensureLight = async () => {
      const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      if (isDark) {
        await page.getByRole('button', { name: /chuyển sang chế độ sáng|switch to light mode/i }).first().click();
      }
    };
    await ensureLight();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await page.waitForTimeout(400);
    await page.screenshot({ path: LIGHT_SHOT, fullPage: false });
    expect(fs.existsSync(LIGHT_SHOT)).toBe(true);
    console.log(`[SHOT] saved ${LIGHT_SHOT}`);

    // ── 4. Dark mode: nav still legible, screenshot ─────────────────────
    await page.getByRole('button', { name: /chuyển sang chế độ tối|switch to dark mode/i }).first().click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.waitForTimeout(500);

    await expect(first).toBeVisible();
    await expect(last).toBeVisible();
    await expect(page.getByTestId('admin-store-status')).toHaveCount(0);

    const darkNav = await last.evaluate((el) => {
      const cs = getComputedStyle(el);
      let node = el;
      let bg = 'rgba(0,0,0,0)';
      while (node) {
        const b = getComputedStyle(node).backgroundColor;
        const m = /rgba?\(([^)]+)\)/.exec(b || '');
        const alpha = m && m[1].split(',').length === 4 ? parseFloat(m[1].split(',')[3]) : 1;
        if (m && alpha > 0.5) { bg = b; break; }
        node = node.parentElement;
      }
      return { color: cs.color, bg };
    });
    const fg = parseRgb(darkNav.color);
    const bg = parseRgb(darkNav.bg);
    const ratio = contrastRatio(fg, bg);
    console.log(`[DARK NAV] color=${darkNav.color} bg=${darkNav.bg} ratio=${ratio.toFixed(2)}`);
    expect(ratio).toBeGreaterThanOrEqual(4.5);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    await page.screenshot({ path: DARK_SHOT, fullPage: false });
    expect(fs.existsSync(DARK_SHOT)).toBe(true);
    console.log(`[SHOT] saved ${DARK_SHOT}`);
  });
});
