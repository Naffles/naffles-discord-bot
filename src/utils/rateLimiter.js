const logger = require('./logger');

class RateLimiter {
    constructor() {
        this.limits = new Map();
        this.cleanupInterval = 60000; // 1 minute
        this.maxEntries = 10000; // Maximum entries to keep in memory
        
        // Default rate limit configurations
        this.defaultLimits = {
            command: { requests: 5, window: 60000 }, // 5 commands per minute
            interaction: { requests: 10, window: 60000 }, // 10 interactions per minute
            api: { requests: 20, window: 60000 }, // 20 API calls per minute
            global: { requests: 100, window: 60000 } // 100 total actions per minute
        };
        
        // Start cleanup interval
        this.startCleanup();
    }

    /**
     * Check if an action is rate limited
     * @param {string} identifier - Unique identifier (e.g., userId, guildId)
     * @param {string} action - Action type (command, interaction, api, global)
     * @param {Object} customLimit - Custom rate limit configuration
     * @returns {Object} Rate limit result
     */
    checkRateLimit(identifier, action = 'global', customLimit = null) {
        try {
            const key = `${identifier}:${action}`;
            const limit = customLimit || this.defaultLimits[action] || this.defaultLimits.global;
            const now = Date.now();
            
            // Get or create rate limit entry
            let entry = this.limits.get(key);
            if (!entry) {
                entry = {
                    requests: [],
                    createdAt: now
                };
                this.limits.set(key, entry);
            }
            
            // Remove expired requests
            entry.requests = entry.requests.filter(timestamp => 
                now - timestamp < limit.window
            );
            
            // Check if limit exceeded
            if (entry.requests.length >= limit.requests) {
                const oldestRequest = Math.min(...entry.requests);
                const resetTime = oldestRequest + limit.window;
                
                logger.security('Rate limit exceeded', {
                    identifier,
                    action,
                    currentRequests: entry.requests.length,
                    limit: limit.requests,
                    resetTime: new Date(resetTime).toISOString()
                });
                
                return {
                    allowed: false,
                    remaining: 0,
                    resetTime,
                    retryAfter: resetTime - now
                };
            }
            
            // Add current request
            entry.requests.push(now);
            entry.lastAccess = now;
            
            return {
                allowed: true,
                remaining: limit.requests - entry.requests.length,
                resetTime: now + limit.window,
                retryAfter: 0
            };
            
        } catch (error) {
            logger.error('Rate limiter error:', error);
            // On error, allow the request to prevent blocking legitimate users
            return {
                allowed: true,
                remaining: 1,
                resetTime: Date.now() + 60000,
                retryAfter: 0
            };
        }
    }

    /**
     * Check multiple rate limits at once
     * @param {string} identifier - Unique identifier
     * @param {Array} actions - Array of actions to check
     * @returns {Object} Combined rate limit result
     */
    checkMultipleRateLimits(identifier, actions) {
        const results = {};
        let overallAllowed = true;
        let minRemaining = Infinity;
        let maxRetryAfter = 0;
        
        for (const action of actions) {
            const result = this.checkRateLimit(identifier, action);
            results[action] = result;
            
            if (!result.allowed) {
                overallAllowed = false;
                maxRetryAfter = Math.max(maxRetryAfter, result.retryAfter);
            }
            
            minRemaining = Math.min(minRemaining, result.remaining);
        }
        
        return {
            allowed: overallAllowed,
            remaining: minRemaining === Infinity ? 0 : minRemaining,
            retryAfter: maxRetryAfter,
            details: results
        };
    }

    /**
     * Reset rate limit for a specific identifier and action
     * @param {string} identifier - Unique identifier
     * @param {string} action - Action type
     */
    resetRateLimit(identifier, action = null) {
        try {
            if (action) {
                const key = `${identifier}:${action}`;
                this.limits.delete(key);
                logger.info('Rate limit reset', { identifier, action });
            } else {
                // Reset all actions for this identifier
                const keysToDelete = [];
                for (const key of this.limits.keys()) {
                    if (key.startsWith(`${identifier}:`)) {
                        keysToDelete.push(key);
                    }
                }
                
                keysToDelete.forEach(key => this.limits.delete(key));
                logger.info('All rate limits reset', { identifier, count: keysToDelete.length });
            }
        } catch (error) {
            logger.error('Failed to reset rate limit:', error);
        }
    }

