const { PrismaClient } = require('@prisma/client');
const { createId } = require('@paralleldrive/cuid2');
const RoomService = require('./roomService');
const KeystoneService = require('./keystoneService');
const TaskTemplateService = require('./taskTemplateService');

/**
 * Task Generation Service
 *
 * Generates task rotations using the three-pillars methodology.
 * Combines room-based pillar tasks with keystone tasks in a structured sequence.
 */

class TaskGenerationService {
  constructor() {
    this.prisma = new PrismaClient();
    this.roomService = new RoomService();
    this.keystoneService = new KeystoneService();
    this.taskTemplateService = new TaskTemplateService();
  }

  /**
   * Generate a complete task rotation for a user
   * @param {string} userId - User ID
   * @param {boolean} shouldShuffleKeystones - Whether to shuffle keystones (for variety on regeneration)
   * @returns {Promise<Object>} Rotation metadata object
   */
  async generateRotation(userId, shouldShuffleKeystones = false) {
    // 1. Fetch user's rooms (sorted by sort_order)
    const rooms = await this.roomService.getUserRooms(userId, false);

    if (rooms.length === 0) {
      throw new Error('User has no configured rooms');
    }

    // 2. Fetch active keystones
    let keystones = await this.keystoneService.getActiveKeystonesForRotation(userId);

    // 3. Shuffle keystones if regenerating (for variety)
    if (shouldShuffleKeystones && keystones.length > 0) {
      keystones = this.shuffleArray(keystones);
    }

    // 4. Build pillar tasks for all rooms
    const pillarTasks = this.buildPillarTasks(rooms);

    // 5. Insert keystones every 3-5 tasks
    const rotation = this.insertKeystonesRandomly(pillarTasks, keystones);

    // 6. Assign sequence positions
    rotation.forEach((task, index) => {
      task.sequence_position = index + 1;
    });

    // 7. Get current rotation version and increment
    const currentProgress = await this.prisma.user_task_progress.findUnique({
      where: { user_id: userId },
      select: { current_rotation_version: true }
    });

    const newVersion = (currentProgress?.current_rotation_version || 0) + 1;

    // 8. Clear old rotation and save new
    await this.clearRotation(userId, newVersion - 1);
    await this.saveRotation(userId, rotation, newVersion);

    return {
      version: newVersion,
      total_tasks: rotation.length,
      generated_at: new Date()
    };
  }

  /**
   * Build pillar tasks for all rooms
   * @param {Array} rooms - Array of room objects
   * @returns {Array} Array of pillar task objects
   * @private
   */
  buildPillarTasks(rooms) {
    const pillarTasks = [];

    for (const room of rooms) {
      // Glass pillar (conditional - only if room has glass)
      if (room.has_glass) {
        pillarTasks.push({
          type: 'pillar',
          roomId: room.id,
          pillarType: 'glass',
          description: this.taskTemplateService.generateTaskDescription(
            room.room_type,
            room.custom_name,
            'glass'
          )
        });
      }

      // Surfaces pillar (always)
      pillarTasks.push({
        type: 'pillar',
        roomId: room.id,
        pillarType: 'surfaces',
        description: this.taskTemplateService.generateTaskDescription(
          room.room_type,
          room.custom_name,
          'surfaces'
        )
      });

      // Floor pillar (always)
      pillarTasks.push({
        type: 'pillar',
        roomId: room.id,
        pillarType: 'floor',
        description: this.taskTemplateService.generateTaskDescription(
          room.room_type,
          room.custom_name,
          'floor'
        )
      });
    }

    return pillarTasks;
  }

  /**
   * Insert keystones at random intervals (3-5 tasks) throughout pillar tasks
   * @param {Array} pillarTasks - Array of pillar task objects
   * @param {Array} keystones - Array of keystone objects
   * @returns {Array} Combined array with keystones inserted
   * @private
   */
  insertKeystonesRandomly(pillarTasks, keystones) {
    const result = [];
    const keystoneInterval = { min: 3, max: 5 };
    let tasksSinceLastKeystone = 0;
    let keystoneIndex = 0;

    for (const task of pillarTasks) {
      result.push(task);
      tasksSinceLastKeystone++;

      // Insert keystone at random interval (3-5 tasks)
      const shouldInsert = tasksSinceLastKeystone >= this.getRandomInt(
        keystoneInterval.min,
        keystoneInterval.max
      );

      if (shouldInsert && keystoneIndex < keystones.length) {
        result.push({
          type: 'keystone',
          keystoneType: keystones[keystoneIndex].task_type,
          description: this.taskTemplateService.getKeystoneDescription(
            keystones[keystoneIndex].task_type,
            keystones[keystoneIndex].custom_name
          )
        });
        keystoneIndex++;
        tasksSinceLastKeystone = 0;
      }
    }

    // Insert remaining keystones at end
    while (keystoneIndex < keystones.length) {
      result.push({
        type: 'keystone',
        keystoneType: keystones[keystoneIndex].task_type,
        description: this.taskTemplateService.getKeystoneDescription(
          keystones[keystoneIndex].task_type,
          keystones[keystoneIndex].custom_name
        )
      });
      keystoneIndex++;
    }

    return result;
  }

  /**
   * Save rotation to database
   * @param {string} userId - User ID
   * @param {Array} taskArray - Array of task objects with sequence positions
   * @param {number} version - Rotation version number
   * @returns {Promise<boolean>} Success status
   * @private
   */
  async saveRotation(userId, taskArray, version) {
    // Build task records for database
    const taskRecords = taskArray.map(task => {
      const record = {
        id: createId(),
        user_id: userId,
        task_type: task.type,
        task_description: task.description,
        sequence_position: task.sequence_position,
        rotation_version: version,
        room_id: null,
        pillar_type: null,
        keystone_type: null
      };

      if (task.type === 'pillar') {
        record.room_id = task.roomId;
        record.pillar_type = task.pillarType;
      } else if (task.type === 'keystone') {
        record.keystone_type = task.keystoneType;
      }

      return record;
    });

    // Batch insert all tasks
    await this.prisma.task_rotation.createMany({
      data: taskRecords
    });

    return true;
  }

  /**
   * Clear old rotation for a user
   * @param {string} userId - User ID
   * @param {number} version - Rotation version to clear
   * @returns {Promise<boolean>} Success status
   * @private
   */
  async clearRotation(userId, version) {
    if (version > 0) {
      await this.prisma.task_rotation.deleteMany({
        where: {
          user_id: userId,
          rotation_version: version
        }
      });
    }

    return true;
  }

  /**
   * Get tasks for a specific rotation version
   * @param {string} userId - User ID
   * @param {number} version - Rotation version
   * @returns {Promise<Array>} Array of task objects
   */
  async getRotationTasks(userId, version) {
    const tasks = await this.prisma.task_rotation.findMany({
      where: {
        user_id: userId,
        rotation_version: version
      },
      orderBy: {
        sequence_position: 'asc'
      }
    });

    return tasks;
  }

  /**
   * Get total task count for a rotation
   * @param {string} userId - User ID
   * @param {number} version - Rotation version
   * @returns {Promise<number>} Total task count
   */
  async getRotationTaskCount(userId, version) {
    const count = await this.prisma.task_rotation.count({
      where: {
        user_id: userId,
        rotation_version: version
      }
    });

    return count;
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   * @param {Array} array - Array to shuffle
   * @returns {Array} Shuffled array (new array, original unchanged)
   * @private
   */
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Generate random integer between min and max (inclusive)
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number} Random integer
   * @private
   */
  getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

module.exports = TaskGenerationService;
