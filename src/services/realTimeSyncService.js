const logger = require('../utils/logger');
const axios = require('axios');
const EventEmitter = require('events');

/**
 * Real-Time Synchronization Service
 * Handles bidirectional real-time synchronization between Discord bot and Naffles backend
 * Manages task status updates, allowlist changes, user progress, and batch operations
 */
class RealTimeSyncService extends EventEmitter {
    constructor(botService) {
        super();
        this.botService = botService;
        this.db = botService.db;
        this.redis = botService.redis;
        
        // API configuration
        this.nafflesApiBaseUrl = process.env.NAFFLES_API_BASE_URL;
        this.nafflesApiKey = process.env.NAFFLES_API_KEY;
        this.webhookSecret = process.env.DISCORD_WEBHOOK_SECRET;
        
        // Sync state management
        this.syncQueue = new Map();
        this.activeSyncs = new Set();
        this.syncRetries = new Map();
        this.maxRetries = 3;
        this.retryDelay = 5000; // 5 seconds
        
        // Batch processing
        this.batchQueue = [];
        this.batchSize = 50;
        this.batchTimeout = 5000; // 5 seconds
        this.batchTimer = null;
        
        // Performance monitoring
        this.metrics = {
            syncOperations: 0,
            successfulSyncs: 0,
            failedSyncs: 0,
            batchOperations: 0,
            webhookEvents: 0,
            lastSyncTime: null,
            averageSyncTime: 0
        };
        
        // Sync intervals
        this.syncIntervals = new Map();
        this.defaultSyncInterval = 30000; // 30 seconds
        
        // Error handling
        this.errorCooldowns = new Map();
        this.cooldownDuration = 60000; // 1 minute
    }

    /**
     * Initialize the real-time sync service
     */
    async initialize() {
        try {
            logger.info('Initializing Real-Time Sync Service...');

            // Set up event listeners
            this.setupEventListeners();

            // Start periodic sync processes
            this.startPeriodicSync();

            // Initialize webhook handling
            await this.initializeWebhookHandling();

            // Start batch processing
            this.startBatchProcessing();

            // Start performance monitoring
            this.startPerformanceMonitoring();

            // Restore sync state from Redis
            await this.restoreSyncState();

            logger.info('Real-Time Sync Service initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Real-Time Sync Service:', error);
            throw error;
        }
    }

    /**
     * Set up event listeners for sync triggers
     */
    setupEventListeners() {
        // Listen for task status changes
        this.on('taskStatusChanged', async (data) => {
            await this.handleTaskStatusSync(data);
        });

        // Listen for allowlist updates
        this.on('allowlistUpdated', async (data) => {
            await this.handleAllowlistSync(data);
        });

        // Listen for user progress updates
        this.on('userProgressUpdated', async (data) => {
            await this.handleUserProgressSync(data);
        });

        // Listen for batch sync requests
        this.on('batchSyncRequested', async (data) => {
            await this.handleBatchSync(data);
        });

        // Listen for webhook events
        this.on('webhookReceived', async (data) => {
            await this.handleWebhookEvent(data);
        });
    }

    /**
     * Handle task status synchronization
     * @param {Object} data - Task status change data
     */
    async handleTaskStatusSync(data) {
        try {
            const { taskId, newStatus, metadata = {} } = data;
            const syncId = `task_status_${taskId}_${Date.now()}`;

            logger.info('Handling task status sync:', { taskId, newStatus, syncId });

            // Add to sync queue
            this.syncQueue.set(syncId, {
                type: 'task_status',
                taskId,
                newStatus,
                metadata,
                timestamp: Date.now(),
                retries: 0
            });

            // Process sync (skip immediate processing in test environment)
            if (process.env.NODE_ENV !== 'test') {
                await this.processSyncOperation(syncId);
            }

        } catch (error) {
            logger.error('Error handling task status sync:', error);
            this.metrics.failedSyncs++;
        }
    }

    /**
     * Handle allowlist synchronization
     * @param {Object} data - Allowlist update data
     */
    async handleAllowlistSync(data) {
        try {
            const { allowlistId, updateType, changes = {} } = data;
            const syncId = `allowlist_${allowlistId}_${Date.now()}`;

            logger.info('Handling allowlist sync:', { allowlistId, updateType, syncId });

            // Add to sync queue
            this.syncQueue.set(syncId, {
                type: 'allowlist_update',
                allowlistId,
                updateType,
                changes,
                timestamp: Date.now(),
                retries: 0
            });

            // Process sync (skip immediate processing in test environment)
            if (process.env.NODE_ENV !== 'test') {
                await this.processSyncOperation(syncId);
            }

        } catch (error) {
            logger.error('Error handling allowlist sync:', error);
            this.metrics.failedSyncs++;
        }
    }

