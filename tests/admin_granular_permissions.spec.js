// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Admin /admin/users — granular Staff permissions across all 5 modules.
 *
 * Contract:
 *  1. The user table renders exactly five permission toggle columns matching
 *     the Staff Panel sidebar: ĐƠN HÀNG, KHO HÀNG, HỘP ẢO, BÀI VIẾT, VOUCHER.
 *  2. Toggling HỘP ẢO (virtual_box) and VOUCHER (vouchers) off for a Staff
 *     account persists via PUT/PATCH /admin/users/:id/permissions.
 *  3. When that Staff logs in, the sidebar hides the revoked modules and the
 *     route guards bounce direct navigation back to /staff.
 *
 * The test is self-contained: it resets the staff account to full permissions
 * before starting and restores them afterwards (try/finally).
 *
 * Screenshots:
 *   successful_test/19_admin_5_permission_toggles_light.png
 *   successful_test/19_admin_5_permission_toggles_dark.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const LIGHT_SHOT = path.join(SHOT_DIR, '19_admin_5_permission_toggles_light.png');
const DARK_SHOT = path.join(SHOT_DIR, '19_admin_5_permission_toggles_dark.png');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tcg.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminSecurePass123!';
const STAFF_EMAIL = process.env.STAFF_EMAIL || 'staff@tcg.com';
const STAFF_PASSWORD = process.env.STAFF_PASSWORD || 'StaffSecurePass123!';

const ALL_PERMISSIONS = { orders: true, inventory: true, virtual_box: true, posts: true, vouchers: true };

const COLUMNS = [
  { key: 'orders', label: 'Đơn hàng' },
  { key: 'inventory', label: 'Kho hàng' },
  { key: 'virtual_box', label: 'Hộp ảo' },
  { key: 'posts', label: 'Bài viết' },
  { key: 'vouchers', label: 'Voucher' }
];

async function apiLogin(request, email, password) {
  const res = await request.post('/api/v1/auth/login', { data: { email, password } });
  expect(res.ok(), `API login ${email}`).toBeTruthy();
  return (await res.json()).data.accessToken;
}

