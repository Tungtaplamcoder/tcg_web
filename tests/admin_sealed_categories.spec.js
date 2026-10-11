// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Dynamic Sealed Product category management ("Danh mục Sealed Product").
 *
 * Contract:
 *  1. Catalog Settings exposes a 4th tab ("📦 Sealed Products") backed by the
 *     `SealedCategory` catalogue via /api/v1/admin/sealed-categories.
 *  2. An admin can quick-add a category (Mã / Tên danh mục / Mô tả) inline;
 *     it is persisted through POST /api/v1/admin/sealed-categories.
 *  3. The product modal's "Loại sản phẩm niêm phong" dropdown is fed by the
 *     dynamic catalogue from GET /api/v1/sealed-categories, so a newly created
 *     category ("Booster Bundle") appears immediately when "Sealed Product"
 *     is selected as the main product type.
 *
 * Screenshots (strict):
 *  - successful_test/23_admin_sealed_categories_tab.png
 *  - successful_test/23_sealed_product_dropdown_dynamic.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
// Also mirror into the workspace-root successful_test/ (the literal task path).
const SHOT_ROOT = path.join(__dirname, '..', '..', 'successful_test');
const SHOT_TAB = path.join(SHOT_DIR, '23_admin_sealed_categories_tab.png');
const SHOT_DROPDOWN = path.join(SHOT_DIR, '23_sealed_product_dropdown_dynamic.png');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tcg.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminSecurePass123!';

// A genuinely new category (not in the seeded catalogue) so the create path is
// exercised deterministically and the test is re-runnable.
const SEALED_CODE = 'booster-bundle';
const SEALED_NAME = 'Booster Bundle';

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

async function adminToken(request) {
  const res = await request.post('/api/v1/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).data.accessToken;
}

async function deleteSealedCategoryIfExists(request, token) {
  const res = await request.get('/api/v1/admin/sealed-categories?activeOnly=false', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const rows = (await res.json()).data || [];
  for (const r of rows.filter((x) => x.code === SEALED_CODE || x.name === SEALED_NAME)) {
    await request.delete(`/api/v1/admin/sealed-categories/${r.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }
}

async function saveShot(page, target) {
  await page.screenshot({ path: target, fullPage: false });
  fs.mkdirSync(SHOT_ROOT, { recursive: true });
  fs.copyFileSync(target, path.join(SHOT_ROOT, path.basename(target)));
  expect(fs.existsSync(target)).toBe(true);
  expect(fs.existsSync(path.join(SHOT_ROOT, path.basename(target)))).toBe(true);
}

test.describe('Admin — dynamic sealed product categories', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    fs.mkdirSync(SHOT_ROOT, { recursive: true });
  });

  test('catalog settings: add a sealed category from the Sealed Products tab', async ({ page, request }) => {
    // ── 0. Clean state for repeatable runs ─────────────────────────────
    const token = await adminToken(request);
    await deleteSealedCategoryIfExists(request, token);

    // ── 1. Admin login → Catalog Settings ──────────────────────────────
    await loginAsAdmin(page);
    await page.goto('/admin/catalog-settings', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByRole('heading', { name: /cấu hình danh mục/i })).toBeVisible();

    // ── 2. Open the "📦 Sealed Products" tab ───────────────────────────
    const sealedTab = page.getByTestId('tab-sealed');
    await expect(sealedTab).toBeVisible();
    await sealedTab.click();
    await expect(page.getByTestId('sealed-categories-tab')).toBeVisible();

    // ── 3. Quick-add "Booster Bundle" (Mã / Tên danh mục / Mô tả) ──────
    await page.getByTestId('sealed-code-input').fill(SEALED_CODE);
    await page.getByTestId('sealed-name-input').fill(SEALED_NAME);
    await page.getByTestId('sealed-desc-input').fill('Bó booster gồm nhiều gói');
    await page.getByTestId('sealed-submit').click();

    // The new row renders in the table after the reload.
    const row = page.getByRole('row', { name: new RegExp(SEALED_NAME, 'i') });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('cell', { name: SEALED_CODE, exact: true })).toBeVisible();

    // Screenshot 1: management tab with the persisted category.
    await saveShot(page, SHOT_TAB);

    // ── 4. Persisted server-side through the admin API ─────────────────
    const publicRes = await request.get('/api/v1/sealed-categories');
    expect(publicRes.ok()).toBeTruthy();
    const created = ((await publicRes.json()).data || []).find((c) => c.code === SEALED_CODE);
    expect(created).toBeTruthy();
    expect(created.name).toBe(SEALED_NAME);

    console.log(`[SEALED] created "${SEALED_NAME}" (code ${SEALED_CODE})`);
  });

  test('product modal: sealed category appears in the dynamic dropdown', async ({ page, request }) => {
    // Ensure the category exists even if this spec is run in isolation.
    const token = await adminToken(request);
    const listRes = await request.get('/api/v1/admin/sealed-categories?activeOnly=false', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const exists = ((await listRes.json()).data || []).some((c) => c.code === SEALED_CODE);
    if (!exists) {
      const createRes = await request.post('/api/v1/admin/sealed-categories', {
        headers: { Authorization: `Bearer ${token}` },
        data: { name: SEALED_NAME, code: SEALED_CODE, description: 'Bó booster gồm nhiều gói' }
      });
      expect(createRes.ok()).toBeTruthy();
    }

    // ── 1. Admin login → product inventory → Add Product modal ─────────
    await loginAsAdmin(page);
    await page.goto('/admin/inventory', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByRole('heading', { name: /quản lý sản phẩm/i })).toBeVisible();

    await page.getByRole('button', { name: /thêm sản phẩm/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // ── 2. Select "Sealed Product" as the main product type ────────────
    await dialog.locator('select[name="category"]').selectOption('BOX');

    // ── 3. Verify the dynamic category dropdown lists "Booster Bundle" ──
    const sealedInput = dialog.locator('[data-creatable-select="sealedType"] input[name="sealedType"]');
    await expect(sealedInput).toBeVisible();
    await sealedInput.click();
    await sealedInput.fill(SEALED_NAME);

    const option = dialog.getByRole('option').filter({ hasText: SEALED_NAME });
    await expect(option).toBeVisible({ timeout: 15_000 });

    // Screenshot 2: dynamic dropdown fed by /sealed-categories.
    await saveShot(page, SHOT_DROPDOWN);

    await option.click();
    await expect(sealedInput).toHaveValue(SEALED_NAME);

    console.log(`[SEALED] "${SEALED_NAME}" present in product modal dropdown`);
  });
});
