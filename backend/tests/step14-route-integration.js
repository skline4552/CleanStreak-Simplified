/**
 * Step 14 Route Integration Tests
 *
 * Tests error handling integration with actual API routes:
 * - Authentication route errors
 * - Validation errors
 * - Database errors (if applicable)
 * - Rate limiting errors
 * - 404 errors
 */

const request = require('supertest');
const app = require('../src/app');

console.log('='.repeat(80));
console.log('STEP 14 ROUTE INTEGRATION TESTS');
console.log('='.repeat(80));
console.log('');

let testsPassed = 0;
let testsFailed = 0;

async function testRoute(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    testsPassed++;
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   Error: ${error.message}`);
    testsFailed++;
  }
}

// Test 1: 404 Error Handling
console.log('1. Testing 404 Error Handling');
console.log('-'.repeat(80));

(async () => {
  await testRoute('Non-existent route returns 404 with proper error format', async () => {
    const response = await request(app)
      .get('/api/does-not-exist')
      .expect(404);

    if (!response.body.error) throw new Error('Missing error object');
    if (!response.body.error.message) throw new Error('Missing error message');
    if (!response.body.error.type) throw new Error('Missing error type');
    if (response.body.error.type !== 'NOT_FOUND_ERROR') throw new Error('Wrong error type');
    if (!response.body.error.requestId) throw new Error('Missing request ID');
  });

  await testRoute('404 error includes route information', async () => {
    const response = await request(app)
      .post('/api/nonexistent-post-route')
      .expect(404);

    if (!response.body.error.message.includes('POST')) {
      throw new Error('Error message does not include HTTP method');
    }
  });

  console.log('');

  // Test 2: Health Endpoint (should not produce errors)
  console.log('2. Testing Health Endpoint Success');
  console.log('-'.repeat(80));

  await testRoute('Health endpoint returns 200 OK', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);

    if (response.body.status !== 'ok') throw new Error('Health check failed');
  });

  await testRoute('Health endpoint includes request ID', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);

    if (!response.body.requestId) throw new Error('Missing request ID in health response');
  });

  console.log('');

  // Test 3: Authentication Route Errors
  console.log('3. Testing Authentication Route Error Handling');
  console.log('-'.repeat(80));

  await testRoute('Login with missing credentials returns proper error', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({})
      .expect(400);

    if (!response.body.error) throw new Error('Missing error object');
    // Should have validation error
  });

  await testRoute('Login with invalid JSON returns proper error', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('invalid json{')
      .expect(400);

    // Should handle malformed JSON gracefully
  });

  await testRoute('Register with missing fields returns validation error', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com' }) // Missing password
      .expect(400);

    if (!response.body.error) throw new Error('Missing error object');
  });

  await testRoute('Register with invalid email format returns validation error', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'not-an-email',
        password: 'ValidPass123!'
      })
      .expect(400);

    if (!response.body.error) throw new Error('Missing error object');
  });

  console.log('');

  // Test 4: Request ID Consistency
  console.log('4. Testing Request ID Consistency Across Errors');
  console.log('-'.repeat(80));

  await testRoute('Each request gets unique request ID', async () => {
    const response1 = await request(app).get('/api/nonexistent1');
    const response2 = await request(app).get('/api/nonexistent2');
    const response3 = await request(app).get('/api/nonexistent3');

    const id1 = response1.body.error.requestId;
    const id2 = response2.body.error.requestId;
    const id3 = response3.body.error.requestId;

    if (id1 === id2 || id2 === id3 || id1 === id3) {
      throw new Error('Request IDs are not unique');
    }
  });

  await testRoute('Request ID format is consistent', async () => {
    const response = await request(app).get('/api/test-nonexistent');
    const requestId = response.body.error.requestId;

    if (typeof requestId !== 'string') {
      throw new Error('Request ID is not a string');
    }
    if (requestId.length === 0) {
      throw new Error('Request ID is empty');
    }
  });

  console.log('');

  // Test 5: Error Response Format Consistency
  console.log('5. Testing Error Response Format Consistency');
  console.log('-'.repeat(80));

  await testRoute('All errors have consistent structure', async () => {
    const routes = [
      '/api/nonexistent',
      '/api/auth/invalid',
      '/api/user/invalid'
    ];

    for (const route of routes) {
      const response = await request(app).get(route);

      if (!response.body.error) {
        throw new Error(`Missing error object for ${route}`);
      }
      if (!response.body.error.message) {
        throw new Error(`Missing error message for ${route}`);
      }
      if (!response.body.error.type) {
        throw new Error(`Missing error type for ${route}`);
      }
      if (!response.body.error.timestamp) {
        throw new Error(`Missing timestamp for ${route}`);
      }
      if (!response.body.error.requestId) {
        throw new Error(`Missing request ID for ${route}`);
      }
    }
  });

  await testRoute('Error timestamps are valid ISO 8601 format', async () => {
    const response = await request(app).get('/api/nonexistent');
    const timestamp = response.body.error.timestamp;

    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid timestamp format');
    }

    // Should be recent (within last minute)
    const now = Date.now();
    const errorTime = date.getTime();
    if (Math.abs(now - errorTime) > 60000) {
      throw new Error('Timestamp is not current');
    }
  });

  console.log('');

  // Test 6: Concurrent Request Handling
  console.log('6. Testing Concurrent Request Error Handling');
  console.log('-'.repeat(80));

  await testRoute('Error handler handles concurrent requests correctly', async () => {
    const requests = [];
    for (let i = 0; i < 50; i++) {
      requests.push(request(app).get(`/api/concurrent-test-${i}`));
    }

    const responses = await Promise.all(requests);

    // All should return 404
    for (const response of responses) {
      if (response.status !== 404) {
        throw new Error(`Expected 404, got ${response.status}`);
      }
      if (!response.body.error) {
        throw new Error('Missing error object in concurrent request');
      }
    }

    // All request IDs should be unique
    const requestIds = responses.map(r => r.body.error.requestId);
    const uniqueIds = new Set(requestIds);
    if (uniqueIds.size !== 50) {
      throw new Error(`Request ID collision: ${uniqueIds.size}/50 unique`);
    }
  });

  await testRoute('Performance: Error handling under load completes within reasonable time', async () => {
    const startTime = Date.now();

    const requests = [];
    for (let i = 0; i < 100; i++) {
      requests.push(request(app).get(`/api/load-test-${i}`));
    }

    await Promise.all(requests);

    const duration = Date.now() - startTime;
    if (duration > 15000) { // 15 seconds for 100 requests
      throw new Error(`Too slow: ${duration}ms for 100 requests`);
    }
  });

  console.log('');

  // Test 7: HTTP Method Handling
  console.log('7. Testing Error Handling Across HTTP Methods');
  console.log('-'.repeat(80));

  await testRoute('GET request 404 handled correctly', async () => {
    await request(app).get('/api/test-get').expect(404);
  });

  await testRoute('POST request 404 handled correctly', async () => {
    await request(app).post('/api/test-post').expect(404);
  });

  await testRoute('PUT request 404 handled correctly', async () => {
    await request(app).put('/api/test-put').expect(404);
  });

  await testRoute('DELETE request 404 handled correctly', async () => {
    await request(app).delete('/api/test-delete').expect(404);
  });

  await testRoute('PATCH request 404 handled correctly', async () => {
    await request(app).patch('/api/test-patch').expect(404);
  });

  console.log('');

  // Test 8: Special Characters in Routes
  console.log('8. Testing Error Handling with Special Characters');
  console.log('-'.repeat(80));

  await testRoute('Route with spaces handled correctly', async () => {
    const response = await request(app)
      .get('/api/test%20with%20spaces')
      .expect(404);

    if (!response.body.error) throw new Error('Missing error object');
  });

  await testRoute('Route with special characters handled correctly', async () => {
    const response = await request(app)
      .get('/api/test-special-!@#$%')
      .expect(404);

    if (!response.body.error) throw new Error('Missing error object');
  });

  await testRoute('Route with unicode characters handled correctly', async () => {
    const response = await request(app)
      .get('/api/test-🔥-emoji')
      .expect(404);

    if (!response.body.error) throw new Error('Missing error object');
  });

  console.log('');

  // Summary
  console.log('='.repeat(80));
  console.log('ROUTE INTEGRATION TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Tests Passed: ${testsPassed}`);
  console.log(`❌ Tests Failed: ${testsFailed}`);
  console.log(`📊 Total Tests: ${testsPassed + testsFailed}`);
  console.log(`📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
  console.log('');

  if (testsFailed === 0) {
    console.log('🎉 All route integration tests passed!');
    console.log('');
    console.log('Validated:');
    console.log('✅ 404 error handling across all HTTP methods');
    console.log('✅ Authentication route error responses');
    console.log('✅ Request ID uniqueness and consistency');
    console.log('✅ Error response format consistency');
    console.log('✅ Concurrent request handling');
    console.log('✅ Performance under load');
    console.log('✅ Special character handling in routes');
    console.log('');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed - review required');
    process.exit(1);
  }
})();