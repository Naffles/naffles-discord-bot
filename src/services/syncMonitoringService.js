const logger = require('../utils/logger');

/**
 * Sync Monitoring Service
 * Monitors synchronization performance, detects issues, and provides optimization recommendations
 * Handles sync error recovery and performance analytics
 */
class SyncMonitoringService {
    constructor(botService, syncService) {
        this.botService = botService;
        this.syncService = syncService;
        this.redis = botService.redis;
        
        // Monitoring configuration
        this.monitoringInterval = 30000; // 30 seconds
        this.alertThresholds = {
            failureRate: 0.1, // 10% failure rate
            avgSyncTime: 5000, // 5 seconds
            queueSize: 100,
            errorCooldowns: 10
        };
        
        // Performance tracking
        this.performanceHistory = [];
        this.maxHistorySize = 1000;
        
        // Alert state
        this.activeAlerts = new Map();
        this.alertCooldowns = new Map();
        this.alertCooldownDuration = 5 * 60 * 1000; // 5 minutes
        
        // Optimization recommendations
        this.optimizationCache = new Map();
        this.optimizationCacheExpiry = 10 * 60 * 1000; // 10 minutes
        
        // Health status
        this.healthStatus = {
            overall: 'healthy',
            components: {
                syncQueue: 'healthy',
                batchProcessing: 'healthy',
                webhookIntegration: 'healthy',
                errorRecovery: 'healthy'
            },
            lastCheck: null
        };
        
        // Monitoring intervals
        this.intervals = [];
    }

    /**
     * Initialize sync monitoring service
     */
    async initialize() {
        try {
            logger.info('Initializing Sync Monitoring Service...');

            // Start performance monitoring
            this.startPerformanceMonitoring();

            // Start health checks
            this.startHealthChecks();

            // Start alert monitoring
            this.startAlertMonitoring();

            // Start optimization analysis
            this.startOptimizationAnalysis();

            // Setup event listeners
            this.setupEventListeners();

            logger.info('Sync Monitoring Service initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Sync Monitoring Service:', error);
            throw error;
        }
    }

    /**
     * Start performance monitoring
     */
    startPerformanceMonitoring() {
        // Skip intervals in test environment
        if (process.env.NODE_ENV === 'test') {
            logger.info('Skipping performance monitoring intervals in test environment');
            return;
        }

        const interval = setInterval(async () => {
            await this.collectPerformanceMetrics();
        }, this.monitoringInterval);

        this.intervals.push(interval);
        logger.info('Performance monitoring started');
    }

    /**
     * Start health checks
     */
    startHealthChecks() {
        // Skip intervals in test environment
        if (process.env.NODE_ENV === 'test') {
            logger.info('Skipping health check intervals in test environment');
            return;
        }

        const interval = setInterval(async () => {
            await this.performHealthCheck();
        }, this.monitoringInterval);

        this.intervals.push(interval);
        logger.info('Health checks started');
    }

    /**
     * Start alert monitoring
     */
    startAlertMonitoring() {
        // Skip intervals in test environment
        if (process.env.NODE_ENV === 'test') {
            logger.info('Skipping alert monitoring intervals in test environment');
            return;
        }

        const interval = setInterval(async () => {
            await this.checkAlertConditions();
        }, this.monitoringInterval);

        this.intervals.push(interval);
        logger.info('Alert monitoring started');
    }

    /**
     * Start optimization analysis
     */
    startOptimizationAnalysis() {
        // Skip intervals in test environment
        if (process.env.NODE_ENV === 'test') {
            logger.info('Skipping optimization analysis intervals in test environment');
            return;
        }

        const interval = setInterval(async () => {
            await this.analyzeOptimizationOpportunities();
        }, 5 * 60 * 1000); // Every 5 minutes

        this.intervals.push(interval);
        logger.info('Optimization analysis started');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for sync events
        this.syncService.on('syncCompleted', (data) => {
            this.recordSyncEvent('completed', data);
        });

        this.syncService.on('syncFailed', (data) => {
            this.recordSyncEvent('failed', data);
        });

        this.syncService.on('batchProcessed', (data) => {
            this.recordBatchEvent(data);
        });

        this.syncService.on('webhookReceived', (data) => {
            this.recordWebhookEvent(data);
        });
    }

