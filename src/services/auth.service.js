import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../database/connect.js';
import { 
  generateTokens, 
  verifyRefreshToken 
} from '../utils/tokenGenerator.js';

/**
 * Authentication Service
 * Handles all business logic related to user authentication
 */
export class AuthService {
  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @returns {Object} - Created user object
   */
  async registerUser(userData) {
    const { email, phoneNumber, password, firstName, lastName } = userData;

    // Check if user already exists with the given phone number
    const existingUser = await prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (existingUser) {
      throw new Error('User with this phone number already exists');
    }

    // Hash the password if provided
    const hashedPassword = password ? await this.hashPassword(password) : null;

    // Create the user
    const user = await prisma.user.create({
      data: {
        email,
        phoneNumber,
        password: hashedPassword,
        firstName,
        lastName,
        role: 'CUSTOMER',
        status: 'PENDING_VERIFICATION',
      },
    });

    // Create empty shopping cart for the user
    await prisma.cart.create({
      data: {
        userId: user.id,
        subtotal: 0,
        total: 0,
        itemCount: 0,
      },
    });

    // Create empty wishlist for the user
    await prisma.wishlist.create({
      data: {
        userId: user.id,
      },
    });

    // Exclude password from returned user object
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Login with password
   * @param {string} phoneNumber - User's phone number
   * @param {string} password - User's password
   * @returns {Object} - User and tokens
   */
  async loginWithPassword(phoneNumber, password) {
    // Find user by phone number
    const user = await prisma.user.findUnique({
      where: { phoneNumber },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if user has password (might be OTP-only user)
    if (!user.password) {
      throw new Error('Password login not enabled for this account');
    }

    // Verify password
    const passwordValid = await this.verifyPassword(password, user.password);
    if (!passwordValid) {
      throw new Error('Invalid password');
    }

    // Generate tokens using the token generator utility
    const { accessToken, refreshToken } = generateTokens(user);

    // Create session
    await this.createSession(user.id, refreshToken);

    const { password: _, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Create user session
   * @param {string} userId - User ID
   * @param {string} refreshToken - Refresh token
   * @returns {Object} - Created session
   */
  async createSession(userId, refreshToken) {
    // Get device info and IP from context if available
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Set session expiry (7 days)

    // First, check if there's an existing session with this refresh token
    const existingSession = await prisma.session.findFirst({
      where: {
        userId,
        refreshToken,
      },
    });

    if (existingSession) {
      // Update the existing session
      return await prisma.session.update({
        where: { id: existingSession.id },
        data: {
          expiresAt,
          updatedAt: new Date(),
        },
      });
    }

    // Create a new session
    const session = await prisma.session.create({
      data: {
        userId,
        token: crypto.randomBytes(64).toString('hex'), // Session token
        refreshToken,
        expiresAt,
      },
    });

    return session;
  }

  /**
   * Logout user - invalidate session
   * @param {string} userId - User ID
   * @param {string} refreshToken - Refresh token
   * @returns {boolean} - Success status
   */
  async logout(userId, refreshToken) {
    await prisma.session.deleteMany({
      where: {
        userId,
        refreshToken,
      },
    });
    return true;
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Object} - New access and refresh tokens
   */
  async refreshToken(refreshToken) {
    try {
      // Verify refresh token using the token generator utility
      const decoded = verifyRefreshToken(refreshToken);
      
      // Find valid session
      const session = await prisma.session.findFirst({
        where: {
          userId: decoded.userId,
          refreshToken,
          expiresAt: {
            gt: new Date(),
          },
        },
        include: {
          user: true,
        },
      });

      if (!session) {
        throw new Error('Invalid session');
      }

      // Generate new tokens using the token generator utility
      const tokens = generateTokens(session.user);
      
      // Update session with new refresh token
      await prisma.session.update({
        where: { id: session.id },
        data: { refreshToken: tokens.refreshToken },
      });

      return tokens;
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Hash a password
   * @param {string} password - Plain text password
   * @returns {string} - Hashed password
   */
  async hashPassword(password) {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify a password against a hash
   * @param {string} password - Plain text password
   * @param {string} hash - Hashed password
   * @returns {boolean} - Whether password matches
   */
  async verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }
} 