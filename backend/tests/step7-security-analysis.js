/**
 * Advanced Security Analysis for Step 7: Password Security Implementation
 * Tests for timing attacks, side-channel vulnerabilities, and advanced security scenarios
 */

const crypto = require('crypto');
const {
  hashPassword,
  comparePassword,
  validatePasswordStrength,
  generateSecurePassword,
  needsRehash,
  SALT_ROUNDS
} = require('../src/utils/password');

const {
  validateEmail,
  sanitizeString,
  validateRegistrationData,
  isSafeString
} = require('../src/utils/validation');

class SecurityAnalysisRunner {
  constructor() {
    this.vulnerabilities = [];
    this.securityChecks = [];
    this.warnings = [];
  }

  async runSecurityAnalysis() {
    console.log('🔐 Advanced Security Analysis for Password Security Implementation\n');

    await this.testTimingAttackResistance();
    await this.testSideChannelResistance();
    await this.testCryptographicStrength();
    await this.testInjectionVulnerabilities();
    await this.testRateLimitingResistance();
    await this.testMemorySecurityAnalysis();
    await this.testEntropySources();

    return this.generateSecurityReport();
  }

  async testTimingAttackResistance() {
    console.log('⏱️  Testing timing attack resistance...');

    // Test password comparison timing consistency
    const password = 'TestPassword123!';
    const hashedPassword = await hashPassword(password);

    const correctTimes = [];
    const incorrectTimes = [];

    // Test 20 correct password comparisons
    for (let i = 0; i < 20; i++) {
      const start = process.hrtime.bigint();
      await comparePassword(password, hashedPassword);
      const end = process.hrtime.bigint();
      correctTimes.push(Number(end - start) / 1000000); // Convert to milliseconds
    }

    // Test 20 incorrect password comparisons
    for (let i = 0; i < 20; i++) {
      const start = process.hrtime.bigint();
      await comparePassword('WrongPassword123!', hashedPassword);
      const end = process.hrtime.bigint();
      incorrectTimes.push(Number(end - start) / 1000000);
    }

    const correctAvg = correctTimes.reduce((a, b) => a + b) / correctTimes.length;
    const incorrectAvg = incorrectTimes.reduce((a, b) => a + b) / incorrectTimes.length;
    const timingDifference = Math.abs(correctAvg - incorrectAvg);

    if (timingDifference > 10) { // More than 10ms difference could indicate timing attack vulnerability
      this.warnings.push(`Password comparison timing difference: ${timingDifference.toFixed(2)}ms (should be <10ms)`);
    } else {
      this.securityChecks.push('✅ Timing attack resistance: Password comparison times are consistent');
    }

    console.log(`   Correct password avg: ${correctAvg.toFixed(2)}ms`);
    console.log(`   Incorrect password avg: ${incorrectAvg.toFixed(2)}ms`);
    console.log(`   Timing difference: ${timingDifference.toFixed(2)}ms`);
  }

  async testSideChannelResistance() {
    console.log('\n🔍 Testing side-channel attack resistance...');

    // Test hash length consistency
    const passwords = ['ShortPass1!', 'MediumLength123!', 'VeryLongPasswordWithManyCharacters123!'];
    const hashLengths = [];

    for (const password of passwords) {
      const hash = await hashPassword(password);
      hashLengths.push(hash.length);
    }

    if (new Set(hashLengths).size !== 1) {
      this.vulnerabilities.push('Hash length varies with password length (potential side-channel)');
    } else {
      this.securityChecks.push('✅ Side-channel resistance: Hash lengths are consistent');
    }

    // Test salt uniqueness
    const password = 'TestPassword123!';
    const hashes = [];
    for (let i = 0; i < 10; i++) {
      hashes.push(await hashPassword(password));
    }

    const uniqueHashes = new Set(hashes);
    if (uniqueHashes.size !== hashes.length) {
      this.vulnerabilities.push('Salt generation may not be cryptographically random');
    } else {
      this.securityChecks.push('✅ Salt uniqueness: All hashes are unique (proper salt generation)');
    }

    console.log(`   Hash lengths: ${hashLengths.join(', ')}`);
    console.log(`   Unique hashes generated: ${uniqueHashes.size}/${hashes.length}`);
  }

