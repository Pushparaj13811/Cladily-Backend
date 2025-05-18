import { AuthService } from '../services/auth.service.js';
import { OtpService } from '../services/otp.service.js';
import ApiError from '../utils/apiError.js';
import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import {
  HTTP_OK,
  HTTP_CREATED,
  HTTP_BAD_REQUEST,
  HTTP_UNAUTHORIZED,
  HTTP_INTERNAL_SERVER_ERROR,
  HTTP_NOT_FOUND,
} from '../httpStatusCode.js';
import { PrismaClient } from '@prisma/client';

// Initialize services
const authService = new AuthService();
const otpService = new OtpService();
const prisma = new PrismaClient();

// Cookie options
const accessTokenCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'Strict',
  maxAge: 60 * 60 * 1000, // 1 hour (matches ACCESS_TOKEN_EXPIRES_IN)
};

const refreshTokenCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'Strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (matches REFRESH_TOKEN_EXPIRES_IN)
};

/**
 * Register a new user
 */
export const register = asyncHandler(async (req, res) => {
  const { email, phone, password, firstName, lastName } = req.body;
  console.log(req.body);

  // Validate required fields
  if (!phone || !firstName || !lastName) {
    throw new ApiError(HTTP_BAD_REQUEST, 'Please provide all required fields');
  }

  try {
    // Register user
    const user = await authService.registerUser({
      email,
      phoneNumber: phone,
      password,
      firstName,
      lastName,
    });

    return res
      .status(HTTP_CREATED)
      .json(new ApiResponse(HTTP_CREATED, 'User registered successfully', user));
  } catch (error) {
    throw new ApiError(
      HTTP_BAD_REQUEST,
      error.message || 'Error registering user'
    );
  }
});

/**
 * Login with password
 */
export const loginWithPassword = asyncHandler(async (req, res) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
    throw new ApiError(HTTP_BAD_REQUEST, 'Phone number and password are required');
  }

  try {
    const { user, accessToken, refreshToken } = await authService.loginWithPassword(
      phone,
      password
    );

    // Set cookies directly with the token (no signing)
    res.cookie('accessToken', accessToken, accessTokenCookieOptions);
    res.cookie('refreshToken', refreshToken, refreshTokenCookieOptions);

    return res
      .status(HTTP_OK)
      .json(
        new ApiResponse(HTTP_OK, 'Login successful', {
          user,
          accessToken,
          refreshToken
        })
      );
  } catch (error) {
    throw new ApiError(HTTP_UNAUTHORIZED, error.message || 'Invalid credentials');
  }
});

/**
 * Request OTP for login/registration
 */
export const requestOtp = asyncHandler(async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    throw new ApiError(HTTP_BAD_REQUEST, 'Phone number is required');
  }

  try {
    const result = await otpService.requestOtpLogin(phoneNumber);

    return res
      .status(HTTP_OK)
      .json(new ApiResponse(HTTP_OK, 'OTP sent successfully', result));
  } catch (error) {
    throw new ApiError(
      HTTP_INTERNAL_SERVER_ERROR,
      error.message || 'Error sending OTP'
    );
  }
});

/**
 * Verify OTP and login
 */
export const verifyOtp = asyncHandler(async (req, res) => {
  const { phoneNumber, otp } = req.body;

  if (!phoneNumber || !otp) {
    throw new ApiError(HTTP_BAD_REQUEST, 'Phone number and OTP are required');
  }

  try {
    const { user, accessToken, refreshToken } = await otpService.verifyOtpLogin(
      phoneNumber,
      otp
    );

    // Set cookies directly with the token (no signing)
    res.cookie('accessToken', accessToken, accessTokenCookieOptions);
    res.cookie('refreshToken', refreshToken, refreshTokenCookieOptions);

    return res
      .status(HTTP_OK)
      .json(
        new ApiResponse(HTTP_OK, 'OTP verified and login successful', {
          user,
          accessToken,
          refreshToken
        })
      );
  } catch (error) {
    throw new ApiError(HTTP_UNAUTHORIZED, error.message || 'Invalid OTP');
  }
});

/**
 * Logout user
 */
export const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  const userId = req.user?.id;

  if (!userId) {
    throw new ApiError(HTTP_BAD_REQUEST, 'User not authenticated');
  }

  try {
    // Try to log out all the user's sessions with the current refreshToken
    if (refreshToken) {
      await authService.logout(userId, refreshToken);
    }

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    return res
      .status(HTTP_OK)
      .json(new ApiResponse(HTTP_OK, 'Logged out successfully', null));
  } catch (error) {
    throw new ApiError(
      HTTP_INTERNAL_SERVER_ERROR,
      error.message || 'Error during logout'
    );
  }
});

/**
 * Refresh token
 */
