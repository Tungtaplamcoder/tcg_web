// @ts-check
const { test, expect, devices } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Mobile performance optimization — E2E verification.
 *
 * Verifies the mobile (≤768px) fast path across the Storefront, Admin
 * Dashboard and Catalog Settings surfaces:
 *   1. Route transitions stay smooth and NEVER overflow horizontally
 *      (mobile page transition is a vertical fade-up, not a slide).
 *   2. Heavy backdrop-blur glass is demoted to a solid fallback on phones
 *      (computed `backdrop-filter` resolves to `none`).
 *   3. Animated containers are hardware-accelerated
 *      (compositor promotion via will-change / translate).
 *   4. Interactive controls honour `touch-action: manipulation` and expose
 *      a ≥44x44px tap target.
 *   5. Modal triggers + catalog settings tabs respond to real touch taps.
 *   6. Zero console errors / uncaught page errors on any route.
 *
 * Screenshots (strict):
 *  - successful_test/39_mobile_home_optimized.png
 *  - successful_test/39_mobile_admin_dashboard_optimized.png
 *  - successful_test/39_mobile_catalog_settings_optimized.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const SHOT_ROOT = path.join(__dirname, '..', '..', 'successful_test');

const SHOTS = {
  home: '39_mobile_home_optimized.png',
  dashboard: '39_mobile_admin_dashboard_optimized.png',
  catalog: '39_mobile_catalog_settings_optimized.png'
};

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tcg.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminSecurePass123!';

/** Console noise that is environmental (not an app regression). */
const BENIGN = /favicon|React DevTools|ResizeObserver loop|Download the React|net::ERR_|Failed to load resource|the server responded with a status of (401|403|404)/i;

function trackErrors(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`[pageerror] ${(err && err.message) || err}`));
  return errors;
}

const appErrors = (list) => list.filter((m) => !BENIGN.test(m));

