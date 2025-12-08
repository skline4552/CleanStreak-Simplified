const bcrypt = require('bcrypt');
const { createId } = require('@paralleldrive/cuid2');
const { prisma } = require('../config/prisma');
const { generateTokenPair, verifyAccessToken, verifyRefreshToken, clearAuthCookies, setAuthCookies } = require('../utils/jwt');
const { hashPassword, comparePassword, validatePasswordStrength } = require('../utils/password');
const { validateRegistrationData, validateLoginData, validateEmail, sanitizeString } = require('../utils/validation');

class AuthController {
  /**
   * Register a new user account
   * POST /api/auth/register
   */
  static async register(req, res) {
    try {
      const { email, password, confirmPassword } = req.body;

      // Validate input data
      const validation = validateRegistrationData({ email, password, confirmPassword });
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validation.errors
        });
      }

      // Sanitize inputs
      const sanitizedEmail = sanitizeString(email?.toLowerCase());

      // Check if user already exists
      const existingUser = await prisma.users.findUnique({
        where: { email: sanitizedEmail }
      });

      if (existingUser) {
        return res.status(409).json({
          error: 'User already exists',
          message: 'An account with this email already exists'
        });
      }

      // Validate password strength
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          error: 'Password validation failed',
          details: passwordValidation.errors
        });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create user
      const user = await prisma.users.create({
        data: {
          id: createId(),
          email: sanitizedEmail,
          password_hash: hashedPassword,
          created_at: new Date(),
          updated_at: new Date(),
          last_login: new Date()
        }
      });

      // Generate JWT tokens (user.token_version defaults to 1 from schema)
      const tokens = generateTokenPair({
        userId: user.id,
        email: user.email,
        tokenVersion: user.token_version || 1
      });

      // Create session record
      const session = await prisma.user_sessions.create({
        data: {
          id: createId(),
          user_id: user.id,
          refresh_token: tokens.refreshToken.token,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          is_active: true,
          device_info: req.get('User-Agent') || 'Unknown',
          ip_address: req.ip || req.connection.remoteAddress || 'Unknown'
        }
      });

      // Set HTTP-only cookies
      setAuthCookies(res, tokens.accessToken.token, tokens.refreshToken.token);

      // Generate and send verification email (non-blocking)
      try {
        const emailService = require('../services/emailService');
        const verificationToken = await emailService.generateVerificationToken(user.id);
        await emailService.sendVerificationEmail(user, verificationToken);
        console.log('Verification email sent to:', user.email);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Don't fail registration if email fails - user can resend later
      }

      // Return success response (exclude password)
      const { password_hash: _, ...userResponse } = user;

      res.status(201).json({
        message: 'User registered successfully',
        user: userResponse,
        sessionId: session.id
      });

    } catch (error) {
      console.error('Registration error:', error);

      // Handle specific database errors
      if (error.code === 'P2002') {
        return res.status(409).json({
          error: 'User already exists',
          message: 'An account with this email already exists'
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        message: 'Registration failed. Please try again.'
      });
    }
  }

  /**
   * Login user
   * POST /api/auth/login
   */
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      // Validate input data
      const validation = validateLoginData({ email, password });
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validation.errors
        });
      }

      // Sanitize email
      const sanitizedEmail = sanitizeString(email?.toLowerCase());

      // Find user (include token_version for security)
      const user = await prisma.users.findUnique({
        where: { email: sanitizedEmail },
        select: {
          id: true,
          email: true,
          password_hash: true,
          token_version: true,
          created_at: true,
          last_login: true,
          email_verified: true,
          email_verified_at: true
        }
      });

      if (!user) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid email or password'
        });
      }

      // Verify password
      const isPasswordValid = await comparePassword(password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid email or password'
        });
      }

      // Update last login
      await prisma.users.update({
        where: { id: user.id },
        data: {
          last_login: new Date(),
          updated_at: new Date()
        }
      });

      // Deactivate existing sessions for this user
      await prisma.user_sessions.updateMany({
        where: {
          user_id: user.id,
          is_active: true
        },
        data: { is_active: false }
      });

      // Generate new JWT tokens with current token version
      const tokens = generateTokenPair({
        userId: user.id,
        email: user.email,
        tokenVersion: user.token_version || 1
      });

      // Create new session record
      const session = await prisma.user_sessions.create({
        data: {
          id: createId(),
          user_id: user.id,
          refresh_token: tokens.refreshToken.token,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          is_active: true,
          device_info: req.get('User-Agent') || 'Unknown',
          ip_address: req.ip || req.connection.remoteAddress || 'Unknown'
        }
      });

      // Set HTTP-only cookies
      setAuthCookies(res, tokens.accessToken.token, tokens.refreshToken.token);

      // Return success response (exclude password)
      const { password_hash: _, ...userResponse } = user;

      res.status(200).json({
        message: 'Login successful',
        user: userResponse,
        sessionId: session.id
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Login failed. Please try again.'
      });
    }
  }

  /**
   * Logout user
   * POST /api/auth/logout
   */
  static async logout(req, res) {
    try {
      const { userId } = req.user || {};

      if (userId) {
        // Deactivate all sessions for this user
        await prisma.user_sessions.updateMany({
          where: {
            user_id: userId,
            is_active: true
          },
          data: { is_active: false }
        });
      }

      // Clear auth cookies
      clearAuthCookies(res);

      res.status(200).json({
        message: 'Logout successful'
      });

    } catch (error) {
      console.error('Logout error:', error);

      // Still clear cookies even if database operation fails
      clearAuthCookies(res);

      res.status(200).json({
        message: 'Logout completed'
      });
    }
  }

  /**
   * Refresh JWT tokens
   * POST /api/auth/refresh
   */
  static async refresh(req, res) {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

      if (!refreshToken) {
        return res.status(401).json({
          error: 'Refresh token required',
          message: 'No refresh token provided'
        });
      }

      // Verify refresh token
      const decoded = verifyRefreshToken(refreshToken);
      if (!decoded) {
        clearAuthCookies(res);
        return res.status(401).json({
          error: 'Invalid refresh token',
          message: 'Please login again'
        });
      }

      // Find active session (include token_version for security)
      const session = await prisma.user_sessions.findFirst({
        where: {
          user_id: decoded.userId,
          refresh_token: refreshToken,
          is_active: true,
          expires_at: {
            gt: new Date()
          }
        },
        include: {
          users: {
            select: {
              id: true,
              email: true,
              token_version: true,
              created_at: true,
              last_login: true
            }
          }
        }
      });

      if (!session) {
        clearAuthCookies(res);
        return res.status(401).json({
          error: 'Session expired',
          message: 'Please login again'
        });
      }

      // Generate new token pair with current token version
      const tokens = generateTokenPair({
        userId: session.users.id,
        email: session.users.email,
        tokenVersion: session.users.token_version || 1
      });

      // Update session with new refresh token
      await prisma.user_sessions.update({
        where: { id: session.id },
        data: {
          refresh_token: tokens.refreshToken.token,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          last_accessed: new Date()
        }
      });

      // Set new HTTP-only cookies
      setAuthCookies(res, tokens.accessToken.token, tokens.refreshToken.token);

      res.status(200).json({
        message: 'Tokens refreshed successfully',
        user: session.users
      });

    } catch (error) {
      console.error('Token refresh error:', error);
      clearAuthCookies(res);
      res.status(401).json({
        error: 'Token refresh failed',
        message: 'Please login again'
      });
    }
  }

  /**
   * Get current user information
   * GET /api/auth/me
   */
  static async me(req, res) {
    try {
      const { userId } = req.user;

      // Get user information
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          created_at: true,
          last_login: true
        }
      });

      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          message: 'User account not found'
        });
      }

      // Get active session info
      const activeSession = await prisma.user_sessions.findFirst({
        where: {
          user_id: userId,
          is_active: true,
          expires_at: {
            gt: new Date()
          }
        },
        select: {
          id: true,
          created_at: true,
          expires_at: true,
          device_info: true
        },
        orderBy: {
          created_at: 'desc'
        }
      });

      res.status(200).json({
        user,
        session: activeSession
      });

    } catch (error) {
      console.error('Get user info error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve user information'
      });
    }
  }

  /**
   * Verify email address
   * GET /api/auth/verify-email?token=xxx
   */
  static async verifyEmail(req, res) {
    try {
      const { token } = req.query;

      if (!token) {
        return res.status(400).json({
          error: 'Verification token required',
          message: 'Please provide a verification token'
        });
      }

      const emailService = require('../services/emailService');
      const user = await emailService.verifyEmailToken(token);

      res.status(200).json({
        message: 'Email verified successfully',
        user: {
          id: user.id,
          email: user.email,
          email_verified: true
        }
      });

    } catch (error) {
      console.error('Email verification error:', error);

      if (error.message.includes('Invalid')) {
        return res.status(400).json({
          error: 'Invalid token',
          message: 'The verification link is invalid'
        });
      }

      if (error.message.includes('expired')) {
        return res.status(400).json({
          error: 'Token expired',
          message: 'The verification link has expired. Please request a new one.'
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        message: 'Email verification failed. Please try again.'
      });
    }
  }

  /**
   * Resend verification email
   * POST /api/auth/resend-verification
   */
  static async resendVerification(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          error: 'Email required',
          message: 'Please provide your email address'
        });
      }

      const emailService = require('../services/emailService');
      await emailService.resendVerificationEmail(email);

      res.status(200).json({
        message: 'Verification email sent successfully'
      });

    } catch (error) {
      console.error('Resend verification error:', error);

      if (error.message.includes('not found')) {
        // Don't reveal if email exists (security)
        return res.status(200).json({
          message: 'If that email is registered, a verification link has been sent'
        });
      }

      if (error.message.includes('already verified')) {
        return res.status(400).json({
          error: 'Already verified',
          message: 'This email address is already verified'
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to send verification email. Please try again.'
      });
    }
  }
}

module.exports = AuthController;