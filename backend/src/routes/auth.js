const express = require('express');
const rateLimit = require('express-rate-limit');
const AuthController = require('../controllers/authController');
const { authenticate, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs for auth endpoints
  message: {
    error: 'Too many authentication attempts',
    message: 'Please try again later',
    retryAfter: 15 * 60 // 15 minutes in seconds
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req) => {
    // Use combination of IP and email (if provided) for more granular limiting
    const email = req.body?.email || 'unknown';
    return `${req.ip}-${email}`;
  }
});

// More restrictive rate limiting for registration
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 registration attempts per hour
  message: {
    error: 'Too many registration attempts',
    message: 'Please try again in one hour',
    retryAfter: 60 * 60 // 1 hour in seconds
  },
  standardHeaders: true,
  legacyHeaders: false
});

// General rate limiting for other auth endpoints
const generalAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Allow more attempts for non-sensitive operations
  message: {
    error: 'Too many requests',
    message: 'Please try again later',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 * @body    { email, password, username }
 */
router.post('/register', registerLimiter, authLimiter, AuthController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 * @body    { email, password }
 */
router.post('/login', authLimiter, AuthController.login);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and invalidate session
 * @access  Public (but uses optional auth to get user info if available)
 */
router.post('/logout', optionalAuth, AuthController.logout);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh JWT tokens using refresh token
 * @access  Public (but requires valid refresh token)
 */
router.post('/refresh', generalAuthLimiter, AuthController.refresh);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user information
 * @access  Private (requires valid access token)
 */
router.get('/me', authenticate, AuthController.me);

// Health check endpoint for auth service
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'authentication',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /api/auth/register',
      'POST /api/auth/login',
      'POST /api/auth/logout',
      'POST /api/auth/refresh',
      'GET /api/auth/me'
    ]
  });
});

module.exports = router;