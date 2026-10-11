// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Virtual Box — 100% FREE unboxing, stripped of all monetization.
 *
 * Contract:
 *  1. /virtual-boxes lists boxes; a card opens the free detail page
 *     (/virtual-boxes/:id).
 *  2. The detail page shows the box overview, an era tag, the transparent
 *     C/R/SR/UR odds panel, the full drop-pool grid, and a single
 *     "Mở Hộp Miễn Phí" CTA.
 *  3. NO currency anywhere: no Coins/Xu/₫/$/VND/USD/giá mở.
 *  4. There is NO "Kho Đồ Tạm" (temporary vault) section in the DOM.
 *  5. Clicking "Mở Hộp Miễn Phí" opens the unboxing modal; tearing the pack
 *     reveals the pulled card cleanly.
 *
 * Screenshot: successful_test/36_virtual_box_free_unboxing_page.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const MIRROR_DIR = path.join(__dirname, '..', '..', 'successful_test');
const SHOT = path.join(SHOT_DIR, '36_virtual_box_free_unboxing_page.png');

const PASSWORD = 'CustomerPass123';
const uniquePhone = () => `09${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
const uniqueEmail = () => `vbox.e2e.${Date.now()}@tcg.test`;

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

/** Scan the rendered page for any currency token. */
async function findCurrency(page) {
  return page.evaluate(() => {
    const text = document.body.innerText || '';
    const lower = text.toLowerCase();
    const hits = [];
    for (const token of ['coins', 'coin', 'vnd', 'usd', 'giá mở', 'points']) {
      if (lower.includes(token)) hits.push(token);
    }
    if (text.includes('₫')) hits.push('₫');
    if (text.includes('$')) hits.push('$');
    // Standalone "Xu" currency unit (not mid-word like "Xuất" — a following
    // Unicode letter disqualifies the match).
    if (/\bxu(?!\p{L})/iu.test(text)) hits.push('Xu');
    // Numeric currency badges, e.g. "1,000 Xu" / "$24.99" / "50 Coins".
    const unitRe = /^[\d.,\s]*(xu|coins?|vnd|usd|₫|\$)[\d.,\s]*$/i;
    for (const el of document.querySelectorAll('body *')) {
      if (el.children.length > 0) continue;
      const t = (el.textContent || '').trim();
      if (t && unitRe.test(t)) hits.push(t);
    }
    return [...new Set(hits)];
  });
}

test.describe('Virtual Box — free unboxing, no currency, no temp vault', () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
  });

  test('free detail/opening page with clean unboxing modal', async ({ page, request }) => {
    const phone = uniquePhone();
    const email = uniqueEmail();

    // ── Setup: create + sign in a customer so the free open endpoint is
    //    authenticated (no balance is ever charged).
    const register = await request.post('/api/v1/auth/register', {
      data: { email, password: PASSWORD, confirmPassword: PASSWORD, fullName: 'Virtual Box E2E', phone }
    });
    expect(register.ok(), `register customer (${register.status()})`).toBeTruthy();
    await submitLogin(page, phone, PASSWORD);

    // ── 1. Navigate to the listing.
    await page.goto('/virtual-boxes', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    const firstCard = page.getByTestId('vbox-card-open').first();
    await expect(firstCard).toBeVisible();

    // ── 2. Open a Virtual Box detail view.
    await firstCard.click();
    await page.waitForURL(/\/virtual-boxes\/[^/]+$/, { timeout: 15_000 });
    await expect(page.getByTestId('vbox-detail')).toBeVisible();
    await page.waitForLoadState('networkidle').catch(() => {});

    // Structure sanity: era tag, odds panel, drop pool, free CTA.
    await expect(page.getByTestId('vbox-era-tag')).toBeVisible();
    const odds = page.getByTestId('vbox-probabilities');
    await expect(odds).toBeVisible();
    await expect(odds).toContainText('%');
    await expect(page.getByTestId('vbox-drop-pool')).toBeVisible();
    const cta = page.getByTestId('vbox-free-open');
    await expect(cta).toBeVisible();
    await expect(cta).toContainText('Mở Hộp Miễn Phí');

    // ── 3. NO currency symbols anywhere on the page.
    const currency = await findCurrency(page);
    expect(currency, `unexpected currency tokens: ${currency.join(', ')}`).toEqual([]);
    // Currency was never part of the CTA copy.
    await expect(cta).not.toContainText(/coin|xu|₫|\$|vnd|usd/i);

    // ── 4. "Kho Đồ Tạm" section is completely absent from the DOM.
    await expect(page.getByText(/Kho Đồ Tạm/i)).toHaveCount(0);
    await expect(page.locator('[data-testid="temp-vault"]')).toHaveCount(0);

    // ── 5. Open the free unboxing modal and tear the pack to reveal a card.
    await cta.click();
    const modal = page.getByTestId('gacha-modal');
    await expect(modal).toBeVisible();

    const pack = page.getByTestId('gacha-pack');
    await expect(pack).toBeVisible();
    for (let i = 0; i < 3; i += 1) {
      await pack.click();
      await page.waitForTimeout(150);
    }

    const reveal = page.getByTestId('gacha-reveal');
    await expect(reveal).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('gacha-done')).toBeVisible();
    console.log('[UNBOX] reveal rendered cleanly');

    // Close the modal and capture the refactored free page.
    await page.getByTestId('gacha-done').click();
    await expect(modal).toHaveCount(0);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({ path: SHOT, fullPage: true });
    expect(fs.existsSync(SHOT)).toBe(true);
    console.log(`[SHOT] saved ${SHOT}`);

    if (fs.existsSync(MIRROR_DIR)) {
      fs.copyFileSync(SHOT, path.join(MIRROR_DIR, path.basename(SHOT)));
    }
  });
});
