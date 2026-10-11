// Thread pool and Rust query engine Tokio thread limits
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || '2';
process.env.TOKIO_WORKER_THREADS = process.env.TOKIO_WORKER_THREADS || '1';
process.env.PRISMA_QUERY_ENGINE_MAX_THREADS = process.env.PRISMA_QUERY_ENGINE_MAX_THREADS || '1';

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
      strictly capped on the datasource URL (defaults: max 5 / 10s) so the
      pool can never fan out past the MariaDB `max_connections` shared
      quota, preventing the 100 NPROC limit from being exhausted. */

const POOL_LIMIT = Math.min(Number(env.dbPoolLimit) || 5, 5);
const POOL_TIMEOUT = Number(env.dbPoolTimeout) || 10;

/** Merge connection_limit / pool_timeout into a mysql:// URL (without
 *  clobbering params the operator already set, and stripping credentials
 *  from any error output). Strictly caps connection_limit at POOL_LIMIT (5). */
const withPoolParams = (url) => {
  try {
    const parsed = new URL(url);
    const existingLimit = parseInt(parsed.searchParams.get('connection_limit'), 10);
    if (!existingLimit || existingLimit > POOL_LIMIT) {
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
