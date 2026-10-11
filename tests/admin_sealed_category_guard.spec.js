// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Sealed category dropdown binding + deletion safeguard.
 *
 * Contract:
 *  1. The product modal's "Loại sản phẩm niêm phong" dropdown is bound ONLY to
 *     the dynamic SealedCategory catalogue (GET /api/v1/sealed-categories) —
 *     never to product-derived category-tree nodes. When the catalogue is
 *     empty it renders "-- Chưa có danh mục sealed --" (no stale product names).
 *  2. DELETE /api/v1/admin/sealed-categories/:id is rejected with 409 while any
 *     product is still tagged with that category.
 *
 * Screenshots (strict):
 *  - successful_test/26_sealed_dropdown_empty_fixed.png
 *  - successful_test/26_sealed_category_delete_guard_alert.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const SHOT_ROOT = path.join(__dirname, '..', '..', 'successful_test');
const SHOT_EMPTY = path.join(SHOT_DIR, '26_sealed_dropdown_empty_fixed.png');
const SHOT_GUARD = path.join(SHOT_DIR, '26_sealed_category_delete_guard_alert.png');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tcg.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminSecurePass123!';

const SEALED_CODE = 'booster-box';
const SEALED_NAME = 'Booster Box';
const PRODUCT_NAME = 'Guard Sealed Booster Box';
const EMPTY_MESSAGE = '-- Chưa có danh mục sealed --';

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

const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

async function deleteGuardProducts(request, token) {
  const res = await request.get(
    `/api/v1/admin/products?search=${encodeURIComponent(PRODUCT_NAME)}&limit=50`,
    auth(token)
  );
  const items = ((await res.json()).data || {}).items || [];
  for (const p of items) {
    if (new RegExp(PRODUCT_NAME, 'i').test(p.name)) {
      await request.delete(`/api/v1/admin/products/${p.id}`, auth(token));
    }
  }
}

// Delete every product still tagged with a sealed category code so the
// category itself is no longer guarded (keeps specs order-independent).
async function purgeLinkedProducts(request, token, code) {
  const res = await request.get(
    `/api/v1/admin/products?category=${encodeURIComponent(code)}&limit=100`,
    auth(token)
  );
  const items = ((await res.json()).data || {}).items || [];
  for (const p of items) {
    await request.delete(`/api/v1/admin/products/${p.id}`, auth(token));
  }
}

async function deleteAllSealedCategories(request, token) {
  const res = await request.get('/api/v1/admin/sealed-categories?activeOnly=false', auth(token));
  const rows = ((await res.json()).data) || [];
  for (const r of rows) {
    await purgeLinkedProducts(request, token, r.code);
    await request.delete(`/api/v1/admin/sealed-categories/${r.id}`, auth(token));
  }
}

async function saveShot(page, target) {
  await page.screenshot({ path: target, fullPage: false });
  fs.mkdirSync(SHOT_ROOT, { recursive: true });
  fs.copyFileSync(target, path.join(SHOT_ROOT, path.basename(target)));
  expect(fs.existsSync(target)).toBe(true);
  expect(fs.existsSync(path.join(SHOT_ROOT, path.basename(target)))).toBe(true);
}

