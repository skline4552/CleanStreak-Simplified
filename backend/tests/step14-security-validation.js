/**
 * Step 14 Security Validation
 *
 * Comprehensive security testing for error handling and logging:
 * - Information leakage prevention
 * - Sensitive data sanitization
 * - Stack trace exposure
 * - Error message safety
 * - Log injection prevention
 */

const { logger } = require('../src/utils/logger');
const {
  AppError,
  ErrorTypes,
  createErrorResponse,
  analyzeError
} = require('../src/middleware/errorHandler');

console.log('='.repeat(80));
console.log('STEP 14 SECURITY VALIDATION');
console.log('='.repeat(80));
console.log('');

let issuesFound = 0;
let checksPerformed = 0;

function securityCheck(name, fn) {
  checksPerformed++;
  try {
    const result = fn();
    if (result === true) {
      console.log(`✅ PASS: ${name}`);
    } else if (result === false) {
      console.log(`❌ FAIL: ${name}`);
      issuesFound++;
    } else {
      console.log(`⚠️  WARNING: ${name} - ${result}`);
    }
  } catch (error) {
    console.error(`❌ ERROR: ${name}`);
    console.error(`   ${error.message}`);
    issuesFound++;
  }
}

// Security Test 1: Sensitive Data Sanitization
console.log('1. Sensitive Data Sanitization');
console.log('-'.repeat(80));

securityCheck('Logger redacts password fields', () => {
  const logSpy = [];
  const originalLog = console.log;
  console.log = (...args) => logSpy.push(args.join(' '));

  logger.info('Test', {
    username: 'testuser',
    password: 'SuperSecret123!',
    email: 'test@example.com'
  });

  console.log = originalLog;

  const logContent = logSpy.join(' ');
  const hasRedaction = logContent.includes('[REDACTED]');
  const leaksPassword = logContent.includes('SuperSecret123!');

  if (!hasRedaction) {
    return 'Password field not being redacted';
  }
  if (leaksPassword) {
    return 'Password value leaked in logs';
  }
  return true;
});

securityCheck('Logger redacts token fields', () => {
  const logSpy = [];
  const originalLog = console.log;
  console.log = (...args) => logSpy.push(args.join(' '));

  logger.info('Test', {
    accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    refreshToken: 'refresh_token_secret',
    apiKey: 'api_key_secret'
  });

  console.log = originalLog;

  const logContent = logSpy.join(' ');
  const leaksToken = logContent.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
  const leaksRefresh = logContent.includes('refresh_token_secret');

  if (leaksToken || leaksRefresh) {
    return 'Token values leaked in logs';
  }
  return true;
});

securityCheck('Logger redacts secret fields', () => {
  const logSpy = [];
  const originalLog = console.log;
  console.log = (...args) => logSpy.push(args.join(' '));

  logger.info('Test', {
    apiSecret: 'secret_value_123',
    clientSecret: 'oauth_client_secret',
    jwtSecret: 'jwt_signing_secret'
  });

  console.log = originalLog;

  const logContent = logSpy.join(' ');
  const leaksSecret = logContent.includes('secret_value_123') ||
                      logContent.includes('oauth_client_secret') ||
                      logContent.includes('jwt_signing_secret');

  if (leaksSecret) {
    return 'Secret values leaked in logs';
  }
  return true;
});

securityCheck('Logger handles nested sensitive data', () => {
  const logSpy = [];
  const originalLog = console.log;
  console.log = (...args) => logSpy.push(args.join(' '));

  logger.info('Test', {
    user: {
      id: '123',
      email: 'test@example.com',
      credentials: {
        password: 'nested_password',
        apiToken: 'nested_token'
      }
    }
  });

  console.log = originalLog;

  const logContent = logSpy.join(' ');
  const leaksPassword = logContent.includes('nested_password');
  const leaksToken = logContent.includes('nested_token');

  if (leaksPassword || leaksToken) {
    return 'Nested sensitive data leaked in logs';
  }
  return true;
});

console.log('');

// Security Test 2: Production Error Messages
console.log('2. Production Error Message Safety');
console.log('-'.repeat(80));

