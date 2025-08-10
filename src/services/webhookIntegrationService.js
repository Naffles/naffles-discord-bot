const logger = require('../utils/logger');
const crypto = require('crypto');
const express = require('express');

/**
 * Webhook Integration Service
 * Handles incoming webhook events from Naffles backend for real-time synchronization
 * Processes batch updates and manages webhook security
 */
class WebhookIntegrationService {
    constructor(botService, syncService) {
        this.botService = botService;
        this.syncService = syncService;
        this.webhookSecret = process.env.DISCORD_WEBHOOK_SECRET;
        this.webhookPort = process.env.DISCORD_WEBHOOK_PORT || 3001;
        
        // Webhook server
        this.app = express();
        this.server = null;
        
        // Rate limiting
        this.rateLimits = new Map();
        this.maxRequestsPerMinute = 100;
        
        // Metrics
        this.metrics = {
            webhooksReceived: 0,
            webhooksProcessed: 0,
            webhooksFailed: 0,
            batchWebhooks: 0,
            lastWebhookTime: null
        };
        
        // Event handlers
        this.eventHandlers = new Map();
        this.setupEventHandlers();
    }

    /**
     * Initialize webhook integration service
     */
    async initialize() {
        try {
            logger.info('Initializing Webhook Integration Service...');

            // Setup Express middleware
            this.setupMiddleware();

            // Setup webhook routes
            this.setupRoutes();

            // Start webhook server
            await this.startWebhookServer();

            // Setup health monitoring
            this.setupHealthMonitoring();

            logger.info(`Webhook Integration Service initialized on port ${this.webhookPort}`);
        } catch (error) {
            logger.error('Failed to initialize Webhook Integration Service:', error);
            throw error;
        }
    }

    /**
     * Setup Express middleware
     */
    setupMiddleware() {
        // Raw body parser for signature verification
        this.app.use('/webhook', express.raw({ type: 'application/json' }));
        
        // JSON parser for other routes
        this.app.use(express.json());
        
        // Rate limiting middleware
        this.app.use(this.rateLimitMiddleware.bind(this));
        
        // Request logging
        this.app.use((req, res, next) => {
            logger.debug(`Webhook request: ${req.method} ${req.path}`, {
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            next();
        });
    }

    /**
     * Setup webhook routes
     */
    setupRoutes() {
        // Main webhook endpoint
        this.app.post('/webhook', this.handleWebhook.bind(this));
        
        // Batch webhook endpoint
        this.app.post('/webhook/batch', this.handleBatchWebhook.bind(this));
        
        // Health check endpoint
        this.app.get('/health', this.handleHealthCheck.bind(this));
        
        // Metrics endpoint
        this.app.get('/metrics', this.handleMetrics.bind(this));
        
        // Webhook registration endpoint
        this.app.post('/register', this.handleWebhookRegistration.bind(this));
    }

    /**
     * Start webhook server
     */
    async startWebhookServer() {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(this.webhookPort, (error) => {
                if (error) {
                    reject(error);
                } else {
                    logger.info(`Webhook server listening on port ${this.webhookPort}`);
                    resolve();
                }
            });
        });
    }

