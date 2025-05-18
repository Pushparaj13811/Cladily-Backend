import { Router } from "express";
import {
    getProductSales,
    getSalesOverview,
    getSalesByPeriod,
    getSalesByCategory
} from "../controllers/sales.controller.js";
import { authenticate, isAdmin } from "../middlewares/auth.middleware.js";

const router = Router();

// All routes require admin access
router.use(authenticate, isAdmin);

// Get overall sales data
router.get("/", getSalesOverview);

// Get sales data by time period
router.get("/periods", getSalesByPeriod);

// Get sales data by category
router.get("/categories", getSalesByCategory);

// Get sales data for a specific product
router.get("/products/:productId", getProductSales);

export default router;
