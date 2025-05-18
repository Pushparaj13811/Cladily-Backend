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
    verifyPhone
} from '../controllers/user.controller.js';
import { authenticate, isAdmin } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Public routes
router.get('/verify-email/:token', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.use(authenticate);

// Profile routes
router.get('/profile', getUserProfile);
router.put('/profile', updateUserProfile);
router.post('/change-password', changeCurrentPassword);
router.post('/resend-verification', resendVerificationEmail);

// Phone verification
router.post('/request-phone-verification', resendVerificationCode);
router.post('/verify-phone', verifyPhone);

// Admin routes
router.get('/admin/profile', isAdmin, getUserProfile);

export default router;
