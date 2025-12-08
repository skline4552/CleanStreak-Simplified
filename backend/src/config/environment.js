const path = require('path');
require('dotenv').config();

const NODE_ENV = process.env.NODE_ENV || 'development';

// Load environment-specific configuration
const envFile = path.join(__dirname, '..', '..', `.env.${NODE_ENV}`);
require('dotenv').config({ path: envFile });

const config = {
  // Application settings
  NODE_ENV,
  PORT: parseInt(process.env.PORT, 10) || 3000,
  HOST: process.env.HOST || '0.0.0.0',

  // Database configuration
  DATABASE_URL: process.env.DATABASE_URL || getDatabaseUrl(),

  // JWT configuration
  JWT_SECRET: process.env.JWT_SECRET || generateDefaultSecret(),
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || generateDefaultSecret('refresh'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  // Cookie configuration
  COOKIE_SECRET: process.env.COOKIE_SECRET || generateDefaultSecret('cookie'),
  COOKIE_SECURE: process.env.COOKIE_SECURE === 'true' || NODE_ENV === 'production',
  COOKIE_SAME_SITE: process.env.COOKIE_SAME_SITE || (NODE_ENV === 'production' ? 'strict' : 'lax'),

  // CORS configuration
  CORS_ORIGIN: getCorsOrigin(),
  CORS_CREDENTIALS: process.env.CORS_CREDENTIALS === 'true' || true,

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,

  // Security
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12,

  // Email configuration
  EMAIL_HOST: process.env.EMAIL_HOST || 'smtp.gmail.com',
  EMAIL_PORT: parseInt(process.env.EMAIL_PORT, 10) || 587,
  EMAIL_SECURE: process.env.EMAIL_SECURE === 'true',
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
  EMAIL_FROM: process.env.EMAIL_FROM || 'CleanStreak <noreply@cleanstreak.com>',

  // Email verification
  EMAIL_VERIFICATION_URL: process.env.EMAIL_VERIFICATION_URL || 'http://localhost:8080/verify-email',
  VERIFICATION_TOKEN_EXPIRY_HOURS: parseInt(process.env.VERIFICATION_TOKEN_EXPIRY_HOURS, 10) || 24,

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || (NODE_ENV === 'production' ? 'info' : 'debug'),

  // Database connection pool (for PostgreSQL)
  DB_POOL_MIN: parseInt(process.env.DB_POOL_MIN, 10) || 2,
  DB_POOL_MAX: parseInt(process.env.DB_POOL_MAX, 10) || 10,
  DB_POOL_ACQUIRE_TIMEOUT: parseInt(process.env.DB_POOL_ACQUIRE_TIMEOUT, 10) || 60000,
  DB_POOL_IDLE_TIMEOUT: parseInt(process.env.DB_POOL_IDLE_TIMEOUT, 10) || 10000,

  // Prisma-specific configuration
  PRISMA_LOG_LEVEL: process.env.PRISMA_LOG_LEVEL || getPrismaLogLevel(),
  PRISMA_QUERY_ENGINE_PROTOCOL: process.env.PRISMA_QUERY_ENGINE_PROTOCOL || 'graphql',
  PRISMA_BINARY_TARGET: process.env.PRISMA_BINARY_TARGET || undefined,

  // Database SSL configuration (for PostgreSQL in production)
  DB_SSL_MODE: process.env.DB_SSL_MODE || (NODE_ENV === 'production' ? 'require' : 'prefer'),
  DB_SSL_CERT: process.env.DB_SSL_CERT || undefined,
  DB_SSL_KEY: process.env.DB_SSL_KEY || undefined,
  DB_SSL_CA: process.env.DB_SSL_CA || undefined,
  DB_SSL_REJECT_UNAUTHORIZED: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' || NODE_ENV === 'production',

  // Database performance monitoring
  DB_SLOW_QUERY_THRESHOLD: parseInt(process.env.DB_SLOW_QUERY_THRESHOLD, 10) || 100, // milliseconds
  DB_CONNECTION_TIMEOUT: parseInt(process.env.DB_CONNECTION_TIMEOUT, 10) || 10000, // milliseconds
  DB_STATEMENT_TIMEOUT: parseInt(process.env.DB_STATEMENT_TIMEOUT, 10) || 30000, // milliseconds
};

function getDatabaseUrl() {
  if (NODE_ENV === 'production') {
    return process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/cleanstreak_prod';
  } else if (NODE_ENV === 'test') {
    return 'file:./test.db';
  } else {
    return 'file:./dev.db';
  }
}

function getCorsOrigin() {
  // If CORS_ORIGIN is set in environment, split by commas
  if (process.env.CORS_ORIGIN) {
    return process.env.CORS_ORIGIN.split(',').map(origin => origin.trim());
  }

  // Default values based on environment
  if (NODE_ENV === 'production') {
    return ['https://cleanstreak.com'];
  } else {
    return ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'];
  }
}

function generateDefaultSecret(type = 'main') {
  if (NODE_ENV === 'production') {
    throw new Error(`${type.toUpperCase()}_SECRET must be set in production environment`);
  }

  // Generate a deterministic but secure default for development
  const crypto = require('crypto');
  const base = `cleanstreak-${type}-${NODE_ENV}`;
  return crypto.createHash('sha256').update(base).digest('hex');
}

function getPrismaLogLevel() {
  switch (NODE_ENV) {
    case 'production':
      return 'warn';
    case 'test':
      return 'error';
    case 'development':
    default:
      return 'info';
  }
}

// Validation
function validateConfig() {
  const required = [];

  if (NODE_ENV === 'production') {
    required.push(
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'COOKIE_SECRET',
      'DATABASE_URL'
    );
  }

  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate JWT secret strength in production
  if (NODE_ENV === 'production') {
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long in production');
    }
  }
}

// Run validation
validateConfig();

module.exports = config;