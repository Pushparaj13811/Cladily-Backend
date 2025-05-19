import { Router } from 'express';
import {
    createDepartment,
    getAllDepartments,
    getDepartmentById,
    getProductsByDepartment,
    updateDepartment,
    deleteDepartment,
    getCategoriesByDepartment
} from '../controllers/department.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// Public routes
router.get('/', getAllDepartments);
router.get('/:departmentId', getDepartmentById);
router.get('/:departmentId/products', getProductsByDepartment);
router.get('/:departmentId/categories', getCategoriesByDepartment);

// Protected routes - require authentication
router.use(authenticate);
 
router.post('/', createDepartment);
router.put('/:departmentId', updateDepartment);
router.delete('/:departmentId', deleteDepartment);

export default router; 