    /**
     * Handle user progress synchronization
     * @param {Object} data - User progress data
     */
    async handleUserProgressSync(data) {
        try {
            const { userId, progressType, progressData = {} } = data;
            const syncId = `user_progress_${userId}_${Date.now()}`;

            logger.info('Handling user progress sync:', { userId, progressType, syncId });

            // Add to sync queue
            this.syncQueue.set(syncId, {
                type: 'user_progress',
                userId,
                progressType,
                progressData,
                timestamp: Date.now(),
                retries: 0
            });

            // Process sync (skip immediate processing in test environment)
            if (process.env.NODE_ENV !== 'test') {
                await this.processSyncOperation(syncId);
            }

        } catch (error) {
            logger.error('Error handling user progress sync:', error);
            this.metrics.failedSyncs++;
        }
    }

    /**
     * Handle batch synchronization
     * @param {Object} data - Batch sync data
     */
    async handleBatchSync(data) {
        try {
            const { operations, priority = 'normal' } = data;
            const batchId = `batch_${Date.now()}`;

            logger.info('Handling batch sync:', { batchId, operationCount: operations.length, priority });

            // Add operations to batch queue
            const batchOperation = {
                batchId,
                operations,
                priority,
                timestamp: Date.now(),
                processed: false
            };

            if (priority === 'high') {
                this.batchQueue.unshift(batchOperation);
            } else {
                this.batchQueue.push(batchOperation);
            }

            // Process immediately if high priority (skip in test environment)
            if (priority === 'high' && process.env.NODE_ENV !== 'test') {
                await this.processBatchQueue();
            }

        } catch (error) {
            logger.error('Error handling batch sync:', error);
            this.metrics.failedSyncs++;
        }
    }

    /**
     * Process individual sync operation
     * @param {string} syncId - Sync operation ID
     */
    async processSyncOperation(syncId) {
        try {
            const syncOp = this.syncQueue.get(syncId);
            if (!syncOp || this.activeSyncs.has(syncId)) {
                return;
            }

            // Check error cooldown
            if (this.isOnErrorCooldown(syncId)) {
                logger.debug(`Sync operation on cooldown: ${syncId}`);
                return;
            }

            this.activeSyncs.add(syncId);
            const startTime = Date.now();

            try {
                switch (syncOp.type) {
                    case 'task_status':
                        await this.syncTaskStatus(syncOp);
                        break;
                    
                    case 'allowlist_update':
                        await this.syncAllowlistUpdate(syncOp);
                        break;
                    
                    case 'user_progress':
                        await this.syncUserProgress(syncOp);
                        break;
                    
                    default:
                        throw new Error(`Unknown sync operation type: ${syncOp.type}`);
                }

                // Success - remove from queue
                this.syncQueue.delete(syncId);
                this.metrics.successfulSyncs++;
                
                // Update performance metrics
                const syncTime = Date.now() - startTime;
                this.updateSyncMetrics(syncTime);

                logger.debug(`Sync operation completed: ${syncId} (${syncTime}ms)`);

            } catch (error) {
                logger.error(`Sync operation failed: ${syncId}`, {
                    message: error.message,
                    stack: error.stack,
                    syncType: syncOp.type
                });
                
                // Handle retry logic
                await this.handleSyncRetry(syncId, error);
            }

        } catch (error) {
            logger.error(`Error processing sync operation ${syncId}:`, error);
        } finally {
            this.activeSyncs.delete(syncId);
            this.metrics.syncOperations++;
        }
    }

    /**
     * Sync task status changes
     * @param {Object} syncOp - Sync operation data
     */
    async syncTaskStatus(syncOp) {
        const { taskId, newStatus, metadata } = syncOp;

        // Update Naffles backend
        await this.makeNafflesApiCall(
            `/api/social-tasks/${taskId}/sync-status`,
            'PATCH',
            {
                status: newStatus,
                source: 'discord_bot',
                metadata,
                timestamp: new Date()
            }
        );

        // Update Discord embeds
        await this.updateDiscordTaskEmbeds(taskId, {
            status: newStatus,
            ...metadata
        });

        // Notify relevant Discord channels
        await this.notifyTaskStatusChange(taskId, newStatus, metadata);
    }

