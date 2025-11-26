/**
 * Test Helper Functions
 *
 * Provides utility functions for creating test data, making authenticated requests,
 * and common test assertions.
 */

const { createId } = require('@paralleldrive/cuid2');
const { prisma } = require('../../src/config/prisma');
const { hashPassword } = require('../../src/utils/password');
const { generateTokenPair, generateAccessToken, generateRefreshToken } = require('../../src/utils/jwt');

/**
 * Create a test user in the database
 * @param {Object} userData - Optional user data overrides
 * @returns {Promise<Object>} Created user object (without password hash)
 */
async function createTestUser(userData = {}) {
  const defaultData = {
    email: `test-${createId()}@example.com`,
    password: 'Test123!@#',
    created_at: new Date(),
    updated_at: new Date(),
    last_login: new Date()
  };

  const data = { ...defaultData, ...userData };
  const hashedPassword = await hashPassword(data.password);

  const user = await prisma.users.create({
    data: {
      id: createId(),
      email: data.email,
      password_hash: hashedPassword,
      created_at: data.created_at,
      updated_at: data.updated_at,
      last_login: data.last_login
    }
  });

  // Return user without password hash but include plain password for testing
  const { password_hash, ...userWithoutPassword } = user;
  return {
    ...userWithoutPassword,
    password: data.password // Include plain password for test authentication
  };
}

/**
 * Create multiple test users
 * @param {number} count - Number of users to create
 * @returns {Promise<Array>} Array of created user objects
 */
async function createTestUsers(count = 3) {
  const users = [];
  for (let i = 0; i < count; i++) {
    const user = await createTestUser({
      email: `test-user-${i}-${createId()}@example.com`
    });
    users.push(user);
  }
  return users;
}

/**
 * Create a test user session
 * @param {string} userId - User ID
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object>} Created session object
 */
async function createTestSession(userId, refreshToken = null) {
  if (!refreshToken) {
    const token = generateRefreshToken({ userId, email: 'test@example.com' });
    refreshToken = token.token;
  }

  const session = await prisma.user_sessions.create({
    data: {
      id: createId(),
      user_id: userId,
      refresh_token: refreshToken,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      is_active: true,
      device_info: 'Test Device',
      ip_address: '127.0.0.1'
    }
  });

  return session;
}

/**
 * Create a test user with authentication tokens
 * @param {Object} userData - Optional user data overrides
 * @returns {Promise<Object>} User object with tokens
 */
async function createAuthenticatedUser(userData = {}) {
  const user = await createTestUser(userData);

  const tokens = generateTokenPair({
    userId: user.id,
    email: user.email
  });

  // Create session in database
  await createTestSession(user.id, tokens.refreshToken.token);

  return {
    user,
    tokens,
    accessToken: tokens.accessToken.token,
    refreshToken: tokens.refreshToken.token
  };
}

/**
 * Create test streak data for a user
 * @param {string} userId - User ID
 * @param {Object} streakData - Optional streak data overrides
 * @returns {Promise<Object>} Created streak object
 */
async function createTestStreak(userId, streakData = {}) {
  const defaultData = {
    task_name: 'default-task',
    current_streak: 5,
    best_streak: 10,
    last_completed: new Date()
  };

  const data = { ...defaultData, ...streakData };

  // Map longest_streak to best_streak for test compatibility
  if (data.longest_streak !== undefined) {
    data.best_streak = data.longest_streak;
  }

  // Map last_completed_date to last_completed for test compatibility
  if (data.last_completed_date !== undefined) {
    data.last_completed = new Date(data.last_completed_date);
  }

  const streak = await prisma.user_streaks.create({
    data: {
      id: createId(),
      user_id: userId,
      task_name: data.task_name,
      current_streak: data.current_streak,
      best_streak: data.best_streak,
      last_completed: data.last_completed,
      created_at: new Date(),
      updated_at: new Date()
    }
  });

  return streak;
}

/**
 * Create test completion history entries
 * @param {string} userId - User ID
 * @param {Array<Object>} completions - Array of completion data
 * @returns {Promise<Array>} Array of created completion objects
 */
async function createTestCompletions(userId, completions = []) {
  const defaultCompletion = {
    task_name: 'Test cleaning task',
    completed_date: new Date(),
    streak_day: 1,
    completion_time: null,
    notes: null
  };

  const createdCompletions = [];

  for (const completion of completions) {
    const data = { ...defaultCompletion, ...completion };

    // Map task_completed to task_name for backward compatibility
    if (data.task_completed !== undefined && data.task_name === defaultCompletion.task_name) {
      data.task_name = data.task_completed;
    }

    // Map completion_date to completed_date for backward compatibility
    if (data.completion_date !== undefined && !data.completed_date) {
      data.completed_date = data.completion_date;
    }

    // Ensure completed_date is always set
    if (!data.completed_date) {
      data.completed_date = new Date();
    }

    const created = await prisma.completion_history.create({
      data: {
        id: createId(),
        user_id: userId,
        task_name: data.task_name,
        completed_date: data.completed_date,
        streak_day: data.streak_day,
        created_at: new Date(),
        completion_time: data.completion_time,
        notes: data.notes
      }
    });
    createdCompletions.push(created);
  }

  return createdCompletions;
}

/**
 * Create a complete test user with streak and completion history
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Complete test user data
 */
