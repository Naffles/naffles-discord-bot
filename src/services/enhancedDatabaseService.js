const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Import enhanced models
const DiscordServerMapping = require('../models/discordServerMapping');
const DiscordAccountLink = require('../models/discordAccountLink');
const DiscordTaskPost = require('../models/discordTaskPost');
const DiscordAllowlistConnection = require('../models/discordAllowlistConnection');
const DiscordInteractionLog = require('../models/discordInteractionLog');

class EnhancedDatabaseService {
    constructor() {
        this.connection = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = 5000; // 5 seconds
        this.healthCheckInterval = null;
        this.cleanupInterval = null;
        this.performanceMetrics = {
            totalQueries: 0,
            avgQueryTime: 0,
            errorCount: 0,
            lastHealthCheck: null
        };
    }

    async connect() {
        try {
            logger.info('Connecting to MongoDB with enhanced database service...');

            const options = {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                maxPoolSize: 20, // Increased pool size
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
                bufferMaxEntries: 0,
                bufferCommands: false,
                maxIdleTimeMS: 30000,
                heartbeatFrequencyMS: 10000,
                retryWrites: true,
                retryReads: true
            };

            this.connection = await mongoose.connect(process.env.MONGODB_URI, options);
            this.isConnected = true;
            this.reconnectAttempts = 0;

            logger.info('Enhanced MongoDB connection established successfully');

            // Set up connection event listeners
            this.setupConnectionListeners();

            // Initialize indexes and database optimizations
            await this.initializeDatabase();

            // Start health monitoring and cleanup services
            this.startHealthMonitoring();
            this.startCleanupServices();

        } catch (error) {
            logger.error('Failed to connect to MongoDB:', error);
            await this.handleReconnection();
        }
    }

    setupConnectionListeners() {
        mongoose.connection.on('connected', () => {
            logger.info('Enhanced MongoDB connection established');
            this.isConnected = true;
            this.performanceMetrics.lastHealthCheck = new Date();
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('Enhanced MongoDB connection lost');
            this.isConnected = false;
            this.handleReconnection();
        });

        mongoose.connection.on('error', (error) => {
            logger.error('Enhanced MongoDB connection error:', error);
            this.isConnected = false;
            this.performanceMetrics.errorCount++;
        });

        mongoose.connection.on('reconnected', () => {
            logger.info('Enhanced MongoDB reconnected successfully');
            this.isConnected = true;
            this.reconnectAttempts = 0;
        });
    }

