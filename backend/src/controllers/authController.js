const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const { generateTokenPair, verifyAccessToken, verifyRefreshToken, clearAuthCookies, setAuthCookies } = require('../utils/jwt');
const { hashPassword, comparePassword, validatePasswordStrength } = require('../utils/password');
const { validateRegistrationData, validateLoginData, validateEmail, sanitizeString } = require('../utils/validation');

const prisma = new PrismaClient();

class AuthController {
  /**
   * Register a new user account
   * POST /api/auth/register
   */
  static async register(req, res) {
    try {
      const { email, password, username } = req.body;

      // Validate input data
      const validation = validateRegistrationData({ email, password, username });
      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validation.errors
        });
      }

      // Sanitize inputs
      const sanitizedEmail = sanitizeString(email?.toLowerCase());
      const sanitizedUsername = sanitizeString(username);

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
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
      const user = await prisma.user.create({
        data: {
          email: sanitizedEmail,
          username: sanitizedUsername,
          password: hashedPassword,
          created_at: new Date(),
          last_login: new Date()
        }
      });

      // Generate JWT tokens
      const tokens = generateTokenPair({
        userId: user.id,
        email: user.email,
        username: user.username
      });

      // Create session record
      const session = await prisma.userSession.create({
        data: {
          user_id: user.id,
          refresh_token: tokens.refreshToken,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          is_active: true,
          user_agent: req.get('User-Agent') || 'Unknown',
          ip_address: req.ip || req.connection.remoteAddress || 'Unknown'
        }
      });

      // Set HTTP-only cookies
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

      // Return success response (exclude password)
      const { password: _, ...userResponse } = user;

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
      const user = await prisma.user.findUnique({
        where: { email: sanitizedEmail }
      });

      if (!user) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid email or password'
        });
      }

      // Verify password
      const isPasswordValid = await comparePassword(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid email or password'
        });
      }

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { last_login: new Date() }
      });

      // Deactivate existing sessions for this user
      await prisma.userSession.updateMany({
        where: {
          user_id: user.id,
          is_active: true
        },
        data: { is_active: false }
      });

      // Generate new JWT tokens
      const tokens = generateTokenPair({
        userId: user.id,
        email: user.email,
        username: user.username
      });

      // Create new session record
      const session = await prisma.userSession.create({
        data: {
          user_id: user.id,
          refresh_token: tokens.refreshToken,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          is_active: true,
          user_agent: req.get('User-Agent') || 'Unknown',
          ip_address: req.ip || req.connection.remoteAddress || 'Unknown'
        }
      });

      // Set HTTP-only cookies
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

      // Return success response (exclude password)
      const { password: _, ...userResponse } = user;

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
        await prisma.userSession.updateMany({
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
      const session = await prisma.userSession.findFirst({
        where: {
          user_id: decoded.userId,
          refresh_token: refreshToken,
          is_active: true,
          expires_at: {
            gt: new Date()
          }
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
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
        userId: session.user.id,
        email: session.user.email,
        username: session.user.username
      });

      // Update session with new refresh token
      await prisma.userSession.update({
        where: { id: session.id },
        data: {
          refresh_token: tokens.refreshToken,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        }
      });

      // Set new HTTP-only cookies
      setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

      res.status(200).json({
        message: 'Tokens refreshed successfully',
        user: session.user
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
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          username: true,
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
      const activeSession = await prisma.userSession.findFirst({
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
          user_agent: true
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