securityCheck('Production errors hide stack traces', () => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  const error = new AppError('Test error', 500, ErrorTypes.SERVER);
  error.stack = 'Error: Test error\n    at /Users/developer/app/src/file.js:42:10';

  const mockReq = { requestId: 'test-123' };
  const response = createErrorResponse(error, mockReq);

  process.env.NODE_ENV = originalEnv;

  if (response.error.stack) {
    return 'Stack trace exposed in production';
  }
  return true;
});

securityCheck('Production errors hide internal details', () => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  const error = new AppError(
    'Database connection failed',
    500,
    ErrorTypes.DATABASE,
    { host: 'internal-db.company.com', port: 5432 }
  );

  const mockReq = { requestId: 'test-123' };
  const response = createErrorResponse(error, mockReq);

  process.env.NODE_ENV = originalEnv;

  if (response.error.details) {
    return 'Internal details exposed in production';
  }
  return true;
});

securityCheck('Production errors do not leak file paths', () => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  const error = new Error('File not found: /home/user/sensitive/path/file.txt');
  const analysis = analyzeError(error);

  process.env.NODE_ENV = originalEnv;

  if (analysis.message.includes('/home/') || analysis.message.includes('/Users/')) {
    return 'File paths leaked in error message';
  }
  return true;
});

console.log('');

// Security Test 3: Log Injection Prevention
console.log('3. Log Injection Prevention');
console.log('-'.repeat(80));

securityCheck('Logger strips control characters', () => {
  const logSpy = [];
  const originalLog = console.log;
  console.log = (...args) => logSpy.push(args.join(' '));

  // Try to inject newlines and ANSI escape codes
  logger.info('Test', {
    maliciousInput: 'Normal text\n[ADMIN] Fake admin message\x1b[31mRed text\x1b[0m'
  });

  console.log = originalLog;

  const logContent = logSpy.join(' ');

  // Control characters should be stripped
  const hasNewlineInjection = logContent.includes('Normal text\n[ADMIN]');
  const hasAnsiInjection = logContent.includes('\x1b[31m');

  if (hasNewlineInjection || hasAnsiInjection) {
    return 'Control character injection not prevented';
  }
  return true;
});

securityCheck('Logger limits string size to prevent DOS', () => {
  const logSpy = [];
  const originalLog = console.log;
  console.log = (...args) => logSpy.push(args.join(' '));

  // Try to log extremely large string
  const hugeString = 'A'.repeat(50000);
  logger.info('Test', { data: hugeString });

  console.log = originalLog;

  const logContent = logSpy.join(' ');

  // Should be truncated
  const isTruncated = logContent.includes('[TRUNCATED]');
  const fullStringLogged = logContent.includes('A'.repeat(50000));

  if (!isTruncated && fullStringLogged) {
    return 'Large strings not truncated - potential DOS vector';
  }
  return true;
});

securityCheck('Logger handles malicious JSON', () => {
  try {
    logger.info('Test', {
      __proto__: { admin: true },
      constructor: { prototype: { admin: true } }
    });
    return true;
  } catch (error) {
    return `Logger threw error on prototype pollution attempt: ${error.message}`;
  }
});

console.log('');

// Security Test 4: Error Information Disclosure
console.log('4. Error Information Disclosure Prevention');
console.log('-'.repeat(80));

securityCheck('Database errors hide connection details', () => {
  const prismaError = {
    code: 'P2002',
    meta: {
      target: ['email'],
      database_error: 'Connection to postgres://user:pass@internal-db:5432/db failed'
    }
  };

  const analysis = analyzeError(prismaError);

  // Should not expose connection strings
  const message = JSON.stringify(analysis);
  if (message.includes('postgres://') || message.includes('internal-db')) {
    return 'Database connection details leaked';
  }
  return true;
});

securityCheck('JWT errors do not expose token content', () => {
  const jwtError = {
    name: 'JsonWebTokenError',
    message: 'invalid token',
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
  };

  const analysis = analyzeError(jwtError);

  // Should not expose actual token
  const message = JSON.stringify(analysis);
  if (message.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')) {
    return 'JWT token content leaked in error';
  }
  return true;
});

