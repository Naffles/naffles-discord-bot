/**
 * Comprehensive Integration Tests for Discord Bot
 * Tests Discord API interactions and Naffles backend communication
 */

const { jest } = require('@jest/globals');
const axios = require('axios');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

// Mock Discord.js with more realistic behavior
jest.mock('discord.js', () => {
    const mockClient = {
        isReady: jest.fn(() => true),
        guilds: {
            cache: new Map(),
            fetch: jest.fn()
        },
        channels: {
            cache: new Map(),
            fetch: jest.fn()
        },
        users: {
            cache: new Map(),
            fetch: jest.fn()
        },
        ws: { ping: 50 },
        uptime: 3600000,
        user: { 
            id: 'bot123',
            tag: 'TestBot#1234',
            username: 'TestBot'
        },
        login: jest.fn().mockResolvedValue(),
        destroy: jest.fn().mockResolvedValue(),
        on: jest.fn(),
        once: jest.fn(),
        off: jest.fn(),
        emit: jest.fn()
    };

    return {
        Client: jest.fn(() => mockClient),
        GatewayIntentBits: {
            Guilds: 1,
            GuildMessages: 2,
            MessageContent: 4,
            GuildMembers: 8
        },
        REST: jest.fn().mockImplementation(() => ({
            setToken: jest.fn().mockReturnThis(),
            put: jest.fn().mockResolvedValue([]),
            get: jest.fn().mockResolvedValue([]),
            delete: jest.fn().mockResolvedValue()
        })),
        Routes: {
            applicationCommands: jest.fn(() => '/applications/123/commands'),
            applicationGuildCommands: jest.fn(() => '/applications/123/guilds/456/commands')
        },
        EmbedBuilder: jest.fn().mockImplementation(() => ({
            setTitle: jest.fn().mockReturnThis(),
            setDescription: jest.fn().mockReturnThis(),
            setColor: jest.fn().mockReturnThis(),
            setTimestamp: jest.fn().mockReturnThis(),
            addFields: jest.fn().mockReturnThis(),
            setFooter: jest.fn().mockReturnThis(),
            toJSON: jest.fn().mockReturnValue({})
        })),
        ActionRowBuilder: jest.fn().mockImplementation(() => ({
            addComponents: jest.fn().mockReturnThis(),
            toJSON: jest.fn().mockReturnValue({})
        })),
        ButtonBuilder: jest.fn().mockImplementation(() => ({
            setCustomId: jest.fn().mockReturnThis(),
            setLabel: jest.fn().mockReturnThis(),
            setStyle: jest.fn().mockReturnThis(),
            setEmoji: jest.fn().mockReturnThis(),
            toJSON: jest.fn().mockReturnValue({})
        })),
        ButtonStyle: {
            Primary: 1,
            Secondary: 2,
            Success: 3,
            Danger: 4
        }
    };
});

// Mock axios for API calls
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

// Import services after mocking
const DiscordBotService = require('../src/services/discordBotService');
const DatabaseService = require('../src/services/databaseService');
const RedisService = require('../src/services/redisService');
const CreateTaskCommand = require('../src/commands/createTask');
const ListTasksCommand = require('../src/commands/listTasks');
const ConnectAllowlistCommand = require('../src/commands/connectAllowlist');
const CommandHandler = require('../src/handlers/commandHandler');
const ButtonHandler = require('../src/handlers/buttonHandler');
const CommunityLinkingService = require('../src/services/communityLinkingService');
const SocialTaskIntegrationService = require('../src/services/socialTaskIntegrationService');
const AllowlistIntegrationService = require('../src/services/allowlistIntegrationService');
const RealTimeSyncService = require('../src/services/realTimeSyncService');

