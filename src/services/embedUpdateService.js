const logger = require('../utils/logger');
const EmbedBuilderService = require('./embedBuilder');

/**
 * Embed Update Service for Real-time Status Changes and Progress Tracking
 * Handles dynamic updates to Discord embeds with real-time data synchronization
 */
class EmbedUpdateService {
    constructor(client, databaseService, redisService) {
        this.client = client;
        this.db = databaseService;
        this.redis = redisService;
        this.embedBuilder = new EmbedBuilderService();
        
        // Track active embeds for updates
        this.activeEmbeds = new Map();
        
        // Update intervals
        this.updateIntervals = new Map();
        
        // Rate limiting for updates
        this.updateCooldowns = new Map();
        this.cooldownDuration = 5000; // 5 seconds between updates
    }

    /**
     * Register an embed for real-time updates
     * @param {string} embedId - Unique identifier for the embed
     * @param {Object} embedInfo - Information about the embed
     */
    async registerEmbedForUpdates(embedId, embedInfo) {
        try {
            const {
                guildId,
                channelId,
                messageId,
                type, // 'task' or 'allowlist'
                dataId, // task ID or allowlist ID
                updateFrequency = 30000 // 30 seconds default
            } = embedInfo;

            // Store embed information
            this.activeEmbeds.set(embedId, {
                guildId,
                channelId,
                messageId,
                type,
                dataId,
                updateFrequency,
                lastUpdate: Date.now(),
                isActive: true
            });

            // Store in Redis for persistence across restarts
            await this.redis.setex(
                `embed_update:${embedId}`,
                3600, // 1 hour TTL
                JSON.stringify(embedInfo)
            );

            // Start update interval if needed
            this.startUpdateInterval(embedId, updateFrequency);

            logger.info(`Registered embed for updates: ${embedId}`);
        } catch (error) {
            logger.error('Error registering embed for updates:', error);
        }
    }

    /**
     * Unregister an embed from updates
     * @param {string} embedId - Unique identifier for the embed
     */
    async unregisterEmbedFromUpdates(embedId) {
        try {
            // Remove from active embeds
            this.activeEmbeds.delete(embedId);

            // Clear update interval
            if (this.updateIntervals.has(embedId)) {
                clearInterval(this.updateIntervals.get(embedId));
                this.updateIntervals.delete(embedId);
            }

            // Remove from Redis
            await this.redis.del(`embed_update:${embedId}`);

            logger.info(`Unregistered embed from updates: ${embedId}`);
        } catch (error) {
            logger.error('Error unregistering embed from updates:', error);
        }
    }

    /**
     * Update a specific embed with new data
     * @param {string} embedId - Unique identifier for the embed
     * @param {Object} updateData - New data for the embed
     * @param {boolean} force - Force update even if on cooldown
     */
    async updateEmbed(embedId, updateData, force = false) {
        try {
            const embedInfo = this.activeEmbeds.get(embedId);
            if (!embedInfo || !embedInfo.isActive) {
                logger.warn(`Embed not found or inactive: ${embedId}`);
                return false;
            }

            // Check cooldown unless forced
            if (!force && this.isOnCooldown(embedId)) {
                logger.debug(`Embed update on cooldown: ${embedId}`);
                return false;
            }

            // Get the Discord message
            const channel = await this.client.channels.fetch(embedInfo.channelId);
            if (!channel) {
                logger.warn(`Channel not found: ${embedInfo.channelId}`);
                await this.unregisterEmbedFromUpdates(embedId);
                return false;
            }

            const message = await channel.messages.fetch(embedInfo.messageId);
            if (!message) {
                logger.warn(`Message not found: ${embedInfo.messageId}`);
                await this.unregisterEmbedFromUpdates(embedId);
                return false;
            }

            // Get current embed
            const currentEmbed = message.embeds[0];
            if (!currentEmbed) {
                logger.warn(`No embed found in message: ${embedInfo.messageId}`);
                return false;
            }

            // Create updated embed
            let updatedEmbed;
            if (embedInfo.type === 'task') {
                updatedEmbed = await this.updateTaskEmbed(currentEmbed, updateData);
            } else if (embedInfo.type === 'allowlist') {
                updatedEmbed = await this.updateAllowlistEmbed(currentEmbed, updateData);
            } else {
                logger.warn(`Unknown embed type: ${embedInfo.type}`);
                return false;
            }

            // Update the message
            await message.edit({ embeds: [updatedEmbed] });

            // Update cooldown
            this.updateCooldowns.set(embedId, Date.now());
            embedInfo.lastUpdate = Date.now();

            logger.debug(`Updated embed: ${embedId}`);
            return true;
        } catch (error) {
            logger.error(`Error updating embed ${embedId}:`, error);
            return false;
        }
    }

