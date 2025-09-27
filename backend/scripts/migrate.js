#!/usr/bin/env node

/**
 * Database Migration Script for CleanStreak Authentication System
 *
 * This script handles:
 * - Running Prisma migrations in different environments
 * - Verifying migration status
 * - Database connection validation
 * - Error handling and rollback procedures
 *
 * Usage:
 *   node scripts/migrate.js [environment]
 *   npm run db:migrate
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load environment configuration
require('dotenv').config();
const config = require('../src/config/environment');
const { prismaWrapper } = require('../src/config/prisma');

class DatabaseMigrator {
  constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.projectRoot = path.resolve(__dirname, '..');
    this.prismaSchemaPath = path.join(this.projectRoot, 'prisma', 'schema.prisma');
    this.migrationsPath = path.join(this.projectRoot, 'prisma', 'migrations');
  }

  /**
   * Main migration execution method
   */
  async execute() {
    console.log('🚀 Starting database migration process...');
    console.log(`Environment: ${this.environment}`);
    console.log(`Database URL: ${this.maskDatabaseUrl(config.DATABASE_URL)}`);
    console.log('─'.repeat(60));

    try {
      // Step 1: Validate environment and prerequisites
      await this.validatePrerequisites();

      // Step 2: Check current migration status
      await this.checkMigrationStatus();

      // Step 3: Test database connection
      await this.testDatabaseConnection();

      // Step 4: Generate Prisma client
      await this.generatePrismaClient();

      // Step 5: Apply migrations
      await this.applyMigrations();

      // Step 6: Verify migrations were applied successfully
      await this.verifyMigrations();

      // Step 7: Test database operations
      await this.testDatabaseOperations();

      console.log('✅ Database migration completed successfully!');
      console.log('─'.repeat(60));

      return { success: true, message: 'Migration completed successfully' };

    } catch (error) {
      console.error('❌ Database migration failed:');
      console.error(error.message);
      console.log('─'.repeat(60));

      await this.handleMigrationFailure(error);
      return { success: false, error: error.message };
    } finally {
      // Always disconnect from database
      await this.cleanup();
    }
  }

  /**
   * Validate prerequisites for migration
   */
  async validatePrerequisites() {
    console.log('📋 Validating prerequisites...');

    // Check if Prisma schema exists
    if (!fs.existsSync(this.prismaSchemaPath)) {
      throw new Error(`Prisma schema not found at: ${this.prismaSchemaPath}`);
    }

    // Check if Prisma CLI is available
    try {
      execSync('npx prisma --version', { cwd: this.projectRoot, stdio: 'ignore' });
    } catch (error) {
      throw new Error('Prisma CLI not available. Run: npm install prisma');
    }

    // Validate environment variables
    if (!config.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    console.log('✓ Prerequisites validated');
  }

  /**
   * Check current migration status
   */
  async checkMigrationStatus() {
    console.log('📊 Checking migration status...');

    try {
      const output = execSync('npx prisma migrate status', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      });

      console.log('Current migration status:');
      console.log(output.trim());

      // Check if migrations directory exists and has migrations
      if (fs.existsSync(this.migrationsPath)) {
        const migrations = fs.readdirSync(this.migrationsPath)
          .filter(item => fs.statSync(path.join(this.migrationsPath, item)).isDirectory());

        console.log(`Found ${migrations.length} migration(s):`, migrations);
      }

    } catch (error) {
      // Migration status command may fail if database doesn't exist yet
      console.log('⚠️  Migration status check failed (database may not exist yet)');
      console.log(error.message);
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
    console.log(`Response time: ${connectionResult.responseTime || 'N/A'}`);
  }

  /**
   * Generate Prisma client
   */
  async generatePrismaClient() {
    console.log('🔧 Generating Prisma client...');

    try {
      const output = execSync('npx prisma generate', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      });

      console.log('✓ Prisma client generated successfully');

      // Show generation summary if available
      const lines = output.split('\n').filter(line => line.trim());
      const summaryLines = lines.slice(-3);
      summaryLines.forEach(line => console.log(`  ${line}`));

    } catch (error) {
      throw new Error(`Prisma client generation failed: ${error.message}`);
    }
  }

  /**
   * Apply database migrations
   */
  async applyMigrations() {
    console.log('🔄 Applying database migrations...');

    try {
      let command;

      if (this.environment === 'production') {
        // In production, deploy migrations (no interactive prompts)
        command = 'npx prisma migrate deploy';
        console.log('Using production migration deployment...');
      } else {
        // In development, use migrate dev (creates migration if needed)
        command = 'npx prisma migrate dev';
        console.log('Using development migration process...');
      }

      const output = execSync(command, {
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      console.log('✓ Migrations applied successfully');

      // Show migration output
      const lines = output.split('\n').filter(line => line.trim());
      lines.forEach(line => {
        if (line.includes('Applied') || line.includes('Everything is up to date')) {
          console.log(`  ${line}`);
        }
      });

    } catch (error) {
      throw new Error(`Migration application failed: ${error.message}`);
    }
  }

  /**
   * Verify migrations were applied successfully
   */
  async verifyMigrations() {
    console.log('✅ Verifying migration application...');

    try {
      // Check migration status again
      const output = execSync('npx prisma migrate status', {
        cwd: this.projectRoot,
        encoding: 'utf8'
      });

      if (output.includes('Database schema is up to date')) {
        console.log('✓ All migrations applied successfully');
      } else {
        console.log('Migration status:', output.trim());
      }

    } catch (error) {
      console.warn('⚠️  Could not verify migration status:', error.message);
    }
  }

  /**
   * Test basic database operations
   */
  async testDatabaseOperations() {
    console.log('🧪 Testing database operations...');

    try {
      const prisma = prismaWrapper.getClient();

      // Test basic queries for each table
      const userCount = await prisma.user.count();
      const streakCount = await prisma.userStreak.count();
      const completionCount = await prisma.completionHistory.count();
      const sessionCount = await prisma.userSession.count();
      const analyticsCount = await prisma.analytics.count();

      console.log('✓ Database operations test passed');
      console.log(`  Users: ${userCount}`);
      console.log(`  Streaks: ${streakCount}`);
      console.log(`  Completions: ${completionCount}`);
      console.log(`  Sessions: ${sessionCount}`);
      console.log(`  Analytics: ${analyticsCount}`);

    } catch (error) {
      throw new Error(`Database operations test failed: ${error.message}`);
    }
  }

  /**
   * Handle migration failure scenarios
   */
  async handleMigrationFailure(error) {
    console.log('🔧 Handling migration failure...');

    // Log detailed error information
    console.error('Detailed error information:');
    console.error({
      message: error.message,
      stack: error.stack,
      environment: this.environment,
      databaseUrl: this.maskDatabaseUrl(config.DATABASE_URL)
    });

    // Suggest recovery actions
    console.log('\n💡 Suggested recovery actions:');
    console.log('1. Check database connection and credentials');
    console.log('2. Verify DATABASE_URL environment variable');
    console.log('3. Ensure database server is running');
    console.log('4. Check migration files for syntax errors');
    console.log('5. Consider running: npx prisma migrate reset (⚠️  DESTRUCTIVE)');

    // In development, offer to reset database
    if (this.environment === 'development') {
      console.log('\n🔄 Development environment detected.');
      console.log('You may want to reset the database: npm run db:reset');
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

    // Mask password in connection string
    return url.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
  }
}

/**
 * CLI execution
 */
async function main() {
  const migrator = new DatabaseMigrator();

  // Handle command line arguments
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Database Migration Script

Usage:
  node scripts/migrate.js [environment]

Examples:
  node scripts/migrate.js development
  node scripts/migrate.js production
  NODE_ENV=production node scripts/migrate.js

Environment Variables:
  NODE_ENV          - Environment (development, production, test)
  DATABASE_URL      - Database connection string

Options:
  --help, -h        - Show this help message
    `);
    process.exit(0);
  }

  // Override environment if provided as argument
  if (args[0] && ['development', 'production', 'test'].includes(args[0])) {
    process.env.NODE_ENV = args[0];
    console.log(`Environment overridden to: ${args[0]}`);
  }

  // Execute migration
  const result = await migrator.execute();

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

module.exports = { DatabaseMigrator };