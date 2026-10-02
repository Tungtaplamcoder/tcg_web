// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Comprehensive dark-mode regression guard.
 *
 * Bug A — Category Cards ("Hộp thẻ" / "Thẻ lẻ"):
 *   The two category <Link> cards carried hard-coded light-mode classes
 *   (`bg-white/80`, `border-pink-100/70`, icon `bg-pink-100/60 text-pink-700`)
 *   with NO `dark:` variants, so in dark mode they rendered as harsh white
 *   slabs. They must now adapt exactly like the Feature Benefit cards
 *   (`.surface-editorial`), which already flip to a dark translucent surface.
 *
 * Bug B — Top-left ambient glow clipping:
 *   The outer header wrapper around the floating pill must never clip
 *   inner/outer glow effects, so it is transparent in BOTH themes and
 *   `overflow: visible`.
 *
 * Screenshots:
 *   successful_test/01_darkmode_glow_uncut_fixed.png
 *   successful_test/07_darkmode_category_cards_fixed.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const SHOT_GLOW = path.join(SHOT_DIR, '01_darkmode_glow_uncut_fixed.png');
const SHOT_CARDS = path.join(SHOT_DIR, '07_darkmode_category_cards_fixed.png');

const TRANSPARENT = 'rgba(0, 0, 0, 0)';
const LIGHT_CARD_BG = 'rgba(255, 255, 255, 0.8)';

const parseRgba = (value) => {
  const m = String(value).match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(',').map((s) => parseFloat(s.trim()));
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
};

test.describe('Dark mode: header glow + category cards', () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
  });

  test('glow is uncut and category cards adopt dark surfaces', async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('[console.error]', msg.text());
    });

    // ── 1. Load the storefront, then toggle dark mode ON via the theme button.
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(400);

    const themeToggle = page.getByRole('button', {
      name: /Chuyển sang chế độ tối|Switch to dark mode/
    });
    await expect(themeToggle).toBeVisible();
    await themeToggle.click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    console.log('[THEME] dark mode enabled');

    // ── 2. Outer header wrapper must be transparent + overflow visible.
    const header = page.getByTestId('site-header');
    await expect(header).toBeVisible();
    await expect(header).toHaveClass(/overflow-visible/);
    await expect(header).toHaveClass(/bg-transparent/);

    const headerStyle = await header.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        overflow: cs.overflow,
        bg: cs.backgroundColor,
        bgImage: cs.backgroundImage,
        backdrop: cs.backdropFilter || cs.webkitBackdropFilter
      };
    });
    console.log(`[HEADER] overflow=${headerStyle.overflow} bg=${headerStyle.bg} img=${headerStyle.bgImage}`);
    expect(headerStyle.overflow).toBe('visible');
    expect(headerStyle.bg).toBe(TRANSPARENT);
    expect(headerStyle.bgImage).toBe('none');
    expect(headerStyle.backdrop).toBe('none');

    // ── 3. Category cards must match the Feature Benefit cards' dark treatment.
    const categoryCards = page.locator('a[href*="category=sealed-products"], a[href*="category=single-cards"]');
    await expect(categoryCards).toHaveCount(2);

    const featureCards = page.locator('.surface-editorial');
    const featureCount = await featureCards.count();
    expect(featureCount).toBeGreaterThan(0);

    const catStyles = await categoryCards.evaluateAll((els) =>
      els.map((el) => ({
        text: el.textContent.trim().slice(0, 24),
        cls: String(el.className),
        bg: getComputedStyle(el).backgroundColor
      }))
    );
    const featureBg = await featureCards.first().evaluate((el) => getComputedStyle(el).backgroundColor);

    console.log('[CATEGORY CARDS]', JSON.stringify(catStyles, null, 2));
    console.log(`[FEATURE CARD BG] ${featureBg}`);

    const featureRgba = parseRgba(featureBg);
    expect(featureRgba, 'feature card bg should parse').not.toBeNull();
    // Feature benefit cards are a dark translucent surface (white @ 4%).
    expect(featureRgba.a).toBeLessThan(0.15);

    for (const card of catStyles) {
      // The harsh light-mode white background must be gone.
      expect(card.bg, `card "${card.text}" still light-mode white`).not.toBe(LIGHT_CARD_BG);
      expect(card.cls, `card "${card.text}" missing dark bg class`).toContain('dark:bg-neutral-900/80');
      expect(card.cls, `card "${card.text}" missing dark border class`).toContain('dark:border-neutral-800');

      const rgba = parseRgba(card.bg);
      expect(rgba, `card "${card.text}" bg should parse`).not.toBeNull();
      // A dark neutral surface: low channel values, not a bright slab.
      expect(rgba.r, `card "${card.text}" red channel too bright`).toBeLessThan(60);
      expect(rgba.g, `card "${card.text}" green channel too bright`).toBeLessThan(60);
      expect(rgba.b, `card "${card.text}" blue channel too bright`).toBeLessThan(60);
      // Matching the dark-mode-adapted feature cards: neither is the light surface.
      expect(rgba.a, `card "${card.text}" should be translucent`).toBeLessThan(1);
    }

    // Text + icon containers adapt too.
    const iconBadge = categoryCards.first().locator('span').first();
    await expect(iconBadge).toHaveClass(/dark:bg-pink-950\/50/);
    const title = categoryCards.first().locator('span.font-display');
    await expect(title).toHaveClass(/dark:text-pink-50/);

    // ── 4. Screenshot 1: uncut header glow in dark mode.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);
    await page.screenshot({ path: SHOT_GLOW, fullPage: false });
    expect(fs.existsSync(SHOT_GLOW)).toBe(true);
    console.log(`[SHOT] saved ${SHOT_GLOW}`);

    // ── 5. Screenshot 2: fixed category cards in dark mode.
    await categoryCards.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    const grid = page.locator('a[href*="category=sealed-products"]').first().locator('xpath=..');
    await grid.screenshot({ path: SHOT_CARDS });
    expect(fs.existsSync(SHOT_CARDS)).toBe(true);
    console.log(`[SHOT] saved ${SHOT_CARDS}`);
  });
});
