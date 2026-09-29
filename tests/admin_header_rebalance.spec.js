// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Seamless soft-pastel Admin header + layout rebalance.
 *
 * The header is no longer an outer card/box: it is transparent, borderless
 * and shadowless, blending into the page's pastel gradient. The
 * "← Quay lại cửa hàng" pill sits in the TOP-RIGHT cluster next to the
 * theme toggle. The whole panel uses the soft rose palette
 * (#E11D48 / #F472B6) instead of the old heavy wine (#4A0E17).
 *
 * Screenshot: successful_test/04_admin_seamless_header_fixed.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const SHOT = path.join(SHOT_DIR, '04_admin_seamless_header_fixed.png');

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

test.describe('Admin header — seamless pastel rebalance', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
  });

  test('header has no box container and actions are top-right', async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('[console.error]', msg.text());
    });

    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin(\/.*)?$/);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.evaluate(() => window.scrollTo(0, 0));

    const header = page.getByTestId('admin-header-banner');
    await expect(header).toBeVisible();

    // ── 1. No outer box container on the top bar ───────────────────────
    await expect(header).toHaveClass(/bg-transparent/);
    await expect(header).toHaveClass(/border-none/);
    await expect(header).not.toHaveClass(/rounded-2xl/);
    await expect(header).not.toHaveClass(/shadow-sm/);

    const box = await header.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        bg: cs.backgroundColor,
        img: cs.backgroundImage,
        borderTop: cs.borderTopWidth,
        borderRight: cs.borderRightWidth,
        radius: cs.borderTopLeftRadius,
        shadow: cs.boxShadow
      };
    });
    expect(box.bg).toBe('rgba(0, 0, 0, 0)');       // transparent
    expect(box.img).toBe('none');                   // no gradient/box fill
    expect(box.borderTop).toBe('0px');
    expect(box.borderRight).toBe('0px');
    console.log(`[BOX REMOVED] bg=${box.bg} border=${box.borderTop} radius=${box.radius} shadow=${box.shadow}`);

    // ── 2. Back button lives in the TOP-RIGHT cluster ──────────────────
    const back = page.getByTestId('admin-back-to-store');
    await expect(back).toBeVisible();
    await expect(back).toContainText(/quay lại cửa hàng|back to store/i);

    // Soft pill styling contract.
    await expect(back).toHaveClass(/bg-white\/80/);
    await expect(back).toHaveClass(/text-pink-700/);
    await expect(back).toHaveClass(/border-pink-200\/60/);
    await expect(back).toHaveClass(/rounded-full/);
    await expect(back).toHaveClass(/backdrop-blur-sm/);
    await expect(back).toHaveClass(/shadow-sm/);

    const themeToggle = header.locator('button[aria-label]').filter({ hasNotText: /menu/i }).last();
    await expect(themeToggle).toBeVisible();

    const geo = await page.evaluate(() => {
      const h = document.querySelector('[data-testid="admin-header-banner"]').getBoundingClientRect();
      const b = document.querySelector('[data-testid="admin-back-to-store"]').getBoundingClientRect();
      const btns = [...document.querySelectorAll('[data-testid="admin-header-banner"] button[aria-label]')];
      const theme = btns.find((el) => !/menu/i.test(el.getAttribute('aria-label') || ''));
      const t = theme ? theme.getBoundingClientRect() : null;
      return {
        header: { x: h.x, right: h.right, mid: h.x + h.width / 2, w: h.width },
        back: { x: b.x, right: b.right, w: b.width },
        theme: t ? { x: t.x, right: t.right } : null
      };
    });

    // Back button is on the right half of the header and hugs the right edge.
    expect(geo.back.x).toBeGreaterThan(geo.header.mid);
    expect(geo.header.right - geo.back.right).toBeLessThanOrEqual(28);
    // Theme toggle sits alongside, immediately to the left of the back pill.
    expect(geo.theme).not.toBeNull();
    expect(geo.theme.right).toBeLessThanOrEqual(geo.back.x + 1);
    console.log(`[ALIGN] header.right=${Math.round(geo.header.right)} back=${Math.round(geo.back.x)}..${Math.round(geo.back.right)} theme=${Math.round(geo.theme.x)}..${Math.round(geo.theme.right)}`);

    // ── 3. Soft pastel system applied to the layout ────────────────────
    const shell = page.getByTestId('admin-shell');
    await expect(shell).toHaveClass(/from-\[#FFF0F5\]/);
    await expect(shell).toHaveClass(/via-\[#FDFBF7\]/);
    await expect(shell).toHaveClass(/to-\[#FFF0F5\]/);
    const shellPaint = await shell.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(shellPaint).toContain('linear-gradient');

    // Removed header chrome stays removed.
    await expect(header.getByTestId('admin-greeting')).toHaveCount(0);
    await expect(header.getByTestId('admin-quick-search')).toHaveCount(0);
    await expect(header.locator('input')).toHaveCount(0);
    await expect(header.locator('div.rounded-full')).toHaveCount(0);

    // ── 4. Screenshot ──────────────────────────────────────────────────
    await page.waitForTimeout(300);
    await page.screenshot({ path: SHOT, fullPage: false });
    expect(fs.existsSync(SHOT)).toBe(true);
    console.log(`[SHOT] saved ${SHOT}`);

    // ── 5. Back button navigates to the storefront ─────────────────────
    await Promise.all([
      page.waitForURL((url) => new URL(url).pathname === '/', { timeout: 30_000 }),
      back.click()
    ]);
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByTestId('navbar-pill')).toBeVisible();
    console.log('[NAV] "Quay lại cửa hàng" → storefront home');
  });
});
