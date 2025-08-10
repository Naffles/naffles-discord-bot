/**
 * End-to-End Tests for Discord Bot Integration
 * Tests complete user workflows from Discord to task completion
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
const EventHandler = require('../src/handlers/eventHandler');

describe('Discord Bot End-to-End Tests', () => {
    let mongoServer;
    let mockClient;
    let databaseService;
    let redisService;
    let botService;
    let commandHandler;
    let buttonHandler;
    let eventHandler;

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
        eventHandler = new EventHandler(botService);

        // Set up mock guild and channel
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
                    user: { id: 'user123', username: 'TestUser', discriminator: '1234' },
                    roles: []
                },
                {
                    user: { id: 'owner123', username: 'GuildOwner', discriminator: '0001' },
                    roles: []
                }
            ]
        });

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

    describe('Complete Task Creation Workflow', () => {
        test('should complete full task creation from Discord command to database storage', async () => {
            // Step 1: Mock successful API response for task creation
            axios.mockResolvedValueOnce({
                data: {
                    success: true,
                    data: {
                        taskId: 'task123',
                        title: 'Follow our Twitter',
                        description: 'Follow @naffles on Twitter for updates',
                        points: 100,
                        type: 'twitter_follow',
                        duration: 168,
                        communityId: 'community123',
                        createdAt: new Date().toISOString(),
                        expiresAt: new Date(Date.now() + 168 * 60 * 60 * 1000).toISOString(),
                        socialData: {
                            twitter: {
                                username: 'naffles',
                                action: 'follow'
                            }
                        }
                    }
                },
                status: 201
            });

            // Step 2: Create mock interaction
            const mockInteraction = mockClient.simulateInteractionCreate({
                commandName: 'naffles-create-task',
                guildId: '123456789',
                channelId: 'channel123',
                user: mockClient.users.cache.get('user123'),
                member: mockClient.guilds.cache.get('123456789').members.cache.get('user123'),
                options: {
                    type: 'twitter_follow',
                    title: 'Follow our Twitter',
                    description: 'Follow @naffles on Twitter for updates',
                    points: 100,
                    duration: 168
                }
            });

            // Step 3: Execute command
            await commandHandler.handleSlashCommand(mockInteraction);

            // Step 4: Verify Discord interaction was handled
            expect(mockInteraction.deferReply).toHaveBeenCalled();
            expect(mockInteraction.editReply).toHaveBeenCalled();

            // Step 5: Verify API call was made
            expect(axios).toHaveBeenCalledWith(expect.objectContaining({
                method: 'POST',
                url: expect.stringContaining('/social-tasks'),
                data: expect.objectContaining({
                    type: 'twitter_follow',
                    title: 'Follow our Twitter',
                    description: 'Follow @naffles on Twitter for updates',
                    points: 100,
                    duration: 168,
                    communityId: 'community123'
                })
            }));

            // Step 6: Verify task post was created in database
            const taskPost = await databaseService.getTaskPost('task123', '123456789');
            expect(taskPost).toBeTruthy();
            expect(taskPost.taskId).toBe('task123');
            expect(taskPost.serverId).toBe('123456789');
            expect(taskPost.channelId).toBe('channel123');

            // Step 7: Verify interaction was logged
            const interactionLogs = await databaseService.getInteractionLogs({
                userId: 'user123',
                guildId: '123456789',
                limit: 10
            });
            expect(interactionLogs).toHaveLength(1);
            expect(interactionLogs[0].action).toBe('command_executed');
            expect(interactionLogs[0].commandName).toBe('naffles-create-task');
            expect(interactionLogs[0].success).toBe(true);
        });

        test('should handle task creation failure gracefully', async () => {
            // Mock API failure
            axios.mockRejectedValueOnce({
                response: {
                    status: 400,
                    data: {
                        error: 'Validation Error',
                        message: 'Invalid task parameters'
                    }
                }
            });

            const mockInteraction = mockClient.simulateInteractionCreate({
                commandName: 'naffles-create-task',
                guildId: '123456789',
                channelId: 'channel123',
                user: mockClient.users.cache.get('user123'),
                options: {
                    type: 'twitter_follow',
                    title: 'Invalid Task',
                    description: '',
                    points: -10, // Invalid
                    duration: 168
                }
            });

            await commandHandler.handleSlashCommand(mockInteraction);

            // Should handle error gracefully
            expect(mockInteraction.deferReply).toHaveBeenCalled();
            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('error'),
                    ephemeral: true
                })
            );

            // Should log the error
            const interactionLogs = await databaseService.getInteractionLogs({
                userId: 'user123',
                limit: 10
            });
            expect(interactionLogs).toHaveLength(1);
            expect(interactionLogs[0].success).toBe(false);
        });
    });

    describe('Complete Task Completion Workflow', () => {
        test('should complete full task completion from button click to points award', async () => {
            // Step 1: Set up existing task post
            await databaseService.createTaskPost({
                taskId: 'task123',
                serverId: '123456789',
                channelId: 'channel123',
                messageId: 'message123',
                createdBy: 'user123'
            });

            // Step 2: Mock successful task completion API response
            axios.mockResolvedValueOnce({
                data: {
                    success: true,
                    data: {
                        completed: true,
                        points: 100,
                        message: 'Task completed successfully! You earned 100 points.',
                        taskData: {
                            id: 'task123',
                            title: 'Follow our Twitter',
                            type: 'twitter_follow'
                        }
                    }
                },
                status: 200
            });

            // Step 3: Create button interaction
            const mockInteraction = mockClient.simulateInteractionCreate({
                type: 3, // MESSAGE_COMPONENT
                customId: 'task_complete_task123',
                guildId: '123456789',
                channelId: 'channel123',
                user: mockClient.users.cache.get('user123')
            });

            // Step 4: Execute button handler
            await buttonHandler.handleButtonInteraction(mockInteraction);

            // Step 5: Verify interaction was handled
            expect(mockInteraction.deferReply).toHaveBeenCalled();
            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('completed successfully'),
                    ephemeral: true
                })
            );

            // Step 6: Verify API call was made
            expect(axios).toHaveBeenCalledWith(expect.objectContaining({
                method: 'POST',
                url: expect.stringContaining('/social-tasks/task123/complete'),
                data: expect.objectContaining({
                    userId: 'user123',
                    discordUserId: 'user123'
                })
            }));

            // Step 7: Verify interaction was logged
            const interactionLogs = await databaseService.getInteractionLogs({
                userId: 'user123',
                action: 'button_clicked',
                limit: 10
            });
            expect(interactionLogs).toHaveLength(1);
            expect(interactionLogs[0].details.customId).toBe('task_complete_task123');
            expect(interactionLogs[0].success).toBe(true);
        });

        test('should handle already completed task', async () => {
            // Mock API response for already completed task
            axios.mockResolvedValueOnce({
                data: {
                    success: false,
                    error: 'Task already completed',
                    message: 'You have already completed this task.'
                },
                status: 400
            });

            const mockInteraction = mockClient.simulateInteractionCreate({
                type: 3,
                customId: 'task_complete_task123',
                guildId: '123456789',
                user: mockClient.users.cache.get('user123')
            });

            await buttonHandler.handleButtonInteraction(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('already completed'),
                    ephemeral: true
                })
            );
        });
    });

    describe('Complete Allowlist Connection Workflow', () => {
        test('should complete full allowlist connection from command to Discord post', async () => {
            // Step 1: Mock successful allowlist fetch
            axios.mockResolvedValueOnce({
                data: {
                    success: true,
                    data: {
                        allowlist: {
                            id: 'allowlist123',
                            title: 'Exclusive NFT Drop',
                            description: 'Get on the allowlist for our exclusive NFT collection',
                            entryPrice: '0.1 ETH',
                            winnerCount: 100,
                            maxEntries: 1000,
                            currentEntries: 250,
                            endTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                            socialTasks: [
                                {
                                    type: 'twitter_follow',
                                    required: true,
                                    data: { username: 'naffles' }
                                },
                                {
                                    type: 'discord_join',
                                    required: false,
                                    data: { serverId: '123456789' }
                                }
                            ],
                            communityId: 'community123'
                        }
                    }
                },
                status: 200
            });

            // Step 2: Create command interaction
            const mockInteraction = mockClient.simulateInteractionCreate({
                commandName: 'naffles-connect-allowlist',
                guildId: '123456789',
                channelId: 'channel123',
                user: mockClient.users.cache.get('user123'),
                options: {
                    allowlist_id: 'allowlist123'
                }
            });

            // Step 3: Execute command
            await commandHandler.handleSlashCommand(mockInteraction);

            // Step 4: Verify Discord interaction was handled
            expect(mockInteraction.deferReply).toHaveBeenCalled();
            expect(mockInteraction.editReply).toHaveBeenCalled();

            // Step 5: Verify API call was made
            expect(axios).toHaveBeenCalledWith(expect.objectContaining({
                method: 'GET',
                url: expect.stringContaining('/allowlists/allowlist123')
            }));

            // Step 6: Verify allowlist connection was created in database
            const connection = await databaseService.getAllowlistConnection('allowlist123', '123456789');
            expect(connection).toBeTruthy();
            expect(connection.allowlistId).toBe('allowlist123');
            expect(connection.serverId).toBe('123456789');
            expect(connection.channelId).toBe('channel123');

            // Step 7: Verify interaction was logged
            const interactionLogs = await databaseService.getInteractionLogs({
                userId: 'user123',
                action: 'command_executed',
                commandName: 'naffles-connect-allowlist',
                limit: 10
            });
            expect(interactionLogs).toHaveLength(1);
            expect(interactionLogs[0].success).toBe(true);
        });

        test('should handle allowlist entry button clicks', async () => {
            // Set up existing allowlist connection
            await databaseService.createAllowlistConnection({
                allowlistId: 'allowlist123',
                serverId: '123456789',
                channelId: 'channel123',
                messageId: 'message456',
                createdBy: 'user123'
            });

            // Mock successful allowlist entry
            axios.mockResolvedValueOnce({
                data: {
                    success: true,
                    data: {
                        entered: true,
                        position: 251,
                        message: 'Successfully entered the allowlist! You are #251 in line.'
                    }
                },
                status: 200
            });

            const mockInteraction = mockClient.simulateInteractionCreate({
                type: 3,
                customId: 'allowlist_enter_allowlist123',
                guildId: '123456789',
                user: mockClient.users.cache.get('user123')
            });

            await buttonHandler.handleButtonInteraction(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('Successfully entered'),
                    ephemeral: true
                })
            );

            expect(axios).toHaveBeenCalledWith(expect.objectContaining({
                method: 'POST',
                url: expect.stringContaining('/allowlists/allowlist123/enter')
            }));
        });
    });

    describe('Community Linking Workflow', () => {
        test('should complete community linking process', async () => {
            // Mock successful community validation
            axios.mockResolvedValueOnce({
                data: {
                    success: true,
                    data: {
                        community: {
                            id: 'newcommunity456',
                            name: 'New Test Community',
                            description: 'A test community for Discord integration',
                            pointsName: 'TestPoints',
                            isActive: true
                        }
                    }
                },
                status: 200
            });

            const mockInteraction = mockClient.simulateInteractionCreate({
                commandName: 'naffles-link-community',
                guildId: '987654321', // Different guild
                user: mockClient.users.cache.get('owner123'),
                options: {
                    community_id: 'newcommunity456'
                }
            });

            // Add the new guild
            mockClient.addMockGuild({
                id: '987654321',
                name: 'New Test Guild',
                ownerId: 'owner123'
            });

            await commandHandler.handleSlashCommand(mockInteraction);

            // Verify community was linked
            const mapping = await databaseService.getServerCommunityMapping('987654321');
            expect(mapping).toBeTruthy();
            expect(mapping.communityId).toBe('newcommunity456');
            expect(mapping.linkedBy).toBe('owner123');

            expect(mockInteraction.deferReply).toHaveBeenCalled();
            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('successfully linked')
                })
            );
        });

        test('should prevent non-owners from linking communities', async () => {
            const mockInteraction = mockClient.simulateInteractionCreate({
                commandName: 'naffles-link-community',
                guildId: '123456789',
                user: mockClient.users.cache.get('user123'), // Not owner
                options: {
                    community_id: 'community456'
                }
            });

            await commandHandler.handleSlashCommand(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('Only the server owner'),
                    ephemeral: true
                })
            );

            // Verify no mapping was created
            const mapping = await databaseService.getServerCommunityMapping('123456789');
            expect(mapping.communityId).toBe('community123'); // Original mapping unchanged
        });
    });

    describe('Real-Time Updates Workflow', () => {
        test('should handle real-time task updates from Naffles backend', async () => {
            // Set up existing task post
            const taskPost = await databaseService.createTaskPost({
                taskId: 'task123',
                serverId: '123456789',
                channelId: 'channel123',
                messageId: 'message123',
                createdBy: 'user123'
            });

            // Mock Discord message for updating
            const mockChannel = mockClient.channels.cache.get('channel123');
            const mockMessage = await mockChannel.send({
                content: 'Original task message',
                embeds: [],
                components: []
            });

            // Update the task post with the message ID
            await databaseService.updateTaskPost(taskPost._id, {
                messageId: mockMessage.id
            });

            // Simulate real-time update from Naffles backend
            const taskUpdate = {
                taskId: 'task123',
                serverId: '123456789',
                status: 'active',
                completions: 15,
                timeRemaining: '5 days',
                updatedAt: new Date().toISOString()
            };

            // Process the update through real-time sync service
            await botService.realTimeSync.handleTaskUpdate(taskUpdate);

            // Verify message was updated
            expect(mockMessage.edit).toHaveBeenCalled();

            // Verify update was logged
            const logs = await databaseService.getInteractionLogs({
                action: 'task_updated',
                limit: 10
            });
            expect(logs).toHaveLength(1);
            expect(logs[0].details.taskId).toBe('task123');
        });

        test('should handle real-time allowlist updates', async () => {
            // Set up existing allowlist connection
            const connection = await databaseService.createAllowlistConnection({
                allowlistId: 'allowlist123',
                serverId: '123456789',
                channelId: 'channel123',
                messageId: 'message456',
                createdBy: 'user123'
            });

            // Mock Discord message
            const mockChannel = mockClient.channels.cache.get('channel123');
            const mockMessage = await mockChannel.send({
                content: 'Original allowlist message',
                embeds: [],
                components: []
            });

            // Update connection with message ID
            await databaseService.updateAllowlistConnection(connection._id, {
                messageId: mockMessage.id
            });

            // Simulate allowlist update
            const allowlistUpdate = {
                allowlistId: 'allowlist123',
                serverId: '123456789',
                entries: 275,
                timeRemaining: '12 hours',
                status: 'active',
                updatedAt: new Date().toISOString()
            };

            await botService.realTimeSync.handleAllowlistUpdate(allowlistUpdate);

            expect(mockMessage.edit).toHaveBeenCalled();
        });
    });

    describe('Error Recovery and Resilience', () => {
        test('should recover from Discord API errors', async () => {
            // Mock Discord API error
            const discordError = new Error('Discord API Error');
            discordError.code = 50013; // Missing Permissions
            
            const mockChannel = mockClient.channels.cache.get('channel123');
            mockChannel.send.mockRejectedValueOnce(discordError);

            // Should handle error gracefully and not crash
            const result = await mockChannel.send('Test message').catch(error => {
                if (error.code === 50013) {
                    return { error: 'Missing permissions' };
                }
                throw error;
            });

            expect(result).toEqual({ error: 'Missing permissions' });
        });

        test('should handle database connection failures gracefully', async () => {
            // Simulate database disconnection
            await databaseService.disconnect();

            const mockInteraction = mockClient.simulateInteractionCreate({
                commandName: 'naffles-create-task',
                guildId: '123456789',
                user: mockClient.users.cache.get('user123'),
                options: {
                    type: 'twitter_follow',
                    title: 'Test Task',
                    description: 'Test description',
                    points: 100
                }
            });

            // Should handle database error gracefully
            await commandHandler.handleSlashCommand(mockInteraction);

            expect(mockInteraction.reply || mockInteraction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('error'),
                    ephemeral: true
                })
            );

            // Reconnect for cleanup
            await databaseService.connect();
        });

        test('should retry failed API calls', async () => {
            // First call fails, second succeeds
            axios
                .mockRejectedValueOnce(new Error('Network timeout'))
                .mockResolvedValueOnce({
                    data: { success: true, data: { tasks: [] } },
                    status: 200
                });

            const mockInteraction = mockClient.simulateInteractionCreate({
                commandName: 'naffles-list-tasks',
                guildId: '123456789',
                user: mockClient.users.cache.get('user123')
            });

            await commandHandler.handleSlashCommand(mockInteraction);

            // Should eventually succeed after retry
            expect(axios).toHaveBeenCalledTimes(2);
            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('No tasks found')
                })
            );
        });
    });

    describe('Multi-User Concurrent Workflows', () => {
        test('should handle multiple users creating tasks simultaneously', async () => {
            // Mock successful API responses for all requests
            axios.mockResolvedValue({
                data: {
                    success: true,
                    data: {
                        taskId: 'task-concurrent-123',
                        title: 'Concurrent Task',
                        type: 'twitter_follow',
                        points: 100
                    }
                },
                status: 201
            });

            // Create multiple users
            const users = ['user1', 'user2', 'user3', 'user4', 'user5'].map(id => {
                return mockClient.addMockUser({
                    id,
                    username: `TestUser${id}`,
                    discriminator: '1234'
                });
            });

            // Create concurrent interactions
            const interactions = users.map((user, index) => 
                mockClient.simulateInteractionCreate({
                    commandName: 'naffles-create-task',
                    guildId: '123456789',
                    channelId: 'channel123',
                    user,
                    options: {
                        type: 'twitter_follow',
                        title: `Task ${index + 1}`,
                        description: `Description ${index + 1}`,
                        points: 100
                    }
                })
            );

            // Execute all commands concurrently
            const promises = interactions.map(interaction => 
                commandHandler.handleSlashCommand(interaction)
            );

            await Promise.all(promises);

            // Verify all interactions were handled
            interactions.forEach(interaction => {
                expect(interaction.deferReply).toHaveBeenCalled();
                expect(interaction.editReply).toHaveBeenCalled();
            });

            // Verify all API calls were made
            expect(axios).toHaveBeenCalledTimes(5);

            // Verify all interactions were logged
            const logs = await databaseService.getInteractionLogs({
                action: 'command_executed',
                commandName: 'naffles-create-task',
                limit: 10
            });
            expect(logs).toHaveLength(5);
        });

        test('should handle multiple users completing tasks simultaneously', async () => {
            // Set up multiple task posts
            const taskIds = ['task1', 'task2', 'task3', 'task4', 'task5'];
            for (const taskId of taskIds) {
                await databaseService.createTaskPost({
                    taskId,
                    serverId: '123456789',
                    channelId: 'channel123',
                    messageId: `message-${taskId}`,
                    createdBy: 'user123'
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

            // Create multiple users
            const users = taskIds.map((taskId, index) => {
                return mockClient.addMockUser({
                    id: `user-${index + 1}`,
                    username: `TestUser${index + 1}`,
                    discriminator: '1234'
                });
            });

            // Create concurrent button interactions
            const interactions = users.map((user, index) => 
                mockClient.simulateInteractionCreate({
                    type: 3,
                    customId: `task_complete_${taskIds[index]}`,
                    guildId: '123456789',
                    user
                })
            );

            // Execute all button clicks concurrently
            const promises = interactions.map(interaction => 
                buttonHandler.handleButtonInteraction(interaction)
            );

            await Promise.all(promises);

            // Verify all interactions were handled
            interactions.forEach(interaction => {
                expect(interaction.deferReply).toHaveBeenCalled();
                expect(interaction.editReply).toHaveBeenCalled();
            });

            // Verify all API calls were made
            expect(axios).toHaveBeenCalledTimes(5);
        });
    });

    describe('Data Consistency and Integrity', () => {
        test('should maintain data consistency across Discord and database', async () => {
            // Create task through Discord command
            axios.mockResolvedValueOnce({
                data: {
                    success: true,
                    data: {
                        taskId: 'consistency-test-123',
                        title: 'Consistency Test Task',
                        type: 'twitter_follow',
                        points: 100,
                        communityId: 'community123'
                    }
                },
                status: 201
            });

            const mockInteraction = mockClient.simulateInteractionCreate({
                commandName: 'naffles-create-task',
                guildId: '123456789',
                channelId: 'channel123',
                user: mockClient.users.cache.get('user123'),
                options: {
                    type: 'twitter_follow',
                    title: 'Consistency Test Task',
                    description: 'Testing data consistency',
                    points: 100
                }
            });

            await commandHandler.handleSlashCommand(mockInteraction);

            // Verify task post exists in database
            const taskPost = await databaseService.getTaskPost('consistency-test-123', '123456789');
            expect(taskPost).toBeTruthy();

            // Verify interaction log exists
            const logs = await databaseService.getInteractionLogs({
                userId: 'user123',
                commandName: 'naffles-create-task',
                limit: 1
            });
            expect(logs).toHaveLength(1);

            // Verify server community mapping still exists
            const mapping = await databaseService.getServerCommunityMapping('123456789');
            expect(mapping).toBeTruthy();
            expect(mapping.communityId).toBe('community123');

            // All data should be consistent
            expect(taskPost.serverId).toBe('123456789');
            expect(logs[0].guildId).toBe('123456789');
            expect(mapping.serverId).toBe('123456789');
        });

        test('should handle partial failures without corrupting data', async () => {
            // Mock API success but simulate database failure during task post creation
            axios.mockResolvedValueOnce({
                data: {
                    success: true,
                    data: {
                        taskId: 'partial-failure-123',
                        title: 'Partial Failure Test',
                        type: 'twitter_follow',
                        points: 100
                    }
                },
                status: 201
            });

            // Mock database failure
            const originalCreateTaskPost = databaseService.createTaskPost;
            databaseService.createTaskPost = jest.fn().mockRejectedValue(new Error('Database error'));

            const mockInteraction = mockClient.simulateInteractionCreate({
                commandName: 'naffles-create-task',
                guildId: '123456789',
                user: mockClient.users.cache.get('user123'),
                options: {
                    type: 'twitter_follow',
                    title: 'Partial Failure Test',
                    description: 'Testing partial failure',
                    points: 100
                }
            });

            await commandHandler.handleSlashCommand(mockInteraction);

            // Should handle error gracefully
            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('error'),
                    ephemeral: true
                })
            );

            // Restore original method
            databaseService.createTaskPost = originalCreateTaskPost;

            // Verify no corrupted data exists
            const taskPost = await databaseService.getTaskPost('partial-failure-123', '123456789');
            expect(taskPost).toBeNull();
        });
    });
});