// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Master refactor verification — catalog schema simplification + creatable
 * selects + product-detail i18n cleanup.
 *
 *  1. /admin/catalog-settings — the Rarity / Sealed Products / Card Conditions
 *     tables expose ONLY `TÊN` + `THAO TÁC`; `code`/`description` columns
 *     ("Mã" / "Mô tả") are permanently dropped.
 *  2. /admin/inventory — the variant "Tình trạng" dropdown is a CreatableSelect:
 *     typing `abc` shows `+ Thêm tình trạng: "abc"` (pink Plus icon); clicking
 *     it persists the condition and auto-selects it.
 *  3. /catalog/:id — a single card whose variant condition has no i18n key
 *     renders the raw condition, never the leaked `product.condition.*` key.
 *
 * Screenshots (strict):
 *  - successful_test/56_admin_catalog_simplified_tables.png
 *  - successful_test/56_inventory_creatable_select_working.png
 *  - successful_test/56_product_detail_i18n_cleaned.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
// Mirror into the workspace-root successful_test/ (the literal task path).
const SHOT_ROOT = path.join(__dirname, '..', '..', 'successful_test');
const SHOT_CATALOG = path.join(SHOT_DIR, '56_admin_catalog_simplified_tables.png');
const SHOT_INVENTORY = path.join(SHOT_DIR, '56_inventory_creatable_select_working.png');
const SHOT_DETAIL = path.join(SHOT_DIR, '56_product_detail_i18n_cleaned.png');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tcg.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminSecurePass123!';

// The exact string from the task. It is deleted before the run so the fresh
// "create" branch is always exercised (the spec stays re-runnable).
const NEW_CONDITION = 'abc';

const STAMP = Date.now();
const DETAIL_PRODUCT = `E2E I18N Condition Card ${STAMP}`;
const DETAIL_SERIES = `E2E I18N Series ${STAMP}`;
const DETAIL_SET = `E2E I18N Set ${STAMP}`;
const DETAIL_CONDITION = 'PSA 10';

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
  expect(res.ok(), 'admin login for test setup').toBeTruthy();
  return (await res.json()).data.accessToken;
}

async function deleteConditionByName(request, token, name) {
  const res = await request.get('/api/v1/admin/card-conditions?activeOnly=false', auth(token));
  if (!res.ok()) return;
  const rows = (await res.json()).data || [];
  for (const row of rows) {
    if (String(row.name).toLowerCase() === name.toLowerCase()) {
      await request.delete(`/api/v1/admin/card-conditions/${row.id}`, auth(token));
    }
  }
}

async function saveShot(page, shotPath, fullPage = false) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  fs.mkdirSync(SHOT_ROOT, { recursive: true });
  await page.screenshot({ path: shotPath, fullPage });
  fs.copyFileSync(shotPath, path.join(SHOT_ROOT, path.basename(shotPath)));
  expect(fs.existsSync(shotPath)).toBe(true);
  expect(fs.existsSync(path.join(SHOT_ROOT, path.basename(shotPath)))).toBe(true);
}

/** Compose several element screenshots into one stacked verification image. */
async function stitchScreenshots(page, shotPath, shots) {
  const html = `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:ui-sans-serif,system-ui,sans-serif">
    ${shots
      .map(
        (s) => `<div style="padding:10px 16px 4px">
          <div style="font-weight:700;font-size:14px;color:#0f172a;padding:6px 0">${s.label}</div>
          <img src="${s.dataUrl}" style="display:block;width:1100px;border:1px solid #e2e8f0;border-radius:6px"/>
        </div>`
      )
      .join('')}
  </body></html>`;

  const composer = await page.context().newPage();
  await composer.setViewportSize({ width: 1160, height: 900 });
  await composer.setContent(html, { waitUntil: 'load' });
  await composer.waitForFunction(() =>
    Array.from(document.images).every((img) => img.complete && img.naturalWidth > 0)
  );
  await composer.screenshot({ path: shotPath, fullPage: true });
  await composer.close();
  fs.mkdirSync(SHOT_ROOT, { recursive: true });
  fs.copyFileSync(shotPath, path.join(SHOT_ROOT, path.basename(shotPath)));
  expect(fs.existsSync(shotPath)).toBe(true);
}

