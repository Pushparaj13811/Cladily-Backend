import express from 'express';
import {
  register,
  loginWithPassword,
  requestOtp,
  verifyOtp,
  logout,
  refreshAccessToken,
  getUserDebugInfo,
  testAdminAccess,
  activateAccount
} from '../controllers/auth.controller.js';
import { authenticate, isAdmin } from '../middlewares/auth.middleware.js';
import { rateLimiter } from '../middlewares/rateLimiter.middleware.js';
import { AUTH_LIMITS } from '../utils/rateLimitWindows.js';

const router = express.Router();

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', rateLimiter(AUTH_LIMITS.SIGNUP), register);

/**
 * @route POST /api/auth/login
 * @desc Login with phone and password
 * @access Public
 */
router.post('/login', rateLimiter(AUTH_LIMITS.LOGIN), loginWithPassword);

/**
 * @route POST /api/auth/request-otp
 * @desc Request OTP for login/registration
 * @access Public
 */
router.post('/request-otp', rateLimiter(AUTH_LIMITS.OTP), requestOtp);

/**
 * @route POST /api/auth/verify-otp
 * @desc Verify OTP and login
 * @access Public
 */
router.post('/verify-otp', rateLimiter(AUTH_LIMITS.OTP), verifyOtp);

/**
 * @route POST /api/auth/logout
 * @desc Logout user
 * @access Private
 */
router.post('/logout', authenticate, logout);

/**
 * @route POST /api/auth/refresh-token
 * @desc Refresh access token
 * @access Public
 */
router.post('/refresh-token', rateLimiter(AUTH_LIMITS.STANDARD), refreshAccessToken);

// Also add a GET route for refresh token for more compatibility
router.get('/refresh-token', rateLimiter(AUTH_LIMITS.STANDARD), refreshAccessToken);

/**
 * @route GET /api/auth/debug
 * @desc Get detailed user info for debugging
 * @access Private
 */
router.get('/debug', authenticate, getUserDebugInfo);

/**
 * @route GET /api/auth/admin-test
 * @desc Test admin access (protected endpoint)
 * @access Admin only
 */
router.get('/admin-test', authenticate, isAdmin, testAdminAccess);

/**
 * @route POST /api/auth/activate-account
 * @desc Activate user account
 * @access Private
 */
router.post('/activate-account', authenticate, activateAccount);

export default router; 