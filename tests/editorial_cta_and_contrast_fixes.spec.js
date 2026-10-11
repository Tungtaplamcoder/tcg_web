// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const SHOT_DIR_1 = path.join(__dirname, '..', 'successful_test');
const SHOT_DIR_2 = path.join(__dirname, '..', '..', 'successful_test');

const SHOT_HOMEPAGE = '61_homepage_editorial_cta.png';
const SHOT_CHECKOUT = '61_checkout_clean_contrast.png';
const SHOT_ADMIN_VOUCHER = '61_admin_voucher_contrast.png';
const SHOT_USER_DROPDOWN = '62_user_dropdown_visible_unclipped.png';
const SHOT_POLISHED_DROPDOWN = '64_user_dropdown_polished_right_aligned.png';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tcg.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminSecurePass123!';

function saveScreenshot(page, filename) {
  const file1 = path.join(SHOT_DIR_1, filename);
  fs.mkdirSync(SHOT_DIR_1, { recursive: true });
  fs.mkdirSync(SHOT_DIR_2, { recursive: true });
  return page.screenshot({ path: file1, fullPage: false }).then(() => {
    const file2 = path.join(SHOT_DIR_2, filename);
    fs.copyFileSync(file1, file2);
    console.log(`[SHOT] saved ${file1} and ${file2}`);
  });
}

async function loginAsAdmin(page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.locator('input[type="text"]').first().fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
  await Promise.all([
    page.waitForURL((url) => url.pathname !== '/login', { timeout: 30_000 }),
    page.getByRole('button', { name: /đăng nhập|login/i }).first().click()
  ]);
  await page.waitForLoadState('networkidle').catch(() => {});
}

