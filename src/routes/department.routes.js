import { Router } from 'express';
import {
    createDepartment,
    getAllDepartments,
    getDepartmentById,
    getProductsByDepartment,
    updateDepartment,
    deleteDepartment
} from '../controllers/department.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';

const router = Router();

// Public routes
router.get('/', getAllDepartments);
router.get('/:departmentId', getDepartmentById);
router.get('/:departmentId/products', getProductsByDepartment);

// Protected routes - require authentication
router.post('/', verifyJWT, createDepartment);
router.put('/:departmentId', verifyJWT, updateDepartment);
router.delete('/:departmentId', verifyJWT, deleteDepartment);

export default router; 