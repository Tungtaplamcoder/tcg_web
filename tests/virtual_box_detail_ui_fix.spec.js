// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Virtual Box detail page — layout optimization & theme-unified footer.
 *
 * Contract:
 *  1. Light mode footer uses the light paper surface (no black band).
 *  2. Drop Pool uses the compact 5/6-column grid with 2.5:3.5 TCG card art.
 *  3. Hero + "other boxes" art wrappers are adaptive (h-48/h-56, object-contain)
 *     so BOTH portrait and landscape box assets render without distortion.
 *
 * Screenshots:
 *   successful_test/42_virtual_box_detail_lightmode_fixed.png
 *   successful_test/42_virtual_box_detail_darkmode_fixed.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const MIRROR_DIR = path.join(__dirname, '..', '..', 'successful_test');
const LIGHT_SHOT = path.join(SHOT_DIR, '42_virtual_box_detail_lightmode_fixed.png');
const DARK_SHOT = path.join(SHOT_DIR, '42_virtual_box_detail_darkmode_fixed.png');

const rgb = (str) => {
  const m = String(str).match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(',').map((s) => parseFloat(s));
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
};

async function resolveBoxPath(page) {
  const res = await page.request.get('/api/v1/virtual-boxes?limit=5');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  const first = body?.data?.items?.[0];
  expect(first && first.id, 'a seeded active virtual box exists').toBeTruthy();
  return `/virtual-boxes/${first.id}`;
}

