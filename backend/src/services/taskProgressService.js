const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const TaskGenerationService = require('./taskGenerationService');
const RoomService = require('./roomService');
const KeystoneService = require('./keystoneService');
const { validateRoomConfigData, sanitizeRoomConfigData } = require('../utils/roomConfigValidator');

/**
 * Task Progress Service
 *
 * Tracks user's current position in their task rotation.
 * Manages cycle completion and applies pending configuration changes.
 */

class TaskProgressService {
  constructor() {
    this.prisma = new PrismaClient();
    // Lazy-load to avoid circular dependency
    this._taskGenerationService = null;
    this._roomService = null;
    this._keystoneService = null;
  }

  get taskGenerationService() {
    if (!this._taskGenerationService) {
      this._taskGenerationService = new TaskGenerationService();
    }
    return this._taskGenerationService;
  }

  get roomService() {
    if (!this._roomService) {
      this._roomService = new RoomService();
    }
    return this._roomService;
  }

  get keystoneService() {
    if (!this._keystoneService) {
      this._keystoneService = new KeystoneService();
    }
    return this._keystoneService;
  }

  /**
   * Get progress record for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Progress object or null if not found
   */
  async getProgress(userId) {
    const progress = await this.prisma.user_task_progress.findUnique({
      where: { user_id: userId }
    });

    return progress;
  }

  /**
   * Initialize progress tracking for a new user
   * @param {string} userId - User ID
   * @param {number} rotationVersion - Initial rotation version
   * @returns {Promise<Object>} Created progress object
   */
  async initializeProgress(userId, rotationVersion = 1) {
    const progress = await this.prisma.user_task_progress.create({
      data: {
        id: uuidv4(),
        user_id: userId,
        current_task_index: 1,
        current_rotation_version: rotationVersion,
        rotation_generated_at: new Date(),
        has_pending_config_changes: false
      }
    });

    return progress;
  }

  /**
   * Get current task for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Current task object or null
   */
  async getCurrentTask(userId) {
    const progress = await this.getProgress(userId);
    if (!progress) {
      throw new Error('User progress not initialized');
    }

    const task = await this.prisma.task_rotation.findFirst({
      where: {
        user_id: userId,
        rotation_version: progress.current_rotation_version,
        sequence_position: progress.current_task_index
      }
    });

    return task;
  }

  /**
   * Advance to next task in rotation
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Next task object
   */
  async advanceToNextTask(userId) {
    const progress = await this.getProgress(userId);
    if (!progress) {
      throw new Error('User progress not initialized');
    }

    const currentVersion = progress.current_rotation_version;

    // Get total tasks in current rotation
    const totalTasks = await this.taskGenerationService.getRotationTaskCount(
      userId,
      currentVersion
    );

    // Increment index
    const nextIndex = progress.current_task_index + 1;

    // Check for cycle completion
    if (nextIndex > totalTasks) {
      // Cycle complete - trigger regeneration
      return await this.handleCycleCompletion(userId);
    }

    // Update progress
    await this.prisma.user_task_progress.update({
      where: { user_id: userId },
      data: { current_task_index: nextIndex }
    });

    return await this.getCurrentTask(userId);
  }

  /**
   * Detect if user has completed their current rotation cycle
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if cycle is complete
   */
  async detectCycleCompletion(userId) {
    const progress = await this.getProgress(userId);
    if (!progress) {
      return false;
    }

    const totalTasks = await this.taskGenerationService.getRotationTaskCount(
      userId,
      progress.current_rotation_version
    );

    return progress.current_task_index > totalTasks;
  }

  /**
   * Handle cycle completion - apply pending changes and regenerate rotation
   * @param {string} userId - User ID
   * @returns {Promise<Object>} New current task
   */
  async handleCycleCompletion(userId) {
    // 1. Check for pending config changes
    const progress = await this.getProgress(userId);

    if (progress?.has_pending_config_changes) {
      // Apply staged changes
      await this.applyPendingConfigChanges(userId);
    }

    // 2. Regenerate rotation with shuffled keystones
    const newRotation = await this.taskGenerationService.generateRotation(
      userId,
      true // shouldShuffleKeystones = true
    );

    // 3. Reset progress to task 1 of new rotation
    await this.prisma.user_task_progress.update({
      where: { user_id: userId },
      data: {
        current_task_index: 1,
        current_rotation_version: newRotation.version,
        has_pending_config_changes: false,
        rotation_generated_at: newRotation.generated_at
      }
    });

    return await this.getCurrentTask(userId);
  }

