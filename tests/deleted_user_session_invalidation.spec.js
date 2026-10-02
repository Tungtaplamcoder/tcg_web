// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Deleted-user session invalidation.
 *
 * Contract:
 *  1. A logged-in user whose account is deleted server-side must be evicted
 *     on the next authenticated request: the backend returns 401
 *     ("Account no longer exists") because the JWT's subject no longer
 *     resolves to a User row.
 *  2. The frontend API interceptor catches the 401 globally, purges every
 *     persisted token / auth artifact (localStorage + sessionStorage) and
 *     resets the auth store to null.
 *  3. The user is redirected to /login and the Topbar reverts to the
 *     unauthenticated "Đăng nhập" state — no stale profile name remains.
 *
 * Screenshot:
 *   successful_test/14_deleted_user_auto_logout_fixed.png
 */

const SHOT_DIR = path.join(__dirname, '..', 'successful_test');
const SHOT = path.join(SHOT_DIR, '14_deleted_user_auto_logout_fixed.png');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tcg.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminSecurePass123!';

const TEST_PREFIX = 'e2e-session-';
const TEST_PASSWORD = 'TestPass123';

/** Admin API login → bearer token for setup/teardown requests. */
async function adminToken(request) {
  const res = await request.post('/api/v1/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });
  expect(res.ok(), 'admin API login').toBeTruthy();
  return (await res.json()).data.accessToken;
}

/** Register a fresh deletable user via the public API. */
async function createUser(request) {
  const stamp = Date.now();
  const email = `${TEST_PREFIX}${stamp}@tcg.local`;
  const phone = '08' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
  const fullName = `E2E Session ${stamp}`;
  const res = await request.post('/api/v1/auth/register', {
    data: {
      email,
      phone,
      fullName,
      password: TEST_PASSWORD,
      confirmPassword: TEST_PASSWORD
    }
  });
  expect(res.ok(), 'register session test user').toBeTruthy();
  return { email, phone, fullName };
}

/** Purge leftover e2e users so phone/email stay unique across runs. */
async function purgeUsers(request, token) {
  const list = await request.get(`/api/v1/admin/users?limit=100&search=${TEST_PREFIX}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!list.ok()) return;
  for (const u of (await list.json()).data.items || []) {
    if (!String(u.email || '').startsWith(TEST_PREFIX)) continue;
    await request.delete(`/api/v1/admin/users/${u.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }
}

/** Delete a user by email through the real admin API. */
async function deleteUserByEmail(request, token, email) {
  const list = await request.get(`/api/v1/admin/users?search=${encodeURIComponent(email)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(list.ok(), 'list users for delete').toBeTruthy();
  const user = ((await list.json()).data.items || []).find((u) => u.email === email);
  expect(user, `test user ${email} present`).toBeTruthy();
  const del = await request.delete(`/api/v1/admin/users/${user.id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(del.ok(), 'delete test user via admin API').toBeTruthy();
}

test.describe('Deleted user — real-time session invalidation', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeAll(async ({ request }) => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    await purgeUsers(request, await adminToken(request));
  });

  test('deleted user is auto-logged-out and stale Topbar name disappears', async ({ page, request }) => {
    const token = await adminToken(request);
    const user = await createUser(request);

    const seen401 = [];
    page.on('response', (res) => {
      if (res.status() === 401) seen401.push(res.url());
    });

    // ── 1. Log in as the test user through the real form ───────────────
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.locator('input[type="text"]').first().fill(user.email);
    await page.locator('input[type="password"]').first().fill(TEST_PASSWORD);
    await Promise.all([
      page.waitForURL((u) => u.pathname === '/', { timeout: 30_000 }),
      page.getByRole('button', { name: /đăng nhập|login|logging/i }).first().click()
    ]);
    await page.waitForLoadState('networkidle').catch(() => {});

    // Authenticated state is visible in the Topbar + localStorage.
    await expect(page.getByTestId('navbar-pill').getByText(user.fullName)).toBeVisible();
    const before = await page.evaluate(() => ({
      token: localStorage.getItem('tcg_access_token'),
      user: localStorage.getItem('tcg_user')
    }));
    expect(before.token, 'access token persisted after login').toBeTruthy();
    expect(before.user, 'user persisted after login').toBeTruthy();
    console.log('[LOGIN] test user authenticated; Topbar shows profile name');

    // ── 2. Delete the account server-side (as admin) ───────────────────
    await deleteUserByEmail(request, token, user.email);
    console.log('[DELETE] test user removed via admin API');

    // ── 3. Reload as the deleted user → bootstrap hits /auth/me → 401 ──
    await page.reload({ waitUntil: 'domcontentloaded' });

    // ── 4. 401 → global purge → redirect /login, no stale name ─────────
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
    await page.waitForLoadState('networkidle').catch(() => {});

    expect(seen401.length, 'a 401 was returned for the deleted account').toBeGreaterThan(0);
    console.log(`[401] observed ${seen401.length} unauthorized response(s): ${seen401.slice(0, 2).join(', ')}`);

    // Stored auth artifacts are gone.
    const after = await page.evaluate(() => ({
      token: localStorage.getItem('tcg_access_token'),
      refresh: localStorage.getItem('tcg_refresh_token'),
      user: localStorage.getItem('tcg_user'),
      session: sessionStorage.length
    }));
    expect(after.token, 'access token purged').toBeNull();
    expect(after.refresh, 'refresh token purged').toBeNull();
    expect(after.user, 'user state purged').toBeNull();
    console.log('[PURGE] localStorage + sessionStorage auth artifacts cleared');

    // Topbar shows the unauthenticated "Đăng nhập" action, not the profile.
    const pill = page.getByTestId('navbar-pill');
    await expect(pill.getByRole('link', { name: /Đăng nhập/i }).first()).toBeVisible();
    await expect(pill.getByText(user.fullName)).toHaveCount(0);
    console.log('[TOPBAR] reverted to "Đăng nhập"; deleted profile name absent');

    // ── 5. Screenshot of the verified clean state ──────────────────────
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({ path: SHOT, fullPage: false });
    expect(fs.existsSync(SHOT)).toBe(true);
    console.log(`[SHOT] saved ${SHOT}`);
  });
});
