import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/apiError.js";
import ApiResponse from "../utils/apiResponse.js";
import { ReviewService } from "../services/review.service.js";
import {
    HTTP_BAD_REQUEST,
    HTTP_CREATED,
    HTTP_INTERNAL_SERVER_ERROR,
    HTTP_NOT_FOUND,
    HTTP_OK,
} from "../httpStatusCode.js";

// Initialize the service
const reviewService = new ReviewService();

/**
 * Create a new product review
 */
const createReview = asyncHandler(async (req, res) => {
    const { productId, rating, comment, title } = req.body;
    const userId = req.user.id;

    if (!productId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Product ID is required");
    }

    if (!rating || rating < 1 || rating > 5) {
        throw new ApiError(HTTP_BAD_REQUEST, "Rating must be between 1 and 5");
    }

    try {
        const reviewData = { rating, comment, title };
        const imageFiles = req.files?.images || [];
        
        const review = await reviewService.createReview(userId, productId, reviewData, imageFiles);
        
        return res.status(HTTP_CREATED).json(
            new ApiResponse(HTTP_CREATED, review, "Review created successfully")
        );
    } catch (error) {
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Failed to create review"
        );
    }
});

/**
 * Get reviews for a product with pagination
 */
const getReviews = asyncHandler(async (req, res) => {
    const productId = req.params.productId;

    if (!productId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Product ID is required");
    }

    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        
        const result = await reviewService.getProductReviews(productId, {
            page,
            limit,
            status: "APPROVED" // Only show approved reviews to customers
        });
        
        return res.status(HTTP_OK).json(
            new ApiResponse(
                HTTP_OK, 
                result, 
                "Reviews retrieved successfully"
            )
        );
    } catch (error) {
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Failed to retrieve reviews"
        );
    }
});

/**
 * Get a specific review by ID
 */
const getReview = asyncHandler(async (req, res) => {
    const reviewId = req.params.reviewId;

    if (!reviewId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Review ID is required");
    }

    try {
        const review = await reviewService.getReviewById(reviewId);
        
        return res.status(HTTP_OK).json(
            new ApiResponse(
                HTTP_OK,
                review,
                "Review retrieved successfully"
            )
        );
    } catch (error) {
        if (error.message === "Review not found") {
            throw new ApiError(HTTP_NOT_FOUND, "Review not found");
        }
        
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Failed to retrieve review"
        );
    }
});

/**
 * Update an existing review
 */
const updateReview = asyncHandler(async (req, res) => {
    const reviewId = req.params.reviewId;
    const userId = req.user.id;
    const { rating, comment, title } = req.body;
    
    if (!reviewId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Review ID is required");
    }

    try {
        const updateData = {};
        if (rating !== undefined) updateData.rating = rating;
        if (comment !== undefined) updateData.comment = comment;
        if (title !== undefined) updateData.title = title;
        
        const newImageFiles = req.files?.images || [];
        const deleteImageIds = req.body.deleteImages || [];
        
        const updatedReview = await reviewService.updateReview(
            reviewId,
            userId,
            updateData,
            newImageFiles,
            deleteImageIds
        );
        
        return res.status(HTTP_OK).json(
            new ApiResponse(
                HTTP_OK,
                updatedReview,
                "Review updated successfully"
            )
        );
    } catch (error) {
        if (error.message === "Review not found") {
            throw new ApiError(HTTP_NOT_FOUND, "Review not found");
        }
        
        if (error.message === "You are not authorized to update this review") {
            throw new ApiError(HTTP_BAD_REQUEST, error.message);
        }
        
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Failed to update review"
        );
    }
});

/**
 * Delete a review
 */
const deleteReview = asyncHandler(async (req, res) => {
    const reviewId = req.params.reviewId;
    const userId = req.user.id;
    const isAdmin = req.user.role === "ADMIN";
    
    if (!reviewId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Review ID is required");
    }

    try {
        await reviewService.deleteReview(reviewId, userId, isAdmin);
        
        return res.status(HTTP_OK).json(
            new ApiResponse(
                HTTP_OK,
                null,
                "Review deleted successfully"
            )
        );
    } catch (error) {
        if (error.message === "Review not found") {
            throw new ApiError(HTTP_NOT_FOUND, "Review not found");
        }
        
        if (error.message === "You are not authorized to delete this review") {
            throw new ApiError(HTTP_BAD_REQUEST, error.message);
        }
        
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Failed to delete review"
        );
    }
});

