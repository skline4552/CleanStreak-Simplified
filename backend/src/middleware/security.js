const helmet = require('helmet');
const cors = require('cors');
const config = require('../config/environment');

/**
 * Advanced Security Middleware
 *
 * Comprehensive security middleware with monitoring, protection,
 * and threat detection capabilities
 */

/**
 * Enhanced Helmet configuration with environment-specific settings
 */
const getHelmetConfig = () => {
  const isDevelopment = config.NODE_ENV === 'development';
  const isProduction = config.NODE_ENV === 'production';

  return {
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        scriptSrc: ["'self'", ...(isDevelopment ? ["'unsafe-eval'"] : [])],
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        connectSrc: ["'self'", ...(isDevelopment ? ['ws:', 'wss:'] : [])],
        mediaSrc: ["'self'"],
        objectSrc: ["'none'"],
        childSrc: ["'none'"],
        workerSrc: ["'self'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        manifestSrc: ["'self'"],
        upgradeInsecureRequests: isProduction ? [] : null
      },
      reportOnly: isDevelopment
    },

    // Strict Transport Security
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },

    // X-Frame-Options
    frameguard: {
      action: 'deny'
    },

    // X-Content-Type-Options
    noSniff: true,

    // X-XSS-Protection
    xssFilter: true,

    // Referrer Policy
    referrerPolicy: {
      policy: ['no-referrer-when-downgrade']
    },

    // Feature Policy / Permissions Policy
    permittedCrossDomainPolicies: false,

    // Hide X-Powered-By header
    hidePoweredBy: true,

    // DNS Prefetch Control
    dnsPrefetchControl: {
      allow: false
    },

    // Expect-CT
    expectCt: isProduction ? {
      maxAge: 30,
      enforce: true
    } : false
  };
};

/**
 * Enhanced CORS configuration with security monitoring
 */
const getCorsConfig = () => {
  return {
    origin: (origin, callback) => {
      const allowedOrigins = Array.isArray(config.CORS_ORIGIN)
        ? config.CORS_ORIGIN
        : [config.CORS_ORIGIN];

      // Allow requests with no origin (e.g., mobile apps, Postman)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // Log suspicious CORS violations
        console.warn(`CORS violation: Origin ${origin} not allowed`, {
          origin,
          timestamp: new Date().toISOString(),
          allowedOrigins
        });

        // Deny access without throwing an error (prevents 500, returns proper CORS rejection)
        callback(null, false);
      }
    },
    credentials: config.CORS_CREDENTIALS,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-API-Key'
    ],
    exposedHeaders: [
      'X-Total-Count',
      'X-Has-More',
      'X-Rate-Limit-Remaining',
      'X-Rate-Limit-Reset'
    ],
    optionsSuccessStatus: 200,
    preflightContinue: false
  };
};

/**
 * Security headers middleware
 */
const securityHeaders = (req, res, next) => {
  // Custom security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Remove server identification
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  // Cache control for security-sensitive responses
  if (req.path.includes('auth') || req.path.includes('user')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }

  next();
};

/**
 * Request monitoring middleware
 */
const requestMonitor = (req, res, next) => {
  const startTime = Date.now();
  const originalIp = req.ip || req.connection.remoteAddress;

  // Enhanced request logging
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  req.requestId = requestId;

  // Log request details
  const requestLog = {
    requestId,
    method: req.method,
    url: req.url,
    path: req.path,
    ip: originalIp,
    userAgent: req.get('User-Agent') || 'unknown',
    referer: req.get('Referer') || 'none',
    timestamp: new Date().toISOString(),
    userId: req.user?.userId || null
  };

  console.log('Request received:', requestLog);

  // Monitor response
  const originalSend = res.send;
  res.send = function(data) {
    const responseTime = Date.now() - startTime;

    // Calculate response size - handle both strings and objects
    let responseSize = 0;
    if (data) {
      if (typeof data === 'string' || Buffer.isBuffer(data)) {
        responseSize = Buffer.byteLength(data);
      } else if (typeof data === 'object') {
        responseSize = Buffer.byteLength(JSON.stringify(data));
      }
    }

    console.log('Request completed:', {
      requestId,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      responseSize
    });

    // Log slow requests
    if (responseTime > 1000) {
      console.warn('Slow request detected:', {
        requestId,
        method: req.method,
        path: req.path,
        responseTime: `${responseTime}ms`,
        ip: originalIp
      });
    }

    return originalSend.call(this, data);
  };

  next();
};

/**
 * IP-based security monitoring
 */
