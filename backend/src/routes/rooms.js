const express = require('express');
const RoomController = require('../controllers/roomController');
const { authenticate } = require('../middleware/auth');
const { userLimiters } = require('../middleware/rateLimiter');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/rooms
 * @desc    Create a new room configuration
 * @access  Private
 * @body    { roomType, customName, hasGlass }
 */
router.post('/', userLimiters.roomConfig, RoomController.createRoom);

/**
 * @route   GET /api/rooms
 * @desc    Get all user's room configurations
 * @access  Private
 * @query   include_inactive (optional boolean)
 */
router.get('/', RoomController.getUserRooms);

/**
 * @route   PUT /api/rooms/reorder
 * @desc    Bulk reorder rooms
 * @access  Private
 * @body    { room_order: ["uuid1", "uuid2", "uuid3"] }
 */
router.put('/reorder', userLimiters.roomConfig, RoomController.reorderRooms);

/**
 * @route   GET /api/rooms/:id
 * @desc    Get a specific room by ID
 * @access  Private
 */
router.get('/:id', RoomController.getRoomById);

/**
 * @route   PUT /api/rooms/:id
 * @desc    Update a room configuration
 * @access  Private
 * @body    { customName?, hasGlass?, isActive? }
 */
router.put('/:id', userLimiters.roomConfig, RoomController.updateRoom);

/**
 * @route   DELETE /api/rooms/:id
 * @desc    Delete a room configuration
 * @access  Private
 */
router.delete('/:id', userLimiters.roomConfig, RoomController.deleteRoom);

module.exports = router;