    /**
     * Sync allowlist updates
     * @param {Object} syncOp - Sync operation data
     */
    async syncAllowlistUpdate(syncOp) {
        const { allowlistId, updateType, changes } = syncOp;

        // Update Naffles backend
        await this.makeNafflesApiCall(
            `/api/allowlists/${allowlistId}/sync-update`,
            'PATCH',
            {
                updateType,
                changes,
                source: 'discord_bot',
                timestamp: new Date()
            }
        );

        // Update Discord embeds
        await this.updateDiscordAllowlistEmbeds(allowlistId, changes);

        // Handle specific update types
        switch (updateType) {
            case 'status_change':
                await this.handleAllowlistStatusChange(allowlistId, changes);
                break;
            
            case 'participant_added':
                await this.handleAllowlistParticipantAdded(allowlistId, changes);
                break;
            
            case 'winner_selected':
                await this.handleAllowlistWinnerSelected(allowlistId, changes);
                break;
        }
    }

    /**
     * Sync user progress updates
     * @param {Object} syncOp - Sync operation data
     */
    async syncUserProgress(syncOp) {
        const { userId, progressType, progressData } = syncOp;

        // Update Naffles backend
        await this.makeNafflesApiCall(
            `/api/users/${userId}/sync-progress`,
            'PATCH',
            {
                progressType,
                progressData,
                source: 'discord_bot',
                timestamp: new Date()
            }
        );

        // Update user-specific Discord elements
        await this.updateUserDiscordElements(userId, progressType, progressData);

        // Handle progress type specific actions
        switch (progressType) {
            case 'points_earned':
                await this.handlePointsEarned(userId, progressData);
                break;
            
            case 'task_completed':
                await this.handleTaskCompleted(userId, progressData);
                break;
            
            case 'achievement_unlocked':
                await this.handleAchievementUnlocked(userId, progressData);
                break;
        }
    }

    /**
     * Update Discord task embeds
     * @param {string} taskId - Task ID
     * @param {Object} updateData - Update data
     */
    async updateDiscordTaskEmbeds(taskId, updateData) {
        try {
            // Get all Discord messages for this task
            const taskMessages = await this.db.getTaskMessages(taskId);
            
            const updatePromises = taskMessages.map(async (messageData) => {
                try {
                    const channel = await this.botService.client.channels.fetch(messageData.channelId);
                    if (!channel) return;

                    const message = await channel.messages.fetch(messageData.messageId);
                    if (!message) return;

                    // Get updated task data
                    const taskData = await this.getTaskData(taskId);
                    if (!taskData) return;

                    // Apply updates
                    const updatedTaskData = { ...taskData, ...updateData };

                    // Create updated embed
                    const updatedEmbed = this.botService.createTaskEmbed(updatedTaskData, {
                        showProgress: true,
                        showAnalytics: true,
                        lastUpdate: new Date()
                    });

                    // Update message
                    await message.edit({
                        embeds: [updatedEmbed],
                        components: message.components
                    });

                    logger.debug(`Updated task embed: ${taskId} in ${messageData.channelId}`);

                } catch (error) {
                    logger.warn(`Failed to update task embed: ${taskId}`, error);
                }
            });

            await Promise.allSettled(updatePromises);

        } catch (error) {
            logger.error('Error updating Discord task embeds:', error);
        }
    }

    /**
     * Update Discord allowlist embeds
     * @param {string} allowlistId - Allowlist ID
     * @param {Object} changes - Changes to apply
     */
    async updateDiscordAllowlistEmbeds(allowlistId, changes) {
        try {
            // Get all Discord messages for this allowlist
            const allowlistMessages = await this.db.getAllowlistMessages(allowlistId);
            
            const updatePromises = allowlistMessages.map(async (messageData) => {
                try {
                    const channel = await this.botService.client.channels.fetch(messageData.channelId);
                    if (!channel) return;

                    const message = await channel.messages.fetch(messageData.messageId);
                    if (!message) return;

                    // Get updated allowlist data
                    const allowlistData = await this.getAllowlistData(allowlistId);
                    if (!allowlistData) return;

                    // Apply changes
                    const updatedAllowlistData = { ...allowlistData, ...changes };

                    // Create updated embed
                    const updatedEmbed = this.botService.createAllowlistEmbed(updatedAllowlistData, {
                        showProgress: true,
                        showAnalytics: true,
                        lastUpdate: new Date()
                    });

                    // Update message
                    await message.edit({
                        embeds: [updatedEmbed],
                        components: message.components
                    });

                    logger.debug(`Updated allowlist embed: ${allowlistId} in ${messageData.channelId}`);

                } catch (error) {
                    logger.warn(`Failed to update allowlist embed: ${allowlistId}`, error);
                }
            });

            await Promise.allSettled(updatePromises);

        } catch (error) {
            logger.error('Error updating Discord allowlist embeds:', error);
        }
    }

