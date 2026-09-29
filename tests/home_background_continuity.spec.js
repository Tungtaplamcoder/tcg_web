// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Background continuity across the "Duyệt theo danh mục" section.
 *
 * A full-width white strip used to cut across this section between two soft
 * pastel areas. The category wrapper must now be fully transparent so the
 * global pastel mesh gradient passes through; only the individual cards carry
 * the floating white surface.
 *
 * Screenshot: successful_test/07_category_bg_seamless_fixed.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const SHOT = path.join(SHOT_DIR, '07_category_bg_seamless_fixed.png');

test.describe('Category section background continuity', () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
  });

  test('category wrapper is transparent, white lives only on cards', async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('[console.error]', msg.text());
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(500);

    const categoriesHeading = page.getByRole('heading', { name: 'Duyệt theo danh mục' });
    await expect(categoriesHeading).toBeVisible();

    // ── 1. The category <section> wrapper + its container are transparent.
    const sectionBg = await page.evaluate(() => {
      const h2 = Array.from(document.querySelectorAll('h2')).find((h) =>
        h.textContent.includes('Duyệt theo danh mục')
      );
      const section = h2.closest('section');
      const container = section.querySelector('div');
      const read = (el) => {
        const cs = getComputedStyle(el);
        return { bg: cs.backgroundColor, bgImage: cs.backgroundImage, cls: String(el.className) };
      };
      return { section: read(section), container: read(container) };
    });

    // The requirement: rgba(0, 0, 0, 0) / transparent, no painted gradient.
    expect(sectionBg.section.bg).toBe('rgba(0, 0, 0, 0)');
    expect(sectionBg.section.bgImage).toBe('none');
    expect(sectionBg.section.cls).toContain('bg-transparent');
    expect(sectionBg.container.bg).toBe('rgba(0, 0, 0, 0)');
    expect(sectionBg.container.bgImage).toBe('none');

    // ── 2. Every ancestor up to <body> stays transparent (no opaque white band).
    const ancestorBgs = await page.evaluate(() => {
      const h2 = Array.from(document.querySelectorAll('h2')).find((h) =>
        h.textContent.includes('Duyệt theo danh mục')
      );
      const out = [];
      let el = h2.closest('section');
      while (el && el !== document.body) {
        const cs = getComputedStyle(el);
        out.push({ tag: el.tagName, bg: cs.backgroundColor, bgImage: cs.backgroundImage });
        el = el.parentElement;
      }
      return out;
    });
    for (const a of ancestorBgs) {
      // Solid body colour must not be painted; the gradient canvas is an image
      // on the outermost wrapper (handled below).
      expect(a.bg).toBe('rgba(0, 0, 0, 0)');
    }
    // The single page canvas owns the pastel gradient.
    const canvas = await page.evaluate(() => {
      const root = document.querySelector('#root > div');
      const cs = getComputedStyle(root);
      return { bgImage: cs.backgroundImage, bgColor: cs.backgroundColor };
    });
    expect(canvas.bgColor).toBe('rgba(0, 0, 0, 0)');
    expect(canvas.bgImage).toContain('linear-gradient');

    // ── 3. No sibling full-width opaque light strip inside the section band.
    const strips = await page.evaluate(() => {
      const h2 = Array.from(document.querySelectorAll('h2')).find((h) =>
        h.textContent.includes('Duyệt theo danh mục')
      );
      const section = h2.closest('section');
      const r = section.getBoundingClientRect();
      const vw = window.innerWidth;
      const bad = [];
      for (const el of section.querySelectorAll('*')) {
        const b = el.getBoundingClientRect();
        if (b.width < vw * 0.9 || b.height < 8) continue;
        const cs = getComputedStyle(el);
        const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/);
        if (!m) continue;
        const p = m[1].split(',').map((s) => parseFloat(s));
        const a = p.length > 3 ? p[3] : 1;
        if (a > 0.05) bad.push({ tag: el.tagName, cls: String(el.className).slice(0, 70), bg: cs.backgroundColor });
      }
      return bad;
    });
    expect(strips).toEqual([]);

    // ── 4. White surface lives ONLY on the category cards.
    const sealedCard = page.locator('a[href*="category=sealed-products"]');
    const singleCard = page.locator('a[href*="category=single-cards"]');
    for (const card of [sealedCard, singleCard]) {
      await expect(card).toBeVisible();
      const cls = await card.getAttribute('class');
      expect(cls).toContain('bg-white/80');
      expect(cls).toContain('backdrop-blur-md');
      expect(cls).toContain('border-pink-100/70');
      expect(cls).toContain('rounded-3xl');
      expect(cls).toContain('shadow-sm');
      // The card must NOT be full-width.
      const box = await card.boundingBox();
      expect(box.width).toBeLessThan(600);
    }

    // ── 5. Visual proof screenshot.
    await categoriesHeading.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -140));
    await page.screenshot({ path: SHOT, fullPage: false });
    expect(fs.existsSync(SHOT)).toBe(true);
    console.log(`[SHOT] saved ${SHOT}`);
  });
});
