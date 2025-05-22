import ApiResponse from "../utils/apiResponse.js";
import ApiError from "../utils/apiError.js";
import {
    HTTP_BAD_REQUEST,
    HTTP_CREATED,
    HTTP_INTERNAL_SERVER_ERROR,
    HTTP_NOT_FOUND,
    HTTP_OK,
    HTTP_FORBIDDEN,
} from "../httpStatusCode.js";
import asyncHandler from "../utils/asyncHandler.js";
import { DepartmentService } from "../services/department.service.js";
import { ImageService } from "../services/image.service.js";

// Initialize the services
const departmentService = new DepartmentService();
const imageService = new ImageService();

/**
 * Create new department
 */
const createDepartment = asyncHandler(async (req, res) => {
    const { user } = req;
    const { name, description } = req.body;

    // Validate input
    if (!name) {
        throw new ApiError(HTTP_BAD_REQUEST, "Department name is required");
    }

    // Check if admin
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
    if (!isAdmin) {
        throw new ApiError(HTTP_FORBIDDEN, "Only admins can create departments");
    }

    try {
        let imageId = null;
        if (req.files && req.files.image && req.files.image[0]) {
            const image = await imageService.uploadImage(req.files.image[0]);
            imageId = image.public_id;
        }

        const department = await departmentService.createDepartment({
            name,
            description,
            imageId
        });

        return res.status(HTTP_CREATED).json(
            new ApiResponse(
                HTTP_CREATED,
                department,
                "Department created successfully"
            )
        );
    } catch (error) {
        console.error("Error in createDepartment:", error);
        throw new ApiError(
            error.statusCode || HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error creating department"
        );
    }
});

/**
 * Get all departments
 */
const getAllDepartments = asyncHandler(async (req, res) => {
    try {
        const departments = await departmentService.getAllDepartments();

        return res.status(HTTP_OK).json(
            new ApiResponse(
                HTTP_OK,
                departments,
                "Departments fetched successfully"
            )
        );
    } catch (error) {
        console.error("Error in getAllDepartments:", error);
        throw new ApiError(
            error.statusCode || HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error fetching departments"
        );
    }
});

/**
 * Get department by ID
 */
const getDepartmentById = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;

    if (!departmentId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Department ID is required");
    }

    try {
        const department = await departmentService.getDepartmentById(departmentId);

        return res.status(HTTP_OK).json(
            new ApiResponse(
                HTTP_OK,
                department,
                "Department fetched successfully"
            )
        );
    } catch (error) {
        if (error.message === "Department not found") {
            throw new ApiError(HTTP_NOT_FOUND, "Department not found");
        }

        console.error("Error in getDepartmentById:", error);
        throw new ApiError(
            error.statusCode || HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error fetching department"
        );
    }
});

/**
 * Get products by department
 */
const getProductsByDepartment = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    const { page, limit, status, category, brand, search, minPrice, maxPrice, sortBy, sortOrder } = req.query;

    if (!departmentId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Department ID is required");
    }

    try {
        const result = await departmentService.getProductsByDepartment(departmentId, {
            page,
            limit,
            status,
            category,
            brand,
            search,
            minPrice,
            maxPrice,
            sortBy,
            sortOrder
        });

        return res.status(HTTP_OK).json(
            new ApiResponse(
                HTTP_OK,
                result,
                "Department products fetched successfully"
            )
        );
    } catch (error) {
        if (error.message === "Department not found") {
            throw new ApiError(HTTP_NOT_FOUND, "Department not found");
        }

        console.error("Error in getProductsByDepartment:", error);
        throw new ApiError(
            error.statusCode || HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error fetching department products"
        );
    }
});

/**
 * Update department
 */
const updateDepartment = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    const { user } = req;
    const { name, description } = req.body;

    if (!departmentId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Department ID is required");
    }

    // Check if admin
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
    if (!isAdmin) {
        throw new ApiError(HTTP_FORBIDDEN, "Only admins can update departments");
    }

    try {
        const updateData = { name, description };

        // Handle image upload if present
        if (req.files && req.files.image && req.files.image[0]) {
            const image = await imageService.uploadImage(req.files.image[0]);
            console.log("Image uploaded:", image);
            updateData.imageId = image.public_id;
        }

        const department = await departmentService.updateDepartment(departmentId, updateData);

        return res.status(HTTP_OK).json(
            new ApiResponse(
                HTTP_OK,
                department,
                "Department updated successfully"
            )
        );
    } catch (error) {
        if (error.message === "Department not found") {
            throw new ApiError(HTTP_NOT_FOUND, "Department not found");
        }

        console.error("Error in updateDepartment:", error);
        throw new ApiError(
            error.statusCode || HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error updating department"
        );
    }
});

/**
 * Delete department
 */
const deleteDepartment = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;
    const { user } = req;

    if (!departmentId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Department ID is required");
    }

    // Check if admin
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
    if (!isAdmin) {
        throw new ApiError(HTTP_FORBIDDEN, "Only admins can delete departments");
    }

    try {
        await departmentService.deleteDepartment(departmentId);

        return res.status(HTTP_OK).json(
            new ApiResponse(
                HTTP_OK,
                null,
                "Department deleted successfully"
            )
        );
    } catch (error) {
        if (error.message === "Department not found") {
            throw new ApiError(HTTP_NOT_FOUND, "Department not found");
        }

        console.error("Error in deleteDepartment:", error);
        throw new ApiError(
            error.statusCode || HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error deleting department"
        );
    }
});

/**
 * Get categories by department
 */
const getCategoriesByDepartment = asyncHandler(async (req, res) => {
    const { departmentId } = req.params;

    if (!departmentId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Department ID is required");
    }

    try {
        const department = await departmentService.getDepartmentById(departmentId);

        return res.status(HTTP_OK).json(
            new ApiResponse(
                HTTP_OK,
                department.categories,
                "Department categories fetched successfully"
            )
        );
    } catch (error) {
        if (error.message === "Department not found") {
            throw new ApiError(HTTP_NOT_FOUND, "Department not found");
        }

        console.error("Error in getCategoriesByDepartment:", error);
        throw new ApiError(
            error.statusCode || HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error fetching department categories"
        );
    }
});

export {
    createDepartment,
    getAllDepartments,
    getDepartmentById,
    getProductsByDepartment,
    updateDepartment,
    deleteDepartment,
    getCategoriesByDepartment
}; 