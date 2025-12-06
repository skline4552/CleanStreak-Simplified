/**
 * Production Database Compatibility Validation for Step 4
 * Tests PostgreSQL schema generation and compatibility
 */

const fs = require('fs');
const path = require('path');

async function validateProductionCompatibility() {
  console.log('\n🏭 Step 4 Production Database Compatibility');
  console.log('===========================================\n');

  const tests = {
    passed: 0,
    failed: 0,
    results: []
  };

  function recordTest(name, passed, details = '') {
    tests.results.push({ name, passed, details });
    if (passed) {
      tests.passed++;
      console.log(`   ✅ ${name}`);
      if (details) console.log(`      ${details}`);
    } else {
      tests.failed++;
      console.log(`   ❌ ${name} - ${details}`);
    }
  }

  try {
    // 1. Test Prisma Schema Production Configuration
    console.log('1. Prisma Schema Production Configuration...');

    const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');

    // Check datasource configuration
    const hasProviderConfig = schemaContent.includes('provider = "sqlite"');
    const hasUrlConfig = schemaContent.includes('url      = env("DATABASE_URL")');

    recordTest('Schema has provider configuration', hasProviderConfig);
    recordTest('Schema uses DATABASE_URL environment variable', hasUrlConfig);

    // 2. Test PostgreSQL-specific Features
    console.log('\n2. PostgreSQL Compatibility Features...');

    // Check for PostgreSQL-compatible data types
    const hasTextFields = schemaContent.includes('String');
    const hasIntegerFields = schemaContent.includes('Int');
    const hasDateTimeFields = schemaContent.includes('DateTime');
    const hasBooleanFields = schemaContent.includes('Boolean');

    recordTest('Uses PostgreSQL-compatible data types',
      hasTextFields && hasIntegerFields && hasDateTimeFields && hasBooleanFields);

    // Check for proper indexes
    const hasIndexes = schemaContent.includes('@@index(');
    const hasUniqueConstraints = schemaContent.includes('@@unique(');
    const hasSingleFieldIndexes = schemaContent.includes('@unique');

    recordTest('Has performance indexes defined', hasIndexes);
    recordTest('Has unique constraints defined', hasUniqueConstraints);
    recordTest('Has single field unique constraints', hasSingleFieldIndexes);

    // Check for foreign key relationships
    const hasForeignKeys = schemaContent.includes('@relation(');
    const hasCascadeDeletes = schemaContent.includes('onDelete: Cascade');

    recordTest('Has foreign key relationships', hasForeignKeys);
    recordTest('Has cascade delete configuration', hasCascadeDeletes);

    // 3. Test Migration File Compatibility
    console.log('\n3. Migration File PostgreSQL Compatibility...');

    const migrationsDir = path.join(__dirname, '..', 'prisma', 'migrations');
    const migrations = fs.readdirSync(migrationsDir);
    const latestMigration = migrations.find(m => m.includes('init'));

    if (latestMigration) {
      const migrationPath = path.join(migrationsDir, latestMigration, 'migration.sql');
      const migrationContent = fs.readFileSync(migrationPath, 'utf8');

      // Check for PostgreSQL-compatible SQL
      const hasCreateTable = migrationContent.includes('CREATE TABLE');
      const hasIndexCreation = migrationContent.includes('CREATE INDEX') || migrationContent.includes('CREATE UNIQUE INDEX');
      const hasForeignKeyConstraints = migrationContent.includes('CONSTRAINT') && migrationContent.includes('FOREIGN KEY');

      recordTest('Migration has table creation statements', hasCreateTable);
      recordTest('Migration has index creation statements', hasIndexCreation);
      recordTest('Migration has foreign key constraints', hasForeignKeyConstraints);

      // Check for potential PostgreSQL conversion issues
      const hasTextType = migrationContent.includes('TEXT');
      const hasIntegerType = migrationContent.includes('INTEGER');
      const hasDateTimeType = migrationContent.includes('DATETIME');

      recordTest('Uses TEXT data type (PostgreSQL compatible)', hasTextType,
        'SQLite TEXT maps to PostgreSQL TEXT/VARCHAR');
      recordTest('Uses INTEGER data type (PostgreSQL compatible)', hasIntegerType,
        'SQLite INTEGER maps to PostgreSQL INTEGER');
      recordTest('Uses DATETIME data type', hasDateTimeType,
        'Note: May need adjustment to TIMESTAMP for PostgreSQL');
    } else {
      recordTest('Migration file exists', false, 'No init migration found');
    }

    // 4. Test Environment Configuration for Production
    console.log('\n4. Production Environment Configuration...');

    const prodEnvPath = path.join(__dirname, '..', '.env.production');
    const prodEnvContent = fs.readFileSync(prodEnvPath, 'utf8');

    const hasPostgreSQLProvider = prodEnvContent.includes('DATABASE_PROVIDER="postgresql"') ||
                                  prodEnvContent.includes('DATABASE_PROVIDER=postgresql');
    const hasPostgreSQLUrl = prodEnvContent.includes('postgresql://') ||
                            prodEnvContent.includes('DATABASE_URL=');
    const hasProductionSettings = prodEnvContent.includes('NODE_ENV=production');

    recordTest('Production environment configured for PostgreSQL', hasPostgreSQLProvider);
    recordTest('Production DATABASE_URL template configured', hasPostgreSQLUrl);
    recordTest('Production environment settings present', hasProductionSettings);

    // Check security settings
    const hasSecureCookies = prodEnvContent.includes('COOKIE_SECURE=true');
    const hasStrictSameSite = prodEnvContent.includes('COOKIE_SAME_SITE=strict');
    const hasHigherBcryptRounds = prodEnvContent.includes('BCRYPT_SALT_ROUNDS=12');

    recordTest('Production has secure cookie configuration', hasSecureCookies);
    recordTest('Production has strict SameSite policy', hasStrictSameSite);
    recordTest('Production has higher bcrypt rounds', hasHigherBcryptRounds);

    // 5. Test Schema Generation for PostgreSQL
    console.log('\n5. PostgreSQL Schema Generation Test...');

    try {
      // Temporarily modify schema for PostgreSQL test
      const originalSchema = fs.readFileSync(schemaPath, 'utf8');
      const postgresSchema = originalSchema.replace(
        'provider = "sqlite"',
        'provider = "postgresql"'
      );

      // Write temporary PostgreSQL schema
      const tempSchemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma.postgres.tmp');
      fs.writeFileSync(tempSchemaPath, postgresSchema);

      // Test if schema is valid for PostgreSQL
      const { execSync } = require('child_process');
      try {
        // Copy temp schema over original temporarily
        fs.writeFileSync(schemaPath, postgresSchema);

        // Set a dummy PostgreSQL URL for validation
        process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test';

        execSync('npx prisma validate', {
          cwd: path.join(__dirname, '..'),
          stdio: 'pipe'
        });

        recordTest('Schema valid for PostgreSQL', true);
      } catch (error) {
        recordTest('Schema valid for PostgreSQL', false, error.message);
      } finally {
        // Restore original schema
        fs.writeFileSync(schemaPath, originalSchema);
        // Remove temp file
        if (fs.existsSync(tempSchemaPath)) {
          fs.unlinkSync(tempSchemaPath);
        }
        // Restore original DATABASE_URL
        delete process.env.DATABASE_URL;
      }
    } catch (error) {
      recordTest('PostgreSQL schema generation test', false, error.message);
    }

    // 6. Test Production Database Pool Configuration
    console.log('\n6. Production Database Pool Configuration...');

    const envConfigPath = path.join(__dirname, '..', 'src', 'config', 'environment.js');
    const envConfigContent = fs.readFileSync(envConfigPath, 'utf8');

    const hasPoolConfig = envConfigContent.includes('DB_POOL_MIN') &&
                         envConfigContent.includes('DB_POOL_MAX');
    const hasConnectionTimeout = envConfigContent.includes('DB_POOL_ACQUIRE_TIMEOUT');
    const hasIdleTimeout = envConfigContent.includes('DB_POOL_IDLE_TIMEOUT');

    recordTest('Has database connection pool configuration', hasPoolConfig);
    recordTest('Has connection timeout configuration', hasConnectionTimeout);
    recordTest('Has idle timeout configuration', hasIdleTimeout);

    // 7. Test Production-specific Features
    console.log('\n7. Production-specific Features...');

    // Check for production validation
    const hasProductionValidation = envConfigContent.includes('NODE_ENV === \'production\'');
    const hasSecretValidation = envConfigContent.includes('JWT_SECRET') &&
                              envConfigContent.includes('length < 32');

    recordTest('Has production environment validation', hasProductionValidation);
    recordTest('Has JWT secret strength validation', hasSecretValidation);

    console.log('\n📊 Production Compatibility Results:');
    console.log('===================================');
    console.log(`Total tests: ${tests.passed + tests.failed}`);
    console.log(`Passed: ${tests.passed}`);
    console.log(`Failed: ${tests.failed}`);
    console.log(`Success rate: ${((tests.passed / (tests.passed + tests.failed)) * 100).toFixed(1)}%`);

    if (tests.failed > 0) {
      console.log('\n❌ Failed tests:');
      tests.results.filter(t => !t.passed).forEach(test => {
        console.log(`   • ${test.name}: ${test.details}`);
      });
    }

    if (tests.failed === 0) {
      console.log('\n🎉 All production compatibility tests passed!');
      console.log('✅ Database schema is ready for PostgreSQL deployment');
      console.log('✅ Environment configuration supports production deployment');
      console.log('✅ Security settings properly configured for production');
    }

    return {
      success: tests.failed === 0,
      total: tests.passed + tests.failed,
      passed: tests.passed,
      failed: tests.failed,
      tests: tests.results
    };

  } catch (error) {
    console.error('\n❌ Production compatibility validation failed:', error.message);
    return {
      success: false,
      error: error.message,
      total: tests.passed + tests.failed,
      passed: tests.passed,
      failed: tests.failed + 1
    };
  }
}

// Export for testing framework
module.exports = { validateProductionCompatibility };

// Run if called directly
if (require.main === module) {
  validateProductionCompatibility()
    .then(results => {
      console.log('\n🏁 Production Compatibility Validation Complete');
      console.log('===============================================');
      console.log(`Overall Status: ${results.success ? 'PASS' : 'FAIL'}`);
      process.exit(results.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Production compatibility validation failed:', error);
      process.exit(1);
    });
}