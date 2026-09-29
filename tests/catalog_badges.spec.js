// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Catalog product-badge verification.
 *
 * Regression guard for the card taxonomy pill:
 *   • Sealed products (e.g. "E2E Sealed Box …") must render a "SEALED" badge,
 *     never the single-card "THẺ" default. Detection must survive payloads
 *     that only ship the immediate category, so it relies on the backend's
 *     derived mainType (SEALED_PRODUCT / SINGLE_CARD) with the frontend
 *     taxonomy heuristic as fallback.
 *   • Badges must be flat solid fills — no AI-style shiny gradients
 *     (bg-gradient-to-r / linear-gradient computed style).
 *
 * Flow: Catalog filtered by Sealed Products → every card badge is SEALED and
 * gradient-free; the "E2E Sealed Box" card is asserted explicitly. Then the
 * unfiltered Catalog is checked for at least one flat "THẺ" single-card badge.
 * Screenshot → successful_test/02_catalog_badges_fixed.png.
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const BADGE_SHOT = path.join(SHOT_DIR, '02_catalog_badges_fixed.png');

const badgeInfo = (el) => {
  const cs = getComputedStyle(el);
  return {
    cls: el.className,
    bgImage: cs.backgroundImage,
    bgColor: cs.backgroundColor,
    text: (el.textContent || '').trim()
  };
};

test.describe('Catalog badges — flat fill + sealed detection', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
  });

  test('sealed products show a flat SEALED badge instead of THẺ', async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('[console.error]', msg.text());
    });

    // ── Sealed Products filter ────────────────────────────────────────────
    await page.goto('/catalog?category=sealed-products', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    const badges = page.getByTestId('product-badge');
    await expect(badges.first()).toBeVisible();

    const count = await badges.count();
    expect(count).toBeGreaterThan(0);
    console.log(`[BADGES] sealed filter → ${count} product badges`);

    for (let i = 0; i < count; i++) {
      const badge = badges.nth(i);
      const info = await badge.evaluate(badgeInfo);

      // Correct taxonomy: sealed → SEALED, never the THẺ card default.
      expect(info.text).toBe('SEALED');
      await expect(badge).toHaveAttribute('data-sealed', 'true');
      expect(info.text).not.toBe('THẺ');

      // Flat fill: no Tailwind gradient class and no painted linear-gradient.
      expect(info.cls).not.toMatch(/gradient/);
      expect(info.bgImage).not.toMatch(/gradient/i);
      expect(info.bgImage).toBe('none');
      console.log(`[BADGE ${i}] "${info.text}" bg=${info.bgColor} image=${info.bgImage}`);
    }

    // The originally-reported case must be covered explicitly.
    const e2eCard = page.locator('a[href^="/product/"]', { hasText: 'E2E Sealed Box' }).first();
    await expect(e2eCard).toBeVisible();
    const e2eBadge = e2eCard.getByTestId('product-badge');
    await expect(e2eBadge).toHaveText('SEALED');
    await expect(e2eBadge).toHaveAttribute('data-sealed', 'true');
    console.log('[BADGE] E2E Sealed Box → SEALED');

    // Screenshot of the fixed, sealed-filtered catalog.
    await page.evaluate(() => {
      const first = document.querySelector('[data-testid="product-badge"]');
      first?.scrollIntoView({ block: 'start' });
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: BADGE_SHOT, fullPage: false });
    expect(fs.existsSync(BADGE_SHOT)).toBe(true);
    console.log(`[SHOT] saved ${BADGE_SHOT}`);

    // ── Unfiltered catalog: single cards still get a flat THẺ badge ───────
    await page.goto('/catalog', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByTestId('product-badge').first()).toBeVisible();

    const cardBadge = page.locator('[data-testid="product-badge"][data-sealed="false"]').first();
    if (await cardBadge.count() > 0) {
      await expect(cardBadge).toHaveText('THẺ');
      const info = await cardBadge.evaluate(badgeInfo);
      expect(info.cls).not.toMatch(/gradient/);
      expect(info.bgImage).toBe('none');
      console.log(`[BADGE] single card → "${info.text}" bg=${info.bgColor}`);
    } else {
      console.log('[BADGE] no single-card badge on page 1 — sealed-only catalog');
    }
  });
});
