const {
  verifyAccessToken,
  verifyRefreshToken,
  extractToken,
  extractRefreshToken,
  isTokenExpired,
  generateAccessToken,
  setAuthCookies,
  clearAuthCookies
} = require('../utils/jwt');

/**
 * Authentication Middleware
 *
 * Provides middleware functions for JWT authentication, authorization,
 * and token refresh with comprehensive error handling and security features.
 */

/**
 * Middleware to authenticate requests using JWT access tokens
 * Verifies the token and adds user information to the request object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const authenticate = async (req, res, next) => {
  try {
    // Extract token from request
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'NO_TOKEN',
        message: 'Access token is required for this operation'
      });
    }

    // Verify and decode the token
    const decoded = verifyAccessToken(token);

    // Add user information to request object
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      jti: decoded.jti,
      iat: decoded.iat,
      exp: decoded.exp
    };

    // Add token metadata
    req.tokenInfo = {
      type: 'access',
      jti: decoded.jti,
      issuedAt: new Date(decoded.iat * 1000),
      expiresAt: new Date(decoded.exp * 1000)
    };

    next();
  } catch (error) {
    // Handle specific JWT errors
    let statusCode = 401;
    let errorCode = 'INVALID_TOKEN';
    let message = 'Invalid or expired access token';

    if (error.message.includes('expired')) {
      errorCode = 'TOKEN_EXPIRED';
      message = 'Access token has expired';
    } else if (error.message.includes('Invalid')) {
      errorCode = 'INVALID_TOKEN';
      message = 'Invalid access token';
    }

    return res.status(statusCode).json({
      error: 'Authentication failed',
      code: errorCode,
      message
    });
  }
};

/**
 * Optional authentication middleware
 * Adds user information if a valid token is present, but doesn't require authentication
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (token) {
      try {
        const decoded = verifyAccessToken(token);

        // Add user information to request object
        req.user = {
          userId: decoded.userId,
          email: decoded.email,
          jti: decoded.jti,
          iat: decoded.iat,
          exp: decoded.exp
        };

        req.tokenInfo = {
          type: 'access',
          jti: decoded.jti,
          issuedAt: new Date(decoded.iat * 1000),
          expiresAt: new Date(decoded.exp * 1000)
        };

        req.isAuthenticated = true;
      } catch (tokenError) {
        // Token is invalid but we don't fail the request
        req.isAuthenticated = false;
      }
    } else {
      req.isAuthenticated = false;
    }

    next();
  } catch (error) {
    // Even if there's an error, continue without authentication
    req.isAuthenticated = false;
    next();
  }
};

/**
 * Middleware to refresh expired access tokens using refresh tokens
 * Automatically generates new tokens if refresh token is valid
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const refreshToken = async (req, res, next) => {
  try {
    // Extract refresh token from request
    const refreshTokenValue = extractRefreshToken(req);

    if (!refreshTokenValue) {
      return res.status(401).json({
        error: 'Refresh token required',
        code: 'NO_REFRESH_TOKEN',
        message: 'Refresh token is required for token refresh'
      });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshTokenValue);

    // Check if we have a database connection for session validation
    // This would typically check against the user_sessions table
    // For now, we'll implement basic validation

    // Generate new access token
    const newAccessToken = generateAccessToken({
      userId: decoded.userId,
      // We may need to fetch additional user data from database here
    });

    // Set the new access token in cookies
    setAuthCookies(res, newAccessToken.token, refreshTokenValue);

    // Add the new token info to the request for potential use
    req.newTokenInfo = {
      accessToken: newAccessToken,
      refreshTokenUsed: decoded.jti
    };

    // For refresh endpoint, return the tokens
    if (req.route && req.route.path === '/refresh') {
      return res.status(200).json({
        success: true,
        accessToken: newAccessToken.token,
        expiresAt: newAccessToken.expiresAt,
        message: 'Token refreshed successfully'
      });
    }

    next();
  } catch (error) {
    // Clear invalid refresh token cookies
    clearAuthCookies(res);

    let statusCode = 401;
    let errorCode = 'INVALID_REFRESH_TOKEN';
    let message = 'Invalid or expired refresh token';

    if (error.message.includes('expired')) {
      errorCode = 'REFRESH_TOKEN_EXPIRED';
      message = 'Refresh token has expired, please login again';
    }

    return res.status(statusCode).json({
      error: 'Token refresh failed',
      code: errorCode,
      message
    });
  }
};

/**
 * Authorization middleware to check user permissions
 * @param {Array|string} requiredRoles - Required role(s) for access
 * @returns {Function} Middleware function
 */
