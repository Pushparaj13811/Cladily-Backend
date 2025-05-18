import express from 'express';
import {
    createOrder,
    getAllOrders,
    getOrderById,
    updateOrderStatus,
    cancelOrder,
    cancelOrderItems,
    returnProduct
} from "../controllers/order.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { rateLimiter } from "../middlewares/rateLimiter.middleware.js";
import { AUTHENTICATED_API_LIMITS } from "../utils/rateLimitWindows.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all orders for the user - read operation
router.get('/', rateLimiter(AUTHENTICATED_API_LIMITS.STANDARD), getAllOrders);

// Get a specific order - read operation
router.get('/:orderId', rateLimiter(AUTHENTICATED_API_LIMITS.STANDARD), getOrderById);

// Create a new order - write operation
router.post('/create', rateLimiter(AUTHENTICATED_API_LIMITS.WRITE), createOrder);

// Update order status (admin only) - write operation
router.patch('/:orderId/status', rateLimiter(AUTHENTICATED_API_LIMITS.WRITE), updateOrderStatus);

// Cancel an order - sensitive operation
router.post('/:orderId/cancel', rateLimiter(AUTHENTICATED_API_LIMITS.SENSITIVE), cancelOrder);

// Cancel specific items in an order - sensitive operation
router.post('/:orderId/cancel-items', rateLimiter(AUTHENTICATED_API_LIMITS.SENSITIVE), cancelOrderItems);

// Return a product - sensitive operation
router.post('/items/:orderItemId/return', rateLimiter(AUTHENTICATED_API_LIMITS.SENSITIVE), returnProduct);

export default router;
