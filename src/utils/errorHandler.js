const logger = require('./logger');

class ErrorHandler {
    constructor() {
        this.errorCounts = new Map();
        this.errorThresholds = {
            discord: { count: 10, window: 300000 }, // 10 errors in 5 minutes
            api: { count: 20, window: 300000 }, // 20 errors in 5 minutes
            database: { count: 5, window: 300000 }, // 5 errors in 5 minutes
            general: { count: 50, window: 300000 } // 50 errors in 5 minutes
        };
        
        // Retry configuration
        this.retryConfig = {
            maxRetries: 3,
            baseDelay: 1000, // 1 second
            maxDelay: 30000, // 30 seconds
            backoffMultiplier: 2
        };
        
        // Maintenance mode tracking
        this.maintenanceMode = {
            active: false,
            reason: null,
            startTime: null,
            estimatedEndTime: null
        };
        
        // Service availability tracking
        this.serviceStatus = {
            discord: { available: true, lastCheck: Date.now() },
            nafflesApi: { available: true, lastCheck: Date.now() },
            database: { available: true, lastCheck: Date.now() }
        };
        
        // Start cleanup interval
        this.startCleanup();
    }

    /**
     * Handle Discord-related errors
     * @param {Error} error - The error object
     * @param {Object} context - Additional context
     * @returns {Object} Error handling result
     */
    handleDiscordError(error, context = {}) {
        const errorInfo = this.categorizeDiscordError(error);
        
        logger.logError(error, {
            category: 'discord',
            type: errorInfo.type,
            severity: errorInfo.severity,
            recoverable: errorInfo.recoverable,
            ...context
        });

        this.trackError('discord', errorInfo.type);

        return {
            type: errorInfo.type,
            severity: errorInfo.severity,
            recoverable: errorInfo.recoverable,
            userMessage: errorInfo.userMessage,
            action: errorInfo.action
        };
    }

    /**
     * Handle API-related errors
     * @param {Error} error - The error object
     * @param {Object} context - Additional context
     * @returns {Object} Error handling result
     */
    handleApiError(error, context = {}) {
        const errorInfo = this.categorizeApiError(error);
        
        logger.logError(error, {
            category: 'api',
            type: errorInfo.type,
            severity: errorInfo.severity,
            recoverable: errorInfo.recoverable,
            ...context
        });

        this.trackError('api', errorInfo.type);

        return {
            type: errorInfo.type,
            severity: errorInfo.severity,
            recoverable: errorInfo.recoverable,
            userMessage: errorInfo.userMessage,
            action: errorInfo.action
        };
    }

    /**
     * Handle database-related errors
     * @param {Error} error - The error object
     * @param {Object} context - Additional context
     * @returns {Object} Error handling result
     */
    handleDatabaseError(error, context = {}) {
        const errorInfo = this.categorizeDatabaseError(error);
        
        logger.logError(error, {
            category: 'database',
            type: errorInfo.type,
            severity: errorInfo.severity,
            recoverable: errorInfo.recoverable,
            ...context
        });

        this.trackError('database', errorInfo.type);

        return {
            type: errorInfo.type,
            severity: errorInfo.severity,
            recoverable: errorInfo.recoverable,
            userMessage: errorInfo.userMessage,
            action: errorInfo.action
        };
    }

    /**
     * Handle general errors
     * @param {Error} error - The error object
     * @param {Object} context - Additional context
     * @returns {Object} Error handling result
     */
    handleGeneralError(error, context = {}) {
        const errorInfo = this.categorizeGeneralError(error);
        
        logger.logError(error, {
            category: 'general',
            type: errorInfo.type,
            severity: errorInfo.severity,
            recoverable: errorInfo.recoverable,
            ...context
        });

        this.trackError('general', errorInfo.type);

        return {
            type: errorInfo.type,
            severity: errorInfo.severity,
            recoverable: errorInfo.recoverable,
            userMessage: errorInfo.userMessage,
            action: errorInfo.action
        };
    }

