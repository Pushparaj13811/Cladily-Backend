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

const router = express.Router();

// Public routes
router.get('/', getCoupons);
router.get('/:id', getCouponById);

// Protected routes
router.use(authenticate);

// Apply coupon (requires user authentication)
router.post('/apply', applyCoupon);

// Admin routes (requires admin role)
router.use(isAdmin);
router.post('/', createCoupon);
router.put('/:id', updateCoupon);
router.delete('/:id', deleteCoupon);

export default router;
