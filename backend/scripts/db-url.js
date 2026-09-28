#!/usr/bin/env node
// =============================================================================
// Canonical DATABASE_URL composer (Node >= 20, zero dependencies).
// =============================================================================
// Why this exists:
//   - Prisma requires `mysql://user:pass@host:port/db` and *correctly
//     URL-encoded* credentials. Special characters in DB_PASS (`@ : / # ?`
//     or spaces) break a hand-written DATABASE_URL in .env with P1001 /
//     ECONNREFUSED / "URL must start with the protocol mysql://" (P1012).
//   - One-shot containers (migrate/seed) don't run src/config/env.js, so
//     they need the same normalization the backend gets.
//
// Usage:
//   node scripts/db-url.js            # prints mysql:// URL to stdout
//   node scripts/db-url.js --print    # same (ignored flag, kept for clarity)
//   const { buildDatabaseUrl } = require('./scripts/db-url')
//
// Reads DB_HOST / DB_PORT / DB_USER / DB_PASS / DB_NAME (+ optional
// DB_POOL_LIMIT / DB_POOL_TIMEOUT) from process.env. In Docker Compose these
// come from the DB_* environment variables — the compose file no longer
// needs a hand-maintained DATABASE_URL string.
// =============================================================================

const encodeCred = (value) =>
  encodeURIComponent(String(value ?? ''))
    // encodeURIComponent leaves ! ' ( ) * unescaped; escape them too so the
    // URL is safe in every parser (Prisma, mysql2, shells, compose files).
    .replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

function buildDatabaseUrl(env = process.env) {
  const host = env.DB_HOST || 'mariadb';
  const port = parseInt(env.DB_PORT, 10) || 3306;
  const user = env.DB_USER;
  const pass = env.DB_PASS ?? '';
  const name = env.DB_NAME || 'tcg_db';
  const poolLimit = parseInt(env.DB_POOL_LIMIT, 10) || 5;
  const poolTimeout = parseInt(env.DB_POOL_TIMEOUT, 10) || 10;

  if (!user) throw new Error('db-url: DB_USER is required');
  if (pass === undefined) throw new Error('db-url: DB_PASS is required');

  const auth = `${encodeCred(user)}:${encodeCred(pass)}`;
  // Only params Prisma's MySQL connector validates: connection_limit +
  // pool_timeout (ssl* params are not supported for mysql:// URLs).
  const url =
    `mysql://${auth}@${host}:${port}/${name}` +
    `?connection_limit=${poolLimit}&pool_timeout=${poolTimeout}`;
  return url;
}

module.exports = { buildDatabaseUrl, encodeCred };

// --- CLI mode -------------------------------------------------------------
// Only act as a script when invoked directly (`node scripts/db-url.js`).
if (require.main === module) {
  try {
    const url = buildDatabaseUrl();
    // Never echo secrets into logs when piped elsewhere — print only the URL.
    process.stdout.write(url + '\n');
  } catch (err) {
    process.stderr.write(`db-url: ${err.message}\n`);
    process.exit(1);
  }
}