    /**
     * Collect performance metrics
     */
    async collectPerformanceMetrics() {
        try {
            const syncStats = this.syncService.getStatistics();
            const timestamp = Date.now();

            const metrics = {
                timestamp,
                syncOperations: syncStats.syncOperations,
                successfulSyncs: syncStats.successfulSyncs,
                failedSyncs: syncStats.failedSyncs,
                queueSize: syncStats.queueSize,
                activeSyncs: syncStats.activeSyncs,
                batchQueueSize: syncStats.batchQueueSize,
                errorCooldowns: syncStats.errorCooldowns,
                averageSyncTime: syncStats.averageSyncTime,
                webhookEvents: syncStats.webhookEvents,
                failureRate: syncStats.syncOperations > 0 ? 
                    (syncStats.failedSyncs / syncStats.syncOperations) : 0
            };

            // Add to performance history
            this.performanceHistory.push(metrics);
            
            // Trim history if too large
            while (this.performanceHistory.length > this.maxHistorySize) {
                this.performanceHistory.shift();
            }

            // Store in Redis for persistence
            await this.redis.setex(
                'discord_sync_performance',
                300, // 5 minutes TTL
                JSON.stringify(metrics)
            );

            logger.debug('Performance metrics collected:', {
                queueSize: metrics.queueSize,
                failureRate: (metrics.failureRate * 100).toFixed(2) + '%',
                avgSyncTime: metrics.averageSyncTime.toFixed(0) + 'ms'
            });

        } catch (error) {
            logger.error('Error collecting performance metrics:', error);
        }
    }

    /**
     * Perform comprehensive health check
     */
    async performHealthCheck() {
        try {
            const timestamp = Date.now();
            const syncStats = this.syncService.getStatistics();

            // Check sync queue health
            const queueHealth = this.checkQueueHealth(syncStats);
            
            // Check batch processing health
            const batchHealth = this.checkBatchProcessingHealth(syncStats);
            
            // Check webhook integration health
            const webhookHealth = await this.checkWebhookIntegrationHealth();
            
            // Check error recovery health
            const errorRecoveryHealth = this.checkErrorRecoveryHealth(syncStats);

            // Update health status
            this.healthStatus = {
                overall: this.calculateOverallHealth([
                    queueHealth,
                    batchHealth,
                    webhookHealth,
                    errorRecoveryHealth
                ]),
                components: {
                    syncQueue: queueHealth,
                    batchProcessing: batchHealth,
                    webhookIntegration: webhookHealth,
                    errorRecovery: errorRecoveryHealth
                },
                lastCheck: timestamp
            };

            // Log health status changes
            if (this.healthStatus.overall !== 'healthy') {
                logger.warn('Sync service health degraded:', this.healthStatus);
            }

        } catch (error) {
            logger.error('Error performing health check:', error);
            this.healthStatus.overall = 'unhealthy';
        }
    }

    /**
     * Check alert conditions
     */
    async checkAlertConditions() {
        try {
            if (this.performanceHistory.length === 0) return;

            const latestMetrics = this.performanceHistory[this.performanceHistory.length - 1];
            const alerts = [];

            // Check failure rate
            if (latestMetrics.failureRate > this.alertThresholds.failureRate) {
                alerts.push({
                    type: 'high_failure_rate',
                    severity: 'warning',
                    message: `Sync failure rate is ${(latestMetrics.failureRate * 100).toFixed(1)}%`,
                    threshold: this.alertThresholds.failureRate,
                    current: latestMetrics.failureRate
                });
            }

            // Check average sync time
            if (latestMetrics.averageSyncTime > this.alertThresholds.avgSyncTime) {
                alerts.push({
                    type: 'slow_sync_time',
                    severity: 'warning',
                    message: `Average sync time is ${latestMetrics.averageSyncTime.toFixed(0)}ms`,
                    threshold: this.alertThresholds.avgSyncTime,
                    current: latestMetrics.averageSyncTime
                });
            }

            // Check queue size
            if (latestMetrics.queueSize > this.alertThresholds.queueSize) {
                alerts.push({
                    type: 'large_queue_size',
                    severity: 'warning',
                    message: `Sync queue size is ${latestMetrics.queueSize}`,
                    threshold: this.alertThresholds.queueSize,
                    current: latestMetrics.queueSize
                });
            }

            // Check error cooldowns
            if (latestMetrics.errorCooldowns > this.alertThresholds.errorCooldowns) {
                alerts.push({
                    type: 'many_error_cooldowns',
                    severity: 'critical',
                    message: `${latestMetrics.errorCooldowns} operations on error cooldown`,
                    threshold: this.alertThresholds.errorCooldowns,
                    current: latestMetrics.errorCooldowns
                });
            }

            // Process alerts
            for (const alert of alerts) {
                await this.processAlert(alert);
            }

        } catch (error) {
            logger.error('Error checking alert conditions:', error);
        }
    }

