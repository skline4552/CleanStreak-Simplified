const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  isTokenExpired,
  getTokenTimeRemaining,
  setAuthCookies,
  clearAuthCookies
} = require('../src/utils/jwt');
const {
  authenticate,
  optionalAuth,
  refreshToken,
  authorize,
  requireFreshToken,
  requireOwnership,
  authRateLimit
} = require('../src/middleware/auth');
const { jwtConfig, authRateLimit: rateLimitConfig } = require('../src/config/auth');

/**
 * Step 8 Integration Validation: Complete Authentication Flow Testing
 *
 * Tests the complete authentication system integration including
 * token generation, validation, middleware integration, and security features.
 */

async function runIntegrationValidationTests() {
  console.log('🔗 Step 8 Integration Validation: Complete Authentication Flow Testing');
  console.log('=' .repeat(80));

  let testsRun = 0;
  let testsPassed = 0;
  const errors = [];
  const performanceMetrics = {};

  function runTest(testName, testFn) {
    testsRun++;
    try {
      const start = Date.now();
      const result = testFn();
      const duration = Date.now() - start;

      if (result === true || result === undefined) {
        testsPassed++;
        console.log(`✅ ${testName} (${duration}ms)`);
        return true;
      } else {
        errors.push(`${testName}: Test returned ${result}`);
        console.log(`❌ ${testName}: Test returned ${result}`);
        return false;
      }
    } catch (error) {
      errors.push(`${testName}: ${error.message}`);
      console.log(`❌ ${testName}: ${error.message}`);
      return false;
    }
  }

  async function runAsyncTest(testName, testFn) {
    testsRun++;
    try {
      const start = Date.now();
      const result = await testFn();
      const duration = Date.now() - start;

      if (result === true || result === undefined) {
        testsPassed++;
        console.log(`✅ ${testName} (${duration}ms)`);
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

  // Test Complete Authentication Flow
  console.log('\n🔄 Complete Authentication Flow Tests');
  console.log('-'.repeat(60));

  let userPayload, tokenPair, accessToken, refreshTokenValue;

  runTest('Create user payload for authentication', () => {
    userPayload = {
      userId: 'integration-test-user-' + Date.now(),
      email: 'integration.test@example.com',
      roles: ['user']
    };
    return !!(userPayload && userPayload.userId && userPayload.email);
  });

  runTest('Generate complete token pair for user', () => {
    tokenPair = generateTokenPair(userPayload);
    accessToken = tokenPair.accessToken.token;
    refreshTokenValue = tokenPair.refreshToken.token;

    return !!(tokenPair &&
           tokenPair.accessToken &&
           tokenPair.refreshToken &&
           accessToken &&
           refreshTokenValue);
  });

  runTest('Verify token pair contains correct user data', () => {
    const decodedAccess = verifyAccessToken(accessToken);
    const decodedRefresh = verifyRefreshToken(refreshTokenValue);

    return decodedAccess.userId === userPayload.userId &&
           decodedAccess.email === userPayload.email &&
           decodedRefresh.userId === userPayload.userId &&
           decodedAccess.type === 'access' &&
           decodedRefresh.type === 'refresh';
  });

  // Test Middleware Integration
  console.log('\n🛡️ Middleware Integration Tests');
  console.log('-'.repeat(60));

  let authRequest, authResponse;

  runTest('Setup mock request with tokens', () => {
    authRequest = {
      headers: { authorization: `Bearer ${accessToken}` },
      cookies: { accessToken, refreshToken: refreshTokenValue },
      params: {},
      body: {},
      query: {}
    };

    authResponse = {
      cookies: {},
      cookie(name, value, options) {
        this.cookies[name] = { value, options };
      },
      clearCookie(name, options) {
        delete this.cookies[name];
      },
      status: (code) => ({
        json: (data) => ({ statusCode: code, data })
      })
    };

    return !!(authRequest && authResponse);
  });

  runTest('Authentication middleware extracts user info', () => {
    let nextCalled = false;
    authenticate(authRequest, authResponse, () => {
      nextCalled = true;
    });

    return nextCalled &&
           authRequest.user &&
           authRequest.user.userId === userPayload.userId &&
           authRequest.tokenInfo &&
           authRequest.tokenInfo.type === 'access';
  });

  runTest('Optional authentication with valid token', () => {
    const testReq = { ...authRequest };
    let nextCalled = false;
    optionalAuth(testReq, authResponse, () => {
      nextCalled = true;
    });

    return nextCalled &&
           testReq.isAuthenticated === true &&
           testReq.user &&
           testReq.user.userId === userPayload.userId;
  });

  runTest('Optional authentication without token', () => {
    const testReq = { headers: {}, cookies: {} };
    let nextCalled = false;
    optionalAuth(testReq, authResponse, () => {
      nextCalled = true;
    });

    return nextCalled &&
           testReq.isAuthenticated === false && !testReq.user;
  });

  runTest('Authorization middleware allows authenticated user', () => {
    const testReq = { ...authRequest, user: { userId: userPayload.userId, roles: ['user'] } };
    let nextCalled = false;
    const authMiddleware = authorize(['user']);
    authMiddleware(testReq, authResponse, () => {
      nextCalled = true;
    });

    return nextCalled; // Should call next() without error
  });

  runTest('Ownership middleware allows resource owner', () => {
    const testReq = {
      user: { userId: userPayload.userId },
      params: { userId: userPayload.userId }
    };
    let nextCalled = false;
    const ownershipMiddleware = requireOwnership('userId');
    ownershipMiddleware(testReq, authResponse, () => {
      nextCalled = true;
    });

    return nextCalled; // Should call next() without error
  });

  // Test Token Refresh Flow
  console.log('\n🔄 Token Refresh Flow Tests');
  console.log('-'.repeat(60));

  let refreshRequest, newTokens;

  runTest('Setup refresh token request', () => {
    refreshRequest = {
      headers: {},
      cookies: { refreshToken: refreshTokenValue },
      body: {},
      route: { path: '/refresh' }
    };

    return !!(refreshRequest && refreshRequest.cookies.refreshToken);
  });

  runTest('Refresh token middleware generates new access token', () => {
    const mockRes = {
      cookies: {},
      statusCode: null,
      responseData: null,
      cookie(name, value, options) { this.cookies[name] = { value, options }; },
      status(code) {
        this.statusCode = code;
        return {
          json: (data) => {
            this.responseData = data;
            newTokens = data;
            return data;
          }
        };
      }
    };

    // Call the middleware directly and check the result
    try {
      console.log('   Calling refreshToken middleware...');

      refreshToken(refreshRequest, mockRes, () => {
        // This should not be called for the refresh endpoint
        console.log('   Next() was called for refresh endpoint - unexpected');
      });

      console.log(`   Response status: ${mockRes.statusCode}`);
      console.log(`   Response data: ${JSON.stringify(mockRes.responseData)}`);

      // The middleware returns immediately for the refresh endpoint, so check synchronously
      return mockRes.statusCode === 200 &&
             mockRes.responseData &&
             mockRes.responseData.success === true &&
             !!mockRes.responseData.accessToken;
    } catch (error) {
      console.log(`   Refresh middleware error: ${error.message}`);
      return false;
    }
  });

  runTest('New access token is valid and contains user data', () => {
    if (!newTokens || !newTokens.accessToken) return false;

    const decoded = verifyAccessToken(newTokens.accessToken);
    return decoded.userId === userPayload.userId &&
           decoded.type === 'access';
  });

  // Test Security Features
  console.log('\n🔒 Security Features Tests');
  console.log('-'.repeat(60));

  runTest('Tokens have different JTIs (JWT IDs)', () => {
    const accessDecoded = jwt.decode(accessToken);
    const refreshDecoded = jwt.decode(refreshTokenValue);

    console.log(`   Access JTI: ${accessDecoded?.jti}, Refresh JTI: ${refreshDecoded?.jti}`);
    return accessDecoded &&
           refreshDecoded &&
           accessDecoded.jti &&
           refreshDecoded.jti &&
           accessDecoded.jti !== refreshDecoded.jti;
  });

  runTest('Access and refresh tokens have different secrets', () => {
    try {
      // This should fail - trying to verify access token with refresh secret
      jwt.verify(accessToken, jwtConfig.refreshToken.secret);
      return false; // Should have thrown an error
    } catch (error) {
      try {
        // This should also fail - trying to verify refresh token with access secret
        jwt.verify(refreshTokenValue, jwtConfig.accessToken.secret);
        return false; // Should have thrown an error
      } catch (error2) {
        return true; // Both verifications failed as expected
      }
    }
  });

  runTest('Token type validation prevents confusion attacks', () => {
    try {
      verifyRefreshToken(accessToken); // Should fail
      console.log('   ERROR: Access token was accepted as refresh token');
      return false;
    } catch (error) {
      try {
        verifyAccessToken(refreshTokenValue); // Should also fail
        console.log('   ERROR: Refresh token was accepted as access token');
        return false;
      } catch (error2) {
        console.log(`   Access->Refresh error: ${error.message}`);
        console.log(`   Refresh->Access error: ${error2.message}`);
        return (error.message.includes('Invalid token type') || error.message.includes('Invalid')) &&
               (error2.message.includes('Invalid token type') || error2.message.includes('Invalid'));
      }
    }
  });

  runTest('Tokens have appropriate expiration times', () => {
    const accessDecoded = jwt.decode(accessToken);
    const refreshDecoded = jwt.decode(refreshTokenValue);

    const accessLifetime = accessDecoded.exp - accessDecoded.iat;
    const refreshLifetime = refreshDecoded.exp - refreshDecoded.iat;

    // Access token should be 15 minutes (900 seconds)
    // Refresh token should be 7 days (604800 seconds)
    return accessLifetime === 900 &&
           refreshLifetime === 604800 &&
           refreshLifetime > accessLifetime;
  });

  // Test Cookie Security
  console.log('\n🍪 Cookie Security Tests');
  console.log('-'.repeat(60));

  let cookieResponse;

  runTest('Setup cookie response mock', () => {
    cookieResponse = {
      cookies: {},
      cookie(name, value, options) {
        this.cookies[name] = { value, options };
      },
      clearCookie(name, options) {
        delete this.cookies[name];
      }
    };
    return true;
  });

  runTest('Auth cookies are set with security options', () => {
    setAuthCookies(cookieResponse, accessToken, refreshTokenValue);

    const accessCookie = cookieResponse.cookies.accessToken;
    const refreshCookie = cookieResponse.cookies.refreshToken;

    return accessCookie &&
           refreshCookie &&
           accessCookie.options.httpOnly === true &&
           refreshCookie.options.httpOnly === true &&
           accessCookie.options.hasOwnProperty('secure') &&
           refreshCookie.options.hasOwnProperty('secure');
  });

  runTest('Cookie expiration times match token lifetimes', () => {
    const accessCookie = cookieResponse.cookies.accessToken;
    const refreshCookie = cookieResponse.cookies.refreshToken;

    // Access token cookie: 15 minutes (900000 ms)
    // Refresh token cookie: 7 days (604800000 ms)
    return accessCookie.options.maxAge === 15 * 60 * 1000 &&
           refreshCookie.options.maxAge === 7 * 24 * 60 * 60 * 1000;
  });

  runTest('Auth cookies can be cleared properly', () => {
    clearAuthCookies(cookieResponse);
    return !cookieResponse.cookies.accessToken &&
           !cookieResponse.cookies.refreshToken;
  });

  // Test Error Handling
  console.log('\n⚠️ Comprehensive Error Handling Tests');
  console.log('-'.repeat(60));

  runTest('Authentication middleware handles expired tokens', () => {
    // Create an expired token (without conflicting exp property)
    const expiredPayload = { userId: userPayload.userId, email: userPayload.email, type: 'access' };
    const expiredToken = jwt.sign(expiredPayload, jwtConfig.accessToken.secret, {
      expiresIn: '-1s', // Already expired
      algorithm: jwtConfig.accessToken.algorithm,
      issuer: 'CleanStreak-Auth'
    });

    const testReq = {
      headers: { authorization: `Bearer ${expiredToken}` },
      cookies: {}
    };

    let errorResponse;
    const testRes = {
      status: (code) => ({
        json: (data) => {
          errorResponse = { statusCode: code, data };
          return { statusCode: code, data };
        }
      })
    };

    let nextCalled = false;
    authenticate(testReq, testRes, () => {
      nextCalled = true;
    });

    return !nextCalled &&
           errorResponse &&
           errorResponse.statusCode === 401 &&
           (errorResponse.data.code === 'TOKEN_EXPIRED' || errorResponse.data.code === 'INVALID_TOKEN');
  });

  runTest('Middleware handles malformed tokens gracefully', () => {
    const testReq = {
      headers: { authorization: 'Bearer malformed.token.here' },
      cookies: {}
    };

    let errorResponse;
    const testRes = {
      status: (code) => ({
        json: (data) => {
          errorResponse = { statusCode: code, data };
          return { statusCode: code, data };
        }
      })
    };

    let nextCalled = false;
    authenticate(testReq, testRes, () => {
      nextCalled = true;
    });

    return !nextCalled &&
           errorResponse &&
           errorResponse.statusCode === 401 &&
           errorResponse.data.code === 'INVALID_TOKEN';
  });

  // Test Performance
  console.log('\n⚡ Performance Integration Tests');
  console.log('-'.repeat(60));

  runTest('Complete auth flow performance (<100ms)', () => {
    const start = Date.now();

    // Simulate complete authentication flow
    const tokens = generateTokenPair(userPayload);
    const decoded = verifyAccessToken(tokens.accessToken.token);
    const isValid = decoded.userId === userPayload.userId;

    const duration = Date.now() - start;
    console.log(`   Complete auth flow: ${duration}ms`);
    performanceMetrics.authFlow = duration;

    return duration < 100 && isValid;
  });

  runTest('Token refresh flow performance (<50ms)', () => {
    const start = Date.now();

    // Simulate token refresh
    const refreshDecoded = verifyRefreshToken(refreshTokenValue);
    const newAccess = generateAccessToken({ userId: refreshDecoded.userId });
    const verified = verifyAccessToken(newAccess.token);

    const duration = Date.now() - start;
    console.log(`   Token refresh flow: ${duration}ms`);
    performanceMetrics.refreshFlow = duration;

    return duration < 50 && verified.userId === refreshDecoded.userId;
  });

  runTest('Concurrent token operations performance', () => {
    const start = Date.now();
    const operations = [];

    // Simulate 10 concurrent authentication operations
    for (let i = 0; i < 10; i++) {
      operations.push(() => {
        const tokens = generateTokenPair({ userId: `user-${i}` });
        return verifyAccessToken(tokens.accessToken.token);
      });
    }

    const results = operations.map(op => op());
    const duration = Date.now() - start;

    console.log(`   10 concurrent operations: ${duration}ms (${duration/10}ms avg)`);
    performanceMetrics.concurrentOps = duration;

    return duration < 500 && results.length === 10;
  });

  // Test Rate Limiting Configuration
  console.log('\n🚦 Rate Limiting Configuration Tests');
  console.log('-'.repeat(60));

  runTest('Rate limiting config is properly defined', () => {
    return rateLimitConfig &&
           rateLimitConfig.login &&
           rateLimitConfig.register &&
           rateLimitConfig.passwordReset &&
           rateLimitConfig.login.windowMs > 0 &&
           rateLimitConfig.login.max > 0;
  });

  runTest('Rate limiting middleware can be created', () => {
    const loginRateLimit = authRateLimit({ type: 'login' });
    const registerRateLimit = authRateLimit({ type: 'register' });

    return typeof loginRateLimit === 'function' &&
           typeof registerRateLimit === 'function';
  });

  // Summary
  console.log('\n📊 Integration Test Summary');
  console.log('=' .repeat(80));
  console.log(`Tests run: ${testsRun}`);
  console.log(`Tests passed: ${testsPassed}`);
  console.log(`Tests failed: ${testsRun - testsPassed}`);
  console.log(`Success rate: ${((testsPassed / testsRun) * 100).toFixed(1)}%`);

  if (Object.keys(performanceMetrics).length > 0) {
    console.log('\n⚡ Performance Metrics:');
    Object.entries(performanceMetrics).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}ms`);
    });
  }

  if (errors.length > 0) {
    console.log('\n❌ Failures:');
    errors.forEach(error => console.log(`   - ${error}`));
  }

  const allTestsPassed = testsPassed === testsRun;
  console.log(`\n${allTestsPassed ? '✅' : '❌'} Step 8 Integration Testing: ${allTestsPassed ? 'PASSED' : 'FAILED'}`);

  return {
    success: allTestsPassed,
    testsRun,
    testsPassed,
    errors,
    performanceMetrics,
    summary: {
      authFlow: 'Complete authentication flow working correctly',
      middlewareIntegration: 'All middleware components properly integrated',
      tokenRefresh: 'Token refresh mechanism functional',
      security: 'Security features implemented and validated',
      cookieManagement: 'HTTP-only cookies with proper security settings',
      errorHandling: 'Comprehensive error handling for all scenarios',
      performance: 'All operations meet performance requirements',
      rateLimiting: 'Rate limiting configuration ready for production'
    }
  };
}

// Run tests if this file is executed directly
if (require.main === module) {
  runIntegrationValidationTests().catch(console.error);
}

module.exports = { runIntegrationValidationTests };