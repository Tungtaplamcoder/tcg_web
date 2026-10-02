// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Dynamic Rarity management — mirrors Series / Era + Expansion Set behaviour.
 *
 * Contract:
 *  1. The product modal's "Độ hiếm (Rarity)" field is a creatable combobox
 *     fed by GET /api/v1/rarities (no longer a hardcoded <select>).
 *  2. An admin can quick-add a brand-new rarity inline ("+ Thêm độ hiếm")
 *     without closing the modal; it is persisted through POST
 *     /api/v1/admin/rarities.
 *  3. The newly created rarity is selected, retained in the field, and still
 *     available after closing/reopening the modal (server round-trip).
 *
 * Screenshots (strict):
 *  - successful_test/18_admin_dynamic_rarity_dropdown.png
 *  - successful_test/18_admin_dynamic_rarity_created.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
// Also mirror into the workspace-root successful_test/ (the literal task path).
const SHOT_ROOT = path.join(__dirname, '..', '..', 'successful_test');
const SHOT_DROPDOWN = path.join(SHOT_DIR, '18_admin_dynamic_rarity_dropdown.png');
const SHOT_CREATED = path.join(SHOT_DIR, '18_admin_dynamic_rarity_created.png');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tcg.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminSecurePass123!';

// A genuinely new option (not in the seeded catalogue) so the quick-add
// create path is exercised deterministically and the test is re-runnable.
const RARITY_CODE = 'QAR';
const RARITY_NAME = 'QA Rare';
const RARITY_LABEL = `${RARITY_CODE} - ${RARITY_NAME}`;

async function loginAsAdmin(page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.locator('input[type="text"]').first().fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
  // The login page redirects all roles to "/" on success, so wait for the
  // route to leave /login rather than assuming an /admin landing.
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

async function deleteRarityIfExists(request, token) {
  const res = await request.get('/api/v1/admin/rarities?activeOnly=false', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const rows = (await res.json()).data || [];
  for (const r of rows.filter((x) => x.code === RARITY_CODE)) {
    await request.delete(`/api/v1/admin/rarities/${r.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }
}

async function saveShot(page, target) {
  await page.screenshot({ path: target, fullPage: false });
  fs.copyFileSync(target, path.join(SHOT_ROOT, path.basename(target)));
  expect(fs.existsSync(target)).toBe(true);
  expect(fs.existsSync(path.join(SHOT_ROOT, path.basename(target)))).toBe(true);
}

async function openRarityField(page, dialog) {
  await dialog.locator('select[name="category"]').selectOption('CARD');
  const input = dialog.locator('[data-creatable-select="rarity"] input[name="rarity"]');
  await expect(input).toBeVisible();
  return input;
}

test.describe('Admin — dynamic rarity management (like Series / Era)', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    fs.mkdirSync(SHOT_ROOT, { recursive: true });
  });

  test('quick-add a new rarity, select it, and retain it in the product modal', async ({ page, request }) => {
    // ── 0. Clean state for repeatable runs ─────────────────────────────
    const token = await adminToken(request);
    await deleteRarityIfExists(request, token);

    // ── 1. Admin login → product inventory ─────────────────────────────
    await loginAsAdmin(page);
    await page.goto('/admin/inventory', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByRole('heading', { name: /quản lý sản phẩm/i })).toBeVisible();

    // ── 2. Open the "Thêm sản phẩm" modal ──────────────────────────────
    await page.getByRole('button', { name: /thêm sản phẩm/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    let rarityInput = await openRarityField(page, dialog);

    // ── 3. Quick-add a brand-new rarity inline ─────────────────────────
    await rarityInput.click();
    await rarityInput.fill(RARITY_LABEL);

    const createOption = dialog
      .getByRole('option')
      .filter({ hasText: /Thêm độ hiếm/ })
      .filter({ hasText: RARITY_LABEL });
    await expect(createOption).toBeVisible();

    // Screenshot 1: the dynamic dropdown offering the quick-add action.
    await saveShot(page, SHOT_DROPDOWN);

    await createOption.click();
    await expect(rarityInput).toHaveValue(RARITY_LABEL, { timeout: 15_000 });

    // Screenshot 2: the freshly created rarity selected in the modal.
    await saveShot(page, SHOT_CREATED);

    // ── 4. Persisted server-side through the admin API ─────────────────
    const publicRes = await request.get('/api/v1/rarities');
    expect(publicRes.ok()).toBeTruthy();
    const created = ((await publicRes.json()).data || []).find((r) => r.code === RARITY_CODE);
    expect(created).toBeTruthy();
    expect(created.name).toBe(RARITY_NAME);

    // ── 5. Retention: reopen the modal, the new rarity is still there ──
    await dialog.locator('button:has(svg.lucide-x)').first().click();
    await expect(dialog).toBeHidden();

    await page.getByRole('button', { name: /thêm sản phẩm/i }).first().click();
    const reopened = page.getByRole('dialog');
    await expect(reopened).toBeVisible();

    rarityInput = await openRarityField(page, reopened);
    await rarityInput.click();
    const persistedOption = reopened.getByRole('option').filter({ hasText: RARITY_LABEL });
    await expect(persistedOption).toBeVisible();
    await persistedOption.click();
    await expect(rarityInput).toHaveValue(RARITY_LABEL, { timeout: 15_000 });

    console.log(`[RARITY] created + retained "${RARITY_LABEL}" (code ${RARITY_CODE})`);
  });

  test('catalog settings exposes Series / Expansion / Rarity management tabs', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/catalog', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    await expect(page.getByRole('heading', { name: /cấu hình danh mục/i })).toBeVisible();
    // All three catalogue dimensions sit side by side.
    await expect(page.getByRole('button', { name: /series \/ era/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /expansion sets/i })).toBeVisible();
    const rarityTab = page.getByRole('button', { name: /quản lý độ hiếm/i });
    await expect(rarityTab).toBeVisible();

    // Rarity tab lists the dynamic catalogue (seeded + test options).
    await rarityTab.click();
    await expect(page.getByRole('columnheader', { name: /^mã$/i })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'SAR', exact: true })).toBeVisible();
    console.log('[CATALOG] Series / Expansion / Rarity tabs verified');
  });
});
