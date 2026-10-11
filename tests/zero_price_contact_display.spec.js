// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const SHOT_DIR_1 = path.join(__dirname, '..', 'successful_test');
const SHOT_DIR_2 = path.join(__dirname, '..', '..', 'successful_test');
const SHOT_NAME = '65_zero_price_contact_display.png';

const ZERO_PRICE_PRODUCT_ID = 'be90bd6a-165f-4875-a240-92c260014ecc';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tcg.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminSecurePass123!';

async function saveScreenshot(page, filename) {
  fs.mkdirSync(SHOT_DIR_1, { recursive: true });
  fs.mkdirSync(SHOT_DIR_2, { recursive: true });
  const file1 = path.join(SHOT_DIR_1, filename);
  const file2 = path.join(SHOT_DIR_2, filename);
  await page.screenshot({ path: file1, fullPage: false });
  fs.copyFileSync(file1, file2);
  console.log(`[SHOT] Saved verified screenshot to ${file1} and ${file2}`);
}

async function loginAsAdmin(page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.locator('input[type="text"]').first().fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
  await Promise.all([
    page.waitForURL(url => url.pathname !== '/login', { timeout: 30_000 }),
    page.getByRole('button', { name: /đăng nhập|login/i }).first().click()
  ]);
  await page.waitForLoadState('networkidle').catch(() => {});
}

test.describe('Display "Liên hệ" for Zero-Price Products & Guard Checkout', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('1. Product Detail: Displays "Liên hệ", guards checkout buttons, and provides Contact Consultation modal', async ({ page }) => {
    await page.goto(`/product/${ZERO_PRICE_PRODUCT_ID}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    // Assert product name is visible
    await expect(page.locator('h1')).toContainText('Pikachu Illustrator Special Promo');

    // Assert price display renders "Liên hệ" instead of "0 đ"
    const priceChip = page.getByTestId('product-detail-price');
    await expect(priceChip).toBeVisible();
    await expect(priceChip).toContainText('Liên hệ');
    await expect(priceChip).not.toContainText('0 đ');
    await expect(priceChip).not.toContainText('0 ₫');

    // Assert price styling has font-semibold text-pink-500
    const priceText = priceChip.locator('span');
    const priceClass = await priceText.getAttribute('class') || '';
    expect(priceClass).toContain('text-pink-500');
    expect(priceClass).toContain('font-semibold');

    // Assert checkout buttons are safely guarded (hidden / not rendered)
    const addToCartBtn = page.getByRole('button', { name: /thêm vào giỏ|add to cart/i });
    await expect(addToCartBtn).toHaveCount(0);
    const buyNowBtn = page.getByRole('button', { name: /mua ngay|buy now/i });
    await expect(buyNowBtn).toHaveCount(0);

    // Assert Contact Consultation button is rendered
    const contactBtn = page.getByTestId('contact-consult-btn');
    await expect(contactBtn).toBeVisible();
    await expect(contactBtn).toContainText('Liên hệ tư vấn');

    // Open Contact Consultation Modal
    await contactBtn.click();
    const modal = page.getByTestId('contact-consultation-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Liên hệ tư vấn');
    await expect(modal).toContainText('Pikachu Illustrator Special Promo');

    // Close Modal to leave the clean Product Detail view for screenshot
    const closeModalBtn = page.getByTestId('close-contact-modal-btn');
    await closeModalBtn.click();
    await expect(modal).not.toBeVisible();

    // Verify contact button still visible
    await expect(contactBtn).toBeVisible();

    // Save screenshot
    await saveScreenshot(page, SHOT_NAME);
  });

  test('2. Storefront Catalog: Product card renders "Liên hệ"', async ({ page }) => {
    await page.goto(`/catalog?search=${encodeURIComponent('Pikachu Illustrator')}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    const card = page.locator('article, .group').filter({ hasText: 'Pikachu Illustrator' }).first();
    await expect(card).toBeVisible();

    const price = card.getByTestId('product-card-price');
    await expect(price).toBeVisible();
    await expect(price).toHaveText('Liên hệ');
    await expect(price).not.toContainText('0 đ');
    await expect(price).not.toContainText('0 ₫');
  });

  test('3. Admin / Staff Inventory: Renders "0 đ (Liên hệ)" badge', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/admin/inventory', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    // Search or find the product in table
    const searchInput = page.locator('input[placeholder*="Tìm kiếm"], input[placeholder*="Search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('Pikachu Illustrator');
      await page.waitForTimeout(500);
    }

    const row = page.locator('tr').filter({ hasText: 'Pikachu Illustrator' }).first();
    await expect(row).toBeVisible();

    const badge = row.getByTestId('contact-price-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('0 đ (Liên hệ)');
  });
});
