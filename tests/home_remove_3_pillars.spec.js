// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Homepage cleanup — the "3 Trụ Cột Minh Bạch" (3 Transparency Pillars)
 * section is removed entirely to tighten the vertical scroll flow.
 *
 * Verifies, in BOTH light and dark mode:
 *   1. The section is gone from the DOM (heading, container, cards, copy).
 *   2. The page renders without console errors or layout shift.
 *   3. The Virtual Box → Footer transition stays clean and spaced.
 *
 * Screenshots:
 *   successful_test/51_homepage_3_pillars_removed_light.png
 *   successful_test/51_homepage_3_pillars_removed_dark.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const LIGHT_SHOT = path.join(SHOT_DIR, '51_homepage_3_pillars_removed_light.png');
const DARK_SHOT = path.join(SHOT_DIR, '51_homepage_3_pillars_removed_dark.png');

const PILLAR_COPY = [
  '3 Trụ Cột Minh Bạch',
  'Xác Thực Vi Kính Quang Học',
  'Kiểm Soát Nhiệt Bật Khắt Khe',
  'Bảo Hiểm 100% Khai Giá'
];

/* Track Cumulative Layout Shift from first paint. */
const CLS_INIT = () => {
  window.__cls = 0;
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__cls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch (e) { /* unsupported */ }
};

const assertPillarsRemoved = async (page) => {
  await expect(page.getByTestId('home-pillars')).toHaveCount(0);
  await expect(page.getByTestId('trust-pillar-card')).toHaveCount(0);
  for (const copy of PILLAR_COPY) {
    await expect(page.getByText(copy, { exact: true })).toHaveCount(0);
  }
  // Nothing references the removed section in the rendered markup.
  const hits = await page.evaluate((terms) => {
    const html = document.body.innerHTML;
    return terms.filter((term) => html.includes(term));
  }, PILLAR_COPY);
  expect(hits, 'removed pillar copy must not appear in the DOM').toEqual([]);
};

const assertCleanTransition = async (page) => {
  const box = page.getByTestId('virtual-box-card');
  const footer = page.getByTestId('site-footer');
  await box.scrollIntoViewIfNeeded();
  await expect(box).toBeVisible();
  await expect(footer).toBeVisible();

  const boxBox = await box.boundingBox();
  const footerBox = await footer.boundingBox();
  const gap = footerBox.y - (boxBox.y + boxBox.height);
  console.log(`[SPACING] virtual-box-card → footer gap = ${Math.round(gap)}px`);
  expect(gap).toBeGreaterThanOrEqual(0);
  expect(gap).toBeLessThan(220);
};

test.describe('Homepage — 3 Transparency Pillars removed', () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
  });

  test('Light mode — section removed, clean render', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push(String(err)));
    await page.addInitScript(CLS_INIT);
    await page.addInitScript(() => {
      try { localStorage.setItem('tcg-theme', 'light'); } catch (e) { /* no-op */ }
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(600);

    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(false);
    await assertPillarsRemoved(page);
    await assertCleanTransition(page);

    const cls = await page.evaluate(() => window.__cls || 0);
    console.log(`[CLS] light mode cumulative layout shift = ${cls.toFixed(4)}`);
    expect(cls).toBeLessThan(0.2);
    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: LIGHT_SHOT, fullPage: true });
    expect(fs.existsSync(LIGHT_SHOT)).toBe(true);
    console.log(`[SHOT] saved ${LIGHT_SHOT} (${fs.statSync(LIGHT_SHOT).size} bytes)`);
  });

  test('Dark mode — section removed, clean render', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push(String(err)));
    await page.addInitScript(CLS_INIT);
    await page.addInitScript(() => {
      try { localStorage.setItem('tcg-theme', 'dark'); } catch (e) { /* no-op */ }
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(600);

    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true);
    await assertPillarsRemoved(page);
    await assertCleanTransition(page);

    const cls = await page.evaluate(() => window.__cls || 0);
    console.log(`[CLS] dark mode cumulative layout shift = ${cls.toFixed(4)}`);
    expect(cls).toBeLessThan(0.2);
    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: DARK_SHOT, fullPage: true });
    expect(fs.existsSync(DARK_SHOT)).toBe(true);
    console.log(`[SHOT] saved ${DARK_SHOT} (${fs.statSync(DARK_SHOT).size} bytes)`);
  });
});
