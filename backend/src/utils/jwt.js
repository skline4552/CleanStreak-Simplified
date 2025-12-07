const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { jwtConfig } = require('../config/auth');

/**
 * JWT Token Management Utility
 *
 * Provides comprehensive JWT token generation, validation, and management
 * with support for access tokens, refresh tokens, and secure cookie handling.
 */

/**
 * Generate a cryptographically secure access token
 * @param {Object} payload - Token payload (user data including tokenVersion)
 * @param {Object} options - Additional token options
 * @returns {Object} Token data with expiration info
 */
function generateAccessToken(payload, options = {}) {
  try {
    // Ensure payload is valid
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid payload provided for access token generation');
    }

    // Validate required fields for security
    if (!payload.userId) {
      throw new Error('userId is required in token payload');
    }

    // tokenVersion is required for session invalidation security
    if (typeof payload.tokenVersion !== 'number') {
      throw new Error('tokenVersion is required in token payload');
    }

    // Generate unique token ID for tracking
    const jti = crypto.randomUUID();

    // Prepare token payload with security metadata
    const tokenPayload = {
      ...payload,
      jti, // JWT ID for token tracking
      type: 'access'
    };

    const tokenOptions = {
      expiresIn: options.expiresIn || jwtConfig.accessToken.expiresIn,
      algorithm: jwtConfig.accessToken.algorithm,
      issuer: 'CleanStreak-Auth'
    };

    const token = jwt.sign(tokenPayload, jwtConfig.accessToken.secret, tokenOptions);

    // Calculate expiration timestamp
    const expiresIn = parseTokenExpiration(tokenOptions.expiresIn);
    const expiresAt = new Date(Date.now() + expiresIn);

    return {
      token,
      jti,
      expiresAt,
      expiresIn: Math.floor(expiresIn / 1000) // in seconds
    };
  } catch (error) {
    throw new Error(`Access token generation failed: ${error.message}`);
  }
}

/**
 * Generate a cryptographically secure refresh token
 * @param {Object} payload - Token payload (user data)
 * @param {Object} options - Additional token options
 * @returns {Object} Token data with expiration info
 */
function generateRefreshToken(payload, options = {}) {
  try {
    // Ensure payload is valid
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid payload provided for refresh token generation');
    }

    // Generate unique token ID for tracking
    const jti = crypto.randomUUID();

    // Prepare token payload with security metadata
    const tokenPayload = {
      userId: payload.userId, // Only store essential data in refresh token
      jti,
      type: 'refresh'
    };

    const tokenOptions = {
      expiresIn: options.expiresIn || jwtConfig.refreshToken.expiresIn,
      algorithm: jwtConfig.refreshToken.algorithm,
      issuer: 'CleanStreak-Auth'
    };

    const token = jwt.sign(tokenPayload, jwtConfig.refreshToken.secret, tokenOptions);

    // Calculate expiration timestamp
    const expiresIn = parseTokenExpiration(tokenOptions.expiresIn);
    const expiresAt = new Date(Date.now() + expiresIn);

    return {
      token,
      jti,
      expiresAt,
      expiresIn: Math.floor(expiresIn / 1000) // in seconds
    };
  } catch (error) {
    throw new Error(`Refresh token generation failed: ${error.message}`);
  }
}

/**
 * Verify and decode an access token
 * @param {string} token - JWT access token
 * @returns {Object} Decoded token payload
 */
function verifyAccessToken(token) {
  try {
    if (!token) {
      throw new Error('No token provided');
    }

    const decoded = jwt.verify(token, jwtConfig.accessToken.secret, {
      algorithms: [jwtConfig.accessToken.algorithm],
      issuer: 'CleanStreak-Auth'
    });

    // Verify token type
    if (decoded.type !== 'access') {
      throw new Error('Invalid token type - expected access token');
    }

    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Access token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid access token');
    } else if (error.name === 'NotBeforeError') {
      throw new Error('Access token not active yet');
    }
    throw new Error(`Access token verification failed: ${error.message}`);
  }
}

/**
 * Verify and decode a refresh token
 * @param {string} token - JWT refresh token
 * @returns {Object} Decoded token payload
 */
function verifyRefreshToken(token) {
  try {
    if (!token) {
      throw new Error('No token provided');
    }

    const decoded = jwt.verify(token, jwtConfig.refreshToken.secret, {
      algorithms: [jwtConfig.refreshToken.algorithm],
      issuer: 'CleanStreak-Auth'
    });

    // Verify token type
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type - expected refresh token');
    }

    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Refresh token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid refresh token');
    } else if (error.name === 'NotBeforeError') {
      throw new Error('Refresh token not active yet');
    }
    throw new Error(`Refresh token verification failed: ${error.message}`);
  }
}

/**
 * Decode token without verification (for debugging/logging)
 * @param {string} token - JWT token
 * @returns {Object} Decoded token payload (unverified)
 */
function decodeToken(token) {
  try {
    if (!token) {
      throw new Error('No token provided');
    }

    return jwt.decode(token, { complete: true });
  } catch (error) {
    throw new Error(`Token decode failed: ${error.message}`);
  }
}

