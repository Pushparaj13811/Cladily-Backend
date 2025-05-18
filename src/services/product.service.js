import { prisma } from '../database/connect.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js';
import slugify from 'slugify';

/**
 * Service for product management
 */
export class ProductService {
  /**
   * Create a new product
   * @param {Object} productData - Product data
   * @param {Array} images - Product images
   * @param {String} createdBy - User ID who created the product
   * @returns {Object} Created product
   */
  async createProduct(productData, images = [], createdBy) {
    const {
      name,
      description,
      shortDescription,
      price,
      compareAtPrice,
      cost,
      sku,
      barcode,
      weight,
      weightUnit,
      dimensions,
      taxable,
      taxCode,
      brandId,
      categories = [],
      tags = [],
      variants = [],
      status = 'DRAFT'
    } = productData;

    // Validate required fields
    if (!name || !description || !price) {
      throw new Error('Name, description, and price are required fields');
    }

    // Create slug from name
    let slug = slugify(name, { lower: true, strict: true });
    
    // Check if slug already exists
    const slugExists = await prisma.product.findUnique({
      where: { slug }
    });
    
    // If slug exists, append random string
    if (slugExists) {
      const randomSuffix = Math.random().toString(36).substring(2, 7);
      slug = `${slug}-${randomSuffix}`;
    }

    return await prisma.$transaction(async (prisma) => {
      // Create the product
      const product = await prisma.product.create({
        data: {
          name,
          slug,
          description,
          shortDescription,
          price: parseFloat(price),
          compareAtPrice: compareAtPrice ? parseFloat(compareAtPrice) : null,
          cost: cost ? parseFloat(cost) : null,
          sku,
          barcode,
          weight: weight ? parseFloat(weight) : null,
          weightUnit,
          dimensions: dimensions ? JSON.parse(dimensions) : null,
          taxable: taxable || true,
          taxCode,
          brandId,
          status
        }
      });

      // Add categories
      if (categories.length > 0) {
        for (let i = 0; i < categories.length; i++) {
          await prisma.productCategory.create({
            data: {
              productId: product.id,
              categoryId: categories[i],
              position: i
            }
          });
        }
      }

      // Add tags
      if (tags.length > 0) {
        for (const tag of tags) {
          let tagRecord;
          
          // Check if tag exists
          tagRecord = await prisma.productTag.findUnique({
            where: { name: tag }
          });
          
          // If not, create it
          if (!tagRecord) {
            tagRecord = await prisma.productTag.create({
              data: {
                name: tag,
                slug: slugify(tag, { lower: true, strict: true })
              }
            });
          }
          
          // Connect tag to product
          await prisma.product.update({
            where: { id: product.id },
            data: {
              tags: {
                connect: { id: tagRecord.id }
              }
            }
          });
        }
      }

      // Add variants
      if (variants.length > 0) {
        for (const variant of variants) {
          await prisma.productVariant.create({
            data: {
              productId: product.id,
              name: variant.name,
              sku: variant.sku,
              barcode: variant.barcode,
              price: variant.price ? parseFloat(variant.price) : null,
              compareAtPrice: variant.compareAtPrice ? parseFloat(variant.compareAtPrice) : null,
              position: variant.position || 0,
              options: variant.options,
              imageUrl: variant.imageUrl,
              inventoryQuantity: variant.inventoryQuantity || 0,
              backorder: variant.backorder || false,
              requiresShipping: variant.requiresShipping !== false
            }
          });
        }
      }

      // Upload and add images
      if (images && images.length > 0) {
        let featuredImageUrl = null;
        
        for (let i = 0; i < images.length; i++) {
          try {
            const result = await uploadToCloudinary(images[i].path);
            
            if (result && result.secure_url) {
              const imageData = {
                productId: product.id,
                url: result.secure_url,
                altText: images[i].originalname || name,
                position: i
              };
              
              await prisma.productImage.create({
                data: imageData
              });
              
              // Set first image as featured image
              if (i === 0) {
                featuredImageUrl = result.secure_url;
              }
            }
          } catch (error) {
            console.error(`Error uploading image ${i}:`, error);
            // Continue with other images
          }
        }
        
        // Update product with featured image
        if (featuredImageUrl) {
          await prisma.product.update({
            where: { id: product.id },
            data: { featuredImageUrl }
          });
        }
      }

      // Return the created product with all relationships
      return await prisma.product.findUnique({
        where: { id: product.id },
        include: {
          variants: true,
          images: true,
          categories: {
            include: {
              category: true
            }
          },
          tags: true,
          brand: true
        }
      });
    });
  }

