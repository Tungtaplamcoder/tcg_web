// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Floating pill navbar — spacing / no-collision verification.
 *
 * The pill was squeezed (max-w-6xl) so nav labels and utility controls
 * collapsed and overlapped. This spec locks in the wider container
 * (max-w-7xl, px-5/6, gap-4), non-wrapping shrink-proof items, and an
 * earlier responsive cutover (nav links show at xl, hamburger below).
 *
 * Contract:
 *  - pill is rounded-full, backdrop-blurred, max-w-7xl and floats inset
 *  - outer <header> is transparent (no white block behind the bar)
 *  - nav links + utility controls never overlap and stay inside the pill
 *  - no horizontal overflow of the pill or the document at any width
 *
 * Screenshot: successful_test/01_topbar_only_pill_fixed.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const PILL_SHOT = path.join(SHOT_DIR, '01_topbar_only_pill_fixed.png');

/** Collect visible topbar items + group gaps from the live DOM. */
function readTopbar() {
  const pill = document.querySelector('[data-testid="navbar-pill"]');
  const brand = document.querySelector('[data-testid="navbar-brand"]');
  const groups = pill.querySelectorAll(':scope > div');
  const center = groups[0];
  const util = groups[groups.length - 1];

  const visible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), right: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height) };
  };

  const items = [];
  if (visible(brand)) items.push({ kind: 'brand', ...rect(brand) });
  if (visible(center)) {
    [...center.querySelectorAll('a')].filter(visible).forEach((a) => {
      items.push({ kind: 'nav', label: a.textContent.trim(), ...rect(a) });
    });
  }
  if (visible(util)) {
    [...util.children].filter(visible).forEach((c) => {
      items.push({ kind: c.tagName.toLowerCase(), ...rect(c) });
    });
  }
  items.sort((a, b) => a.x - b.x);

  const br = visible(brand) ? brand.getBoundingClientRect() : null;
  const cr = visible(center) ? center.getBoundingClientRect() : null;
  const ur = visible(util) ? util.getBoundingClientRect() : null;
  const pr = pill.getBoundingClientRect();

  return {
    pill: { x: Math.round(pr.x), right: Math.round(pr.right), w: Math.round(pr.width), h: Math.round(pr.height) },
    pillOverflowX: pill.scrollWidth - pill.clientWidth,
    navVisible: visible(center),
    gapBrandCenter: cr && br ? Math.round(cr.x - br.right) : null,
    gapCenterUtil: cr && ur ? Math.round(ur.x - cr.right) : null,
    gapBrandUtil: ur && br ? Math.round(ur.x - br.right) : null,
    items
  };
}

/** Pairwise overlap among same-row items, with 1px rounding tolerance. */
function findOverlaps(items) {
  const overlaps = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      const horizontal = a.right > b.x + 1 && b.right > a.x + 1;
      if (horizontal) overlaps.push([a.label || a.kind, b.label || b.kind]);
    }
  }
  return overlaps;
}

