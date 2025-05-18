/**
 * Redis Key Management Utility
 * 
 * This utility provides a consistent way to generate Redis keys across the application.
 * It supports namespacing, versioning, and dynamic parameters to ensure keys are:
 * - Predictable: follow a consistent pattern
 * - Unique: avoid collisions between different data types
 * - Scalable: easy to extend for new features
 * - Maintainable: easy to understand their purpose
 */

// Key version for cache invalidation during schema changes
const KEY_VERSION = 'v1';

// Namespace constants
const NAMESPACE = {
  USER: 'user',
  PRODUCT: 'product',
  CATEGORY: 'category',
  CART: 'cart',
  ORDER: 'order',
  SESSION: 'session',
  OTP: 'otp',
  TOKEN: 'token',
  REVIEW: 'review',
  CATALOG: 'catalog',
  WISHLIST: 'wishlist',
  COUPON: 'coupon',
  SEARCH: 'search',
  RATE_LIMIT: 'rate_limit'
};

/**
 * Generate a Redis key with proper namespacing
 * 
 * @param {string} namespace - The data category (e.g., 'user', 'product')
 * @param {string} action - The specific data being cached (e.g., 'profile', 'list')
 * @param {Object|string} params - Parameters that make the key unique
 * @returns {string} The formatted Redis key
 */
const generateKey = (namespace, action, params = '') => {
  // Convert object params to a consistent string
  let paramString = '';
  
  if (typeof params === 'object' && params !== null) {
    // Sort keys to ensure consistent ordering regardless of how params are passed
    const sortedKeys = Object.keys(params).sort();
    
    // Create string in format ":key1=value1:key2=value2"
    paramString = sortedKeys
      .filter(key => params[key] !== undefined && params[key] !== null)
      .map(key => `:${key}=${params[key]}`)
      .join('');
  } else if (params) {
    paramString = `:${params}`;
  }
  
  return `${KEY_VERSION}:${namespace}:${action}${paramString}`;
};

/**
 * Generate user-related cache keys
 */
const userKeys = {
  profile: (userId) => generateKey(NAMESPACE.USER, 'profile', userId),
  sessions: (userId) => generateKey(NAMESPACE.USER, 'sessions', userId),
  wishlist: (userId) => generateKey(NAMESPACE.USER, 'wishlist', userId),
  orders: (userId) => generateKey(NAMESPACE.USER, 'orders', userId),
  cart: (userId) => generateKey(NAMESPACE.USER, 'cart', userId),
};

/**
 * Generate product-related cache keys
 */
const productKeys = {
  detail: (productId) => generateKey(NAMESPACE.PRODUCT, 'detail', productId),
  bySlug: (slug) => generateKey(NAMESPACE.PRODUCT, 'bySlug', slug),
  list: (params) => generateKey(NAMESPACE.PRODUCT, 'list', params),
  related: (productId) => generateKey(NAMESPACE.PRODUCT, 'related', productId),
  reviews: (productId) => generateKey(NAMESPACE.PRODUCT, 'reviews', productId),
  search: (query) => generateKey(NAMESPACE.SEARCH, 'products', query),
};

/**
 * Generate category-related cache keys
 */
const categoryKeys = {
  detail: (categoryId) => generateKey(NAMESPACE.CATEGORY, 'detail', categoryId),
  list: () => generateKey(NAMESPACE.CATEGORY, 'list'),
  products: (categoryId, params) => generateKey(NAMESPACE.CATEGORY, 'products', { categoryId, ...params }),
};

/**
 * Generate cart-related cache keys
 */
const cartKeys = {
  detail: (identifier) => generateKey(NAMESPACE.CART, 'detail', identifier), // userId or sessionId
  count: (identifier) => generateKey(NAMESPACE.CART, 'count', identifier),
};

/**
 * Generate order-related cache keys
 */
const orderKeys = {
  detail: (orderId) => generateKey(NAMESPACE.ORDER, 'detail', orderId),
  list: (userId, params) => generateKey(NAMESPACE.ORDER, 'list', { userId, ...params }),
  stats: (userId) => generateKey(NAMESPACE.ORDER, 'stats', userId),
};

/**
 * Generate OTP-related cache keys
 */
const otpKeys = {
  phone: (phoneNumber) => generateKey(NAMESPACE.OTP, 'phone', phoneNumber),
  email: (email) => generateKey(NAMESPACE.OTP, 'email', email),
};

/**
 * Generate authentication-related cache keys
 */
const authKeys = {
  refreshToken: (userId, tokenId) => generateKey(NAMESPACE.TOKEN, 'refresh', { userId, tokenId }),
  accessToken: (userId) => generateKey(NAMESPACE.TOKEN, 'access', userId),
  session: (sessionId) => generateKey(NAMESPACE.SESSION, 'data', sessionId),
};

/**
 * Generate search-related cache keys
 */
const searchKeys = {
  results: (params) => generateKey(NAMESPACE.SEARCH, 'results', params),
  suggestions: (prefix) => generateKey(NAMESPACE.SEARCH, 'suggestions', prefix),
};

/**
 * Generate sales-related cache keys
 */
const salesKeys = {
  overview: (period) => generateKey('sales', 'overview', period),
  byProduct: (productId, period) => generateKey('sales', 'product', { productId, period }),
  byCategory: (period) => generateKey('sales', 'category', period),
};

/**
 * Generate coupon-related cache keys
 */
const couponKeys = {
  detail: (code) => generateKey(NAMESPACE.COUPON, 'detail', code),
  list: (params) => generateKey(NAMESPACE.COUPON, 'list', params),
  validity: (code, userId) => generateKey(NAMESPACE.COUPON, 'validity', { code, userId }),
};

// Add rate limiting keys
const rateLimitKeys = {
  /**
   * Generate a key for IP-based rate limiting
   * @param {string} ip - The IP address
   * @param {string} route - The route being accessed (optional)
   * @returns {string} - The generated key
   */
  ip: (ip, route = 'global') => generateKey(NAMESPACE.RATE_LIMIT, `ip:${route}`, ip),

  /**
   * Generate a key for user-based rate limiting
   * @param {string} userId - The user ID
   * @param {string} route - The route being accessed (optional)
   * @returns {string} - The generated key
   */
  user: (userId, route = 'global') => generateKey(NAMESPACE.RATE_LIMIT, `user:${route}`, userId),

  /**
   * Generate a key for API key-based rate limiting
   * @param {string} apiKey - The API key identifier
   * @param {string} route - The route being accessed (optional)
   * @returns {string} - The generated key
   */
  apiKey: (apiKey, route = 'global') => generateKey(NAMESPACE.RATE_LIMIT, `apiKey:${route}`, apiKey)
};

export {
  generateKey,
  NAMESPACE,
  userKeys,
  productKeys,
  categoryKeys,
  cartKeys,
  orderKeys,
  otpKeys,
  authKeys,
  searchKeys,
  salesKeys,
  couponKeys,
  rateLimitKeys,
}; 