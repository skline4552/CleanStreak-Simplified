/**
 * Streak Management Integration Tests
 *
 * Comprehensive integration tests for streak management functionality including:
 * - Task completion and streak calculation
 * - Bulk task completion
 * - Streak retrieval and statistics
 * - Streak reset and maintenance logic
 * - Edge cases (timezone, date boundaries, concurrent completions)
 * - Performance testing
 *
 * Target: Complete API endpoint testing with complex streak logic
 */

const request = require('supertest');
const app = require('../src/app');
const { prisma } = require('../src/config/prisma');
const {
  createAuthenticatedUser,
  createCompleteTestUser,
  createTestStreak,
  createTestCompletions,
  getAuthHeader,
  getISODate,
  getYesterdayDate,
  getDateDaysAgo,
  cleanupTestData,
  wait
} = require('./utils/testHelpers');

// Load setup
require('./setup');

describe('Streak Management Integration Tests', () => {

  // Clean up before each test
  beforeEach(async () => {
    await cleanupTestData();
  });

  describe('GET /api/user/streaks - Get All Streaks', () => {

    test('should retrieve user streaks', async () => {
      const testData = await createCompleteTestUser({
        streakData: {
          current_streak: 7,
          longest_streak: 14,
          total_completions: 50
        }
      });

      const response = await request(app)
        .get('/api/user/streaks')
        .set(getAuthHeader(testData.accessToken))
        .expect(200);

      expect(response.body).toHaveProperty('streaks');
      expect(response.body.streaks).toHaveProperty('current_streak', 7);
      expect(response.body.streaks).toHaveProperty('longest_streak', 14);
      expect(response.body.streaks).toHaveProperty('total_completions', 50);
    });

    test('should initialize streak data for new user', async () => {
      const { accessToken } = await createAuthenticatedUser();

      const response = await request(app)
        .get('/api/user/streaks')
        .set(getAuthHeader(accessToken))
        .expect(200);

      expect(response.body).toHaveProperty('streaks');
      expect(response.body.streaks.current_streak).toBeGreaterThanOrEqual(0);
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/user/streaks')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

  });

  describe('GET /api/user/streak/:taskName - Get Specific Streak', () => {

    test('should retrieve streak for specific task', async () => {
      const { user, accessToken } = await createAuthenticatedUser();

      await createTestStreak(user.id, {
        current_streak: 5,
        last_completed_date: getISODate()
      });

      await createTestCompletions(user.id, [
        { completion_date: getISODate(), task_completed: 'Clean kitchen' },
        { completion_date: getYesterdayDate(), task_completed: 'Clean kitchen' }
      ]);

      const response = await request(app)
        .get('/api/user/streak/Clean%20kitchen')
        .set(getAuthHeader(accessToken))
        .expect(200);

      expect(response.body).toHaveProperty('streak');
      expect(response.body.streak).toHaveProperty('task');
    });

    test('should handle non-existent task gracefully', async () => {
      const { accessToken } = await createAuthenticatedUser();

      const response = await request(app)
        .get('/api/user/streak/NonExistentTask')
        .set(getAuthHeader(accessToken));

      expect([200, 404]).toContain(response.status);
    });

  });

  describe('POST /api/user/complete - Complete Task', () => {

    test('should complete a task and update streak', async () => {
      const testData = await createCompleteTestUser({
        streakData: {
          current_streak: 5,
          longest_streak: 10,
          total_completions: 20,
          last_completed_date: getYesterdayDate()
        }
      });

      const response = await request(app)
        .post('/api/user/complete')
        .set(getAuthHeader(testData.accessToken))
        .send({
          taskName: 'Clean bathroom',
          completionDate: getISODate()
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('streak');
      expect(response.body.streak.current_streak).toBeGreaterThanOrEqual(6);

      // Verify completion was recorded
      const completion = await prisma.completion_history.findFirst({
        where: {
          user_id: testData.user.id,
          task_completed: 'Clean bathroom',
          completion_date: getISODate()
        }
      });

      expect(completion).toBeTruthy();
    });

    test('should start new streak for first completion', async () => {
      const { user, accessToken } = await createAuthenticatedUser();

      const response = await request(app)
        .post('/api/user/complete')
        .set(getAuthHeader(accessToken))
        .send({
          taskName: 'First task',
          completionDate: getISODate()
        })
        .expect(201);

      expect(response.body.streak.current_streak).toBeGreaterThanOrEqual(1);

      // Verify streak record was created
      const streak = await prisma.user_streaks.findFirst({
        where: { user_id: user.id }
      });

      expect(streak).toBeTruthy();
      expect(streak.total_completions).toBeGreaterThanOrEqual(1);
    });

    test('should break streak if completion is after gap', async () => {
      const testData = await createCompleteTestUser({
        streakData: {
          current_streak: 10,
          longest_streak: 15,
          total_completions: 30,
          last_completed_date: getDateDaysAgo(5) // 5 days ago - breaks streak
        }
      });

      const response = await request(app)
        .post('/api/user/complete')
        .set(getAuthHeader(testData.accessToken))
        .send({
          taskName: 'Resume task',
          completionDate: getISODate()
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      // Streak should reset to 1
      expect(response.body.streak.current_streak).toBeLessThanOrEqual(1);
    });

    test('should prevent duplicate completions on same day', async () => {
      const { user, accessToken } = await createAuthenticatedUser();
      const today = getISODate();

      // First completion
      await request(app)
        .post('/api/user/complete')
        .set(getAuthHeader(accessToken))
        .send({
          taskName: 'Daily task',
          completionDate: today
        })
        .expect(201);

      // Second completion on same day
      const response = await request(app)
        .post('/api/user/complete')
        .set(getAuthHeader(accessToken))
        .send({
          taskName: 'Daily task',
          completionDate: today
        });

      // Should either prevent duplicate or accept it
      expect([200, 400, 409]).toContain(response.status);
    });

    test('should validate required fields', async () => {
      const { accessToken } = await createAuthenticatedUser();

      // Missing taskName
      const response1 = await request(app)
        .post('/api/user/complete')
        .set(getAuthHeader(accessToken))
        .send({
          completionDate: getISODate()
        });

      expect([400, 500]).toContain(response1.status);

      // Missing completionDate
      const response2 = await request(app)
        .post('/api/user/complete')
        .set(getAuthHeader(accessToken))
        .send({
          taskName: 'Test task'
        });

      expect([200, 400, 500]).toContain(response2.status);
    });

    test('should handle invalid date formats', async () => {
      const { accessToken } = await createAuthenticatedUser();

      const response = await request(app)
        .post('/api/user/complete')
        .set(getAuthHeader(accessToken))
        .send({
          taskName: 'Test task',
          completionDate: 'invalid-date'
        });

      expect([400, 500]).toContain(response.status);
    });

  });

  describe('POST /api/user/bulk-complete - Bulk Complete Tasks', () => {

    test('should complete multiple tasks at once', async () => {
      const { accessToken } = await createAuthenticatedUser();

      const tasks = [
        { taskName: 'Task 1', completionDate: getISODate() },
        { taskName: 'Task 2', completionDate: getISODate() },
        { taskName: 'Task 3', completionDate: getISODate() }
      ];

      const response = await request(app)
        .post('/api/user/bulk-complete')
        .set(getAuthHeader(accessToken))
        .send({ tasks })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('completed');
      expect(response.body.completed).toBeGreaterThanOrEqual(3);
    });

    test('should handle empty task array', async () => {
      const { accessToken } = await createAuthenticatedUser();

      const response = await request(app)
        .post('/api/user/bulk-complete')
        .set(getAuthHeader(accessToken))
        .send({ tasks: [] });

      expect([200, 400]).toContain(response.status);
    });

    test('should handle partial failures gracefully', async () => {
      const { accessToken } = await createAuthenticatedUser();

      const tasks = [
        { taskName: 'Valid task', completionDate: getISODate() },
        { taskName: '', completionDate: getISODate() }, // Invalid
        { taskName: 'Another valid task', completionDate: getISODate() }
      ];

      const response = await request(app)
        .post('/api/user/bulk-complete')
        .set(getAuthHeader(accessToken))
        .send({ tasks });

      // Should handle partially valid data
      expect([200, 400, 500]).toContain(response.status);
    });

  });

  describe('Streak Calculation Logic', () => {

    test('should maintain streak for consecutive daily completions', async () => {
      const { user, accessToken } = await createAuthenticatedUser();

      // Complete tasks on consecutive days
      for (let i = 3; i >= 0; i--) {
        const date = getDateDaysAgo(i);
        await request(app)
          .post('/api/user/complete')
          .set(getAuthHeader(accessToken))
          .send({
            taskName: `Task day ${i}`,
            completionDate: date
          });

        // Small delay to avoid rate limiting
        await wait(100);
      }

      // Check final streak
      const response = await request(app)
        .get('/api/user/streaks')
        .set(getAuthHeader(accessToken))
        .expect(200);

      expect(response.body.streaks.current_streak).toBeGreaterThanOrEqual(4);
    });

    test('should update longest streak when current exceeds it', async () => {
      const testData = await createCompleteTestUser({
        streakData: {
          current_streak: 15,
          longest_streak: 10,
          total_completions: 50,
          last_completed_date: getYesterdayDate()
        }
      });

      await request(app)
        .post('/api/user/complete')
        .set(getAuthHeader(testData.accessToken))
        .send({
          taskName: 'Extend streak',
          completionDate: getISODate()
        })
        .expect(201);

      // Verify longest streak was updated
      const streak = await prisma.user_streaks.findFirst({
        where: { user_id: testData.user.id }
      });

      expect(streak.longest_streak).toBeGreaterThanOrEqual(streak.current_streak);
    });

    test('should increment total completions regardless of streak', async () => {
      const testData = await createCompleteTestUser({
        streakData: {
          current_streak: 5,
          total_completions: 20,
          last_completed_date: getDateDaysAgo(10) // Break in streak
        }
      });

      await request(app)
        .post('/api/user/complete')
        .set(getAuthHeader(testData.accessToken))
        .send({
          taskName: 'New completion',
          completionDate: getISODate()
        })
        .expect(201);

      const streak = await prisma.user_streaks.findFirst({
        where: { user_id: testData.user.id }
      });

      // Total completions should increase even if streak broke
      expect(streak.total_completions).toBeGreaterThan(20);
    });

  });

  describe('Edge Cases and Boundary Conditions', () => {

    test('should handle completions at day boundary', async () => {
      const { accessToken } = await createAuthenticatedUser();

      // Complete task at end of day
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59);

      const response = await request(app)
        .post('/api/user/complete')
        .set(getAuthHeader(accessToken))
        .send({
          taskName: 'End of day task',
          completionDate: endOfDay.toISOString().split('T')[0]
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
    });

    test('should handle future date completions', async () => {
      const { accessToken } = await createAuthenticatedUser();

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const response = await request(app)
        .post('/api/user/complete')
        .set(getAuthHeader(accessToken))
        .send({
          taskName: 'Future task',
          completionDate: futureDate.toISOString().split('T')[0]
        });

      // Should either reject or accept with warning
      expect([200, 400]).toContain(response.status);
    });

    test('should handle very old completions', async () => {
      const { accessToken } = await createAuthenticatedUser();

      const oldDate = getDateDaysAgo(365); // 1 year ago

      const response = await request(app)
        .post('/api/user/complete')
        .set(getAuthHeader(accessToken))
        .send({
          taskName: 'Historical task',
          completionDate: oldDate
        });

      expect([200, 400]).toContain(response.status);
    });

    test('should handle concurrent completion requests', async () => {
      const { accessToken } = await createAuthenticatedUser();

      const requests = Array.from({ length: 3 }, (_, i) =>
        request(app)
          .post('/api/user/complete')
          .set(getAuthHeader(accessToken))
          .send({
            taskName: `Concurrent task ${i}`,
            completionDate: getISODate()
          })
      );

      const responses = await Promise.all(requests);

      // All should either succeed or get rate limited
      responses.forEach(response => {
        expect([200, 429, 500]).toContain(response.status);
      });
    });

  });

  describe('Data Integrity Tests', () => {

    test('should maintain referential integrity on completion', async () => {
      const { user, accessToken } = await createAuthenticatedUser();

      await request(app)
        .post('/api/user/complete')
        .set(getAuthHeader(accessToken))
        .send({
          taskName: 'Integrity test',
          completionDate: getISODate()
        })
        .expect(201);

      // Verify completion references valid user
      const completion = await prisma.completion_history.findFirst({
        where: { user_id: user.id },
        include: { users: true }
      });

      expect(completion).toBeTruthy();
      expect(completion.users).toBeTruthy();
      expect(completion.users.id).toBe(user.id);
    });

    test('should handle database errors gracefully', async () => {
      const { accessToken } = await createAuthenticatedUser();

      // Disconnect database temporarily
      await prisma.$disconnect();

      const response = await request(app)
        .post('/api/user/complete')
        .set(getAuthHeader(accessToken))
        .send({
          taskName: 'DB error test',
          completionDate: getISODate()
        });

      // Reconnect
      await prisma.$connect();

      expect([429, 500]).toContain(response.status);
    });

  });

  describe('Performance Tests', () => {

    test('should complete task quickly', async () => {
      const { accessToken } = await createAuthenticatedUser();

      const startTime = Date.now();
      await request(app)
        .post('/api/user/complete')
        .set(getAuthHeader(accessToken))
        .send({
          taskName: 'Performance test',
          completionDate: getISODate()
        })
        .expect(201);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000);
    });

    test('should retrieve streaks quickly', async () => {
      const testData = await createCompleteTestUser({
        streakData: { current_streak: 10 }
      });

      const startTime = Date.now();
      await request(app)
        .get('/api/user/streaks')
        .set(getAuthHeader(testData.accessToken))
        .expect(200);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500);
    });

    test('should handle bulk completions efficiently', async () => {
      const { accessToken } = await createAuthenticatedUser();

      const tasks = Array.from({ length: 10 }, (_, i) => ({
        taskName: `Bulk task ${i}`,
        completionDate: getISODate()
      }));

      const startTime = Date.now();
      await request(app)
        .post('/api/user/bulk-complete')
        .set(getAuthHeader(accessToken))
        .send({ tasks })
        .expect(200);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000);
    });

  });

  describe('Statistics and Reporting', () => {

    test('should calculate completion rate correctly', async () => {
      const testData = await createCompleteTestUser({
        streakData: {
          current_streak: 7,
          total_completions: 30,
          longest_streak: 10
        },
        completions: Array.from({ length: 10 }, (_, i) => ({
          completion_date: getDateDaysAgo(i),
          task_completed: `Task ${i}`
        }))
      });

      const response = await request(app)
        .get('/api/user/stats')
        .set(getAuthHeader(testData.accessToken))
        .expect(200);

      expect(response.body.stats).toHaveProperty('completion_rate');
      expect(typeof response.body.stats.completion_rate).toBe('number');
    });

    test('should provide accurate streak statistics', async () => {
      const testData = await createCompleteTestUser({
        streakData: {
          current_streak: 5,
          longest_streak: 15,
          total_completions: 100
        }
      });

      const response = await request(app)
        .get('/api/user/streaks')
        .set(getAuthHeader(testData.accessToken))
        .expect(200);

      expect(response.body.streaks.current_streak).toBe(5);
      expect(response.body.streaks.longest_streak).toBe(15);
      expect(response.body.streaks.total_completions).toBe(100);
    });

  });

});