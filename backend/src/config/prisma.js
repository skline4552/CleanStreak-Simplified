const { PrismaClient } = require('@prisma/client');
const config = require('./environment');

/**
 * Prisma Client Configuration
 * Environment-specific database client with connection pooling and optimizations
 */

class PrismaClientWrapper {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this._processListenersAdded = false;
  }

  /**
   * Initialize Prisma client with environment-specific configuration
   */
  initialize() {
    if (this.client) {
      return this.client;
    }

    const prismaConfig = this.getPrismaConfig();
    this.client = new PrismaClient(prismaConfig);

    // Set up event listeners for connection monitoring
    this.setupEventListeners();

    return this.client;
  }

  /**
   * Get environment-specific Prisma configuration
   */
  getPrismaConfig() {
    const baseConfig = {
      log: this.getLogConfig(),
      errorFormat: 'pretty',
    };

    // Environment-specific configurations
    if (config.NODE_ENV === 'production') {
      return {
        ...baseConfig,
        datasources: {
          db: {
            url: config.DATABASE_URL,
          },
        },
        // PostgreSQL connection pool configuration
        __internal: {
          engine: {
            pool: {
              min: config.DB_POOL_MIN,
              max: config.DB_POOL_MAX,
              acquireTimeoutMillis: config.DB_POOL_ACQUIRE_TIMEOUT,
              idleTimeoutMillis: config.DB_POOL_IDLE_TIMEOUT,
            },
          },
        },
      };
    } else if (config.NODE_ENV === 'test') {
      return {
        ...baseConfig,
        datasources: {
          db: {
            url: config.DATABASE_URL || 'file:./test.db',
          },
        },
        log: [], // Suppress logs during testing
      };
    } else {
      // Development configuration
      return {
        ...baseConfig,
        datasources: {
          db: {
            url: config.DATABASE_URL || 'file:./dev.db',
          },
        },
      };
    }
  }

  /**
   * Get logging configuration based on environment
   */
  getLogConfig() {
    switch (config.NODE_ENV) {
      case 'production':
        return ['error', 'warn'];
      case 'test':
        return [];
      case 'development':
      default:
        return ['query', 'info', 'warn', 'error'];
    }
  }

  /**
   * Setup event listeners for connection monitoring
   */
  setupEventListeners() {
    if (!this.client) return;

    // Query logging in development
    if (config.NODE_ENV === 'development') {
      this.client.$on('query', (e) => {
        if (e.duration > 100) {
          console.warn(`Slow query detected (${e.duration}ms):`, e.query);
        }
      });
    }

    // For Prisma 5.0+, we need to listen to process events directly
    // instead of using client.$on('beforeExit')
    const handleShutdown = async () => {
      console.log('Prisma client disconnecting...');
      this.isConnected = false;
      await this.disconnect();
    };

    // Add process event listeners if not already added
    if (!this._processListenersAdded) {
      process.on('SIGINT', handleShutdown);
      process.on('SIGTERM', handleShutdown);
      process.on('beforeExit', handleShutdown);
      this._processListenersAdded = true;
    }
  }

  /**
   * Test database connection
   */
  async testConnection() {
    try {
      if (!this.client) {
        this.initialize();
      }

      await this.client.$queryRaw`SELECT 1`;
      this.isConnected = true;

      return {
        success: true,
        status: 'connected',
        timestamp: new Date().toISOString(),
        environment: config.NODE_ENV,
      };
    } catch (error) {
      this.isConnected = false;

      return {
        success: false,
        status: 'disconnected',
        error: error.message,
        timestamp: new Date().toISOString(),
        environment: config.NODE_ENV,
      };
    }
  }

  /**
   * Get connection health information
   */
  async getConnectionHealth() {
    try {
      if (!this.client) {
        return { status: 'not_initialized' };
      }

      const startTime = Date.now();
      await this.client.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        responseTime: `${responseTime}ms`,
        isConnected: this.isConnected,
        environment: config.NODE_ENV,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        isConnected: false,
        environment: config.NODE_ENV,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Gracefully disconnect from database
   */
  async disconnect() {
    if (this.client) {
      await this.client.$disconnect();
      this.client = null;
      this.isConnected = false;
      console.log('Prisma client disconnected successfully');
    }
  }

  /**
   * Get the Prisma client instance
   */
  getClient() {
    if (!this.client) {
      this.initialize();
    }
    return this.client;
  }

  /**
   * Check if client is initialized and connected
   */
  isReady() {
    return this.client !== null && this.isConnected;
  }
}

// Create singleton instance
const prismaWrapper = new PrismaClientWrapper();

// Initialize on module load
const prisma = prismaWrapper.initialize();

// Export both the client and wrapper for different use cases
module.exports = {
  prisma,
  prismaWrapper,

  // Convenience methods
  testConnection: () => prismaWrapper.testConnection(),
  getConnectionHealth: () => prismaWrapper.getConnectionHealth(),
  disconnect: () => prismaWrapper.disconnect(),
  isReady: () => prismaWrapper.isReady(),
};