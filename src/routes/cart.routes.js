import express from 'express';
import {
    getCart,
    addToCart,
    updateCart,
    removeFromCart,
    clearCart,
    applyCoupon,
    removeCoupon,
    mergeGuestCart
} from '../controllers/cart.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { createGuestId } from '../middlewares/guest.middleware.js';
import { rateLimiter } from '../middlewares/rateLimiter.middleware.js';
import { PUBLIC_API_LIMITS, AUTHENTICATED_API_LIMITS } from '../utils/rateLimitWindows.js';

const router = express.Router();

// All cart routes require either user authentication or a guest ID
router.use(createGuestId);

// Routes that don't require authentication (work with guest ID)
router.get('/', rateLimiter(PUBLIC_API_LIMITS.STANDARD), getCart);
router.post('/add', rateLimiter(PUBLIC_API_LIMITS.WRITE), addToCart);
router.put('/update', rateLimiter(PUBLIC_API_LIMITS.WRITE), updateCart);
router.delete('/remove', rateLimiter(PUBLIC_API_LIMITS.WRITE), removeFromCart);
router.delete('/clear', rateLimiter(PUBLIC_API_LIMITS.WRITE), clearCart);
router.post('/coupon/apply', rateLimiter(PUBLIC_API_LIMITS.WRITE), applyCoupon);
router.delete('/coupon/remove', rateLimiter(PUBLIC_API_LIMITS.WRITE), removeCoupon);

// Routes that require authentication
router.use(authenticate);
router.post('/merge', rateLimiter(AUTHENTICATED_API_LIMITS.WRITE), mergeGuestCart);

export default router;