    /**
     * Categorize Discord errors
     * @param {Error} error - The error object
     * @returns {Object} Error categorization
     */
    categorizeDiscordError(error) {
        const message = error.message?.toLowerCase() || '';
        const code = error.code;

        // Rate limit errors
        if (code === 429 || message.includes('rate limit')) {
            return {
                type: 'rate_limit',
                severity: 'medium',
                recoverable: true,
                userMessage: 'Please wait a moment before trying again.',
                action: 'retry_with_delay'
            };
        }

        // Permission errors
        if (code === 50013 || message.includes('missing permissions')) {
            return {
                type: 'permissions',
                severity: 'medium',
                recoverable: false,
                userMessage: 'The bot lacks the necessary permissions to perform this action.',
                action: 'check_permissions'
            };
        }

        // Unknown guild/channel errors
        if (code === 10004 || code === 10003 || message.includes('unknown')) {
            return {
                type: 'not_found',
                severity: 'low',
                recoverable: false,
                userMessage: 'The requested server or channel could not be found.',
                action: 'validate_context'
            };
        }

        // Connection errors
        if (message.includes('connection') || message.includes('network')) {
            return {
                type: 'connection',
                severity: 'high',
                recoverable: true,
                userMessage: 'Connection issue detected. Please try again.',
                action: 'reconnect'
            };
        }

        // Token errors
        if (code === 401 || message.includes('unauthorized')) {
            return {
                type: 'authentication',
                severity: 'critical',
                recoverable: false,
                userMessage: 'Authentication failed. Please contact support.',
                action: 'check_token'
            };
        }

        // Default Discord error
        return {
            type: 'discord_unknown',
            severity: 'medium',
            recoverable: true,
            userMessage: 'A Discord error occurred. Please try again.',
            action: 'retry'
        };
    }

    /**
     * Categorize API errors
     * @param {Error} error - The error object
     * @returns {Object} Error categorization
     */
    categorizeApiError(error) {
        const status = error.response?.status;
        const message = error.message?.toLowerCase() || '';

        // Timeout errors
        if (message.includes('timeout') || error.code === 'ECONNABORTED') {
            return {
                type: 'timeout',
                severity: 'medium',
                recoverable: true,
                userMessage: 'Request timed out. Please try again.',
                action: 'retry'
            };
        }

        // Network errors
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            return {
                type: 'network',
                severity: 'high',
                recoverable: true,
                userMessage: 'Network error. Please try again later.',
                action: 'retry_with_delay'
            };
        }