    /**
     * Process alert
     * @param {Object} alert - Alert data
     */
    async processAlert(alert) {
        try {
            const alertKey = `${alert.type}_${Date.now()}`;
            
            // Check if we're in cooldown for this alert type
            if (this.isAlertOnCooldown(alert.type)) {
                return;
            }

            // Add to active alerts
            this.activeAlerts.set(alertKey, {
                ...alert,
                timestamp: Date.now(),
                acknowledged: false
            });

            // Set cooldown
            this.alertCooldowns.set(alert.type, Date.now());

            // Log alert
            logger.warn(`Sync monitoring alert: ${alert.message}`, {
                type: alert.type,
                severity: alert.severity,
                threshold: alert.threshold,
                current: alert.current
            });

            // Send alert to administrators if critical
            if (alert.severity === 'critical') {
                await this.sendCriticalAlert(alert);
            }

            // Store alert in Redis
            await this.redis.setex(
                `discord_sync_alert:${alertKey}`,
                3600, // 1 hour TTL
                JSON.stringify(alert)
            );

        } catch (error) {
            logger.error('Error processing alert:', error);
        }
    }

    /**
     * Analyze optimization opportunities
     */
    async analyzeOptimizationOpportunities() {
        try {
            if (this.performanceHistory.length < 10) return;

            const cacheKey = 'optimization_analysis';
            const cached = this.optimizationCache.get(cacheKey);
            
            if (cached && (Date.now() - cached.timestamp) < this.optimizationCacheExpiry) {
                return cached.recommendations;
            }

            const recommendations = [];
            const recentMetrics = this.performanceHistory.slice(-10);

            // Analyze queue size trends
            const avgQueueSize = recentMetrics.reduce((sum, m) => sum + m.queueSize, 0) / recentMetrics.length;
            if (avgQueueSize > 50) {
                recommendations.push({
                    type: 'queue_optimization',
                    priority: 'medium',
                    description: 'Consider increasing batch processing frequency or size',
                    impact: 'Reduce queue buildup and improve sync latency',
                    implementation: 'Adjust batch processing parameters in sync service'
                });
            }

            // Analyze sync time trends
            const avgSyncTime = recentMetrics.reduce((sum, m) => sum + m.averageSyncTime, 0) / recentMetrics.length;
            if (avgSyncTime > 3000) {
                recommendations.push({
                    type: 'performance_optimization',
                    priority: 'high',
                    description: 'Sync operations are taking longer than optimal',
                    impact: 'Improve overall sync performance and user experience',
                    implementation: 'Review API call timeouts and add connection pooling'
                });
            }

            // Analyze failure patterns
            const avgFailureRate = recentMetrics.reduce((sum, m) => sum + m.failureRate, 0) / recentMetrics.length;
            if (avgFailureRate > 0.05) {
                recommendations.push({
                    type: 'reliability_optimization',
                    priority: 'high',
                    description: 'Sync failure rate is higher than expected',
                    impact: 'Improve sync reliability and reduce data inconsistencies',
                    implementation: 'Review error handling and add more robust retry mechanisms'
                });
            }

            // Analyze batch processing efficiency
            const batchMetrics = recentMetrics.filter(m => m.batchQueueSize > 0);
            if (batchMetrics.length > 0) {
                const avgBatchSize = batchMetrics.reduce((sum, m) => sum + m.batchQueueSize, 0) / batchMetrics.length;
                if (avgBatchSize < 10) {
                    recommendations.push({
                        type: 'batch_optimization',
                        priority: 'low',
                        description: 'Batch processing could be more efficient with larger batches',
                        impact: 'Reduce API call overhead and improve throughput',
                        implementation: 'Increase batch size or adjust batch timeout'
                    });
                }
            }

            // Cache recommendations
            this.optimizationCache.set(cacheKey, {
                recommendations,
                timestamp: Date.now()
            });

            if (recommendations.length > 0) {
                logger.info(`Generated ${recommendations.length} optimization recommendations`);
                
                // Log high priority recommendations
                const highPriority = recommendations.filter(r => r.priority === 'high');
                if (highPriority.length > 0) {
                    logger.warn('High priority optimization recommendations:', 
                        highPriority.map(r => r.description)
                    );
                }
            }

            return recommendations;

        } catch (error) {
            logger.error('Error analyzing optimization opportunities:', error);
            return [];
        }
    }