test.describe('Catalog schema simplification + creatable selects + i18n', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    fs.mkdirSync(SHOT_ROOT, { recursive: true });
  });

  // ── 1. Catalog Settings tables: only TÊN + THAO TÁC ────────────────────
  test('catalog settings tables expose only TÊN and THAO TÁC', async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('[console.error]', msg.text());
    });

    await loginAsAdmin(page);
    await page.goto('/admin/catalog-settings', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByRole('heading', { name: /cấu hình danh mục/i })).toBeVisible();

    const TABS = [
      { key: 'rarity', label: 'Quản lý Độ hiếm (Rarity)' },
      { key: 'sealed', label: 'Sealed Products' },
      { key: 'conditions', label: 'Tình trạng thẻ' }
    ];

    const shots = [];
    for (const tab of TABS) {
      const tabButton = page.getByTestId(`tab-${tab.key}`);
      await expect(tabButton, `tab ${tab.label}`).toBeVisible();
      await tabButton.click();

      const table = page.locator('table:visible').first();
      await expect(table, `${tab.label}: table renders`).toBeVisible({ timeout: 15_000 });

      const headers = (await table.locator('thead th').allTextContents()).map((h) => h.trim().toLowerCase());
      // Zero "Mã" / "Mô tả" columns.
      for (const h of headers) {
        expect(h.includes('mã'), `${tab.label}: no "Mã" column (got "${h}")`).toBeFalsy();
        expect(h.includes('mô tả'), `${tab.label}: no "Mô tả" column (got "${h}")`).toBeFalsy();
      }
      // Exactly two columns: a name header + the action header.
      expect(headers.length, `${tab.label}: exactly 2 columns`).toBe(2);
      expect(headers.some((h) => h.startsWith('tên')), `${tab.label}: TÊN column`).toBeTruthy();
      expect(headers.includes('thao tác'), `${tab.label}: THAO TÁC column`).toBeTruthy();

      const buffer = await table.screenshot({ type: 'png' });
      shots.push({
        label: `${tab.label} — ${headers.join(' | ')}`,
        dataUrl: `data:image/png;base64,${buffer.toString('base64')}`
      });
      console.log(`[TAB ${tab.label}] headers: ${headers.join(' | ')}`);
    }

    await stitchScreenshots(page, SHOT_CATALOG, shots);
    console.log(`[SHOT] saved ${SHOT_CATALOG}`);
  });

  // ── 2. Inventory CreatableSelect condition quick-create ────────────────
  test('inventory condition dropdown creates + auto-selects a new value', async ({ page, request }) => {
    const token = await adminToken(request);
    // Ensure the exact task value does not already exist so the create option renders.
    await deleteConditionByName(request, token, NEW_CONDITION);

    await loginAsAdmin(page);
    await page.goto('/admin/inventory', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    // Open the create-product modal.
    await page.getByRole('button', { name: /thêm sản phẩm/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Single Cards → reveals the variant "Tình trạng" CreatableSelect.
    await dialog.locator('select[name="category"]').selectOption('CARD');
    await dialog.getByRole('button', { name: /thêm variant/i }).click();

    const conditionSelect = dialog.locator('[data-testid="variant-condition-0"]');
    await expect(conditionSelect).toBeVisible();
    const input = conditionSelect.locator('input[role="combobox"]');
    await input.click();
    await input.fill(NEW_CONDITION);

    // Inline create option: `+ Thêm tình trạng: "abc"` with a pink Plus icon.
    const createOption = conditionSelect.getByRole('option', { name: new RegExp(`thêm tình trạng:\\s*"${NEW_CONDITION}"`, 'i') });
    await expect(createOption, 'inline create option must appear').toBeVisible();
    await expect(createOption.locator('svg.text-pink-500'), 'pink Plus icon on create option').toHaveCount(1);

    await createOption.click();

    // Auto-selected on the variant row + persisted to the DB.
    await expect(input).toHaveValue(NEW_CONDITION);
    await expect
      .poll(async () => {
        const res = await request.get('/api/v1/admin/card-conditions?activeOnly=false', auth(token));
        const rows = (await res.json()).data || [];
        return rows.some((r) => String(r.name).toLowerCase() === NEW_CONDITION.toLowerCase());
      }, { timeout: 10_000 })
      .toBe(true);

    await expect(dialog).toBeVisible();
    await saveShot(page, SHOT_INVENTORY);
    console.log(`[SHOT] saved ${SHOT_INVENTORY}`);
  });

  // ── 3. Product detail: dynamic condition label, no raw i18n keys ───────
  test('product detail renders raw dynamic condition without i18n key leakage', async ({ page, request }) => {
    const token = await adminToken(request);

    // Create a single card whose variant condition has no `product.condition.*`
    // key (a dynamic value), then open its detail page.
    const createRes = await request.post('/api/v1/admin/products', {
      ...auth(token),
      data: {
        name: DETAIL_PRODUCT,
        category: 'single-cards',
        categoryPath: ['CARD', DETAIL_SERIES, DETAIL_SET],
        language: 'ENG',
        cardSet: DETAIL_SET,
        rarity: 'Illustration Rare',
        images: [],
        variants: [{ condition: DETAIL_CONDITION, variant: 'Normal', price: 123000, stockQuantity: 1 }]
      }
    });
    expect(createRes.ok(), `create product (${createRes.status()})`).toBeTruthy();
    const product = (await createRes.json()).data;
    expect(product?.id, 'created product id').toBeTruthy();

    await page.goto(`/catalog/${product.id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    // The dynamic condition chip is visible and reads as raw text.
    await expect(page.getByRole('heading', { name: new RegExp(DETAIL_PRODUCT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })).toBeVisible();
    await expect(page.getByText(DETAIL_CONDITION, { exact: false }).first()).toBeVisible();

    // No leaked i18n keys anywhere on the page.
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.includes('product.condition.'), 'no raw product.condition.* keys').toBeFalsy();

    // No warm yellow/orange accents on the condition chips / stars.
    const warm = await page.evaluate(() => {
      const re = /(amber|orange|yellow)-/;
      const els = Array.from(document.querySelectorAll('[class*="text-"], [class*="bg-"], [class*="ring-"]'));
      return els.filter((el) => re.test(el.className)).length;
    });
    expect(warm, 'no warm amber/orange/yellow accent classes').toBe(0);

    await saveShot(page, SHOT_DETAIL, true);
    console.log(`[SHOT] saved ${SHOT_DETAIL}`);
  });
});
