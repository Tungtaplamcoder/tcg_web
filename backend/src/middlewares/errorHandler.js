const { AppError, ValidationError } = require('../utils/errors');
const { ZodError } = require('zod');

const errorHandler = (err, req, res, next) => {
  let error = err;

  // Convert known errors to AppError instances
  if (err instanceof ZodError) {
    const details = err.errors.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message
    }));
    error = new ValidationError('Invalid input data', details);
  } else if (!(err instanceof AppError)) {
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
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;