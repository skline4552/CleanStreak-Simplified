const express = require('express');
const TaskController = require('../controllers/taskController');
const { authenticate } = require('../middleware/auth');
const { userLimiters } = require('../middleware/rateLimiter');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/tasks/current
 * @desc    Get the current task from rotation
 * @access  Private
 */
router.get('/current', TaskController.getCurrentTask);

/**
 * @route   GET /api/tasks/preview
 * @desc    Preview upcoming tasks in rotation
 * @access  Private
 * @query   limit (optional, default 20, max 50)
 */
router.get('/preview', TaskController.previewTasks);

/**
 * @route   POST /api/tasks/regenerate
 * @desc    Force regeneration of task rotation (admin/debug)
 * @access  Private
 */
router.post('/regenerate', userLimiters.roomConfig, TaskController.regenerateRotation);

module.exports = router;