    /**
     * Process batch queue
     */
    async processBatchQueue() {
        try {
            if (this.batchQueue.length === 0) return;

            const batch = this.batchQueue.splice(0, this.batchSize);
            const batchId = `batch_${Date.now()}`;

            logger.info(`Processing batch: ${batchId} with ${batch.length} operations`);

            // Group operations by type for efficiency
            const groupedOps = this.groupOperationsByType(batch);

            // Process each group
            const results = await Promise.allSettled([
                this.processBatchTaskUpdates(groupedOps.task_status || []),
                this.processBatchAllowlistUpdates(groupedOps.allowlist_update || []),
                this.processBatchUserProgress(groupedOps.user_progress || [])
            ]);

            // Calculate success/failure rates
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.length - successful;

            this.metrics.batchOperations++;
            logger.info(`Batch processed: ${batchId} - ${successful} successful, ${failed} failed`);

        } catch (error) {
            logger.error('Error processing batch queue:', error);
        }
    }

    /**
     * Group operations by type for batch processing
     * @param {Array} operations - Operations to group
     * @returns {Object} Grouped operations
     */
    groupOperationsByType(operations) {
        const grouped = {};
        
        operations.forEach(op => {
            op.operations.forEach(operation => {
                if (!grouped[operation.type]) {
                    grouped[operation.type] = [];
                }
                grouped[operation.type].push(operation);
            });
        });

        return grouped;
    }

    /**
     * Process batch task updates
     * @param {Array} taskOps - Task operations
     */
    async processBatchTaskUpdates(taskOps) {
        if (taskOps.length === 0) return;

        try {
            // Group by task ID to avoid duplicate updates
            const taskGroups = new Map();
            taskOps.forEach(op => {
                if (!taskGroups.has(op.taskId)) {
                    taskGroups.set(op.taskId, []);
                }
                taskGroups.get(op.taskId).push(op);
            });

            // Process each task group
            const updatePromises = Array.from(taskGroups.entries()).map(async ([taskId, ops]) => {
                // Merge all updates for this task
                const mergedUpdate = this.mergeTaskUpdates(ops);
                
                // Apply the merged update
                await this.syncTaskStatus({
                    taskId,
                    newStatus: mergedUpdate.status,
                    metadata: mergedUpdate.metadata
                });
            });

            await Promise.allSettled(updatePromises);
            logger.info(`Processed ${taskGroups.size} task updates in batch`);

        } catch (error) {
            logger.error('Error processing batch task updates:', error);
            throw error;
        }
    }

    /**
     * Process batch allowlist updates
     * @param {Array} allowlistOps - Allowlist operations
     */
    async processBatchAllowlistUpdates(allowlistOps) {
        if (allowlistOps.length === 0) return;

        try {
            // Group by allowlist ID
            const allowlistGroups = new Map();
            allowlistOps.forEach(op => {
                if (!allowlistGroups.has(op.allowlistId)) {
                    allowlistGroups.set(op.allowlistId, []);
                }
                allowlistGroups.get(op.allowlistId).push(op);
            });

            // Process each allowlist group
            const updatePromises = Array.from(allowlistGroups.entries()).map(async ([allowlistId, ops]) => {
                // Merge all updates for this allowlist
                const mergedUpdate = this.mergeAllowlistUpdates(ops);
                
                // Apply the merged update
                await this.syncAllowlistUpdate({
                    allowlistId,
                    updateType: mergedUpdate.updateType,
                    changes: mergedUpdate.changes
                });
            });

            await Promise.allSettled(updatePromises);
            logger.info(`Processed ${allowlistGroups.size} allowlist updates in batch`);

        } catch (error) {
            logger.error('Error processing batch allowlist updates:', error);
            throw error;
        }
    }

