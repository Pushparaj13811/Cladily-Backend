import { Router } from "express";
import {
    getProductSales,
    getSalesOverview,
    getSalesByPeriod,
    getSalesByCategory
} from "../controllers/sales.controller.js";
import { authenticate, isAdmin } from "../middlewares/auth.middleware.js";
import { rateLimiter } from "../middlewares/rateLimiter.middleware.js";
import { ADMIN_API_LIMITS } from "../utils/rateLimitWindows.js";

const router = Router();

// All routes require admin access
router.use(authenticate, isAdmin);

// Get overall sales data - admin dashboard route
router.get("/", rateLimiter(ADMIN_API_LIMITS.STANDARD), getSalesOverview);

// Get sales data by time period - admin dashboard route
router.get("/periods", rateLimiter(ADMIN_API_LIMITS.STANDARD), getSalesByPeriod);

// Get sales data by category - admin dashboard route
router.get("/categories", rateLimiter(ADMIN_API_LIMITS.STANDARD), getSalesByCategory);

// Get sales data for a specific product - admin dashboard route
router.get("/products/:productId", rateLimiter(ADMIN_API_LIMITS.STANDARD), getProductSales);

export default router;
