const StreakService = require('../services/streakService');
const { validateTaskName, sanitizeString } = require('../utils/validation');

/**
 * User Controller
 *
 * Handles HTTP requests for user-related operations including streak management,
 * task completions, and user data retrieval.
 */

class UserController {
  constructor() {
    this.streakService = new StreakService();

    // Bind methods to preserve 'this' context
    this.getStreaks = this.getStreaks.bind(this);
    this.getStreak = this.getStreak.bind(this);
    this.completeTask = this.completeTask.bind(this);
    this.getHistory = this.getHistory.bind(this);
    this.getStats = this.getStats.bind(this);
    this.deleteCompletion = this.deleteCompletion.bind(this);
    this.getProfile = this.getProfile.bind(this);
    this.bulkCompleteTask = this.bulkCompleteTask.bind(this);
  }

  /**
   * Get all streaks for the authenticated user
   * GET /api/user/streaks
   */
  async getStreaks(req, res) {
    try {
      const userId = req.user.userId;
      const streaks = await this.streakService.getUserStreaks(userId);

      res.status(200).json({
        success: true,
        data: {
          streaks,
          count: streaks.length
        },
        message: 'Streaks retrieved successfully'
      });
    } catch (error) {
      console.error('Error in getStreaks:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'STREAK_FETCH_ERROR',
        message: 'Failed to retrieve user streaks'
      });
    }
  }

  /**
   * Get specific streak for a task
   * GET /api/user/streak/:taskName
   */
  async getStreak(req, res) {
    try {
      const userId = req.user.userId;
      const { taskName } = req.params;

      if (!taskName) {
        return res.status(400).json({
          error: 'Bad request',
          code: 'MISSING_TASK_NAME',
          message: 'Task name is required'
        });
      }

      const streak = await this.streakService.getUserStreak(userId, taskName);

      if (!streak) {
        return res.status(404).json({
          error: 'Not found',
          code: 'STREAK_NOT_FOUND',
          message: 'Streak not found for this task'
        });
      }

      res.status(200).json({
        success: true,
        data: { streak },
        message: 'Streak retrieved successfully'
      });
    } catch (error) {
      console.error('Error in getStreak:', error);

      if (error.message.includes('Invalid task name')) {
        return res.status(400).json({
          error: 'Bad request',
          code: 'INVALID_TASK_NAME',
          message: 'Invalid task name format'
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        code: 'STREAK_FETCH_ERROR',
        message: 'Failed to retrieve streak'
      });
    }
  }

  /**
   * Complete a task and update streak
   * POST /api/user/complete
   */
  async completeTask(req, res) {
    try {
      const userId = req.user.userId;
      const { taskName, completionDate, notes } = req.body;

      if (!taskName) {
        return res.status(400).json({
          error: 'Bad request',
          code: 'MISSING_TASK_NAME',
          message: 'Task name is required'
        });
      }

      // Validate completion date if provided
      let parsedDate = new Date();
      if (completionDate) {
        parsedDate = new Date(completionDate);
        if (isNaN(parsedDate.getTime())) {
          return res.status(400).json({
            error: 'Bad request',
            code: 'INVALID_DATE',
            message: 'Invalid completion date format'
          });
        }

        // Don't allow future dates
        if (parsedDate > new Date()) {
          return res.status(400).json({
            error: 'Bad request',
            code: 'FUTURE_DATE',
            message: 'Completion date cannot be in the future'
          });
        }
      }

      const result = await this.streakService.completeTask(
        userId,
        taskName,
        parsedDate,
        notes
      );

      res.status(201).json({
        success: true,
        data: result,
        message: 'Task completed successfully'
      });
    } catch (error) {
      console.error('Error in completeTask:', error);

      if (error.message.includes('Invalid task name')) {
        return res.status(400).json({
          error: 'Bad request',
          code: 'INVALID_TASK_NAME',
          message: 'Invalid task name format'
        });
      }

      if (error.message.includes('already completed today')) {
        return res.status(409).json({
          error: 'Conflict',
          code: 'TASK_ALREADY_COMPLETED',
          message: 'Task has already been completed today'
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        code: 'TASK_COMPLETION_ERROR',
        message: 'Failed to complete task'
      });
    }
  }

  /**
   * Get completion history for the user
   * GET /api/user/history
   */
  async getHistory(req, res) {
    try {
      const userId = req.user.userId;
      const {
        limit = 50,
        offset = 0,
        taskName,
        startDate,
        endDate
      } = req.query;

      // Validate pagination parameters
      const parsedLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
      const parsedOffset = Math.max(parseInt(offset) || 0, 0);

      // Validate dates if provided
      let parsedStartDate, parsedEndDate;
      if (startDate) {
        parsedStartDate = new Date(startDate);
        if (isNaN(parsedStartDate.getTime())) {
          return res.status(400).json({
            error: 'Bad request',
            code: 'INVALID_START_DATE',
            message: 'Invalid start date format'
          });
        }
      }

      if (endDate) {
        parsedEndDate = new Date(endDate);
        if (isNaN(parsedEndDate.getTime())) {
          return res.status(400).json({
            error: 'Bad request',
            code: 'INVALID_END_DATE',
            message: 'Invalid end date format'
          });
        }
      }

      const options = {
        limit: parsedLimit,
        offset: parsedOffset,
        taskName: taskName || null,
        startDate: parsedStartDate,
        endDate: parsedEndDate
      };

      const result = await this.streakService.getCompletionHistory(userId, options);

      res.status(200).json({
        success: true,
        data: result,
        message: 'History retrieved successfully'
      });
    } catch (error) {
      console.error('Error in getHistory:', error);

      if (error.message.includes('Invalid task name')) {
        return res.status(400).json({
          error: 'Bad request',
          code: 'INVALID_TASK_NAME',
          message: 'Invalid task name format'
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        code: 'HISTORY_FETCH_ERROR',
        message: 'Failed to retrieve completion history'
      });
    }
  }

  /**
   * Get streak statistics for the user
   * GET /api/user/stats
   */
  async getStats(req, res) {
    try {
      const userId = req.user.userId;
      const stats = await this.streakService.getStreakStats(userId);

      res.status(200).json({
        success: true,
        data: { stats },
        message: 'Statistics retrieved successfully'
      });
    } catch (error) {
      console.error('Error in getStats:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'STATS_FETCH_ERROR',
        message: 'Failed to retrieve statistics'
      });
    }
  }

  /**
   * Delete a completion (undo)
   * DELETE /api/user/completion/:completionId
   */
  async deleteCompletion(req, res) {
    try {
      const userId = req.user.userId;
      const { completionId } = req.params;

      if (!completionId) {
        return res.status(400).json({
          error: 'Bad request',
          code: 'MISSING_COMPLETION_ID',
          message: 'Completion ID is required'
        });
      }

      const result = await this.streakService.deleteCompletion(userId, completionId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Completion deleted successfully'
      });
    } catch (error) {
      console.error('Error in deleteCompletion:', error);

      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Not found',
          code: 'COMPLETION_NOT_FOUND',
          message: 'Completion not found'
        });
      }

      if (error.message.includes('Unauthorized')) {
        return res.status(403).json({
          error: 'Forbidden',
          code: 'UNAUTHORIZED_DELETE',
          message: 'Cannot delete another user\'s completion'
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        code: 'COMPLETION_DELETE_ERROR',
        message: 'Failed to delete completion'
      });
    }
  }

  /**
   * Get user profile information
   * GET /api/user/profile
   */
  async getProfile(req, res) {
    try {
      const userId = req.user.userId;
      const email = req.user.email;

      // Get basic stats for the profile
      const stats = await this.streakService.getStreakStats(userId);

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: userId,
            email: email
          },
          stats
        },
        message: 'Profile retrieved successfully'
      });
    } catch (error) {
      console.error('Error in getProfile:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'PROFILE_FETCH_ERROR',
        message: 'Failed to retrieve user profile'
      });
    }
  }

  /**
   * Bulk complete multiple tasks
   * POST /api/user/bulk-complete
   */
  async bulkCompleteTask(req, res) {
    try {
      const userId = req.user.userId;
      const { tasks, completionDate } = req.body;

      if (!Array.isArray(tasks) || tasks.length === 0) {
        return res.status(400).json({
          error: 'Bad request',
          code: 'INVALID_TASKS',
          message: 'Tasks must be a non-empty array'
        });
      }

      if (tasks.length > 10) {
        return res.status(400).json({
          error: 'Bad request',
          code: 'TOO_MANY_TASKS',
          message: 'Maximum 10 tasks can be completed at once'
        });
      }

      // Validate completion date if provided
      let parsedDate = new Date();
      if (completionDate) {
        parsedDate = new Date(completionDate);
        if (isNaN(parsedDate.getTime()) || parsedDate > new Date()) {
          return res.status(400).json({
            error: 'Bad request',
            code: 'INVALID_DATE',
            message: 'Invalid completion date format or future date'
          });
        }
      }

      const results = [];
      const errors = [];

      // Complete each task
      for (const taskData of tasks) {
        try {
          const { taskName, notes } = taskData;
          if (!taskName) {
            errors.push({ taskName: 'unknown', error: 'Task name is required' });
            continue;
          }

          const result = await this.streakService.completeTask(
            userId,
            taskName,
            parsedDate,
            notes
          );
          results.push({ taskName, result });
        } catch (error) {
          errors.push({ taskName: taskData.taskName, error: error.message });
        }
      }

      res.status(200).json({
        success: true,
        data: {
          completed: results,
          errors: errors,
          summary: {
            total: tasks.length,
            successful: results.length,
            failed: errors.length
          }
        },
        message: `Bulk completion finished: ${results.length} successful, ${errors.length} failed`
      });
    } catch (error) {
      console.error('Error in bulkCompleteTask:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'BULK_COMPLETION_ERROR',
        message: 'Failed to complete bulk tasks'
      });
    }
  }
}

module.exports = new UserController();