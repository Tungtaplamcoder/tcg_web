// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const SHOT_ROOT = path.join(__dirname, '..', '..', 'successful_test');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tcg.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminSecurePass123!';

const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

async function adminToken(request) {
  const res = await request.post('/api/v1/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).data.accessToken;
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
}

async function saveShot(page, filename) {
  const target = path.join(SHOT_DIR, filename);
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: target, fullPage: false });
  fs.mkdirSync(SHOT_ROOT, { recursive: true });
  fs.copyFileSync(target, path.join(SHOT_ROOT, filename));
  expect(fs.existsSync(target)).toBe(true);
  expect(fs.existsSync(path.join(SHOT_ROOT, filename))).toBe(true);
}

test.describe('Urgent Hotfixes Verification', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });
  test.describe.configure({ mode: 'serial' });

  let token;
  const stamp = Date.now();
  const testLangWithProduct = `HotfixLang_Linked_${stamp}`;
  const testLangEmpty = `HotfixLang_Empty_${stamp}`;
  let langLinkedId;
  let langEmptyId;
  let testProductId;

  const longDescription = `[THÔNG SỐ ĐẶC BIỆT - PHIÊN BẢN GIỚI HẠN]
Dòng thẻ bài Pokémon TCG cao cấp được bảo quản trong điều kiện chuẩn PSA/BGS.
- Tên thẻ: Pikachu & Zekrom GX Special Art
- Bộ sưu tập: Tag Team All Stars High Class Pack
- Tình trạng: Near Mint / Mint 100% nguyên seal chưa qua thi đấu
- Nghệ sĩ minh họa: Mitsuhiro Arita
- Chi tiết bổ sung: Toàn bộ thẻ được quét mã QR xác thực nguồn gốc chính hãng từ nhà phát hành Pokémon Company Nhật Bản. Lớp phủ phản quang Holographic hoàn hảo, không vết xước, góc cạnh sắc nét chuẩn thi đấu quốc tế.`;

  test.beforeAll(async ({ request }) => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    fs.mkdirSync(SHOT_ROOT, { recursive: true });
    token = await adminToken(request);

    // Create 2 test languages
    const r1 = await request.post('/api/v1/admin/catalog-settings/languages', {
      ...auth(token),
      data: { name: testLangWithProduct }
    });
    expect(r1.ok()).toBeTruthy();
    langLinkedId = (await r1.json()).data.id;

    const r2 = await request.post('/api/v1/admin/catalog-settings/languages', {
      ...auth(token),
      data: { name: testLangEmpty }
    });
    expect(r2.ok()).toBeTruthy();
    langEmptyId = (await r2.json()).data.id;

    // Create 1 product with long description and linked to testLangWithProduct
    const prodRes = await request.post('/api/v1/admin/products', {
      ...auth(token),
      data: {
        name: `Hotfix Test Pikachu ${stamp}`,
        description: longDescription,
        category: 'CARD',
        language: testLangWithProduct,
        variants: [{ price: 850000, stockQuantity: 5, condition: 'NEAR_MINT' }]
      }
    });
    expect(prodRes.ok()).toBeTruthy();
    testProductId = (await prodRes.json()).data.id;
  });

  test.afterAll(async ({ request }) => {
    if (!token) return;
    if (testProductId) {
      await request.delete(`/api/v1/admin/products/${testProductId}`, auth(token)).catch(() => {});
    }
    if (langLinkedId) {
      await request.delete(`/api/v1/admin/catalog-settings/languages/${langLinkedId}`, auth(token)).catch(() => {});
    }
    if (langEmptyId) {
      await request.delete(`/api/v1/admin/catalog-settings/languages/${langEmptyId}`, auth(token)).catch(() => {});
    }
  });

  test('Hotfix 1: Product long description persists without truncation & modal textarea has rows=4, w-full', async ({ page, request }) => {
    // 1. Verify backend saved complete description without truncation
    const prodCheck = await request.get(`/api/v1/products/${testProductId}`);
    expect(prodCheck.ok()).toBeTruthy();
    const fetchedProd = (await prodCheck.json()).data;
    expect(fetchedProd.description).toBe(longDescription);
    expect(fetchedProd.description.length).toBeGreaterThan(250);

    // 2. Open Admin Inventory -> Edit Product -> Check textarea attributes
    await loginAsAdmin(page);
    await page.goto('/admin/inventory', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    await page.getByRole('button', { name: /thêm sản phẩm/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const descTextarea = dialog.locator('textarea[name="description"]');
    await expect(descTextarea).toBeVisible();
    await expect(descTextarea).toHaveAttribute('rows', '4');
    const textareaClass = await descTextarea.getAttribute('class');
    expect(textareaClass).toContain('w-full');
    expect(await descTextarea.getAttribute('maxlength')).toBeNull();

    await descTextarea.fill(longDescription);
    await saveShot(page, 'hotfix_1_long_description_textarea.png');
  });

  test('Hotfix 2: ProductDetail renders full-width (w-full) info container with neutral styling & whitespace-pre-line', async ({ page }) => {
    await page.goto(`/product/${testProductId}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.setItem('tcg-theme', 'dark'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    const section = page.locator('[data-testid="product-description-section"]');
    await expect(section).toBeVisible({ timeout: 15_000 });
    await expect(section).toHaveClass(/w-full/);

    const container = section.locator('div.w-full');
    await expect(container).toBeVisible();
    const containerClasses = await container.getAttribute('class');

    // Expected spec classes:
    // bg-neutral-900/60 border border-neutral-800 rounded-xl p-5 text-sm leading-relaxed text-neutral-300
    expect(containerClasses).toContain('w-full');
    expect(containerClasses).toContain('dark:bg-neutral-900/60');
    expect(containerClasses).toContain('dark:border-neutral-800');
    expect(containerClasses).toContain('rounded-xl');
    expect(containerClasses).toContain('p-5');
    expect(containerClasses).toContain('text-sm');
    expect(containerClasses).toContain('leading-relaxed');
    expect(containerClasses).toContain('dark:text-neutral-300');

    // Paragraph contains whitespace-pre-line leading-relaxed
    const descP = container.locator('p');
    await expect(descP).toHaveClass(/whitespace-pre-line/);
    await expect(descP).toHaveClass(/leading-relaxed/);
    await expect(descP).toContainText('[THÔNG SỐ ĐẶC BIỆT - PHIÊN BẢN GIỚI HẠN]');
    await expect(descP).toContainText('Pikachu & Zekrom GX Special Art');
    await expect(descP).toContainText('chuẩn thi đấu quốc tế');

    await saveShot(page, 'hotfix_2_product_detail_fullwidth_description.png');
  });

  test('Hotfix 3: Direct Language Delete Guard (disabled when productCount > 0, 1-click delete when productCount === 0)', async ({ page, request }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/catalog-settings', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.setItem('tcg-theme', 'dark'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    const langTab = page.getByTestId('tab-language');
    await expect(langTab).toBeVisible();
    await langTab.click();
    await expect(page.getByTestId('language-tab')).toBeVisible();

    // 1. Language with linked product: delete button must be disabled with tooltip
    const linkedRow = page.getByTestId(`language-row-${testLangWithProduct}`);
    await expect(linkedRow).toBeVisible({ timeout: 15_000 });
    await expect(linkedRow.getByTestId('language-product-count')).toHaveText('1 sản phẩm');

    const linkedDeleteBtn = linkedRow.locator(`[data-testid="language-delete-${testLangWithProduct}"]`);
    await expect(linkedDeleteBtn).toBeVisible();
    await expect(linkedDeleteBtn).toBeDisabled();
    await expect(linkedDeleteBtn).toHaveAttribute('title', 'Không thể xoá khi còn sản phẩm liên kết');
    const linkedBtnClass = await linkedDeleteBtn.getAttribute('class');
    expect(linkedBtnClass).toContain('opacity-30');
    expect(linkedBtnClass).toContain('cursor-not-allowed');

    await saveShot(page, 'hotfix_3_language_delete_guard_disabled.png');

    // 2. Language with productCount === 0: delete button is enabled
    const emptyRow = page.getByTestId(`language-row-${testLangEmpty}`);
    await expect(emptyRow).toBeVisible({ timeout: 15_000 });
    await expect(emptyRow.getByTestId('language-product-count')).toHaveText('0 sản phẩm');

    const emptyDeleteBtn = emptyRow.locator(`[data-testid="language-delete-${testLangEmpty}"]`);
    await expect(emptyDeleteBtn).toBeVisible();
    await expect(emptyDeleteBtn).toBeEnabled();
    await expect(emptyDeleteBtn).toHaveAttribute('title', 'Xóa');

    // 3. Click delete: NO modal should appear, directly deletes in 1 click!
    await emptyDeleteBtn.click();

    // Verify confirm dialog did NOT open
    await expect(page.locator('[data-testid="confirm-dialog"]')).toBeHidden();

    // Row should disappear from table
    await expect(page.getByTestId(`language-row-${testLangEmpty}`)).toBeHidden({ timeout: 15_000 });

    // Success toast shown
    await expect(page.getByText('Đã xóa.')).toBeVisible({ timeout: 10_000 });

    await saveShot(page, 'hotfix_3_language_direct_delete_success.png');

    // 4. Verify API delete guard also blocks deletion of linked language
    const apiDelRes = await request.delete(`/api/v1/admin/catalog-settings/languages/${langLinkedId}`, auth(token));
    expect(apiDelRes.status()).toBe(409);
    const errBody = await apiDelRes.json();
    expect(errBody.error.message).toContain('Không thể xoá khi còn sản phẩm liên kết');
  });
});
