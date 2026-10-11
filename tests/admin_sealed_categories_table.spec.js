// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Sealed Products table — "Số sản phẩm" column + single-notification guard.
 *
 * Contract:
 *  1. The Sealed Products table header is MÃ | TÊN DANH MỤC | SỐ SẢN PHẨM |
 *     THAO TÁC — the MÔ TẢ column is gone, replaced by a pastel product-count
 *     badge fed by GET /api/v1/admin/sealed-categories (`productCount`).
 *  2. A blocked deletion (category still used by products) shows exactly ONE
 *     error notification — no duplicate toast + inline banner.
 *
 * Screenshots (strict):
 *  - successful_test/27_sealed_categories_product_count_table.png
 *  - successful_test/27_sealed_categories_single_error_toast.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const SHOT_ROOT = path.join(__dirname, '..', '..', 'successful_test');
const SHOT_TABLE = path.join(SHOT_DIR, '27_sealed_categories_product_count_table.png');
const SHOT_ERROR = path.join(SHOT_DIR, '27_sealed_categories_single_error_toast.png');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tcg.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminSecurePass123!';

const SEALED_CODE = 'booster-box';
const SEALED_NAME = 'Booster Box';
const EMPTY_SEALED_CODE = 'blister-pack';
const EMPTY_SEALED_NAME = 'Blister Pack';
const PRODUCT_NAME = 'Table Count Booster Box';

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

async function cleanup(request, token) {
  const products = await request.get(
    `/api/v1/admin/products?search=${encodeURIComponent(PRODUCT_NAME)}&limit=50`,
    auth(token)
  );
  for (const p of (((await products.json()).data || {}).items || [])) {
    if (new RegExp(PRODUCT_NAME, 'i').test(p.name)) {
      await request.delete(`/api/v1/admin/products/${p.id}`, auth(token));
    }
  }
  const sealed = await request.get('/api/v1/admin/sealed-categories?activeOnly=false', auth(token));
  for (const s of (((await sealed.json()).data) || [])) {
    // Purge any product still tagged with this category so the delete is not
    // guarded (keeps specs order-independent).
    const linked = await request.get(
      `/api/v1/admin/products?category=${encodeURIComponent(s.code)}&limit=100`,
      auth(token)
    );
    for (const p of (((await linked.json()).data || {}).items || [])) {
      await request.delete(`/api/v1/admin/products/${p.id}`, auth(token));
    }
    await request.delete(`/api/v1/admin/sealed-categories/${s.id}`, auth(token));
  }
}

async function createSealedCategory(request, token, name, code) {
  const res = await request.post('/api/v1/admin/sealed-categories', {
    ...auth(token),
    data: { name, code }
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).data;
}

async function saveShot(page, target) {
  await page.screenshot({ path: target, fullPage: false });
  fs.mkdirSync(SHOT_ROOT, { recursive: true });
  fs.copyFileSync(target, path.join(SHOT_ROOT, path.basename(target)));
  expect(fs.existsSync(target)).toBe(true);
  expect(fs.existsSync(path.join(SHOT_ROOT, path.basename(target)))).toBe(true);
}

test.describe('Admin — Sealed Products table (product count + single error)', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    fs.mkdirSync(SHOT_ROOT, { recursive: true });
  });

  test('renames Mô tả → Số sản phẩm and shows one error on blocked delete', async ({ page, request }) => {
    const token = await adminToken(request);

    // ── 0. Deterministic state: one used category + one unused category ──
    await cleanup(request, token);
    await createSealedCategory(request, token, SEALED_NAME, SEALED_CODE);
    await createSealedCategory(request, token, EMPTY_SEALED_NAME, EMPTY_SEALED_CODE);

    const productRes = await request.post('/api/v1/admin/products', {
      ...auth(token),
      data: {
        name: PRODUCT_NAME,
        category: SEALED_CODE,
        categoryPath: ['BOX', SEALED_CODE],
        variants: [{ price: 1000000, stockQuantity: 2 }]
      }
    });
    expect(productRes.ok()).toBeTruthy();

    // Backend exposes the aggregate count on the admin catalogue endpoint.
    const apiList = await request.get('/api/v1/admin/sealed-categories?activeOnly=false', auth(token));
    const apiRows = (await apiList.json()).data || [];
    expect(apiRows.find((c) => c.code === SEALED_CODE)?.productCount).toBe(1);
    expect(apiRows.find((c) => c.code === EMPTY_SEALED_CODE)?.productCount).toBe(0);

    // ── 1. Open Catalog Settings → Sealed Products tab ───────────────────
    await loginAsAdmin(page);
    await page.goto('/admin/catalog-settings', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.getByTestId('tab-sealed').click();
    await expect(page.getByTestId('sealed-categories-tab')).toBeVisible();

    // ── 2. Column headers: MÃ | TÊN DANH MỤC | SỐ SẢN PHẨM | THAO TÁC ───
    await expect(page.getByRole('columnheader', { name: /^mã$/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /^tên danh mục$/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /^số sản phẩm$/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /^thao tác$/i })).toBeVisible();
    // The old Mô tả column is gone.
    await expect(page.getByRole('columnheader', { name: /mô tả/i })).toHaveCount(0);

    // Pastel count badges: 1 for Booster Box, 0 for Blister Pack.
    const usedRow = page.getByRole('row', { name: new RegExp(SEALED_NAME, 'i') });
    await expect(usedRow.getByText('1 sản phẩm')).toBeVisible();
    const emptyRow = page.getByRole('row', { name: new RegExp(EMPTY_SEALED_NAME, 'i') });
    await expect(emptyRow.getByText('0 sản phẩm')).toBeVisible();

    await saveShot(page, SHOT_TABLE);

    // ── 3. Blocked delete → exactly ONE error notification ───────────────
    await usedRow.getByTitle('Xóa').click();
    const confirm = page.getByTestId('confirm-dialog');
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Xóa', exact: true }).click();

    const toast = page.getByTestId('catalog-toast');
    await expect(toast).toHaveCount(1);
    await expect(toast).toHaveAttribute('data-toast-type', 'error');
    await expect(toast).toContainText(/Không thể xóa danh mục này vì còn \d+ sản phẩm đang sử dụng/);
    // No duplicate local banner carrying the same guard message.
    await expect(page.getByText(/Không thể xóa danh mục này/)).toHaveCount(1);

    await saveShot(page, SHOT_ERROR);

    console.log('[TABLE] Số sản phẩm column rendered; single error notification confirmed');
  });
});
