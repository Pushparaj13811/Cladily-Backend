import ApiError from "../utils/apiError.js";
import ApiResponse from "../utils/apiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { WishlistService } from '../services/wishlist.service.js';
import {
    HTTP_BAD_REQUEST,
    HTTP_INTERNAL_SERVER_ERROR,
    HTTP_NOT_FOUND,
    HTTP_OK,
    HTTP_UNAUTHORIZED,
} from "../httpStatusCode.js";

// Initialize service
const wishlistService = new WishlistService();

/**
 * Get user's wishlist
 */
const getWishlist = asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    
    if (!userId) {
        throw new ApiError(HTTP_UNAUTHORIZED, "You must be logged in to view your wishlist");
    }

    try {
        const wishlist = await wishlistService.getWishlist(userId);
        
        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Wishlist retrieved successfully", wishlist));
    } catch (error) {
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error retrieving wishlist"
        );
    }
});

/**
 * Add product to wishlist
 */
const addToWishlist = asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    
    if (!userId) {
        throw new ApiError(HTTP_UNAUTHORIZED, "You must be logged in to add to wishlist");
    }

    const { productId } = req.body;
    
    if (!productId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Product ID is required");
    }

    try {
        const wishlistItem = await wishlistService.addToWishlist(userId, productId);
        
        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Product added to wishlist", wishlistItem));
    } catch (error) {
        if (error.message === 'Product not found or inactive') {
            throw new ApiError(HTTP_NOT_FOUND, error.message);
        }
        
        if (error.message === 'Product already in wishlist') {
            throw new ApiError(HTTP_BAD_REQUEST, error.message);
        }
        
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error adding product to wishlist"
        );
    }
});

/**
 * Remove product from wishlist
 */
const removeFromWishlist = asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    
    if (!userId) {
        throw new ApiError(HTTP_UNAUTHORIZED, "You must be logged in to remove from wishlist");
    }

    const { productId } = req.body;
    
    if (!productId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Product ID is required");
    }

    try {
        await wishlistService.removeFromWishlist(userId, productId);
        
        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Product removed from wishlist"));
    } catch (error) {
        if (error.message === 'Wishlist not found') {
            throw new ApiError(HTTP_NOT_FOUND, error.message);
        }
        
        if (error.message === 'Product not in wishlist') {
            throw new ApiError(HTTP_NOT_FOUND, error.message);
        }
        
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error removing product from wishlist"
        );
    }
});

/**
 * Clear wishlist
 */
const clearWishlist = asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    
    if (!userId) {
        throw new ApiError(HTTP_UNAUTHORIZED, "You must be logged in to clear your wishlist");
    }

    try {
        await wishlistService.clearWishlist(userId);
        
        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Wishlist cleared successfully"));
    } catch (error) {
        if (error.message === 'Wishlist not found') {
            throw new ApiError(HTTP_NOT_FOUND, error.message);
        }
        
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error clearing wishlist"
        );
    }
});

/**
 * Check if product is in wishlist
 */
const isInWishlist = asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    
    if (!userId) {
        throw new ApiError(HTTP_UNAUTHORIZED, "You must be logged in to check wishlist");
    }

    const { productId } = req.params;
    
    if (!productId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Product ID is required");
    }

    try {
        const isInWishlist = await wishlistService.isInWishlist(userId, productId);
        
        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Wishlist status retrieved", { isInWishlist }));
    } catch (error) {
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error checking wishlist status"
        );
    }
});

export { 
    getWishlist, 
    addToWishlist, 
    removeFromWishlist, 
    clearWishlist, 
    isInWishlist 
};
