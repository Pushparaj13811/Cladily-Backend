# Rate Limiting System for Cladily

This document outlines the Redis-based rate limiting system implemented for the Cladily e-commerce platform. The system is designed to protect API endpoints from abuse and ensure fair resource distribution.

## Table of Contents

1. [Overview](#overview)
2. [Rate Limiting Algorithms](#rate-limiting-algorithms)
3. [Configuration Options](#configuration-options)
4. [Usage Examples](#usage-examples)
5. [Implementation Details](#implementation-details)
6. [Best Practices](#best-practices)
7. [Headers and Client Feedback](#headers-and-client-feedback)
8. [Troubleshooting](#troubleshooting)

## Overview

The rate limiting system uses Redis to track and enforce request limits across the application. It supports:

- Multiple rate limiting algorithms (fixed window, sliding window, token bucket)
- Different identifier types (IP address, user ID, API key)
- Custom handlers for rate limit exceeded scenarios
- Route-specific or global rate limits
- Standard rate limit headers (RFC 6585)

## Rate Limiting Algorithms

### Fixed Window

The fixed window algorithm divides time into fixed windows (e.g., 1-minute intervals) and counts requests within each window. When a new window starts, the counter resets.

**Pros:**
- Simple to understand and implement
- Minimal memory usage

**Cons:**
- Can allow bursts at window boundaries (e.g., many requests at the end of one window and beginning of the next)

### Sliding Window

The sliding window algorithm tracks requests with timestamps and counts all requests within a rolling time window (e.g., the last 60 seconds).

**Pros:**
- Prevents bursts at window boundaries
- More accurate rate limiting

**Cons:**
- Higher memory usage due to timestamp storage
- Slightly more complex implementation

### Token Bucket

The token bucket algorithm uses a bucket that is filled with tokens at a steady rate. Each request consumes one token. If the bucket is empty, requests are rejected.

**Pros:**
- Allows for burst traffic up to the bucket size
- Provides a smooth rate of requests over time

**Cons:**
- More complex to implement accurately
- Requires timestamp tracking for token refill calculations

## Configuration Options

| Option                  | Default              | Description                                                 |
|-------------------------|----------------------|-------------------------------------------------------------|
| `windowMs`              | 60000 (1 minute)     | Time window in milliseconds for rate limiting               |
| `max`                   | 60                   | Maximum number of requests within the window                |
| `standardHeaders`       | true                 | Enable RFC 6585 rate limit headers                          |
| `legacyHeaders`         | false                | Enable deprecated X-RateLimit headers                       |
| `type`                  | IP                   | Type of identifier to use (IP, USER, API_KEY)               |
| `algorithm`             | SLIDING_WINDOW       | Algorithm to use for rate limiting                          |
| `skipSuccessfulRequests`| false                | Whether to exclude successful requests from the counter     |
| `skip`                  | () => false          | Function to determine whether to skip rate limiting         |
| `routeKey`              | undefined            | Route-specific key for targeted rate limiting               |
| `keyGenerator`          | undefined            | Custom function to generate rate limit keys                 |
| `handler`               | undefined            | Custom handler when rate limit is exceeded                  |

## Usage Examples

### Basic Rate Limiting

Apply a default rate limiter to a route (60 requests per minute by IP):

```javascript
import { rateLimiter } from '../middlewares/rateLimiter.middleware.js';

// Apply to all routes in a router
router.use(rateLimiter());

// Apply to a specific route
router.get('/products', rateLimiter(), productController.getAllProducts);
```

### Custom Rate Limits

Apply different rate limits to different routes:

```javascript
// Higher limit for public API
router.get('/public-api', rateLimiter({ 
  max: 100,
  windowMs: 60 * 1000 // 100 requests per minute
}), publicController.getData);

// Lower limit for sensitive endpoints
router.post('/checkout', rateLimiter({ 
  max: 10,
  windowMs: 60 * 1000 // 10 requests per minute
}), checkoutController.processOrder);
```

### User-Based Rate Limiting

Limit based on authenticated user:

```javascript
router.post('/comments', 
  authenticate, 
  rateLimiter({ 
    type: RATE_LIMIT_TYPE.USER,
    max: 5,
    windowMs: 60 * 1000 // 5 comments per minute per user
  }), 
  commentController.addComment
);
```

### API Key Rate Limiting

Limit based on API key for external consumers:

```javascript
router.get('/api/data', 
  validateApiKey,
  rateLimiter({ 
    type: RATE_LIMIT_TYPE.API_KEY,
    max: 1000,
    windowMs: 24 * 60 * 60 * 1000 // 1000 requests per day
  }), 
  apiController.getData
);
```

### Different Algorithms

Choose an algorithm based on your needs:

```javascript
// Token bucket for API allowing bursts
router.get('/api/search', 
  rateLimiter({ 
    algorithm: RATE_LIMIT_ALGORITHM.TOKEN_BUCKET,
    max: 20,
    windowMs: 10 * 1000 // 20 requests per 10 seconds
  }),
  searchController.search
);

// Fixed window for simple limiting
router.post('/login', 
  rateLimiter({ 
    algorithm: RATE_LIMIT_ALGORITHM.FIXED_WINDOW,
    max: 5,
    windowMs: 15 * 60 * 1000 // 5 login attempts per 15 minutes
  }),
  authController.login
);
```

### Custom Rate Limit Handler

Provide a custom response when the rate limit is exceeded:

```javascript
router.post('/login', 
  rateLimiter({ 
    max: 5,
    windowMs: 15 * 60 * 1000,
    handler: (req, res, next, options) => {
      res.status(429).json({
        success: false,
        message: 'Too many login attempts. Please try again later.',
        retryAfter: Math.ceil(options.windowMs / 1000)
      });
    }
  }),
  authController.login
);
```

## Implementation Details

### Key Generation

Rate limit keys are generated using the Redis key utility:

```javascript
// IP-based key
rateLimitKeys.ip(ip, routeSpecifier);

// User-based key
rateLimitKeys.user(userId, routeSpecifier);

// API key-based key
rateLimitKeys.apiKey(apiKey, routeSpecifier);
```

### Redis Data Structures

Different algorithms use different Redis data structures:

- **Fixed Window**: Uses Redis string with `INCR` and `EXPIRE`
- **Sliding Window**: Uses Redis sorted set (`ZSET`) with timestamps as scores
- **Token Bucket**: Uses Redis hash to store tokens and last refill time

## Best Practices

1. **Consider Your API Patterns**
   - Apply stricter limits to write operations
   - Use higher limits for read-heavy routes
   - Consider the resource cost of each endpoint

2. **User Experience**
   - Provide clear feedback when limits are exceeded
   - Use retry-after headers to guide clients
   - Consider implementing progressive backoff

3. **Security Considerations**
   - Apply stricter limits to authentication endpoints
   - Use separate limits for anonymous vs. authenticated users
   - Consider IP + User combined rate limiting for critical operations

4. **Monitoring and Analysis**
   - Track rate limit hits to identify potential abuse
   - Adjust limits based on actual usage patterns
   - Use rate limit data to inform scaling decisions

## Headers and Client Feedback

When rate limiting is applied, the following headers are sent:

- `RateLimit-Limit`: Maximum number of requests allowed in the window
- `RateLimit-Remaining`: Number of requests remaining in the current window
- `RateLimit-Reset`: Time when the rate limit window resets (Unix timestamp in seconds)

Legacy headers (when enabled):
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

When a rate limit is exceeded, a 429 Too Many Requests status is returned with:
- A message indicating when the client can retry
- A `Retry-After` header indicating seconds to wait

## Troubleshooting

### Common Issues

1. **Rate Limit Not Applied**
   - Check Redis connection
   - Verify the middleware is correctly positioned in the route chain
   - Ensure the identifier (IP, user, API key) is available

2. **Unexpected Rate Limiting**
   - Check if you're behind a proxy (may need to configure trust proxy)
   - Verify rate limit key generation is working as expected
   - Check if multiple app instances share the same Redis

3. **Redis Performance**
   - Monitor Redis memory usage
   - Consider using a dedicated Redis instance for rate limiting
   - Use Redis persistence for critical rate limiting data

---

This rate limiting system is designed to be extensible and maintainable as the Cladily platform grows. Follow these guidelines to ensure consistent rate limiting practices across the application. 