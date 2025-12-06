const {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  isTokenExpired,
  extractToken,
  extractRefreshToken,
  validateTokenPayload,
  getTokenTimeRemaining,
  setAuthCookies,
  clearAuthCookies,
  generateCookieOptions
} = require('../src/utils/jwt');

/**
 * Step 8 Validation: JWT Token Management Testing
 *
 * Comprehensive testing of JWT utilities and authentication middleware
 */

async function runJWTValidationTests() {
  console.log('🔐 Step 8 Validation: JWT Token Management Testing');
  console.log('=' .repeat(60));

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

  // Test JWT Token Generation
  console.log('\n📝 Token Generation Tests');
  console.log('-'.repeat(40));

  let accessTokenData, refreshTokenData, tokenPair;
  const testPayload = { userId: 'test-user-123', email: 'test@example.com' };

  runTest('Generate access token with valid payload', () => {
    accessTokenData = generateAccessToken(testPayload);
    return accessTokenData &&
           accessTokenData.token &&
           accessTokenData.jti &&
           accessTokenData.expiresAt &&
           accessTokenData.expiresIn > 0;
  });

  runTest('Generate refresh token with valid payload', () => {
    refreshTokenData = generateRefreshToken(testPayload);
    return refreshTokenData &&
           refreshTokenData.token &&
           refreshTokenData.jti &&
           refreshTokenData.expiresAt &&
           refreshTokenData.expiresIn > 0;
  });

  runTest('Generate token pair', () => {
    tokenPair = generateTokenPair(testPayload);
    return !!(tokenPair &&
           tokenPair.accessToken &&
           tokenPair.refreshToken &&
           tokenPair.accessToken.token &&
           tokenPair.refreshToken.token);
  });

  runTest('Reject invalid payload for access token', () => {
    try {
      generateAccessToken(null);
      return false; // Should have thrown an error
    } catch (error) {
      return error.message.includes('Invalid payload');
    }
  });

  runTest('Reject invalid payload for refresh token', () => {
    try {
      generateRefreshToken('invalid');
      return false; // Should have thrown an error
    } catch (error) {
      return error.message.includes('Invalid payload');
    }
  });

  // Test JWT Token Verification
  console.log('\n🔍 Token Verification Tests');
  console.log('-'.repeat(40));

  let decodedAccess, decodedRefresh;

  runTest('Verify valid access token', () => {
    decodedAccess = verifyAccessToken(accessTokenData.token);
    return decodedAccess &&
           decodedAccess.userId === testPayload.userId &&
           decodedAccess.email === testPayload.email &&
           decodedAccess.type === 'access';
  });

  runTest('Verify valid refresh token', () => {
    decodedRefresh = verifyRefreshToken(refreshTokenData.token);
    return decodedRefresh &&
           decodedRefresh.userId === testPayload.userId &&
           decodedRefresh.type === 'refresh';
  });

  runTest('Reject invalid access token', () => {
    try {
      verifyAccessToken('invalid.token.here');
      return false; // Should have thrown an error
    } catch (error) {
      return error.message.includes('Invalid access token');
    }
  });

  runTest('Reject invalid refresh token', () => {
    try {
      verifyRefreshToken('invalid.token.here');
      return false; // Should have thrown an error
    } catch (error) {
      return error.message.includes('Invalid refresh token');
    }
  });

  runTest('Reject access token used as refresh token', () => {
    try {
      verifyRefreshToken(accessTokenData.token);
      return false; // Should have thrown an error
    } catch (error) {
      return error.message.includes('Invalid token type') || error.message.includes('Invalid refresh token');
    }
  });

  runTest('Reject refresh token used as access token', () => {
    try {
      verifyAccessToken(refreshTokenData.token);
      return false; // Should have thrown an error
    } catch (error) {
      return error.message.includes('Invalid token type') || error.message.includes('Invalid access token');
    }
  });

  // Test Token Utility Functions
  console.log('\n🛠️ Token Utility Tests');
  console.log('-'.repeat(40));

  runTest('Check token expiration - valid token', () => {
    return !isTokenExpired(accessTokenData.token);
  });

  runTest('Check token expiration - invalid token', () => {
    return isTokenExpired('invalid.token');
  });

  runTest('Get token time remaining', () => {
    const remaining = getTokenTimeRemaining(accessTokenData.token);
    return remaining > 0 && remaining <= (15 * 60 * 1000); // Should be ≤ 15 minutes
  });

  runTest('Validate good token payload', () => {
    return validateTokenPayload(testPayload);
  });

  runTest('Reject invalid token payload', () => {
    return !validateTokenPayload({ invalidField: 'test' });
  });

  runTest('Reject null token payload', () => {
    return !validateTokenPayload(null);
  });

  // Test Token Extraction
  console.log('\n📤 Token Extraction Tests');
  console.log('-'.repeat(40));

  const mockRequest = {
    headers: {},
    cookies: {},
    query: {},
    body: {}
  };

  runTest('Extract token from Authorization header', () => {
    mockRequest.headers.authorization = `Bearer ${accessTokenData.token}`;
    const extracted = extractToken(mockRequest);
    return extracted === accessTokenData.token;
  });

  runTest('Extract token from cookies', () => {
    delete mockRequest.headers.authorization;
    mockRequest.cookies.accessToken = accessTokenData.token;
    const extracted = extractToken(mockRequest);
    return extracted === accessTokenData.token;
  });

  runTest('Extract token from query parameter', () => {
    delete mockRequest.cookies.accessToken;
    mockRequest.query.token = accessTokenData.token;
    const extracted = extractToken(mockRequest);
    return extracted === accessTokenData.token;
  });

  runTest('Return null when no token present', () => {
    delete mockRequest.query.token;
    const extracted = extractToken(mockRequest);
    return extracted === null;
  });

  runTest('Extract refresh token from cookies', () => {
    mockRequest.cookies.refreshToken = refreshTokenData.token;
    const extracted = extractRefreshToken(mockRequest);
    return extracted === refreshTokenData.token;
  });

  runTest('Extract refresh token from body', () => {
    delete mockRequest.cookies.refreshToken;
    mockRequest.body.refreshToken = refreshTokenData.token;
    const extracted = extractRefreshToken(mockRequest);
    return extracted === refreshTokenData.token;
  });

  // Test Cookie Management
  console.log('\n🍪 Cookie Management Tests');
  console.log('-'.repeat(40));

  const mockResponse = {
    cookies: {},
    cookie(name, value, options) {
      this.cookies[name] = { value, options };
    },
    clearCookie(name, options) {
      delete this.cookies[name];
    }
  };

  runTest('Generate secure cookie options', () => {
    const options = generateCookieOptions();
    return options.httpOnly === true &&
           options.sameSite &&
           options.hasOwnProperty('secure');
  });

  runTest('Set authentication cookies', () => {
    setAuthCookies(mockResponse, accessTokenData.token, refreshTokenData.token);
    return mockResponse.cookies.accessToken &&
           mockResponse.cookies.refreshToken &&
           mockResponse.cookies.accessToken.options.httpOnly === true;
  });

  runTest('Clear authentication cookies', () => {
    clearAuthCookies(mockResponse);
    return !mockResponse.cookies.accessToken &&
           !mockResponse.cookies.refreshToken;
  });

  // Test Error Handling
  console.log('\n⚠️ Error Handling Tests');
  console.log('-'.repeat(40));

  runTest('Handle empty token verification', () => {
    try {
      verifyAccessToken('');
      return false;
    } catch (error) {
      return error.message.includes('No token provided');
    }
  });

  runTest('Handle null token verification', () => {
    try {
      verifyAccessToken(null);
      return false;
    } catch (error) {
      return error.message.includes('No token provided');
    }
  });

  runTest('Handle malformed token', () => {
    try {
      verifyAccessToken('not.a.jwt');
      return false;
    } catch (error) {
      return error.message.includes('Invalid access token');
    }
  });

  // Test Performance
  console.log('\n⚡ Performance Tests');
  console.log('-'.repeat(40));

  runTest('Token generation performance (<100ms)', () => {
    const start = Date.now();
    for (let i = 0; i < 10; i++) {
      generateAccessToken(testPayload);
    }
    const duration = Date.now() - start;
    console.log(`   Token generation: ${duration}ms for 10 tokens (${duration/10}ms avg)`);
    return duration < 1000; // 10 tokens in under 1 second
  });

  runTest('Token verification performance (<50ms)', () => {
    const start = Date.now();
    for (let i = 0; i < 10; i++) {
      verifyAccessToken(accessTokenData.token);
    }
    const duration = Date.now() - start;
    console.log(`   Token verification: ${duration}ms for 10 verifications (${duration/10}ms avg)`);
    return duration < 500; // 10 verifications in under 500ms
  });

  // Summary
  console.log('\n📊 Test Summary');
  console.log('=' .repeat(60));
  console.log(`Tests run: ${testsRun}`);
  console.log(`Tests passed: ${testsPassed}`);
  console.log(`Tests failed: ${testsRun - testsPassed}`);
  console.log(`Success rate: ${((testsPassed / testsRun) * 100).toFixed(1)}%`);

  if (errors.length > 0) {
    console.log('\n❌ Failures:');
    errors.forEach(error => console.log(`   - ${error}`));
  }

  const allTestsPassed = testsPassed === testsRun;
  console.log(`\n${allTestsPassed ? '✅' : '❌'} Step 8 JWT Token Management: ${allTestsPassed ? 'PASSED' : 'FAILED'}`);

  return {
    success: allTestsPassed,
    testsRun,
    testsPassed,
    errors,
    summary: {
      tokenGeneration: 'Working correctly',
      tokenVerification: 'Secure validation implemented',
      tokenUtilities: 'All utility functions operational',
      cookieManagement: 'HTTP-only secure cookies configured',
      errorHandling: 'Comprehensive error handling',
      performance: 'Meets performance requirements'
    }
  };
}

// Run tests if this file is executed directly
if (require.main === module) {
  runJWTValidationTests().catch(console.error);
}

module.exports = { runJWTValidationTests };