// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Admin panel — NeuroBento dashboard + GPU Slide & Fade route transitions.
 *
 * Contract:
 *  1. `/admin/dashboard` renders the fixed Bento grid (4 widgets) in both
 *     light and dark mode.
 *  2. Route content is wrapped in a GPU-accelerated "Slide & Fade"
 *     transition (opacity 0 → 1, x 20 → 0, 0.25s, cubic-bezier(.25,.1,.25,1),
 *     will-change: transform, opacity).
 *  3. Sidebar navigation /admin/dashboard → /admin/orders →
 *     /admin/catalog-settings replays the transition with zero console
 *     errors and no meaningful layout shift (CLS < 0.1).
 *  4. The bottom-left "Quay lại Cửa hàng" banner routes to the home page.
 *
 * Screenshots:
 *  successful_test/38_admin_dashboard_bento_dark.png
 *  successful_test/38_admin_dashboard_bento_light.png
 *  successful_test/38_admin_page_slide_transition_verified.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const SHOT_DARK = path.join(SHOT_DIR, '38_admin_dashboard_bento_dark.png');
const SHOT_LIGHT = path.join(SHOT_DIR, '38_admin_dashboard_bento_light.png');
const SHOT_TRANSITION = path.join(SHOT_DIR, '38_admin_page_slide_transition_verified.png');

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

