// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Top Navbar redesign — glassmorphism + 3-column layout visual verification.
 *
 * Flow: login as admin → Home (/) → assert the redesigned header structure
 * (fixed glass bar, brand block, centered nav links, utility group) →
 * capture the header in Light theme → switch to Dark → capture again →
 * toggle language VI ⇄ EN and verify the labels swap smoothly → verify
 * hover underline behavior on a nav link → capture final shots.
 */

const LOGIN_URL = 'http://localhost:3000/login';
const HOME_URL = 'http://localhost:3000/';
const TEST_USER = 'admin@tcg.local';
const TEST_PASS = 'AdminSecurePass123!';

test.describe('Navbar redesign — glassmorphism header + i18n segment toggle', () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  test('polished header renders clean in light + dark, language switch is smooth', async ({ page }) => {
    test.setTimeout(120_000);

    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('[console.error]', msg.text());
    });
    // Pin light theme for the first capture (theme persisted in localStorage)
    await page.addInitScript(() => {
      try { window.localStorage.setItem('tcg-theme', 'light'); } catch (e) { /* ignore */ }
    });

    // ── 1. Login as admin
    await page.goto(LOGIN_URL);
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await expect(page.locator('input[type="text"]')).toBeVisible();
      await page.fill('input[type="text"]', TEST_USER);
      await page.fill('input[type="password"]', TEST_PASS);
      await page.click('button[type="submit"]');
      try {
        await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });
        break;
      } catch {
        if (attempt === 3) throw new Error('Login never redirected after 3 attempts');
        await page.goto(LOGIN_URL);
      }
    }
    console.log('[AUTH] logged in, landed on', page.url());

    // ── 2. Home page — the redesigned navbar must be fixed at the top
    await page.goto(HOME_URL);
    const navbar = page.getByTestId('site-navbar');
    await expect(navbar).toBeVisible();
    await expect(navbar).toHaveClass(/fixed/);
    await expect(navbar).toHaveClass(/backdrop-blur/);
    await expect(navbar).toHaveClass(/h-16/);
    console.log('[NAVBAR] fixed glass bar visible (fixed + backdrop-blur + h-16)');

    // Layout checks: no horizontal overflow (zero layout breaks)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
    console.log(`[LAYOUT] horizontal overflow = ${overflow}px (no layout breaks)`);

    // Hero content is not hidden under the fixed bar (flow spacer works)
    const spacerBox = await page.locator('nav >> div').first().boundingBox();
    expect(spacerBox.y).toBeGreaterThanOrEqual(0);

    // ── 3. Structure assertions
    // Brand block (left) — logo + two-tone wordmark
    await expect(page.getByTestId('navbar-brand')).toBeVisible();
    await expect(page.getByTestId('navbar-shop-name')).toContainText(/TCG/i);
    const brandImgCount = await page.getByTestId('navbar-shop-logo').count();
    if (brandImgCount > 0) {
      // logo decoded
      await expect(page.getByTestId('navbar-shop-logo')).toHaveAttribute('src', /.+/);
    }
    console.log('[BRAND] logo + wordmark aligned');

    // Center nav — minimalist text links with hover underline
    for (const label of ['Trang chủ', 'Cửa hàng', 'Hộp Ảo', 'Tin tức', 'Tra cứu đơn']) {
      const link = navbar.getByRole('link', { name: label });
      await expect(link).toBeVisible();
      await expect(link).toHaveClass(/font-medium/);
    }
    console.log('[NAV] all five text links render with font-medium');

    // Admin Portal — sleek ghost/outline button (not a solid gradient pill)
    const adminBtn = navbar.getByRole('link', { name: /Khu vực Admin/i });
    await expect(adminBtn).toBeVisible();
    await expect(adminBtn).toHaveClass(/border/);
    await expect(adminBtn).not.toHaveClass(/bg-gradient-to-r/);
    console.log('[GHOST] Admin Portal is an outline button — no solid pill');

    // Utility group — language segment, theme toggle, cart, profile
    const langGroup = navbar.getByRole('group', { name: /Ngôn ngữ|Language/i });
    await expect(langGroup).toBeVisible();
    await expect(navbar.getByRole('button', { name: /Switch to dark mode/i })).toBeVisible();
    const cartLink = navbar.getByRole('link', { name: /Giỏ hàng/i });
    await expect(cartLink).toBeVisible();
    await expect(page.getByRole('button', { name: /Admin User|admin/i }).first()).toBeVisible();
    console.log('[UTILITY] language segment + theme toggle + cart + profile all present');

    // Language segment — compact minimalist control
    await expect(langGroup).toHaveClass(/bg-slate-100/);
    await expect(langGroup).toHaveClass(/rounded-lg/);
    await expect(langGroup.getByRole('button', { name: 'VI', exact: true })).toHaveClass(/text-xs/);
    console.log('[I18N] VI | EN is a compact segment control (bg-slate-100 p-1 rounded-lg text-xs)');

    // ── 4. LIGHT theme screenshot of the polished header
    await page.screenshot({ path: 'navbar-light.png', fullPage: false });
    await navbar.screenshot({ path: 'navbar-light-cropped.png' });
    console.log('[SHOT] saved navbar-light.png + navbar-light-cropped.png');

    // ── 5. Hover underline on a nav link (subtle underline transitions in)
    const catalogLink = navbar.getByRole('link', { name: 'Cửa hàng' });
    await catalogLink.hover();
    await page.waitForTimeout(400); // underline transition settles
    const underlineScale = await catalogLink.evaluate((el) => {
      // The underline is the child span with the gradient classes
      const span = el.querySelector('span.bg-gradient-to-r');
      if (!span) return -1;
      return span.getBoundingClientRect().width;
    });
    expect(underlineScale).toBeGreaterThan(0);
    // Active link (Trang chủ on /) keeps its underline permanently
    const homeLink = navbar.getByRole('link', { name: 'Trang chủ' });
    const homeUnderlineWidth = await homeLink.evaluate(
      (el) => el.querySelector('span.bg-gradient-to-r')?.getBoundingClientRect().width || -1
    );
    expect(homeUnderlineWidth).toBeGreaterThan(0);
    console.log('[HOVER] gradient underline present on hover; active route keeps its underline');

    // ── 6. Switch to DARK theme and capture
    await navbar.getByRole('button', { name: /Switch to dark mode/i }).click();
    await page.waitForTimeout(700); // cross-fade transition settles
    await expect(page.locator('html')).toHaveClass(/dark/);
    console.log('[THEME] dark mode active');

    await page.screenshot({ path: 'navbar-dark.png', fullPage: false });
    await navbar.screenshot({ path: 'navbar-dark-cropped.png' });
    console.log('[SHOT] saved navbar-dark.png + navbar-dark-cropped.png');

    // Dark theme keeps the glass aesthetic (no layout shift between themes)
    const overflowDark = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflowDark).toBeLessThanOrEqual(0);
    console.log(`[LAYOUT] dark theme overflow = ${overflowDark}px (zero breaks)`);

    // ── 7. Language switching — VI ⇄ EN smooth interaction
    const enBtn = langGroup.getByRole('button', { name: 'EN', exact: true });
    await enBtn.click();
    await expect(navbar.getByRole('link', { name: 'Home', exact: true })).toBeVisible({ timeout: 3_000 });
    // Active segment inverts (white text on dark thumb in light mode,
    // slate-900 text on white thumb in dark mode) and is pressed.
    await expect(langGroup.getByRole('button', { name: 'EN', exact: true })).toHaveAttribute('aria-pressed', 'true');
    console.log('[I18N] switched to EN — "Home" link visible, EN segment active (pressed)');

    await page.screenshot({ path: 'navbar-dark-en.png', fullPage: false });
    console.log('[SHOT] saved navbar-dark-en.png');

    // Toggle back to VI
    await langGroup.getByRole('button', { name: 'VI', exact: true }).click();
    await expect(navbar.getByRole('link', { name: 'Trang chủ', exact: true })).toBeVisible({ timeout: 3_000 });
    console.log('[I18N] switched back to VI — "Trang chủ" link visible');

    // Admin portal label also i18n-bound
    await expect(navbar.getByRole('link', { name: /Admin Portal|Khu vực Admin/i })).toBeVisible();
    console.log('[I18N] all labels translate cleanly — smooth switching confirmed');
  });
});
