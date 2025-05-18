import { prisma } from '../database/connect.js';

/**
 * Coupon Service
 * Handles all business logic related to coupons
 */
export class CouponService {
  /**
   * Create a new coupon
   * @param {Object} couponData - The coupon data
   * @param {String} userId - The ID of the user creating the coupon
   * @returns {Object} - The created coupon
   */
  async createCoupon(couponData, userId) {
    const {
      code,
      name,
      description,
      type,
      value,
      applicabilityScope,
      minimumOrderAmount,
      maximumDiscountAmount,
      isAutomaticallyApplied,
      isOneTimeUse,
      customerUsageLimit,
      priority,
      startDate,
      endDate,
      status,
      applicableProductIds,
      applicableCategoryIds
    } = couponData;

    // Validate that code is unique
    const existingCoupon = await prisma.coupon.findUnique({
      where: { code }
    });

    if (existingCoupon) {
      throw new Error('Coupon code already exists');
    }

    // Create the coupon
    const coupon = await prisma.coupon.create({
      data: {
        code,
        name,
        description,
        type,
        value,
        applicabilityScope,
        minimumOrderAmount: minimumOrderAmount || null,
        maximumDiscountAmount: maximumDiscountAmount || null,
        isAutomaticallyApplied: isAutomaticallyApplied || false,
        isOneTimeUse: isOneTimeUse || false,
        customerUsageLimit: customerUsageLimit || null,
        priority: priority || 1,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
        status,
        applicableProductIds,
        applicableCategoryIds
      }
    });

    return coupon;
  }

  /**
   * Get all coupons with pagination
   * @param {Number} page - The page number
   * @param {Number} limit - The limit per page
   * @param {Boolean} includeInactive - Whether to include inactive coupons
   * @returns {Array} - Array of coupons
   */
  async getCoupons(page = 1, limit = 10, includeInactive = false) {
    const skip = (page - 1) * limit;
    
    // Filter conditions
    const where = {
      deletedAt: null,
    };
    
    // Only show active coupons if includeInactive is false
    if (!includeInactive) {
      where.status = 'ACTIVE';
    }
    
    // Get coupons with count
    const [coupons, totalCount] = await Promise.all([
      prisma.coupon.findMany({
        where,
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit,
      }),
      prisma.coupon.count({ where })
    ]);
    
    return {
      coupons,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page
    };
  }

  /**
   * Get a coupon by ID
   * @param {String} couponId - The coupon ID
   * @returns {Object} - The coupon
   */
  async getCouponById(couponId) {
    const coupon = await prisma.coupon.findUnique({
      where: { id: couponId }
    });

    if (!coupon) {
      throw new Error('Coupon not found');
    }

    return coupon;
  }

  /**
   * Get a coupon by code
   * @param {String} code - The coupon code
   * @returns {Object} - The coupon
   */
  async getCouponByCode(code) {
    const coupon = await prisma.coupon.findUnique({
      where: { code }
    });

    if (!coupon) {
      throw new Error('Coupon not found');
    }

    return coupon;
  }

  /**
   * Update a coupon
   * @param {String} couponId - The coupon ID
   * @param {Object} couponData - The coupon data to update
   * @returns {Object} - The updated coupon
   */
  async updateCoupon(couponId, couponData) {
    // Verify the coupon exists
    const existingCoupon = await prisma.coupon.findUnique({
      where: { id: couponId }
    });

    if (!existingCoupon) {
      throw new Error('Coupon not found');
    }

    // Check if code is being changed and ensure it's unique
    if (couponData.code && couponData.code !== existingCoupon.code) {
      const codeExists = await prisma.coupon.findUnique({
        where: { code: couponData.code }
      });

      if (codeExists) {
        throw new Error('Coupon code already exists');
      }
    }

    // Update dates if provided
    if (couponData.startDate) {
      couponData.startDate = new Date(couponData.startDate);
    }
    
    if (couponData.endDate) {
      couponData.endDate = new Date(couponData.endDate);
    }

    // Update the coupon
    const updatedCoupon = await prisma.coupon.update({
      where: { id: couponId },
      data: couponData
    });

    return updatedCoupon;
  }

  /**
   * Delete a coupon
   * @param {String} couponId - The coupon ID
   * @returns {Boolean} - Success status
   */
  async deleteCoupon(couponId) {
    // Verify the coupon exists
    const existingCoupon = await prisma.coupon.findUnique({
      where: { id: couponId }
    });

    if (!existingCoupon) {
      throw new Error('Coupon not found');
    }

    // Soft delete the coupon
    await prisma.coupon.update({
      where: { id: couponId },
      data: { 
        deletedAt: new Date(),
        status: 'INACTIVE'
      }
    });

    return true;
  }

  /**
   * Apply a coupon to a cart
   * @param {String} code - The coupon code
   * @param {Number} cartTotal - The cart total
   * @param {String} userId - The user ID
   * @returns {Object} - The discount amount and coupon details
   */
  async applyCoupon(code, cartTotal, userId) {
    // Get the coupon
    const coupon = await prisma.coupon.findUnique({
      where: { code }
    });

    if (!coupon) {
      throw new Error('Coupon not found');
    }

    // Check if coupon is active
    if (coupon.status !== 'ACTIVE') {
      throw new Error('Coupon is not active');
    }

    // Check if coupon has started
    if (coupon.startDate > new Date()) {
      throw new Error('Coupon is not yet active');
    }

    // Check if coupon has expired
    if (coupon.endDate && coupon.endDate < new Date()) {
      throw new Error('Coupon has expired');
    }

    // Check minimum order amount
    if (coupon.minimumOrderAmount && parseFloat(coupon.minimumOrderAmount) > cartTotal) {
      throw new Error(`Minimum order amount of ${coupon.minimumOrderAmount} not met`);
    }

    // Check usage limit for one-time use coupons
    if (coupon.isOneTimeUse || coupon.customerUsageLimit) {
      // Count how many times this user has used this coupon
      const usageCount = await prisma.orderCoupon.count({
        where: {
          couponId: coupon.id,
          order: {
            userId
          }
        }
      });

      if (coupon.isOneTimeUse && usageCount > 0) {
        throw new Error('This coupon can only be used once per customer');
      }

      if (coupon.customerUsageLimit && usageCount >= coupon.customerUsageLimit) {
        throw new Error(`You have reached the usage limit (${coupon.customerUsageLimit}) for this coupon`);
      }
    }

    // Calculate discount amount based on coupon type
    let discountAmount = 0;

    switch (coupon.type) {
      case 'PERCENTAGE':
        discountAmount = (cartTotal * parseFloat(coupon.value)) / 100;
        // Apply maximum discount if set
        if (coupon.maximumDiscountAmount && discountAmount > parseFloat(coupon.maximumDiscountAmount)) {
          discountAmount = parseFloat(coupon.maximumDiscountAmount);
        }
        break;
      case 'FIXED_AMOUNT':
        discountAmount = parseFloat(coupon.value);
        // Ensure discount doesn't exceed cart total
        if (discountAmount > cartTotal) {
          discountAmount = cartTotal;
        }
        break;
      case 'FREE_SHIPPING':
        // For free shipping, we would typically set the shipping cost to 0
        // This would be handled differently depending on the application logic
        discountAmount = 0; // No direct cart discount
        break;
      default:
        throw new Error('Invalid coupon type');
    }

    return {
      couponId: coupon.id,
      code: coupon.code,
      discountAmount,
      type: coupon.type
    };
  }
} 