const { createId } = require('@paralleldrive/cuid2');
const { prisma } = require('../config/prisma');
const RoomService = require('../services/roomService');
const { sanitizeString } = require('../utils/validation');

// Instantiate service
const roomService = new RoomService();

class RoomController {
  /**
   * Create a new room configuration
   * POST /api/rooms
   */
  static async createRoom(req, res) {
    try {
      const { userId } = req.user;
      const { roomType, customName, hasGlass } = req.body;

      // Validate required fields
      if (!roomType || !customName) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'roomType and customName are required'
        });
      }

      // Sanitize custom name
      const sanitizedName = sanitizeString(customName);

      // Validate custom name length
      if (sanitizedName.length < 1 || sanitizedName.length > 50) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Custom name must be between 1 and 50 characters'
        });
      }

      // Create room via service
      const room = await roomService.createRoom(userId, {
        roomType: roomType.toLowerCase(),
        customName: sanitizedName,
        hasGlass: hasGlass !== undefined ? hasGlass : true
      });

      res.status(201).json({
        success: true,
        room
      });

    } catch (error) {
      console.error('Create room error:', error);

      if (error.message.includes('Invalid room type')) {
        return res.status(400).json({
          error: 'Validation failed',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to create room. Please try again.'
      });
    }
  }

  /**
   * Get all user's rooms
   * GET /api/rooms
   */
  static async getUserRooms(req, res) {
    try {
      const { userId } = req.user;
      const includeInactive = req.query.include_inactive === 'true';

      const rooms = await roomService.getUserRooms(userId, includeInactive);

      res.status(200).json({
        success: true,
        rooms
      });

    } catch (error) {
      console.error('Get user rooms error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve rooms. Please try again.'
      });
    }
  }

  /**
   * Get a specific room by ID
   * GET /api/rooms/:id
   */
  static async getRoomById(req, res) {
    try {
      const { userId } = req.user;
      const { id } = req.params;

      const room = await roomService.getRoomById(id, userId);

      if (!room) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Room not found or you do not have access to it'
        });
      }

      res.status(200).json({
        success: true,
        room
      });

    } catch (error) {
      console.error('Get room by ID error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve room. Please try again.'
      });
    }
  }

  /**
   * Update a room configuration
   * PUT /api/rooms/:id
   */
  static async updateRoom(req, res) {
    try {
      const { userId } = req.user;
      const { id } = req.params;
      const updates = {};

      // Validate and sanitize updates
      if (req.body.customName !== undefined) {
        const sanitizedName = sanitizeString(req.body.customName);
        if (sanitizedName.length < 1 || sanitizedName.length > 50) {
          return res.status(400).json({
            error: 'Validation failed',
            message: 'Custom name must be between 1 and 50 characters'
          });
        }
        updates.customName = sanitizedName;
      }

      if (req.body.hasGlass !== undefined) {
        updates.hasGlass = Boolean(req.body.hasGlass);
      }

      if (req.body.isActive !== undefined) {
        updates.isActive = Boolean(req.body.isActive);
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'No valid updates provided'
        });
      }

      const updatedRoom = await roomService.updateRoom(id, userId, updates);

      if (!updatedRoom) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Room not found or you do not have access to it'
        });
      }

      res.status(200).json({
        success: true,
        room: updatedRoom,
        message: 'Room updated. Changes will apply after completing current cycle.'
      });

    } catch (error) {
      console.error('Update room error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update room. Please try again.'
      });
    }
  }

  /**
   * Delete a room configuration
   * DELETE /api/rooms/:id
   */
  static async deleteRoom(req, res) {
    try {
      const { userId } = req.user;
      const { id } = req.params;

      const success = await roomService.deleteRoom(id, userId);

      if (!success) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Room not found or you do not have access to it'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Room deleted. Changes will apply after completing current cycle.'
      });

    } catch (error) {
      console.error('Delete room error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to delete room. Please try again.'
      });
    }
  }

  /**
   * Reorder rooms
   * PUT /api/rooms/reorder
   */
  static async reorderRooms(req, res) {
    try {
      const { userId } = req.user;
      const { room_order } = req.body;

      // Validate room_order
      if (!Array.isArray(room_order) || room_order.length === 0) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'room_order must be a non-empty array of room IDs'
        });
      }

      const success = await roomService.reorderRooms(userId, room_order);

      if (!success) {
        return res.status(400).json({
          error: 'Reorder failed',
          message: 'Failed to reorder rooms. Verify all room IDs are valid.'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Rooms reordered successfully. Changes will apply after completing current cycle.'
      });

    } catch (error) {
      console.error('Reorder rooms error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to reorder rooms. Please try again.'
      });
    }
  }
}

module.exports = RoomController;
