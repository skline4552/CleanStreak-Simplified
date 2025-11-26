/**
 * RoomService Unit Tests
 *
 * Tests for room configuration CRUD operations including:
 * - Room creation with valid data
 * - Room type validation
 * - Room reordering
 * - getUserRooms sorting
 * - deleteRoom functionality
 * - hasConfiguredRooms detection
 */

const { prisma } = require('../../src/config/prisma');
const RoomService = require('../../src/services/roomService');
const { createTestUser, cleanupTestData } = require('../utils/testHelpers');

// Load setup
require('../setup');

describe('RoomService Unit Tests', () => {
  let roomService;
  let testUser;

  beforeAll(() => {
    roomService = new RoomService();
  });

  beforeEach(async () => {
    await cleanupTestData();
    // Also clean up room-related tables
    await prisma.task_rotation.deleteMany({});
    await prisma.user_task_progress.deleteMany({});
    await prisma.pending_room_configs.deleteMany({});
    await prisma.user_keystone_tasks.deleteMany({});
    await prisma.user_rooms.deleteMany({});

    testUser = await createTestUser();
  });

  describe('createRoom', () => {
    test('should create room with valid data', async () => {
      const roomData = {
        roomType: 'bedroom',
        customName: 'Master Bedroom',
        hasGlass: true
      };

      const room = await roomService.createRoom(testUser.id, roomData);

      expect(room).toHaveProperty('id');
      expect(room.user_id).toBe(testUser.id);
      expect(room.room_type).toBe('bedroom');
      expect(room.custom_name).toBe('Master Bedroom');
      expect(room.has_glass).toBe(true);
      expect(room.sort_order).toBe(1); // First room
      expect(room.is_active).toBe(true);
    });

    test('should validate room type', async () => {
      const roomData = {
        roomType: 'invalid_type',
        customName: 'Test Room',
        hasGlass: true
      };

      await expect(
        roomService.createRoom(testUser.id, roomData)
      ).rejects.toThrow('Invalid room type');
    });

    test('should validate custom name length (too short)', async () => {
      const roomData = {
        roomType: 'bedroom',
        customName: '',
        hasGlass: true
      };

      await expect(
        roomService.createRoom(testUser.id, roomData)
      ).rejects.toThrow('Custom name must be between 1 and 50 characters');
    });

    test('should validate custom name length (too long)', async () => {
      const roomData = {
        roomType: 'bedroom',
        customName: 'A'.repeat(51),
        hasGlass: true
      };

      await expect(
        roomService.createRoom(testUser.id, roomData)
      ).rejects.toThrow('Custom name must be between 1 and 50 characters');
    });

    test('should assign incrementing sort_order to multiple rooms', async () => {
      const room1 = await roomService.createRoom(testUser.id, {
        roomType: 'bedroom',
        customName: 'Room 1',
        hasGlass: true
      });

      const room2 = await roomService.createRoom(testUser.id, {
        roomType: 'kitchen',
        customName: 'Room 2',
        hasGlass: true
      });

      const room3 = await roomService.createRoom(testUser.id, {
        roomType: 'bathroom',
        customName: 'Room 3',
        hasGlass: true
      });

      expect(room1.sort_order).toBe(1);
      expect(room2.sort_order).toBe(2);
      expect(room3.sort_order).toBe(3);
    });

    test('should default hasGlass to true if not provided', async () => {
      const roomData = {
        roomType: 'bedroom',
        customName: 'Test Room'
      };

      const room = await roomService.createRoom(testUser.id, roomData);
      expect(room.has_glass).toBe(true);
    });

    test('should trim whitespace from custom name', async () => {
      const roomData = {
        roomType: 'bedroom',
        customName: '  Trimmed Room  ',
        hasGlass: true
      };

      const room = await roomService.createRoom(testUser.id, roomData);
      expect(room.custom_name).toBe('Trimmed Room');
    });
  });

  describe('getUserRooms', () => {
    test('should return rooms sorted by sort_order', async () => {
      // Create rooms out of order
      await roomService.createRoom(testUser.id, {
        roomType: 'bedroom',
        customName: 'First',
        hasGlass: true
      });

      await roomService.createRoom(testUser.id, {
        roomType: 'kitchen',
        customName: 'Second',
        hasGlass: true
      });

      await roomService.createRoom(testUser.id, {
        roomType: 'bathroom',
        customName: 'Third',
        hasGlass: true
      });

      const rooms = await roomService.getUserRooms(testUser.id);

      expect(rooms).toHaveLength(3);
      expect(rooms[0].custom_name).toBe('First');
      expect(rooms[0].sort_order).toBe(1);
      expect(rooms[1].custom_name).toBe('Second');
      expect(rooms[1].sort_order).toBe(2);
      expect(rooms[2].custom_name).toBe('Third');
      expect(rooms[2].sort_order).toBe(3);
    });

    test('should exclude inactive rooms by default', async () => {
      const room1 = await roomService.createRoom(testUser.id, {
        roomType: 'bedroom',
        customName: 'Active Room',
        hasGlass: true
      });

      const room2 = await roomService.createRoom(testUser.id, {
        roomType: 'kitchen',
        customName: 'Inactive Room',
        hasGlass: true
      });

      // Mark room2 as inactive
      await prisma.user_rooms.update({
        where: { id: room2.id },
        data: { is_active: false }
      });

      const rooms = await roomService.getUserRooms(testUser.id);

      expect(rooms).toHaveLength(1);
      expect(rooms[0].id).toBe(room1.id);
    });

    test('should include inactive rooms when requested', async () => {
      await roomService.createRoom(testUser.id, {
        roomType: 'bedroom',
        customName: 'Active Room',
        hasGlass: true
      });

      const room2 = await roomService.createRoom(testUser.id, {
        roomType: 'kitchen',
        customName: 'Inactive Room',
        hasGlass: true
      });

      // Mark room2 as inactive
      await prisma.user_rooms.update({
        where: { id: room2.id },
        data: { is_active: false }
      });

      const rooms = await roomService.getUserRooms(testUser.id, true);

      expect(rooms).toHaveLength(2);
    });

    test('should return empty array for user with no rooms', async () => {
      const rooms = await roomService.getUserRooms(testUser.id);
      expect(rooms).toEqual([]);
    });
  });

  describe('getRoomById', () => {
    test('should retrieve specific room by id', async () => {
      const createdRoom = await roomService.createRoom(testUser.id, {
        roomType: 'bedroom',
        customName: 'Test Room',
        hasGlass: true
      });

      const room = await roomService.getRoomById(createdRoom.id, testUser.id);

      expect(room).not.toBeNull();
      expect(room.id).toBe(createdRoom.id);
      expect(room.custom_name).toBe('Test Room');
    });

    test('should return null for non-existent room', async () => {
      const room = await roomService.getRoomById('non-existent-id', testUser.id);
      expect(room).toBeNull();
    });

    test('should return null for room belonging to different user', async () => {
      const otherUser = await createTestUser();
      const room = await roomService.createRoom(otherUser.id, {
        roomType: 'bedroom',
        customName: 'Other User Room',
        hasGlass: true
      });

      const result = await roomService.getRoomById(room.id, testUser.id);
      expect(result).toBeNull();
    });
  });

  describe('updateRoom', () => {
    test('should update room type', async () => {
      const room = await roomService.createRoom(testUser.id, {
        roomType: 'bedroom',
        customName: 'Test Room',
        hasGlass: true
      });

      const updated = await roomService.updateRoom(room.id, testUser.id, {
        room_type: 'kitchen'
      });

      expect(updated.room_type).toBe('kitchen');
      expect(updated.custom_name).toBe('Test Room'); // Unchanged
    });

    test('should update custom name', async () => {
      const room = await roomService.createRoom(testUser.id, {
        roomType: 'bedroom',
        customName: 'Original Name',
        hasGlass: true
      });

      const updated = await roomService.updateRoom(room.id, testUser.id, {
        custom_name: 'Updated Name'
      });

      expect(updated.custom_name).toBe('Updated Name');
    });

    test('should update has_glass flag', async () => {
      const room = await roomService.createRoom(testUser.id, {
        roomType: 'bedroom',
        customName: 'Test Room',
        hasGlass: true
      });

      const updated = await roomService.updateRoom(room.id, testUser.id, {
        has_glass: false
      });

      expect(updated.has_glass).toBe(false);
    });

    test('should throw error for invalid room type', async () => {
      const room = await roomService.createRoom(testUser.id, {
        roomType: 'bedroom',
        customName: 'Test Room',
        hasGlass: true
      });

      await expect(
        roomService.updateRoom(room.id, testUser.id, {
          room_type: 'invalid_type'
        })
      ).rejects.toThrow('Invalid room type');
    });

    test('should throw error for unauthorized room', async () => {
      const otherUser = await createTestUser();
      const room = await roomService.createRoom(otherUser.id, {
        roomType: 'bedroom',
        customName: 'Other User Room',
        hasGlass: true
      });

      await expect(
        roomService.updateRoom(room.id, testUser.id, {
          custom_name: 'Hacked Name'
        })
      ).rejects.toThrow('Room not found or unauthorized');
    });
  });

  describe('deleteRoom', () => {
    test('should soft delete room by marking inactive', async () => {
      const room = await roomService.createRoom(testUser.id, {
        roomType: 'bedroom',
        customName: 'Test Room',
        hasGlass: true
      });

      const result = await roomService.deleteRoom(room.id, testUser.id);
      expect(result).toBe(true);

      // Verify room is marked inactive
      const deletedRoom = await prisma.user_rooms.findUnique({
        where: { id: room.id }
      });

      expect(deletedRoom).not.toBeNull();
      expect(deletedRoom.is_active).toBe(false);

      // Verify it's excluded from default getUserRooms
      const activeRooms = await roomService.getUserRooms(testUser.id);
      expect(activeRooms).toHaveLength(0);
    });

    test('should throw error for non-existent room', async () => {
      await expect(
        roomService.deleteRoom('non-existent-id', testUser.id)
      ).rejects.toThrow('Room not found or unauthorized');
    });

    test('should throw error for unauthorized room', async () => {
      const otherUser = await createTestUser();
      const room = await roomService.createRoom(otherUser.id, {
        roomType: 'bedroom',
        customName: 'Other User Room',
        hasGlass: true
      });

      await expect(
        roomService.deleteRoom(room.id, testUser.id)
      ).rejects.toThrow('Room not found or unauthorized');
    });
  });

  describe('reorderRooms', () => {
    test('should reorder rooms correctly', async () => {
      const room1 = await roomService.createRoom(testUser.id, {
        roomType: 'bedroom',
        customName: 'Room 1',
        hasGlass: true
      });

      const room2 = await roomService.createRoom(testUser.id, {
        roomType: 'kitchen',
        customName: 'Room 2',
        hasGlass: true
      });

      const room3 = await roomService.createRoom(testUser.id, {
        roomType: 'bathroom',
        customName: 'Room 3',
        hasGlass: true
      });

      // Reorder: room3, room1, room2
      await roomService.reorderRooms(testUser.id, [room3.id, room1.id, room2.id]);

      const rooms = await roomService.getUserRooms(testUser.id);

      expect(rooms[0].id).toBe(room3.id);
      expect(rooms[0].sort_order).toBe(1);
      expect(rooms[1].id).toBe(room1.id);
      expect(rooms[1].sort_order).toBe(2);
      expect(rooms[2].id).toBe(room2.id);
      expect(rooms[2].sort_order).toBe(3);
    });

    test('should throw error for empty array', async () => {
      await expect(
        roomService.reorderRooms(testUser.id, [])
      ).rejects.toThrow('Room ID array must be a non-empty array');
    });

    test('should throw error for non-array input', async () => {
      await expect(
        roomService.reorderRooms(testUser.id, 'not-an-array')
      ).rejects.toThrow('Room ID array must be a non-empty array');
    });

    test('should throw error for unauthorized room', async () => {
      const room1 = await roomService.createRoom(testUser.id, {
        roomType: 'bedroom',
        customName: 'User Room',
        hasGlass: true
      });

      const otherUser = await createTestUser();
      const room2 = await roomService.createRoom(otherUser.id, {
        roomType: 'kitchen',
        customName: 'Other User Room',
        hasGlass: true
      });

      await expect(
        roomService.reorderRooms(testUser.id, [room1.id, room2.id])
      ).rejects.toThrow('not found or unauthorized');
    });
  });

  describe('hasConfiguredRooms', () => {
    test('should return true when user has active rooms', async () => {
      await roomService.createRoom(testUser.id, {
        roomType: 'bedroom',
        customName: 'Test Room',
        hasGlass: true
      });

      const hasRooms = await roomService.hasConfiguredRooms(testUser.id);
      expect(hasRooms).toBe(true);
    });

    test('should return false when user has no rooms', async () => {
      const hasRooms = await roomService.hasConfiguredRooms(testUser.id);
      expect(hasRooms).toBe(false);
    });

    test('should return false when user has only inactive rooms', async () => {
      const room = await roomService.createRoom(testUser.id, {
        roomType: 'bedroom',
        customName: 'Test Room',
        hasGlass: true
      });

      // Mark as inactive
      await prisma.user_rooms.update({
        where: { id: room.id },
        data: { is_active: false }
      });

      const hasRooms = await roomService.hasConfiguredRooms(testUser.id);
      expect(hasRooms).toBe(false);
    });
  });

  describe('validateRoomType', () => {
    test('should validate all valid room types', async () => {
      const validTypes = [
        'living_room',
        'bedroom',
        'kitchen',
        'bathroom',
        'office',
        'dining_room',
        'laundry',
        'garage'
      ];

      for (const type of validTypes) {
        expect(roomService.validateRoomType(type)).toBe(true);
      }
    });

    test('should reject invalid room types', async () => {
      expect(roomService.validateRoomType('invalid_type')).toBe(false);
      expect(roomService.validateRoomType('basement')).toBe(false);
      expect(roomService.validateRoomType('')).toBe(false);
    });
  });

  describe('getValidRoomTypes', () => {
    test('should return array of valid room types', async () => {
      const types = roomService.getValidRoomTypes();
      expect(Array.isArray(types)).toBe(true);
      expect(types).toHaveLength(8);
      expect(types).toContain('bedroom');
      expect(types).toContain('kitchen');
      expect(types).toContain('bathroom');
    });
  });
});
