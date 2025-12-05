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

      // Generate JWT tokens
      const tokens = generateTokenPair({
        userId: user.id,
        email: user.email
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

      // Find user
      const user = await prisma.users.findUnique({
        where: { email: sanitizedEmail }
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

      // Generate new JWT tokens
      const tokens = generateTokenPair({
        userId: user.id,
        email: user.email
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

      // Find active session
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

      // Generate new token pair
      const tokens = generateTokenPair({
        userId: session.users.id,
        email: session.users.email
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
}

module.exports = AuthController;