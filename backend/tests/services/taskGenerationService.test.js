/**
 * TaskGenerationService Unit Tests
 *
 * Tests for task rotation generation including:
 * - Rotation generation with glass pillar when room has glass
 * - Skipping glass pillar when room has no glass
 * - Keystone insertion every 3-5 tasks
 * - Handling zero rooms gracefully
 * - Handling single room
 * - Keystone shuffling on regeneration
 */

const { prisma } = require('../../src/config/prisma');
const TaskGenerationService = require('../../src/services/taskGenerationService');
const RoomService = require('../../src/services/roomService');
const KeystoneService = require('../../src/services/keystoneService');
const { createTestUser, cleanupTestData } = require('../utils/testHelpers');

// Load setup
require('../setup');

describe('TaskGenerationService Unit Tests', () => {
  let taskGenerationService;
  let roomService;
  let keystoneService;
  let testUser;

  beforeAll(() => {
    taskGenerationService = new TaskGenerationService();
    roomService = new RoomService();
    keystoneService = new KeystoneService();
  });

  beforeEach(async () => {
    await cleanupTestData();
    // Clean up room-related tables
    await prisma.task_rotation.deleteMany({});
    await prisma.user_task_progress.deleteMany({});
    await prisma.pending_room_configs.deleteMany({});
    await prisma.user_keystone_tasks.deleteMany({});
    await prisma.user_rooms.deleteMany({});

    testUser = await createTestUser();
  });

  /**
   * Helper function to setup test rooms
   */
  async function setupTestRooms(userId, count, options = {}) {
    const rooms = [];
    for (let i = 0; i < count; i++) {
      const room = await roomService.createRoom(userId, {
        roomType: 'bedroom',
        customName: `Test Room ${i + 1}`,
        hasGlass: options.hasGlass !== undefined ? options.hasGlass : true
      });
      rooms.push(room);
    }
    return rooms;
  }

  describe('generateRotation', () => {
    test('should generate rotation with glass pillar when room has glass', async () => {
      // Setup: Create room with has_glass = true
      await roomService.createRoom(testUser.id, {
        roomType: 'bedroom',
        customName: 'Master Bedroom',
        hasGlass: true
      });

      const rotation = await taskGenerationService.generateRotation(testUser.id);

      expect(rotation).toHaveProperty('version');
      expect(rotation).toHaveProperty('total_tasks');
      expect(rotation).toHaveProperty('generated_at');

      // Verify rotation was saved to database
      const tasks = await prisma.task_rotation.findMany({
        where: { user_id: testUser.id, rotation_version: rotation.version }
      });

      const glassTasks = tasks.filter(t => t.pillar_type === 'glass');
      expect(glassTasks.length).toBeGreaterThan(0);
      expect(glassTasks[0].task_type).toBe('pillar');
    });

    test('should skip glass pillar when room has no glass', async () => {
      // Setup: Create room with has_glass = false
      await roomService.createRoom(testUser.id, {
        roomType: 'bedroom',
        customName: 'Guest Bedroom',
        hasGlass: false
      });

      const rotation = await taskGenerationService.generateRotation(testUser.id);

      const tasks = await prisma.task_rotation.findMany({
        where: { user_id: testUser.id, rotation_version: rotation.version }
      });

      const glassTasks = tasks.filter(t => t.pillar_type === 'glass');
      expect(glassTasks.length).toBe(0);

      // Should still have surfaces and floor pillars
      const surfacesTasks = tasks.filter(t => t.pillar_type === 'surfaces');
      const floorTasks = tasks.filter(t => t.pillar_type === 'floor');
      expect(surfacesTasks.length).toBe(1);
      expect(floorTasks.length).toBe(1);
    });

    test('should insert keystones every 3-5 tasks', async () => {
      // Setup: Create 3 rooms, initialize keystones
      await setupTestRooms(testUser.id, 3);
      await keystoneService.initializeDefaultKeystones(testUser.id);

      const rotation = await taskGenerationService.generateRotation(testUser.id);

      const tasks = await prisma.task_rotation.findMany({
        where: { user_id: testUser.id, rotation_version: rotation.version },
        orderBy: { sequence_position: 'asc' }
      });

      // Verify keystone distribution
      const keystonePositions = tasks
        .filter(t => t.task_type === 'keystone')
        .map(t => t.sequence_position);

      expect(keystonePositions.length).toBeGreaterThan(0);

      // Check spacing between keystones (should be 3-5 tasks)
      for (let i = 1; i < keystonePositions.length; i++) {
        const gap = keystonePositions[i] - keystonePositions[i - 1];
        expect(gap).toBeGreaterThanOrEqual(3);
        expect(gap).toBeLessThanOrEqual(6); // Allow for edge cases
      }
    });

    test('should throw error for zero rooms', async () => {
      // User has no rooms configured
      await expect(
        taskGenerationService.generateRotation(testUser.id)
      ).rejects.toThrow('User has no configured rooms');
    });

    test('should handle single room', async () => {
      await roomService.createRoom(testUser.id, {
        roomType: 'kitchen',
        customName: 'Kitchen',
        hasGlass: true
      });

      const rotation = await taskGenerationService.generateRotation(testUser.id);

      const tasks = await prisma.task_rotation.findMany({
        where: { user_id: testUser.id, rotation_version: rotation.version }
      });

      expect(tasks.length).toBeGreaterThan(0);
      expect(rotation.total_tasks).toBe(tasks.length);

      // Should have all 3 pillars for single room with glass
      const pillarTasks = tasks.filter(t => t.task_type === 'pillar');
      expect(pillarTasks.length).toBe(3); // glass, surfaces, floor

      const glassTasks = pillarTasks.filter(t => t.pillar_type === 'glass');
      const surfacesTasks = pillarTasks.filter(t => t.pillar_type === 'surfaces');
      const floorTasks = pillarTasks.filter(t => t.pillar_type === 'floor');

      expect(glassTasks.length).toBe(1);
      expect(surfacesTasks.length).toBe(1);
      expect(floorTasks.length).toBe(1);
    });

    test('should generate rotation without keystones if none are active', async () => {
      await setupTestRooms(testUser.id, 2);
      // Don't initialize keystones

      const rotation = await taskGenerationService.generateRotation(testUser.id);

      const tasks = await prisma.task_rotation.findMany({
        where: { user_id: testUser.id, rotation_version: rotation.version }
      });

      const keystoneTasks = tasks.filter(t => t.task_type === 'keystone');
      expect(keystoneTasks.length).toBe(0);

      // Should still have pillar tasks
      const pillarTasks = tasks.filter(t => t.task_type === 'pillar');
      expect(pillarTasks.length).toBeGreaterThan(0);
    });

    test('should increment rotation version', async () => {
      await setupTestRooms(testUser.id, 1);

      // Initialize progress with version 0
      await prisma.user_task_progress.create({
        data: {
          id: require('@paralleldrive/cuid2').createId(),
          user_id: testUser.id,
          current_task_index: 1,
          current_rotation_version: 0,
          rotation_generated_at: new Date(),
          has_pending_config_changes: false
        }
      });

      const rotation1 = await taskGenerationService.generateRotation(testUser.id);
      expect(rotation1.version).toBe(1);

      const rotation2 = await taskGenerationService.generateRotation(testUser.id);
      expect(rotation2.version).toBe(2);

      const rotation3 = await taskGenerationService.generateRotation(testUser.id);
      expect(rotation3.version).toBe(3);
    });

    test('should clear old rotation when generating new one', async () => {
      await setupTestRooms(testUser.id, 1);

      // Initialize progress with version 0
      await prisma.user_task_progress.create({
        data: {
          id: require('@paralleldrive/cuid2').createId(),
          user_id: testUser.id,
          current_task_index: 1,
          current_rotation_version: 0,
          rotation_generated_at: new Date(),
          has_pending_config_changes: false
        }
      });

      const rotation1 = await taskGenerationService.generateRotation(testUser.id);

      const tasksV1 = await prisma.task_rotation.findMany({
        where: { user_id: testUser.id, rotation_version: rotation1.version }
      });
      expect(tasksV1.length).toBeGreaterThan(0);

      const rotation2 = await taskGenerationService.generateRotation(testUser.id);

      // Old rotation should be deleted
      const oldTasks = await prisma.task_rotation.findMany({
        where: { user_id: testUser.id, rotation_version: rotation1.version }
      });
      expect(oldTasks.length).toBe(0);

      // New rotation should exist
      const newTasks = await prisma.task_rotation.findMany({
        where: { user_id: testUser.id, rotation_version: rotation2.version }
      });
      expect(newTasks.length).toBeGreaterThan(0);
    });

    test('should shuffle keystones when shouldShuffleKeystones is true', async () => {
      await setupTestRooms(testUser.id, 2);
      await keystoneService.initializeDefaultKeystones(testUser.id);

      // Initialize progress with version 0
      await prisma.user_task_progress.create({
        data: {
          id: require('@paralleldrive/cuid2').createId(),
          user_id: testUser.id,
          current_task_index: 1,
          current_rotation_version: 0,
          rotation_generated_at: new Date(),
          has_pending_config_changes: false
        }
      });

      // Generate twice with shuffling
      const rotation1 = await taskGenerationService.generateRotation(testUser.id, true);
      const tasks1 = await prisma.task_rotation.findMany({
        where: { user_id: testUser.id, rotation_version: rotation1.version },
        orderBy: { sequence_position: 'asc' }
      });

      const rotation2 = await taskGenerationService.generateRotation(testUser.id, true);
      const tasks2 = await prisma.task_rotation.findMany({
        where: { user_id: testUser.id, rotation_version: rotation2.version },
        orderBy: { sequence_position: 'asc' }
      });

      // Extract keystone types in order
      const keystones1 = tasks1
        .filter(t => t.task_type === 'keystone')
        .map(t => t.keystone_type);

      const keystones2 = tasks2
        .filter(t => t.task_type === 'keystone')
        .map(t => t.keystone_type);

      // Should have same keystones (but potentially different order)
      expect(keystones1.length).toBe(keystones2.length);

      // Check that all keystone types are present in both
      const types1 = new Set(keystones1);
      const types2 = new Set(keystones2);
      expect([...types1].sort()).toEqual([...types2].sort());
    });
  });

  describe('getRotationTasks', () => {
    test('should retrieve tasks in correct sequence order', async () => {
      await setupTestRooms(testUser.id, 2);
      const rotation = await taskGenerationService.generateRotation(testUser.id);

      const tasks = await taskGenerationService.getRotationTasks(
        testUser.id,
        rotation.version
      );

      expect(tasks.length).toBe(rotation.total_tasks);

      // Verify sequence positions are sequential
      for (let i = 0; i < tasks.length; i++) {
        expect(tasks[i].sequence_position).toBe(i + 1);
      }
    });

    test('should return empty array for non-existent rotation', async () => {
      const tasks = await taskGenerationService.getRotationTasks(testUser.id, 999);
      expect(tasks).toEqual([]);
    });
  });

  describe('getRotationTaskCount', () => {
    test('should return correct task count', async () => {
      await setupTestRooms(testUser.id, 2);
      const rotation = await taskGenerationService.generateRotation(testUser.id);

      const count = await taskGenerationService.getRotationTaskCount(
        testUser.id,
        rotation.version
      );

      expect(count).toBe(rotation.total_tasks);
    });

    test('should return 0 for non-existent rotation', async () => {
      const count = await taskGenerationService.getRotationTaskCount(testUser.id, 999);
      expect(count).toBe(0);
    });
  });

  describe('buildPillarTasks', () => {
    test('should create correct pillar tasks for multiple rooms', async () => {
      const rooms = await setupTestRooms(testUser.id, 2, { hasGlass: true });

      // Access private method via instance
      const pillarTasks = taskGenerationService.buildPillarTasks(rooms);

      // 2 rooms with glass = 6 pillar tasks (3 per room)
      expect(pillarTasks.length).toBe(6);

      // Verify room 1 tasks
      const room1Tasks = pillarTasks.filter(t => t.roomId === rooms[0].id);
      expect(room1Tasks.length).toBe(3);
      expect(room1Tasks.map(t => t.pillarType).sort()).toEqual(['floor', 'glass', 'surfaces']);

      // Verify room 2 tasks
      const room2Tasks = pillarTasks.filter(t => t.roomId === rooms[1].id);
      expect(room2Tasks.length).toBe(3);
      expect(room2Tasks.map(t => t.pillarType).sort()).toEqual(['floor', 'glass', 'surfaces']);
    });

    test('should skip glass pillar for rooms without glass', async () => {
      const rooms = await setupTestRooms(testUser.id, 2, { hasGlass: false });

      const pillarTasks = taskGenerationService.buildPillarTasks(rooms);

      // 2 rooms without glass = 4 pillar tasks (2 per room: surfaces + floor)
      expect(pillarTasks.length).toBe(4);

      const glassTasks = pillarTasks.filter(t => t.pillarType === 'glass');
      expect(glassTasks.length).toBe(0);
    });

    test('should generate task descriptions for each pillar', async () => {
      const rooms = await setupTestRooms(testUser.id, 1, { hasGlass: true });

      const pillarTasks = taskGenerationService.buildPillarTasks(rooms);

      pillarTasks.forEach(task => {
        expect(task).toHaveProperty('description');
        expect(task.description).toBeTruthy();
        expect(typeof task.description).toBe('string');
      });
    });
  });

  describe('task description generation', () => {
    test('should include room name in task descriptions', async () => {
      await roomService.createRoom(testUser.id, {
        roomType: 'kitchen',
        customName: 'Main Kitchen',
        hasGlass: true
      });

      const rotation = await taskGenerationService.generateRotation(testUser.id);
      const tasks = await taskGenerationService.getRotationTasks(
        testUser.id,
        rotation.version
      );

      const pillarTasks = tasks.filter(t => t.task_type === 'pillar');

      pillarTasks.forEach(task => {
        // Task description should mention the room
        expect(task.task_description.toLowerCase()).toContain('kitchen');
      });
    });
  });

  describe('complex scenarios', () => {
    test('should handle mixed rooms (some with glass, some without)', async () => {
      await roomService.createRoom(testUser.id, {
        roomType: 'bedroom',
        customName: 'Master Bedroom',
        hasGlass: true
      });

      await roomService.createRoom(testUser.id, {
        roomType: 'kitchen',
        customName: 'Kitchen',
        hasGlass: false
      });

      await roomService.createRoom(testUser.id, {
        roomType: 'bathroom',
        customName: 'Guest Bath',
        hasGlass: true
      });

      const rotation = await taskGenerationService.generateRotation(testUser.id);
      const tasks = await prisma.task_rotation.findMany({
        where: { user_id: testUser.id, rotation_version: rotation.version }
      });

      const pillarTasks = tasks.filter(t => t.task_type === 'pillar');
      const glassTasks = pillarTasks.filter(t => t.pillar_type === 'glass');

      // Should have glass tasks for 2 rooms (bedroom and bathroom)
      expect(glassTasks.length).toBe(2);

      // All rooms should have surfaces and floor
      const surfacesTasks = pillarTasks.filter(t => t.pillar_type === 'surfaces');
      const floorTasks = pillarTasks.filter(t => t.pillar_type === 'floor');
      expect(surfacesTasks.length).toBe(3);
      expect(floorTasks.length).toBe(3);
    });

    test('should handle large number of rooms', async () => {
      await setupTestRooms(testUser.id, 10);
      await keystoneService.initializeDefaultKeystones(testUser.id);

      const rotation = await taskGenerationService.generateRotation(testUser.id);
      const tasks = await prisma.task_rotation.findMany({
        where: { user_id: testUser.id, rotation_version: rotation.version }
      });

      // 10 rooms with glass = 30 pillar tasks + keystones
      const pillarTasks = tasks.filter(t => t.task_type === 'pillar');
      expect(pillarTasks.length).toBe(30);

      const keystoneTasks = tasks.filter(t => t.task_type === 'keystone');
      expect(keystoneTasks.length).toBeGreaterThan(0);

      expect(rotation.total_tasks).toBe(tasks.length);
    });
  });
});