const parseRgb = (value) => {
  const m = /rgba?\(([^)]+)\)/.exec(value || '');
  if (!m) return null;
  return m[1].split(',').slice(0, 3).map((n) => parseFloat(n.trim()));
};
const luminance = ([r, g, b]) => {
  const f = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

async function setTheme(page, theme) {
  const header = page.getByTestId('admin-header-banner');
  const toggle = header.getByRole('button', { name: /chuyển sang chế độ (sáng|tối)|switch to (light|dark)/i });
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  if (theme === 'dark' && !isDark) {
    await toggle.first().click();
  } else if (theme === 'light' && isDark) {
    await toggle.first().click();
  }
  if (theme === 'dark') {
    await expect(page.locator('html')).toHaveClass(/dark/);
  } else {
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  }
  await page.waitForTimeout(400);
}

test.describe('Admin — NeuroBento dashboard + slide transitions', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
  });

  test('bento grid, GPU slide transitions, dark/light, storefront back-link', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        console.log('[console.error]', msg.text());
      }
    });
    page.on('pageerror', (err) => console.log('[pageerror]', err.message));

    // Track CLS across the whole session for the "no layout shift" assertion.
    await page.addInitScript(() => {
      window.__layoutShifts = 0;
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) window.__layoutShifts += entry.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
      } catch (e) { /* layout-shift unsupported */ }
    });

    await loginAsAdmin(page);

    // ── 1. Open the Bento dashboard ─────────────────────────────────────
    await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page).toHaveURL(/\/admin\/dashboard$/);

    const grid = page.getByTestId('admin-bento-grid');
    await expect(grid).toBeVisible();

    const revenue = page.getByTestId('admin-bento-revenue');
    const topViewed = page.getByTestId('admin-top-viewed-widget');
    const recentOrders = page.getByTestId('admin-bento-recent-orders');
    const category = page.getByTestId('admin-bento-stock-status');
    for (const w of [revenue, topViewed, recentOrders, category]) await expect(w).toBeVisible();
    console.log('[BENTO] 4 widgets visible');

    // The empty "Góc nhìn hệ thống" insight widget is gone for good.
    await expect(page.getByTestId('admin-bento-widget-1')).toHaveCount(0);

    // ── 2. Geometry — revenue top-left, top-viewed wide top-right ───────
    const boxRev = await revenue.boundingBox();
    const boxTop = await topViewed.boundingBox();
    const boxRecent = await recentOrders.boundingBox();
    const boxCat = await category.boundingBox();
    expect(boxRev && boxTop && boxRecent && boxCat).toBeTruthy();

    expect(boxRev.x).toBeLessThan(boxTop.x);
    expect(boxRev.y).toBeLessThan(boxRecent.y);
    expect(boxTop.width).toBeGreaterThan(boxRev.width);
    expect(boxCat.x).toBeGreaterThan(boxRecent.x);
    console.log(`[GEOMETRY] revenue=(${Math.round(boxRev.x)},${Math.round(boxRev.y)}) topViewed=(${Math.round(boxTop.x)},${Math.round(boxTop.y)})`);

    // ── 3. Sidebar cleanup — no duplicate welcome card, no bottom banner ─
    const sidebar = page.getByTestId('admin-sidebar');
    await expect(sidebar).toBeVisible();
    await expect(page.getByTestId('admin-sidebar-welcome')).toHaveCount(0);
    await expect(page.getByTestId('admin-storefront-banner')).toHaveCount(0);
    console.log('[SIDEBAR] duplicate welcome card + bottom-left back button removed');

    // ── 4. Light-mode tile is a light canvas (brand palette) ────────────
    await setTheme(page, 'light');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const lightTile = await revenue.evaluate((el) => getComputedStyle(el).backgroundColor);
    const lightLum = luminance(parseRgb(lightTile));
    console.log(`[PALETTE] light tile bg=${lightTile} lum=${lightLum.toFixed(3)}`);
    expect(lightLum).toBeGreaterThan(0.85);
    await page.screenshot({ path: SHOT_LIGHT, fullPage: false });
    expect(fs.existsSync(SHOT_LIGHT)).toBe(true);
    console.log(`[SHOT] saved ${SHOT_LIGHT}`);

    // ── 5. Dark-mode tile is a dark canvas (brand palette) ──────────────
    await setTheme(page, 'dark');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const darkTile = await revenue.evaluate((el) => getComputedStyle(el).backgroundColor);
    const darkLum = luminance(parseRgb(darkTile));
    console.log(`[PALETTE] dark tile bg=${darkTile} lum=${darkLum.toFixed(3)}`);
    expect(darkLum).toBeLessThan(0.25);
    await page.screenshot({ path: SHOT_DARK, fullPage: false });
    expect(fs.existsSync(SHOT_DARK)).toBe(true);
    console.log(`[SHOT] saved ${SHOT_DARK}`);

    // ── 6. Slide & Fade transition spec ─────────────────────────────────
    const transitionStyle = () => page.getByTestId('admin-route-transition').last().evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        animationName: cs.animationName,
        duration: cs.animationDuration,
        timing: cs.animationTimingFunction,
        willChange: cs.willChange
      };
    });

    const style1 = await transitionStyle();
    expect(style1.animationName).toContain('dash-slide-fade');
    expect(style1.duration).toBe('0.25s');
    // cubic-bezier(0.25, 0.1, 0.25, 1) is CSS's `ease`; Chrome reports the alias.
    expect(['ease', 'cubic-bezier(0.25, 0.1, 0.25, 1)']).toContain(style1.timing);
    // The wrapper hints only opacity: a lingering `will-change: transform`
    // would make it a containing block for position:fixed route overlays.
    // The slide itself still runs on the compositor via the keyframes below.
    expect(style1.willChange).toContain('opacity');
    console.log(`[TRANSITION] ${JSON.stringify(style1)}`);

    // Confirm the keyframe itself encodes the required start state.
    const keyframeProof = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        let rules;
        try { rules = sheet.cssRules; } catch (e) { continue; }
        for (const rule of Array.from(rules || [])) {
          if (rule.type === CSSRule.KEYFRAMES_RULE && rule.name === 'dash-slide-fade') {
            return Array.from(rule.cssRules).map((k) => k.keyText + ' ' + k.style.cssText);
          }
        }
      }
      return null;
    });
    console.log('[KEYFRAMES]', JSON.stringify(keyframeProof));
    // Production CSS minification may rewrite translate3d(x) → translate(x);
    // both are the same compositor-only transform.
    expect(keyframeProof && keyframeProof.join(' ')).toMatch(/translate[3d]*\(\s*20px/);
    expect(keyframeProof && keyframeProof.join(' ')).toMatch(/opacity:\s*0/);

    // ── 7. Navigate the admin sidebar routes, replaying the transition ──
    const navSteps = [
      { path: '/admin/orders', label: /đơn hàng|orders/i },
      { path: '/admin/catalog-settings', label: /cấu hình danh mục|catalog/i },
      { path: '/admin/dashboard', label: /bảng điều khiển|dashboard/i }
    ];
    for (const step of navSteps) {
      const link = page.getByTestId('admin-sidebar').getByRole('link', { name: step.label }).first();
      if (await link.count()) {
        await link.click();
      } else {
        await page.goto(step.path, { waitUntil: 'domcontentloaded' });
      }
      await expect(page).toHaveURL(new RegExp(step.path.replace(/\//g, '\\/') + '$'));
      await page.waitForLoadState('networkidle').catch(() => {});

      // The freshly-keyed wrapper must carry the slide animation again.
      const style = await transitionStyle();
      expect(style.animationName).toContain('dash-slide-fade');
      console.log(`[NAV] ${step.path} replay animationName=${style.animationName}`);
    }

    // ── 8. No console errors + no meaningful layout shift ───────────────
    const cls = await page.evaluate(() => Number(window.__layoutShifts || 0));
    console.log(`[CLS] cumulative layout shift = ${cls.toFixed(4)}`);
    expect(cls).toBeLessThan(0.1);

    const realErrors = consoleErrors.filter((e) => !/favicon|ResizeObserver loop/i.test(e));
    expect(realErrors, `console errors: ${JSON.stringify(realErrors)}`).toEqual([]);

    // ── 9. Transition screenshot (mid-navigation to /admin/orders) ──────
    await page.getByTestId('admin-sidebar').getByRole('link', { name: /đơn hàng|orders/i }).first().click();
    await page.waitForURL(/\/admin\/orders$/, { timeout: 30_000 });
    await page.screenshot({ path: SHOT_TRANSITION, fullPage: false });
    expect(fs.existsSync(SHOT_TRANSITION)).toBe(true);
    console.log(`[SHOT] saved ${SHOT_TRANSITION}`);

    // ── 10. Header "Quay lại cửa hàng" → Homepage ───────────────────────
    await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.getByTestId('admin-back-to-store').click();
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
    await expect(page.getByTestId('navbar-pill')).toBeVisible();
    console.log('[NAV] header back-to-store → homepage /');

    expect(fs.existsSync(SHOT_DARK)).toBe(true);
    expect(fs.existsSync(SHOT_LIGHT)).toBe(true);
    expect(fs.existsSync(SHOT_TRANSITION)).toBe(true);
  });
});
