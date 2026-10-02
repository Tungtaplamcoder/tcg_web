// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Saved shipping addresses — Shopee-style 1-click checkout.
 *
 * Contract:
 *  1. The profile dropdown exposes a "Địa chỉ nhận hàng" item (MapPin icon).
 *  2. It opens the AddressManager modal where a user can add an address and
 *     mark it as the default (soft blush pink "Mặc định" badge).
 *  3. The default address pre-fills the checkout "Địa chỉ giao hàng" fields,
 *     and the "Chọn từ địa chỉ đã lưu" picker re-fills them in 1 click.
 *
 * Screenshots:
 *   successful_test/15_user_dropdown_addresses_menu.png
 *   successful_test/15_address_manager_modal.png
 *   successful_test/15_checkout_prefilled_address.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const DROPDOWN_SHOT = path.join(SHOT_DIR, '15_user_dropdown_addresses_menu.png');
const MANAGER_SHOT = path.join(SHOT_DIR, '15_address_manager_modal.png');
const CHECKOUT_SHOT = path.join(SHOT_DIR, '15_checkout_prefilled_address.png');

const PASSWORD = 'CustomerPass123';

// A fresh account per run keeps the spec self-contained and repeatable.
const uniquePhone = () => `09${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
const uniqueEmail = () => `addr.e2e.${Date.now()}@tcg.test`;

async function submitLogin(page, identifier, password) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.locator('input[type="text"]').first().fill(identifier);
  await page.locator('input[type="password"]').first().fill(password);
  await Promise.all([
    page.waitForURL((url) => url.pathname === '/', { timeout: 30_000 }),
    page.getByRole('button', { name: /đăng nhập|login|logging/i }).first().click()
  ]);
  await page.waitForLoadState('networkidle').catch(() => {});
}

test.describe('Saved shipping addresses — 1-click checkout', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
  });

  test('add default address and pre-fill checkout', async ({ page, request }) => {
    const phone = uniquePhone();
    const email = uniqueEmail();

    // ── Setup: create a customer account via the public API.
    const register = await request.post('/api/v1/auth/register', {
      data: {
        email,
        password: PASSWORD,
        confirmPassword: PASSWORD,
        fullName: 'Nguyễn Văn Test',
        phone
      }
    });
    expect(register.ok(), `register customer (${register.status()})`).toBeTruthy();

    // ── 1. Log in and open the user dropdown.
    await submitLogin(page, phone, PASSWORD);
    await expect(page.getByTestId('site-header')).toBeVisible();

    await page.locator('button[aria-haspopup="menu"]').first().click();
    const addressesItem = page.getByTestId('user-menu-addresses');
    await expect(addressesItem).toBeVisible();
    await expect(addressesItem).toContainText('Địa chỉ nhận hàng');

    await page.screenshot({ path: DROPDOWN_SHOT, fullPage: false });
    expect(fs.existsSync(DROPDOWN_SHOT)).toBe(true);
    console.log(`[SHOT] saved ${DROPDOWN_SHOT}`);

    // ── 2. Open the address manager and add a default address.
    await addressesItem.click();
    const manager = page.getByTestId('address-manager');
    await expect(manager).toBeVisible();

    await page.getByTestId('address-add').click();
    await expect(page.getByTestId('address-form')).toBeVisible();

    await page.getByTestId('address-input-fullname').fill('Nguyễn Văn Test');
    await page.getByTestId('address-input-phone').fill(phone);
    await page.getByTestId('address-input-province').selectOption('11'); // Hà Nội
    await expect(page.getByTestId('address-input-ward')).toBeEnabled();

    const wardValue = await page
      .getByTestId('address-input-ward')
      .locator('option')
      .nth(1)
      .getAttribute('value');
    expect(wardValue, 'a ward option exists for the province').toBeTruthy();
    await page.getByTestId('address-input-ward').selectOption(wardValue);

    await page.getByTestId('address-input-street').fill('123 Nguyễn Huệ');
    await page.getByTestId('address-input-default').check();
    await page.getByTestId('address-save').click();

    // Saved card + soft blush pink default badge visible.
    const card = page.getByTestId('address-card').first();
    await expect(card).toBeVisible();
    await expect(page.getByTestId('address-default-badge')).toBeVisible();
    await expect(page.getByTestId('address-default-badge')).toContainText('Mặc định');
    await expect(card).toContainText('Nguyễn Văn Test');

    await page.screenshot({ path: MANAGER_SHOT, fullPage: false });
    expect(fs.existsSync(MANAGER_SHOT)).toBe(true);
    console.log(`[SHOT] saved ${MANAGER_SHOT}`);

    // Close the modal before continuing.
    await page.getByTestId('address-manager-close').click();
    await expect(manager).toBeHidden();

    // ── 3. Checkout is pre-filled with the default address.
    await page.goto('/checkout', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    await expect(page.getByTestId('checkout-saved-address-btn')).toBeVisible();
    await expect(page.locator('input[name="fullName"]')).toHaveValue('Nguyễn Văn Test');
    await expect(page.locator('input[name="phone"]')).toHaveValue(phone);
    await expect(page.locator('input[name="addressLine1"]')).toHaveValue('123 Nguyễn Huệ');
    await expect(page.getByTestId('checkout-province')).toHaveValue('11');
    await expect(page.getByTestId('checkout-ward')).toHaveValue(wardValue);

    await page.screenshot({ path: CHECKOUT_SHOT, fullPage: true });
    expect(fs.existsSync(CHECKOUT_SHOT)).toBe(true);
    console.log(`[SHOT] saved ${CHECKOUT_SHOT}`);

    // ── 4. The saved-address picker re-fills in 1 click.
    await page.getByTestId('checkout-saved-address-btn').click();
    await expect(page.getByTestId('address-manager')).toBeVisible();
    await page.getByTestId('address-choose').first().click();
    await expect(page.getByTestId('address-manager')).toBeHidden();
    await expect(page.locator('input[name="addressLine1"]')).toHaveValue('123 Nguyễn Huệ');
    await expect(page.getByTestId('checkout-province')).toHaveValue('11');
    await expect(page.getByTestId('checkout-ward')).toHaveValue(wardValue);

    console.log('[OK] saved addresses → dropdown → manager → checkout prefill + 1-click picker');
  });
});
