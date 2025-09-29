const express = require('express');
const cookieParser = require('cookie-parser');

// Load environment configuration
const config = require('./config/environment');

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

// Initialize comprehensive security middleware
// This includes helmet, CORS, security headers, and monitoring
initializeSecurity(app);

// Body parsing middleware (placed after security initialization)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check endpoint (before input validation for simplicity)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    port: config.PORT
  });
});

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

// Global error handler with security event logging
app.use((err, req, res, next) => {
  // Log error with request context
  const errorLog = {
    requestId: req.requestId || 'unknown',
    error: err.message,
    stack: config.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    userId: req.user?.userId,
    timestamp: new Date().toISOString()
  };

  console.error('Application error:', errorLog);

  // Security-focused error response
  res.status(err.status || 500).json({
    error: 'Something went wrong!',
    code: err.code || 'INTERNAL_ERROR',
    message: config.NODE_ENV === 'development' ? err.message : 'Internal server error',
    requestId: req.requestId,
    timestamp: new Date().toISOString()
  });
});

// Enhanced 404 handler with logging
app.use('*', (req, res) => {
  // Log 404s for security monitoring
  console.log('404 Not Found:', {
    requestId: req.requestId || 'unknown',
    method: req.method,
    url: req.url,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  res.status(404).json({
    error: 'Route not found',
    code: 'ROUTE_NOT_FOUND',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Start server with enhanced logging
if (require.main === module) {
  app.listen(config.PORT, config.HOST, () => {
    console.log('='.repeat(60));
    console.log('🚀 CleanStreak Backend Server Started');
    console.log('='.repeat(60));
    console.log(`📍 Server: http://${config.HOST}:${config.PORT}`);
    console.log(`🌍 Environment: ${config.NODE_ENV}`);
    console.log(`💚 Health check: http://${config.HOST}:${config.PORT}/api/health`);
    console.log(`🔒 CORS origins: ${Array.isArray(config.CORS_ORIGIN) ? config.CORS_ORIGIN.join(', ') : config.CORS_ORIGIN}`);
    console.log(`🛡️  Security middleware: Active`);
    console.log(`⚡ Rate limiting: Active`);
    console.log(`🔍 Request monitoring: Active`);
    console.log(`🧹 Input sanitization: Active`);
    console.log('='.repeat(60));

    // Log startup success event
    console.log('Server startup completed:', {
      timestamp: new Date().toISOString(),
      environment: config.NODE_ENV,
      port: config.PORT,
      host: config.HOST,
      securityEnabled: true,
      rateLimitingEnabled: true
    });
  });
}

module.exports = app;