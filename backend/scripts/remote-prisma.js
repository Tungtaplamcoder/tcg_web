#!/usr/bin/env node
// =============================================================================
// remote-prisma — run SAFE Prisma operations against the REMOTE cPanel MySQL
// database from your LOCAL machine ("Local Build, Remote Run" pipeline).
// =============================================================================
// WHY THIS EXISTS:
//   The Prisma CLI validates the schema with WebAssembly. On shared cPanel
//   hosting (CloudLinux LVE, ~4GB virtual-memory cap) that Wasm instance
//   cannot be allocated and every CLI command dies with
//     RangeError: WebAssembly.Instance(): Out of memory: Cannot allocate
//     Wasm memory for new instance
//   So NO Prisma CLI command may EVER execute on the server. All schema work
//   is done locally; only the already-running Node app touches the remote DB.
//
// WHAT IT DOES:
//   Loads cPanel DB credentials from backend/.env.cpanel (git-ignored — see
//   .env.cpanel.example), composes a correctly URL-encoded DATABASE_URL, and
//   spawns the LOCAL Prisma CLI with it. Because it runs on your machine,
//   Wasm validation + schema engine get normal amounts of memory.
//
// USAGE (from backend/):
//   node scripts/remote-prisma.js migrate deploy    # apply pending migrations
//   node scripts/remote-prisma.js migrate status    # see applied/pending list
//   node scripts/remote-prisma.js db seed           # idempotent seed (seed.js
//                                                   # exits early if data exists)
//
// SAFETY:
//   - `migrate dev` / `db push` are INTENTIONALLY NOT routable here — they
//     can reset/shadow-drop data. Use them only against your local dev DB.
//   - The script refuses to run when the target host looks like localhost
//     (that would hit your local dev DB, not the production one).
//   - Credentials never appear in process listings or logs: the URL is
//     passed via environment, never via argv.
// =============================================================================

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const BACKEND_ROOT = path.join(__dirname, '..');

// --- Load .env.cpanel (dedicated remote-ops config; never committed) --------
const cpanelEnvPath = path.join(BACKEND_ROOT, '.env.cpanel');
if (!fs.existsSync(cpanelEnvPath)) {
  process.stderr.write(
    'remote-prisma: backend/.env.cpanel not found.\n' +
    '  Copy backend/.env.cpanel.example to backend/.env.cpanel and fill in the\n' +
    '  cPanel MySQL credentials (from cPanel > MySQL Databases).\n'
  );
  process.exit(1);
}
const cpanelEnv = dotenv.parse(fs.readFileSync(cpanelEnvPath));

const required = ['DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME'];
for (const key of required) {
  if (!cpanelEnv[key]) {
    process.stderr.write(`remote-prisma: ${key} is missing in backend/.env.cpanel\n`);
    process.exit(1);
  }
}

// --- Guard: never silently target a local dev database ----------------------
const host = cpanelEnv.DB_HOST;
if (/^(localhost|127\.0\.0\.1|::1|mariadb|db)$/i.test(host) && process.env.REMOTE_PRISMA_ALLOW_LOCAL !== '1') {
  process.stderr.write(
    `remote-prisma: DB_HOST "${host}" looks like a local/dev database.\n` +
      '  Set the real cPanel MySQL host (cPanel > MySQL Databases > Remote MySQL,\n' +
      "  or your host's DB hostname) in backend/.env.cpanel.\n" +
      '  To override when you truly mean a local target: REMOTE_PRISMA_ALLOW_LOCAL=1\n'
  );
  process.exit(1);
}

// --- Compose URL-encoded DATABASE_URL from parts -----------------------------
// encodeURIComponent leaves ! ' ( ) * unescaped — escape those too so any
// DB_PASS characters are safe for every consumer (Prisma engine, mysql2).
const encodeCred = (value) =>
  encodeURIComponent(String(value ?? '')).replace(
    /[!'()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()
  );

const port = parseInt(cpanelEnv.DB_PORT, 10) || 3306;
const databaseUrl =
  `mysql://${encodeCred(cpanelEnv.DB_USER)}:${encodeCred(cpanelEnv.DB_PASS)}` +
  `@${host}:${port}/${encodeCred(cpanelEnv.DB_NAME)}` +
  `?connection_limit=${parseInt(cpanelEnv.DB_POOL_LIMIT, 10) || 5}` +
  `&pool_timeout=${parseInt(cpanelEnv.DB_POOL_TIMEOUT, 10) || 10}`;

// --- Resolve the LOCAL Prisma CLI binary (never a global one) ---------------
// npm workspaces hoist deps to the repo root, so accept both locations:
// backend/node_modules/.bin/prisma (standalone) or the workspace root's.
const candidates = [
  path.join(BACKEND_ROOT, 'node_modules', '.bin', 'prisma'),
  path.join(BACKEND_ROOT, '..', 'node_modules', '.bin', 'prisma')
];
const prismaBin = candidates.find((p) => fs.existsSync(p));
if (!prismaBin) {
  process.stderr.write(
    'remote-prisma: local prisma CLI not found (looked in backend/node_modules/.bin and the repo root).\n' +
    '  Run "npm install" at the repo root (or in backend/) first.\n'
  );
  process.exit(1);
}

// --- Route only whitelisted safe subcommands ---------------------------------
const args = process.argv.slice(2);
const ALLOWED = [
  /^migrate deploy$/,
  /^migrate status$/,
  /^db seed$/
];
const subcommand = args.join(' ');
if (!ALLOWED.some((re) => re.test(subcommand))) {
  process.stderr.write(
    `remote-prisma: "${subcommand || '(none)'}" is not allowed against the remote database.\n` +
    '  Allowed: migrate deploy | migrate status | db seed\n' +
    '  Destructive commands (migrate dev, db push, db reset) must target your LOCAL dev DB only.\n'
  );
  process.exit(2);
}

// --- Execute locally, against the remote DATABASE_URL -----------------------
console.log(
  `remote-prisma: running "prisma ${subcommand}" against ${host}:${port}/${cpanelEnv.DB_NAME} (from your machine — server never executes Prisma CLI)`
);
const result = spawnSync(prismaBin, args, {
  cwd: BACKEND_ROOT,
  stdio: 'inherit',
  env: {
    ...process.env,
    ...cpanelEnv,
    DATABASE_URL: databaseUrl,
    // Seed values used by prisma/seed.js when the remote DB is empty:
    ADMIN_EMAIL: cpanelEnv.ADMIN_EMAIL || process.env.ADMIN_EMAIL,
    ADMIN_PASSWORD: cpanelEnv.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD
  }
});

if (result.error) {
  process.stderr.write(`remote-prisma: failed to start prisma CLI: ${result.error.message}\n`);
  process.exit(1);
}
process.exit(result.status ?? 1);
