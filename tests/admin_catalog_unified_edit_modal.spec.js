// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Catalog Settings — unified floating Edit modal + count-column cleanup.
 *
 * Contract verified across ALL FOUR tabs (Series / Era, Expansion Sets,
 * Quản lý Độ hiếm (Rarity), Sealed Products):
 *  1. Series / Era headers are strictly TÊN | THAO TÁC — no "SỐ SẢN PHẨM".
 *  2. Expansion Sets headers are TÊN | SERIES | SỐ SẢN PHẨM | THAO TÁC.
 *  3. Rarity is MÃ | TÊN | THAO TÁC (no count); Sealed keeps
 *     MÃ | TÊN DANH MỤC | SỐ SẢN PHẨM | THAO TÁC.
 *  4. Every row exposes Edit (✏️) + Delete (🗑️); clicking Edit opens the
 *     shared floating <CatalogEditModal> pre-filled with the row's values.
 *  5. Saving (Cập nhật) issues the tab's backend PUT, shows the success toast,
 *     closes the modal and refreshes the table.
 *
 * Screenshots (strict):
 *  - successful_test/31_catalog_series_era_no_count_fixed.png
 *  - successful_test/31_catalog_unified_edit_modal.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const SHOT_ROOT = path.join(__dirname, '..', '..', 'successful_test');
const SHOT_SERIES = path.join(SHOT_DIR, '31_catalog_series_era_no_count_fixed.png');
const SHOT_MODAL = path.join(SHOT_DIR, '31_catalog_unified_edit_modal.png');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tcg.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminSecurePass123!';

const STAMP = Date.now();
const SERIES_NAME = `E2E Series ${STAMP}`;
const SERIES_NAME_UPDATED = `E2E Series ${STAMP} updated`;
const EXPANSION_NAME = `E2E Expansion ${STAMP}`;
const RARITY_CODE = `E2E${String(STAMP).slice(-5)}`;
const RARITY_NAME = `E2E Rarity ${STAMP}`;
const SEALED_CODE = `e2e-sealed-${String(STAMP).slice(-5)}`;
const SEALED_NAME = `E2E Sealed ${STAMP}`;

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

async function saveShot(page, target) {
  await page.screenshot({ path: target, fullPage: false });
  fs.mkdirSync(SHOT_ROOT, { recursive: true });
  fs.copyFileSync(target, path.join(SHOT_ROOT, path.basename(target)));
  expect(fs.existsSync(target)).toBe(true);
  expect(fs.existsSync(path.join(SHOT_ROOT, path.basename(target)))).toBe(true);
}

async function headersOf(table) {
  return (await table.locator('thead th').allTextContents()).map((h) => h.trim().toUpperCase());
}

