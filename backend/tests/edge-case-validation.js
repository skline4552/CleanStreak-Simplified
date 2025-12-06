/**
 * Edge Case and Boundary Condition Validation for Step 4
 * Tests extreme conditions, data limits, and error scenarios
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

async function testEdgeCases() {
  console.log('\n🧪 Step 4 Edge Case & Boundary Validation');
  console.log('==========================================\n');

  const prisma = new PrismaClient();
  let testResults = {
    passed: 0,
    failed: 0,
    tests: []
  };

  function recordTest(name, passed, details = '') {
    testResults.tests.push({ name, passed, details });
    if (passed) {
      testResults.passed++;
      console.log(`   ✅ ${name}`);
    } else {
      testResults.failed++;
      console.log(`   ❌ ${name} - ${details}`);
    }
  }

  try {
    await prisma.$connect();

    // 1. Email Edge Cases
    console.log('1. Email Validation Edge Cases...');

    // Test very long email
    try {
      const longEmail = 'a'.repeat(300) + '@example.com';
      const user = await prisma.user.create({
        data: {
          email: longEmail,
          password_hash: await bcrypt.hash('password', 10)
        }
      });
      recordTest('Very long email (320 chars)', true);
      await prisma.user.delete({ where: { id: user.id } });
    } catch (error) {
      recordTest('Very long email (320 chars)', false, error.message);
    }

    // Test email with special characters
    try {
      const specialEmail = 'test+user.with-special_chars@example-domain.co.uk';
      const user = await prisma.user.create({
        data: {
          email: specialEmail,
          password_hash: await bcrypt.hash('password', 10)
        }
      });
      recordTest('Email with special characters', true);
      await prisma.user.delete({ where: { id: user.id } });
    } catch (error) {
      recordTest('Email with special characters', false, error.message);
    }

    // Test empty email (allowed at database level, but unique constraint still applies)
    try {
      await prisma.user.create({
        data: {
          email: '',
          password_hash: await bcrypt.hash('password', 10)
        }
      });
      recordTest('Empty email accepted (database level)', true, 'Note: Application validation should be added');
      await prisma.user.deleteMany({ where: { email: '' } });
    } catch (error) {
      recordTest('Empty email accepted (database level)', false, error.message);
    }

    // 2. Password Hash Edge Cases
    console.log('\n2. Password Hash Edge Cases...');

    // Test very long password hash
    try {
      const longHash = 'a'.repeat(1000);
      const user = await prisma.user.create({
        data: {
          email: 'test-long-hash@example.com',
          password_hash: longHash
        }
      });
      recordTest('Very long password hash (1000 chars)', true);
      await prisma.user.delete({ where: { id: user.id } });
    } catch (error) {
      recordTest('Very long password hash (1000 chars)', false, error.message);
    }

    // Test empty password hash (allowed at database level)
    try {
      const user = await prisma.user.create({
        data: {
          email: 'test-empty-pass@example.com',
          password_hash: ''
        }
      });
      recordTest('Empty password hash accepted (database level)', true, 'Note: Application validation should be added');
      await prisma.user.delete({ where: { id: user.id } });
    } catch (error) {
      recordTest('Empty password hash accepted (database level)', false, error.message);
    }

    // 3. Task Name Edge Cases
    console.log('\n3. Task Name Edge Cases...');

    const testUser = await prisma.user.create({
      data: {
        email: 'edge-test@example.com',
        password_hash: await bcrypt.hash('password', 10)
      }
    });

    // Test very long task name
    try {
      const longTaskName = 'This is a very long task name that contains multiple words and should test the limits of what can be stored in the task_name field ' + 'x'.repeat(200);
      const streak = await prisma.userStreak.create({
        data: {
          user_id: testUser.id,
          task_name: longTaskName,
          current_streak: 1
        }
      });
      recordTest('Very long task name (300+ chars)', true);
      await prisma.userStreak.delete({ where: { id: streak.id } });
    } catch (error) {
      recordTest('Very long task name (300+ chars)', false, error.message);
    }

    // Test task name with unicode characters
    try {
      const unicodeTaskName = '🏃‍♀️ Daily Running 💪 健身 ランニング 🌟';
      const streak = await prisma.userStreak.create({
        data: {
          user_id: testUser.id,
          task_name: unicodeTaskName,
          current_streak: 1
        }
      });
      recordTest('Unicode task name', true);
      await prisma.userStreak.delete({ where: { id: streak.id } });
    } catch (error) {
      recordTest('Unicode task name', false, error.message);
    }

    // Test empty task name (allowed at database level)
    try {
      const streak = await prisma.userStreak.create({
        data: {
          user_id: testUser.id,
          task_name: '',
          current_streak: 1
        }
      });
      recordTest('Empty task name accepted (database level)', true, 'Note: Application validation should be added');
      await prisma.userStreak.delete({ where: { id: streak.id } });
    } catch (error) {
      recordTest('Empty task name accepted (database level)', false, error.message);
    }

    // 4. Numeric Edge Cases
    console.log('\n4. Numeric Edge Cases...');

    // Test maximum streak values
    try {
      const maxStreak = await prisma.userStreak.create({
        data: {
          user_id: testUser.id,
          task_name: 'Max Streak Test',
          current_streak: 2147483647, // Max 32-bit integer
          best_streak: 2147483647
        }
      });
      recordTest('Maximum streak values (2^31-1)', true);
      await prisma.userStreak.delete({ where: { id: maxStreak.id } });
    } catch (error) {
      recordTest('Maximum streak values (2^31-1)', false, error.message);
    }

    // Test negative streak values (should be handled gracefully)
    try {
      await prisma.userStreak.create({
        data: {
          user_id: testUser.id,
          task_name: 'Negative Streak Test',
          current_streak: -1,
          best_streak: -1
        }
      });
      recordTest('Negative streak values handled', true);
      await prisma.userStreak.deleteMany({
        where: {
          user_id: testUser.id,
          task_name: 'Negative Streak Test'
        }
      });
    } catch (error) {
      recordTest('Negative streak values handled', false, error.message);
    }

    // 5. Date Edge Cases
    console.log('\n5. Date Edge Cases...');

    // Test future date
    try {
      const futureDate = new Date('2099-12-31T23:59:59.999Z');
      const completion = await prisma.completionHistory.create({
        data: {
          user_id: testUser.id,
          task_name: 'Future Date Test',
          completed_date: futureDate,
          streak_day: 1
        }
      });
      recordTest('Future date handling', true);
      await prisma.completionHistory.delete({ where: { id: completion.id } });
    } catch (error) {
      recordTest('Future date handling', false, error.message);
    }

    // Test very old date
    try {
      const oldDate = new Date('1900-01-01T00:00:00.000Z');
      const completion = await prisma.completionHistory.create({
        data: {
          user_id: testUser.id,
          task_name: 'Old Date Test',
          completed_date: oldDate,
          streak_day: 1
        }
      });
      recordTest('Very old date handling', true);
      await prisma.completionHistory.delete({ where: { id: completion.id } });
    } catch (error) {
      recordTest('Very old date handling', false, error.message);
    }

    // 6. Session Edge Cases
    console.log('\n6. Session Edge Cases...');

    // Test very long refresh token
    try {
      const longToken = 'a'.repeat(500);
      const session = await prisma.userSession.create({
        data: {
          user_id: testUser.id,
          refresh_token: longToken,
          expires_at: new Date(Date.now() + 86400000) // 24 hours
        }
      });
      recordTest('Very long refresh token (500 chars)', true);
      await prisma.userSession.delete({ where: { id: session.id } });
    } catch (error) {
      recordTest('Very long refresh token (500 chars)', false, error.message);
    }

    // Test session with past expiry date
    try {
      const pastDate = new Date('2020-01-01T00:00:00.000Z');
      const session = await prisma.userSession.create({
        data: {
          user_id: testUser.id,
          refresh_token: 'expired_token_' + Date.now(),
          expires_at: pastDate
        }
      });
      recordTest('Expired session creation', true);
      await prisma.userSession.delete({ where: { id: session.id } });
    } catch (error) {
      recordTest('Expired session creation', false, error.message);
    }

    // 7. Analytics Edge Cases
    console.log('\n7. Analytics Edge Cases...');

    // Test very long metric value
    try {
      const longValue = JSON.stringify({ data: 'x'.repeat(1000) });
      const analytics = await prisma.analytics.create({
        data: {
          metric_name: 'long_value_test',
          metric_value: longValue
        }
      });
      recordTest('Very long metric value', true);
      await prisma.analytics.delete({ where: { id: analytics.id } });
    } catch (error) {
      recordTest('Very long metric value', false, error.message);
    }

    // Test special characters in metric name
    try {
      const analytics = await prisma.analytics.create({
        data: {
          metric_name: 'test-metric_with.special@chars#123',
          metric_value: 'test_value'
        }
      });
      recordTest('Special characters in metric name', true);
      await prisma.analytics.delete({ where: { id: analytics.id } });
    } catch (error) {
      recordTest('Special characters in metric name', false, error.message);
    }

    // 8. Bulk Operations Edge Cases
    console.log('\n8. Bulk Operations Edge Cases...');

    // Test large batch insert
    try {
      const batchData = [];
      for (let i = 0; i < 1000; i++) {
        batchData.push({
          user_id: testUser.id,
          task_name: `Bulk Test ${i}`,
          completed_date: new Date(Date.now() - i * 86400000), // Spread over 1000 days
          streak_day: i + 1
        });
      }

      await prisma.completionHistory.createMany({
        data: batchData
      });
      recordTest('Large batch insert (1000 records)', true);

      // Cleanup
      await prisma.completionHistory.deleteMany({
        where: {
          user_id: testUser.id,
          task_name: { startsWith: 'Bulk Test' }
        }
      });
    } catch (error) {
      recordTest('Large batch insert (1000 records)', false, error.message);
    }

    // 9. Orphaned Data Scenarios
    console.log('\n9. Orphaned Data Prevention...');

    // Test that orphaned records are prevented by foreign key constraints
    try {
      await prisma.userStreak.create({
        data: {
          user_id: 'non-existent-user-id',
          task_name: 'Orphan Test',
          current_streak: 1
        }
      });
      recordTest('Orphaned streak prevention', false, 'Should have failed');
    } catch (error) {
      recordTest('Orphaned streak prevention', true);
    }

    // Cleanup test user
    await prisma.user.delete({ where: { id: testUser.id } });

    console.log('\n📊 Edge Case Test Results:');
    console.log('==========================');
    console.log(`Total tests: ${testResults.passed + testResults.failed}`);
    console.log(`Passed: ${testResults.passed}`);
    console.log(`Failed: ${testResults.failed}`);
    console.log(`Success rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);

    if (testResults.failed > 0) {
      console.log('\n❌ Failed tests:');
      testResults.tests.filter(t => !t.passed).forEach(test => {
        console.log(`   • ${test.name}: ${test.details}`);
      });
    }

    return {
      success: testResults.failed === 0,
      total: testResults.passed + testResults.failed,
      passed: testResults.passed,
      failed: testResults.failed,
      tests: testResults.tests
    };

  } catch (error) {
    console.error('\n❌ Edge case testing failed:', error.message);
    return {
      success: false,
      error: error.message,
      total: testResults.passed + testResults.failed,
      passed: testResults.passed,
      failed: testResults.failed + 1
    };
  } finally {
    await prisma.$disconnect();
  }
}

// Export for testing framework
module.exports = { testEdgeCases };

// Run if called directly
if (require.main === module) {
  testEdgeCases()
    .then(results => {
      console.log('\n🏁 Edge Case Validation Complete');
      console.log('================================');
      console.log(`Overall Status: ${results.success ? 'PASS' : 'FAIL'}`);
      process.exit(results.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Edge case validation failed:', error);
      process.exit(1);
    });
}