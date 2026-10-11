// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Catalog Settings — dynamic "SỐ SẢN PHẨM" (usage count) column.
 *
 * Contract:
 *  1. Backend aggregation: GET /api/v1/admin/sealed-categories and
 *     GET /api/v1/admin/card-conditions return a numeric `productCount` per
 *     row, computed from the products/variants actually tagged with it.
 *  2. /admin/catalog-settings — the Sealed Products and Tình trạng thẻ tabs
 *     render a strict TÊN DANH MỤC | SỐ SẢN PHẨM | THAO TÁC header and a soft
 *     pastel-pink "[N] sản phẩm" badge in the count column.
 *  3. Brand: pastel pink accent only — zero warm tones (amber/orange/yellow),
 *     Edit + Delete use lucide-react vector icons.
 *
 * Screenshots (strict):
 *  - successful_test/57_catalog_product_count_column_dark.png
 *  - successful_test/57_catalog_product_count_column_light.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const SHOT_ROOT = path.join(__dirname, '..', '..', 'successful_test');
const DARK_SHOT = path.join(SHOT_DIR, '57_catalog_product_count_column_dark.png');
const LIGHT_SHOT = path.join(SHOT_DIR, '57_catalog_product_count_column_light.png');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tcg.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminSecurePass123!';

const STAMP = Date.now();
const SEALED_NAME = `E2E Count Sealed ${STAMP}`;
const EMPTY_SEALED_NAME = `E2E Count Empty ${STAMP}`;
const CONDITION_NAME = `E2E Count Condition ${STAMP}`;
const PRODUCT_NAME = `E2E Count Product ${STAMP}`;

const WARM_TONES = /(amber|orange|yellow)-/;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });
const headersOf = async (table) =>
  (await table.locator('thead th').allTextContents()).map((h) => h.trim().toUpperCase());

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

async function saveShot(page, file) {
  await page.screenshot({ path: file, fullPage: false });
  fs.mkdirSync(SHOT_ROOT, { recursive: true });
  fs.copyFileSync(file, path.join(SHOT_ROOT, path.basename(file)));
  expect(fs.existsSync(file)).toBe(true);
  expect(fs.existsSync(path.join(SHOT_ROOT, path.basename(file)))).toBe(true);
}

