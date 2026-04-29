class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode   = statusCode;
    this.code         = code;
    this.details      = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Shape express-validator errors into a flat array of { field, message } objects.
 */
function formatValidationErrors(result) {
  return result.array().map(e => ({ field: e.path ?? e.param, message: e.msg }));
}

module.exports = { AppError, formatValidationErrors };