    async handleReconnection() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger.error('Max reconnection attempts reached. Giving up.');
            return;
        }

        this.reconnectAttempts++;
        logger.info(`Attempting to reconnect to MongoDB (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

        setTimeout(async () => {
            try {
                await this.connect();
            } catch (error) {
                logger.error('Reconnection attempt failed:', error);
            }
        }, this.reconnectInterval * this.reconnectAttempts);
    }

    async initializeDatabase() {
        try {
            logger.info('Initializing enhanced database indexes and optimizations...');

            // Create all necessary indexes
            await this.createIndexes();

            // Set up database optimizations
            await this.optimizeDatabase();

            // Validate data integrity
            await this.validateDataIntegrity();

            logger.info('Enhanced database initialization completed successfully');
        } catch (error) {
            logger.error('Failed to initialize enhanced database:', error);
            throw error;
        }
    }

    async createIndexes() {
        try {
            // Discord Server Mapping indexes
            await DiscordServerMapping.collection.createIndex({ guildId: 1 }, { unique: true });
            await DiscordServerMapping.collection.createIndex({ communityId: 1, isActive: 1 });
            await DiscordServerMapping.collection.createIndex({ linkedBy: 1, linkedAt: -1 });
            await DiscordServerMapping.collection.createIndex({ 'activityStats.lastActivity': -1 });
            await DiscordServerMapping.collection.createIndex({ 'integrationStatus.isHealthy': 1, isActive: 1 });

            // Discord Account Link indexes
            await DiscordAccountLink.collection.createIndex({ discordId: 1 }, { unique: true });
            await DiscordAccountLink.collection.createIndex({ nafflesUserId: 1, 'status.isActive': 1 });
            await DiscordAccountLink.collection.createIndex({ 'linkingData.linkedAt': -1 });
            await DiscordAccountLink.collection.createIndex({ 'activityStats.lastActivity': -1 });
            await DiscordAccountLink.collection.createIndex({ 'status.isActive': 1, 'status.isVerified': 1 });
            await DiscordAccountLink.collection.createIndex({ 'oauthTokens.expiresAt': 1 });

            // Discord Task Post indexes
            await DiscordTaskPost.collection.createIndex({ taskId: 1, guildId: 1 });
            await DiscordTaskPost.collection.createIndex({ guildId: 1, 'taskData.status': 1 });
            await DiscordTaskPost.collection.createIndex({ messageId: 1, 'lifecycle.isActive': 1 });
            await DiscordTaskPost.collection.createIndex({ 'creationData.createdBy': 1, 'creationData.createdAt': -1 });
            await DiscordTaskPost.collection.createIndex({ 'timing.endTime': 1, 'taskData.status': 1 });

            // Discord Allowlist Connection indexes
            await DiscordAllowlistConnection.collection.createIndex({ allowlistId: 1, guildId: 1 });
            await DiscordAllowlistConnection.collection.createIndex({ guildId: 1, 'allowlistData.status': 1 });
            await DiscordAllowlistConnection.collection.createIndex({ messageId: 1, 'lifecycle.isActive': 1 });
            await DiscordAllowlistConnection.collection.createIndex({ 'timing.endTime': 1, 'allowlistData.status': 1 });

            // Discord Interaction Log indexes
            await DiscordInteractionLog.collection.createIndex({ guildId: 1, 'timing.timestamp': -1 });
            await DiscordInteractionLog.collection.createIndex({ userId: 1, 'timing.timestamp': -1 });
            await DiscordInteractionLog.collection.createIndex({ 'interaction.type': 1, 'timing.timestamp': -1 });
            await DiscordInteractionLog.collection.createIndex({ 'interaction.commandName': 1, 'timing.timestamp': -1 });
            await DiscordInteractionLog.collection.createIndex({ action: 1, result: 1, 'timing.timestamp': -1 });

            logger.info('Enhanced database indexes created successfully');
        } catch (error) {
            logger.error('Failed to create enhanced database indexes:', error);
            throw error;
        }
    }

    async optimizeDatabase() {
        try {
            // Set read preference for analytics queries
            mongoose.connection.db.readPreference = 'secondaryPreferred';

            // Configure write concern for better performance
            mongoose.connection.db.writeConcern = { w: 1, j: true };

            logger.info('Database optimizations applied successfully');
        } catch (error) {
            logger.error('Failed to apply database optimizations:', error);
        }
    }

    async validateDataIntegrity() {
        try {
            // Check for orphaned records
            const orphanedTasks = await DiscordTaskPost.countDocuments({
                guildId: { $nin: await DiscordServerMapping.distinct('guildId', { isActive: true }) }
            });

            const orphanedAllowlists = await DiscordAllowlistConnection.countDocuments({
                guildId: { $nin: await DiscordServerMapping.distinct('guildId', { isActive: true }) }
            });

            if (orphanedTasks > 0 || orphanedAllowlists > 0) {
                logger.warn(`Data integrity check found ${orphanedTasks} orphaned tasks and ${orphanedAllowlists} orphaned allowlists`);
            }

            logger.info('Data integrity validation completed');
        } catch (error) {
            logger.error('Failed to validate data integrity:', error);
        }
    }

    startHealthMonitoring() {
        this.healthCheckInterval = setInterval(async () => {
            try {
                await this.performHealthCheck();
            } catch (error) {
                logger.error('Health check failed:', error);
            }
        }, 60000); // Every minute
    }

    startCleanupServices() {
        this.cleanupInterval = setInterval(async () => {
            try {
                await this.performCleanup();
            } catch (error) {
                logger.error('Cleanup service failed:', error);
            }
        }, 3600000); // Every hour
    }

    async performHealthCheck() {
        const startTime = Date.now();
        
        try {
            // Test basic connectivity
            await mongoose.connection.db.admin().ping();
            
            // Check collection stats
            const stats = await this.getCollectionStats();
            
            // Update performance metrics
            const responseTime = Date.now() - startTime;
            this.performanceMetrics.lastHealthCheck = new Date();
            this.performanceMetrics.avgQueryTime = 
                (this.performanceMetrics.avgQueryTime + responseTime) / 2;
            
            logger.debug('Health check completed successfully', { responseTime, stats });
        } catch (error) {
            this.performanceMetrics.errorCount++;
            logger.error('Health check failed:', error);
            throw error;
        }
    }

    async performCleanup() {
        try {
            logger.info('Starting database cleanup...');

            // Clean up old interaction logs (older than 90 days)
            const logsDeleted = await DiscordInteractionLog.cleanupOldLogs(90);
            
            // Archive old logs (older than 30 days)
            const logsArchived = await DiscordInteractionLog.archiveOldLogs(30);
            
            // Clean up expired verification tokens
            const expiredTokens = await DiscordAccountLink.updateMany(
                {
                    'linkingData.tokenExpiresAt': { $lt: new Date() },
                    'status.isVerified': false
                },
                {
                    $unset: {
                        'linkingData.verificationToken': 1,
                        'linkingData.tokenExpiresAt': 1
                    }
                }
            );

            // Update expired tasks and allowlists
            const expiredTasks = await DiscordTaskPost.updateMany(
                {
                    'taskData.status': 'active',
                    'timing.endTime': { $lte: new Date() }
                },
                {
                    'taskData.status': 'expired',
                    'lifecycle.lastStatusChange': new Date()
                }
            );

            const expiredAllowlists = await DiscordAllowlistConnection.updateMany(
                {
                    'allowlistData.status': 'active',
                    'timing.endTime': { $lte: new Date() }
                },
                {
                    'allowlistData.status': 'expired',
                    'lifecycle.lastStatusChange': new Date()
                }
            );

            logger.info('Database cleanup completed', {
                logsDeleted: logsDeleted.deletedCount,
                logsArchived: logsArchived.modifiedCount,
                expiredTokens: expiredTokens.modifiedCount,
                expiredTasks: expiredTasks.modifiedCount,
                expiredAllowlists: expiredAllowlists.modifiedCount
            });

        } catch (error) {
            logger.error('Database cleanup failed:', error);
        }
    }

    async getCollectionStats() {
        try {
            const collections = [
                'discordservermappings',
                'discordaccountlinks',
                'discordtaskposts',
                'discordallowlistconnections',
                'discordinteractionlogs'
            ];

            const stats = {};
            for (const collection of collections) {
                const collStats = await mongoose.connection.db.collection(collection).stats();
                stats[collection] = {
                    count: collStats.count,
                    size: collStats.size,
                    avgObjSize: collStats.avgObjSize,
                    indexCount: collStats.nindexes,
                    totalIndexSize: collStats.totalIndexSize
                };
            }

            return stats;
        } catch (error) {
            logger.error('Failed to get collection stats:', error);
            return {};
        }
    }

    // Enhanced Server Mapping Methods
    async createServerMapping(guildData, communityId, linkedBy, additionalData = {}) {
        try {
            // Deactivate any existing mapping for this guild
            await DiscordServerMapping.updateMany(
                { guildId: guildData.id },
                { isActive: false }
            );

            const mappingData = {
                guildId: guildData.id,
                communityId,
                linkedBy,
                guildInfo: {
                    name: guildData.name,
                    icon: guildData.iconURL?.() || null,
                    memberCount: guildData.memberCount,
                    ownerId: guildData.ownerId,
                    preferredLocale: guildData.preferredLocale,
                    features: guildData.features || [],
                    premiumTier: guildData.premiumTier || 0,
                    verificationLevel: guildData.verificationLevel
                },
                ...additionalData
            };

            const mapping = new DiscordServerMapping(mappingData);
            await mapping.save();
            
            await mapping.addAuditEntry('created', linkedBy, { communityId });
            
            logger.info('Server mapping created successfully', { guildId: guildData.id, communityId });
            return mapping;
        } catch (error) {
            logger.error('Failed to create server mapping:', error);
            throw error;
        }
    }

    async getServerMapping(guildId) {
        try {
            const mapping = await DiscordServerMapping.findByGuild(guildId);
            if (mapping) {
                await mapping.updateActivity();
            }
            return mapping;
        } catch (error) {
            logger.error('Failed to get server mapping:', error);
            throw error;
        }
    }

    // Enhanced Account Link Methods
    async createAccountLink(discordUser, nafflesUser, linkMethod = 'oauth', additionalData = {}) {
        try {
            // Deactivate any existing link for this Discord user
            await DiscordAccountLink.updateMany(
                { discordId: discordUser.id },
                { 'status.isActive': false }
            );

            const linkData = {
                discordId: discordUser.id,
                nafflesUserId: nafflesUser.id,
                discordUserInfo: {
                    username: discordUser.username,
                    discriminator: discordUser.discriminator,
                    globalName: discordUser.global_name,
                    avatar: discordUser.avatar,
                    verified: discordUser.verified,
                    mfaEnabled: discordUser.mfa_enabled
                },
                nafflesUserInfo: {
                    username: nafflesUser.username,
                    walletAddress: nafflesUser.walletAddress,
                    email: nafflesUser.email,
                    tier: nafflesUser.tier
                },
                linkingData: {
                    method: linkMethod,
                    ipAddress: additionalData.ipAddress,
                    userAgent: additionalData.userAgent
                },
                permissions: {
                    dataProcessingConsent: additionalData.dataProcessingConsent || false,
                    consentTimestamp: additionalData.dataProcessingConsent ? new Date() : null
                }
            };

            const link = new DiscordAccountLink(linkData);
            await link.save();
            
            await link.addAuditEntry('created', 'system', { linkMethod }, additionalData.ipAddress, additionalData.userAgent);
            
            logger.info('Account link created successfully', { discordId: discordUser.id, nafflesUserId: nafflesUser.id });
            return link;
        } catch (error) {
            logger.error('Failed to create account link:', error);
            throw error;
        }
    }

    async getAccountLink(discordId) {
        try {
            const link = await DiscordAccountLink.findByDiscord(discordId);
            if (link) {
                await link.updateActivity();
            }
            return link;
        } catch (error) {
            logger.error('Failed to get account link:', error);
            throw error;
        }
    }

    // Enhanced Task Post Methods
    async createTaskPost(taskData, guildId, channelId, messageId, createdBy, additionalData = {}) {
        try {
            const postData = {
                taskId: taskData.id,
                guildId,
                channelId,
                messageId,
                creationData: {
                    createdBy,
                    creationMethod: additionalData.creationMethod || 'slash_command',
                    creatorRole: additionalData.creatorRole,
                    creatorPermissions: additionalData.creatorPermissions || []
                },
                taskData: {
                    title: taskData.title,
                    description: taskData.description,
                    type: taskData.type,
                    points: taskData.points || 0,
                    requirements: taskData.requirements || [],
                    rewards: taskData.rewards || []
                },
                timing: {
                    startTime: taskData.startTime || new Date(),
                    endTime: taskData.endTime,
                    duration: taskData.duration,
                    timeZone: taskData.timeZone
                },
                messageData: {
                    embedData: additionalData.embedData,
                    buttonIds: additionalData.buttonIds || []
                }
            };

            const post = new DiscordTaskPost(postData);
            await post.save();
            
            await post.addAuditEntry('created', createdBy, { taskId: taskData.id });
            
            logger.info('Task post created successfully', { taskId: taskData.id, guildId, messageId });
            return post;
        } catch (error) {
            logger.error('Failed to create task post:', error);
            throw error;
        }
    }

    // Enhanced Allowlist Connection Methods
    async createAllowlistConnection(allowlistData, guildId, channelId, messageId, connectedBy, additionalData = {}) {
        try {
            const connectionData = {
                allowlistId: allowlistData.id,
                guildId,
                channelId,
                messageId,
                connectionData: {
                    connectedBy,
                    connectionMethod: additionalData.connectionMethod || 'slash_command',
                    connectorRole: additionalData.connectorRole,
                    connectorPermissions: additionalData.connectorPermissions || []
                },
                allowlistData: {
                    title: allowlistData.title,
                    description: allowlistData.description,
                    prize: allowlistData.prize,
                    winnerCount: allowlistData.winnerCount,
                    entryPrice: allowlistData.entryPrice || { amount: 0, isFree: true },
                    requirements: allowlistData.requirements || []
                },
                timing: {
                    startTime: allowlistData.startTime || new Date(),
                    endTime: allowlistData.endTime,
                    timeZone: allowlistData.timeZone
                },
                messageData: {
                    embedData: additionalData.embedData,
                    buttonIds: additionalData.buttonIds || []
                }
            };

            const connection = new DiscordAllowlistConnection(connectionData);
            await connection.save();
            
            await connection.addAuditEntry('created', connectedBy, { allowlistId: allowlistData.id });
            
            logger.info('Allowlist connection created successfully', { allowlistId: allowlistData.id, guildId, messageId });
            return connection;
        } catch (error) {
            logger.error('Failed to create allowlist connection:', error);
            throw error;
        }
    }

    // Enhanced Interaction Logging
    async logInteraction(interactionData) {
        try {
            const log = await DiscordInteractionLog.logInteraction(interactionData);
            this.performanceMetrics.totalQueries++;
            return log;
        } catch (error) {
            logger.error('Failed to log interaction:', error);
            this.performanceMetrics.errorCount++;
            throw error;
        }
    }

    // Analytics and Reporting Methods
    async getGuildAnalytics(guildId, days = 30) {
        try {
            const [
                serverMapping,
                taskStats,
                allowlistStats,
                interactionStats,
                accountLinks
            ] = await Promise.all([
                DiscordServerMapping.findByGuild(guildId),
                DiscordTaskPost.getCompletionStats(guildId, days),
                DiscordAllowlistConnection.getEntryStats(guildId, days),
                DiscordInteractionLog.getGuildStats(guildId, days),
                DiscordAccountLink.find({ 
                    'activityStats.lastActivity': { 
                        $gte: new Date(Date.now() - (days * 24 * 60 * 60 * 1000)) 
                    }
                }).countDocuments()
            ]);

            return {
                serverMapping,
                taskStats: taskStats[0] || {},
                allowlistStats: allowlistStats[0] || {},
                interactionStats,
                activeAccountLinks: accountLinks,
                generatedAt: new Date()
            };
        } catch (error) {
            logger.error('Failed to get guild analytics:', error);
            throw error;
        }
    }

    async getPlatformAnalytics(days = 30) {
        try {
            const [
                totalServers,
                totalAccountLinks,
                totalTasks,
                totalAllowlists,
                totalInteractions,
                performanceMetrics
            ] = await Promise.all([
                DiscordServerMapping.getActiveCount(),
                DiscordAccountLink.getActiveCount(),
                DiscordTaskPost.countDocuments({ 'lifecycle.isActive': true }),
                DiscordAllowlistConnection.countDocuments({ 'lifecycle.isActive': true }),
                DiscordInteractionLog.countDocuments({
                    'timing.timestamp': { 
                        $gte: new Date(Date.now() - (days * 24 * 60 * 60 * 1000)) 
                    }
                }),
                DiscordInteractionLog.getPerformanceMetrics(days)
            ]);

            return {
                totalServers,
                totalAccountLinks,
                totalTasks,
                totalAllowlists,
                totalInteractions,
                performanceMetrics: performanceMetrics[0] || {},
                systemHealth: this.getSystemHealth(),
                generatedAt: new Date()
            };
        } catch (error) {
            logger.error('Failed to get platform analytics:', error);
            throw error;
        }
    }

    // Data Migration Methods
    async migrateData(fromVersion, toVersion) {
        try {
            logger.info(`Starting data migration from version ${fromVersion} to ${toVersion}`);

            // Add migration logic here based on version requirements
            switch (toVersion) {
                case '2.0':
                    await this.migrateToV2();
                    break;
                default:
                    logger.warn(`No migration path defined for version ${toVersion}`);
            }

            logger.info('Data migration completed successfully');
        } catch (error) {
            logger.error('Data migration failed:', error);
            throw error;
        }
    }

    async migrateToV2() {
        // Example migration logic
        try {
            // Update old schema fields to new format
            await DiscordServerMapping.updateMany(
                { 'guildInfo.lastUpdated': { $exists: false } },
                { $set: { 'guildInfo.lastUpdated': new Date() } }
            );

            logger.info('Migration to v2.0 completed');
        } catch (error) {
            logger.error('Migration to v2.0 failed:', error);
            throw error;
        }
    }

    // System Health and Monitoring
    getSystemHealth() {
        return {
            isConnected: this.isConnected,
            connectionState: mongoose.connection.readyState,
            performanceMetrics: this.performanceMetrics,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            lastHealthCheck: this.performanceMetrics.lastHealthCheck
        };
    }

    async disconnect() {
        try {
            // Clear intervals
            if (this.healthCheckInterval) {
                clearInterval(this.healthCheckInterval);
            }
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
            }

            // Close connection
            if (this.connection) {
                await mongoose.connection.close();
                this.isConnected = false;
                logger.info('Enhanced MongoDB connection closed');
            }
        } catch (error) {
            logger.error('Error closing enhanced MongoDB connection:', error);
        }
    }

    // Health Check
    isHealthy() {
        return this.isConnected && 
               mongoose.connection.readyState === 1 &&
               this.performanceMetrics.errorCount < 10; // Threshold for errors
    }

    getConnectionInfo() {
        return {
            isConnected: this.isConnected,
            readyState: mongoose.connection.readyState,
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            name: mongoose.connection.name,
            performanceMetrics: this.performanceMetrics,
            systemHealth: this.getSystemHealth()
        };
    }
}

module.exports = EnhancedDatabaseService;