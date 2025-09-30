/**
 * Comprehensive Logging Utility
 *
 * Provides structured logging for the CleanStreak application
 * with environment-specific configurations and log management.
 */

const fs = require('fs');
const path = require('path');

/**
 * Log levels with priority ordering
 */
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

/**
 * ANSI color codes for console output
 */
const COLORS = {
  error: '\x1b[31m',   // Red
  warn: '\x1b[33m',    // Yellow
  info: '\x1b[36m',    // Cyan
  debug: '\x1b[35m',   // Magenta
  reset: '\x1b[0m'     // Reset
};

/**
 * Logger configuration based on environment
 */
const getLogConfig = () => {
  const env = process.env.NODE_ENV || 'development';

  const configs = {
    development: {
      level: LOG_LEVELS.debug,
      console: true,
      file: false,
      colors: true,
      timestamp: true,
      requestId: true,
      pretty: true
    },
    production: {
      level: LOG_LEVELS.info,
      console: true,
      file: true,
      colors: false,
      timestamp: true,
      requestId: true,
      pretty: false,
      logDir: 'logs',
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    },
    test: {
      level: LOG_LEVELS.error,
      console: false,
      file: false,
      colors: false,
      timestamp: true,
      requestId: false,
      pretty: false
    }
  };

  return configs[env] || configs.development;
};

/**
 * Ensure log directory exists
 */
const ensureLogDirectory = (config) => {
  if (config.file && config.logDir) {
    const logPath = path.resolve(process.cwd(), config.logDir);
    if (!fs.existsSync(logPath)) {
      fs.mkdirSync(logPath, { recursive: true });
    }
    return logPath;
  }
  return null;
};

/**
 * Format timestamp
 */
const formatTimestamp = () => {
  return new Date().toISOString();
};

/**
 * Sanitize log data to prevent injection and limit size
 */
const sanitizeLogData = (data) => {
  if (typeof data === 'string') {
    // Limit string length and remove control characters
    return data.slice(0, 1000).replace(/[\x00-\x1F\x7F]/g, '');
  }

  if (typeof data === 'object' && data !== null) {
    try {
      // Convert to JSON and limit size
      const jsonStr = JSON.stringify(data, (key, value) => {
        // Sanitize sensitive data
        if (key.toLowerCase().includes('password') ||
            key.toLowerCase().includes('secret') ||
            key.toLowerCase().includes('token')) {
          return '[REDACTED]';
        }

        // Limit string values
        if (typeof value === 'string') {
          return value.slice(0, 500);
        }

        return value;
      });

      return jsonStr.length > 10000 ? jsonStr.slice(0, 10000) + '...[TRUNCATED]' : jsonStr;
    } catch (error) {
      return '[CIRCULAR_OR_INVALID_OBJECT]';
    }
  }

  return data;
};

/**
 * Format log message for console output
 */
const formatConsoleMessage = (level, message, data, config) => {
  const parts = [];

  // Timestamp
  if (config.timestamp) {
    parts.push(`[${formatTimestamp()}]`);
  }

  // Log level
  const levelStr = level.toUpperCase().padEnd(5);
  if (config.colors && COLORS[level]) {
    parts.push(`${COLORS[level]}${levelStr}${COLORS.reset}`);
  } else {
    parts.push(levelStr);
  }

  // Message
  parts.push(message);

  // Data
  if (data && Object.keys(data).length > 0) {
    if (config.pretty) {
      parts.push('\n' + JSON.stringify(data, null, 2));
    } else {
      parts.push(sanitizeLogData(data));
    }
  }

  return parts.join(' ');
};

/**
 * Format log message for file output
 */
const formatFileMessage = (level, message, data) => {
  const logEntry = {
    timestamp: formatTimestamp(),
    level: level.toUpperCase(),
    message: message,
    pid: process.pid,
    hostname: require('os').hostname()
  };

  if (data && Object.keys(data).length > 0) {
    logEntry.data = data;
  }

  return JSON.stringify(logEntry);
};

/**
 * Rotate log files if they exceed max size
 */
const rotateLogFile = (filePath, config) => {
  try {
    if (!fs.existsSync(filePath)) {
      return;
    }

    const stats = fs.statSync(filePath);
    if (stats.size > config.maxFileSize) {
      // Rotate existing log files
      for (let i = config.maxFiles - 1; i > 0; i--) {
        const oldFile = `${filePath}.${i}`;
        const newFile = `${filePath}.${i + 1}`;

        if (fs.existsSync(oldFile)) {
          if (i === config.maxFiles - 1) {
            fs.unlinkSync(oldFile); // Delete oldest file
          } else {
            fs.renameSync(oldFile, newFile);
          }
        }
      }

      // Move current file to .1
      fs.renameSync(filePath, `${filePath}.1`);
    }
  } catch (error) {
    console.error('Error rotating log file:', error.message);
  }
};

