import { prisma } from '../database/connect.js';

/**
 * Wishlist Service
 * Handles all business logic related to wishlists
 */
export class WishlistService {
  /**
   * Get wishlist for a user
   * @param {String} userId - User ID
   * @returns {Object} - Wishlist with items
   */
  async getWishlist(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Find or create wishlist
    let wishlist = await prisma.wishlist.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: {
                  take: 1 // Get just one image per product
                },
                variants: {
                  take: 1 // Get just first variant for preview
                }
              }
            }
          }
        }
      }
    });

    if (!wishlist) {
      // Create new wishlist
      wishlist = await prisma.wishlist.create({
        data: {
          userId
        },
        include: {
          items: true
        }
      });
    }

    // Transform wishlist items for display
    const transformedItems = wishlist.items.map(item => {
      const product = item.product;
      const mainImage = product.images[0]?.url || null;
      const firstVariant = product.variants[0] || null;
      
      return {
        id: item.id,
        productId: item.productId,
        addedAt: item.addedAt,
        name: product.name,
        description: product.description,
        price: parseFloat(firstVariant?.price || product.price),
        imageUrl: mainImage,
        slug: product.slug
      };
    });

    return {
      id: wishlist.id,
      userId: wishlist.userId,
      itemCount: transformedItems.length,
      items: transformedItems
    };
  }

  /**
   * Add product to wishlist
   * @param {String} userId - User ID
   * @param {String} productId - Product ID
   * @returns {Object} - Added wishlist item
   */
  async addToWishlist(userId, productId) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!productId) {
      throw new Error('Product ID is required');
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { 
        id: productId,
        status: 'ACTIVE',
        deletedAt: null
      }
    });

    if (!product) {
      throw new Error('Product not found or inactive');
    }

    // Find or create wishlist
    const wishlist = await prisma.wishlist.upsert({
      where: { userId },
      create: { userId },
      update: {},
      select: { id: true }
    });

    // Check if item already exists in wishlist
    const existingItem = await prisma.wishlistItem.findUnique({
      where: {
        wishlistId_productId: {
          wishlistId: wishlist.id,
          productId
        }
      }
    });

    if (existingItem) {
      throw new Error('Product already in wishlist');
    }

    // Add item to wishlist
    const wishlistItem = await prisma.wishlistItem.create({
      data: {
        wishlistId: wishlist.id,
        productId
      },
      include: {
        product: {
          select: {
            name: true,
            images: {
              take: 1
            }
          }
        }
      }
    });

    return {
      id: wishlistItem.id,
      productId: wishlistItem.productId,
      name: wishlistItem.product.name,
      imageUrl: wishlistItem.product.images[0]?.url || null,
      addedAt: wishlistItem.addedAt
    };
  }

  /**
   * Remove product from wishlist
   * @param {String} userId - User ID
   * @param {String} productId - Product ID
   * @returns {Boolean} - Success status
   */
  async removeFromWishlist(userId, productId) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!productId) {
      throw new Error('Product ID is required');
    }

    // Find wishlist
    const wishlist = await prisma.wishlist.findUnique({
      where: { userId }
    });

    if (!wishlist) {
      throw new Error('Wishlist not found');
    }

    // Find and delete wishlist item
    try {
      await prisma.wishlistItem.delete({
        where: {
          wishlistId_productId: {
            wishlistId: wishlist.id,
            productId
          }
        }
      });
      
      return true;
    } catch (error) {
      if (error.code === 'P2025') { // Record not found
        throw new Error('Product not in wishlist');
      }
      throw error;
    }
  }

  /**
   * Clear all items from wishlist
   * @param {String} userId - User ID
   * @returns {Boolean} - Success status
   */
  async clearWishlist(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Find wishlist
    const wishlist = await prisma.wishlist.findUnique({
      where: { userId }
    });

    if (!wishlist) {
      throw new Error('Wishlist not found');
    }

    // Delete all items
    await prisma.wishlistItem.deleteMany({
      where: { wishlistId: wishlist.id }
    });

    return true;
  }

  /**
   * Check if product is in wishlist
   * @param {String} userId - User ID
   * @param {String} productId - Product ID
   * @returns {Boolean} - True if product is in wishlist
   */
  async isInWishlist(userId, productId) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!productId) {
      throw new Error('Product ID is required');
    }

    // Find wishlist
    const wishlist = await prisma.wishlist.findUnique({
      where: { userId },
      select: { id: true }
    });

    if (!wishlist) {
      return false;
    }

    // Check if product is in wishlist
    const wishlistItem = await prisma.wishlistItem.findUnique({
      where: {
        wishlistId_productId: {
          wishlistId: wishlist.id,
          productId
        }
      }
    });

    return !!wishlistItem;
  }
} 