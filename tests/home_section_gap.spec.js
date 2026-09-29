// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Section-gap refactor on the home page.
 *
 * The "Duyệt theo danh mục" (categories) grid and the "Sản phẩm nổi bật"
 * (featured products) block used to be separated by a large empty band and a
 * redundant "Nhận bộ thẻ này ngay" CTA. This spec locks the refactor:
 *
 *   1. The "Nhận bộ thẻ này ngay" CTA is gone from the DOM (hidden).
 *   2. An Editorial Marquee strip is rendered BETWEEN the categories and the
 *      featured products sections, with the required editorial keywords.
 *   3. Vertical spacing flows naturally (no oversized empty gap).
 *
 * Screenshot: successful_test/07_home_section_gap_fixed.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const SHOT = path.join(SHOT_DIR, '07_home_section_gap_fixed.png');

test.describe('Home section gap — editorial marquee bridge', () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
  });

  test('CTA removed, marquee bridges categories → featured', async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('[console.error]', msg.text());
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(500);

    // ── 1. The featured-products CTA button must be gone.
    const cta = page.getByText('Nhận bộ thẻ này ngay', { exact: false });
    await expect(cta).toBeHidden();
    // Broader guard: no visible link carrying the old CTA label.
    await expect(page.getByRole('link', { name: /Nhận bộ thẻ này ngay/i })).toHaveCount(0);

    // ── 2. Editorial marquee is rendered and visible.
    const marquee = page.getByTestId('editorial-marquee');
    await expect(marquee).toBeVisible();

    const marqueeText = (await marquee.innerText()).replace(/\s+/g, ' ').toUpperCase();
    expect(marqueeText).toContain('AUTHENTIC POKÉMON CARDS');
    expect(marqueeText).toContain('RARE CHASE CARDS');
    expect(marqueeText).toContain('VERIFIED AUTHENTICITY');
    expect(marqueeText).toContain('CURATED PACKS');
    expect(marqueeText).toContain('FAST SHIPPING');

    // Required styling tokens on the strip.
    const marqueeClass = await marquee.getAttribute('class');
    expect(marqueeClass).toContain('bg-pink-50/40');
    expect(marqueeClass).toContain('backdrop-blur-xs');
    expect(marqueeClass).toContain('border-pink-100/40');

    // ── 3. Marquee sits BETWEEN the two sections, with tightened spacing.
    const categoriesHeading = page.getByRole('heading', { name: 'Duyệt theo danh mục' });
    const featuredHeading = page.getByRole('heading', { name: 'Sản phẩm nổi bật' });
    await expect(categoriesHeading).toBeVisible();
    await expect(featuredHeading).toBeVisible();

    // The real whitespace band is measured from the bottom of the category
    // cards grid (not the heading) to the top of the featured section heading.
    const categoriesSection = page.locator('section', {
      has: page.getByRole('heading', { name: 'Duyệt theo danh mục' })
    });
    const categoryGrid = categoriesSection.locator('div.grid');
    const gridBox = await categoryGrid.boundingBox();
    const marqueeBox = await marquee.boundingBox();
    const featBox = await featuredHeading.boundingBox();
    expect(gridBox).not.toBeNull();
    expect(marqueeBox).not.toBeNull();
    expect(featBox).not.toBeNull();

    expect(marqueeBox.y).toBeGreaterThan(gridBox.y + gridBox.height);
    expect(featBox.y).toBeGreaterThan(marqueeBox.y + marqueeBox.height);

    // Tight gap: the empty band between the categories grid and the featured
    // heading is dominated by the marquee strip, not a large dead zone.
    const gap = featBox.y - (gridBox.y + gridBox.height);
    console.log(
      `[GAP] categories-grid→featured-heading gap = ${Math.round(gap)}px (marquee ${Math.round(marqueeBox.height)}px)`
    );
    expect(gap).toBeLessThan(200);

    // ── 4. Visual proof screenshot.
    await marquee.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -80));
    await page.screenshot({ path: SHOT, fullPage: false });
    expect(fs.existsSync(SHOT)).toBe(true);
    console.log(`[SHOT] saved ${SHOT}`);
  });
});
