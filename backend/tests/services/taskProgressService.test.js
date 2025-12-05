/**
 * TaskProgressService Unit Tests
 *
 * Tests for task progress tracking including:
 * - Advancing through rotation correctly
 * - Cycle completion detection and regeneration
 * - Applying pending config changes on cycle completion
 * - getCurrentTask for users with/without rooms
 */

const { prisma } = require('../../src/config/prisma');
const { createId } = require('@paralleldrive/cuid2');
const TaskProgressService = require('../../src/services/taskProgressService');
const TaskGenerationService = require('../../src/services/taskGenerationService');
const RoomService = require('../../src/services/roomService');
const KeystoneService = require('../../src/services/keystoneService');
const { createTestUser, cleanupTestData } = require('../utils/testHelpers');

// Load setup
require('../setup');

describe('TaskProgressService Unit Tests', () => {
  let taskProgressService;
  let taskGenerationService;
  let roomService;
  let keystoneService;
  let testUser;

  beforeAll(() => {
    taskProgressService = new TaskProgressService();
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

  /**
   * Helper function to advance to end of cycle
   */
  async function advanceToEndOfCycle(userId) {
    let task = await taskProgressService.getCurrentTask(userId);
    const progress = await taskProgressService.getProgress(userId);
    const totalTasks = await taskGenerationService.getRotationTaskCount(
      userId,
      progress.current_rotation_version
    );

    // Advance to the last task
    for (let i = task.sequence_position; i < totalTasks; i++) {
      task = await taskProgressService.advanceToNextTask(userId);
    }

    return task;
  }

  describe('getProgress', () => {
    test('should return null for user without progress record', async () => {
      const progress = await taskProgressService.getProgress(testUser.id);
      expect(progress).toBeNull();
    });

    test('should return progress record when it exists', async () => {
      const created = await taskProgressService.initializeProgress(testUser.id, 1);

      const progress = await taskProgressService.getProgress(testUser.id);
      expect(progress).not.toBeNull();
      expect(progress.user_id).toBe(testUser.id);
      expect(progress.current_task_index).toBe(1);
      expect(progress.current_rotation_version).toBe(1);
    });
  });

  describe('initializeProgress', () => {
    test('should create progress record with default values', async () => {
      const progress = await taskProgressService.initializeProgress(testUser.id);

      expect(progress).toHaveProperty('id');
      expect(progress.user_id).toBe(testUser.id);
      expect(progress.current_task_index).toBe(1);
      expect(progress.current_rotation_version).toBe(1);
      expect(progress.has_pending_config_changes).toBe(false);
      expect(progress.rotation_generated_at).toBeInstanceOf(Date);
    });

    test('should accept custom rotation version', async () => {
      const progress = await taskProgressService.initializeProgress(testUser.id, 5);

      expect(progress.current_rotation_version).toBe(5);
    });
  });

  describe('getCurrentTask', () => {
    test('should return null for user without configured rooms', async () => {
      const task = await taskProgressService.getCurrentTask(testUser.id);
      expect(task).toBeNull();
    });

    test('should auto-initialize progress for user with rooms', async () => {
      await setupTestRooms(testUser.id, 1);

      const task = await taskProgressService.getCurrentTask(testUser.id);

      expect(task).not.toBeNull();
      expect(task.sequence_position).toBe(1);
      expect(task.rotation_version).toBe(1);

      // Verify progress was created
      const progress = await taskProgressService.getProgress(testUser.id);
      expect(progress).not.toBeNull();
      expect(progress.current_task_index).toBe(1);
    });

    test('should auto-generate rotation if needed', async () => {
      await setupTestRooms(testUser.id, 1);

      const task = await taskProgressService.getCurrentTask(testUser.id);

      expect(task).not.toBeNull();

      // Verify rotation was generated
      const tasks = await prisma.task_rotation.findMany({
        where: { user_id: testUser.id, rotation_version: 1 }
      });

      expect(tasks.length).toBeGreaterThan(0);
    });

    test('should return correct current task', async () => {
      await setupTestRooms(testUser.id, 2);
      // generateRotation already creates/updates progress via upsert
      await taskGenerationService.generateRotation(testUser.id);

      const task = await taskProgressService.getCurrentTask(testUser.id);

      expect(task).not.toBeNull();
      expect(task.sequence_position).toBe(1);
      expect(task.task_type).toBe('pillar');
    });
  });

  describe('advanceToNextTask', () => {
    test('should advance through rotation correctly', async () => {
      await setupTestRooms(testUser.id, 2);
      await taskGenerationService.generateRotation(testUser.id);

      const task1 = await taskProgressService.getCurrentTask(testUser.id);
      expect(task1.sequence_position).toBe(1);

      const task2 = await taskProgressService.advanceToNextTask(testUser.id);
      expect(task2.sequence_position).toBe(2);

      const task3 = await taskProgressService.advanceToNextTask(testUser.id);
      expect(task3.sequence_position).toBe(3);

      // Verify progress was updated
      const progress = await taskProgressService.getProgress(testUser.id);
      expect(progress.current_task_index).toBe(3);
    });

    test('should throw error if progress not initialized', async () => {
      await expect(
        taskProgressService.advanceToNextTask(testUser.id)
      ).rejects.toThrow('User progress not initialized');
    });

    test('should maintain correct task order', async () => {
      await setupTestRooms(testUser.id, 2);
      await taskGenerationService.generateRotation(testUser.id);

      const task1 = await taskProgressService.getCurrentTask(testUser.id);
      const task2 = await taskProgressService.advanceToNextTask(testUser.id);
      const task3 = await taskProgressService.advanceToNextTask(testUser.id);

      expect(task1.sequence_position).toBeLessThan(task2.sequence_position);
      expect(task2.sequence_position).toBeLessThan(task3.sequence_position);
    });
  });

  describe('detectCycleCompletion', () => {
    test('should return false when cycle is not complete', async () => {
      await setupTestRooms(testUser.id, 2);
      await taskGenerationService.generateRotation(testUser.id);
      await taskProgressService.getCurrentTask(testUser.id);

      const isComplete = await taskProgressService.detectCycleCompletion(testUser.id);
      expect(isComplete).toBe(false);
    });

    test('should return true when cycle is complete', async () => {
      await setupTestRooms(testUser.id, 1, { hasGlass: false });
      await taskGenerationService.generateRotation(testUser.id);
      await taskProgressService.getCurrentTask(testUser.id);

      // Advance past all tasks
      await advanceToEndOfCycle(testUser.id);

      // Manually set progress beyond total tasks
      const progress = await taskProgressService.getProgress(testUser.id);
      const totalTasks = await taskGenerationService.getRotationTaskCount(
        testUser.id,
        progress.current_rotation_version
      );

      await prisma.user_task_progress.update({
        where: { user_id: testUser.id },
        data: { current_task_index: totalTasks + 1 }
      });

      const isComplete = await taskProgressService.detectCycleCompletion(testUser.id);
      expect(isComplete).toBe(true);
    });

    test('should return false for user without progress', async () => {
      const isComplete = await taskProgressService.detectCycleCompletion(testUser.id);
      expect(isComplete).toBe(false);
    });
  });

  describe('handleCycleCompletion', () => {
    test('should detect cycle completion and regenerate', async () => {
      // Setup small rotation (2 pillar tasks)
      await setupTestRooms(testUser.id, 1, { hasGlass: false });

      // generateRotation already initializes progress via upsert
      const rotation1 = await taskGenerationService.generateRotation(testUser.id);

      const totalTasks = rotation1.total_tasks;
      expect(totalTasks).toBe(2); // surfaces + floor

      // Advance to end
      await taskProgressService.advanceToNextTask(testUser.id); // task 2

      // Next advance should trigger regeneration
      const newTask = await taskProgressService.advanceToNextTask(testUser.id);

      expect(newTask.sequence_position).toBe(1);
      expect(newTask.rotation_version).toBe(rotation1.version + 1);

      // Verify progress was reset
      const progress = await taskProgressService.getProgress(testUser.id);
      expect(progress.current_task_index).toBe(1);
      expect(progress.current_rotation_version).toBe(rotation1.version + 1);
    });

    test('should apply pending config changes on cycle completion', async () => {
      // Setup initial rotation
      await setupTestRooms(testUser.id, 1, { hasGlass: false });
      await taskGenerationService.generateRotation(testUser.id);
      await taskProgressService.getCurrentTask(testUser.id);

      // Stage pending changes (add a room)
      const newRoom = await roomService.createRoom(testUser.id, {
        roomType: 'kitchen',
        customName: 'New Kitchen',
        hasGlass: true
      });

      const progress = await taskProgressService.getProgress(testUser.id);
      expect(progress.has_pending_config_changes).toBe(true);

      // Advance to end of cycle
      await advanceToEndOfCycle(testUser.id);

      // Trigger cycle completion
      const newTask = await taskProgressService.advanceToNextTask(testUser.id);

      // Verify pending changes applied (flag cleared)
      const newProgress = await taskProgressService.getProgress(testUser.id);
      expect(newProgress.has_pending_config_changes).toBe(false);

      // Verify new rotation includes both rooms
      const tasks = await prisma.task_rotation.findMany({
        where: {
          user_id: testUser.id,
          rotation_version: newProgress.current_rotation_version
        }
      });

      const uniqueRoomIds = new Set(tasks.filter(t => t.room_id).map(t => t.room_id));
      expect(uniqueRoomIds.size).toBe(2); // Both rooms should be in rotation
    });

    test('should shuffle keystones on regeneration', async () => {
      await setupTestRooms(testUser.id, 1, { hasGlass: false });
      await keystoneService.initializeDefaultKeystones(testUser.id);

      // Enable just a few keystones
      const keystones = await keystoneService.getUserKeystones(testUser.id);
      await keystoneService.updateKeystone(keystones[0].id, testUser.id, { isActive: true });
      await keystoneService.updateKeystone(keystones[1].id, testUser.id, { isActive: true });

      // generateRotation already initializes progress via upsert
      const rotation1 = await taskGenerationService.generateRotation(testUser.id);

      // Get keystone order in first rotation
      const tasks1 = await prisma.task_rotation.findMany({
        where: { user_id: testUser.id, rotation_version: rotation1.version },
        orderBy: { sequence_position: 'asc' }
      });
      const keystones1 = tasks1.filter(t => t.task_type === 'keystone').map(t => t.keystone_type);

      // Advance to cycle completion
      await advanceToEndOfCycle(testUser.id);
      await taskProgressService.advanceToNextTask(testUser.id);

      const progress = await taskProgressService.getProgress(testUser.id);

      // Get keystone order in new rotation
      const tasks2 = await prisma.task_rotation.findMany({
        where: { user_id: testUser.id, rotation_version: progress.current_rotation_version },
        orderBy: { sequence_position: 'asc' }
      });
      const keystones2 = tasks2.filter(t => t.task_type === 'keystone').map(t => t.keystone_type);

      // Should have same keystones (potentially different order due to shuffling)
      expect(keystones1.length).toBe(keystones2.length);
      expect([...keystones1].sort()).toEqual([...keystones2].sort());
    });
  });

  describe('stagePendingChanges', () => {
    test('should validate configuration data', async () => {
      const invalidConfig = {
        rooms: 'not-an-array' // Invalid
      };

      await expect(
        taskProgressService.stagePendingChanges(testUser.id, invalidConfig)
      ).rejects.toThrow('Invalid configuration data');
    });

    test('should create pending config record', async () => {
      await setupTestRooms(testUser.id, 1);
      await taskGenerationService.generateRotation(testUser.id);
      await taskProgressService.getCurrentTask(testUser.id);

      const validConfig = {
        rooms: [],
        keystones: []
      };

      await taskProgressService.stagePendingChanges(testUser.id, validConfig);

      const pending = await prisma.pending_room_configs.findUnique({
        where: { user_id: testUser.id }
      });

      expect(pending).not.toBeNull();
      expect(pending.config_data).toBeTruthy();

      const parsed = JSON.parse(pending.config_data);
      expect(parsed).toHaveProperty('rooms');
      expect(parsed).toHaveProperty('keystones');
    });

    test('should mark user as having pending changes', async () => {
      await setupTestRooms(testUser.id, 1);
      await taskGenerationService.generateRotation(testUser.id);
      await taskProgressService.getCurrentTask(testUser.id);

      const validConfig = {
        rooms: [],
        keystones: []
      };

      await taskProgressService.stagePendingChanges(testUser.id, validConfig);

      const progress = await taskProgressService.getProgress(testUser.id);
      expect(progress.has_pending_config_changes).toBe(true);
    });

    test('should update existing pending config', async () => {
      await setupTestRooms(testUser.id, 1);
      await taskGenerationService.generateRotation(testUser.id);
      await taskProgressService.getCurrentTask(testUser.id);

      const config1 = { rooms: [], keystones: [] };
      await taskProgressService.stagePendingChanges(testUser.id, config1);

      const config2 = {
        rooms: [{
          id: 'test-room-id',
          roomType: 'bedroom',
          customName: 'Test Room',
          hasGlass: true,
          sortOrder: 1,
          isActive: true
        }],
        keystones: []
      };
      await taskProgressService.stagePendingChanges(testUser.id, config2);

      const pending = await prisma.pending_room_configs.findUnique({
        where: { user_id: testUser.id }
      });

      const parsed = JSON.parse(pending.config_data);
      expect(parsed.rooms.length).toBe(1);
    });
  });

  describe('getPendingChanges', () => {
    test('should return null when no pending changes', async () => {
      const pending = await taskProgressService.getPendingChanges(testUser.id);
      expect(pending).toBeNull();
    });

    test('should return parsed config data', async () => {
      await setupTestRooms(testUser.id, 1);
      await taskGenerationService.generateRotation(testUser.id);
      await taskProgressService.getCurrentTask(testUser.id);

      const config = {
        rooms: [{
          id: 'test-room-id',
          roomType: 'kitchen',
          customName: 'Test Kitchen',
          hasGlass: false,
          sortOrder: 1,
          isActive: true
        }],
        keystones: []
      };
      await taskProgressService.stagePendingChanges(testUser.id, config);

      const pending = await taskProgressService.getPendingChanges(testUser.id);

      expect(pending).not.toBeNull();
      expect(pending).toHaveProperty('rooms');
      expect(pending).toHaveProperty('keystones');
      expect(pending.rooms.length).toBe(1);
    });
  });

  describe('clearPendingChanges', () => {
    test('should delete pending config record', async () => {
      await setupTestRooms(testUser.id, 1);
      await taskGenerationService.generateRotation(testUser.id);
      await taskProgressService.getCurrentTask(testUser.id);

      const config = { rooms: [], keystones: [] };
      await taskProgressService.stagePendingChanges(testUser.id, config);

      await taskProgressService.clearPendingChanges(testUser.id);

      const pending = await prisma.pending_room_configs.findUnique({
        where: { user_id: testUser.id }
      });

      expect(pending).toBeNull();
    });

    test('should clear pending changes flag', async () => {
      await setupTestRooms(testUser.id, 1);
      await taskGenerationService.generateRotation(testUser.id);
      await taskProgressService.getCurrentTask(testUser.id);

      const config = { rooms: [], keystones: [] };
      await taskProgressService.stagePendingChanges(testUser.id, config);

      await taskProgressService.clearPendingChanges(testUser.id);

      const progress = await taskProgressService.getProgress(testUser.id);
      expect(progress.has_pending_config_changes).toBe(false);
    });

    test('should not fail when no pending changes exist', async () => {
      await setupTestRooms(testUser.id, 1);
      await taskGenerationService.generateRotation(testUser.id);
      await taskProgressService.getCurrentTask(testUser.id);

      await expect(
        taskProgressService.clearPendingChanges(testUser.id)
      ).resolves.toBe(true);
    });
  });

  describe('migration and backward compatibility', () => {
    test('should handle existing user without rooms', async () => {
      // User without rooms should get null task
      const task = await taskProgressService.getCurrentTask(testUser.id);
      expect(task).toBeNull();
    });

    test('should auto-migrate user with rooms but no progress', async () => {
      await setupTestRooms(testUser.id, 1);

      // First call should auto-initialize
      const task = await taskProgressService.getCurrentTask(testUser.id);

      expect(task).not.toBeNull();
      expect(task.sequence_position).toBe(1);

      // Verify progress and rotation were created
      const progress = await taskProgressService.getProgress(testUser.id);
      expect(progress).not.toBeNull();

      const tasks = await prisma.task_rotation.findMany({
        where: { user_id: testUser.id }
      });
      expect(tasks.length).toBeGreaterThan(0);
    });

    test('should handle user who adds rooms after initial registration', async () => {
      // Initially no rooms
      const task1 = await taskProgressService.getCurrentTask(testUser.id);
      expect(task1).toBeNull();

      // User configures rooms
      await setupTestRooms(testUser.id, 1);

      // Should now get a task
      const task2 = await taskProgressService.getCurrentTask(testUser.id);
      expect(task2).not.toBeNull();
      expect(task2.sequence_position).toBe(1);
    });
  });
});
