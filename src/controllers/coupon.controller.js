import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/apiError.js";
import ApiResponse from "../utils/apiResponse.js";
import { CouponService } from "../services/coupon.service.js";
import {
    HTTP_BAD_REQUEST,
    HTTP_CREATED,
    HTTP_INTERNAL_SERVER_ERROR,
    HTTP_NOT_FOUND,
    HTTP_OK,
} from "../httpStatusCode.js";

// Initialize service
const couponService = new CouponService();

/**
 * Create a new coupon
 */
const createCoupon = asyncHandler(async (req, res) => {
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
    } = req.body;

    // Validate required fields
    if (!code || !name || !type || !value || !startDate) {
        throw new ApiError(
            HTTP_BAD_REQUEST,
            "Required fields are missing. Please provide code, name, type, value, and startDate."
        );
    }

    try {
        const coupon = await couponService.createCoupon({
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
        }, req.user.id);

        return res
            .status(HTTP_CREATED)
            .json(new ApiResponse(HTTP_CREATED, "Coupon created successfully", coupon));
    } catch (error) {
        if (error.message === 'Coupon code already exists') {
            throw new ApiError(HTTP_BAD_REQUEST, error.message);
        }

        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error creating coupon"
        );
    }
});

/**
 * Get all coupons with pagination
 */
const getCoupons = asyncHandler(async (req, res) => {
    const page = parseInt(req.query?.page) || 1;
    const limit = parseInt(req.query?.limit) || 10;
    const includeInactive = req.query?.includeInactive === 'true';

    try {
        const result = await couponService.getCoupons(page, limit, includeInactive);

        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Coupons fetched successfully", result));
    } catch (error) {
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error fetching coupons"
        );
    }
});

/**
 * Get a coupon by ID
 */
const getCouponById = asyncHandler(async (req, res) => {
    const couponId = req.params?.id;

    if (!couponId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Coupon ID is required");
    }

    try {
        const coupon = await couponService.getCouponById(couponId);

        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Coupon fetched successfully", coupon));
    } catch (error) {
        if (error.message === 'Coupon not found') {
            throw new ApiError(HTTP_NOT_FOUND, error.message);
        }

        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error fetching coupon"
        );
    }
});

/**
 * Update a coupon
 */
const updateCoupon = asyncHandler(async (req, res) => {
    const couponId = req.params?.id;

    if (!couponId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Coupon ID is required");
    }

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
    } = req.body;

    // Check if at least one field is provided for update
    if (Object.keys(req.body).length === 0) {
        throw new ApiError(HTTP_BAD_REQUEST, "At least one field is required to update the coupon");
    }

    try {
        const updatedCoupon = await couponService.updateCoupon(couponId, {
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
        });

        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Coupon updated successfully", updatedCoupon));
    } catch (error) {
        if (error.message === 'Coupon not found') {
            throw new ApiError(HTTP_NOT_FOUND, error.message);
        }

        if (error.message === 'Coupon code already exists') {
            throw new ApiError(HTTP_BAD_REQUEST, error.message);
        }

        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error updating coupon"
        );
    }
});

/**
 * Delete a coupon
 */
const deleteCoupon = asyncHandler(async (req, res) => {
    const couponId = req.params?.id;

    if (!couponId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Coupon ID is required");
    }

    try {
        await couponService.deleteCoupon(couponId);

        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Coupon deleted successfully", null));
    } catch (error) {
        if (error.message === 'Coupon not found') {
            throw new ApiError(HTTP_NOT_FOUND, error.message);
        }

        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error deleting coupon"
        );
    }
});

/**
 * Apply a coupon to a cart
 */
const applyCoupon = asyncHandler(async (req, res) => {
    const { code, cartTotal } = req.body;
    const userId = req.user.id;

    if (!code) {
        throw new ApiError(HTTP_BAD_REQUEST, "Coupon code is required");
    }

    if (!cartTotal) {
        throw new ApiError(HTTP_BAD_REQUEST, "Cart total is required");
    }

    try {
        const result = await couponService.applyCoupon(code, parseFloat(cartTotal), userId);

        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Coupon applied successfully", result));
    } catch (error) {
        if (error.message === 'Coupon not found') {
            throw new ApiError(HTTP_NOT_FOUND, error.message);
        }

        throw new ApiError(
            HTTP_BAD_REQUEST,
            error.message || "Error applying coupon"
        );
    }
});

export {
    createCoupon,
    getCoupons,
    getCouponById,
    updateCoupon,
    deleteCoupon,
    applyCoupon,
};