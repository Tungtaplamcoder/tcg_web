// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

/**
 * Topbar background continuity + pill elevation verification.
 *
 * Regression guard for the "flat white rectangular block" behind the header:
 * the outer header must be fully transparent and no solid page wrapper may
 * paint an opaque band over the top viewport — the soft pastel canvas gradient
 * + mesh must flow seamlessly to the top edge. The floating pill must carry
 * its own semi-transparent blurred surface with a soft shadow so it reads as
 * elevated above the continuous background.
 *
 * Screenshot: successful_test/01_topbar_seamless_fixed.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const SHOT = path.join(SHOT_DIR, '01_topbar_seamless_fixed.png');

/* ── Minimal PNG (8-bit RGB/RGBA, non-interlaced) decoder ─────────────── */
function decodePng(buf) {
  let off = 8;
  const chunks = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    chunks.push({ type, data: buf.subarray(off + 8, off + 8 + len) });
    off += 12 + len;
  }
  const ihdr = chunks.find((c) => c.type === 'IHDR').data;
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const channels = ihdr[9] === 6 ? 4 : 3;
  const idat = Buffer.concat(chunks.filter((c) => c.type === 'IDAT').map((c) => c.data));
  const raw = zlib.inflateSync(idat);
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  let p = 0;
  for (let y = 0; y < height; y++) {
    const f = raw[p++];
    const line = raw.subarray(p, p + stride);
    p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      if (f === 1) v = (v + a) & 0xff;
      else if (f === 2) v = (v + b) & 0xff;
      else if (f === 3) v = (v + ((a + b) >> 1)) & 0xff;
      else if (f === 4) {
        const q = a + b - c;
        const pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        v = (v + pr) & 0xff;
      }
      cur[x] = v;
    }
  }
  return {
    width,
    height,
    px: (x, y) => {
      const i = y * stride + x * channels;
      return [out[i], out[i + 1], out[i + 2]];
    }
  };
}

test.describe('Topbar seamless background + pill elevation', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
  });

  test('no solid block behind the header; pill floats with blur + shadow', async ({ page }) => {
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

      // ── 1. Outer header wrapper is completely transparent.
      await expect(header).toHaveClass(/bg-transparent/);
      const headerPaint = await header.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { bg: cs.backgroundColor, img: cs.backgroundImage };
      });
      expect(headerPaint.bg).toBe('rgba(0, 0, 0, 0)');
      expect(headerPaint.img).toBe('none');
      console.log(`[HEADER] ${route} transparent (bg=${headerPaint.bg}, img=${headerPaint.img})`);

      // ── 2. No solid background block over the top viewport.
      const samples = await page.evaluate(() => {
        const firstPainterAt = (x, y) => {
          let el = document.elementFromPoint(x, y);
          while (el) {
            const cs = getComputedStyle(el);
            const hasImg = cs.backgroundImage && cs.backgroundImage !== 'none';
            const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/);
            let alpha = 1;
            if (m) {
              const parts = m[1].split(',').map((s) => parseFloat(s));
              if (parts.length > 3) alpha = parts[3];
            }
            if (hasImg) return { type: 'image', tag: el.tagName, cls: String(el.className).slice(0, 80) };
            if (alpha > 0.9) return { type: 'solid', color: cs.backgroundColor, tag: el.tagName, cls: String(el.className).slice(0, 80) };
            el = el.parentElement;
          }
          return { type: 'none' };
        };
        const w = window.innerWidth;
        const pts = [
          [Math.round(w * 0.05), 6], [Math.round(w * 0.5), 6], [Math.round(w * 0.95), 6],
          [Math.round(w * 0.05), 72], [Math.round(w * 0.95), 72]
        ];
        return pts.map(([x, y]) => ({ x, y, painter: firstPainterAt(x, y) }));
      });
      const solid = samples.filter((s) => s.painter.type === 'solid');
      expect(solid).toEqual([]);
      // The visible background must be painted by a gradient/mesh image.
      for (const s of samples) expect(s.painter.type).toBe('image');
      console.log(`[BLOCK] ${route} → ${samples.length} top-viewport probes, 0 solid blocks`);

      // ── 3. Pill: semi-transparent + blur + elevation + pink hairline.
      await expect(pill).toHaveClass(/bg-white\/90/);
      await expect(pill).toHaveClass(/backdrop-blur-md/);
      await expect(pill).toHaveClass(/border-pink-100\/60/);
      await expect(pill).toHaveClass(/shadow-sm|shadow-soft-lg/);
      const pillPaint = await pill.evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          bg: cs.backgroundColor,
          backdrop: cs.backdropFilter || cs.webkitBackdropFilter,
          shadow: cs.boxShadow,
          border: cs.borderTopColor
        };
      });
      expect(pillPaint.bg).toContain('0.9');
      expect(pillPaint.backdrop).toContain('blur');
      expect(pillPaint.shadow).not.toBe('none');
      expect(pillPaint.border).not.toBe('rgba(0, 0, 0, 0)');
      console.log(
        `[PILL] ${route} bg=${pillPaint.bg} backdrop=${pillPaint.backdrop} shadow=${pillPaint.shadow.slice(0, 32)}…`
      );

      // ── 4. No overflow.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(0);
    }

    // ── 5. Pixel proof: the top gutter is pastel (not white) and continuous
    //        across the header/content boundary (no hard seam).
    const strip = decodePng(
      await page.screenshot({ clip: { x: 8, y: 0, width: 14, height: 220 } })
    );
    const xMid = Math.floor(strip.width / 2);
    const topColor = strip.px(xMid, 2);
    const [r, g, b] = topColor;
    // #FFF0F5 → (255,240,245). A white block would be (255,255,255).
    expect(g).toBeLessThan(252);
    expect(r).toBeGreaterThanOrEqual(g);
    let maxStep = 0;
    for (let y = 1; y < strip.height; y++) {
      const a = strip.px(xMid, y - 1);
      const c = strip.px(xMid, y);
      maxStep = Math.max(maxStep, Math.abs(a[0] - c[0]), Math.abs(a[1] - c[1]), Math.abs(a[2] - c[2]));
    }
    console.log(`[PIXEL] top gutter rgb=${topColor.join(',')} maxAdjacentStep=${maxStep}`);
    expect(topColor.join(',')).not.toBe('255,255,255');
    expect(maxStep).toBeLessThan(40); // smooth pastel -> no abrupt block edge

    // ── 6. Save the verified screenshot at the required path.
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.getByTestId('navbar-pill')).toBeVisible();
    await page.screenshot({ path: SHOT, fullPage: false });
    expect(fs.existsSync(SHOT)).toBe(true);
    console.log(`[SHOT] saved ${SHOT}`);

    // ── 7. Dark theme pass.
    await page.addInitScript(() => {
      try { window.localStorage.setItem('tcg-theme', 'dark'); } catch (e) { /* ignore */ }
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.locator('html')).toHaveClass(/dark/);
    const darkHeader = await page.getByTestId('site-header').evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, img: cs.backgroundImage };
    });
    expect(darkHeader.bg).toBe('rgba(0, 0, 0, 0)');
    expect(darkHeader.img).toBe('none');
    console.log('[THEME] dark → header still transparent');
  });
});
