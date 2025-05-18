/**
 * Cache Implementation Examples
 * 
 * This file demonstrates practical examples of using the Redis caching system
 * in different parts of the Cladily application.
 */

import redisManager from './redisClient.js';
import { productKeys, userKeys, categoryKeys, salesKeys } from './redisKeys.js';
import { prisma } from '../database/connect.js';

// Example 1: Product Detail Caching
export async function getProductWithCache(productId) {
  try {
    // Generate a cache key for this product
    const cacheKey = productKeys.detail(productId);
    
    // Try to get from cache first
    const cachedProduct = await redisManager.get(cacheKey);
    if (cachedProduct) {
      console.log('Cache hit: Product retrieved from cache');
      return cachedProduct;
    }
    
    console.log('Cache miss: Fetching product from database');
    
    // Cache miss - get from database
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: true,
        reviews: {
          take: 5,
          orderBy: { createdAt: 'desc' }
        },
        category: true,
      }
    });
    
    if (!product) return null;
    
    // Store in cache with 1 hour expiry
    await redisManager.set(cacheKey, product, 3600);
    
    return product;
  } catch (error) {
    console.error('Error in getProductWithCache:', error);
    throw error;
  }
}

// Example 2: Using Cache Wrapper for User Profile
export async function getUserProfileWithCache(userId) {
  const fetchUserFromDb = async () => {
    return await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
        status: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });
  };
  
  return await redisManager.cacheWrapper(
    userKeys.profile(userId),
    fetchUserFromDb,
    1800 // 30 minutes
  );
}

// Example 3: Cache Invalidation Pattern
export async function updateProductWithCacheInvalidation(productId, updateData) {
  try {
    // Update in database
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: updateData
    });
    
    // Invalidate related caches
    await redisManager.del(productKeys.detail(productId));
    await redisManager.del(productKeys.list()); // List cache if exists
    
    if (updateData.categoryId) {
      // Invalidate category products cache if category changed
      await redisManager.del(categoryKeys.products(updateData.categoryId));
    }
    
    console.log('Product updated and caches invalidated');
    return updatedProduct;
  } catch (error) {
    console.error('Error in updateProductWithCacheInvalidation:', error);
    throw error;
  }
}

// Example 4: Caching Expensive Computation (Sales Analytics)
export async function getSalesDashboardWithCache() {
  const calculateSalesDashboard = async () => {
    // This would be an expensive calculation in a real app
    const totalSales = await prisma.order.aggregate({
      _sum: { total: true },
      where: { status: 'DELIVERED' }
    });
    
    const topSellingProducts = await prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5
    });
    
    // Further processing and joining with product details
    const topProducts = await Promise.all(
      topSellingProducts.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { name: true, image: true }
        });
        
        return {
          productId: item.productId,
          name: product.name,
          image: product.image,
          totalSold: item._sum.quantity,
          totalRevenue: item._sum.subtotal
        };
      })
    );
    
    return {
      totalRevenue: totalSales._sum.total || 0,
      topSellingProducts: topProducts,
      lastCalculated: new Date().toISOString()
    };
  };
  
  // Cache for 1 hour (this would be analytics data that doesn't need real-time updates)
  return await redisManager.cacheWrapper(
    salesKeys.dashboard(),
    calculateSalesDashboard,
    3600
  );
}

// Example 5: Incrementing Counter (Product Views)
export async function incrementProductViews(productId) {
  const cacheKey = productKeys.views(productId);
  
  // Increment view count in Redis
  const views = await redisManager.increment(cacheKey);
  
  // Persist to database periodically (every 100 views)
  if (views % 100 === 0) {
    await prisma.product.update({
      where: { id: productId },
      data: { viewCount: { increment: 100 } }
    });
    console.log(`Persisted 100 views for product ${productId}`);
  }
  
  return views;
} 