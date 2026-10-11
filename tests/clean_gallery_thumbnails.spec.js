const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const SHOT_DIR = path.resolve(__dirname, '../successful_test');
const SHOT_FILE = path.join(SHOT_DIR, '67_clean_gallery_thumbnails_no_badges.png');
const SHOT_ROOT = '/root/tcg_web/successful_test';

const TEST_IMAGES = [
  'https://images.pokemontcg.io/swsh4/25_hires.png',
  'https://images.pokemontcg.io/swsh4/44_hires.png',
  'https://images.pokemontcg.io/swsh4/188_hires.png'
];

test.describe('Clean Gallery Thumbnails (No Overlays / No Badges)', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });
  let createdProductId = null;

  test.afterAll(async ({ request }) => {
    if (createdProductId) {
      try {
        const loginRes = await request.post('/api/v1/auth/login', {
          data: { email: 'admin@tcg.local', password: 'AdminSecurePass123!' }
        });
        const loginData = await loginRes.json();
        const token = loginData.data?.accessToken;
        if (token) {
          await request.delete(`/api/v1/admin/products/${createdProductId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          console.log(`Cleaned up test product ${createdProductId}`);
        }
      } catch (e) {
        console.warn('Failed to cleanup product:', e.message);
      }
    }
  });

  test('Gallery thumbnails do not display "COVER" or "#" overlays, showing clean sleek pink active ring', async ({ page, request }) => {
    // 1. Authenticate as Admin
    const loginRes = await request.post('/api/v1/auth/login', {
      data: { email: 'admin@tcg.local', password: 'AdminSecurePass123!' }
    });
    expect(loginRes.ok()).toBeTruthy();
    const loginData = await loginRes.json();
    const token = loginData.data?.accessToken;
    expect(token).toBeTruthy();

    // 2. Create test product with 3 images via API
    const productName = `Clean Thumbnails Test Box ${Date.now()}`;
    const createRes = await request.post('/api/v1/admin/products', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        name: productName,
        category: 'BOX',
        sealedType: 'Booster Box',
        images: TEST_IMAGES,
        variants: [
          {
            price: 320000,
            stock: 10,
            condition: 'NEAR_MINT'
          }
        ]
      }
    });
    expect(createRes.ok()).toBeTruthy();
    const createData = await createRes.json();
    createdProductId = createData.data?.id;
    expect(createdProductId).toBeTruthy();

    // 3. Navigate to Storefront Product Detail page
    await page.goto(`/product/${createdProductId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    // 4. Verify ProductGallery and Thumbnails are rendered
    const gallery = page.locator('[data-testid="product-gallery"]');
    await expect(gallery).toBeVisible();

    const thumbnailRow = page.locator('[data-testid="product-gallery-thumbnails"]');
    await expect(thumbnailRow).toBeVisible();

    const thumbButtons = thumbnailRow.locator('button[data-testid^="gallery-thumb-"]');
    await expect(thumbButtons).toHaveCount(3);

    // 5. CRITICAL ASSERTIONS:
    // - NO "COVER" overlay badge in thumbnail carousel
    // - NO "#1", "#2", "#3" numbered indicator tags
    const coverTextElements = thumbnailRow.getByText(/cover/i);
    await expect(coverTextElements).toHaveCount(0);

    const numberedTextElements = thumbnailRow.getByText(/#[0-9]+/);
    await expect(numberedTextElements).toHaveCount(0);

    // Verify all text in thumbnail row does NOT contain "#"
    const thumbnailRowText = await thumbnailRow.innerText();
    expect(thumbnailRowText).not.toContain('#');
    expect(thumbnailRowText.toLowerCase()).not.toContain('cover');

    // 6. Verify active and inactive styling
    // First thumbnail is active by default
    const firstThumb = thumbButtons.nth(0);
    const secondThumb = thumbButtons.nth(1);

    const firstThumbClass = await firstThumb.getAttribute('class');
    expect(firstThumbClass).toContain('ring-pink-500');

    const secondThumbClass = await secondThumb.getAttribute('class');
    expect(secondThumbClass).toContain('border-neutral-200');

    // Click second thumbnail -> verify it becomes active with pink ring
    await secondThumb.click();
    await page.waitForTimeout(200);

    const newSecondThumbClass = await secondThumb.getAttribute('class');
    expect(newSecondThumbClass).toContain('ring-pink-500');

    // Return to first thumbnail for clean presentation screenshot
    await firstThumb.click();
    await page.waitForTimeout(200);

    // 7. Capture screenshot focusing on product detail and thumbnails
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    fs.mkdirSync(SHOT_ROOT, { recursive: true });

    await page.screenshot({ path: SHOT_FILE, fullPage: false });
    fs.copyFileSync(SHOT_FILE, path.join(SHOT_ROOT, path.basename(SHOT_FILE)));

    expect(fs.existsSync(SHOT_FILE)).toBe(true);
    expect(fs.existsSync(path.join(SHOT_ROOT, path.basename(SHOT_FILE)))).toBe(true);

    console.log(`[VERIFIED] Screenshot successfully captured at: ${SHOT_FILE}`);
  });
});