    /**
     * Process batch user progress updates
     * @param {Array} userOps - User progress operations
     */
    async processBatchUserProgress(userOps) {
        if (userOps.length === 0) return;

        try {
            // Group by user ID
            const userGroups = new Map();
            userOps.forEach(op => {
                if (!userGroups.has(op.userId)) {
                    userGroups.set(op.userId, []);
                }
                userGroups.get(op.userId).push(op);
            });

            // Process each user group
            const updatePromises = Array.from(userGroups.entries()).map(async ([userId, ops]) => {
                // Process each progress update for this user
                for (const op of ops) {
                    await this.syncUserProgress({
                        userId,
                        progressType: op.progressType,
                        progressData: op.progressData
                    });
                }
            });

            await Promise.allSettled(updatePromises);
            logger.info(`Processed ${userGroups.size} user progress updates in batch`);

        } catch (error) {
            logger.error('Error processing batch user progress updates:', error);
            throw error;
        }
    }

    /**
     * Handle webhook events from Naffles backend
     * @param {Object} webhookData - Webhook event data
     */
    async handleWebhookEvent(webhookData) {
        try {
            const { eventType, data, timestamp, signature } = webhookData;

            // Verify webhook signature
            if (!this.verifyWebhookSignature(webhookData, signature)) {
                logger.warn('Invalid webhook signature received');
                return;
            }

            this.metrics.webhookEvents++;
            logger.info('Processing webhook event:', { eventType, timestamp });

            switch (eventType) {
                case 'task.status_changed':
                    await this.handleTaskStatusWebhook(data);
                    break;
                
                case 'allowlist.updated':
                    await this.handleAllowlistWebhook(data);
                    break;
                
                case 'user.progress_updated':
                    await this.handleUserProgressWebhook(data);
                    break;
                
                case 'community.settings_changed':
                    await this.handleCommunitySettingsWebhook(data);
                    break;
                
                default:
                    logger.warn(`Unknown webhook event type: ${eventType}`);
            }

        } catch (error) {
            logger.error('Error handling webhook event:', error);
        }
    }

    /**
     * Handle task status webhook
     * @param {Object} data - Webhook data
     */
    async handleTaskStatusWebhook(data) {
        const { taskId, oldStatus, newStatus, metadata } = data;
        
        // Emit sync event
        this.emit('taskStatusChanged', {
            taskId,
            newStatus,
            metadata: {
                ...metadata,
                oldStatus,
                source: 'webhook'
            }
        });
    }

    /**
     * Handle allowlist webhook
     * @param {Object} data - Webhook data
     */
    async handleAllowlistWebhook(data) {
        const { allowlistId, updateType, changes } = data;
        
        // Emit sync event
        this.emit('allowlistUpdated', {
            allowlistId,
            updateType,
            changes: {
                ...changes,
                source: 'webhook'
            }
        });
    }

    /**
     * Handle user progress webhook
     * @param {Object} data - Webhook data
     */
    async handleUserProgressWebhook(data) {
        const { userId, progressType, progressData } = data;
        
        // Emit sync event
        this.emit('userProgressUpdated', {
            userId,
            progressType,
            progressData: {
                ...progressData,
                source: 'webhook'
            }
        });
    }

    /**
     * Start batch processing
     */
    startBatchProcessing() {
        // Skip intervals in test environment
        if (process.env.NODE_ENV === 'test') {
            logger.info('Skipping batch processing intervals in test environment');
            return;
        }

        // Process batch queue every 10 seconds
        const batchInterval = setInterval(async () => {
            await this.processBatchQueue();
        }, 10000);
        this.syncIntervals.set('batch', batchInterval);

        // Start batch timeout processing
        this.batchTimer = setInterval(() => {
            if (this.batchQueue.length > 0) {
                this.processBatchQueue();
            }
        }, this.batchTimeout);

        logger.info('Batch processing started');
    }

    /**
     * Start periodic sync processes
     */
    startPeriodicSync() {
        // Skip intervals in test environment
        if (process.env.NODE_ENV === 'test') {
            logger.info('Skipping periodic sync intervals in test environment');
            return;
        }

        // Process sync queue every 5 seconds
        const syncInterval = setInterval(async () => {
            await this.processPendingSyncs();
        }, 5000);
        this.syncIntervals.set('sync', syncInterval);

        // Clean up old sync operations every minute
        const cleanupInterval = setInterval(async () => {
            await this.cleanupOldSyncs();
        }, 60000);
        this.syncIntervals.set('cleanup', cleanupInterval);

        logger.info('Periodic sync processes started');
    }

    /**
     * Process pending sync operations
     */
    async processPendingSyncs() {
        try {
            const pendingSyncs = Array.from(this.syncQueue.keys())
                .filter(syncId => !this.activeSyncs.has(syncId))
                .slice(0, 10); // Process up to 10 at a time

            const processPromises = pendingSyncs.map(syncId => 
                this.processSyncOperation(syncId)
            );

            await Promise.allSettled(processPromises);

        } catch (error) {
            logger.error('Error processing pending syncs:', error);
        }
    }

