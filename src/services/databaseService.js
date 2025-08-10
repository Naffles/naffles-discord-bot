const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Import enhanced database service
const EnhancedDatabaseService = require('./enhancedDatabaseService');
const DataCleanupService = require('./dataCleanupService');
const MigrationRunner = require('../migrations/migrationRunner');

// Import models (legacy support)
const ServerMapping = require('../models/serverMapping');
const AccountLink = require('../models/accountLink');
const TaskPost = require('../models/taskPost');
const InteractionLog = require('../models/interactionLog');

class DatabaseService {
    constructor() {
        this.connection = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = 5000; // 5 seconds
        
        // Enhanced services
        this.enhancedService = new EnhancedDatabaseService();
        this.cleanupService = new DataCleanupService();
        this.migrationRunner = new MigrationRunner();
        this.useEnhancedService = process.env.USE_ENHANCED_DATABASE === 'true';
    }

    async connect() {
        try {
            if (this.useEnhancedService) {
                logger.info('Using enhanced database service...');
                await this.enhancedService.connect();
                
                // Initialize migration runner
                await this.migrationRunner.initialize();
                
                // Run pending migrations
                await this.migrationRunner.migrate();
                
                // Start cleanup service
                this.cleanupService.start(60); // Run every hour
                
                this.isConnected = this.enhancedService.isConnected;
                return;
            }

            // Legacy connection method
            logger.info('Connecting to MongoDB...');

            const options = {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
                bufferMaxEntries: 0,
                bufferCommands: false
            };

            this.connection = await mongoose.connect(process.env.MONGODB_URI, options);
            this.isConnected = true;
            this.reconnectAttempts = 0;

            logger.info('MongoDB connected successfully');

            // Set up connection event listeners
            this.setupConnectionListeners();

            // Initialize indexes
            await this.initializeIndexes();

        } catch (error) {
            logger.error('Failed to connect to MongoDB:', error);
            await this.handleReconnection();
        }
    }

