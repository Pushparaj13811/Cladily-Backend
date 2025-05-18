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
import { handleDynamicFields, upload } from "../middlewares/multer.middleware.js";

const router = Router();

// Public routes
router.get("/", getAllProducts);
// Specific route must come before generic pattern
router.get("/slug/:slug", getProductBySlug);
router.get("/:productId/related", getRelatedProducts);
router.get("/:productId", getProductById);

// Admin routes (require authentication)
router.use(authenticate);

// Create product (admin only)
router.post("/", isAdmin, upload, handleDynamicFields, createProduct);

// Update product (admin only)
router.put("/:productId", isAdmin, upload, handleDynamicFields, updateProduct);

// Delete product (admin only)
router.delete("/:productId", isAdmin, deleteProduct);

// Update product inventory (admin only)
router.patch("/:productId/inventory", isAdmin, updateInventory);

export default router;