    /**
     * Handle incoming webhook
     */
    async handleWebhook(req, res) {
        try {
            this.metrics.webhooksReceived++;
            this.metrics.lastWebhookTime = new Date();

            // Verify webhook signature
            const signature = req.get('X-Naffles-Signature');
            if (!this.verifyWebhookSignature(req.body, signature)) {
                logger.warn('Invalid webhook signature', {
                    ip: req.ip,
                    signature: signature?.substring(0, 10) + '...'
                });
                return res.status(401).json({ error: 'Invalid signature' });
            }

            // Parse webhook data
            const webhookData = JSON.parse(req.body.toString());
            const { eventType, data, timestamp, batchId } = webhookData;

            logger.info('Received webhook:', {
                eventType,
                timestamp,
                batchId: batchId || 'single',
                dataKeys: Object.keys(data || {})
            });

            // Process webhook event
            await this.processWebhookEvent(eventType, data, {
                timestamp,
                batchId,
                source: 'webhook'
            });

            this.metrics.webhooksProcessed++;
            res.status(200).json({ 
                success: true, 
                processed: true,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error('Error handling webhook:', error);
            this.metrics.webhooksFailed++;
            res.status(500).json({ 
                error: 'Webhook processing failed',
                message: error.message 
            });
        }
    }

    /**
     * Handle batch webhook
     */
    async handleBatchWebhook(req, res) {
        try {
            this.metrics.webhooksReceived++;
            this.metrics.batchWebhooks++;
            this.metrics.lastWebhookTime = new Date();

            // Verify webhook signature
            const signature = req.get('X-Naffles-Signature');
            if (!this.verifyWebhookSignature(req.body, signature)) {
                logger.warn('Invalid batch webhook signature', {
                    ip: req.ip,
                    signature: signature?.substring(0, 10) + '...'
                });
                return res.status(401).json({ error: 'Invalid signature' });
            }

            // Parse batch webhook data
            const batchData = JSON.parse(req.body.toString());
            const { batchId, events, timestamp } = batchData;

            logger.info('Received batch webhook:', {
                batchId,
                eventCount: events.length,
                timestamp
            });

            // Process batch events
            const results = await this.processBatchWebhookEvents(events, {
                batchId,
                timestamp,
                source: 'batch_webhook'
            });

            const successful = results.filter(r => r.success).length;
            const failed = results.length - successful;

            this.metrics.webhooksProcessed += successful;
            this.metrics.webhooksFailed += failed;

            res.status(200).json({
                success: true,
                batchId,
                processed: successful,
                failed,
                results: results.map(r => ({
                    eventType: r.eventType,
                    success: r.success,
                    error: r.error
                }))
            });

        } catch (error) {
            logger.error('Error handling batch webhook:', error);
            this.metrics.webhooksFailed++;
            res.status(500).json({
                error: 'Batch webhook processing failed',
                message: error.message
            });
        }
    }

    /**
     * Process individual webhook event
     * @param {string} eventType - Type of webhook event
     * @param {Object} data - Event data
     * @param {Object} metadata - Additional metadata
     */
    async processWebhookEvent(eventType, data, metadata = {}) {
        try {
            const handler = this.eventHandlers.get(eventType);
            if (!handler) {
                logger.warn(`No handler found for webhook event: ${eventType}`);
                return { success: false, error: 'No handler found' };
            }

            // Execute event handler
            await handler(data, metadata);

            logger.debug(`Webhook event processed: ${eventType}`);
            return { success: true };

        } catch (error) {
            logger.error(`Error processing webhook event ${eventType}:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Process batch webhook events
     * @param {Array} events - Array of webhook events
     * @param {Object} metadata - Batch metadata
     */
    async processBatchWebhookEvents(events, metadata = {}) {
        try {
            // Process events in parallel with concurrency limit
            const concurrencyLimit = 10;
            const results = [];

            for (let i = 0; i < events.length; i += concurrencyLimit) {
                const batch = events.slice(i, i + concurrencyLimit);
                
                const batchPromises = batch.map(async (event) => {
                    try {
                        const result = await this.processWebhookEvent(
                            event.eventType,
                            event.data,
                            { ...metadata, eventIndex: i + batch.indexOf(event) }
                        );
                        return { ...result, eventType: event.eventType };
                    } catch (error) {
                        return {
                            success: false,
                            error: error.message,
                            eventType: event.eventType
                        };
                    }
                });

                const batchResults = await Promise.allSettled(batchPromises);
                results.push(...batchResults.map(r => 
                    r.status === 'fulfilled' ? r.value : { success: false, error: r.reason.message }
                ));
            }

            return results;

        } catch (error) {
            logger.error('Error processing batch webhook events:', error);
            throw error;
        }
    }

    /**
     * Setup event handlers for different webhook types
     */
    setupEventHandlers() {
        // Task status change handler
        this.eventHandlers.set('task.status_changed', async (data, metadata) => {
            const { taskId, oldStatus, newStatus, changes } = data;
            
            // Emit sync event to real-time sync service
            this.syncService.emit('taskStatusChanged', {
                taskId,
                newStatus,
                metadata: {
                    oldStatus,
                    changes,
                    ...metadata
                }
            });
            
            // Also trigger direct sync for immediate processing
            await this.syncService.handleTaskStatusSync({
                taskId,
                newStatus,
                metadata: {
                    oldStatus,
                    changes,
                    ...metadata
                }
            });
        });

        // Task progress update handler
        this.eventHandlers.set('task.progress_updated', async (data, metadata) => {
            const { taskId, progressData } = data;
            
            // Update Discord embeds with new progress
            await this.syncService.updateDiscordTaskEmbeds(taskId, {
                ...progressData,
                lastUpdate: new Date()
            });
        });

        // Task completion handler
        this.eventHandlers.set('task.completed', async (data, metadata) => {
            const { taskId, completedBy, completionData } = data;
            
            // Emit sync event
            this.syncService.emit('taskStatusChanged', {
                taskId,
                newStatus: 'completed',
                metadata: {
                    completedBy,
                    completionData,
                    ...metadata
                }
            });
        });

        // Allowlist status change handler
        this.eventHandlers.set('allowlist.status_changed', async (data, metadata) => {
            const { allowlistId, oldStatus, newStatus, changes } = data;
            
            // Emit sync event
            this.syncService.emit('allowlistUpdated', {
                allowlistId,
                updateType: 'status_change',
                changes: {
                    oldStatus,
                    newStatus,
                    ...changes,
                    ...metadata
                }
            });
        });

        // Allowlist participant added handler
        this.eventHandlers.set('allowlist.participant_added', async (data, metadata) => {
            const { allowlistId, participant, totalParticipants } = data;
            
            // Emit sync event
            this.syncService.emit('allowlistUpdated', {
                allowlistId,
                updateType: 'participant_added',
                changes: {
                    newParticipant: participant,
                    totalParticipants,
                    ...metadata
                }
            });
        });

        // Allowlist winner selected handler
        this.eventHandlers.set('allowlist.winner_selected', async (data, metadata) => {
            const { allowlistId, winners, completionData } = data;
            
            // Emit sync event
            this.syncService.emit('allowlistUpdated', {
                allowlistId,
                updateType: 'winner_selected',
                changes: {
                    winners,
                    completionData,
                    ...metadata
                }
            });
        });

        // User progress update handler
        this.eventHandlers.set('user.progress_updated', async (data, metadata) => {
            const { userId, progressType, progressData } = data;
            
            // Emit sync event
            this.syncService.emit('userProgressUpdated', {
                userId,
                progressType,
                progressData: {
                    ...progressData,
                    ...metadata
                }
            });
        });

        // User points earned handler
        this.eventHandlers.set('user.points_earned', async (data, metadata) => {
            const { userId, pointsEarned, source, taskId } = data;
            
            // Emit sync event
            this.syncService.emit('userProgressUpdated', {
                userId,
                progressType: 'points_earned',
                progressData: {
                    pointsEarned,
                    source,
                    taskId,
                    ...metadata
                }
            });
        });

        // User achievement unlocked handler
        this.eventHandlers.set('user.achievement_unlocked', async (data, metadata) => {
            const { userId, achievement, pointsEarned } = data;
            
            // Emit sync event
            this.syncService.emit('userProgressUpdated', {
                userId,
                progressType: 'achievement_unlocked',
                progressData: {
                    achievement,
                    pointsEarned,
                    ...metadata
                }
            });
        });

        // Community settings changed handler
        this.eventHandlers.set('community.settings_changed', async (data, metadata) => {
            const { communityId, changes } = data;
            
            // Handle community-specific updates
            await this.handleCommunitySettingsChange(communityId, changes, metadata);
        });

        // System maintenance handler
        this.eventHandlers.set('system.maintenance', async (data, metadata) => {
            const { maintenanceType, scheduledTime, duration } = data;
            
            // Notify relevant Discord channels about maintenance
            await this.notifyMaintenanceScheduled(maintenanceType, scheduledTime, duration);
        });
    }

    /**
     * Handle community settings change
     * @param {string} communityId - Community ID
     * @param {Object} changes - Settings changes
     * @param {Object} metadata - Additional metadata
     */
    async handleCommunitySettingsChange(communityId, changes, metadata) {
        try {
            // Get Discord servers linked to this community
            const linkedServers = await this.botService.db.getServersByCommunity(communityId);
            
            for (const server of linkedServers) {
                try {
                    const guild = this.botService.client.guilds.cache.get(server.guildId);
                    if (!guild) continue;

                    // Notify server administrators about settings changes
                    await this.notifyServerAdmins(guild, {
                        type: 'community_settings_changed',
                        communityId,
                        changes,
                        metadata
                    });

                } catch (error) {
                    logger.warn(`Failed to notify server ${server.guildId} about community changes:`, error);
                }
            }

        } catch (error) {
            logger.error('Error handling community settings change:', error);
        }
    }

    /**
     * Notify server administrators
     * @param {Object} guild - Discord guild
     * @param {Object} notification - Notification data
     */
    async notifyServerAdmins(guild, notification) {
        try {
            // Find administrators
            const admins = guild.members.cache.filter(member => 
                member.permissions.has('Administrator') && !member.user.bot
            );

            // Create notification embed
            const embed = this.botService.createInfoEmbed(
                'Community Settings Updated',
                'Your linked Naffles community settings have been updated.',
                {
                    fields: [
                        {
                            name: 'Community ID',
                            value: notification.communityId,
                            inline: true
                        },
                        {
                            name: 'Changes',
                            value: Object.keys(notification.changes).join(', '),
                            inline: true
                        },
                        {
                            name: 'Updated At',
                            value: new Date().toLocaleString(),
                            inline: true
                        }
                    ]
                }
            );

            // Send DM to administrators
            const dmPromises = admins.map(async (admin) => {
                try {
                    await admin.send({ embeds: [embed] });
                } catch (error) {
                    logger.debug(`Failed to DM admin ${admin.user.username}:`, error.message);
                }
            });

            await Promise.allSettled(dmPromises);

        } catch (error) {
            logger.error('Error notifying server admins:', error);
        }
    }

    /**
     * Rate limiting middleware
     */
    rateLimitMiddleware(req, res, next) {
        const clientIp = req.ip;
        const now = Date.now();
        const windowMs = 60 * 1000; // 1 minute

        // Clean up old entries
        for (const [ip, data] of this.rateLimits.entries()) {
            if (now - data.windowStart > windowMs) {
                this.rateLimits.delete(ip);
            }
        }

        // Check rate limit
        const clientData = this.rateLimits.get(clientIp) || {
            requests: 0,
            windowStart: now
        };

        if (now - clientData.windowStart > windowMs) {
            // Reset window
            clientData.requests = 0;
            clientData.windowStart = now;
        }

        clientData.requests++;
        this.rateLimits.set(clientIp, clientData);

        if (clientData.requests > this.maxRequestsPerMinute) {
            logger.warn(`Rate limit exceeded for IP: ${clientIp}`);
            return res.status(429).json({
                error: 'Rate limit exceeded',
                retryAfter: Math.ceil((windowMs - (now - clientData.windowStart)) / 1000)
            });
        }

        next();
    }

    /**
     * Handle health check
     */
    async handleHealthCheck(req, res) {
        try {
            const health = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                metrics: this.metrics,
                services: {
                    discord: this.botService.client.isReady(),
                    sync: this.syncService ? true : false,
                    database: await this.checkDatabaseHealth(),
                    redis: await this.checkRedisHealth()
                }
            };

            res.status(200).json(health);
        } catch (error) {
            logger.error('Health check failed:', error);
            res.status(500).json({
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Handle metrics request
     */
    async handleMetrics(req, res) {
        try {
            const metrics = {
                ...this.metrics,
                rateLimits: {
                    activeIps: this.rateLimits.size,
                    maxRequestsPerMinute: this.maxRequestsPerMinute
                },
                eventHandlers: this.eventHandlers.size,
                uptime: process.uptime()
            };

            res.status(200).json(metrics);
        } catch (error) {
            logger.error('Metrics request failed:', error);
            res.status(500).json({
                error: 'Failed to retrieve metrics',
                message: error.message
            });
        }
    }

    /**
     * Handle webhook registration
     */
    async handleWebhookRegistration(req, res) {
        try {
            const { events, secret } = req.body;

            // Validate registration request
            if (!Array.isArray(events) || !secret) {
                return res.status(400).json({
                    error: 'Invalid registration request',
                    required: ['events', 'secret']
                });
            }

            // Store webhook configuration
            const registration = {
                events,
                secret,
                registeredAt: new Date(),
                active: true
            };

            // In a real implementation, you might store this in a database
            logger.info('Webhook registration received:', {
                events: events.length,
                registeredAt: registration.registeredAt
            });

            res.status(200).json({
                success: true,
                registration: {
                    events: events.length,
                    registeredAt: registration.registeredAt
                }
            });

        } catch (error) {
            logger.error('Webhook registration failed:', error);
            res.status(500).json({
                error: 'Registration failed',
                message: error.message
            });
        }
    }

    /**
     * Verify webhook signature
     * @param {Buffer} payload - Request payload
     * @param {string} signature - Provided signature
     * @returns {boolean} Whether signature is valid
     */
    verifyWebhookSignature(payload, signature) {
        try {
            if (!signature || !this.webhookSecret) {
                return false;
            }

            const expectedSignature = crypto
                .createHmac('sha256', this.webhookSecret)
                .update(payload)
                .digest('hex');

            return crypto.timingSafeEqual(
                Buffer.from(signature, 'hex'),
                Buffer.from(expectedSignature, 'hex')
            );
        } catch (error) {
            logger.error('Error verifying webhook signature:', error);
            return false;
        }
    }

    /**
     * Setup health monitoring
     */
    setupHealthMonitoring() {
        // Monitor webhook processing health
        setInterval(() => {
            const now = Date.now();
            const fiveMinutesAgo = now - (5 * 60 * 1000);

            // Check if we've received webhooks recently
            if (this.metrics.lastWebhookTime && this.metrics.lastWebhookTime < fiveMinutesAgo) {
                logger.warn('No webhooks received in the last 5 minutes');
            }

            // Log metrics
            logger.debug('Webhook service metrics:', this.metrics);

        }, 60000); // Every minute
    }

    /**
     * Check database health
     */
    async checkDatabaseHealth() {
        try {
            await this.botService.db.ping();
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Check Redis health
     */
    async checkRedisHealth() {
        try {
            await this.botService.redis.ping();
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Notify about scheduled maintenance
     * @param {string} maintenanceType - Type of maintenance
     * @param {Date} scheduledTime - Scheduled time
     * @param {number} duration - Duration in minutes
     */
    async notifyMaintenanceScheduled(maintenanceType, scheduledTime, duration) {
        try {
            // Get all linked servers
            const allServers = await this.botService.db.getAllServerMappings();
            
            const embed = this.botService.createWarningEmbed(
                'Scheduled Maintenance',
                `Naffles platform maintenance is scheduled.`,
                {
                    fields: [
                        {
                            name: 'Maintenance Type',
                            value: maintenanceType,
                            inline: true
                        },
                        {
                            name: 'Scheduled Time',
                            value: new Date(scheduledTime).toLocaleString(),
                            inline: true
                        },
                        {
                            name: 'Duration',
                            value: `${duration} minutes`,
                            inline: true
                        }
                    ]
                }
            );

            // Notify all servers
            for (const server of allServers) {
                try {
                    const guild = this.botService.client.guilds.cache.get(server.guildId);
                    if (!guild) continue;

                    // Find a suitable channel to post the notification
                    const channel = guild.systemChannel || 
                                  guild.channels.cache.find(ch => ch.name.includes('general')) ||
                                  guild.channels.cache.find(ch => ch.type === 'GUILD_TEXT');

                    if (channel) {
                        await channel.send({ embeds: [embed] });
                    }

                } catch (error) {
                    logger.warn(`Failed to notify server ${server.guildId} about maintenance:`, error);
                }
            }

        } catch (error) {
            logger.error('Error notifying about scheduled maintenance:', error);
        }
    }

    /**
     * Get webhook statistics
     * @returns {Object} Webhook statistics
     */
    getStatistics() {
        return {
            ...this.metrics,
            rateLimits: {
                activeIps: this.rateLimits.size,
                maxRequestsPerMinute: this.maxRequestsPerMinute
            },
            eventHandlers: this.eventHandlers.size,
            serverStatus: this.server ? 'running' : 'stopped'
        };
    }

    /**
     * Shutdown webhook service
     */
    async shutdown() {
        try {
            logger.info('Shutting down Webhook Integration Service...');

            if (this.server) {
                await new Promise((resolve) => {
                    this.server.close(resolve);
                });
            }

            logger.info('Webhook Integration Service shutdown complete');
        } catch (error) {
            logger.error('Error during webhook service shutdown:', error);
        }
    }
}

module.exports = WebhookIntegrationService;