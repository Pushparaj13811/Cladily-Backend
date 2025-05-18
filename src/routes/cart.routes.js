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

const router = express.Router();

// All cart routes require either user authentication or a guest ID
router.use(createGuestId);

// Routes that don't require authentication (work with guest ID)
router.get('/', getCart);
router.post('/add', addToCart);
router.put('/update', updateCart);
router.delete('/remove', removeFromCart);
router.delete('/clear', clearCart);
router.post('/coupon/apply', applyCoupon);
router.delete('/coupon/remove', removeCoupon);

// Routes that require authentication
router.use(authenticate);
router.post('/merge', mergeGuestCart);

export default router;