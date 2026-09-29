// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * 3M (Quarter) price-history chart verification.
 *
 * Regression guard for the 3M tab on the Product Detail page
 * ("Thông tin thị trường"). The backend used to build the date axis from the
 * UNION of every variant's buckets; for `quarter` (3-day buckets reported on
 * slightly different rolling grids per variant) that produced a dense daily
 * axis with mismatched dates. Prices were then forward-filled, so the 3M line
 * rendered as a flat staircase with zero-line drops and jittery bars.
 *
 * The fix drives the chart from the SELECTED item's own buckets (one point per
 * bucket, exactly like the working 6M chart). This spec:
 *   1. opens a product that has a TCGplayer id (654458),
 *   2. clicks the "3M" range tab,
 *   3. asserts the API payload and the rendered Recharts line/bars carry real,
 *      non-zero, non-flat price data,
 *   4. saves successful_test/03_chart_3m_fixed.png.
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const SHOT = path.join(SHOT_DIR, '03_chart_3m_fixed.png');
const TCG_ID = '654458';
const FALLBACK_PRODUCT_ID = '67ef7de8-2dab-42e9-8935-1a3fc9c2f5be';

/** Resolve the product id that owns the target TCGplayer id via the public API. */
async function resolveProductId(request) {
  try {
    const res = await request.get('/api/v1/products?limit=100');
    if (res.ok()) {
      const body = await res.json();
      const items = body?.data?.items || [];
      const hit = items.find((it) => String(it?.tcgplayerId) === TCG_ID);
      if (hit?.id) return hit.id;
    }
  } catch (err) {
    console.log('[resolve] falling back to known id:', err.message);
  }
  return FALLBACK_PRODUCT_ID;
}

/** Count distinct y coordinates in a Recharts line path (x,y pairs). */
function distinctY(pathD) {
  const nums = (pathD.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  const ys = new Set();
  for (let i = 1; i < nums.length; i += 2) ys.add(nums[i]);
  return ys.size;
}

test.describe('3M (Quarter) market price chart', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
  });

  test('3M tab renders the price line with real, non-flat data', async ({ page, request }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('[console.error]', msg.text());
    });

    const productId = await resolveProductId(request);
    console.log(`[product] ${productId} (tcgplayerId=${TCG_ID})`);

    // ── 1. Open the product detail page (defaults to the 6M tab). ──
    await page.goto(`/product/${productId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.locator('.recharts-responsive-container svg').first()).toBeVisible();

    // ── 2. Click "3M" and capture the quarter API response. ──
    const threeMonthTab = page.getByRole('button', { name: '3M', exact: true });
    await expect(threeMonthTab).toBeVisible();

    const [apiRes] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/tcgplayer/price-history/') && r.url().includes('range=quarter'),
        { timeout: 30_000 }
      ),
      threeMonthTab.click()
    ]);
    expect(apiRes.status()).toBe(200);

    const body = await apiRes.json();
    const chartData = body?.data?.chart_data;
    expect(Array.isArray(chartData)).toBe(true);
    expect(body?.data?.actual_range).toBe('quarter');

    // ── 3. Payload contract: dense, chronological, never zero/null. ──
    expect(chartData.length).toBeGreaterThanOrEqual(20);
    const dates = chartData.map((d) => d.date);
    const times = dates.map((d) => new Date(d).getTime());
    expect(times.every((t) => !Number.isNaN(t))).toBe(true);
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1]);

    const uniqueDates = new Set(dates);
    expect(uniqueDates.size).toBe(chartData.length); // no synthetic duplicate grid
    const badPrices = chartData.filter((d) => d.price === null || d.price === undefined || Number(d.price) <= 0);
    expect(badPrices).toEqual([]);
    const zeros = chartData.filter((d) => Number(d.quantitySold) === 0).length;
    console.log(`[payload] points=${chartData.length} uniqueDates=${uniqueDates.size} zeroQtyDays=${zeros}`);

    // ── 4. Rendered chart contract: line + one bar per point. ──
    const line = page.locator('.recharts-line-curve').first();
    await expect(line).toBeVisible({ timeout: 15_000 });
    await page.waitForFunction(
      (expected) => document.querySelectorAll('.recharts-bar-rectangle').length === expected,
      chartData.length,
      { timeout: 15_000 }
    );

    const rendered = await page.evaluate(() => ({
      bars: document.querySelectorAll('.recharts-bar-rectangle').length,
      lineD: document.querySelector('.recharts-line-curve')?.getAttribute('d') || '',
      activeTab: [...document.querySelectorAll('button')]
        .filter((b) => ['1M', '3M', '6M', '1Y'].includes(b.textContent.trim()))
        .find((b) => b.className.includes('from-primary'))?.textContent.trim() || ''
    }));

    expect(rendered.activeTab).toBe('3M');
    expect(rendered.bars).toBe(chartData.length);
    expect(rendered.lineD.length).toBeGreaterThan(50);
    const yValues = distinctY(rendered.lineD);
    expect(yValues).toBeGreaterThan(5); // a real curve, not a flat staircase
    console.log(`[render] bars=${rendered.bars} distinctY=${yValues} linePathLen=${rendered.lineD.length}`);

    // ── 5. Screenshot of the fixed 3M chart. ──
    const chartCard = page.locator('div.rounded-2xl', { has: page.locator('.recharts-responsive-container') }).first();
    await chartCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await chartCard.screenshot({ path: SHOT });
    expect(fs.existsSync(SHOT)).toBe(true);
    console.log(`[SHOT] saved ${SHOT}`);
  });
});
