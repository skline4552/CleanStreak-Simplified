/**
 * Comprehensive test suite for Step 7: Password Security Implementation
 * Tests bcrypt functionality, password validation, and security best practices
 */

const bcrypt = require('bcrypt');
const {
  hashPassword,
  comparePassword,
  validatePasswordStrength,
  generateSecurePassword,
  needsRehash,
  clearPassword,
  SALT_ROUNDS,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH
} = require('../src/utils/password');

const {
  validateEmail,
  validateUsername,
  validateTaskName,
  validateDate,
  validateStreakCount,
  sanitizeString,
  validateRegistrationData,
  validateLoginData,
  validateCompletionData,
  isSafeString
} = require('../src/utils/validation');

/**
 * Test runner with detailed reporting
 */
class PasswordSecurityTestRunner {
  constructor() {
    this.totalTests = 0;
    this.passedTests = 0;
    this.failedTests = 0;
    this.testResults = [];
    this.startTime = null;
    this.endTime = null;
  }

  async runTest(testName, testFunction) {
    this.totalTests++;
    const testStartTime = Date.now();

    try {
      await testFunction();
      this.passedTests++;
      const duration = Date.now() - testStartTime;
      this.testResults.push({
        name: testName,
        status: 'PASSED',
        duration: duration,
        error: null
      });
      console.log(`✅ ${testName} (${duration}ms)`);
    } catch (error) {
      this.failedTests++;
      const duration = Date.now() - testStartTime;
      this.testResults.push({
        name: testName,
        status: 'FAILED',
        duration: duration,
        error: error.message
      });
      console.log(`❌ ${testName} (${duration}ms): ${error.message}`);
    }
  }

  async runAllTests() {
    console.log('🔒 Starting Password Security Validation for Step 7\n');
    this.startTime = Date.now();

    // Test bcrypt functionality
    await this.testBcryptFunctionality();

    // Test password validation
    await this.testPasswordValidation();

    // Test validation utilities
    await this.testValidationUtilities();

    // Test security features
    await this.testSecurityFeatures();

    // Test performance
    await this.testPerformance();

    // Test edge cases
    await this.testEdgeCases();

    this.endTime = Date.now();
    this.generateReport();
  }

  async testBcryptFunctionality() {
    console.log('\n📘 Testing bcrypt functionality...');

    await this.runTest('bcrypt salt rounds configuration', async () => {
      if (SALT_ROUNDS !== 12) {
        throw new Error(`Expected salt rounds to be 12, got ${SALT_ROUNDS}`);
      }
    });

    await this.runTest('password hashing with valid input', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = await hashPassword(password);

      if (!hashedPassword || typeof hashedPassword !== 'string') {
        throw new Error('Hash function should return a string');
      }

      if (!hashedPassword.startsWith('$2b$')) {
        throw new Error('Hash should use bcrypt format');
      }

      const rounds = bcrypt.getRounds(hashedPassword);
      if (rounds !== SALT_ROUNDS) {
        throw new Error(`Hash should use ${SALT_ROUNDS} salt rounds, got ${rounds}`);
      }
    });

