// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Homepage light/dark theme unification + adaptive featured grid.
 *
 * Bug 1 — hardcoded dark bands: "Mở Hộp Áo Miễn Phí" and "3 Trụ Cột Minh Bạch"
 * painted `bg-neutral-900` in BOTH themes, so light mode showed a black block
 * mid-page. They now adapt (pastel light card / dark editorial card) and the
 * footer matches.
 *
 * Bug 2 — sparse grid: with <4 products the 4-column grid pinned items to the
 * far left. Small catalogs now center gracefully and fill to 4 columns as the
 * catalog grows.
 *
 * Screenshots:
 *   successful_test/41_homepage_lightmode_unified_fixed.png
 *   successful_test/41_homepage_darkmode_unified_fixed.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const LIGHT_SHOT = path.join(SHOT_DIR, '41_homepage_lightmode_unified_fixed.png');
const DARK_SHOT = path.join(SHOT_DIR, '41_homepage_darkmode_unified_fixed.png');

const parseRgb = (value) => {
  const m = String(value).match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(',').map((s) => parseFloat(s.trim()));
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
};

const luminance = ({ r, g, b }) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

test.describe('Homepage light/dark theme unification', () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
  });

  test('Light mode — no harsh black container bands', async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('tcg-theme', 'light'); } catch (e) { /* no-op */ }
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('[console.error]', msg.text());
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(500);

    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(false);

    // Virtual Box + featured showcase cards must use light pastel surfaces.
    for (const id of ['virtual-box-card', 'showcase-product-card']) {
      const el = page.getByTestId(id).first();
      await expect(el).toBeVisible();
      const style = await el.evaluate((node) => {
        const cs = getComputedStyle(node);
        return { bg: cs.backgroundColor, color: cs.color };
      });
      const bg = parseRgb(style.bg);
      const fg = parseRgb(style.color);
      expect(bg, `${id} has an opaque background`).not.toBeNull();
      expect(bg.a, `${id} background alpha`).toBeGreaterThan(0.5);
      console.log(`[LIGHT] ${id} bg=${style.bg} color=${style.color}`);
      expect(luminance(bg), `${id} background must be light in light mode`).toBeGreaterThan(150);
      expect(luminance(fg), `${id} text must be dark in light mode`).toBeLessThan(120);
    }

    // No large, opaque, near-black block anywhere inside <main>.
    const bands = await page.evaluate(() => {
      const bad = [];
      for (const el of document.querySelectorAll('main *')) {
        const r = el.getBoundingClientRect();
        if (r.width < 400 || r.height < 120) continue;
        const cs = getComputedStyle(el);
        const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/);
        if (!m) continue;
        const p = m[1].split(',').map((s) => parseFloat(s.trim()));
        const a = p.length > 3 ? p[3] : 1;
        if (a <= 0.5) continue;
        const lum = 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
        if (lum < 60) bad.push({ cls: String(el.className).slice(0, 70), bg: cs.backgroundColor });
      }
      return bad;
    });
    expect(bands, 'no hardcoded dark bands in light mode').toEqual([]);

    // Brand constraint: vector icons only — no raw text/character emojis.
    const emojiHits = await page.evaluate(() => {
      const text = document.querySelector('main')?.innerText || '';
      return text.match(/\p{Extended_Pictographic}/gu) || [];
    });
    expect(emojiHits, 'homepage must not render raw text emojis').toEqual([]);
    console.log('[ICONS] no raw text emojis found in homepage copy');

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: LIGHT_SHOT, fullPage: true });
    expect(fs.existsSync(LIGHT_SHOT)).toBe(true);
    console.log(`[SHOT] saved ${LIGHT_SHOT} (${fs.statSync(LIGHT_SHOT).size} bytes)`);
  });

  test('Dark mode — rich dark glassmorphism renders seamlessly', async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('tcg-theme', 'dark'); } catch (e) { /* no-op */ }
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(500);

    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true);

    for (const id of ['virtual-box-card', 'showcase-product-card']) {
      const el = page.getByTestId(id).first();
      await expect(el).toBeVisible();
      const style = await el.evaluate((node) => {
        const cs = getComputedStyle(node);
        return { bg: cs.backgroundColor, color: cs.color };
      });
      const bg = parseRgb(style.bg);
      const fg = parseRgb(style.color);
      console.log(`[DARK] ${id} bg=${style.bg} color=${style.color}`);
      expect(bg.a, `${id} background alpha`).toBeGreaterThan(0.5);
      expect(luminance(bg), `${id} background must be dark in dark mode`).toBeLessThan(70);
      expect(luminance(fg), `${id} text must be light in dark mode`).toBeGreaterThan(150);
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: DARK_SHOT, fullPage: true });
    expect(fs.existsSync(DARK_SHOT)).toBe(true);
    console.log(`[SHOT] saved ${DARK_SHOT} (${fs.statSync(DARK_SHOT).size} bytes)`);
  });

  test('Sparse catalog — 1-3 products center instead of sticking left', async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('tcg-theme', 'light'); } catch (e) { /* no-op */ }
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(500);

    const grid = page.getByTestId('featured-grid');
    await expect(grid).toBeVisible();
    const cards = page.getByTestId('showcase-product-card');
    const count = await cards.count();
    console.log(`[GRID] product cards = ${count}`);

    if (count > 0 && count < 4) {
      const gridCls = await grid.getAttribute('class');
      expect(gridCls, 'sparse grid must center').toContain('justify-center');
      expect(gridCls, 'sparse grid must be width-capped').toContain('max-w-');

      const box = await cards.first().boundingBox();
      const viewport = page.viewportSize();
      const cardCenter = box.x + box.width / 2;
      const viewportCenter = viewport.width / 2;
      console.log(`[GRID] card center=${Math.round(cardCenter)} viewport center=${viewportCenter}`);
      // Centered within a reasonable tolerance, and definitely not stuck left.
      expect(Math.abs(cardCenter - viewportCenter)).toBeLessThan(90);
      expect(box.x).toBeGreaterThan(120);
    } else if (count >= 4) {
      expect(await grid.getAttribute('class')).toContain('lg:grid-cols-4');
    }
  });
});