test.describe('UI & Design Refactor: Editorial CTA, Contrast Fix, User Dropdown & Payment Gateway Obfuscation', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('1. Homepage Editorial CTA and generic payment badges (no boxed border, open canvas)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    // Verify open-canvas Editorial CTA
    const mission = page.getByTestId('home-mission-card');
    await expect(mission).toBeVisible();

    // Verify container is open-canvas: NO boxed borders, NO card bg
    const missionClass = await mission.getAttribute('class') || '';
    expect(missionClass).not.toContain('border-pink-200/70');
    expect(missionClass).not.toContain('bg-white/75');
    expect(missionClass).not.toContain('shadow-soft');
    expect(missionClass).toContain('text-center');

    // Verify editorial typography in heading
    await expect(mission).toContainText('Chúng tôi');
    await expect(mission).toContainText('sẵn sàng giúp bạn');
    await expect(mission).toContainText('Biến');
    await expect(mission).toContainText('đam mê Pokémon thành điều có thật');
    await expect(mission.locator('.editorial-serif').first()).toBeVisible();

    // Verify soft pastel pink CTA button ("Mua ngay!")
    const shopNowBtn = mission.getByRole('link', { name: /mua ngay/i });
    await expect(shopNowBtn).toBeVisible();
    const btnClass = await shopNowBtn.getAttribute('class') || '';
    expect(btnClass).toContain('bg-pink-500');

    // Verify subtext clean typography
    await expect(mission.getByText(/Từ thẻ lẻ đã graded đến hộp niêm phong/i)).toBeVisible();

    // Verify payment badge text has generic secure branding (NO SePay)
    const trustSection = page.getByTestId('home-trust');
    await expect(trustSection).toBeVisible();
    await expect(trustSection.getByText('Thanh toán an toàn — Quét mã QR ngân hàng 24/7')).toBeVisible();

    // Ensure zero public mention of SePay on the homepage
    const pageContent = await page.content();
    expect(pageContent).not.toContain('SePay Auto Verification');

    // Scroll mission into view and save screenshot
    await mission.scrollIntoViewIfNeeded();
    await saveScreenshot(page, SHOT_HOMEPAGE);
  });

  test('2. User Dropdown in Header opens reliably, unclipped with z-[100] and flush right-edge alignment', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    // Ensure Light Mode for testing theme-adaptive styling and right alignment
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    });

    // Locate the user dropdown trigger in the Header
    const userTrigger = page.getByTestId('user-menu-trigger');
    await expect(userTrigger).toBeVisible();
    await expect(userTrigger).toContainText('Admin User');

    // Click trigger to open menu
    await userTrigger.click();

    // Verify dropdown menu opens with z-[100] and light mode styling
    const dropdownMenu = page.getByTestId('user-dropdown-menu');
    await expect(dropdownMenu).toBeVisible();
    const menuClass = await dropdownMenu.getAttribute('class') || '';
    expect(menuClass).toContain('z-[100]');
    expect(menuClass).toContain('origin-top-right');
    expect(menuClass).toContain('pointer-events-auto');
    expect(menuClass).toContain('bg-white');
    expect(menuClass).toContain('border-pink-100');

    // Assert the dropdown menu has non-zero bounding box
    const box = await dropdownMenu.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.width).toBeGreaterThan(150);
    expect(box?.height).toBeGreaterThan(150);

    // Assert flush right-edge alignment: dropdown right edge aligns with trigger right edge
    const triggerBox = await userTrigger.boundingBox();
    expect(triggerBox).not.toBeNull();
    const triggerRight = (triggerBox?.x ?? 0) + (triggerBox?.width ?? 0);
    const dropdownRight = (box?.x ?? 0) + (box?.width ?? 0);
    const rightEdgeDiff = Math.abs(triggerRight - dropdownRight);
    expect(rightEdgeDiff).toBeLessThanOrEqual(1.5);

    // Assert header has no overflow clipping and has z-50
    const headerStyles = await page.evaluate(() => {
      const header = document.querySelector('[data-testid="site-header"]');
      if (!header) return null;
      const s = window.getComputedStyle(header);
      return {
        overflowX: s.overflowX,
        overflowY: s.overflowY,
        zIndex: s.zIndex
      };
    });
    expect(headerStyles).not.toBeNull();
    expect(headerStyles?.overflowX).not.toBe('hidden');
    expect(headerStyles?.overflowY).not.toBe('hidden');
    expect(headerStyles?.zIndex).toBe('50');

    // Assert menu extends below header and is unclipped
    const isUnclipped = await page.evaluate(() => {
      const header = document.querySelector('[data-testid="site-header"]');
      const menu = document.querySelector('[data-testid="user-dropdown-menu"]');
      if (!header || !menu) return false;
      const headerRect = header.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      return menuRect.bottom > headerRect.bottom && menuRect.height > 0;
    });
    expect(isUnclipped).toBe(true);

    // Verify user info header styling
    const userInfoHeader = dropdownMenu.locator('div').first();
    const headerClass = await userInfoHeader.getAttribute('class') || '';
    expect(headerClass).toContain('bg-pink-50/60');
    expect(headerClass).toContain('border-pink-100/80');

    // Verify menu items
    const adminLink = dropdownMenu.getByRole('link', { name: /khu vực admin/i });
    const profileLink = dropdownMenu.getByRole('link', { name: /hồ sơ/i });
    const logoutBtn = dropdownMenu.getByRole('button', { name: /đăng xuất/i });

    await expect(adminLink).toBeVisible();
    await expect(profileLink).toBeVisible();
    await expect(logoutBtn).toBeVisible();

    // Save screenshots
    await saveScreenshot(page, SHOT_USER_DROPDOWN);
    await saveScreenshot(page, SHOT_POLISHED_DROPDOWN);

    // Hover over Admin link to test hover interaction
    await adminLink.hover();
  });

  test('3. Admin Vouchers table text contrast in dark mode', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/vouchers', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    // Turn on Dark Mode
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    });

    // Check table headers visibility
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // Verify voucher code (WELCOME10) has high contrast text
    const welcomeVoucher = page.locator('text=WELCOME10').first();
    await expect(welcomeVoucher).toBeVisible();

    // Check that WELCOME10 has text-neutral-100 or high contrast in dark mode
    const codeClass = await welcomeVoucher.getAttribute('class') || '';
    expect(codeClass).toContain('dark:text-neutral-100');

    // Save screenshot of Admin Vouchers with high contrast
    await saveScreenshot(page, SHOT_ADMIN_VOUCHER);
  });

  test('4. Checkout payment transfer info card contrast and generic gateway title', async ({ page, request }) => {
    await loginAsAdmin(page);

    // Get an in-stock product to put in cart
    const prodRes = await request.get('/api/v1/products?limit=50');
    const prodJson = await prodRes.json();
    const items = prodJson.data?.items || [];
    const product = items.find((p) =>
      Array.isArray(p.variants) && p.variants.some((v) => Number(v.stockQuantity) > 0)
    ) || items[0];
    expect(product).toBeTruthy();

    const variant = product.variants?.find((v) => Number(v.stockQuantity) > 0) || product.variants?.[0] || null;
    const variantId = variant?.id || null;

    // Put item in cart via localStorage
    await page.goto('/catalog', { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ prod, vId }) => {
      const cartItem = {
        productId: prod.id,
        variantId: vId,
        name: prod.name,
        price: Number(prod.variants?.[0]?.price) || Number(prod.price) || 500000,
        quantity: 1,
        imageUrl: prod.imageUrl || ''
      };
      localStorage.setItem('tcg_cart', JSON.stringify([cartItem]));
      localStorage.setItem('tcg_cart_version', '2');
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }, { prod: product, vId: variantId });

    // Go to /checkout in dark mode
    await page.goto('/checkout', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    // Fill shipping address
    await page.locator('input[name="fullName"]').fill('Nguyễn Văn Test');
    await page.locator('input[name="phone"]').fill('0901234567');
    await page.getByTestId('checkout-province').selectOption({ index: 1 });
    await page.waitForTimeout(500);
    await page.getByTestId('checkout-ward').selectOption({ index: 1 });
    await page.locator('input[name="addressLine1"]').fill('123 Đường Test, Quận 1');

    // Submit checkout to see the payment screen
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Wait for the payment screen to render
    const redirectTitle = page.locator('h2', { hasText: 'Cổng Thanh Toán Tự Động' });
    await expect(redirectTitle).toBeVisible({ timeout: 15_000 });

    // Verify generic gateway branding (Zero mention of SePay)
    const pageText = await page.content();
    expect(pageText).not.toContain('Chuyển hướng đến SePay');

    // Verify bank details text contrast in transfer info card
    await expect(page.getByText('Mã đơn hàng')).toBeVisible();
    await expect(page.getByText('Số tiền (VND)')).toBeVisible();

    // Check high-contrast classes on labels and values
    const orderCodeLabel = page.getByText('Mã đơn hàng');
    const orderCodeLabelClass = await orderCodeLabel.getAttribute('class') || '';
    expect(orderCodeLabelClass).toContain('dark:text-neutral-200');

    // Save screenshot of checkout payment details
    await saveScreenshot(page, SHOT_CHECKOUT);
  });
});
