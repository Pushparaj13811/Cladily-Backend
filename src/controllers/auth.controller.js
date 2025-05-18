import { AuthService } from '../services/auth.service.js';
import { OtpService } from '../services/otp.service.js';
import ApiError from '../utils/apiError.js';
import ApiResponse from '../utils/apiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { signCookieValue } from '../utils/tokenGenerator.js';
import {
  HTTP_OK,
  HTTP_CREATED,
  HTTP_BAD_REQUEST,
  HTTP_UNAUTHORIZED,
  HTTP_INTERNAL_SERVER_ERROR,
} from '../httpStatusCode.js';

// Initialize services
const authService = new AuthService();
const otpService = new OtpService();

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
  path: '/api/auth/refresh', // Restrict refresh token cookie to refresh endpoint
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

    // Sign cookies with COOKIE_SECRET for added security
    const signedAccessToken = signCookieValue(accessToken);
    const signedRefreshToken = signCookieValue(refreshToken);

    // Set cookies
    res.cookie('accessToken', signedAccessToken, accessTokenCookieOptions);
    res.cookie('refreshToken', signedRefreshToken, refreshTokenCookieOptions);

    return res
      .status(HTTP_OK)
      .json(
        new ApiResponse(HTTP_OK, 'Login successful', {
          user,
          accessToken, // Still send token in response for API clients
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

    // Sign cookies with COOKIE_SECRET for added security
    const signedAccessToken = signCookieValue(accessToken);
    const signedRefreshToken = signCookieValue(refreshToken);

    // Set cookies
    res.cookie('accessToken', signedAccessToken, accessTokenCookieOptions);
    res.cookie('refreshToken', signedRefreshToken, refreshTokenCookieOptions);

    return res
      .status(HTTP_OK)
      .json(
        new ApiResponse(HTTP_OK, 'OTP verified and login successful', {
          user,
          accessToken, // Still send token in response for API clients
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
  const { refreshToken } = req.cookies;
  const userId = req.user?.id;

  if (!refreshToken || !userId) {
    throw new ApiError(HTTP_BAD_REQUEST, 'User not authenticated');
  }

  try {
    await authService.logout(userId, refreshToken);

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
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    throw new ApiError(HTTP_UNAUTHORIZED, 'Refresh token is required');
  }

  try {
    const { accessToken, refreshToken: newRefreshToken } = await authService.refreshToken(
      refreshToken
    );

    // Sign cookies with COOKIE_SECRET for added security
    const signedAccessToken = signCookieValue(accessToken);
    const signedRefreshToken = signCookieValue(newRefreshToken);

    // Set new cookies
    res.cookie('accessToken', signedAccessToken, accessTokenCookieOptions);
    res.cookie('refreshToken', signedRefreshToken, refreshTokenCookieOptions);

    return res
      .status(HTTP_OK)
      .json(
        new ApiResponse(HTTP_OK, 'Access token refreshed', {
          accessToken,
        })
      );
  } catch (error) {
    // Clear cookies on error
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    throw new ApiError(HTTP_UNAUTHORIZED, 'Invalid refresh token');
  }
}); 