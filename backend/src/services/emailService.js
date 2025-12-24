const { Resend } = require('resend');
const { prisma } = require('../config/prisma');
const crypto = require('crypto'); // Added crypto for token generation

/**
 * Email Service
 *
 * Handles all email-related functionality including:
 * - Sending verification emails using Resend API
 * - Token generation and validation
 * - Email template rendering
 */
class EmailService {
  constructor() {
    this.resend = null;
    this.initializeResend();
  }

  /**
   * Initialize Resend client
   */
  initializeResend() {
    try {
      // Debug: Log email configuration status
      console.log('Email configuration check:', {
        hasResendApiKey: !!process.env.RESEND_API_KEY,
        emailFrom: process.env.EMAIL_FROM ? 'set' : 'not set'
      });

      // Only initialize if Resend API key is present
      if (!process.env.RESEND_API_KEY) {
        console.warn('Email configuration missing - email service disabled');
        console.warn('Missing: RESEND_API_KEY');
        return;
      }

      this.resend = new Resend(process.env.RESEND_API_KEY);

      console.log('Email service initialized successfully with Resend');
    } catch (error) {
      console.error('Failed to initialize email service:', error);
    }
  }

  /**
   * Check if email service is available
   */
  isAvailable() {
    return this.resend !== null;
  }

  /**
   * Send verification email to user
   * @param {Object} user - User object with id and email
   * @param {string} verificationToken - Verification token
   * @returns {Promise<Object>} Send result
   */
  async sendVerificationEmail(user, verificationToken) {
    if (!this.isAvailable()) {
      throw new Error('Email service not configured');
    }

    const verificationUrl = `${process.env.EMAIL_VERIFICATION_URL || 'http://localhost:8080/verify-email'}?token = ${verificationToken} `;
    const expiryHours = parseInt(process.env.VERIFICATION_TOKEN_EXPIRY_HOURS, 10) || 24;

    try {
      const { data, error } = await this.resend.emails.send({
        from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
        to: user.email,
        subject: 'Verify Your CleanStreak Account',
        text: this.getVerificationEmailText(verificationUrl, expiryHours)
      });

      if (error) {
        console.error('Resend API error:', JSON.stringify(error, null, 2));
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          statusCode: error.statusCode
        });
        throw new Error(`Failed to send verification email: ${error.message || 'Unknown error'} `);
      }

      console.log('Verification email sent:', data.id);
      return { success: true, messageId: data.id };
    } catch (error) {
      console.error('Failed to send verification email:', error);
      throw new Error('Failed to send verification email');
    }
  }

  /**
   * Generate plain text email template
   * @param {string} verificationUrl - Verification URL
   * @param {number} expiryHours - Token expiry in hours
   * @returns {string} Email text
   */
  getVerificationEmailText(verificationUrl, expiryHours) {
    return `
Welcome to CleanStreak!

Thanks for signing up! Please verify your email address to get started with your habit tracking journey.

Verify your email by clicking the link below:
${verificationUrl}

This link will expire in ${expiryHours} hours.

If you didn't create an account with CleanStreak, you can safely ignore this email.

Best regards,
  The CleanStreak Team

---
  CleanStreak - Build better habits, one task at a time
    `.trim();
  }

  /**
   * Generate email verification token
   * @param {string} userId - User ID
   * @returns {Promise<string>} Verification token
   */
  async generateVerificationToken(userId) {
    try {
      // Create unique token using crypto
      const token = crypto.randomBytes(32).toString('hex');
      const expiryHours = parseInt(process.env.VERIFICATION_TOKEN_EXPIRY_HOURS, 10) || 24;
      const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

      // Delete any existing tokens for this user
      await prisma.email_verification_tokens.deleteMany({
        where: { user_id: userId }
      });

      // Create new token
      await prisma.email_verification_tokens.create({
        data: {
          // Using crypto for the token itself, but still need an ID for the DB record
          // For simplicity, we can use the token itself as the ID if it's guaranteed unique,
          // or generate a separate ID if the schema requires it.
          // Assuming 'id' in the schema is a unique identifier for the record, not the token value.
          id: crypto.randomBytes(16).toString('hex'), // Generate a unique ID for the record
          user_id: userId,
          token,
          expires_at: expiresAt
        }
      });

      return token;
    } catch (error) {
      console.error('Failed to generate verification token:', error);
      throw new Error('Failed to generate verification token');
    }
  }

  /**
   * Verify email token and mark user as verified
   * @param {string} token - Verification token
   * @returns {Promise<Object>} User object
   */
  async verifyEmailToken(token) {
    try {
      // Find token
      const verificationToken = await prisma.email_verification_tokens.findUnique({
        where: { token },
        include: { users: true }
      });

      if (!verificationToken) {
        throw new Error('Invalid verification token');
      }

      // Check if expired
      if (new Date() > verificationToken.expires_at) {
        throw new Error('Verification token has expired');
      }

      // Update user
      await prisma.users.update({
        where: { id: verificationToken.user_id },
        data: {
          email_verified: true,
          email_verified_at: new Date(),
          updated_at: new Date()
        }
      });

      // Delete used token
      await prisma.email_verification_tokens.delete({
        where: { id: verificationToken.id }
      });

      return verificationToken.users;
    } catch (error) {
      console.error('Email verification failed:', error);
      throw error;
    }
  }

  /**
   * Resend verification email
   * @param {string} email - User email address
   * @returns {Promise<Object>} Success result
   */
  async resendVerificationEmail(email) {
    try {
      const user = await prisma.users.findUnique({
        where: { email: email.toLowerCase() }
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (user.email_verified) {
        throw new Error('Email already verified');
      }

      const token = await this.generateVerificationToken(user.id);
      await this.sendVerificationEmail(user, token);

      return { success: true };
    } catch (error) {
      console.error('Failed to resend verification email:', error);
      throw error;
    }
  }

  /**
   * Clean up expired verification tokens (for maintenance tasks)
   * @returns {Promise<number>} Number of deleted tokens
   */
  async cleanupExpiredTokens() {
    try {
      const result = await prisma.email_verification_tokens.deleteMany({
        where: {
          expires_at: {
            lt: new Date()
          }
        }
      });

      console.log(`Cleaned up ${result.count} expired verification tokens`);
      return result.count;
    } catch (error) {
      console.error('Failed to cleanup expired tokens:', error);
      return 0;
    }
  }
}

// Export singleton instance
module.exports = new EmailService();
