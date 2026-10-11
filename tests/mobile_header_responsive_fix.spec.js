// @ts-check
const { test, expect, devices } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Mobile header responsive fix — E2E verification.
 *
 * The phone top bar must contain ONLY three elements: the store logo (left),
 * the cart icon + badge, and the hamburger menu (right). Language pills,
 * theme switch and the profile dropdown are hidden from the bar on phones and
 * relocated into the slide-out drawer.
 *
 * Viewports: iPhone SE (375x667) and iPhone 14 Pro Max (430x932).
 * Screenshots (strict):
 *  - successful_test/52_mobile_header_clean_fixed.png
 *  - successful_test/52_mobile_drawer_menu_opened.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const SHOT_ROOT = path.join(__dirname, '..', '..', 'successful_test');

const SHOTS = {
  header: '52_mobile_header_clean_fixed.png',
  drawer: '52_mobile_drawer_menu_opened.png'
};

const BENIGN = /favicon|React DevTools|ResizeObserver loop|Download the React|net::ERR_|Failed to load resource|the server responded with a status of (401|403|404)/i;

function trackErrors(page) {
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`); });
  page.on('pageerror', (err) => errors.push(`[pageerror] ${(err && err.message) || err}`));
  return errors;
}
const appErrors = (list) => list.filter((m) => !BENIGN.test(m));

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

async function noOverflow(page, label) {
  const m = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth
  }));
  expect(m.scrollW, `${label}: no horizontal overflow`).toBeLessThanOrEqual(m.clientW + 2);
}

async function assertCleanHeader(page, label) {
  const brand = page.getByTestId('navbar-brand');
  const cart = page.locator('[data-testid="navbar-pill"] a[href="/cart"]').first();
  const menu = page.getByTestId('mobile-menu-toggle');

  await expect(brand, `${label}: logo visible`).toBeVisible();
  await expect(cart, `${label}: cart visible`).toBeVisible();
  await expect(menu, `${label}: hamburger visible`).toBeVisible();

  // Hamburger renders a vector <Menu/> icon (no text glyph).
  await expect(menu.locator('svg')).toBeVisible();
  expect((await menu.innerText()).trim(), `${label}: hamburger has no text`).toBe('');

  // Secondary controls are hidden from the phone top bar.
  await expect(page.locator('[data-testid="navbar-pill"] [role="group"]'), `${label}: language pill hidden`).toBeHidden();
  await expect(
    page.locator('[data-testid="navbar-pill"] button[aria-label*="chế độ"], [data-testid="navbar-pill"] button[aria-label*="mode"]'),
    `${label}: theme toggle hidden`
  ).toBeHidden();
  await expect(
    page.locator('[data-testid="navbar-pill"] a[href="/login"]'),
    `${label}: profile/login hidden from bar`
  ).toBeHidden();

  // 44x44 tap targets.
  for (const [name, loc] of [['cart', cart], ['hamburger', menu]]) {
    const box = await loc.boundingBox();
    expect(box.width, `${label}: ${name} width ≥ 44`).toBeGreaterThanOrEqual(44);
    expect(box.height, `${label}: ${name} height ≥ 44`).toBeGreaterThanOrEqual(44);
  }

  // No overlap between logo and the right-hand action cluster.
  const brandBox = await brand.boundingBox();
  const cartBox = await cart.boundingBox();
  const menuBox = await menu.boundingBox();
  expect(brandBox.x + brandBox.width, `${label}: logo does not overlap cart`).toBeLessThanOrEqual(cartBox.x + 1);
  expect(cartBox.x + cartBox.width, `${label}: cart does not overlap hamburger`).toBeLessThanOrEqual(menuBox.x + 1);

  // Every element stays inside the viewport.
  const vw = await page.evaluate(() => window.innerWidth);
  for (const [name, box] of [['brand', brandBox], ['cart', cartBox], ['menu', menuBox]]) {
    expect(box.x, `${label}: ${name} left ≥ 0`).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width, `${label}: ${name} right ≤ viewport`).toBeLessThanOrEqual(vw + 1);
  }

  await noOverflow(page, label);
}

async function assertDrawer(page, label) {
  const drawer = page.getByTestId('mobile-drawer');
  await expect(drawer, `${label}: drawer visible`).toBeVisible();
  // Let the slide-in transform animation settle before measuring geometry.
  await drawer.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished))).catch(() => {});
  await expect(page.getByTestId('mobile-drawer-backdrop'), `${label}: backdrop visible`).toBeVisible();

  // Middle: main navigation links present.
  const nav = page.getByTestId('mobile-drawer-nav');
  await expect(nav, `${label}: drawer nav visible`).toBeVisible();
  for (const text of ['Trang chủ', 'Cửa hàng', 'Hộp Ảo', 'Tin tức', 'Tra cứu đơn']) {
    await expect(nav.getByText(text, { exact: true }), `${label}: nav "${text}"`).toBeVisible();
  }

  // Top: quick auth (guest) or profile.
  const auth = page.getByTestId('mobile-drawer-auth');
  const profile = page.getByTestId('mobile-drawer-profile');
  expect(await auth.count() + await profile.count(), `${label}: drawer has auth/profile section`).toBeGreaterThan(0);

  // Bottom: settings row with language switcher + theme toggle (Sáng/Tối).
  const settings = page.getByTestId('mobile-drawer-settings');
  await expect(settings, `${label}: settings row visible`).toBeVisible();
  await expect(settings.getByRole('group'), `${label}: language switcher in drawer`).toBeVisible();
  await expect(settings.getByRole('button', { name: /VI/ }), `${label}: VI option`).toBeVisible();
  await expect(settings.getByRole('button', { name: /EN/ }), `${label}: EN option`).toBeVisible();
  await expect(page.getByTestId('mobile-drawer-theme-toggle'), `${label}: theme toggle in drawer`).toBeVisible();
  await expect(page.getByTestId('mobile-drawer-theme-toggle')).toContainText(/Sáng|Tối|Light|Dark/);

  // Drawer hugs the right edge and stays within the viewport.
  const dw = await drawer.boundingBox();
  const vw = await page.evaluate(() => window.innerWidth);
  expect(dw.x, `${label}: drawer starts inside viewport`).toBeGreaterThanOrEqual(0);
  expect(dw.x + dw.width, `${label}: drawer right edge ≤ viewport`).toBeLessThanOrEqual(vw + 1);

  // Settings row sits inside the visible viewport (not pushed below the fold).
  const sb = await settings.boundingBox();
  const vh = await page.evaluate(() => window.innerHeight);
  expect(sb.y + sb.height, `${label}: settings row within viewport`).toBeLessThanOrEqual(vh + 1);

  await noOverflow(page, label);
}

const MOBILE_FLAGS = { isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'vi-VN' };

test.describe('Mobile header — iPhone SE (375px)', () => {
  test.use({ ...MOBILE_FLAGS, viewport: { width: 375, height: 667 }, userAgent: devices['iPhone SE'].userAgent });

  test('top bar shows only logo + cart + hamburger, no overlap', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(400);

    await assertCleanHeader(page, 'SE375');
    await saveShot(page, SHOTS.header);

    // Drawer still works at the narrowest supported width.
    await page.getByTestId('mobile-menu-toggle').tap();
    await assertDrawer(page, 'SE375');
    await page.getByTestId('mobile-drawer-close').tap();
    await expect(page.getByTestId('mobile-drawer')).toHaveCount(0);

    expect(appErrors(errors), 'no console/page errors (SE)').toEqual([]);
  });
});

test.describe('Mobile header — iPhone 14 Pro Max (430px)', () => {
  test.use({ ...MOBILE_FLAGS, viewport: { width: 430, height: 932 }, userAgent: devices['iPhone 14 Pro Max'].userAgent });

  test('hamburger opens a slide-out drawer with nav, language and theme', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(400);

    await assertCleanHeader(page, 'MAX430');

    await page.getByTestId('mobile-menu-toggle').tap();
    await assertDrawer(page, 'MAX430');
    await saveShot(page, SHOTS.drawer);

    // Language switch works inside the drawer (VI → EN).
    const enBtn = page.getByTestId('mobile-drawer-settings').getByRole('button', { name: /EN/ });
    await enBtn.tap();
    await expect(enBtn).toHaveAttribute('aria-pressed', 'true');

    // Theme switch works inside the drawer (light → dark) and flips <html>.
    const themeBtn = page.getByTestId('mobile-drawer-theme-toggle');
    const before = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    await themeBtn.tap();
    await expect.poll(async () => page.evaluate(() => document.documentElement.classList.contains('dark'))).not.toBe(before);

    // No overflow while the drawer is open, and it closes cleanly.
    await noOverflow(page, 'MAX430 drawer open');
    await page.getByTestId('mobile-drawer-close').tap();
    await expect(page.getByTestId('mobile-drawer')).toHaveCount(0);

    expect(appErrors(errors), 'no console/page errors (Pro Max)').toEqual([]);
  });
});
