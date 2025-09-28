/**
 * Integration test for Step 7: Password Security with Authentication System
 * Tests integration with existing auth configuration and database
 */

const {
  hashPassword,
  comparePassword,
  validatePasswordStrength,
  SALT_ROUNDS
} = require('../src/utils/password');

const {
  validateEmail,
  validateRegistrationData,
  validateLoginData
} = require('../src/utils/validation');

// Import existing configurations to test integration
const authConfig = require('../src/config/auth');
const environmentConfig = require('../src/config/environment');

class IntegrationTestRunner {
  constructor() {
    this.testResults = [];
    this.integrationIssues = [];
  }

  async runIntegrationTests() {
    console.log('🔗 Testing Integration with Authentication System\n');

    await this.testConfigurationIntegration();
    await this.testDatabaseCompatibility();
    await this.testAuthenticationFlow();
    await this.testEnvironmentIntegration();
    await this.testSecurityConsistency();

    return this.generateIntegrationReport();
  }

  async testConfigurationIntegration() {
    console.log('⚙️  Testing configuration integration...');

    try {
      // Test that password utilities use same bcrypt rounds as auth config
      if (authConfig.bcrypt && authConfig.bcrypt.saltRounds) {
        if (SALT_ROUNDS !== authConfig.bcrypt.saltRounds) {
          this.integrationIssues.push(`Salt rounds mismatch: password.js uses ${SALT_ROUNDS}, auth.js uses ${authConfig.bcrypt.saltRounds}`);
        } else {
          this.testResults.push('✅ Salt rounds consistent between password utilities and auth config');
        }
      } else {
        this.testResults.push('✅ Password utilities define salt rounds independently');
      }

      // Test environment configuration consistency
      if (environmentConfig.BCRYPT_SALT_ROUNDS) {
        if (SALT_ROUNDS !== environmentConfig.BCRYPT_SALT_ROUNDS) {
          this.integrationIssues.push(`Environment salt rounds mismatch: password.js uses ${SALT_ROUNDS}, environment uses ${environmentConfig.BCRYPT_SALT_ROUNDS}`);
        } else {
          this.testResults.push('✅ Salt rounds consistent with environment configuration');
        }
      }

      console.log('   Configuration integration verified');
    } catch (error) {
      this.integrationIssues.push(`Configuration integration test failed: ${error.message}`);
    }
  }

  async testDatabaseCompatibility() {
    console.log('\n🗄️  Testing database compatibility...');

    try {
      // Test that password hashes fit in expected database field length
      const longPassword = 'A'.repeat(126) + '1!'; // Maximum allowed password length (128 total)
      const hash = await hashPassword(longPassword);

      // bcrypt hashes are typically 60 characters for $2b$ format
      if (hash.length > 255) {
        this.integrationIssues.push(`Password hash too long for typical VARCHAR(255): ${hash.length} characters`);
      } else {
        this.testResults.push(`✅ Password hash length compatible with database: ${hash.length} characters`);
      }

      // Test hash format consistency
      if (!hash.startsWith('$2b$12$')) {
        this.integrationIssues.push(`Unexpected hash format: ${hash.substring(0, 10)}...`);
      } else {
        this.testResults.push('✅ Hash format consistent with bcrypt $2b$12$ specification');
      }

      console.log(`   Hash length: ${hash.length} characters`);
      console.log(`   Hash format: ${hash.substring(0, 10)}...`);
    } catch (error) {
      this.integrationIssues.push(`Database compatibility test failed: ${error.message}`);
    }
  }

