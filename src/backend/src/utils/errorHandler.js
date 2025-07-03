class AppError extends Error {
  constructor(message, statusCode, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; // Operational errors are trusted errors (e.g. user input error)
    this.details = details; // Optional field for more detailed error information (e.g. validation errors array)

    Error.captureStackTrace(this, this.constructor);
  }
}

const handleServiceError = (error, defaultMessage = 'An unexpected error occurred.', defaultStatus = 500) => {
  if (error instanceof AppError) {
    throw error;
  }
  // Log the original error for debugging if it's not an AppError
  // console.error('Unhandled Service Error:', error); // Or use a logger
  throw new AppError(defaultMessage, defaultStatus, error.message);
};

module.exports = {
  AppError,
  handleServiceError,
}; 