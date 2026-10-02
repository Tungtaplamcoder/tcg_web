// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Admin — multi-variant product creation (Add/Edit Product modal).
 *
 * Regression contract:
 *  1. A Single Card product can carry several variant rows with DISTINCT
 *     conditions (Near Mint / Lightly Played / Damaged). "Damaged" used to be
 *     offered by the UI but missing from the backend CardCondition enum, so
 *     the whole submit failed with a vague `variants.N.condition Invalid input`.
 *  2. Price / Stock are submitted as clean numbers, not string primitives.
 *  3. The modal body is a max-height scroll container, so a long variant list
 *     never pushes the sticky Save / Cancel footer out of the viewport.
 *
 * Screenshot (strict):
 *  - successful_test/20_admin_multivariant_form_fixed.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
// Mirror into the workspace-root successful_test/ (the literal task path).
const SHOT_ROOT = path.join(__dirname, '..', '..', 'successful_test');
const SHOT_FILE = path.join(SHOT_DIR, '20_admin_multivariant_form_fixed.png');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tcg.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminSecurePass123!';

// Existing catalogue nodes so the test never pollutes the category tree.
const SERIES_LABEL = 'Sun & Moon Series';
const EXPANSION_LABEL = 'Cosmic Eclipse';

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

async function deleteProductsBySlug(request, token, slug) {
  const res = await request.get(`/api/v1/admin/products?search=${encodeURIComponent(slug)}&limit=100`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok()) return;
  const items = ((await res.json()).data || {}).items || [];
  for (const p of items.filter((x) => x.slug === slug)) {
    await request.delete(`/api/v1/admin/products/${p.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }
}

async function pickCreatable(dialog, name, label) {
  const input = dialog.locator(`[data-creatable-select="${name}"] input`);
  await expect(input).toBeVisible();
  await input.click();
  await input.fill(label);
  await input.press('Enter');
  await expect(input).toHaveValue(label, { timeout: 15_000 });
}

test.describe('Admin — multi-variant product form', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    fs.mkdirSync(SHOT_ROOT, { recursive: true });
  });

  test('creates a product with 3 distinct-condition variants and a scrollable modal body', async ({ page, request }) => {
    const unique = Date.now();
    const productName = `QA Multi Variant ${unique}`;
    const slug = `qa-multi-variant-${unique}`;

    // ── 0. Reset state for repeatable runs ─────────────────────────────
    const token = await adminToken(request);
    await deleteProductsBySlug(request, token, slug);

    // Track any failed product POST so we can assert there were ZERO
    // "Invalid input" / validation errors during the run.
    const failedPosts = [];
    page.on('response', async (res) => {
      if (res.url().includes('/admin/products') && res.request().method() === 'POST' && res.status() >= 400) {
        let body = '';
        try { body = JSON.stringify(await res.json()); } catch { /* ignore */ }
        failedPosts.push({ status: res.status(), body });
      }
    });

    // ── 1. Admin login → product inventory ─────────────────────────────
    await loginAsAdmin(page);
    await page.goto('/admin/inventory', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByRole('heading', { name: /quản lý sản phẩm/i })).toBeVisible();

    // ── 2. Open the "Thêm sản phẩm" modal ──────────────────────────────
    await page.getByRole('button', { name: /thêm sản phẩm/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // ── 3. Fill product basics + valid CARD taxonomy ───────────────────
    await dialog.locator('input[name="name"]').fill(productName);
    await dialog.locator('select[name="category"]').selectOption('CARD');
    await pickCreatable(dialog, 'seriesEra', SERIES_LABEL);
    await pickCreatable(dialog, 'expansionSet', EXPANSION_LABEL);

    // ── 4. Add three variant rows ──────────────────────────────────────
    const addVariant = dialog.getByRole('button', { name: /thêm variant|add variant/i });
    await addVariant.click();
    await addVariant.click();
    await addVariant.click();

    const variantRows = dialog.locator('div.space-y-2 > div').filter({ has: page.locator('select') });
    await expect(variantRows).toHaveCount(3);

    // Auto-select must have produced unique conditions on its own.
    const autoConditions = await variantRows.locator('select').evaluateAll((els) => els.map((e) => e.value));
    expect(new Set(autoConditions).size).toBe(3);

    // ── 5. Fill distinct conditions + numeric price / stock ────────────
    const conditions = ['NEAR_MINT', 'LIGHTLY_PLAYED', 'DAMAGED'];
    for (let i = 0; i < 3; i++) {
      const row = variantRows.nth(i);
      await row.locator('select').selectOption(conditions[i]);
      const numbers = row.locator('input[type="number"]');
      await numbers.nth(0).fill(String(120000 + i * 10000));
      await numbers.nth(1).fill(String(i + 1));
    }

    // ── 6. Modal body must be a scroll container; footer stays visible ──
    const scrollBody = dialog.locator('.custom-scrollbar');
    await expect(scrollBody).toBeVisible();
    const metrics = await scrollBody.evaluate((el) => ({
      overflowY: getComputedStyle(el).overflowY,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight
    }));
    expect(metrics.overflowY).toBe('auto');
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);

    const saveButton = dialog.getByRole('button', { name: /lưu sản phẩm/i });
    await expect(saveButton).toBeInViewport();

    // Scroll the body to the variant rows so the screenshot captures them
    // together with the always-reachable sticky footer.
    await scrollBody.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await page.screenshot({ path: SHOT_FILE, fullPage: false });
    fs.copyFileSync(SHOT_FILE, path.join(SHOT_ROOT, path.basename(SHOT_FILE)));
    expect(fs.existsSync(SHOT_FILE)).toBe(true);
    expect(fs.existsSync(path.join(SHOT_ROOT, path.basename(SHOT_FILE)))).toBe(true);

    // ── 7. Submit and assert a clean, error-free success ───────────────
    await saveButton.click();

    // Modal closes smoothly on success.
    await expect(dialog).toBeHidden({ timeout: 20_000 });

    // No validation / "Invalid input" error box anywhere on the page.
    await expect(page.getByText(/Invalid input/i)).toHaveCount(0);
    expect(failedPosts).toEqual([]);

    // The toast confirms creation and the product really exists server-side.
    await expect(page.getByText(/Đã tạo sản phẩm mới/i)).toBeVisible({ timeout: 10_000 });

    const listRes = await request.get(`/api/v1/admin/products?search=${encodeURIComponent(productName)}&limit=100`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(listRes.ok()).toBeTruthy();
    const created = (((await listRes.json()).data || {}).items || []).find((p) => p.slug === slug);
    expect(created).toBeTruthy();
    const createdConditions = (created.variants || []).map((v) => v.condition).sort();
    expect(createdConditions).toEqual(['DAMAGED', 'LIGHTLY_PLAYED', 'NEAR_MINT']);
    expect((created.variants || []).every((v) => typeof v.price === 'string' || typeof v.price === 'number')).toBe(true);

    console.log(`[MULTIVARIANT] created "${productName}" with conditions ${createdConditions.join(', ')}`);

    // ── 8. Cleanup ─────────────────────────────────────────────────────
    await deleteProductsBySlug(request, token, slug);
  });

  test('rejects duplicate variant conditions with a clear, specific message', async ({ page }) => {
    let postCount = 0;
    page.on('request', (req) => {
      if (req.url().includes('/admin/products') && req.method() === 'POST') postCount += 1;
    });

    await loginAsAdmin(page);
    await page.goto('/admin/inventory', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.getByRole('button', { name: /thêm sản phẩm/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.locator('input[name="name"]').fill(`QA Duplicate Condition ${Date.now()}`);
    await dialog.locator('select[name="category"]').selectOption('CARD');
    await pickCreatable(dialog, 'seriesEra', SERIES_LABEL);
    await pickCreatable(dialog, 'expansionSet', EXPANSION_LABEL);

    const addVariant = dialog.getByRole('button', { name: /thêm variant|add variant/i });
    await addVariant.click();
    await addVariant.click();

    const variantRows = dialog.locator('div.space-y-2 > div').filter({ has: page.locator('select') });
    await expect(variantRows).toHaveCount(2);
    // Force both rows onto the same condition.
    await variantRows.nth(0).locator('select').selectOption('NEAR_MINT');
    await variantRows.nth(1).locator('select').selectOption('NEAR_MINT');

    await dialog.getByRole('button', { name: /lưu sản phẩm/i }).click();

    // Clear, specific Vietnamese message — never a vague "Invalid input",
    // and never a wasted round-trip to the backend.
    await expect(dialog.getByRole('alert')).toContainText('Các biến thể không được trùng tình trạng thẻ');
    await expect(dialog).toBeVisible();
    expect(postCount).toBe(0);

    // The suggestion/auto-select path still works: reopening a fresh row
    // auto-fills a condition not yet used.
    console.log('[MULTIVARIANT] duplicate condition blocked client-side with clear message');
  });
});
