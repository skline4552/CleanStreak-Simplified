/**
 * Centralized Error Handler Middleware
 *
 * Provides comprehensive error handling for the CleanStreak application
 * with security-focused error responses and comprehensive logging.
 */

// Logger will be dynamically required to avoid circular dependency

/**
 * Error types for classification
 */
const ErrorTypes = {
  VALIDATION: 'VALIDATION_ERROR',
  AUTHENTICATION: 'AUTHENTICATION_ERROR',
  AUTHORIZATION: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND_ERROR',
  RATE_LIMIT: 'RATE_LIMIT_ERROR',
  DATABASE: 'DATABASE_ERROR',
  SERVER: 'INTERNAL_SERVER_ERROR',
  BAD_REQUEST: 'BAD_REQUEST_ERROR'
};

/**
 * Custom error class for application-specific errors
 */
class AppError extends Error {
  constructor(message, statusCode, type = ErrorTypes.SERVER, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.type = type;
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.isOperational = true; // Distinguishes operational errors from programming errors

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Create standardized error response format
 */
const createErrorResponse = (error, req) => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  const errorResponse = {
    error: {
      message: error.message || 'An unexpected error occurred',
      type: error.type || ErrorTypes.SERVER,
      timestamp: error.timestamp || new Date().toISOString(),
      requestId: req.requestId || 'unknown'
    }
  };

  // Add additional details in development mode
  if (isDevelopment) {
    errorResponse.error.stack = error.stack;
    errorResponse.error.details = error.details;
  }

  // Add validation errors if present
  if (error.type === ErrorTypes.VALIDATION && error.details) {
    errorResponse.error.validation = error.details;
  }

  return errorResponse;
};

/**
 * Determine error type and status code from error object
 */
const analyzeError = (error) => {
  // Handle known error types
  if (error.isOperational) {
    return {
      statusCode: error.statusCode,
      type: error.type,
      message: error.message
    };
  }

  // Handle Prisma database errors
  if (error.code && error.code.startsWith('P')) {
    switch (error.code) {
      case 'P2002': // Unique constraint violation
        return {
          statusCode: 409,
          type: ErrorTypes.VALIDATION,
          message: 'A record with this data already exists'
        };
      case 'P2025': // Record not found
        return {
          statusCode: 404,
          type: ErrorTypes.NOT_FOUND,
          message: 'The requested resource was not found'
        };
      case 'P2003': // Foreign key constraint violation
        return {
          statusCode: 400,
          type: ErrorTypes.VALIDATION,
          message: 'Invalid reference to related resource'
        };
      default:
        return {
          statusCode: 500,
          type: ErrorTypes.DATABASE,
          message: 'Database operation failed'
        };
    }
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    return {
      statusCode: 401,
      type: ErrorTypes.AUTHENTICATION,
      message: 'Invalid authentication token'
    };
  }

  if (error.name === 'TokenExpiredError') {
    return {
      statusCode: 401,
      type: ErrorTypes.AUTHENTICATION,
      message: 'Authentication token has expired'
    };
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    return {
      statusCode: 400,
      type: ErrorTypes.VALIDATION,
      message: error.message
    };
  }

  // Handle rate limiting errors
  if (error.statusCode === 429) {
    return {
      statusCode: 429,
      type: ErrorTypes.RATE_LIMIT,
      message: 'Too many requests, please try again later'
    };
  }

  // Default to internal server error
  return {
    statusCode: 500,
    type: ErrorTypes.SERVER,
    message: 'Internal server error'
  };
};

/**
 * Log error with appropriate level and details
 */
const logError = (error, req) => {
  const errorInfo = {
    message: error.message,
    type: error.type || ErrorTypes.SERVER,
    statusCode: error.statusCode || 500,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id || 'anonymous',
    requestId: req.requestId,
    timestamp: new Date().toISOString()
  };

  // Use console.error as fallback to avoid circular dependency
  try {
    const { logger } = require('../utils/logger');

    // Log with appropriate level based on error severity
    if (error.statusCode >= 500) {
      logger.error('Server Error', errorInfo);
    } else if (error.statusCode >= 400) {
      logger.warn('Client Error', errorInfo);
    } else {
      logger.info('Request Error', errorInfo);
    }
  } catch (loggerError) {
    // Fallback to console logging
    console.error('Error Handler:', errorInfo);
  }
};

/**
 * Main error handling middleware
 */
const errorHandler = (error, req, res, next) => {
  // Analyze error to determine response
  const errorAnalysis = analyzeError(error);

  // Create enhanced error object
  const enhancedError = {
    ...error,
    statusCode: errorAnalysis.statusCode,
    type: errorAnalysis.type,
    message: errorAnalysis.message,
    timestamp: new Date().toISOString()
  };

  // Log the error
  logError(enhancedError, req);

  // Create response
  const errorResponse = createErrorResponse(enhancedError, req);

  // Send error response
  res.status(errorAnalysis.statusCode).json(errorResponse);
};

/**
 * Handle 404 Not Found errors
 */
const notFoundHandler = (req, res, next) => {
  const error = new AppError(
    `Route ${req.method} ${req.originalUrl} not found`,
    404,
    ErrorTypes.NOT_FOUND
  );

  next(error);
};

/**
 * Catch async errors and pass to error handler
 */
const asyncErrorHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Handle unhandled promise rejections
 */
const handleUnhandledRejection = () => {
  process.on('unhandledRejection', (reason, promise) => {
    try {
      const { logger } = require('../utils/logger');
      logger.error('Unhandled Promise Rejection', {
        reason: reason?.message || reason,
        stack: reason?.stack,
        promise: promise.toString(),
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('Unhandled Promise Rejection:', reason);
    }

    // Don't exit the process in production, log and continue
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  });
};

/**
 * Handle uncaught exceptions
 */
const handleUncaughtException = () => {
  process.on('uncaughtException', (error) => {
    try {
      const { logger } = require('../utils/logger');
      logger.error('Uncaught Exception', {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('Uncaught Exception:', error);
    }

    // Exit the process for uncaught exceptions
    process.exit(1);
  });
};

/**
 * Initialize global error handlers
 */
const initializeGlobalErrorHandlers = () => {
  handleUnhandledRejection();
  handleUncaughtException();

  try {
    const { logger } = require('../utils/logger');
    logger.info('Global error handlers initialized');
  } catch (err) {
    console.log('Global error handlers initialized');
  }
};

module.exports = {
  AppError,
  ErrorTypes,
  errorHandler,
  notFoundHandler,
  asyncErrorHandler,
  initializeGlobalErrorHandlers,
  createErrorResponse,
  analyzeError
};