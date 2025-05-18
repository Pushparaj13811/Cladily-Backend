import express from 'express';
import {
    getUserAddresses,
    getAddressById,
    addUserAddress,
    updateUserAddress,
    deleteUserAddress,
    setAddressAsDefault,
} from '../controllers/address.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { rateLimiter } from '../middlewares/rateLimiter.middleware.js';
import { AUTHENTICATED_API_LIMITS } from '../utils/rateLimitWindows.js';

const router = express.Router();

// All address routes require authentication
router.use(authenticate);

// Read operations
router.get('/', rateLimiter(AUTHENTICATED_API_LIMITS.STANDARD), getUserAddresses);
router.get('/:addressId', rateLimiter(AUTHENTICATED_API_LIMITS.STANDARD), getAddressById);

// Write operations
router.post('/', rateLimiter(AUTHENTICATED_API_LIMITS.WRITE), addUserAddress);
router.put('/:addressId', rateLimiter(AUTHENTICATED_API_LIMITS.WRITE), updateUserAddress);
router.delete('/:addressId', rateLimiter(AUTHENTICATED_API_LIMITS.WRITE), deleteUserAddress);
router.patch('/:addressId/default', rateLimiter(AUTHENTICATED_API_LIMITS.WRITE), setAddressAsDefault);

export default router; 