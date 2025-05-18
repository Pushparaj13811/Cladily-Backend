import ApiResponse from "../utils/apiResponse.js";
import ApiError from "../utils/apiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { CategoryService } from "../services/category.service.js";
import {
    HTTP_BAD_REQUEST,
    HTTP_CREATED,
    HTTP_INTERNAL_SERVER_ERROR,
    HTTP_NOT_FOUND,
    HTTP_OK,
    HTTP_UNAUTHORIZED,
} from "../httpStatusCode.js";

// Initialize service
const categoryService = new CategoryService();

/**
 * Create a new category
 */
const createCategory = asyncHandler(async (req, res) => {
    const { 
        name, 
        slug, 
        description, 
        parentId, 
        isActive, 
        isVisible, 
        metaTitle, 
        metaDescription, 
        metaKeywords, 
        imageUrl, 
        iconUrl, 
        sortOrder 
    } = req.body;

    // Validate required fields
    if (!name || !name.trim()) {
        throw new ApiError(HTTP_BAD_REQUEST, "Category name is required");
    }

    try {
        const category = await categoryService.createCategory({
            name,
            slug,
            description,
            parentId,
            isActive,
            isVisible,
            metaTitle,
            metaDescription,
            metaKeywords,
            imageUrl,
            iconUrl,
            sortOrder
        });

        return res
            .status(HTTP_CREATED)
            .json(new ApiResponse(HTTP_CREATED, "Category created successfully", category));
    } catch (error) {
        if (error.message === 'Category with this name already exists' || 
            error.message === 'Category with this slug already exists') {
            throw new ApiError(HTTP_BAD_REQUEST, error.message);
        }
        
        if (error.message === 'Parent category not found') {
            throw new ApiError(HTTP_NOT_FOUND, error.message);
        }
        
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error creating category"
        );
    }
});

/**
 * Get all categories
 */
const getCategories = asyncHandler(async (req, res) => {
    const includeInactive = req.query.includeInactive === 'true';
    const onlyRootCategories = req.query.onlyRootCategories === 'true';
    const includeDeleted = req.query.includeDeleted === 'true';

    try {
        const categories = await categoryService.getCategories({
            includeInactive,
            onlyRootCategories,
            includeDeleted
        });

        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Categories fetched successfully", categories));
    } catch (error) {
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error fetching categories"
        );
    }
});

/**
 * Get category hierarchy as a tree structure
 */
const getCategoryHierarchy = asyncHandler(async (req, res) => {
    const includeInactive = req.query.includeInactive === 'true';
    const includeDeleted = req.query.includeDeleted === 'true';

    try {
        const hierarchy = await categoryService.getCategoryHierarchy({
            includeInactive,
            includeDeleted
        });

        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Category hierarchy fetched successfully", hierarchy));
    } catch (error) {
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error fetching category hierarchy"
        );
    }
});

/**
 * Get root categories (categories without parents)
 */
const getRootCategories = asyncHandler(async (req, res) => {
    const includeInactive = req.query.includeInactive === 'true';
    const includeDeleted = req.query.includeDeleted === 'true';

    try {
        const rootCategories = await categoryService.getRootCategories({
            includeInactive,
            includeDeleted
        });

        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Root categories fetched successfully", rootCategories));
    } catch (error) {
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error fetching root categories"
        );
    }
});

/**
 * Get subcategories for a specific parent category
 */
const getSubcategories = asyncHandler(async (req, res) => {
    const parentId = req.params.parentId;
    const includeInactive = req.query.includeInactive === 'true';
    const includeDeleted = req.query.includeDeleted === 'true';
    
    if (!parentId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Parent category ID is required");
    }

    try {
        const subcategories = await categoryService.getSubcategories(parentId, {
            includeInactive,
            includeDeleted
        });

        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Subcategories fetched successfully", subcategories));
    } catch (error) {
        if (error.message === 'Parent category not found') {
            throw new ApiError(HTTP_NOT_FOUND, error.message);
        }
        
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error fetching subcategories"
        );
    }
});