export const refreshAccessToken = asyncHandler(async (req, res) => {
  // Get refresh token from cookies or request body or headers
  const cookieRefreshToken = req.cookies?.refreshToken;
  const bodyRefreshToken = req.body?.refreshToken;
  const headerRefreshToken = req.header('X-Refresh-Token');
  
  const refreshToken = cookieRefreshToken || bodyRefreshToken || headerRefreshToken;
  
  console.log('Refresh token request received:', {
    fromCookie: !!cookieRefreshToken,
    fromBody: !!bodyRefreshToken,
    fromHeader: !!headerRefreshToken,
    hasToken: !!refreshToken
  });

  if (!refreshToken) {
    throw new ApiError(HTTP_UNAUTHORIZED, 'Refresh token is required');
  }

  try {
    console.log('Processing refresh token request');
    
    // Get new tokens - no need to verify cookie signature
    const { accessToken, refreshToken: newRefreshToken } = await authService.refreshToken(
      refreshToken
    );

    // Set new cookies
    res.cookie('accessToken', accessToken, accessTokenCookieOptions);
    res.cookie('refreshToken', newRefreshToken, refreshTokenCookieOptions);
    
    console.log('Successfully refreshed tokens');

    return res
      .status(HTTP_OK)
      .json(
        new ApiResponse(HTTP_OK, 'Access token refreshed', {
          accessToken,
          refreshToken: newRefreshToken
        })
      );
  } catch (error) {
    console.error('Refresh token error:', error.message);
    // Clear cookies on error
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    throw new ApiError(HTTP_UNAUTHORIZED, 'Invalid refresh token');
  }
});

/**
 * Get user debug info (for development/debugging purposes only)
 */
export const getUserDebugInfo = asyncHandler(async (req, res) => {
  try {
    // Get user from request (set by authentication middleware)
    const userId = req.user?.id;
    
    if (!userId) {
      throw new ApiError(HTTP_UNAUTHORIZED, 'User not authenticated');
    }
    
    // Fetch user with full details from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        role: true,
        status: true,
        emailVerified: true,
        phoneVerified: true,
        createdAt: true,
        updatedAt: true,
      }
    });
    
    if (!user) {
      throw new ApiError(HTTP_NOT_FOUND, 'User not found');
    }
    
    // Get active sessions
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() }
      },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        deviceInfo: true,
        ipAddress: true
      }
    });
    
    return res
      .status(HTTP_OK)
      .json(
        new ApiResponse(HTTP_OK, 'User debug info', {
          user,
          sessions,
          authInfo: {
            authenticated: true,
            tokenPayload: {
              userId: req.user.id,
              role: req.user.role,
            }
          }
        })
      );
  } catch (error) {
    throw new ApiError(
      HTTP_INTERNAL_SERVER_ERROR,
      error.message || 'Error fetching user debug info'
    );
  }
});

/**
 * Test admin access (for debugging purposes only)
 */
export const testAdminAccess = asyncHandler(async (req, res) => {
  // This endpoint can only be accessed if the user is authenticated and has admin role
  // The middleware will handle the role check, so if we get here, the user is an admin
  
  return res
    .status(HTTP_OK)
    .json(
      new ApiResponse(HTTP_OK, 'Admin access confirmed', {
        user: {
          id: req.user.id,
          role: req.user.role,
          name: `${req.user.firstName} ${req.user.lastName}`,
        },
        message: 'You have successfully accessed an admin-only endpoint'
      })
    );
});

/**
 * Activate user account
 * Changes user status from PENDING_VERIFICATION to ACTIVE
 */
export const activateAccount = asyncHandler(async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      throw new ApiError(HTTP_UNAUTHORIZED, 'User not authenticated');
    }
    
    // Fetch current user status
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { status: true }
    });
    
    if (!user) {
      throw new ApiError(HTTP_NOT_FOUND, 'User not found');
    }
    
    if (user.status !== 'PENDING_VERIFICATION') {
      throw new ApiError(
        HTTP_BAD_REQUEST, 
        `Account activation failed. Current status: ${user.status}`
      );
    }
    
    // Update user status to ACTIVE
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        role: true,
        status: true,
        emailVerified: true,
        phoneVerified: true,
      }
    });
    
    console.log(`User ${userId} activated successfully`);
    
    // Generate new tokens with updated user info
    const { accessToken, refreshToken } = await authService.generateNewTokensForUser(updatedUser);
    
    // Set cookies directly with the new tokens
    res.cookie('accessToken', accessToken, accessTokenCookieOptions);
    res.cookie('refreshToken', refreshToken, refreshTokenCookieOptions);
    
    return res
      .status(HTTP_OK)
      .json(
        new ApiResponse(HTTP_OK, 'Account activated successfully', {
          user: updatedUser,
          accessToken,
          refreshToken
        })
      );
  } catch (error) {
    throw new ApiError(
      HTTP_INTERNAL_SERVER_ERROR,
      error.message || 'Error activating account'
    );
  }
}); 