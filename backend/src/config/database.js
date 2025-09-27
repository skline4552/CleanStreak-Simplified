const { prisma, prismaWrapper, testConnection, getConnectionHealth } = require('./prisma');
const config = require('./environment');

/**
 * Enhanced Database Configuration
 * Integrates with dedicated Prisma client for optimized database operations
 */

/**
 * Database connection utilities that leverage the new Prisma client wrapper
 */
class DatabaseManager {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Initialize database connection
   */
  async initialize() {
    if (this.isInitialized) {
      return true;
    }

    try {
      const healthCheck = await testConnection();
      if (healthCheck.success) {
        this.isInitialized = true;
        console.log(`Database initialized successfully for ${config.NODE_ENV} environment`);
        return true;
      } else {
        throw new Error(healthCheck.error);
      }
    } catch (error) {
      console.error('Database initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Get Prisma client instance
   */
  getClient() {
    return prisma;
  }

  /**
   * Enhanced database health check with detailed metrics
   */
  async checkHealth() {
    try {
      const health = await getConnectionHealth();

      return {
        ...health,
        database: {
          provider: this.getDatabaseProvider(),
          connectionPool: this.getConnectionPoolInfo(),
          version: await this.getDatabaseVersion(),
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get database provider information
   */
  getDatabaseProvider() {
    if (config.DATABASE_URL.startsWith('postgresql://') || config.DATABASE_URL.startsWith('postgres://')) {
      return 'postgresql';
    } else if (config.DATABASE_URL.startsWith('file:')) {
      return 'sqlite';
    } else {
      return 'unknown';
    }
  }

  /**
   * Get connection pool information for PostgreSQL
   */
  getConnectionPoolInfo() {
    const provider = this.getDatabaseProvider();

    if (provider === 'postgresql' && config.NODE_ENV === 'production') {
      return {
        min: config.DB_POOL_MIN,
        max: config.DB_POOL_MAX,
        acquireTimeout: config.DB_POOL_ACQUIRE_TIMEOUT,
        idleTimeout: config.DB_POOL_IDLE_TIMEOUT,
      };
    }

    return null;
  }

  /**
   * Get database version
   */
  async getDatabaseVersion() {
    try {
      const provider = this.getDatabaseProvider();

      if (provider === 'postgresql') {
        const result = await prisma.$queryRaw`SELECT version()`;
        return result[0]?.version || 'unknown';
      } else if (provider === 'sqlite') {
        const result = await prisma.$queryRaw`SELECT sqlite_version() as version`;
        return `SQLite ${result[0]?.version || 'unknown'}`;
      }

      return 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Test database performance
   */
  async testPerformance() {
    const tests = [];

    try {
      // Simple query performance test
      const start1 = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const simple = Date.now() - start1;
      tests.push({ test: 'simple_query', duration: `${simple}ms` });

      // User table query performance test (if tables exist)
      try {
        const start2 = Date.now();
        await prisma.user.findFirst();
        const userQuery = Date.now() - start2;
        tests.push({ test: 'user_table_query', duration: `${userQuery}ms` });
      } catch (tableError) {
        tests.push({ test: 'user_table_query', error: 'Table not found or not migrated' });
      }

      return {
        status: 'completed',
        tests,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'failed',
        error: error.message,
        tests,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Execute database migrations
   */
  async runMigrations() {
    try {
      // Note: In a production environment, migrations should be run via Prisma CLI
      // This method is primarily for development and testing
      console.log('Migrations should be run via Prisma CLI: npx prisma migrate deploy');

      return {
        status: 'info',
        message: 'Use "npx prisma migrate deploy" for production migrations',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get database statistics
   */
  async getStatistics() {
    try {
      const stats = {};

      // Get table counts if tables exist
      try {
        stats.users = await prisma.user.count();
        stats.userStreaks = await prisma.userStreak.count();
        stats.completionHistory = await prisma.completionHistory.count();
        stats.userSessions = await prisma.userSession.count();
        stats.analytics = await prisma.analytics.count();
      } catch (tableError) {
        stats.note = 'Database tables not found or not migrated';
      }

      return {
        status: 'success',
        statistics: stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Gracefully close database connections
   */
  async close() {
    try {
      await prismaWrapper.disconnect();
      this.isInitialized = false;
      console.log('Database connections closed successfully');
    } catch (error) {
      console.error('Error closing database connections:', error.message);
      throw error;
    }
  }
}

// Create singleton instance
const databaseManager = new DatabaseManager();

// Legacy compatibility functions (maintain backward compatibility)
const initializePrisma = () => {
  console.warn('initializePrisma is deprecated. Use databaseManager.initialize() instead.');
  return prisma;
};

const checkDatabaseConnection = async () => {
  console.warn('checkDatabaseConnection is deprecated. Use databaseManager.checkHealth() instead.');
  const health = await databaseManager.checkHealth();
  return {
    status: health.status === 'healthy' ? 'connected' : 'disconnected',
    timestamp: health.timestamp,
    error: health.error,
  };
};

const closeDatabaseConnection = async () => {
  console.warn('closeDatabaseConnection is deprecated. Use databaseManager.close() instead.');
  await databaseManager.close();
};

// Export enhanced database manager and legacy compatibility
module.exports = {
  // Enhanced database manager (recommended)
  databaseManager,

  // Direct Prisma client access
  prisma,

  // Legacy compatibility (deprecated but maintained)
  initializePrisma,
  checkDatabaseConnection,
  closeDatabaseConnection,

  // New enhanced methods
  testConnection,
  getConnectionHealth,
};