#!/usr/bin/env node
/**
 * Railway Backend Email Test Script
 *
 * Tests the email verification flow on your Railway production backend
 * by registering a test user and triggering the verification email.
 *
 * Usage:
 *   node test-railway-email.js https://your-railway-backend.up.railway.app test@example.com
 */

const https = require('https');
const http = require('http');

// Get arguments
const railwayUrl = process.argv[2];
const testEmail = process.argv[3];

if (!railwayUrl || !testEmail) {
  console.error('\n❌ Error: Missing required arguments');
  console.log('\nUsage:');
  console.log('  node test-railway-email.js <railway-backend-url> <test-email>');
  console.log('\nExample:');
  console.log('  node test-railway-email.js https://your-app.up.railway.app test@example.com\n');
  process.exit(1);
}

// Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(testEmail)) {
  console.error('\n❌ Error: Invalid email format');
  console.log(`Provided: ${testEmail}\n`);
  process.exit(1);
}

// Validate URL format
try {
  new URL(railwayUrl);
} catch (error) {
  console.error('\n❌ Error: Invalid URL format');
  console.log(`Provided: ${railwayUrl}`);
  console.log('Expected format: https://your-app.up.railway.app\n');
  process.exit(1);
}

console.log('\n🚂 Testing Railway Backend Email Integration\n');
console.log('═'.repeat(60));

console.log('\n📋 Configuration:');
console.log('─'.repeat(60));
console.log('Backend URL:', railwayUrl);
console.log('Test Email:', testEmail);
console.log('Endpoint:', `${railwayUrl}/api/auth/register`);

// Generate random password for test
const testPassword = 'TestPassword123!';
const timestamp = Date.now();
const randomSuffix = Math.random().toString(36).substring(2, 8);
const uniqueEmail = testEmail.replace('@', `+test${timestamp}_${randomSuffix}@`);

console.log('Unique Email:', uniqueEmail);
console.log('(using email aliasing to avoid conflicts)');

// Prepare request data
const requestData = JSON.stringify({
  email: uniqueEmail,
  password: testPassword,
  confirmPassword: testPassword
});

// Parse URL
const url = new URL(`${railwayUrl}/api/auth/register`);
const isHttps = url.protocol === 'https:';
const httpModule = isHttps ? https : http;

const options = {
  hostname: url.hostname,
  port: url.port || (isHttps ? 443 : 80),
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(requestData)
  }
};

console.log('\n📧 Registering test user...');
console.log('─'.repeat(60));

// Make request
const req = httpModule.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('\n📨 Response received:');
    console.log('─'.repeat(60));
    console.log('Status Code:', res.statusCode);
    console.log('Status Message:', res.statusMessage);

    // Try to parse JSON response
    let responseBody;
    try {
      responseBody = JSON.parse(data);
      console.log('\nResponse Body:');
      console.log(JSON.stringify(responseBody, null, 2));
    } catch (error) {
      console.log('\nRaw Response:');
      console.log(data);
    }

    console.log('\n' + '═'.repeat(60));

    if (res.statusCode === 201) {
      console.log('\n✅ SUCCESS! User registered successfully');
      console.log('─'.repeat(60));
      console.log('✉️  Verification email should be sent to:', uniqueEmail);
      console.log('\n📬 Next steps:');
      console.log('1. Check Railway logs for email confirmation:');
      console.log('   railway logs --service backend');
      console.log('2. Look for: "Verification email sent: [message-id]"');
      console.log('3. Check Resend dashboard: https://resend.com/emails');
      console.log('4. Check your email inbox (including spam folder)');
    } else if (res.statusCode === 409) {
      console.log('\n⚠️  User already exists (this is okay for testing)');
      console.log('─'.repeat(60));
      console.log('Try running the script again - it will generate a new unique email.');
    } else if (res.statusCode === 400) {
      console.log('\n❌ Validation Error');
      console.log('─'.repeat(60));
      if (responseBody && responseBody.details) {
        console.log('Validation errors:', responseBody.details);
      }
    } else {
      console.log('\n❌ Unexpected Response');
      console.log('─'.repeat(60));
      console.log('Expected status: 201');
      console.log('Received status:', res.statusCode);
      console.log('\nPossible issues:');
      console.log('- Backend not deployed correctly');
      console.log('- RESEND_API_KEY not set in Railway');
      console.log('- Network/connectivity issue');
    }

    console.log('\n🔍 Debugging Tips:');
    console.log('─'.repeat(60));
    console.log('Check Railway logs:');
    console.log('  railway logs --service backend --tail');
    console.log('\nCheck environment variables:');
    console.log('  railway variables --service backend');
    console.log('\nVerify Resend API key:');
    console.log('  https://resend.com/api-keys\n');
  });
});

req.on('error', (error) => {
  console.error('\n❌ Request Error:');
  console.error('─'.repeat(60));
  console.error(error.message);
  console.error('\nPossible causes:');
  console.error('- Invalid Railway URL');
  console.error('- Backend not running');
  console.error('- Network connectivity issue');
  console.error('- SSL/TLS certificate issue\n');
  process.exit(1);
});

// Send request
req.write(requestData);
req.end();
