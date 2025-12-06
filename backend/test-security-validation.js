#!/usr/bin/env node

/**
 * Comprehensive Authentication Security Validation
 * Tests all endpoints, error scenarios, and security measures
 */

const http = require('http');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: []
};

// Helper function to make HTTP requests
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const jsonBody = body ? JSON.parse(body) : {};
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: jsonBody
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Test helper function
async function runTest(testName, testFn) {
  testResults.total++;
  try {
    console.log(`🧪 Testing: ${testName}`);
    const result = await testFn();
    if (result.success) {
      testResults.passed++;
      console.log(`✅ PASS: ${testName}`);
      if (result.message) console.log(`   ${result.message}`);
    } else {
      testResults.failed++;
      console.log(`❌ FAIL: ${testName}`);
      console.log(`   ${result.message}`);
    }
    testResults.details.push({
      name: testName,
      success: result.success,
      message: result.message
    });
  } catch (error) {
    testResults.failed++;
    console.log(`❌ ERROR: ${testName}`);
    console.log(`   ${error.message}`);
    testResults.details.push({
      name: testName,
      success: false,
      message: error.message
    });
  }
}

// Test health endpoints
async function testHealthEndpoints() {
  await runTest('Main Health Endpoint', async () => {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/health',
      method: 'GET'
    });

    return {
      success: response.statusCode === 200 && response.body.status === 'ok',
      message: `Status: ${response.statusCode}, Body: ${JSON.stringify(response.body)}`
    };
  });

  await runTest('Auth Health Endpoint', async () => {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/health',
      method: 'GET'
    });

    return {
      success: response.statusCode === 200 && response.body.service === 'authentication',
      message: `Status: ${response.statusCode}, Service: ${response.body.service}`
    };
  });
}

// Test registration validation
async function testRegistrationValidation() {
  // Test missing fields
  await runTest('Registration - Missing Email', async () => {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      password: 'TestPassword123!',
      confirmPassword: 'TestPassword123!'
    });

    return {
      success: response.statusCode === 400,
      message: `Expected 400, got ${response.statusCode}: ${JSON.stringify(response.body)}`
    };
  });

  // Test password mismatch
  await runTest('Registration - Password Mismatch', async () => {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      email: 'test@mismatch.com',
      password: 'TestPassword123!',
      confirmPassword: 'DifferentPassword123!'
    });

    return {
      success: response.statusCode === 400,
      message: `Expected 400, got ${response.statusCode}: ${JSON.stringify(response.body)}`
    };
  });

  // Test weak password
  await runTest('Registration - Weak Password', async () => {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      email: 'test@weak.com',
      password: '123',
      confirmPassword: '123'
    });

    return {
      success: response.statusCode === 400,
      message: `Expected 400, got ${response.statusCode}: ${JSON.stringify(response.body)}`
    };
  });

  // Test invalid email
  await runTest('Registration - Invalid Email', async () => {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      email: 'not-an-email',
      password: 'TestPassword123!',
      confirmPassword: 'TestPassword123!'
    });

    return {
      success: response.statusCode === 400,
      message: `Expected 400, got ${response.statusCode}: ${JSON.stringify(response.body)}`
    };
  });
}

// Test login validation
async function testLoginValidation() {
  // Test wrong password
  await runTest('Login - Wrong Password', async () => {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      email: 'validatortest@example.com',
      password: 'WrongPassword123!'
    });

    return {
      success: response.statusCode === 401,
      message: `Expected 401, got ${response.statusCode}: ${JSON.stringify(response.body)}`
    };
  });

  // Test non-existent user
  await runTest('Login - Non-existent User', async () => {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      email: 'nonexistent@user.com',
      password: 'TestPassword123!'
    });

    return {
      success: response.statusCode === 401,
      message: `Expected 401, got ${response.statusCode}: ${JSON.stringify(response.body)}`
    };
  });
}

// Test authentication middleware
async function testAuthenticationMiddleware() {
  // Test protected endpoint without token
  await runTest('Protected Endpoint - No Token', async () => {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/me',
      method: 'GET'
    });

    return {
      success: response.statusCode === 401,
      message: `Expected 401, got ${response.statusCode}: ${JSON.stringify(response.body)}`
    };
  });

  // Test protected endpoint with invalid token
  await runTest('Protected Endpoint - Invalid Token', async () => {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/me',
      method: 'GET',
      headers: { 'Cookie': 'accessToken=invalid-token' }
    });

    return {
      success: response.statusCode === 401,
      message: `Expected 401, got ${response.statusCode}: ${JSON.stringify(response.body)}`
    };
  });
}

// Test successful authentication flow
async function testAuthenticationFlow() {
  let cookies = '';

  // Test valid registration
  await runTest('Valid Registration', async () => {
    const testEmail = `sectest${Date.now()}@example.com`;
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      email: testEmail,
      password: 'TestPassword123!',
      confirmPassword: 'TestPassword123!'
    });

    // Extract cookies
    if (response.headers['set-cookie']) {
      cookies = response.headers['set-cookie'].map(cookie => cookie.split(';')[0]).join('; ');
    }

    return {
      success: response.statusCode === 201 && response.body.message === 'User registered successfully',
      message: `Status: ${response.statusCode}, Message: ${response.body.message}`
    };
  });

  // Test accessing protected endpoint with valid token
  await runTest('Protected Endpoint - Valid Token', async () => {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/me',
      method: 'GET',
      headers: { 'Cookie': cookies }
    });

    return {
      success: response.statusCode === 200 && response.body.user,
      message: `Status: ${response.statusCode}, Has user: ${!!response.body.user}`
    };
  });
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Authentication Security Validation Tests');
  console.log('=' * 60);

  await testHealthEndpoints();
  console.log('');

  await testRegistrationValidation();
  console.log('');

  await testLoginValidation();
  console.log('');

  await testAuthenticationMiddleware();
  console.log('');

  await testAuthenticationFlow();
  console.log('');

  // Print summary
  console.log('=' * 60);
  console.log('🏁 Test Results Summary');
  console.log(`✅ Passed: ${testResults.passed}/${testResults.total}`);
  console.log(`❌ Failed: ${testResults.failed}/${testResults.total}`);
  console.log(`📊 Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);

  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.details
      .filter(test => !test.success)
      .forEach(test => console.log(`   - ${test.name}: ${test.message}`));
  }

  return testResults;
}

// Run tests if called directly
if (require.main === module) {
  runAllTests()
    .then(results => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ Test execution failed:', error.message);
      process.exit(1);
    });
}

module.exports = { runAllTests };