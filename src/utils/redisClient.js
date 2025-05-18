import { createClient } from "redis";

/**
 * Redis client singleton for caching operations throughout the application
 */
class RedisManager {
    constructor() {
        this.client = null;
        this.isReady = false;
    }

    /**
     * Initialize and connect to Redis
     */
    async connect() {
        try {
            // Create Redis client
            this.client = createClient({
                url: process.env.REDIS_URL || 'redis://localhost:6379',
            });

            // Set up event handlers
            this.client.on('error', (err) => {
                console.error('Redis Client Error:', err);
                this.isReady = false;
            });

            this.client.on('ready', () => {
                this.isReady = true;
            });

            // Connect to Redis
            await this.client.connect();
            return this.client;
        } catch (error) {
            console.error('Redis Connection Error:', error);
            throw error;
        }
    }

    /**
     * Get client instance (connect if not already connected)
     */
    async getClient() {
        if (!this.client || !this.isReady) {
            await this.connect();
        }
        return this.client;
    }

    /**
     * Set a key with value and optional expiry
     * 
     * @param {string} key - Redis key
     * @param {any} value - Data to cache (will be JSON stringified)
     * @param {number} ttlSeconds - Time to live in seconds
     * @returns {Promise<boolean>} - Success status
     */
    async set(key, value, ttlSeconds = null) {
        try {
            const client = await this.getClient();
            const serializedValue = JSON.stringify(value);
            
            if (ttlSeconds) {
                await client.setEx(key, ttlSeconds, serializedValue);
            } else {
                await client.set(key, serializedValue);
            }
            
            return true;
        } catch (error) {
            console.error(`Redis set error [${key}]:`, error);
            return false;
        }
    }

    /**
     * Get value for a key
     * 
     * @param {string} key - Redis key
     * @returns {Promise<any>} - Parsed cached data or null
     */
    async get(key) {
        try {
            const client = await this.getClient();
            const value = await client.get(key);
            
            if (!value) return null;
            
            return JSON.parse(value);
        } catch (error) {
            console.error(`Redis get error [${key}]:`, error);
            return null;
        }
    }

    /**
     * Delete a key
     * 
     * @param {string} key - Redis key
     * @returns {Promise<boolean>} - Success status
     */
    async del(key) {
        try {
            const client = await this.getClient();
            await client.del(key);
            return true;
        } catch (error) {
            console.error(`Redis del error [${key}]:`, error);
            return false;
        }
    }

    /**
     * Delete multiple keys matching a pattern
     * 
     * @param {string} pattern - Redis key pattern with wildcard (*)
     * @returns {Promise<number>} - Number of keys deleted
     */
    async delByPattern(pattern) {
        try {
            const client = await this.getClient();
            const keys = await client.keys(pattern);
            
            if (keys.length === 0) return 0;
            
            const pipeline = client.multi();
            keys.forEach(key => pipeline.del(key));
            
            const results = await pipeline.exec();
            return keys.length;
        } catch (error) {
            console.error(`Redis delByPattern error [${pattern}]:`, error);
            return 0;
        }
    }

    /**
     * Cache function result with specified key and TTL
     * 
     * @param {string} key - Redis key
     * @param {function} fn - Function to execute if cache miss
     * @param {number} ttlSeconds - Time to live in seconds
     * @returns {Promise<any>} - Cached or freshly fetched data
     */
    async cacheWrapper(key, fn, ttlSeconds = 3600) {
        try {
            // Try to get from cache first
            const cachedData = await this.get(key);
            
            if (cachedData !== null) {
                return cachedData;
            }
            
            // Cache miss - execute function
            const result = await fn();
            
            // Cache the result
            if (result !== undefined && result !== null) {
                await this.set(key, result, ttlSeconds);
            }
            
            return result;
        } catch (error) {
            console.error(`Redis cacheWrapper error [${key}]:`, error);
            // Execute function directly if caching fails
            return await fn();
        }
    }

    /**
     * Increment a counter
     * 
     * @param {string} key - Redis key
     * @param {number} increment - Amount to increment (default: 1)
     * @returns {Promise<number>} - Updated counter value
     */
    async increment(key, increment = 1) {
        try {
            const client = await this.getClient();
            return await client.incrBy(key, increment);
        } catch (error) {
            console.error(`Redis increment error [${key}]:`, error);
            return null;
        }
    }

    /**
     * Set key expiry time
     * 
     * @param {string} key - Redis key
     * @param {number} ttlSeconds - Time to live in seconds
     * @returns {Promise<boolean>} - Success status
     */
    async expire(key, ttlSeconds) {
        try {
            const client = await this.getClient();
            await client.expire(key, ttlSeconds);
            return true;
        } catch (error) {
            console.error(`Redis expire error [${key}]:`, error);
            return false;
        }
    }

    /**
     * Check if key exists
     * 
     * @param {string} key - Redis key
     * @returns {Promise<boolean>} - Whether key exists
     */
    async exists(key) {
        try {
            const client = await this.getClient();
            const result = await client.exists(key);
            return result === 1;
        } catch (error) {
            console.error(`Redis exists error [${key}]:`, error);
            return false;
        }
    }

    /**
     * Disconnect from Redis
     * @returns {Promise<boolean>} - Success status
     */
    async disconnect() {
        try {
            if (this.client && this.isReady) {
                await this.client.quit();
                this.isReady = false;
                return true;
            }
            return false;
        } catch (error) {
            console.error('Redis Disconnect Error:', error);
            return false;
        }
    }
}

// Singleton instance
const redisManager = new RedisManager();

export default redisManager;
