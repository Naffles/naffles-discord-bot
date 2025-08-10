/**
 * Performance Tests for Discord Bot Integration
 * Tests handling of multiple concurrent Discord interactions and load scenarios
 */

const { jest } = require('@jest/globals');
const axios = require('axios');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

// Import mock Discord client
const { MockDiscordClient } = require('./mockDiscordClient');

// Mock axios
jest.mock('axios');

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
const CommandHandler = require('../src/handlers/commandHandler');
const ButtonHandler = require('../src/handlers/buttonHandler');
const HealthMonitor = require('../src/services/healthMonitor');

describe('Discord Bot Performance Tests', () => {
    let mongoServer;
    let mockClient;
    let databaseService;
    let redisService;
    let botService;
    let commandHandler;
    let buttonHandler;
    let healthMonitor;

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
        axios.mockClear();

        // Create mock Discord client
        mockClient = new MockDiscordClient();

        // Initialize services
        databaseService = new DatabaseService();
        redisService = new RedisService();

        // Mock Redis connection with performance tracking
        redisService.connect = jest.fn().mockResolvedValue();
        redisService.disconnect = jest.fn().mockResolvedValue();
        redisService.isConnected = jest.fn(() => true);
        redisService.ping = jest.fn().mockResolvedValue('PONG');
        redisService.get = jest.fn().mockImplementation(async (key) => {
            // Simulate Redis latency
            await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
            return null;
        });
        redisService.set = jest.fn().mockImplementation(async (key, value, ttl) => {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
            return 'OK';
        });
        redisService.del = jest.fn().mockResolvedValue(1);
        redisService.incr = jest.fn().mockResolvedValue(1);
        redisService.expire = jest.fn().mockResolvedValue(1);

        // Connect to test database
        await databaseService.connect();
        await redisService.connect();

        // Initialize bot service
        botService = new DiscordBotService(mockClient, databaseService, redisService);
        await botService.initialize();

        // Initialize handlers
        commandHandler = new CommandHandler(botService);
        buttonHandler = new ButtonHandler(botService);
        healthMonitor = new HealthMonitor(mockClient, botService);

        // Set up mock guild with many users
        const mockGuild = mockClient.addMockGuild({
            id: '123456789',
            name: 'Performance Test Guild',
            ownerId: 'owner123',
            memberCount: 1000,
            channels: [
                { id: 'channel123', name: 'general', type: 0 },
                { id: 'channel456', name: 'tasks', type: 0 },
                { id: 'channel789', name: 'allowlists', type: 0 }
            ]
        });

        // Add many mock users
        for (let i = 1; i <= 100; i++) {
            mockClient.addMockUser({
                id: `user${i}`,
                username: `TestUser${i}`,
                discriminator: String(i).padStart(4, '0'),
                createdTimestamp: Date.now() - (30 * 24 * 60 * 60 * 1000)
            });
        }

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

    describe('Concurrent Command Execution', () => {
        test('should handle 50 concurrent create-task commands', async () => {
            // Mock successful API responses
            axios.mockResolvedValue({
                data: {
                    success: true,
                    data: {
                        taskId: 'concurrent-task-123',
                        title: 'Concurrent Task',
                        type: 'twitter_follow',
                        points: 100,
                        communityId: 'community123'
                    }
                },
                status: 201
            });

            const startTime = Date.now();
            
            // Create 50 concurrent interactions
            const interactions = Array.from({ length: 50 }, (_, i) => 
                mockClient.simulateInteractionCreate({
                    commandName: 'naffles-create-task',
                    guildId: '123456789',
                    channelId: 'channel123',
                    user: mockClient.users.cache.get(`user${(i % 100) + 1}`),
                    options: {
                        type: 'twitter_follow',
                        title: `Concurrent Task ${i + 1}`,
                        description: `Description for task ${i + 1}`,
                        points: 100,
                        duration: 168
                    }
                })
            );

            // Execute all commands concurrently
            const promises = interactions.map(interaction => 
                commandHandler.handleSlashCommand(interaction)
            );

            await Promise.all(promises);
            
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            // Performance assertions
            expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
            
            // Verify all interactions were handled
            interactions.forEach(interaction => {
                expect(interaction.deferReply).toHaveBeenCalled();
                expect(interaction.editReply).toHaveBeenCalled();
            });

            // Verify API calls were made
            expect(axios).toHaveBeenCalledTimes(50);

            console.log(`50 concurrent create-task commands completed in ${totalTime}ms`);
        });

        test('should handle 100 concurrent list-tasks commands', async () => {
            // Mock API response with tasks
            axios.mockResolvedValue({
                data: {
                    success: true,
                    data: {
                        tasks: Array.from({ length: 10 }, (_, i) => ({
                            id: `task${i + 1}`,
                            title: `Task ${i + 1}`,
                            type: 'twitter_follow',
                            points: 100,
                            status: 'active',
                            completions: Math.floor(Math.random() * 50)
                        }))
                    }
                },
                status: 200
            });

            const startTime = Date.now();
            
            // Create 100 concurrent interactions
            const interactions = Array.from({ length: 100 }, (_, i) => 
                mockClient.simulateInteractionCreate({
                    commandName: 'naffles-list-tasks',
                    guildId: '123456789',
                    user: mockClient.users.cache.get(`user${(i % 100) + 1}`)
                })
            );

            const promises = interactions.map(interaction => 
                commandHandler.handleSlashCommand(interaction)
            );

            await Promise.all(promises);
            
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            expect(totalTime).toBeLessThan(8000); // Should complete within 8 seconds
            
            interactions.forEach(interaction => {
                expect(interaction.deferReply).toHaveBeenCalled();
                expect(interaction.editReply).toHaveBeenCalled();
            });

            console.log(`100 concurrent list-tasks commands completed in ${totalTime}ms`);
        });

        test('should handle mixed command types concurrently', async () => {
            // Mock different API responses
            axios.mockImplementation((config) => {
                if (config.url.includes('/social-tasks') && config.method === 'POST') {
                    return Promise.resolve({
                        data: { success: true, data: { taskId: 'mixed-task-123' } },
                        status: 201
                    });
                } else if (config.url.includes('/social-tasks') && config.method === 'GET') {
                    return Promise.resolve({
                        data: { success: true, data: { tasks: [] } },
                        status: 200
                    });
                } else if (config.url.includes('/allowlists')) {
                    return Promise.resolve({
                        data: { 
                            success: true, 
                            data: { 
                                allowlist: { 
                                    id: 'mixed-allowlist-123',
                                    title: 'Mixed Test Allowlist'
                                } 
                            } 
                        },
                        status: 200
                    });
                }
                return Promise.reject(new Error('Unknown endpoint'));
            });

            const commandTypes = [
                'naffles-create-task',
                'naffles-list-tasks',
                'naffles-connect-allowlist'
            ];

            const startTime = Date.now();
            
            // Create 60 mixed interactions (20 of each type)
            const interactions = Array.from({ length: 60 }, (_, i) => {
                const commandType = commandTypes[i % 3];
                const baseInteraction = {
                    commandName: commandType,
                    guildId: '123456789',
                    channelId: 'channel123',
                    user: mockClient.users.cache.get(`user${(i % 100) + 1}`)
                };

                if (commandType === 'naffles-create-task') {
                    baseInteraction.options = {
                        type: 'twitter_follow',
                        title: `Mixed Task ${i + 1}`,
                        description: 'Mixed test description',
                        points: 100
                    };
                } else if (commandType === 'naffles-connect-allowlist') {
                    baseInteraction.options = {
                        allowlist_id: 'mixed-allowlist-123'
                    };
                }

                return mockClient.simulateInteractionCreate(baseInteraction);
            });

            const promises = interactions.map(interaction => 
                commandHandler.handleSlashCommand(interaction)
            );

            await Promise.all(promises);
            
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            expect(totalTime).toBeLessThan(12000); // Should complete within 12 seconds
            
            console.log(`60 mixed concurrent commands completed in ${totalTime}ms`);
        });
    });

    describe('High-Frequency Button Interactions', () => {
        test('should handle 200 concurrent button clicks', async () => {
            // Set up task posts for button interactions
            const taskIds = Array.from({ length: 20 }, (_, i) => `task${i + 1}`);
            for (const taskId of taskIds) {
                await databaseService.createTaskPost({
                    taskId,
                    serverId: '123456789',
                    channelId: 'channel123',
                    messageId: `message-${taskId}`,
                    createdBy: 'user1'
                });
            }

            // Mock successful completion responses
            axios.mockResolvedValue({
                data: {
                    success: true,
                    data: {
                        completed: true,
                        points: 100,
                        message: 'Task completed successfully!'
                    }
                },
                status: 200
            });

            const startTime = Date.now();
            
            // Create 200 concurrent button interactions (10 users per task)
            const interactions = Array.from({ length: 200 }, (_, i) => 
                mockClient.simulateInteractionCreate({
                    type: 3, // MESSAGE_COMPONENT
                    customId: `task_complete_${taskIds[i % 20]}`,
                    guildId: '123456789',
                    user: mockClient.users.cache.get(`user${(i % 100) + 1}`)
                })
            );

            const promises = interactions.map(interaction => 
                buttonHandler.handleButtonInteraction(interaction)
            );

            await Promise.all(promises);
            
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            expect(totalTime).toBeLessThan(15000); // Should complete within 15 seconds
            
            interactions.forEach(interaction => {
                expect(interaction.deferReply).toHaveBeenCalled();
            });

            console.log(`200 concurrent button clicks completed in ${totalTime}ms`);
        });

        test('should handle rapid sequential button clicks from single user', async () => {
            // Set up multiple task posts
            const taskIds = Array.from({ length: 50 }, (_, i) => `rapid-task${i + 1}`);
            for (const taskId of taskIds) {
                await databaseService.createTaskPost({
                    taskId,
                    serverId: '123456789',
                    channelId: 'channel123',
                    messageId: `message-${taskId}`,
                    createdBy: 'user1'
                });
            }

            axios.mockResolvedValue({
                data: {
                    success: true,
                    data: { completed: true, points: 100 }
                },
                status: 200
            });

            const startTime = Date.now();
            const user = mockClient.users.cache.get('user1');
            
            // Create rapid sequential interactions
            const promises = taskIds.map((taskId, i) => {
                return new Promise(resolve => {
                    setTimeout(async () => {
                        const interaction = mockClient.simulateInteractionCreate({
                            type: 3,
                            customId: `task_complete_${taskId}`,
                            guildId: '123456789',
                            user
                        });
                        
                        await buttonHandler.handleButtonInteraction(interaction);
                        resolve();
                    }, i * 10); // 10ms intervals
                });
            });

            await Promise.all(promises);
            
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            expect(totalTime).toBeLessThan(3000); // Should complete within 3 seconds
            
            console.log(`50 rapid sequential button clicks completed in ${totalTime}ms`);
        });
    });

    describe('Database Performance Under Load', () => {
        test('should handle concurrent database operations efficiently', async () => {
            const startTime = Date.now();
            
            // Create 100 concurrent database operations
            const operations = Array.from({ length: 100 }, (_, i) => {
                const operationType = i % 4;
                
                switch (operationType) {
                    case 0: // Create task post
                        return databaseService.createTaskPost({
                            taskId: `perf-task-${i}`,
                            serverId: '123456789',
                            channelId: 'channel123',
                            messageId: `message-${i}`,
                            createdBy: `user${(i % 100) + 1}`
                        });
                    
                    case 1: // Create account link
                        return databaseService.createAccountLink({
                            discordUserId: `user${i}`,
                            nafflesUserId: `naffles${i}`,
                            accessToken: `token${i}`,
                            refreshToken: `refresh${i}`
                        });
                    
                    case 2: // Log interaction
                        return databaseService.logInteraction({
                            userId: `user${(i % 100) + 1}`,
                            guildId: '123456789',
                            action: 'performance_test',
                            success: true,
                            details: { testIndex: i }
                        });
                    
                    case 3: // Create allowlist connection
                        return databaseService.createAllowlistConnection({
                            allowlistId: `allowlist${i}`,
                            serverId: '123456789',
                            channelId: 'channel123',
                            messageId: `allowlist-message-${i}`,
                            createdBy: `user${(i % 100) + 1}`
                        });
                }
            });

            await Promise.all(operations);
            
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
            
            // Verify data was created
            const taskPosts = await databaseService.getTaskPost('perf-task-0', '123456789');
            expect(taskPosts).toBeTruthy();

            console.log(`100 concurrent database operations completed in ${totalTime}ms`);
        });

        test('should maintain performance with large datasets', async () => {
            // Create a large dataset first
            const setupStart = Date.now();
            
            const setupOperations = Array.from({ length: 1000 }, (_, i) => 
                databaseService.logInteraction({
                    userId: `user${(i % 100) + 1}`,
                    guildId: '123456789',
                    action: 'setup_data',
                    success: true,
                    details: { index: i }
                })
            );

            await Promise.all(setupOperations);
            
            const setupEnd = Date.now();
            console.log(`Setup 1000 records in ${setupEnd - setupStart}ms`);

            // Now test query performance
            const queryStart = Date.now();
            
            const queries = Array.from({ length: 50 }, (_, i) => 
                databaseService.getInteractionLogs({
                    userId: `user${(i % 100) + 1}`,
                    limit: 10
                })
            );

            const results = await Promise.all(queries);
            
            const queryEnd = Date.now();
            const queryTime = queryEnd - queryStart;

            expect(queryTime).toBeLessThan(2000); // Should complete within 2 seconds
            expect(results).toHaveLength(50);
            
            console.log(`50 concurrent queries on large dataset completed in ${queryTime}ms`);
        });
    });

    describe('Redis Performance and Caching', () => {
        test('should handle high-frequency cache operations', async () => {
            const startTime = Date.now();
            
            // Create 500 concurrent cache operations
            const operations = Array.from({ length: 500 }, (_, i) => {
                const operationType = i % 3;
                const key = `perf:test:${i}`;
                const value = JSON.stringify({ index: i, data: `test-data-${i}` });
                
                switch (operationType) {
                    case 0: // Set operation
                        return redisService.set(key, value, 300);
                    case 1: // Get operation
                        return redisService.get(key);
                    case 2: // Delete operation
                        return redisService.del(key);
                }
            });

            await Promise.all(operations);
            
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            expect(totalTime).toBeLessThan(3000); // Should complete within 3 seconds
            
            console.log(`500 concurrent Redis operations completed in ${totalTime}ms`);
        });

        test('should efficiently handle rate limiting checks', async () => {
            const startTime = Date.now();
            
            // Simulate 200 rate limit checks
            const rateLimitChecks = Array.from({ length: 200 }, (_, i) => {
                const userId = `user${(i % 50) + 1}`;
                const key = `rate_limit:${userId}:123456789`;
                
                return redisService.incr(key).then(() => 
                    redisService.expire(key, 60)
                );
            });

            await Promise.all(rateLimitChecks);
            
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            expect(totalTime).toBeLessThan(1500); // Should complete within 1.5 seconds
            
            console.log(`200 rate limit checks completed in ${totalTime}ms`);
        });
    });

    describe('Memory Usage and Resource Management', () => {
        test('should maintain stable memory usage under load', async () => {
            const initialMemory = process.memoryUsage();
            
            // Create a large number of interactions
            const interactions = Array.from({ length: 500 }, (_, i) => 
                mockClient.simulateInteractionCreate({
                    commandName: 'naffles-list-tasks',
                    guildId: '123456789',
                    user: mockClient.users.cache.get(`user${(i % 100) + 1}`)
                })
            );

            // Mock API response
            axios.mockResolvedValue({
                data: { success: true, data: { tasks: [] } },
                status: 200
            });

            // Process all interactions
            const promises = interactions.map(interaction => 
                commandHandler.handleSlashCommand(interaction)
            );

            await Promise.all(promises);
            
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }

            const finalMemory = process.memoryUsage();
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
            const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

            // Memory increase should be reasonable (less than 100MB)
            expect(memoryIncreaseMB).toBeLessThan(100);
            
            console.log(`Memory increase after 500 interactions: ${memoryIncreaseMB.toFixed(2)}MB`);
        });

        test('should clean up resources properly', async () => {
            const resourcesBefore = {
                eventListeners: mockClient.listenerCount(),
                timers: process._getActiveHandles().length,
                connections: mongoose.connection.readyState
            };

            // Create and process many interactions
            const interactions = Array.from({ length: 100 }, (_, i) => 
                mockClient.simulateInteractionCreate({
                    commandName: 'naffles-create-task',
                    guildId: '123456789',
                    user: mockClient.users.cache.get(`user${(i % 100) + 1}`),
                    options: {
                        type: 'twitter_follow',
                        title: `Cleanup Test ${i}`,
                        description: 'Testing resource cleanup',
                        points: 100
                    }
                })
            );

            axios.mockResolvedValue({
                data: { success: true, data: { taskId: 'cleanup-test' } },
                status: 201
            });

            await Promise.all(interactions.map(interaction => 
                commandHandler.handleSlashCommand(interaction)
            ));

            // Clean up
            await botService.cleanup();

            const resourcesAfter = {
                eventListeners: mockClient.listenerCount(),
                timers: process._getActiveHandles().length,
                connections: mongoose.connection.readyState
            };

            // Resources should be cleaned up properly
            expect(resourcesAfter.eventListeners).toBeLessThanOrEqual(resourcesBefore.eventListeners);
            expect(resourcesAfter.connections).toBe(1); // Should still be connected
            
            console.log('Resource cleanup completed successfully');
        });
    });

    describe('API Response Time Performance', () => {
        test('should handle API latency gracefully', async () => {
            // Mock API with varying response times
            axios.mockImplementation(() => {
                const delay = Math.random() * 1000; // 0-1000ms delay
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve({
                            data: { success: true, data: { tasks: [] } },
                            status: 200
                        });
                    }, delay);
                });
            });

            const startTime = Date.now();
            
            // Create 30 concurrent interactions
            const interactions = Array.from({ length: 30 }, (_, i) => 
                mockClient.simulateInteractionCreate({
                    commandName: 'naffles-list-tasks',
                    guildId: '123456789',
                    user: mockClient.users.cache.get(`user${(i % 100) + 1}`)
                })
            );

            const promises = interactions.map(interaction => 
                commandHandler.handleSlashCommand(interaction)
            );

            await Promise.all(promises);
            
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            // Should handle variable latency within reasonable time
            expect(totalTime).toBeLessThan(5000);
            
            console.log(`30 interactions with variable API latency completed in ${totalTime}ms`);
        });

        test('should timeout slow API requests appropriately', async () => {
            // Mock very slow API response
            axios.mockImplementation(() => 
                new Promise(resolve => {
                    setTimeout(() => {
                        resolve({
                            data: { success: true, data: { tasks: [] } },
                            status: 200
                        });
                    }, 10000); // 10 second delay
                })
            );

            const interaction = mockClient.simulateInteractionCreate({
                commandName: 'naffles-list-tasks',
                guildId: '123456789',
                user: mockClient.users.cache.get('user1')
            });

            const startTime = Date.now();
            
            await commandHandler.handleSlashCommand(interaction);
            
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            // Should timeout before 10 seconds
            expect(totalTime).toBeLessThan(8000);
            
            // Should handle timeout gracefully
            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('timeout'),
                    ephemeral: true
                })
            );
        });
    });

    describe('Health Monitoring Performance', () => {
        test('should perform health checks efficiently', async () => {
            const startTime = Date.now();
            
            // Perform 20 concurrent health checks
            const healthChecks = Array.from({ length: 20 }, () => 
                healthMonitor.performHealthCheck()
            );

            await Promise.all(healthChecks);
            
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            expect(totalTime).toBeLessThan(2000); // Should complete within 2 seconds
            
            console.log(`20 concurrent health checks completed in ${totalTime}ms`);
        });

        test('should maintain performance metrics accurately', () => {
            const startTime = Date.now();
            
            // Simulate various operations
            for (let i = 0; i < 100; i++) {
                botService.incrementMetric('commandsProcessed');
                if (i % 10 === 0) {
                    botService.incrementMetric('errorsEncountered');
                }
            }

            const metrics = botService.getMetrics();
            const endTime = Date.now();
            
            expect(metrics.commandsProcessed).toBe(100);
            expect(metrics.errorsEncountered).toBe(10);
            expect(endTime - startTime).toBeLessThan(100); // Should be very fast
            
            console.log('Performance metrics updated efficiently');
        });
    });

    describe('Scalability Tests', () => {
        test('should scale to handle multiple guilds simultaneously', async () => {
            // Create multiple guilds
            const guilds = Array.from({ length: 10 }, (_, i) => {
                const guildId = `guild${i + 1}`;
                return mockClient.addMockGuild({
                    id: guildId,
                    name: `Test Guild ${i + 1}`,
                    ownerId: `owner${i + 1}`,
                    memberCount: 100
                });
            });

            // Create server community mappings for all guilds
            for (let i = 0; i < 10; i++) {
                await databaseService.createServerCommunityMapping({
                    serverId: `guild${i + 1}`,
                    communityId: `community${i + 1}`,
                    linkedBy: `owner${i + 1}`
                });
            }

            axios.mockResolvedValue({
                data: { success: true, data: { tasks: [] } },
                status: 200
            });

            const startTime = Date.now();
            
            // Create interactions across all guilds
            const interactions = Array.from({ length: 100 }, (_, i) => 
                mockClient.simulateInteractionCreate({
                    commandName: 'naffles-list-tasks',
                    guildId: `guild${(i % 10) + 1}`,
                    user: mockClient.users.cache.get(`user${(i % 100) + 1}`)
                })
            );

            const promises = interactions.map(interaction => 
                commandHandler.handleSlashCommand(interaction)
            );

            await Promise.all(promises);
            
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            expect(totalTime).toBeLessThan(8000); // Should handle multi-guild load
            
            console.log(`100 interactions across 10 guilds completed in ${totalTime}ms`);
        });

        test('should handle burst traffic patterns', async () => {
            axios.mockResolvedValue({
                data: { success: true, data: { taskId: 'burst-task' } },
                status: 201
            });

            // Simulate burst pattern: high load, then low load, then high again
            const burstSizes = [50, 10, 5, 40, 15, 60]; // Varying load
            const results = [];

            for (const burstSize of burstSizes) {
                const startTime = Date.now();
                
                const interactions = Array.from({ length: burstSize }, (_, i) => 
                    mockClient.simulateInteractionCreate({
                        commandName: 'naffles-create-task',
                        guildId: '123456789',
                        user: mockClient.users.cache.get(`user${(i % 100) + 1}`),
                        options: {
                            type: 'twitter_follow',
                            title: `Burst Task ${i}`,
                            description: 'Burst test',
                            points: 100
                        }
                    })
                );

                const promises = interactions.map(interaction => 
                    commandHandler.handleSlashCommand(interaction)
                );

                await Promise.all(promises);
                
                const endTime = Date.now();
                const burstTime = endTime - startTime;
                
                results.push({ size: burstSize, time: burstTime });
                
                // Small delay between bursts
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // All bursts should complete within reasonable time
            results.forEach(result => {
                const timePerInteraction = result.time / result.size;
                expect(timePerInteraction).toBeLessThan(200); // Less than 200ms per interaction
            });

            console.log('Burst traffic patterns handled successfully:', results);
        });
    });

    describe('Error Recovery Performance', () => {
        test('should recover quickly from temporary failures', async () => {
            let failureCount = 0;
            
            // Mock API that fails first few times then succeeds
            axios.mockImplementation(() => {
                failureCount++;
                if (failureCount <= 10) {
                    return Promise.reject(new Error('Temporary failure'));
                }
                return Promise.resolve({
                    data: { success: true, data: { tasks: [] } },
                    status: 200
                });
            });

            const startTime = Date.now();
            
            // Create 20 interactions
            const interactions = Array.from({ length: 20 }, (_, i) => 
                mockClient.simulateInteractionCreate({
                    commandName: 'naffles-list-tasks',
                    guildId: '123456789',
                    user: mockClient.users.cache.get(`user${(i % 100) + 1}`)
                })
            );

            const promises = interactions.map(interaction => 
                commandHandler.handleSlashCommand(interaction)
            );

            await Promise.all(promises);
            
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            // Should recover and complete within reasonable time
            expect(totalTime).toBeLessThan(10000);
            
            console.log(`Recovery from failures completed in ${totalTime}ms`);
        });

        test('should maintain performance during partial service degradation', async () => {
            // Mock Redis failures
            let redisFailures = 0;
            const originalGet = redisService.get;
            redisService.get = jest.fn().mockImplementation(async (key) => {
                redisFailures++;
                if (redisFailures % 3 === 0) {
                    throw new Error('Redis timeout');
                }
                return originalGet.call(redisService, key);
            });

            axios.mockResolvedValue({
                data: { success: true, data: { tasks: [] } },
                status: 200
            });

            const startTime = Date.now();
            
            const interactions = Array.from({ length: 30 }, (_, i) => 
                mockClient.simulateInteractionCreate({
                    commandName: 'naffles-list-tasks',
                    guildId: '123456789',
                    user: mockClient.users.cache.get(`user${(i % 100) + 1}`)
                })
            );

            const promises = interactions.map(interaction => 
                commandHandler.handleSlashCommand(interaction)
            );

            await Promise.all(promises);
            
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            // Should handle partial Redis failures gracefully
            expect(totalTime).toBeLessThan(8000);
            
            // Restore original method
            redisService.get = originalGet;
            
            console.log(`Handled partial service degradation in ${totalTime}ms`);
        });
    });
});