const ipSecurityMonitor = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || '';

  // Detect potential bot traffic
  const botPatterns = [
    /bot|crawler|spider|crawling/i,
    /facebook|twitter|linkedin|pinterest/i,
    /google|bing|yahoo|duckduckgo/i,
    /slurp|msnbot|baiduspider/i
  ];

  const isBot = botPatterns.some(pattern => pattern.test(userAgent));

  if (isBot) {
    console.log('Bot traffic detected:', {
      ip,
      userAgent,
      path: req.path,
      timestamp: new Date().toISOString()
    });

    // Allow legitimate bots but rate limit them more strictly
    req.isBot = true;
  }

  // Check for suspicious IP patterns
  const suspiciousIpPatterns = [
    /^10\./, // Private networks (suspicious for web requests)
    /^192\.168\./, // Private networks
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./ // Private networks
  ];

  // Note: These patterns might be legitimate for internal services
  // Adjust based on your deployment environment

  next();
};

/**
 * Authentication attempt monitoring
 */
const authAttemptMonitor = (req, res, next) => {
  if (req.path.includes('auth')) {
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent') || '';
    const email = req.body?.email;

    // Log authentication attempts
    console.log('Auth attempt:', {
      type: req.path.includes('login') ? 'login' : 'register',
      ip,
      userAgent,
      email: email ? `${email.charAt(0)}***@${email.split('@')[1]}` : 'none',
      timestamp: new Date().toISOString()
    });

    // Monitor the response for failed attempts
    const originalJson = res.json;
    res.json = function(data) {
      if (res.statusCode >= 400) {
        console.warn('Auth attempt failed:', {
          ip,
          email: email ? `${email.charAt(0)}***@${email.split('@')[1]}` : 'none',
          statusCode: res.statusCode,
          error: data.error,
          timestamp: new Date().toISOString()
        });
      }

      return originalJson.call(this, data);
    };
  }

  next();
};

/**
 * Content-Type validation middleware
 */
const validateContentType = (req, res, next) => {
  // Only validate POST, PUT, PATCH requests
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.get('Content-Type');
    const contentLength = parseInt(req.get('Content-Length'), 10) || 0;
    const hasBody = contentLength > 0 || (req.body && Object.keys(req.body).length > 0);

    // Only require Content-Type if there's actually a body
    if (!contentType && hasBody) {
      return res.status(400).json({
        error: 'Content-Type header is required',
        code: 'MISSING_CONTENT_TYPE'
      });
    }

    // If Content-Type is provided, validate it
    if (contentType) {
      // Allow JSON and form data
      const allowedTypes = [
        'application/json',
        'application/x-www-form-urlencoded',
        'multipart/form-data'
      ];

      const isValidType = allowedTypes.some(type =>
        contentType.toLowerCase().includes(type)
      );

      if (!isValidType) {
        return res.status(415).json({
          error: 'Unsupported content type',
          code: 'UNSUPPORTED_MEDIA_TYPE',
          supportedTypes: allowedTypes
        });
      }
    }
  }

  next();
};

/**
 * Request size validation middleware
 */
const validateRequestSize = (maxSize = 10 * 1024 * 1024) => { // 10MB default
  return (req, res, next) => {
    const contentLength = parseInt(req.get('Content-Length'), 10);

    if (contentLength && contentLength > maxSize) {
      return res.status(413).json({
        error: 'Request too large',
        code: 'REQUEST_TOO_LARGE',
        maxSize: `${Math.floor(maxSize / 1024 / 1024)}MB`
      });
    }

    next();
  };
};

/**
 * HTTP method validation middleware
 */
const validateHttpMethod = (req, res, next) => {
  const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'];

  if (!allowedMethods.includes(req.method)) {
    return res.status(405).json({
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED',
      allowedMethods
    });
  }

  next();
};

/**
 * Security event logger
 */
const logSecurityEvent = (eventType, details) => {
  const securityEvent = {
    type: eventType,
    timestamp: new Date().toISOString(),
    severity: details.severity || 'medium',
    details,
    environment: config.NODE_ENV
  };

  console.warn(`Security Event [${eventType}]:`, securityEvent);

  // In production, you might want to send this to a security monitoring service
  if (config.NODE_ENV === 'production' && details.severity === 'high') {
    // TODO: Implement alerting for high-severity security events
    console.error('HIGH SEVERITY SECURITY EVENT:', securityEvent);
  }
};

/**
 * Initialize all security middleware
 */
const initializeSecurity = (app) => {
  // Basic security headers
  app.use(helmet(getHelmetConfig()));

  // CORS configuration
  app.use(cors(getCorsConfig()));

  // Custom security middleware
  app.use(securityHeaders);
  app.use(requestMonitor);
  app.use(ipSecurityMonitor);
  app.use(authAttemptMonitor);
  app.use(validateContentType);
  app.use(validateRequestSize());
  app.use(validateHttpMethod);

  console.log('Security middleware initialized');
};

module.exports = {
  initializeSecurity,
  securityHeaders,
  requestMonitor,
  ipSecurityMonitor,
  authAttemptMonitor,
  validateContentType,
  validateRequestSize,
  validateHttpMethod,
  logSecurityEvent,
  getHelmetConfig,
  getCorsConfig
};