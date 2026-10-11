// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Dynamic card conditions ("Tình trạng thẻ") — Admin + Staff quick-add.
 *
 * Contract:
 *  1. Staff logs in, opens the product modal in Inventory (/staff/inventory →
 *     /staff/products), and uses the inline "+ Thêm tình trạng mới" button to
 *     quick-add a brand-new condition ("Ungraded") straight to the DB.
 *  2. The new condition is auto-selected in the variant "TÌNH TRẠNG" dropdown
 *     immediately, without a page reload.
 *  3. The Admin Catalog Settings surface exposes the Admin-only "Tình trạng thẻ"
 *     tab and lists "Ungraded" in the management table.
 *
 * Screenshots (strict):
 *  - successful_test/53_staff_quick_add_condition_modal.png
 *  - successful_test/53_admin_catalog_conditions_tab_verified.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
// Also mirror into the workspace-root successful_test/ (the literal task path).
const SHOT_ROOT = path.join(__dirname, '..', '..', 'successful_test');
const SHOT_STAFF = path.join(SHOT_DIR, '53_staff_quick_add_condition_modal.png');
const SHOT_ADMIN = path.join(SHOT_DIR, '53_admin_catalog_conditions_tab_verified.png');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tcg.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminSecurePass123!';
const STAFF_EMAIL = process.env.STAFF_EMAIL || 'staff@tcg.com';
const STAFF_PASSWORD = process.env.STAFF_PASSWORD || 'StaffSecurePass123!';

// A genuinely new condition so the quick-add create path is exercised
// deterministically and the spec is re-runnable.
const CONDITION_NAME = 'Ungraded';
const CONDITION_CODE = 'Ungraded';

async function loginVia(page, email, password) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.locator('input[type="text"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  // Every role redirects to "/" on success, so wait to leave /login.
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 }),
    page.getByRole('button', { name: /đăng nhập|login|logging/i }).first().click()
  ]);
  await page.waitForLoadState('networkidle').catch(() => {});
}