    /**
     * Record sync event
     * @param {string} type - Event type
     * @param {Object} data - Event data
     */
    recordSyncEvent(type, data) {
        try {
            const event = {
                type,
                timestamp: Date.now(),
                syncId: data.syncId,
                syncType: data.syncType,
                duration: data.duration,
                success: type === 'completed'
            };

            // Store recent events for analysis
            this.redis.lpush('discord_sync_events', JSON.stringify(event));
            this.redis.ltrim('discord_sync_events', 0, 999); // Keep last 1000 events
            this.redis.expire('discord_sync_events', 3600); // 1 hour TTL

        } catch (error) {
            logger.error('Error recording sync event:', error);
        }
    }

    /**
     * Record batch event
     * @param {Object} data - Batch event data
     */
    recordBatchEvent(data) {
        try {
            const event = {
                type: 'batch_processed',
                timestamp: Date.now(),
                batchId: data.batchId,
                operationCount: data.operationCount,
                successful: data.successful,
                failed: data.failed,
                duration: data.duration
            };

            this.redis.lpush('discord_batch_events', JSON.stringify(event));
            this.redis.ltrim('discord_batch_events', 0, 499); // Keep last 500 events
            this.redis.expire('discord_batch_events', 3600); // 1 hour TTL

        } catch (error) {
            logger.error('Error recording batch event:', error);
        }
    }

    /**
     * Record webhook event
     * @param {Object} data - Webhook event data
     */
    recordWebhookEvent(data) {
        try {
            const event = {
                type: 'webhook_received',
                timestamp: Date.now(),
                eventType: data.eventType,
                processed: data.processed,
                batchId: data.batchId
            };

            this.redis.lpush('discord_webhook_events', JSON.stringify(event));
            this.redis.ltrim('discord_webhook_events', 0, 999); // Keep last 1000 events
            this.redis.expire('discord_webhook_events', 3600); // 1 hour TTL

        } catch (error) {
            logger.error('Error recording webhook event:', error);
        }
    }

    /**
     * Check queue health
     * @param {Object} stats - Sync statistics
     * @returns {string} Health status
     */
    checkQueueHealth(stats) {
        if (stats.queueSize > 200) return 'critical';
        if (stats.queueSize > 100) return 'warning';
        if (stats.activeSyncs > 50) return 'warning';
        return 'healthy';
    }

    /**
     * Check batch processing health
     * @param {Object} stats - Sync statistics
     * @returns {string} Health status
     */
    checkBatchProcessingHealth(stats) {
        if (stats.batchQueueSize > 100) return 'warning';
        if (stats.batchOperations === 0 && stats.syncOperations > 100) return 'warning';
        return 'healthy';
    }

    /**
     * Check webhook integration health
     * @returns {Promise<string>} Health status
     */
    async checkWebhookIntegrationHealth() {
        try {
            // Check if webhooks have been received recently
            const recentWebhooks = await this.redis.lrange('discord_webhook_events', 0, 9);
            
            if (recentWebhooks.length === 0) {
                return 'warning'; // No recent webhooks
            }

            const latestWebhook = JSON.parse(recentWebhooks[0]);
            const timeSinceLastWebhook = Date.now() - latestWebhook.timestamp;
            
            if (timeSinceLastWebhook > 10 * 60 * 1000) { // 10 minutes
                return 'warning';
            }

            return 'healthy';
        } catch (error) {
            return 'critical';
        }
    }

    /**
     * Check error recovery health
     * @param {Object} stats - Sync statistics
     * @returns {string} Health status
     */
    checkErrorRecoveryHealth(stats) {
        if (stats.errorCooldowns > 20) return 'critical';
        if (stats.errorCooldowns > 10) return 'warning';
        if (stats.failedSyncs > stats.successfulSyncs) return 'critical';
        return 'healthy';
    }

    /**
     * Calculate overall health from component healths
     * @param {Array} componentHealths - Array of component health statuses
     * @returns {string} Overall health status
     */
    calculateOverallHealth(componentHealths) {
        if (componentHealths.includes('critical')) return 'critical';
        if (componentHealths.includes('warning')) return 'warning';
        return 'healthy';
    }

    /**
     * Check if alert type is on cooldown
     * @param {string} alertType - Alert type
     * @returns {boolean} Whether alert is on cooldown
     */
    isAlertOnCooldown(alertType) {
        const cooldownTime = this.alertCooldowns.get(alertType);
        if (!cooldownTime) return false;
        
        return (Date.now() - cooldownTime) < this.alertCooldownDuration;
    }