/**
 * Check if a token is expired without verification
 * @param {string} token - JWT token
 * @returns {boolean} True if token is expired
 */
function isTokenExpired(token) {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) {
      return true;
    }

    return Date.now() >= decoded.exp * 1000;
  } catch (error) {
    return true; // Treat decode errors as expired
  }
}

/**
 * Extract token from various sources (headers, cookies, query)
 * @param {Object} req - Express request object
 * @returns {string|null} Extracted token or null
 */
function extractToken(req) {
  // Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check cookies
  if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken;
  }

  // Check query parameter (for specific use cases)
  if (req.query && req.query.token) {
    return req.query.token;
  }

  return null;
}

/**
 * Extract refresh token from request
 * @param {Object} req - Express request object
 * @returns {string|null} Extracted refresh token or null
 */
function extractRefreshToken(req) {
  // Check cookies (primary method for refresh tokens)
  if (req.cookies && req.cookies.refreshToken) {
    return req.cookies.refreshToken;
  }

  // Check request body for refresh operations
  if (req.body && req.body.refreshToken) {
    return req.body.refreshToken;
  }

  return null;
}

/**
 * Generate secure cookie options for tokens
 * @param {Object} options - Additional cookie options
 * @returns {Object} Cookie configuration
 */
function generateCookieOptions(options = {}) {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    ...jwtConfig.cookieOptions,
    ...options,
    httpOnly: true, // Always enforce httpOnly for security
    secure: isProduction, // Always use secure in production (required for sameSite: 'none')
    sameSite: isProduction ? 'none' : 'lax' // Use 'none' for cross-domain in production, 'lax' for development
  };
}

/**
 * Set authentication cookies on response
 * @param {Object} res - Express response object
 * @param {string} accessToken - Access token
 * @param {string} refreshToken - Refresh token
 * @param {Object} options - Additional cookie options
 */
function setAuthCookies(res, accessToken, refreshToken, options = {}) {
  try {
    const cookieOptions = generateCookieOptions(options);

    // Set access token cookie (shorter expiration)
    res.cookie('accessToken', accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    // Set refresh token cookie (longer expiration)
    res.cookie('refreshToken', refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
  } catch (error) {
    throw new Error(`Failed to set auth cookies: ${error.message}`);
  }
}

/**
 * Clear authentication cookies
 * @param {Object} res - Express response object
 */
function clearAuthCookies(res) {
  try {
    const cookieOptions = generateCookieOptions();

    // Remove maxAge to avoid Express deprecation warning
    // clearCookie automatically expires cookies immediately in Express 4.x and 5.x
    const { maxAge, ...clearOptions } = cookieOptions;

    res.clearCookie('accessToken', clearOptions);
    res.clearCookie('refreshToken', clearOptions);
  } catch (error) {
    throw new Error(`Failed to clear auth cookies: ${error.message}`);
  }
}

/**
 * Parse token expiration string to milliseconds
 * @param {string} expiration - Expiration string (e.g., '15m', '7d')
 * @returns {number} Expiration in milliseconds
 */
function parseTokenExpiration(expiration) {
  const match = expiration.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error('Invalid expiration format');
  }

  const value = parseInt(match[1]);
  const unit = match[2];

  const multipliers = {
    s: 1000,          // seconds
    m: 60 * 1000,     // minutes
    h: 60 * 60 * 1000,    // hours
    d: 24 * 60 * 60 * 1000 // days
  };

  return value * multipliers[unit];
}

/**
 * Generate token pair (access + refresh)
 * @param {Object} payload - User payload
 * @param {Object} options - Token options
 * @returns {Object} Access and refresh token data
 */
function generateTokenPair(payload, options = {}) {
  try {
    const accessTokenData = generateAccessToken(payload, options.accessToken);
    const refreshTokenData = generateRefreshToken(payload, options.refreshToken);

    return {
      accessToken: accessTokenData,
      refreshToken: refreshTokenData
    };
  } catch (error) {
    throw new Error(`Token pair generation failed: ${error.message}`);
  }
}

/**
 * Validate token payload structure
 * @param {Object} payload - Token payload to validate
 * @returns {boolean} True if payload is valid
 */
function validateTokenPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  // Required fields for access tokens (including tokenVersion for security)
  const requiredFields = ['userId', 'tokenVersion'];
  return requiredFields.every(field => payload.hasOwnProperty(field)) &&
         typeof payload.tokenVersion === 'number';
}

/**
 * Get token expiration time remaining
 * @param {string} token - JWT token
 * @returns {number} Time remaining in milliseconds
 */
function getTokenTimeRemaining(token) {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) {
      return 0;
    }

    const remaining = (decoded.exp * 1000) - Date.now();
    return Math.max(0, remaining);
  } catch (error) {
    return 0;
  }
}

module.exports = {
  // Token generation
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,

  // Token verification
  verifyAccessToken,
  verifyRefreshToken,

  // Token utilities
  decodeToken,
  isTokenExpired,
  extractToken,
  extractRefreshToken,
  validateTokenPayload,
  getTokenTimeRemaining,

  // Cookie management
  setAuthCookies,
  clearAuthCookies,
  generateCookieOptions,

  // Helper functions
  parseTokenExpiration
};