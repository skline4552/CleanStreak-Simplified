const { PrismaClient } = require('@prisma/client');
const { validateTaskName, sanitizeString } = require('../utils/validation');
const { createId } = require('@paralleldrive/cuid2');

/**
 * Streak Service
 *
 * Business logic for managing user streaks, task completions, and related analytics.
 * Handles data validation, streak calculations, and database operations.
 */

class StreakService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Get user's current streaks for all tasks
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of user streaks
   */
  async getUserStreaks(userId) {
    try {
      const streaks = await this.prisma.user_streaks.findMany({
        where: {
          user_id: userId
        },
        orderBy: [
          { current_streak: 'desc' },
          { task_name: 'asc' }
        ]
      });

      return streaks.map(streak => ({
        id: streak.id,
        taskName: streak.task_name,
        currentStreak: streak.current_streak,
        bestStreak: streak.best_streak,
        lastCompleted: streak.last_completed,
        createdAt: streak.created_at,
        updatedAt: streak.updated_at
      }));
    } catch (error) {
      console.error('Error fetching user streaks:', error);
      throw new Error('Failed to fetch user streaks');
    }
  }

  /**
   * Get specific streak for a user and task
   * @param {string} userId - User ID
   * @param {string} taskName - Task name
   * @returns {Promise<Object|null>} Streak data or null if not found
   */
  async getUserStreak(userId, taskName) {
    try {
      // Validate and sanitize task name
      if (!validateTaskName(taskName)) {
        throw new Error('Invalid task name format');
      }

      const sanitizedTaskName = sanitizeString(taskName);

      const streak = await this.prisma.user_streaks.findUnique({
        where: {
          user_id_task_name: {
            user_id: userId,
            task_name: sanitizedTaskName
          }
        }
      });

      if (!streak) {
        return null;
      }

      return {
        id: streak.id,
        taskName: streak.task_name,
        currentStreak: streak.current_streak,
        bestStreak: streak.best_streak,
        lastCompleted: streak.last_completed,
        createdAt: streak.created_at,
        updatedAt: streak.updated_at
      };
    } catch (error) {
      console.error('Error fetching user streak:', error);
      throw new Error('Failed to fetch user streak');
    }
  }

  /**
   * Complete a task for a user and update streak
   * @param {string} userId - User ID
   * @param {string} taskName - Task name
   * @param {Date} completionDate - Completion date (optional, defaults to now)
   * @param {string} notes - Optional notes for the completion
   * @returns {Promise<Object>} Updated streak and completion data
   */
  async completeTask(userId, taskName, completionDate = new Date(), notes = null) {
    try {
      // Validate inputs
      if (!validateTaskName(taskName)) {
        throw new Error('Invalid task name format');
      }

      const sanitizedTaskName = sanitizeString(taskName);
      const sanitizedNotes = notes ? sanitizeString(notes) : null;

      // Normalize completion date to start of day for streak calculations
      const completionDay = new Date(completionDate);
      completionDay.setHours(0, 0, 0, 0);

      // Check if task was already completed today
      const existingCompletion = await this.prisma.completion_history.findFirst({
        where: {
          user_id: userId,
          task_name: sanitizedTaskName,
          completed_date: {
            gte: completionDay,
            lt: new Date(completionDay.getTime() + 24 * 60 * 60 * 1000)
          }
        }
      });

      if (existingCompletion) {
        throw new Error('Task already completed today');
      }

      // Get or create user streak
      let userStreak = await this.prisma.user_streaks.findUnique({
        where: {
          user_id_task_name: {
            user_id: userId,
            task_name: sanitizedTaskName
          }
        }
      });

      let newStreak = 1;
      let newBestStreak = 1;

      if (userStreak) {
        // Calculate new streak
        const lastCompletedDay = userStreak.last_completed ?
          new Date(userStreak.last_completed.getTime()) : null;

        if (lastCompletedDay) {
          lastCompletedDay.setHours(0, 0, 0, 0);
          const daysDiff = Math.floor((completionDay - lastCompletedDay) / (24 * 60 * 60 * 1000));

          if (daysDiff === 1) {
            // Consecutive day - increment streak
            newStreak = userStreak.current_streak + 1;
          } else if (daysDiff === 0) {
            // Same day (shouldn't happen due to check above, but safety net)
            throw new Error('Task already completed today');
          } else {
            // Gap in streak - reset to 1
            newStreak = 1;
          }
        }

        newBestStreak = Math.max(userStreak.best_streak, newStreak);
      }

      // Use transaction to ensure data consistency
      const result = await this.prisma.$transaction(async (tx) => {
        // Update or create user streak
        const updatedStreak = await tx.user_streaks.upsert({
          where: {
            user_id_task_name: {
              user_id: userId,
              task_name: sanitizedTaskName
            }
          },
          update: {
            current_streak: newStreak,
            best_streak: newBestStreak,
            last_completed: completionDate,
            updated_at: new Date()
          },
          create: {
            id: createId(),
            user_id: userId,
            task_name: sanitizedTaskName,
            current_streak: newStreak,
            best_streak: newBestStreak,
            last_completed: completionDate,
            created_at: new Date(),
            updated_at: new Date()
          }
        });

        // Create completion history entry
        const completion = await tx.completion_history.create({
          data: {
            id: createId(),
            user_id: userId,
            task_name: sanitizedTaskName,
            completed_date: completionDate,
            streak_day: newStreak,
            notes: sanitizedNotes,
            created_at: new Date()
          }
        });

        return { updatedStreak, completion };
      });

      return {
        streak: {
          id: result.updatedStreak.id,
          taskName: result.updatedStreak.task_name,
          currentStreak: result.updatedStreak.current_streak,
          bestStreak: result.updatedStreak.best_streak,
          lastCompleted: result.updatedStreak.last_completed,
          createdAt: result.updatedStreak.created_at,
          updatedAt: result.updatedStreak.updated_at
        },
        completion: {
          id: result.completion.id,
          taskName: result.completion.task_name,
          completedDate: result.completion.completed_date,
          streakDay: result.completion.streak_day,
          notes: result.completion.notes,
          createdAt: result.completion.created_at
        }
      };
    } catch (error) {
      console.error('Error completing task:', error);
      throw error; // Re-throw to preserve specific error messages
    }
  }

  /**
   * Get completion history for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options (limit, offset, taskName, startDate, endDate)
   * @returns {Promise<Object>} Completion history with pagination info
   */
  async getCompletionHistory(userId, options = {}) {
    try {
      const {
        limit = 50,
        offset = 0,
        taskName = null,
        startDate = null,
        endDate = null
      } = options;

      // Build where clause
      const where = { user_id: userId };

      if (taskName) {
        if (!validateTaskName(taskName)) {
          throw new Error('Invalid task name format');
        }
        where.task_name = sanitizeString(taskName);
      }

      if (startDate || endDate) {
        where.completed_date = {};
        if (startDate) {
          where.completed_date.gte = new Date(startDate);
        }
        if (endDate) {
          where.completed_date.lte = new Date(endDate);
        }
      }

      // Get completions with pagination
      const [completions, totalCount] = await Promise.all([
        this.prisma.completion_history.findMany({
          where,
          orderBy: { completed_date: 'desc' },
          take: limit,
          skip: offset
        }),
        this.prisma.completion_history.count({ where })
      ]);

      return {
        completions: completions.map(completion => ({
          id: completion.id,
          task_name: completion.task_name,  // Keep snake_case for API consistency
          completed_date: completion.completed_date,
          streak_day: completion.streak_day,
          notes: completion.notes,
          created_at: completion.created_at
        })),
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount
        }
      };
    } catch (error) {
      console.error('Error fetching completion history:', error);
      throw new Error('Failed to fetch completion history');
    }
  }

  /**
   * Get streak statistics for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Streak statistics
   */
  async getStreakStats(userId) {
    try {
      const [streaks, totalCompletions, uniqueTasks] = await Promise.all([
        this.prisma.user_streaks.findMany({
          where: { user_id: userId }
        }),
        this.prisma.completion_history.count({
          where: { user_id: userId }
        }),
        this.prisma.completion_history.groupBy({
          by: ['task_name'],
          where: { user_id: userId }
        })
      ]);

      const activeStreaks = streaks.filter(s => s.current_streak > 0);
      const bestOverallStreak = Math.max(...streaks.map(s => s.best_streak), 0);
      const totalCurrentStreak = activeStreaks.reduce((sum, s) => sum + s.current_streak, 0);

      return {
        totalCompletions,
        uniqueTasks: uniqueTasks.length,
        activeStreaks: activeStreaks.length,
        totalStreaks: streaks.length,
        bestOverallStreak,
        totalCurrentStreak,
        averageStreakLength: streaks.length > 0 ?
          streaks.reduce((sum, s) => sum + s.best_streak, 0) / streaks.length : 0
      };
    } catch (error) {
      console.error('Error fetching streak stats:', error);
      throw new Error('Failed to fetch streak statistics');
    }
  }

  /**
   * Delete a completion (admin function or undo)
   * @param {string} userId - User ID
   * @param {string} completionId - Completion ID to delete
   * @returns {Promise<Object>} Result of deletion
   */
  async deleteCompletion(userId, completionId) {
    try {
      // Get the completion to verify ownership and get task info
      const completion = await this.prisma.completion_history.findUnique({
        where: { id: completionId }
      });

      if (!completion) {
        throw new Error('Completion not found');
      }

      if (completion.user_id !== userId) {
        throw new Error('Unauthorized: Cannot delete another user\'s completion');
      }

      // Delete the completion and recalculate streak
      await this.prisma.$transaction(async (tx) => {
        // Delete the completion
        await tx.completion_history.delete({
          where: { id: completionId }
        });

        // Recalculate streak for this task
        await this._recalculateStreak(tx, userId, completion.task_name);
      });

      return { success: true, message: 'Completion deleted successfully' };
    } catch (error) {
      console.error('Error deleting completion:', error);
      throw error;
    }
  }

  /**
   * Recalculate streak for a specific user and task
   * @private
   * @param {Object} tx - Prisma transaction object
   * @param {string} userId - User ID
   * @param {string} taskName - Task name
   */
  async _recalculateStreak(tx, userId, taskName) {
    // Get all completions for this task, ordered by date
    const completions = await tx.completion_history.findMany({
      where: {
        user_id: userId,
        task_name: taskName
      },
      orderBy: { completed_date: 'desc' }
    });

    if (completions.length === 0) {
      // No completions left, delete the streak
      await tx.user_streaks.delete({
        where: {
          user_id_task_name: {
            user_id: userId,
            task_name: taskName
          }
        }
      });
      return;
    }

    // Calculate current streak and best streak
    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;
    let lastDate = null;

    for (let i = 0; i < completions.length; i++) {
      const completion = completions[i];
      const completionDay = new Date(completion.completed_date);
      completionDay.setHours(0, 0, 0, 0);

      if (i === 0) {
        // First (most recent) completion
        tempStreak = 1;
        lastDate = completionDay;

        // Check if it's recent enough to count as current streak
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor((today - completionDay) / (24 * 60 * 60 * 1000));

        if (daysDiff <= 1) { // Today or yesterday
          currentStreak = 1;
        }
      } else {
        // Check if consecutive with previous
        const daysDiff = Math.floor((lastDate - completionDay) / (24 * 60 * 60 * 1000));

        if (daysDiff === 1) {
          // Consecutive day
          tempStreak++;
          if (i === 1 && currentStreak > 0) {
            // Still part of current streak
            currentStreak = tempStreak;
          }
        } else {
          // Gap - update best streak and reset temp
          bestStreak = Math.max(bestStreak, tempStreak);
          tempStreak = 1;
          if (currentStreak === 0) {
            // No current streak established yet
            currentStreak = 0;
          }
        }

        lastDate = completionDay;
      }
    }

    // Final best streak update
    bestStreak = Math.max(bestStreak, tempStreak);

    // Update the streak
    await tx.user_streaks.update({
      where: {
        user_id_task_name: {
          user_id: userId,
          task_name: taskName
        }
      },
      data: {
        current_streak: currentStreak,
        best_streak: bestStreak,
        last_completed: completions[0].completed_date,
        updated_at: new Date()
      }
    });
  }

  /**
   * Clean up old completion history (for maintenance)
   * @param {number} daysToKeep - Number of days of history to keep
   * @returns {Promise<number>} Number of records deleted
   */
  async cleanupOldCompletions(daysToKeep = 365) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await this.prisma.completion_history.deleteMany({
        where: {
          completed_date: {
            lt: cutoffDate
          }
        }
      });

      return result.count;
    } catch (error) {
      console.error('Error cleaning up old completions:', error);
      throw new Error('Failed to cleanup old completions');
    }
  }

  /**
   * Close database connection
   */
  async disconnect() {
    await this.prisma.$disconnect();
  }
}

module.exports = StreakService;