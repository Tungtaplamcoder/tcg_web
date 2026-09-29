// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Seamless editorial flow — no dividers between categories → featured.
 *
 * The section transition must be carried purely by refined floating category
 * cards and natural vertical spacing. This spec locks that in:
 *
 *   1. No marquee / text ticker / horizontal divider bar sits between the
 *      "Duyệt theo danh mục" grid and the "Sản phẩm nổi bật" section.
 *   2. Category cards render as premium floating cards (rounded-3xl + shadow).
 *   3. No generic uppercase eyebrow / sub-heading above "Sản phẩm nổi bật".
 *
 * Screenshot: successful_test/07_home_seamless_transition_fixed.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const SHOT = path.join(SHOT_DIR, '07_home_seamless_transition_fixed.png');

test.describe('Home seamless section transition', () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
  });

  test('no dividers, floating category cards, clean featured header', async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('[console.error]', msg.text());
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(500);

    const categoriesHeading = page.getByRole('heading', { name: 'Duyệt theo danh mục' });
    const featuredHeading = page.getByRole('heading', { name: 'Sản phẩm nổi bật' });
    await expect(categoriesHeading).toBeVisible();
    await expect(featuredHeading).toBeVisible();

    // ── 1. No divider components between the two sections.
    await expect(page.getByTestId('editorial-marquee')).toHaveCount(0);
    await expect(page.getByText(/AUTHENTIC POKÉMON CARDS/i)).toHaveCount(0);
    // No horizontal rule anywhere on the home page bridge.
    await expect(page.locator('hr')).toHaveCount(0);

    // The band between the category grid and the featured heading must not
    // contain any full-width bordered / divider strip.
    const dividerStrips = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('h2'));
      const cat = headings.find((h) => h.textContent.includes('Duyệt theo danh mục'));
      const feat = headings.find((h) => h.textContent.includes('Sản phẩm nổi bật'));
      if (!cat || !feat) return ['missing-headings'];
      const catSection = cat.closest('section');
      const catGrid = catSection ? catSection.querySelector('div.grid') : null;
      const bottom = catGrid ? catGrid.getBoundingClientRect().bottom : cat.getBoundingClientRect().bottom;
      const top = feat.getBoundingClientRect().top;
      const vw = window.innerWidth;
      const bad = [];
      for (const el of document.querySelectorAll('section, div, hr')) {
        const r = el.getBoundingClientRect();
        if (r.height < 2 || r.height > 140) continue;
        if (r.width < vw * 0.9) continue;
        if (r.top < bottom - 1 || r.bottom > top + 1) continue;
        const cs = getComputedStyle(el);
        const hasBorder = parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderBottomWidth) > 0;
        const hasBg = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';
        if (hasBorder || hasBg) {
          bad.push({ tag: el.tagName, cls: String(el.className).slice(0, 70) });
        }
      }
      return bad;
    });
    expect(dividerStrips).toEqual([]);

    // ── 2. Category cards are premium floating cards.
    const sealedCard = page.locator('a[href*="category=sealed-products"]');
    const singleCard = page.locator('a[href*="category=single-cards"]');
    await expect(sealedCard).toBeVisible();
    await expect(singleCard).toBeVisible();

    for (const card of [sealedCard, singleCard]) {
      const cls = await card.getAttribute('class');
      expect(cls).toContain('rounded-3xl');
      expect(cls).toContain('shadow-sm');
      expect(cls).toContain('bg-white/80');
      expect(cls).toContain('backdrop-blur-md');
      expect(cls).toContain('hover:shadow-md');
      expect(cls).toContain('hover:-translate-y-1');

      // Soft blush icon pill.
      const iconPill = card.locator('span').first();
      const pillCls = await iconPill.getAttribute('class');
      expect(pillCls).toContain('bg-pink-100/60');
      expect(pillCls).toContain('text-pink-700');
    }

    // ── 3. No eyebrow / sub-heading above "Sản phẩm nổi bật".
    await expect(page.getByText('Lựa chọn hot', { exact: true })).toBeHidden();
    const featuredSection = page.locator('section', { has: featuredHeading });
    await expect(featuredSection.locator('.section-eyebrow')).toHaveCount(0);
    const aboveText = await page.evaluate(() => {
      const h2 = Array.from(document.querySelectorAll('h2')).find((h) =>
        h.textContent.includes('Sản phẩm nổi bật')
      );
      const prev = h2 && h2.previousElementSibling;
      return prev ? prev.textContent.trim() : '';
    });
    expect(aboveText).toBe('');

    // ── 4. Natural spacing between grid and featured header (no dead zone).
    const gridBox = await page
      .locator('section', { has: categoriesHeading })
      .locator('div.grid')
      .boundingBox();
    const featBox = await featuredHeading.boundingBox();
    expect(gridBox).not.toBeNull();
    expect(featBox).not.toBeNull();
    const gap = featBox.y - (gridBox.y + gridBox.height);
    console.log(`[GAP] categories-grid → featured-heading = ${Math.round(gap)}px`);
    expect(gap).toBeGreaterThan(20);
    expect(gap).toBeLessThan(160);

    // ── 5. Visual proof screenshot.
    await featuredHeading.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -180));
    await page.screenshot({ path: SHOT, fullPage: false });
    expect(fs.existsSync(SHOT)).toBe(true);
    console.log(`[SHOT] saved ${SHOT}`);
  });
});