    /**
     * Send critical alert to administrators
     * @param {Object} alert - Alert data
     */
    async sendCriticalAlert(alert) {
        try {
            // Get all server mappings to find administrators
            const serverMappings = await this.botService.db.getAllServerMappings();
            
            const embed = this.botService.createErrorEmbed(
                'Critical Sync Alert',
                {
                    description: alert.message,
                    fields: [
                        {
                            name: 'Alert Type',
                            value: alert.type,
                            inline: true
                        },
                        {
                            name: 'Threshold',
                            value: alert.threshold.toString(),
                            inline: true
                        },
                        {
                            name: 'Current Value',
                            value: alert.current.toString(),
                            inline: true
                        },
                        {
                            name: 'Timestamp',
                            value: new Date().toLocaleString(),
                            inline: false
                        }
                    ]
                }
            );

            // Send to server administrators
            for (const mapping of (serverMappings || [])) {
                try {
                    const guild = this.botService.client.guilds.cache.get(mapping.guildId);
                    if (!guild) continue;

                    // Find administrators
                    const admins = guild.members.cache.filter(member => 
                        member.permissions.has('Administrator') && !member.user.bot
                    );

                    // Send DM to administrators
                    for (const admin of admins.values()) {
                        try {
                            await admin.send({ embeds: [embed] });
                        } catch (error) {
                            logger.debug(`Failed to send critical alert to ${admin.user.username}:`, error.message);
                        }
                    }

                } catch (error) {
                    logger.warn(`Failed to send critical alert to server ${mapping.guildId}:`, error);
                }
            }

        } catch (error) {
            logger.error('Error sending critical alert:', error);
        }
    }

    /**
     * Get monitoring statistics
     * @returns {Object} Monitoring statistics
     */
    getStatistics() {
        return {
            healthStatus: this.healthStatus,
            activeAlerts: this.activeAlerts.size,
            performanceHistorySize: this.performanceHistory.length,
            optimizationRecommendations: this.optimizationCache.size,
            alertCooldowns: this.alertCooldowns.size,
            monitoringUptime: Date.now() - (this.healthStatus.lastCheck || Date.now())
        };
    }

    /**
     * Get performance trends
     * @param {number} timeRange - Time range in milliseconds
     * @returns {Object} Performance trends
     */
    getPerformanceTrends(timeRange = 60 * 60 * 1000) { // 1 hour default
        try {
            const cutoff = Date.now() - timeRange;
            const recentMetrics = this.performanceHistory.filter(m => m.timestamp > cutoff);
            
            if (recentMetrics.length === 0) {
                return { error: 'No data available for the specified time range' };
            }

            const trends = {
                timeRange,
                dataPoints: recentMetrics.length,
                trends: {
                    queueSize: this.calculateTrend(recentMetrics, 'queueSize'),
                    failureRate: this.calculateTrend(recentMetrics, 'failureRate'),
                    averageSyncTime: this.calculateTrend(recentMetrics, 'averageSyncTime'),
                    syncOperations: this.calculateTrend(recentMetrics, 'syncOperations')
                },
                summary: {
                    avgQueueSize: recentMetrics.reduce((sum, m) => sum + m.queueSize, 0) / recentMetrics.length,
                    avgFailureRate: recentMetrics.reduce((sum, m) => sum + m.failureRate, 0) / recentMetrics.length,
                    avgSyncTime: recentMetrics.reduce((sum, m) => sum + m.averageSyncTime, 0) / recentMetrics.length,
                    totalOperations: recentMetrics[recentMetrics.length - 1].syncOperations - recentMetrics[0].syncOperations
                }
            };

            return trends;

        } catch (error) {
            logger.error('Error calculating performance trends:', error);
            return { error: 'Failed to calculate trends' };
        }
    }

    /**
     * Calculate trend for a metric
     * @param {Array} metrics - Metrics array
     * @param {string} field - Field to analyze
     * @returns {string} Trend direction
     */
    calculateTrend(metrics, field) {
        if (metrics.length < 2) return 'stable';
        
        const first = metrics[0][field];
        const last = metrics[metrics.length - 1][field];
        const change = ((last - first) / first) * 100;
        
        if (change > 10) return 'increasing';
        if (change < -10) return 'decreasing';
        return 'stable';
    }

    /**
     * Shutdown monitoring service
     */
    async shutdown() {
        try {
            logger.info('Shutting down Sync Monitoring Service...');

            // Clear all intervals
            this.intervals.forEach(interval => clearInterval(interval));
            this.intervals = [];

            // Save final metrics
            if (this.performanceHistory.length > 0) {
                const finalMetrics = this.performanceHistory[this.performanceHistory.length - 1];
                await this.redis.setex(
                    'discord_sync_final_metrics',
                    86400, // 24 hours TTL
                    JSON.stringify(finalMetrics)
                );
            }

            logger.info('Sync Monitoring Service shutdown complete');
        } catch (error) {
            logger.error('Error during monitoring service shutdown:', error);
        }
    }
}

module.exports = SyncMonitoringService;