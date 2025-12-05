const express = require('express');
const KeystoneController = require('../controllers/keystoneController');
const { authenticate } = require('../middleware/auth');
const { userLimiters } = require('../middleware/rateLimiter');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/keystone-tasks
 * @desc    Get all user's keystone task configurations
 * @access  Private
 * @query   active_only (optional boolean)
 */
router.get('/', KeystoneController.getUserKeystones);

/**
 * @route   POST /api/keystone-tasks/initialize
 * @desc    Initialize keystone tasks for user (first-time setup)
 * @access  Private
 * @body    { activeKeystones?: string[] } - Array of keystone types to enable
 */
router.post('/initialize', userLimiters.roomConfig, KeystoneController.initializeKeystones);

/**
 * @route   PUT /api/keystone-tasks/:id
 * @desc    Update a keystone task configuration
 * @access  Private
 * @body    { customName?, isActive?, sortOrder? }
 */
router.put('/:id', userLimiters.roomConfig, KeystoneController.updateKeystone);

module.exports = router;
