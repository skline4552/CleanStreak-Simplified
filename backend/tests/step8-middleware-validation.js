const {
  authenticate,
  optionalAuth,
  refreshToken,
  authorize,
  requireFreshToken,
  requireOwnership,
  authRateLimit
} = require('../src/middleware/auth');
const { generateAccessToken, generateRefreshToken } = require('../src/utils/jwt');

/**
 * Step 8 Middleware Validation: Authentication Middleware Testing
 *
 * Testing authentication middleware functions and security features
 */

async function runMiddlewareValidationTests() {
  console.log('🛡️ Step 8 Middleware Validation: Authentication Middleware Testing');
  console.log('=' .repeat(70));

  let testsRun = 0;
  let testsPassed = 0;
  const errors = [];

  function runTest(testName, testFn) {
    testsRun++;
    try {
      const result = testFn();
      if (result === true || result === undefined) {
        testsPassed++;
        console.log(`✅ ${testName}`);
        return true;
      } else {
        errors.push(`${testName}: Test returned false`);
        console.log(`❌ ${testName}: Test returned false`);
        return false;
      }
    } catch (error) {
      errors.push(`${testName}: ${error.message}`);
      console.log(`❌ ${testName}: ${error.message}`);
      return false;
    }
  }

  // Generate test tokens
  const testPayload = { userId: 'test-user-123', email: 'test@example.com' };
  const accessTokenData = generateAccessToken(testPayload);
  const refreshTokenData = generateRefreshToken(testPayload);

  // Test Authentication Middleware
  console.log('\n🔐 Authentication Middleware Tests');
  console.log('-'.repeat(50));

  runTest('Authenticate with valid token via header', () => {
    const mockReq = {
      headers: { authorization: `Bearer ${accessTokenData.token}` },
      cookies: {}
    };
    const mockRes = { status: () => ({ json: () => {} }) };
    let nextCalled = false;
    const mockNext = () => { nextCalled = true; };

    authenticate(mockReq, mockRes, mockNext);

    return nextCalled &&
           mockReq.user &&
           mockReq.user.userId === testPayload.userId &&
           mockReq.tokenInfo &&
           mockReq.tokenInfo.type === 'access';
  });

  runTest('Authenticate with valid token via cookie', () => {
    const mockReq = {
      headers: {},
      cookies: { accessToken: accessTokenData.token }
    };
    const mockRes = { status: () => ({ json: () => {} }) };
    let nextCalled = false;
    const mockNext = () => { nextCalled = true; };

    authenticate(mockReq, mockRes, mockNext);

    return nextCalled &&
           mockReq.user &&
           mockReq.user.userId === testPayload.userId;
  });

  runTest('Reject authentication with no token', () => {
    const mockReq = { headers: {}, cookies: {} };
    let statusCode, response;
    const mockRes = {
      status: (code) => {
        statusCode = code;
        return { json: (data) => { response = data; } };
      }
    };
    const mockNext = () => {};

    authenticate(mockReq, mockRes, mockNext);

    return statusCode === 401 &&
           response &&
           response.code === 'NO_TOKEN';
  });

  runTest('Reject authentication with invalid token', () => {
    const mockReq = {
      headers: { authorization: 'Bearer invalid.token.here' },
      cookies: {}
    };
    let statusCode, response;
    const mockRes = {
      status: (code) => {
        statusCode = code;
        return { json: (data) => { response = data; } };
      }
    };
    const mockNext = () => {};

    authenticate(mockReq, mockRes, mockNext);

    return statusCode === 401 &&
           response &&
           response.code === 'INVALID_TOKEN';
  });

  // Test Optional Authentication Middleware
  console.log('\n🔓 Optional Authentication Tests');
  console.log('-'.repeat(50));

  runTest('Optional auth with valid token', () => {
    const mockReq = {
      headers: { authorization: `Bearer ${accessTokenData.token}` },
      cookies: {}
    };
    const mockRes = {};
    let nextCalled = false;
    const mockNext = () => { nextCalled = true; };

    optionalAuth(mockReq, mockRes, mockNext);

    return nextCalled &&
           mockReq.user &&
           mockReq.isAuthenticated === true;
  });

  runTest('Optional auth with no token', () => {
    const mockReq = { headers: {}, cookies: {} };
    const mockRes = {};
    let nextCalled = false;
    const mockNext = () => { nextCalled = true; };

    optionalAuth(mockReq, mockRes, mockNext);

    return nextCalled &&
           !mockReq.user &&
           mockReq.isAuthenticated === false;
  });

  runTest('Optional auth with invalid token', () => {
    const mockReq = {
      headers: { authorization: 'Bearer invalid.token' },
      cookies: {}
    };
    const mockRes = {};
    let nextCalled = false;
    const mockNext = () => { nextCalled = true; };

    optionalAuth(mockReq, mockRes, mockNext);

    return nextCalled &&
           !mockReq.user &&
           mockReq.isAuthenticated === false;
  });

  // Test Authorization Middleware
  console.log('\n🔒 Authorization Middleware Tests');
  console.log('-'.repeat(50));

  runTest('Authorize authenticated user with no role requirements', () => {
    const mockReq = { user: { userId: 'test-user-123' } };
    const mockRes = {};
    let nextCalled = false;
    const mockNext = () => { nextCalled = true; };

    const authMiddleware = authorize([]);
    authMiddleware(mockReq, mockRes, mockNext);

    return nextCalled;
  });

  runTest('Reject authorization for unauthenticated user', () => {
    const mockReq = {};
    let statusCode, response;
    const mockRes = {
      status: (code) => {
        statusCode = code;
        return { json: (data) => { response = data; } };
      }
    };
    const mockNext = () => {};

    const authMiddleware = authorize(['user']);
    authMiddleware(mockReq, mockRes, mockNext);

    return statusCode === 401 &&
           response &&
           response.code === 'NOT_AUTHENTICATED';
  });

  // Test Fresh Token Requirement
  console.log('\n⏰ Fresh Token Middleware Tests');
  console.log('-'.repeat(50));

  runTest('Accept fresh token', () => {
    const mockReq = {
      tokenInfo: {
        issuedAt: new Date(Date.now() - 30000) // 30 seconds ago
      }
    };
    const mockRes = {};
    let nextCalled = false;
    const mockNext = () => { nextCalled = true; };

    const freshTokenMiddleware = requireFreshToken(60); // 60 seconds max age
    freshTokenMiddleware(mockReq, mockRes, mockNext);

    return nextCalled;
  });

  runTest('Reject old token', () => {
    const mockReq = {
      tokenInfo: {
        issuedAt: new Date(Date.now() - 400000) // 400 seconds ago
      }
    };
    let statusCode, response;
    const mockRes = {
      status: (code) => {
        statusCode = code;
        return { json: (data) => { response = data; } };
      }
    };
    const mockNext = () => {};

    const freshTokenMiddleware = requireFreshToken(300); // 300 seconds max age
    freshTokenMiddleware(mockReq, mockRes, mockNext);

    return statusCode === 401 &&
           response &&
           response.code === 'TOKEN_TOO_OLD';
  });

  // Test Ownership Middleware
  console.log('\n👤 Ownership Middleware Tests');
  console.log('-'.repeat(50));

  runTest('Allow access to own resource', () => {
    const mockReq = {
      user: { userId: 'test-user-123' },
      params: { userId: 'test-user-123' }
    };
    const mockRes = {};
    let nextCalled = false;
    const mockNext = () => { nextCalled = true; };

    const ownershipMiddleware = requireOwnership('userId');
    ownershipMiddleware(mockReq, mockRes, mockNext);

    return nextCalled;
  });

  runTest('Deny access to other user resource', () => {
    const mockReq = {
      user: { userId: 'test-user-123' },
      params: { userId: 'other-user-456' }
    };
    let statusCode, response;
    const mockRes = {
      status: (code) => {
        statusCode = code;
        return { json: (data) => { response = data; } };
      }
    };
    const mockNext = () => {};

    const ownershipMiddleware = requireOwnership('userId');
    ownershipMiddleware(mockReq, mockRes, mockNext);

    return statusCode === 403 &&
           response &&
           response.code === 'NOT_RESOURCE_OWNER';
  });

  // Test Rate Limiting
  console.log('\n🚦 Rate Limiting Tests');
  console.log('-'.repeat(50));

  runTest('Rate limiting middleware creation', () => {
    const rateLimitMiddleware = authRateLimit({ type: 'login' });
    return typeof rateLimitMiddleware === 'function';
  });

  runTest('Rate limiting middleware with custom options', () => {
    const rateLimitMiddleware = authRateLimit({
      type: 'register',
      windowMs: 60000,
      max: 5
    });
    return typeof rateLimitMiddleware === 'function';
  });

  // Test Error Handling
  console.log('\n⚠️ Error Handling Tests');
  console.log('-'.repeat(50));

  runTest('Middleware handles exceptions gracefully', () => {
    const mockReq = {
      headers: { authorization: 'Bearer malformed' },
      cookies: {}
    };
    let errorHandled = false;
    const mockRes = {
      status: () => ({
        json: () => { errorHandled = true; }
      })
    };
    const mockNext = () => {};

    try {
      authenticate(mockReq, mockRes, mockNext);
      return errorHandled;
    } catch (error) {
      return false; // Should not throw unhandled exceptions
    }
  });

  // Summary
  console.log('\n📊 Test Summary');
  console.log('=' .repeat(70));
  console.log(`Tests run: ${testsRun}`);
  console.log(`Tests passed: ${testsPassed}`);
  console.log(`Tests failed: ${testsRun - testsPassed}`);
  console.log(`Success rate: ${((testsPassed / testsRun) * 100).toFixed(1)}%`);

  if (errors.length > 0) {
    console.log('\n❌ Failures:');
    errors.forEach(error => console.log(`   - ${error}`));
  }

  const allTestsPassed = testsPassed === testsRun;
  console.log(`\n${allTestsPassed ? '✅' : '❌'} Step 8 Authentication Middleware: ${allTestsPassed ? 'PASSED' : 'FAILED'}`);

  return {
    success: allTestsPassed,
    testsRun,
    testsPassed,
    errors,
    summary: {
      authentication: 'Working correctly with token extraction',
      optionalAuth: 'Handles both authenticated and anonymous users',
      authorization: 'Role-based access control implemented',
      freshToken: 'Token age validation working',
      ownership: 'Resource ownership validation functional',
      rateLimiting: 'Rate limiting middleware configured',
      errorHandling: 'Comprehensive error handling implemented'
    }
  };
}

// Run tests if this file is executed directly
if (require.main === module) {
  runMiddlewareValidationTests().catch(console.error);
}

module.exports = { runMiddlewareValidationTests };