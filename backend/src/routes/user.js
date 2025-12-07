const express = require('express');
const userController = require('../controllers/userController');
const { authenticate, authRateLimit } = require('../middleware/auth');

/**
 * User Routes
 *
 * Defines API endpoints for user-related operations including streak management,
 * task completions, and user data operations. All routes require authentication.
 */

const router = express.Router();

// Apply authentication middleware to all user routes
router.use(authenticate);

/**
 * Streak Management Routes
 */

// Get all user streaks
// GET /api/user/streaks
router.get('/streaks', userController.getStreaks);

// Get specific streak for a task
// GET /api/user/streak/:taskName
router.get('/streak/:taskName', userController.getStreak);

/**
 * Task Completion Routes
 */

// Complete a single task
// POST /api/user/complete
// Rate limited to prevent abuse
router.post('/complete',
  authRateLimit({ type: 'general', max: 30, windowMs: 15 * 60 * 1000 }), // 30 per 15 minutes
  userController.completeTask
);

// Bulk complete multiple tasks
// POST /api/user/bulk-complete
// More restrictive rate limiting for bulk operations
router.post('/bulk-complete',
  authRateLimit({ type: 'general', max: 5, windowMs: 15 * 60 * 1000 }), // 5 per 15 minutes
  userController.bulkCompleteTask
);

/**
 * History and Analytics Routes
 */

// Get completion history with pagination and filtering
// GET /api/user/history?limit=50&offset=0&taskName=&startDate=&endDate=
router.get('/history', userController.getHistory);

// Get user streak statistics
// GET /api/user/stats
router.get('/stats', userController.getStats);

/**
 * User Profile Routes
 */

// Get user profile information
// GET /api/user/profile
router.get('/profile', userController.getProfile);

/**
 * Account Management Routes
 */

// Get account summary and data storage information
// GET /api/user/account
router.get('/account', userController.getAccountSummary);

// Export user data in JSON format
// GET /api/user/export
// Rate limited for security
router.get('/export',
  authRateLimit({ type: 'general', max: 5, windowMs: 60 * 60 * 1000 }), // 5 per hour
  userController.exportData
);

// Change user password
// POST /api/user/change-password
// Rate limited for security
router.post('/change-password',
  authRateLimit({ type: 'general', max: 5, windowMs: 60 * 60 * 1000 }), // 5 per hour
  userController.changePassword
);

// Logout from all devices (invalidate all sessions)
// POST /api/user/logout-all
// Rate limited for security
router.post('/logout-all',
  authRateLimit({ type: 'general', max: 5, windowMs: 60 * 60 * 1000 }), // 5 per hour
  userController.logoutAllDevices
);

// Delete user account and all associated data
// DELETE /api/user/account
// Very restrictive rate limiting for security
router.delete('/account',
  authRateLimit({ type: 'general', max: 2, windowMs: 60 * 60 * 1000 }), // 2 per hour
  userController.deleteAccount
);

/**
 * Data Management Routes
 */

// Delete a specific completion (undo)
// DELETE /api/user/completion/:completionId
// Rate limited for safety
router.delete('/completion/:completionId',
  authRateLimit({ type: 'general', max: 10, windowMs: 15 * 60 * 1000 }), // 10 per 15 minutes
  userController.deleteCompletion
);

/**
 * Health Check Route
 */

// User service health check
// GET /api/user/health
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'user-api',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    user: {
      authenticated: true,
      userId: req.user?.userId || 'unknown'
    }
  });
});

/**
 * Route Documentation Endpoint
 */

// Get available routes and their descriptions
// GET /api/user/routes
router.get('/routes', (req, res) => {
  const routes = [
    {
      method: 'GET',
      path: '/api/user/streaks',
      description: 'Get all user streaks',
      authentication: 'required'
    },
    {
      method: 'GET',
      path: '/api/user/streak/:taskName',
      description: 'Get specific streak for a task',
      authentication: 'required',
      parameters: {
        taskName: 'Name of the task (URL encoded)'
      }
    },
    {
      method: 'POST',
      path: '/api/user/complete',
      description: 'Complete a single task',
      authentication: 'required',
      rateLimit: '30 requests per 15 minutes',
      body: {
        taskName: 'string (required)',
        completionDate: 'ISO date string (optional, defaults to now)',
        notes: 'string (optional)'
      }
    },
    {
      method: 'POST',
      path: '/api/user/bulk-complete',
      description: 'Complete multiple tasks at once',
      authentication: 'required',
      rateLimit: '5 requests per 15 minutes',
      body: {
        tasks: 'array of {taskName, notes} objects (max 10)',
        completionDate: 'ISO date string (optional, applies to all tasks)'
      }
    },
    {
      method: 'GET',
      path: '/api/user/history',
      description: 'Get completion history with pagination',
      authentication: 'required',
      queryParams: {
        limit: 'number (1-100, default 50)',
        offset: 'number (default 0)',
        taskName: 'string (optional filter)',
        startDate: 'ISO date string (optional filter)',
        endDate: 'ISO date string (optional filter)'
      }
    },
    {
      method: 'GET',
      path: '/api/user/stats',
      description: 'Get user streak statistics',
      authentication: 'required'
    },
    {
      method: 'GET',
      path: '/api/user/profile',
      description: 'Get user profile information',
      authentication: 'required'
    },
    {
      method: 'GET',
      path: '/api/user/account',
      description: 'Get account summary and data storage information',
      authentication: 'required'
    },
    {
      method: 'GET',
      path: '/api/user/export',
      description: 'Export user data in JSON format',
      authentication: 'required',
      rateLimit: '5 requests per hour',
      responseHeaders: {
        'Content-Disposition': 'attachment; filename with user ID and date'
      }
    },
    {
      method: 'DELETE',
      path: '/api/user/account',
      description: 'Delete user account and all associated data',
      authentication: 'required',
      rateLimit: '2 requests per hour',
      body: {
        email: 'string (required - must match account email)',
        confirmation: 'string (required - must be exactly "DELETE MY ACCOUNT")'
      },
      warning: 'This action is irreversible and will delete all user data'
    },
    {
      method: 'DELETE',
      path: '/api/user/completion/:completionId',
      description: 'Delete a specific completion (undo)',
      authentication: 'required',
      rateLimit: '10 requests per 15 minutes',
      parameters: {
        completionId: 'Completion ID to delete'
      }
    },
    {
      method: 'GET',
      path: '/api/user/health',
      description: 'User service health check',
      authentication: 'required'
    },
    {
      method: 'GET',
      path: '/api/user/routes',
      description: 'Get this route documentation',
      authentication: 'required'
    }
  ];

  res.status(200).json({
    success: true,
    data: {
      routes,
      totalRoutes: routes.length,
      baseUrl: '/api/user',
      authentication: 'All routes require valid JWT access token',
      rateLimit: 'Various rate limits applied based on endpoint sensitivity'
    },
    message: 'User API routes documentation'
  });
});

/**
 * Error handling for user routes
 */
router.use((error, req, res, next) => {
  console.error('User route error:', error);

  res.status(error.status || 500).json({
    error: 'User API error',
    code: error.code || 'USER_API_ERROR',
    message: error.message || 'An error occurred in the user API',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;