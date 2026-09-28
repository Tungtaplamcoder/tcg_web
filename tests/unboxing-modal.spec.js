// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Unboxing Modal — automated visual verification (rebuilt clean modal).
 *
 * Flow: login as admin → Virtual Box Arcade → Aurora Legends Box →
 * "Open Box" → "Tear Pack" → wait for the reveal phase → assert the
 * real card artwork (Pikachu VMAX cb04dfc93891.jpg) is visibly rendered
 * (not the generic card back) → screenshot the revealed state.
 *
 * The card pool is weighted (5 cards; 60% COMMON), so any pull from the
 * Aurora box is a pass — the assertion is that a *dynamic* card image
 * from the API payload renders, i.e. img src points at the pulled card's
 * artwork URL and the bitmap actually loads (naturalWidth > 0).
 */

const LOGIN_URL = 'http://localhost:3000/login';
const VIRTUAL_BOXES_URL = 'http://localhost:3000/virtual-boxes';
const TEST_USER = 'admin@tcg.local';
const TEST_PASS = 'AdminSecurePass123!';
const AURORA_BOX_NAME = 'Aurora Legends Box';

test.describe('Unboxing Modal — clean reveal + dynamic card artwork', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('login → Aurora Legends Box → Tear Pack → revealed card artwork renders', async ({ page }) => {
    test.setTimeout(90_000);

    // The app defaults to Vietnamese after the i18n overhaul; this spec's
    // button-text assertions ("Open Box", "Tear Pack", "Open Another") are
    // written against the English UI, so pin the language before boot.
    await page.addInitScript(() => {
      try { window.localStorage.setItem('tcg-lang', 'en'); } catch (e) { /* ignore */ }
    });

    // ── Capture the open-box API payload + card image requests for diagnostics
    const apiPayloads = [];
    const imageRequests = [];
    page.on('response', async (response) => {
      if (response.url().includes('/virtual-boxes/') && response.url().includes('/open')) {
        const body = await response.json().catch(() => null);
        apiPayloads.push({ url: response.url(), status: response.status(), body });
        console.log('[API] open-box response:', JSON.stringify(body, null, 2));
      }
    });
    page.on('request', (request) => {
      if (request.resourceType() === 'image' && /ibb\.co/.test(request.url())) {
        imageRequests.push(request.url());
      }
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('[console.error]', msg.text());
    });

    // ── 1. Authenticate (retry — the backend auth limiter allows 10 logins / 15 min)
    await page.goto(LOGIN_URL);
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await expect(page.locator('input[type="text"]')).toBeVisible();
      await page.fill('input[type="text"]', TEST_USER);
      await page.fill('input[type="password"]', TEST_PASS);
      await page.click('button[type="submit"]');
      try {
        await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });
        break;
      } catch {
        if (attempt === 5) throw new Error('Login never redirected (rate-limited or failed 5×)');
        const rateLimited = await page.locator('text=/Too many requests/i').isVisible().catch(() => false);
        console.log(`[AUTH] login attempt ${attempt} failed${rateLimited ? ' (429 rate limit)' : ''} — retrying`);
        await page.goto(LOGIN_URL);
      }
    }
    console.log('[AUTH] logged in, landed on', page.url());

    // ── 2. Go to the Virtual Box Arcade page
    await page.goto(VIRTUAL_BOXES_URL);
    const auroraCard = page.locator('article', { hasText: AURORA_BOX_NAME }).first();
    await expect(auroraCard).toBeVisible({ timeout: 15_000 });

    // ── 3. Click "Open Box" on the Aurora Legends Box (not the first box)
    await auroraCard.locator('button', { hasText: /Open Box/i }).click();

    // ── 4. Modal opens — sealed pack state ("Tear Pack" visible)
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    const tearButton = page.locator('button', { hasText: 'Tear Pack' });
    await expect(tearButton).toBeVisible({ timeout: 10_000 });
    console.log('[MODAL] sealed pack visible — triggering Tear Pack');

    // ── 5. Trigger the unboxing action and wait for the API response
    const openResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/open') && res.request().method() === 'POST',
      { timeout: 30_000 }
    );
    await tearButton.click();
    const openResponse = await openResponsePromise;
    const payload = await openResponse.json();
    const pulledCard = payload?.data?.card?.gachaCard || payload?.data?.card;
    const expectedName = pulledCard?.name || null;
    const expectedImg = pulledCard?.imageUrl || pulledCard?.image_url || pulledCard?.image || null;
    console.log('[API] pulled card:', expectedName, '→', expectedImg);
    expect(openResponse.status()).toBe(200);
    expect(expectedImg, 'API payload must carry a card image URL').toBeTruthy();

    // ── 6. Wait for the reveal phase — the revealed card <img> mounts
    //    AND its bitmap actually decodes (naturalWidth > 0). Visibility
    //    alone can pass while the file is still in flight.
    const revealedImg = dialog.locator('img[alt="Revealed Card"], img[alt="' + (expectedName || 'Revealed Card') + '"]').first();
    await expect(revealedImg).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(async () => revealedImg.evaluate((el) => el.naturalWidth), { timeout: 20_000, message: 'card bitmap should decode' })
      .toBeGreaterThan(0);

    // ── 7. Inspect the DOM element during the reveal phase
    const imgSrc = await revealedImg.getAttribute('src');
    const natural = await revealedImg.evaluate((el) => ({ w: el.naturalWidth, h: el.naturalHeight }));
    console.log('[DOM] revealed card img src =', imgSrc);
    console.log('[DOM] natural size =', natural.w, 'x', natural.h);
    console.log('[NET] card image requests seen:', imageRequests);

    // src must match the API payload artwork (dynamic binding, not card back)
    expect(imgSrc).toBeTruthy();
    expect(imgSrc).toBe(expectedImg);

    // the card back placeholder (old bug) must NOT be the visible face
    const cardBackVisible = await dialog.locator('text=Mystery Pull').isVisible().catch(() => false);
    expect(cardBackVisible).toBe(false);

    // ── 8. Screenshot the revealed card state
    await page.waitForTimeout(800); // let the zoom-in reveal settle
    await page.screenshot({ path: 'unboxing-modal-reveal.png', fullPage: false });
    console.log('[SHOT] saved unboxing-modal-reveal.png');

    // ── 9. Bonus: cycle "Open Another" once to prove the state machine resets
    await page.locator('button', { hasText: 'Open Another' }).click();
    await expect(tearButton).toBeVisible({ timeout: 10_000 });
    console.log('[RESET] Open Another returned to sealed pack state — OK');
  });
});
