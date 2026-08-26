const { ValidationError } = require('../utils/errors');

const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = req[source];
    const result = schema.safeParse(data);

    if (!result.success) {
      const details = result.error.errors.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message
      }));
      return next(new ValidationError('Validation failed', details));
    }

    // Replace validated data
    req[source] = result.data;
    next();
  };
};

module.exports = validate;