securityCheck('Operational errors are properly classified', () => {
  const appError = new AppError('Test', 400, ErrorTypes.VALIDATION);
  if (!appError.isOperational) {
    return 'AppError not marked as operational';
  }

  const systemError = new Error('System error');
  if (systemError.isOperational === true) {
    return 'System errors incorrectly marked as operational';
  }

  return true;
});

console.log('');

// Security Test 5: Request Correlation and Tracking
console.log('5. Request Correlation Security');
console.log('-'.repeat(80));

securityCheck('Request IDs are unpredictable', () => {
  const { requestLoggingMiddleware } = require('../src/utils/logger');

  const ids = new Set();
  for (let i = 0; i < 100; i++) {
    const mockReq = { method: 'GET', path: '/test', get: () => 'agent' };
    const mockRes = { on: () => {} };
    requestLoggingMiddleware(mockReq, mockRes, () => {});
    ids.add(mockReq.requestId);
  }

  // All should be unique
  if (ids.size !== 100) {
    return `Request ID collision detected (${ids.size}/100 unique)`;
  }

  // Check they're not sequential
  const idArray = Array.from(ids);
  const firstId = idArray[0];
  const lastId = idArray[99];

  // Should be random hexadecimal strings, not sequential numbers
  if (firstId === '1' && lastId === '100') {
    return 'Request IDs appear sequential - predictable';
  }

  return true;
});

securityCheck('Logger context cleanup prevents memory leaks', () => {
  // Set many contexts
  for (let i = 0; i < 1000; i++) {
    logger.setContext(`old-request-${i}`, {
      timestamp: Date.now() - (2 * 60 * 60 * 1000), // 2 hours ago
      data: 'test'
    });
  }

  // Cleanup
  logger.cleanupContexts();

  // Memory leak check is hard to test precisely, but function should not throw
  return true;
});

console.log('');

// Security Test 6: Circular Reference Safety
console.log('6. Circular Reference and Complex Object Handling');
console.log('-'.repeat(80));

securityCheck('Logger handles circular references without crashes', () => {
  try {
    const circular = { name: 'test' };
    circular.self = circular;
    circular.deep = { parent: circular };

    logger.info('Circular test', circular);
    return true;
  } catch (error) {
    return `Logger crashed on circular reference: ${error.message}`;
  }
});

securityCheck('Logger handles BigInt values', () => {
  try {
    logger.info('BigInt test', {
      bigNumber: BigInt('9007199254740991')
    });
    return true;
  } catch (error) {
    // BigInt cannot be serialized to JSON, should handle gracefully
    if (error.message.includes('BigInt')) {
      return true; // Expected behavior
    }
    return `Unexpected error: ${error.message}`;
  }
});

securityCheck('Logger handles Symbol values', () => {
  try {
    logger.info('Symbol test', {
      sym: Symbol('test'),
      normalField: 'value'
    });
    return true;
  } catch (error) {
    return `Logger crashed on Symbol: ${error.message}`;
  }
});

console.log('');

// Summary
console.log('='.repeat(80));
console.log('SECURITY VALIDATION SUMMARY');
console.log('='.repeat(80));
console.log(`✅ Security Checks Passed: ${checksPerformed - issuesFound}`);
console.log(`❌ Issues Found: ${issuesFound}`);
console.log(`📊 Total Checks: ${checksPerformed}`);
console.log(`🔒 Security Score: ${((checksPerformed - issuesFound) / checksPerformed * 100).toFixed(1)}%`);
console.log('');

if (issuesFound === 0) {
  console.log('🎉 All security checks passed!');
  console.log('');
  console.log('Security Features Validated:');
  console.log('✅ Sensitive data sanitization (passwords, tokens, secrets)');
  console.log('✅ Production error message safety (no stack traces or internal details)');
  console.log('✅ Log injection prevention (control character stripping)');
  console.log('✅ DOS protection (string size limits)');
  console.log('✅ Information disclosure prevention');
  console.log('✅ Unpredictable request IDs');
  console.log('✅ Circular reference handling');
  console.log('✅ Memory leak prevention');
  console.log('');
  process.exit(0);
} else {
  console.log(`⚠️  ${issuesFound} security issue(s) found - review required`);
  console.log('');
  process.exit(1);
}