/* Safe database-failure handling for controllers.
 *
 * Every Prisma call made by a controller is wrapped in try/catch. Operational
 * errors (validation, not-found, conflict, payment... — anything thrown as
 * AppError) keep flowing to the global error handler with their original
 * status code. Raw database failures (lost connection, pool timeout, Prisma
 * engine errors P1xxx/P2xxx) must never surface as unhandled 500s:
 *   - List endpoints degrade to 200 + empty data (empty array / empty page)
 *     so storefront pages render their empty state instead of an error page.
 *   - Single reads and writes return a clean 400 JSON payload clients can
 *     show as a retryable message.
 */

const PRISMA_ERROR_NAMES = [
  'PrismaClientInitializationError',
  'PrismaClientKnownRequestError',
  'PrismaClientUnknownRequestError',
  'PrismaClientRustPanicError',
  'PrismaClientValidationError'
];

const DB_UNAVAILABLE_MESSAGE = 'Hệ thống tạm thời không khả dụng, vui lòng thử lại sau.';

const isDatabaseError = (error) => {
  if (!error || error.isOperational) return false;
  if (/^P[12]\d{3}$/.test(error.code || '')) return true;
  if (typeof error.clientVersion === 'string') return true;
  return PRISMA_ERROR_NAMES.includes(error.name);
};

const logDatabaseError = (scope, error) => {
  console.error(
    `[dbGuard] ${scope} — database failure:`,
    error?.code || error?.name || 'UNKNOWN',
    error?.message || error
  );
};

// Empty paginated payload ({ items: [], meta }) matching the list contract.
const emptyPage = (page = 1, limit = 20) => ({
  items: [],
  meta: { page, limit, totalItems: 0, totalPages: 0 }
});

// 200 + empty data for list endpoints: keeps the success shape so the
// frontend falls back to its empty state instead of an error screen.
const sendDbEmpty = (res, scope, error, data) => {
  logDatabaseError(scope, error);
  return res.status(200).json({
    success: true,
    data,
    message: 'Data temporarily unavailable'
  });
};

// Clean 400 JSON for single reads / writes — no stack traces, no 500s.
const sendDbError = (res, scope, error, message = DB_UNAVAILABLE_MESSAGE) => {
  logDatabaseError(scope, error);
  return res.status(400).json({
    success: false,
    error: { code: 'DATABASE_ERROR', message },
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  isDatabaseError,
  logDatabaseError,
  emptyPage,
  sendDbEmpty,
  sendDbError,
  DB_UNAVAILABLE_MESSAGE
};