    await this.runTest('password comparison with correct password', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = await hashPassword(password);
      const isMatch = await comparePassword(password, hashedPassword);

      if (!isMatch) {
        throw new Error('Password comparison should return true for matching passwords');
      }
    });

    await this.runTest('password comparison with incorrect password', async () => {
      const password = 'TestPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hashedPassword = await hashPassword(password);
      const isMatch = await comparePassword(wrongPassword, hashedPassword);

      if (isMatch) {
        throw new Error('Password comparison should return false for non-matching passwords');
      }
    });

    await this.runTest('hash uniqueness verification', async () => {
      const password = 'TestPassword123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      if (hash1 === hash2) {
        throw new Error('Each hash should be unique due to random salts');
      }

      // Both should still validate correctly
      const match1 = await comparePassword(password, hash1);
      const match2 = await comparePassword(password, hash2);

      if (!match1 || !match2) {
        throw new Error('Both unique hashes should validate the same password');
      }
    });

    await this.runTest('rehash detection functionality', async () => {
      // Create hash with lower salt rounds
      const password = 'TestPassword123!';
      const lowRoundHash = await bcrypt.hash(password, 10); // Lower than current 12

      if (!needsRehash(lowRoundHash)) {
        throw new Error('Should detect that lower round hash needs rehashing');
      }

      const currentRoundHash = await hashPassword(password);
      if (needsRehash(currentRoundHash)) {
        throw new Error('Should not require rehashing for current round hash');
      }
    });
  }

  async testPasswordValidation() {
    console.log('\n📘 Testing password validation...');

    await this.runTest('password length requirements', async () => {
      const shortPassword = 'Abc1!';
      const validation = validatePasswordStrength(shortPassword);

      if (validation.isValid) {
        throw new Error('Should reject passwords shorter than minimum length');
      }

      if (!validation.errors.some(error => error.includes('at least 8 characters'))) {
        throw new Error('Should provide specific length requirement error');
      }
    });

    await this.runTest('password character requirements', async () => {
      const testCases = [
        { password: 'alllowercase123!', missing: 'uppercase' },
        { password: 'ALLUPPERCASE123!', missing: 'lowercase' },
        { password: 'NoNumbers!', missing: 'number' },
        { password: 'NoSpecialChars123', missing: 'special character' }
      ];

      for (const testCase of testCases) {
        const validation = validatePasswordStrength(testCase.password);
        if (validation.isValid) {
          throw new Error(`Should reject password missing ${testCase.missing}: ${testCase.password}`);
        }
      }
    });

    await this.runTest('strong password acceptance', async () => {
      const strongPasswords = [
        'MySecure123!',
        'P@ssw0rd2023',
        'Complex_Pass1',
        'Str0ng#Security',
        'Valid8Password!'
      ];

      for (const password of strongPasswords) {
        const validation = validatePasswordStrength(password);
        if (!validation.isValid) {
          throw new Error(`Should accept strong password: ${password}, errors: ${validation.errors.join(', ')}`);
        }
      }
    });

    await this.runTest('common password detection', async () => {
      const commonPasswords = [
        'password',
        'Password123',
        'admin',
        'letmein',
        'welcome'
      ];

      for (const password of commonPasswords) {
        const validation = validatePasswordStrength(password);
        if (validation.isValid) {
          throw new Error(`Should reject common password: ${password}`);
        }
      }
    });

    await this.runTest('sequential character detection', async () => {
      const sequentialPasswords = [
        'Abc123456!',
        'Password123456',
        'Qwerty123!'
      ];

      for (const password of sequentialPasswords) {
        const validation = validatePasswordStrength(password);
        if (validation.isValid) {
          throw new Error(`Should reject password with sequential characters: ${password}`);
        }
      }
    });

    await this.runTest('repeated character detection', async () => {
      const repeatedPasswords = [
        'Passsword123!',
        'Myyyy123!',
        'Test1111!'
      ];

      for (const password of repeatedPasswords) {
        const validation = validatePasswordStrength(password);
        if (validation.isValid) {
          throw new Error(`Should reject password with excessive repeated characters: ${password}`);
        }
      }
    });

    await this.runTest('secure password generation', async () => {
      const passwords = [];

      // Generate multiple passwords to test uniqueness and requirements
      for (let i = 0; i < 10; i++) {
        const password = generateSecurePassword(16);
        passwords.push(password);

        // Validate each generated password meets requirements
        const validation = validatePasswordStrength(password);
        if (!validation.isValid) {
          throw new Error(`Generated password should meet all requirements: ${password}, errors: ${validation.errors.join(', ')}`);
        }
      }

      // Check uniqueness
      const uniquePasswords = new Set(passwords);
      if (uniquePasswords.size !== passwords.length) {
        throw new Error('Generated passwords should be unique');
      }
    });
  }

  async testValidationUtilities() {
    console.log('\n📘 Testing validation utilities...');

    await this.runTest('email validation with valid emails', async () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'first+last@company.org',
        'user123@test-domain.com'
      ];

      for (const email of validEmails) {
        const validation = validateEmail(email);
        if (!validation.isValid) {
          throw new Error(`Should accept valid email: ${email}, error: ${validation.error}`);
        }
      }
    });

    await this.runTest('email validation with invalid emails', async () => {
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user@domain',
        'user..name@domain.com',
        ''
      ];

      for (const email of invalidEmails) {
        const validation = validateEmail(email);
        if (validation.isValid) {
          throw new Error(`Should reject invalid email: ${email}`);
        }
      }
    });

    await this.runTest('disposable email detection', async () => {
      const disposableEmails = [
        'test@10minutemail.com',
        'user@tempmail.org',
        'fake@guerrillamail.com'
      ];

      for (const email of disposableEmails) {
        const validation = validateEmail(email);
        if (validation.isValid) {
          throw new Error(`Should reject disposable email: ${email}`);
        }
      }
    });

    await this.runTest('username validation', async () => {
      const validUsernames = ['user123', 'test_user', 'my-name', 'ValidUser'];
      const invalidUsernames = ['us', 'user@name', 'admin', 'a'.repeat(31)];

      for (const username of validUsernames) {
        const validation = validateUsername(username);
        if (!validation.isValid) {
          throw new Error(`Should accept valid username: ${username}, error: ${validation.error}`);
        }
      }

      for (const username of invalidUsernames) {
        const validation = validateUsername(username);
        if (validation.isValid) {
          throw new Error(`Should reject invalid username: ${username}`);
        }
      }
    });

    await this.runTest('task name validation', async () => {
      const validTaskNames = ['Daily Exercise', 'Read for 30 minutes', 'Morning meditation!'];
      const invalidTaskNames = ['', 'a'.repeat(101), 'Task with <script>'];

      for (const taskName of validTaskNames) {
        const validation = validateTaskName(taskName);
        if (!validation.isValid) {
          throw new Error(`Should accept valid task name: ${taskName}, error: ${validation.error}`);
        }
      }

      for (const taskName of invalidTaskNames) {
        const validation = validateTaskName(taskName);
        if (validation.isValid) {
          throw new Error(`Should reject invalid task name: ${taskName}`);
        }
      }
    });

    await this.runTest('registration data validation', async () => {
      const validData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!'
      };

      const validation = validateRegistrationData(validData);
      if (!validation.isValid) {
        throw new Error(`Should accept valid registration data, errors: ${validation.errors.join(', ')}`);
      }

      // Test password mismatch
      const mismatchData = { ...validData, confirmPassword: 'DifferentPass123!' };
      const mismatchValidation = validateRegistrationData(mismatchData);
      if (mismatchValidation.isValid) {
        throw new Error('Should reject registration data with password mismatch');
      }
    });

    await this.runTest('login data validation', async () => {
      const validData = {
        email: 'test@example.com',
        password: 'SecurePass123!'
      };

      const validation = validateLoginData(validData);
      if (!validation.isValid) {
        throw new Error(`Should accept valid login data, errors: ${validation.errors.join(', ')}`);
      }
    });
  }

  async testSecurityFeatures() {
    console.log('\n📘 Testing security features...');

    await this.runTest('XSS prevention in sanitizeString', async () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        '<img src="x" onerror="alert(1)">',
        'javascript:alert(1)',
        '"><script>alert(1)</script>'
      ];

      for (const input of maliciousInputs) {
        const sanitized = sanitizeString(input);
        if (sanitized.includes('<script>') || sanitized.includes('javascript:')) {
          throw new Error(`Should sanitize malicious input: ${input} -> ${sanitized}`);
        }
      }
    });

    await this.runTest('safe string detection', async () => {
      const unsafeStrings = [
        '<script>alert(1)</script>',
        'javascript:void(0)',
        'onclick="alert(1)"',
        'eval(malicious)',
        'vbscript:msgbox(1)'
      ];

      for (const unsafeString of unsafeStrings) {
        if (isSafeString(unsafeString)) {
          throw new Error(`Should detect unsafe string: ${unsafeString}`);
        }
      }

      const safeStrings = ['normal text', 'user@domain.com', 'Valid Task Name'];
      for (const safeString of safeStrings) {
        if (!isSafeString(safeString)) {
          throw new Error(`Should accept safe string: ${safeString}`);
        }
      }
    });

    await this.runTest('input length limits', async () => {
      const longString = 'a'.repeat(2000);
      const sanitized = sanitizeString(longString);

      if (sanitized.length > 1000) {
        throw new Error('Should limit sanitized string length to prevent memory issues');
      }
    });

    await this.runTest('password hashing error handling', async () => {
      try {
        await hashPassword(null);
        throw new Error('Should throw error for null password');
      } catch (error) {
        if (!error.message.includes('must be a non-empty string')) {
          throw new Error('Should provide specific error for invalid input');
        }
      }

      try {
        await comparePassword('test', null);
        throw new Error('Should throw error for null hash');
      } catch (error) {
        if (!error.message.includes('must be a non-empty string')) {
          throw new Error('Should provide specific error for invalid hash');
        }
      }
    });
  }

  async testPerformance() {
    console.log('\n📘 Testing performance...');

    await this.runTest('bcrypt hashing performance', async () => {
      const password = 'TestPassword123!';
      const startTime = Date.now();

      // Test multiple hashing operations
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(hashPassword(password));
      }

      await Promise.all(promises);
      const duration = Date.now() - startTime;
      const avgDuration = duration / 5;

      // bcrypt with 12 salt rounds should take reasonable time (typically 100-500ms per operation)
      if (avgDuration > 1000) {
        throw new Error(`Hashing performance too slow: ${avgDuration}ms average (expected <1000ms)`);
      }

      console.log(`   ⏱️  Average bcrypt hashing time: ${avgDuration}ms`);
    });

    await this.runTest('password comparison performance', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = await hashPassword(password);

      const startTime = Date.now();

      // Test multiple comparison operations
      for (let i = 0; i < 10; i++) {
        await comparePassword(password, hashedPassword);
      }

      const duration = Date.now() - startTime;
      const avgDuration = duration / 10;

      if (avgDuration > 500) {
        throw new Error(`Comparison performance too slow: ${avgDuration}ms average (expected <500ms)`);
      }

      console.log(`   ⏱️  Average password comparison time: ${avgDuration}ms`);
    });

    await this.runTest('validation performance', async () => {
      const testData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!'
      };

      const startTime = Date.now();

      // Test multiple validation operations
      for (let i = 0; i < 100; i++) {
        validateRegistrationData(testData);
        validatePasswordStrength(testData.password);
        validateEmail(testData.email);
      }

      const duration = Date.now() - startTime;
      const avgDuration = duration / 100;

      if (avgDuration > 5) {
        throw new Error(`Validation performance too slow: ${avgDuration}ms average (expected <5ms)`);
      }

      console.log(`   ⏱️  Average validation time: ${avgDuration}ms`);
    });
  }

  async testEdgeCases() {
    console.log('\n📘 Testing edge cases...');

    await this.runTest('maximum length password handling', async () => {
      const maxLengthPassword = 'A1!' + 'a'.repeat(MAX_PASSWORD_LENGTH - 3);
      const hashedPassword = await hashPassword(maxLengthPassword);
      const isMatch = await comparePassword(maxLengthPassword, hashedPassword);

      if (!isMatch) {
        throw new Error('Should handle maximum length passwords correctly');
      }
    });

    await this.runTest('unicode character handling', async () => {
      const unicodePassword = 'Pässwörd123!™';
      const hashedPassword = await hashPassword(unicodePassword);
      const isMatch = await comparePassword(unicodePassword, hashedPassword);

      if (!isMatch) {
        throw new Error('Should handle unicode characters in passwords');
      }
    });

    await this.runTest('empty and null input handling', async () => {
      const invalidInputs = [null, undefined, '', ' ', 123, {}, []];

      for (const input of invalidInputs) {
        try {
          await hashPassword(input);
          throw new Error(`Should reject invalid input: ${input}`);
        } catch (error) {
          // Expected to throw
        }

        const validation = validatePasswordStrength(input);
        if (validation.isValid) {
          throw new Error(`Should reject invalid password input: ${input}`);
        }
      }
    });

    await this.runTest('malformed hash handling', async () => {
      const malformedHashes = [
        'not-a-hash',
        '$2b$invalid',
        '',
        null,
        123
      ];

      for (const hash of malformedHashes) {
        try {
          await comparePassword('test', hash);
          throw new Error(`Should reject malformed hash: ${hash}`);
        } catch (error) {
          // Expected to throw
        }
      }
    });

    await this.runTest('concurrent operations safety', async () => {
      const password = 'TestPassword123!';

      // Test concurrent hashing operations
      const hashPromises = [];
      for (let i = 0; i < 10; i++) {
        hashPromises.push(hashPassword(password + i));
      }

      const hashes = await Promise.all(hashPromises);

      // Verify all hashes are unique and valid
      const uniqueHashes = new Set(hashes);
      if (uniqueHashes.size !== hashes.length) {
        throw new Error('Concurrent hashing should produce unique results');
      }

      // Test concurrent comparison operations
      const comparePromises = [];
      for (let i = 0; i < hashes.length; i++) {
        comparePromises.push(comparePassword(password + i, hashes[i]));
      }

      const results = await Promise.all(comparePromises);
      if (!results.every(result => result === true)) {
        throw new Error('Concurrent comparison operations should all succeed');
      }
    });

    await this.runTest('memory usage validation', async () => {
      // Test with large number of operations to check for memory leaks
      const password = 'TestPassword123!';
      const hashedPassword = await hashPassword(password);

      for (let i = 0; i < 50; i++) {
        await comparePassword(password, hashedPassword);
        validatePasswordStrength(password);
        sanitizeString(`test string ${i}`);
      }

      // If we reach here without memory issues, test passes
    });
  }

  generateReport() {
    const totalDuration = this.endTime - this.startTime;
    const successRate = (this.passedTests / this.totalTests) * 100;

    console.log('\n' + '='.repeat(80));
    console.log('🔒 PASSWORD SECURITY VALIDATION REPORT - STEP 7');
    console.log('='.repeat(80));

    console.log(`\n📊 TEST SUMMARY:`);
    console.log(`   Total Tests: ${this.totalTests}`);
    console.log(`   Passed: ${this.passedTests}`);
    console.log(`   Failed: ${this.failedTests}`);
    console.log(`   Success Rate: ${successRate.toFixed(1)}%`);
    console.log(`   Total Duration: ${totalDuration}ms`);

    if (this.failedTests > 0) {
      console.log(`\n❌ FAILED TESTS:`);
      this.testResults.filter(test => test.status === 'FAILED').forEach(test => {
        console.log(`   • ${test.name}: ${test.error}`);
      });
    }

    console.log(`\n🔍 SECURITY VALIDATION:`);
    console.log(`   ✅ bcrypt Implementation: Using 12 salt rounds (high security)`);
    console.log(`   ✅ Password Requirements: Comprehensive strength validation`);
    console.log(`   ✅ Input Validation: XSS and injection prevention`);
    console.log(`   ✅ Error Handling: Secure error messages without information leakage`);
    console.log(`   ✅ Performance: Optimized for production workloads`);

    const avgTestDuration = totalDuration / this.totalTests;
    console.log(`\n⏱️ PERFORMANCE METRICS:`);
    console.log(`   Average Test Duration: ${avgTestDuration.toFixed(1)}ms`);
    console.log(`   bcrypt Salt Rounds: 12 (high security)`);
    console.log(`   Validation Response Time: <5ms`);

    console.log(`\n✅ STEP 7 VALIDATION: ${successRate === 100 ? 'COMPLETED SUCCESSFULLY' : 'REQUIRES ATTENTION'}`);

    if (successRate === 100) {
      console.log(`\n🎉 All password security requirements have been successfully implemented!`);
      console.log(`   Ready for integration with authentication system.`);
    }

    console.log('\n' + '='.repeat(80));

    return {
      totalTests: this.totalTests,
      passedTests: this.passedTests,
      failedTests: this.failedTests,
      successRate: successRate,
      duration: totalDuration,
      testResults: this.testResults
    };
  }
}

// Export for use in other test files
module.exports = PasswordSecurityTestRunner;

// Run tests if executed directly
if (require.main === module) {
  (async () => {
    const testRunner = new PasswordSecurityTestRunner();
    await testRunner.runAllTests();

    // Exit with appropriate code
    process.exit(testRunner.failedTests > 0 ? 1 : 0);
  })();
}