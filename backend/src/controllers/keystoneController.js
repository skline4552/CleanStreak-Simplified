const { prisma } = require('../config/prisma');
const KeystoneService = require('../services/keystoneService');
const { sanitizeString } = require('../utils/validation');

// Instantiate service
const keystoneService = new KeystoneService();

class KeystoneController {
  /**
   * Get all user's keystone task configurations
   * GET /api/keystone-tasks
   */
  static async getUserKeystones(req, res) {
    try {
      const { userId } = req.user;
      const activeOnly = req.query.active_only === 'true';

      const keystones = await keystoneService.getUserKeystones(userId, activeOnly);

      res.status(200).json({
        success: true,
        keystone_tasks: keystones
      });

    } catch (error) {
      console.error('Get user keystones error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve keystone tasks. Please try again.'
      });
    }
  }

  /**
   * Update a keystone task configuration
   * PUT /api/keystone-tasks/:id
   */
  static async updateKeystone(req, res) {
    try {
      const { userId } = req.user;
      const { id } = req.params;
      const updates = {};

      // Validate and sanitize updates
      if (req.body.customName !== undefined) {
        if (req.body.customName === null || req.body.customName === '') {
          updates.customName = null;
        } else {
          const sanitizedName = sanitizeString(req.body.customName);
          if (sanitizedName.length < 1 || sanitizedName.length > 100) {
            return res.status(400).json({
              error: 'Validation failed',
              message: 'Custom name must be between 1 and 100 characters'
            });
          }
          updates.customName = sanitizedName;
        }
      }

      if (req.body.isActive !== undefined) {
        updates.isActive = Boolean(req.body.isActive);
      }

      if (req.body.sortOrder !== undefined) {
        const sortOrder = parseInt(req.body.sortOrder, 10);
        if (isNaN(sortOrder) || sortOrder < 0) {
          return res.status(400).json({
            error: 'Validation failed',
            message: 'Sort order must be a non-negative integer'
          });
        }
        updates.sortOrder = sortOrder;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'No valid updates provided'
        });
      }

      const updatedKeystone = await keystoneService.updateKeystone(id, userId, updates);

      if (!updatedKeystone) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Keystone task not found or you do not have access to it'
        });
      }

      res.status(200).json({
        success: true,
        task: updatedKeystone,
        message: 'Keystone task updated. Changes will apply after completing current cycle.'
      });

    } catch (error) {
      console.error('Update keystone error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update keystone task. Please try again.'
      });
    }
  }
}

module.exports = KeystoneController;
