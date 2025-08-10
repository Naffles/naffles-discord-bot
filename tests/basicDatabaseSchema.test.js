const mongoose = require('mongoose');

// Import models
const DiscordServerMapping = require('../src/models/discordServerMapping');
const DiscordAccountLink = require('../src/models/discordAccountLink');
const DiscordTaskPost = require('../src/models/discordTaskPost');
const DiscordAllowlistConnection = require('../src/models/discordAllowlistConnection');
const DiscordInteractionLog = require('../src/models/discordInteractionLog');

describe('Discord Bot Database Schema - Basic Tests', () => {
    describe('Model Definitions', () => {
        test('DiscordServerMapping model should be defined', () => {
            expect(DiscordServerMapping).toBeDefined();
            expect(DiscordServerMapping.modelName).toBe('DiscordServerMapping');
        });

        test('DiscordAccountLink model should be defined', () => {
            expect(DiscordAccountLink).toBeDefined();
            expect(DiscordAccountLink.modelName).toBe('DiscordAccountLink');
        });

        test('DiscordTaskPost model should be defined', () => {
            expect(DiscordTaskPost).toBeDefined();
            expect(DiscordTaskPost.modelName).toBe('DiscordTaskPost');
        });

        test('DiscordAllowlistConnection model should be defined', () => {
            expect(DiscordAllowlistConnection).toBeDefined();
            expect(DiscordAllowlistConnection.modelName).toBe('DiscordAllowlistConnection');
        });

        test('DiscordInteractionLog model should be defined', () => {
            expect(DiscordInteractionLog).toBeDefined();
            expect(DiscordInteractionLog.modelName).toBe('DiscordInteractionLog');
        });
    });

    describe('Schema Validation', () => {
        test('DiscordServerMapping should have required fields', () => {
            const schema = DiscordServerMapping.schema;
            
            expect(schema.paths.guildId).toBeDefined();
            expect(schema.paths.guildId.isRequired).toBe(true);
            expect(schema.paths.communityId).toBeDefined();
            expect(schema.paths.communityId.isRequired).toBe(true);
            expect(schema.paths.linkedBy).toBeDefined();
            expect(schema.paths.linkedBy.isRequired).toBe(true);
        });

        test('DiscordAccountLink should have required fields', () => {
            const schema = DiscordAccountLink.schema;
            
            expect(schema.paths.discordId).toBeDefined();
            expect(schema.paths.discordId.isRequired).toBe(true);
            expect(schema.paths.nafflesUserId).toBeDefined();
            expect(schema.paths.nafflesUserId.isRequired).toBe(true);
        });

        test('DiscordTaskPost should have required fields', () => {
            const schema = DiscordTaskPost.schema;
            
            expect(schema.paths.taskId).toBeDefined();
            expect(schema.paths.taskId.isRequired).toBe(true);
            expect(schema.paths.guildId).toBeDefined();
            expect(schema.paths.guildId.isRequired).toBe(true);
            expect(schema.paths.messageId).toBeDefined();
            expect(schema.paths.messageId.isRequired).toBe(true);
        });

        test('DiscordAllowlistConnection should have required fields', () => {
            const schema = DiscordAllowlistConnection.schema;
            
            expect(schema.paths.allowlistId).toBeDefined();
            expect(schema.paths.allowlistId.isRequired).toBe(true);
            expect(schema.paths.guildId).toBeDefined();
            expect(schema.paths.guildId.isRequired).toBe(true);
            expect(schema.paths.messageId).toBeDefined();
            expect(schema.paths.messageId.isRequired).toBe(true);
        });

        test('DiscordInteractionLog should have required fields', () => {
            const schema = DiscordInteractionLog.schema;
            
            expect(schema.paths.guildId).toBeDefined();
            expect(schema.paths.guildId.isRequired).toBe(true);
            expect(schema.paths.userId).toBeDefined();
            expect(schema.paths.userId.isRequired).toBe(true);
            expect(schema.paths.action).toBeDefined();
            expect(schema.paths.action.isRequired).toBe(true);
        });
    });

    describe('Model Methods', () => {
        test('DiscordServerMapping should have static methods', () => {
            expect(typeof DiscordServerMapping.findByGuild).toBe('function');
            expect(typeof DiscordServerMapping.findByCommunity).toBe('function');
            expect(typeof DiscordServerMapping.getActiveCount).toBe('function');
        });

        test('DiscordAccountLink should have static methods', () => {
            expect(typeof DiscordAccountLink.findByDiscord).toBe('function');
            expect(typeof DiscordAccountLink.findByNaffles).toBe('function');
            expect(typeof DiscordAccountLink.getActiveCount).toBe('function');
        });

        test('DiscordTaskPost should have static methods', () => {
            expect(typeof DiscordTaskPost.findByTask).toBe('function');
            expect(typeof DiscordTaskPost.findByGuild).toBe('function');
            expect(typeof DiscordTaskPost.findActiveByGuild).toBe('function');
        });

        test('DiscordAllowlistConnection should have static methods', () => {
            expect(typeof DiscordAllowlistConnection.findByAllowlist).toBe('function');
            expect(typeof DiscordAllowlistConnection.findByGuild).toBe('function');
            expect(typeof DiscordAllowlistConnection.findActiveByGuild).toBe('function');
        });

        test('DiscordInteractionLog should have static methods', () => {
            expect(typeof DiscordInteractionLog.logInteraction).toBe('function');
            expect(typeof DiscordInteractionLog.getGuildStats).toBe('function');
            expect(typeof DiscordInteractionLog.getUserStats).toBe('function');
        });
    });

    describe('Services', () => {
        test('EnhancedDatabaseService should be importable', () => {
            const EnhancedDatabaseService = require('../src/services/enhancedDatabaseService');
            expect(EnhancedDatabaseService).toBeDefined();
            expect(typeof EnhancedDatabaseService).toBe('function');
        });

        test('DataCleanupService should be importable', () => {
            const DataCleanupService = require('../src/services/dataCleanupService');
            expect(DataCleanupService).toBeDefined();
            expect(typeof DataCleanupService).toBe('function');
        });

        test('MigrationRunner should be importable', () => {
            const MigrationRunner = require('../src/migrations/migrationRunner');
            expect(MigrationRunner).toBeDefined();
            expect(typeof MigrationRunner).toBe('function');
        });
    });

    describe('Schema Indexes', () => {
        test('DiscordServerMapping should have proper indexes', () => {
            const indexes = DiscordServerMapping.schema.indexes();
            const indexFields = indexes.map(index => Object.keys(index[0]));
            
            expect(indexFields.some(fields => fields.includes('guildId'))).toBe(true);
            expect(indexFields.some(fields => fields.includes('communityId'))).toBe(true);
            expect(indexFields.some(fields => fields.includes('linkedBy'))).toBe(true);
        });

        test('DiscordAccountLink should have proper indexes', () => {
            const indexes = DiscordAccountLink.schema.indexes();
            const indexFields = indexes.map(index => Object.keys(index[0]));
            
            expect(indexFields.some(fields => fields.includes('discordId'))).toBe(true);
            expect(indexFields.some(fields => fields.includes('nafflesUserId'))).toBe(true);
        });

        test('DiscordTaskPost should have proper indexes', () => {
            const indexes = DiscordTaskPost.schema.indexes();
            const indexFields = indexes.map(index => Object.keys(index[0]));
            
            expect(indexFields.some(fields => fields.includes('taskId'))).toBe(true);
            expect(indexFields.some(fields => fields.includes('guildId'))).toBe(true);
            expect(indexFields.some(fields => fields.includes('messageId'))).toBe(true);
        });
    });
});