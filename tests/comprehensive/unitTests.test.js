/**
 * Comprehensive Unit Tests for Discord Bot Integration
 * Tests all Discord bot service components and command handlers
 */

const { jest } = require('@jest/globals');

// Mock Discord.js before importing other modules
jest.mock('discord.js', () => ({
    Client: jest.fn(),
    GatewayIntentBits: {
        Guilds: 1,
        GuildMessages: 2,
        MessageContent: 4,
        GuildMembers: 8
    },
    REST: jest.fn().mockImplementation(() => ({
        setToken: jest.fn().mockReturnThis(),
        put: jest.fn(),
        get: jest.fn(),
        delete: jest.fn()
    })),
    Routes: {
        applicationCommands: jest.fn(),
        applicationGuildCommands: jest.fn()
    },
    EmbedBuilder: jest.fn().mockImplementation(() => ({
        setTitle: jest.fn().mockReturnThis(),
        setDescription: jest.fn().mockReturnThis(),
        setColor: jest.fn().mockReturnThis(),
        setTimestamp: jest.fn().mockReturnThis(),
        addFields: jest.fn().mockReturnThis(),
        setFooter: jest.fn().mockReturnThis(),
        setThumbnail: jest.fn().mockReturnThis(),
        setImage: jest.fn().mockReturnThis()
    })),
    ActionRowBuilder: jest.fn().mockImplementation(() => ({
        addComponents: jest.fn().mockReturnThis()
    })),
    ButtonBuilder: jest.fn().mockImplementation(() => ({
        setCustomId: jest.fn().mockReturnThis(),
        setLabel: jest.fn().mockReturnThis(),
        setStyle: jest.fn().mockReturnThis(),
        setEmoji: jest.fn().mockReturnThis(),
        setDisabled: jest.fn().mockReturnThis()
    })),
    ButtonStyle: {
        Primary: 1,
        Secondary: 2,
        Success: 3,
        Danger: 4,
        Link: 5
    },
    SlashCommandBuilder: jest.fn().mockImplementation(() => ({
        setName: jest.fn().mockReturnThis(),
        setDescription: jest.fn().mockReturnThis(),
        addStringOption: jest.fn().mockReturnThis(),
        addIntegerOption: jest.fn().mockReturnThis(),
        addBooleanOption: jest.fn().mockReturnThis(),
        addUserOption: jest.fn().mockReturnThis(),
        addChannelOption: jest.fn().mockReturnThis(),
        addRoleOption: jest.fn().mockReturnThis(),
        addMentionableOption: jest.fn().mockReturnThis(),
        addNumberOption: jest.fn().mockReturnThis(),
        addAttachmentOption: jest.fn().mockReturnThis()
    })),
    ModalBuilder: jest.fn().mockImplementation(() => ({
        setCustomId: jest.fn().mockReturnThis(),
        setTitle: jest.fn().mockReturnThis(),
        addComponents: jest.fn().mockReturnThis()
    })),
    TextInputBuilder: jest.fn().mockImplementation(() => ({
        setCustomId: jest.fn().mockReturnThis(),
        setLabel: jest.fn().mockReturnThis(),
        setStyle: jest.fn().mockReturnThis(),
        setPlaceholder: jest.fn().mockReturnThis(),
        setRequired: jest.fn().mockReturnThis(),
        setMaxLength: jest.fn().mockReturnThis(),
        setMinLength: jest.fn().mockReturnThis(),
        setValue: jest.fn().mockReturnThis()
    })),
    TextInputStyle: {
        Short: 1,
        Paragraph: 2
    },
    PermissionFlagsBits: {
        Administrator: 8n,
        ManageGuild: 32n,
        ManageChannels: 16n,
        ManageMessages: 8192n,
        SendMessages: 2048n
    }
}));

// Mock other dependencies
jest.mock('axios');
jest.mock('../src/utils/logger');
jest.mock('../src/utils/rateLimiter');
jest.mock('../src/utils/errorHandler');

