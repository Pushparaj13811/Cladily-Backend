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

const router = express.Router();

// All address routes require authentication
router.use(authenticate);

// Address routes
router.get('/', getUserAddresses);
router.get('/:addressId', getAddressById);
router.post('/', addUserAddress);
router.put('/:addressId', updateUserAddress);
router.delete('/:addressId', deleteUserAddress);
router.patch('/:addressId/default', setAddressAsDefault);

export default router; 