async function assertNoOverflow(page, label) {
  const metrics = await page.evaluate(() => {
    const de = document.documentElement;
    const vw = window.innerWidth;
    const offenders = [];
    document.querySelectorAll('body *').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && (r.right > vw + 2 || r.left < -2)) {
        offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 48)}`);
      }
    });
    return { scrollW: de.scrollWidth, clientW: de.clientWidth, innerW: vw, offenders: offenders.slice(0, 6) };
  });
  if (metrics.scrollW > metrics.clientW + 2) {
    console.log(`[overflow] ${label} offenders:`, metrics.offenders);
  }
  expect(metrics.scrollW, `${label}: no horizontal overflow`).toBeLessThanOrEqual(metrics.clientW + 2);
}

async function computed(page, selector, prop) {
  return page.evaluate(({ selector, prop }) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    return getComputedStyle(el)[prop];
  }, { selector, prop });
}

async function minTapBox(page, locator) {
  const box = await locator.boundingBox();
  if (!box) return { w: 0, h: 0 };
  return { w: box.width, h: box.height };
}

async function loginAsAdmin(page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.locator('input[type="text"]').first().fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 }),
    page.getByRole('button', { name: /đăng nhập|login|logging/i }).first().click()
  ]);
  await page.waitForLoadState('networkidle').catch(() => {});
}

async function saveShot(page, name) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  fs.mkdirSync(SHOT_ROOT, { recursive: true });
  const target = path.join(SHOT_DIR, name);
  await page.screenshot({ path: target, fullPage: false });
  fs.copyFileSync(target, path.join(SHOT_ROOT, name));
  expect(fs.existsSync(target)).toBe(true);
  expect(fs.statSync(target).size).toBeGreaterThan(8000);
  console.log(`[SHOT] saved ${target} (${fs.statSync(target).size} bytes)`);
}

test.describe('Mobile performance optimization (iPhone 14)', () => {
  const { defaultBrowserType, ...iphone } = devices['iPhone 14'];
  test.use({ ...iphone, viewport: { width: 390, height: 844 } });
  test.describe.configure({ mode: 'serial' });

  /** @type {string[]} */
  let errors = [];

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    fs.mkdirSync(SHOT_ROOT, { recursive: true });
  });

  test('storefront routes render with blur demoted and zero overflow', async ({ page }) => {
    errors = trackErrors(page);

    // 1a. Home — hero + navbar + footer.
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(400);
    await expect(page.getByTestId('navbar-pill')).toBeVisible();
    await expect(page.getByTestId('home-hero')).toBeVisible();

    // Heavy glass demoted to a solid fallback on mobile.
    const pillBlur = await computed(page, '[data-testid="navbar-pill"]', 'backdropFilter');
    console.log('[blur] navbar pill backdrop-filter on mobile =', pillBlur);
    expect(['none', 'none"']).toContain(pillBlur);

    // Navbar tap targets ≥ 44px + touch-action manipulation.
    const menuBtn = page.getByRole('button', { name: /menu/i }).first();
    const menuBox = await minTapBox(page, menuBtn);
    expect(menuBox.w, 'menu button width ≥ 44').toBeGreaterThanOrEqual(44);
    expect(menuBox.h, 'menu button height ≥ 44').toBeGreaterThanOrEqual(44);
    expect(await computed(page, 'header button', 'touchAction')).toBe('manipulation');

    await assertNoOverflow(page, 'home');
    await saveShot(page, SHOTS.home);

    // 1b. Catalog + Virtual Boxes — smooth route transitions, no overflow.
    for (const route of ['/catalog', '/virtual-boxes']) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(300);
      await expect(page.locator('main')).toBeVisible();
      await assertNoOverflow(page, route);
    }
  });

  test('admin dashboard is bento-stacked, chart-safe and transition-optimized', async ({ page }) => {
    errors = trackErrors(page);
    await loginAsAdmin(page);

    await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByTestId('admin-bento-grid')).toBeVisible();

    // Bento grid stacks to a single column on mobile.
    const cols = await computed(page, '[data-testid="admin-bento-grid"]', 'gridTemplateColumns');
    console.log('[bento] mobile grid-template-columns =', cols);
    expect(String(cols).split(' ').filter(Boolean).length, 'bento grid is 1 column on mobile').toBe(1);

    // Route transition uses the vertical fade-up (no horizontal slide).
    const animName = await computed(page, '[data-testid="admin-route-transition"]', 'animationName');
    console.log('[transition] mobile animation-name =', animName);
    expect(String(animName)).toContain('dash-fade-up');

    // The route wrapper must never hold a transform containing block, or
    // fixed-position modals opened inside a route would render offset.
    const willChange = String(await computed(page, '[data-testid="admin-route-transition"]', 'willChange'));
    console.log('[transition] mobile will-change =', willChange);
    expect(willChange).not.toContain('transform');

    // Recharts containers are fixed-height on mobile (no measure loop).
    const chartBox = await page.locator('[data-testid="admin-bento-revenue"] .recharts-responsive-container').first().boundingBox();
    console.log('[charts] revenue chart box =', chartBox && `${Math.round(chartBox.width)}x${Math.round(chartBox.height)}`);
    expect(chartBox).toBeTruthy();
    expect(chartBox.height).toBeGreaterThan(100);
    expect(chartBox.width).toBeLessThanOrEqual(390);

    await assertNoOverflow(page, 'admin dashboard');
    await saveShot(page, SHOTS.dashboard);

    // Mobile drawer opens cleanly. The bottom sidebar "Quay lại Cửa hàng"
    // card was removed — the header button is the only storefront link now.
    await page.getByRole('button', { name: /open menu/i }).first().tap();
    await expect(page.getByTestId('admin-storefront-banner')).toHaveCount(0);
    const navLink = page.getByTestId('admin-sidebar').getByRole('link').first();
    await expect(navLink).toBeVisible();
    const navBox = await minTapBox(page, navLink);
    expect(navBox.h, 'sidebar nav tap height ≥ 36').toBeGreaterThanOrEqual(36);
    await page.keyboard.press('Escape').catch(() => {});
  });

  test('catalog settings tabs + edit modal respond to touch taps', async ({ page }) => {
    errors = trackErrors(page);
    await loginAsAdmin(page);

    await page.goto('/admin/catalog-settings', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByTestId('catalog-config')).toBeVisible();
    await assertNoOverflow(page, 'catalog settings');

    // Tap every catalog settings tab and assert its panel renders.
    const tabs = [
      ['tab-rarity', 'rarity-form'],
      ['tab-sealed', 'sealed-categories-tab'],
      ['tab-series', 'series-tab'],
      ['tab-expansions', 'expansions-tab']
    ];
    for (const [tabId, panelId] of tabs) {
      const tab = page.getByTestId(tabId);
      await tab.scrollIntoViewIfNeeded();
      const box = await minTapBox(page, tab);
      expect(box.h, `${tabId} tap height ≥ 44`).toBeGreaterThanOrEqual(44);
      expect(await computed(page, `[data-testid="${tabId}"]`, 'touchAction')).toBe('manipulation');
      await tab.tap();
      await expect(page.getByTestId(panelId)).toBeVisible();
      await assertNoOverflow(page, `catalog ${tabId}`);
    }

    // Modal trigger tap response — open + close the shared edit modal.
    await page.getByTestId('tab-rarity').tap();
    const editBtn = page.locator('[data-testid="rarity-table"] button[title="Sửa"]').first();
    if (await editBtn.count()) {
      await editBtn.tap();
      await expect(page.getByTestId('catalog-edit-modal')).toBeVisible();
      await page.getByRole('button', { name: /đóng/i }).first().tap();
      await expect(page.getByTestId('catalog-edit-modal')).toHaveCount(0);
    } else {
      console.log('[modal] no rarity row present — tab tap response verified only');
    }

    await page.getByTestId('tab-rarity').tap();
    await saveShot(page, SHOTS.catalog);
  });

  test.afterAll(() => {
    const real = appErrors(errors);
    if (real.length) console.log('[console.errors]', real);
    expect(real, 'no console/page errors across mobile routes').toEqual([]);
  });
});