/**
 * Get a category by ID
 */
const getCategoryById = asyncHandler(async (req, res) => {
    const categoryId = req.params.id;
    const includeProducts = req.query.includeProducts === 'true';
    
    if (!categoryId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Category ID is required");
    }

    try {
        const category = await categoryService.getCategoryById(categoryId, includeProducts);

        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Category fetched successfully", category));
    } catch (error) {
        if (error.message === 'Category not found') {
            throw new ApiError(HTTP_NOT_FOUND, error.message);
        }
        
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error fetching category"
        );
    }
});

/**
 * Get a category by slug
 */
const getCategoryBySlug = asyncHandler(async (req, res) => {
    const slug = req.params.slug;
    const includeProducts = req.query.includeProducts === 'true';
    
    if (!slug) {
        throw new ApiError(HTTP_BAD_REQUEST, "Category slug is required");
    }

    try {
        const category = await categoryService.getCategoryBySlug(slug, includeProducts);

        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Category fetched successfully", category));
    } catch (error) {
        if (error.message === 'Category not found') {
            throw new ApiError(HTTP_NOT_FOUND, error.message);
        }
        
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error fetching category"
        );
    }
});

/**
 * Update a category
 */
const updateCategory = asyncHandler(async (req, res) => {
    const categoryId = req.params.id;
    const { 
        name, 
        slug, 
        description, 
        parentId, 
        isActive, 
        isVisible, 
        metaTitle, 
        metaDescription, 
        metaKeywords, 
        imageUrl, 
        iconUrl, 
        sortOrder 
    } = req.body;
    
    if (!categoryId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Category ID is required");
    }
    
    // Check if there's anything to update
    if (Object.keys(req.body).length === 0) {
        throw new ApiError(HTTP_BAD_REQUEST, "No update data provided");
    }

    try {
        const updatedCategory = await categoryService.updateCategory(categoryId, {
            name,
            slug,
            description,
            parentId,
            isActive,
            isVisible,
            metaTitle,
            metaDescription,
            metaKeywords,
            imageUrl,
            iconUrl,
            sortOrder
        });

        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Category updated successfully", updatedCategory));
    } catch (error) {
        if (error.message === 'Category not found') {
            throw new ApiError(HTTP_NOT_FOUND, error.message);
        }
        
        if (error.message === 'Category with this name already exists' || 
            error.message === 'Category with this slug already exists' ||
            error.message === 'Category cannot be its own parent' ||
            error.message === 'This would create a circular reference in the category hierarchy') {
            throw new ApiError(HTTP_BAD_REQUEST, error.message);
        }
        
        if (error.message === 'Parent category not found') {
            throw new ApiError(HTTP_NOT_FOUND, error.message);
        }
        
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error updating category"
        );
    }
});

/**
 * Delete a category
 */
const deleteCategory = asyncHandler(async (req, res) => {
    const categoryId = req.params.id;
    const permanently = req.query.permanently === 'true';
    
    if (!categoryId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Category ID is required");
    }

    try {
        await categoryService.deleteCategory(categoryId, permanently);

        return res
            .status(HTTP_OK)
            .json(new ApiResponse(HTTP_OK, "Category deleted successfully", null));
    } catch (error) {
        if (error.message === 'Category not found') {
            throw new ApiError(HTTP_NOT_FOUND, error.message);
        }
        
        if (error.message === 'Cannot delete category with child categories' ||
            error.message === 'Cannot permanently delete category with associated products') {
            throw new ApiError(HTTP_BAD_REQUEST, error.message);
        }
        
        throw new ApiError(
            HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error deleting category"
        );
    }
});

export { 
    createCategory, 
    getCategories,
    getCategoryHierarchy,
    getRootCategories,
    getSubcategories,
    getCategoryById, 
    getCategoryBySlug, 
    updateCategory, 
    deleteCategory 
};