/**
 * Write log to file
 */
const writeToFile = (level, message, data, config, logDir) => {
  if (!config.file || !logDir) {
    return;
  }

  const logFile = path.join(logDir, `${level}.log`);
  const allLogFile = path.join(logDir, 'all.log');

  try {
    // Rotate if necessary
    rotateLogFile(logFile, config);
    rotateLogFile(allLogFile, config);

    const logMessage = formatFileMessage(level, message, data) + '\n';

    // Write to level-specific file
    fs.appendFileSync(logFile, logMessage);

    // Write to all.log
    fs.appendFileSync(allLogFile, logMessage);
  } catch (error) {
    console.error('Error writing to log file:', error.message);
  }
};

/**
 * Main Logger class
 */
class Logger {
  constructor() {
    this.config = getLogConfig();
    this.logDir = ensureLogDirectory(this.config);
    this.requestContext = new Map();
  }

  /**
   * Set request context for correlation
   */
  setContext(requestId, context) {
    if (this.config.requestId && requestId) {
      this.requestContext.set(requestId, context);
    }
  }

  /**
   * Get request context
   */
  getContext(requestId) {
    return this.requestContext.get(requestId) || {};
  }

  /**
   * Clear old request contexts to prevent memory leaks
   */
  cleanupContexts() {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    for (const [requestId, context] of this.requestContext.entries()) {
      if (context.timestamp && (now - context.timestamp) > maxAge) {
        this.requestContext.delete(requestId);
      }
    }
  }

  /**
   * Core logging method
   */
  log(level, message, data = {}) {
    // Check if this level should be logged
    if (LOG_LEVELS[level] > this.config.level) {
      return;
    }

    // Sanitize data
    const sanitizedData = sanitizeLogData(data);
    let processedData;
    try {
      processedData = typeof sanitizedData === 'string'
        ? JSON.parse(sanitizedData)
        : sanitizedData;
    } catch (e) {
      // If JSON.parse fails, use sanitized data as-is
      processedData = sanitizedData;
    }

    // Add request context if available
    if (data.requestId && this.config.requestId) {
      const context = this.getContext(data.requestId);
      Object.assign(processedData, context);
    }

    // Console logging
    if (this.config.console) {
      const consoleMessage = formatConsoleMessage(level, message, processedData, this.config);
      console.log(consoleMessage);
    }

    // File logging
    if (this.config.file) {
      writeToFile(level, message, processedData, this.config, this.logDir);
    }

    // Periodic cleanup
    if (Math.random() < 0.01) { // 1% chance
      this.cleanupContexts();
    }
  }

  /**
   * Error level logging
   */
  error(message, data = {}) {
    this.log('error', message, data);
  }

  /**
   * Warning level logging
   */
  warn(message, data = {}) {
    this.log('warn', message, data);
  }

  /**
   * Info level logging
   */
  info(message, data = {}) {
    this.log('info', message, data);
  }

  /**
   * Debug level logging
   */
  debug(message, data = {}) {
    this.log('debug', message, data);
  }

  /**
   * Create child logger with additional context
   */
  child(context = {}) {
    const childLogger = new Logger();
    childLogger.defaultContext = { ...this.defaultContext, ...context };
    return childLogger;
  }

  /**
   * Log request details
   */
  request(req, res, duration) {
    const requestData = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id || 'anonymous',
      requestId: req.requestId
    };

    const level = res.statusCode >= 400 ? 'warn' : 'info';
    this.log(level, `${req.method} ${req.originalUrl}`, requestData);
  }

  /**
   * Log authentication events
   */
  auth(event, data = {}) {
    this.info(`Auth Event: ${event}`, {
      event,
      timestamp: formatTimestamp(),
      ...data
    });
  }

  /**
   * Log security events
   */
  security(event, data = {}) {
    this.warn(`Security Event: ${event}`, {
      event,
      severity: 'high',
      timestamp: formatTimestamp(),
      ...data
    });
  }

  /**
   * Log database events
   */
  database(event, data = {}) {
    this.debug(`Database Event: ${event}`, {
      event,
      timestamp: formatTimestamp(),
      ...data
    });
  }
}

// Create singleton logger instance
const logger = new Logger();

/**
 * Request logging middleware
 */
const requestLoggingMiddleware = (req, res, next) => {
  const startTime = Date.now();

  // Generate request ID if not present
  if (!req.requestId) {
    req.requestId = require('crypto').randomBytes(16).toString('hex');
  }

  // Set context
  logger.setContext(req.requestId, {
    timestamp: Date.now(),
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Log request completion
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.request(req, res, duration);
  });

  next();
};

module.exports = {
  logger,
  Logger,
  requestLoggingMiddleware,
  LOG_LEVELS,
  formatTimestamp
};