async function adminToken(request) {
  const res = await request.post('/api/v1/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });
  expect(res.ok(), 'admin login for test setup').toBeTruthy();
  return (await res.json()).data.accessToken;
}

/** Reset the seeded staff password to a known value so the E2E login is
 *  self-contained and repeatable. */
async function ensureStaffPassword(request) {
  const token = await adminToken(request);
  const list = await request.get(`/api/v1/admin/users?search=${encodeURIComponent(STAFF_EMAIL)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(list.ok(), 'list users').toBeTruthy();
  const items = (await list.json()).data.items || [];
  const staff = items.find((u) => u.email === STAFF_EMAIL);
  expect(staff, `staff user ${STAFF_EMAIL} exists`).toBeTruthy();

  const patch = await request.patch(`/api/v1/admin/users/${staff.id}/password`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { newPassword: STAFF_PASSWORD }
  });
  expect(patch.ok(), 'set staff password').toBeTruthy();
}

async function deleteConditionIfExists(request, code) {
  const token = await adminToken(request);
  const res = await request.get('/api/v1/admin/card-conditions?activeOnly=false', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const rows = (await res.json()).data || [];
  for (const c of rows.filter((x) => x.code === code)) {
    await request.delete(`/api/v1/admin/card-conditions/${c.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }
}

async function saveShot(page, target) {
  await page.screenshot({ path: target, fullPage: false });
  fs.copyFileSync(target, path.join(SHOT_ROOT, path.basename(target)));
  expect(fs.existsSync(target)).toBe(true);
  expect(fs.existsSync(path.join(SHOT_ROOT, path.basename(target)))).toBe(true);
  console.log(`[SHOT] saved ${target}`);
}

test.describe('Dynamic card conditions — Staff quick-add & Admin catalog tab', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test.beforeAll(async ({ request }) => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    fs.mkdirSync(SHOT_ROOT, { recursive: true });
    await ensureStaffPassword(request);
    await deleteConditionIfExists(request, CONDITION_CODE);
  });

  test('Staff quick-adds "Ungraded" inline and it is auto-selected', async ({ page }) => {
    // ── 1. Staff login → inventory product modal ───────────────────────
    await loginVia(page, STAFF_EMAIL, STAFF_PASSWORD);
    await page.goto('/staff/inventory', { waitUntil: 'domcontentloaded' });
    await page.waitForURL((url) => url.pathname.includes('/staff/products'), { timeout: 30_000 }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByRole('heading', { name: /quản lý sản phẩm/i })).toBeVisible();

    await page.getByRole('button', { name: /thêm sản phẩm/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Single Cards use the Condition + Language variant structure.
    await dialog.locator('select[name="category"]').selectOption('CARD');

    // Add a variant row so the TÌNH TRẠNG dropdown is rendered.
    await dialog.getByRole('button', { name: /thêm variant/i }).first().click();

    // ── 2. Inline quick-add a brand-new condition ──────────────────────
    await dialog.getByTestId('add-condition-btn').click();
    const quickAdd = page.getByTestId('condition-quick-add-modal');
    await expect(quickAdd).toBeVisible();

    await quickAdd.getByTestId('condition-quick-add-input').fill(CONDITION_NAME);

    // Screenshot: the Staff inline "+ Thêm tình trạng mới" quick-add modal.
    await saveShot(page, SHOT_STAFF);

    await quickAdd.getByTestId('condition-quick-add-save').click();
    await expect(quickAdd).toBeHidden({ timeout: 15_000 });

    // ── 3. Auto-selected in the variant dropdown (no reload) ───────────
    const conditionSelect = dialog.getByTestId('variant-condition-0');
    await expect(conditionSelect).toHaveValue(CONDITION_NAME, { timeout: 15_000 });

    // Persisted server-side (visible to Admin).
    const token = await adminToken(page.request);
    const res = await page.request.get('/api/v1/admin/card-conditions?activeOnly=false', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const created = ((await res.json()).data || []).find((c) => c.code === CONDITION_CODE);
    expect(created, 'condition persisted to DB').toBeTruthy();

    console.log(`[CONDITION] staff quick-added "${CONDITION_NAME}" and it auto-selected`);
  });

  test('Admin Catalog Settings shows the "Tình trạng thẻ" tab with "Ungraded"', async ({ page }) => {
    // ── 4. Switch to the Admin account ─────────────────────────────────
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
    await page.context().clearCookies();
    await loginVia(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    // ── 5. Admin-only catalog settings tab ─────────────────────────────
    await page.goto('/admin/catalog-settings', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByRole('heading', { name: /cấu hình danh mục/i })).toBeVisible();

    const conditionsTab = page.getByRole('button', { name: /tình trạng thẻ/i });
    await expect(conditionsTab).toBeVisible();
    await conditionsTab.click();

    await expect(page.getByTestId('card-conditions-tab')).toBeVisible();
    await expect(page.getByTestId(`condition-row-${CONDITION_CODE}`)).toBeVisible();
    await expect(
      page.getByTestId(`condition-row-${CONDITION_CODE}`).getByText(CONDITION_NAME, { exact: true }).first()
    ).toBeVisible();

    // Screenshot: the verified Admin condition management table.
    await saveShot(page, SHOT_ADMIN);

    console.log('[CATALOG] Admin "Tình trạng thẻ" tab verified with "Ungraded"');
  });

  test('The "Tình trạng thẻ" tab is hidden from Staff accounts', async ({ page }) => {
    await loginVia(page, STAFF_EMAIL, STAFF_PASSWORD);
    await page.goto('/admin/catalog-settings', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    // Staff is blocked from the Admin surface entirely, so the tab must never
    // render for them.
    await expect(page.getByRole('button', { name: /tình trạng thẻ/i })).toHaveCount(0);
    console.log('[ROLE] "Tình trạng thẻ" tab absent for Staff');
  });
});
