// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Staff panel — Editorial unification with the Admin panel.
 *
 * Contract:
 *  1. /staff renders the SAME editorial shell as /admin: seamless transparent
 *     header, white rounded (w-72) sidebar with the logo block on top, nav
 *     directly below the logo, and the user profile block anchored at the
 *     BOTTOM of the sidebar.
 *  2. The dashboard exposes exactly ONE title ("Tổng quan công việc") plus a
 *     subtitle ("Công việc cần xử lý trong ngày"). The legacy colliding
 *     strings ("Bảng điều khiển Staff" / duplicated "Tổng quan") are gone and
 *     no text elements overlap in the header/title area.
 *  3. Structure matches /admin in both light and dark modes.
 *
 * Screenshots:
 *   successful_test/10_staff_editorial_panel_light.png
 *   successful_test/10_staff_editorial_panel_dark.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const SHOT_LIGHT = path.join(SHOT_DIR, '10_staff_editorial_panel_light.png');
const SHOT_DARK = path.join(SHOT_DIR, '10_staff_editorial_panel_dark.png');

const THEME_KEY = 'tcg-theme';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tcg.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminSecurePass123!';
const STAFF_EMAIL = process.env.STAFF_EMAIL || 'staff@tcg.com';
const STAFF_PASSWORD = process.env.STAFF_PASSWORD || 'StaffSecurePass123!';

