const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Migration: Initial Discord Bot Database Schema
 * Version: 1.0.0
 * Description: Creates initial collections and indexes for Discord bot database
 */

const migration = {
    version: '1.0.0',
    description: 'Initial Discord bot database schema setup',
    
    async up() {
        try {
            logger.info('Running migration: Initial Discord bot database schema');

            const db = mongoose.connection.db;

            // Create collections if they don't exist
            const collections = [
                'discordservermappings',
                'discordaccountlinks', 
                'discordtaskposts',
                'discordallowlistconnections',
                'discordinteractionlogs'
            ];

            for (const collectionName of collections) {
                const exists = await db.listCollections({ name: collectionName }).hasNext();
                if (!exists) {
                    await db.createCollection(collectionName);
                    logger.info(`Created collection: ${collectionName}`);
                }
            }

            // Create basic indexes
            await this.createBasicIndexes(db);

            // Set up TTL indexes
            await this.createTTLIndexes(db);

            // Create text indexes for search
            await this.createTextIndexes(db);

            logger.info('Initial schema migration completed successfully');
            
        } catch (error) {
            logger.error('Initial schema migration failed:', error);
            throw error;
        }
    },

    async down() {
        try {
            logger.info('Rolling back migration: Initial Discord bot database schema');

            const db = mongoose.connection.db;

            // Drop collections (be careful with this in production)
            const collections = [
                'discordservermappings',
                'discordaccountlinks', 
                'discordtaskposts',
                'discordallowlistconnections',
                'discordinteractionlogs'
            ];

            for (const collectionName of collections) {
                const exists = await db.listCollections({ name: collectionName }).hasNext();
                if (exists) {
                    await db.collection(collectionName).drop();
                    logger.info(`Dropped collection: ${collectionName}`);
                }
            }

            logger.info('Initial schema migration rollback completed');
            
        } catch (error) {
            logger.error('Initial schema migration rollback failed:', error);
            throw error;
        }
    },

    async createBasicIndexes(db) {
        try {
            // Discord Server Mapping indexes
            await db.collection('discordservermappings').createIndex({ guildId: 1 }, { unique: true });
            await db.collection('discordservermappings').createIndex({ communityId: 1, isActive: 1 });
            await db.collection('discordservermappings').createIndex({ linkedBy: 1, linkedAt: -1 });
            await db.collection('discordservermappings').createIndex({ isActive: 1 });

            // Discord Account Link indexes
            await db.collection('discordaccountlinks').createIndex({ discordId: 1 }, { unique: true });
            await db.collection('discordaccountlinks').createIndex({ nafflesUserId: 1 });
            await db.collection('discordaccountlinks').createIndex({ 'status.isActive': 1 });
            await db.collection('discordaccountlinks').createIndex({ 'linkingData.linkedAt': -1 });

            // Discord Task Post indexes
            await db.collection('discordtaskposts').createIndex({ taskId: 1, guildId: 1 });
            await db.collection('discordtaskposts').createIndex({ messageId: 1 }, { unique: true });
            await db.collection('discordtaskposts').createIndex({ guildId: 1, 'taskData.status': 1 });
            await db.collection('discordtaskposts').createIndex({ 'lifecycle.isActive': 1 });

            // Discord Allowlist Connection indexes
            await db.collection('discordallowlistconnections').createIndex({ allowlistId: 1, guildId: 1 });
            await db.collection('discordallowlistconnections').createIndex({ messageId: 1 }, { unique: true });
            await db.collection('discordallowlistconnections').createIndex({ guildId: 1, 'allowlistData.status': 1 });
            await db.collection('discordallowlistconnections').createIndex({ 'lifecycle.isActive': 1 });

            // Discord Interaction Log indexes
            await db.collection('discordinteractionlogs').createIndex({ interactionId: 1 }, { unique: true });
            await db.collection('discordinteractionlogs').createIndex({ guildId: 1, 'timing.timestamp': -1 });
            await db.collection('discordinteractionlogs').createIndex({ userId: 1, 'timing.timestamp': -1 });
            await db.collection('discordinteractionlogs').createIndex({ 'interaction.type': 1, 'timing.timestamp': -1 });

            logger.info('Basic indexes created successfully');
        } catch (error) {
            logger.error('Failed to create basic indexes:', error);
            throw error;
        }
    },

    async createTTLIndexes(db) {
        try {
            // TTL index for interaction logs (90 days)
            await db.collection('discordinteractionlogs').createIndex(
                { 'timing.timestamp': 1 }, 
                { expireAfterSeconds: 90 * 24 * 60 * 60 }
            );

            // TTL index for expired verification tokens
            await db.collection('discordaccountlinks').createIndex(
                { 'linkingData.tokenExpiresAt': 1 }, 
                { 
                    expireAfterSeconds: 0,
                    partialFilterExpression: { 
                        'linkingData.verificationToken': { $exists: true },
                        'status.isVerified': false
                    }
                }
            );

            // TTL index for expired tasks (90 days after expiration)
            await db.collection('discordtaskposts').createIndex(
                { 'timing.endTime': 1 }, 
                { 
                    expireAfterSeconds: 90 * 24 * 60 * 60,
                    partialFilterExpression: { 
                        'taskData.status': { $in: ['expired', 'completed', 'cancelled'] }
                    }
                }
            );

            // TTL index for expired allowlists (180 days after expiration)
            await db.collection('discordallowlistconnections').createIndex(
                { 'timing.endTime': 1 }, 
                { 
                    expireAfterSeconds: 180 * 24 * 60 * 60,
                    partialFilterExpression: { 
                        'allowlistData.status': { $in: ['expired', 'completed', 'cancelled'] }
                    }
                }
            );

            logger.info('TTL indexes created successfully');
        } catch (error) {
            logger.error('Failed to create TTL indexes:', error);
            throw error;
        }
    },

    async createTextIndexes(db) {
        try {
            // Text search index for task posts
            await db.collection('discordtaskposts').createIndex({
                'taskData.title': 'text',
                'taskData.description': 'text',
                'taskData.category': 'text'
            });

            // Text search index for allowlist connections
            await db.collection('discordallowlistconnections').createIndex({
                'allowlistData.title': 'text',
                'allowlistData.description': 'text',
                'allowlistData.prize': 'text',
                'allowlistData.category': 'text'
            });

            // Text search index for interaction logs
            await db.collection('discordinteractionlogs').createIndex({
                'userInfo.username': 'text',
                'interaction.commandName': 'text',
                action: 'text',
                'error.errorMessage': 'text'
            });

            logger.info('Text indexes created successfully');
        } catch (error) {
            logger.error('Failed to create text indexes:', error);
            throw error;
        }
    }
};

module.exports = migration;