test.describe('Admin — catalog "SỐ SẢN PHẨM" usage-count column', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });
  test.describe.configure({ mode: 'serial' });

  let token;
  let sealedId;
  let emptySealedId;
  let conditionId;
  let productId;

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    fs.mkdirSync(SHOT_ROOT, { recursive: true });
  });

  test.afterAll(async ({ request }) => {
    if (!token) return;
    if (productId) await request.delete(`/api/v1/admin/products/${productId}`, auth(token));
    if (conditionId) await request.delete(`/api/v1/admin/card-conditions/${conditionId}`, auth(token));
    if (emptySealedId) await request.delete(`/api/v1/admin/sealed-categories/${emptySealedId}`, auth(token));
    if (sealedId) await request.delete(`/api/v1/admin/sealed-categories/${sealedId}`, auth(token));
    // The product's categoryPath created a leaf Category row under BOX — remove
    // it so repeated runs don't accumulate orphaned catalog nodes.
    const cats = await request.get('/api/v1/admin/categories?activeOnly=false', auth(token));
    for (const c of (await cats.json()).data || []) {
      if (c.name === SEALED_NAME) await request.delete(`/api/v1/admin/categories/${c.id}`, auth(token));
    }
  });

  test('backend aggregation returns an accurate productCount per row', async ({ request }) => {
    token = await adminToken(request);

    // One sealed category that will be used, one left empty.
    const sealedRes = await request.post('/api/v1/admin/sealed-categories', {
      ...auth(token),
      data: { name: SEALED_NAME }
    });
    expect(sealedRes.ok()).toBeTruthy();
    sealedId = (await sealedRes.json()).data.id;

    const emptyRes = await request.post('/api/v1/admin/sealed-categories', {
      ...auth(token),
      data: { name: EMPTY_SEALED_NAME }
    });
    expect(emptyRes.ok()).toBeTruthy();
    emptySealedId = (await emptyRes.json()).data.id;

    const conditionRes = await request.post('/api/v1/admin/card-conditions', {
      ...auth(token),
      data: { name: CONDITION_NAME }
    });
    expect(conditionRes.ok()).toBeTruthy();
    conditionId = (await conditionRes.json()).data.id;

    // A single product linked to the used sealed category via the BOX tree and
    // to the new condition via its variant.
    const productRes = await request.post('/api/v1/admin/products', {
      ...auth(token),
      data: {
        name: PRODUCT_NAME,
        category: 'BOX',
        categoryPath: ['BOX', SEALED_NAME],
        variants: [{ price: 500000, stockQuantity: 2, condition: CONDITION_NAME }]
      }
    });
    expect(productRes.ok()).toBeTruthy();
    productId = (await productRes.json()).data.id;

    const sealedList = await request.get('/api/v1/admin/sealed-categories?activeOnly=false', auth(token));
    const sealedRows = (await sealedList.json()).data || [];
    expect(sealedRows.find((c) => c.id === sealedId)?.productCount).toBe(1);
    expect(sealedRows.find((c) => c.id === emptySealedId)?.productCount).toBe(0);

    const conditionList = await request.get('/api/v1/admin/card-conditions?activeOnly=false', auth(token));
    const conditionRows = (await conditionList.json()).data || [];
    expect(conditionRows.find((c) => c.id === conditionId)?.productCount).toBe(1);

    console.log('[COUNT API] sealed=1/0 · condition=1 aggregation verified');
  });

  test('Sealed Products + Tình trạng thẻ show the dynamic SỐ SẢN PHẨM column (dark + light)', async ({ page }) => {
    await loginAsAdmin(page);

    // ── Dark theme ───────────────────────────────────────────────────────
    await page.goto('/admin/catalog-settings', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.setItem('tcg-theme', 'dark'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByRole('heading', { name: /cấu hình danh mục/i })).toBeVisible();
    await expect(page.locator('html')).toHaveClass(/dark/);

    // ── Sealed Products tab ──────────────────────────────────────────────
    await page.getByTestId('tab-sealed').click();
    const sealedTable = page.getByTestId('sealed-table');
    await expect(sealedTable).toBeVisible({ timeout: 15_000 });

    const sealedHeaders = await headersOf(sealedTable);
    expect(sealedHeaders).toContain('SỐ SẢN PHẨM');
    expect(sealedHeaders.indexOf('SỐ SẢN PHẨM')).toBe(1);

    const usedRow = sealedTable.getByRole('row', { name: new RegExp(escapeRe(SEALED_NAME)) });
    await expect(usedRow).toBeVisible();
    const usedBadge = usedRow.getByTestId('sealed-product-count');
    await expect(usedBadge).toBeVisible();
    expect((await usedBadge.textContent()).trim()).toBe('1 sản phẩm');

    const emptyRow = sealedTable.getByRole('row', { name: new RegExp(escapeRe(EMPTY_SEALED_NAME)) });
    await expect(emptyRow.getByTestId('sealed-product-count')).toHaveText('0 sản phẩm');

    // Pastel-pink pill styling, strict lucide-icon actions, no warm tones.
    const badgeClass = await usedBadge.getAttribute('class');
    expect(badgeClass).toContain('rounded-full');
    expect(badgeClass).toContain('text-pink-');
    expect(badgeClass).not.toMatch(WARM_TONES);
    await expect(usedRow.getByTitle('Sửa')).toBeVisible();
    await expect(usedRow.getByTitle('Xóa')).toBeVisible();
    expect(await sealedTable.evaluate((el) => el.outerHTML)).not.toMatch(WARM_TONES);

    const sealedCounts = await sealedTable.getByTestId('sealed-product-count').allTextContents();
    expect(sealedCounts.length).toBeGreaterThan(0);
    for (const text of sealedCounts) expect(text.trim()).toMatch(/^\d+ sản phẩm$/);

    await saveShot(page, DARK_SHOT);
    console.log('[COUNT UI] Sealed Products SỐ SẢN PHẨM column verified (dark)');

    // ── Tình trạng thẻ tab ───────────────────────────────────────────────
    await page.getByTestId('tab-conditions').click();
    const conditionTable = page.getByTestId('condition-table');
    await expect(conditionTable).toBeVisible({ timeout: 15_000 });

    const conditionHeaders = await headersOf(conditionTable);
    expect(conditionHeaders).toContain('SỐ SẢN PHẨM');

    const conditionRow = page.getByTestId(`condition-row-${CONDITION_NAME}`);
    await expect(conditionRow).toBeVisible();
    const conditionBadge = conditionRow.getByTestId('condition-product-count');
    await expect(conditionBadge).toBeVisible();
    expect((await conditionBadge.textContent()).trim()).toBe('1 sản phẩm');
    expect(await conditionTable.evaluate((el) => el.outerHTML)).not.toMatch(WARM_TONES);

    const conditionCounts = await conditionTable.getByTestId('condition-product-count').allTextContents();
    for (const text of conditionCounts) expect(text.trim()).toMatch(/^\d+ sản phẩm$/);

    // ── Light theme ──────────────────────────────────────────────────────
    const toLight = page.getByRole('button', { name: /chuyển sang chế độ sáng|switch to light/i }).first();
    if (await toLight.count()) {
      await toLight.click();
      await expect(page.locator('html')).not.toHaveClass(/dark/);
    } else {
      await page.evaluate(() => localStorage.setItem('tcg-theme', 'light'));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByTestId('tab-conditions').click();
      await expect(page.getByTestId('condition-table')).toBeVisible({ timeout: 15_000 });
    }

    await saveShot(page, LIGHT_SHOT);
    console.log('[COUNT UI] Tình trạng thẻ SỐ SẢN PHẨM column verified (light)');

    console.log(`[SHOT] ${DARK_SHOT}`);
    console.log(`[SHOT] ${LIGHT_SHOT}`);
  });
});
