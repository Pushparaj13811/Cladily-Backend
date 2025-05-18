import redisManager from '../utils/redisClient.js';
import { generateKey } from '../utils/redisKeys.js';

/**
 * Middleware to cache API responses
 * 
 * @param {string} namespace - The data category (e.g., 'user', 'product')
 * @param {string} action - The specific data being cached (e.g., 'profile', 'list')
 * @param {number} ttlSeconds - Cache TTL in seconds
 * @param {Function} paramsFn - Optional function to extract custom params from request
 * @returns {Function} Express middleware
 */
export const cacheResponse = (namespace, action, ttlSeconds = 3600, paramsFn = null) => {
  return async (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    try {
      // Extract parameters for cache key
      let params = {};
      
      if (paramsFn) {
        // Use custom function to extract params
        params = paramsFn(req);
      } else {
        // Default: combine route params, query params, and user ID if authenticated
        params = {
          ...req.params,
          ...req.query,
        };
        
        // Add authenticated user to cache key if available
        if (req.user?.id) {
          params.userId = req.user.id;
        }
      }

      // Generate cache key
      const cacheKey = generateKey(namespace, action, params);
      
      // Check cache
      const cachedData = await redisManager.get(cacheKey);
      
      if (cachedData !== null) {
        // Send cached response
        return res.status(200).json(cachedData);
      }

      // Cache miss - store original res.json method
      const originalJson = res.json;
      
      // Intercept res.json to cache the response
      res.json = function(data) {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          redisManager.set(cacheKey, data, ttlSeconds).catch(err => {
            console.error(`Cache middleware error [${cacheKey}]:`, err);
          });
        }
        
        // Call original json method
        return originalJson.call(this, data);
      };
      
      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next(); // Continue without caching
    }
  };
};

/**
 * Middleware to clear cache entries
 * 
 * @param {string} namespace - The data category (e.g., 'user', 'product')
 * @param {string} action - Optional specific action to clear
 * @param {Function} paramsFn - Optional function to extract custom params from request
 * @returns {Function} Express middleware
 */
export const clearCache = (namespace, action = null, paramsFn = null) => {
  return async (req, res, next) => {
    try {
      // Call next first to ensure the operation completes
      next();
      
      // Clear cache after response is sent
      res.on('finish', async () => {
        // Only clear cache for successful operations
        if (res.statusCode >= 200 && res.statusCode < 300) {
          if (action) {
            // Clear specific action cache
            let pattern;
            
            if (paramsFn) {
              // Use custom function to extract params
              const params = paramsFn(req);
              const cacheKey = generateKey(namespace, action, params);
              await redisManager.del(cacheKey);
            } else {
              // Clear all keys for this action using pattern matching
              pattern = `*:${namespace}:${action}:*`;
              await redisManager.delByPattern(pattern);
            }
          } else {
            // Clear all namespace keys
            const pattern = `*:${namespace}:*`;
            await redisManager.delByPattern(pattern);
          }
        }
      });
    } catch (error) {
      console.error('Cache clear middleware error:', error);
      // Continue even if cache clearing fails
    }
  };
};

/**
 * Get a cache decorator that can be applied to controller methods
 * 
 * @param {string} namespace - The data category (e.g., 'user', 'product')
 * @param {string} action - The specific data being cached
 * @param {number} ttlSeconds - Cache TTL in seconds 
 * @returns {Function} Decorator function for controller methods
 */
export const withCache = (namespace, action, ttlSeconds = 3600) => {
  return (target, propertyKey, descriptor) => {
    // Save a reference to the original method
    const originalMethod = descriptor.value;
    
    // Rewrite the method to use cache
    descriptor.value = async function(...args) {
      const req = args[0]; // First argument is typically the request
      
      // Skip caching for non-GET requests
      if (req.method !== 'GET') {
        return originalMethod.apply(this, args);
      }
      
      // Generate params from request
      const params = {
        ...req.params,
        ...req.query,
        userId: req.user?.id,
      };
      
      // Generate cache key
      const cacheKey = generateKey(namespace, action, params);
      
      // Use cache wrapper
      return await redisManager.cacheWrapper(
        cacheKey,
        () => originalMethod.apply(this, args),
        ttlSeconds
      );
    };
    
    return descriptor;
  };
};

export default {
  cacheResponse,
  clearCache,
  withCache
}; 