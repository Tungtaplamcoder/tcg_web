// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Admin /admin/users — Delete user with STRICT 2-step confirmation.
 *
 * Contract:
 *  1. The old "Ban" action (prohibition icon / svg.lucide-ban) is GONE from
 *     the row actions and is replaced by a red Trash (svg.lucide-trash-2)
 *     delete action, available for every role (Customer / Staff / co-Admin).
 *  2. The logged-in admin's OWN row keeps the trash button DISABLED
 *     (self-deletion guard).
 *  3. Clicking the trash opens Step 1 ("Xác nhận xóa tài khoản").
 *     "Tiếp tục xóa" transitions to Step 2 with a strict keyword gate:
 *     the "Xóa vĩnh viễn" button stays disabled until DELETE/XÓA is typed.
 *  4. Confirming calls DELETE /admin/users/:id, shows the success toast
 *     "Đã xóa tài khoản thành công" and removes the row.
 *
 * Screenshots:
 *   successful_test/13_admin_user_delete_step1_modal.png
 *   successful_test/13_admin_user_delete_step2_modal.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const SHOT_STEP1 = path.join(SHOT_DIR, '13_admin_user_delete_step1_modal.png');
const SHOT_STEP2 = path.join(SHOT_DIR, '13_admin_user_delete_step2_modal.png');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tcg.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminSecurePass123!';

const TEST_PREFIX = 'e2e-delete-';

/** UI login through the real form; every role lands on the Homepage first. */
async function loginAsAdmin(page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.locator('input[type="text"]').first().fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
  await Promise.all([
    page.waitForURL((url) => url.pathname === '/', { timeout: 30_000 }),
    page.getByRole('button', { name: /đăng nhập|login|logging/i }).first().click()
  ]);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.goto('/admin/users', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
}

/** Admin API login → returns a bearer token for setup/teardown requests. */
async function adminToken(request) {
  const res = await request.post('/api/v1/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });
  expect(res.ok(), 'admin API login').toBeTruthy();
  return (await res.json()).data.accessToken;
}

/** Hard-delete any leftover e2e test users so phone/email stay unique. */
async function purgeTestUsers(request, token) {
  const list = await request.get(`/api/v1/admin/users?limit=100&search=${TEST_PREFIX}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!list.ok()) return;
  const items = (await list.json()).data.items || [];
  for (const u of items) {
    if (!String(u.email || '').startsWith(TEST_PREFIX)) continue;
    await request.delete(`/api/v1/admin/users/${u.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }
}

/** Register a fresh deletable customer via the public API. */
async function createTestUser(request) {
  const stamp = Date.now();
  const email = `${TEST_PREFIX}${stamp}@tcg.local`;
  const phone = '09' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
  const res = await request.post('/api/v1/auth/register', {
    data: {
      email,
      phone,
      fullName: `E2E Delete ${stamp}`,
      password: 'TestPass123',
      confirmPassword: 'TestPass123'
    }
  });
  expect(res.ok(), 'register deletable test user').toBeTruthy();
  return { email, phone };
}

test.describe('Admin user delete — strict 2-step confirmation', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeAll(async ({ request }) => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    const token = await adminToken(request);
    await purgeTestUsers(request, token);
  });

  test('trash action + 2-step modal deletes the user', async ({ page, request }) => {
    const token = await adminToken(request);
    const testUser = await createTestUser(request);

    // ── 1. Log in and open the User Management page ─────────────────────
    await loginAsAdmin(page);
    await expect(page.getByRole('heading', { name: /Quản lý người dùng/i })).toBeVisible();

    // ── 2. Trash replaces Ban across the table; self-row stays disabled ──
    const firstDeleteBtn = page.locator('[data-testid="delete-user-btn"]').first();
    await expect(firstDeleteBtn).toBeVisible({ timeout: 20_000 });
    expect(await page.locator('svg.lucide-ban').count(), 'no Ban icon remains').toBe(0);
    const trashSvgCount = await page.locator('[data-testid="delete-user-btn"] svg[class*="trash"]').count();
    expect(trashSvgCount, 'trash icons present').toBeGreaterThan(0);
    console.log(`[ACTIONS] delete buttons=${await page.locator('[data-testid="delete-user-btn"]').count()} trash svgs=${trashSvgCount}`);

    const adminRow = page.locator('tr', { hasText: ADMIN_EMAIL });
    await expect(adminRow.locator('[data-testid="delete-user-btn"]')).toBeDisabled();
    console.log('[GUARD] admin self-delete button is disabled');

    // ── 3. Locate the freshly created test user row ─────────────────────
    await page.getByPlaceholder(/Tìm theo email/i).fill(testUser.email);
    await page.waitForLoadState('networkidle').catch(() => {});
    const row = page.locator('tr', { hasText: testUser.email });
    await expect(row).toBeVisible({ timeout: 15_000 });

    // ── 4. Step 1 modal ─────────────────────────────────────────────────
    await row.locator('[data-testid="delete-user-btn"]').click();
    const step1 = page.getByTestId('delete-user-modal-step1');
    await expect(step1).toBeVisible();
    await expect(step1).toContainText('Xác nhận xóa tài khoản');
    await expect(step1).toContainText(testUser.email);
    await expect(step1.getByTestId('delete-proceed-btn')).toHaveText(/Tiếp tục xóa/i);
    await page.waitForTimeout(250);
    await page.screenshot({ path: SHOT_STEP1 });
    expect(fs.existsSync(SHOT_STEP1)).toBe(true);
    console.log(`[SHOT] saved ${SHOT_STEP1}`);

    // ── 5. Step 2 modal — strict keyword gate ───────────────────────────
    await step1.getByTestId('delete-proceed-btn').click();
    const step2 = page.getByTestId('delete-user-modal-step2');
    await expect(step2).toBeVisible();
    await expect(step2).toContainText('Cảnh báo xác nhận lần 2');
    await expect(step2).toContainText('KHÔNG THỂ KHÔI PHỤC');

    const confirmBtn = step2.getByTestId('delete-confirm-btn');
    await expect(confirmBtn).toBeDisabled();
    await step2.getByTestId('delete-confirm-input').fill('DEL');
    await expect(confirmBtn).toBeDisabled();
    await page.waitForTimeout(250);
    await page.screenshot({ path: SHOT_STEP2 });
    expect(fs.existsSync(SHOT_STEP2)).toBe(true);
    console.log(`[SHOT] saved ${SHOT_STEP2}`);

    // ── 6. Type DELETE → enabled → confirm → deleted ────────────────────
    await step2.getByTestId('delete-confirm-input').fill('DELETE');
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    await expect(page.getByText('Đã xóa tài khoản thành công')).toBeVisible({ timeout: 15_000 });
    await expect(row).toHaveCount(0, { timeout: 15_000 });
    console.log('[DELETE] row removed from table after 2-step confirmation');

    // ── 7. API corroboration: the user is really gone ───────────────────
    const verify = await request.get(`/api/v1/admin/users?search=${encodeURIComponent(testUser.email)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(verify.ok()).toBeTruthy();
    const remaining = (await verify.json()).data.items || [];
    expect(remaining.find((u) => u.email === testUser.email), 'user absent from API').toBeFalsy();
    console.log('[VERIFY] user absent from backend after delete');
  });
});
