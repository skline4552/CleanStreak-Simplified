/**
 * Step 14 Integration Tests: Error Handling and Logging
 *
 * Comprehensive integration tests including:
 * - API error responses in different environments
 * - Logging behavior under various conditions
 * - Error handler integration with actual routes
 * - Security considerations (information leakage)
 * - Performance and edge cases
 */

const request = require('supertest');
const app = require('../src/app');
const { logger } = require('../src/utils/logger');
const { AppError, ErrorTypes } = require('../src/middleware/errorHandler');

describe('Step 14: Error Handling and Logging Integration', () => {

  // Store original NODE_ENV
  const originalEnv = process.env.NODE_ENV;

  afterAll(() => {
    // Restore original environment
    process.env.NODE_ENV = originalEnv;
  });

  describe('API Error Responses', () => {

    test('404 error for non-existent routes includes proper format', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('type');
      expect(response.body.error).toHaveProperty('timestamp');
      expect(response.body.error).toHaveProperty('requestId');
      expect(response.body.error.type).toBe('NOT_FOUND_ERROR');
    });

    test('Health endpoint returns successful response', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('requestId');
    });

    test('Error response includes request correlation ID', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body.error.requestId).toBeDefined();
      expect(typeof response.body.error.requestId).toBe('string');
      expect(response.body.error.requestId.length).toBeGreaterThan(0);
    });

  });

  describe('Environment-Specific Behavior', () => {

    test('Development mode includes stack traces', async () => {
      process.env.NODE_ENV = 'development';

      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body.error).toHaveProperty('stack');
    });

    test('Production mode excludes stack traces', async () => {
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body.error).not.toHaveProperty('stack');
    });

    test('Production mode excludes error details', async () => {
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body.error).not.toHaveProperty('details');
    });

  });

  describe('Logger Functionality', () => {

    test('Logger handles all log levels without errors', () => {
      expect(() => {
        logger.debug('Debug message', { test: 'data' });
        logger.info('Info message', { test: 'data' });
        logger.warn('Warning message', { test: 'data' });
        logger.error('Error message', { test: 'data' });
      }).not.toThrow();
    });

    test('Logger specialized methods work correctly', () => {
      expect(() => {
        logger.auth('login_attempt', { userId: 'test-123' });
        logger.security('suspicious_activity', { ip: '127.0.0.1' });
        logger.database('query', { duration: 100 });
      }).not.toThrow();
    });

    test('Logger sanitizes sensitive data in nested objects', () => {
      const logOutput = [];
      const originalLog = console.log;
      console.log = (...args) => logOutput.push(args.join(' '));

      logger.info('Test', {
        user: {
          email: 'test@example.com',
          password: 'should-be-redacted',
          profile: {
            name: 'Test User',
            apiSecret: 'should-also-be-redacted'
          }
        }
      });

      console.log = originalLog;

      const logString = logOutput.join(' ');
      expect(logString).toContain('[REDACTED]');
      expect(logString).not.toContain('should-be-redacted');
      expect(logString).not.toContain('should-also-be-redacted');
    });

    test('Logger handles very large objects', () => {
      const largeObject = {
        data: 'x'.repeat(15000),
        nested: {
          moreData: 'y'.repeat(15000)
        }
      };

      expect(() => {
        logger.info('Large object test', largeObject);
      }).not.toThrow();
    });

    test('Logger handles circular references gracefully', () => {
      const circular = { name: 'test' };
      circular.self = circular;
      circular.nested = { parent: circular };

      expect(() => {
        logger.info('Circular reference test', circular);
      }).not.toThrow();
    });

  });

  describe('Error Handler Security', () => {

    test('Error messages do not leak internal paths in production', async () => {
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      const responseString = JSON.stringify(response.body);
      expect(responseString).not.toMatch(/\/Users\//);
      expect(responseString).not.toMatch(/\/home\//);
      expect(responseString).not.toMatch(/node_modules/);
    });

    test('Error responses do not include sensitive headers', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.headers).not.toHaveProperty('x-powered-by');
    });

  });

  describe('AppError Custom Error Class', () => {

    test('AppError sets all required properties', () => {
      const error = new AppError(
        'Test error',
        400,
        ErrorTypes.VALIDATION,
        { field: 'email' }
      );

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.type).toBe(ErrorTypes.VALIDATION);
      expect(error.details).toEqual({ field: 'email' });
      expect(error.isOperational).toBe(true);
      expect(error.timestamp).toBeDefined();
      expect(error.stack).toBeDefined();
    });

    test('AppError has proper prototype chain', () => {
      const error = new AppError('Test', 500);
      expect(error instanceof Error).toBe(true);
      expect(error instanceof AppError).toBe(true);
    });

  });

  describe('Edge Cases', () => {

    test('Logger handles null and undefined values', () => {
      expect(() => {
        logger.info('Null test', { value: null });
        logger.info('Undefined test', { value: undefined });
        logger.info('Mixed test', {
          nullValue: null,
          undefinedValue: undefined,
          normalValue: 'test'
        });
      }).not.toThrow();
    });

    test('Logger handles empty objects and arrays', () => {
      expect(() => {
        logger.info('Empty object', {});
        logger.info('Empty array', { items: [] });
        logger.info('Empty nested', { data: { nested: {} } });
      }).not.toThrow();
    });

    test('Logger handles special characters in strings', () => {
      expect(() => {
        logger.info('Special chars', {
          unicode: '🔥 Unicode emoji',
          newlines: 'Line 1\nLine 2\nLine 3',
          tabs: 'Col1\tCol2\tCol3',
          quotes: 'Single \' and double " quotes'
        });
      }).not.toThrow();
    });

    test('Logger handles Date objects', () => {
      expect(() => {
        logger.info('Date test', {
          now: new Date(),
          timestamp: Date.now()
        });
      }).not.toThrow();
    });

    test('Error handler processes multiple concurrent errors', async () => {
      const requests = Array.from({ length: 10 }, () =>
        request(app).get('/api/nonexistent')
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(404);
        expect(response.body.error).toBeDefined();
        expect(response.body.error.requestId).toBeDefined();
      });

      // All request IDs should be unique
      const requestIds = responses.map(r => r.body.error.requestId);
      const uniqueIds = new Set(requestIds);
      expect(uniqueIds.size).toBe(10);
    });

  });

  describe('Request Logging Integration', () => {

    test('Each request gets unique request ID', async () => {
      const response1 = await request(app).get('/api/health');
      const response2 = await request(app).get('/api/health');

      expect(response1.body.requestId).toBeDefined();
      expect(response2.body.requestId).toBeDefined();
      expect(response1.body.requestId).not.toBe(response2.body.requestId);
    });

    test('Request ID is consistent within single request', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      const requestId = response.body.error.requestId;
      expect(requestId).toBeDefined();
      expect(typeof requestId).toBe('string');
    });

  });

  describe('Logger Context Management', () => {

    test('Logger setContext and getContext work correctly', () => {
      const requestId = 'test-req-123';
      const context = { userId: 'user-456', ip: '127.0.0.1' };

      logger.setContext(requestId, context);
      const retrieved = logger.getContext(requestId);

      expect(retrieved).toEqual(context);
    });

    test('Logger returns empty object for unknown context', () => {
      const retrieved = logger.getContext('unknown-request-id');
      expect(retrieved).toEqual({});
    });

    test('Logger cleanupContexts does not throw', () => {
      expect(() => {
        logger.cleanupContexts();
      }).not.toThrow();
    });

  });

  describe('Child Logger Functionality', () => {

    test('Child logger can be created', () => {
      const child = logger.child({ component: 'test-component' });
      expect(child).toBeDefined();
      expect(typeof child.info).toBe('function');
      expect(typeof child.error).toBe('function');
    });

    test('Child logger inherits parent methods', () => {
      const child = logger.child({ service: 'api' });
      expect(() => {
        child.info('Child logger test');
        child.error('Child logger error test');
        child.debug('Child logger debug test');
      }).not.toThrow();
    });

  });

  describe('Performance and Scalability', () => {

    test('Logger performs well with rapid consecutive calls', () => {
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        logger.info(`Test log ${i}`, { iteration: i, data: 'test' });
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    test('Error handler processes errors efficiently', async () => {
      const startTime = Date.now();

      const requests = Array.from({ length: 20 }, (_, i) =>
        request(app).get(`/api/nonexistent-${i}`)
      );

      await Promise.all(requests);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(10000); // Should complete in under 10 seconds
    });

  });

});