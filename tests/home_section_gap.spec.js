// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Section-gap refactor on the home page — seamless editorial bridge.
 *
 * The "Duyệt theo danh mục" (categories) grid and the "Sản phẩm nổi bật"
 * (featured products) block used to be separated by a large empty band and a
 * redundant "Nhận bộ thẻ này ngay" CTA. The shipped design closes that gap
 * with natural vertical spacing and floating category cards — it deliberately
 * does NOT introduce a marquee / ticker / divider strip (see
 * home_seamless_flow.spec.js, which locks the absence of a bridge element).
 *
 * This spec is the gap-accounting counterpart:
 *   1. The "Nhận bộ thẻ này ngay" CTA is gone from the DOM (hidden).
 *   2. No marquee / divider strip bridges the two sections.
 *   3. The categories grid → featured heading gap is tight (no dead zone).
 *
 * Screenshot: successful_test/07_home_section_gap_fixed.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const SHOT = path.join(SHOT_DIR, '07_home_section_gap_fixed.png');

test.describe('Home section gap — seamless editorial bridge', () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
  });

  test('CTA removed, no divider bridge, categories → featured gap is tight', async ({ page }) => {
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

    // ── 2. The bridge is spacing, not a marquee / divider strip.
    await expect(page.getByTestId('editorial-marquee')).toHaveCount(0);
    await expect(page.getByText(/AUTHENTIC POKÉMON CARDS/i)).toHaveCount(0);
    await expect(page.locator('hr')).toHaveCount(0);

    // ── 3. Categories and featured sections both render.
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
    const featBox = await featuredHeading.boundingBox();
    expect(gridBox).not.toBeNull();
    expect(featBox).not.toBeNull();

    const gap = featBox.y - (gridBox.y + gridBox.height);
    console.log(`[GAP] categories-grid → featured-heading gap = ${Math.round(gap)}px`);

    // Featured heading must sit below the grid, and the dead zone is bounded.
    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeLessThan(200);

    // ── 4. Visual proof screenshot.
    await featuredHeading.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -120));
    await page.screenshot({ path: SHOT, fullPage: false });
    expect(fs.existsSync(SHOT)).toBe(true);
    console.log(`[SHOT] saved ${SHOT}`);
  });
});
