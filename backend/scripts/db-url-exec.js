#!/usr/bin/env node
// =============================================================================
// db-url-exec: run a child command with a canonically composed DATABASE_URL.
// =============================================================================
// Usage:  node scripts/db-url-exec.js -- <command...>
// Example (compose one-shots):
//   node scripts/db-url-exec.js -- npx prisma migrate deploy
//
// Replaces the fragile `DATABASE_URL="$(node scripts/db-url.js)" ...` shell
// pattern: no quoting/escaping hazards, works with any DB_PASS characters,
// and guarantees Prisma always sees `mysql://user:pass@host:port/db` built
// from the DB_* parts (never a stale string from .env).
// =============================================================================

const { spawnSync } = require('child_process');
const { buildDatabaseUrl } = require('./db-url');

const sep = process.argv.indexOf('--');
if (sep === -1) {
  process.stderr.write('usage: node scripts/db-url-exec.js -- <command...>\n');
  process.exit(2);
}
const command = process.argv.slice(sep + 1);
if (command.length === 0) {
  process.stderr.write('db-url-exec: no command given after --\n');
  process.exit(2);
}

let url;
try {
  url = buildDatabaseUrl();
} catch (err) {
  process.stderr.write(`db-url-exec: ${err.message}\n`);
  process.exit(1);
}

const result = spawnSync(command[0], command.slice(1), {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: url }
});

if (result.error) {
  process.stderr.write(`db-url-exec: failed to start ${command[0]}: ${result.error.message}\n`);
  process.exit(1);
}
process.exit(result.status ?? 1);
