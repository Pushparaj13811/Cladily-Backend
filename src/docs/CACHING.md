# Redis Caching System for Cladily

This document outlines the Redis caching system implemented for the Cladily e-commerce platform. The system is designed to optimize application performance, reduce database load, and provide a consistent caching approach across the application.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Key Components](#key-components)
3. [Cache Key Management](#cache-key-management)
4. [Common Caching Patterns](#common-caching-patterns)
5. [Cache Invalidation Strategies](#cache-invalidation-strategies)
6. [Best Practices](#best-practices)
7. [Usage Examples](#usage-examples)
8. [Troubleshooting](#troubleshooting)

## Architecture Overview

The caching system uses Redis as a distributed in-memory data store that sits between the application and the database. Redis provides:

- High-performance data access (sub-millisecond response times)
- Support for complex data structures (strings, hashes, lists)
- Built-in expiry mechanisms
- Atomic operations for counters and rate limiting
- Pub/sub capabilities for real-time features

The architecture follows these principles:
- **Cache-Aside Pattern**: The application checks the cache before the database
- **Write-Through/Invalidation**: Updates invalidate or update the cache to maintain consistency
- **Time-Based Expiry**: All cached items have appropriate TTLs based on data volatility

## Key Components

The caching system consists of three main components:

### 1. Redis Manager (`redisClient.js`)

A singleton service that provides:
- Connection management
- Simplified Redis operations (get, set, delete)
- Cache wrapper for function results
- Counter operations
- Key expiry management
- Pattern-based key deletion for cache invalidation

### 2. Key Management (`redisKeys.js`)

A utility that:
- Defines standardized key namespaces
- Provides functions to generate consistent cache keys
- Supports versioning for cache invalidation during schema changes
- Organizes keys by data domain (users, products, categories, etc.)

### 3. Cache Middleware (`cache.middleware.js`)

Express middleware that:
- Enables easy route-level caching
- Handles cache headers and conditional requests
- Supports dynamic key generation from request parameters
- Manages cache clearing based on HTTP methods

## Cache Key Management

Cache keys follow a convention that ensures they are:

- **Predictable**: Keys follow a consistent pattern for easy debugging
- **Unique**: No key collisions between different data types
- **Namespaced**: Organized by domain for easier management
- **Versioned**: Support for bulk invalidation during schema changes

Key format: `cladily:v1:{namespace}:{action}:{params}`

Example keys:
- `cladily:v1:product:detail:123` - Product details
- `cladily:v1:user:profile:456` - User profile
- `cladily:v1:category:products:789` - Products in a category
- `cladily:v1:search:results:shoes:1` - Search results

## Common Caching Patterns

### 1. Simple Key-Value Caching

```javascript
// Store value
await redisManager.set(productKeys.detail(productId), product, 3600);

// Retrieve value
const product = await redisManager.get(productKeys.detail(productId));
```

### 2. Function Result Caching

```javascript
const result = await redisManager.cacheWrapper(
  categoryKeys.list(),
  fetchAllCategories,
  1800
);
```

### 3. Counter Pattern

```javascript
// Increment view count
const views = await redisManager.increment(productKeys.views(productId));
```

### 4. API Response Caching

```javascript
// In route handler
app.get('/api/products/:id', cacheResponse('product', 'detail'));
```

## Cache Invalidation Strategies

The system uses multiple strategies to ensure data consistency:

### 1. Time-Based Expiration

All cached items have a TTL (Time To Live) appropriate to the data volatility:
- High volatility data (cart, inventory): Short TTL (seconds to minutes)
- Medium volatility (product details): Medium TTL (minutes to hours)
- Low volatility (categories): Longer TTL (hours to days)

### 2. Event-Based Invalidation

Cache is invalidated based on data modification events:
- When a product is updated, its cache is cleared
- When a review is added, product cache is refreshed
- When order status changes, dashboard caches are updated

### 3. Bulk Invalidation

For major changes:
- Version prefix in keys enables wholesale cache clearing
- Pattern-based deletion for related items

## Best Practices

1. **Set Appropriate TTLs**
   - Match cache duration to data volatility
   - Use shorter TTLs for frequently changing data

2. **Use Consistent Key Patterns**
   - Always use the key generation utilities
   - Don't create ad-hoc keys in controllers

3. **Cache Validation**
   - Consider using ETag or Last-Modified headers for API responses
   - Implement conditional requests where appropriate

4. **Error Handling**
   - Treat cache issues as non-fatal
   - Fall back to database on cache misses or failures

5. **Monitoring**
   - Log cache hit/miss rates
   - Monitor Redis memory usage
   - Watch for cache-related performance bottlenecks

## Usage Examples

### Product Caching Example

```javascript
// Get product with cache
export async function getProductWithCache(productId) {
  // Try cache first
  const cacheKey = productKeys.detail(productId);
  const cachedProduct = await redisManager.get(cacheKey);
  
  if (cachedProduct) return cachedProduct;
  
  // Cache miss - get from database
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { variants: true, category: true }
  });
  
  if (product) {
    // Store in cache with 1 hour expiry
    await redisManager.set(cacheKey, product, 3600);
  }
  
  return product;
}
```

### Cache Invalidation Example

```javascript
// Update product with cache invalidation
export async function updateProduct(productId, data) {
  // Update in database
  const product = await prisma.product.update({
    where: { id: productId },
    data
  });
  
  // Invalidate caches
  await redisManager.del(productKeys.detail(productId));
  
  // If category changed, invalidate category caches
  if (data.categoryId) {
    await redisManager.del(categoryKeys.products(data.categoryId));
  }
  
  return product;
}
```

## Troubleshooting

### Common Issues

1. **Stale Data**
   - Check TTL settings
   - Verify invalidation logic is working
   - Ensure all update paths clear cache

2. **Memory Usage**
   - Review cached object sizes
   - Implement data trimming for large objects
   - Consider Redis eviction policies

3. **Performance**
   - Monitor Redis latency
   - Check for serialization bottlenecks
   - Ensure efficient key design

### Debugging

- Use Redis CLI commands to inspect keys and values
- Monitor Redis with `redis-cli monitor`
- Check key expiry with `redis-cli ttl key`
- List keys with `redis-cli keys "pattern:*"` (use sparingly in production)

---

This caching system is designed to be extensible and maintainable as the Cladily platform grows. Follow these guidelines to ensure consistent caching practices across the application. 