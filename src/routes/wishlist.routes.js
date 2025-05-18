import express from 'express';
import {
    getWishlist,
    addToWishlist,
    removeFromWishlist,
    clearWishlist,
    isInWishlist
} from '../controllers/wishlist.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { rateLimiter } from '../middlewares/rateLimiter.middleware.js';
import { AUTHENTICATED_API_LIMITS } from '../utils/rateLimitWindows.js';

const router = express.Router();

// All wishlist routes require authentication
router.use(authenticate);

// GET routes - read operations
router.get('/', rateLimiter(AUTHENTICATED_API_LIMITS.STANDARD), getWishlist);
router.get('/check/:productId', rateLimiter(AUTHENTICATED_API_LIMITS.STANDARD), isInWishlist);

// POST routes - write operations
router.post('/add', rateLimiter(AUTHENTICATED_API_LIMITS.WRITE), addToWishlist);

// DELETE routes - write operations
router.delete('/remove', rateLimiter(AUTHENTICATED_API_LIMITS.WRITE), removeFromWishlist);
router.delete('/clear', rateLimiter(AUTHENTICATED_API_LIMITS.WRITE), clearWishlist);

export default router; 