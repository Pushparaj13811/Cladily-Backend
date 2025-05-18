import express from 'express';
import {
    getWishlist,
    addToWishlist,
    removeFromWishlist,
    clearWishlist,
    isInWishlist
} from '../controllers/wishlist.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = express.Router();

// All wishlist routes require authentication
router.use(authenticate);

// GET routes
router.get('/', getWishlist);
router.get('/check/:productId', isInWishlist);

// POST routes
router.post('/add', addToWishlist);

// DELETE routes
router.delete('/remove', removeFromWishlist);
router.delete('/clear', clearWishlist);

export default router; 