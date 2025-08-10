const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Import models
const DiscordServerMapping = require('../models/discordServerMapping');
const DiscordAccountLink = require('../models/discordAccountLink');
const DiscordTaskPost = require('../models/discordTaskPost');
const DiscordAllowlistConnection = require('../models/discordAllowlistConnection');
const DiscordInteractionLog = require('../models/discordInteractionLog');

class DataCleanupService {
    constructor() {
        this.cleanupInterval = null;
        this.isRunning = false;
        this.lastCleanup = null;
        this.cleanupStats = {
            totalRuns: 0,
            totalItemsProcessed: 0,
            totalItemsDeleted: 0,
            totalErrors: 0,
            averageRunTime: 0
        };
    }

    start(intervalMinutes = 60) {
        if (this.cleanupInterval) {
            logger.warn('Data cleanup service is already running');
            return;
        }

        logger.info(`Starting data cleanup service with ${intervalMinutes} minute intervals`);
        
        // Run initial cleanup
        this.runCleanup();
        
        // Schedule recurring cleanup
        this.cleanupInterval = setInterval(() => {
            this.runCleanup();
        }, intervalMinutes * 60 * 1000);
    }

    stop() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            logger.info('Data cleanup service stopped');
        }
    }

    async runCleanup() {
        if (this.isRunning) {
            logger.warn('Cleanup already in progress, skipping this run');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();
        
        try {
            logger.info('Starting data cleanup process...');

            const results = await Promise.allSettled([
                this.cleanupInteractionLogs(),
                this.cleanupExpiredTokens(),
                this.cleanupExpiredTasks(),
                this.cleanupExpiredAllowlists(),
                this.cleanupOrphanedRecords(),
                this.cleanupInactiveAccounts(),
                this.archiveOldData(),
                this.optimizeIndexes()
            ]);

            // Process results
            let totalProcessed = 0;
            let totalDeleted = 0;
            let errors = 0;

            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    const stats = result.value;
                    totalProcessed += stats.processed || 0;
                    totalDeleted += stats.deleted || 0;
                } else {
                    errors++;
                    logger.error(`Cleanup task ${index} failed:`, result.reason);
                }
            });

            const runTime = Date.now() - startTime;
            this.updateStats(totalProcessed, totalDeleted, errors, runTime);
            this.lastCleanup = new Date();

            logger.info('Data cleanup completed', {
                runTime: `${runTime}ms`,
                totalProcessed,
                totalDeleted,
                errors
            });

        } catch (error) {
            logger.error('Data cleanup process failed:', error);
            this.cleanupStats.totalErrors++;
        } finally {
            this.isRunning = false;
        }
    }

    async cleanupInteractionLogs() {
        try {
            logger.debug('Cleaning up old interaction logs...');

            // Delete logs older than 90 days
            const cutoffDate = new Date(Date.now() - (90 * 24 * 60 * 60 * 1000));
            const result = await DiscordInteractionLog.deleteMany({
                'timing.timestamp': { $lt: cutoffDate }
            });

            // Archive logs older than 30 days but newer than 90 days
            const archiveCutoffDate = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
            const archiveResult = await DiscordInteractionLog.updateMany(
                {
                    'timing.timestamp': { $lt: archiveCutoffDate, $gte: cutoffDate },
                    'metadata.archived': { $ne: true }
                },
                {
                    $set: { 
                        'metadata.archived': true, 
                        'metadata.archivedAt': new Date() 
                    }
                }
            );

            logger.debug(`Interaction logs cleanup: ${result.deletedCount} deleted, ${archiveResult.modifiedCount} archived`);

            return {
                processed: result.deletedCount + archiveResult.modifiedCount,
                deleted: result.deletedCount,
                archived: archiveResult.modifiedCount
            };

        } catch (error) {
            logger.error('Failed to cleanup interaction logs:', error);
            throw error;
        }
    }

    async cleanupExpiredTokens() {
        try {
            logger.debug('Cleaning up expired verification tokens...');

            const result = await DiscordAccountLink.updateMany(
                {
                    'linkingData.tokenExpiresAt': { $lt: new Date() },
                    'status.isVerified': false,
                    'linkingData.verificationToken': { $exists: true }
                },
                {
                    $unset: {
                        'linkingData.verificationToken': 1,
                        'linkingData.tokenExpiresAt': 1
                    },
                    $push: {
                        auditLog: {
                            action: 'token_expired_cleanup',
                            timestamp: new Date(),
                            performedBy: 'system',
                            details: { reason: 'Automatic cleanup of expired verification token' }
                        }
                    }
                }
            );

            logger.debug(`Expired tokens cleanup: ${result.modifiedCount} tokens removed`);

            return {
                processed: result.modifiedCount,
                deleted: result.modifiedCount
            };

        } catch (error) {
            logger.error('Failed to cleanup expired tokens:', error);
            throw error;
        }
    }

    async cleanupExpiredTasks() {
        try {
            logger.debug('Cleaning up expired tasks...');

            // Update expired active tasks
            const expiredResult = await DiscordTaskPost.updateMany(
                {
                    'taskData.status': 'active',
                    'timing.endTime': { $lte: new Date() },
                    'lifecycle.isActive': true
                },
                {
                    $set: {
                        'taskData.status': 'expired',
                        'lifecycle.lastStatusChange': new Date()
                    },
                    $push: {
                        auditLog: {
                            action: 'auto_expired',
                            timestamp: new Date(),
                            performedBy: 'system',
                            details: { reason: 'Automatic expiration cleanup' }
                        }
                    }
                }
            );

            // Archive very old expired tasks (older than 30 days)
            const archiveCutoffDate = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
            const archiveResult = await DiscordTaskPost.updateMany(
                {
                    'taskData.status': { $in: ['expired', 'completed', 'cancelled'] },
                    'timing.endTime': { $lt: archiveCutoffDate },
                    'lifecycle.isArchived': false
                },
                {
                    $set: {
                        'lifecycle.isArchived': true,
                        'lifecycle.archivedAt': new Date(),
                        'lifecycle.archivedBy': 'system',
                        'lifecycle.archivedReason': 'Automatic archival after 30 days'
                    }
                }
            );

            logger.debug(`Expired tasks cleanup: ${expiredResult.modifiedCount} expired, ${archiveResult.modifiedCount} archived`);

            return {
                processed: expiredResult.modifiedCount + archiveResult.modifiedCount,
                deleted: 0,
                expired: expiredResult.modifiedCount,
                archived: archiveResult.modifiedCount
            };

        } catch (error) {
            logger.error('Failed to cleanup expired tasks:', error);
            throw error;
        }
    }

    async cleanupExpiredAllowlists() {
        try {
            logger.debug('Cleaning up expired allowlists...');

            // Update expired active allowlists
            const expiredResult = await DiscordAllowlistConnection.updateMany(
                {
                    'allowlistData.status': 'active',
                    'timing.endTime': { $lte: new Date() },
                    'lifecycle.isActive': true
                },
                {
                    $set: {
                        'allowlistData.status': 'expired',
                        'lifecycle.lastStatusChange': new Date()
                    },
                    $push: {
                        auditLog: {
                            action: 'auto_expired',
                            timestamp: new Date(),
                            performedBy: 'system',
                            details: { reason: 'Automatic expiration cleanup' }
                        }
                    }
                }
            );

            // Archive very old expired allowlists (older than 60 days)
            const archiveCutoffDate = new Date(Date.now() - (60 * 24 * 60 * 60 * 1000));
            const archiveResult = await DiscordAllowlistConnection.updateMany(
                {
                    'allowlistData.status': { $in: ['expired', 'completed', 'cancelled'] },
                    'timing.endTime': { $lt: archiveCutoffDate },
                    'lifecycle.isArchived': false
                },
                {
                    $set: {
                        'lifecycle.isArchived': true,
                        'lifecycle.archivedAt': new Date(),
                        'lifecycle.archivedBy': 'system',
                        'lifecycle.archivedReason': 'Automatic archival after 60 days'
                    }
                }
            );

            logger.debug(`Expired allowlists cleanup: ${expiredResult.modifiedCount} expired, ${archiveResult.modifiedCount} archived`);

            return {
                processed: expiredResult.modifiedCount + archiveResult.modifiedCount,
                deleted: 0,
                expired: expiredResult.modifiedCount,
                archived: archiveResult.modifiedCount
            };

        } catch (error) {
            logger.error('Failed to cleanup expired allowlists:', error);
            throw error;
        }
    }

    async cleanupOrphanedRecords() {
        try {
            logger.debug('Cleaning up orphaned records...');

            // Get all active guild IDs
            const activeGuildIds = await DiscordServerMapping.distinct('guildId', { isActive: true });

            // Find orphaned task posts
            const orphanedTasks = await DiscordTaskPost.updateMany(
                {
                    guildId: { $nin: activeGuildIds },
                    'lifecycle.isActive': true
                },
                {
                    $set: {
                        'lifecycle.isActive': false,
                        'lifecycle.isArchived': true,
                        'lifecycle.archivedAt': new Date(),
                        'lifecycle.archivedBy': 'system',
                        'lifecycle.archivedReason': 'Orphaned record - guild no longer active'
                    }
                }
            );

            // Find orphaned allowlist connections
            const orphanedAllowlists = await DiscordAllowlistConnection.updateMany(
                {
                    guildId: { $nin: activeGuildIds },
                    'lifecycle.isActive': true
                },
                {
                    $set: {
                        'lifecycle.isActive': false,
                        'lifecycle.isArchived': true,
                        'lifecycle.archivedAt': new Date(),
                        'lifecycle.archivedBy': 'system',
                        'lifecycle.archivedReason': 'Orphaned record - guild no longer active'
                    }
                }
            );

            logger.debug(`Orphaned records cleanup: ${orphanedTasks.modifiedCount} tasks, ${orphanedAllowlists.modifiedCount} allowlists`);

            return {
                processed: orphanedTasks.modifiedCount + orphanedAllowlists.modifiedCount,
                deleted: 0,
                orphanedTasks: orphanedTasks.modifiedCount,
                orphanedAllowlists: orphanedAllowlists.modifiedCount
            };

        } catch (error) {
            logger.error('Failed to cleanup orphaned records:', error);
            throw error;
        }
    }

    async cleanupInactiveAccounts() {
        try {
            logger.debug('Cleaning up inactive accounts...');

            // Mark accounts as inactive if no activity for 180 days
            const inactivityCutoff = new Date(Date.now() - (180 * 24 * 60 * 60 * 1000));
            
            const result = await DiscordAccountLink.updateMany(
                {
                    'status.isActive': true,
                    $or: [
                        { 'activityStats.lastActivity': { $lt: inactivityCutoff } },
                        { 'activityStats.lastActivity': { $exists: false } }
                    ],
                    'linkingData.linkedAt': { $lt: inactivityCutoff }
                },
                {
                    $set: {
                        'status.isActive': false,
                        'status.deactivatedAt': new Date(),
                        'status.deactivationReason': 'Automatic deactivation due to inactivity (180 days)'
                    },
                    $push: {
                        auditLog: {
                            action: 'auto_deactivated',
                            timestamp: new Date(),
                            performedBy: 'system',
                            details: { reason: 'Automatic deactivation due to inactivity' }
                        }
                    }
                }
            );

            logger.debug(`Inactive accounts cleanup: ${result.modifiedCount} accounts deactivated`);

            return {
                processed: result.modifiedCount,
                deleted: 0,
                deactivated: result.modifiedCount
            };

        } catch (error) {
            logger.error('Failed to cleanup inactive accounts:', error);
            throw error;
        }
    }

    async archiveOldData() {
        try {
            logger.debug('Archiving old data...');

            let totalArchived = 0;

            // Archive old server mappings that are inactive for 90 days
            const serverArchiveCutoff = new Date(Date.now() - (90 * 24 * 60 * 60 * 1000));
            const serverResult = await DiscordServerMapping.updateMany(
                {
                    isActive: false,
                    'activityStats.lastActivity': { $lt: serverArchiveCutoff },
                    archived: { $ne: true }
                },
                {
                    $set: {
                        archived: true,
                        archivedAt: new Date(),
                        archivedReason: 'Automatic archival after 90 days of inactivity'
                    }
                }
            );

            totalArchived += serverResult.modifiedCount;

            // Archive old account links that are inactive for 365 days
            const accountArchiveCutoff = new Date(Date.now() - (365 * 24 * 60 * 60 * 1000));
            const accountResult = await DiscordAccountLink.updateMany(
                {
                    'status.isActive': false,
                    'activityStats.lastActivity': { $lt: accountArchiveCutoff },
                    archived: { $ne: true }
                },
                {
                    $set: {
                        archived: true,
                        archivedAt: new Date(),
                        archivedReason: 'Automatic archival after 365 days of inactivity'
                    }
                }
            );

            totalArchived += accountResult.modifiedCount;

            logger.debug(`Data archival: ${totalArchived} records archived`);

            return {
                processed: totalArchived,
                deleted: 0,
                archived: totalArchived
            };

        } catch (error) {
            logger.error('Failed to archive old data:', error);
            throw error;
        }
    }

    async optimizeIndexes() {
        try {
            logger.debug('Optimizing database indexes...');

            const db = mongoose.connection.db;
            const collections = [
                'discordservermappings',
                'discordaccountlinks',
                'discordtaskposts',
                'discordallowlistconnections',
                'discordinteractionlogs'
            ];

            let totalOptimized = 0;

            for (const collectionName of collections) {
                try {
                    // Reindex collection
                    await db.collection(collectionName).reIndex();
                    totalOptimized++;
                } catch (error) {
                    logger.warn(`Failed to reindex collection ${collectionName}:`, error.message);
                }
            }

            logger.debug(`Index optimization: ${totalOptimized} collections reindexed`);

            return {
                processed: totalOptimized,
                deleted: 0,
                optimized: totalOptimized
            };

        } catch (error) {
            logger.error('Failed to optimize indexes:', error);
            throw error;
        }
    }

    updateStats(processed, deleted, errors, runTime) {
        this.cleanupStats.totalRuns++;
        this.cleanupStats.totalItemsProcessed += processed;
        this.cleanupStats.totalItemsDeleted += deleted;
        this.cleanupStats.totalErrors += errors;
        
        // Calculate average run time
        this.cleanupStats.averageRunTime = 
            ((this.cleanupStats.averageRunTime * (this.cleanupStats.totalRuns - 1)) + runTime) / 
            this.cleanupStats.totalRuns;
    }

    getStats() {
        return {
            ...this.cleanupStats,
            isRunning: this.isRunning,
            lastCleanup: this.lastCleanup,
            nextCleanup: this.cleanupInterval ? 
                new Date(Date.now() + (this.cleanupInterval._idleTimeout || 0)) : null
        };
    }

    async getDataSummary() {
        try {
            const [
                totalServers,
                activeServers,
                totalAccounts,
                activeAccounts,
                totalTasks,
                activeTasks,
                totalAllowlists,
                activeAllowlists,
                totalLogs,
                recentLogs
            ] = await Promise.all([
                DiscordServerMapping.countDocuments(),
                DiscordServerMapping.countDocuments({ isActive: true }),
                DiscordAccountLink.countDocuments(),
                DiscordAccountLink.countDocuments({ 'status.isActive': true }),
                DiscordTaskPost.countDocuments(),
                DiscordTaskPost.countDocuments({ 'lifecycle.isActive': true }),
                DiscordAllowlistConnection.countDocuments(),
                DiscordAllowlistConnection.countDocuments({ 'lifecycle.isActive': true }),
                DiscordInteractionLog.countDocuments(),
                DiscordInteractionLog.countDocuments({
                    'timing.timestamp': { $gte: new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)) }
                })
            ]);

            return {
                servers: { total: totalServers, active: activeServers },
                accounts: { total: totalAccounts, active: activeAccounts },
                tasks: { total: totalTasks, active: activeTasks },
                allowlists: { total: totalAllowlists, active: activeAllowlists },
                logs: { total: totalLogs, recent: recentLogs },
                generatedAt: new Date()
            };

        } catch (error) {
            logger.error('Failed to get data summary:', error);
            throw error;
        }
    }

    async performManualCleanup(options = {}) {
        const {
            cleanupLogs = true,
            cleanupTokens = true,
            cleanupExpired = true,
            cleanupOrphaned = true,
            cleanupInactive = true,
            archiveOld = true,
            optimizeIndexes = true
        } = options;

        if (this.isRunning) {
            throw new Error('Cleanup is already in progress');
        }

        const tasks = [];
        
        if (cleanupLogs) tasks.push(this.cleanupInteractionLogs());
        if (cleanupTokens) tasks.push(this.cleanupExpiredTokens());
        if (cleanupExpired) {
            tasks.push(this.cleanupExpiredTasks());
            tasks.push(this.cleanupExpiredAllowlists());
        }
        if (cleanupOrphaned) tasks.push(this.cleanupOrphanedRecords());
        if (cleanupInactive) tasks.push(this.cleanupInactiveAccounts());
        if (archiveOld) tasks.push(this.archiveOldData());
        if (optimizeIndexes) tasks.push(this.optimizeIndexes());

        this.isRunning = true;
        const startTime = Date.now();

        try {
            const results = await Promise.allSettled(tasks);
            
            let totalProcessed = 0;
            let totalDeleted = 0;
            let errors = 0;
            const details = {};

            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    const stats = result.value;
                    totalProcessed += stats.processed || 0;
                    totalDeleted += stats.deleted || 0;
                    details[`task_${index}`] = stats;
                } else {
                    errors++;
                    details[`task_${index}_error`] = result.reason.message;
                }
            });

            const runTime = Date.now() - startTime;
            
            return {
                success: true,
                runTime,
                totalProcessed,
                totalDeleted,
                errors,
                details
            };

        } catch (error) {
            logger.error('Manual cleanup failed:', error);
            throw error;
        } finally {
            this.isRunning = false;
        }
    }
}

module.exports = DataCleanupService;