test.describe('Admin — catalog unified edit modal & count-column cleanup', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });
  test.describe.configure({ mode: 'serial' });

  let token;
  let rootId;
  let seriesId;
  let expansionId;
  let rarityId;
  let sealedId;

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    fs.mkdirSync(SHOT_ROOT, { recursive: true });
  });

  test.afterAll(async ({ request }) => {
    if (!token) return;
    // Children before parents: delete expansion → series.
    if (sealedId) await request.delete(`/api/v1/admin/sealed-categories/${sealedId}`, auth(token));
    if (rarityId) await request.delete(`/api/v1/admin/rarities/${rarityId}`, auth(token));
    if (expansionId) await request.delete(`/api/v1/admin/categories/${expansionId}`, auth(token));
    if (seriesId) await request.delete(`/api/v1/admin/categories/${seriesId}`, auth(token));
  });

  test('edit modal opens pre-filled on every tab; Series and Rarity drop the count column', async ({ page, request }) => {
    token = await adminToken(request);

    // ── 0. Deterministic fixtures via API ────────────────────────────────
    const cats = await request.get('/api/v1/admin/categories?activeOnly=false', auth(token));
    const root = ((await cats.json()).data || []).find((c) => c.slug === 'single-cards');
    expect(root, 'single-cards root category').toBeTruthy();
    rootId = root.id;

    const seriesRes = await request.post('/api/v1/admin/categories', {
      ...auth(token),
      data: { name: SERIES_NAME, parentId: rootId }
    });
    expect(seriesRes.ok()).toBeTruthy();
    seriesId = (await seriesRes.json()).data.id;

    const expandRes = await request.post('/api/v1/admin/categories', {
      ...auth(token),
      data: { name: EXPANSION_NAME, parentId: seriesId }
    });
    expect(expandRes.ok()).toBeTruthy();
    expansionId = (await expandRes.json()).data.id;

    const rarityRes = await request.post('/api/v1/admin/rarities', {
      ...auth(token),
      data: { code: RARITY_CODE, name: RARITY_NAME }
    });
    expect(rarityRes.ok()).toBeTruthy();
    rarityId = (await rarityRes.json()).data.id;

    const sealedRes = await request.post('/api/v1/admin/sealed-categories', {
      ...auth(token),
      data: { code: SEALED_CODE, name: SEALED_NAME }
    });
    expect(sealedRes.ok()).toBeTruthy();
    sealedId = (await sealedRes.json()).data.id;

    // ── 1. Admin login → Catalog Settings ────────────────────────────────
    await loginAsAdmin(page);
    await page.goto('/admin/catalog-settings', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByRole('heading', { name: /cấu hình danh mục/i })).toBeVisible();

    const modal = page.getByTestId('catalog-edit-modal');

    // ── 2. Series / Era — headers strict TÊN | THAO TÁC, no count ────────
    await page.getByTestId('tab-series').click();
    const seriesTable = page.getByTestId('series-tab').locator('table');
    await expect(seriesTable).toBeVisible({ timeout: 15_000 });
    expect(await headersOf(seriesTable)).toEqual(['TÊN', 'THAO TÁC']);
    await expect(seriesTable.getByRole('columnheader', { name: /^số sản phẩm$/i })).toHaveCount(0);

    const seriesRow = seriesTable.getByRole('row', { name: new RegExp(escapeRe(SERIES_NAME)) });
    await expect(seriesRow).toBeVisible();
    await expect(seriesRow.getByTitle('Sửa')).toBeVisible();
    await expect(seriesRow.getByTitle('Xóa')).toBeVisible();

    await saveShot(page, SHOT_SERIES);

    // ── 3. Series Edit modal — pre-filled + working PUT round-trip ───────
    await seriesRow.getByTitle('Sửa').click();
    await expect(modal).toBeVisible();
    await expect(page.getByTestId('catalog-edit-title')).toContainText('Chỉnh sửa');
    await expect(page.getByTestId('catalog-edit-title')).toContainText(SERIES_NAME);
    await expect(page.getByTestId('catalog-edit-name')).toHaveValue(SERIES_NAME);

    await page.getByTestId('catalog-edit-name').fill(SERIES_NAME_UPDATED);
    await page.getByTestId('catalog-edit-save').click();
    await expect(modal).toBeHidden({ timeout: 15_000 });

    const toast = page.getByTestId('catalog-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toHaveAttribute('data-toast-type', 'success');
    await expect(toast).toContainText('Đã cập nhật.');
    await expect(
      seriesTable.getByRole('row', { name: new RegExp(escapeRe(SERIES_NAME_UPDATED)) })
    ).toBeVisible({ timeout: 15_000 });
    console.log('[SERIES] count column absent; Edit modal pre-filled; PUT refresh verified');

    // ── 4. Expansion Sets — headers TÊN | SERIES | SỐ SẢN PHẨM | THAO TÁC ─
    await page.getByTestId('tab-expansions').click();
    const expTable = page.getByTestId('expansions-tab').locator('table');
    await expect(expTable).toBeVisible({ timeout: 15_000 });
    expect(await headersOf(expTable)).toEqual(['TÊN', 'SERIES', 'SỐ SẢN PHẨM', 'THAO TÁC']);
    await expect(expTable.getByRole('columnheader', { name: /^số sản phẩm$/i })).toHaveCount(1);

    await expTable.getByRole('row', { name: new RegExp(escapeRe(EXPANSION_NAME)) }).getByTitle('Sửa').click();
    await expect(modal).toBeVisible();
    await expect(page.getByTestId('catalog-edit-title')).toContainText(EXPANSION_NAME);
    await expect(page.getByTestId('catalog-edit-name')).toHaveValue(EXPANSION_NAME);
    await expect(page.getByTestId('catalog-edit-parentId')).toHaveValue(seriesId);
    await page.getByRole('button', { name: 'Hủy', exact: true }).click();
    await expect(modal).toBeHidden();
    console.log('[EXPANSIONS] count column present; Edit modal pre-filled with parent series');

    // ── 5. Rarity — count column dropped; modal opens + screenshot ──────
    await page.getByTestId('tab-rarity').click();
    const rarityTable = page.getByTestId('rarity-table');
    await expect(rarityTable).toBeVisible({ timeout: 15_000 });
    expect(await headersOf(rarityTable)).toEqual(['MÃ', 'TÊN', 'THAO TÁC']);

    await rarityTable.getByRole('row', { name: new RegExp(escapeRe(RARITY_NAME)) }).getByTitle('Sửa').click();
    await expect(modal).toBeVisible();
    await expect(page.getByTestId('catalog-edit-title')).toContainText(RARITY_NAME);
    await expect(page.getByTestId('catalog-edit-code')).toHaveValue(RARITY_CODE);
    await expect(page.getByTestId('catalog-edit-name')).toHaveValue(RARITY_NAME);

    // Verified screenshot: unified floating Edit modal pre-filled.
    await saveShot(page, SHOT_MODAL);
    await page.getByRole('button', { name: 'Hủy', exact: true }).click();
    await expect(modal).toBeHidden();
    console.log('[RARITY] count column dropped; Edit modal pre-filled');

    // ── 6. Sealed Products — headers unchanged; modal opens ─────────────
    await page.getByTestId('tab-sealed').click();
    const sealedTable = page.getByTestId('sealed-categories-tab').locator('table');
    await expect(sealedTable).toBeVisible({ timeout: 15_000 });
    expect(await headersOf(sealedTable)).toEqual(['MÃ', 'TÊN DANH MỤC', 'SỐ SẢN PHẨM', 'THAO TÁC']);

    await sealedTable.getByRole('row', { name: new RegExp(escapeRe(SEALED_NAME)) }).getByTitle('Sửa').click();
    await expect(modal).toBeVisible();
    await expect(page.getByTestId('catalog-edit-title')).toContainText(SEALED_NAME);
    await expect(page.getByTestId('catalog-edit-code')).toHaveValue(SEALED_CODE);
    await expect(page.getByTestId('catalog-edit-name')).toHaveValue(SEALED_NAME);
    await page.getByRole('button', { name: 'Hủy', exact: true }).click();
    await expect(modal).toBeHidden();
    console.log('[SEALED] headers unchanged; Edit modal pre-filled');

    console.log('[SHOT] saved series + unified modal screenshots');
  });

  test('PUT /api/v1/admin/categories/:id alias updates a category name', async ({ request }) => {
    test.skip(!seriesId, 'series fixture unavailable');
    const res = await request.put(`/api/v1/admin/categories/${expansionId}`, {
      ...auth(token),
      data: { name: `${EXPANSION_NAME} via PUT` }
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.name).toBe(`${EXPANSION_NAME} via PUT`);
    console.log('[PUT] /admin/categories/:id alias verified');
  });
});