        // HTTP status errors
        switch (status) {
            case 400:
                return {
                    type: 'bad_request',
                    severity: 'low',
                    recoverable: false,
                    userMessage: 'Invalid request. Please check your input.',
                    action: 'validate_input'
                };
            case 401:
                return {
                    type: 'unauthorized',
                    severity: 'high',
                    recoverable: false,
                    userMessage: 'Authentication failed. Please contact support.',
                    action: 'check_auth'
                };
            case 403:
                return {
                    type: 'forbidden',
                    severity: 'medium',
                    recoverable: false,
                    userMessage: 'Access denied. You may not have permission for this action.',
                    action: 'check_permissions'
                };
            case 404:
                return {
                    type: 'not_found',
                    severity: 'low',
                    recoverable: false,
                    userMessage: 'The requested resource was not found.',
                    action: 'validate_resource'
                };
            case 429:
                return {
                    type: 'rate_limit',
                    severity: 'medium',
                    recoverable: true,
                    userMessage: 'Too many requests. Please wait before trying again.',
                    action: 'retry_with_delay'
                };
            case 500:
            case 502:
            case 503:
            case 504:
                return {
                    type: 'server_error',
                    severity: 'high',
                    recoverable: true,
                    userMessage: 'Server error. Please try again later.',
                    action: 'retry_with_delay'
                };
            default:
                return {
                    type: 'api_unknown',
                    severity: 'medium',
                    recoverable: true,
                    userMessage: 'An API error occurred. Please try again.',
                    action: 'retry'
                };
        }
    }

    /**
     * Categorize database errors
     * @param {Error} error - The error object
     * @returns {Object} Error categorization
     */
    categorizeDatabaseError(error) {
        const message = error.message?.toLowerCase() || '';
        const name = error.name?.toLowerCase() || '';

        // Connection errors
        if (message.includes('connection') || name.includes('connection')) {
            return {
                type: 'connection',
                severity: 'critical',
                recoverable: true,
                userMessage: 'Database connection issue. Please try again.',
                action: 'reconnect'
            };
        }

        // Validation errors
        if (name.includes('validation') || message.includes('validation')) {
            return {
                type: 'validation',
                severity: 'low',
                recoverable: false,
                userMessage: 'Invalid data provided. Please check your input.',
                action: 'validate_data'
            };
        }

        // Duplicate key errors
        if (message.includes('duplicate') || message.includes('unique')) {
            return {
                type: 'duplicate',
                severity: 'low',
                recoverable: false,
                userMessage: 'This record already exists.',
                action: 'check_uniqueness'
            };
        }

        // Timeout errors
        if (message.includes('timeout')) {
            return {
                type: 'timeout',
                severity: 'medium',
                recoverable: true,
                userMessage: 'Database operation timed out. Please try again.',
                action: 'retry'
            };
        }

        // Default database error
        return {
            type: 'database_unknown',
            severity: 'high',
            recoverable: true,
            userMessage: 'A database error occurred. Please try again.',
            action: 'retry'
        };
    }

    /**
     * Categorize general errors
     * @param {Error} error - The error object
     * @returns {Object} Error categorization
     */
    categorizeGeneralError(error) {
        if (!error) {
            return {
                type: 'unknown',
                severity: 'medium',
                recoverable: true,
                userMessage: 'An unexpected error occurred. Please try again.',
                action: 'retry'
            };
        }
        
        const message = error.message?.toLowerCase() || '';
        const name = error.name?.toLowerCase() || '';

        // Type errors
        if (name.includes('type')) {
            return {
                type: 'type_error',
                severity: 'medium',
                recoverable: false,
                userMessage: 'Invalid data type. Please contact support.',
                action: 'validate_types'
            };
        }

        // Reference errors
        if (name.includes('reference')) {
            return {
                type: 'reference_error',
                severity: 'medium',
                recoverable: false,
                userMessage: 'Internal error. Please contact support.',
                action: 'check_references'
            };
        }

        // Syntax errors
        if (name.includes('syntax')) {
            return {
                type: 'syntax_error',
                severity: 'high',
                recoverable: false,
                userMessage: 'Internal error. Please contact support.',
                action: 'check_syntax'
            };
        }

        // Default general error
        return {
            type: 'unknown',
            severity: 'medium',
            recoverable: true,
            userMessage: 'An unexpected error occurred. Please try again.',
            action: 'retry'
        };
    }

    /**
     * Track error occurrences
     * @param {string} category - Error category
     * @param {string} type - Error type
     */
    trackError(category, type) {
        const key = `${category}:${type}`;
        const now = Date.now();
        
        if (!this.errorCounts.has(key)) {
            this.errorCounts.set(key, []);
        }
        
        const errors = this.errorCounts.get(key);
        errors.push(now);
        
        // Check if threshold exceeded
        const threshold = this.errorThresholds[category] || this.errorThresholds.general;
        const recentErrors = errors.filter(timestamp => 
            now - timestamp < threshold.window
        );
        
        if (recentErrors.length >= threshold.count) {
            logger.security('Error threshold exceeded', {
                category,
                type,
                count: recentErrors.length,
                threshold: threshold.count,
                window: threshold.window
            });
        }
        
        // Keep only recent errors
        this.errorCounts.set(key, recentErrors);
    }

    /**
     * Get error statistics
     * @returns {Object} Error statistics
     */
    getErrorStatistics() {
        const now = Date.now();
        const stats = {
            categories: {},
            total: 0,
            recent: 0 // Last hour
        };
        
        for (const [key, timestamps] of this.errorCounts.entries()) {
            const [category, type] = key.split(':');
            
            if (!stats.categories[category]) {
                stats.categories[category] = {
                    total: 0,
                    recent: 0,
                    types: {}
                };
            }
            
            const recentTimestamps = timestamps.filter(timestamp => 
                now - timestamp < 3600000 // Last hour
            );
            
            stats.categories[category].total += timestamps.length;
            stats.categories[category].recent += recentTimestamps.length;
            stats.categories[category].types[type] = {
                total: timestamps.length,
                recent: recentTimestamps.length
            };
            
            stats.total += timestamps.length;
            stats.recent += recentTimestamps.length;
        }
        
        return stats;
    }

    /**
     * Create user-friendly error message
     * @param {Object} errorResult - Error handling result
     * @param {Object} context - Additional context
     * @returns {string} User-friendly message
     */
    createUserMessage(errorResult, context = {}) {
        let message = errorResult.userMessage;
        
        if (context.command) {
            message = `Error with command "${context.command}": ${message}`;
        }
        
        if (errorResult.recoverable) {
            message += ' You can try again.';
        } else {
            message += ' If this problem persists, please contact support.';
        }
        
        return message;
    }

    /**
     * Start cleanup interval
     */
    startCleanup() {
        setInterval(() => {
            this.cleanup();
        }, 300000); // 5 minutes
        
        logger.info('Error handler cleanup started');
    }

    /**
     * Clean up old error records
     */
    cleanup() {
        try {
            const now = Date.now();
            const maxAge = 3600000; // 1 hour
            let cleanedCount = 0;
            
            for (const [key, timestamps] of this.errorCounts.entries()) {
                const recentTimestamps = timestamps.filter(timestamp => 
                    now - timestamp < maxAge
                );
                
                if (recentTimestamps.length === 0) {
                    this.errorCounts.delete(key);
                    cleanedCount++;
                } else if (recentTimestamps.length < timestamps.length) {
                    this.errorCounts.set(key, recentTimestamps);
                }
            }
            
            if (cleanedCount > 0) {
                logger.info('Error handler cleanup completed', { 
                    cleanedEntries: cleanedCount,
                    remainingEntries: this.errorCounts.size 
                });
            }
            
        } catch (error) {
            logger.error('Error handler cleanup failed:', error);
        }
    }

    /**
     * Clear all error tracking data
     */
    clear() {
        const size = this.errorCounts.size;
        this.errorCounts.clear();
        logger.info('Error handler cleared', { clearedEntries: size });
    }

    /**
     * Execute operation with retry mechanism
     * @param {Function} operation - Operation to execute
     * @param {Object} options - Retry options
     * @returns {Promise} Operation result
     */
    async executeWithRetry(operation, options = {}) {
        const config = { ...this.retryConfig, ...options };
        let lastError;
        
        for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                
                if (attempt === config.maxRetries) {
                    logger.error('Max retries exceeded', {
                        attempts: attempt + 1,
                        error: error.message
                    });
                    break;
                }
                
                const delay = this.calculateRetryDelay(attempt);
                logger.warn(`Retry attempt ${attempt + 1} after ${delay}ms`, {
                    error: error.message
                });
                
                await this.sleep(delay);
            }
        }
        
        throw lastError;
    }

    /**
     * Calculate retry delay with exponential backoff
     * @param {number} attempt - Attempt number
     * @returns {number} Delay in milliseconds
     */
    calculateRetryDelay(attempt) {
        const delay = this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt);
        return Math.min(delay, this.retryConfig.maxDelay);
    }

    /**
     * Sleep for specified duration
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise} Sleep promise
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Activate maintenance mode
     * @param {string} reason - Reason for maintenance
     * @param {Date} estimatedEndTime - Estimated end time
     */
    activateMaintenanceMode(reason, estimatedEndTime = null) {
        this.maintenanceMode = {
            active: true,
            reason,
            startTime: new Date(),
            estimatedEndTime
        };
        
        logger.warn('Maintenance mode activated', {
            reason,
            estimatedEndTime
        });
    }

    /**
     * Deactivate maintenance mode
     */
    deactivateMaintenanceMode() {
        const duration = this.maintenanceMode.startTime ? 
            Date.now() - this.maintenanceMode.startTime.getTime() : 0;
        
        this.maintenanceMode = {
            active: false,
            reason: null,
            startTime: null,
            estimatedEndTime: null
        };
        
        logger.info('Maintenance mode deactivated', { duration });
    }

    /**
     * Check if maintenance mode is active
     * @returns {boolean} Maintenance mode status
     */
    isMaintenanceModeActive() {
        return this.maintenanceMode.active;
    }

    /**
     * Get maintenance mode information
     * @returns {Object} Maintenance mode info
     */
    getMaintenanceInfo() {
        return { ...this.maintenanceMode };
    }

    /**
     * Update service availability status
     * @param {string} service - Service name
     * @param {boolean} available - Availability status
     */
    updateServiceStatus(service, available) {
        if (this.serviceStatus[service]) {
            this.serviceStatus[service].available = available;
            this.serviceStatus[service].lastCheck = Date.now();
            
            logger.info('Service status updated', {
                service,
                available,
                timestamp: new Date()
            });
        }
    }

    /**
     * Get service status
     * @param {string} service - Service name
     * @returns {Object} Service status
     */
    getServiceStatus(service) {
        return this.serviceStatus[service] || { available: false, lastCheck: 0 };
    }

    /**
     * Get all service statuses
     * @returns {Object} All service statuses
     */
    getAllServiceStatuses() {
        return { ...this.serviceStatus };
    }

    /**
     * Check if error should trigger fallback
     * @param {Object} errorResult - Error handling result
     * @returns {boolean} Should trigger fallback
     */
    shouldTriggerFallback(errorResult) {
        const fallbackTriggers = ['connection', 'server_error', 'timeout', 'authentication', 'network'];
        return fallbackTriggers.includes(errorResult.type) || 
               errorResult.severity === 'critical' || 
               errorResult.severity === 'high';
    }
}

module.exports = ErrorHandler;