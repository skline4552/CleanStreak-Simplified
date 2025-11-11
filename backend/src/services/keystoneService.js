const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

/**
 * Keystone Service
 *
 * Manages keystone task configurations for users.
 * Keystones are high-impact tasks that appear periodically in the rotation.
 */

class KeystoneService {
  constructor() {
    this.prisma = new PrismaClient();

    // Default keystone task types (in default order)
    this.defaultKeystones = [
      'master_toilet',
      'guest_toilet',
      'kitchen_sink',
      'master_bath_sink',
      'guest_bath_sink',
      'stovetop',
      'shower_tub',
      'microwave'
    ];
  }

  /**
   * Initialize default keystones for a new user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of created keystone objects
   */
  async initializeDefaultKeystones(userId) {
    // Check if user already has keystones
    const existingCount = await this.prisma.user_keystone_tasks.count({
      where: { user_id: userId }
    });

    if (existingCount > 0) {
      throw new Error('User already has keystones initialized');
    }

    // Create all default keystones
    const keystones = this.defaultKeystones.map((taskType, index) => ({
      id: uuidv4(),
      user_id: userId,
      task_type: taskType,
      custom_name: null,
      is_active: true,
      sort_order: index + 1
    }));

    // Batch create
    await this.prisma.user_keystone_tasks.createMany({
      data: keystones
    });

    // Return created keystones
    return await this.getUserKeystones(userId);
  }

  /**
   * Get all keystones for a user
   * @param {string} userId - User ID
   * @param {boolean} activeOnly - Whether to return only active keystones
   * @returns {Promise<Array>} Array of keystone objects sorted by sort_order
   */
  async getUserKeystones(userId, activeOnly = false) {
    const where = { user_id: userId };
    if (activeOnly) {
      where.is_active = true;
    }

    const keystones = await this.prisma.user_keystone_tasks.findMany({
      where,
      orderBy: { sort_order: 'asc' }
    });

    return keystones;
  }

  /**
   * Get a specific keystone by ID
   * @param {string} keystoneId - Keystone ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<Object|null>} Keystone object or null if not found
   */
  async getKeystoneById(keystoneId, userId) {
    const keystone = await this.prisma.user_keystone_tasks.findFirst({
      where: {
        id: keystoneId,
        user_id: userId
      }
    });

    return keystone;
  }

  /**
   * Update a keystone task
   * @param {string} keystoneId - Keystone ID
   * @param {string} userId - User ID (for authorization)
   * @param {Object} updates - Fields to update
   * @param {string} updates.customName - Custom name for the keystone
   * @param {boolean} updates.isActive - Whether keystone is active
   * @param {number} updates.sortOrder - Sort order position
   * @returns {Promise<Object>} Updated keystone object
   */
  async updateKeystone(keystoneId, userId, updates) {
    // Verify keystone belongs to user
    const existingKeystone = await this.getKeystoneById(keystoneId, userId);
    if (!existingKeystone) {
      throw new Error('Keystone not found or unauthorized');
    }

    // Build update data
    const updateData = {};

    if (updates.hasOwnProperty('customName')) {
      // Validate custom name length if provided
      if (updates.customName !== null) {
        const trimmed = updates.customName.trim();
        if (trimmed.length > 100) {
          throw new Error('Custom name must be 100 characters or less');
        }
        updateData.custom_name = trimmed.length > 0 ? trimmed : null;
      } else {
        updateData.custom_name = null;
      }
    }

    if (updates.hasOwnProperty('isActive')) {
      if (typeof updates.isActive !== 'boolean') {
        throw new Error('isActive must be a boolean');
      }
      updateData.is_active = updates.isActive;
    }

    if (updates.hasOwnProperty('sortOrder')) {
      if (!Number.isInteger(updates.sortOrder) || updates.sortOrder < 1) {
        throw new Error('sortOrder must be a positive integer');
      }
      updateData.sort_order = updates.sortOrder;
    }

    // Update keystone
    const updatedKeystone = await this.prisma.user_keystone_tasks.update({
      where: { id: keystoneId },
      data: updateData
    });

    // Mark user as having pending config changes if active status changed
    if (updateData.hasOwnProperty('is_active')) {
      await this.markPendingConfigChanges(userId);
    }

    return updatedKeystone;
  }

  /**
   * Get active keystones for rotation generation (sorted by sort_order)
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of active keystone objects
   */
  async getActiveKeystonesForRotation(userId) {
    const keystones = await this.prisma.user_keystone_tasks.findMany({
      where: {
        user_id: userId,
        is_active: true
      },
      orderBy: { sort_order: 'asc' }
    });

    return keystones;
  }

  /**
   * Reorder keystones for a user
   * @param {string} userId - User ID
   * @param {string[]} keystoneIdArray - Array of keystone IDs in desired order
   * @returns {Promise<boolean>} Success status
   */
  async reorderKeystones(userId, keystoneIdArray) {
    if (!Array.isArray(keystoneIdArray) || keystoneIdArray.length === 0) {
      throw new Error('Keystone ID array must be a non-empty array');
    }

    // Verify all keystones belong to user
    const keystones = await this.getUserKeystones(userId);
    const userKeystoneIds = new Set(keystones.map(k => k.id));

    for (const keystoneId of keystoneIdArray) {
      if (!userKeystoneIds.has(keystoneId)) {
        throw new Error(`Keystone ${keystoneId} not found or unauthorized`);
      }
    }

    // Update sort_order for each keystone
    const updates = keystoneIdArray.map((keystoneId, index) => {
      return this.prisma.user_keystone_tasks.update({
        where: { id: keystoneId },
        data: { sort_order: index + 1 }
      });
    });

    await this.prisma.$transaction(updates);

    return true;
  }

  /**
   * Check if user has keystones initialized
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if user has keystones
   */
  async hasKeystones(userId) {
    const count = await this.prisma.user_keystone_tasks.count({
      where: { user_id: userId }
    });

    return count > 0;
  }

  /**
   * Mark user as having pending configuration changes
   * @param {string} userId - User ID
   * @private
   */
  async markPendingConfigChanges(userId) {
    // Check if user_task_progress exists for user
    const progress = await this.prisma.user_task_progress.findUnique({
      where: { user_id: userId }
    });

    if (progress) {
      await this.prisma.user_task_progress.update({
        where: { user_id: userId },
        data: { has_pending_config_changes: true }
      });
    }
  }

  /**
   * Get default keystone types
   * @returns {string[]} Array of default keystone types
   */
  getDefaultKeystoneTypes() {
    return [...this.defaultKeystones];
  }
}

module.exports = KeystoneService;
