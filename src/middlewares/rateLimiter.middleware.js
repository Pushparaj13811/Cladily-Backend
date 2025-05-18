/**
 * Rate Limiter Middleware
 * 
 * This middleware provides rate limiting functionality based on configurable options.
 * It supports different algorithms and can limit based on IP, user ID, or API key.
 */

export const RATE_LIMIT_ALGORITHM = {
    FIXED_WINDOW: 'fixed_window',
    SLIDING_WINDOW: 'sliding_window',
    TOKEN_BUCKET: 'token_bucket'
};

export const RATE_LIMIT_TYPE = {
    IP: 'ip',
    USER: 'user',
    API_KEY: 'api_key'
};

// Import Redis client for storing rate limit data
import redisClient from '../utils/redisClient.js';

/**
 * Rate limiter middleware
 * 
 * @param {Object} options - Rate limiting options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum number of requests in the window
 * @param {string} options.algorithm - Rate limiting algorithm to use
 * @param {string} options.type - What to base rate limiting on (IP, user, API key)
 * @param {Function} options.skip - Function to determine whether to skip rate limiting
 * @returns {Function} Express middleware function
 */
export const rateLimiter = (options) => {
    const {
        windowMs = 60 * 1000, // Default: 1 minute
        max = 60,             // Default: 60 requests per minute
        algorithm = RATE_LIMIT_ALGORITHM.FIXED_WINDOW,  // Changed default to fixed window
        type = RATE_LIMIT_TYPE.IP,
        skip = () => false    // Default: don't skip
    } = options;

    return async (req, res, next) => {
        // Skip rate limiting if needed
        if (skip(req)) {
            return next();
        }

        // Determine the rate limiting key
        let identifier;
        switch (type) {
            case RATE_LIMIT_TYPE.USER:
                // Use user ID if authenticated, otherwise fallback to IP
                identifier = req.user?.id || req.ip;
                break;
            case RATE_LIMIT_TYPE.API_KEY:
                // Use API key from header or query param
                identifier = req.headers['x-api-key'] || req.query.apiKey || req.ip;
                break;
            case RATE_LIMIT_TYPE.IP:
            default:
                identifier = req.ip;
                break;
        }

        const key = `ratelimit:${algorithm}:${req.originalUrl}:${identifier}`;
        
        try {
            // Get the Redis client
            const client = await redisClient.getClient();
            
            let currentCount;
            const now = Date.now();
            
            // Apply rate limiting based on algorithm
            switch (algorithm) {
                case RATE_LIMIT_ALGORITHM.FIXED_WINDOW:
                    // Simple key with expiration - using Redis client methods correctly
                    const countStr = await client.get(key) || '0';
                    const count = parseInt(countStr, 10) + 1;
                    await client.set(key, count.toString());
                    if (count === 1) {
                        await client.expire(key, Math.ceil(windowMs / 1000));
                    }
                    currentCount = count;
                    break;
                    
                case RATE_LIMIT_ALGORITHM.SLIDING_WINDOW:
                    // Simplified sliding window using sorted sets
                    // Add current timestamp to a list with the request time
                    const nowStr = now.toString();
                    await client.set(`${key}:${nowStr}`, '1');
                    await client.expire(`${key}:${nowStr}`, Math.ceil(windowMs / 1000));
                    
                    // Get all keys in the window
                    const keys = await client.keys(`${key}:*`);
                    const validKeys = [];
                    
                    // Filter out expired timestamps
                    for (const timeKey of keys) {
                        const timestamp = parseInt(timeKey.split(':').pop(), 10);
                        if (now - timestamp < windowMs) {
                            validKeys.push(timeKey);
                        } else {
                            await client.del(timeKey);
                        }
                    }
                    
                    currentCount = validKeys.length;
                    break;
                    
                case RATE_LIMIT_ALGORITHM.TOKEN_BUCKET:
                    // Implementation of token bucket algorithm using standard Redis operations
                    const lastRefillStr = await client.get(`${key}:lastRefill`) || now.toString();
                    const tokensStr = await client.get(`${key}:tokens`) || max.toString();
                    
                    let currentTokens = parseInt(tokensStr, 10);
                    const lastRefillTime = parseInt(lastRefillStr, 10);
                    
                    // Calculate tokens to add based on time elapsed
                    const timePassed = now - lastRefillTime;
                    const tokensToAdd = Math.floor((timePassed / windowMs) * max);
                    
                    // Refill bucket (up to max)
                    currentTokens = Math.min(currentTokens + tokensToAdd, max);
                    
                    if (currentTokens > 0) {
                        // Consume a token
                        currentTokens--;
                        await client.set(`${key}:tokens`, currentTokens.toString());
                        await client.set(`${key}:lastRefill`, now.toString());
                        await client.expire(`${key}:tokens`, Math.ceil(windowMs / 1000) * 2);
                        await client.expire(`${key}:lastRefill`, Math.ceil(windowMs / 1000) * 2);
                        currentCount = max - currentTokens;
                    } else {
                        // No tokens available
                        currentCount = max + 1; // Exceeds limit
                    }
                    break;
                    
                default:
                    // Default to fixed window with simple implementation
                    const defaultCountStr = await client.get(key) || '0';
                    const defaultCount = parseInt(defaultCountStr, 10) + 1;
                    await client.set(key, defaultCount.toString());
                    if (defaultCount === 1) {
                        await client.expire(key, Math.ceil(windowMs / 1000));
                    }
                    currentCount = defaultCount;
                    break;
            }
            
            // Set rate limit headers
            const remaining = Math.max(0, max - currentCount);
            res.setHeader('X-RateLimit-Limit', max);
            res.setHeader('X-RateLimit-Remaining', remaining);
            res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000));
            
            // If limit exceeded, return error
            if (currentCount > max) {
                return res.status(429).json({
                    success: false,
                    message: 'Too many requests, please try again later.',
                    error: {
                        code: 'RATE_LIMIT_EXCEEDED',
                        retryAfter: Math.ceil(windowMs / 1000)
                    }
                });
            }
            
            next();
        } catch (error) {
            console.error('Rate limiter error:', error);
            // Don't block requests if rate limiter fails
            next();
        }
    };
};

export default rateLimiter; 