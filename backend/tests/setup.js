/**
 * Test Setup and Configuration
 *
 * Provides common test utilities, setup, and teardown functions for all test suites.
 * Configures the test environment, database handling, and test lifecycle management.
 */

const { prisma } = require('../src/config/prisma');

/**
 * Global test configuration
 */
global.testConfig = {
  // Test timeout (10 seconds)
  timeout: 10000,

  // Test database URL
  databaseUrl: process.env.DATABASE_URL || 'file:./test.db',

  // JWT test secrets
  jwtSecret: process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret-key-for-testing-only',

  // Test server configuration
  port: process.env.TEST_PORT || 3001,
  host: process.env.TEST_HOST || 'localhost'
};

/**
 * Setup function to run before all tests
 */
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';

  // Suppress console output during tests (optional)
  if (process.env.SUPPRESS_TEST_LOGS === 'true') {
    global.console = {
      ...console,
      log: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
  }

  // Initialize test database connection
  try {
    await prisma.$connect();
  } catch (error) {
    console.error('Failed to connect to test database:', error);
    throw error;
  }
});

/**
 * Cleanup function to run after all tests
 */
afterAll(async () => {
  // Close database connection
  try {
    await prisma.$disconnect();
  } catch (error) {
    console.error('Failed to disconnect from test database:', error);
  }

  // Give a little time for cleanup
  await new Promise(resolve => setTimeout(resolve, 500));
});

/**
 * Setup function to run before each test
 * Cleans up database tables to ensure test isolation
 */
beforeEach(async () => {
  // Clean up database tables in reverse dependency order
  try {
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
  } catch (error) {
    console.error('Failed to clean up test database:', error);
    // Continue with tests even if cleanup fails
  }
});

/**
 * Teardown function to run after each test
 */
afterEach(async () => {
  // Additional cleanup if needed
  jest.clearAllMocks();
});

module.exports = {
  testConfig: global.testConfig
};