import express from 'express';
import {
  register,
  loginWithPassword,
  requestOtp,
  verifyOtp,
  logout,
  refreshAccessToken,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = express.Router();

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', register);

/**
 * @route POST /api/auth/login
 * @desc Login with phone and password
 * @access Public
 */
router.post('/login', loginWithPassword);

/**
 * @route POST /api/auth/request-otp
 * @desc Request OTP for login/registration
 * @access Public
 */
router.post('/request-otp', requestOtp);

/**
 * @route POST /api/auth/verify-otp
 * @desc Verify OTP and login
 * @access Public
 */
router.post('/verify-otp', verifyOtp);

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
router.post('/refresh-token', refreshAccessToken);

export default router; 