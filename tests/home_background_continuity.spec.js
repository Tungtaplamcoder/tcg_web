// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Unbroken home-page background.
 *
 * Section components used to paint their own local gradients
 * (e.g. `bg-gradient-to-b from-white to-pink-50`), producing hard horizontal
 * colour cuts between Hero, Category Grid and Featured Products.
 *
 * After the fix there is exactly ONE continuous gradient, owned by the
 * outermost layout container. Every inner <section> must be strictly
 * transparent so that single canvas shows through from top to bottom.
 *
 * Screenshot: successful_test/07_home_unbroken_background_fixed.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const SHOT = path.join(SHOT_DIR, '07_home_unbroken_background_fixed.png');

const TRANSPARENT = 'rgba(0, 0, 0, 0)';

test.describe('Home unbroken background continuity', () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
  });

  test('Hero, Category and Featured sections are all transparent', async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('[console.error]', msg.text());
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(500);

    // ── Locate the three section wrappers.
    const heroSection = page.locator('section', { has: page.locator('h1') }).first();
    const categorySection = page.locator('section', {
      has: page.getByRole('heading', { name: 'Duyệt theo danh mục' })
    });
    const featuredSection = page.locator('section', {
      has: page.getByRole('heading', { name: 'Sản phẩm nổi bật' })
    });

    for (const [name, loc] of [
      ['Hero', heroSection],
      ['Category', categorySection],
      ['Featured', featuredSection]
    ]) {
      await expect(loc, `${name} section should be visible`).toBeVisible();
      const style = await loc.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { bg: cs.backgroundColor, bgImage: cs.backgroundImage, cls: String(el.className) };
      });
      expect(style.bg, `${name} background-color`).toBe(TRANSPARENT);
      expect(style.bgImage, `${name} background-image`).toBe('none');
      expect(style.cls, `${name} should carry bg-transparent`).toContain('bg-transparent');
      console.log(`[SECTION] ${name}: bg=${style.bg} bgImage=${style.bgImage}`);
    }

    // ── Every <section> inside <main> must be transparent (no local bands).
    const sections = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('main section')).map((el) => {
        const cs = getComputedStyle(el);
        return { cls: String(el.className).slice(0, 80), bg: cs.backgroundColor, bgImage: cs.backgroundImage };
      });
    });
    expect(sections.length).toBeGreaterThan(0);
    for (const s of sections) {
      expect(s.bg, `section ${s.cls}`).toBe(TRANSPARENT);
      expect(s.bgImage, `section ${s.cls}`).toBe('none');
    }
    console.log(`[OK] all ${sections.length} home sections are transparent`);

    // ── Exactly one global gradient, owned by the outer layout container.
    const canvas = await page.evaluate(() => {
      const layout = document.querySelector('#root > div');
      const home = document.querySelector('main > div');
      const cs = getComputedStyle(layout);
      const homeCs = home ? getComputedStyle(home) : null;
      return {
        cls: String(layout.className),
        bgColor: cs.backgroundColor,
        bgImage: cs.backgroundImage,
        homeCls: home ? String(home.className) : '',
        homeBg: homeCs ? homeCs.backgroundColor : '',
        homeBgImage: homeCs ? homeCs.backgroundImage : ''
      };
    });
    expect(canvas.cls).toContain('from-[#FFF0F5]');
    expect(canvas.cls).toContain('via-[#FDFBF7]');
    expect(canvas.cls).toContain('to-[#FFF0F5]');
    expect(canvas.bgColor).toBe(TRANSPARENT);
    expect(canvas.bgImage).toContain('linear-gradient');
    // The Home page wrapper must NOT start a second gradient of its own.
    expect(canvas.homeBg).toBe(TRANSPARENT);
    expect(canvas.homeBgImage).toBe('none');

    // ── No full-width opaque background strip anywhere in <main>.
    const strips = await page.evaluate(() => {
      const vw = window.innerWidth;
      const bad = [];
      for (const el of document.querySelectorAll('main *')) {
        const r = el.getBoundingClientRect();
        if (r.width < vw * 0.9 || r.height < 8 || r.height > 2000) continue;
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

    // ── Visual proof screenshot (full page shows the gradient continuity).
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: SHOT, fullPage: true });
    expect(fs.existsSync(SHOT)).toBe(true);
    console.log(`[SHOT] saved ${SHOT}`);
  });
});
