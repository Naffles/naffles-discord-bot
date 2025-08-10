const PermissionManager = require('../src/services/permissionManager');
const SecurityMonitor = require('../src/services/securityMonitor');
const AuditLogger = require('../src/services/auditLogger');
const SecurityReporter = require('../src/services/securityReporter');

// Mock Discord.js and other dependencies
jest.mock('discord.js', () => ({
    EmbedBuilder: jest.fn().mockImplementation(() => ({
        setTitle: jest.fn().mockReturnThis(),
        setDescription: jest.fn().mockReturnThis(),
        setColor: jest.fn().mockReturnThis(),
        setTimestamp: jest.fn().mockReturnThis(),
        addFields: jest.fn().mockReturnThis(),
        setFooter: jest.fn().mockReturnThis()
    })),
    ActionRowBuilder: jest.fn().mockImplementation(() => ({
        addComponents: jest.fn().mockReturnThis()
    })),
    ButtonBuilder: jest.fn().mockImplementation(() => ({
        setCustomId: jest.fn().mockReturnThis(),
        setLabel: jest.fn().mockReturnThis(),
        setStyle: jest.fn().mockReturnThis(),
        setEmoji: jest.fn().mockReturnThis()
    })),
    ButtonStyle: {
        Primary: 1,
        Secondary: 2
    }
}));

// Mock logger
jest.mock('../src/utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    security: jest.fn(),
    audit: jest.fn()
}));

