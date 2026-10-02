// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Dark-mode guard for the Order History (/orders) expanded accordion.
 *
 * Bug:
 *   Expanding an order card in dark mode rendered a muddy, semi-transparent
 *   light-grey panel (`bg-ink-50/60` with no `dark:` variant) for the inner
 *   order details (shipping timeline, product line items, delivery address).
 *
 * Fix contract (frontend/src/pages/OrderHistory.jsx):
 *   Outer expanded wrapper : bg-neutral-100/90  dark:bg-neutral-900/90
 *   Timeline track         : bg-white/60        dark:bg-neutral-950/60
 *   Item rows + address    : bg-white/70        dark:bg-neutral-950/70
 *   Secondary text         : text-neutral-600   dark:text-neutral-400
 *
 * Screenshot:
 *   successful_test/21_darkmode_orders_expanded_accordion_fixed.png
 */

// Workspace root is /root/tcg_web (the outer repo); tests live at
// /root/tcg_web/tcg_web/tests, so the required `successful_test/` folder
// is two levels up.
const SHOT_DIR = path.join(__dirname, '..', '..', 'successful_test');
const SHOT_FIXED = path.join(SHOT_DIR, '21_darkmode_orders_expanded_accordion_fixed.png');

const CUSTOMER = { email: 'customer@tcg.com', password: 'Customer@123' };

const parseRgba = (value) => {
  const m = String(value).match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(',').map((s) => parseFloat(s.trim()));
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
};

test.describe('Dark mode: /orders expanded accordion surfaces', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
  });

  test('expanded order details adopt dark neutral surfaces', async ({ page, request }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('[console.error]', msg.text());
    });

    // ── 1. Authenticate the seeded customer via the public API.
    const login = await request.post('/api/v1/auth/login', { data: CUSTOMER });
    expect(login.ok(), `login (${login.status()})`).toBeTruthy();
    const { accessToken, refreshToken, user } = (await login.json()).data;
    expect(accessToken, 'access token returned').toBeTruthy();

    // ── 2. Establish the origin, seed session + dark theme, hard-reload.
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(
      ({ accessToken, refreshToken, user }) => {
        localStorage.setItem('tcg_access_token', JSON.stringify(accessToken));
        localStorage.setItem('tcg_refresh_token', JSON.stringify(refreshToken));
        localStorage.setItem('tcg_user', JSON.stringify(user));
        localStorage.setItem('tcg-theme', 'dark');
      },
      { accessToken, refreshToken, user }
    );

    await page.goto('/orders', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.locator('html')).toHaveClass(/dark/);

    // ── 3. Expand the first order card (click bubbles to the summary onClick).
    const firstOrder = page.getByText(/TCG-\d{8}-[A-Z0-9]+/).first();
    await expect(firstOrder).toBeVisible();
    await firstOrder.click();

    // ── 4. Locate the inner detail containers via their dark surface classes.
    const outer = page.locator('div[class*="dark:bg-neutral-900/90"]').first();
    const timeline = page.locator('div[class*="dark:bg-neutral-950/60"]').first();
    const rows = page.locator('div[class*="dark:bg-neutral-950/70"]');
    await expect(outer).toBeVisible();
    await expect(timeline).toBeVisible();
    await expect(rows.first()).toBeVisible();
    // Let the transition-colors settle before sampling computed styles.
    await page.waitForTimeout(500);

    // ── 5. Computed backgrounds must be dark neutrals, never the light slab.
    const bg = async (locator) => locator.evaluate((el) => getComputedStyle(el).backgroundColor);
    const outerBg = parseRgba(await bg(outer));
    const timelineBg = parseRgba(await bg(timeline));
    const rowBg = parseRgba(await bg(rows.first()));

    console.log('[BG] outer=', JSON.stringify(outerBg), 'timeline=', JSON.stringify(timelineBg), 'row=', JSON.stringify(rowBg));

    for (const [label, c] of [['outer', outerBg], ['timeline', timelineBg], ['row', rowBg]]) {
      expect(c, `${label} bg should parse`).not.toBeNull();
      expect(c.r, `${label} red channel too bright`).toBeLessThan(60);
      expect(c.g, `${label} green channel too bright`).toBeLessThan(60);
      expect(c.b, `${label} blue channel too bright`).toBeLessThan(60);
    }
    // Outer must be the neutral-900/90 surface; inner boxes the near-black neutral-950.
    expect(outerBg.r).toBe(23);
    expect(outerBg.g).toBe(23);
    expect(outerBg.b).toBe(23);
    expect(Math.abs(outerBg.a - 0.9)).toBeLessThan(0.05);
    expect(timelineBg.r).toBe(10);
    expect(Math.abs(timelineBg.a - 0.6)).toBeLessThan(0.05);
    expect(rowBg.r).toBe(10);
    expect(Math.abs(rowBg.a - 0.7)).toBeLessThan(0.05);

    // ── 6. Classes: old muddy light panel gone, new dark classes present.
    await expect(outer).toHaveClass(/dark:bg-neutral-900\/90/);
    await expect(outer).not.toHaveClass(/bg-ink-50\/60/);
    await expect(timeline).toHaveClass(/dark:bg-neutral-950\/60/);
    await expect(timeline).toHaveClass(/dark:border-neutral-800\/60/);
    await expect(rows.first()).toHaveClass(/dark:bg-neutral-950\/70/);

    // ── 7. Secondary address text uses the high-contrast dark token.
    const addressSecondary = page
      .locator('div[class*="dark:bg-neutral-950/70"] p[class*="dark:text-neutral-400"]')
      .first();
    await expect(addressSecondary).toBeVisible();

    // ── 8. Screenshot the expanded, fixed card.
    const card = outer.locator('xpath=ancestor::div[contains(@class,"card-premium")][1]');
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    await card.screenshot({ path: SHOT_FIXED });
    expect(fs.existsSync(SHOT_FIXED)).toBe(true);
    console.log(`[SHOT] saved ${SHOT_FIXED}`);
  });
});
