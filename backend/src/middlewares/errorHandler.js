const { AppError, ValidationError, ConflictError, NotFoundError } = require('../utils/errors');
const { ZodError } = require('zod');

// Map raw Prisma/database errors to clean AppErrors so clients always receive
// structured JSON instead of unhandled 500 crashes.
const PRISMA_ERROR_MAP = {
  P2000: () => new AppError('Giá trị quá dài cho trường dữ liệu', 400, 'DB_VALUE_TOO_LONG'),
  P2002: () => new ConflictError('Dữ liệu bị trùng lặp (unique constraint)'),
  P2003: () => new AppError('Dữ liệu liên quan không hợp lệ hoặc đã bị xóa (foreign key)', 409, 'DB_FK_VIOLATION'),
  P2025: () => new NotFoundError('Bản ghi không tồn tại hoặc đã bị thay đổi'),
  P2021: () => new AppError('Bảng dữ liệu không tồn tại — cần chạy migration SQL', 500, 'DB_TABLE_MISSING'),
  P2022: () => new AppError('Thiếu cột dữ liệu — cần chạy migration SQL (schema drift)', 500, 'DB_COLUMN_MISSING'),
};

const isPrismaError = (err) =>
  /^P2\d{3}$/.test(err?.code || '') ||
  typeof err?.clientVersion === 'string' ||
  ['PrismaClientInitializationError', 'PrismaClientKnownRequestError', 'PrismaClientUnknownRequestError', 'PrismaClientRustPanicError', 'PrismaClientValidationError'].includes(err?.name);

const mapDatabaseError = (err) => {
  const mapped = PRISMA_ERROR_MAP[err?.code];
  if (mapped) return mapped();
  const message = err?.message || 'Unknown database error';
  console.error('Database error:', err?.code || err?.name || 'UNKNOWN', message);
  return new AppError(`Lỗi hệ thống cơ sở dữ liệu: ${message}`, 500, 'DB_ERROR');
};

const errorHandler = (err, req, res, next) => {
  let error = err;

  // Convert known errors to AppError instances
  if (err instanceof ZodError) {
    const details = err.errors.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message
    }));
    error = new ValidationError('Invalid input data', details);
  } else if (err instanceof AppError) {
    // Operational AppError (incl. mapped Prisma errors re-thrown by controllers) — pass through
  } else if (isPrismaError(err)) {
    // Raw Prisma error that reached the handler un-mapped
    error = mapDatabaseError(err);
  } else {
    // Unknown error
    console.error('Unhandled error:', err);
    error = new AppError('Internal server error', 500, 'INTERNAL_SERVER_ERROR');
  }

  const statusCode = error.statusCode || 500;
  const response = {
    success: false,
    error: {
      code: error.code,
      message: error.message
    },
    timestamp: new Date().toISOString()
  };

  if (error.details) {
    response.error.details = error.details;
    // Field-keyed error map (e.g., { phone: "Invalid format" }) so clients can
    // bind messages directly to inputs. Accepts [{field, message}] or a plain object.
    if (Array.isArray(error.details)) {
      const fieldErrors = {};
      for (const d of error.details) {
        if (d && d.field) fieldErrors[d.field] = d.message;
      }
      response.errors = fieldErrors;
    } else {
      response.errors = error.details;
    }
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;