  /**
   * Get a product by ID
   * @param {String} productId - Product ID 
   * @returns {Object} Product
   */
  async getProductById(productId) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: true,
        images: true,
        categories: {
          include: {
            category: true
          }
        },
        tags: true,
        brand: true,
        reviews: {
          where: {
            status: 'APPROVED',
            deletedAt: null
          },
          take: 5,
          orderBy: {
            createdAt: 'desc'
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true
              }
            }
          }
        }
      }
    });
    
    if (!product) {
      throw new Error('Product not found');
    }
    
    return product;
  }
  
  /**
   * Get a product by slug
   * @param {String} slug - Product slug
   * @returns {Object} Product
   */
  async getProductBySlug(slug) {
    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        variants: true,
        images: true,
        categories: {
          include: {
            category: true
          }
        },
        tags: true,
        brand: true,
        reviews: {
          where: {
            status: 'APPROVED',
            deletedAt: null
          },
          take: 5,
          orderBy: {
            createdAt: 'desc'
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true
              }
            }
          }
        }
      }
    });
    
    if (!product) {
      throw new Error('Product not found');
    }
    
    return product;
  }

  /**
   * Get all products with filtering and pagination
   * @param {Object} options - Query options (filters, pagination, sorting)
   * @returns {Object} Products and pagination info
   */
  async getProducts(options = {}) {
    const {
      page = 1,
      limit = 20,
      status = 'ACTIVE',
      category,
      brand,
      tag,
      search,
      minPrice,
      maxPrice,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;
    
    const skip = (page - 1) * limit;
    
    // Build the where clause based on filters
    const whereClause = {
      deletedAt: null
    };
    
    if (status) {
      whereClause.status = status;
    }
    
    if (minPrice !== undefined) {
      whereClause.price = {
        ...whereClause.price,
        gte: parseFloat(minPrice)
      };
    }
    
    if (maxPrice !== undefined) {
      whereClause.price = {
        ...whereClause.price,
        lte: parseFloat(maxPrice)
      };
    }
    
    if (category) {
      whereClause.categories = {
        some: {
          categoryId: category
        }
      };
    }
    
    if (brand) {
      whereClause.brandId = brand;
    }
    
    if (tag) {
      whereClause.tags = {
        some: {
          id: tag
        }
      };
    }
    
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { searchKeywords: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    // Get products with count for pagination
    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder
        },
        include: {
          images: {
            take: 1
          },
          brand: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          },
          categories: {
            include: {
              category: {
                select: {
                  id: true,
                  name: true,
                  slug: true
                }
              }
            }
          }
        }
      }),
      prisma.product.count({
        where: whereClause
      })
    ]);
    
    return {
      products,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / limit)
      }
    };
  }

  /**
   * Update a product
   * @param {String} productId - Product ID
   * @param {Object} updateData - Updated product data
   * @param {Array} newImages - New images to add
   * @param {Array} deleteImageIds - IDs of images to delete
   * @returns {Object} Updated product
   */
  async updateProduct(productId, updateData, newImages = [], deleteImageIds = []) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        images: true
      }
    });
    
    if (!product) {
      throw new Error('Product not found');
    }
    
    const {
      name,
      description,
      shortDescription,
      price,
      compareAtPrice,
      cost,
      sku,
      barcode,
      weight,
      weightUnit,
      dimensions,
      taxable,
      taxCode,
      brandId,
      categories = [],
      tags = [],
      variants = [],
      status
    } = updateData;

    // Update slug if name is changed
    let slugUpdate = {};
    if (name && name !== product.name) {
      let newSlug = slugify(name, { lower: true, strict: true });
      
      // Check if slug already exists
      const slugExists = await prisma.product.findFirst({
        where: {
          slug: newSlug,
          id: { not: productId }
        }
      });
      
      // If slug exists, append random string
      if (slugExists) {
        const randomSuffix = Math.random().toString(36).substring(2, 7);
        newSlug = `${newSlug}-${randomSuffix}`;
      }
      
      slugUpdate = { slug: newSlug };
    }

    return await prisma.$transaction(async (prisma) => {
      // Update product
      const updatedProduct = await prisma.product.update({
        where: { id: productId },
        data: {
          ...(name && { name }),
          ...slugUpdate,
          ...(description && { description }),
          ...(shortDescription !== undefined && { shortDescription }),
          ...(price && { price: parseFloat(price) }),
          ...(compareAtPrice !== undefined && { compareAtPrice: compareAtPrice ? parseFloat(compareAtPrice) : null }),
          ...(cost !== undefined && { cost: cost ? parseFloat(cost) : null }),
          ...(sku && { sku }),
          ...(barcode && { barcode }),
          ...(weight !== undefined && { weight: weight ? parseFloat(weight) : null }),
          ...(weightUnit && { weightUnit }),
          ...(dimensions && { dimensions: typeof dimensions === 'string' ? JSON.parse(dimensions) : dimensions }),
          ...(taxable !== undefined && { taxable }),
          ...(taxCode !== undefined && { taxCode }),
          ...(brandId !== undefined && { brandId }),
          ...(status && { status })
        }
      });

      // Handle categories if provided
      if (categories.length > 0) {
        // Remove existing categories
        await prisma.productCategory.deleteMany({
          where: { productId }
        });
        
        // Add new categories
        for (let i = 0; i < categories.length; i++) {
          await prisma.productCategory.create({
            data: {
              productId,
              categoryId: categories[i],
              position: i
            }
          });
        }
      }

      // Handle tags if provided
      if (tags.length > 0) {
        // Disconnect all existing tags
        await prisma.product.update({
          where: { id: productId },
          data: {
            tags: {
              set: []
            }
          }
        });
        
        // Add new tags
        for (const tag of tags) {
          let tagRecord;
          
          // Check if tag exists
          tagRecord = await prisma.productTag.findUnique({
            where: { name: tag }
          });
          
          // If not, create it
          if (!tagRecord) {
            tagRecord = await prisma.productTag.create({
              data: {
                name: tag,
                slug: slugify(tag, { lower: true, strict: true })
              }
            });
          }
          
          // Connect tag to product
          await prisma.product.update({
            where: { id: productId },
            data: {
              tags: {
                connect: { id: tagRecord.id }
              }
            }
          });
        }
      }

      // Handle variants if provided
      if (variants.length > 0) {
        for (const variant of variants) {
          if (variant.id) {
            // Update existing variant
            await prisma.productVariant.update({
              where: { id: variant.id },
              data: {
                ...(variant.name && { name: variant.name }),
                ...(variant.sku && { sku: variant.sku }),
                ...(variant.barcode && { barcode: variant.barcode }),
                ...(variant.price !== undefined && { price: variant.price ? parseFloat(variant.price) : null }),
                ...(variant.compareAtPrice !== undefined && { compareAtPrice: variant.compareAtPrice ? parseFloat(variant.compareAtPrice) : null }),
                ...(variant.position !== undefined && { position: variant.position }),
                ...(variant.options && { options: variant.options }),
                ...(variant.imageUrl && { imageUrl: variant.imageUrl }),
                ...(variant.inventoryQuantity !== undefined && { inventoryQuantity: variant.inventoryQuantity }),
                ...(variant.backorder !== undefined && { backorder: variant.backorder }),
                ...(variant.requiresShipping !== undefined && { requiresShipping: variant.requiresShipping })
              }
            });
          } else {
            // Create new variant
            await prisma.productVariant.create({
              data: {
                productId,
                name: variant.name,
                sku: variant.sku,
                barcode: variant.barcode,
                price: variant.price ? parseFloat(variant.price) : null,
                compareAtPrice: variant.compareAtPrice ? parseFloat(variant.compareAtPrice) : null,
                position: variant.position || 0,
                options: variant.options,
                imageUrl: variant.imageUrl,
                inventoryQuantity: variant.inventoryQuantity || 0,
                backorder: variant.backorder || false,
                requiresShipping: variant.requiresShipping !== false
              }
            });
          }
        }
      }

      // Handle image deletions
      if (deleteImageIds.length > 0) {
        const imagesToDelete = product.images.filter(img => deleteImageIds.includes(img.id));
        
        for (const image of imagesToDelete) {
          // Extract public ID from URL
          const publicId = image.url.split('/').pop().split('.')[0];
          await deleteFromCloudinary(publicId);
          
          // Delete image record
          await prisma.productImage.delete({
            where: { id: image.id }
          });
        }
      }

      // Handle new images
      if (newImages.length > 0) {
        let updatedFeaturedImage = false;
        const currentPosition = product.images.length - deleteImageIds.length;
        
        for (let i = 0; i < newImages.length; i++) {
          try {
            const result = await uploadToCloudinary(newImages[i].path);
            
            if (result && result.secure_url) {
              const imageData = {
                productId,
                url: result.secure_url,
                altText: newImages[i].originalname || updatedProduct.name,
                position: currentPosition + i
              };
              
              await prisma.productImage.create({
                data: imageData
              });
              
              // Update featured image if needed
              if (!updatedProduct.featuredImageUrl && !updatedFeaturedImage) {
                await prisma.product.update({
                  where: { id: productId },
                  data: { featuredImageUrl: result.secure_url }
                });
                updatedFeaturedImage = true;
              }
            }
          } catch (error) {
            console.error(`Error uploading image ${i}:`, error);
            // Continue with other images
          }
        }
      }

      // Return the updated product with all relationships
      return await prisma.product.findUnique({
        where: { id: productId },
        include: {
          variants: true,
          images: true,
          categories: {
            include: {
              category: true
            }
          },
          tags: true,
          brand: true
        }
      });
    });
  }

  /**
   * Delete a product (soft delete)
   * @param {String} productId - Product ID
   * @returns {Boolean} Success status
   */
  async deleteProduct(productId) {
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });
    
    if (!product) {
      throw new Error('Product not found');
    }
    
    // Soft delete the product
    await prisma.product.update({
      where: { id: productId },
      data: {
        deletedAt: new Date(),
        status: 'ARCHIVED'
      }
    });
    
    return true;
  }

  /**
   * Get related products
   * @param {String} productId - Product ID
   * @param {Number} limit - Number of products to return
   * @returns {Array} Related products
   */
  async getRelatedProducts(productId, limit = 5) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        categories: true,
        tags: true
      }
    });
    
    if (!product) {
      throw new Error('Product not found');
    }
    
    // Get category IDs and tag IDs
    const categoryIds = product.categories.map(pc => pc.categoryId);
    const tagIds = product.tags.map(tag => tag.id);
    
    // Find related products based on categories and tags
    const relatedProducts = await prisma.product.findMany({
      where: {
        id: { not: productId },
        status: 'ACTIVE',
        deletedAt: null,
        OR: [
          {
            categories: {
              some: {
                categoryId: { in: categoryIds }
              }
            }
          },
          {
            tags: {
              some: {
                id: { in: tagIds }
              }
            }
          }
        ]
      },
      take: limit,
      include: {
        images: {
          take: 1
        },
        categories: {
          include: {
            category: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });
    
    return relatedProducts;
  }

  /**
   * Update product inventory
   * @param {String} productId - Product ID
   * @param {String} variantId - Variant ID (optional)
   * @param {Number} quantity - Quantity change (positive for increase, negative for decrease)
   * @returns {Object} Updated product/variant
   */
  async updateInventory(productId, variantId, quantity) {
    if (!productId) {
      throw new Error('Product ID is required');
    }
    
    if (isNaN(quantity)) {
      throw new Error('Quantity must be a number');
    }
    
    if (variantId) {
      // Update variant inventory
      const variant = await prisma.productVariant.findFirst({
        where: {
          id: variantId,
          productId
        }
      });
      
      if (!variant) {
        throw new Error('Variant not found');
      }
      
      // Calculate new quantity
      const newQuantity = variant.inventoryQuantity + quantity;
      
      // Update variant inventory
      const updatedVariant = await prisma.productVariant.update({
        where: { id: variantId },
        data: {
          inventoryQuantity: newQuantity
        }
      });
      
      // Update product status if needed
      await this.updateProductStatusBasedOnInventory(productId);
      
      return updatedVariant;
    } else {
      // Update all variants
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          variants: true
        }
      });
      
      if (!product) {
        throw new Error('Product not found');
      }
      
      // If no variants, throw error
      if (product.variants.length === 0) {
        throw new Error('Product has no variants to update inventory');
      }
      
      // Update all variants
      for (const variant of product.variants) {
        await prisma.productVariant.update({
          where: { id: variant.id },
          data: {
            inventoryQuantity: variant.inventoryQuantity + quantity
          }
        });
      }
      
      // Update product status based on inventory
      await this.updateProductStatusBasedOnInventory(productId);
      
      return await prisma.product.findUnique({
        where: { id: productId },
        include: {
          variants: true
        }
      });
    }
  }

  /**
   * Update product status based on inventory
   * @param {String} productId - Product ID
   * @private
   */
  async updateProductStatusBasedOnInventory(productId) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: true
      }
    });
    
    if (!product) {
      return;
    }
    
    // If no variants, no need to update status
    if (product.variants.length === 0) {
      return;
    }
    
    // Check if all variants are out of stock
    const allOutOfStock = product.variants.every(v => v.inventoryQuantity <= 0 && !v.backorder);
    
    // Update status if needed
    if (allOutOfStock && product.status !== 'OUT_OF_STOCK') {
      await prisma.product.update({
        where: { id: productId },
        data: { status: 'OUT_OF_STOCK' }
      });
    } else if (!allOutOfStock && product.status === 'OUT_OF_STOCK') {
      await prisma.product.update({
        where: { id: productId },
        data: { status: 'ACTIVE' }
      });
    }
  }
} 