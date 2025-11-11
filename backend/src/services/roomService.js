const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const TaskTemplateService = require('./taskTemplateService');

/**
 * Room Service
 *
 * Handles CRUD operations for user room configurations.
 * Manages room creation, updates, deletion, and reordering.
 */

class RoomService {
  constructor() {
    this.prisma = new PrismaClient();
    this.taskTemplateService = new TaskTemplateService();

    // Valid room types
    this.validRoomTypes = [
      'living_room',
      'bedroom',
      'kitchen',
      'bathroom',
      'office',
      'dining_room',
      'laundry',
      'garage'
    ];
  }

  /**
   * Create a new room for a user
   * @param {string} userId - User ID
   * @param {Object} roomData - Room configuration data
   * @param {string} roomData.roomType - Type of room
   * @param {string} roomData.customName - Custom name for the room
   * @param {boolean} roomData.hasGlass - Whether room has glass surfaces
   * @returns {Promise<Object>} Created room object
   */
  async createRoom(userId, { roomType, customName, hasGlass = true }) {
    // Validate room type
    if (!this.validateRoomType(roomType)) {
      throw new Error(`Invalid room type: ${roomType}. Must be one of: ${this.validRoomTypes.join(', ')}`);
    }

    // Validate custom name
    if (!customName || customName.trim().length < 1 || customName.trim().length > 50) {
      throw new Error('Custom name must be between 1 and 50 characters');
    }

    // Get current max sort_order for this user
    const maxOrderRoom = await this.prisma.user_rooms.findFirst({
      where: { user_id: userId },
      orderBy: { sort_order: 'desc' }
    });

    const nextSortOrder = maxOrderRoom ? maxOrderRoom.sort_order + 1 : 1;

    // Create room
    const room = await this.prisma.user_rooms.create({
      data: {
        id: uuidv4(),
        user_id: userId,
        room_type: roomType,
        custom_name: customName.trim(),
        has_glass: hasGlass,
        sort_order: nextSortOrder,
        is_active: true
      }
    });

    // Mark user as having pending config changes
    await this.markPendingConfigChanges(userId);

    return room;
  }

  /**
   * Get all rooms for a user
   * @param {string} userId - User ID
   * @param {boolean} includeInactive - Whether to include inactive rooms
   * @returns {Promise<Array>} Array of room objects sorted by sort_order
   */
  async getUserRooms(userId, includeInactive = false) {
    const where = { user_id: userId };
    if (!includeInactive) {
      where.is_active = true;
    }

    const rooms = await this.prisma.user_rooms.findMany({
      where,
      orderBy: { sort_order: 'asc' }
    });

    return rooms;
  }

  /**
   * Get a specific room by ID
   * @param {string} roomId - Room ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<Object|null>} Room object or null if not found
   */
  async getRoomById(roomId, userId) {
    const room = await this.prisma.user_rooms.findFirst({
      where: {
        id: roomId,
        user_id: userId
      }
    });

    return room;
  }

  /**
   * Update a room
   * @param {string} roomId - Room ID
   * @param {string} userId - User ID (for authorization)
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated room object
   */
  async updateRoom(roomId, userId, updates) {
    // Verify room belongs to user
    const existingRoom = await this.getRoomById(roomId, userId);
    if (!existingRoom) {
      throw new Error('Room not found or unauthorized');
    }

    // Validate updates
    const allowedFields = ['room_type', 'custom_name', 'has_glass', 'is_active'];
    const updateData = {};

    for (const field of allowedFields) {
      if (updates.hasOwnProperty(field)) {
        updateData[field] = updates[field];
      }
    }

    // Validate room_type if being updated
    if (updateData.room_type && !this.validateRoomType(updateData.room_type)) {
      throw new Error(`Invalid room type: ${updateData.room_type}`);
    }

    // Validate custom_name if being updated
    if (updateData.custom_name) {
      const trimmed = updateData.custom_name.trim();
      if (trimmed.length < 1 || trimmed.length > 50) {
        throw new Error('Custom name must be between 1 and 50 characters');
      }
      updateData.custom_name = trimmed;
    }

    // Update room
    const updatedRoom = await this.prisma.user_rooms.update({
      where: { id: roomId },
      data: updateData
    });

    // Mark user as having pending config changes
    await this.markPendingConfigChanges(userId);

    return updatedRoom;
  }

  /**
   * Delete a room (soft delete by marking inactive)
   * @param {string} roomId - Room ID
   * @param {string} userId - User ID (for authorization)
   * @returns {Promise<boolean>} Success status
   */
  async deleteRoom(roomId, userId) {
    // Verify room belongs to user
    const existingRoom = await this.getRoomById(roomId, userId);
    if (!existingRoom) {
      throw new Error('Room not found or unauthorized');
    }

    // Soft delete by marking inactive
    await this.prisma.user_rooms.update({
      where: { id: roomId },
      data: { is_active: false }
    });

    // Mark user as having pending config changes
    await this.markPendingConfigChanges(userId);

    return true;
  }

  /**
   * Reorder rooms for a user
   * @param {string} userId - User ID
   * @param {string[]} roomIdArray - Array of room IDs in desired order
   * @returns {Promise<boolean>} Success status
   */
  async reorderRooms(userId, roomIdArray) {
    if (!Array.isArray(roomIdArray) || roomIdArray.length === 0) {
      throw new Error('Room ID array must be a non-empty array');
    }

    // Verify all rooms belong to user
    const rooms = await this.getUserRooms(userId, true);
    const userRoomIds = new Set(rooms.map(r => r.id));

    for (const roomId of roomIdArray) {
      if (!userRoomIds.has(roomId)) {
        throw new Error(`Room ${roomId} not found or unauthorized`);
      }
    }

    // Update sort_order for each room
    const updates = roomIdArray.map((roomId, index) => {
      return this.prisma.user_rooms.update({
        where: { id: roomId },
        data: { sort_order: index + 1 }
      });
    });

    await this.prisma.$transaction(updates);

    // Mark user as having pending config changes
    await this.markPendingConfigChanges(userId);

    return true;
  }

  /**
   * Validate room type
   * @param {string} roomType - Room type to validate
   * @returns {boolean} True if valid
   */
  validateRoomType(roomType) {
    return this.validRoomTypes.includes(roomType);
  }

  /**
   * Check if user has any configured rooms
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if user has rooms
   */
  async hasConfiguredRooms(userId) {
    const count = await this.prisma.user_rooms.count({
      where: {
        user_id: userId,
        is_active: true
      }
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
   * Get valid room types
   * @returns {string[]} Array of valid room types
   */
  getValidRoomTypes() {
    return [...this.validRoomTypes];
  }
}

module.exports = RoomService;
