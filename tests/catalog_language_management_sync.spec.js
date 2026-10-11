// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Dynamic product languages ("Ngôn ngữ") — catalog settings ↔ inventory sync.
 *
 * Contract:
 *  1. Catalog Settings exposes a "Ngôn ngữ" tab that manages the CardLanguage
 *     catalogue (GET/POST/PUT/DELETE /api/v1/admin/catalog-settings/languages).
 *     The table shows "TÊN NGÔN NGỮ | SỐ SẢN PHẨM | THAO TÁC" with a live
 *     product-count badge. Only full canonical names are stored ("Japanese",
 *     "English") — never the legacy short codes (JP/ENG/CN/KR).
 *  2. A language created in Catalog Settings appears immediately in the
 *     inventory "Tất cả ngôn ngữ" filter, which is fed by the dynamic
 *     CardLanguage catalogue (GET /api/v1/languages).
 *  3. The product modal's "Ngôn ngữ (Language)" CreatableSelect lists the full
 *     language names from the DB and a product saves successfully with one.
 *
 * Screenshots (strict):
 *  - successful_test/59_catalog_language_tab_dark.png
 *  - successful_test/59_inventory_language_filter_synced_dark.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
// Mirror into the workspace-root successful_test/ (the literal task path).
const SHOT_ROOT = path.join(__dirname, '..', '..', 'successful_test');
const SHOT_TAB = path.join(SHOT_DIR, '59_catalog_language_tab_dark.png');
const SHOT_FILTER = path.join(SHOT_DIR, '59_inventory_language_filter_synced_dark.png');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tcg.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminSecurePass123!';

const LANG_NAME = 'Japanese';

async function enableDarkMode(page) {
  await page.addInitScript(() => {
    try { localStorage.setItem('tcg-theme', 'dark'); } catch (e) { /* private mode */ }
  });
}

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
  await expect(page.locator('html')).toHaveClass(/dark/);
}

