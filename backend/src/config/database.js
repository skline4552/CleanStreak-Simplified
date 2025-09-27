const { PrismaClient } = require('@prisma/client');

// Database configuration based on environment
const getDatabaseConfig = () => {
  const env = process.env.NODE_ENV || 'development';

  const config = {
    development: {
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'file:./dev.db'
        }
      },
      log: ['query', 'info', 'warn', 'error']
    },
    production: {
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      },
      log: ['warn', 'error']
    },
    test: {
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL || 'file:./test.db'
        }
      },
      log: []
    }
  };

  return config[env] || config.development;
};

// Initialize Prisma client with environment-specific configuration
let prisma;

const initializePrisma = () => {
  if (!prisma) {
    const config = getDatabaseConfig();
    prisma = new PrismaClient(config);
  }
  return prisma;
};

// Database connection health check
const checkDatabaseConnection = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'connected', timestamp: new Date().toISOString() };
  } catch (error) {
    return {
      status: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

// Graceful shutdown
const closeDatabaseConnection = async () => {
  if (prisma) {
    await prisma.$disconnect();
    console.log('Database connection closed');
  }
};

// Handle process termination
process.on('beforeExit', closeDatabaseConnection);
process.on('SIGINT', closeDatabaseConnection);
process.on('SIGTERM', closeDatabaseConnection);

module.exports = {
  initializePrisma,
  checkDatabaseConnection,
  closeDatabaseConnection,
  getDatabaseConfig
};