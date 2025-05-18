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

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all orders for the user
router.get('/', getAllOrders);

// Get a specific order
router.get('/:orderId', getOrderById);

// Create a new order
router.post('/create', createOrder);

// Update order status (admin only)
router.patch('/:orderId/status', updateOrderStatus);

// Cancel an order
router.post('/:orderId/cancel', cancelOrder);

// Cancel specific items in an order
router.post('/:orderId/cancel-items', cancelOrderItems);

// Return a product
router.post('/items/:orderItemId/return', returnProduct);

export default router;
