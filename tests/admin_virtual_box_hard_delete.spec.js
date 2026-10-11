// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Admin /admin/virtual-boxes — DIRECT 1-click HARD delete (no typing gate).
 *
 * Contract:
 *  1. Clicking the red Trash (svg.lucide-trash-2) on a row opens a lightweight
 *     single-step confirmation modal.
 *  2. The "Xóa vĩnh viễn" confirm button is immediately clickable — there is
 *     NO text input and NO "type DELETE/XÓA" requirement.
 *  3. Confirming calls DELETE /admin/virtual-boxes/:id which performs a real
 *     hard delete (pool mappings purged first, then the box record).
 *     The row is purged from the table, the counters update, and the success
 *     toast is shown.
 *
 * Screenshot:
 *   successful_test/24_admin_virtual_box_direct_delete.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const SHOT = path.join(SHOT_DIR, '24_admin_virtual_box_direct_delete.png');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tcg.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminSecurePass123!';

const TEST_PREFIX = 'e2e-hard-delete-';

/** UI login through the real form; admin lands on the Homepage first. */
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
  await page.goto('/admin/virtual-boxes', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
}

/** Admin API login → bearer token for setup/teardown/verification. */
async function adminToken(request) {
  const res = await request.post('/api/v1/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });
  expect(res.ok(), 'admin API login').toBeTruthy();
  return (await res.json()).data.accessToken;
}

/** Hard-delete leftover e2e boxes so the run is deterministic. */
async function purgeTestBoxes(request, token) {
  const list = await request.get(`/api/v1/admin/virtual-boxes?limit=100&search=${TEST_PREFIX}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!list.ok()) return;
  const items = (await list.json()).data.items || [];
  for (const box of items) {
    if (!String(box.name || '').startsWith(TEST_PREFIX)) continue;
    await request.delete(`/api/v1/admin/virtual-boxes/${box.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }
}

/** Create a fresh, deletable box via the admin API. */
async function createTestBox(request, token) {
  const name = `${TEST_PREFIX}${Date.now()}`;
  const res = await request.post('/api/v1/admin/virtual-boxes', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name,
      price: 9.99,
      status: 'ACTIVE',
      dropRates: [{ rarity: 'COMMON', rate: 100 }],
      pool: []
    }
  });
  expect(res.ok(), 'create deletable test box').toBeTruthy();
  const body = await res.json();
  return { id: body.data.id, name };
}

test.describe('Admin virtual box — direct 1-click hard delete', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeAll(async ({ request }) => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    const token = await adminToken(request);
    await purgeTestBoxes(request, token);
  });

  test('trash action + single confirmation hard deletes without typing', async ({ page, request }) => {
    const token = await adminToken(request);
    const testBox = await createTestBox(request, token);

    // ── 1. Log in and open Virtual Boxes ────────────────────────────────
    await loginAsAdmin(page);
    await expect(page.getByRole('heading', { name: /Hộp ảo/i })).toBeVisible();

    // ── 2. Locate the freshly created box row via the search filter ─────
    const searchInput = page.getByPlaceholder(/Tìm hộp theo tên/i);
    await searchInput.fill(testBox.name);
    await page.waitForLoadState('networkidle').catch(() => {});
    const row = page.locator('tbody tr', { hasText: testBox.name });
    await expect(row).toBeVisible({ timeout: 20_000 });

    // Counters reflect the filtered result set before deletion.
    const stats = page.locator('h2').locator('..').locator('p').first();
    await expect(stats).toContainText(/1\s+hộp/);
    await expect(page.locator('tbody tr')).toHaveCount(1);

    // ── 3. Trash opens the lightweight confirm modal ────────────────────
    const trashBtn = row.locator('[data-testid="delete-virtual-box-btn"]');
    await expect(trashBtn).toBeVisible();
    expect(await trashBtn.locator('svg[class*="trash"]').count()).toBeGreaterThan(0);
    await trashBtn.click();

    const modal = page.getByTestId('delete-virtual-box-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Bạn có chắc chắn muốn xóa vĩnh viễn Hộp ảo');
    await expect(modal).toContainText(testBox.name);

    // There must be NO typing gate anymore.
    await expect(page.getByTestId('delete-virtual-box-confirm-input')).toHaveCount(0);
    await expect(modal.locator('input[type="text"]')).toHaveCount(0);
    console.log('[MODAL] light confirm shown — no text input present');

    // ── 4. "Xóa vĩnh viễn" is immediately clickable, click it directly ──
    const confirmBtn = page.getByTestId('delete-virtual-box-confirm-btn');
    await expect(confirmBtn).toBeVisible();
    await expect(confirmBtn).toBeEnabled();
    await expect(confirmBtn).toHaveText(/Xóa vĩnh viễn/i);
    await confirmBtn.click();

    // ── 5. Row is purged from the table + counter decremented ───────────
    await expect(page.getByText('Đã xóa vĩnh viễn virtual box.')).toBeVisible({ timeout: 15_000 });
    await expect(row).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator('tbody tr')).toHaveCount(0, { timeout: 15_000 });
    await expect(stats).toContainText(/0\s+hộp/);
    console.log('[DELETE] row purged from DOM and total boxes count decremented');

    // ── 6. Required screenshot of the verified direct hard delete ───────
    await page.screenshot({ path: SHOT, fullPage: true });
    expect(fs.existsSync(SHOT)).toBe(true);
    console.log(`[SHOT] saved ${SHOT}`);

    // ── 7. API corroboration: the box is really gone from the database ──
    const verify = await request.get(
      `/api/v1/admin/virtual-boxes?search=${encodeURIComponent(testBox.name)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(verify.ok()).toBeTruthy();
    const remaining = (await verify.json()).data.items || [];
    expect(remaining.find((b) => b.id === testBox.id), 'box absent from API').toBeFalsy();
    console.log('[VERIFY] box absent from backend after direct hard delete');
  });
});
