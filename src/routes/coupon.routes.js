import express from 'express';
import {
    createCoupon,
    getCoupons,
    getCouponById,
    updateCoupon,
    deleteCoupon,
    applyCoupon,
} from '../controllers/coupon.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { isAdmin } from '../middlewares/role.middleware.js';
import { rateLimiter } from '../middlewares/rateLimiter.middleware.js';
import { PUBLIC_API_LIMITS, AUTHENTICATED_API_LIMITS, ADMIN_API_LIMITS } from '../utils/rateLimitWindows.js';

const router = express.Router();

// Public routes
router.get('/', rateLimiter(PUBLIC_API_LIMITS.STANDARD), getCoupons);
router.get('/:id', rateLimiter(PUBLIC_API_LIMITS.STANDARD), getCouponById);

// Protected routes
router.use(authenticate);

// Apply coupon (requires user authentication)
router.post('/apply', rateLimiter(AUTHENTICATED_API_LIMITS.WRITE), applyCoupon);

// Admin routes (requires admin role)
router.use(isAdmin);
router.post('/', rateLimiter(ADMIN_API_LIMITS.WRITE), createCoupon);
router.put('/:id', rateLimiter(ADMIN_API_LIMITS.WRITE), updateCoupon);
router.delete('/:id', rateLimiter(ADMIN_API_LIMITS.WRITE), deleteCoupon);

export default router;