    setupConnectionListeners() {
        mongoose.connection.on('connected', () => {
            logger.info('MongoDB connection established');
            this.isConnected = true;
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB connection lost');
            this.isConnected = false;
            this.handleReconnection();
        });

        mongoose.connection.on('error', (error) => {
            logger.error('MongoDB connection error:', error);
            this.isConnected = false;
        });

        mongoose.connection.on('reconnected', () => {
            logger.info('MongoDB reconnected successfully');
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

    async initializeIndexes() {
        try {
            logger.info('Initializing database indexes...');

            // Server mapping indexes
            await ServerMapping.collection.createIndex({ guildId: 1 }, { unique: true });
            await ServerMapping.collection.createIndex({ communityId: 1 });
            await ServerMapping.collection.createIndex({ isActive: 1 });

            // Account link indexes
            await AccountLink.collection.createIndex({ discordUserId: 1 }, { unique: true });
            await AccountLink.collection.createIndex({ nafflesUserId: 1 });
            await AccountLink.collection.createIndex({ isActive: 1 });

            // Task post indexes
            await TaskPost.collection.createIndex({ guildId: 1, taskId: 1 }, { unique: true });
            await TaskPost.collection.createIndex({ messageId: 1 });
            await TaskPost.collection.createIndex({ status: 1 });
            await TaskPost.collection.createIndex({ expiresAt: 1 });

            // Interaction log indexes
            await InteractionLog.collection.createIndex({ guildId: 1, timestamp: -1 });
            await InteractionLog.collection.createIndex({ userId: 1, timestamp: -1 });
            await InteractionLog.collection.createIndex({ action: 1, timestamp: -1 });

            logger.info('Database indexes initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize database indexes:', error);
            throw error;
        }
    }

    async disconnect() {
        try {
            if (this.useEnhancedService) {
                this.cleanupService.stop();
                await this.enhancedService.disconnect();
                this.isConnected = false;
                return;
            }

            // Legacy disconnect method
            if (this.connection) {
                await mongoose.connection.close();
                this.isConnected = false;
                logger.info('MongoDB connection closed');
            }
        } catch (error) {
            logger.error('Error closing MongoDB connection:', error);
        }
    }

    // Server-Community Mapping Methods
    async getServerCommunityMapping(guildId) {
        try {
            const mapping = await ServerMapping.findOne({ guildId, isActive: true });
            return mapping;
        } catch (error) {
            logger.error('Failed to get server community mapping:', error);
            throw error;
        }
    }

    async createServerCommunityMapping(data) {
        try {
            // Deactivate any existing mapping for this guild
            await ServerMapping.updateMany(
                { guildId: data.guildId },
                { isActive: false }
            );

            const mapping = new ServerMapping(data);
            await mapping.save();
            return mapping;
        } catch (error) {
            logger.error('Failed to create server community mapping:', error);
            throw error;
        }
    }

    async updateServerCommunityMapping(guildId, updates) {
        try {
            const mapping = await ServerMapping.findOneAndUpdate(
                { guildId, isActive: true },
                { ...updates, updatedAt: new Date() },
                { new: true }
            );
            return mapping;
        } catch (error) {
            logger.error('Failed to update server community mapping:', error);
            throw error;
        }
    }

    async deleteServerCommunityMapping(guildId) {
        try {
            await ServerMapping.updateMany(
                { guildId },
                { isActive: false, updatedAt: new Date() }
            );
            return true;
        } catch (error) {
            logger.error('Failed to delete server community mapping:', error);
            throw error;
        }
    }

    // Account Linking Methods
    async getAccountLink(discordUserId) {
        try {
            const link = await AccountLink.findOne({ discordUserId, isActive: true });
            return link;
        } catch (error) {
            logger.error('Failed to get account link:', error);
            throw error;
        }
    }

    async createAccountLink(data) {
        try {
            // Deactivate any existing link for this Discord user
            await AccountLink.updateMany(
                { discordUserId: data.discordUserId },
                { isActive: false }
            );

            const link = new AccountLink(data);
            await link.save();
            return link;
        } catch (error) {
            logger.error('Failed to create account link:', error);
            throw error;
        }
    }

    async updateAccountLink(discordUserId, updates) {
        try {
            const link = await AccountLink.findOneAndUpdate(
                { discordUserId, isActive: true },
                { ...updates, updatedAt: new Date() },
                { new: true }
            );
            return link;
        } catch (error) {
            logger.error('Failed to update account link:', error);
            throw error;
        }
    }

    async deleteAccountLink(discordUserId) {
        try {
            await AccountLink.updateMany(
                { discordUserId },
                { isActive: false, updatedAt: new Date() }
            );
            return true;
        } catch (error) {
            logger.error('Failed to delete account link:', error);
            throw error;
        }
    }

    // Task Post Methods
    async getTaskPost(guildId, taskId) {
        try {
            const post = await TaskPost.findOne({ guildId, taskId });
            return post;
        } catch (error) {
            logger.error('Failed to get task post:', error);
            throw error;
        }
    }

    async createTaskPost(data) {
        try {
            const post = new TaskPost(data);
            await post.save();
            return post;
        } catch (error) {
            logger.error('Failed to create task post:', error);
            throw error;
        }
    }

    async updateTaskPost(guildId, taskId, updates) {
        try {
            const post = await TaskPost.findOneAndUpdate(
                { guildId, taskId },
                { ...updates, updatedAt: new Date() },
                { new: true }
            );
            return post;
        } catch (error) {
            logger.error('Failed to update task post:', error);
            throw error;
        }
    }

    async getActiveTaskPosts(guildId) {
        try {
            const posts = await TaskPost.find({
                guildId,
                status: 'active',
                expiresAt: { $gt: new Date() }
            }).sort({ createdAt: -1 });
            return posts;
        } catch (error) {
            logger.error('Failed to get active task posts:', error);
            throw error;
        }
    }

    async expireOldTaskPosts() {
        try {
            const result = await TaskPost.updateMany(
                {
                    status: 'active',
                    expiresAt: { $lte: new Date() }
                },
                {
                    status: 'expired',
                    updatedAt: new Date()
                }
            );

            if (result.modifiedCount > 0) {
                logger.info(`Expired ${result.modifiedCount} old task posts`);
            }

            return result.modifiedCount;
        } catch (error) {
            logger.error('Failed to expire old task posts:', error);
            throw error;
        }
    }

    // Interaction Logging Methods
    async logInteraction(data) {
        try {
            const log = new InteractionLog(data);
            await log.save();
            return log;
        } catch (error) {
            logger.error('Failed to log interaction:', error);
            throw error;
        }
    }

    async getInteractionLogs(filters = {}, limit = 100) {
        try {
            const logs = await InteractionLog.find(filters)
                .sort({ timestamp: -1 })
                .limit(limit);
            return logs;
        } catch (error) {
            logger.error('Failed to get interaction logs:', error);
            throw error;
        }
    }

    async getInteractionStats(guildId, timeRange = 24) {
        try {
            const startTime = new Date(Date.now() - (timeRange * 60 * 60 * 1000));

            const stats = await InteractionLog.aggregate([
                {
                    $match: {
                        guildId,
                        timestamp: { $gte: startTime }
                    }
                },
                {
                    $group: {
                        _id: '$action',
                        count: { $sum: 1 },
                        successCount: {
                            $sum: { $cond: [{ $eq: ['$result', 'success'] }, 1, 0] }
                        }
                    }
                }
            ]);

            return stats;
        } catch (error) {
            logger.error('Failed to get interaction stats:', error);
            throw error;
        }
    }

    // Cleanup Methods
    async cleanupOldLogs(daysToKeep = 30) {
        try {
            const cutoffDate = new Date(Date.now() - (daysToKeep * 24 * 60 * 60 * 1000));

            const result = await InteractionLog.deleteMany({
                timestamp: { $lt: cutoffDate }
            });

            if (result.deletedCount > 0) {
                logger.info(`Cleaned up ${result.deletedCount} old interaction logs`);
            }

            return result.deletedCount;
        } catch (error) {
            logger.error('Failed to cleanup old logs:', error);
            throw error;
        }
    }

    // Enhanced Database Methods
    async createServerMapping(guildData, communityId, linkedBy, additionalData = {}) {
        if (this.useEnhancedService) {
            return await this.enhancedService.createServerMapping(guildData, communityId, linkedBy, additionalData);
        }
        // Fallback to legacy method
        return await this.createServerCommunityMapping({
            guildId: guildData.id,
            communityId,
            linkedBy,
            ...additionalData
        });
    }

    async createAccountLink(discordUser, nafflesUser, linkMethod = 'oauth', additionalData = {}) {
        if (this.useEnhancedService) {
            return await this.enhancedService.createAccountLink(discordUser, nafflesUser, linkMethod, additionalData);
        }
        // Fallback to legacy method
        return await this.createAccountLink({
            discordUserId: discordUser.id,
            nafflesUserId: nafflesUser.id,
            discordUsername: discordUser.username,
            nafflesUsername: nafflesUser.username,
            linkMethod,
            ...additionalData
        });
    }

    async getGuildAnalytics(guildId, days = 30) {
        if (this.useEnhancedService) {
            return await this.enhancedService.getGuildAnalytics(guildId, days);
        }
        // Fallback to basic stats
        return await this.getInteractionStats(guildId, days);
    }

    async getPlatformAnalytics(days = 30) {
        if (this.useEnhancedService) {
            return await this.enhancedService.getPlatformAnalytics(days);
        }
        // Fallback to basic stats
        return {
            message: 'Enhanced analytics not available in legacy mode',
            useEnhancedService: false
        };
    }

    // Migration Methods
    async runMigrations() {
        if (!this.migrationRunner) {
            throw new Error('Migration runner not initialized');
        }
        return await this.migrationRunner.migrate();
    }

    async getMigrationStatus() {
        if (!this.migrationRunner) {
            throw new Error('Migration runner not initialized');
        }
        return await this.migrationRunner.getStatus();
    }

    async rollbackMigration(targetVersion = null) {
        if (!this.migrationRunner) {
            throw new Error('Migration runner not initialized');
        }
        return await this.migrationRunner.rollback(targetVersion);
    }

    // Cleanup Methods
    async performCleanup(options = {}) {
        if (!this.cleanupService) {
            throw new Error('Cleanup service not initialized');
        }
        return await this.cleanupService.performManualCleanup(options);
    }

    getCleanupStats() {
        if (!this.cleanupService) {
            throw new Error('Cleanup service not initialized');
        }
        return this.cleanupService.getStats();
    }

    async getDataSummary() {
        if (!this.cleanupService) {
            throw new Error('Cleanup service not initialized');
        }
        return await this.cleanupService.getDataSummary();
    }

    // Health Check
    isHealthy() {
        if (this.useEnhancedService) {
            return this.enhancedService.isHealthy();
        }
        return this.isConnected && mongoose.connection.readyState === 1;
    }

    getConnectionInfo() {
        if (this.useEnhancedService) {
            return this.enhancedService.getConnectionInfo();
        }
        
        return {
            isConnected: this.isConnected,
            readyState: mongoose.connection.readyState,
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            name: mongoose.connection.name,
            useEnhancedService: this.useEnhancedService
        };
    }

    getSystemHealth() {
        if (this.useEnhancedService) {
            return this.enhancedService.getSystemHealth();
        }
        
        return {
            isConnected: this.isConnected,
            connectionState: mongoose.connection.readyState,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            useEnhancedService: this.useEnhancedService
        };
    }
}

module.exports = DatabaseService;