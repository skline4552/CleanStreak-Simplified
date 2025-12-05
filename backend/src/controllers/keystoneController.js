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
        keystone_tasks: keystones,
        has_keystones: keystones.length > 0
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
   * Initialize keystone tasks for user
   * POST /api/keystone-tasks/initialize
   */
  static async initializeKeystones(req, res) {
    try {
      const { userId } = req.user;
      const { keystones } = req.body;

      // Validate keystones if provided
      if (keystones !== undefined) {
        if (!Array.isArray(keystones)) {
          return res.status(400).json({
            error: 'Validation failed',
            message: 'keystones must be an array'
          });
        }

        // Validate each keystone object
        for (const keystone of keystones) {
          if (!keystone.task_type || typeof keystone.task_type !== 'string') {
            return res.status(400).json({
              error: 'Validation failed',
              message: 'Each keystone must have a task_type string'
            });
          }

          if (keystone.custom_name && typeof keystone.custom_name !== 'string') {
            return res.status(400).json({
              error: 'Validation failed',
              message: 'custom_name must be a string if provided'
            });
          }
        }
      }

      const result = await keystoneService.initializeCustomKeystones(userId, keystones || []);

      res.status(201).json({
        success: true,
        keystone_tasks: result,
        message: 'Keystone tasks initialized successfully'
      });

    } catch (error) {
      console.error('Initialize keystones error:', error);

      if (error.message === 'User already has keystones initialized') {
        return res.status(409).json({
          error: 'Already initialized',
          message: 'Keystone tasks have already been initialized for this user'
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to initialize keystone tasks. Please try again.'
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
