/**
 * Health Check and Utility Endpoints
 *
 * Provides comprehensive service health monitoring including:
 * - Database connectivity checks
 * - System metrics (memory, uptime)
 * - Service status indicators
 * - Environment information
 */

const express = require('express');
const router = express.Router();
const { databaseManager } = require('../config/database');
const { logger } = require('../utils/logger');
const config = require('../config/environment');

/**
 * Get memory usage metrics
 */
const getMemoryMetrics = () => {
  const memUsage = process.memoryUsage();

  return {
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
    rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
    external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
    heapUsedPercentage: `${Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)}%`
  };
};

/**
 * Get system uptime
 */
const getUptime = () => {
  const uptimeSeconds = process.uptime();
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);

  return {
    raw: uptimeSeconds,
    formatted: `${hours}h ${minutes}m ${seconds}s`
  };
};

/**
 * Check database health with timeout protection
 */
const checkDatabaseHealth = async () => {
  const startTime = Date.now();

  try {
    // Set a timeout for database health check (5 seconds)
    const healthCheckPromise = databaseManager.checkHealth();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database health check timeout')), 5000);
    });

    const health = await Promise.race([healthCheckPromise, timeoutPromise]);
    const responseTime = Date.now() - startTime;

    return {
      status: health.status || 'unknown',
      connected: health.status === 'healthy',
      responseTime: `${responseTime}ms`,
      lastChecked: health.timestamp || new Date().toISOString(),
      details: health.database || {}
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error('Database health check failed', {
      error: error.message,
      responseTime: `${responseTime}ms`
    });

    return {
      status: 'unhealthy',
      connected: false,
      error: error.message,
      responseTime: `${responseTime}ms`,
      lastChecked: new Date().toISOString()
    };
  }
};

/**
 * Get service dependencies status
 */
const getServicesStatus = (dbHealth) => {
  return {
    database: {
      status: dbHealth.connected ? 'operational' : 'degraded',
      responseTime: dbHealth.responseTime
    },
    authentication: {
      status: 'operational',
      jwtConfigured: !!config.JWT_SECRET
    },
    logging: {
      status: 'operational',
      level: config.LOG_LEVEL
    },
    security: {
      status: 'operational',
      environment: config.NODE_ENV
    }
  };
};

/**
 * GET /api/health
 * Comprehensive health check endpoint
 * Returns 200 if all services healthy, 503 if any service is degraded
 */
router.get('/', async (req, res) => {
  const startTime = Date.now();

  try {
    logger.debug('Health check requested', {
      requestId: req.requestId,
      ip: req.ip
    });

    // Perform health checks
    const dbHealth = await checkDatabaseHealth();
    const memory = getMemoryMetrics();
    const uptime = getUptime();
    const services = getServicesStatus(dbHealth);

    // Determine overall health status
    const isHealthy = dbHealth.connected;
    const overallStatus = isHealthy ? 'healthy' : 'degraded';
    const statusCode = isHealthy ? 200 : 503;

    const responseTime = Date.now() - startTime;

    const healthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      environment: config.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      uptime: uptime,
      memory: memory,
      database: dbHealth,
      services: services,
      responseTime: `${responseTime}ms`,
      requestId: req.requestId
    };

    // Log health check with appropriate level
    if (!isHealthy) {
      logger.warn('Health check returned degraded status', {
        requestId: req.requestId,
        responseTime: `${responseTime}ms`,
        databaseStatus: dbHealth.status
      });
    } else {
      logger.debug('Health check completed successfully', {
        requestId: req.requestId,
        responseTime: `${responseTime}ms`
      });
    }

    res.status(statusCode).json(healthResponse);

  } catch (error) {
    const responseTime = Date.now() - startTime;

    logger.error('Health check endpoint error', {
      error: error.message,
      stack: error.stack,
      requestId: req.requestId,
      responseTime: `${responseTime}ms`
    });

    // Return degraded status even if health check itself fails
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      message: error.message,
      responseTime: `${responseTime}ms`,
      requestId: req.requestId
    });
  }
});

/**
 * GET /api/health/readiness
 * Readiness probe - checks if service is ready to accept traffic
 * Used by container orchestration systems (Kubernetes, etc.)
 */
router.get('/readiness', async (req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth();

    if (dbHealth.connected) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        reason: 'Database not connected',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Readiness check failed', { error: error.message });

    res.status(503).json({
      status: 'not ready',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/health/liveness
 * Liveness probe - checks if service is alive
 * Used by container orchestration systems to determine if container should be restarted
 */
router.get('/liveness', (req, res) => {
  // Simple liveness check - if we can respond, we're alive
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: getUptime().formatted
  });
});

/**
 * GET /api/health/metrics
 * Detailed metrics endpoint (may be used for monitoring systems)
 */
router.get('/metrics', async (req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    const memory = getMemoryMetrics();
    const uptime = getUptime();

    res.status(200).json({
      timestamp: new Date().toISOString(),
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        uptime: uptime
      },
      memory: memory,
      database: dbHealth,
      environment: {
        nodeEnv: config.NODE_ENV,
        port: config.PORT,
        host: config.HOST
      }
    });
  } catch (error) {
    logger.error('Metrics endpoint error', { error: error.message });

    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;