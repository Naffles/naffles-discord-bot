const logger = require('../utils/logger');

class HealthMonitor {
    constructor(client, botService) {
        this.client = client;
        this.botService = botService;
        this.isRunning = false;
        this.interval = null;
        this.checkInterval = 30000; // 30 seconds

        // Health check configuration
        this.healthChecks = {
            discord: { enabled: true, timeout: 5000 },
            database: { enabled: true, timeout: 5000 },
            redis: { enabled: true, timeout: 5000 },
            nafflesApi: { enabled: true, timeout: 10000 }
        };

        // Health status tracking
        this.healthStatus = {
            overall: 'unknown',
            lastCheck: null,
            services: {
                discord: { status: 'unknown', lastCheck: null, error: null },
                database: { status: 'unknown', lastCheck: null, error: null },
                redis: { status: 'unknown', lastCheck: null, error: null },
                nafflesApi: { status: 'unknown', lastCheck: null, error: null }
            }
        };

        // Alert thresholds
        this.alertThresholds = {
            consecutiveFailures: 3,
            responseTimeWarning: 5000,
            responseTimeCritical: 10000
        };

        // Failure tracking
        this.failureCount = {
            discord: 0,
            database: 0,
            redis: 0,
            nafflesApi: 0
        };
    }

    /**
     * Start health monitoring
     */
    start() {
        if (this.isRunning) {
            logger.warn('Health monitor is already running');
            return;
        }

        logger.info('Starting health monitor');
        this.isRunning = true;

        // Run initial health check
        this.performHealthCheck();

        // Schedule periodic health checks
        this.interval = setInterval(() => {
            this.performHealthCheck();
        }, this.checkInterval);
    }