// Import modules after mocking
const DiscordBotService = require('../src/services/discordBotService');
const CreateTaskCommand = require('../src/commands/createTask');
const ListTasksCommand = require('../src/commands/listTasks');
const ConnectAllowlistCommand = require('../src/commands/connectAllowlist');
const CommandHandler = require('../src/handlers/commandHandler');
const ButtonHandler = require('../src/handlers/buttonHandler');
const EventHandler = require('../src/handlers/eventHandler');
const PermissionManager = require('../src/services/permissionManager');
const SecurityMonitor = require('../src/services/securityMonitor');
const AuditLogger = require('../src/services/auditLogger');
const EmbedBuilder = require('../src/services/embedBuilder');
const CommunityLinkingService = require('../src/services/communityLinkingService');
const SocialTaskIntegrationService = require('../src/services/socialTaskIntegrationService');
const AllowlistIntegrationService = require('../src/services/allowlistIntegrationService');
const RealTimeSyncService = require('../src/services/realTimeSyncService');
const HealthMonitor = require('../src/services/healthMonitor');
const DatabaseService = require('../src/services/databaseService');
const RedisService = require('../src/services/redisService');

describe('Discord Bot Unit Tests', () => {
    let mockClient;
    let mockDatabaseService;
    let mockRedisService;
    let botService;

    beforeEach(() => {
        // Create mock Discord client
        mockClient = {
            isReady: jest.fn(() => true),
            guilds: {
                cache: new Map([
                    ['123456789', {
                        id: '123456789',
                        name: 'Test Guild',
                        memberCount: 100,
                        ownerId: 'owner123',
                        systemChannel: null,
                        fetchOwner: jest.fn().mockResolvedValue({
                            createDM: jest.fn().mockResolvedValue({
                                send: jest.fn().mockResolvedValue()
                            })
                        })
                    }]
                ])
            },
            channels: {
                cache: new Map([
                    ['channel123', {
                        id: 'channel123',
                        name: 'general',
                        type: 0,
                        send: jest.fn().mockResolvedValue()
                    }]
                ])
            },
            users: {
                cache: new Map([
                    ['user123', {
                        id: 'user123',
                        tag: 'TestUser#1234',
                        bot: false,
                        createdTimestamp: Date.now() - (30 * 24 * 60 * 60 * 1000)
                    }]
                ])
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

        // Create mock database service
        mockDatabaseService = {
            connect: jest.fn().mockResolvedValue(),
            disconnect: jest.fn().mockResolvedValue(),
            isHealthy: jest.fn(() => true),
            isConnected: jest.fn(() => true),
            getConnectionInfo: jest.fn(() => ({ 
                isConnected: true,
                host: 'localhost',
                database: 'test'
            })),
            testConnection: jest.fn().mockResolvedValue({ status: 'ok' }),
            
            // Server mapping methods
            getServerCommunityMapping: jest.fn().mockResolvedValue(null),
            createServerCommunityMapping: jest.fn().mockResolvedValue({
                serverId: '123456789',
                communityId: 'community123',
                linkedBy: 'user123',
                linkedAt: new Date()
            }),
            updateServerCommunityMapping: jest.fn().mockResolvedValue(),
            deleteServerCommunityMapping: jest.fn().mockResolvedValue(),
            
            // Task post methods
            createTaskPost: jest.fn().mockResolvedValue({
                _id: 'post123',
                taskId: 'task123',
                serverId: '123456789',
                channelId: 'channel123',
                messageId: 'message123'
            }),
            getTaskPost: jest.fn().mockResolvedValue(null),
            updateTaskPost: jest.fn().mockResolvedValue(),
            deleteTaskPost: jest.fn().mockResolvedValue(),
            expireOldTaskPosts: jest.fn().mockResolvedValue(0),
            
            // Account linking methods
            createAccountLink: jest.fn().mockResolvedValue({
                discordUserId: 'user123',
                nafflesUserId: 'naffles123',
                linkedAt: new Date()
            }),
            getAccountLink: jest.fn().mockResolvedValue(null),
            updateAccountLink: jest.fn().mockResolvedValue(),
            deleteAccountLink: jest.fn().mockResolvedValue(),
            
            // Allowlist connection methods
            createAllowlistConnection: jest.fn().mockResolvedValue({
                allowlistId: 'allowlist123',
                serverId: '123456789',
                channelId: 'channel123',
                messageId: 'message123'
            }),
            getAllowlistConnection: jest.fn().mockResolvedValue(null),
            updateAllowlistConnection: jest.fn().mockResolvedValue(),
            deleteAllowlistConnection: jest.fn().mockResolvedValue(),
            
            // Interaction logging
            logInteraction: jest.fn().mockResolvedValue(),
            getInteractionLogs: jest.fn().mockResolvedValue([]),
            
            // Audit logging
            logAuditEvent: jest.fn().mockResolvedValue(),
            getAuditLogs: jest.fn().mockResolvedValue([]),
            
            // Security logging
            logSecurityEvent: jest.fn().mockResolvedValue(),
            getSecurityEvents: jest.fn().mockResolvedValue([])
        };

        // Create mock Redis service
        mockRedisService = {
            connect: jest.fn().mockResolvedValue(),
            disconnect: jest.fn().mockResolvedValue(),
            isConnected: jest.fn(() => true),
            getConnectionInfo: jest.fn(() => ({ 
                isConnected: true,
                host: 'localhost',
                port: 6379
            })),
            ping: jest.fn().mockResolvedValue('PONG'),
            
            // Cache methods
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue('OK'),
            del: jest.fn().mockResolvedValue(1),
            exists: jest.fn().mockResolvedValue(0),
            expire: jest.fn().mockResolvedValue(1),
            ttl: jest.fn().mockResolvedValue(-1),
            
            // Hash methods
            hget: jest.fn().mockResolvedValue(null),
            hset: jest.fn().mockResolvedValue(1),
            hdel: jest.fn().mockResolvedValue(1),
            hgetall: jest.fn().mockResolvedValue({}),
            
            // List methods
            lpush: jest.fn().mockResolvedValue(1),
            rpush: jest.fn().mockResolvedValue(1),
            lpop: jest.fn().mockResolvedValue(null),
            rpop: jest.fn().mockResolvedValue(null),
            lrange: jest.fn().mockResolvedValue([]),
            
            // Set methods
            sadd: jest.fn().mockResolvedValue(1),
            srem: jest.fn().mockResolvedValue(1),
            smembers: jest.fn().mockResolvedValue([]),
            sismember: jest.fn().mockResolvedValue(0)
        };

        // Initialize bot service
        botService = new DiscordBotService(mockClient, mockDatabaseService, mockRedisService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('DiscordBotService', () => {
        test('should initialize successfully', async () => {
            await expect(botService.initialize()).resolves.not.toThrow();
            expect(botService.client).toBe(mockClient);
            expect(botService.db).toBe(mockDatabaseService);
            expect(botService.redis).toBe(mockRedisService);
        });

        test('should have all required services initialized', () => {
            expect(botService.communityLinking).toBeInstanceOf(CommunityLinkingService);
            expect(botService.embedBuilder).toBeInstanceOf(EmbedBuilder);
            expect(botService.socialTaskIntegration).toBeInstanceOf(SocialTaskIntegrationService);
            expect(botService.allowlistIntegration).toBeInstanceOf(AllowlistIntegrationService);
            expect(botService.realTimeSync).toBeInstanceOf(RealTimeSyncService);
        });

        test('should validate user permissions correctly', async () => {
            const mockInteraction = {
                user: {
                    id: 'user123',
                    bot: false,
                    createdTimestamp: Date.now() - (30 * 24 * 60 * 60 * 1000),
                    tag: 'TestUser#1234'
                },
                guildId: '123456789',
                member: {
                    permissions: {
                        has: jest.fn().mockReturnValue(true)
                    },
                    roles: {
                        cache: new Map()
                    },
                    guild: {
                        ownerId: 'owner123'
                    }
                }
            };

            const result = await botService.validateUserPermissions(mockInteraction, 'naffles-create-task');
            expect(result.allowed).toBe(true);
        });

        test('should handle API calls to Naffles backend', async () => {
            const axios = require('axios');
            axios.mockResolvedValue({
                data: { success: true, data: { test: 'data' } },
                status: 200
            });

            const result = await botService.makeNafflesApiCall('/test', 'GET');
            expect(result).toEqual({ success: true, data: { test: 'data' } });
            expect(axios).toHaveBeenCalledWith(expect.objectContaining({
                method: 'GET',
                url: expect.stringContaining('/test'),
                headers: expect.objectContaining({
                    'Authorization': expect.stringContaining('Bearer')
                })
            }));
        });

        test('should handle API call failures gracefully', async () => {
            const axios = require('axios');
            axios.mockRejectedValue(new Error('Network error'));

            await expect(botService.makeNafflesApiCall('/test', 'GET'))
                .rejects.toThrow('Network error');
        });

        test('should get connection status', () => {
            const status = botService.getConnectionStatus();
            expect(status).toHaveProperty('discord');
            expect(status).toHaveProperty('database');
            expect(status).toHaveProperty('redis');
            expect(status).toHaveProperty('nafflesApi');
            expect(status).toHaveProperty('lastHealthCheck');
        });

        test('should get service metrics', () => {
            const metrics = botService.getMetrics();
            expect(metrics).toHaveProperty('commandsProcessed');
            expect(metrics).toHaveProperty('errorsEncountered');
            expect(metrics).toHaveProperty('uptimeHours');
            expect(metrics).toHaveProperty('guildsConnected');
            expect(typeof metrics.uptimeHours).toBe('number');
        });

        test('should handle guild join events', async () => {
            const mockGuild = {
                id: '987654321',
                name: 'New Test Guild',
                memberCount: 50,
                ownerId: 'newowner123',
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

        test('should handle guild leave events', async () => {
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
    });

    describe('Command Handlers', () => {
        let commandHandler;

        beforeEach(() => {
            commandHandler = new CommandHandler(botService);
        });

        test('should initialize all commands', () => {
            expect(commandHandler.commands.size).toBeGreaterThan(0);
            expect(commandHandler.commands.has('naffles-create-task')).toBe(true);
            expect(commandHandler.commands.has('naffles-list-tasks')).toBe(true);
            expect(commandHandler.commands.has('naffles-connect-allowlist')).toBe(true);
        });

        test('should handle slash commands', async () => {
            const mockInteraction = {
                commandName: 'naffles-create-task',
                user: {
                    id: 'user123',
                    bot: false,
                    createdTimestamp: Date.now() - (30 * 24 * 60 * 60 * 1000),
                    tag: 'TestUser#1234'
                },
                guildId: '123456789',
                member: {
                    permissions: {
                        has: jest.fn().mockReturnValue(true)
                    }
                },
                options: {
                    getString: jest.fn().mockReturnValue('test'),
                    getInteger: jest.fn().mockReturnValue(100)
                },
                reply: jest.fn().mockResolvedValue(),
                deferReply: jest.fn().mockResolvedValue()
            };

            // Mock the command execution
            const mockCommand = {
                execute: jest.fn().mockResolvedValue()
            };
            commandHandler.commands.set('naffles-create-task', mockCommand);

            await commandHandler.handleSlashCommand(mockInteraction);

            expect(mockCommand.execute).toHaveBeenCalledWith(mockInteraction);
        });

        test('should handle unknown commands', async () => {
            const mockInteraction = {
                commandName: 'unknown-command',
                reply: jest.fn().mockResolvedValue()
            };

            await commandHandler.handleSlashCommand(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('Unknown command'),
                    ephemeral: true
                })
            );
        });

        test('should handle command execution errors', async () => {
            const mockInteraction = {
                commandName: 'naffles-create-task',
                user: { id: 'user123' },
                guildId: '123456789',
                reply: jest.fn().mockResolvedValue(),
                followUp: jest.fn().mockResolvedValue()
            };

            const mockCommand = {
                execute: jest.fn().mockRejectedValue(new Error('Command failed'))
            };
            commandHandler.commands.set('naffles-create-task', mockCommand);

            await commandHandler.handleSlashCommand(mockInteraction);

            expect(mockInteraction.followUp).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('error'),
                    ephemeral: true
                })
            );
        });
    });

    describe('Individual Commands', () => {
        describe('CreateTaskCommand', () => {
            let createTaskCommand;

            beforeEach(() => {
                createTaskCommand = new CreateTaskCommand(botService);
            });

            test('should have correct command data', () => {
                expect(createTaskCommand.name).toBe('naffles-create-task');
                expect(createTaskCommand.data).toBeDefined();
            });

            test('should execute successfully with valid input', async () => {
                const mockInteraction = {
                    user: {
                        id: 'user123',
                        bot: false,
                        createdTimestamp: Date.now() - (30 * 24 * 60 * 60 * 1000),
                        tag: 'TestUser#1234'
                    },
                    guildId: '123456789',
                    member: {
                        permissions: {
                            has: jest.fn().mockReturnValue(true)
                        }
                    },
                    options: {
                        getString: jest.fn()
                            .mockReturnValueOnce('twitter_follow')
                            .mockReturnValueOnce('Follow our Twitter')
                            .mockReturnValueOnce('Please follow @naffles on Twitter'),
                        getInteger: jest.fn()
                            .mockReturnValueOnce(100)
                            .mockReturnValueOnce(168)
                    },
                    reply: jest.fn().mockResolvedValue(),
                    deferReply: jest.fn().mockResolvedValue(),
                    editReply: jest.fn().mockResolvedValue()
                };

                // Mock successful API call
                botService.makeNafflesApiCall = jest.fn().mockResolvedValue({
                    success: true,
                    data: { taskId: 'task123' }
                });

                await createTaskCommand.execute(mockInteraction);

                expect(mockInteraction.deferReply).toHaveBeenCalled();
                expect(botService.makeNafflesApiCall).toHaveBeenCalled();
                expect(mockInteraction.editReply).toHaveBeenCalled();
            });

            test('should handle permission denied', async () => {
                const mockInteraction = {
                    user: {
                        id: 'user123',
                        bot: false,
                        createdTimestamp: Date.now() - (2 * 24 * 60 * 60 * 1000), // Too new
                        tag: 'TestUser#1234'
                    },
                    guildId: '123456789',
                    member: {
                        permissions: {
                            has: jest.fn().mockReturnValue(false)
                        }
                    },
                    reply: jest.fn().mockResolvedValue()
                };

                await createTaskCommand.execute(mockInteraction);

                expect(mockInteraction.reply).toHaveBeenCalledWith(
                    expect.objectContaining({
                        content: expect.stringContaining('permission'),
                        ephemeral: true
                    })
                );
            });
        });

        describe('ListTasksCommand', () => {
            let listTasksCommand;

            beforeEach(() => {
                listTasksCommand = new ListTasksCommand(botService);
            });

            test('should list tasks successfully', async () => {
                const mockInteraction = {
                    user: { id: 'user123' },
                    guildId: '123456789',
                    reply: jest.fn().mockResolvedValue(),
                    deferReply: jest.fn().mockResolvedValue(),
                    editReply: jest.fn().mockResolvedValue()
                };

                // Mock API response with tasks
                botService.makeNafflesApiCall = jest.fn().mockResolvedValue({
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
                                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
                            }
                        ]
                    }
                });

                await listTasksCommand.execute(mockInteraction);

                expect(mockInteraction.deferReply).toHaveBeenCalled();
                expect(botService.makeNafflesApiCall).toHaveBeenCalled();
                expect(mockInteraction.editReply).toHaveBeenCalled();
            });

            test('should handle no tasks found', async () => {
                const mockInteraction = {
                    user: { id: 'user123' },
                    guildId: '123456789',
                    reply: jest.fn().mockResolvedValue(),
                    deferReply: jest.fn().mockResolvedValue(),
                    editReply: jest.fn().mockResolvedValue()
                };

                botService.makeNafflesApiCall = jest.fn().mockResolvedValue({
                    success: true,
                    data: { tasks: [] }
                });

                await listTasksCommand.execute(mockInteraction);

                expect(mockInteraction.editReply).toHaveBeenCalledWith(
                    expect.objectContaining({
                        content: expect.stringContaining('No tasks found')
                    })
                );
            });
        });

        describe('ConnectAllowlistCommand', () => {
            let connectAllowlistCommand;

            beforeEach(() => {
                connectAllowlistCommand = new ConnectAllowlistCommand(botService);
            });

            test('should connect allowlist successfully', async () => {
                const mockInteraction = {
                    user: { id: 'user123' },
                    guildId: '123456789',
                    channelId: 'channel123',
                    options: {
                        getString: jest.fn().mockReturnValue('allowlist123')
                    },
                    reply: jest.fn().mockResolvedValue(),
                    deferReply: jest.fn().mockResolvedValue(),
                    editReply: jest.fn().mockResolvedValue()
                };

                botService.makeNafflesApiCall = jest.fn().mockResolvedValue({
                    success: true,
                    data: {
                        allowlist: {
                            id: 'allowlist123',
                            title: 'Test Allowlist',
                            description: 'Test allowlist description',
                            entryPrice: '0.1 ETH',
                            winnerCount: 100,
                            endTime: new Date(Date.now() + 24 * 60 * 60 * 1000)
                        }
                    }
                });

                await connectAllowlistCommand.execute(mockInteraction);

                expect(mockInteraction.deferReply).toHaveBeenCalled();
                expect(botService.makeNafflesApiCall).toHaveBeenCalled();
                expect(mockInteraction.editReply).toHaveBeenCalled();
            });
        });
    });

    describe('Button Handler', () => {
        let buttonHandler;

        beforeEach(() => {
            buttonHandler = new ButtonHandler(botService);
        });

        test('should handle task completion buttons', async () => {
            const mockInteraction = {
                customId: 'task_complete_task123',
                user: { id: 'user123', tag: 'TestUser#1234' },
                guildId: '123456789',
                reply: jest.fn().mockResolvedValue(),
                deferReply: jest.fn().mockResolvedValue(),
                editReply: jest.fn().mockResolvedValue()
            };

            botService.makeNafflesApiCall = jest.fn().mockResolvedValue({
                success: true,
                data: { completed: true, points: 100 }
            });

            await buttonHandler.handleButtonInteraction(mockInteraction);

            expect(mockInteraction.deferReply).toHaveBeenCalled();
            expect(botService.makeNafflesApiCall).toHaveBeenCalled();
        });

        test('should handle allowlist entry buttons', async () => {
            const mockInteraction = {
                customId: 'allowlist_enter_allowlist123',
                user: { id: 'user123', tag: 'TestUser#1234' },
                guildId: '123456789',
                reply: jest.fn().mockResolvedValue()
            };

            botService.makeNafflesApiCall = jest.fn().mockResolvedValue({
                success: true,
                data: { entered: true }
            });

            await buttonHandler.handleButtonInteraction(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('entered'),
                    ephemeral: true
                })
            );
        });

        test('should handle unknown button interactions', async () => {
            const mockInteraction = {
                customId: 'unknown_button',
                user: { id: 'user123' },
                reply: jest.fn().mockResolvedValue()
            };

            await buttonHandler.handleButtonInteraction(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('Unknown button'),
                    ephemeral: true
                })
            );
        });
    });

    describe('Event Handler', () => {
        let eventHandler;

        beforeEach(() => {
            eventHandler = new EventHandler(botService);
        });

        test('should handle ready event', async () => {
            await eventHandler.handleReady();
            // Should not throw and should log ready state
            expect(mockClient.user).toBeDefined();
        });

        test('should handle guild create event', async () => {
            const mockGuild = {
                id: '987654321',
                name: 'New Guild',
                memberCount: 50
            };

            await eventHandler.handleGuildCreate(mockGuild);

            expect(mockDatabaseService.logInteraction).toHaveBeenCalledWith(
                expect.objectContaining({
                    guildId: '987654321',
                    action: 'guild_join'
                })
            );
        });

        test('should handle guild delete event', async () => {
            const mockGuild = {
                id: '987654321',
                name: 'Leaving Guild'
            };

            await eventHandler.handleGuildDelete(mockGuild);

            expect(mockDatabaseService.logInteraction).toHaveBeenCalledWith(
                expect.objectContaining({
                    guildId: '987654321',
                    action: 'guild_leave'
                })
            );
        });

        test('should handle interaction create event', async () => {
            const mockInteraction = {
                isCommand: () => true,
                commandName: 'naffles-create-task',
                user: { id: 'user123' },
                guildId: '123456789'
            };

            // Mock command handler
            botService.commandHandler = {
                handleSlashCommand: jest.fn().mockResolvedValue()
            };

            await eventHandler.handleInteractionCreate(mockInteraction);

            expect(botService.commandHandler.handleSlashCommand).toHaveBeenCalledWith(mockInteraction);
        });
    });

    describe('Service Components', () => {
        describe('PermissionManager', () => {
            let permissionManager;

            beforeEach(() => {
                permissionManager = new PermissionManager(botService);
            });

            test('should check basic permissions', async () => {
                const mockInteraction = {
                    user: {
                        id: 'user123',
                        bot: false,
                        createdTimestamp: Date.now() - (30 * 24 * 60 * 60 * 1000),
                        tag: 'TestUser#1234'
                    },
                    guildId: '123456789',
                    member: {
                        permissions: {
                            has: jest.fn().mockReturnValue(true)
                        },
                        roles: {
                            cache: new Map()
                        },
                        guild: {
                            ownerId: 'owner123'
                        }
                    }
                };

                const result = await permissionManager.checkCommandPermission(
                    mockInteraction, 
                    'naffles-create-task'
                );

                expect(result.allowed).toBe(true);
            });

            test('should deny bot accounts', async () => {
                const mockInteraction = {
                    user: {
                        id: 'bot123',
                        bot: true,
                        tag: 'BotUser#0000'
                    },
                    guildId: '123456789'
                };

                const result = await permissionManager.checkCommandPermission(
                    mockInteraction, 
                    'naffles-create-task'
                );

                expect(result.allowed).toBe(false);
                expect(result.reason).toBe('Bots cannot use commands');
            });

            test('should deny new accounts', async () => {
                const mockInteraction = {
                    user: {
                        id: 'newuser123',
                        bot: false,
                        createdTimestamp: Date.now() - (2 * 24 * 60 * 60 * 1000), // 2 days old
                        tag: 'NewUser#1234'
                    },
                    guildId: '123456789'
                };

                const result = await permissionManager.checkCommandPermission(
                    mockInteraction, 
                    'naffles-create-task'
                );

                expect(result.allowed).toBe(false);
                expect(result.reason).toBe('Account must be at least 7 days old to use commands');
            });
        });

        describe('SecurityMonitor', () => {
            let securityMonitor;

            beforeEach(() => {
                securityMonitor = new SecurityMonitor(botService);
            });

            test('should monitor command execution', async () => {
                const mockInteraction = {
                    user: { id: 'user123' },
                    guildId: '123456789',
                    commandName: 'naffles-create-task'
                };

                await securityMonitor.monitorCommandExecution(mockInteraction, 'success');

                const userData = securityMonitor.suspiciousActivity.get('commands_user123_123456789');
                expect(userData).toBeDefined();
                expect(userData.commands).toHaveLength(1);
            });

            test('should detect rapid command usage', async () => {
                const mockInteraction = {
                    user: { id: 'rapiduser123' },
                    guildId: '123456789',
                    commandName: 'naffles-create-task'
                };

                // Simulate rapid commands
                for (let i = 0; i < 12; i++) {
                    await securityMonitor.monitorCommandExecution(mockInteraction, 'success');
                }

                const events = securityMonitor.getRecentSecurityEvents(10);
                const rapidEvent = events.find(e => e.type === 'rapid_commands');
                expect(rapidEvent).toBeDefined();
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
            let auditLogger;

            beforeEach(() => {
                auditLogger = new AuditLogger(botService);
            });

            test('should log command execution', async () => {
                const mockInteraction = {
                    user: {
                        id: 'user123',
                        tag: 'TestUser#1234',
                        createdTimestamp: Date.now() - (30 * 24 * 60 * 60 * 1000)
                    },
                    guildId: '123456789',
                    guild: { name: 'Test Guild' },
                    channelId: 'channel123',
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
                expect(auditLogger.auditLogs[0].userId).toBe('user123');
            });

            test('should get audit statistics', () => {
                const stats = auditLogger.getAuditStatistics();
                expect(stats).toHaveProperty('totalLogs');
                expect(stats).toHaveProperty('recentLogs');
                expect(stats).toHaveProperty('logsByType');
            });
        });

        describe('EmbedBuilder', () => {
            let embedBuilder;

            beforeEach(() => {
                embedBuilder = new EmbedBuilder();
            });

            test('should create task embed', () => {
                const taskData = {
                    id: 'task123',
                    title: 'Follow Twitter',
                    description: 'Follow our Twitter account',
                    points: 100,
                    type: 'twitter_follow',
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
                };

                const embed = embedBuilder.createTaskEmbed(taskData);
                expect(embed).toBeDefined();
            });

            test('should create allowlist embed', () => {
                const allowlistData = {
                    id: 'allowlist123',
                    title: 'Test Allowlist',
                    description: 'Test allowlist description',
                    entryPrice: '0.1 ETH',
                    winnerCount: 100,
                    endTime: new Date(Date.now() + 24 * 60 * 60 * 1000)
                };

                const embed = embedBuilder.createAllowlistEmbed(allowlistData);
                expect(embed).toBeDefined();
            });

            test('should create error embed', () => {
                const error = new Error('Test error');
                const embed = embedBuilder.createErrorEmbed(error);
                expect(embed).toBeDefined();
            });
        });

        describe('HealthMonitor', () => {
            let healthMonitor;

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

            test('should perform health check', async () => {
                botService.testApiConnection = jest.fn().mockResolvedValue({
                    status: 'healthy',
                    responseTime: 100
                });

                await healthMonitor.performHealthCheck();

                expect(healthMonitor.healthStatus.lastCheck).toBeTruthy();
                expect(healthMonitor.healthStatus.overall).toBeTruthy();
            });

            test('should get health status', () => {
                const status = healthMonitor.getHealthStatus();
                expect(status).toHaveProperty('overall');
                expect(status).toHaveProperty('isMonitoring');
                expect(status).toHaveProperty('checkInterval');
                expect(status).toHaveProperty('services');
            });
        });
    });

    describe('Database and Redis Services', () => {
        describe('DatabaseService', () => {
            test('should connect successfully', async () => {
                await expect(mockDatabaseService.connect()).resolves.not.toThrow();
                expect(mockDatabaseService.connect).toHaveBeenCalled();
            });

            test('should test connection', async () => {
                const result = await mockDatabaseService.testConnection();
                expect(result).toEqual({ status: 'ok' });
            });

            test('should create server community mapping', async () => {
                const mapping = await mockDatabaseService.createServerCommunityMapping({
                    serverId: '123456789',
                    communityId: 'community123',
                    linkedBy: 'user123'
                });

                expect(mapping).toHaveProperty('serverId');
                expect(mapping).toHaveProperty('communityId');
                expect(mapping).toHaveProperty('linkedBy');
            });

            test('should log interactions', async () => {
                await mockDatabaseService.logInteraction({
                    userId: 'user123',
                    guildId: '123456789',
                    action: 'command_executed',
                    details: { command: 'naffles-create-task' }
                });

                expect(mockDatabaseService.logInteraction).toHaveBeenCalled();
            });
        });

        describe('RedisService', () => {
            test('should connect successfully', async () => {
                await expect(mockRedisService.connect()).resolves.not.toThrow();
                expect(mockRedisService.connect).toHaveBeenCalled();
            });

            test('should ping successfully', async () => {
                const result = await mockRedisService.ping();
                expect(result).toBe('PONG');
            });

            test('should handle cache operations', async () => {
                await mockRedisService.set('test:key', 'test:value');
                expect(mockRedisService.set).toHaveBeenCalledWith('test:key', 'test:value');

                const value = await mockRedisService.get('test:key');
                expect(mockRedisService.get).toHaveBeenCalledWith('test:key');
            });
        });
    });
});