/**
 * Mark a review as helpful
 */
const markReviewAsHelpful = asyncHandler(async (req, res) => {
    const reviewId = req.params.reviewId;
    
    if (!reviewId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Review ID is required");
    }

    try {
        const result = await reviewService.markReviewAsHelpful(reviewId);
        
        return res.status(HTTP_OK).json(
            new ApiResponse(
                HTTP_OK,
                result,
                "Review marked as helpful"
            )
        );
    } catch (error) {
        if (error.message === "Review not found") {
            throw new ApiError(HTTP_NOT_FOUND, "Review not found");
        }
        
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Failed to mark review as helpful"
        );
    }
});

/**
 * Report a review
 */
const reportReview = asyncHandler(async (req, res) => {
    const reviewId = req.params.reviewId;
    const { reason } = req.body;
    
    if (!reviewId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Review ID is required");
    }

    if (!reason) {
        throw new ApiError(HTTP_BAD_REQUEST, "Report reason is required");
    }

    try {
        const result = await reviewService.reportReview(reviewId, reason);
        
        return res.status(HTTP_OK).json(
            new ApiResponse(
                HTTP_OK,
                result,
                "Review reported successfully"
            )
        );
    } catch (error) {
        if (error.message === "Review not found") {
            throw new ApiError(HTTP_NOT_FOUND, "Review not found");
        }
        
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Failed to report review"
        );
    }
});

/**
 * Get review statistics for a product
 */
const getProductReviewStats = asyncHandler(async (req, res) => {
    const productId = req.params.productId;
    
    if (!productId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Product ID is required");
    }

    try {
        const stats = await reviewService.getProductReviewStats(productId);
        
        return res.status(HTTP_OK).json(
            new ApiResponse(
                HTTP_OK,
                stats,
                "Review statistics retrieved successfully"
            )
        );
    } catch (error) {
        if (error.message === "Product not found") {
            throw new ApiError(HTTP_NOT_FOUND, "Product not found");
        }
        
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Failed to retrieve review statistics"
        );
    }
});

/**
 * Admin: Update review status (approve/reject)
 */
const updateReviewStatus = asyncHandler(async (req, res) => {
    const reviewId = req.params.reviewId;
    const { status } = req.body;
    
    // This is an admin-only endpoint
    if (req.user.role !== "ADMIN") {
        throw new ApiError(HTTP_BAD_REQUEST, "Only admins can update review status");
    }
    
    if (!reviewId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Review ID is required");
    }

    if (!status || !["APPROVED", "REJECTED"].includes(status)) {
        throw new ApiError(HTTP_BAD_REQUEST, "Valid status (APPROVED/REJECTED) is required");
    }

    try {
        const updatedReview = await reviewService.updateReviewStatus(reviewId, status);
        
        return res.status(HTTP_OK).json(
            new ApiResponse(
                HTTP_OK,
                updatedReview,
                `Review ${status.toLowerCase()} successfully`
            )
        );
    } catch (error) {
        if (error.message === "Review not found") {
            throw new ApiError(HTTP_NOT_FOUND, "Review not found");
        }
        
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Failed to update review status"
        );
    }
});

/**
 * Admin: Add reply to a review
 */
const addReviewReply = asyncHandler(async (req, res) => {
    const reviewId = req.params.reviewId;
    const { reply } = req.body;
    const adminId = req.user.id;
    
    // This is an admin-only endpoint
    if (req.user.role !== "ADMIN") {
        throw new ApiError(HTTP_BAD_REQUEST, "Only admins can reply to reviews");
    }
    
    if (!reviewId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Review ID is required");
    }

    if (!reply) {
        throw new ApiError(HTTP_BAD_REQUEST, "Reply text is required");
    }

    try {
        const updatedReview = await reviewService.addReviewReply(reviewId, adminId, reply);
        
        return res.status(HTTP_OK).json(
            new ApiResponse(
                HTTP_OK,
                updatedReview,
                "Reply added successfully"
            )
        );
    } catch (error) {
        if (error.message === "Review not found") {
            throw new ApiError(HTTP_NOT_FOUND, "Review not found");
        }
        
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Failed to add reply to review"
        );
    }
});

export { 
    createReview, 
    getReviews, 
    getReview, 
    updateReview, 
    deleteReview,
    markReviewAsHelpful,
    reportReview,
    getProductReviewStats,
    updateReviewStatus,
    addReviewReply
};
