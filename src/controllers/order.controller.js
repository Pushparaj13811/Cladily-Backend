import { prisma } from '../database/connect.js';
import ApiResponse from '../utils/apiResponse.js';
import ApiError from '../utils/apiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { OrderService } from '../services/order.service.js';

// Initialize service
const orderService = new OrderService();

// Create an order from the cart
const createOrder = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  if (!userId) {
    throw new ApiError(400, "User ID is required");
  }
  
  const orderData = {
    ...req.body,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  };

  try {
    const result = await orderService.createOrder(userId, orderData);
    
    return res
      .status(201)
      .json(
        new ApiResponse(
          201,
          result,
          "Order created successfully"
        )
      );
  } catch (error) {
    throw new ApiError(400, error.message || "Failed to create order");
  }
});

// Get all orders for a user
const getAllOrders = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  
  if (!userId) {
    throw new ApiError(400, "User ID is required");
  }

  const { page = 1, limit = 10, status } = req.query;
  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    status
  };
  
  const result = await orderService.getUserOrders(userId, options);
  
  return res.status(200).json(
    new ApiResponse(
      200,
      result,
      "Orders fetched successfully"
    )
  );
});

// Get order by ID
const getOrderById = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { orderId } = req.params;
  
  if (!orderId) {
    throw new ApiError(400, "Order ID is required");
  }
  
  try {
    const order = await orderService.getOrderDetails(orderId, userId);
    
    return res.status(200).json(
      new ApiResponse(
        200,
        order,
        "Order fetched successfully"
      )
    );
  } catch (error) {
    throw new ApiError(404, error.message || "Order not found");
  }
});

// Update order status
const updateOrderStatus = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { orderId } = req.params;
  const { status } = req.body;
  
  if (!orderId) {
    throw new ApiError(400, "Order ID is required");
  }
  
  if (!status) {
    throw new ApiError(400, "Status is required");
  }
  
  // Check if user is admin (add your admin check logic here)
  const isAdmin = req.user.role === "ADMIN";
  
  try {
    const updatedOrder = await orderService.updateOrderStatus(orderId, status, userId, isAdmin);
    
    return res.status(200).json(
      new ApiResponse(
        200,
        updatedOrder,
        "Order status updated successfully"
      )
    );
  } catch (error) {
    throw new ApiError(400, error.message || "Failed to update order status");
  }
});

// Cancel an order
const cancelOrder = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { orderId } = req.params;
  const { reason } = req.body;

  if (!orderId) {
    throw new ApiError(400, "Order ID is required");
  }
  
  // Check if user is admin (add your admin check logic here)
  const isAdmin = req.user.role === "ADMIN";
  
  try {
    const result = await orderService.cancelOrder(orderId, userId, reason, isAdmin);
    
    return res.status(200).json(
      new ApiResponse(
        200,
        result,
        "Order canceled successfully"
      )
    );
  } catch (error) {
    throw new ApiError(400, error.message || "Failed to cancel order");
  }
});

// Cancel order items
const cancelOrderItems = asyncHandler(async (req, res) => {
  // This functionality can be implemented in the order service
  // For now, we'll keep the existing implementation
  
  const { orderId } = req.params;
  const { items, reason } = req.body;
  const userId = req.user.id;

  if (!orderId) {
    throw new ApiError(400, "Order ID is required");
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "Items array is required");
  }

  // Fetch the order
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      payments: true
    }
  });

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  // Check if user is authorized to cancel this order
  const isAdmin = req.user.role === "ADMIN";
  if (!isAdmin && order.userId !== userId) {
    throw new ApiError(403, "You are not authorized to cancel this order");
  }

  // Check if order is in a state that allows cancellations
  const cancelableStatuses = ["PENDING", "PROCESSING", "ON_HOLD"];
  if (!cancelableStatuses.includes(order.status)) {
    throw new ApiError(400, `Cannot cancel items for an order in ${order.status} status`);
  }

  // Verify all items exist in the order
  const orderItemIds = order.items.map(item => item.id);
  for (const itemId of items) {
    if (!orderItemIds.includes(itemId)) {
      throw new ApiError(400, `Item ${itemId} does not exist in this order`);
    }
  }

  // Get the items to be canceled
  const itemsToCancel = order.items.filter(item => items.includes(item.id));
  const totalRefundAmount = itemsToCancel.reduce((sum, item) => sum + parseFloat(item.total), 0);

  let refund = null;
  const completedPayment = order.payments.find(p => p.status === "PAID");

  // Process refund if payment has been made
  if (completedPayment && totalRefundAmount > 0) {
    refund = await prisma.refund.create({
      data: {
        orderId: order.id,
        amount: totalRefundAmount,
        reason: reason || "Items canceled by user",
        status: "PENDING",
        notes: `Refund initiated for canceled items`
      }
    });
  }

  // Update order items
  const updatedItems = await Promise.all(
    itemsToCancel.map(item =>
      prisma.orderItem.update({
        where: { id: item.id },
        data: {
          status: "CANCELED",
          canceledAt: new Date(),
          metadata: {
            ...(item.metadata || {}),
            cancelReason: reason || "Canceled by user",
            refundId: refund?.id
          }
        }
      })
    )
  );

  // Update the order's total and refunded amount
  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      refundedAmount: {
        increment: totalRefundAmount
      }
    },
    include: {
      items: true
    }
  });

  // If all items are canceled, update the order status to canceled
  const allItemsCanceled = updatedOrder.items.every(item => item.status === "CANCELED");
  if (allItemsCanceled) {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "CANCELED",
        cancelReason: reason || "All items canceled",
        canceledAt: new Date()
      }
    });
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        updatedItems,
        refund,
        totalRefundAmount
      },
      "Order items canceled successfully"
    )
  );
});

// Process a return for a product
const returnProduct = asyncHandler(async (req, res) => {
  const { orderItemId } = req.params;
  const { reason, refundMethod } = req.body;
  const userId = req.user.id;

  if (!orderItemId) {
    throw new ApiError(400, "Order item ID is required");
  }

  if (!reason) {
    throw new ApiError(400, "Reason is required");
  }

  if (!refundMethod) {
    throw new ApiError(400, "Refund method is required");
  }

  try {
    const result = await orderService.processReturn(orderItemId, userId, {
      reason,
      refundMethod
    });
    
    return res.status(200).json(
      new ApiResponse(
        200,
        result,
        "Return processed successfully"
      )
    );
  } catch (error) {
    throw new ApiError(400, error.message || "Failed to process return");
  }
});

export {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  cancelOrderItems,
  returnProduct
};
