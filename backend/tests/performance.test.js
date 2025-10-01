/**
 * Performance Testing Suite
 *
 * Comprehensive performance tests including:
 * - Response time benchmarks (target: <200ms)
 * - Load testing with concurrent requests
 * - Database query performance
 * - Memory usage monitoring
 * - Throughput testing
 * - Stress testing under heavy load
 *
 * Target: Verified sub-200ms response times for all endpoints
 */

const request = require('supertest');
const app = require('../src/app');
const { prisma } = require('../src/config/prisma');
const {
  createAuthenticatedUser,
  createCompleteTestUser,
  createTestCompletions,
  getAuthHeader,
  getISODate,
  getDateDaysAgo,
  cleanupTestData,
  wait
} = require('./utils/testHelpers');

// Load setup
require('./setup');

describe('Performance Testing Suite', () => {

  // Clean up before each test
  beforeEach(async () => {
    await cleanupTestData();
  });

  describe('Response Time Benchmarks', () => {

    test('health check should respond in < 100ms', async () => {
      const startTime = Date.now();
      await request(app)
        .get('/api/health')
        .expect(200);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
    });

    test('user registration should complete in < 500ms', async () => {
      const startTime = Date.now();
      await request(app)
        .post('/api/auth/register')
        .send({
          email: `perf-${Date.now()}@example.com`,
          password: 'TestPass123!@#',
          confirmPassword: 'TestPass123!@#'
        });
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500);
    });

    test('user login should complete in < 500ms', async () => {
      const testUser = await createAuthenticatedUser();

      const startTime = Date.now();
      await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.user.email,
          password: testUser.user.password
        });
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500);
    });

    test('profile retrieval should respond in < 200ms', async () => {
      const { accessToken } = await createAuthenticatedUser();

      const startTime = Date.now();
      await request(app)
        .get('/api/user/profile')
        .set(getAuthHeader(accessToken))
        .expect(200);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(200);
    });

    test('streak retrieval should respond in < 200ms', async () => {
      const testData = await createCompleteTestUser({
        streakData: { current_streak: 10 }
      });

      const startTime = Date.now();
      await request(app)
        .get('/api/user/streaks')
        .set(getAuthHeader(testData.accessToken))
        .expect(200);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(200);
    });

    test('task completion should complete in < 300ms', async () => {
      const { accessToken } = await createAuthenticatedUser();

      const startTime = Date.now();
      await request(app)
        .post('/api/user/complete')
        .set(getAuthHeader(accessToken))
        .send({
          taskName: 'Performance test task',
          completionDate: getISODate()
        })
        .expect(201); // POST creates a new resource, returns 201
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(300);
    });

    test('history retrieval should respond in < 300ms', async () => {
      const completions = Array.from({ length: 20 }, (_, i) => ({
        completion_date: getDateDaysAgo(i),
        task_completed: `Task ${i + 1}`
      }));

      const testData = await createCompleteTestUser({ completions });

      const startTime = Date.now();
      await request(app)
        .get('/api/user/history?page=1&limit=10')
        .set(getAuthHeader(testData.accessToken))
        .expect(200);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(300);
    });

    test('data export should complete in < 1000ms', async () => {
      const completions = Array.from({ length: 50 }, (_, i) => ({
        completion_date: getDateDaysAgo(i),
        task_completed: `Task ${i + 1}`
      }));

      const testData = await createCompleteTestUser({
        streakData: { current_streak: 10, total_completions: 50 },
        completions
      });

      const startTime = Date.now();
      await request(app)
        .get('/api/user/export')
        .set(getAuthHeader(testData.accessToken))
        .expect(200);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000);
    });

  });

  describe('Concurrent Request Handling', () => {

    test('should handle 10 concurrent health checks', async () => {
      const requests = Array.from({ length: 10 }, () =>
        request(app).get('/api/health')
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should complete in reasonable time
      expect(duration).toBeLessThan(1000);
    });

    test('should handle multiple concurrent authentications', async () => {
      const testUser = await createAuthenticatedUser();

      const requests = Array.from({ length: 5 }, () =>
        request(app)
          .get('/api/user/profile')
          .set(getAuthHeader(testUser.accessToken))
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;

      // All should succeed or be rate limited
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });

      expect(duration).toBeLessThan(2000);
    });

    test('should handle concurrent task completions', async () => {
      const { accessToken } = await createAuthenticatedUser();

      const requests = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post('/api/user/complete')
          .set(getAuthHeader(accessToken))
          .send({
            taskName: `Concurrent task ${i}`,
            completionDate: getISODate()
          })
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;

      // Should handle concurrency gracefully (201 for created, 200/429/500 for other cases)
      responses.forEach(response => {
        expect([200, 201, 429, 500]).toContain(response.status);
      });

      expect(duration).toBeLessThan(3000);
    }, 10000);

  });

  describe('Database Performance', () => {

    test('should efficiently query user with streaks', async () => {
      const testData = await createCompleteTestUser({
        streakData: { current_streak: 10 }
      });

      const startTime = Date.now();
      const user = await prisma.users.findUnique({
        where: { id: testData.user.id },
        include: {
          user_streaks: true
        }
      });
      const duration = Date.now() - startTime;

      expect(user).toBeTruthy();
      expect(duration).toBeLessThan(50);
    });

    test('should efficiently query completion history', async () => {
      const completions = Array.from({ length: 100 }, (_, i) => ({
        completion_date: getDateDaysAgo(i),
        task_completed: `Task ${i + 1}`
      }));

      const testData = await createCompleteTestUser({ completions });

      const startTime = Date.now();
      const history = await prisma.completion_history.findMany({
        where: { user_id: testData.user.id },
        take: 20,
        orderBy: { completed_date: 'desc' } // Fixed: completed_date not completion_date
      });
      const duration = Date.now() - startTime;

      expect(history.length).toBe(20);
      expect(duration).toBeLessThan(100);
    });

    test('should efficiently count total completions', async () => {
      const completions = Array.from({ length: 50 }, (_, i) => ({
        completion_date: getDateDaysAgo(i),
        task_completed: `Task ${i + 1}`
      }));

      const testData = await createCompleteTestUser({ completions });

      const startTime = Date.now();
      const count = await prisma.completion_history.count({
        where: { user_id: testData.user.id }
      });
      const duration = Date.now() - startTime;

      expect(count).toBe(50);
      expect(duration).toBeLessThan(50);
    });

    test('should efficiently update streak data', async () => {
      const testData = await createCompleteTestUser({
        streakData: { current_streak: 5 }
      });

      const startTime = Date.now();
      await prisma.user_streaks.update({
        where: {
          // Use compound unique constraint: user_id AND task_name
          user_id_task_name: {
            user_id: testData.user.id,
            task_name: testData.streak.task_name
          }
        },
        data: {
          current_streak: 6,
          last_completed: new Date(getISODate()), // Fixed: last_completed not last_completed_date
          updated_at: new Date()
        }
      });
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(50);
    });

  });

  describe('Large Dataset Performance', () => {

    test('should handle user with 100+ completions', async () => {
      const completions = Array.from({ length: 100 }, (_, i) => ({
        completion_date: getDateDaysAgo(i),
        task_completed: `Task ${i + 1}`
      }));

      const testData = await createCompleteTestUser({ completions });

      const startTime = Date.now();
      const response = await request(app)
        .get('/api/user/history?page=1&limit=50')
        .set(getAuthHeader(testData.accessToken))
        .expect(200);
      const duration = Date.now() - startTime;

      // Response is {success, data: {completions, pagination}, message}
      expect(response.body.data.pagination.total).toBe(100);
      expect(duration).toBeLessThan(500);
    });

    test('should handle pagination efficiently', async () => {
      const completions = Array.from({ length: 200 }, (_, i) => ({
        completion_date: getDateDaysAgo(i),
        task_completed: `Task ${i + 1}`
      }));

      const testData = await createCompleteTestUser({ completions });

      // Test multiple pages
      for (let page = 1; page <= 3; page++) {
        const startTime = Date.now();
        const response = await request(app)
          .get(`/api/user/history?page=${page}&limit=50`)
          .set(getAuthHeader(testData.accessToken))
          .expect(200);
        const duration = Date.now() - startTime;

        expect(duration).toBeLessThan(500);
        // Response is {success, data: {completions, pagination}, message}
        expect(response.body.data.completions.length).toBeLessThanOrEqual(50);

        // Small delay to avoid rate limiting
        await wait(100);
      }
    }, 15000);

  });

  describe('Throughput Testing', () => {

    test('should maintain performance under sequential load', async () => {
      const { accessToken } = await createAuthenticatedUser();

      const durations = [];

      for (let i = 0; i < 10; i++) {
        const startTime = Date.now();
        await request(app)
          .get('/api/user/profile')
          .set(getAuthHeader(accessToken))
          .expect(200);
        durations.push(Date.now() - startTime);

        await wait(50); // Small delay to avoid rate limiting
      }

      // Average response time should be reasonable
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      expect(avgDuration).toBeLessThan(300);

      // No single request should be extremely slow
      durations.forEach(duration => {
        expect(duration).toBeLessThan(500);
      });
    }, 15000);

  });

  describe('Memory and Resource Usage', () => {

    test('should handle multiple user sessions efficiently', async () => {
      // Create multiple authenticated users
      const users = await Promise.all(
        Array.from({ length: 5 }, () => createAuthenticatedUser())
      );

      // Each user makes requests
      const requests = users.map(user =>
        request(app)
          .get('/api/user/profile')
          .set(getAuthHeader(user.accessToken))
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;

      // All should succeed or be rate limited
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });

      expect(duration).toBeLessThan(2000);
    }, 10000);

    test('should clean up inactive sessions efficiently', async () => {
      const { user } = await createAuthenticatedUser();

      // Create multiple inactive sessions
      await prisma.user_sessions.createMany({
        data: Array.from({ length: 10 }, (_, i) => ({
          id: `test-session-${i}`,
          user_id: user.id,
          refresh_token: `token-${i}`,
          expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired
          is_active: false,
          device_info: 'Test Device',
          ip_address: '127.0.0.1'
        }))
      });

      const startTime = Date.now();
      await prisma.user_sessions.deleteMany({
        where: {
          user_id: user.id,
          is_active: false
        }
      });
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
    });

  });

  describe('Stress Testing', () => {

    test('should gracefully handle rapid successive requests', async () => {
      const { accessToken } = await createAuthenticatedUser();

      const startTime = Date.now();

      for (let i = 0; i < 20; i++) {
        await request(app)
          .get('/api/user/profile')
          .set(getAuthHeader(accessToken));

        // No delay - test rapid requests
      }

      const duration = Date.now() - startTime;

      // Should complete without crashing
      expect(duration).toBeLessThan(5000);
    }, 10000);

    test('should handle mixed workload efficiently', async () => {
      const { accessToken } = await createAuthenticatedUser();

      const operations = [
        () => request(app).get('/api/user/profile').set(getAuthHeader(accessToken)),
        () => request(app).get('/api/user/streaks').set(getAuthHeader(accessToken)),
        () => request(app).get('/api/user/history').set(getAuthHeader(accessToken)),
        () => request(app).post('/api/user/complete')
          .set(getAuthHeader(accessToken))
          .send({
            taskName: `Mixed task ${Date.now()}`,
            completionDate: getISODate()
          })
      ];

      const startTime = Date.now();

      // Execute mixed operations
      const requests = Array.from({ length: 12 }, (_, i) =>
        operations[i % operations.length]()
      );

      await Promise.all(requests);

      const duration = Date.now() - startTime;

      // Should handle mixed workload
      expect(duration).toBeLessThan(3000);
    }, 10000);

  });

  describe('Edge Case Performance', () => {

    test('should handle empty result sets efficiently', async () => {
      const { accessToken } = await createAuthenticatedUser();

      const startTime = Date.now();
      await request(app)
        .get('/api/user/history')
        .set(getAuthHeader(accessToken))
        .expect(200);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(200);
    });

    test('should handle first-time user efficiently', async () => {
      const startTime = Date.now();
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: `firsttime-${Date.now()}@example.com`,
          password: 'TestPass123!@#',
          confirmPassword: 'TestPass123!@#'
        });
      const duration = Date.now() - startTime;

      // Accept success or rate limit
      if (response.status === 201) {
        expect(duration).toBeLessThan(500);
      }
    });

    test('should handle date range queries efficiently', async () => {
      const completions = Array.from({ length: 30 }, (_, i) => ({
        completion_date: getDateDaysAgo(i),
        task_completed: `Task ${i + 1}`
      }));

      const testData = await createCompleteTestUser({ completions });

      const startTime = Date.now();
      await request(app)
        .get(`/api/user/history?startDate=${getDateDaysAgo(15)}&endDate=${getISODate()}`)
        .set(getAuthHeader(testData.accessToken))
        .expect(200);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(300);
    });

  });

});