test.describe('Virtual Box detail — equal-height top, compact pool, adaptive art, unified footer', () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
  });

  test('light + dark layout fixes', async ({ page }) => {
    // Force light theme for the first pass.
    await page.addInitScript(() => {
      try { window.localStorage.setItem('tcg-theme', 'light'); } catch (e) { /* ignore */ }
    });

    const boxPath = await resolveBoxPath(page);
    await page.goto(boxPath, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByTestId('vbox-detail')).toBeVisible();

    // ── 1. Equal-height top row: both cards stretch to the same height.
    const heights = await page.evaluate(() => {
      const section = document.querySelector('[data-testid="vbox-detail"] section');
      const cards = [...section.children].filter((el) => el.tagName === 'DIV');
      return cards.map((c) => Math.round(c.getBoundingClientRect().height));
    });
    expect(heights.length).toBeGreaterThanOrEqual(2);
    expect(Math.abs(heights[0] - heights[1])).toBeLessThanOrEqual(2);

    // ── 2. Compact drop-pool grid: 6 columns at lg + 2.5:3.5 card art.
    const grid = page.getByTestId('vbox-pool-grid');
    await expect(grid).toBeVisible();
    await expect(grid).toHaveClass(/grid-cols-2/);
    await expect(grid).toHaveClass(/sm:grid-cols-3/);
    await expect(grid).toHaveClass(/md:grid-cols-5/);
    await expect(grid).toHaveClass(/lg:grid-cols-6/);

    const cols = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(cols).toBe(6);

    const firstArt = page.getByTestId('vbox-pool-art').first();
    await expect(firstArt).toBeVisible();
    const art = await firstArt.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { w: r.width, h: r.height, ratio: cs.aspectRatio, cls: String(el.className) };
    });
    expect(art.cls).not.toContain('aspect-[3/4]');
    expect(Math.abs(art.w / art.h - 2.5 / 3.5)).toBeLessThan(0.03);

    // ── 3. Adaptive box-art wrappers handle portrait AND landscape assets.
    const wrapperInfo = await page.evaluate(() => {
      const out = [];
      for (const id of ['vbox-hero-art', 'vbox-other-art']) {
        const el = document.querySelector(`[data-testid="${id}"]`);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        out.push({ id, w: r.width, h: r.height, cls: String(el.className) });
      }
      return out;
    });
    expect(wrapperInfo.length).toBeGreaterThanOrEqual(1);
    for (const w of wrapperInfo) {
      expect(w.cls).toContain('flex');
      expect(w.cls).toContain('h-48');
      expect(w.cls).toContain('sm:h-56');
      expect(w.cls).toContain('rounded-2xl');
    }

    const fit = await page.evaluate(async () => {
      const svg = (w, h) =>
        `data:image/svg+xml;utf8,${encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#ec4899"/></svg>`
        )}`;
      const wrappers = ['vbox-hero-art', 'vbox-other-art']
        .map((id) => document.querySelector(`[data-testid="${id}"]`))
        .filter(Boolean);
      const results = [];
      for (const wrapper of wrappers) {
        const wr = wrapper.getBoundingClientRect();
        const before = [...wrapper.children].length;
        for (const [nw, nh] of [[400, 200], [200, 400]]) {
          const img = document.createElement('img');
          img.src = svg(nw, nh);
          img.className = 'max-w-full max-h-full object-contain drop-shadow-md';
          img.style.maxWidth = '100%';
          img.style.maxHeight = '100%';
          wrapper.appendChild(img);
          await new Promise((res) => { img.onload = res; if (img.complete) res(); });
          const r = img.getBoundingClientRect();
          results.push({
            orientation: nw > nh ? 'landscape' : 'portrait',
            fitsW: r.width <= wr.width + 1,
            fitsH: r.height <= wr.height + 1,
            ratioErr: Math.abs((r.width / r.height) - (nw / nh))
          });
          img.remove();
        }
        if (wrapper.children.length !== before) throw new Error('wrapper cleanup failed');
      }
      return results;
    });
    expect(fit.length).toBeGreaterThanOrEqual(2);
    for (const f of fit) {
      expect(f.fitsW, `${f.orientation} fits width`).toBe(true);
      expect(f.fitsH, `${f.orientation} fits height`).toBe(true);
      expect(f.ratioErr, `${f.orientation} aspect preserved`).toBeLessThan(0.05);
    }

    // ── 4. Light-mode footer: light surface, no black band.
    const footer = page.getByTestId('site-footer');
    await footer.scrollIntoViewIfNeeded();
    const lightFooter = await footer.evaluate((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        bg: cs.backgroundColor,
        borderTopColor: cs.borderTopColor,
        width: Math.round(r.width),
        vw: window.innerWidth
      };
    });
    const lf = rgb(lightFooter.bg);
    expect(lf, `footer bg parse (${lightFooter.bg})`).toBeTruthy();
    expect(lf.r).toBeGreaterThan(200);
    expect(lf.g).toBeGreaterThan(200);
    expect(lf.b).toBeGreaterThan(200);
    const lb = rgb(lightFooter.borderTopColor);
    expect(lb.r).toBeGreaterThan(200); // pink-100, never a dark hairline

    // No full-width near-black strip in the footer band (light mode).
    const darkBands = await page.evaluate(() => {
      const footer = document.querySelector('[data-testid="site-footer"]');
      const fr = footer.getBoundingClientRect();
      const bad = [];
      for (const el of document.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.width < window.innerWidth * 0.9 || r.height < 8) continue;
        if (r.bottom < fr.top || r.top > fr.bottom) continue;
        const cs = getComputedStyle(el);
        const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/);
        if (!m) continue;
        const p = m[1].split(',').map((s) => parseFloat(s));
        const a = p.length > 3 ? p[3] : 1;
        if (a > 0.85 && p[0] < 60 && p[1] < 60 && p[2] < 60) bad.push({ tag: el.tagName, bg: cs.backgroundColor });
      }
      return bad;
    });
    expect(darkBands, `unexpected dark bands: ${JSON.stringify(darkBands)}`).toEqual([]);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);
    await page.screenshot({ path: LIGHT_SHOT, fullPage: true });
    expect(fs.existsSync(LIGHT_SHOT)).toBe(true);
    console.log(`[SHOT] saved ${LIGHT_SHOT}`);

    // ── 5. Dark mode: footer flips to the neutral dark surface.
    await page.addInitScript(() => {
      try { window.localStorage.setItem('tcg-theme', 'dark'); } catch (e) { /* ignore */ }
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.locator('html')).toHaveClass(/dark/);

    const darkFooter = await footer.evaluate((el) => getComputedStyle(el).backgroundColor);
    const df = rgb(darkFooter);
    expect(df, `dark footer bg parse (${darkFooter})`).toBeTruthy();
    expect(df.r).toBeLessThan(60);
    expect(df.g).toBeLessThan(60);
    expect(df.b).toBeLessThan(60);

    await footer.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);
    await page.screenshot({ path: DARK_SHOT, fullPage: true });
    expect(fs.existsSync(DARK_SHOT)).toBe(true);
    console.log(`[SHOT] saved ${DARK_SHOT}`);

    if (fs.existsSync(MIRROR_DIR)) {
      fs.copyFileSync(LIGHT_SHOT, path.join(MIRROR_DIR, path.basename(LIGHT_SHOT)));
      fs.copyFileSync(DARK_SHOT, path.join(MIRROR_DIR, path.basename(DARK_SHOT)));
    }
  });
});