describe('Security System', () => {
    let mockBotService;
    let permissionManager;
    let securityMonitor;
    let auditLogger;
    let securityReporter;

    beforeEach(() => {
        mockBotService = {
            client: {
                guilds: {
                    cache: new Map()
                }
            },
            db: {
                logAuditEvent: jest.fn(),
                logSecurityEvent: jest.fn()
            },
            rateLimiter: {
                checkRateLimit: jest.fn().mockReturnValue({ allowed: true, remaining: 10 })
            }
        };

        permissionManager = new PermissionManager(mockBotService);
        securityMonitor = new SecurityMonitor(mockBotService);
        auditLogger = new AuditLogger(mockBotService);
        securityReporter = new SecurityReporter(mockBotService);

        // Add services to mock bot service
        mockBotService.permissionManager = permissionManager;
        mockBotService.securityMonitor = securityMonitor;
        mockBotService.auditLogger = auditLogger;
        mockBotService.securityReporter = securityReporter;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('PermissionManager', () => {
        test('should initialize with default permissions', () => {
            expect(permissionManager.defaultPermissions).toBeDefined();
            expect(permissionManager.defaultPermissions['naffles-create-task']).toBeDefined();
            expect(permissionManager.defaultPermissions['naffles-security']).toBeDefined();
        });

        test('should check command permissions correctly', async () => {
            const mockInteraction = {
                guildId: 'test-guild',
                user: {
                    id: 'test-user',
                    bot: false,
                    createdTimestamp: Date.now() - (30 * 24 * 60 * 60 * 1000), // 30 days old
                    tag: 'TestUser#1234'
                },
                member: {
                    permissions: {
                        has: jest.fn().mockReturnValue(true)
                    },
                    roles: {
                        cache: new Map()
                    },
                    guild: {
                        ownerId: 'owner-id'
                    }
                }
            };

            const result = await permissionManager.checkCommandPermission(mockInteraction, 'naffles-create-task');
            expect(result.allowed).toBe(true);
        });

        test('should deny permission for bot accounts', async () => {
            const mockInteraction = {
                guildId: 'test-guild',
                user: {
                    id: 'bot-user',
                    bot: true,
                    tag: 'BotUser#0000'
                },
                member: {}
            };

            const result = await permissionManager.checkCommandPermission(mockInteraction, 'naffles-create-task');
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('Bots cannot use commands');
        });

        test('should deny permission for new accounts', async () => {
            const mockInteraction = {
                guildId: 'test-guild',
                user: {
                    id: 'new-user',
                    bot: false,
                    createdTimestamp: Date.now() - (2 * 24 * 60 * 60 * 1000), // 2 days old
                    tag: 'NewUser#1234'
                },
                member: {}
            };

            const result = await permissionManager.checkCommandPermission(mockInteraction, 'naffles-create-task');
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('Account must be at least 7 days old to use commands');
        });

        test('should check admin permissions for admin-only commands', async () => {
            const mockInteraction = {
                guildId: 'test-guild',
                user: {
                    id: 'regular-user',
                    bot: false,
                    createdTimestamp: Date.now() - (30 * 24 * 60 * 60 * 1000),
                    tag: 'RegularUser#1234'
                },
                member: {
                    permissions: {
                        has: jest.fn().mockReturnValue(false)
                    },
                    roles: {
                        cache: new Map()
                    },
                    guild: {
                        ownerId: 'owner-id'
                    }
                }
            };

            const result = await permissionManager.checkCommandPermission(mockInteraction, 'naffles-security');
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('This command requires administrator permissions');
        });
    });

    describe('SecurityMonitor', () => {
        test('should initialize with default thresholds', () => {
            expect(securityMonitor.alertThresholds).toBeDefined();
            expect(securityMonitor.eventTypes).toBeDefined();
        });

        test('should track command usage', async () => {
            const mockInteraction = {
                user: { id: 'test-user' },
                guildId: 'test-guild',
                commandName: 'naffles-create-task'
            };

            await securityMonitor.monitorCommandExecution(mockInteraction, 'success');
            
            const userData = securityMonitor.suspiciousActivity.get('commands_test-user_test-guild');
            expect(userData).toBeDefined();
            expect(userData.commands).toHaveLength(1);
        });

        test('should detect rapid command usage', async () => {
            const mockInteraction = {
                user: { id: 'rapid-user' },
                guildId: 'test-guild',
                commandName: 'naffles-create-task'
            };

            // Simulate rapid commands
            for (let i = 0; i < 12; i++) {
                await securityMonitor.monitorCommandExecution(mockInteraction, 'success');
            }

            // Check if security event was created
            const events = securityMonitor.getRecentSecurityEvents(10);
            const rapidCommandEvent = events.find(e => e.type === 'rapid_commands');
            expect(rapidCommandEvent).toBeDefined();
        });

        test('should monitor member joins for mass join attacks', async () => {
            const mockMember = {
                user: {
                    id: 'new-member',
                    tag: 'NewMember#1234',
                    createdTimestamp: Date.now() - (1 * 24 * 60 * 60 * 1000) // 1 day old
                },
                guild: {
                    id: 'test-guild'
                }
            };

            // Simulate mass joins
            for (let i = 0; i < 12; i++) {
                mockMember.user.id = `new-member-${i}`;
                await securityMonitor.monitorMemberJoin(mockMember);
            }

            const events = securityMonitor.getRecentSecurityEvents(10);
            const massJoinEvent = events.find(e => e.type === 'mass_joins');
            expect(massJoinEvent).toBeDefined();
        });

        test('should get security statistics', () => {
            const stats = securityMonitor.getSecurityStatistics();
            expect(stats).toHaveProperty('totalEvents');
            expect(stats).toHaveProperty('recentEvents');
            expect(stats).toHaveProperty('eventsByType');
            expect(stats).toHaveProperty('suspiciousUsers');
        });
    });

    describe('AuditLogger', () => {
        test('should initialize with event types', () => {
            expect(auditLogger.eventTypes).toBeDefined();
            expect(auditLogger.eventTypes.COMMAND_EXECUTED).toBe('command_executed');
        });

        test('should log command execution', async () => {
            const mockInteraction = {
                user: {
                    id: 'test-user',
                    tag: 'TestUser#1234',
                    createdTimestamp: Date.now() - (30 * 24 * 60 * 60 * 1000)
                },
                guildId: 'test-guild',
                guild: { name: 'Test Guild' },
                channelId: 'test-channel',
                commandName: 'naffles-create-task',
                options: { data: [] },
                member: {
                    joinedTimestamp: Date.now() - (10 * 24 * 60 * 60 * 1000),
                    roles: { cache: new Map() },
                    permissions: { toArray: () => ['SendMessages'] }
                }
            };

            await auditLogger.logCommandExecution(mockInteraction, 'success');
            
            expect(auditLogger.auditLogs).toHaveLength(1);
            expect(auditLogger.auditLogs[0].type).toBe('command_executed');
            expect(auditLogger.auditLogs[0].userId).toBe('test-user');
        });

        test('should log permission checks', async () => {
            const mockInteraction = {
                user: {
                    id: 'test-user',
                    tag: 'TestUser#1234',
                    createdTimestamp: Date.now() - (30 * 24 * 60 * 60 * 1000)
                },
                guildId: 'test-guild',
                guild: { name: 'Test Guild' },
                commandName: 'naffles-create-task',
                member: {
                    joinedTimestamp: Date.now() - (10 * 24 * 60 * 60 * 1000),
                    roles: { cache: new Map() },
                    permissions: { toArray: () => ['SendMessages'] }
                }
            };

            await auditLogger.logPermissionCheck(mockInteraction, 'granted', 'Permission granted');
            
            expect(auditLogger.auditLogs).toHaveLength(1);
            expect(auditLogger.auditLogs[0].type).toBe('permission_granted');
        });

        test('should get audit statistics', () => {
            const stats = auditLogger.getAuditStatistics();
            expect(stats).toHaveProperty('totalLogs');
            expect(stats).toHaveProperty('recentLogs');
            expect(stats).toHaveProperty('logsByType');
        });

        test('should filter audit logs', async () => {
            // Add some test logs
            await auditLogger.createAuditLog({
                type: 'command_executed',
                userId: 'user1',
                guildId: 'guild1',
                timestamp: new Date()
            });

            await auditLogger.createAuditLog({
                type: 'permission_denied',
                userId: 'user2',
                guildId: 'guild1',
                timestamp: new Date()
            });

            const commandLogs = auditLogger.getAuditLogs({ type: 'command_executed' });
            expect(commandLogs).toHaveLength(1);
            expect(commandLogs[0].type).toBe('command_executed');

            const guildLogs = auditLogger.getAuditLogs({ guildId: 'guild1' });
            expect(guildLogs).toHaveLength(2);
        });
    });

    describe('SecurityReporter', () => {
        test('should initialize with empty reports', () => {
            expect(securityReporter.reports).toHaveLength(0);
            expect(securityReporter.alertChannels).toBeDefined();
        });

        test('should generate security report', async () => {
            // Add some mock data
            mockBotService.securityMonitor.getSecurityStatistics = jest.fn().mockReturnValue({
                totalEvents: 10,
                recentEvents: 2,
                dailyEvents: 5,
                suspiciousUsers: 1,
                eventsByType: { 'rapid_commands': 3 },
                eventsBySeverity: { 'medium': 2 }
            });

            mockBotService.auditLogger.getAuditStatistics = jest.fn().mockReturnValue({
                totalLogs: 50,
                recentLogs: 10,
                dailyLogs: 25,
                uniqueUsers: 5,
                uniqueGuilds: 2
            });

            mockBotService.securityMonitor.getRecentSecurityEvents = jest.fn().mockReturnValue([
                {
                    type: 'rapid_commands',
                    severity: 'medium',
                    userId: 'test-user',
                    guildId: 'test-guild',
                    timestamp: Date.now()
                }
            ]);

            mockBotService.auditLogger.getAuditLogs = jest.fn().mockReturnValue([
                {
                    type: 'command_executed',
                    userId: 'test-user',
                    guildId: 'test-guild',
                    timestamp: new Date()
                }
            ]);

            const report = await securityReporter.generateSecurityReport('day', 'test-guild');
            
            expect(report).toBeDefined();
            expect(report.summary).toBeDefined();
            expect(report.threatAnalysis).toBeDefined();
            expect(report.recommendations).toBeDefined();
            expect(securityReporter.reports).toHaveLength(1);
        });

        test('should configure alert channels', () => {
            securityReporter.setAlertChannel('test-guild', 'test-channel');
            expect(securityReporter.alertChannels.get('test-guild')).toBe('test-channel');

            securityReporter.removeAlertChannel('test-guild');
            expect(securityReporter.alertChannels.has('test-guild')).toBe(false);
        });

        test('should format security alerts', () => {
            const alert = {
                type: 'test_alert',
                severity: 'medium',
                description: 'Test alert description',
                details: { test: 'data' }
            };

            const embed = securityReporter.formatSecurityAlert(alert);
            expect(embed).toBeDefined();
        });
    });

    describe('Integration Tests', () => {
        test('should handle complete security workflow', async () => {
            const mockInteraction = {
                user: {
                    id: 'test-user',
                    bot: false,
                    createdTimestamp: Date.now() - (30 * 24 * 60 * 60 * 1000),
                    tag: 'TestUser#1234'
                },
                guildId: 'test-guild',
                guild: { name: 'Test Guild' },
                channelId: 'test-channel',
                commandName: 'naffles-create-task',
                options: { data: [] },
                member: {
                    permissions: { has: jest.fn().mockReturnValue(true) },
                    roles: { cache: new Map() },
                    guild: { ownerId: 'owner-id' },
                    joinedTimestamp: Date.now() - (10 * 24 * 60 * 60 * 1000)
                }
            };

            // 1. Check permissions
            const permissionResult = await permissionManager.checkCommandPermission(
                mockInteraction, 
                'naffles-create-task'
            );
            expect(permissionResult.allowed).toBe(true);

            // 2. Log command execution
            await auditLogger.logCommandExecution(mockInteraction, 'success');
            expect(auditLogger.auditLogs).toHaveLength(1);

            // 3. Monitor for security
            await securityMonitor.monitorCommandExecution(mockInteraction, 'success');
            const userData = securityMonitor.suspiciousActivity.get('commands_test-user_test-guild');
            expect(userData).toBeDefined();

            // 4. Generate security report
            const report = await securityReporter.generateSecurityReport('day', 'test-guild');
            expect(report).toBeDefined();
        });

        test('should handle security violations', async () => {
            const mockInteraction = {
                user: {
                    id: 'malicious-user',
                    bot: false,
                    createdTimestamp: Date.now() - (30 * 24 * 60 * 60 * 1000),
                    tag: 'MaliciousUser#1234'
                },
                guildId: 'test-guild',
                guild: { name: 'Test Guild' },
                commandName: 'naffles-create-task',
                member: {
                    permissions: { has: jest.fn().mockReturnValue(true) },
                    roles: { cache: new Map() },
                    guild: { ownerId: 'owner-id' }
                }
            };

            // Simulate rapid command usage (security violation)
            for (let i = 0; i < 12; i++) {
                await securityMonitor.monitorCommandExecution(mockInteraction, 'success');
            }

            // Check if security event was created
            const events = securityMonitor.getRecentSecurityEvents(10);
            const rapidCommandEvent = events.find(e => e.type === 'rapid_commands');
            expect(rapidCommandEvent).toBeDefined();
            expect(rapidCommandEvent.severity).toBe('medium');

            // Log the security event
            await auditLogger.logSecurityEvent(rapidCommandEvent);
            const securityLogs = auditLogger.getAuditLogs({ type: 'security_event' });
            expect(securityLogs).toHaveLength(1);
        });
    });
});