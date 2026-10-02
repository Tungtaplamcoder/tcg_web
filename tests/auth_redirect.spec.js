// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Auth redirect — EVERY role lands on the Homepage after login.
 *
 * Contract:
 *  1. Submitting the login form with ADMIN credentials navigates to "/" — the
 *     active path immediately after login is strictly the Homepage, never
 *     /admin.
 *  2. Submitting the login form with STAFF credentials navigates to "/" — the
 *     active path immediately after login is strictly the Homepage, never
 *     /staff.
 *  3. The storefront Topbar keeps the role management link ("Khu vực Admin" /
 *     "Khu vực Staff") so the panel is still one click away.
 *
 * Screenshots:
 *   successful_test/12_admin_login_redirect_homepage.png
 *   successful_test/12_staff_login_redirect_homepage.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const ADMIN_SHOT = path.join(SHOT_DIR, '12_admin_login_redirect_homepage.png');
const STAFF_SHOT = path.join(SHOT_DIR, '12_staff_login_redirect_homepage.png');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tcg.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminSecurePass123!';
const STAFF_EMAIL = process.env.STAFF_EMAIL || 'staff@tcg.com';
const STAFF_PASSWORD = process.env.STAFF_PASSWORD || 'StaffSecurePass123!';

/** Current SPA pathname, e.g. "/" or "/admin". */
const activePath = (page) => new URL(page.url()).pathname;

/**
 * Submit the real login form and wait until the client-side redirect settles.
 * We intentionally do NOT wait for a role panel — the redirect target is the
 * Homepage for every role now.
 */
async function submitLogin(page, identifier, password) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.locator('input[type="text"]').first().fill(identifier);
  await page.locator('input[type="password"]').first().fill(password);
  await Promise.all([
    page.waitForURL((url) => url.pathname === '/', { timeout: 30_000 }),
    page.getByRole('button', { name: /đăng nhập|login|logging/i }).first().click()
  ]);
  await page.waitForLoadState('networkidle').catch(() => {});
}

/** Reset the seeded staff password to a known value via the admin API so the
 *  E2E login is self-contained and repeatable. */
async function ensureStaffPassword(request) {
  const adminLogin = await request.post('/api/v1/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });
  expect(adminLogin.ok(), 'admin login for test setup').toBeTruthy();
  const adminToken = (await adminLogin.json()).data.accessToken;

  const list = await request.get(`/api/v1/admin/users?search=${encodeURIComponent(STAFF_EMAIL)}`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  expect(list.ok(), 'list users').toBeTruthy();
  const items = (await list.json()).data.items || [];
  const staff = items.find((u) => u.email === STAFF_EMAIL);
  expect(staff, `staff user ${STAFF_EMAIL} exists`).toBeTruthy();

  const patch = await request.patch(`/api/v1/admin/users/${staff.id}/password`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { newPassword: STAFF_PASSWORD }
  });
  expect(patch.ok(), 'set staff password').toBeTruthy();
}

test.describe('Auth redirect — all roles land on the Homepage', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeAll(async ({ request }) => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    await ensureStaffPassword(request);
  });

  test('admin login redirects to homepage (/)', async ({ page }) => {
    await submitLogin(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    // Strict: the active path right after login is the Homepage, not /admin.
    expect(activePath(page), 'admin active path after login').toBe('/');

    // The storefront chrome is present and the admin panel stays one click away.
    await expect(page.getByTestId('site-header')).toBeVisible();
    await expect(page.getByRole('link', { name: /Khu vực Admin|Admin Portal/i }).first()).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    await page.screenshot({ path: ADMIN_SHOT, fullPage: true });
    expect(fs.existsSync(ADMIN_SHOT)).toBe(true);
    console.log(`[SHOT] saved ${ADMIN_SHOT}`);
  });

  test('staff login redirects to homepage (/)', async ({ page }) => {
    await submitLogin(page, STAFF_EMAIL, STAFF_PASSWORD);

    // Strict: the active path right after login is the Homepage, not /staff.
    expect(activePath(page), 'staff active path after login').toBe('/');

    // The storefront chrome is present and the staff panel stays one click away.
    await expect(page.getByTestId('site-header')).toBeVisible();
    await expect(page.getByRole('link', { name: /Khu vực Staff|Staff Portal/i }).first()).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    await page.screenshot({ path: STAFF_SHOT, fullPage: true });
    expect(fs.existsSync(STAFF_SHOT)).toBe(true);
    console.log(`[SHOT] saved ${STAFF_SHOT}`);
  });
});
