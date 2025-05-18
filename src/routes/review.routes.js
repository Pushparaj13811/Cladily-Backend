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

const router = Router();

// Public routes (no authentication required)
// Get reviews for a product
router.get("/product/:productId", getReviews);
// Get review statistics for a product
router.get("/product/:productId/stats", getProductReviewStats);
// Get a specific review
router.get("/:reviewId", getReview);

// User routes (authentication required)
router.use(authenticate);
// Create a new review
router.post("/", createReview);
// Update user's own review
router.put("/:reviewId", updateReview);
// Delete user's own review
router.delete("/:reviewId", deleteReview);
// Mark a review as helpful
router.post("/:reviewId/helpful", markReviewAsHelpful);
// Report a review
router.post("/:reviewId/report", reportReview);

// Admin routes
// Update review status (approve/reject)
router.patch("/:reviewId/status", isAdmin, updateReviewStatus);
// Add admin reply to a review
router.post("/:reviewId/reply", isAdmin, addReviewReply);

export default router;