    /**
     * Update multiple embeds with batch data
     * @param {Array} updates - Array of update objects
     */
    async batchUpdateEmbeds(updates) {
        try {
            const updatePromises = updates.map(update => 
                this.updateEmbed(update.embedId, update.data, update.force)
            );

            const results = await Promise.allSettled(updatePromises);
            
            const successful = results.filter(result => result.status === 'fulfilled' && result.value).length;
            const failed = results.length - successful;

            logger.info(`Batch update completed: ${successful} successful, ${failed} failed`);
            return { successful, failed };
        } catch (error) {
            logger.error('Error in batch update:', error);
            return { successful: 0, failed: updates.length };
        }
    }

    /**
     * Update task embed with new data
     * @private
     */
    async updateTaskEmbed(currentEmbed, updateData) {
        try {
            // Convert Discord embed to our format
            const embedData = this.convertDiscordEmbedToData(currentEmbed);
            
            // Apply updates
            if (updateData.status) {
                embedData.status = updateData.status;
            }
            
            if (updateData.completedBy !== undefined) {
                embedData.completedBy = updateData.completedBy;
            }
            
            if (updateData.endTime) {
                embedData.endTime = updateData.endTime;
            }
            
            if (updateData.participants !== undefined) {
                embedData.participants = updateData.participants;
            }

            // Create updated embed
            return this.embedBuilder.createTaskEmbed(embedData);
        } catch (error) {
            logger.error('Error updating task embed:', error);
            throw error;
        }
    }

    /**
     * Update allowlist embed with new data
     * @private
     */
    async updateAllowlistEmbed(currentEmbed, updateData) {
        try {
            // Convert Discord embed to our format
            const embedData = this.convertDiscordEmbedToData(currentEmbed);
            
            // Apply updates
            if (updateData.status) {
                embedData.status = updateData.status;
            }
            
            if (updateData.participants !== undefined) {
                embedData.participants = updateData.participants;
            }
            
            if (updateData.endTime) {
                embedData.endTime = updateData.endTime;
            }
            
            if (updateData.winnerCount !== undefined) {
                embedData.winnerCount = updateData.winnerCount;
            }

            // Create updated embed
            return this.embedBuilder.createAllowlistEmbed(embedData);
        } catch (error) {
            logger.error('Error updating allowlist embed:', error);
            throw error;
        }
    }

    /**
     * Start automatic update interval for an embed
     * @private
     */
    startUpdateInterval(embedId, frequency) {
        // Clear existing interval if any
        if (this.updateIntervals.has(embedId)) {
            clearInterval(this.updateIntervals.get(embedId));
        }

        // Start new interval
        const interval = setInterval(async () => {
            await this.performScheduledUpdate(embedId);
        }, frequency);

        this.updateIntervals.set(embedId, interval);
    }

    /**
     * Perform scheduled update for an embed
     * @private
     */
    async performScheduledUpdate(embedId) {
        try {
            const embedInfo = this.activeEmbeds.get(embedId);
            if (!embedInfo || !embedInfo.isActive) {
                return;
            }

            // Fetch latest data from database/API
            let latestData;
            if (embedInfo.type === 'task') {
                latestData = await this.fetchLatestTaskData(embedInfo.dataId);
            } else if (embedInfo.type === 'allowlist') {
                latestData = await this.fetchLatestAllowlistData(embedInfo.dataId);
            }

            if (latestData) {
                await this.updateEmbed(embedId, latestData);
            }
        } catch (error) {
            logger.error(`Error in scheduled update for ${embedId}:`, error);
        }
    }

