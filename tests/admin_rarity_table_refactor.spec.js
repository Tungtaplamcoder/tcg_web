// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Rarity table refactor — the redundant "Mô tả" column is gone AND the
 * "SỐ SẢN PHẨM" (product count) column has been removed, leaving the strict
 * MÃ | TÊN | THAO TÁC layout.
 *
 * Contract:
 *  1. Catalog Settings → "Quản lý Độ hiếm (Rarity)" quick-add form exposes
 *     only Mã (code) + Tên (name); the duplicate "Mô tả" input is gone.
 *  2. The rarity table header is strictly MÃ | TÊN | THAO TÁC — the
 *     "MÔ TẢ" and "SỐ SẢN PHẨM" headers/cells are completely absent.
 *  3. No per-row product-count badge is rendered.
 *
 * Screenshot (strict):
 *  - successful_test/28_rarity_table_product_count_fixed.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
// Also mirror into the workspace-root successful_test/ (the literal task path).
const SHOT_ROOT = path.join(__dirname, '..', '..', 'successful_test');
const SHOT_PATH = path.join(SHOT_DIR, '28_rarity_table_product_count_fixed.png');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tcg.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminSecurePass123!';

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

test.describe('Admin — rarity table product count refactor', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    fs.mkdirSync(SHOT_ROOT, { recursive: true });
  });

  test('GET /api/v1/admin/rarities exposes a numeric productCount', async ({ request }) => {
    const token = await adminToken(request);
    const res = await request.get('/api/v1/admin/rarities?activeOnly=false', {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(res.ok()).toBeTruthy();

    const rows = (await res.json()).data || [];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(Number.isFinite(Number(row.productCount))).toBe(true);
      expect(Number(row.productCount)).toBeGreaterThanOrEqual(0);
    }

    console.log(`[RARITY] ${rows.length} rarities returned with productCount`);
  });

  test('rarity tab omits Mô tả and the product-count column', async ({ page }) => {
    // ── 1. Admin login → Catalog Settings ──────────────────────────────
    await loginAsAdmin(page);
    await page.goto('/admin/catalog-settings', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByRole('heading', { name: /cấu hình danh mục/i })).toBeVisible();

    // ── 2. Open the "Quản lý Độ hiếm (Rarity)" tab ─────────────────────
    const rarityTab = page.getByTestId('tab-rarity');
    await expect(rarityTab).toBeVisible();
    await rarityTab.click();

    const table = page.getByTestId('rarity-table');
    await expect(table).toBeVisible({ timeout: 15_000 });

    // ── 3. Table header contract: MÃ | TÊN | THAO TÁC ──────────────────
    const headers = (await table.locator('thead th').allTextContents()).map((h) => h.trim().toUpperCase());
    expect(headers).toEqual(['MÃ', 'TÊN', 'THAO TÁC']);
    expect(headers).not.toContain('MÔ TẢ');
    expect(headers).not.toContain('SỐ SẢN PHẨM');

    const tableText = (await table.innerText()).toUpperCase();
    expect(tableText).not.toContain('MÔ TẢ');
    expect(tableText).not.toContain('SỐ SẢN PHẨM');

    // ── 4. The quick-add form no longer has a description input ────────
    const form = page.getByTestId('rarity-form');
    await expect(form).toBeVisible();
    await expect(page.getByTestId('rarity-code-input')).toBeVisible();
    await expect(page.getByTestId('rarity-name-input')).toBeVisible();
    // Only the two named text inputs remain — no Mô tả / placeholder "Tùy chọn".
    await expect(form.locator('input[type="text"]')).toHaveCount(2);
    await expect(form.getByText('Mô tả', { exact: true })).toHaveCount(0);

    // ── 5. No per-row product-count badge is rendered ──────────────────
    await expect(page.getByTestId('rarity-product-count')).toHaveCount(0);

    // ── 6. Verified screenshot ─────────────────────────────────────────
    await saveShot(page);

    console.log('[RARITY] headers MÃ | TÊN | THAO TÁC; product-count column removed');
  });
});
