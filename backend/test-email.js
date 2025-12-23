#!/usr/bin/env node
/**
 * Email Service Test Script
 *
 * Tests the Resend email integration by sending a test verification email.
 *
 * Usage:
 *   node test-email.js your-email@example.com
 */

require('dotenv').config();
const { Resend } = require('resend');

// Get email from command line argument
const testEmail = process.argv[2];

if (!testEmail) {
  console.error('\n❌ Error: Please provide a test email address');
  console.log('\nUsage:');
  console.log('  node test-email.js your-email@example.com\n');
  process.exit(1);
}

// Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(testEmail)) {
  console.error('\n❌ Error: Invalid email format');
  console.log(`Provided: ${testEmail}\n`);
  process.exit(1);
}

console.log('\n🧪 Testing Resend Email Integration\n');
console.log('═'.repeat(50));

// Check configuration
console.log('\n📋 Configuration Check:');
console.log('─'.repeat(50));
console.log('RESEND_API_KEY:', process.env.RESEND_API_KEY ? '✅ Set' : '❌ Missing');
console.log('EMAIL_FROM:', process.env.EMAIL_FROM || 'onboarding@resend.dev (default)');
console.log('Test Email:', testEmail);

if (!process.env.RESEND_API_KEY) {
  console.error('\n❌ Error: RESEND_API_KEY not found in environment variables');
  console.log('\nPlease add it to your .env file:');
  console.log('  RESEND_API_KEY=re_your_api_key_here\n');
  process.exit(1);
}

// Initialize Resend
console.log('\n🔧 Initializing Resend client...');
const resend = new Resend(process.env.RESEND_API_KEY);

// Test email content
const testVerificationUrl = 'http://localhost:8080/verify-email?token=test_token_123';
const emailContent = `
Welcome to CleanStreak!

This is a TEST email to verify your Resend integration is working correctly.

If this were a real verification email, you would click the link below:
${testVerificationUrl}

This link would expire in 24 hours.

Best regards,
The CleanStreak Team

---
CleanStreak - Build better habits, one task at a time
`.trim();

// Send test email
async function sendTestEmail() {
  console.log('\n📧 Sending test email...');
  console.log('─'.repeat(50));

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      to: testEmail,
      subject: '✅ CleanStreak - Email Service Test',
      text: emailContent
    });

    if (error) {
      console.error('\n❌ Resend API Error:');
      console.error(JSON.stringify(error, null, 2));
      process.exit(1);
    }

    console.log('\n✅ Email sent successfully!');
    console.log('─'.repeat(50));
    console.log('Message ID:', data.id);
    console.log('To:', testEmail);
    console.log('From:', process.env.EMAIL_FROM || 'onboarding@resend.dev');

    console.log('\n📬 Check your inbox!');
    console.log('─'.repeat(50));
    console.log('The test email should arrive within a few seconds.');
    console.log('Check your spam folder if you don\'t see it.\n');

  } catch (error) {
    console.error('\n❌ Unexpected Error:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the test
sendTestEmail();
