import express from 'express';
import {
    createCategory,
    getCategories,
    getCategoryById,
    getCategoryBySlug,
    updateCategory,
    deleteCategory
} from '../controllers/category.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { isAdmin } from '../middlewares/role.middleware.js';

const router = express.Router();

// Public routes
router.get('/', getCategories);
router.get('/id/:id', getCategoryById);
router.get('/slug/:slug', getCategoryBySlug);

// Admin routes (requires authentication and admin role)
router.use(authenticate);
router.use(isAdmin);

router.post('/', createCategory);
router.put('/:id', updateCategory);
router.delete('/:id', deleteCategory);

export default router;
