const rateLimit = require('express-rate-limit');
const { authRateLimit } = require('../config/auth');

/**
 * Advanced Rate Limiting Middleware
 *
 * Provides comprehensive rate limiting for different endpoint types
 * with adaptive limits, monitoring, and security features
 */

/**
 * Create a rate limiter with advanced features
 * @param {Object} options - Rate limiter configuration
 * @returns {Function} Express rate limiting middleware
 */
const createRateLimiter = (options = {}) => {
  // In test environment, significantly increase limits to prevent test interference
  // UNLESS the limiter explicitly wants to be tested (enforceLimitsInTests: true)
  const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
  const enforceLimitsInTests = options.enforceLimitsInTests === true;

  const defaultOptions = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // requests per window
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    keyGenerator: (req) => {
      // Use IP address + user ID for authenticated requests
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const userId = req.user?.userId || '';
      return `${ip}-${userId}`;
    },
    handler: (req, res) => {
      const retryAfter = Math.ceil(options.windowMs / 1000) || 900;

      // Log rate limit violations for security monitoring
      console.warn(`Rate limit exceeded for ${req.ip} on ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method,
        userId: req.user?.userId,
        timestamp: new Date().toISOString()
      });

      res.status(429).json({
        error: 'Too Many Requests',
        code: 'RATE_LIMIT_EXCEEDED',
        message: options.message || 'Too many requests from this IP, please try again later.',
        retryAfter,
        limit: options.max || 100,
        reset: new Date(Date.now() + (options.windowMs || 15 * 60 * 1000)),
        remaining: 0
      });
    },
    // Note: onLimitReached has been deprecated in express-rate-limit v7
    // The logging is now handled in the custom handler function above
  };

  const mergedOptions = { ...defaultOptions, ...options };
  // Remove the enforceLimitsInTests flag from options before passing to express-rate-limit
  delete mergedOptions.enforceLimitsInTests;

  // In test environment, multiply limits by 1000 to prevent interference
  // UNLESS enforceLimitsInTests is true (for testing rate limiting itself)
  if (isTestEnv && !enforceLimitsInTests) {
    mergedOptions.max = typeof mergedOptions.max === 'number'
      ? mergedOptions.max * 1000
      : 100000;
  }
  // When enforceLimitsInTests is true, use the original limits for security testing

  return rateLimit(mergedOptions);
};

/**
 * General API rate limiter
 */
const generalLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // General API requests per window
  message: 'Too many API requests from this IP, please try again later.',
  skipSuccessfulRequests: false
});

/**
 * Strict rate limiter for sensitive operations
 */
const strictLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Very limited requests per hour
  message: 'Too many requests for this sensitive operation, please try again later.',
  skipSuccessfulRequests: true
});

/**
 * Authentication rate limiters
 */
const authLimiters = {
  // Login attempts
  login: createRateLimiter({
    windowMs: authRateLimit.login.windowMs,
    max: authRateLimit.login.max,
    skipSuccessfulRequests: authRateLimit.login.skipSuccessfulRequests,
    message: 'Too many login attempts, please try again later.',
    enforceLimitsInTests: true, // Enable rate limiting in tests for security validation
    keyGenerator: (req) => {
      // Combine IP and email for login attempts
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const email = req.body?.email || 'no-email';
      return `login-${ip}-${email}`;
    }
  }),

  // Registration attempts
  register: createRateLimiter({
    windowMs: authRateLimit.register.windowMs,
    max: authRateLimit.register.max,
    skipFailedRequests: authRateLimit.register.skipFailedRequests,
    message: 'Too many registration attempts, please try again later.',
    // Note: enforceLimitsInTests removed - validation tests need freedom to test multiple scenarios
    // Security tests should use registerStrict for actual rate limit validation
  }),

  // Strict registration rate limiter for security testing
  registerStrict: createRateLimiter({
    windowMs: authRateLimit.register.windowMs,
    max: authRateLimit.register.max,
    skipFailedRequests: authRateLimit.register.skipFailedRequests,
    message: 'Too many registration attempts, please try again later.',
    enforceLimitsInTests: true // Enforce actual limits for security validation
  }),

  // Password reset attempts
  passwordReset: createRateLimiter({
    windowMs: authRateLimit.passwordReset.windowMs,
    max: authRateLimit.passwordReset.max,
    skipSuccessfulRequests: authRateLimit.passwordReset.skipSuccessfulRequests,
    message: 'Too many password reset attempts, please try again later.'
  }),

  // Token refresh attempts
  tokenRefresh: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 refresh attempts per 15 minutes
    message: 'Too many token refresh attempts, please try again later.',
    keyGenerator: (req) => {
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const userId = req.user?.userId || 'anonymous';
      return `refresh-${ip}-${userId}`;
    }
  })
};

/**
 * User operation rate limiters
 */
const userLimiters = {
  // Task completion rate limiter
  taskCompletion: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 task completions per minute
    message: 'Too many task completions, please slow down.',
    keyGenerator: (req) => {
      const userId = req.user?.userId || 'anonymous';
      return `task-completion-${userId}`;
    }
  }),

  // Data export rate limiter
  dataExport: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 exports per hour
    message: 'Too many data export requests, please try again later.',
    keyGenerator: (req) => {
      const userId = req.user?.userId || 'anonymous';
      return `export-${userId}`;
    }
  }),

  // Account deletion rate limiter
  accountDeletion: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 2, // 2 deletion attempts per hour
    message: 'Too many account deletion attempts, please try again later.',
    keyGenerator: (req) => {
      const userId = req.user?.userId || 'anonymous';
      return `deletion-${userId}`;
    }
  }),

  // History and analytics requests
  dataRetrieval: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 data retrieval requests per 15 minutes
    message: 'Too many data requests, please try again later.',
    keyGenerator: (req) => {
      const userId = req.user?.userId || 'anonymous';
      return `data-${userId}`;
    }
  }),

  // Room configuration operations (create, update, delete, reorder)
  roomConfig: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 room config operations per 15 minutes
    message: 'Too many room configuration requests, please try again later.',
    keyGenerator: (req) => {
      const userId = req.user?.userId || 'anonymous';
      return `room-config-${userId}`;
    }
  })
};

/**
 * Adaptive rate limiter that adjusts based on server load
 * @param {Object} baseOptions - Base rate limit configuration
 * @returns {Function} Adaptive rate limiting middleware
 */
const adaptiveLimiter = (baseOptions = {}) => {
  return createRateLimiter({
    ...baseOptions,
    max: (req) => {
      // Get current system load (simplified)
      const currentLoad = process.cpuUsage();
      const baseMax = baseOptions.max || 100;

      // Reduce limit if CPU usage is high
      if (currentLoad.system > 80000000) { // High CPU usage
        return Math.floor(baseMax * 0.5);
      } else if (currentLoad.system > 50000000) { // Medium CPU usage
        return Math.floor(baseMax * 0.75);
      }

      return baseMax;
    }
  });
};

/**
 * IP-based suspicious activity detection
 */
const suspiciousActivityLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 suspicious requests per hour
  skipSuccessfulRequests: false,
  message: 'Suspicious activity detected, access temporarily restricted.',
  keyGenerator: (req) => {
    return `suspicious-${req.ip || 'unknown'}`;
  },
  handler: (req, res) => {
    // Log suspicious activity
    console.error('Suspicious activity detected', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
      headers: req.headers,
      timestamp: new Date().toISOString()
    });

    res.status(429).json({
      error: 'Access Restricted',
      code: 'SUSPICIOUS_ACTIVITY',
      message: 'Suspicious activity detected. Access temporarily restricted for security.',
      retryAfter: 3600 // 1 hour
    });
  }
});

/**
 * Middleware to detect and limit suspicious patterns
 */
const detectSuspiciousActivity = (req, res, next) => {
  const userAgent = req.get('User-Agent') || '';
  const path = req.path;

  // Flag suspicious patterns
  const suspiciousPatterns = [
    /sqlmap/i,
    /nikto/i,
    /nmap/i,
    /dirb/i,
    /gobuster/i,
    /burpsuite/i,
    /owasp/i,
    /<script/i,
    /javascript:/i,
    /eval\(/i,
    /union.*select/i,
    /1=1/i,
    /or.*1=1/i
  ];

  const isSuspicious = suspiciousPatterns.some(pattern =>
    pattern.test(userAgent) || pattern.test(path) || pattern.test(JSON.stringify(req.body))
  );

  if (isSuspicious) {
    // Apply suspicious activity rate limiting
    return suspiciousActivityLimiter(req, res, next);
  }

  next();
};

module.exports = {
  createRateLimiter,
  generalLimiter,
  strictLimiter,
  authLimiters,
  userLimiters,
  adaptiveLimiter,
  detectSuspiciousActivity,
  suspiciousActivityLimiter
};