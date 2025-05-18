import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/apiError.js";
import ApiResponse from "../utils/apiResponse.js";
import { SalesService } from "../services/sales.service.js";
import {
    HTTP_BAD_REQUEST,
    HTTP_INTERNAL_SERVER_ERROR,
    HTTP_OK,
    HTTP_UNAUTHORIZED,
    HTTP_FORBIDDEN
} from "../httpStatusCode.js";

// Initialize the service
const salesService = new SalesService();

/**
 * Get sales data for a product
 */
const getProductSales = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { user } = req;

    // Authorization check
    if (!user) {
        throw new ApiError(HTTP_UNAUTHORIZED, "Authentication required");
    }

    if (user.role !== 'ADMIN') {
        throw new ApiError(HTTP_FORBIDDEN, "Admin access required");
    }

    if (!productId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Product ID is required");
    }

    try {
        const salesData = await salesService.getProductSales(productId);
        
        return res.status(HTTP_OK).json(
            new ApiResponse(
                HTTP_OK,
                salesData,
                "Product sales data retrieved successfully"
            )
        );
    } catch (error) {
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Failed to retrieve product sales data"
        );
    }
});

/**
 * Get overall sales data
 */
const getSalesOverview = asyncHandler(async (req, res) => {
    const { user } = req;
    const { startDate, endDate, category, brand } = req.query;

    // Authorization check
    if (!user) {
        throw new ApiError(HTTP_UNAUTHORIZED, "Authentication required");
    }

    if (user.role !== 'ADMIN') {
        throw new ApiError(HTTP_FORBIDDEN, "Admin access required");
    }

    try {
        const salesData = await salesService.getSalesOverview({
            startDate,
            endDate,
            category,
            brand
        });
        
        return res.status(HTTP_OK).json(
            new ApiResponse(
                HTTP_OK,
                salesData,
                "Sales overview data retrieved successfully"
            )
        );
    } catch (error) {
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Failed to retrieve sales overview data"
        );
    }
});

/**
 * Get sales data by time period
 */
const getSalesByPeriod = asyncHandler(async (req, res) => {
    const { user } = req;
    const { period, limit } = req.query;

    // Authorization check
    if (!user) {
        throw new ApiError(HTTP_UNAUTHORIZED, "Authentication required");
    }

    if (user.role !== 'ADMIN') {
        throw new ApiError(HTTP_FORBIDDEN, "Admin access required");
    }

    try {
        const salesData = await salesService.getSalesByTimePeriod(
            period || 'monthly',
            limit ? parseInt(limit) : 12
        );
        
        return res.status(HTTP_OK).json(
            new ApiResponse(
                HTTP_OK,
                salesData,
                "Sales time period data retrieved successfully"
            )
        );
    } catch (error) {
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Failed to retrieve sales time period data"
        );
    }
});

/**
 * Get sales data by category
 */
const getSalesByCategory = asyncHandler(async (req, res) => {
    const { user } = req;

    // Authorization check
    if (!user) {
        throw new ApiError(HTTP_UNAUTHORIZED, "Authentication required");
    }

    if (user.role !== 'ADMIN') {
        throw new ApiError(HTTP_FORBIDDEN, "Admin access required");
    }

    try {
        const salesData = await salesService.getSalesByCategory();
        
        return res.status(HTTP_OK).json(
            new ApiResponse(
                HTTP_OK,
                salesData,
                "Category sales data retrieved successfully"
            )
        );
    } catch (error) {
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Failed to retrieve category sales data"
        );
    }
});

export {
    getProductSales,
    getSalesOverview,
    getSalesByPeriod,
    getSalesByCategory
};