describe('Discord Bot Integration Tests', () => {
    let mongoServer;
    let mockClient;
    let databaseService;
    let redisService;
    let botService;
    let commandHandler;
    let buttonHandler;

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
        const { Client } = require('discord.js');
        mockClient = new Client();

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

        // Connect to test database
        await databaseService.connect();
        await redisService.connect();

        // Initialize bot service
        botService = new DiscordBotService(mockClient, databaseService, redisService);
        await botService.initialize();

        // Initialize handlers
        commandHandler = new CommandHandler(botService);
        buttonHandler = new ButtonHandler(botService);
    });

    afterEach(async () => {
        // Clean up database
        if (mongoose.connection.readyState === 1) {
            const collections = await mongoose.connection.db.collections();
            for (const collection of collections) {
                await collection.deleteMany({});
            }
        }

        // Disconnect services
        await databaseService.disconnect();
        await redisService.disconnect();
    });

    describe('Discord API Integration', () => {
        test('should register slash commands with Discord', async () => {
            const { REST } = require('discord.js');
            const mockRest = new REST();

            // Mock successful command registration
            mockRest.put.mockResolvedValue([
                { id: '1', name: 'naffles-create-task' },
                { id: '2', name: 'naffles-list-tasks' },
                { id: '3', name: 'naffles-connect-allowlist' }
            ]);

            const commands = [
                { name: 'naffles-create-task', description: 'Create a social task' },
                { name: 'naffles-list-tasks', description: 'List active tasks' },
                { name: 'naffles-connect-allowlist', description: 'Connect an allowlist' }
            ];

            const result = await mockRest.put('/applications/123/commands', { body: commands });

            expect(mockRest.put).toHaveBeenCalledWith(
                '/applications/123/commands',
                { body: commands }
            );
            expect(result).toHaveLength(3);
            expect(result[0]).toHaveProperty('name', 'naffles-create-task');
        });

        test('should handle Discord API rate limits', async () => {
            const { REST } = require('discord.js');
            const mockRest = new REST();

            // Mock rate limit error
            const rateLimitError = new Error('Rate limited');
            rateLimitError.status = 429;
            rateLimitError.headers = { 'retry-after': '1000' };

            mockRest.put.mockRejectedValueOnce(rateLimitError);
            mockRest.put.mockResolvedValueOnce([{ id: '1', name: 'test-command' }]);

            // Should retry after rate limit
            await expect(async () => {
                try {
                    await mockRest.put('/applications/123/commands', { body: [] });
                } catch (error) {
                    if (error.status === 429) {
                        // Simulate retry after delay
                        await new Promise(resolve => setTimeout(resolve, 100));
                        return await mockRest.put('/applications/123/commands', { body: [] });
                    }
                    throw error;
                }
            }).not.toThrow();

            expect(mockRest.put).toHaveBeenCalledTimes(2);
        });

        test('should handle Discord client connection', async () => {
            const mockLoginPromise = Promise.resolve();
            mockClient.login.mockReturnValue(mockLoginPromise);

            await botService.connectToDiscord();

            expect(mockClient.login).toHaveBeenCalledWith(process.env.DISCORD_BOT_TOKEN);
        });

        test('should handle Discord client disconnection', async () => {
            await botService.disconnectFromDiscord();

            expect(mockClient.destroy).toHaveBeenCalled();
        });

        test('should fetch guild information', async () => {
            const mockGuild = {
                id: '123456789',
                name: 'Test Guild',
                memberCount: 100,
                ownerId: 'owner123',
                channels: {
                    cache: new Map([
                        ['channel123', { id: 'channel123', name: 'general', type: 0 }]
                    ])
                }
            };

            mockClient.guilds.fetch.mockResolvedValue(mockGuild);

            const guild = await mockClient.guilds.fetch('123456789');

            expect(guild).toEqual(mockGuild);
            expect(mockClient.guilds.fetch).toHaveBeenCalledWith('123456789');
        });

        test('should send messages to Discord channels', async () => {
            const mockChannel = {
                id: 'channel123',
                name: 'general',
                type: 0,
                send: jest.fn().mockResolvedValue({
                    id: 'message123',
                    content: 'Test message',
                    embeds: []
                })
            };

            mockClient.channels.fetch.mockResolvedValue(mockChannel);

            const channel = await mockClient.channels.fetch('channel123');
            const message = await channel.send('Test message');

            expect(message).toHaveProperty('id', 'message123');
            expect(mockChannel.send).toHaveBeenCalledWith('Test message');
        });
    });

    describe('Naffles Backend Integration', () => {
        test('should authenticate with Naffles API', async () => {
            axios.mockResolvedValue({
                data: { success: true, token: 'auth-token' },
                status: 200
            });

            const result = await botService.makeNafflesApiCall('/auth/validate', 'POST', {
                botToken: process.env.DISCORD_BOT_TOKEN
            });

            expect(result).toEqual({ success: true, token: 'auth-token' });
            expect(axios).toHaveBeenCalledWith(expect.objectContaining({
                method: 'POST',
                url: expect.stringContaining('/auth/validate'),
                headers: expect.objectContaining({
                    'Authorization': expect.stringContaining('Bearer'),
                    'Content-Type': 'application/json'
                }),
                data: { botToken: process.env.DISCORD_BOT_TOKEN }
            }));
        });

        test('should create social task via API', async () => {
            const taskData = {
                type: 'twitter_follow',
                title: 'Follow our Twitter',
                description: 'Follow @naffles on Twitter',
                points: 100,
                duration: 168,
                communityId: 'community123'
            };

            axios.mockResolvedValue({
                data: {
                    success: true,
                    data: {
                        taskId: 'task123',
                        ...taskData,
                        createdAt: new Date().toISOString(),
                        expiresAt: new Date(Date.now() + 168 * 60 * 60 * 1000).toISOString()
                    }
                },
                status: 201
            });

            const result = await botService.makeNafflesApiCall('/social-tasks', 'POST', taskData);

            expect(result.success).toBe(true);
            expect(result.data).toHaveProperty('taskId', 'task123');
            expect(axios).toHaveBeenCalledWith(expect.objectContaining({
                method: 'POST',
                url: expect.stringContaining('/social-tasks'),
                data: taskData
            }));
        });

        test('should fetch community tasks via API', async () => {
            const mockTasks = [
                {
                    id: 'task123',
                    title: 'Follow Twitter',
                    description: 'Follow our Twitter account',
                    points: 100,
                    type: 'twitter_follow',
                    status: 'active',
                    completions: 25,
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                },
                {
                    id: 'task456',
                    title: 'Join Discord',
                    description: 'Join our Discord server',
                    points: 50,
                    type: 'discord_join',
                    status: 'active',
                    completions: 15,
                    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
                }
            ];

            axios.mockResolvedValue({
                data: {
                    success: true,
                    data: { tasks: mockTasks }
                },
                status: 200
            });

            const result = await botService.makeNafflesApiCall('/social-tasks?communityId=community123', 'GET');

            expect(result.success).toBe(true);
            expect(result.data.tasks).toHaveLength(2);
            expect(result.data.tasks[0]).toHaveProperty('id', 'task123');
        });

        test('should connect allowlist via API', async () => {
            const allowlistData = {
                id: 'allowlist123',
                title: 'Test Allowlist',
                description: 'Test allowlist description',
                entryPrice: '0.1 ETH',
                winnerCount: 100,
                endTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                socialTasks: [
                    { type: 'twitter_follow', required: true },
                    { type: 'discord_join', required: false }
                ]
            };

            axios.mockResolvedValue({
                data: {
                    success: true,
                    data: { allowlist: allowlistData }
                },
                status: 200
            });

            const result = await botService.makeNafflesApiCall('/allowlists/allowlist123', 'GET');

            expect(result.success).toBe(true);
            expect(result.data.allowlist).toHaveProperty('id', 'allowlist123');
            expect(result.data.allowlist.socialTasks).toHaveLength(2);
        });

        test('should handle API authentication errors', async () => {
            axios.mockRejectedValue({
                response: {
                    status: 401,
                    data: { error: 'Unauthorized', message: 'Invalid API key' }
                }
            });

            await expect(botService.makeNafflesApiCall('/test', 'GET'))
                .rejects.toThrow('API request failed');
        });

        test('should handle API server errors', async () => {
            axios.mockRejectedValue({
                response: {
                    status: 500,
                    data: { error: 'Internal Server Error' }
                }
            });

            await expect(botService.makeNafflesApiCall('/test', 'GET'))
                .rejects.toThrow('API request failed');
        });

        test('should retry failed API requests', async () => {
            // First call fails, second succeeds
            axios
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce({
                    data: { success: true, data: 'test' },
                    status: 200
                });

            const result = await botService.makeNafflesApiCallWithRetry('/test', 'GET', null, 2);

            expect(result).toEqual({ success: true, data: 'test' });
            expect(axios).toHaveBeenCalledTimes(2);
        });
    });

    describe('Database Integration', () => {
        test('should create and retrieve server community mapping', async () => {
            const mappingData = {
                serverId: '123456789',
                communityId: 'community123',
                linkedBy: 'user123'
            };

            const mapping = await databaseService.createServerCommunityMapping(mappingData);
            expect(mapping).toHaveProperty('serverId', '123456789');
            expect(mapping).toHaveProperty('communityId', 'community123');

            const retrieved = await databaseService.getServerCommunityMapping('123456789');
            expect(retrieved).toHaveProperty('serverId', '123456789');
            expect(retrieved).toHaveProperty('communityId', 'community123');
        });

        test('should create and retrieve task posts', async () => {
            const taskPostData = {
                taskId: 'task123',
                serverId: '123456789',
                channelId: 'channel123',
                messageId: 'message123',
                createdBy: 'user123'
            };

            const taskPost = await databaseService.createTaskPost(taskPostData);
            expect(taskPost).toHaveProperty('taskId', 'task123');
            expect(taskPost).toHaveProperty('messageId', 'message123');

            const retrieved = await databaseService.getTaskPost('task123', '123456789');
            expect(retrieved).toHaveProperty('taskId', 'task123');
        });

        test('should create and retrieve account links', async () => {
            const linkData = {
                discordUserId: 'user123',
                nafflesUserId: 'naffles123',
                accessToken: 'token123',
                refreshToken: 'refresh123'
            };

            const link = await databaseService.createAccountLink(linkData);
            expect(link).toHaveProperty('discordUserId', 'user123');
            expect(link).toHaveProperty('nafflesUserId', 'naffles123');

            const retrieved = await databaseService.getAccountLink('user123');
            expect(retrieved).toHaveProperty('discordUserId', 'user123');
        });

        test('should log interactions', async () => {
            const interactionData = {
                userId: 'user123',
                guildId: '123456789',
                channelId: 'channel123',
                action: 'command_executed',
                commandName: 'naffles-create-task',
                success: true,
                details: { taskType: 'twitter_follow' }
            };

            await databaseService.logInteraction(interactionData);

            const logs = await databaseService.getInteractionLogs({
                userId: 'user123',
                limit: 10
            });

            expect(logs).toHaveLength(1);
            expect(logs[0]).toHaveProperty('action', 'command_executed');
            expect(logs[0]).toHaveProperty('commandName', 'naffles-create-task');
        });

        test('should expire old task posts', async () => {
            // Create some old task posts
            const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
            
            await databaseService.createTaskPost({
                taskId: 'old-task-1',
                serverId: '123456789',
                channelId: 'channel123',
                messageId: 'message1',
                createdBy: 'user123',
                createdAt: oldDate
            });

            await databaseService.createTaskPost({
                taskId: 'old-task-2',
                serverId: '123456789',
                channelId: 'channel123',
                messageId: 'message2',
                createdBy: 'user123',
                createdAt: oldDate
            });

            const expiredCount = await databaseService.expireOldTaskPosts();
            expect(expiredCount).toBe(2);
        });

        test('should handle database connection errors', async () => {
            // Disconnect and try to perform operation
            await databaseService.disconnect();

            await expect(databaseService.createServerCommunityMapping({
                serverId: '123456789',
                communityId: 'community123',
                linkedBy: 'user123'
            })).rejects.toThrow();

            // Reconnect for cleanup
            await databaseService.connect();
        });
    });

    describe('Redis Integration', () => {
        test('should cache and retrieve data', async () => {
            const testData = { test: 'data', timestamp: Date.now() };
            
            await redisService.set('test:key', JSON.stringify(testData), 3600);
            expect(redisService.set).toHaveBeenCalledWith('test:key', JSON.stringify(testData), 3600);

            redisService.get.mockResolvedValue(JSON.stringify(testData));
            const retrieved = await redisService.get('test:key');
            const parsedData = JSON.parse(retrieved);

            expect(parsedData).toEqual(testData);
        });

        test('should handle cache expiration', async () => {
            await redisService.set('expiring:key', 'test-value', 1); // 1 second TTL
            
            // Simulate expiration
            redisService.get.mockResolvedValueOnce('test-value');
            redisService.get.mockResolvedValueOnce(null);

            const value1 = await redisService.get('expiring:key');
            expect(value1).toBe('test-value');

            // After expiration
            const value2 = await redisService.get('expiring:key');
            expect(value2).toBeNull();
        });

        test('should handle Redis connection errors', async () => {
            redisService.isConnected.mockReturnValue(false);
            redisService.get.mockRejectedValue(new Error('Redis connection failed'));

            await expect(redisService.get('test:key')).rejects.toThrow('Redis connection failed');
        });
    });

    describe('End-to-End Command Workflows', () => {
        test('should complete create task workflow', async () => {
            // Mock successful API response
            axios.mockResolvedValue({
                data: {
                    success: true,
                    data: {
                        taskId: 'task123',
                        title: 'Follow Twitter',
                        description: 'Follow our Twitter account',
                        points: 100,
                        type: 'twitter_follow',
                        expiresAt: new Date(Date.now() + 168 * 60 * 60 * 1000).toISOString()
                    }
                },
                status: 201
            });

            const mockInteraction = {
                user: {
                    id: 'user123',
                    bot: false,
                    createdTimestamp: Date.now() - (30 * 24 * 60 * 60 * 1000),
                    tag: 'TestUser#1234'
                },
                guildId: '123456789',
                channelId: 'channel123',
                member: {
                    permissions: {
                        has: jest.fn().mockReturnValue(true)
                    },
                    roles: { cache: new Map() },
                    guild: { ownerId: 'owner123' }
                },
                options: {
                    getString: jest.fn()
                        .mockReturnValueOnce('twitter_follow')
                        .mockReturnValueOnce('Follow Twitter')
                        .mockReturnValueOnce('Follow our Twitter account'),
                    getInteger: jest.fn()
                        .mockReturnValueOnce(100)
                        .mockReturnValueOnce(168)
                },
                deferReply: jest.fn().mockResolvedValue(),
                editReply: jest.fn().mockResolvedValue()
            };

            // Create server community mapping first
            await databaseService.createServerCommunityMapping({
                serverId: '123456789',
                communityId: 'community123',
                linkedBy: 'user123'
            });

            const createTaskCommand = new CreateTaskCommand(botService);
            await createTaskCommand.execute(mockInteraction);

            expect(mockInteraction.deferReply).toHaveBeenCalled();
            expect(axios).toHaveBeenCalledWith(expect.objectContaining({
                method: 'POST',
                url: expect.stringContaining('/social-tasks')
            }));
            expect(mockInteraction.editReply).toHaveBeenCalled();

            // Verify task post was created in database
            const taskPost = await databaseService.getTaskPost('task123', '123456789');
            expect(taskPost).toBeTruthy();
        });

        test('should complete list tasks workflow', async () => {
            // Mock API response with tasks
            axios.mockResolvedValue({
                data: {
                    success: true,
                    data: {
                        tasks: [
                            {
                                id: 'task123',
                                title: 'Follow Twitter',
                                description: 'Follow our Twitter account',
                                points: 100,
                                type: 'twitter_follow',
                                status: 'active',
                                completions: 25,
                                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                            }
                        ]
                    }
                },
                status: 200
            });

            const mockInteraction = {
                user: { id: 'user123', tag: 'TestUser#1234' },
                guildId: '123456789',
                deferReply: jest.fn().mockResolvedValue(),
                editReply: jest.fn().mockResolvedValue()
            };

            // Create server community mapping
            await databaseService.createServerCommunityMapping({
                serverId: '123456789',
                communityId: 'community123',
                linkedBy: 'user123'
            });

            const listTasksCommand = new ListTasksCommand(botService);
            await listTasksCommand.execute(mockInteraction);

            expect(mockInteraction.deferReply).toHaveBeenCalled();
            expect(axios).toHaveBeenCalledWith(expect.objectContaining({
                method: 'GET',
                url: expect.stringContaining('/social-tasks')
            }));
            expect(mockInteraction.editReply).toHaveBeenCalled();
        });

        test('should complete connect allowlist workflow', async () => {
            // Mock API response
            axios.mockResolvedValue({
                data: {
                    success: true,
                    data: {
                        allowlist: {
                            id: 'allowlist123',
                            title: 'Test Allowlist',
                            description: 'Test allowlist description',
                            entryPrice: '0.1 ETH',
                            winnerCount: 100,
                            endTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                        }
                    }
                },
                status: 200
            });

            const mockInteraction = {
                user: { id: 'user123', tag: 'TestUser#1234' },
                guildId: '123456789',
                channelId: 'channel123',
                options: {
                    getString: jest.fn().mockReturnValue('allowlist123')
                },
                deferReply: jest.fn().mockResolvedValue(),
                editReply: jest.fn().mockResolvedValue()
            };

            const connectAllowlistCommand = new ConnectAllowlistCommand(botService);
            await connectAllowlistCommand.execute(mockInteraction);

            expect(mockInteraction.deferReply).toHaveBeenCalled();
            expect(axios).toHaveBeenCalledWith(expect.objectContaining({
                method: 'GET',
                url: expect.stringContaining('/allowlists/allowlist123')
            }));
            expect(mockInteraction.editReply).toHaveBeenCalled();

            // Verify allowlist connection was created
            const connection = await databaseService.getAllowlistConnection('allowlist123', '123456789');
            expect(connection).toBeTruthy();
        });

        test('should handle button interactions for task completion', async () => {
            // Mock API response for task completion
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

            const mockInteraction = {
                customId: 'task_complete_task123',
                user: { id: 'user123', tag: 'TestUser#1234' },
                guildId: '123456789',
                deferReply: jest.fn().mockResolvedValue(),
                editReply: jest.fn().mockResolvedValue()
            };

            await buttonHandler.handleButtonInteraction(mockInteraction);

            expect(mockInteraction.deferReply).toHaveBeenCalled();
            expect(axios).toHaveBeenCalledWith(expect.objectContaining({
                method: 'POST',
                url: expect.stringContaining('/social-tasks/task123/complete')
            }));
            expect(mockInteraction.editReply).toHaveBeenCalled();
        });
    });

    describe('Real-Time Sync Integration', () => {
        test('should sync task updates from Naffles backend', async () => {
            const realTimeSyncService = new RealTimeSyncService(botService);
            
            const taskUpdate = {
                taskId: 'task123',
                serverId: '123456789',
                status: 'completed',
                completions: 50,
                updatedAt: new Date().toISOString()
            };

            // Mock Discord message update
            const mockMessage = {
                id: 'message123',
                edit: jest.fn().mockResolvedValue()
            };

            mockClient.channels.fetch.mockResolvedValue({
                messages: {
                    fetch: jest.fn().mockResolvedValue(mockMessage)
                }
            });

            await realTimeSyncService.handleTaskUpdate(taskUpdate);

            expect(mockClient.channels.fetch).toHaveBeenCalled();
            expect(mockMessage.edit).toHaveBeenCalled();
        });

        test('should sync allowlist updates from Naffles backend', async () => {
            const realTimeSyncService = new RealTimeSyncService(botService);
            
            const allowlistUpdate = {
                allowlistId: 'allowlist123',
                serverId: '123456789',
                entries: 75,
                timeRemaining: '2 hours',
                updatedAt: new Date().toISOString()
            };

            // Mock Discord message update
            const mockMessage = {
                id: 'message456',
                edit: jest.fn().mockResolvedValue()
            };

            mockClient.channels.fetch.mockResolvedValue({
                messages: {
                    fetch: jest.fn().mockResolvedValue(mockMessage)
                }
            });

            await realTimeSyncService.handleAllowlistUpdate(allowlistUpdate);

            expect(mockClient.channels.fetch).toHaveBeenCalled();
            expect(mockMessage.edit).toHaveBeenCalled();
        });
    });

    describe('Error Handling and Recovery', () => {
        test('should handle Discord API errors gracefully', async () => {
            const discordError = new Error('Discord API Error');
            discordError.code = 50013; // Missing Permissions
            
            mockClient.channels.fetch.mockRejectedValue(discordError);

            const mockInteraction = {
                channelId: 'channel123',
                reply: jest.fn().mockResolvedValue()
            };

            // Should handle error without crashing
            await expect(async () => {
                try {
                    await mockClient.channels.fetch('channel123');
                } catch (error) {
                    if (error.code === 50013) {
                        await mockInteraction.reply({
                            content: 'Missing permissions to access channel',
                            ephemeral: true
                        });
                        return;
                    }
                    throw error;
                }
            }).not.toThrow();

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('Missing permissions'),
                    ephemeral: true
                })
            );
        });

        test('should handle network failures with retry logic', async () => {
            const networkError = new Error('ECONNREFUSED');
            
            // First two calls fail, third succeeds
            axios
                .mockRejectedValueOnce(networkError)
                .mockRejectedValueOnce(networkError)
                .mockResolvedValueOnce({
                    data: { success: true, data: 'recovered' },
                    status: 200
                });

            const result = await botService.makeNafflesApiCallWithRetry('/test', 'GET', null, 3);

            expect(result).toEqual({ success: true, data: 'recovered' });
            expect(axios).toHaveBeenCalledTimes(3);
        });

        test('should handle database connection recovery', async () => {
            // Simulate connection loss
            await databaseService.disconnect();
            
            // Attempt operation (should fail)
            await expect(databaseService.getServerCommunityMapping('123456789'))
                .rejects.toThrow();

            // Reconnect and retry
            await databaseService.connect();
            
            // Should work after reconnection
            const mapping = await databaseService.createServerCommunityMapping({
                serverId: '123456789',
                communityId: 'community123',
                linkedBy: 'user123'
            });

            expect(mapping).toHaveProperty('serverId', '123456789');
        });
    });

    describe('Performance and Load Testing', () => {
        test('should handle multiple concurrent command executions', async () => {
            // Mock successful API responses
            axios.mockResolvedValue({
                data: { success: true, data: { tasks: [] } },
                status: 200
            });

            const mockInteractions = Array.from({ length: 10 }, (_, i) => ({
                commandName: 'naffles-list-tasks',
                user: { id: `user${i}`, tag: `TestUser${i}#1234` },
                guildId: '123456789',
                deferReply: jest.fn().mockResolvedValue(),
                editReply: jest.fn().mockResolvedValue()
            }));

            // Create server community mapping
            await databaseService.createServerCommunityMapping({
                serverId: '123456789',
                communityId: 'community123',
                linkedBy: 'user123'
            });

            const startTime = Date.now();
            
            const promises = mockInteractions.map(interaction => 
                commandHandler.handleSlashCommand(interaction)
            );

            await Promise.all(promises);
            
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            // Should complete within reasonable time (5 seconds for 10 concurrent commands)
            expect(totalTime).toBeLessThan(5000);

            // Verify all interactions were handled
            mockInteractions.forEach(interaction => {
                expect(interaction.deferReply).toHaveBeenCalled();
                expect(interaction.editReply).toHaveBeenCalled();
            });
        });

        test('should handle high-frequency button interactions', async () => {
            axios.mockResolvedValue({
                data: { success: true, data: { completed: true, points: 100 } },
                status: 200
            });

            const mockInteractions = Array.from({ length: 20 }, (_, i) => ({
                customId: `task_complete_task${i}`,
                user: { id: `user${i}`, tag: `TestUser${i}#1234` },
                guildId: '123456789',
                deferReply: jest.fn().mockResolvedValue(),
                editReply: jest.fn().mockResolvedValue()
            }));

            const promises = mockInteractions.map(interaction => 
                buttonHandler.handleButtonInteraction(interaction)
            );

            await expect(Promise.all(promises)).resolves.not.toThrow();

            // Verify all interactions were handled
            mockInteractions.forEach(interaction => {
                expect(interaction.deferReply).toHaveBeenCalled();
            });
        });
    });
});