    /**
     * Stop health monitoring
     */
    stop() {
        if (!this.isRunning) {
            logger.warn('Health monitor is not running');
            return;
        }

        logger.info('Stopping health monitor');
        this.isRunning = false;

        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    /**
     * Perform comprehensive health check
     */
    async performHealthCheck() {
        const startTime = Date.now();
        logger.debug('Starting health check');

        const results = {};

        // Check each service
        for (const [serviceName, config] of Object.entries(this.healthChecks)) {
            if (config.enabled) {
                results[serviceName] = await this.checkService(serviceName, config);
            } else {
                results[serviceName] = { status: 'disabled', responseTime: 0 };
            }
        }

        // Update health status
        this.updateHealthStatus(results);

        // Log results
        const totalTime = Date.now() - startTime;
        logger.debug(`Health check completed in ${totalTime}ms`, {
            overall: this.healthStatus.overall,
            services: Object.keys(results).map(service => ({
                service,
                status: results[service].status,
                responseTime: results[service].responseTime
            }))
        });

        // Handle alerts if needed
        this.handleAlerts(results);
    }

    /**
     * Check individual service health
     */
    async checkService(serviceName, config) {
        const startTime = Date.now();

        try {
            let result;

            switch (serviceName) {
                case 'discord':
                    result = await this.checkDiscordHealth(config.timeout);
                    break;
                case 'database':
                    result = await this.checkDatabaseHealth(config.timeout);
                    break;
                case 'redis':
                    result = await this.checkRedisHealth(config.timeout);
                    break;
                case 'nafflesApi':
                    result = await this.checkNafflesApiHealth(config.timeout);
                    break;
                default:
                    throw new Error(`Unknown service: ${serviceName}`);
            }

            const responseTime = Date.now() - startTime;
            this.failureCount[serviceName] = 0; // Reset failure count on success

            return {
                status: 'healthy',
                responseTime,
                details: result
            };

        } catch (error) {
            const responseTime = Date.now() - startTime;
            this.failureCount[serviceName]++;

            logger.error(`Health check failed for ${serviceName}`, {
                error: error.message,
                responseTime,
                failureCount: this.failureCount[serviceName]
            });

            return {
                status: 'unhealthy',
                responseTime,
                error: error.message
            };
        }
    }

    /**
     * Check Discord client health
     */
    async checkDiscordHealth(timeout) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('Discord health check timeout'));
            }, timeout);

            try {
                if (!this.client || !this.client.isReady()) {
                    clearTimeout(timer);
                    reject(new Error('Discord client not ready'));
                    return;
                }

                // Check if we can access basic client properties
                const guilds = this.client.guilds.cache.size;
                const ping = this.client.ws.ping;

                clearTimeout(timer);
                resolve({
                    guilds,
                    ping,
                    uptime: this.client.uptime
                });

            } catch (error) {
                clearTimeout(timer);
                reject(error);
            }
        });
    }

    /**
     * Check database health
     */
    async checkDatabaseHealth(timeout) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('Database health check timeout'));
            }, timeout);

            try {
                // Import database service dynamically to avoid circular dependencies
                const databaseService = require('./databaseService');

                if (!databaseService.isConnected()) {
                    clearTimeout(timer);
                    reject(new Error('Database not connected'));
                    return;
                }

                // Perform a simple query to test connectivity
                databaseService.testConnection()
                    .then((result) => {
                        clearTimeout(timer);
                        resolve(result);
                    })
                    .catch((error) => {
                        clearTimeout(timer);
                        reject(error);
                    });

            } catch (error) {
                clearTimeout(timer);
                reject(error);
            }
        });
    }

    /**
     * Check Redis health
     */
    async checkRedisHealth(timeout) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('Redis health check timeout'));
            }, timeout);

            try {
                // Import Redis service dynamically to avoid circular dependencies
                const redisService = require('./redisService');

                if (!redisService.isConnected()) {
                    clearTimeout(timer);
                    reject(new Error('Redis not connected'));
                    return;
                }

                // Perform a simple ping to test connectivity
                redisService.ping()
                    .then((result) => {
                        clearTimeout(timer);
                        resolve(result);
                    })
                    .catch((error) => {
                        clearTimeout(timer);
                        reject(error);
                    });

            } catch (error) {
                clearTimeout(timer);
                reject(error);
            }
        });
    }

    /**
     * Check Naffles API health
     */
    async checkNafflesApiHealth(timeout) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('Naffles API health check timeout'));
            }, timeout);

            try {
                // Use the bot service to check API connectivity
                this.botService.testApiConnection()
                    .then((result) => {
                        clearTimeout(timer);
                        resolve(result);
                    })
                    .catch((error) => {
                        clearTimeout(timer);
                        reject(error);
                    });

            } catch (error) {
                clearTimeout(timer);
                reject(error);
            }
        });
    }

    /**
     * Update overall health status based on service results
     */
    updateHealthStatus(results) {
        const now = new Date();

        // Update individual service statuses
        for (const [serviceName, result] of Object.entries(results)) {
            this.healthStatus.services[serviceName] = {
                status: result.status,
                lastCheck: now,
                error: result.error || null,
                responseTime: result.responseTime
            };
        }

        // Determine overall health status
        const serviceStatuses = Object.values(results).map(r => r.status);

        if (serviceStatuses.every(status => status === 'healthy' || status === 'disabled')) {
            this.healthStatus.overall = 'healthy';
        } else if (serviceStatuses.some(status => status === 'healthy')) {
            this.healthStatus.overall = 'degraded';
        } else {
            this.healthStatus.overall = 'unhealthy';
        }

        this.healthStatus.lastCheck = now;
    }

    /**
     * Handle health check alerts
     */
    handleAlerts(results) {
        for (const [serviceName, result] of Object.entries(results)) {
            const failureCount = this.failureCount[serviceName];

            // Alert on consecutive failures
            if (failureCount >= this.alertThresholds.consecutiveFailures) {
                logger.error(`Service ${serviceName} has failed ${failureCount} consecutive times`, {
                    service: serviceName,
                    status: result.status,
                    error: result.error,
                    failureCount
                });
            }

            // Alert on slow response times
            if (result.responseTime > this.alertThresholds.responseTimeCritical) {
                logger.warn(`Service ${serviceName} response time is critical: ${result.responseTime}ms`, {
                    service: serviceName,
                    responseTime: result.responseTime,
                    threshold: this.alertThresholds.responseTimeCritical
                });
            } else if (result.responseTime > this.alertThresholds.responseTimeWarning) {
                logger.warn(`Service ${serviceName} response time is slow: ${result.responseTime}ms`, {
                    service: serviceName,
                    responseTime: result.responseTime,
                    threshold: this.alertThresholds.responseTimeWarning
                });
            }
        }
    }

    /**
     * Get current health status
     */
    getHealthStatus() {
        return {
            ...this.healthStatus,
            isMonitoring: this.isRunning,
            checkInterval: this.checkInterval
        };
    }

    /**
     * Get detailed health report
     */
    getHealthReport() {
        const status = this.getHealthStatus();

        return {
            timestamp: new Date().toISOString(),
            overall: status.overall,
            isMonitoring: status.isMonitoring,
            lastCheck: status.lastCheck,
            services: Object.entries(status.services).map(([name, service]) => ({
                name,
                status: service.status,
                lastCheck: service.lastCheck,
                responseTime: service.responseTime,
                error: service.error,
                failureCount: this.failureCount[name]
            })),
            configuration: {
                checkInterval: this.checkInterval,
                healthChecks: this.healthChecks,
                alertThresholds: this.alertThresholds
            }
        };
    }

    /**
     * Update health check configuration
     */
    updateConfiguration(config) {
        if (config.checkInterval) {
            this.checkInterval = config.checkInterval;

            // Restart monitoring with new interval if running
            if (this.isRunning) {
                this.stop();
                this.start();
            }
        }

        if (config.healthChecks) {
            this.healthChecks = { ...this.healthChecks, ...config.healthChecks };
        }

        if (config.alertThresholds) {
            this.alertThresholds = { ...this.alertThresholds, ...config.alertThresholds };
        }

        logger.info('Health monitor configuration updated', config);
    }
}

module.exports = HealthMonitor;