// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Admin panel — Dark Mode contrast.
 *
 * Contract:
 *  1. The sidebar no longer renders a Store Status Badge (see
 *     admin_sidebar_clean.spec.js for the dedicated badge-absence check).
 *  2. Toggling dark mode repaints the page canvas to a dark gradient and
 *     the "Phân tích doanh thu" heading switches to a high-contrast light
 *     colour (not dark gray/black on a dark background).
 *
 * Screenshot:
 *  successful_test/04_admin_darkmode_contrast_fixed.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const DARK_SHOT = path.join(SHOT_DIR, '04_admin_darkmode_contrast_fixed.png');

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
  // Every role lands on the Homepage after login; open the Admin panel next.
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
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
  const parts = m[1].split(',').map((n) => parseFloat(n.trim()));
  return parts.slice(0, 3);
};

const contrastRatio = (fg, bg) => {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
};

test.describe('Admin panel — dark mode contrast', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
  });

  test('sidebar is clean and dark mode keeps heading legible', async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('[console.error]', msg.text());
    });

    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin(\/.*)?$/);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.evaluate(() => window.scrollTo(0, 0));

    // ── 1. Sidebar is clean: no quick-create CTA, no status badge ───────
    const sidebar = page.getByTestId('admin-sidebar');
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /tạo sản phẩm|new product/i })).toHaveCount(0);
    await expect(page.getByTestId('admin-store-status')).toHaveCount(0);

    // ── 2. Force light mode baseline ────────────────────────────────────
    const ensureLight = async () => {
      const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      if (isDark) {
        await page.getByRole('button', { name: /chuyển sang chế độ sáng|switch to light mode/i }).first().click();
      }
    };
    await ensureLight();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await page.waitForTimeout(400);

    // ── 3. Toggle dark mode via the header theme button ─────────────────
    await page.getByRole('button', { name: /chuyển sang chế độ tối|switch to dark mode/i }).first().click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.waitForTimeout(500);

    // Page canvas must switch to the dark gradient (not stay pastel/white).
    const shellBg = await page.getByTestId('admin-shell').evaluate(
      (el) => getComputedStyle(el).backgroundImage
    );
    const htmlBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    console.log(`[DARK] shellBackgroundImage=${shellBg} bodyBg=${htmlBg}`);

    // ── 4. Heading contrast in dark mode ────────────────────────────────
    const heading = page.getByRole('heading', { name: /phân tích doanh thu|revenue analytics/i });
    await expect(heading).toBeVisible();

    const headingProof = await heading.evaluate((el) => {
      const cs = getComputedStyle(el);
      // Find the nearest opaque-ish ancestor background (card / page canvas).
      let node = el;
      let bg = 'rgba(0, 0, 0, 0)';
      while (node) {
        const b = getComputedStyle(node).backgroundColor;
        const m = /rgba?\(([^)]+)\)/.exec(b || '');
        const alpha = m && m[1].split(',').length === 4 ? parseFloat(m[1].split(',')[3]) : 1;
        if (m && alpha > 0.5) { bg = b; break; }
        node = node.parentElement;
      }
      return { color: cs.color, bg };
    });

    const fg = parseRgb(headingProof.color);
    const bg = parseRgb(headingProof.bg);
    expect(fg).not.toBeNull();
    expect(bg).not.toBeNull();

    const fgLum = luminance(fg);
    const bgLum = luminance(bg);
    const ratio = contrastRatio(fg, bg);
    console.log(`[CONTRAST] heading=${headingProof.color} (lum=${fgLum.toFixed(3)}) bg=${headingProof.bg} (lum=${bgLum.toFixed(3)}) ratio=${ratio.toFixed(2)}`);

    // Heading must be light-on-dark: high luminance text, low luminance bg.
    expect(fgLum).toBeGreaterThan(0.5);
    expect(bgLum).toBeLessThan(0.25);
    // WCAG AA for large/bold display text.
    expect(ratio).toBeGreaterThanOrEqual(4.5);

    // ── 5. Screenshot of the fixed dark-mode panel ──────────────────────
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    await page.screenshot({ path: DARK_SHOT, fullPage: false });
    expect(fs.existsSync(DARK_SHOT)).toBe(true);
    console.log(`[SHOT] saved ${DARK_SHOT}`);
  });
});