  /**
   * Stage pending configuration changes for application at cycle completion
   * @param {string} userId - User ID
   * @param {Object} configData - Configuration data to stage
   * @returns {Promise<boolean>} Success status
   */
  async stagePendingChanges(userId, configData) {
    // Validate configuration data (Issue #24)
    const validation = validateRoomConfigData(configData);
    if (!validation.valid) {
      throw new Error(`Invalid configuration data: ${validation.errors.join(', ')}`);
    }

    // Sanitize data
    const sanitized = sanitizeRoomConfigData(configData);

    // Check if pending config already exists
    const existing = await this.prisma.pending_room_configs.findUnique({
      where: { user_id: userId }
    });

    if (existing) {
      // Update existing
      await this.prisma.pending_room_configs.update({
        where: { user_id: userId },
        data: {
          config_data: JSON.stringify(sanitized)
        }
      });
    } else {
      // Create new
      await this.prisma.pending_room_configs.create({
        data: {
          id: uuidv4(),
          user_id: userId,
          config_data: JSON.stringify(sanitized)
        }
      });
    }

    // Mark user as having pending changes
    await this.prisma.user_task_progress.update({
      where: { user_id: userId },
      data: { has_pending_config_changes: true }
    });

    return true;
  }

  /**
   * Apply pending configuration changes
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async applyPendingConfigChanges(userId) {
    // Retrieve staged changes from pending_room_configs
    const pending = await this.prisma.pending_room_configs.findUnique({
      where: { user_id: userId }
    });

    if (!pending) {
      return false;
    }

    let configData;
    try {
      configData = JSON.parse(pending.config_data);
    } catch (error) {
      throw new Error('Failed to parse pending configuration data');
    }

    // Apply room updates if present
    if (configData.rooms && Array.isArray(configData.rooms)) {
      await this.applyRoomUpdates(userId, configData.rooms);
    }

    // Apply keystone updates if present
    if (configData.keystones && Array.isArray(configData.keystones)) {
      await this.applyKeystoneUpdates(userId, configData.keystones);
    }

    // Clear pending config
    await this.prisma.pending_room_configs.delete({
      where: { user_id: userId }
    });

    return true;
  }

  /**
   * Apply room configuration updates
   * @param {string} userId - User ID
   * @param {Array} roomUpdates - Array of room update objects
   * @private
   */
  async applyRoomUpdates(userId, roomUpdates) {
    // Get existing rooms
    const existingRooms = await this.roomService.getUserRooms(userId, true);
    const existingRoomIds = new Set(existingRooms.map(r => r.id));
    const updateRoomIds = new Set(roomUpdates.map(r => r.id));

    // Delete rooms that are no longer in the update list
    const roomsToDelete = existingRooms.filter(r => !updateRoomIds.has(r.id));
    for (const room of roomsToDelete) {
      await this.prisma.user_rooms.delete({ where: { id: room.id } });
    }

    // Update or create rooms
    for (const roomUpdate of roomUpdates) {
      if (existingRoomIds.has(roomUpdate.id)) {
        // Update existing room
        await this.prisma.user_rooms.update({
          where: { id: roomUpdate.id },
          data: {
            room_type: roomUpdate.roomType,
            custom_name: roomUpdate.customName,
            has_glass: roomUpdate.hasGlass,
            sort_order: roomUpdate.sortOrder,
            is_active: roomUpdate.isActive
          }
        });
      } else {
        // Create new room
        await this.prisma.user_rooms.create({
          data: {
            id: roomUpdate.id,
            user_id: userId,
            room_type: roomUpdate.roomType,
            custom_name: roomUpdate.customName,
            has_glass: roomUpdate.hasGlass,
            sort_order: roomUpdate.sortOrder,
            is_active: roomUpdate.isActive
          }
        });
      }
    }
  }

  /**
   * Apply keystone configuration updates
   * @param {string} userId - User ID
   * @param {Array} keystoneUpdates - Array of keystone update objects
   * @private
   */
  async applyKeystoneUpdates(userId, keystoneUpdates) {
    // Update keystones (we don't delete keystones, just update them)
    for (const keystoneUpdate of keystoneUpdates) {
      await this.prisma.user_keystone_tasks.update({
        where: { id: keystoneUpdate.id },
        data: {
          task_type: keystoneUpdate.taskType,
          custom_name: keystoneUpdate.customName,
          is_active: keystoneUpdate.isActive,
          sort_order: keystoneUpdate.sortOrder
        }
      });
    }
  }

  /**
   * Get pending configuration changes for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Pending configuration data or null
   */
  async getPendingChanges(userId) {
    const pending = await this.prisma.pending_room_configs.findUnique({
      where: { user_id: userId }
    });

    if (!pending) {
      return null;
    }

    try {
      return JSON.parse(pending.config_data);
    } catch (error) {
      throw new Error('Failed to parse pending configuration data');
    }
  }

  /**
   * Clear pending configuration changes
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async clearPendingChanges(userId) {
    const pending = await this.prisma.pending_room_configs.findUnique({
      where: { user_id: userId }
    });

    if (pending) {
      await this.prisma.pending_room_configs.delete({
        where: { user_id: userId }
      });
    }

    // Clear flag in progress
    await this.prisma.user_task_progress.update({
      where: { user_id: userId },
      data: { has_pending_config_changes: false }
    });

    return true;
  }
}

module.exports = TaskProgressService;
