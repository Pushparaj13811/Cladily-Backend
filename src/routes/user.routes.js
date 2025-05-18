import express from 'express';
import {
    getUserProfile,
    updateUserProfile,
    changeCurrentPassword,
    forgotPassword,
    resetPassword,
    resendVerificationEmail,
    verifyEmail,
    resendVerificationCode,
    verifyPhone,
    activateUserAccount
} from '../controllers/user.controller.js';
import { authenticate, isAdmin } from '../middlewares/auth.middleware.js';
import { rateLimiter } from '../middlewares/rateLimiter.middleware.js';
import { PUBLIC_API_LIMITS, AUTHENTICATED_API_LIMITS, AUTH_LIMITS } from '../utils/rateLimitWindows.js';

const router = express.Router();

// Public routes
router.get('/verify-email/:token', rateLimiter(PUBLIC_API_LIMITS.STANDARD), verifyEmail);
router.post('/forgot-password', rateLimiter(AUTH_LIMITS.PASSWORD_RESET), forgotPassword);
router.post('/reset-password', rateLimiter(AUTH_LIMITS.PASSWORD_RESET), resetPassword);

// Protected routes
router.use(authenticate);

// Profile routes
router.get('/profile', rateLimiter(AUTHENTICATED_API_LIMITS.STANDARD), getUserProfile);
router.put('/profile', rateLimiter(AUTHENTICATED_API_LIMITS.WRITE), updateUserProfile);
router.post('/change-password', rateLimiter(AUTHENTICATED_API_LIMITS.SENSITIVE), changeCurrentPassword);
router.post('/resend-verification', rateLimiter(AUTH_LIMITS.STANDARD), resendVerificationEmail);

// Account activation route
router.post('/activate', rateLimiter(AUTHENTICATED_API_LIMITS.STANDARD), activateUserAccount);

// Phone verification
router.post('/request-phone-verification', rateLimiter(AUTH_LIMITS.OTP), resendVerificationCode);
router.post('/verify-phone', rateLimiter(AUTH_LIMITS.OTP), verifyPhone);

// Admin routes
router.get('/admin/profile', isAdmin, rateLimiter(AUTHENTICATED_API_LIMITS.STANDARD), getUserProfile);

export default router;