    /**
     * Fetch latest task data
     * @private
     */
    async fetchLatestTaskData(taskId) {
        try {
            // This would typically fetch from your database or API
            // For now, return mock data structure
            return {
                status: 'active',
                completedBy: Math.floor(Math.random() * 100),
                participants: Math.floor(Math.random() * 50)
            };
        } catch (error) {
            logger.error('Error fetching latest task data:', error);
            return null;
        }
    }

    /**
     * Fetch latest allowlist data
     * @private
     */
    async fetchLatestAllowlistData(allowlistId) {
        try {
            // This would typically fetch from your database or API
            // For now, return mock data structure
            return {
                status: 'active',
                participants: Math.floor(Math.random() * 200),
                endTime: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
            };
        } catch (error) {
            logger.error('Error fetching latest allowlist data:', error);
            return null;
        }
    }

    /**
     * Convert Discord embed to our data format
     * @private
     */
    convertDiscordEmbedToData(discordEmbed) {
        const data = {
            title: discordEmbed.title?.replace(/^[🎯🎫]\s*/, '') || '',
            description: discordEmbed.description || '',
            status: 'active',
            completedBy: 0,
            participants: 0
        };

        // Extract data from fields
        if (discordEmbed.fields) {
            discordEmbed.fields.forEach(field => {
                if (field.name.includes('Completed By')) {
                    const match = field.value.match(/(\d+)/);
                    if (match) data.completedBy = parseInt(match[1]);
                } else if (field.name.includes('Participants')) {
                    const match = field.value.match(/(\d+)/);
                    if (match) data.participants = parseInt(match[1]);
                } else if (field.name.includes('Status')) {
                    data.status = field.value.replace(/^[📊]\s*/, '').toLowerCase();
                }
            });
        }

        return data;
    }

    /**
     * Check if embed is on cooldown
     * @private
     */
    isOnCooldown(embedId) {
        const lastUpdate = this.updateCooldowns.get(embedId);
        if (!lastUpdate) return false;
        return (Date.now() - lastUpdate) < this.cooldownDuration;
    }

    /**
     * Clean up inactive embeds and intervals
     */
    async cleanup() {
        try {
            const now = Date.now();
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours

            for (const [embedId, embedInfo] of this.activeEmbeds.entries()) {
                if (now - embedInfo.lastUpdate > maxAge) {
                    await this.unregisterEmbedFromUpdates(embedId);
                    logger.info(`Cleaned up inactive embed: ${embedId}`);
                }
            }
        } catch (error) {
            logger.error('Error during cleanup:', error);
        }
    }

    /**
     * Initialize service and restore active embeds from Redis
     */
    async initialize() {
        try {
            // Restore active embeds from Redis
            const keys = await this.redis.keys('embed_update:*');
            
            for (const key of keys) {
                const embedId = key.replace('embed_update:', '');
                const embedInfoStr = await this.redis.get(key);
                
                if (embedInfoStr) {
                    const embedInfo = JSON.parse(embedInfoStr);
                    this.activeEmbeds.set(embedId, {
                        ...embedInfo,
                        lastUpdate: Date.now(),
                        isActive: true
                    });
                    
                    this.startUpdateInterval(embedId, embedInfo.updateFrequency || 30000);
                }
            }

            // Start cleanup interval
            setInterval(() => {
                this.cleanup();
            }, 60 * 60 * 1000); // Run cleanup every hour

            logger.info(`Embed update service initialized with ${this.activeEmbeds.size} active embeds`);
        } catch (error) {
            logger.error('Error initializing embed update service:', error);
        }
    }

    /**
     * Get statistics about active embeds
     */
    getStatistics() {
        return {
            activeEmbeds: this.activeEmbeds.size,
            updateIntervals: this.updateIntervals.size,
            cooldowns: this.updateCooldowns.size,
            embedTypes: {
                task: Array.from(this.activeEmbeds.values()).filter(e => e.type === 'task').length,
                allowlist: Array.from(this.activeEmbeds.values()).filter(e => e.type === 'allowlist').length
            }
        };
    }
}

module.exports = EmbedUpdateService;