  async testCryptographicStrength() {
    console.log('\n🔐 Testing cryptographic strength...');

    // Verify bcrypt version and parameters
    const password = 'TestPassword123!';
    const hash = await hashPassword(password);

    if (!hash.startsWith('$2b$')) {
      this.vulnerabilities.push('Not using bcrypt version 2b (most secure version)');
    } else {
      this.securityChecks.push('✅ Cryptographic strength: Using bcrypt version 2b');
    }

    const rounds = parseInt(hash.split('$')[2]);
    if (rounds < 12) {
      this.vulnerabilities.push(`bcrypt rounds too low: ${rounds} (minimum recommended: 12)`);
    } else if (rounds >= 12 && rounds <= 15) {
      this.securityChecks.push(`✅ Cryptographic strength: Optimal bcrypt rounds (${rounds})`);
    } else {
      this.warnings.push(`bcrypt rounds very high: ${rounds} (may impact performance)`);
    }

    // Test entropy in password generation
    const generatedPasswords = [];
    for (let i = 0; i < 50; i++) {
      generatedPasswords.push(generateSecurePassword(16));
    }

    const allChars = generatedPasswords.join('');
    const uniqueChars = new Set(allChars);

    if (uniqueChars.size < 50) {
      this.warnings.push(`Low character diversity in generated passwords: ${uniqueChars.size} unique characters`);
    } else {
      this.securityChecks.push(`✅ Password generation entropy: High character diversity (${uniqueChars.size} unique chars)`);
    }

    console.log(`   bcrypt version: ${hash.substring(0, 4)}`);
    console.log(`   Salt rounds: ${rounds}`);
    console.log(`   Generated password entropy: ${uniqueChars.size} unique characters`);
  }

  async testInjectionVulnerabilities() {
    console.log('\n💉 Testing injection vulnerability resistance...');

    const injectionPayloads = [
      "'; DROP TABLE users; --",
      '<script>alert("xss")</script>',
      'javascript:alert(1)',
      '${7*7}',
      '{{7*7}}',
      '../../../etc/passwd',
      'eval("malicious")',
      'onload="alert(1)"',
      'vbscript:msgbox(1)',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='
    ];

    let protectedCount = 0;
    for (const payload of injectionPayloads) {
      const sanitized = sanitizeString(payload);
      const isSafe = isSafeString(payload);

      if (sanitized.includes('<script>') || sanitized.includes('javascript:') ||
          sanitized.includes('eval(') || sanitized.includes('vbscript:')) {
        this.vulnerabilities.push(`Injection payload not properly sanitized: ${payload}`);
      } else {
        protectedCount++;
      }

      if (isSafe && (payload.includes('<script>') || payload.includes('javascript:'))) {
        this.vulnerabilities.push(`Dangerous payload incorrectly marked as safe: ${payload}`);
      }
    }

    if (protectedCount === injectionPayloads.length) {
      this.securityChecks.push('✅ Injection resistance: All test payloads properly sanitized');
    }

    console.log(`   Protected against: ${protectedCount}/${injectionPayloads.length} injection payloads`);
  }

  async testRateLimitingResistance() {
    console.log('\n🚦 Testing brute force resistance capabilities...');

    // Simulate rapid password validation attempts
    const password = 'TestPassword123!';
    const hashedPassword = await hashPassword(password);

    const startTime = Date.now();
    const attempts = 50;

    for (let i = 0; i < attempts; i++) {
      await comparePassword(`attempt${i}`, hashedPassword);
    }

    const duration = Date.now() - startTime;
    const attemptsPerSecond = (attempts / duration) * 1000;

    // bcrypt should naturally rate-limit to prevent brute force
    if (attemptsPerSecond > 20) {
      this.warnings.push(`High password validation rate: ${attemptsPerSecond.toFixed(1)}/sec (consider additional rate limiting)`);
    } else {
      this.securityChecks.push(`✅ Brute force resistance: Natural rate limiting (${attemptsPerSecond.toFixed(1)} attempts/sec)`);
    }

    console.log(`   Password validation rate: ${attemptsPerSecond.toFixed(1)} attempts/second`);
  }

