import ApiResponse from "../utils/apiResponse.js";
import ApiError from "../utils/apiError.js";
import {
    HTTP_BAD_REQUEST,
    HTTP_CREATED,
    HTTP_INTERNAL_SERVER_ERROR,
    HTTP_NOT_FOUND,
    HTTP_FORBIDDEN,
    HTTP_OK,
} from "../httpStatusCode.js";
import asyncHandler from "../utils/asyncHandler.js";
import { ProductService } from "../services/product.service.js";

// Initialize the service
const productService = new ProductService();

/**
 * Create new product
 */
const createProduct = asyncHandler(async (req, res) => {
    const { body, files, user } = req;

    try {
        const product = await productService.createProduct(body, files?.images, user.id);

        return res.status(HTTP_CREATED).json(
            new ApiResponse(
                HTTP_CREATED, 
                product, 
                "Product created successfully"
            )
        );
    } catch (error) {
        throw new ApiError(
            error.statusCode || HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error creating product"
        );
    }
});

/**
 * Get a product by ID
 */
const getProductById = asyncHandler(async (req, res) => {
    const { productId } = req.params;

    if (!productId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Product ID is required");
    }

    try {
        const product = await productService.getProductById(productId);

        return res.status(HTTP_OK).json(
            new ApiResponse(
                HTTP_OK, 
                product, 
                "Product fetched successfully"
            )
        );
    } catch (error) {
        if (error.message === "Product not found") {
            throw new ApiError(HTTP_NOT_FOUND, "Product not found");
        }
        
        throw new ApiError(
            error.statusCode || HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error retrieving product"
        );
    }
});

/**
 * Get a product by slug
 */
const getProductBySlug = asyncHandler(async (req, res) => {
    const { slug } = req.params;

    if (!slug) {
        throw new ApiError(HTTP_BAD_REQUEST, "Product slug is required");
    }

    try {
        const product = await productService.getProductBySlug(slug);

        return res.status(HTTP_OK).json(
            new ApiResponse(
                HTTP_OK, 
                product, 
                "Product fetched successfully"
            )
        );
    } catch (error) {
        if (error.message === "Product not found") {
            throw new ApiError(HTTP_NOT_FOUND, "Product not found");
        }
        
        throw new ApiError(
            error.statusCode || HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error retrieving product"
        );
    }
});

/**
 * Get all products
 */
const getAllProducts = asyncHandler(async (req, res) => {
    try {
        const {
            page,
            limit,
            status,
            category,
            brand,
            tag,
            search,
            minPrice,
            maxPrice,
            sortBy,
            sortOrder
        } = req.query;

        const result = await productService.getProducts({
            page,
            limit,
            status,
            category,
            brand,
            tag,
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
                "Products fetched successfully"
            )
        );
    } catch (error) {
        throw new ApiError(
            error.statusCode || HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error retrieving products"
        );
    }
});

/**
 * Update a product
 */
const updateProduct = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { body, files, user } = req;

    if (!productId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Product ID is required");
    }

    try {
        // Check if admin for non-mongo systems
        const isAdmin = user.role === 'ADMIN';
        
        if (!isAdmin) {
            throw new ApiError(HTTP_FORBIDDEN, "Only admins can update products");
        }

        const product = await productService.updateProduct(
            productId, 
            body, 
            files?.images, 
            body.deleteImages ? JSON.parse(body.deleteImages) : []
        );

        return res.status(HTTP_OK).json(
            new ApiResponse(
                HTTP_OK, 
                product, 
                "Product updated successfully"
            )
        );
    } catch (error) {
        if (error.message === "Product not found") {
            throw new ApiError(HTTP_NOT_FOUND, "Product not found");
        }
        
        throw new ApiError(
            error.statusCode || HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error updating product"
        );
    }
});

/**
 * Delete a product
 */
const deleteProduct = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { user } = req;

    if (!productId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Product ID is required");
    }

    try {
        // Check if admin
        const isAdmin = user.role === 'ADMIN';
        
        if (!isAdmin) {
            throw new ApiError(HTTP_FORBIDDEN, "Only admins can delete products");
        }

        await productService.deleteProduct(productId);

        return res.status(HTTP_OK).json(
            new ApiResponse(
                HTTP_OK, 
                null, 
                "Product deleted successfully"
            )
        );
    } catch (error) {
        if (error.message === "Product not found") {
            throw new ApiError(HTTP_NOT_FOUND, "Product not found");
        }
        
        throw new ApiError(
            error.statusCode || HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error deleting product"
        );
    }
});

/**
 * Get related products
 */
const getRelatedProducts = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { limit } = req.query;

    if (!productId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Product ID is required");
    }

    try {
        const products = await productService.getRelatedProducts(productId, limit);

        return res.status(HTTP_OK).json(
            new ApiResponse(
                HTTP_OK, 
                products, 
                "Related products fetched successfully"
            )
        );
    } catch (error) {
        if (error.message === "Product not found") {
            throw new ApiError(HTTP_NOT_FOUND, "Product not found");
        }
        
        throw new ApiError(
            error.statusCode || HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error retrieving related products"
        );
    }
});

/**
 * Update product inventory
 */
const updateInventory = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { variantId, quantity } = req.body;
    const { user } = req;

    if (!productId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Product ID is required");
    }

    if (quantity === undefined) {
        throw new ApiError(HTTP_BAD_REQUEST, "Quantity is required");
    }

    try {
        // Check if admin
        const isAdmin = user.role === 'ADMIN';
        
        if (!isAdmin) {
            throw new ApiError(HTTP_FORBIDDEN, "Only admins can update inventory");
        }

        const result = await productService.updateInventory(productId, variantId, parseInt(quantity));

        return res.status(HTTP_OK).json(
            new ApiResponse(
                HTTP_OK, 
                result, 
                "Inventory updated successfully"
            )
        );
    } catch (error) {
        if (error.message.includes("not found")) {
            throw new ApiError(HTTP_NOT_FOUND, error.message);
        }
        
        throw new ApiError(
            error.statusCode || HTTP_INTERNAL_SERVER_ERROR,
            error.message || "Error updating inventory"
        );
    }
});

export {
    createProduct,
    getProductById,
    getProductBySlug,
    getAllProducts,
    updateProduct,
    deleteProduct,
    getRelatedProducts,
    updateInventory
};
