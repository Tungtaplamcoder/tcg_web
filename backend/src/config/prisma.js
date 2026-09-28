// Generated Prisma Client (custom output — see prisma/schema.prisma). The
// generated client bundles its own runtime + query-engine binaries, so it
// works even when `@prisma/client` is absent from node_modules on the
// production server (cPanel "Run NPM Install" never runs prisma generate).
const { PrismaClient } = require('../generated/prisma');
const env = require('./env');

/* ── cPanel / LiteSpeed hardening ─────────────────────────────
   1) GLOBAL SINGLETON — exactly ONE PrismaClient (and therefore ONE
      query-engine instance with its own Tokio runtime) per Node process.
      Each extra client spawns more engine threads/timers; under CloudLinux
      LVE that is what exhausts memory and triggers the Rust engine crash
      "PANIC: timer has gone away". Cached on globalThis so the instance
      survives module re-loads (nodemon hot reload, Passenger restarts
      inside the same process, require-cache invalidation).
   2) BOUNDED CONNECTION POOL — connection_limit / pool_timeout are
      enforced directly on the datasource URL (defaults: 5 / 10) so the
      pool can never fan out past the MariaDB `max_connections` shared
      quota, even for consumers that hand us a URL without params. */

const POOL_LIMIT = env.dbPoolLimit || 5;
const POOL_TIMEOUT = env.dbPoolTimeout || 10;

/** Merge connection_limit / pool_timeout into a mysql:// URL (without
 *  clobbering params the operator already set, and stripping credentials
 *  from any error output). */
const withPoolParams = (url) => {
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has('connection_limit')) {
      parsed.searchParams.set('connection_limit', String(POOL_LIMIT));
    }
    if (!parsed.searchParams.has('pool_timeout')) {
      parsed.searchParams.set('pool_timeout', String(POOL_TIMEOUT));
    }
    return parsed.toString();
  } catch {
    // Not a parseable URL — fall back to naive query-string append.
    return `${url}${url.includes('?') ? '&' : '?'}connection_limit=${POOL_LIMIT}&pool_timeout=${POOL_TIMEOUT}`;
  }
};

const datasourceUrl = withPoolParams(env.databaseUrl);

/**
 * Returns the process-wide PrismaClient singleton, creating it on first call.
 * `datasources.db.url` carries the bounded pool params; the client itself is
 * reused by every service/controller via require('./config/prisma').
 */
const createPrismaClient = () =>
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    datasources: {
      db: {
        url: datasourceUrl
      }
    }
  });

// globalThis cache: never a second engine in the same process.
globalThis.__tcgPrismaSingleton = globalThis.__tcgPrismaSingleton || createPrismaClient();

module.exports = globalThis.__tcgPrismaSingleton;