async function findUserId(request, token, email) {
  const res = await request.get(`/api/v1/admin/users?search=${encodeURIComponent(email)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(res.ok(), 'list users').toBeTruthy();
  const items = (await res.json()).data.items || [];
  const user = items.find((u) => u.email === email);
  expect(user, `user ${email} exists`).toBeTruthy();
  return user.id;
}

async function setPermissions(request, token, userId, permissions) {
  const res = await request.patch(`/api/v1/admin/users/${userId}/permissions`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { permissions }
  });
  expect(res.ok(), 'set permissions').toBeTruthy();
  return (await res.json()).data.permissions;
}

async function loginViaUI(page, email, password, waitFor) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.locator('input[type="text"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await Promise.all([
    page.waitForURL(waitFor, { timeout: 30_000 }),
    page.getByRole('button', { name: /đăng nhập|login|logging/i }).first().click()
  ]);
  await page.waitForLoadState('networkidle').catch(() => {});
}

async function logout(page) {
  await page.evaluate(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
    try { sessionStorage.clear(); } catch { /* ignore */ }
  });
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
}

async function ensureLight(page) {
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  if (isDark) {
    await page.getByRole('button', { name: /chuyển sang chế độ sáng|switch to light mode/i }).first().click();
  }
  await expect(page.locator('html')).not.toHaveClass(/dark/);
}

async function ensureDark(page) {
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  if (!isDark) {
    await page.getByRole('button', { name: /chuyển sang chế độ tối|switch to dark mode/i }).first().click();
  }
  await expect(page.locator('html')).toHaveClass(/dark/);
}

test.describe('Admin — 5 granular Staff permission toggles', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
  });

  test('renders 5 module toggles, persists revokes, and hides Staff menus', async ({ page, request }) => {
    const adminToken = await apiLogin(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    const staffId = await findUserId(request, adminToken, STAFF_EMAIL);

    // Start from a known full-access state.
    await setPermissions(request, adminToken, staffId, ALL_PERMISSIONS);

    try {
      // ── 1. Admin logs in and opens User Management ────────────────────
      await loginViaUI(page, ADMIN_EMAIL, ADMIN_PASSWORD, (url) => url.pathname !== '/login');
      await page.goto('/admin/users', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});
      await expect(page.getByRole('heading', { name: /Quản lý người dùng/i })).toBeVisible();

      // ── 2. All five permission columns are rendered ───────────────────
      const headers = page.locator('th[data-permission-column]');
      await expect(headers).toHaveCount(5, { timeout: 20_000 });
      for (const col of COLUMNS) {
        await expect(page.locator(`th[data-permission-column="${col.key}"]`)).toHaveText(new RegExp(col.label, 'i'));
      }
      console.log(`[COLUMNS] rendered ${await headers.count()} permission columns`);

      // ── 3. Locate the Staff row and confirm all toggles start ON ──────
      await page.getByPlaceholder(/Tìm theo email/i).fill(STAFF_EMAIL);
      await page.waitForLoadState('networkidle').catch(() => {});
      const row = page.locator('tr', { hasText: STAFF_EMAIL });
      await expect(row).toBeVisible({ timeout: 15_000 });

      for (const col of COLUMNS) {
        await expect(row.locator(`[data-permission="${col.key}"]`)).toBeChecked({ timeout: 15_000 });
      }
      console.log('[TOGGLES] all 5 staff toggles initially checked');

      // ── 4. Toggle HỘP ẢO and VOUCHER off ──────────────────────────────
      for (const key of ['virtual_box', 'vouchers']) {
        const input = row.locator(`[data-permission="${key}"]`);
        await input.click({ force: true });
        await expect(input).not.toBeChecked({ timeout: 15_000 });
        await page.waitForLoadState('networkidle').catch(() => {});
      }
      await expect(row.locator('[data-permission="orders"]')).toBeChecked();
      await expect(row.locator('[data-permission="inventory"]')).toBeChecked();
      await expect(row.locator('[data-permission="posts"]')).toBeChecked();
      console.log('[TOGGLES] virtual_box + vouchers turned OFF; others untouched');

      // ── 5. Persistence corroboration via API ──────────────────────────
      const persisted = await findUserId(request, adminToken, STAFF_EMAIL);
      const listRes = await request.get(`/api/v1/admin/users?search=${encodeURIComponent(STAFF_EMAIL)}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const staffRow = (await listRes.json()).data.items.find((u) => u.id === persisted);
      expect(staffRow.permissions.virtual_box, 'virtual_box persisted false').toBe(false);
      expect(staffRow.permissions.vouchers, 'vouchers persisted false').toBe(false);
      expect(staffRow.permissions.orders, 'orders unchanged').toBe(true);
      console.log('[VERIFY] backend persisted the revoked toggles');

      // ── 6. Screenshots: light + dark with the 5 toggle columns ────────
      await ensureLight(page);
      await page.waitForTimeout(350);
      await page.screenshot({ path: LIGHT_SHOT, fullPage: false });
      expect(fs.existsSync(LIGHT_SHOT)).toBe(true);
      console.log(`[SHOT] saved ${LIGHT_SHOT}`);

      await ensureDark(page);
      await page.waitForTimeout(350);
      await page.screenshot({ path: DARK_SHOT, fullPage: false });
      expect(fs.existsSync(DARK_SHOT)).toBe(true);
      console.log(`[SHOT] saved ${DARK_SHOT}`);

      // ── 7. Staff logs in and the revoked modules disappear ────────────
      await logout(page);
      // Every role lands on the Homepage after login; open the Staff panel next.
      await loginViaUI(page, STAFF_EMAIL, STAFF_PASSWORD, (url) => url.pathname !== '/login');
      await page.goto('/staff', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});
      const sidebar = page.getByTestId('staff-sidebar');
      await expect(sidebar).toBeVisible({ timeout: 20_000 });

      await expect(sidebar.locator('[data-permission="virtual_box"]')).toHaveCount(0);
      await expect(sidebar.locator('[data-permission="vouchers"]')).toHaveCount(0);
      await expect(sidebar.locator('[data-permission="orders"]')).toHaveCount(1);
      await expect(sidebar.locator('[data-permission="inventory"]')).toHaveCount(1);
      await expect(sidebar.locator('[data-permission="posts"]')).toHaveCount(1);
      await expect(sidebar.getByText('Hộp ảo')).toHaveCount(0);
      console.log('[SIDEBAR] revoked modules hidden; granted modules still visible');

      // ── 8. Route guards bounce direct navigation to revoked modules ───
      for (const route of ['/staff/virtual-boxes', '/staff/vouchers']) {
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle').catch(() => {});
        await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe('/staff');
      }
      // A granted module still resolves normally.
      await page.goto('/staff/products', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});
      await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe('/staff/products');
      console.log('[GUARD] revoked routes redirect; granted route stays');
    } finally {
      // Always leave the staff account at full access for other suites.
      await setPermissions(request, adminToken, staffId, ALL_PERMISSIONS).catch(() => {});
    }
  });
});