test.describe('Pill navbar spacing — no squeezed/overlapping controls', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
  });

  test('pill is wide, items separated and never overlap', async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('[console.error]', msg.text());
    });

    for (const route of ['/', '/catalog']) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});

      const header = page.getByTestId('site-header');
      const pill = page.getByTestId('navbar-pill');
      await expect(header).toBeVisible();
      await expect(pill).toBeVisible();

      // ── Shape + widened container + spacing classes.
      await expect(pill).toHaveClass(/rounded-full/);
      await expect(pill).toHaveClass(/max-w-7xl/);
      await expect(pill).toHaveClass(/gap-4/);
      await expect(pill).toHaveClass(/backdrop-blur-md/);
      await expect(pill).toHaveClass(/bg-white\/90/);
      await expect(pill).toHaveClass(/shadow-sm|shadow-soft-lg/);

      const radius = await pill.evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius));
      expect(radius).toBeGreaterThanOrEqual(999);

      // ── Full-width wrapper(s) behind the pill must be strictly clean:
      //    transparent, no background image, NO backdrop filter.
      await expect(header).toHaveClass(/bg-transparent/);
      await expect(header).toHaveClass(/shadow-none/);
      await expect(header).toHaveClass(/border-none/);
      const headerPaint = await header.evaluate((el) => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          bg: cs.backgroundColor,
          img: cs.backgroundImage,
          backdrop: cs.backdropFilter || cs.webkitBackdropFilter || 'none',
          w: Math.round(r.width),
          vw: window.innerWidth
        };
      });
      expect(headerPaint.bg).toBe('rgba(0, 0, 0, 0)');
      expect(headerPaint.img).toBe('none');
      expect(headerPaint.backdrop).toBe('none');
      expect(headerPaint.w).toBeGreaterThanOrEqual(headerPaint.vw - 1); // spans full width
      const navPaint = await page.getByTestId('site-navbar').evaluate((el) => {
        const cs = getComputedStyle(el);
        return { bg: cs.backgroundColor, img: cs.backgroundImage, backdrop: cs.backdropFilter || 'none' };
      });
      expect(navPaint.bg).toBe('rgba(0, 0, 0, 0)');
      expect(navPaint.img).toBe('none');
      expect(navPaint.backdrop).toBe('none');

      // The glass effect must live ONLY on the inner pill.
      const pillBlur = await pill.evaluate((el) => getComputedStyle(el).backdropFilter || getComputedStyle(el).webkitBackdropFilter);
      expect(pillBlur).toContain('blur');

      // No full-width opaque near-white block may sit in the top band.
      const strips = await page.evaluate(() => {
        const vw = window.innerWidth;
        const bad = [];
        for (const el of document.querySelectorAll('*')) {
          const r = el.getBoundingClientRect();
          if (r.width < vw * 0.9 || r.height < 4 || r.bottom < 0 || r.top > 90) continue;
          const cs = getComputedStyle(el);
          const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/);
          if (!m) continue;
          const p = m[1].split(',').map((s) => parseFloat(s));
          const a = p.length > 3 ? p[3] : 1;
          const nearWhite = p[0] >= 248 && p[1] >= 248 && p[2] >= 248;
          if (a > 0.85 && nearWhite) bad.push({ tag: el.tagName, cls: String(el.className).slice(0, 60), bg: cs.backgroundColor });
        }
        return bad;
      });
      expect(strips).toEqual([]);

      // The page body itself carries the pastel gradient, not a solid white.
      const bodyPaint = await page.evaluate(() => {
        const cs = getComputedStyle(document.body);
        return { bg: cs.backgroundColor, img: cs.backgroundImage };
      });
      expect(bodyPaint.img).toContain('linear-gradient');
      console.log(
        `[WRAPPER] ${route} header=${headerPaint.bg}/${headerPaint.img} backdrop=${headerPaint.backdrop} navBackdrop=${navPaint.backdrop} pillBlur=${pillBlur} whiteStrips=${strips.length}`
      );

      const topbar = await page.evaluate(readTopbar);
      console.log(`[TOPBAR] ${route}`, JSON.stringify(topbar));

      // ── Floating shape preserved.
      expect(topbar.pill.w).toBeGreaterThanOrEqual(1150);
      expect(topbar.pill.h).toBeGreaterThan(40);

      // ── No clipped/overflowing content inside the pill.
      expect(topbar.pillOverflowX).toBeLessThanOrEqual(0);

      // ── Nav links visible on desktop and separated from brand/utilities.
      expect(topbar.navVisible).toBe(true);
      expect(topbar.gapBrandCenter).toBeGreaterThanOrEqual(8);
      expect(topbar.gapCenterUtil).toBeGreaterThanOrEqual(8);

      // ── No elements overlap within the topbar.
      const overlaps = findOverlaps(topbar.items);
      expect(overlaps).toEqual([]);

      // ── Every item sits inside the pill bounds (no spill/clipping).
      for (const it of topbar.items) {
        expect(it.x).toBeGreaterThanOrEqual(topbar.pill.x - 1);
        expect(it.right).toBeLessThanOrEqual(topbar.pill.right + 1);
      }

      // ── Labels render on a single line (not squeezed/wrapped).
      const navItems = topbar.items.filter((i) => i.kind === 'nav');
      expect(navItems.length).toBeGreaterThanOrEqual(4);
      for (const it of navItems) {
        expect(it.h).toBeLessThanOrEqual(44);
        expect(it.w).toBeGreaterThan(40);
      }

      // ── No horizontal document overflow.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(0);
      console.log(
        `[SPACING] ${route} → pill w=${topbar.pill.w} gapBC=${topbar.gapBrandCenter} gapCU=${topbar.gapCenterUtil} overlaps=${overlaps.length}`
      );
    }

    // ── Screenshot at the required path.
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.getByTestId('navbar-pill')).toBeVisible();
    await page.screenshot({ path: PILL_SHOT, fullPage: false });
    expect(fs.existsSync(PILL_SHOT)).toBe(true);
    console.log(`[SHOT] saved ${PILL_SHOT}`);

    // ── Responsive spot-checks: no overlap / overflow at other widths.
    for (const width of [1280, 1180, 1024, 820]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(250);
      const tb = await page.evaluate(readTopbar);
      const ov = findOverlaps(tb.items);
      const docOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(tb.pillOverflowX).toBeLessThanOrEqual(0);
      expect(docOverflow).toBeLessThanOrEqual(0);
      expect(ov).toEqual([]);
      console.log(
        `[RESPONSIVE] w=${width} navVisible=${tb.navVisible} pillW=${tb.pill.w} overlaps=${ov.length}`
      );
    }

    // ── Dark theme pass.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      try { window.localStorage.setItem('tcg-theme', 'dark'); } catch (e) { /* ignore */ }
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.locator('html')).toHaveClass(/dark/);
    const darkTb = await page.evaluate(readTopbar);
    expect(darkTb.pillOverflowX).toBeLessThanOrEqual(0);
    expect(findOverlaps(darkTb.items)).toEqual([]);
    console.log('[THEME] dark → no overlap, no overflow');
  });
});
