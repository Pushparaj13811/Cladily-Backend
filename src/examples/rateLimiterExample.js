/**
 * Rate Limiter Implementation Examples
 * 
 * This file demonstrates practical examples of applying rate limiters
 * to various routes in the Cladily application.
 */

import express from 'express';
import { rateLimiter, RATE_LIMIT_TYPE, RATE_LIMIT_ALGORITHM } from '../middlewares/rateLimiter.middleware.js';
import { HTTP_TOO_MANY_REQUESTS } from '../httpStatusCode.js';

const router = express.Router();

/**
 * Example 1: Basic Global Rate Limiting
 * 
 * This applies a default rate limiter to all routes in this router.
 * Limits to 60 requests per minute per IP address.
 */
// Apply global middleware to all routes
const globalLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  standardHeaders: true,
  message: 'Too many requests from this IP, please try again after a minute'
});

// Apply to all routes
// router.use(globalLimiter);

/**
 * Example 2: Route-Specific Rate Limiting
 * 
 * Different routes get different rate limits based on their resource intensity
 * and security requirements.
 */
 
// Public, read-only API - higher limits
router.get('/api/products', rateLimiter({ 
  max: 100,
  windowMs: 60 * 1000, // 100 requests per minute
  routeKey: 'products:list'
}), (req, res) => {
  res.json({ message: 'Products list' });
});

// Individual product details - medium limits
router.get('/api/products/:id', rateLimiter({ 
  max: 60,
  windowMs: 60 * 1000, // 60 requests per minute
  routeKey: 'products:detail'
}), (req, res) => {
  res.json({ message: `Product details for ${req.params.id}` });
});

// Search API - could be resource intensive
router.get('/api/search', rateLimiter({ 
  max: 20,
  windowMs: 30 * 1000, // 20 requests per 30 seconds
  algorithm: RATE_LIMIT_ALGORITHM.SLIDING_WINDOW,
  routeKey: 'search'
}), (req, res) => {
  res.json({ message: 'Search results' });
});

/**
 * Example 3: Authentication Protection
 * 
 * Strict limits on authentication routes to prevent brute force attacks
 */
router.post('/api/auth/login', rateLimiter({ 
  max: 5,
  windowMs: 15 * 60 * 1000, // 5 requests per 15 minutes
  algorithm: RATE_LIMIT_ALGORITHM.FIXED_WINDOW,
  routeKey: 'auth:login',
  handler: (req, res, next, options) => {
    // Custom handler for authentication failures
    const retryAfterSeconds = Math.ceil(options.windowMs / 1000);
    
    res.status(HTTP_TOO_MANY_REQUESTS).json({
      success: false,
      message: `Too many login attempts. Please try again after ${retryAfterSeconds} seconds.`,
      retryAfter: retryAfterSeconds
    });
  }
}), (req, res) => {
  res.json({ message: 'Login successful' });
});

/**
 * Example 4: User-Based Rate Limiting
 * 
 * These routes are protected by user-based rate limits
 * First authenticate the user, then apply rate limits specific to that user
 */
// Simulate authentication middleware
const authenticate = (req, res, next) => {
  // In a real app, this would validate tokens, etc.
  req.user = { id: '123', role: 'user' };
  next();
};

// Post comments - limit per user
router.post('/api/comments', authenticate, rateLimiter({ 
  type: RATE_LIMIT_TYPE.USER,
  max: 5,
  windowMs: 60 * 1000, // 5 comments per minute per user
  routeKey: 'comments:create'
}), (req, res) => {
  res.json({ message: 'Comment posted' });
});

// Order submission - strict limits per user
router.post('/api/orders', authenticate, rateLimiter({ 
  type: RATE_LIMIT_TYPE.USER,
  max: 10,
  windowMs: 60 * 60 * 1000, // 10 orders per hour per user
  routeKey: 'orders:create'
}), (req, res) => {
  res.json({ message: 'Order created' });
});

/**
 * Example 5: Role-Based Rate Limiting
 * 
 * Different limits based on user roles
 */
// Custom key generator based on user role
const roleBasedLimiter = rateLimiter({
  keyGenerator: (req) => {
    // Use IP for unauthenticated requests
    if (!req.user) {
      return `ip:${req.ip}`;
    }
    
    // Use role-based keys for authenticated requests
    return `role:${req.user.role}:${req.user.id}`;
  },
  max: (req) => {
    // Higher limits for admin users
    if (req.user?.role === 'admin') {
      return 1000;
    }
    
    // Medium limits for registered users
    if (req.user) {
      return 100;
    }
    
    // Lower limits for anonymous users
    return 30;
  },
  windowMs: 60 * 1000, // Per minute
  routeKey: 'api'
});

router.get('/api/dashboard', authenticate, roleBasedLimiter, (req, res) => {
  res.json({ message: 'Dashboard data' });
});

/**
 * Example 6: API Key Rate Limiting
 * 
 * Apply rate limits based on API keys for external integrations
 */
// Simulate API key validation middleware
const validateApiKey = (req, res, next) => {
  const apiKey = req.get('X-API-Key') || req.query.apiKey;
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  req.apiKey = apiKey;
  next();
};

router.get('/api/external/data', validateApiKey, rateLimiter({ 
  type: RATE_LIMIT_TYPE.API_KEY,
  max: 1000,
  windowMs: 24 * 60 * 60 * 1000, // 1000 requests per day
  routeKey: 'external:data'
}), (req, res) => {
  res.json({ message: 'External API data' });
});

/**
 * Example 7: Token Bucket for Burst Traffic
 * 
 * Allow short bursts of traffic but limit sustained usage
 */
router.get('/api/feed', rateLimiter({ 
  algorithm: RATE_LIMIT_ALGORITHM.TOKEN_BUCKET,
  max: 30,              // Bucket size (max burst)
  windowMs: 60 * 1000,  // Refill rate: 30 tokens per minute
  routeKey: 'feed'
}), (req, res) => {
  res.json({ message: 'News feed data' });
});

export default router;

// Usage in app.js:
// import rateLimiterExampleRoutes from './examples/rateLimiterExample.js';
// app.use('/examples', rateLimiterExampleRoutes); 