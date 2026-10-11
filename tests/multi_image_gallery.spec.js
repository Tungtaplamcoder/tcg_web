const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * E2E Multi-Image Gallery & Invalid URL Regression Verification
 *
 * Requirements:
 * 1. Open Product Modal -> Add multiple images -> verify no "Invalid url" error upon saving.
 * 2. View product detail -> verify the first image displays first followed by gallery thumbnails.
 * 3. Save screenshot to: successful_test/66_multi_image_gallery_saved.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const SHOT_ROOT = path.join(__dirname, '..', '..', 'successful_test');
const SHOT_FILE = path.join(SHOT_DIR, '66_multi_image_gallery_saved.png');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tcg.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminSecurePass123!';

const TEST_IMAGES = [
  'https://images.pokemontcg.io/swsh4/25.png',
  'https://images.pokemontcg.io/swsh4/25_hires.png',
  'https://images.pokemontcg.io/swsh4/symbol.png'
];

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

async function pickCreatable(dialog, name, label) {
  const input = dialog.locator(`[data-creatable-select="${name}"] input`);
  await expect(input).toBeVisible();
  await input.click();
  await input.fill(label);
  await input.press('Enter');
  await expect(input).toHaveValue(label, { timeout: 15_000 });
}

test.describe('Feature: Dynamic Multi-Image Gallery & Fix Invalid URL', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  let token;
  let createdProductId = null;
  const unique = Date.now();
  const productName = `E2E Gallery Test ${unique}`;

  test.beforeAll(async ({ request }) => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    fs.mkdirSync(SHOT_ROOT, { recursive: true });
    token = await adminToken(request);
  });

  test.afterAll(async ({ request }) => {
    if (createdProductId && token) {
      await request.delete(`/api/v1/admin/products/${createdProductId}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    }
  });

  test('creates a product with multi-image gallery without Invalid url error, and verifies storefront detail view', async ({ page, request }) => {
    // Track API responses to ensure no validation error (HTTP 400 with "Invalid url")
    let hasValidationError = false;
    page.on('response', async (res) => {
      if (res.url().includes('/admin/products') && (res.request().method() === 'POST' || res.request().method() === 'PATCH')) {
        if (res.status() >= 400) {
          hasValidationError = true;
        }
      }
    });

    // ── 1. Admin login & open Inventory ──────────────────────────────
    await loginAsAdmin(page);
    await page.goto('/admin/inventory', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    // ── 2. Open Product Modal ─────────────────────────────────────────
    await page.getByRole('button', { name: /thêm sản phẩm/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // ── 3. Fill product basics ────────────────────────────────────────
    await dialog.locator('input[name="name"]').fill(productName);

    // Select BOX (Sealed Products) for a clean, deterministic taxonomy flow
    await dialog.locator('select[name="category"]').selectOption('BOX');
    await page.waitForTimeout(300);
    await pickCreatable(dialog, 'sealedType', 'Booster Box');

    // Add variant (price: 250000, stock: 15)
    const addVariantBtn = dialog.getByRole('button', { name: /thêm variant|add variant/i });
    if (await addVariantBtn.isVisible()) {
      await addVariantBtn.click();
    }
    const priceInputs = dialog.locator('input[type="number"]');
    if (await priceInputs.count() >= 2) {
      await priceInputs.nth(0).fill('250000');
      await priceInputs.nth(1).fill('15');
    }

    // ── 4. Dynamic Multi-Image Upload Gallery ─────────────────────────
    const urlInput = dialog.locator('[data-testid="image-url-input"]');
    const addUrlBtn = dialog.locator('[data-testid="add-image-url-btn"]');
    await expect(urlInput).toBeVisible();
    await expect(addUrlBtn).toBeVisible();

    // Add image 1 (Cover / Main)
    await urlInput.fill(TEST_IMAGES[0]);
    await addUrlBtn.click();
    await page.waitForTimeout(200);

    // Add image 2
    await urlInput.fill(TEST_IMAGES[1]);
    await addUrlBtn.click();
    await page.waitForTimeout(200);

    // Add image 3
    await urlInput.fill(TEST_IMAGES[2]);
    await addUrlBtn.click();
    await page.waitForTimeout(200);

    // Verify thumbnails exist in the gallery uploader list
    const galleryList = dialog.locator('[data-testid="product-gallery-uploader-list"]');
    await expect(galleryList).toBeVisible();
    const galleryItems = dialog.locator('[data-testid^="gallery-upload-item-"]');
    await expect(galleryItems).toHaveCount(3);

    // Verify first image is clearly badged: "Ảnh bìa / Chính" (Cover)
    const coverBadge = dialog.locator('[data-testid="cover-image-badge"]');
    await expect(coverBadge).toBeVisible();
    await expect(coverBadge).toContainText(/ảnh bìa/i);

    // Verify hover reveals delete button on thumbnail
    await galleryItems.first().hover();
    const removeBtn = dialog.locator('[data-testid="remove-image-btn-0"]');
    await expect(removeBtn).toBeVisible();

    // ── 5. Save Product & Verify NO "Invalid url" error ────────────────
    const saveButton = dialog.getByRole('button', { name: /lưu sản phẩm/i });
    await saveButton.click();

    // Ensure modal closes on success without throwing "Invalid url"
    await expect(dialog).toBeHidden({ timeout: 20_000 });
    expect(hasValidationError).toBe(false);

    // Verify toast confirmation
    await expect(page.getByText(/đã tạo sản phẩm mới/i)).toBeVisible({ timeout: 10_000 });

    // ── 6. Query the created product from API to get its ID ────────────
    const listRes = await request.get(`/api/v1/admin/products?search=${encodeURIComponent(productName)}&limit=10`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(listRes.ok()).toBeTruthy();
    const listData = await listRes.json();
    const product = (listData.data?.items || []).find((p) => p.name === productName);
    expect(product).toBeTruthy();
    createdProductId = product.id;

    // Verify backend stored images array with backward compatibility
    expect(Array.isArray(product.images)).toBe(true);
    expect(product.images.length).toBe(3);
    expect(product.images[0]).toBe(TEST_IMAGES[0]);
    expect(product.images[1]).toBe(TEST_IMAGES[1]);
    expect(product.images[2]).toBe(TEST_IMAGES[2]);
    expect(product.frontImage).toBe(TEST_IMAGES[0]);
    expect(product.backImage).toBe(TEST_IMAGES[1]);

    // ── 7. View Storefront Product Detail ──────────────────────────────
    await page.goto(`/product/${createdProductId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    // Verify ProductGallery stage is visible
    const productGallery = page.locator('[data-testid="product-gallery"]');
    await expect(productGallery).toBeVisible();

    // Verify primary / first image displays first by default
    const mainImg = productGallery.locator('.pd-artwork img, img.pd-artwork');
    await expect(mainImg).toBeVisible();
    await expect(mainImg).toHaveAttribute('src', TEST_IMAGES[0]);

    // Verify gallery thumbnails row exists with 3 items
    const thumbnailRow = page.locator('[data-testid="product-gallery-thumbnails"]');
    await expect(thumbnailRow).toBeVisible();
    const thumbButtons = thumbnailRow.locator('button[data-testid^="gallery-thumb-"]');
    await expect(thumbButtons).toHaveCount(3);

    // Click second thumbnail -> verify main image switches to image 2
    await thumbButtons.nth(1).click();
    await expect(mainImg).toHaveAttribute('src', TEST_IMAGES[1]);

    // Click third thumbnail -> verify main image switches to image 3
    await thumbButtons.nth(2).click();
    await expect(mainImg).toHaveAttribute('src', TEST_IMAGES[2]);

    // Click back to first thumbnail -> verify main image switches back to image 1
    await thumbButtons.nth(0).click();
    await expect(mainImg).toHaveAttribute('src', TEST_IMAGES[0]);

    // ── 8. Capture and save the screenshot ─────────────────────────────
    await page.screenshot({ path: SHOT_FILE, fullPage: false });
    fs.mkdirSync(SHOT_ROOT, { recursive: true });
    fs.copyFileSync(SHOT_FILE, path.join(SHOT_ROOT, path.basename(SHOT_FILE)));
    expect(fs.existsSync(SHOT_FILE)).toBe(true);
    expect(fs.existsSync(path.join(SHOT_ROOT, path.basename(SHOT_FILE)))).toBe(true);

    console.log(`[TEST SUCCESS] Screenshot saved to ${SHOT_FILE} and mirrored to ${path.join(SHOT_ROOT, path.basename(SHOT_FILE))}`);
  });
});
