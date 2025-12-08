const express = require('express');
const AuthController = require('../controllers/authController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { authLimiters } = require('../middleware/rateLimiter');

const router = express.Router();

// Note: Rate limiting is now handled at the app level in app.js
// This eliminates duplicate rate limiters and ensures test environment
// detection works correctly with our wrapped createRateLimiter function

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 * @body    { email, password, username }
 */
router.post('/register', AuthController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 * @body    { email, password }
 */
router.post('/login', AuthController.login);

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
router.post('/refresh', AuthController.refresh);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user information
 * @access  Private (requires valid access token)
 */
router.get('/me', authenticate, AuthController.me);

/**
 * @route   GET /api/auth/verify-email
 * @desc    Verify email address with token
 * @access  Public
 * @query   { token }
 */
router.get('/verify-email', AuthController.verifyEmail);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend email verification link
 * @access  Public
 * @body    { email }
 */
router.post('/resend-verification', authLimiters.verificationResend, AuthController.resendVerification);

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
      'GET /api/auth/me',
      'GET /api/auth/verify-email',
      'POST /api/auth/resend-verification'
    ]
  });
});

module.exports = router;