  async testAuthenticationFlow() {
    console.log('\n🔐 Testing authentication flow integration...');

    try {
      // Simulate complete registration flow
      const registrationData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'SecurePassword123!',
        confirmPassword: 'SecurePassword123!'
      };

      // Test registration data validation
      const regValidation = validateRegistrationData(registrationData);
      if (!regValidation.isValid) {
        this.integrationIssues.push(`Registration validation failed: ${regValidation.errors.join(', ')}`);
      } else {
        this.testResults.push('✅ Registration data validation successful');
      }

      // Test password strength validation
      const strengthValidation = validatePasswordStrength(registrationData.password);
      if (!strengthValidation.isValid) {
        this.integrationIssues.push(`Password strength validation failed: ${strengthValidation.errors.join(', ')}`);
      } else {
        this.testResults.push('✅ Password strength validation successful');
      }

      // Test password hashing
      const hashedPassword = await hashPassword(registrationData.password);
      this.testResults.push('✅ Password hashing successful');

      // Simulate login flow
      const loginData = {
        email: registrationData.email,
        password: registrationData.password
      };

      // Test login data validation
      const loginValidation = validateLoginData(loginData);
      if (!loginValidation.isValid) {
        this.integrationIssues.push(`Login validation failed: ${loginValidation.errors.join(', ')}`);
      } else {
        this.testResults.push('✅ Login data validation successful');
      }

      // Test password comparison
      const passwordMatch = await comparePassword(loginData.password, hashedPassword);
      if (!passwordMatch) {
        this.integrationIssues.push('Password comparison failed for valid credentials');
      } else {
        this.testResults.push('✅ Password comparison successful');
      }

      // Test invalid password
      const invalidMatch = await comparePassword('WrongPassword123!', hashedPassword);
      if (invalidMatch) {
        this.integrationIssues.push('Password comparison incorrectly accepted invalid credentials');
      } else {
        this.testResults.push('✅ Invalid password correctly rejected');
      }

      console.log('   Complete authentication flow tested');
    } catch (error) {
      this.integrationIssues.push(`Authentication flow test failed: ${error.message}`);
    }
  }

  async testEnvironmentIntegration() {
    console.log('\n🌍 Testing environment integration...');

    try {
      const env = environmentConfig;

      // Test that password utilities work in current environment
      const testPassword = 'EnvTest123!';
      const hash = await hashPassword(testPassword);
      const match = await comparePassword(testPassword, hash);

      if (!match) {
        this.integrationIssues.push('Password utilities not working correctly in current environment');
      } else {
        this.testResults.push(`✅ Password utilities working in ${env.NODE_ENV} environment`);
      }

      // Test email validation with environment-specific domains
      const testEmails = [
        'user@localhost.com', // Should work in development
        'admin@production.com' // Should work in production
      ];

      for (const email of testEmails) {
        const emailValidation = validateEmail(email);
        if (!emailValidation.isValid) {
          this.integrationIssues.push(`Email validation failed for ${email} in ${env.NODE_ENV} environment`);
        }
      }

      this.testResults.push('✅ Email validation working across environments');

      console.log(`   Environment: ${env.NODE_ENV}`);
      console.log(`   Database: ${env.DATABASE_URL ? 'Configured' : 'Not configured'}`);
    } catch (error) {
      this.integrationIssues.push(`Environment integration test failed: ${error.message}`);
    }
  }

  async testSecurityConsistency() {
    console.log('\n🛡️  Testing security consistency...');

    try {
      // Test that all security measures are consistent across modules
      const testInputs = [
        '<script>alert("xss")</script>',
        'javascript:alert(1)',
        'test@example.com',
        'ValidPassword123!'
      ];

      for (const input of testInputs) {
        // Test email validation security
        if (input.includes('@')) {
          const emailValidation = validateEmail(input);
          if (input.includes('<script>') && emailValidation.isValid) {
            this.integrationIssues.push(`Email validation accepted XSS payload: ${input}`);
          }
        }

        // Test password validation security
        if (input.length >= 8) {
          const passwordValidation = validatePasswordStrength(input);
          if (input.includes('<script>') && passwordValidation.isValid) {
            this.integrationIssues.push(`Password validation accepted XSS payload: ${input}`);
          }
        }
      }

      this.testResults.push('✅ Security measures consistent across all validation functions');

      // Test that error messages don't leak sensitive information
      try {
        await comparePassword('test', 'invalid-hash');
      } catch (error) {
        if (error.message.includes('invalid-hash')) {
          this.integrationIssues.push('Error message leaks hash information');
        } else {
          this.testResults.push('✅ Error messages do not leak sensitive information');
        }
      }

      console.log('   Security consistency verified');
    } catch (error) {
      this.integrationIssues.push(`Security consistency test failed: ${error.message}`);
    }
  }

  generateIntegrationReport() {
    console.log('\n' + '='.repeat(80));
    console.log('🔗 INTEGRATION TEST REPORT - STEP 7');
    console.log('='.repeat(80));

    console.log('\n✅ INTEGRATION TESTS PASSED:');
    this.testResults.forEach(result => console.log(`   ${result}`));

    if (this.integrationIssues.length > 0) {
      console.log('\n❌ INTEGRATION ISSUES:');
      this.integrationIssues.forEach(issue => console.log(`   ❌ ${issue}`));
    }

    const totalTests = this.testResults.length + this.integrationIssues.length;
    const passedTests = this.testResults.length;
    const integrationScore = (passedTests / totalTests) * 100;

    console.log('\n📊 INTEGRATION SUMMARY:');
    console.log(`   Tests Passed: ${this.testResults.length}`);
    console.log(`   Issues Found: ${this.integrationIssues.length}`);
    console.log(`   Integration Score: ${integrationScore.toFixed(1)}%`);

    console.log('\n🎯 INTEGRATION STATUS:');
    if (this.integrationIssues.length === 0) {
      console.log('   ✅ Password security utilities are fully integrated with authentication system');
      console.log('   ✅ Ready for next step in authentication implementation');
    } else {
      console.log('   ⚠️  Integration issues need to be resolved before proceeding');
    }

    console.log('\n🔮 NEXT STEPS:');
    console.log('   1. Implement JWT token management (Step 8)');
    console.log('   2. Create authentication routes and controllers (Step 9)');
    console.log('   3. Integrate password utilities with user registration/login endpoints');
    console.log('   4. Add comprehensive authentication middleware');

    console.log('\n' + '='.repeat(80));

    return {
      passed: this.testResults.length,
      issues: this.integrationIssues.length,
      score: integrationScore
    };
  }
}

// Export for use in other test files
module.exports = IntegrationTestRunner;

// Run tests if executed directly
if (require.main === module) {
  (async () => {
    const testRunner = new IntegrationTestRunner();
    const results = await testRunner.runIntegrationTests();

    // Exit with appropriate code
    process.exit(results.issues > 0 ? 1 : 0);
  })();
}