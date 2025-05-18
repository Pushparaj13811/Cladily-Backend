import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/apiError.js";
import ApiResponse from "../utils/apiResponse.js";
import { CartService } from "../services/cart.service.js";
import {
    HTTP_BAD_REQUEST,
    HTTP_CREATED,
    HTTP_INTERNAL_SERVER_ERROR,
    HTTP_NOT_FOUND,
    HTTP_OK,
} from "../httpStatusCode.js";

// Initialize service
const cartService = new CartService();

/**
 * Get cart contents
 */
const getCart = asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    const sessionId = req.cookies?.guestId;

    try {
        const cart = await cartService.getCart(userId, sessionId);
        
        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Cart retrieved successfully", cart));
    } catch (error) {
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error retrieving cart"
        );
    }
});

/**
 * Add item to cart
 */
const addToCart = asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    const sessionId = req.cookies?.guestId;

    const { productId, variantId, quantity } = req.body;

    if (!productId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Product ID is required");
    }

    if (!quantity || quantity <= 0) {
        throw new ApiError(HTTP_BAD_REQUEST, "Quantity must be greater than 0");
    }

    try {
        const cartItem = await cartService.addToCart(
            userId, 
            sessionId, 
            productId, 
            variantId || null, 
            parseInt(quantity)
        );
        
        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Item added to cart successfully", cartItem));
    } catch (error) {
        if (error.message.includes('stock')) {
            throw new ApiError(HTTP_BAD_REQUEST, error.message);
        }
        
        if (error.message.includes('limit')) {
            throw new ApiError(HTTP_BAD_REQUEST, error.message);
        }
        
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error adding item to cart"
        );
    }
});

/**
 * Update cart item
 */
const updateCart = asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    const sessionId = req.cookies?.guestId;

    const { productId, variantId, quantity, isAbsolute } = req.body;

    if (!productId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Product ID is required");
    }

    if (quantity === undefined) {
        throw new ApiError(HTTP_BAD_REQUEST, "Quantity is required");
    }

    try {
        const result = await cartService.updateCartItem(
            userId, 
            sessionId, 
            productId, 
            variantId || null, 
            parseInt(quantity), 
            isAbsolute === true
        );
        
        return res
            .status(HTTP_OK)
            .json(new ApiResponse(
                HTTP_OK, 
                result.removed ? "Item removed from cart" : "Cart updated successfully", 
                result
            ));
    } catch (error) {
        if (error.message === 'Cart not found') {
            throw new ApiError(HTTP_NOT_FOUND, error.message);
        }
        
        if (error.message === 'Product not found in cart') {
            throw new ApiError(HTTP_NOT_FOUND, error.message);
        }
        
        if (error.message.includes('limit')) {
            throw new ApiError(HTTP_BAD_REQUEST, error.message);
        }
        
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error updating cart"
        );
    }
});

/**
 * Remove item from cart
 */
const removeFromCart = asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    const sessionId = req.cookies?.guestId;

    const { productId, variantId } = req.body;

    if (!productId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Product ID is required");
    }

    try {
        await cartService.removeFromCart(userId, sessionId, productId, variantId || null);
        
        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Item removed from cart successfully"));
    } catch (error) {
        if (error.message === 'Cart not found') {
            throw new ApiError(HTTP_NOT_FOUND, error.message);
        }
        
        if (error.message === 'Product not found in cart') {
            throw new ApiError(HTTP_NOT_FOUND, error.message);
        }
        
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error removing item from cart"
        );
    }
});

/**
 * Clear cart
 */
const clearCart = asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    const sessionId = req.cookies?.guestId;

    try {
        await cartService.clearCart(userId, sessionId);
        
        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Cart cleared successfully"));
    } catch (error) {
        if (error.message === 'Cart not found') {
            throw new ApiError(HTTP_NOT_FOUND, error.message);
        }
        
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error clearing cart"
        );
    }
});

/**
 * Apply coupon to cart
 */
const applyCoupon = asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    const sessionId = req.cookies?.guestId;

    const { code } = req.body;

    if (!code) {
        throw new ApiError(HTTP_BAD_REQUEST, "Coupon code is required");
    }

    try {
        const result = await cartService.applyCoupon(userId, sessionId, code);
        
        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Coupon applied successfully", result));
    } catch (error) {
        if (error.message === 'Cart not found') {
            throw new ApiError(HTTP_NOT_FOUND, error.message);
        }
        
        if (error.message === 'Invalid or expired coupon') {
            throw new ApiError(HTTP_NOT_FOUND, error.message);
        }
        
        throw new ApiError(
            HTTP_BAD_REQUEST,
            error.message || "Error applying coupon"
        );
    }
});

/**
 * Remove coupon from cart
 */
const removeCoupon = asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    const sessionId = req.cookies?.guestId;

    const { code } = req.body;

    if (!code) {
        throw new ApiError(HTTP_BAD_REQUEST, "Coupon code is required");
    }

    try {
        await cartService.removeCoupon(userId, sessionId, code);
        
        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Coupon removed successfully"));
    } catch (error) {
        if (error.message === 'Cart not found') {
            throw new ApiError(HTTP_NOT_FOUND, error.message);
        }
        
        if (error.message === 'Coupon not applied to this cart') {
            throw new ApiError(HTTP_NOT_FOUND, error.message);
        }
        
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error removing coupon"
        );
    }
});

/**
 * Merge guest cart into user cart
 */
const mergeGuestCart = asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    const sessionId = req.cookies?.guestId;

    if (!userId) {
        throw new ApiError(HTTP_BAD_REQUEST, "User must be logged in");
    }

    if (!sessionId) {
        throw new ApiError(HTTP_BAD_REQUEST, "No guest cart to merge");
    }

    try {
        const mergedCart = await cartService.mergeGuestCart(userId, sessionId);
        
        // Clear the guest ID cookie
        res.clearCookie('guestId');
        
        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Cart merged successfully", mergedCart));
    } catch (error) {
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error merging cart"
        );
    }
});

export { 
    getCart, 
    addToCart, 
    updateCart, 
    removeFromCart, 
    clearCart, 
    applyCoupon, 
    removeCoupon,
    mergeGuestCart
}; 