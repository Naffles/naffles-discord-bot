const redis = require('redis');
const logger = require('../utils/logger');

class RedisService {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = 5000; // 5 seconds
        
        // Cache configuration
        this.defaultTTL = 3600; // 1 hour
        this.cachePrefixes = {
            userSession: 'discord:session:',
            serverMapping: 'discord:server:',
            taskCache: 'discord:task:',
            rateLimiting: 'discord:ratelimit:',
            tempData: 'discord:temp:'
        };
    }

    async connect() {
        try {
            logger.info('Connecting to Redis...');

            const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
            
            this.client = redis.createClient({
                url: redisUrl,
                retry_strategy: (options) => {
                    if (options.error && options.error.code === 'ECONNREFUSED') {
                        logger.error('Redis server connection refused');
                        return new Error('Redis server connection refused');
                    }
                    if (options.total_retry_time > 1000 * 60 * 60) {
                        logger.error('Redis retry time exhausted');
                        return new Error('Retry time exhausted');
                    }
                    if (options.attempt > 10) {
                        logger.error('Redis max retry attempts reached');
                        return undefined;
                    }
                    // Reconnect after
                    return Math.min(options.attempt * 100, 3000);
                }
            });

            // Set up event listeners
            this.setupEventListeners();

            // Connect to Redis
            await this.client.connect();
            
            this.isConnected = true;
            this.reconnectAttempts = 0;
            
            logger.info('Redis connected successfully');

            // Test the connection
            await this.client.ping();
            logger.info('Redis ping successful');

        } catch (error) {
            logger.error('Failed to connect to Redis:', error);
            this.isConnected = false;
            await this.handleReconnection();
        }
    }

    setupEventListeners() {
        this.client.on('connect', () => {
            logger.info('Redis client connected');
        });

        this.client.on('ready', () => {
            logger.info('Redis client ready');
            this.isConnected = true;
        });

        this.client.on('error', (error) => {
            logger.error('Redis client error:', error);
            this.isConnected = false;
        });

        this.client.on('end', () => {
            logger.warn('Redis client connection ended');
            this.isConnected = false;
        });

        this.client.on('reconnecting', () => {
            logger.info('Redis client reconnecting...');
        });
    }

    async handleReconnection() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger.error('Max Redis reconnection attempts reached. Giving up.');
            return;
        }

        this.reconnectAttempts++;
        logger.info(`Attempting to reconnect to Redis (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

        setTimeout(async () => {
            try {
                await this.connect();
            } catch (error) {
                logger.error('Redis reconnection attempt failed:', error);
            }
        }, this.reconnectInterval * this.reconnectAttempts);
    }

    async disconnect() {
        try {
            if (this.client && this.isConnected) {
                await this.client.quit();
                this.isConnected = false;
                logger.info('Redis connection closed');
            }
        } catch (error) {
            logger.error('Error closing Redis connection:', error);
        }
    }

    // Generic Cache Methods
    async set(key, value, ttl = this.defaultTTL) {
        try {
            if (!this.isConnected) {
                logger.warn('Redis not connected, skipping cache set');
                return false;
            }

            const serializedValue = JSON.stringify(value);
            await this.client.setEx(key, ttl, serializedValue);
            return true;
        } catch (error) {
            logger.error('Failed to set cache value:', error);
            return false;
        }
    }

    async get(key) {
        try {
            if (!this.isConnected) {
                logger.warn('Redis not connected, skipping cache get');
                return null;
            }

            const value = await this.client.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            logger.error('Failed to get cache value:', error);
            return null;
        }
    }

    async del(key) {
        try {
            if (!this.isConnected) {
                logger.warn('Redis not connected, skipping cache delete');
                return false;
            }

            await this.client.del(key);
            return true;
        } catch (error) {
            logger.error('Failed to delete cache value:', error);
            return false;
        }
    }

    async exists(key) {
        try {
            if (!this.isConnected) {
                return false;
            }

            const result = await this.client.exists(key);
            return result === 1;
        } catch (error) {
            logger.error('Failed to check cache key existence:', error);
            return false;
        }
    }

    // User Session Methods
    async setUserSession(userId, sessionData, ttl = 86400) { // 24 hours
        const key = `${this.cachePrefixes.userSession}${userId}`;
        return await this.set(key, sessionData, ttl);
    }

    async getUserSession(userId) {
        const key = `${this.cachePrefixes.userSession}${userId}`;
        return await this.get(key);
    }

    async deleteUserSession(userId) {
        const key = `${this.cachePrefixes.userSession}${userId}`;
        return await this.del(key);
    }

    // Server Mapping Cache Methods
    async cacheServerMapping(guildId, mappingData, ttl = 3600) { // 1 hour
        const key = `${this.cachePrefixes.serverMapping}${guildId}`;
        return await this.set(key, mappingData, ttl);
    }

    async getCachedServerMapping(guildId) {
        const key = `${this.cachePrefixes.serverMapping}${guildId}`;
        return await this.get(key);
    }

    async invalidateServerMapping(guildId) {
        const key = `${this.cachePrefixes.serverMapping}${guildId}`;
        return await this.del(key);
    }

    // Task Cache Methods
    async cacheTaskData(taskId, taskData, ttl = 1800) { // 30 minutes
        const key = `${this.cachePrefixes.taskCache}${taskId}`;
        return await this.set(key, taskData, ttl);
    }

    async getCachedTaskData(taskId) {
        const key = `${this.cachePrefixes.taskCache}${taskId}`;
        return await this.get(key);
    }

    async invalidateTaskCache(taskId) {
        const key = `${this.cachePrefixes.taskCache}${taskId}`;
        return await this.del(key);
    }

    // Rate Limiting Methods
    async checkRateLimit(identifier, limit = 10, window = 60) {
        try {
            if (!this.isConnected) {
                return { allowed: true, remaining: limit };
            }

            const key = `${this.cachePrefixes.rateLimiting}${identifier}`;
            const current = await this.client.get(key);
            
            if (!current) {
                await this.client.setEx(key, window, '1');
                return { allowed: true, remaining: limit - 1 };
            }

            const count = parseInt(current);
            if (count >= limit) {
                const ttl = await this.client.ttl(key);
                return { 
                    allowed: false, 
                    remaining: 0, 
                    resetTime: Date.now() + (ttl * 1000) 
                };
            }

            await this.client.incr(key);
            return { allowed: true, remaining: limit - count - 1 };
        } catch (error) {
            logger.error('Failed to check rate limit:', error);
            return { allowed: true, remaining: limit };
        }
    }

    async resetRateLimit(identifier) {
        const key = `${this.cachePrefixes.rateLimiting}${identifier}`;
        return await this.del(key);
    }

    // Temporary Data Methods
    async setTempData(key, data, ttl = 300) { // 5 minutes
        const fullKey = `${this.cachePrefixes.tempData}${key}`;
        return await this.set(fullKey, data, ttl);
    }

    async getTempData(key) {
        const fullKey = `${this.cachePrefixes.tempData}${key}`;
        return await this.get(fullKey);
    }

    async deleteTempData(key) {
        const fullKey = `${this.cachePrefixes.tempData}${key}`;
        return await this.del(fullKey);
    }

    // Bulk Operations
    async mget(keys) {
        try {
            if (!this.isConnected || keys.length === 0) {
                return [];
            }

            const values = await this.client.mGet(keys);
            return values.map(value => value ? JSON.parse(value) : null);
        } catch (error) {
            logger.error('Failed to get multiple cache values:', error);
            return new Array(keys.length).fill(null);
        }
    }

    async mset(keyValuePairs, ttl = this.defaultTTL) {
        try {
            if (!this.isConnected || keyValuePairs.length === 0) {
                return false;
            }

            const pipeline = this.client.multi();
            
            for (const [key, value] of keyValuePairs) {
                const serializedValue = JSON.stringify(value);
                pipeline.setEx(key, ttl, serializedValue);
            }

            await pipeline.exec();
            return true;
        } catch (error) {
            logger.error('Failed to set multiple cache values:', error);
            return false;
        }
    }

    // Pattern-based Operations
    async deletePattern(pattern) {
        try {
            if (!this.isConnected) {
                return 0;
            }

            const keys = await this.client.keys(pattern);
            if (keys.length === 0) {
                return 0;
            }

            await this.client.del(keys);
            return keys.length;
        } catch (error) {
            logger.error('Failed to delete keys by pattern:', error);
            return 0;
        }
    }

    async getKeysByPattern(pattern) {
        try {
            if (!this.isConnected) {
                return [];
            }

            return await this.client.keys(pattern);
        } catch (error) {
            logger.error('Failed to get keys by pattern:', error);
            return [];
        }
    }

    // Statistics and Monitoring
    async getStats() {
        try {
            if (!this.isConnected) {
                return null;
            }

            const info = await this.client.info();
            const dbSize = await this.client.dbSize();
            
            return {
                connected: this.isConnected,
                dbSize,
                info: this.parseRedisInfo(info)
            };
        } catch (error) {
            logger.error('Failed to get Redis stats:', error);
            return null;
        }
    }

    parseRedisInfo(info) {
        const lines = info.split('\r\n');
        const parsed = {};
        
        for (const line of lines) {
            if (line.includes(':')) {
                const [key, value] = line.split(':');
                parsed[key] = value;
            }
        }
        
        return parsed;
    }

    // Health Check
    async ping() {
        try {
            if (!this.isConnected) {
                return false;
            }

            const result = await this.client.ping();
            return result === 'PONG';
        } catch (error) {
            logger.error('Redis ping failed:', error);
            return false;
        }
    }

    isHealthy() {
        return this.isConnected;
    }

    getConnectionInfo() {
        return {
            isConnected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.maxReconnectAttempts
        };
    }
}

module.exports = RedisService;