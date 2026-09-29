// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

/**
 * Global background unification.
 *
 * Home, Catalog and Virtual Box pages must NOT override the master pastel
 * canvas with local wrapper backgrounds (violet/white gradients, mesh or
 * white bands). The root layout owns the single source of truth:
 *   bg-gradient-to-b from-[#FFF0F5] via-[#FDFBF7] to-[#FFF0F5]
 *
 * The test walks /, /catalog, /virtual-boxes, /news and asserts the computed
 * body background + the rendered top-viewport pixel palette are identical,
 * and that no full-width wrapper paints an opaque band over the canvas.
 *
 * Screenshots: successful_test/05_home_bg_unified.png,
 *              successful_test/06_virtual_box_bg_unified.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const HOME_SHOT = path.join(SHOT_DIR, '05_home_bg_unified.png');
const VBOX_SHOT = path.join(SHOT_DIR, '06_virtual_box_bg_unified.png');

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

/** Average RGB of a small clip screenshot (top gutter, above the pill). */
async function topGutterRgb(page) {
  const buf = await page.screenshot({ clip: { x: 6, y: 2, width: 8, height: 8 } });
  const img = decodePng(buf);
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const [pr, pg, pb] = img.px(x, y);
      r += pr; g += pg; b += pb; n++;
    }
  }
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

test.describe('Global pastel background unification', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
  });

  test('Home, Catalog, Virtual Box and News share the identical pastel canvas', async ({ page }) => {
    test.setTimeout(120_000);
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('[console.error]', msg.text());
    });

    const routes = ['/', '/catalog', '/virtual-boxes', '/news'];
    const palette = {};

    for (const route of routes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(400);

      // ── Body/root computed background (the master canvas).
      const computed = await page.evaluate(() => {
        const bodyCS = getComputedStyle(document.body);
        const htmlCS = getComputedStyle(document.documentElement);
        const rootEl = document.querySelector('#root > div');
        const rootCS = rootEl ? getComputedStyle(rootEl) : null;
        return {
          bodyBgColor: bodyCS.backgroundColor,
          bodyBgImage: bodyCS.backgroundImage,
          htmlBgColor: htmlCS.backgroundColor,
          rootBgImage: rootCS ? rootCS.backgroundImage : '',
          rootClass: rootEl ? String(rootEl.className) : ''
        };
      });

      // No solid body/html colour — the gradient must be the canvas.
      expect(computed.bodyBgColor).toBe('rgba(0, 0, 0, 0)');
      expect(computed.htmlBgColor).toBe('rgba(0, 0, 0, 0)');
      expect(computed.bodyBgImage).toContain('linear-gradient');
      expect(computed.rootBgImage).toContain('linear-gradient');
      // Master classes required by the brief.
      expect(computed.rootClass).toContain('from-[#FFF0F5]');
      expect(computed.rootClass).toContain('text-neutral-800');
      expect(computed.rootClass).toContain('antialiased');

      // ── No full-width opaque band over the top viewport.
      const strips = await page.evaluate(() => {
        const vw = window.innerWidth;
        const bad = [];
        for (const el of document.querySelectorAll('*')) {
          const r = el.getBoundingClientRect();
          if (r.width < vw * 0.9 || r.height < 4 || r.bottom < 0 || r.top > 95) continue;
          const cs = getComputedStyle(el);
          const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/);
          if (!m) continue;
          const p = m[1].split(',').map((s) => parseFloat(s));
          const a = p.length > 3 ? p[3] : 1;
          if (a > 0.85) bad.push({ tag: el.tagName, cls: String(el.className).slice(0, 70), bg: cs.backgroundColor });
        }
        return bad;
      });
      expect(strips).toEqual([]);

      // ── Rendered top-viewport palette.
      const rgb = await topGutterRgb(page);
      palette[route] = { bodyBgImage: computed.bodyBgImage, rgb };
      console.log(`[BG] ${route} topGutter=${rgb.join(',')} bodyGradient=${computed.bodyBgImage.slice(0, 42)}…`);
    }

    // ── All pages must share the identical palette + body gradient.
    const ref = palette[routes[0]];
    for (const route of routes) {
      expect(palette[route].bodyBgImage).toBe(ref.bodyBgImage);
      expect(palette[route].rgb).toEqual(ref.rgb);
    }
    // The shared top palette is the pastel #FFF0F5, not white.
    expect(ref.rgb[1]).toBeLessThan(252);
    console.log(`[UNIFIED] all ${routes.length} routes share topGutter=${ref.rgb.join(',')}`);

    // ── Screenshots at the required paths.
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: HOME_SHOT, fullPage: false });

    await page.goto('/virtual-boxes', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: VBOX_SHOT, fullPage: false });

    expect(fs.existsSync(HOME_SHOT)).toBe(true);
    expect(fs.existsSync(VBOX_SHOT)).toBe(true);
    console.log(`[SHOT] saved ${HOME_SHOT}`);
    console.log(`[SHOT] saved ${VBOX_SHOT}`);
  });
});
