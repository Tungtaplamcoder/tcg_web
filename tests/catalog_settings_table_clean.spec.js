// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Catalog Settings — remove the "SỐ SẢN PHẨM" column from the Rarity and
 * Card-Condition tabs.
 *
 * Contract:
 *  1. "Quản lý Độ hiếm (Rarity)" table is strictly TÊN | THAO TÁC — the
 *     "SỐ SẢN PHẨM" header and product-count cell are completely absent.
 *  2. "Tình trạng thẻ" table is strictly TÊN TÌNH TRẠNG | THAO TÁC — the
 *     "SỐ SẢN PHẨM" header and product-count cell are completely absent.
 *  3. "Sealed Products" keeps its "SỐ SẢN PHẨM" column intact.
 *  4. Edit + Delete actions remain on every Rarity and Condition row.
 *
 * Screenshots (strict):
 *  - successful_test/58_catalog_rarity_no_count.png
 *  - successful_test/58_catalog_condition_no_count.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
// Also mirror into the workspace-root successful_test/ (the literal task path).
const SHOT_ROOT = path.join(__dirname, '..', '..', 'successful_test');
const RARITY_SHOT = path.join(SHOT_DIR, '58_catalog_rarity_no_count.png');
const CONDITION_SHOT = path.join(SHOT_DIR, '58_catalog_condition_no_count.png');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tcg.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminSecurePass123!';

const STAMP = Date.now();
const RARITY_NAME = `E2E Clean Rarity ${STAMP}`;
const CONDITION_NAME = `E2E Clean Condition ${STAMP}`;

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

test.describe('Admin — Rarity & Condition tabs without SỐ SẢN PHẨM column', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });
  test.describe.configure({ mode: 'serial' });

  let token;
  let rarityId;
  let conditionId;

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    fs.mkdirSync(SHOT_ROOT, { recursive: true });
  });

  test.afterAll(async ({ request }) => {
    if (!token) return;
    if (rarityId) await request.delete(`/api/v1/admin/rarities/${rarityId}`, auth(token));
    if (conditionId) await request.delete(`/api/v1/admin/card-conditions/${conditionId}`, auth(token));
  });

  test('Rarity + Condition tables keep only TÊN and THAO TÁC', async ({ page, request }) => {
    token = await adminToken(request);

    // Deterministic fixtures so a known row exists in each tab.
    const rarityRes = await request.post('/api/v1/admin/rarities', {
      ...auth(token),
      data: { name: RARITY_NAME }
    });
    expect(rarityRes.ok()).toBeTruthy();
    rarityId = (await rarityRes.json()).data.id;

    const conditionRes = await request.post('/api/v1/admin/card-conditions', {
      ...auth(token),
      data: { name: CONDITION_NAME }
    });
    expect(conditionRes.ok()).toBeTruthy();
    conditionId = (await conditionRes.json()).data.id;

    await loginAsAdmin(page);
    await page.goto('/admin/catalog-settings', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByRole('heading', { name: /cấu hình danh mục/i })).toBeVisible();

    // ── Rarity tab ───────────────────────────────────────────────────────
    await page.getByTestId('tab-rarity').click();
    const rarityTable = page.getByTestId('rarity-table');
    await expect(rarityTable).toBeVisible({ timeout: 15_000 });

    expect(await headersOf(rarityTable)).toEqual(['TÊN', 'THAO TÁC']);
    await expect(rarityTable.getByRole('columnheader', { name: /^số sản phẩm$/i })).toHaveCount(0);
    expect((await rarityTable.innerText()).toUpperCase()).not.toContain('SỐ SẢN PHẨM');
    await expect(rarityTable.getByTestId('rarity-product-count')).toHaveCount(0);

    const rarityRow = rarityTable.getByRole('row', { name: new RegExp(RARITY_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) });
    await expect(rarityRow).toBeVisible();
    await expect(rarityRow.getByTitle('Sửa')).toBeVisible();
    await expect(rarityRow.getByTitle('Xóa')).toBeVisible();

    await saveShot(page, RARITY_SHOT);
    console.log('[CLEAN UI] Rarity tab is TÊN | THAO TÁC (no SỐ SẢN PHẨM)');

    // ── Tình trạng thẻ tab ───────────────────────────────────────────────
    await page.getByTestId('tab-conditions').click();
    const conditionTable = page.getByTestId('condition-table');
    await expect(conditionTable).toBeVisible({ timeout: 15_000 });

    expect(await headersOf(conditionTable)).toEqual(['TÊN TÌNH TRẠNG', 'THAO TÁC']);
    await expect(conditionTable.getByRole('columnheader', { name: /^số sản phẩm$/i })).toHaveCount(0);
    expect((await conditionTable.innerText()).toUpperCase()).not.toContain('SỐ SẢN PHẨM');
    await expect(conditionTable.getByTestId('condition-product-count')).toHaveCount(0);

    const conditionRow = page.getByTestId(`condition-row-${CONDITION_NAME}`);
    await expect(conditionRow).toBeVisible();
    await expect(conditionRow.getByTitle('Sửa')).toBeVisible();
    await expect(conditionRow.getByTitle('Xóa')).toBeVisible();

    await saveShot(page, CONDITION_SHOT);
    console.log('[CLEAN UI] Tình trạng thẻ tab is TÊN TÌNH TRẠNG | THAO TÁC (no SỐ SẢN PHẨM)');

    // ── Sealed Products tab keeps its SỐ SẢN PHẨM column ─────────────────
    await page.getByTestId('tab-sealed').click();
    const sealedTable = page.getByTestId('sealed-table');
    await expect(sealedTable).toBeVisible({ timeout: 15_000 });
    expect(await headersOf(sealedTable)).toContain('SỐ SẢN PHẨM');
    console.log('[CLEAN UI] Sealed Products tab still shows SỐ SẢN PHẨM');

    console.log(`[SHOT] ${RARITY_SHOT}`);
    console.log(`[SHOT] ${CONDITION_SHOT}`);
  });
});