  async testMemorySecurityAnalysis() {
    console.log('\n🧠 Testing memory security...');

    // Test for potential memory leaks in password operations
    const initialMemory = process.memoryUsage().heapUsed;

    for (let i = 0; i < 100; i++) {
      const password = `TestPassword${i}!`;
      const hash = await hashPassword(password);
      await comparePassword(password, hash);
      validatePasswordStrength(password);
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    if (memoryIncrease > 50 * 1024 * 1024) { // 50MB threshold
      this.warnings.push(`Significant memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(1)}MB`);
    } else {
      this.securityChecks.push('✅ Memory security: No significant memory leaks detected');
    }

    console.log(`   Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(1)}MB`);
  }

  async testEntropySources() {
    console.log('\n🎲 Testing randomness and entropy sources...');

    // Test crypto.randomBytes availability (used by bcrypt internally)
    try {
      const randomBytes = crypto.randomBytes(32);
      if (randomBytes.length === 32) {
        this.securityChecks.push('✅ Entropy source: crypto.randomBytes available and functional');
      }
    } catch (error) {
      this.vulnerabilities.push('crypto.randomBytes not available - weak entropy source');
    }

    // Test generated password randomness
    const passwords = [];
    for (let i = 0; i < 1000; i++) {
      passwords.push(generateSecurePassword(12));
    }

    // Check for any duplicate passwords (should be extremely unlikely)
    const uniquePasswords = new Set(passwords);
    if (uniquePasswords.size < passwords.length) {
      this.warnings.push(`Duplicate passwords generated: ${passwords.length - uniquePasswords.size} duplicates in 1000 attempts`);
    } else {
      this.securityChecks.push('✅ Password uniqueness: No duplicates in 1000 generated passwords');
    }

    // Test character distribution
    const allChars = passwords.join('');
    const charCounts = {};
    for (const char of allChars) {
      charCounts[char] = (charCounts[char] || 0) + 1;
    }

    const charValues = Object.values(charCounts);
    const avgCount = charValues.reduce((a, b) => a + b) / charValues.length;
    const variance = charValues.reduce((sum, count) => sum + Math.pow(count - avgCount, 2), 0) / charValues.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev / avgCount > 0.5) {
      this.warnings.push(`High character distribution variance: ${(stdDev / avgCount).toFixed(2)}`);
    } else {
      this.securityChecks.push('✅ Character distribution: Balanced randomness in generated passwords');
    }

    console.log(`   Unique passwords: ${uniquePasswords.size}/1000`);
    console.log(`   Character distribution variance: ${(stdDev / avgCount).toFixed(3)}`);
  }

  generateSecurityReport() {
    console.log('\n' + '='.repeat(80));
    console.log('🔐 ADVANCED SECURITY ANALYSIS REPORT');
    console.log('='.repeat(80));

    console.log('\n✅ SECURITY CHECKS PASSED:');
    this.securityChecks.forEach(check => console.log(`   ${check}`));

    if (this.warnings.length > 0) {
      console.log('\n⚠️  SECURITY WARNINGS:');
      this.warnings.forEach(warning => console.log(`   ⚠️  ${warning}`));
    }

    if (this.vulnerabilities.length > 0) {
      console.log('\n🚨 SECURITY VULNERABILITIES:');
      this.vulnerabilities.forEach(vuln => console.log(`   🚨 ${vuln}`));
    }

    const totalChecks = this.securityChecks.length + this.warnings.length + this.vulnerabilities.length;
    const passedChecks = this.securityChecks.length;
    const securityScore = (passedChecks / totalChecks) * 100;

    console.log('\n📊 SECURITY SCORE:');
    console.log(`   Security Checks Passed: ${this.securityChecks.length}`);
    console.log(`   Warnings: ${this.warnings.length}`);
    console.log(`   Vulnerabilities: ${this.vulnerabilities.length}`);
    console.log(`   Overall Security Score: ${securityScore.toFixed(1)}%`);

    console.log('\n🎯 RECOMMENDATIONS:');

    if (this.vulnerabilities.length === 0) {
      console.log('   ✅ No critical vulnerabilities found');
    } else {
      console.log('   🚨 Address critical vulnerabilities before production deployment');
    }

    if (this.warnings.length === 0) {
      console.log('   ✅ No security warnings');
    } else {
      console.log('   ⚠️  Review and address security warnings for optimal security');
    }

    console.log('   ✅ Consider implementing additional rate limiting at application level');
    console.log('   ✅ Monitor password validation timing in production for timing attacks');
    console.log('   ✅ Regularly update bcrypt library to latest version');
    console.log('   ✅ Consider implementing account lockout after failed attempts');

    console.log('\n' + '='.repeat(80));

    return {
      securityScore,
      vulnerabilities: this.vulnerabilities.length,
      warnings: this.warnings.length,
      passed: this.securityChecks.length
    };
  }
}

// Export for use in other test files
module.exports = SecurityAnalysisRunner;

// Run analysis if executed directly
if (require.main === module) {
  (async () => {
    const analysisRunner = new SecurityAnalysisRunner();
    const results = await analysisRunner.runSecurityAnalysis();

    // Exit with appropriate code
    process.exit(results.vulnerabilities > 0 ? 1 : 0);
  })();
}