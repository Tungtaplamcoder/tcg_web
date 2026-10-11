// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Expansion Sets tab — restored "SỐ SẢN PHẨM" column.
 *
 * Contract:
 *  1. Expansion Sets table headers are strictly
 *     TÊN | SERIES | SỐ SẢN PHẨM | THAO TÁC.
 *  2. GET /api/v1/admin/categories returns an accurate `_count.products`
 *     aggregate for each Expansion Set category (verified with a real product
 *     linked to the set).
 *  3. Each row renders the shared soft pastel badge formatted "[N] sản phẩm".
 *  4. The Edit (✏️) action still opens the unified floating Edit Modal
 *     (CatalogEditModal) pre-filled with the set's details + parent series.
 *
 * Screenshot (strict):
 *  - successful_test/32_expansion_sets_product_count_badge.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const SHOT_ROOT = path.join(__dirname, '..', '..', 'successful_test');
const SHOT_PATH = path.join(SHOT_DIR, '32_expansion_sets_product_count_badge.png');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tcg.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminSecurePass123!';

const STAMP = Date.now();
const SERIES_NAME = `E2E Count Series ${STAMP}`;
const EXPANSION_NAME = `E2E Count Set ${STAMP}`;
const PRODUCT_NAME = `E2E Count Product ${STAMP}`;

const BADGE_CLASSES = [
  'bg-pink-100/80',
  'text-pink-700',
  'dark:bg-pink-950/60',
  'dark:text-pink-300',
  'border-pink-200/50',
  'dark:border-pink-900/40'
];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

async function headersOf(table) {
  return (await table.locator('thead th').allTextContents()).map((h) => h.trim().toUpperCase());
}

async function saveShot(page) {
  await page.screenshot({ path: SHOT_PATH, fullPage: false });
  fs.mkdirSync(SHOT_ROOT, { recursive: true });
  fs.copyFileSync(SHOT_PATH, path.join(SHOT_ROOT, path.basename(SHOT_PATH)));
  expect(fs.existsSync(SHOT_PATH)).toBe(true);
  expect(fs.existsSync(path.join(SHOT_ROOT, path.basename(SHOT_PATH)))).toBe(true);
}

test.describe('Admin — Expansion Sets product-count column', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });
  test.describe.configure({ mode: 'serial' });

  let token;
  let seriesId;
  let expansionId;
  let productId;

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    fs.mkdirSync(SHOT_ROOT, { recursive: true });
  });

  test.afterAll(async ({ request }) => {
    if (!token) return;
    if (productId) await request.delete(`/api/v1/admin/products/${productId}`, auth(token));
    if (expansionId) await request.delete(`/api/v1/admin/categories/${expansionId}`, auth(token));
    if (seriesId) await request.delete(`/api/v1/admin/categories/${seriesId}`, auth(token));
  });

  test('backend counts products linked to each Expansion Set', async ({ request }) => {
    token = await adminToken(request);

    const cats = await request.get('/api/v1/admin/categories?activeOnly=false', auth(token));
    const root = ((await cats.json()).data || []).find((c) => c.slug === 'single-cards');
    expect(root, 'single-cards root category').toBeTruthy();

    const seriesRes = await request.post('/api/v1/admin/categories', {
      ...auth(token),
      data: { name: SERIES_NAME, parentId: root.id }
    });
    expect(seriesRes.ok()).toBeTruthy();
    seriesId = (await seriesRes.json()).data.id;

    const expRes = await request.post('/api/v1/admin/categories', {
      ...auth(token),
      data: { name: EXPANSION_NAME, parentId: seriesId }
    });
    expect(expRes.ok()).toBeTruthy();
    expansionId = (await expRes.json()).data.id;

    // Link one real product to the expansion set via the cascading path.
    const productRes = await request.post('/api/v1/admin/products', {
      ...auth(token),
      data: {
        name: PRODUCT_NAME,
        category: 'CARD',
        categoryPath: [SERIES_NAME, EXPANSION_NAME],
        variants: [{ price: 250000, stockQuantity: 3 }]
      }
    });
    expect(productRes.ok()).toBeTruthy();
    productId = (await productRes.json()).data.id;

    const after = await request.get('/api/v1/admin/categories?activeOnly=false', auth(token));
    const rows = (await after.json()).data || [];
    const exp = rows.find((c) => c.id === expansionId);
    expect(exp, 'expansion set row returned').toBeTruthy();
    expect(exp._count?.products, 'expansion set product count').toBe(1);

    console.log(`[API] expansion "${EXPANSION_NAME}" accurately reports 1 linked product`);
  });

  test('Expansion Sets tab shows SERIES + pastel SỐ SẢN PHẨM badge and Edit modal opens', async ({ page }) => {
    // ── 1. Admin login → Catalog Settings → Expansion Sets ───────────────
    await loginAsAdmin(page);
    await page.goto('/admin/catalog-settings', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByRole('heading', { name: /cấu hình danh mục/i })).toBeVisible();

    await page.getByTestId('tab-expansions').click();
    const table = page.getByTestId('expansions-tab').locator('table');
    await expect(table).toBeVisible({ timeout: 15_000 });

    // ── 2. Header contract: TÊN | SERIES | SỐ SẢN PHẨM | THAO TÁC ───────
    expect(await headersOf(table)).toEqual(['TÊN', 'SERIES', 'SỐ SẢN PHẨM', 'THAO TÁC']);

    // ── 3. Pastel "[N] sản phẩm" badge on the linked expansion set ───────
    const row = table.getByRole('row', { name: new RegExp(escapeRe(EXPANSION_NAME)) });
    await expect(row).toBeVisible();

    const badge = row.getByTestId('option-product-count');
    await expect(badge).toBeVisible();
    expect((await badge.textContent()).trim()).toBe('1 sản phẩm');

    const cls = await badge.getAttribute('class');
    expect(cls).toContain('rounded-full');
    for (const required of BADGE_CLASSES) {
      expect(cls, `badge missing "${required}"`).toContain(required);
    }

    // Row also carries the unified Edit + Delete actions.
    await expect(row.getByTitle('Sửa')).toBeVisible();
    await expect(row.getByTitle('Xóa')).toBeVisible();

    // ── 4. Verified screenshot ──────────────────────────────────────────
    await saveShot(page);
    console.log('[EXPANSION COUNT] headers + pastel badge verified');

    // ── 5. Edit (✏️) opens the unified floating modal pre-filled ────────
    await row.getByTitle('Sửa').click();
    const modal = page.getByTestId('catalog-edit-modal');
    await expect(modal).toBeVisible();
    await expect(page.getByTestId('catalog-edit-title')).toContainText(EXPANSION_NAME);
    await expect(page.getByTestId('catalog-edit-name')).toHaveValue(EXPANSION_NAME);
    await expect(page.getByTestId('catalog-edit-parentId')).toHaveValue(seriesId);
    await page.getByRole('button', { name: 'Hủy', exact: true }).click();
    await expect(modal).toBeHidden();
    console.log('[EXPANSION COUNT] unified Edit modal opened pre-filled');

    console.log(`[SHOT] saved ${SHOT_PATH}`);
  });
});