async function createCompleteTestUser(options = {}) {
  const {
    userData = {},
    streakData = {},
    completions = []
  } = options;

  const authUser = await createAuthenticatedUser(userData);
  const streak = await createTestStreak(authUser.user.id, streakData);

  // Create completion history records
  let completionHistory = [];
  if (completions.length > 0) {
    completionHistory = await createTestCompletions(authUser.user.id, completions);
  } else if (streakData.total_completions > 0) {
    // Auto-generate completion history to match total_completions
    const taskName = streakData.task_name || 'default-task';

    // Use last_completed_date if provided, otherwise default to yesterday
    // to avoid conflicts with tests that want to complete tasks today
    const lastDate = streakData.last_completed_date
      ? new Date(streakData.last_completed_date)
      : new Date(new Date().setDate(new Date().getDate() - 1));

    const generatedCompletions = [];
    for (let i = 0; i < streakData.total_completions; i++) {
      const daysBeforeLastDate = streakData.total_completions - i - 1;
      const date = new Date(lastDate);
      date.setDate(date.getDate() - daysBeforeLastDate);
      generatedCompletions.push({
        task_name: taskName,
        completed_date: date,
        streak_day: i + 1
      });
    }
    completionHistory = await createTestCompletions(authUser.user.id, generatedCompletions);
  }

  return {
    ...authUser,
    streak,
    completions: completionHistory
  };
}

/**
 * Get authorization header with Bearer token
 * @param {string} token - Access token
 * @returns {Object} Header object
 */
function getAuthHeader(token) {
  return {
    Authorization: `Bearer ${token}`
  };
}

/**
 * Get cookie header with authentication cookies
 * @param {string} accessToken - Access token
 * @param {string} refreshToken - Refresh token
 * @returns {Object} Header object
 */
function getCookieHeader(accessToken, refreshToken) {
  const cookies = [];
  if (accessToken) cookies.push(`accessToken=${accessToken}`);
  if (refreshToken) cookies.push(`refreshToken=${refreshToken}`);
  return {
    Cookie: cookies.join('; ')
  };
}

/**
 * Extract cookies from response headers
 * @param {Object} response - Supertest response object
 * @returns {Object} Object with extracted tokens
 */
function extractCookies(response) {
  const setCookieHeader = response.headers['set-cookie'];
  if (!setCookieHeader) return {};

  const cookies = {};

  setCookieHeader.forEach(cookie => {
    if (cookie.includes('accessToken=')) {
      const match = cookie.match(/accessToken=([^;]+)/);
      if (match) cookies.accessToken = match[1];
    }
    if (cookie.includes('refreshToken=')) {
      const match = cookie.match(/refreshToken=([^;]+)/);
      if (match) cookies.refreshToken = match[1];
    }
  });

  return cookies;
}

/**
 * Generate an expired access token for testing
 * @param {Object} payload - Token payload
 * @returns {string} Expired token
 */
function generateExpiredToken(payload = {}) {
  const jwt = require('jsonwebtoken');
  const jwtSecret = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only';

  return jwt.sign(
    {
      userId: payload.userId || 'test-user-id',
      email: payload.email || 'test@example.com',
      jti: createId(),
      iat: Math.floor(Date.now() / 1000) - 3600, // Issued 1 hour ago
      exp: Math.floor(Date.now() / 1000) - 1800  // Expired 30 minutes ago
    },
    jwtSecret
  );
}

/**
 * Generate an invalid token for testing
 * @returns {string} Invalid token
 */
function generateInvalidToken() {
  return 'invalid.jwt.token.for.testing';
}

/**
 * Wait for a specified duration (for async testing)
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get date string in ISO format (YYYY-MM-DD)
 * @param {Date} date - Date object (defaults to today)
 * @returns {string} ISO date string
 */
function getISODate(date = new Date()) {
  return date.toISOString().split('T')[0];
}

/**
 * Get yesterday's date in ISO format
 * @returns {string} ISO date string
 */
function getYesterdayDate() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getISODate(yesterday);
}

/**
 * Get date N days ago in ISO format
 * @param {number} daysAgo - Number of days ago
 * @returns {string} ISO date string
 */
function getDateDaysAgo(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return getISODate(date);
}

/**
 * Validate JWT token structure (basic validation)
 * @param {string} token - Token to validate
 * @returns {boolean} True if token structure is valid
 */
function isValidJWTStructure(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  return parts.length === 3;
}

/**
 * Clean up all test data from database
 * @returns {Promise<void>}
 */
async function cleanupTestData() {
  // Clean up room customization tables first (Phase 8)
  await prisma.task_rotation.deleteMany({});
  await prisma.user_task_progress.deleteMany({});
  await prisma.pending_room_configs.deleteMany({});
  await prisma.user_keystone_tasks.deleteMany({});
  await prisma.user_rooms.deleteMany({});

  // Clean up existing tables
  await prisma.completion_history.deleteMany({});
  await prisma.user_streaks.deleteMany({});
  await prisma.user_sessions.deleteMany({});
  await prisma.users.deleteMany({});
}

/**
 * Mock logger for testing
 */
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  auth: jest.fn(),
  security: jest.fn(),
  database: jest.fn(),
  child: jest.fn(() => mockLogger),
  setContext: jest.fn(),
  getContext: jest.fn(() => ({})),
  cleanupContexts: jest.fn()
};

module.exports = {
  // User creation helpers
  createTestUser,
  createTestUsers,
  createAuthenticatedUser,
  createCompleteTestUser,

  // Session and token helpers
  createTestSession,
  generateExpiredToken,
  generateInvalidToken,

  // Streak and completion helpers
  createTestStreak,
  createTestCompletions,

  // Request helpers
  getAuthHeader,
  getCookieHeader,
  extractCookies,

  // Date helpers
  getISODate,
  getYesterdayDate,
  getDateDaysAgo,

  // Validation helpers
  isValidJWTStructure,

  // Utility helpers
  wait,
  cleanupTestData,
  mockLogger
};