async function openProductModal(page) {
  await page.goto('/admin/inventory', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.getByRole('button', { name: /thêm sản phẩm/i }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('select[name="category"]').selectOption('BOX');
  const sealedInput = dialog.locator('[data-creatable-select="sealedType"] input[name="sealedType"]');
  await expect(sealedInput).toBeVisible();
  const sealedWrap = dialog.locator('[data-creatable-select="sealedType"]');
  return { dialog, sealedInput, sealedWrap };
}

test.describe('Admin — sealed category dropdown binding & delete guard', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    fs.mkdirSync(SHOT_ROOT, { recursive: true });
  });

  test('binds dropdown to dynamic catalogue and blocks deleting tagged categories', async ({ page, request }) => {
    const token = await adminToken(request);

    // ── 0. Clean state: drop tagged products, then all sealed categories ──
    await deleteGuardProducts(request, token);
    await deleteAllSealedCategories(request, token);

    await loginAsAdmin(page);

    // ── 1. Empty catalogue → explicit empty state, no product names ───────
    let { dialog, sealedInput, sealedWrap } = await openProductModal(page);
    await expect(sealedInput).toHaveAttribute('placeholder', EMPTY_MESSAGE);
    await sealedInput.click();
    const empty = dialog.getByTestId('creatable-empty');
    await expect(empty).toBeVisible();
    await expect(empty).toHaveText(EMPTY_MESSAGE);
    // No stale product-derived "categories" leaked into the picker.
    await expect(sealedWrap.getByRole('option')).toHaveCount(0);
    await expect(sealedWrap.getByRole('option').filter({ hasText: /E2E Booster Box/i })).toHaveCount(0);

    await saveShot(page, SHOT_EMPTY);

    // ── 2. Create a category → it appears dynamically in the dropdown ─────
    const createRes = await request.post('/api/v1/admin/sealed-categories', {
      ...auth(token),
      data: { name: SEALED_NAME, code: SEALED_CODE, description: 'Hộp booster niêm phong' }
    });
    expect(createRes.ok()).toBeTruthy();

    // Reopen the modal (fresh fetch on open) and confirm the new option.
    ({ dialog, sealedInput, sealedWrap } = await openProductModal(page));
    await sealedInput.click();
    await sealedInput.fill(SEALED_NAME);
    await expect(sealedWrap.getByRole('option').filter({ hasText: SEALED_NAME })).toBeVisible({ timeout: 15_000 });

    // ── 3. Tag a product with the category, then attempt deletion ─────────
    const publicRes = await request.get('/api/v1/sealed-categories');
    const sealed = ((await publicRes.json()).data || []).find((c) => c.code === SEALED_CODE);
    expect(sealed, 'sealed category must exist after creation').toBeTruthy();

    const productRes = await request.post('/api/v1/admin/products', {
      ...auth(token),
      data: {
        name: PRODUCT_NAME,
        category: SEALED_CODE,
        categoryPath: ['BOX', SEALED_CODE],
        variants: [{ price: 1234567, stockQuantity: 3 }]
      }
    });
    expect(productRes.ok()).toBeTruthy();

    // API-level guard: cannot delete while a product is still attached.
    const blocked = await request.delete(`/api/v1/admin/sealed-categories/${sealed.id}`, auth(token));
    expect(blocked.status()).toBe(409);
    const blockedBody = await blocked.json();
    expect(blockedBody.error.message).toContain('Không thể xóa danh mục này vì còn');
    expect(blockedBody.error.message).toContain('sản phẩm đang sử dụng');

    // ── 4. UI guard: deleting from Catalog Settings surfaces the alert ────
    await page.goto('/admin/catalog-settings', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.getByTestId('tab-sealed').click();
    await expect(page.getByTestId('sealed-categories-tab')).toBeVisible();

    const row = page.getByRole('row', { name: new RegExp(SEALED_NAME, 'i') });
    await expect(row).toBeVisible();
    await row.getByTitle('Xóa').click();

    const confirm = page.getByTestId('confirm-dialog');
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Xóa', exact: true }).click();

    const guardAlert = page.getByText(/Không thể xóa danh mục này vì còn \d+ sản phẩm đang sử dụng/).first();
    await expect(guardAlert).toBeVisible({ timeout: 15_000 });

    // Deletion was prevented — the row is still there.
    await expect(page.getByRole('cell', { name: SEALED_CODE, exact: true })).toBeVisible();

    await saveShot(page, SHOT_GUARD);

    console.log('[GUARD] dropdown bound to dynamic catalogue; deletion blocked while tagged');
  });
});
