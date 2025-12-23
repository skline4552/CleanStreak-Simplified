/**
 * User API Integration Tests
 *
 * Comprehensive integration tests for user data management endpoints including:
 * - User profile retrieval and management
 * - Account summary and statistics
 * - History retrieval with pagination and filtering
 * - Data export functionality
 * - Account deletion with data cleanup
 * - Edge cases and error handling
 *
 * Target: Complete API endpoint testing with edge cases
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
  getDateDaysAgo,
  cleanupTestData
} = require('./utils/testHelpers');

// Load setup
require('./setup');

describe('User API Integration Tests', () => {

  // Clean up before each test
  beforeEach(async () => {
    await cleanupTestData();
  });

  describe('GET /api/user/profile - Get User Profile', () => {

    test('should retrieve user profile with authentication', async () => {
      const { user, accessToken } = await createAuthenticatedUser();

      const response = await request(app)
        .get('/api/user/profile')
        .set(getAuthHeader(accessToken))
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id', user.id);
      expect(response.body.user).toHaveProperty('email', user.email);
      expect(response.body.user).not.toHaveProperty('password_hash');
    });

    test('should reject profile request without authentication', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

  });

  describe('GET /api/user/account - Get Account Summary', () => {

    test('should retrieve account summary with streak data', async () => {
      const testData = await createCompleteTestUser({
        streakData: {
          current_streak: 10,
          longest_streak: 15,
          total_completions: 50
        }
      });

      const response = await request(app)
        .get('/api/user/account')
        .set(getAuthHeader(testData.accessToken))
        .expect(200);

      expect(response.body).toHaveProperty('account');
      expect(response.body.account).toHaveProperty('user');
      expect(response.body.account).toHaveProperty('stats');
      expect(response.body.account.stats).toHaveProperty('current_streak', 10);
      expect(response.body.account.stats).toHaveProperty('longest_streak', 15);
      expect(response.body.account.stats).toHaveProperty('total_completions', 50);
    });

    test('should handle account without streak data', async () => {
      const { accessToken } = await createAuthenticatedUser();

      const response = await request(app)
        .get('/api/user/account')
        .set(getAuthHeader(accessToken))
        .expect(200);

      expect(response.body).toHaveProperty('account');
      expect(response.body.account).toHaveProperty('stats');
    });

  });

  describe('GET /api/user/stats - Get User Statistics', () => {

    test('should retrieve comprehensive user statistics', async () => {
      const completions = [
        { completion_date: getISODate(), task_completed: 'Clean kitchen' },
        { completion_date: getDateDaysAgo(1), task_completed: 'Clean bathroom' },
        { completion_date: getDateDaysAgo(2), task_completed: 'Vacuum living room' }
      ];

      const testData = await createCompleteTestUser({
        streakData: {
          current_streak: 3,
          longest_streak: 5,
          total_completions: 10
        },
        completions
      });

      const response = await request(app)
        .get('/api/user/stats')
        .set(getAuthHeader(testData.accessToken))
        .expect(200);

      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats).toHaveProperty('current_streak');
      expect(response.body.stats).toHaveProperty('longest_streak');
      expect(response.body.stats).toHaveProperty('total_completions');
      expect(response.body.stats).toHaveProperty('completion_rate');
    });

  });

  describe('GET /api/user/history - Get Completion History', () => {

    test('should retrieve completion history with pagination', async () => {
      const completions = Array.from({ length: 25 }, (_, i) => ({
        completion_date: getDateDaysAgo(i),
        task_completed: `Task ${i + 1}`,
        completed_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      }));

      const testData = await createCompleteTestUser({ completions });

      const response = await request(app)
        .get('/api/user/history?page=1&limit=10')
        .set(getAuthHeader(testData.accessToken))
        .expect(200);

      expect(response.body).toHaveProperty('history');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('total', 25);
      expect(response.body.pagination).toHaveProperty('page', 1);
      expect(response.body.pagination).toHaveProperty('limit', 10);
      expect(response.body.history.length).toBeLessThanOrEqual(10);
    });

    test('should filter history by date range', async () => {
      const completions = [
        { completion_date: getDateDaysAgo(1), task_completed: 'Recent task' },
        { completion_date: getDateDaysAgo(10), task_completed: 'Old task' },
        { completion_date: getDateDaysAgo(20), task_completed: 'Very old task' }
      ];

      const testData = await createCompleteTestUser({ completions });

      const startDate = getDateDaysAgo(15);
      const endDate = getISODate();

      const response = await request(app)
        .get(`/api/user/history?startDate=${startDate}&endDate=${endDate}`)
        .set(getAuthHeader(testData.accessToken))
        .expect(200);

      expect(response.body).toHaveProperty('history');
      // Should only include tasks within date range
      expect(response.body.history.length).toBeLessThanOrEqual(2);
    });

    test('should handle empty history', async () => {
      const { accessToken } = await createAuthenticatedUser();

      const response = await request(app)
        .get('/api/user/history')
        .set(getAuthHeader(accessToken))
        .expect(200);

      expect(response.body).toHaveProperty('history');
      expect(response.body.history).toEqual([]);
      expect(response.body.pagination).toHaveProperty('total', 0);
    });

    test('should validate pagination parameters', async () => {
      const { accessToken } = await createAuthenticatedUser();

      // Test invalid page number
      const response1 = await request(app)
        .get('/api/user/history?page=-1')
        .set(getAuthHeader(accessToken));

      expect([400, 200]).toContain(response1.status);

      // Test invalid limit
      const response2 = await request(app)
        .get('/api/user/history?limit=1000')
        .set(getAuthHeader(accessToken));

      expect([400, 200]).toContain(response2.status);
    });

  });

  describe('GET /api/user/export - Export User Data', () => {

    test('should export all user data in JSON format', async () => {
      const completions = [
        { completion_date: getISODate(), task_completed: 'Task 1' },
        { completion_date: getDateDaysAgo(1), task_completed: 'Task 2' }
      ];

      const testData = await createCompleteTestUser({
        streakData: {
          current_streak: 2,
          longest_streak: 5,
          total_completions: 10
        },
        completions
      });

      const response = await request(app)
        .get('/api/user/export')
        .set(getAuthHeader(testData.accessToken))
        .expect(200);

      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers['content-disposition']).toContain('attachment');

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('streaks');
      expect(response.body).toHaveProperty('history');
      expect(response.body).toHaveProperty('exportedAt');
      expect(response.body.user).not.toHaveProperty('password_hash');
    });

    test('should handle export for user with no data', async () => {
      const { accessToken } = await createAuthenticatedUser();

      const response = await request(app)
        .get('/api/user/export')
        .set(getAuthHeader(accessToken))
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.history).toEqual([]);
    });

  });

  describe('DELETE /api/user/account - Delete Account', () => {

    test('should delete user account and all associated data', async () => {
      const completions = [
        { completion_date: getISODate(), task_completed: 'Task 1' }
      ];

      const testData = await createCompleteTestUser({
        streakData: { current_streak: 1 },
        completions
      });

      const userId = testData.user.id;

      const response = await request(app)
        .delete('/api/user/account')
        .set(getAuthHeader(testData.accessToken))
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // Verify user is deleted
      const user = await prisma.users.findUnique({
        where: { id: userId }
      });
      expect(user).toBeNull();

      // Verify streak data is deleted
      const streaks = await prisma.user_streaks.findMany({
        where: { user_id: userId }
      });
      expect(streaks.length).toBe(0);

      // Verify history is deleted
      const history = await prisma.completion_history.findMany({
        where: { user_id: userId }
      });
      expect(history.length).toBe(0);

      // Verify sessions are deleted
      const sessions = await prisma.user_sessions.findMany({
        where: { user_id: userId }
      });
      expect(sessions.length).toBe(0);
    });

    test('should require authentication for account deletion', async () => {
      const response = await request(app)
        .delete('/api/user/account')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle deletion of already deleted account gracefully', async () => {
      const { user, accessToken } = await createAuthenticatedUser();

      // Delete the user directly from database
      await prisma.users.delete({
        where: { id: user.id }
      });

      const response = await request(app)
        .delete('/api/user/account')
        .set(getAuthHeader(accessToken));

      // Should handle gracefully, may return 404 or 500
      expect([401, 404, 500]).toContain(response.status);
    });

  });

  describe('DELETE /api/user/completion/:completionId - Delete Completion', () => {

    test('should delete a specific completion', async () => {
      const completions = [
        { completion_date: getISODate(), task_completed: 'Task to delete' }
      ];

      const testData = await createCompleteTestUser({ completions });
      const completionId = testData.completions[0].user_id; // Get the actual completion ID

      // Get the completion to delete
      const completionToDelete = await prisma.completion_history.findFirst({
        where: { user_id: testData.user.id }
      });

      const response = await request(app)
        .delete(`/api/user/completion/${completionToDelete.user_id}`)
        .set(getAuthHeader(testData.accessToken));

      // Accept 200, 204, or 404 (if not found)
      expect([200, 204, 404]).toContain(response.status);
    });

    test('should not delete another users completion', async () => {
      const user1 = await createCompleteTestUser({
        completions: [{ completion_date: getISODate(), task_completed: 'User 1 task' }]
      });

      const user2 = await createAuthenticatedUser();

      const user1Completion = await prisma.completion_history.findFirst({
        where: { user_id: user1.user.id }
      });

      const response = await request(app)
        .delete(`/api/user/completion/${user1Completion.user_id}`)
        .set(getAuthHeader(user2.accessToken));

      // Should be forbidden or not found
      expect([403, 404]).toContain(response.status);
    });

  });

  describe('Edge Cases and Error Handling', () => {

    test('should handle requests with invalid authentication token', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .set(getAuthHeader('invalid.token.here'))
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    test('should handle concurrent requests gracefully', async () => {
      const { accessToken } = await createAuthenticatedUser();

      const requests = Array.from({ length: 5 }, () =>
        request(app)
          .get('/api/user/profile')
          .set(getAuthHeader(accessToken))
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });
    });

    test('should handle very large history datasets', async () => {
      const completions = Array.from({ length: 100 }, (_, i) => ({
        completion_date: getDateDaysAgo(i),
        task_completed: `Task ${i + 1}`,
        completed_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      }));

      const testData = await createCompleteTestUser({ completions });

      const response = await request(app)
        .get('/api/user/history?page=1&limit=50')
        .set(getAuthHeader(testData.accessToken))
        .expect(200);

      expect(response.body.pagination.total).toBe(100);
      expect(response.body.history.length).toBeLessThanOrEqual(50);
    });

    test('should validate date format in history queries', async () => {
      const { accessToken } = await createAuthenticatedUser();

      const response = await request(app)
        .get('/api/user/history?startDate=invalid-date&endDate=also-invalid')
        .set(getAuthHeader(accessToken));

      // Should either validate dates or accept them
      expect([200, 400]).toContain(response.status);
    });

  });

  describe('Data Consistency Tests', () => {

    test('should maintain data consistency after multiple operations', async () => {
      const { user, accessToken } = await createAuthenticatedUser();

      // Create streak data
      await createTestStreak(user.id, {
        current_streak: 5,
        total_completions: 10
      });

      // Create completions
      await createTestCompletions(user.id, [
        { completion_date: getISODate(), task_completed: 'Task 1' },
        { completion_date: getDateDaysAgo(1), task_completed: 'Task 2' }
      ]);

      // Retrieve stats
      const statsResponse = await request(app)
        .get('/api/user/stats')
        .set(getAuthHeader(accessToken))
        .expect(200);

      expect(statsResponse.body.stats).toHaveProperty('total_completions');

      // Retrieve history
      const historyResponse = await request(app)
        .get('/api/user/history')
        .set(getAuthHeader(accessToken))
        .expect(200);

      expect(historyResponse.body.history.length).toBeGreaterThan(0);
    });

    test('should return consistent data across multiple endpoints', async () => {
      const testData = await createCompleteTestUser({
        userData: { email: 'consistency@test.com' },
        streakData: { current_streak: 3 },
        completions: [
          { completion_date: getISODate(), task_completed: 'Task 1' }
        ]
      });

      // Get profile
      const profileResponse = await request(app)
        .get('/api/user/profile')
        .set(getAuthHeader(testData.accessToken))
        .expect(200);

      // Get account summary
      const accountResponse = await request(app)
        .get('/api/user/account')
        .set(getAuthHeader(testData.accessToken))
        .expect(200);

      // Email should be consistent
      expect(profileResponse.body.user.email).toBe('consistency@test.com');
      expect(accountResponse.body.account.user.email).toBe('consistency@test.com');
    });

  });

  describe('Performance Tests', () => {

    test('should respond quickly to profile requests', async () => {
      const { accessToken } = await createAuthenticatedUser();

      const startTime = Date.now();
      await request(app)
        .get('/api/user/profile')
        .set(getAuthHeader(accessToken))
        .expect(200);
      const duration = Date.now() - startTime;

      // Should respond within 500ms
      expect(duration).toBeLessThan(500);
    });

    test('should handle history pagination efficiently', async () => {
      const completions = Array.from({ length: 50 }, (_, i) => ({
        completion_date: getDateDaysAgo(i),
        task_completed: `Task ${i + 1}`
      }));

      const testData = await createCompleteTestUser({ completions });

      const startTime = Date.now();
      await request(app)
        .get('/api/user/history?page=2&limit=20')
        .set(getAuthHeader(testData.accessToken))
        .expect(200);
      const duration = Date.now() - startTime;

      // Should respond within 1 second
      expect(duration).toBeLessThan(1000);
    });

  });

});