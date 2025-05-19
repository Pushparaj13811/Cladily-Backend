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
    const { files, user } = req;
    let productData = req.body;
    
    console.log("Raw product creation request body:", JSON.stringify(productData, null, 2));
    console.log("Files received:", files?.images ? files.images.length : 0);
    
    // Handle both form data and direct JSON submissions
    // If the request is multipart/form-data, the product data might be in a JSON string
    if (typeof productData.productData === 'string') {
        try {
            const parsedData = JSON.parse(productData.productData);
            console.log("Parsed productData from JSON string:", JSON.stringify(parsedData, null, 2));
            
            // Merge parsed data with any direct fields (some implementations send both)
            productData = {
                ...productData,  // Keep original fields
                ...parsedData    // Override with parsed fields
            };
            
            // Remove the raw productData string to avoid confusion
            delete productData.productData;
            
            console.log("Merged product data:", JSON.stringify(productData, null, 2));
        } catch (error) {
            console.error("Failed to parse productData JSON:", error);
            throw new ApiError(HTTP_BAD_REQUEST, "Invalid product data format");
        }
    }
    
    // Check for individual fields that were sent directly in form data
    // This helps with implementations that append individual fields rather than using productData
    const directFields = [
        'name', 'description', 'shortDescription', 'price', 'compareAtPrice', 
        'cost', 'sku', 'barcode', 'weight', 'weightUnit', 'status', 'taxable',
        'departmentId'
    ];
    
    directFields.forEach(field => {
        if (req.body[field] !== undefined && (!productData[field] || field === 'price')) {
            try {
                // Try to parse JSON strings that might represent objects/arrays
                if (typeof req.body[field] === 'string' && 
                   (req.body[field].startsWith('[') || req.body[field].startsWith('{'))) {
                    productData[field] = JSON.parse(req.body[field]);
                } 
                // Handle numeric fields
                else if (['price', 'compareAtPrice', 'cost', 'weight'].includes(field) && 
                         typeof req.body[field] === 'string') {
                    const numValue = parseFloat(req.body[field]);
                    if (!isNaN(numValue)) {
                        productData[field] = numValue;
                    } else {
                        productData[field] = req.body[field];
                    }
                }
                // Otherwise use the value directly
                else {
                    productData[field] = req.body[field];
                }
                console.log(`Set ${field} from direct form field:`, productData[field]);
            } catch (error) {
                console.error(`Error parsing direct field ${field}:`, error);
                // Keep the original string value if parsing fails
                productData[field] = req.body[field];
            }
        }
    });
    
    // Handle specific fields that need special treatment
    
    // Parse variants to ensure proper format
    if (productData.variants && typeof productData.variants === 'string') {
        try {
            productData.variants = JSON.parse(productData.variants);
            console.log("Parsed variants:", productData.variants);
        } catch (error) {
            console.error("Failed to parse variants:", error);
            // If parsing fails, initialize as empty array
            productData.variants = [];
        }
    } else if (!productData.variants) {
        productData.variants = [];
    }
    
    // Parse categories to ensure proper format
    if (productData.categoryIds && typeof productData.categoryIds === 'string') {
        try {
            productData.categoryIds = JSON.parse(productData.categoryIds);
            console.log("Parsed categoryIds:", productData.categoryIds);
        } catch (error) {
            console.error("Failed to parse categoryIds:", error);
            // If parsing fails, initialize as empty array
            productData.categoryIds = [];
        }
    } else if (!productData.categoryIds) {
        productData.categoryIds = [];
    }
    
    // Handle departmentId
    if (productData.departmentId && typeof productData.departmentId === 'string') {
        console.log("Using department ID:", productData.departmentId);
    }
    
    // Ensure the minimum required fields are present (name, description, price)
    if (!productData.name) {
        throw new ApiError(HTTP_BAD_REQUEST, "Product name is required");
    }
    
    if (!productData.description) {
        throw new ApiError(HTTP_BAD_REQUEST, "Product description is required");
    }
    
    if (!productData.price && productData.price !== 0) {
        throw new ApiError(HTTP_BAD_REQUEST, "Product price is required");
    }
    
    try {
        // Transform categoryIds into categories array for the service
        if (productData.categoryIds && Array.isArray(productData.categoryIds)) {
            productData.categories = productData.categoryIds;
            console.log("Set categories from categoryIds:", productData.categories);
        } else if (productData.category) {
            productData.categories = [productData.category];
            console.log("Set categories from category:", productData.categories);
        }
        
        console.log("Final productData being sent to service:", JSON.stringify(productData, null, 2));
        const product = await productService.createProduct(productData, files?.images, user.id);
        console.log("Product created successfully:", product.id);

        return res.status(HTTP_CREATED).json(
            new ApiResponse(
                HTTP_CREATED, 
                product, 
                "Product created successfully"
            )
        );
    } catch (error) {
        console.error("Error in createProduct:", error);
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
        console.log("GET /products request received with query params:", req.query);
        
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

        console.log(`API response prepared: ${result.products.length} products found`);
        console.log("API response:", result);
        
        const response = new ApiResponse(
            HTTP_OK, 
            result, 
            "Products fetched successfully"
        );
        
        console.log("Sending API response:", {
            success: response.success,
            statusCode: response.statusCode,
            message: response.message,
            dataLength: result.products.length
        });
        
        return res.status(HTTP_OK).json(
            new ApiResponse(
                HTTP_OK, 
                result, 
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

    // If the request is multipart/form-data, the product data might be in a JSON string
    if (typeof updateData.productData === 'string') {
        try {
            updateData = JSON.parse(updateData.productData);
        } catch (error) {
            throw new ApiError(HTTP_BAD_REQUEST, "Invalid product data format");
        }
    }
    
    // Parse variants to ensure proper format
    if (updateData.variants && typeof updateData.variants === 'string') {
        try {
            updateData.variants = JSON.parse(updateData.variants);
        } catch {
            // If parsing fails, keep it as a string - the service will handle it
        }
    }
    
    // Parse categories to ensure proper format
    if (updateData.categoryIds && typeof updateData.categoryIds === 'string') {
        try {
            updateData.categoryIds = JSON.parse(updateData.categoryIds);
        } catch {
            // If parsing fails, keep it as a string - the service will handle it
        }
    }
    
    // Parse deleteImages to ensure proper format
    let deleteImages = [];
    if (updateData.deleteImages) {
        try {
            deleteImages = typeof updateData.deleteImages === 'string' 
                ? JSON.parse(updateData.deleteImages) 
                : updateData.deleteImages;
        } catch (error) {
            console.error('Failed to parse deleteImages:', error);
            deleteImages = [];
        }
    }

    try {
        // Check if admin for non-mongo systems
        const isAdmin = user.role === 'ADMIN';
        
        if (!isAdmin) {
            throw new ApiError(HTTP_FORBIDDEN, "Only admins can update products");
        }

        // Transform categoryIds into categories array for the service
        if (updateData.categoryIds && Array.isArray(updateData.categoryIds)) {
            updateData.categories = updateData.categoryIds;
        } else if (updateData.category) {
            updateData.categories = [updateData.category];
        }

        const product = await productService.updateProduct(
            productId, 
            updateData, 
            files?.images, 
            deleteImages
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
