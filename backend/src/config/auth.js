const jwt = require('jsonwebtoken');

// JWT configuration
const jwtConfig = {
  // Access token configuration
  accessToken: {
    secret: process.env.JWT_SECRET || 'your-default-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    algorithm: 'HS256'
  },

  // Refresh token configuration
  refreshToken: {
    secret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-change-in-production',
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    algorithm: 'HS256'
  },

  // Cookie configuration for tokens
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict', // Always use strict for security
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
  }
};

// Password configuration
const passwordConfig = {
  saltRounds: 12,
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false
};

// Session configuration
const sessionConfig = {
  maxConcurrentSessions: 5, // Maximum number of concurrent sessions per user
  sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  extendSessionOnActivity: true
};

// Detect test environment for rate limiting adjustments
const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

// Rate limiting configuration for auth endpoints
const authRateLimit = {
  // Login attempts
  login: {
    windowMs: isTestEnv ? 60 * 1000 : 15 * 60 * 1000, // 1 minute in tests, 15 minutes in production
    max: 5, // 5 attempts per window
    skipSuccessfulRequests: true
  },

  // Registration attempts
  register: {
    windowMs: isTestEnv ? 60 * 1000 : 60 * 60 * 1000, // 1 minute in tests, 1 hour in production
    max: 3, // 3 registrations per hour per IP
    skipFailedRequests: true // Don't count validation failures, only successful registrations
  },

  // Password reset attempts
  passwordReset: {
    windowMs: isTestEnv ? 60 * 1000 : 60 * 60 * 1000, // 1 minute in tests, 1 hour in production
    max: 3, // 3 password reset attempts per hour
    skipSuccessfulRequests: true
  }
};

// Utility functions for JWT
const generateAccessToken = (payload) => {
  return jwt.sign(payload, jwtConfig.accessToken.secret, {
    expiresIn: jwtConfig.accessToken.expiresIn,
    algorithm: jwtConfig.accessToken.algorithm
  });
};

const generateRefreshToken = (payload) => {
  return jwt.sign(payload, jwtConfig.refreshToken.secret, {
    expiresIn: jwtConfig.refreshToken.expiresIn,
    algorithm: jwtConfig.refreshToken.algorithm
  });
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, jwtConfig.accessToken.secret);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, jwtConfig.refreshToken.secret);
};

module.exports = {
  jwtConfig,
  passwordConfig,
  sessionConfig,
  authRateLimit,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
};