    /**
     * Get current rate limit status
     * @param {string} identifier - Unique identifier
     * @param {string} action - Action type
     * @returns {Object} Current status
     */
    getRateLimitStatus(identifier, action = 'global') {
        try {
            const key = `${identifier}:${action}`;
            const entry = this.limits.get(key);
            const limit = this.defaultLimits[action] || this.defaultLimits.global;
            const now = Date.now();
            
            if (!entry) {
                return {
                    requests: 0,
                    remaining: limit.requests,
                    resetTime: now + limit.window,
                    isLimited: false
                };
            }
            
            // Filter expired requests
            const activeRequests = entry.requests.filter(timestamp => 
                now - timestamp < limit.window
            );
            
            const remaining = Math.max(0, limit.requests - activeRequests.length);
            const isLimited = remaining === 0;
            const resetTime = activeRequests.length > 0 ? 
                Math.min(...activeRequests) + limit.window : 
                now + limit.window;
            
            return {
                requests: activeRequests.length,
                remaining,
                resetTime,
                isLimited
            };
            
        } catch (error) {
            logger.error('Failed to get rate limit status:', error);
            return {
                requests: 0,
                remaining: 1,
                resetTime: Date.now() + 60000,
                isLimited: false
            };
        }
    }

    /**
     * Update rate limit configuration
     * @param {string} action - Action type
     * @param {Object} config - New configuration
     */
    updateRateLimit(action, config) {
        try {
            if (!config.requests || !config.window) {
                throw new Error('Rate limit config must include requests and window');
            }
            
            this.defaultLimits[action] = {
                requests: parseInt(config.requests),
                window: parseInt(config.window)
            };
            
            logger.info('Rate limit updated', { action, config: this.defaultLimits[action] });
        } catch (error) {
            logger.error('Failed to update rate limit:', error);
        }
    }

    /**
     * Get rate limiter statistics
     * @returns {Object} Statistics
     */
    getStatistics() {
        try {
            const now = Date.now();
            let totalEntries = 0;
            let activeEntries = 0;
            let totalRequests = 0;
            const actionStats = {};
            
            for (const [key, entry] of this.limits.entries()) {
                totalEntries++;
                
                const [identifier, action] = key.split(':');
                if (!actionStats[action]) {
                    actionStats[action] = { entries: 0, requests: 0 };
                }
                
                // Count active requests
                const activeRequests = entry.requests.filter(timestamp => 
                    now - timestamp < 60000 // Last minute
                );
                
                if (activeRequests.length > 0) {
                    activeEntries++;
                }
                
                totalRequests += entry.requests.length;
                actionStats[action].entries++;
                actionStats[action].requests += entry.requests.length;
            }
            
            return {
                totalEntries,
                activeEntries,
                totalRequests,
                memoryUsage: this.limits.size,
                actionStats,
                limits: this.defaultLimits
            };
            
        } catch (error) {
            logger.error('Failed to get rate limiter statistics:', error);
            return {
                totalEntries: 0,
                activeEntries: 0,
                totalRequests: 0,
                memoryUsage: 0,
                actionStats: {},
                limits: this.defaultLimits
            };
        }
    }

    /**
     * Start cleanup interval to remove old entries
     */
    startCleanup() {
        setInterval(() => {
            this.cleanup();
        }, this.cleanupInterval);
        
        logger.info('Rate limiter cleanup started', { 
            interval: this.cleanupInterval,
            maxEntries: this.maxEntries 
        });
    }

    /**
     * Clean up old and expired entries
     */
    cleanup() {
        try {
            const now = Date.now();
            const keysToDelete = [];
            let cleanedRequests = 0;
            
            for (const [key, entry] of this.limits.entries()) {
                // Remove expired requests
                const originalLength = entry.requests.length;
                entry.requests = entry.requests.filter(timestamp => 
                    now - timestamp < Math.max(...Object.values(this.defaultLimits).map(l => l.window))
                );
                
                cleanedRequests += originalLength - entry.requests.length;
                
                // Remove entries with no active requests and old last access
                if (entry.requests.length === 0 && 
                    (!entry.lastAccess || now - entry.lastAccess > 300000)) { // 5 minutes
                    keysToDelete.push(key);
                }
            }
            
            // Delete old entries
            keysToDelete.forEach(key => this.limits.delete(key));
            
            // If still too many entries, remove oldest ones
            if (this.limits.size > this.maxEntries) {
                const sortedEntries = Array.from(this.limits.entries())
                    .sort(([, a], [, b]) => (a.lastAccess || a.createdAt) - (b.lastAccess || b.createdAt));
                
                const toRemove = this.limits.size - this.maxEntries;
                for (let i = 0; i < toRemove; i++) {
                    this.limits.delete(sortedEntries[i][0]);
                    keysToDelete.push(sortedEntries[i][0]);
                }
            }
            
            if (keysToDelete.length > 0 || cleanedRequests > 0) {
                logger.info('Rate limiter cleanup completed', {
                    deletedEntries: keysToDelete.length,
                    cleanedRequests,
                    remainingEntries: this.limits.size
                });
            }
            
        } catch (error) {
            logger.error('Rate limiter cleanup failed:', error);
        }
    }

    /**
     * Clear all rate limit data
     */
    clear() {
        const size = this.limits.size;
        this.limits.clear();
        logger.info('Rate limiter cleared', { clearedEntries: size });
    }
}

module.exports = RateLimiter;