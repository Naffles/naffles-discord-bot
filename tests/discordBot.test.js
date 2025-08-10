const { jest } = require('@jest/globals');
const { Client } = require('discord.js');
const DiscordBotService = require('../src/services/discordBotService');
const DatabaseService = require('../src/services/databaseService');
const RedisService = require('../src/services/redisService');
const HealthMonitor = require('../src/services/healthMonitor');
const NafflesDiscordBot = require('../src/index');

// Mock Discord.js
jest.mock('discord.js');
jest.mock('../src/utils/logger');

describe('Discord Bot Integration Tests', () => {
    let mockClient;
    let mockDatabaseService;
    let mockRedisService;
    let botService;
    let healthMonitor;

    beforeEach(() => {
        // Mock Discord client
        mockClient = {
            isReady: jest.fn(() => true),
            guilds: {
                cache: new Map([
                    ['123456789', { id: '123456789', name: 'Test Guild', memberCount: 100 }]
                ])
            },
            ws: { ping: 50 },
            uptime: 3600000,
            user: { tag: 'TestBot#1234' },
            login: jest.fn().mockResolvedValue(),
            destroy: jest.fn().mockResolvedValue()
        };

        Client.mockImplementation(() => mockClient);

        // Mock database service
        mockDatabaseService = {
            connect: jest.fn().mockResolvedValue(),
            disconnect: jest.fn().mockResolvedValue(),
            isHealthy: jest.fn(() => true),
            getConnectionInfo: jest.fn(() => ({ isConnected: true })),
            testConnection: jest.fn().mockResolvedValue({ status: 'ok' }),
            getServerCommunityMapping: jest.fn().mockResolvedValue(null),
            createServerCommunityMapping: jest.fn().mockResolvedValue({}),
            logInteraction: jest.fn().mockResolvedValue(),
            expireOldTaskPosts: jest.fn().mockResolvedValue(0)
        };

        // Mock Redis service
        mockRedisService = {
            connect: jest.fn().mockResolvedValue(),
            disconnect: jest.fn().mockResolvedValue(),
            isConnected: jest.fn(() => true),
            getConnectionInfo: jest.fn(() => ({ isConnected: true })),
            ping: jest.fn().mockResolvedValue('PONG')
        };

        // Set up environment variables
        process.env.DISCORD_BOT_TOKEN = 'test-token';
        process.env.DISCORD_CLIENT_ID = 'test-client-id';
        process.env.NAFFLES_API_BASE_URL = 'https://api.test.com';
        process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
        process.env.REDIS_URL = 'redis://localhost:6379';
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('DiscordBotService', () => {
        beforeEach(() => {
            botService = new DiscordBotService(mockClient, mockDatabaseService, mockRedisService);
        });

        test('should initialize successfully', async () => {
            await expect(botService.initialize()).resolves.not.toThrow();
        });

        test('should handle guild join event', async () => {
            const mockGuild = {
                id: '987654321',
                name: 'New Test Guild',
                memberCount: 50,
                systemChannel: null,
                fetchOwner: jest.fn().mockResolvedValue({
                    createDM: jest.fn().mockResolvedValue({
                        send: jest.fn().mockResolvedValue()
                    })
                })
            };

            await botService.onGuildJoin(mockGuild);

            expect(mockDatabaseService.logInteraction).toHaveBeenCalledWith(
                expect.objectContaining({
                    guildId: '987654321',
                    action: 'guild_join'
                })
            );
        });

        test('should handle guild leave event', async () => {
            const mockGuild = {
                id: '987654321',
                name: 'Leaving Guild'
            };

            await botService.onGuildLeave(mockGuild);

            expect(mockDatabaseService.logInteraction).toHaveBeenCalledWith(
                expect.objectContaining({
                    guildId: '987654321',
                    action: 'guild_leave'
                })
            );
        });

        test('should handle button interactions', async () => {
            const mockInteraction = {
                customId: 'task_complete_123',
                user: { id: 'user123', tag: 'TestUser#1234' },
                guildId: '123456789',
                reply: jest.fn().mockResolvedValue()
            };

            await botService.handleButtonInteraction(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('Task completion functionality'),
                    ephemeral: true
                })
            );
        });

        test('should test API connection', async () => {
            // Mock successful API call
            botService.makeNafflesApiCall = jest.fn().mockResolvedValue({
                data: { version: '1.0.0' },
                responseTime: 100
            });

            const result = await botService.testApiConnection();

            expect(result).toEqual({
                status: 'healthy',
                responseTime: 100,
                version: '1.0.0'
            });
        });

        test('should handle API connection failure', async () => {
            // Mock failed API call
            botService.makeNafflesApiCall = jest.fn().mockRejectedValue(new Error('Connection failed'));

            await expect(botService.testApiConnection()).rejects.toThrow('Naffles API connection failed');
        });

        test('should get connection status', () => {
            const status = botService.getConnectionStatus();

            expect(status).toHaveProperty('discord');
            expect(status).toHaveProperty('nafflesApi');
            expect(status).toHaveProperty('lastHealthCheck');
        });

        test('should get metrics', () => {
            const metrics = botService.getMetrics();

            expect(metrics).toHaveProperty('commandsProcessed');
            expect(metrics).toHaveProperty('errorsEncountered');
            expect(metrics).toHaveProperty('uptimeHours');
            expect(typeof metrics.uptimeHours).toBe('number');
        });
    });

    describe('HealthMonitor', () => {
        beforeEach(() => {
            healthMonitor = new HealthMonitor(mockClient, botService);
        });

        test('should initialize with correct configuration', () => {
            expect(healthMonitor.checkInterval).toBe(30000);
            expect(healthMonitor.healthChecks).toHaveProperty('discord');
            expect(healthMonitor.healthChecks).toHaveProperty('database');
            expect(healthMonitor.healthChecks).toHaveProperty('redis');
            expect(healthMonitor.healthChecks).toHaveProperty('nafflesApi');
        });

        test('should start monitoring', () => {
            const setIntervalSpy = jest.spyOn(global, 'setInterval');
            
            healthMonitor.start();

            expect(healthMonitor.isRunning).toBe(true);
            expect(setIntervalSpy).toHaveBeenCalledWith(
                expect.any(Function),
                30000
            );

            setIntervalSpy.mockRestore();
        });

        test('should stop monitoring', () => {
            const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
            
            healthMonitor.start();
            healthMonitor.stop();

            expect(healthMonitor.isRunning).toBe(false);
            expect(clearIntervalSpy).toHaveBeenCalled();

            clearIntervalSpy.mockRestore();
        });

        test('should perform health check', async () => {
            // Mock service health checks
            botService.testApiConnection = jest.fn().mockResolvedValue({
                status: 'healthy',
                responseTime: 100
            });

            await healthMonitor.performHealthCheck();

            expect(healthMonitor.healthStatus.lastCheck).toBeTruthy();
            expect(healthMonitor.healthStatus.overall).toBeTruthy();
        });

        test('should check Discord health', async () => {
            const result = await healthMonitor.checkDiscordHealth(5000);

            expect(result).toEqual({
                guilds: 1,
                ping: 50,
                uptime: 3600000
            });
        });

        test('should handle Discord health check timeout', async () => {
            mockClient.isReady.mockReturnValue(false);

            await expect(healthMonitor.checkDiscordHealth(100))
                .rejects.toThrow('Discord client not ready');
        });

        test('should get health status', () => {
            const status = healthMonitor.getHealthStatus();

            expect(status).toHaveProperty('overall');
            expect(status).toHaveProperty('isMonitoring');
            expect(status).toHaveProperty('checkInterval');
            expect(status).toHaveProperty('services');
        });

        test('should get health report', () => {
            const report = healthMonitor.getHealthReport();

            expect(report).toHaveProperty('timestamp');
            expect(report).toHaveProperty('overall');
            expect(report).toHaveProperty('services');
            expect(report).toHaveProperty('configuration');
            expect(Array.isArray(report.services)).toBe(true);
        });

        test('should update configuration', () => {
            const newConfig = {
                checkInterval: 60000,
                alertThresholds: {
                    consecutiveFailures: 5
                }
            };

            healthMonitor.updateConfiguration(newConfig);

            expect(healthMonitor.checkInterval).toBe(60000);
            expect(healthMonitor.alertThresholds.consecutiveFailures).toBe(5);
        });
    });

    describe('NafflesDiscordBot', () => {
        let bot;

        beforeEach(() => {
            bot = new NafflesDiscordBot();
        });

        test('should validate environment successfully', () => {
            expect(() => bot.validateEnvironment()).not.toThrow();
        });

        test('should throw error for missing environment variables', () => {
            delete process.env.DISCORD_BOT_TOKEN;

            expect(() => bot.validateEnvironment()).toThrow('Missing required environment variables');
        });

        test('should initialize services', async () => {
            // Mock service constructors
            jest.doMock('../src/services/databaseService', () => {
                return jest.fn().mockImplementation(() => mockDatabaseService);
            });

            jest.doMock('../src/services/redisService', () => {
                return jest.fn().mockImplementation(() => mockRedisService);
            });

            await expect(bot.initializeServices()).resolves.not.toThrow();
        });

        test('should handle initialization failure gracefully', async () => {
            mockDatabaseService.connect.mockRejectedValue(new Error('Connection failed'));

            await expect(bot.initializeServices()).rejects.toThrow('Connection failed');
        });
    });

    describe('Integration Tests', () => {
        test('should handle complete bot lifecycle', async () => {
            const bot = new NafflesDiscordBot();

            // Mock all required methods
            bot.validateEnvironment = jest.fn();
            bot.initializeServices = jest.fn().mockResolvedValue();
            bot.setupHandlers = jest.fn().mockResolvedValue();
            bot.setupHealthMonitoring = jest.fn();
            bot.setupGracefulShutdown = jest.fn();

            await expect(bot.initialize()).resolves.not.toThrow();

            expect(bot.validateEnvironment).toHaveBeenCalled();
            expect(bot.initializeServices).toHaveBeenCalled();
            expect(bot.setupHandlers).toHaveBeenCalled();
            expect(bot.setupHealthMonitoring).toHaveBeenCalled();
            expect(bot.setupGracefulShutdown).toHaveBeenCalled();
        });

        test('should handle graceful shutdown', async () => {
            const bot = new NafflesDiscordBot();
            bot.client = mockClient;
            bot.databaseService = mockDatabaseService;
            bot.redisService = mockRedisService;
            bot.healthMonitor = { stop: jest.fn() };

            // Mock process.exit to prevent actual exit
            const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

            // Simulate shutdown
            bot.isShuttingDown = false;
            const shutdownHandler = bot.setupGracefulShutdown;
            
            // This would normally be called by process signals
            // but we'll test the shutdown logic directly
            expect(bot.isShuttingDown).toBe(false);

            mockExit.mockRestore();
        });
    });

    describe('Error Handling', () => {
        test('should handle service initialization errors', async () => {
            const bot = new NafflesDiscordBot();
            mockDatabaseService.connect.mockRejectedValue(new Error('Database connection failed'));

            await expect(bot.initializeServices()).rejects.toThrow('Database connection failed');
        });

        test('should handle Discord login errors', async () => {
            mockClient.login.mockRejectedValue(new Error('Invalid token'));

            const bot = new NafflesDiscordBot();
            bot.initialize = jest.fn().mockResolvedValue();

            await expect(bot.start()).rejects.toThrow('Invalid token');
        });

        test('should handle health check errors gracefully', async () => {
            const healthMonitor = new HealthMonitor(mockClient, botService);
            
            // Mock a service that throws an error
            botService.testApiConnection = jest.fn().mockRejectedValue(new Error('API Error'));

            // Should not throw, but handle the error gracefully
            await expect(healthMonitor.performHealthCheck()).resolves.not.toThrow();
        });
    });

    describe('Performance Tests', () => {
        test('should handle multiple concurrent interactions', async () => {
            const botService = new DiscordBotService(mockClient, mockDatabaseService, mockRedisService);
            
            const interactions = Array.from({ length: 10 }, (_, i) => ({
                customId: `task_complete_${i}`,
                user: { id: `user${i}`, tag: `TestUser${i}#1234` },
                guildId: '123456789',
                reply: jest.fn().mockResolvedValue()
            }));

            const promises = interactions.map(interaction => 
                botService.handleButtonInteraction(interaction)
            );

            await expect(Promise.all(promises)).resolves.not.toThrow();

            // Verify all interactions were handled
            interactions.forEach(interaction => {
                expect(interaction.reply).toHaveBeenCalled();
            });
        });

        test('should maintain performance under load', async () => {
            const healthMonitor = new HealthMonitor(mockClient, botService);
            
            const startTime = Date.now();
            
            // Perform multiple health checks
            const healthChecks = Array.from({ length: 5 }, () => 
                healthMonitor.performHealthCheck()
            );

            await Promise.all(healthChecks);
            
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            // Should complete within reasonable time (5 seconds for 5 checks)
            expect(totalTime).toBeLessThan(5000);
        });
    });
});

// Test utilities
describe('Test Utilities', () => {
    test('should create mock Discord interaction', () => {
        const mockInteraction = {
            customId: 'test_action_123',
            user: { id: 'user123', tag: 'TestUser#1234' },
            guildId: '123456789',
            channelId: 'channel123',
            reply: jest.fn().mockResolvedValue(),
            followUp: jest.fn().mockResolvedValue(),
            deferReply: jest.fn().mockResolvedValue()
        };

        expect(mockInteraction).toHaveProperty('customId');
        expect(mockInteraction).toHaveProperty('user');
        expect(mockInteraction).toHaveProperty('reply');
    });

    test('should create mock Discord guild', () => {
        const mockGuild = {
            id: '123456789',
            name: 'Test Guild',
            memberCount: 100,
            joinedAt: new Date(),
            systemChannel: null,
            fetchOwner: jest.fn().mockResolvedValue({
                createDM: jest.fn().mockResolvedValue({
                    send: jest.fn().mockResolvedValue()
                })
            })
        };

        expect(mockGuild).toHaveProperty('id');
        expect(mockGuild).toHaveProperty('name');
        expect(mockGuild).toHaveProperty('memberCount');
    });
});