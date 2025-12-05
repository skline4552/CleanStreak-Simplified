/**
 * Database Validation Test Suite for Step 4
 * Tests Prisma schema, database connectivity, and performance
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

// Performance tracking
const performanceMetrics = {
  queries: [],
  connectionTime: 0,
  totalTestTime: 0
};

// Track query performance
function trackQuery(operation, startTime) {
  const endTime = Date.now();
  const duration = endTime - startTime;
  performanceMetrics.queries.push({
    operation,
    duration,
    timestamp: new Date().toISOString()
  });
  return duration;
}

async function validateDatabaseSchema() {
  console.log('\n🔍 Step 4 Database Validation Test Suite');
  console.log('==========================================\n');

  const testStartTime = Date.now();
  let prisma;

  try {
    // 1. Test Prisma Client Connection
    console.log('1. Testing Prisma Client Connection...');
    const connectionStart = Date.now();
    prisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
    });

    await prisma.$connect();
    performanceMetrics.connectionTime = trackQuery('Database Connection', connectionStart);
    console.log(`   ✅ Connected to database (${performanceMetrics.connectionTime}ms)`);

    // 2. Test Database Schema
    console.log('\n2. Validating Database Schema...');

    // Test if all models are available
    const models = ['user', 'userStreak', 'completionHistory', 'userSession', 'analytics'];
    for (const model of models) {
      if (!prisma[model]) {
        throw new Error(`Model ${model} not found in Prisma client`);
      }
    }
    console.log('   ✅ All 5 models available in Prisma client');

    // 3. Test CRUD Operations
    console.log('\n3. Testing CRUD Operations...');

    // Create test user
    const createUserStart = Date.now();
    const testUser = await prisma.user.create({
      data: {
        email: 'test@cleanstreak.com',
        password_hash: await bcrypt.hash('testpassword123', 12),
        email_verified: true
      }
    });
    trackQuery('Create User', createUserStart);
    console.log('   ✅ User creation successful');

    // Create test streak
    const createStreakStart = Date.now();
    const testStreak = await prisma.userStreak.create({
      data: {
        user_id: testUser.id,
        task_name: 'Daily Exercise',
        current_streak: 5,
        best_streak: 10,
        last_completed: new Date()
      }
    });
    trackQuery('Create Streak', createStreakStart);
    console.log('   ✅ Streak creation successful');

    // Create completion history
    const createCompletionStart = Date.now();
    const testCompletion = await prisma.completionHistory.create({
      data: {
        user_id: testUser.id,
        task_name: 'Daily Exercise',
        completed_date: new Date(),
        streak_day: 5,
        completion_time: '09:30',
        notes: 'Morning workout completed'
      }
    });
    trackQuery('Create Completion', createCompletionStart);
    console.log('   ✅ Completion history creation successful');

    // Create user session
    const createSessionStart = Date.now();
    const testSession = await prisma.userSession.create({
      data: {
        user_id: testUser.id,
        refresh_token: 'test_refresh_token_' + Date.now(),
        device_info: 'Chrome Browser',
        ip_address: '127.0.0.1',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    });
    trackQuery('Create Session', createSessionStart);
    console.log('   ✅ Session creation successful');

    // Create analytics entry
    const createAnalyticsStart = Date.now();
    const testAnalytics = await prisma.analytics.create({
      data: {
        metric_name: 'daily_completions',
        metric_value: '1',
        metadata: JSON.stringify({ user_id: testUser.id })
      }
    });
    trackQuery('Create Analytics', createAnalyticsStart);
    console.log('   ✅ Analytics creation successful');

    // 4. Test Relationships and Joins
    console.log('\n4. Testing Relationships and Joins...');

    const relationshipStart = Date.now();
    const userWithData = await prisma.user.findUnique({
      where: { id: testUser.id },
      include: {
        streaks: true,
        completions: true,
        sessions: true
      }
    });
    trackQuery('User with Relations', relationshipStart);

    if (!userWithData?.streaks?.length || !userWithData?.completions?.length || !userWithData?.sessions?.length) {
      throw new Error('Relationships not working correctly');
    }
    console.log('   ✅ All relationships working correctly');

    // 5. Test Unique Constraints
    console.log('\n5. Testing Unique Constraints...');

    try {
      await prisma.user.create({
        data: {
          email: 'test@cleanstreak.com', // Duplicate email
          password_hash: 'anotherhash'
        }
      });
      throw new Error('Unique constraint not enforced');
    } catch (error) {
      if (error.code === 'P2002') {
        console.log('   ✅ Email unique constraint working');
      } else {
        throw error;
      }
    }

    try {
      await prisma.userStreak.create({
        data: {
          user_id: testUser.id,
          task_name: 'Daily Exercise', // Duplicate user_id + task_name
          current_streak: 1
        }
      });
      throw new Error('Unique constraint not enforced');
    } catch (error) {
      if (error.code === 'P2002') {
        console.log('   ✅ User-Task unique constraint working');
      } else {
        throw error;
      }
    }

    // 6. Test Cascade Deletion
    console.log('\n6. Testing Cascade Deletion...');

    const deleteStart = Date.now();
    await prisma.user.delete({
      where: { id: testUser.id }
    });
    trackQuery('Cascade Delete', deleteStart);

    // Verify related data was deleted
    const orphanedStreaks = await prisma.userStreak.findMany({
      where: { user_id: testUser.id }
    });
    const orphanedCompletions = await prisma.completionHistory.findMany({
      where: { user_id: testUser.id }
    });
    const orphanedSessions = await prisma.userSession.findMany({
      where: { user_id: testUser.id }
    });

    if (orphanedStreaks.length > 0 || orphanedCompletions.length > 0 || orphanedSessions.length > 0) {
      throw new Error('Cascade deletion not working properly');
    }
    console.log('   ✅ Cascade deletion working correctly');

    // 7. Performance Testing
    console.log('\n7. Performance Testing...');

    // Create multiple users for performance testing
    const users = [];
    for (let i = 0; i < 10; i++) {
      const perfUser = await prisma.user.create({
        data: {
          email: `perftest${i}@cleanstreak.com`,
          password_hash: await bcrypt.hash('testpass', 10)
        }
      });
      users.push(perfUser);
    }

    // Test batch operations
    const batchStart = Date.now();
    const streaks = users.map(user => ({
      user_id: user.id,
      task_name: 'Performance Test',
      current_streak: Math.floor(Math.random() * 30),
      best_streak: Math.floor(Math.random() * 100)
    }));

    await prisma.userStreak.createMany({
      data: streaks
    });
    trackQuery('Batch Create Streaks', batchStart);

    // Test indexed queries
    const indexQueryStart = Date.now();
    const recentCompletions = await prisma.completionHistory.findMany({
      where: {
        completed_date: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      },
      orderBy: {
        completed_date: 'desc'
      },
      take: 100
    });
    trackQuery('Indexed Query', indexQueryStart);

    console.log('   ✅ Performance tests completed');

    // Cleanup performance test data
    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: 'perftest'
        }
      }
    });

    performanceMetrics.totalTestTime = Date.now() - testStartTime;

    // 8. Results Summary
    console.log('\n📊 Performance Results:');
    console.log('======================');
    console.log(`Total test time: ${performanceMetrics.totalTestTime}ms`);
    console.log(`Database connection: ${performanceMetrics.connectionTime}ms`);

    performanceMetrics.queries.forEach(query => {
      console.log(`${query.operation}: ${query.duration}ms`);
    });

    const avgQueryTime = performanceMetrics.queries.reduce((sum, q) => sum + q.duration, 0) / performanceMetrics.queries.length;
    console.log(`Average query time: ${avgQueryTime.toFixed(2)}ms`);

    // Check performance thresholds
    const slowQueries = performanceMetrics.queries.filter(q => q.duration > 100);
    if (slowQueries.length > 0) {
      console.log(`⚠️  ${slowQueries.length} queries exceeded 100ms threshold`);
    } else {
      console.log('✅ All queries under 100ms performance threshold');
    }

    console.log('\n🎉 All database validation tests passed!');
    console.log('=====================================');

    return {
      success: true,
      metrics: performanceMetrics,
      slowQueries: slowQueries.length
    };

  } catch (error) {
    console.error('\n❌ Database validation failed:', error.message);
    console.error('Stack trace:', error.stack);
    return {
      success: false,
      error: error.message,
      metrics: performanceMetrics
    };
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
}

// Security validation
async function validateSecurityPractices() {
  console.log('\n🔒 Security Validation');
  console.log('=====================\n');

  const securityChecks = {
    passwordHashing: false,
    uniqueConstraints: false,
    foreignKeyConstraints: false,
    sessionSecurity: false,
    dataValidation: false
  };

  try {
    const prisma = new PrismaClient();

    // 1. Password hashing validation
    const hashedPassword = await bcrypt.hash('testpassword', 12);
    const isValidHash = hashedPassword.length >= 50 && hashedPassword.startsWith('$2b$12$');
    securityChecks.passwordHashing = isValidHash;
    console.log(`1. Password Hashing: ${isValidHash ? '✅' : '❌'}`);

    // 2. Unique constraints validation
    const schema = await prisma.$queryRaw`PRAGMA index_list('users')`;
    const hasUniqueEmail = schema.some(index => index.name === 'users_email_key' && index.unique == 1);
    securityChecks.uniqueConstraints = hasUniqueEmail;
    console.log(`2. Unique Constraints: ${hasUniqueEmail ? '✅' : '❌'}`);
    if (hasUniqueEmail) {
      console.log('   ✓ Email unique constraint properly configured');
    }

    // 3. Foreign key constraints validation
    const fkInfo = await prisma.$queryRaw`PRAGMA foreign_key_list('user_streaks')`;
    const hasForeignKeys = fkInfo.length > 0;
    securityChecks.foreignKeyConstraints = hasForeignKeys;
    console.log(`3. Foreign Key Constraints: ${hasForeignKeys ? '✅' : '❌'}`);

    // 4. Session security validation
    const sessionFields = await prisma.$queryRaw`PRAGMA table_info('user_sessions')`;
    const hasRefreshToken = sessionFields.some(field => field.name === 'refresh_token');
    const hasExpiresAt = sessionFields.some(field => field.name === 'expires_at');
    securityChecks.sessionSecurity = hasRefreshToken && hasExpiresAt;
    console.log(`4. Session Security: ${securityChecks.sessionSecurity ? '✅' : '❌'}`);

    // 5. Data validation (schema constraints)
    const userFields = await prisma.$queryRaw`PRAGMA table_info('users')`;
    const hasRequiredFields = userFields.some(field => field.name === 'email' && field.notnull == 1) &&
                             userFields.some(field => field.name === 'password_hash' && field.notnull == 1);
    securityChecks.dataValidation = hasRequiredFields;
    console.log(`5. Data Validation: ${hasRequiredFields ? '✅' : '❌'}`);
    if (hasRequiredFields) {
      console.log('   ✓ Required fields (email, password_hash) properly configured as NOT NULL');
    }

    await prisma.$disconnect();

    const passedChecks = Object.values(securityChecks).filter(check => check).length;
    const totalChecks = Object.keys(securityChecks).length;

    console.log(`\nSecurity Score: ${passedChecks}/${totalChecks} checks passed`);

    return {
      success: passedChecks === totalChecks,
      checks: securityChecks,
      score: `${passedChecks}/${totalChecks}`
    };

  } catch (error) {
    console.error('Security validation error:', error.message);
    return {
      success: false,
      error: error.message,
      checks: securityChecks
    };
  }
}

// Run all validations
async function runAllValidations() {
  const dbResults = await validateDatabaseSchema();
  const securityResults = await validateSecurityPractices();

  return {
    database: dbResults,
    security: securityResults,
    overall: dbResults.success && securityResults.success
  };
}

// Export for testing framework
module.exports = {
  validateDatabaseSchema,
  validateSecurityPractices,
  runAllValidations
};

// Run if called directly
if (require.main === module) {
  runAllValidations()
    .then(results => {
      console.log('\n📋 Final Results Summary:');
      console.log('========================');
      console.log(`Database Tests: ${results.database.success ? 'PASS' : 'FAIL'}`);
      console.log(`Security Tests: ${results.security.success ? 'PASS' : 'FAIL'}`);
      console.log(`Overall Status: ${results.overall ? 'PASS' : 'FAIL'}`);

      process.exit(results.overall ? 0 : 1);
    })
    .catch(error => {
      console.error('Validation failed:', error);
      process.exit(1);
    });
}