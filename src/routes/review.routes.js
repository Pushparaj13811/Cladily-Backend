import { Router } from "express";
import {
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
} from "../controllers/review.controller.js";
import { authenticate, isAdmin } from "../middlewares/auth.middleware.js";
import { rateLimiter } from "../middlewares/rateLimiter.middleware.js";
import { PUBLIC_API_LIMITS, AUTHENTICATED_API_LIMITS, ADMIN_API_LIMITS } from "../utils/rateLimitWindows.js";

const router = Router();

// Public routes (no authentication required)
// Get reviews for a product
router.get("/product/:productId", rateLimiter(PUBLIC_API_LIMITS.STANDARD), getReviews);
// Get review statistics for a product
router.get("/product/:productId/stats", rateLimiter(PUBLIC_API_LIMITS.STANDARD), getProductReviewStats);
// Get a specific review
router.get("/:reviewId", rateLimiter(PUBLIC_API_LIMITS.STANDARD), getReview);

// User routes (authentication required)
router.use(authenticate);
// Create a new review
router.post("/", rateLimiter(AUTHENTICATED_API_LIMITS.WRITE), createReview);
// Update user's own review
router.put("/:reviewId", rateLimiter(AUTHENTICATED_API_LIMITS.WRITE), updateReview);
// Delete user's own review
router.delete("/:reviewId", rateLimiter(AUTHENTICATED_API_LIMITS.WRITE), deleteReview);
// Mark a review as helpful
router.post("/:reviewId/helpful", rateLimiter(AUTHENTICATED_API_LIMITS.STANDARD), markReviewAsHelpful);
// Report a review
router.post("/:reviewId/report", rateLimiter(AUTHENTICATED_API_LIMITS.STANDARD), reportReview);

// Admin routes
// Update review status (approve/reject)
router.patch("/:reviewId/status", isAdmin, rateLimiter(ADMIN_API_LIMITS.WRITE), updateReviewStatus);
// Add admin reply to a review
router.post("/:reviewId/reply", isAdmin, rateLimiter(ADMIN_API_LIMITS.WRITE), addReviewReply);

export default router;
