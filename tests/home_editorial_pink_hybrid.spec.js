// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Homepage — hybrid editorial layout (soft pastel pink theme).
 *
 * Locks the 6-section storefront structure and, critically, the FREE Virtual
 * Box business rule: the "Mở Hộp Áo Miễn Phí" module must keep its free copy
 * and its CTA must link to the existing free open flow with ZERO paid amounts,
 * prices or currency symbols.
 *
 * Screenshot: successful_test/35_homepage_editorial_pink_hybrid.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const SHOT = path.join(SHOT_DIR, '35_homepage_editorial_pink_hybrid.png');

const CURRENCY_SYMBOL = /[₫$€¥]/;
const MONEY_KEYWORD = /\b(VND|USD|EUR|VNĐ)\b/i;
const MONEY_AMOUNT = /\b\d{1,3}(?:[.,]\d{3})+\b/;

test.describe('Homepage editorial pink hybrid layout', () => {
  test.use({ viewport: { width: 1366, height: 900 } });

  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
  });

  test('hero → footer render with pink theme and a strictly free Virtual Box', async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('[console.error]', msg.text());
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(600);

    // ── 1. EDITORIAL HERO ─────────────────────────────────────────────
    const hero = page.getByTestId('home-hero');
    await expect(hero).toBeVisible();
    const h1 = hero.locator('h1');
    await expect(h1).toContainText('Khám phá');
    await expect(h1).toContainText('Thẻ Pokémon Hiếm');
    await expect(h1).toContainText('Bạn Không Nên Bỏ Lỡ');
    await expect(h1.locator('.editorial-serif')).toHaveCount(1);
    // Interactive 3D card fan with rose backglow
    await expect(page.getByRole('group', { name: 'Featured card fan showcase' })).toBeVisible();

    // Brand mission callout + pink CTA
    const mission = page.getByTestId('home-mission-card');
    await expect(mission).toBeVisible();
    await expect(mission).toContainText('đam mê Pokémon thành điều có thật');
    await expect(mission.getByRole('link')).toContainText('Mua ngay');

    // Energy elements bar — 7 element tags with pink hover styling
    const energyBar = page.getByTestId('energy-elements-bar');
    await expect(energyBar).toBeVisible();
    for (const label of ['Đấu sĩ', 'Lửa', 'Sét', 'Thường', 'Băng', 'Siêu', 'Độc']) {
      await expect(energyBar.getByText(label, { exact: true })).toBeVisible();
    }
    expect(await energyBar.getAttribute('class')).toContain('border-pink-100/70');

    // ── 2. TRUST FEATURE CARDS (4) ────────────────────────────────────
    const trustCards = page.getByTestId('trust-feature-card');
    await expect(trustCards).toHaveCount(4);
    for (const title of ['Cam kết chính hãng', 'Giao hàng nhanh', 'Thanh toán an toàn', 'Định giá chuẩn xác']) {
      await expect(page.getByTestId('home-trust').getByText(title, { exact: true })).toBeVisible();
    }
    const trustCls = await trustCards.first().getAttribute('class');
    expect(trustCls).toContain('rounded-2xl');
    expect(trustCls).toContain('bg-white/5');
    expect(trustCls).toContain('dark:bg-neutral-900/60');
    expect(trustCls).toContain('border-pink-100/10');

    // ── 3. FEATURED PRODUCTS — 4-COLUMN GRID ──────────────────────────
    await expect(page.getByRole('heading', { name: 'Sản phẩm nổi bật' })).toBeVisible();
    const featuredGrid = page.getByTestId('featured-grid');
    await expect(featuredGrid).toBeVisible();
    expect(await featuredGrid.getAttribute('class')).toContain('gap-6');
    expect(await featuredGrid.getAttribute('class')).toMatch(/grid-cols-/);

    const showcaseCards = page.getByTestId('showcase-product-card');
    const cardCount = await showcaseCards.count();
    console.log(`[FEATURED] showcase cards rendered = ${cardCount}`);
    expect(cardCount).toBeGreaterThan(0);
    // Accurate prices in pink, plus quick-add + view controls.
    const priceEl = showcaseCards.first().locator('span.text-pink-500');
    await expect(priceEl).toBeVisible();
    expect(await priceEl.getAttribute('class')).toContain('dark:text-pink-400');
    expect(await priceEl.getAttribute('class')).toContain('font-semibold');
    await expect(showcaseCards.first().getByRole('button', { name: /Thêm vào giỏ/i })).toBeVisible();
    await expect(showcaseCards.first().getByRole('link', { name: /Xem/i })).toBeVisible();

    // ── 4. FREE VIRTUAL BOX ("MỞ HỘP ÁO MIỄN PHÍ") ────────────────────
    const box = page.getByTestId('home-virtual-box');
    await expect(box).toBeVisible();
    await expect(box.getByRole('heading', { name: 'Mở Hộp Áo Miễn Phí' })).toBeVisible();
    await expect(box).toContainText('Hộp Áo Trải Nghiệm');
    await expect(box).toContainText('Khám phá bộ sưu tập thẻ ảo, trải nghiệm mở hộp chân thực và kiểm tra tỷ lệ rơi thẻ minh bạch 100%.');

    const freeCta = page.getByTestId('virtual-box-free-cta');
    await expect(freeCta).toBeVisible();
    await expect(freeCta).toContainText('Mở Hộp Miễn Phí');
    // Direct link to the existing free open flow.
    expect(await freeCta.getAttribute('href')).toBe('/virtual-boxes');

    // Zero paid amounts / currency symbols anywhere in this section.
    const boxText = await box.innerText();
    expect(boxText, 'no currency symbols in the free Virtual Box section').not.toMatch(CURRENCY_SYMBOL);
    expect(boxText, 'no VND/USD keywords in the free Virtual Box section').not.toMatch(MONEY_KEYWORD);
    expect(boxText, 'no formatted prices in the free Virtual Box section').not.toMatch(MONEY_AMOUNT);
    console.log('[VIRTUAL BOX] free section verified with 0 currency symbols');

    // ── 6. THEME STRICT CONSTRAINT — no orange / gold / yellow accents ──
    const forbidden = await page.evaluate(() => {
      const main = document.querySelector('main');
      const html = main ? main.innerHTML : '';
      const hits = [];
      for (const token of ['amber-', 'orange-', 'yellow-']) {
        if (html.includes(token)) hits.push(token);
      }
      return hits;
    });
    expect(forbidden, 'no amber/orange/yellow utility classes on the homepage').toEqual([]);

    // ── Smooth render check: every section from Hero to Footer ────────
    for (const id of ['home-hero', 'home-trust', 'home-categories', 'home-featured', 'home-virtual-box']) {
      const section = page.getByTestId(id);
      await section.scrollIntoViewIfNeeded();
      await expect(section).toBeVisible();
    }
    const footer = page.getByTestId('site-footer');
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeVisible();
    await expect(page.getByTestId('footer-support-email')).toBeVisible();

    // ── Visual proof — full-page screenshot ───────────────────────────
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({ path: SHOT, fullPage: true });
    expect(fs.existsSync(SHOT)).toBe(true);
    const bytes = fs.statSync(SHOT).size;
    expect(bytes).toBeGreaterThan(10000);
    console.log(`[SHOT] saved ${SHOT} (${bytes} bytes)`);
  });
});
