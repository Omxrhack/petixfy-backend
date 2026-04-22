const { ZodError } = require('zod');
const { AppError } = require('../utils/AppError');

function mapPostgresError(err) {
  if (!err || !err.code) {
    return null;
  }

  if (err.code === '23505') {
    return new AppError('Duplicate value violates unique constraint', 409);
  }

  if (err.code === '23503') {
    return new AppError('Invalid reference: related record does not exist', 400);
  }

  if (err.code === '22P02') {
    return new AppError('Invalid input syntax', 400);
  }

  return null;
}

function sendErrorDev(res, err) {
  return res.status(err.statusCode || 500).json({
    status: err.status || 'error',
    error: err.message || 'Internal server error',
    code: err.code,
    stack: err.stack,
    details: err.details || null,
  });
}

function sendErrorProd(res, err) {
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      error: err.message,
    });
  }

  return res.status(500).json({
    status: 'error',
    error: 'Something went wrong',
  });
}

function globalErrorHandler(err, req, res, next) {
  let normalizedError = err;

  if (err instanceof ZodError || err?.name === 'ZodError') {
    const zodMessages = err.issues?.map((issue) => issue.message) ?? [err.message];
    normalizedError = new AppError(zodMessages.join(', '), 400);
    normalizedError.details = err.flatten ? err.flatten() : { formErrors: zodMessages };
  }

  const pgMapped = mapPostgresError(err);
  if (pgMapped) {
    pgMapped.details = err.details || err.message;
    normalizedError = pgMapped;
  }

  if (!(normalizedError instanceof AppError)) {
    normalizedError = Object.assign(new AppError(normalizedError?.message || 'Internal server error', 500), {
      isOperational: false,
      code: normalizedError?.code,
      details: normalizedError?.details,
      stack: normalizedError?.stack,
    });
  }

  if (process.env.NODE_ENV === 'development') {
    return sendErrorDev(res, normalizedError);
  }

  return sendErrorProd(res, normalizedError);
}

module.exports = { globalErrorHandler };