/** UI login through the real form; returns once the role redirect settles. */
async function loginAs(page, email, password, urlPattern) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.locator('input[type="text"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await Promise.all([
    page.waitForURL(urlPattern, { timeout: 30_000 }),
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

/** True when two axis-aligned rectangles overlap (with an optional tolerance). */
function toRect(box) {
  if (!box) return null;
  return { left: box.x, top: box.y, right: box.x + box.width, bottom: box.y + box.height };
}

function rectsOverlap(a, b, tolerance = 0) {
  if (!a || !b) return false;
  return !(
    a.right - tolerance <= b.left ||
    a.left + tolerance >= b.right ||
    a.bottom - tolerance <= b.top ||
    a.top + tolerance >= b.bottom
  );
}

async function metrics(page, testId) {
  return page.getByTestId(testId).evaluate((el) => {
    const card = el.querySelector(':scope > div') || el;
    const box = card.getBoundingClientRect();
    const cs = getComputedStyle(card);
    return {
      width: Math.round(box.width),
      radius: parseFloat(cs.borderTopLeftRadius),
      x: Math.round(box.x),
      top: Math.round(box.top)
    };
  });
}

test.describe('Staff panel — editorial unification with Admin', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeAll(async ({ request }) => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    await ensureStaffPassword(request);
  });

  test('staff dashboard mirrors admin editorial shell (light + dark)', async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('[console.error]', msg.text());
    });

    // Force a deterministic light start for the light screenshot.
    await page.addInitScript(([key, value]) => {
      try { window.localStorage.setItem(key, value); } catch (e) { /* no-op */ }
    }, [THEME_KEY, 'light']);

    // ── 1. Log in as Staff User and land on /staff ─────────────────────
    await loginAs(page, STAFF_EMAIL, STAFF_PASSWORD, /\/staff(\/.*)?$/);
    await expect(page).toHaveURL(/\/staff(\/.*)?$/);
    await expect(page.getByTestId('staff-shell')).toBeVisible();
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    // ── 2. No overlapping text / no duplicated legacy header strings ───
    await expect(page.getByText('Bảng điều khiển Staff', { exact: false })).toHaveCount(0);

    const header = page.getByTestId('staff-header-banner');
    await expect(header).toBeVisible();
    const headerText = (await header.innerText()).trim();
    expect(headerText).not.toMatch(/Tổng quan/i);
    expect(headerText).not.toMatch(/Bảng điều khiển Staff/i);

    const title = page.getByTestId('staff-page-title');
    await expect(title).toBeVisible();
    await expect(title).toHaveText('Tổng quan công việc');

    const subtitle = page.getByTestId('staff-page-header').getByText('Công việc cần xử lý trong ngày');
    await expect(subtitle).toBeVisible();

    const titleBox = toRect(await title.boundingBox());
    const subtitleBox = toRect(await subtitle.boundingBox());
    const headerBox = toRect(await header.boundingBox());
    expect(titleBox, 'title has a box').toBeTruthy();
    expect(subtitleBox, 'subtitle has a box').toBeTruthy();
    expect(headerBox, 'header has a box').toBeTruthy();

    // Stacked full-width block elements sit flush; allow a sub-pixel tolerance.
    const STACK_TOLERANCE = 2;
    expect(
      rectsOverlap(titleBox, subtitleBox, STACK_TOLERANCE),
      `title overlaps subtitle: ${JSON.stringify({ titleBox, subtitleBox })}`
    ).toBeFalsy();
    expect(
      rectsOverlap(titleBox, headerBox, STACK_TOLERANCE),
      `title overlaps header: ${JSON.stringify({ titleBox, headerBox })}`
    ).toBeFalsy();

    // The single title must not appear more than once in the dashboard.
    await expect(page.getByText('Tổng quan công việc', { exact: true })).toHaveCount(1);
    console.log('[OVERLAP] title/subtitle/header do not collide');

    // ── 3. Sidebar: logo on top, nav below it, profile at the BOTTOM ───
    const sidebar = page.getByTestId('staff-sidebar');
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByText('Khu vực Staff')).toBeVisible();

    const profile = page.getByTestId('staff-sidebar-profile');
    await expect(profile).toBeVisible();
    await expect(profile).toContainText('Staff User');
    await expect(profile).toContainText(STAFF_EMAIL);

    const sidebarBox = await sidebar.boundingBox();
    const profileBox = await profile.boundingBox();
    const logoBox = await sidebar.getByText('Khu vực Staff').boundingBox();

    expect(profileBox, 'profile box').toBeTruthy();
    expect(logoBox, 'logo box').toBeTruthy();

    // Profile is in the lower portion of the sidebar and below the logo.
    const sidebarBottom = sidebarBox.y + sidebarBox.height;
    expect(profileBox.y).toBeGreaterThan(sidebarBox.y + sidebarBox.height * 0.6);
    expect(profileBox.y + profileBox.height).toBeLessThanOrEqual(sidebarBottom + 2);
    expect(profileBox.y).toBeGreaterThan(logoBox.y + logoBox.height);
    console.log(
      `[SIDEBAR] sidebar=[${sidebarBox.y},${sidebarBottom}] logoY=${logoBox.y} profileY=${profileBox.y}`
    );

    // No storefront chrome on the staff route.
    await expect(page.getByTestId('site-header')).toBeHidden();
    await expect(page.getByTestId('navbar-pill')).toBeHidden();

    // ── 4. Light-mode screenshot ───────────────────────────────────────
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    await page.screenshot({ path: SHOT_LIGHT, fullPage: true });
    expect(fs.existsSync(SHOT_LIGHT)).toBe(true);
    console.log(`[SHOT] saved ${SHOT_LIGHT}`);

    // ── 5. Dark mode — toggle, verify, screenshot ──────────────────────
    await page.getByRole('button', { name: /chuyển sang chế độ tối|switch to dark/i }).first().click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.waitForTimeout(400);
    await expect(title).toBeVisible();
    await page.screenshot({ path: SHOT_DARK, fullPage: true });
    expect(fs.existsSync(SHOT_DARK)).toBe(true);
    console.log(`[SHOT] saved ${SHOT_DARK}`);

    // ── 6. Structural parity with the Admin panel (same run) ───────────
    const staffSidebarMetrics = await metrics(page, 'staff-sidebar');
    const staffHeader = await header.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, borderTopWidth: cs.borderTopWidth, className: el.className };
    });
    expect(staffHeader.bg).toBe('rgba(0, 0, 0, 0)');
    expect(parseFloat(staffHeader.borderTopWidth)).toBe(0);
    expect(staffHeader.className).toContain('bg-transparent');
    expect(staffHeader.className).toContain('border-none');

    await page.getByTestId('staff-sidebar').getByRole('button', { name: /đăng xuất|logout/i }).click();
    await page.waitForURL(/\/$/, { timeout: 30_000 }).catch(() => {});
    await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, /\/admin(\/.*)?$/);
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    const adminSidebarMetrics = await metrics(page, 'admin-sidebar');
    const adminHeader = page.getByTestId('admin-header-banner');
    const adminHeaderClasses = await adminHeader.evaluate((el) => el.className);

    expect(staffSidebarMetrics.width).toBe(adminSidebarMetrics.width);
    expect(staffSidebarMetrics.radius).toBe(adminSidebarMetrics.radius);
    expect(staffSidebarMetrics.radius).toBeGreaterThanOrEqual(12);
    expect(staffHeader.className).toBe(adminHeaderClasses);
    console.log(
      `[PARITY] staff=${JSON.stringify(staffSidebarMetrics)} admin=${JSON.stringify(adminSidebarMetrics)}`
    );
  });
});