const authorize = (requiredRoles = []) => {
  return (req, res, next) => {
    try {
      // Ensure user is authenticated first
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'NOT_AUTHENTICATED',
          message: 'User must be authenticated to access this resource'
        });
      }

      // Convert single role to array
      const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

      // If no specific roles required, just check authentication
      if (roles.length === 0) {
        return next();
      }

      // Check if user has required role(s)
      // Note: Role checking would need to be implemented based on user data structure
      const userRoles = req.user.roles || ['user']; // Default to 'user' role

      const hasRequiredRole = roles.some(role => userRoles.includes(role));

      if (!hasRequiredRole) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Required role(s): ${roles.join(', ')}`
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        error: 'Authorization check failed',
        code: 'AUTHORIZATION_ERROR',
        message: 'An error occurred while checking permissions'
      });
    }
  };
};

/**
 * Middleware to validate token freshness
 * Ensures the token was issued recently enough for sensitive operations
 * @param {number} maxAge - Maximum age in seconds (default: 300 = 5 minutes)
 * @returns {Function} Middleware function
 */
const requireFreshToken = (maxAge = 300) => {
  return (req, res, next) => {
    try {
      if (!req.tokenInfo) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'NOT_AUTHENTICATED',
          message: 'Authentication required for this operation'
        });
      }

      const tokenAge = (Date.now() - req.tokenInfo.issuedAt.getTime()) / 1000;

      if (tokenAge > maxAge) {
        return res.status(401).json({
          error: 'Token too old',
          code: 'TOKEN_TOO_OLD',
          message: `Token must be less than ${maxAge} seconds old for this operation`
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        error: 'Token freshness check failed',
        code: 'TOKEN_FRESHNESS_ERROR',
        message: 'An error occurred while checking token freshness'
      });
    }
  };
};

/**
 * Middleware to check if user owns the requested resource
 * Compares user ID from token with resource owner ID
 * @param {string} resourceUserIdParam - Parameter name containing resource owner ID
 * @returns {Function} Middleware function
 */
const requireOwnership = (resourceUserIdParam = 'userId') => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'NOT_AUTHENTICATED',
          message: 'Authentication required for this operation'
        });
      }

      // Get resource owner ID from request parameters, body, or query
      const resourceUserId = req.params[resourceUserIdParam] ||
                           req.body[resourceUserIdParam] ||
                           req.query[resourceUserIdParam];

      if (!resourceUserId) {
        return res.status(400).json({
          error: 'Invalid request',
          code: 'MISSING_RESOURCE_ID',
          message: `Resource ${resourceUserIdParam} is required`
        });
      }

      // Check if user owns the resource
      if (req.user.userId !== resourceUserId) {
        return res.status(403).json({
          error: 'Access denied',
          code: 'NOT_RESOURCE_OWNER',
          message: 'You can only access your own resources'
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        error: 'Ownership check failed',
        code: 'OWNERSHIP_CHECK_ERROR',
        message: 'An error occurred while checking resource ownership'
      });
    }
  };
};

/**
 * Middleware to handle authentication errors gracefully
 * Provides consistent error responses for authentication failures
 * @param {Error} error - Authentication error
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const handleAuthError = (error, req, res, next) => {
  // If error is not authentication related, pass to next error handler
  if (!error.name || !error.name.includes('Auth')) {
    return next(error);
  }

  // Clear auth cookies on authentication errors
  clearAuthCookies(res);

  // Map error types to appropriate responses
  let statusCode = 401;
  let errorCode = 'AUTHENTICATION_ERROR';
  let message = 'Authentication failed';

  if (error.message.includes('expired')) {
    errorCode = 'TOKEN_EXPIRED';
    message = 'Authentication token has expired';
  } else if (error.message.includes('invalid')) {
    errorCode = 'INVALID_TOKEN';
    message = 'Invalid authentication token';
  }

  res.status(statusCode).json({
    error: 'Authentication error',
    code: errorCode,
    message,
    timestamp: new Date().toISOString()
  });
};

/**
 * Rate limiting middleware specifically for authentication endpoints
 * @param {Object} options - Rate limiting options
 * @returns {Function} Middleware function
 */
const authRateLimit = (options = {}) => {
  const rateLimit = require('express-rate-limit');
  const { authRateLimit: rateLimitConfig } = require('../config/auth');

  const defaultOptions = rateLimitConfig[options.type] || rateLimitConfig.login;

  return rateLimit({
    windowMs: options.windowMs || defaultOptions.windowMs,
    max: options.max || defaultOptions.max,
    skipSuccessfulRequests: options.skipSuccessfulRequests !== undefined
      ? options.skipSuccessfulRequests
      : defaultOptions.skipSuccessfulRequests,
    message: {
      error: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
      message: `Too many ${options.type || 'authentication'} attempts, please try again later`,
      retryAfter: Math.ceil((options.windowMs || defaultOptions.windowMs) / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false
  });
};

module.exports = {
  authenticate,
  optionalAuth,
  refreshToken,
  authorize,
  requireFreshToken,
  requireOwnership,
  handleAuthError,
  authRateLimit
};