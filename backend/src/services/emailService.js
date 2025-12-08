const nodemailer = require('nodemailer');
const { createId } = require('@paralleldrive/cuid2');
const { prisma } = require('../config/prisma');

/**
 * Email Service
 *
 * Handles all email-related functionality including:
 * - Sending verification emails
 * - Token generation and validation
 * - Email template rendering
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  /**
   * Initialize nodemailer transporter
   */
  initializeTransporter() {
    try {
      // Only initialize if email configuration is present
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        console.warn('Email configuration missing - email service disabled');
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT, 10) || 587,
        secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      });

      console.log('Email service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize email service:', error);
    }
  }

  /**
   * Check if email service is available
   */
  isAvailable() {
    return this.transporter !== null;
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

    const verificationUrl = `${process.env.EMAIL_VERIFICATION_URL || 'http://localhost:8080/verify-email'}?token=${verificationToken}`;
    const expiryHours = parseInt(process.env.VERIFICATION_TOKEN_EXPIRY_HOURS, 10) || 24;

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'CleanStreak <noreply@cleanstreak.com>',
      to: user.email,
      subject: 'Verify Your CleanStreak Account',
      text: this.getVerificationEmailText(verificationUrl, expiryHours)
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Verification email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
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
      // Create unique token
      const token = createId();
      const expiryHours = parseInt(process.env.VERIFICATION_TOKEN_EXPIRY_HOURS, 10) || 24;
      const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

      // Delete any existing tokens for this user
      await prisma.email_verification_tokens.deleteMany({
        where: { user_id: userId }
      });

      // Create new token
      await prisma.email_verification_tokens.create({
        data: {
          id: createId(),
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
