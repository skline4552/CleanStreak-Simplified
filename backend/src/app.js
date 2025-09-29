const express = require('express');
const cookieParser = require('cookie-parser');

// Load environment configuration
const config = require('./config/environment');

// Import logging and error handling
const { logger, requestLoggingMiddleware } = require('./utils/logger');
const {
  errorHandler,
  notFoundHandler,
  initializeGlobalErrorHandlers
} = require('./middleware/errorHandler');

// Import advanced security middleware
const { initializeSecurity } = require('./middleware/security');
const {
  generalLimiter,
  authLimiters,
  userLimiters,
  detectSuspiciousActivity
} = require('./middleware/rateLimiter');
const {
  sanitizeAllInput,
  checkMaliciousContent
} = require('./middleware/validation');

const app = express();

// Initialize global error handlers for unhandled promises and exceptions
initializeGlobalErrorHandlers();

// Initialize request logging middleware (early in the stack)
app.use(requestLoggingMiddleware);

// Initialize comprehensive security middleware
// This includes helmet, CORS, security headers, and monitoring
initializeSecurity(app);

// Body parsing middleware (placed after security initialization)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check routes (before input validation for simplicity)
// These endpoints should be publicly accessible and not rate-limited
const healthRoutes = require('./routes/health');
app.use('/api/health', healthRoutes);

// Input sanitization and security validation (after health endpoint)
app.use(sanitizeAllInput);
app.use(checkMaliciousContent);
app.use(detectSuspiciousActivity);

// General API rate limiting
app.use('/api/', generalLimiter);

// Import route modules
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');

// API routes with enhanced security
// Authentication routes with specific rate limiting
app.use('/api/auth/login', authLimiters.login);
app.use('/api/auth/register', authLimiters.register);
app.use('/api/auth/refresh', authLimiters.tokenRefresh);
app.use('/api/auth', authRoutes);

// User routes with operation-specific rate limiting
app.use('/api/user/complete', userLimiters.taskCompletion);
app.use('/api/user/export', userLimiters.dataExport);
app.use('/api/user/account', userLimiters.accountDeletion);
app.use('/api/user', userLimiters.dataRetrieval);
app.use('/api/user', userRoutes);

// 404 handler for unmatched routes
app.use('*', notFoundHandler);

// Global error handler with comprehensive logging and security
app.use(errorHandler);

// Start server with enhanced logging
if (require.main === module) {
  app.listen(config.PORT, config.HOST, () => {
    const serverInfo = {
      server: `http://${config.HOST}:${config.PORT}`,
      environment: config.NODE_ENV,
      healthCheck: `http://${config.HOST}:${config.PORT}/api/health`,
      corsOrigins: Array.isArray(config.CORS_ORIGIN) ? config.CORS_ORIGIN.join(', ') : config.CORS_ORIGIN,
      securityMiddleware: 'Active',
      rateLimiting: 'Active',
      requestMonitoring: 'Active',
      inputSanitization: 'Active',
      errorHandling: 'Active',
      logging: 'Active'
    };

    logger.info('CleanStreak Backend Server Started', serverInfo);

    // Pretty console output for development
    if (config.NODE_ENV === 'development') {
      console.log('='.repeat(60));
      console.log('🚀 CleanStreak Backend Server Started');
      console.log('='.repeat(60));
      console.log(`📍 Server: ${serverInfo.server}`);
      console.log(`🌍 Environment: ${serverInfo.environment}`);
      console.log(`💚 Health check: ${serverInfo.healthCheck}`);
      console.log(`🔒 CORS origins: ${serverInfo.corsOrigins}`);
      console.log(`🛡️  Security middleware: ${serverInfo.securityMiddleware}`);
      console.log(`⚡ Rate limiting: ${serverInfo.rateLimiting}`);
      console.log(`🔍 Request monitoring: ${serverInfo.requestMonitoring}`);
      console.log(`🧹 Input sanitization: ${serverInfo.inputSanitization}`);
      console.log(`❗ Error handling: ${serverInfo.errorHandling}`);
      console.log(`📝 Comprehensive logging: ${serverInfo.logging}`);
      console.log('='.repeat(60));
    }
  });
}

module.exports = app;