import express from 'express';
import {
    createCategory,
    getCategories,
    getCategoryHierarchy,
    getRootCategories,
    getSubcategories,
    getCategoryById,
    getCategoryBySlug,
    updateCategory,
    deleteCategory
} from '../controllers/category.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { isAdmin } from '../middlewares/role.middleware.js';
import { rateLimiter } from '../middlewares/rateLimiter.middleware.js';
import { PUBLIC_API_LIMITS, ADMIN_API_LIMITS } from '../utils/rateLimitWindows.js';

const router = express.Router();

// Public routes
router.get('/', rateLimiter(PUBLIC_API_LIMITS.HIGH_VOLUME), getCategories);
router.get('/hierarchy', rateLimiter(PUBLIC_API_LIMITS.HIGH_VOLUME), getCategoryHierarchy);
router.get('/roots', rateLimiter(PUBLIC_API_LIMITS.HIGH_VOLUME), getRootCategories);
router.get('/parent/:parentId', rateLimiter(PUBLIC_API_LIMITS.HIGH_VOLUME), getSubcategories);
router.get('/id/:id', rateLimiter(PUBLIC_API_LIMITS.HIGH_VOLUME), getCategoryById);
router.get('/slug/:slug', rateLimiter(PUBLIC_API_LIMITS.HIGH_VOLUME), getCategoryBySlug);

// Admin routes (requires authentication and admin role)
router.use(authenticate);
router.use(isAdmin);

// Admin write operations
router.post('/', rateLimiter(ADMIN_API_LIMITS.WRITE), createCategory);
router.put('/:id', rateLimiter(ADMIN_API_LIMITS.WRITE), updateCategory);
router.delete('/:id', rateLimiter(ADMIN_API_LIMITS.WRITE), deleteCategory);

export default router;
