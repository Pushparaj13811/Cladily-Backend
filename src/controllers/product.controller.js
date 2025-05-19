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
import cloudinaryService from "../services/cloudinary.service.js";
import { transformProductImages, transformProductsImages } from "../utils/imageUtils.js";
import { prisma } from "../database/connect.js";

// Initialize the service
const productService = new ProductService();

/**
 * Create new product
 */
const createProduct = asyncHandler(async (req, res) => {
    const { files, user } = req;
    let productData = req.body;

    console.log("Raw product creation request body:", JSON.stringify(productData, null, 2));
    console.log("Files received:", files?.images ? files.images.length : 0);
    console.log("Files details:", files?.images ? JSON.stringify(files.images.map(f => ({
        fieldname: f.fieldname,
        originalname: f.originalname,
        path: f.path,
        size: f.size
    })), null, 2) : 'No files');

    // Handle both form data and direct JSON submissions
    if (typeof productData.productData === 'string') {
        try {
            const parsedData = JSON.parse(productData.productData);
            productData = {
                ...productData,
                ...parsedData
            };
            delete productData.productData;
        } catch (error) {
            console.error("Failed to parse productData JSON:", error);
            throw new ApiError(HTTP_BAD_REQUEST, "Invalid product data format");
        }
    }

    // Remove the images array from productData since we'll use the actual files
    if (productData.images) {
        delete productData.images;
    }

    try {
        // Ensure files.images is an array
        const imageFiles = files?.images ? (Array.isArray(files.images) ? files.images : [files.images]) : [];
        console.log("Passing images to service:", imageFiles.length);

        // Pass the files directly to the service
        const product = await productService.createProduct(productData, user.id, imageFiles);
        const transformedProduct = transformProductImages(product);

        return res.status(HTTP_CREATED).json(
            new ApiResponse(
                HTTP_CREATED,
                transformedProduct,
                "Product created successfully"
            )
        );
    } catch (error) {
        console.error("Error in createProduct controller:", error);
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
        const transformedProduct = transformProductImages(product);

        return res.status(HTTP_OK).json(
            new ApiResponse(
                HTTP_OK,
                transformedProduct,
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
            tag,
            search,
            minPrice,
            maxPrice,
            sortBy,
            sortOrder,
            departmentId
        } = req.query;

        const result = await productService.getProducts({
            page,
            limit,
            status,
            category,
            tag,
            search,
            minPrice,
            maxPrice,
            sortBy,
            sortOrder,
            department: departmentId
        });

        // Transform products to include generated image URLs
        const transformedProducts = transformProductsImages(result.products);
        const transformedResult = {
            ...result,
            products: transformedProducts
        };

        return res.status(HTTP_OK).json(
            new ApiResponse(
                HTTP_OK,
                transformedResult,
                "Products fetched successfully"
            )
        );
    } catch (error) {
        console.error("Error in getAllProducts controller:", error);
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
    const { files, user } = req;
    let updateData = req.body;

    if (!productId) {
        throw new ApiError(HTTP_BAD_REQUEST, "Product ID is required");
    }

    // Parse product data if it's a string
    if (typeof updateData.productData === 'string') {
        try {
            updateData = JSON.parse(updateData.productData);
        } catch (error) {
            throw new ApiError(HTTP_BAD_REQUEST, "Invalid product data format");
        }
    }

    // Handle image uploads
    let uploadedImages = [];
    if (files?.images) {
        try {
            uploadedImages = await cloudinaryService.uploadMultipleImages(files.images);

            // Update product data with new image public_ids
            if (uploadedImages.length > 0) {
                updateData.images = [
                    ...(updateData.images || []),
                    ...uploadedImages.map(img => ({ public_id: img.public_id }))
                ];
            }
        } catch (error) {
            console.error("Failed to upload images:", error);
            throw new ApiError(HTTP_INTERNAL_SERVER_ERROR, "Failed to upload product images");
        }
    }

    // Handle image deletions
    if (updateData.deleteImages) {
        try {
            const imagesToDelete = Array.isArray(updateData.deleteImages)
                ? updateData.deleteImages
                : [updateData.deleteImages];

            await cloudinaryService.deleteMultipleImages(imagesToDelete);
        } catch (error) {
            console.error("Failed to delete images:", error);
            throw new ApiError(HTTP_INTERNAL_SERVER_ERROR, "Failed to delete product images");
        }
    }

    try {
        const product = await productService.updateProduct(
            productId,
            updateData,
            user.id
        );

        const transformedProduct = transformProductImages(product);

        return res.status(HTTP_OK).json(
            new ApiResponse(
                HTTP_OK,
                transformedProduct,
                "Product updated successfully"
            )
        );
    } catch (error) {
        // If update fails, delete newly uploaded images
        if (uploadedImages.length > 0) {
            await cloudinaryService.deleteMultipleImages(
                uploadedImages.map(img => img.public_id)
            );
        }

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

        // Delete the product
        await productService.deleteProduct(productId);

        const images = await prisma.productImage.findMany({
            where: {
                productId: productId
            }
        });

        if (images.length > 0) {
            await cloudinaryService.deleteMultipleImages(images.map(img => img.public_id));
        }

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
