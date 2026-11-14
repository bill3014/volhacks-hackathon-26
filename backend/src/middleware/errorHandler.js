export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (!error.status || error.status >= 500) console.error(error);
  res.status(error.status ?? 500).json({
    error: error.status ? error.message : 'Internal server error',
  });
}
