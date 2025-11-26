/**
 * Room Configuration Flow Integration Tests
 *
 * End-to-end integration tests for the complete room customization flow including:
 * - Complete flow: configure rooms → generate rotation → complete tasks
 * - Room CRUD operations via API
 * - Task progression through rotation
 * - Cycle completion and regeneration
 */

const request = require('supertest');
const app = require('../../src/app');
const { prisma } = require('../../src/config/prisma');
const {
  createAuthenticatedUser,
  getAuthHeader,
  cleanupTestData
} = require('../utils/testHelpers');

// Load setup
require('../setup');

describe('Room Configuration Flow Integration Tests', () => {
  let authUser;
  let authToken;

  beforeEach(async () => {
    await cleanupTestData();
    // Clean up room-related tables
    await prisma.task_rotation.deleteMany({});
    await prisma.user_task_progress.deleteMany({});
    await prisma.pending_room_configs.deleteMany({});
    await prisma.user_keystone_tasks.deleteMany({});
    await prisma.user_rooms.deleteMany({});

    authUser = await createAuthenticatedUser();
    authToken = authUser.accessToken;
  });

  describe('Complete Flow: Configure → Generate → Complete', () => {
    test('complete flow: configure rooms → generate rotation → complete tasks', async () => {
      // 1. User creates first room
      const room1Response = await request(app)
        .post('/api/rooms')
        .set(getAuthHeader(authToken))
        .send({
          roomType: 'kitchen',
          customName: 'Kitchen',
          hasGlass: true
        });

      expect(room1Response.status).toBe(201);
      expect(room1Response.body.room).toHaveProperty('id');
      expect(room1Response.body.room.custom_name).toBe('Kitchen');

      // 2. User creates second room
      const room2Response = await request(app)
        .post('/api/rooms')
        .set(getAuthHeader(authToken))
        .send({
          roomType: 'bedroom',
          customName: 'Master Bedroom',
          hasGlass: false
        });

      expect(room2Response.status).toBe(201);
      expect(room2Response.body.room.custom_name).toBe('Master Bedroom');

      // 3. System auto-generates rotation on first task request
      const currentTaskResponse = await request(app)
        .get('/api/tasks/current')
        .set(getAuthHeader(authToken));

      expect(currentTaskResponse.status).toBe(200);
      expect(currentTaskResponse.body.task).toBeDefined();
      expect(currentTaskResponse.body.task.position).toBe(1);
      expect(currentTaskResponse.body.task.description).toBeTruthy();

      const firstTask = currentTaskResponse.body.task;

      // 4. User completes first task
      const completionResponse = await request(app)
        .post('/api/user/complete')
        .set(getAuthHeader(authToken))
        .send({
          taskName: firstTask.description,
          task_rotation_id: firstTask.id
        });

      expect(completionResponse.status).toBe(201);
      expect(completionResponse.body).toHaveProperty('completion');
      expect(completionResponse.body).toHaveProperty('next_task');
      expect(completionResponse.body.next_task.position).toBe(2);

      // 5. Verify progression to next task
      const nextTaskResponse = await request(app)
        .get('/api/tasks/current')
        .set(getAuthHeader(authToken));

      expect(nextTaskResponse.status).toBe(200);
      expect(nextTaskResponse.body.task.position).toBe(2);
      expect(nextTaskResponse.body.task.id).not.toBe(firstTask.id);

      // 6. Verify completion was recorded
      const historyResponse = await request(app)
        .get('/api/user/history?limit=10')
        .set(getAuthHeader(authToken));

      expect(historyResponse.status).toBe(200);
      expect(historyResponse.body.history.length).toBe(1);
      expect(historyResponse.body.history[0].task_name).toBe(firstTask.description);
    });

    test('should handle multiple task completions in sequence', async () => {
      // Setup rooms
      await request(app)
        .post('/api/rooms')
        .set(getAuthHeader(authToken))
        .send({
          roomType: 'bedroom',
          customName: 'Bedroom',
          hasGlass: false
        });

      // Complete multiple tasks
      for (let i = 0; i < 3; i++) {
        const currentTask = await request(app)
          .get('/api/tasks/current')
          .set(getAuthHeader(authToken));

        expect(currentTask.status).toBe(200);
        expect(currentTask.body.task.position).toBe(i + 1);

        const completion = await request(app)
          .post('/api/user/complete')
          .set(getAuthHeader(authToken))
          .send({
            taskName: currentTask.body.task.description,
            task_rotation_id: currentTask.body.task.id
          });

        expect(completion.status).toBe(201);

        if (i < 2) {
          expect(completion.body.next_task.position).toBe(i + 2);
        }
      }

      // Verify all completions recorded
      const history = await request(app)
        .get('/api/user/history?limit=10')
        .set(getAuthHeader(authToken));

      expect(history.body.history.length).toBe(3);
    });
  });

  describe('Room CRUD Operations via API', () => {
    test('should create room with valid data', async () => {
      const response = await request(app)
        .post('/api/rooms')
        .set(getAuthHeader(authToken))
        .send({
          roomType: 'bathroom',
          customName: 'Guest Bath',
          hasGlass: true
        });

      expect(response.status).toBe(201);
      expect(response.body.room).toHaveProperty('id');
      expect(response.body.room.room_type).toBe('bathroom');
      expect(response.body.room.custom_name).toBe('Guest Bath');
      expect(response.body.room.has_glass).toBe(true);
    });

    test('should retrieve all user rooms', async () => {
      // Create multiple rooms
      await request(app)
        .post('/api/rooms')
        .set(getAuthHeader(authToken))
        .send({
          roomType: 'kitchen',
          customName: 'Kitchen',
          hasGlass: true
        });

      await request(app)
        .post('/api/rooms')
        .set(getAuthHeader(authToken))
        .send({
          roomType: 'bedroom',
          customName: 'Bedroom',
          hasGlass: false
        });

      const response = await request(app)
        .get('/api/rooms')
        .set(getAuthHeader(authToken));

      expect(response.status).toBe(200);
      expect(response.body.rooms).toHaveLength(2);
      expect(response.body.rooms[0].sort_order).toBe(1);
      expect(response.body.rooms[1].sort_order).toBe(2);
    });

    test('should update room', async () => {
      const createResponse = await request(app)
        .post('/api/rooms')
        .set(getAuthHeader(authToken))
        .send({
          roomType: 'kitchen',
          customName: 'Old Kitchen',
          hasGlass: true
        });

      const roomId = createResponse.body.room.id;

      const updateResponse = await request(app)
        .put(`/api/rooms/${roomId}`)
        .set(getAuthHeader(authToken))
        .send({
          customName: 'New Kitchen',
          hasGlass: false
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.room.custom_name).toBe('New Kitchen');
      expect(updateResponse.body.room.has_glass).toBe(false);
    });

    test('should delete room', async () => {
      const createResponse = await request(app)
        .post('/api/rooms')
        .set(getAuthHeader(authToken))
        .send({
          roomType: 'kitchen',
          customName: 'Kitchen',
          hasGlass: true
        });

      const roomId = createResponse.body.room.id;

      const deleteResponse = await request(app)
        .delete(`/api/rooms/${roomId}`)
        .set(getAuthHeader(authToken));

      expect(deleteResponse.status).toBe(200);

      // Verify room is no longer in active list
      const listResponse = await request(app)
        .get('/api/rooms')
        .set(getAuthHeader(authToken));

      expect(listResponse.body.rooms).toHaveLength(0);
    });

    test('should reorder rooms', async () => {
      const room1 = await request(app)
        .post('/api/rooms')
        .set(getAuthHeader(authToken))
        .send({
          roomType: 'kitchen',
          customName: 'Room 1',
          hasGlass: true
        });

      const room2 = await request(app)
        .post('/api/rooms')
        .set(getAuthHeader(authToken))
        .send({
          roomType: 'bedroom',
          customName: 'Room 2',
          hasGlass: true
        });

      const room3 = await request(app)
        .post('/api/rooms')
        .set(getAuthHeader(authToken))
        .send({
          roomType: 'bathroom',
          customName: 'Room 3',
          hasGlass: true
        });

      // Reorder: room3, room1, room2
      const reorderResponse = await request(app)
        .put('/api/rooms/reorder')
        .set(getAuthHeader(authToken))
        .send({
          roomIds: [room3.body.room.id, room1.body.room.id, room2.body.room.id]
        });

      expect(reorderResponse.status).toBe(200);

      // Verify new order
      const listResponse = await request(app)
        .get('/api/rooms')
        .set(getAuthHeader(authToken));

      expect(listResponse.body.rooms[0].id).toBe(room3.body.room.id);
      expect(listResponse.body.rooms[1].id).toBe(room1.body.room.id);
      expect(listResponse.body.rooms[2].id).toBe(room2.body.room.id);
    });

    test('should reject invalid room type', async () => {
      const response = await request(app)
        .post('/api/rooms')
        .set(getAuthHeader(authToken))
        .send({
          roomType: 'invalid_room_type',
          customName: 'Test Room',
          hasGlass: true
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('should reject unauthorized room access', async () => {
      const otherUser = await createAuthenticatedUser();

      const createResponse = await request(app)
        .post('/api/rooms')
        .set(getAuthHeader(otherUser.accessToken))
        .send({
          roomType: 'kitchen',
          customName: 'Other User Kitchen',
          hasGlass: true
        });

      const roomId = createResponse.body.room.id;

      // Try to access other user's room
      const getResponse = await request(app)
        .get(`/api/rooms/${roomId}`)
        .set(getAuthHeader(authToken));

      expect(getResponse.status).toBe(404);
    });
  });

  describe('Task Progression Through Rotation', () => {
    test('should maintain correct task progression', async () => {
      // Setup room
      await request(app)
        .post('/api/rooms')
        .set(getAuthHeader(authToken))
        .send({
          roomType: 'bedroom',
          customName: 'Bedroom',
          hasGlass: true
        });

      // Get initial task
      const task1 = await request(app)
        .get('/api/tasks/current')
        .set(getAuthHeader(authToken));

      expect(task1.body.task.position).toBe(1);
      expect(task1.body.progress.total_tasks).toBeGreaterThan(0);

      // Complete and advance
      const completion1 = await request(app)
        .post('/api/user/complete')
        .set(getAuthHeader(authToken))
        .send({
          taskName: task1.body.task.description,
          task_rotation_id: task1.body.task.id
        });

      expect(completion1.body.next_task.position).toBe(2);

      // Get task 2
      const task2 = await request(app)
        .get('/api/tasks/current')
        .set(getAuthHeader(authToken));

      expect(task2.body.task.position).toBe(2);
      expect(task2.body.task.id).not.toBe(task1.body.task.id);
    });

    test('should display correct progress information', async () => {
      await request(app)
        .post('/api/rooms')
        .set(getAuthHeader(authToken))
        .send({
          roomType: 'kitchen',
          customName: 'Kitchen',
          hasGlass: false
        });

      const response = await request(app)
        .get('/api/tasks/current')
        .set(getAuthHeader(authToken));

      expect(response.body).toHaveProperty('task');
      expect(response.body).toHaveProperty('progress');
      expect(response.body.progress).toHaveProperty('current_position');
      expect(response.body.progress).toHaveProperty('total_tasks');
      expect(response.body.progress).toHaveProperty('rotation_version');
    });

    test('should include room and pillar information in tasks', async () => {
      await request(app)
        .post('/api/rooms')
        .set(getAuthHeader(authToken))
        .send({
          roomType: 'bathroom',
          customName: 'Main Bath',
          hasGlass: true
        });

      const response = await request(app)
        .get('/api/tasks/current')
        .set(getAuthHeader(authToken));

      const task = response.body.task;
      expect(task).toHaveProperty('type');

      if (task.type === 'pillar') {
        expect(task).toHaveProperty('pillar');
        expect(task).toHaveProperty('room');
        expect(['glass', 'surfaces', 'floor']).toContain(task.pillar);
      }
    });
  });

  describe('Task Preview', () => {
    test('should retrieve task preview', async () => {
      await request(app)
        .post('/api/rooms')
        .set(getAuthHeader(authToken))
        .send({
          roomType: 'kitchen',
          customName: 'Kitchen',
          hasGlass: true
        });

      const response = await request(app)
        .get('/api/tasks/preview')
        .set(getAuthHeader(authToken));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('preview');
      expect(Array.isArray(response.body.preview)).toBe(true);
      expect(response.body.preview.length).toBeGreaterThan(0);

      // Verify first task is marked as current
      expect(response.body.preview[0]).toHaveProperty('is_current');
      expect(response.body.preview[0].is_current).toBe(true);
    });

    test('should show upcoming tasks in order', async () => {
      await request(app)
        .post('/api/rooms')
        .set(getAuthHeader(authToken))
        .send({
          roomType: 'bedroom',
          customName: 'Bedroom',
          hasGlass: false
        });

      const response = await request(app)
        .get('/api/tasks/preview')
        .set(getAuthHeader(authToken));

      const preview = response.body.preview;

      // Verify positions are sequential
      for (let i = 0; i < preview.length; i++) {
        expect(preview[i].position).toBe(i + 1);
      }
    });
  });

  describe('Cycle Completion and Regeneration', () => {
    test('should regenerate rotation after cycle completion', async () => {
      // Create room with minimal tasks (no glass = 2 tasks only)
      await request(app)
        .post('/api/rooms')
        .set(getAuthHeader(authToken))
        .send({
          roomType: 'bedroom',
          customName: 'Bedroom',
          hasGlass: false
        });

      // Get rotation info
      const initialTask = await request(app)
        .get('/api/tasks/current')
        .set(getAuthHeader(authToken));

      const totalTasks = initialTask.body.progress.total_tasks;
      const initialVersion = initialTask.body.progress.rotation_version;

      // Complete all tasks
      for (let i = 0; i < totalTasks; i++) {
        const currentTask = await request(app)
          .get('/api/tasks/current')
          .set(getAuthHeader(authToken));

        await request(app)
          .post('/api/user/complete')
          .set(getAuthHeader(authToken))
          .send({
            taskName: currentTask.body.task.description,
            task_rotation_id: currentTask.body.task.id
          });
      }

      // Next task should be from new rotation
      const newCycleTask = await request(app)
        .get('/api/tasks/current')
        .set(getAuthHeader(authToken));

      expect(newCycleTask.body.task.position).toBe(1);
      expect(newCycleTask.body.progress.rotation_version).toBe(initialVersion + 1);
    });

    test('should apply pending changes on cycle completion', async () => {
      // Create initial room
      await request(app)
        .post('/api/rooms')
        .set(getAuthHeader(authToken))
        .send({
          roomType: 'bedroom',
          customName: 'Bedroom',
          hasGlass: false
        });

      // Generate rotation
      const initialTask = await request(app)
        .get('/api/tasks/current')
        .set(getAuthHeader(authToken));

      const totalTasks = initialTask.body.progress.total_tasks;

      // Add another room (creates pending change)
      await request(app)
        .post('/api/rooms')
        .set(getAuthHeader(authToken))
        .send({
          roomType: 'kitchen',
          customName: 'Kitchen',
          hasGlass: true
        });

      // Complete cycle
      for (let i = 0; i < totalTasks; i++) {
        const currentTask = await request(app)
          .get('/api/tasks/current')
          .set(getAuthHeader(authToken));

        await request(app)
          .post('/api/user/complete')
          .set(getAuthHeader(authToken))
          .send({
            taskName: currentTask.body.task.description,
            task_rotation_id: currentTask.body.task.id
          });
      }

      // New rotation should include both rooms
      const newCycleTask = await request(app)
        .get('/api/tasks/current')
        .set(getAuthHeader(authToken));

      // Verify new rotation has more tasks (both rooms)
      expect(newCycleTask.body.progress.total_tasks).toBeGreaterThan(totalTasks);
    });
  });

  describe('Rotation Regeneration', () => {
    test('should manually regenerate rotation', async () => {
      await request(app)
        .post('/api/rooms')
        .set(getAuthHeader(authToken))
        .send({
          roomType: 'kitchen',
          customName: 'Kitchen',
          hasGlass: true
        });

      // Get initial rotation
      const initialTask = await request(app)
        .get('/api/tasks/current')
        .set(getAuthHeader(authToken));

      const initialVersion = initialTask.body.progress.rotation_version;

      // Regenerate
      const regenerateResponse = await request(app)
        .post('/api/tasks/regenerate')
        .set(getAuthHeader(authToken));

      expect(regenerateResponse.status).toBe(200);
      expect(regenerateResponse.body).toHaveProperty('rotation');
      expect(regenerateResponse.body.rotation.version).toBe(initialVersion + 1);

      // Verify new rotation is active
      const newTask = await request(app)
        .get('/api/tasks/current')
        .set(getAuthHeader(authToken));

      expect(newTask.body.task.position).toBe(1);
      expect(newTask.body.progress.rotation_version).toBe(initialVersion + 1);
    });
  });

  describe('Backward Compatibility - Legacy Mode', () => {
    test('should return null task for user without rooms', async () => {
      const response = await request(app)
        .get('/api/tasks/current')
        .set(getAuthHeader(authToken));

      expect(response.status).toBe(200);
      expect(response.body.task).toBeNull();
      expect(response.body.hasConfiguredRooms).toBe(false);
    });

    test('should auto-initialize for user who adds rooms', async () => {
      // Initially no rooms
      const task1 = await request(app)
        .get('/api/tasks/current')
        .set(getAuthHeader(authToken));

      expect(task1.body.task).toBeNull();

      // Add room
      await request(app)
        .post('/api/rooms')
        .set(getAuthHeader(authToken))
        .send({
          roomType: 'bedroom',
          customName: 'Bedroom',
          hasGlass: true
        });

      // Should now get task
      const task2 = await request(app)
        .get('/api/tasks/current')
        .set(getAuthHeader(authToken));

      expect(task2.body.task).not.toBeNull();
      expect(task2.body.task.position).toBe(1);
      expect(task2.body.hasConfiguredRooms).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing authentication', async () => {
      const response = await request(app)
        .get('/api/tasks/current');

      expect(response.status).toBe(401);
    });

    test('should handle invalid room data', async () => {
      const response = await request(app)
        .post('/api/rooms')
        .set(getAuthHeader(authToken))
        .send({
          roomType: 'bedroom',
          customName: '',
          hasGlass: true
        });

      expect(response.status).toBe(400);
    });

    test('should handle completion without rotation', async () => {
      const response = await request(app)
        .post('/api/user/complete')
        .set(getAuthHeader(authToken))
        .send({
          taskName: 'Some task',
          task_rotation_id: null
        });

      // Should still work for legacy mode
      expect([200, 201]).toContain(response.status);
    });
  });
});
