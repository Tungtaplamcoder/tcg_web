// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Catalog Settings — product-count column contract.
 *
 * The "SỐ SẢN PHẨM" column is present on Expansion Sets and Sealed Products,
 * and intentionally ABSENT from Series / Era and Rarities. Where present, every
 * count renders the SAME soft pastel Editorial pill (`bg-pink-100/80 …
 * border-pink-200/50`) formatted "[N] sản phẩm" — never a raw unstyled number
 * and never a per-tab colour variant.
 *
 * Screenshot (strict):
 *  - successful_test/30_catalog_unified_badges_all_tabs.png
 *    A single stitched image showing all four tabs stacked, proving the
 *    count column is absent only on Series/Expansions and shared pastel
 *    badge parity everywhere it appears.
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
// Mirror into the workspace-root successful_test/ (the literal task path).
const SHOT_ROOT = path.join(__dirname, '..', '..', 'successful_test');
const SHOT_PATH = path.join(SHOT_DIR, '30_catalog_unified_badges_all_tabs.png');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tcg.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminSecurePass123!';

// The pink Editorial badge signature every tab must share.
const BADGE_CLASSES = [
  'bg-pink-100/80',
  'text-pink-700',
  'dark:bg-pink-950/60',
  'dark:text-pink-300',
  'border-pink-200/50',
  'dark:border-pink-900/40'
];

const TABS = [
  { key: 'series', label: 'Series / Era', testId: 'option-product-count', hasCount: false },
  { key: 'expansions', label: 'Expansion Sets', testId: 'option-product-count', hasCount: true },
  { key: 'rarity', label: 'Quản lý Độ hiếm (Rarity)', testId: 'rarity-product-count', hasCount: false },
  { key: 'sealed', label: 'Sealed Products', testId: 'sealed-product-count', hasCount: true }
];

async function loginAsAdmin(page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.locator('input[type="text"]').first().fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 }),
    page.getByRole('button', { name: /đăng nhập|login|logging/i }).first().click()
  ]);
  await page.waitForLoadState('networkidle').catch(() => {});
}

async function stitchScreenshots(page, shots) {
  const html = `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:ui-sans-serif,system-ui,sans-serif">
    ${shots
      .map(
        (s) => `<div style="padding:10px 16px 4px">
          <div style="font-weight:700;font-size:14px;color:#0f172a;padding:6px 0">${s.label}</div>
          <img src="${s.dataUrl}" style="display:block;width:1366px;border:1px solid #e2e8f0;border-radius:6px"/>
        </div>`
      )
      .join('')}
  </body></html>`;

  const composer = await page.context().newPage();
  await composer.setViewportSize({ width: 1400, height: 900 });
  await composer.setContent(html, { waitUntil: 'load' });
  // Ensure every embedded PNG has decoded before grabbing the composite.
  await composer.waitForFunction(() =>
    Array.from(document.images).every((img) => img.complete && img.naturalWidth > 0)
  );
  await composer.screenshot({ path: SHOT_PATH, fullPage: true });
  await composer.close();
}

test.describe('Admin — unified catalog product-count badges', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    fs.mkdirSync(SHOT_ROOT, { recursive: true });
  });

  test('count column is gone from Series/Rarities and shared pastel badge remains on Expansion/Sealed', async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('[console.error]', msg.text());
    });

    // ── 1. Admin login → Catalog Settings ────────────────────────────────
    await loginAsAdmin(page);
    await page.goto('/admin/catalog-settings', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page.getByRole('heading', { name: /cấu hình danh mục/i })).toBeVisible();

    const shots = [];

    // ── 2. Click through every tab and enforce the per-tab contract ──────
    for (const tab of TABS) {
      const tabButton = page.getByTestId(`tab-${tab.key}`);
      await expect(tabButton, `tab ${tab.label} must exist`).toBeVisible();
      await tabButton.click();
      await expect(tabButton).toHaveClass(/border-primary-600/);

      // Single visible table for the active tab.
      const table = page.locator('table:visible').first();
      await expect(table, `${tab.label}: table must render`).toBeVisible({ timeout: 15_000 });

      if (!tab.hasCount) {
        // Series / Expansions: the "SỐ SẢN PHẨM" column is strictly ABSENT.
        await expect(
          table.getByRole('columnheader', { name: /^số sản phẩm$/i }),
          `${tab.label}: SỐ SẢN PHẨM header must be gone`
        ).toHaveCount(0);
        await expect(
          page.getByTestId(tab.testId),
          `${tab.label}: no product-count badge`
        ).toHaveCount(0);

        const buffer = await table.screenshot({ type: 'png' });
        shots.push({
          label: `${tab.label} — SỐ SẢN PHẨM column removed`,
          dataUrl: `data:image/png;base64,${buffer.toString('base64')}`
        });
        console.log(`[TAB ${tab.label}] count column absent`);
        continue;
      }

      // (a) Header text is exactly "SỐ SẢN PHẨM" on count-bearing tabs.
      const header = table.getByRole('columnheader', { name: /^số sản phẩm$/i });
      await expect(header, `${tab.label}: SỐ SẢN PHẨM header`).toHaveCount(1);

      // (b) Product counts are formatted "[N] sản phẩm" pastel pills.
      const badges = page.getByTestId(tab.testId);
      await expect(badges.first(), `${tab.label}: at least one badge`).toBeVisible();
      const badgeCount = await badges.count();
      expect(badgeCount, `${tab.label}: badge rows`).toBeGreaterThan(0);

      const texts = await badges.allTextContents();
      for (const text of texts) {
        expect(text.trim(), `${tab.label}: badge "${text}"`).toMatch(/^\d+ sản phẩm$/);
      }

      // (c) Every badge uses the identical soft-pink Editorial signature.
      const classNames = await badges.evaluateAll((els) => els.map((el) => el.className));
      for (const cls of classNames) {
        expect(cls, `${tab.label}: badge must be rounded-full`).toContain('rounded-full');
        for (const required of BADGE_CLASSES) {
          expect(cls, `${tab.label}: badge missing "${required}"`).toContain(required);
        }
      }

      // Capture this tab's table for the stitched proof image.
      const buffer = await table.screenshot({ type: 'png' });
      shots.push({
        label: `${tab.label} — header "SỐ SẢN PHẨM" · ${badgeCount} badge(s) · sample "${texts[0]?.trim()}"`,
        dataUrl: `data:image/png;base64,${buffer.toString('base64')}`
      });

      console.log(`[TAB ${tab.label}] header OK · ${badgeCount} unified badges · sample "${texts[0]?.trim()}"`);
    }

    // ── 3. Stitched verification screenshot (all four tabs) ──────────────
    await stitchScreenshots(page, shots);

    fs.copyFileSync(SHOT_PATH, path.join(SHOT_ROOT, path.basename(SHOT_PATH)));
    expect(fs.existsSync(SHOT_PATH)).toBe(true);
    expect(fs.existsSync(path.join(SHOT_ROOT, path.basename(SHOT_PATH)))).toBe(true);
    console.log(`[SHOT] saved ${SHOT_PATH}`);
  });
});
