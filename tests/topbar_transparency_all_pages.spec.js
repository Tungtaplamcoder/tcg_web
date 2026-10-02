// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

/**
 * Topbar outer-wrapper transparency — exhaustive cross-route / cross-theme guard.
 *
 * Regression cover for the persistent opaque band behind the floating pill
 * topbar. On Home, Login and Register the outer <header> / route wrapper has
 * historically carried a full-width solid/semi-opaque surface (dark
 * bg-neutral-950 / bg-black in dark mode, bg-white/* + backdrop-blur-* in
 * light mode), producing an ugly horizontal band across the top viewport while
 * Catalog and Virtual Box (transparent wrappers) looked correct.
 *
 * Contract enforced here:
 *   1. The outer [data-testid="site-header"] and its <nav> wrapper are ALWAYS
 *      100% transparent in every theme — background-color rgba(0,0,0,0),
 *      background-image none, backdrop-filter none, no opaque border.
 *   2. NO bg-white/*, bg-black/*, bg-neutral-*, bg-ink-* or backdrop-blur-*
 *      utility exists on the outer header / outer wrapper elements.
 *   3. Glass styling (background + blur + border) exists ONLY on the inner
 *      rounded [data-testid="navbar-pill"].
 *   4. No full-width opaque horizontal color band paints over the top viewport.
 *
 * Verified screenshots:
 *   successful_test/11_darkmode_login_topbar_fixed.png
 *   successful_test/11_lightmode_login_topbar_fixed.png
 *   successful_test/11_darkmode_home_topbar_fixed.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');

const ROUTES = ['/', '/login', '/register', '/catalog', '/virtual-box', '/virtual-boxes'];
const THEMES = ['light', 'dark'];

const SHOTS = {
  'dark:/login': '11_darkmode_login_topbar_fixed.png',
  'light:/login': '11_lightmode_login_topbar_fixed.png',
  'dark:/': '11_darkmode_home_topbar_fixed.png'
};

const FORBIDDEN_CLASS = /(^|\s)(bg-(white|black|neutral|ink|gray|zinc|slate)(\/[^\s]+)?|backdrop-blur[^\s]*)(\s|$)/;

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

async function gotoRoute(page, route) {
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(350);
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function assertTransparentOuterWrapper(page, route, theme) {
  const header = page.getByTestId('site-header');
  const nav = page.getByTestId('site-navbar');
  const pill = page.getByTestId('navbar-pill');

  await expect(header).toBeVisible();
  await expect(nav).toBeVisible();
  await expect(pill).toBeVisible();

  const paint = await page.evaluate(() => {
    const shadowOpaque = (shadow) => {
      if (!shadow || shadow === 'none') return false;
      const cols = shadow.match(/rgba?\([^)]*\)/g);
      if (!cols) return !/#0000\b/.test(shadow); // no rgb() → opaque unless explicit transparent hex
      return cols.some((c) => {
        const p = c.replace(/rgba?\(|\)/g, '').split(',').map((s) => parseFloat(s));
        const a = p.length > 3 ? p[3] : 1;
        return a > 0.02;
      });
    };
    const read = (el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        bg: cs.backgroundColor,
        img: cs.backgroundImage,
        backdrop: cs.backdropFilter || cs.webkitBackdropFilter || 'none',
        shadow: cs.boxShadow,
        shadowOpaque: shadowOpaque(cs.boxShadow),
        borderTopWidth: cs.borderTopWidth,
        className: el.className,
        rect: { top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) }
      };
    };
    return {
      header: read(document.querySelector('[data-testid="site-header"]')),
      nav: read(document.querySelector('[data-testid="site-navbar"]')),
      pill: read(document.querySelector('[data-testid="navbar-pill"]'))
    };
  });

  // 1. Outer header + nav wrapper: fully transparent, no image, no blur.
  for (const [name, el] of [['header', paint.header], ['nav', paint.nav]]) {
    expect(el.bg, `${name} bg @ ${route} (${theme})`).toBe('rgba(0, 0, 0, 0)');
    expect(el.img, `${name} background-image @ ${route} (${theme})`).toBe('none');
    expect(el.backdrop, `${name} backdrop-filter @ ${route} (${theme})`).toBe('none');
    expect(el.shadowOpaque, `${name} opaque box-shadow @ ${route} (${theme})`).toBe(false);
    expect(el.borderTopWidth, `${name} border @ ${route} (${theme})`).toBe('0px');
    expect(el.className, `${name} forbidden bg/blur utility @ ${route} (${theme})`).not.toMatch(FORBIDDEN_CLASS);
  }

  // Header is full-bleed but must not clip / carry any surface.
  const viewportWidth = page.viewportSize().width;
  expect(paint.header.rect.width, `header full-bleed width @ ${route} (${theme})`).toBeGreaterThanOrEqual(
    Math.floor(viewportWidth * 0.98)
  );

  // 2. Glass lives ONLY on the inner pill.
  expect(paint.pill.bg, `pill bg @ ${route} (${theme})`).not.toBe('rgba(0, 0, 0, 0)');
  expect(paint.pill.backdrop, `pill blur @ ${route} (${theme})`).toContain('blur');
  expect(paint.pill.className, `pill keeps glass @ ${route} (${theme})`).toMatch(/backdrop-blur/);

  // 3. No full-width opaque horizontal band over the top viewport.
  const bandOffenders = await page.evaluate(() => {
    const vw = window.innerWidth;
    const isOpaque = (color) => {
      const m = color && color.match(/rgba?\(([^)]+)\)/);
      if (!m) return false;
      const parts = m[1].split(',').map((s) => parseFloat(s));
      const alpha = parts.length > 3 ? parts[3] : 1;
      return alpha > 0.05;
    };
    const out = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const r = el.getBoundingClientRect();
      if (r.width < vw * 0.9) continue;        // must span nearly full width
      if (r.top > 8) continue;                  // must sit at the very top
      if (r.height > 200) continue;             // page canvas is fine; only bands
      const cs = getComputedStyle(el);
      const solidImage = cs.backgroundImage !== 'none' && !cs.backgroundImage.includes('gradient');
      if (isOpaque(cs.backgroundColor) || solidImage) {
        out.push({
          tag: el.tagName,
          cls: String(el.className).slice(0, 100),
          bg: cs.backgroundColor,
          img: cs.backgroundImage.slice(0, 60),
          top: Math.round(r.top),
          height: Math.round(r.height)
        });
      }
    }
    return out;
  });
  expect(bandOffenders, `full-width top band @ ${route} (${theme}): ${JSON.stringify(bandOffenders)}`).toEqual([]);

  // 4. Pixel proof: the page background is ONE continuous wash all the way to
  //    the top edge. There must be no hard horizontal seam where the in-flow
  //    header ends (~headerBottom) and no band anywhere in the top strip.
  //    Sample background-only gutter columns so pill/card content is excluded.
  //    Regression: Login/Register/Home previously clipped their ambient glow
  //    at the header boundary, leaving bare gradient above it (a step of
  //    7–30 RGB units) — a visible dark/cloudy band behind the pill.
  const headerBottom = await page.evaluate(() =>
    Math.round(document.querySelector('[data-testid="site-header"]').getBoundingClientRect().bottom)
  );
  const strip = decodePng(
    await page.screenshot({ clip: { x: 0, y: 0, width: viewportWidth, height: 220 } })
  );
  const gutterCols = [8, 24, viewportWidth - 25, viewportWidth - 9];
  let maxStep = 0;
  let boundaryStep = 0;
  let boundaryAt = 0;
  for (const x of gutterCols) {
    for (let y = 1; y < strip.height; y++) {
      const a = strip.px(x, y - 1);
      const c = strip.px(x, y);
      const s = Math.max(Math.abs(a[0] - c[0]), Math.abs(a[1] - c[1]), Math.abs(a[2] - c[2]));
      if (s > maxStep) maxStep = s;
      if (y >= headerBottom - 5 && y <= headerBottom + 5 && s > boundaryStep) {
        boundaryStep = s;
        boundaryAt = y;
      }
    }
  }
  console.log(
    `[TOPBAR] ${theme} ${route} header=${paint.header.bg} nav=${paint.nav.bg} pill=${paint.pill.bg} ` +
      `headerBottom=${headerBottom} maxAdjacentStep=${maxStep} boundaryStep=${boundaryStep}@${boundaryAt}`
  );
  expect(
    boundaryStep,
    `hard horizontal band edge at header boundary (y≈${headerBottom}) @ ${route} (${theme}): ` +
      `step ${boundaryStep} at y=${boundaryAt}`
  ).toBeLessThanOrEqual(5);
  expect(maxStep, `abrupt band edge in top strip @ ${route} (${theme})`).toBeLessThan(12);
}

for (const theme of THEMES) {
  test.describe(`Topbar outer-wrapper transparency — ${theme} mode`, () => {
    test.use({ viewport: { width: 1366, height: 900 } });

    test.beforeAll(() => {
      fs.mkdirSync(SHOT_DIR, { recursive: true });
    });

    test(`transparent across all routes (${theme})`, async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(String(err)));

      await page.addInitScript((t) => {
        try { window.localStorage.setItem('tcg-theme', t); } catch (e) { /* ignore */ }
      }, theme);

      for (const route of ROUTES) {
        await test.step(`${theme} ${route}`, async () => {
          await gotoRoute(page, route);

          const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
          expect(isDark, `html.dark @ ${route} (${theme})`).toBe(theme === 'dark');

          await assertTransparentOuterWrapper(page, route, theme);

          const shotName = SHOTS[`${theme}:${route}`];
          if (shotName) {
            const shotPath = path.join(SHOT_DIR, shotName);
            await page.screenshot({ path: shotPath, fullPage: false });
            expect(fs.existsSync(shotPath), `screenshot ${shotName}`).toBe(true);
            console.log(`[SHOT] saved ${shotPath}`);
          }
        });
      }

      expect(pageErrors, `uncaught page errors (${theme})`).toEqual([]);
    });
  });
}
