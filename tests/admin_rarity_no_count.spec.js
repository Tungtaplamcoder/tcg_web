// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Rarity tab — remove the "SỐ SẢN PHẨM" column, keep Edit modal.
 *
 * Contract:
 *  1. The "Quản lý Độ hiếm (Rarity)" table header is strictly
 *     MÃ | TÊN | THAO TÁC — the "SỐ SẢN PHẨM" column is completely absent.
 *  2. Every row keeps Edit (✏️) + Delete (🗑️) actions.
 *  3. Clicking Edit opens the centered floating <CatalogEditModal> pre-filled
 *     with the row's Mã (code) and Tên (name).
 *
 * Screenshot (strict):
 *  - successful_test/33_rarity_tab_no_count_fixed.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
// Also mirror into the workspace-root successful_test/ (the literal task path).
const SHOT_ROOT = path.join(__dirname, '..', '..', 'successful_test');
const SHOT_PATH = path.join(SHOT_DIR, '33_rarity_tab_no_count_fixed.png');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tcg.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminSecurePass123!';

const STAMP = Date.now();
const RARITY_CODE = `NORC${String(STAMP).slice(-5)}`;
const RARITY_NAME = `E2E NoCount ${STAMP}`;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

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

async function saveShot(page) {
  await page.screenshot({ path: SHOT_PATH, fullPage: false });
  fs.mkdirSync(SHOT_ROOT, { recursive: true });
  fs.copyFileSync(SHOT_PATH, path.join(SHOT_ROOT, path.basename(SHOT_PATH)));
  expect(fs.existsSync(SHOT_PATH)).toBe(true);
  expect(fs.existsSync(path.join(SHOT_ROOT, path.basename(SHOT_PATH)))).toBe(true);
}

test.describe('Admin — rarity tab without product-count column', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });
  test.describe.configure({ mode: 'serial' });

  let token;
  let rarityId;

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    fs.mkdirSync(SHOT_ROOT, { recursive: true });
  });

  test.afterAll(async ({ request }) => {
    if (!token || !rarityId) return;
    await request.delete(`/api/v1/admin/rarities/${rarityId}`, auth(token));
  });

  test('rarity table is MÃ | TÊN | THAO TÁC and Edit opens a pre-filled modal', async ({ page, request }) => {
    token = await adminToken(request);

    // ── 0. Deterministic fixture so a known row exists for the prefill check ─
    const createRes = await request.post('/api/v1/admin/rarities', {
      ...auth(token),
      data: { code: RARITY_CODE, name: RARITY_NAME }
    });
    expect(createRes.ok()).toBeTruthy();
    rarityId = (await createRes.json()).data.id;

    // ── 1. Admin login → Catalog Settings → Rarity tab ─────────────────
    await loginAsAdmin(page);
    await page.goto('/admin/catalog-settings', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByRole('heading', { name: /cấu hình danh mục/i })).toBeVisible();

    const rarityTab = page.getByTestId('tab-rarity');
    await expect(rarityTab).toBeVisible();
    await rarityTab.click();

    const table = page.getByTestId('rarity-table');
    await expect(table).toBeVisible({ timeout: 15_000 });

    // ── 2. Header contract: strictly MÃ | TÊN | THAO TÁC ──────────────
    const headers = (await table.locator('thead th').allTextContents()).map((h) => h.trim().toUpperCase());
    expect(headers).toEqual(['MÃ', 'TÊN', 'THAO TÁC']);
    expect(headers).not.toContain('SỐ SẢN PHẨM');
    await expect(table.getByRole('columnheader', { name: /^số sản phẩm$/i })).toHaveCount(0);

    const tableText = (await table.innerText()).toUpperCase();
    expect(tableText).not.toContain('SỐ SẢN PHẨM');
    // No product-count badges remain in the rarity table.
    await expect(table.getByTestId('rarity-product-count')).toHaveCount(0);

    // ── 3. Row keeps Edit + Delete; Edit opens the floating modal ──────
    const row = table.getByRole('row', { name: new RegExp(escapeRe(RARITY_NAME)) });
    await expect(row).toBeVisible();
    await expect(row.getByTitle('Sửa')).toBeVisible();
    await expect(row.getByTitle('Xóa')).toBeVisible();

    await row.getByTitle('Sửa').click();
    const modal = page.getByTestId('catalog-edit-modal');
    await expect(modal).toBeVisible();
    await expect(page.getByTestId('catalog-edit-title')).toContainText(RARITY_NAME);
    await expect(page.getByTestId('catalog-edit-code')).toHaveValue(RARITY_CODE);
    await expect(page.getByTestId('catalog-edit-name')).toHaveValue(RARITY_NAME);

    // ── 4. Verified screenshot ─────────────────────────────────────────
    await saveShot(page);

    console.log('[RARITY] headers MÃ | TÊN | THAO TÁC; no product count; Edit modal pre-filled');
  });
});
