import { prisma } from '../database/connect.js';
import { v4 as uuidv4 } from 'uuid';
import { generateOrderNumber } from '../utils/orderUtils.js';

/**
 * Order Service
 * Handles all business logic related to orders
 */
export class OrderService {
  /**
   * Create a new order from cart
   * @param {String} userId - User ID
   * @param {Object} orderData - Order data
   * @returns {Object} - Created order with payment info
   */
  async createOrder(userId, orderData) {
    const {
      shippingAddressId,
      billingAddressId,
      paymentMethod,
      notes,
      customerNotes
    } = orderData;

    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!shippingAddressId) {
      throw new Error('Shipping address is required');
    }

    if (!paymentMethod) {
      throw new Error('Payment method is required');
    }

    // Get user info for order
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        emailVerified: true,
        phoneVerified: true
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Verify user
    if (!user.emailVerified || !user.phoneVerified) {
      if (!user.emailVerified) {
        throw new Error('Please verify your email before placing an order');
      }
      if (!user.phoneVerified) {
        throw new Error('Please verify your phone before placing an order');
      }
    }

    // Get user's cart
    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: true,
            variant: true
          }
        },
        appliedCoupons: {
          include: {
            coupon: true
          }
        }
      }
    });

    if (!cart || cart.items.length === 0) {
      throw new Error('Cart is empty');
    }

    // Get shipping and billing addresses
    const shippingAddress = await prisma.address.findUnique({
      where: { id: shippingAddressId, userId }
    });

    if (!shippingAddress) {
      throw new Error('Shipping address not found');
    }

    let finalBillingAddressId = billingAddressId;
    if (!finalBillingAddressId) {
      // If billing address not provided, use shipping address
      finalBillingAddressId = shippingAddressId;
    } else {
      // Verify billing address exists and belongs to user
      const billingAddressExists = await prisma.address.findUnique({
        where: { id: finalBillingAddressId, userId }
      });

      if (!billingAddressExists) {
        throw new Error('Billing address not found');
      }
    }

    // Generate a unique order number
    const orderNumber = generateOrderNumber();

    // Create order in transaction
    return await prisma.$transaction(async (prisma) => {
      // Create order
      const order = await prisma.order.create({
        data: {
          orderNumber,
          userId,
          email: user.email,
          phone: user.phone,
          status: 'PENDING',
          paymentStatus: paymentMethod === 'COD' ? 'PENDING' : 'PENDING',
          fulfillmentStatus: 'UNFULFILLED',
          currency: 'INR',
          subtotal: cart.subtotal,
          shippingTotal: cart.shippingTotal,
          taxTotal: cart.taxTotal,
          discountTotal: cart.discountTotal,
          total: cart.total,
          notes,
          customerNotes,
          shippingAddressId,
          billingAddressId: finalBillingAddressId,
          ipAddress: orderData.ipAddress || null,
          userAgent: orderData.userAgent || null,
          estimatedDelivery: orderData.estimatedDelivery || null,
          // Create order items
          items: {
            createMany: {
              data: cart.items.map(item => ({
                productId: item.productId,
                variantId: item.variantId || null,
                name: item.product.name,
                sku: item.variant?.sku || item.product.sku || null,
                price: item.price,
                quantity: item.quantity,
                total: item.totalPrice,
                discount: 0
              }))
            }
          },
          // Create coupon records
          coupons: {
            createMany: {
              data: cart.appliedCoupons.map(couponItem => ({
                couponId: couponItem.couponId,
                code: couponItem.coupon.code,
                discountAmount: couponItem.discountAmount
              }))
            }
          }
        },
        include: {
          items: true,
          coupons: true
        }
      });

      // Create a payment record
      const payment = await prisma.payment.create({
        data: {
          orderId: order.id,
          amount: order.total,
          method: paymentMethod,
          status: paymentMethod === 'COD' ? 'PENDING' : 'PENDING'
        }
      });

      // Clear the cart after successful order creation
      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id }
      });

      await prisma.cartCoupon.deleteMany({
        where: { cartId: cart.id }
      });

      await prisma.cart.update({
        where: { id: cart.id },
        data: {
          subtotal: 0,
          total: 0,
          itemCount: 0,
          discountTotal: 0,
          taxTotal: 0,
          shippingTotal: 0
        }
      });

      // Increment the coupon usage count
      for (const couponItem of cart.appliedCoupons) {
        await prisma.coupon.update({
          where: { id: couponItem.couponId },
          data: {
            usageCount: { increment: 1 }
          }
        });
      }

      return {
        order,
        payment
      };
    });
  }

  /**
   * Get all orders for a user
   * @param {String} userId - User ID
   * @param {Object} options - Query options
   * @returns {Array} - Array of orders
   */
  async getUserOrders(userId, options = {}) {
    const { page = 1, limit = 10, status } = options;
    const skip = (page - 1) * limit;

    // Build the where clause
    const where = { userId };
    if (status) {
      where.status = status;
    }

    // Get orders with pagination
    const [orders, totalCount] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  images: {
                    take: 1
                  }
                }
              },
              variant: true
            }
          },
          payments: true,
          coupons: true,
          shippingAddress: true,
          fulfillments: true
        }
      }),
      prisma.order.count({ where })
    ]);

    return {
      orders,
      pagination: {
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
        limit
      }
    };
  }

  /**
   * Get order details
   * @param {String} orderId - Order ID
   * @param {String} userId - User ID (for authorization)
   * @returns {Object} - Order details
   */
  async getOrderDetails(orderId, userId) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                images: {
                  take: 1
                }
              }
            },
            variant: true
          }
        },
        payments: true,
        coupons: {
          include: {
            coupon: true
          }
        },
        shippingAddress: true,
        billingAddress: true,
        fulfillments: true,
        refunds: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        }
      }
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // Check if user is authorized to view this order
    if (userId && order.userId !== userId) {
      // Allow admin to view any order (add admin check here if needed)
      throw new Error('You are not authorized to view this order');
    }

    return order;
  }

  /**
   * Update order status
   * @param {String} orderId - Order ID
   * @param {String} status - New status
   * @param {String} userId - User ID (for authorization)
   * @param {Boolean} isAdmin - Whether user is admin
   * @returns {Object} - Updated order
   */
  async updateOrderStatus(orderId, status, userId, isAdmin = false) {
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // Check if user is authorized to update this order
    if (!isAdmin && order.userId !== userId) {
      throw new Error('You are not authorized to update this order');
    }

    // Validate status transition
    this.validateStatusTransition(order.status, status);

    // Update related fields based on status
    const updateData = { status };

    if (status === 'DELIVERED') {
      updateData.completedAt = new Date();
    } else if (status === 'CANCELED') {
      updateData.canceledAt = new Date();
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: updateData
    });

    return updatedOrder;
  }

  /**
   * Validate order status transition
   * @param {String} currentStatus - Current order status
   * @param {String} newStatus - New order status
   */
  validateStatusTransition(currentStatus, newStatus) {
    // Define valid status transitions
    const validTransitions = {
      'PENDING': ['PROCESSING', 'CANCELED'],
      'PROCESSING': ['SHIPPED', 'CANCELED', 'ON_HOLD'],
      'SHIPPED': ['DELIVERED', 'RETURNED', 'CANCELED'],
      'DELIVERED': ['RETURNED', 'REFUNDED'],
      'ON_HOLD': ['PROCESSING', 'CANCELED'],
      'CANCELED': [],
      'RETURNED': ['REFUNDED'],
      'REFUNDED': []
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }
  }

  /**
   * Cancel order
   * @param {String} orderId - Order ID
   * @param {String} userId - User ID
   * @param {String} reason - Cancellation reason
   * @param {Boolean} isAdmin - Whether user is admin
   * @returns {Object} - Canceled order
   */
  async cancelOrder(orderId, userId, reason, isAdmin = false) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: true,
        items: true
      }
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // Check if user is authorized to cancel this order
    if (!isAdmin && order.userId !== userId) {
      throw new Error('You are not authorized to cancel this order');
    }

    // Check if order can be canceled
    const cancelableStatuses = ['PENDING', 'PROCESSING', 'ON_HOLD'];
    if (!cancelableStatuses.includes(order.status)) {
      throw new Error(`Cannot cancel order in ${order.status} status`);
    }

    // Handle refund if payment has been made
    let refund = null;
    const completedPayment = order.payments.find(p => p.status === 'PAID');
    
    if (completedPayment) {
      // Create refund record
      refund = await prisma.refund.create({
        data: {
          orderId: order.id,
          amount: order.total,
          reason: reason || 'Order canceled',
          status: 'PENDING',
          notes: `Refund initiated for canceled order`
        }
      });
    }

    // Update order
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELED',
        cancelReason: reason || 'Order canceled by user',
        canceledAt: new Date()
      }
    });

    return {
      order: updatedOrder,
      refund
    };
  }

  /**
   * Process a return/refund request
   * @param {String} orderItemId - Order item ID
   * @param {String} userId - User ID
   * @param {Object} returnData - Return data
   * @returns {Object} - Return/refund status
   */
  async processReturn(orderItemId, userId, returnData) {
    const { reason, refundMethod } = returnData;

    if (!orderItemId || !reason || !refundMethod) {
      throw new Error('Order item ID, reason, and refund method are required');
    }

    // Get the order item
    const orderItem = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: {
        order: {
          include: {
            payments: true
          }
        }
      }
    });

    if (!orderItem) {
      throw new Error('Order item not found');
    }

    // Check if user is authorized
    if (orderItem.order.userId !== userId) {
      throw new Error('You are not authorized to return this item');
    }

    // Check if item is eligible for return
    if (orderItem.order.status !== 'DELIVERED') {
      throw new Error('Only delivered items can be returned');
    }

    // Check if return is within allowed timeframe (e.g., 7 days)
    const deliveredDate = orderItem.order.completedAt || orderItem.order.updatedAt;
    const returnWindow = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    
    if (Date.now() - deliveredDate.getTime() > returnWindow) {
      throw new Error('Return window has expired');
    }

    // Create refund record
    const refund = await prisma.refund.create({
      data: {
        orderId: orderItem.order.id,
        amount: parseFloat(orderItem.total),
        reason,
        status: 'PENDING',
        notes: `Refund for returned item: ${orderItem.name}`
      }
    });

    // Update order item
    await prisma.$transaction([
      // Mark the order item as returned
      prisma.orderItem.update({
        where: { id: orderItemId },
        data: {
          metadata: {
            ...(orderItem.metadata || {}),
            returnReason: reason,
            returnDate: new Date(),
            refundId: refund.id
          }
        }
      }),
      
      // Update order refunded amount
      prisma.order.update({
        where: { id: orderItem.order.id },
        data: {
          refundedAmount: {
            increment: parseFloat(orderItem.total)
          }
        }
      })
    ]);

    return {
      orderItemId,
      refundId: refund.id,
      refundStatus: 'PENDING',
      refundAmount: parseFloat(orderItem.total)
    };
  }
} 