// @ts-check
const { defineConfig } = require('@playwright/test');

/**
 * Playwright E2E config for the TCG storefront stack.
 *
 * The frontend is the Dockerized production build (nginx :3000) which
 * reverse-proxies /api/v1 to the backend, so tests hit exactly what a
 * user sees. Headed is opt-in per the task requirement — launch with:
 *
 *   xvfb-run npx playwright test --headed
 */
module.exports = defineConfig({
  testDir: './tests',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  outputDir: './test-results/artifacts',
  use: {
    baseURL: 'http://localhost:3000',
    // Headless by default; the CLI --headed flag (under xvfb-run) overrides
    // this for visual/headed verification sessions.
    headless: true,
    viewport: { width: 1366, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    locale: 'vi-VN'
  }
});
