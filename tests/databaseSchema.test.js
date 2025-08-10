const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Import models
const DiscordServerMapping = require('../src/models/discordServerMapping');
const DiscordAccountLink = require('../src/models/discordAccountLink');
const DiscordTaskPost = require('../src/models/discordTaskPost');
const DiscordAllowlistConnection = require('../src/models/discordAllowlistConnection');
const DiscordInteractionLog = require('../src/models/discordInteractionLog');

// Import services
const EnhancedDatabaseService = require('../src/services/enhancedDatabaseService');
const DataCleanupService = require('../src/services/dataCleanupService');
const MigrationRunner = require('../src/migrations/migrationRunner');

describe('Discord Bot Database Schema', () => {
    let mongoServer;
    let dbService;
    let cleanupService;
    let migrationRunner;

    beforeAll(async () => {
        // Start in-memory MongoDB
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        
        // Connect to test database
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        // Initialize services
        dbService = new EnhancedDatabaseService();
        cleanupService = new DataCleanupService();
        migrationRunner = new MigrationRunner();
    });

    afterAll(async () => {
        await mongoose.connection.close();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        // Clear all collections before each test
        const collections = mongoose.connection.collections;
        for (const key in collections) {
            await collections[key].deleteMany({});
        }
    });

    describe('DiscordServerMapping Model', () => {
        test('should create a server mapping with all required fields', async () => {
            const mappingData = {
                guildId: '123456789',
                communityId: 'community-123',
                linkedBy: 'user-456',
                guildInfo: {
                    name: 'Test Guild',
                    memberCount: 100,
                    ownerId: 'owner-123'
                }
            };

            const mapping = new DiscordServerMapping(mappingData);
            const savedMapping = await mapping.save();

            expect(savedMapping.guildId).toBe(mappingData.guildId);
            expect(savedMapping.communityId).toBe(mappingData.communityId);
            expect(savedMapping.linkedBy).toBe(mappingData.linkedBy);
            expect(savedMapping.isActive).toBe(true);
            expect(savedMapping.guildInfo.name).toBe(mappingData.guildInfo.name);
            expect(savedMapping.activityStats.totalTasksCreated).toBe(0);
            expect(savedMapping.integrationStatus.isHealthy).toBe(true);
        });

        test('should enforce unique guildId constraint', async () => {
            const mappingData = {
                guildId: '123456789',
                communityId: 'community-123',
                linkedBy: 'user-456'
            };

            await new DiscordServerMapping(mappingData).save();

            // Try to create another mapping with same guildId
            const duplicateMapping = new DiscordServerMapping({
                ...mappingData,
                communityId: 'community-456'
            });

            await expect(duplicateMapping.save()).rejects.toThrow();
        });

        test('should update activity stats correctly', async () => {
            const mapping = new DiscordServerMapping({
                guildId: '123456789',
                communityId: 'community-123',
                linkedBy: 'user-456'
            });

            await mapping.save();
            await mapping.incrementTaskCreated();

            expect(mapping.activityStats.totalTasksCreated).toBe(1);
            expect(mapping.activityStats.lastTaskCreated).toBeDefined();
            expect(mapping.activityStats.lastActivity).toBeDefined();
        });

        test('should add audit entries correctly', async () => {
            const mapping = new DiscordServerMapping({
                guildId: '123456789',
                communityId: 'community-123',
                linkedBy: 'user-456'
            });

            await mapping.save();
            await mapping.addAuditEntry('test_action', 'user-123', { test: 'data' });

            expect(mapping.auditLog).toHaveLength(1);
            expect(mapping.auditLog[0].action).toBe('test_action');
            expect(mapping.auditLog[0].performedBy).toBe('user-123');
            expect(mapping.auditLog[0].details.test).toBe('data');
        });
    });

    describe('DiscordAccountLink Model', () => {
        test('should create an account link with encrypted tokens', async () => {
            const linkData = {
                discordId: '987654321',
                nafflesUserId: 'naffles-123',
                discordUserInfo: {
                    username: 'testuser',
                    discriminator: '1234'
                },
                nafflesUserInfo: {
                    username: 'nafflesuser',
                    walletAddress: '0x123...'
                },
                oauthTokens: {
                    accessToken: 'access-token-123',
                    refreshToken: 'refresh-token-456'
                }
            };

            const link = new DiscordAccountLink(linkData);
            const savedLink = await link.save();

            expect(savedLink.discordId).toBe(linkData.discordId);
            expect(savedLink.nafflesUserId).toBe(linkData.nafflesUserId);
            expect(savedLink.status.isActive).toBe(true);
            expect(savedLink.status.isVerified).toBe(false);
            
            // Tokens should be encrypted
            expect(savedLink.oauthTokens.accessToken).not.toBe(linkData.oauthTokens.accessToken);
            expect(savedLink.oauthTokens.refreshToken).not.toBe(linkData.oauthTokens.refreshToken);

            // But should decrypt correctly
            const decryptedTokens = savedLink.getDecryptedTokens();
            expect(decryptedTokens.accessToken).toBe(linkData.oauthTokens.accessToken);
            expect(decryptedTokens.refreshToken).toBe(linkData.oauthTokens.refreshToken);
        });

        test('should enforce unique discordId constraint', async () => {
            const linkData = {
                discordId: '987654321',
                nafflesUserId: 'naffles-123',
                discordUserInfo: { username: 'testuser' },
                nafflesUserInfo: { username: 'nafflesuser' }
            };

            await new DiscordAccountLink(linkData).save();

            // Try to create another link with same discordId
            const duplicateLink = new DiscordAccountLink({
                ...linkData,
                nafflesUserId: 'naffles-456'
            });

            await expect(duplicateLink.save()).rejects.toThrow();
        });

        test('should update activity stats correctly', async () => {
            const link = new DiscordAccountLink({
                discordId: '987654321',
                nafflesUserId: 'naffles-123',
                discordUserInfo: { username: 'testuser' },
                nafflesUserInfo: { username: 'nafflesuser' }
            });

            await link.save();
            await link.incrementTaskCompletion(10);

            expect(link.activityStats.totalTasksCompleted).toBe(1);
            expect(link.activityStats.totalPointsEarned).toBe(10);
            expect(link.activityStats.lastTaskCompletion).toBeDefined();
        });
    });

    describe('DiscordTaskPost Model', () => {
        test('should create a task post with comprehensive data', async () => {
            const taskData = {
                taskId: 'task-123',
                guildId: '123456789',
                channelId: '987654321',
                messageId: '555666777',
                creationData: {
                    createdBy: 'user-123',
                    creationMethod: 'slash_command'
                },
                taskData: {
                    title: 'Test Task',
                    description: 'A test task',
                    type: 'twitter_follow',
                    points: 50
                },
                timing: {
                    endTime: new Date(Date.now() + 86400000) // 24 hours from now
                }
            };

            const post = new DiscordTaskPost(taskData);
            const savedPost = await post.save();

            expect(savedPost.taskId).toBe(taskData.taskId);
            expect(savedPost.guildId).toBe(taskData.guildId);
            expect(savedPost.taskData.title).toBe(taskData.taskData.title);
            expect(savedPost.taskData.status).toBe('active');
            expect(savedPost.lifecycle.isActive).toBe(true);
            expect(savedPost.interactionStats.views).toBe(0);
            expect(savedPost.analytics.conversionRate).toBe(0);
        });

        test('should update interaction stats correctly', async () => {
            const post = new DiscordTaskPost({
                taskId: 'task-123',
                guildId: '123456789',
                channelId: '987654321',
                messageId: '555666777',
                creationData: { createdBy: 'user-123' },
                taskData: { title: 'Test Task', type: 'twitter_follow' }
            });

            await post.save();
            await post.incrementViews('user-456');
            await post.incrementCompletions('user-456', 5000);

            expect(post.interactionStats.views).toBe(1);
            expect(post.interactionStats.uniqueViews).toBe(1);
            expect(post.interactionStats.completions).toBe(1);
            expect(post.interactionStats.averageCompletionTime).toBe(5000);
            expect(post.engagement.viewedByIds).toContain('user-456');
            expect(post.engagement.completedByIds).toContain('user-456');
        });

        test('should handle task expiration correctly', async () => {
            const post = new DiscordTaskPost({
                taskId: 'task-123',
                guildId: '123456789',
                channelId: '987654321',
                messageId: '555666777',
                creationData: { createdBy: 'user-123' },
                taskData: { title: 'Test Task', type: 'twitter_follow' },
                timing: {
                    endTime: new Date(Date.now() - 1000) // 1 second ago
                }
            });

            await post.save();

            expect(post.isExpired()).toBe(true);
            expect(post.getTimeRemaining()).toBe(0);
        });
    });

    describe('DiscordAllowlistConnection Model', () => {
        test('should create an allowlist connection with comprehensive data', async () => {
            const connectionData = {
                allowlistId: 'allowlist-123',
                guildId: '123456789',
                channelId: '987654321',
                messageId: '555666777',
                connectionData: {
                    connectedBy: 'user-123',
                    connectionMethod: 'slash_command'
                },
                allowlistData: {
                    title: 'Test Allowlist',
                    description: 'A test allowlist',
                    prize: 'NFT Collection',
                    winnerCount: 100,
                    entryPrice: { amount: 0, isFree: true }
                },
                timing: {
                    endTime: new Date(Date.now() + 86400000) // 24 hours from now
                }
            };

            const connection = new DiscordAllowlistConnection(connectionData);
            const savedConnection = await connection.save();

            expect(savedConnection.allowlistId).toBe(connectionData.allowlistId);
            expect(savedConnection.guildId).toBe(connectionData.guildId);
            expect(savedConnection.allowlistData.title).toBe(connectionData.allowlistData.title);
            expect(savedConnection.allowlistData.status).toBe('active');
            expect(savedConnection.lifecycle.isActive).toBe(true);
            expect(savedConnection.winnerData.isDrawn).toBe(false);
        });

        test('should handle entry management correctly', async () => {
            const connection = new DiscordAllowlistConnection({
                allowlistId: 'allowlist-123',
                guildId: '123456789',
                channelId: '987654321',
                messageId: '555666777',
                connectionData: { connectedBy: 'user-123' },
                allowlistData: { 
                    title: 'Test Allowlist', 
                    prize: 'NFT', 
                    winnerCount: 10 
                }
            });

            await connection.save();
            
            const entryResult = await connection.addEntry('user-456', 'testuser', { 
                ipAddress: '127.0.0.1' 
            });

            expect(entryResult).toBe(true);
            expect(connection.entryManagement.entryQueue).toHaveLength(1);
            expect(connection.entryManagement.entryQueue[0].userId).toBe('user-456');
            expect(connection.entryManagement.entryQueue[0].status).toBe('pending');
            expect(connection.interactionStats.entries).toBe(1);
        });

        test('should prevent duplicate entries', async () => {
            const connection = new DiscordAllowlistConnection({
                allowlistId: 'allowlist-123',
                guildId: '123456789',
                channelId: '987654321',
                messageId: '555666777',
                connectionData: { connectedBy: 'user-123' },
                allowlistData: { 
                    title: 'Test Allowlist', 
                    prize: 'NFT', 
                    winnerCount: 10 
                }
            });

            await connection.save();
            
            // First entry should succeed
            const firstEntry = await connection.addEntry('user-456', 'testuser');
            expect(firstEntry).toBe(true);
            
            // Second entry should fail
            const secondEntry = await connection.addEntry('user-456', 'testuser');
            expect(secondEntry).toBe(false);
            expect(connection.entryManagement.duplicateAttempts).toHaveLength(1);
        });
    });

    describe('DiscordInteractionLog Model', () => {
        test('should create an interaction log with comprehensive data', async () => {
            const logData = {
                guildId: '123456789',
                channelId: '987654321',
                userId: 'user-456',
                userInfo: {
                    username: 'testuser',
                    discriminator: '1234'
                },
                interaction: {
                    type: 'slash_command',
                    commandName: 'naffles-create-task'
                },
                action: 'command_naffles-create-task',
                result: 'success',
                timing: {
                    responseTime: 150
                }
            };

            const log = await DiscordInteractionLog.logInteraction(logData);

            expect(log.interactionId).toBeDefined();
            expect(log.guildId).toBe(logData.guildId);
            expect(log.userId).toBe(logData.userId);
            expect(log.action).toBe(logData.action);
            expect(log.result).toBe(logData.result);
            expect(log.timing.responseTime).toBe(logData.timing.responseTime);
        });

        test('should generate analytics correctly', async () => {
            // Create multiple log entries
            const baseLogData = {
                guildId: '123456789',
                channelId: '987654321',
                userId: 'user-456',
                userInfo: { username: 'testuser' },
                interaction: { type: 'slash_command', commandName: 'test-command' },
                action: 'test_action',
                timing: { responseTime: 100 }
            };

            await DiscordInteractionLog.logInteraction({ ...baseLogData, result: 'success' });
            await DiscordInteractionLog.logInteraction({ ...baseLogData, result: 'success' });
            await DiscordInteractionLog.logInteraction({ ...baseLogData, result: 'error' });

            const stats = await DiscordInteractionLog.getGuildStats('123456789', 1);
            
            expect(stats).toHaveLength(1);
            expect(stats[0]._id).toBe('test_action');
            expect(stats[0].totalCount).toBe(3);
            expect(stats[0].results).toHaveLength(2); // success and error
        });
    });

    describe('Enhanced Database Service', () => {
        test('should create server mapping with enhanced data', async () => {
            const guildData = {
                id: '123456789',
                name: 'Test Guild',
                memberCount: 100,
                ownerId: 'owner-123'
            };

            const mapping = await dbService.createServerMapping(
                guildData, 
                'community-123', 
                'user-456',
                { 
                    botConfig: { 
                        autoPostTasks: true 
                    } 
                }
            );

            expect(mapping.guildId).toBe(guildData.id);
            expect(mapping.communityId).toBe('community-123');
            expect(mapping.guildInfo.name).toBe(guildData.name);
            expect(mapping.botConfig.autoPostTasks).toBe(true);
            expect(mapping.auditLog).toHaveLength(1);
            expect(mapping.auditLog[0].action).toBe('created');
        });

        test('should create account link with enhanced security', async () => {
            const discordUser = {
                id: '987654321',
                username: 'testuser',
                discriminator: '1234',
                verified: true
            };

            const nafflesUser = {
                id: 'naffles-123',
                username: 'nafflesuser',
                walletAddress: '0x123...'
            };

            const link = await dbService.createAccountLink(
                discordUser,
                nafflesUser,
                'oauth',
                {
                    ipAddress: '127.0.0.1',
                    userAgent: 'Test Agent',
                    dataProcessingConsent: true
                }
            );

            expect(link.discordId).toBe(discordUser.id);
            expect(link.nafflesUserId).toBe(nafflesUser.id);
            expect(link.permissions.dataProcessingConsent).toBe(true);
            expect(link.permissions.consentTimestamp).toBeDefined();
            expect(link.auditLog).toHaveLength(1);
        });

        test('should get platform analytics', async () => {
            // Create some test data
            await new DiscordServerMapping({
                guildId: '123456789',
                communityId: 'community-123',
                linkedBy: 'user-456'
            }).save();

            await new DiscordAccountLink({
                discordId: '987654321',
                nafflesUserId: 'naffles-123',
                discordUserInfo: { username: 'testuser' },
                nafflesUserInfo: { username: 'nafflesuser' }
            }).save();

            const analytics = await dbService.getPlatformAnalytics(30);

            expect(analytics.totalServers).toBe(1);
            expect(analytics.totalAccountLinks).toBe(1);
            expect(analytics.generatedAt).toBeDefined();
            expect(analytics.systemHealth).toBeDefined();
        });
    });

    describe('Data Cleanup Service', () => {
        test('should clean up expired tokens', async () => {
            // Create account with expired token
            const link = new DiscordAccountLink({
                discordId: '987654321',
                nafflesUserId: 'naffles-123',
                discordUserInfo: { username: 'testuser' },
                nafflesUserInfo: { username: 'nafflesuser' },
                linkingData: {
                    verificationToken: 'expired-token',
                    tokenExpiresAt: new Date(Date.now() - 1000) // 1 second ago
                },
                status: { isVerified: false }
            });

            await link.save();

            const result = await cleanupService.cleanupExpiredTokens();

            expect(result.processed).toBe(1);
            expect(result.deleted).toBe(1);

            // Verify token was removed
            const updatedLink = await DiscordAccountLink.findById(link._id);
            expect(updatedLink.linkingData.verificationToken).toBeUndefined();
        });

        test('should clean up expired tasks', async () => {
            // Create expired task
            const task = new DiscordTaskPost({
                taskId: 'task-123',
                guildId: '123456789',
                channelId: '987654321',
                messageId: '555666777',
                creationData: { createdBy: 'user-123' },
                taskData: { 
                    title: 'Expired Task', 
                    type: 'twitter_follow',
                    status: 'active'
                },
                timing: {
                    endTime: new Date(Date.now() - 1000) // 1 second ago
                }
            });

            await task.save();

            const result = await cleanupService.cleanupExpiredTasks();

            expect(result.expired).toBe(1);

            // Verify task was marked as expired
            const updatedTask = await DiscordTaskPost.findById(task._id);
            expect(updatedTask.taskData.status).toBe('expired');
        });

        test('should get data summary', async () => {
            // Create some test data
            await new DiscordServerMapping({
                guildId: '123456789',
                communityId: 'community-123',
                linkedBy: 'user-456'
            }).save();

            await new DiscordAccountLink({
                discordId: '987654321',
                nafflesUserId: 'naffles-123',
                discordUserInfo: { username: 'testuser' },
                nafflesUserInfo: { username: 'nafflesuser' }
            }).save();

            const summary = await cleanupService.getDataSummary();

            expect(summary.servers.total).toBe(1);
            expect(summary.servers.active).toBe(1);
            expect(summary.accounts.total).toBe(1);
            expect(summary.accounts.active).toBe(1);
            expect(summary.generatedAt).toBeDefined();
        });
    });

    describe('Migration Runner', () => {
        test('should initialize migration runner', async () => {
            await migrationRunner.initialize();
            
            expect(migrationRunner.migrations.size).toBeGreaterThan(0);
        });

        test('should validate migrations', async () => {
            await migrationRunner.initialize();
            
            const validation = await migrationRunner.validateMigrations();
            
            expect(validation.isValid).toBe(true);
            expect(validation.issues).toHaveLength(0);
        });

        test('should get migration status', async () => {
            await migrationRunner.initialize();
            
            const status = await migrationRunner.getStatus();
            
            expect(status.totalMigrations).toBeGreaterThan(0);
            expect(status.appliedCount).toBeGreaterThanOrEqual(0);
            expect(status.pendingCount).toBeGreaterThanOrEqual(0);
            expect(Array.isArray(status.applied)).toBe(true);
            expect(Array.isArray(status.pending)).toBe(true);
        });
    });
});