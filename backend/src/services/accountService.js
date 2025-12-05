const { PrismaClient } = require('@prisma/client');
const { validateEmail, sanitizeString } = require('../utils/validation');
const StreakService = require('./streakService');

/**
 * Account Service
 *
 * Handles account management operations including data export, account deletion,
 * and data privacy compliance (GDPR, CCPA).
 */

class AccountService {
  constructor() {
    this.prisma = new PrismaClient();
    this.streakService = new StreakService();
  }

  /**
   * Export all user data in JSON format
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Complete user data export
   */
  async exportUserData(userId) {
    try {
      // Get user information
      const user = await this.prisma.users.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          created_at: true,
          last_login: true,
          email_verified: true,
          email_verified_at: true
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Get all user streaks
      const streaks = await this.prisma.user_streaks.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'asc' }
      });

      // Get all completion history
      const completions = await this.prisma.completion_history.findMany({
        where: { user_id: userId },
        orderBy: { completed_date: 'asc' }
      });

      // Get all user sessions (for audit purposes)
      const sessions = await this.prisma.user_sessions.findMany({
        where: { user_id: userId },
        select: {
          id: true,
          created_at: true,
          expires_at: true,
          last_accessed: true,
          is_active: true,
          device_info: true,
          ip_address: true
        },
        orderBy: { created_at: 'asc' }
      });

      // Calculate summary statistics
      const totalCompletions = completions.length;
      const uniqueTasks = [...new Set(completions.map(c => c.task_name))];
      const firstCompletion = completions.length > 0 ? completions[0].completed_date : null;
      const lastCompletion = completions.length > 0 ? completions[completions.length - 1].completed_date : null;
      const bestStreak = Math.max(...streaks.map(s => s.best_streak), 0);
      const currentActiveStreaks = streaks.filter(s => s.current_streak > 0).length;

      // Create comprehensive data export
      const exportData = {
        exportInfo: {
          exportDate: new Date().toISOString(),
          exportVersion: '1.0',
          userId: userId,
          dataRetentionNotice: 'This export contains all personal data stored in CleanStreak as of the export date.'
        },
        account: {
          id: user.id,
          email: user.email,
          accountCreated: user.created_at,
          lastLogin: user.last_login,
          emailVerified: user.email_verified,
          emailVerifiedAt: user.email_verified_at
        },
        streaks: streaks.map(streak => ({
          id: streak.id,
          taskName: streak.task_name,
          currentStreak: streak.current_streak,
          bestStreak: streak.best_streak,
          lastCompleted: streak.last_completed,
          createdAt: streak.created_at,
          updatedAt: streak.updated_at
        })),
        completionHistory: completions.map(completion => ({
          id: completion.id,
          taskName: completion.task_name,
          completedDate: completion.completed_date,
          streakDay: completion.streak_day,
          notes: completion.notes,
          createdAt: completion.created_at
        })),
        sessions: sessions.map(session => ({
          id: session.id,
          createdAt: session.created_at,
          expiresAt: session.expires_at,
          lastAccessed: session.last_accessed,
          isActive: session.is_active,
          deviceInfo: session.device_info,
          ipAddress: session.ip_address
        })),
        summary: {
          totalCompletions,
          uniqueTasks: uniqueTasks.length,
          uniqueTaskNames: uniqueTasks,
          totalStreaks: streaks.length,
          currentActiveStreaks,
          bestOverallStreak: bestStreak,
          accountDuration: user.created_at ? {
            startDate: user.created_at,
            daysActive: Math.floor((new Date() - new Date(user.created_at)) / (24 * 60 * 60 * 1000))
          } : null,
          activityPeriod: {
            firstCompletion,
            lastCompletion,
            totalDaysWithActivity: firstCompletion && lastCompletion ?
              Math.floor((new Date(lastCompletion) - new Date(firstCompletion)) / (24 * 60 * 60 * 1000)) + 1 : 0
          }
        }
      };

      return exportData;
    } catch (error) {
      console.error('Error exporting user data:', error);
      throw new Error('Failed to export user data');
    }
  }

  /**
   * Delete user account and all associated data
   * @param {string} userId - User ID
   * @param {string} email - User email for verification
   * @returns {Promise<Object>} Deletion result with summary
   */
  async deleteUserAccount(userId, email) {
    try {
      // Verify user exists and email matches
      const user = await this.prisma.users.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (user.email !== email) {
        throw new Error('Email verification failed');
      }

      // Perform complete data deletion in transaction
      const deletionResult = await this.prisma.$transaction(async (tx) => {
        // Count records before deletion for summary
        const [
          completionCount,
          streakCount,
          sessionCount
        ] = await Promise.all([
          tx.completion_history.count({ where: { user_id: userId } }),
          tx.user_streaks.count({ where: { user_id: userId } }),
          tx.user_sessions.count({ where: { user_id: userId } })
        ]);

        // Delete all user data in proper order (respect foreign key constraints)

        // 1. Delete completion history
        await tx.completion_history.deleteMany({
          where: { user_id: userId }
        });

        // 2. Delete user streaks
        await tx.user_streaks.deleteMany({
          where: { user_id: userId }
        });

        // 3. Delete user sessions
        await tx.user_sessions.deleteMany({
          where: { user_id: userId }
        });

        // 4. Delete user account (this will also cascade to any remaining related data)
        await tx.users.delete({
          where: { id: userId }
        });

        return {
          deletedUser: 1,
          deletedCompletions: completionCount,
          deletedStreaks: streakCount,
          deletedSessions: sessionCount,
          totalRecordsDeleted: 1 + completionCount + streakCount + sessionCount
        };
      });

      return {
        success: true,
        message: 'Account deleted successfully',
        deletionSummary: {
          userId: userId,
          email: email,
          deletedAt: new Date().toISOString(),
          recordsDeleted: deletionResult
        }
      };
    } catch (error) {
      console.error('Error deleting user account:', error);

      if (error.message.includes('User not found') || error.message.includes('Email verification failed')) {
        throw error; // Re-throw validation errors
      }

      throw new Error('Failed to delete user account');
    }
  }

  /**
   * Get account data summary (for account management UI)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Account data summary
   */
  async getAccountSummary(userId) {
    try {
      const user = await this.prisma.users.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          created_at: true,
          last_login: true
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Get data counts and streak data
      const [
        totalCompletions,
        totalStreaks,
        activeSessions,
        statsData,
        streaksData
      ] = await Promise.all([
        this.prisma.completion_history.count({ where: { user_id: userId } }),
        this.prisma.user_streaks.count({ where: { user_id: userId } }),
        this.prisma.user_sessions.count({
          where: {
            user_id: userId,
            is_active: true,
            expires_at: { gt: new Date() }
          }
        }),
        this.streakService.getStreakStats(userId),
        this.streakService.getUserStreaks(userId)
      ]);

      // Calculate account age
      const accountAge = user.created_at ?
        Math.floor((new Date() - new Date(user.created_at)) / (24 * 60 * 60 * 1000)) : 0;

      // Get primary streak
      const primaryStreak = streaksData[0];

      return {
        account: {
          user: {
            id: user.id,
            email: user.email,
            createdAt: user.created_at,
            lastLogin: user.last_login,
            accountAgeDays: accountAge
          },
          stats: {
            current_streak: primaryStreak?.currentStreak || 0,
            longest_streak: statsData.bestOverallStreak || 0,
            total_completions: statsData.totalCompletions || 0
          }
        },
        dataStorage: {
          totalCompletions,
          totalStreaks,
          activeSessions,
          estimatedStorageKB: Math.ceil(
            (totalCompletions * 0.5) + // ~0.5KB per completion
            (totalStreaks * 0.3) + // ~0.3KB per streak
            (activeSessions * 0.8) + // ~0.8KB per session
            1 // User record
          )
        },
        privacyOptions: {
          dataExportAvailable: true,
          accountDeletionAvailable: true,
          dataRetentionPeriod: '365 days for inactive accounts',
          gdprCompliant: true
        }
      };
    } catch (error) {
      console.error('Error getting account summary:', error);
      throw new Error('Failed to get account summary');
    }
  }

  /**
   * Anonymize user data (alternative to deletion for data retention compliance)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Anonymization result
   */
  async anonymizeUserData(userId) {
    try {
      const user = await this.prisma.users.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Anonymize user data while preserving statistical value
      const anonymizationResult = await this.prisma.$transaction(async (tx) => {
        // Generate anonymous identifier
        const anonymousId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Update user record with anonymized data
        await tx.users.update({
          where: { id: userId },
          data: {
            email: `${anonymousId}@anonymous.local`,
            password_hash: 'ANONYMIZED',
            updated_at: new Date()
          }
        });

        // Clear sensitive data from sessions
        await tx.user_sessions.updateMany({
          where: { user_id: userId },
          data: {
            ip_address: 'ANONYMIZED',
            device_info: 'ANONYMIZED'
          }
        });

        // Clear personal notes from completion history
        const notesUpdated = await tx.completion_history.updateMany({
          where: {
            user_id: userId,
            notes: { not: null }
          },
          data: {
            notes: '[ANONYMIZED]'
          }
        });

        return {
          anonymizedUser: 1,
          anonymizedSessions: await tx.user_sessions.count({ where: { user_id: userId } }),
          anonymizedNotes: notesUpdated.count
        };
      });

      return {
        success: true,
        message: 'User data anonymized successfully',
        anonymizationSummary: {
          originalUserId: userId,
          anonymizedAt: new Date().toISOString(),
          recordsAnonymized: anonymizationResult
        }
      };
    } catch (error) {
      console.error('Error anonymizing user data:', error);
      throw new Error('Failed to anonymize user data');
    }
  }

  /**
   * Clean up inactive user data (maintenance function)
   * @param {number} inactiveDays - Number of days of inactivity before cleanup
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupInactiveUsers(inactiveDays = 365) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);

      // Find users inactive for specified period
      const inactiveUsers = await this.prisma.users.findMany({
        where: {
          last_login: {
            lt: cutoffDate
          }
        },
        select: { id: true, email: true, last_login: true }
      });

      let cleanupResults = {
        usersProcessed: inactiveUsers.length,
        anonymized: 0,
        deleted: 0,
        errors: []
      };

      // Process each inactive user
      for (const user of inactiveUsers) {
        try {
          // Check if user has any activity (completions) in the past year
          const hasRecentActivity = await this.prisma.completion_history.findFirst({
            where: {
              user_id: user.id,
              completed_date: {
                gt: cutoffDate
              }
            }
          });

          if (hasRecentActivity) {
            // User has recent activity, anonymize instead of delete
            await this.anonymizeUserData(user.id);
            cleanupResults.anonymized++;
          } else {
            // No recent activity, safe to delete
            await this.deleteUserAccount(user.id, user.email);
            cleanupResults.deleted++;
          }
        } catch (error) {
          cleanupResults.errors.push({
            userId: user.id,
            email: user.email,
            error: error.message
          });
        }
      }

      return cleanupResults;
    } catch (error) {
      console.error('Error cleaning up inactive users:', error);
      throw new Error('Failed to cleanup inactive users');
    }
  }

  /**
   * Close database connection
   */
  async disconnect() {
    await this.prisma.$disconnect();
  }
}

module.exports = AccountService;