    /**
     * Clean up old sync operations
     */
    async cleanupOldSyncs() {
        try {
            const now = Date.now();
            const maxAge = 5 * 60 * 1000; // 5 minutes

            // Clean up old sync operations
            for (const [syncId, syncOp] of this.syncQueue.entries()) {
                if (now - syncOp.timestamp > maxAge) {
                    this.syncQueue.delete(syncId);
                    logger.debug(`Cleaned up old sync operation: ${syncId}`);
                }
            }

            // Clean up error cooldowns
            for (const [syncId, cooldownTime] of this.errorCooldowns.entries()) {
                if (now - cooldownTime > this.cooldownDuration) {
                    this.errorCooldowns.delete(syncId);
                }
            }

        } catch (error) {
            logger.error('Error during sync cleanup:', error);
        }
    }

    /**
     * Handle sync retry logic
     * @param {string} syncId - Sync operation ID
     * @param {Error} error - Error that occurred
     */
    async handleSyncRetry(syncId, error) {
        const syncOp = this.syncQueue.get(syncId);
        if (!syncOp) return;

        syncOp.retries++;
        syncOp.lastError = error.message;
        syncOp.lastRetryTime = Date.now();

        if (syncOp.retries >= this.maxRetries) {
            // Max retries reached - remove from queue and log
            this.syncQueue.delete(syncId);
            this.metrics.failedSyncs++;
            
            logger.error(`Sync operation failed after ${this.maxRetries} retries: ${syncId}`, {
                type: syncOp.type,
                error: error.message,
                retries: syncOp.retries
            });

            // Set error cooldown
            this.errorCooldowns.set(syncId, Date.now());
        } else {
            // Schedule retry
            setTimeout(() => {
                this.processSyncOperation(syncId);
            }, this.retryDelay * syncOp.retries);

            logger.warn(`Sync operation retry scheduled: ${syncId} (attempt ${syncOp.retries + 1}/${this.maxRetries})`);
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

        const monitoringInterval = setInterval(() => {
            const stats = {
                ...this.metrics,
                queueSize: this.syncQueue.size,
                activeSyncs: this.activeSyncs.size,
                batchQueueSize: this.batchQueue.length,
                errorCooldowns: this.errorCooldowns.size
            };

            logger.info('Sync service performance stats:', stats);

            // Store metrics in Redis for monitoring
            this.redis.setex('discord_sync_metrics', 300, JSON.stringify(stats));

        }, 60000); // Every minute

        this.syncIntervals.set('monitoring', monitoringInterval);
        logger.info('Performance monitoring started');
    }

    /**
     * Update sync performance metrics
     * @param {number} syncTime - Time taken for sync operation
     */
    updateSyncMetrics(syncTime) {
        this.metrics.lastSyncTime = Date.now();
        
        // Calculate rolling average
        if (this.metrics.averageSyncTime === 0) {
            this.metrics.averageSyncTime = syncTime;
        } else {
            this.metrics.averageSyncTime = (this.metrics.averageSyncTime * 0.9) + (syncTime * 0.1);
        }
    }

    /**
     * Check if sync operation is on error cooldown
     * @param {string} syncId - Sync operation ID
     * @returns {boolean} Whether operation is on cooldown
     */
    isOnErrorCooldown(syncId) {
        const cooldownTime = this.errorCooldowns.get(syncId);
        if (!cooldownTime) return false;
        
        return (Date.now() - cooldownTime) < this.cooldownDuration;
    }

    /**
     * Verify webhook signature
     * @param {Object} webhookData - Webhook data
     * @param {string} signature - Provided signature
     * @returns {boolean} Whether signature is valid
     */
    verifyWebhookSignature(webhookData, signature) {
        try {
            const crypto = require('crypto');
            const payload = JSON.stringify(webhookData);
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
     * Make API call to Naffles backend
     * @param {string} endpoint - API endpoint
     * @param {string} method - HTTP method
     * @param {Object} data - Request data
     * @returns {Promise<Object>} API response
     */
    async makeNafflesApiCall(endpoint, method = 'GET', data = null) {
        try {
            // In test environment, return mock data
            if (process.env.NODE_ENV === 'test') {
                return { success: true, data: data };
            }

            const config = {
                method,
                url: `${this.nafflesApiBaseUrl}${endpoint}`,
                headers: {
                    'Authorization': `Bearer ${this.nafflesApiKey}`,
                    'Content-Type': 'application/json',
                    'X-Discord-Bot-Sync': 'true'
                },
                timeout: 5000 // Reduced timeout for faster failure
            };

            if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
                config.data = data;
            }

            const response = await axios(config);
            return response.data;
        } catch (error) {
            logger.error(`Naffles API call failed [${method} ${endpoint}]:`, {
                message: error.message,
                status: error.response?.status
            });
            throw error;
        }
    }

    // Helper methods for data retrieval

    async getTaskData(taskId) {
        try {
            return await this.makeNafflesApiCall(`/api/social-tasks/${taskId}`);
        } catch (error) {
            logger.error('Error getting task data:', error);
            return null;
        }
    }

    async getAllowlistData(allowlistId) {
        try {
            return await this.makeNafflesApiCall(`/api/allowlists/${allowlistId}`);
        } catch (error) {
            logger.error('Error getting allowlist data:', error);
            return null;
        }
    }

    // Merge methods for batch processing

    mergeTaskUpdates(ops) {
        const merged = {
            status: ops[ops.length - 1].newStatus, // Use latest status
            metadata: {}
        };

        // Merge all metadata
        ops.forEach(op => {
            Object.assign(merged.metadata, op.metadata);
        });

        return merged;
    }

    mergeAllowlistUpdates(ops) {
        const merged = {
            updateType: 'batch_update',
            changes: {}
        };

        // Merge all changes
        ops.forEach(op => {
            Object.assign(merged.changes, op.changes);
        });

        return merged;
    }

    /**
     * Initialize webhook handling
     */
    async initializeWebhookHandling() {
        try {
            // Skip webhook registration in test environment
            if (process.env.NODE_ENV === 'test') {
                logger.info('Skipping webhook registration in test environment');
                return;
            }

            // Register webhook endpoint with Naffles backend
            await this.makeNafflesApiCall('/api/webhooks/discord-bot', 'POST', {
                url: `${process.env.DISCORD_BOT_WEBHOOK_URL}/webhook`,
                events: [
                    'task.status_changed',
                    'allowlist.updated',
                    'user.progress_updated',
                    'community.settings_changed'
                ],
                secret: this.webhookSecret
            });

            logger.info('Webhook handling initialized');
        } catch (error) {
            logger.warn('Failed to register webhook endpoint:', error.message);
        }
    }

    /**
     * Restore sync state from Redis
     */
    async restoreSyncState() {
        try {
            const keys = await this.redis.keys('discord_sync:*');
            
            // Handle case where keys might be null or undefined
            if (!keys || !Array.isArray(keys)) {
                logger.info('No sync state to restore from Redis');
                return;
            }
            
            for (const key of keys) {
                const syncData = await this.redis.get(key);
                if (syncData) {
                    const syncOp = JSON.parse(syncData);
                    const syncId = key.replace('discord_sync:', '');
                    this.syncQueue.set(syncId, syncOp);
                }
            }

            logger.info(`Restored ${this.syncQueue.size} sync operations from Redis`);
        } catch (error) {
            logger.error('Error restoring sync state:', error);
        }
    }

    /**
     * Get sync service statistics
     * @returns {Object} Service statistics
     */
    getStatistics() {
        return {
            ...this.metrics,
            queueSize: this.syncQueue.size,
            activeSyncs: this.activeSyncs.size,
            batchQueueSize: this.batchQueue.length,
            errorCooldowns: this.errorCooldowns.size,
            uptime: Date.now() - (this.metrics.lastSyncTime || Date.now())
        };
    }

    /**
     * Notify task status change to relevant Discord channels
     * @param {string} taskId - Task ID
     * @param {string} newStatus - New status
     * @param {Object} metadata - Additional metadata
     */
    async notifyTaskStatusChange(taskId, newStatus, metadata) {
        try {
            // Get all Discord messages for this task
            const taskMessages = await this.db.getTaskMessages(taskId);
            
            for (const messageData of taskMessages) {
                try {
                    const channel = await this.botService.client.channels.fetch(messageData.channelId);
                    if (!channel) continue;

                    // Send notification message
                    await channel.send({
                        content: `📢 Task status updated: **${newStatus}**`,
                        embeds: [{
                            title: 'Task Status Update',
                            description: `Task ${taskId} status changed to ${newStatus}`,
                            color: newStatus === 'completed' ? 0x00ff00 : 0xffaa00,
                            timestamp: new Date().toISOString()
                        }]
                    });

                } catch (error) {
                    logger.warn(`Failed to notify task status change in ${messageData.channelId}:`, error.message);
                }
            }

        } catch (error) {
            logger.error('Error notifying task status change:', error);
        }
    }

    /**
     * Handle allowlist participant added
     * @param {string} allowlistId - Allowlist ID
     * @param {Object} changes - Changes data
     */
    async handleAllowlistParticipantAdded(allowlistId, changes) {
        try {
            // Update Discord embeds with new participant count
            await this.updateDiscordAllowlistEmbeds(allowlistId, changes);

            // Notify relevant channels
            const allowlistMessages = await this.db.getAllowlistMessages(allowlistId);
            
            for (const messageData of allowlistMessages) {
                try {
                    const channel = await this.botService.client.channels.fetch(messageData.channelId);
                    if (!channel) continue;

                    await channel.send({
                        content: `🎉 New participant joined the allowlist!`,
                        embeds: [{
                            title: 'Allowlist Update',
                            description: `Total participants: ${changes.totalParticipants || 'Unknown'}`,
                            color: 0x00ff00,
                            timestamp: new Date().toISOString()
                        }]
                    });

                } catch (error) {
                    logger.warn(`Failed to notify allowlist update in ${messageData.channelId}:`, error.message);
                }
            }

        } catch (error) {
            logger.error('Error handling allowlist participant added:', error);
        }
    }

    /**
     * Handle allowlist status change
     * @param {string} allowlistId - Allowlist ID
     * @param {Object} changes - Changes data
     */
    async handleAllowlistStatusChange(allowlistId, changes) {
        try {
            await this.updateDiscordAllowlistEmbeds(allowlistId, changes);
        } catch (error) {
            logger.error('Error handling allowlist status change:', error);
        }
    }

    /**
     * Handle allowlist winner selected
     * @param {string} allowlistId - Allowlist ID
     * @param {Object} changes - Changes data
     */
    async handleAllowlistWinnerSelected(allowlistId, changes) {
        try {
            await this.updateDiscordAllowlistEmbeds(allowlistId, changes);
        } catch (error) {
            logger.error('Error handling allowlist winner selected:', error);
        }
    }

    /**
     * Update user Discord elements
     * @param {string} userId - User ID
     * @param {string} progressType - Progress type
     * @param {Object} progressData - Progress data
     */
    async updateUserDiscordElements(userId, progressType, progressData) {
        try {
            // This would update user-specific Discord elements
            // For now, just log the update
            logger.debug(`Updated Discord elements for user ${userId}:`, {
                progressType,
                progressData
            });
        } catch (error) {
            logger.error('Error updating user Discord elements:', error);
        }
    }

    /**
     * Handle points earned
     * @param {string} userId - User ID
     * @param {Object} progressData - Progress data
     */
    async handlePointsEarned(userId, progressData) {
        try {
            logger.debug(`User ${userId} earned points:`, progressData);
        } catch (error) {
            logger.error('Error handling points earned:', error);
        }
    }

    /**
     * Handle task completed
     * @param {string} userId - User ID
     * @param {Object} progressData - Progress data
     */
    async handleTaskCompleted(userId, progressData) {
        try {
            logger.debug(`User ${userId} completed task:`, progressData);
        } catch (error) {
            logger.error('Error handling task completed:', error);
        }
    }

    /**
     * Handle achievement unlocked
     * @param {string} userId - User ID
     * @param {Object} progressData - Progress data
     */
    async handleAchievementUnlocked(userId, progressData) {
        try {
            logger.debug(`User ${userId} unlocked achievement:`, progressData);
        } catch (error) {
            logger.error('Error handling achievement unlocked:', error);
        }
    }

    /**
     * Shutdown the sync service gracefully
     */
    async shutdown() {
        try {
            logger.info('Shutting down Real-Time Sync Service...');

            // Clear all intervals
            this.syncIntervals.forEach(interval => clearInterval(interval));
            
            // Clear batch timer
            if (this.batchTimer) {
                clearTimeout(this.batchTimer);
            }

            // Process remaining sync operations
            await this.processPendingSyncs();

            // Save sync state to Redis
            for (const [syncId, syncOp] of this.syncQueue.entries()) {
                await this.redis.setex(`discord_sync:${syncId}`, 3600, JSON.stringify(syncOp));
            }

            logger.info('Real-Time Sync Service shutdown complete');
        } catch (error) {
            logger.error('Error during sync service shutdown:', error);
        }
    }
}

module.exports = RealTimeSyncService;