import express from 'express';
import {
    getUserProfile,
    updateUserProfile,
    changePassword,
    forgotPassword,
    resetPassword,
    resendVerificationEmail,
    verifyEmail,
    getUserAddresses,
    addUserAddress,
    updateUserAddress,
    deleteUserAddress,
    requestPhoneVerification,
    verifyPhone,
} from '../controllers/user.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

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
router.post('/change-password', changePassword);
router.post('/resend-verification', resendVerificationEmail);

// Phone verification
router.post('/request-phone-verification', requestPhoneVerification);
router.post('/verify-phone', verifyPhone);

// Address routes
router.get('/addresses', getUserAddresses);
router.post('/addresses', addUserAddress);
router.put('/addresses/:addressId', updateUserAddress);
router.delete('/addresses/:addressId', deleteUserAddress);

export default router;
