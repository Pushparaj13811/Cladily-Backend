import Router from "express";
import {
    createProduct,
    getProductById,
    getProductBySlug,
    getAllProducts,
    updateProduct,
    deleteProduct,
    getRelatedProducts,
    updateInventory
} from "../controllers/product.controller.js";
import { authenticate, isAdmin } from "../middlewares/auth.middleware.js";
import { handleFileUpload, handleDynamicFields } from "../middlewares/multer.middleware.js";
import { rateLimiter } from "../middlewares/rateLimiter.middleware.js";
import { PUBLIC_API_LIMITS, ADMIN_API_LIMITS } from "../utils/rateLimitWindows.js";

const router = Router();

// Custom middleware to detect search queries and apply appropriate rate limits
const searchAwareRateLimiter = (req, res, next) => {
    // Check if this is a search query
    if (req.query.search) {
        return rateLimiter(PUBLIC_API_LIMITS.SEARCH)(req, res, next);
    }
    // Otherwise use the regular product browsing limit
    return rateLimiter(PUBLIC_API_LIMITS.HIGH_VOLUME)(req, res, next);
};

// Public routes - Specific routes must come before generic patterns
router.get("/slug/:slug", rateLimiter(PUBLIC_API_LIMITS.HIGH_VOLUME), getProductBySlug);
router.get("/:productId/related", rateLimiter(PUBLIC_API_LIMITS.HIGH_VOLUME), getRelatedProducts);
router.get("/", searchAwareRateLimiter, getAllProducts);
router.get("/:productId", rateLimiter(PUBLIC_API_LIMITS.HIGH_VOLUME), getProductById);

// Admin routes (require authentication)
router.use(authenticate);

// Create product (admin only)
router.post("/", isAdmin, rateLimiter(ADMIN_API_LIMITS.WRITE), handleFileUpload, handleDynamicFields, createProduct);

// Update product (admin only)
router.put("/:productId", isAdmin, rateLimiter(ADMIN_API_LIMITS.WRITE), handleFileUpload, handleDynamicFields, updateProduct);

// Delete product (admin only)
router.delete("/:productId", isAdmin, rateLimiter(ADMIN_API_LIMITS.WRITE), deleteProduct);

// Update product inventory (admin only)
router.patch("/:productId/inventory", isAdmin, rateLimiter(ADMIN_API_LIMITS.WRITE), updateInventory);

export default router;