async function adminToken(request) {
  const res = await request.post('/api/v1/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).data.accessToken;
}

async function deleteLanguagesByName(request, token, names) {
  const res = await request.get('/api/v1/admin/catalog-settings/languages?activeOnly=false', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const rows = (await res.json()).data || [];
  for (const r of rows.filter((x) => names.includes(x.name))) {
    await request.delete(`/api/v1/admin/catalog-settings/languages/${r.id}`, {
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

// Pick the first option from a CreatableSelect inside the modal dialog.
// Scope to the combobox's own listbox — native <select> options also expose
// role="option" and would otherwise match first.
async function pickFirstOption(dialog, selectName) {
  const input = dialog.locator(`[data-creatable-select="${selectName}"] input`).first();
  await input.click();
  const option = dialog.locator(`[data-creatable-select="${selectName}"] [role="option"]`).first();
  await expect(option).toBeVisible({ timeout: 15_000 });
  await option.click();
}

test.describe('Admin — language catalogue ↔ inventory sync', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    fs.mkdirSync(SHOT_ROOT, { recursive: true });
  });

  test('"Ngôn ngữ" tab manages the catalogue with a live product count', async ({ page, request }) => {
    // ── 0. Clean state so the UI "Create Japanese" path runs repeatably ──
    const token = await adminToken(request);
    await deleteLanguagesByName(request, token, [LANG_NAME]);

    // ── 1. Admin login (dark mode) → Catalog Settings → "Ngôn ngữ" tab ──
    await enableDarkMode(page);
    await loginAsAdmin(page);
    await page.goto('/admin/catalog-settings', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByRole('heading', { name: /cấu hình danh mục/i })).toBeVisible();

    const tab = page.getByTestId('tab-language');
    await expect(tab).toBeVisible();
    // Clean (emoji-free) tab title rendered with a Lucide icon only.
    expect(((await tab.textContent()) || '').replace(/\s+/g, ' ').trim()).toBe('Ngôn ngữ');
    await tab.click();
    await expect(page.getByTestId('language-tab')).toBeVisible();

    // Table contract: exactly the three required columns.
    const table = page.getByTestId('language-table');
    await expect(table).toBeVisible();
    await expect(table.getByRole('columnheader', { name: /tên ngôn ngữ/i })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: /số sản phẩm/i })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: /thao tác/i })).toBeVisible();

    // ── 2. Create "Japanese" (full name, no short code) ──────────────────
    await page.getByTestId('language-name-input').fill(LANG_NAME);
    await page.getByTestId('language-submit').click();

    const row = page.getByTestId(`language-row-${LANG_NAME}`);
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row).toContainText(LANG_NAME);
    // Dynamic count badge, e.g. "0 sản phẩm".
    await expect(row.getByTestId('language-product-count')).toHaveText(/\d+ sản phẩm/);

    // Screenshot 1: "Ngôn ngữ" tab (dark) with the persisted language + count.
    await saveShot(page, SHOT_TAB);

    // ── 3. Persisted and exposed by the live catalogue endpoint ──────────
    const adminRes = await request.get('/api/v1/admin/catalog-settings/languages?activeOnly=false', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const created = ((await adminRes.json()).data || []).find((l) => l.name === LANG_NAME);
    expect(created, 'Japanese must persist in the language catalogue').toBeTruthy();
    expect(created).toHaveProperty('productCount');

    const publicRes = await request.get('/api/v1/languages');
    expect(publicRes.ok()).toBeTruthy();
    expect(((await publicRes.json()).data || []).some((l) => l.name === LANG_NAME)).toBe(true);

    console.log(`[LANG] created "${LANG_NAME}" via Catalog Settings with product count ${created.productCount}`);
  });

  test('inventory "Tất cả ngôn ngữ" filter is synced from the DB', async ({ page }) => {
    await enableDarkMode(page);
    await loginAsAdmin(page);
    await page.goto('/admin/inventory', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByRole('heading', { name: /quản lý sản phẩm/i })).toBeVisible();

    const filter = page.getByTestId('language-filter');
    await expect(filter).toBeVisible();

    // The dynamic language is an option; the hardcoded short codes are gone.
    const options = await filter.locator('option').allInnerTexts();
    expect(options).toContain(LANG_NAME);
    expect(options).not.toContain('JP');
    expect(options).not.toContain('ENG');
    expect(options).not.toContain('CN');
    expect(options).not.toContain('KR');

    // Selecting the dynamic option filters the table.
    await filter.selectOption({ label: LANG_NAME });
    await expect(filter).toHaveValue(LANG_NAME);

    // Screenshot 2: inventory filter synced (dark).
    await saveShot(page, SHOT_FILTER);

    console.log('[LANG] inventory filter dropdown lists dynamic full language names');
  });

  test('product modal lists full language names and saves successfully', async ({ page }) => {
    await enableDarkMode(page);
    await loginAsAdmin(page);
    await page.goto('/admin/inventory', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByRole('heading', { name: /quản lý sản phẩm/i })).toBeVisible();

    await page.getByRole('button', { name: /thêm sản phẩm/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const unique = Date.now();
    await dialog.locator('input[name="name"]').fill(`E2E Language Card ${unique}`);

    // Single Cards use the Condition + Language variant structure.
    await dialog.locator('select[name="category"]').selectOption('CARD');

    // Cascading category tree: Series → Expansion.
    await pickFirstOption(dialog, 'seriesEra');
    await pickFirstOption(dialog, 'expansionSet');
    await pickFirstOption(dialog, 'rarity');

    // ── "Ngôn ngữ (Language)" — full names only, no short codes ──────────
    const langInput = dialog.locator('[data-creatable-select="language"] input').first();
    await expect(langInput).toBeVisible();
    await langInput.click();
    const langOptions = dialog.locator('[data-creatable-select="language"] [role="option"]');
    await expect(langOptions.filter({ hasText: LANG_NAME })).toBeVisible({ timeout: 15_000 });
    const labels = await langOptions.allInnerTexts();
    expect(labels).toContain('English');
    expect(labels).toContain(LANG_NAME);
    expect(labels).not.toContain('JP');
    expect(labels).not.toContain('ENG');
    expect(labels).not.toContain('CN');
    expect(labels).not.toContain('KR');
    await langOptions.filter({ hasText: LANG_NAME }).first().click();
    await expect(langInput).toHaveValue(LANG_NAME);

    // Add a variant row and fill price + stock.
    await dialog.getByRole('button', { name: /thêm variant/i }).first().click();
    const numbers = dialog.locator('input[type="number"]');
    await numbers.nth(0).fill('123000');
    await numbers.nth(1).fill('3');

    // ── Save ─────────────────────────────────────────────────────────────
    await dialog.getByRole('button', { name: /lưu sản phẩm/i }).click();
    await expect(page.getByText(/đã tạo sản phẩm mới/i)).toBeVisible({ timeout: 15_000 });
    await expect(dialog).toBeHidden({ timeout: 15_000 });

    console.log('[LANG] product saved with full language name from the dynamic catalogue');
  });
});
