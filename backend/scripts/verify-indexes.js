#!/usr/bin/env node

/**
 * Database Index Verification Script for CleanStreak Authentication System
 *
 * This script verifies optimal indexing strategy by:
 * - Checking all required indexes exist
 * - Analyzing index performance and usage
 * - Providing optimization recommendations
 * - Testing query performance with indexes
 *
 * Usage:
 *   node scripts/verify-indexes.js [--detailed] [--performance]
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load environment configuration
require('dotenv').config();
const config = require('../src/config/environment');
const { prismaWrapper } = require('../src/config/prisma');

class IndexVerifier {
  constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.projectRoot = path.resolve(__dirname, '..');
    this.detailedMode = process.argv.includes('--detailed');
    this.performanceMode = process.argv.includes('--performance');

    // Expected indexes based on the plan requirements
    this.expectedIndexes = {
      users: [
        { name: 'users_email_key', type: 'UNIQUE', columns: ['email'] },
        { name: 'users_email_idx', type: 'INDEX', columns: ['email'] },
        { name: 'users_created_at_idx', type: 'INDEX', columns: ['created_at'] },
        { name: 'users_last_login_idx', type: 'INDEX', columns: ['last_login'] }
      ],
      user_streaks: [
        { name: 'user_streaks_user_id_task_name_key', type: 'UNIQUE', columns: ['user_id', 'task_name'] },
        { name: 'user_streaks_user_id_idx', type: 'INDEX', columns: ['user_id'] },
        { name: 'user_streaks_task_name_idx', type: 'INDEX', columns: ['task_name'] },
        { name: 'user_streaks_last_completed_idx', type: 'INDEX', columns: ['last_completed'] }
      ],
      completion_history: [
        { name: 'completion_history_user_id_completed_date_idx', type: 'INDEX', columns: ['user_id', 'completed_date'] },
        { name: 'completion_history_completed_date_idx', type: 'INDEX', columns: ['completed_date'] },
        { name: 'completion_history_user_id_task_name_idx', type: 'INDEX', columns: ['user_id', 'task_name'] },
        { name: 'completion_history_task_name_idx', type: 'INDEX', columns: ['task_name'] }
      ],
      user_sessions: [
        { name: 'user_sessions_refresh_token_key', type: 'UNIQUE', columns: ['refresh_token'] },
        { name: 'user_sessions_user_id_idx', type: 'INDEX', columns: ['user_id'] },
        { name: 'user_sessions_refresh_token_idx', type: 'INDEX', columns: ['refresh_token'] },
        { name: 'user_sessions_expires_at_idx', type: 'INDEX', columns: ['expires_at'] },
        { name: 'user_sessions_is_active_idx', type: 'INDEX', columns: ['is_active'] }
      ],
      analytics: [
        { name: 'analytics_metric_name_date_idx', type: 'INDEX', columns: ['metric_name', 'date'] },
        { name: 'analytics_date_idx', type: 'INDEX', columns: ['date'] }
      ]
    };
  }

  /**
   * Main verification execution method
   */
  async execute() {
    console.log('🔍 Starting database index verification...');
    console.log(`Environment: ${this.environment}`);
    console.log(`Database URL: ${this.maskDatabaseUrl(config.DATABASE_URL)}`);
    console.log(`Detailed mode: ${this.detailedMode ? 'ON' : 'OFF'}`);
    console.log(`Performance testing: ${this.performanceMode ? 'ON' : 'OFF'}`);
    console.log('─'.repeat(60));

    try {
      // Step 1: Test database connection
      await this.testDatabaseConnection();

      // Step 2: Detect database provider
      const dbProvider = await this.detectDatabaseProvider();

      // Step 3: Verify index existence
      const indexResults = await this.verifyIndexes(dbProvider);

      // Step 4: Analyze index performance (if requested)
      let performanceResults = null;
      if (this.performanceMode) {
        performanceResults = await this.analyzeIndexPerformance(dbProvider);
      }

      // Step 5: Generate optimization recommendations
      const recommendations = await this.generateRecommendations(indexResults, performanceResults);

      // Step 6: Display results
      this.displayResults(indexResults, performanceResults, recommendations);

      console.log('✅ Index verification completed successfully!');
      console.log('─'.repeat(60));

      return {
        success: true,
        results: indexResults,
        performance: performanceResults,
        recommendations
      };

    } catch (error) {
      console.error('❌ Index verification failed:');
      console.error(error.message);
      console.log('─'.repeat(60));

      return { success: false, error: error.message };
    } finally {
      // Always disconnect from database
      await this.cleanup();
    }
  }

  /**
   * Test database connection
   */
  async testDatabaseConnection() {
    console.log('🔗 Testing database connection...');

    const connectionResult = await prismaWrapper.testConnection();

    if (!connectionResult.success) {
      throw new Error(`Database connection failed: ${connectionResult.error}`);
    }

    console.log('✓ Database connection successful');
  }

  /**
   * Detect database provider (SQLite vs PostgreSQL)
   */
  async detectDatabaseProvider() {
    console.log('🔍 Detecting database provider...');

    const prisma = prismaWrapper.getClient();

    try {
      // Try PostgreSQL-specific query
      await prisma.$queryRaw`SELECT version()`;
      console.log('✓ PostgreSQL database detected');
      return 'postgresql';
    } catch (error) {
      try {
        // Try SQLite-specific query
        await prisma.$queryRaw`SELECT sqlite_version()`;
        console.log('✓ SQLite database detected');
        return 'sqlite';
      } catch (sqliteError) {
        throw new Error('Could not detect database provider');
      }
    }
  }

  /**
   * Verify all expected indexes exist
   */
  async verifyIndexes(dbProvider) {
    console.log('📊 Verifying database indexes...');

    const prisma = prismaWrapper.getClient();
    const results = {
      provider: dbProvider,
      tables: {},
      summary: {
        total: 0,
        found: 0,
        missing: 0,
        unexpected: 0
      }
    };

    for (const [tableName, expectedIndexes] of Object.entries(this.expectedIndexes)) {
      console.log(`\n📋 Checking indexes for table: ${tableName}`);

      const actualIndexes = await this.getTableIndexes(prisma, tableName, dbProvider);

      results.tables[tableName] = {
        expected: expectedIndexes,
        actual: actualIndexes,
        status: {
          found: [],
          missing: [],
          unexpected: []
        }
      };

      // Check each expected index
      for (const expectedIndex of expectedIndexes) {
        results.summary.total++;

        const foundIndex = actualIndexes.find(idx =>
          idx.name === expectedIndex.name ||
          this.compareIndexColumns(idx.columns, expectedIndex.columns)
        );

        if (foundIndex) {
          results.summary.found++;
          results.tables[tableName].status.found.push(expectedIndex);
          console.log(`  ✓ ${expectedIndex.name} (${expectedIndex.type})`);
        } else {
          results.summary.missing++;
          results.tables[tableName].status.missing.push(expectedIndex);
          console.log(`  ❌ ${expectedIndex.name} (${expectedIndex.type}) - MISSING`);
        }
      }

      // Check for unexpected indexes
      for (const actualIndex of actualIndexes) {
        const isExpected = expectedIndexes.some(expected =>
          expected.name === actualIndex.name ||
          this.compareIndexColumns(expected.columns, actualIndex.columns)
        );

        if (!isExpected) {
          results.summary.unexpected++;
          results.tables[tableName].status.unexpected.push(actualIndex);
          console.log(`  ⚠️  ${actualIndex.name} - UNEXPECTED`);
        }
      }
    }

    return results;
  }

  /**
   * Get indexes for a specific table
   */
  async getTableIndexes(prisma, tableName, dbProvider) {
    try {
      if (dbProvider === 'postgresql') {
        // PostgreSQL index query
        const indexes = await prisma.$queryRaw`
          SELECT
            indexname as name,
            indexdef as definition,
            tablename
          FROM pg_indexes
          WHERE tablename = ${tableName}
          ORDER BY indexname
        `;

        return indexes.map(idx => ({
          name: idx.name,
          definition: idx.definition,
          columns: this.parsePostgreSQLIndexColumns(idx.definition),
          type: idx.definition.includes('UNIQUE') ? 'UNIQUE' : 'INDEX'
        }));

      } else {
        // SQLite index query
        const indexes = await prisma.$queryRaw`
          SELECT name, sql
          FROM sqlite_master
          WHERE type = 'index'
          AND tbl_name = ${tableName}
          AND name NOT LIKE 'sqlite_autoindex_%'
          ORDER BY name
        `;

        return indexes.map(idx => ({
          name: idx.name,
          definition: idx.sql || '',
          columns: this.parseSQLiteIndexColumns(idx.sql || ''),
          type: (idx.sql || '').includes('UNIQUE') ? 'UNIQUE' : 'INDEX'
        }));
      }
    } catch (error) {
      console.warn(`Warning: Could not get indexes for table ${tableName}:`, error.message);
      return [];
    }
  }

  /**
   * Parse index columns from PostgreSQL index definition
   */
  parsePostgreSQLIndexColumns(definition) {
    const match = definition.match(/\(([^)]+)\)/);
    if (match) {
      return match[1].split(',').map(col => col.trim().replace(/"/g, ''));
    }
    return [];
  }

  /**
   * Parse index columns from SQLite index definition
   */
  parseSQLiteIndexColumns(definition) {
    if (!definition) return [];

    const match = definition.match(/\(([^)]+)\)/);
    if (match) {
      return match[1].split(',').map(col => col.trim().replace(/"/g, ''));
    }
    return [];
  }

  /**
   * Compare index columns arrays
   */
  compareIndexColumns(cols1, cols2) {
    if (!cols1 || !cols2 || cols1.length !== cols2.length) return false;
    return cols1.sort().join(',') === cols2.sort().join(',');
  }

  /**
   * Analyze index performance with sample queries
   */
  async analyzeIndexPerformance(dbProvider) {
    console.log('\n🚀 Analyzing index performance...');

    const prisma = prismaWrapper.getClient();
    const performanceTests = [];

    // Create some test data if none exists
    await this.ensureTestData(prisma);

    const testQueries = [
      {
        name: 'User lookup by email',
        query: 'SELECT * FROM users WHERE email = ?',
        expectedIndex: 'users_email_idx'
      },
      {
        name: 'User streaks by user_id',
        query: 'SELECT * FROM user_streaks WHERE user_id = ?',
        expectedIndex: 'user_streaks_user_id_idx'
      },
      {
        name: 'Completion history by user and date range',
        query: 'SELECT * FROM completion_history WHERE user_id = ? AND completed_date >= ?',
        expectedIndex: 'completion_history_user_id_completed_date_idx'
      },
      {
        name: 'Analytics by date range',
        query: 'SELECT * FROM analytics WHERE date >= ? AND date <= ?',
        expectedIndex: 'analytics_date_idx'
      }
    ];

    for (const test of testQueries) {
      try {
        console.log(`  Testing: ${test.name}`);

        const startTime = Date.now();

        // Execute query multiple times and average the results
        const iterations = 10;
        let totalTime = 0;

        for (let i = 0; i < iterations; i++) {
          const iterationStart = Date.now();
          await this.executeTestQuery(prisma, test.query, dbProvider);
          totalTime += Date.now() - iterationStart;
        }

        const avgTime = totalTime / iterations;
        const result = {
          name: test.name,
          averageTime: avgTime,
          expectedIndex: test.expectedIndex,
          status: avgTime < 10 ? 'EXCELLENT' : avgTime < 50 ? 'GOOD' : avgTime < 100 ? 'ACCEPTABLE' : 'SLOW'
        };

        performanceTests.push(result);
        console.log(`    Average time: ${avgTime.toFixed(2)}ms (${result.status})`);

      } catch (error) {
        console.warn(`    Warning: ${test.name} failed:`, error.message);
        performanceTests.push({
          name: test.name,
          error: error.message,
          status: 'ERROR'
        });
      }
    }

    return performanceTests;
  }

  /**
   * Execute test query with appropriate parameters
   */
  async executeTestQuery(prisma, query, dbProvider) {
    // Generate test parameters based on query
    const testParams = this.generateTestParams(query);

    if (dbProvider === 'postgresql') {
      // PostgreSQL uses $1, $2, etc.
      const pgQuery = query.replace(/\?/g, (match, offset, string) => {
        const paramIndex = string.substring(0, offset).split('?').length;
        return `$${paramIndex}`;
      });
      await prisma.$queryRawUnsafe(pgQuery, ...testParams);
    } else {
      // SQLite uses ?
      await prisma.$queryRawUnsafe(query, ...testParams);
    }
  }

  /**
   * Generate test parameters for queries
   */
  generateTestParams(query) {
    const paramCount = (query.match(/\?/g) || []).length;
    const params = [];

    for (let i = 0; i < paramCount; i++) {
      if (query.includes('email')) {
        params.push('test@example.com');
      } else if (query.includes('user_id')) {
        params.push('test_user_id');
      } else if (query.includes('date')) {
        params.push(new Date());
      } else {
        params.push('test_value');
      }
    }

    return params;
  }

  /**
   * Ensure test data exists for performance testing
   */
  async ensureTestData(prisma) {
    try {
      const userCount = await prisma.user.count();
      if (userCount === 0) {
        console.log('  Creating minimal test data for performance testing...');

        // Create a test user
        await prisma.user.create({
          data: {
            email: 'test@example.com',
            password_hash: 'test_hash'
          }
        });

        console.log('  ✓ Test data created');
      }
    } catch (error) {
      console.warn('  Warning: Could not create test data:', error.message);
    }
  }

  /**
   * Generate optimization recommendations
   */
  async generateRecommendations(indexResults, performanceResults) {
    const recommendations = [];

    // Check for missing critical indexes
    if (indexResults.summary.missing > 0) {
      recommendations.push({
        type: 'CRITICAL',
        title: 'Missing Required Indexes',
        description: `${indexResults.summary.missing} required indexes are missing. This will severely impact query performance.`,
        action: 'Run database migration to create missing indexes'
      });
    }

    // Check for performance issues
    if (performanceResults) {
      const slowQueries = performanceResults.filter(test => test.status === 'SLOW');
      if (slowQueries.length > 0) {
        recommendations.push({
          type: 'WARNING',
          title: 'Slow Query Performance',
          description: `${slowQueries.length} queries are performing slowly (>100ms). Consider index optimization.`,
          action: 'Review and optimize indexes for slow queries'
        });
      }
    }

    // Check for unexpected indexes
    if (indexResults.summary.unexpected > 0) {
      recommendations.push({
        type: 'INFO',
        title: 'Unexpected Indexes Found',
        description: `${indexResults.summary.unexpected} unexpected indexes found. Review if they are needed.`,
        action: 'Review unexpected indexes and remove if unnecessary'
      });
    }

    // Overall health assessment
    const healthScore = indexResults.summary.total > 0 ?
      (indexResults.summary.found / indexResults.summary.total) * 100 : 0;

    if (healthScore === 100) {
      recommendations.push({
        type: 'SUCCESS',
        title: 'Excellent Index Health',
        description: 'All required indexes are present and properly configured.',
        action: 'Continue monitoring performance in production'
      });
    }

    return { recommendations, healthScore };
  }

  /**
   * Display verification results
   */
  displayResults(indexResults, performanceResults, recommendations) {
    console.log('\n📊 INDEX VERIFICATION RESULTS');
    console.log('═'.repeat(60));

    // Summary
    console.log('\n📈 SUMMARY:');
    console.log(`Database Provider: ${indexResults.provider.toUpperCase()}`);
    console.log(`Total Expected Indexes: ${indexResults.summary.total}`);
    console.log(`Found: ${indexResults.summary.found} ✓`);
    console.log(`Missing: ${indexResults.summary.missing} ${indexResults.summary.missing > 0 ? '❌' : '✓'}`);
    console.log(`Unexpected: ${indexResults.summary.unexpected} ${indexResults.summary.unexpected > 0 ? '⚠️' : '✓'}`);

    // Performance results
    if (performanceResults) {
      console.log('\n🚀 PERFORMANCE ANALYSIS:');
      performanceResults.forEach(test => {
        const statusIcon = {
          'EXCELLENT': '🟢',
          'GOOD': '🔵',
          'ACCEPTABLE': '🟡',
          'SLOW': '🔴',
          'ERROR': '❌'
        }[test.status] || '❓';

        console.log(`${statusIcon} ${test.name}: ${test.averageTime ? test.averageTime.toFixed(2) + 'ms' : test.error}`);
      });
    }

    // Recommendations
    if (recommendations.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      recommendations.recommendations.forEach((rec, index) => {
        const typeIcon = {
          'CRITICAL': '🚨',
          'WARNING': '⚠️',
          'INFO': 'ℹ️',
          'SUCCESS': '✅'
        }[rec.type] || '📋';

        console.log(`${typeIcon} ${rec.title}`);
        console.log(`   ${rec.description}`);
        console.log(`   Action: ${rec.action}`);
        if (index < recommendations.recommendations.length - 1) console.log('');
      });

      console.log(`\n🏥 Overall Health Score: ${recommendations.healthScore.toFixed(1)}%`);
    }

    // Detailed mode output
    if (this.detailedMode) {
      console.log('\n🔍 DETAILED INDEX INFORMATION:');
      for (const [tableName, tableData] of Object.entries(indexResults.tables)) {
        console.log(`\n📋 Table: ${tableName}`);

        console.log('  Expected indexes:');
        tableData.expected.forEach(idx => {
          const status = tableData.status.found.includes(idx) ? '✓' : '❌';
          console.log(`    ${status} ${idx.name} (${idx.type}) on [${idx.columns.join(', ')}]`);
        });

        if (tableData.status.unexpected.length > 0) {
          console.log('  Unexpected indexes:');
          tableData.status.unexpected.forEach(idx => {
            console.log(`    ⚠️  ${idx.name} on [${idx.columns.join(', ')}]`);
          });
        }
      }
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      await prismaWrapper.disconnect();
    } catch (error) {
      console.warn('Warning: Could not disconnect from database:', error.message);
    }
  }

  /**
   * Mask sensitive information in database URL
   */
  maskDatabaseUrl(url) {
    if (!url) return 'Not set';
    return url.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
  }
}

/**
 * CLI execution
 */
async function main() {
  // Handle command line arguments
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Database Index Verification Script

Usage:
  node scripts/verify-indexes.js [options]

Options:
  --detailed        Show detailed index information
  --performance     Run performance analysis
  --help, -h        Show this help message

Examples:
  node scripts/verify-indexes.js
  node scripts/verify-indexes.js --detailed
  node scripts/verify-indexes.js --performance --detailed

Environment Variables:
  NODE_ENV          Environment (development, production, test)
  DATABASE_URL      Database connection string
    `);
    process.exit(0);
  }

  // Execute verification
  const verifier = new IndexVerifier();
  const result = await verifier.execute();

  // Exit with appropriate code
  process.exit(result.success ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { IndexVerifier };