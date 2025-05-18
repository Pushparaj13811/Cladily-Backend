import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/apiError.js";
import ApiResponse from "../utils/apiResponse.js";
import { AddressService } from "../services/address.service.js";
import {
    HTTP_OK,
    HTTP_CREATED,
    HTTP_BAD_REQUEST,
    HTTP_NOT_FOUND,
    HTTP_INTERNAL_SERVER_ERROR,
} from "../httpStatusCode.js";

// Initialize service
const addressService = new AddressService();

/**
 * Get user addresses
 */
export const getUserAddresses = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    try {
        const addresses = await addressService.getUserAddresses(userId);

        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "User addresses retrieved successfully", addresses));
    } catch (error) {
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error retrieving user addresses"
        );
    }
});

/**
 * Get a single address by ID
 */
export const getAddressById = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { addressId } = req.params;

    if (!addressId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Address ID is required");
    }

    try {
        const address = await addressService.getAddressById(addressId);
        
        if (address.userId !== userId) {
            throw new ApiError(HTTP_NOT_FOUND, "Address not found or unauthorized");
        }

        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Address retrieved successfully", address));
    } catch (error) {
        if (error.message === 'Address not found') {
            throw new ApiError(HTTP_NOT_FOUND, error.message);
        }
        
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error retrieving address"
        );
    }
});

/**
 * Add a new address
 */
export const addUserAddress = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { 
        fullName, 
        line1, 
        line2, 
        city, 
        state, 
        postalCode, 
        country, 
        phoneNumber,
        isDefault,
        addressType,
        isShipping,
        isBilling
    } = req.body;

    if (!fullName || !line1 || !city || !state || !postalCode || !country) {
        throw new ApiError(HTTP_BAD_REQUEST, "Required address fields are missing");
    }

    try {
        const address = await addressService.addUserAddress(userId, {
            fullName, 
            line1, 
            line2, 
            city, 
            state, 
            postalCode, 
            country, 
            phoneNumber,
            isDefault,
            addressType,
            isShipping,
            isBilling
        });

        return res
            .status(HTTP_CREATED)
            .json(new ApiResponse(HTTP_CREATED, "Address added successfully", address));
    } catch (error) {
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error adding address"
        );
    }
});

/**
 * Update an address
 */
export const updateUserAddress = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { addressId } = req.params;
    const { 
        fullName, 
        line1, 
        line2, 
        city, 
        state, 
        postalCode, 
        country, 
        phoneNumber,
        isDefault,
        addressType,
        isShipping,
        isBilling
    } = req.body;

    if (!addressId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Address ID is required");
    }

    if (!fullName || !line1 || !city || !state || !postalCode || !country) {
        throw new ApiError(HTTP_BAD_REQUEST, "Required address fields are missing");
    }

    try {
        const address = await addressService.updateUserAddress(userId, addressId, {
            fullName, 
            line1, 
            line2, 
            city, 
            state, 
            postalCode, 
            country, 
            phoneNumber,
            isDefault,
            addressType,
            isShipping,
            isBilling
        });

        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Address updated successfully", address));
    } catch (error) {
        if (error.message.includes('Address not found')) {
            throw new ApiError(HTTP_NOT_FOUND, error.message);
        }
        
        if (error.message.includes('not authorized')) {
            throw new ApiError(HTTP_NOT_FOUND, "Address not found or unauthorized");
        }
        
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error updating address"
        );
    }
});

/**
 * Delete an address
 */
export const deleteUserAddress = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { addressId } = req.params;

    if (!addressId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Address ID is required");
    }

    try {
        await addressService.deleteUserAddress(userId, addressId);

        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Address deleted successfully", null));
    } catch (error) {
        if (error.message.includes('Address not found')) {
            throw new ApiError(HTTP_NOT_FOUND, error.message);
        }
        
        if (error.message.includes('not authorized')) {
            throw new ApiError(HTTP_NOT_FOUND, "Address not found or unauthorized");
        }
        
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error deleting address"
        );
    }
});

/**
 * Set address as default
 */
export const setAddressAsDefault = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { addressId } = req.params;

    if (!addressId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Address ID is required");
    }

    try {
        const address = await addressService.setAddressAsDefault(userId, addressId);

        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Address set as default successfully", address));
    } catch (error) {
        if (error.message.includes('Address not found')) {
            throw new ApiError(HTTP_NOT_FOUND, error.message);
        }
        
        if (error.message.includes('not authorized')) {
            throw new ApiError(HTTP_NOT_FOUND, "Address not found or unauthorized");
        }
        
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error setting address as default"
        );
    }
}); 