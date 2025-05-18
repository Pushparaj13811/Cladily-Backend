/**
 * Rate Limit Windows Utility
 * 
 * This file defines standard rate limit windows for different types of routes.
 * These can be used throughout the application to maintain consistent rate limiting.
 */

import { RATE_LIMIT_ALGORITHM, RATE_LIMIT_TYPE } from '../middlewares/rateLimiter.middleware.js';

/**
 * Standard time windows in milliseconds
 */
export const TIME_WINDOWS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  FIVE_MINUTES: 5 * 60 * 1000,
  FIFTEEN_MINUTES: 15 * 60 * 1000,
  THIRTY_MINUTES: 30 * 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,
};

/**
 * Public API rate limits
 * For unauthenticated public endpoints
 */
export const PUBLIC_API_LIMITS = {
  // General public API
  STANDARD: {
    windowMs: TIME_WINDOWS.MINUTE,
    max: 60, // 60 requests per minute
    algorithm: RATE_LIMIT_ALGORITHM.SLIDING_WINDOW,
    type: RATE_LIMIT_TYPE.IP,
  },
  
  // Read-heavy public endpoints like product listings
  HIGH_VOLUME: {
    windowMs: TIME_WINDOWS.MINUTE,
    max: 120, // 120 requests per minute
    algorithm: RATE_LIMIT_ALGORITHM.SLIDING_WINDOW,
    type: RATE_LIMIT_TYPE.IP,
  },

  // Search endpoints
  SEARCH: {
    windowMs: TIME_WINDOWS.MINUTE,
    max: 30, // 30 searches per minute
    algorithm: RATE_LIMIT_ALGORITHM.SLIDING_WINDOW,
    type: RATE_LIMIT_TYPE.IP,
  },

  // For extremely lightweight endpoints
  RELAXED: {
    windowMs: TIME_WINDOWS.MINUTE,
    max: 300, // 300 requests per minute
    algorithm: RATE_LIMIT_ALGORITHM.SLIDING_WINDOW,
    type: RATE_LIMIT_TYPE.IP,
  },
};

/**
 * Authentication related rate limits
 * For login, signup, password reset, etc.
 */
export const AUTH_LIMITS = {
  // Standard auth endpoints
  STANDARD: {
    windowMs: TIME_WINDOWS.MINUTE,
    max: 20, // 20 requests per minute
    algorithm: RATE_LIMIT_ALGORITHM.SLIDING_WINDOW,
    type: RATE_LIMIT_TYPE.IP,
  },
  
  // Login attempts
  LOGIN: {
    windowMs: TIME_WINDOWS.FIFTEEN_MINUTES,
    max: 10, // 10 attempts per 15 minutes
    algorithm: RATE_LIMIT_ALGORITHM.FIXED_WINDOW,
    type: RATE_LIMIT_TYPE.IP,
  },
  
  // Account creation
  SIGNUP: {
    windowMs: TIME_WINDOWS.HOUR,
    max: 5, // 5 accounts per hour
    algorithm: RATE_LIMIT_ALGORITHM.FIXED_WINDOW,
    type: RATE_LIMIT_TYPE.IP,
  },
  
  // Password reset/recovery
  PASSWORD_RESET: {
    windowMs: TIME_WINDOWS.HOUR,
    max: 3, // 3 password reset attempts per hour
    algorithm: RATE_LIMIT_ALGORITHM.FIXED_WINDOW,
    type: RATE_LIMIT_TYPE.IP,
  },
  
  // OTP verification
  OTP: {
    windowMs: TIME_WINDOWS.FIFTEEN_MINUTES,
    max: 5, // 5 OTP attempts per 15 minutes
    algorithm: RATE_LIMIT_ALGORITHM.FIXED_WINDOW,
    type: RATE_LIMIT_TYPE.IP,
  },
};

/**
 * Authenticated API rate limits
 * For endpoints that require authentication
 */
export const AUTHENTICATED_API_LIMITS = {
  // Standard authenticated endpoints
  STANDARD: {
    windowMs: TIME_WINDOWS.MINUTE,
    max: 100, // 100 requests per minute
    algorithm: RATE_LIMIT_ALGORITHM.SLIDING_WINDOW,
    type: RATE_LIMIT_TYPE.USER,
  },
  
  // Write operations (create/update/delete)
  WRITE: {
    windowMs: TIME_WINDOWS.MINUTE,
    max: 30, // 30 write operations per minute
    algorithm: RATE_LIMIT_ALGORITHM.SLIDING_WINDOW,
    type: RATE_LIMIT_TYPE.USER,
  },
  
  // Sensitive operations
  SENSITIVE: {
    windowMs: TIME_WINDOWS.HOUR,
    max: 10, // 10 sensitive operations per hour
    algorithm: RATE_LIMIT_ALGORITHM.SLIDING_WINDOW,
    type: RATE_LIMIT_TYPE.USER,
  },
};

/**
 * Admin API rate limits
 * For admin-only endpoints
 */
export const ADMIN_API_LIMITS = {
  // Standard admin operations
  STANDARD: {
    windowMs: TIME_WINDOWS.MINUTE,
    max: 300, // 300 requests per minute
    algorithm: RATE_LIMIT_ALGORITHM.SLIDING_WINDOW,
    type: RATE_LIMIT_TYPE.USER,
  },
  
  // Write operations for admin (create/update/delete)
  WRITE: {
    windowMs: TIME_WINDOWS.MINUTE,
    max: 60, // 60 write operations per minute
    algorithm: RATE_LIMIT_ALGORITHM.SLIDING_WINDOW,
    type: RATE_LIMIT_TYPE.USER,
  },
  
  // Bulk operations
  BULK: {
    windowMs: TIME_WINDOWS.MINUTE,
    max: 30, // 30 bulk operations per minute
    algorithm: RATE_LIMIT_ALGORITHM.TOKEN_BUCKET, // Allow bursts
    type: RATE_LIMIT_TYPE.USER,
  },
};

/**
 * External API rate limits
 * For API keys and 3rd party integrations
 */
export const EXTERNAL_API_LIMITS = {
  // Standard API key access
  STANDARD: {
    windowMs: TIME_WINDOWS.DAY,
    max: 10000, // 10,000 requests per day
    algorithm: RATE_LIMIT_ALGORITHM.SLIDING_WINDOW,
    type: RATE_LIMIT_TYPE.API_KEY,
  },
  
  // Premium API key access
  PREMIUM: {
    windowMs: TIME_WINDOWS.DAY,
    max: 50000, // 50,000 requests per day
    algorithm: RATE_LIMIT_ALGORITHM.SLIDING_WINDOW,
    type: RATE_LIMIT_TYPE.API_KEY,
  },
};

/**
 * Global API limits
 * Applied to all routes as a baseline
 */
export const GLOBAL_LIMITS = {
  // Default global limit
  DEFAULT: {
    windowMs: TIME_WINDOWS.MINUTE,
    max: 500, // 500 requests per minute per IP
    algorithm: RATE_LIMIT_ALGORITHM.SLIDING_WINDOW,
    type: RATE_LIMIT_TYPE.IP,
    skip: (req) => {
      // Skip rate limiting for local development and health checks
      const skipPaths = ['/api/health', '/metrics'];
      return (
        req.ip === '127.0.0.1' || 
        req.ip === '::1' ||
        skipPaths.includes(req.path)
      );
    }
  },
}; 