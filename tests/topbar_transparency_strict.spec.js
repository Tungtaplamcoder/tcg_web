// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

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

/**
 * STRICT topbar outer-container transparency verification.
 *
 * Root cause this guards against: an OUTER full-width wrapper around the
 * floating pill topbar (a <header>, a `sticky` <div>, a Layout/route wrapper
 * rendered by App.jsx, or the Login/Register page shells) carrying a hardcoded
 * background or backdrop-blur. That paints a horizontal artifact across the top
 * of the viewport:
 *   • Dark mode  → solid/opaque dark bar on /, /login, /register
 *   • Light mode → translucent white "cloudy" band on /login, /register
 *
 * This spec recursively resolves the topbar stack for every route in BOTH
 * themes and asserts, via computed styles, that:
 *   1. `window.getComputedStyle(header).backgroundColor` === rgba(0,0,0,0)
 *      (or the literal `transparent`).
 *   2. The header's full ancestor chain, its <nav>, and any outer wrapper
 *      also compute to a transparent background with no backdrop-filter.
 *   3. NO full-width element paints an opaque/solid surface across the top.
 *   4. Glass background/border/blur exists ONLY on the inner
 *      [data-testid="navbar-pill"].
 *
 * If any assertion fails, the failure message names the offending element and
 * class so it can be stripped directly from source.
 *
 * Verified screenshots (full-page):
 *   successful_test/11_darkmode_login_topbar_fixed.png
 *   successful_test/11_lightmode_login_topbar_fixed.png
 *   successful_test/11_darkmode_home_topbar_fixed.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');

// `/virtual-boxes` is the canonical storefront route; `/virtual-box` is included
// because it is explicitly named in the requirement and still renders through
// the shared transparent storefront layout.
const ROUTES = ['/', '/login', '/register', '/catalog', '/virtual-box', '/virtual-boxes'];
const THEMES = ['light', 'dark'];

const SHOTS = {
  'dark:/login': '11_darkmode_login_topbar_fixed.png',
  'light:/login': '11_lightmode_login_topbar_fixed.png',
  'dark:/': '11_darkmode_home_topbar_fixed.png'
};

const TRANSPARENT = ['rgba(0, 0, 0, 0)', 'transparent'];

const FORBIDDEN_CLASS =
  /(^|\s)(bg-(white|black|neutral|ink|gray|zinc|slate)(\/[^\s]+)?|dark:bg-(?!transparent\b)[^\s]+|backdrop-blur[^\s]*)(\s|$)/;

test.describe('Strict topbar outer-container transparency (all routes × themes)', () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
  });

  for (const theme of THEMES) {
    test(`${theme} mode — outer wrapper strictly transparent on every route`, async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(String(err)));

      await page.addInitScript((t) => {
        try { window.localStorage.setItem('tcg-theme', t); } catch (e) { /* ignore */ }
      }, theme);

      for (const route of ROUTES) {
        await test.step(`${theme} ${route}`, async () => {
          await page.goto(route, { waitUntil: 'domcontentloaded' });
          await page.waitForLoadState('networkidle').catch(() => {});
          await page.waitForTimeout(300);
          await page.evaluate(() => window.scrollTo(0, 0));

          const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
          expect(isDark, `html.dark @ ${route} (${theme})`).toBe(theme === 'dark');

          // ── Requirement 3: computed backgroundColor of outer <header>.
          const outerHeader = page.locator('header').first();
          await expect(outerHeader).toBeVisible();
          const headerBg = await outerHeader.evaluate((el) => getComputedStyle(el).backgroundColor);
          expect(
            TRANSPARENT.includes(headerBg),
            `outer <header> background @ ${route} (${theme}) was "${headerBg}" — expected rgba(0, 0, 0, 0)`
          ).toBe(true);

          // ── Deep audit: header, its ancestors, nav wrapper, and any element
          //    that wraps the topbar must be transparent and blur-free.
          const audit = await page.evaluate(() => {
            const read = (el) => {
              const cs = getComputedStyle(el);
              const r = el.getBoundingClientRect();
              const shadow = cs.boxShadow;
              let shadowOpaque = false;
              if (shadow && shadow !== 'none') {
                const cols = shadow.match(/rgba?\([^)]*\)/g);
                shadowOpaque = cols
                  ? cols.some((c) => {
                      const p = c.replace(/rgba?\(|\)/g, '').split(',').map((s) => parseFloat(s));
                      return (p.length > 3 ? p[3] : 1) > 0.02;
                    })
                  : !/#0000\b/.test(shadow);
              }
              return {
                tag: el.tagName,
                testid: el.getAttribute('data-testid') || '',
                cls: String(el.className || '').slice(0, 160),
                bg: cs.backgroundColor,
                img: cs.backgroundImage,
                backdrop: cs.backdropFilter || cs.webkitBackdropFilter || 'none',
                shadowOpaque,
                borderTopWidth: cs.borderTopWidth,
                top: Math.round(r.top),
                width: Math.round(r.width),
                height: Math.round(r.height)
              };
            };

            const header = document.querySelector('[data-testid="site-header"]');
            const nav = document.querySelector('[data-testid="site-navbar"]');
            const pill = document.querySelector('[data-testid="navbar-pill"]');

            const chain = [];
            let n = header;
            while (n && n.tagName !== 'HTML') {
              chain.push(read(n));
              n = n.parentElement;
            }

            // Full-width opaque top-band scan (top 160px, full-bleed, short).
            const vw = window.innerWidth;
            const bands = [];
            for (const el of Array.from(document.querySelectorAll('body *'))) {
              const r = el.getBoundingClientRect();
              if (r.width < vw * 0.9) continue;
              if (r.top > 8 || r.bottom <= 0) continue;
              if (r.height > 220) continue; // page canvas is not a band
              const cs = getComputedStyle(el);
              const m = cs.backgroundColor && cs.backgroundColor.match(/rgba?\(([^)]+)\)/);
              const a = m ? (m[1].split(',').length > 3 ? parseFloat(m[1].split(',')[3]) : 1) : 0;
              const solidImage = cs.backgroundImage !== 'none' && !cs.backgroundImage.includes('gradient');
              if (a > 0.05 || solidImage) {
                bands.push({
                  tag: el.tagName,
                  testid: el.getAttribute('data-testid') || '',
                  cls: String(el.className).slice(0, 140),
                  bg: cs.backgroundColor,
                  img: cs.backgroundImage.slice(0, 60)
                });
              }
            }

            return {
              header: read(header),
              nav: read(nav),
              pill: read(pill),
              chain: chain.slice(1).map((c) => ({ tag: c.tag, id: c.testid, cls: c.cls, bg: c.bg, backdrop: c.backdrop, img: c.img })),
              bands
            };
          });

          // Header + nav must be transparent, blur-free, border/shadow-free.
          for (const [name, el] of [['header', audit.header], ['nav', audit.nav]]) {
            expect(
              TRANSPARENT.includes(el.bg),
              `${name} bg @ ${route} (${theme}) = "${el.bg}" (class="${el.cls}")`
            ).toBe(true);
            expect(el.img, `${name} background-image @ ${route} (${theme}) = "${el.img}"`).toBe('none');
            expect(el.backdrop, `${name} backdrop-filter @ ${route} (${theme}) = "${el.backdrop}"`).toBe('none');
            expect(el.shadowOpaque, `${name} opaque box-shadow @ ${route} (${theme})`).toBe(false);
            expect(el.borderTopWidth, `${name} border @ ${route} (${theme})`).toBe('0px');
            expect(
              el.cls,
              `${name} carries forbidden bg/blur utility @ ${route} (${theme}): "${el.cls}"`
            ).not.toMatch(FORBIDDEN_CLASS);
          }

          // Ancestor wrappers (App root, route/Layout wrapper, Login/Register shell).
          for (const anc of audit.chain) {
            const isPageCanvas =
              anc.cls.includes('min-h-screen') || anc.tag === 'BODY' || anc.tag === 'DIV' && anc.id === 'root';
            // The body / App root legitimately carry the page gradient; they
            // must still have a transparent *background-color* (no solid band).
            expect(
              TRANSPARENT.includes(anc.bg),
              `ancestor <${anc.tag}> #${anc.id} background-color @ ${route} (${theme}) = "${anc.bg}" (class="${anc.cls}")`
            ).toBe(true);
            if (!isPageCanvas) {
              expect(anc.backdrop, `ancestor <${anc.tag}> backdrop @ ${route} (${theme})`).toBe('none');
            }
          }

          // No full-width opaque horizontal band across the top.
          expect(
            audit.bands,
            `full-width top band @ ${route} (${theme}): ${JSON.stringify(audit.bands)}`
          ).toEqual([]);

          // ── Pixel proof: one continuous background wash to the top edge —
          //    no hard horizontal seam at the in-flow header boundary.
          const headerBottom = await page.evaluate(() =>
            Math.round(document.querySelector('[data-testid="site-header"]').getBoundingClientRect().bottom)
          );
          const vw = page.viewportSize().width;
          const strip = decodePng(await page.screenshot({ clip: { x: 0, y: 0, width: vw, height: 220 } }));
          const gutterCols = [8, 24, vw - 25, vw - 9];
          let maxStep = 0, boundaryStep = 0, boundaryAt = 0;
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
          expect(
            boundaryStep,
            `hard horizontal band edge at header boundary (y≈${headerBottom}) @ ${route} (${theme}): ` +
              `step ${boundaryStep} at y=${boundaryAt}`
          ).toBeLessThanOrEqual(5);
          expect(maxStep, `abrupt band edge in top strip @ ${route} (${theme})`).toBeLessThan(12);

          // Glass confined to the inner pill.
          expect(
            TRANSPARENT.includes(audit.pill.bg),
            `pill bg is transparent @ ${route} (${theme}) — glass must live on the pill`
          ).toBe(false);
          expect(audit.pill.backdrop, `pill blur @ ${route} (${theme})`).toContain('blur');
          expect(audit.pill.width, `pill must be narrower than viewport @ ${route} (${theme})`).toBeLessThan(1366);

          console.log(
            `[STRICT-TOPBAR] ${theme} ${route} header=${audit.header.bg} nav=${audit.nav.bg} ` +
              `ancestors=${audit.chain.length} bands=${audit.bands.length} pill=${audit.pill.bg}`
          );

          // ── Required verification screenshots (full-page).
          const shotName = SHOTS[`${theme}:${route}`];
          if (shotName) {
            const shotPath = path.join(SHOT_DIR, shotName);
            await page.screenshot({ path: shotPath, fullPage: true });
            expect(fs.existsSync(shotPath), `screenshot ${shotName}`).toBe(true);
            console.log(`[SHOT] saved ${shotPath}`);
          }
        });
      }

      expect(pageErrors, `uncaught page errors (${theme})`).toEqual([]);
    });
  }
});
