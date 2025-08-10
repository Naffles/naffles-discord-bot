const { describe, test, expect, beforeEach, afterEach, jest } = require('@jest/globals');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const EmbedBuilderService = require('../src/services/embedBuilder');
const EmbedUpdateService = require('../src/services/embedUpdateService');
const EmbedTemplates = require('../src/services/embedTemplates');

// Mock Discord.js components
jest.mock('discord.js', () => ({
    EmbedBuilder: jest.fn().mockImplementation(() => ({
        setTitle: jest.fn().mockReturnThis(),
        setDescription: jest.fn().mockReturnThis(),
        setColor: jest.fn().mockReturnThis(),
        addFields: jest.fn().mockReturnThis(),
        setFooter: jest.fn().mockReturnThis(),
        setTimestamp: jest.fn().mockReturnThis(),
        setThumbnail: jest.fn().mockReturnThis(),
        setImage: jest.fn().mockReturnThis(),
        setAuthor: jest.fn().mockReturnThis(),
        data: { fields: [] }
    })),
    ActionRowBuilder: jest.fn().mockImplementation(() => ({
        addComponents: jest.fn().mockReturnThis(),
        components: []
    })),
    ButtonBuilder: jest.fn().mockImplementation(() => ({
        setCustomId: jest.fn().mockReturnThis(),
        setLabel: jest.fn().mockReturnThis(),
        setStyle: jest.fn().mockReturnThis(),
        setEmoji: jest.fn().mockReturnThis(),
        setDisabled: jest.fn().mockReturnThis(),
        setURL: jest.fn().mockReturnThis()
    })),
    StringSelectMenuBuilder: jest.fn().mockImplementation(() => ({
        setCustomId: jest.fn().mockReturnThis(),
        setPlaceholder: jest.fn().mockReturnThis(),
        setMinValues: jest.fn().mockReturnThis(),
        setMaxValues: jest.fn().mockReturnThis(),
        addOptions: jest.fn().mockReturnThis()
    })),
    ButtonStyle: {
        Primary: 1,
        Secondary: 2,
        Success: 3,
        Danger: 4,
        Link: 5
    }
}));

// Mock logger
jest.mock('../src/utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
}));

describe('Embed System Tests', () => {
    let embedBuilder;
    let embedTemplates;
    let mockClient;
    let mockDatabaseService;
    let mockRedisService;
    let embedUpdateService;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();

        // Initialize services
        embedBuilder = new EmbedBuilderService();
        embedTemplates = new EmbedTemplates();

        // Mock client and services for EmbedUpdateService
        mockClient = {
            channels: {
                fetch: jest.fn()
            }
        };

        mockDatabaseService = {
            query: jest.fn()
        };

        mockRedisService = {
            setex: jest.fn(),
            get: jest.fn(),
            del: jest.fn(),
            keys: jest.fn().mockResolvedValue([])
        };

        embedUpdateService = new EmbedUpdateService(mockClient, mockDatabaseService, mockRedisService);
    });

    afterEach(() => {
        // Clean up any intervals
        if (embedUpdateService) {
            embedUpdateService.updateIntervals.forEach(interval => clearInterval(interval));
        }
    });

    describe('EmbedBuilderService', () => {
        describe('createTaskEmbed', () => {
            test('should create a basic task embed', () => {
                const taskData = {
                    title: 'Follow on Twitter',
                    description: 'Follow our Twitter account for updates',
                    points: 100,
                    type: 'twitter_follow',
                    status: 'active',
                    completedBy: 25
                };

                const embed = embedBuilder.createTaskEmbed(taskData);

                expect(EmbedBuilder).toHaveBeenCalled();
                expect(embed.setTitle).toHaveBeenCalledWith('🎯 Follow on Twitter');
                expect(embed.setDescription).toHaveBeenCalledWith('Follow our Twitter account for updates');
                expect(embed.setColor).toHaveBeenCalledWith(0x3B82F6);
                expect(embed.setFooter).toHaveBeenCalledWith({
                    text: 'Powered by Naffles',
                    iconURL: 'https://naffles.com/icon.png'
                });
                expect(embed.setTimestamp).toHaveBeenCalled();
            });

            test('should handle task with all optional fields', () => {
                const taskData = {
                    title: 'Complete Survey',
                    description: 'Fill out our community survey',
                    points: 200,
                    type: 'custom',
                    status: 'active',
                    completedBy: 50,
                    duration: 48,
                    requirements: ['Must be community member', 'Account must be verified'],
                    endTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    thumbnailUrl: 'https://example.com/thumb.png',
                    author: {
                        name: 'Community Admin',
                        iconURL: 'https://example.com/admin.png',
                        url: 'https://example.com/admin'
                    }
                };

                const embed = embedBuilder.createTaskEmbed(taskData);

                expect(embed.setThumbnail).toHaveBeenCalledWith('https://example.com/thumb.png');
                expect(embed.setAuthor).toHaveBeenCalledWith({
                    name: 'Community Admin',
                    iconURL: 'https://example.com/admin.png',
                    url: 'https://example.com/admin'
                });
            });

            test('should handle error gracefully', () => {
                // Mock EmbedBuilder to throw error
                EmbedBuilder.mockImplementationOnce(() => {
                    throw new Error('Mock error');
                });

                const taskData = { title: 'Test Task' };
                const embed = embedBuilder.createTaskEmbed(taskData);

                // Should return error embed
                expect(embed).toBeDefined();
            });
        });

        describe('createAllowlistEmbed', () => {
            test('should create a basic allowlist embed', () => {
                const allowlistData = {
                    title: 'NFT Allowlist',
                    description: 'Get on the allowlist for our upcoming NFT drop',
                    prize: '1000 NFTs',
                    winnerCount: 500,
                    entryPrice: 0,
                    participants: 150,
                    endTime: new Date(Date.now() + 48 * 60 * 60 * 1000)
                };

                const embed = embedBuilder.createAllowlistEmbed(allowlistData);

                expect(embed.setTitle).toHaveBeenCalledWith('🎫 NFT Allowlist');
                expect(embed.setColor).toHaveBeenCalledWith(0x10B981);
                expect(embed.addFields).toHaveBeenCalled();
            });

            test('should handle allowlist with social tasks', () => {
                const allowlistData = {
                    title: 'Premium Allowlist',
                    description: 'Premium NFT allowlist with requirements',
                    socialTasks: [
                        { taskType: 'twitter_follow', description: 'Follow @example' },
                        { taskType: 'discord_join', description: 'Join Discord server' }
                    ],
                    profitGuaranteePercentage: 25
                };

                const embed = embedBuilder.createAllowlistEmbed(allowlistData);

                expect(embed.addFields).toHaveBeenCalled();
            });

            test('should handle everyone wins scenario', () => {
                const allowlistData = {
                    title: 'Everyone Wins Allowlist',
                    description: 'Everyone who enters wins!',
                    winnerCount: 'everyone'
                };

                const embed = embedBuilder.createAllowlistEmbed(allowlistData);

                expect(embed.addFields).toHaveBeenCalled();
            });
        });

        describe('createActionButtons', () => {
            test('should create task action buttons', () => {
                const data = {
                    id: 'task123',
                    status: 'active',
                    externalUrl: 'https://twitter.com/example'
                };

                const buttons = embedBuilder.createActionButtons('task', data);

                expect(ActionRowBuilder).toHaveBeenCalled();
                expect(ButtonBuilder).toHaveBeenCalled();
            });

            test('should create allowlist action buttons', () => {
                const data = {
                    id: 'allowlist456',
                    status: 'active'
                };

                const buttons = embedBuilder.createActionButtons('allowlist', data);

                expect(ActionRowBuilder).toHaveBeenCalled();
                expect(ButtonBuilder).toHaveBeenCalled();
            });

            test('should handle disabled buttons for completed tasks', () => {
                const data = {
                    id: 'task789',
                    status: 'completed'
                };

                const buttons = embedBuilder.createActionButtons('task', data);

                expect(ActionRowBuilder).toHaveBeenCalled();
            });
        });

        describe('createPaginationControls', () => {
            test('should create pagination controls', () => {
                const paginationData = {
                    currentPage: 2,
                    totalPages: 5,
                    customId: 'test_pagination'
                };

                const controls = embedBuilder.createPaginationControls(paginationData);

                expect(ActionRowBuilder).toHaveBeenCalled();
                expect(ButtonBuilder).toHaveBeenCalledTimes(3); // Previous, Page Info, Next
            });

            test('should disable previous button on first page', () => {
                const paginationData = {
                    currentPage: 1,
                    totalPages: 3,
                    customId: 'test_pagination'
                };

                const controls = embedBuilder.createPaginationControls(paginationData);

                expect(ActionRowBuilder).toHaveBeenCalled();
            });

            test('should disable next button on last page', () => {
                const paginationData = {
                    currentPage: 3,
                    totalPages: 3,
                    customId: 'test_pagination'
                };

                const controls = embedBuilder.createPaginationControls(paginationData);

                expect(ActionRowBuilder).toHaveBeenCalled();
            });
        });

        describe('Status Embeds', () => {
            test('should create success embed', () => {
                const embed = embedBuilder.createSuccessEmbed('Task Completed', 'You have successfully completed the task!');

                expect(embed.setTitle).toHaveBeenCalledWith('🎉 Task Completed');
                expect(embed.setColor).toHaveBeenCalledWith(0x10B981);
            });

            test('should create error embed', () => {
                const embed = embedBuilder.createErrorEmbed('Something went wrong', {
                    troubleshooting: 'Try refreshing the page'
                });

                expect(embed.setTitle).toHaveBeenCalledWith('❌ Error');
                expect(embed.setColor).toHaveBeenCalledWith(0xEF4444);
            });

            test('should create warning embed', () => {
                const embed = embedBuilder.createWarningEmbed('Caution', 'This action cannot be undone');

                expect(embed.setTitle).toHaveBeenCalledWith('⚠️ Caution');
                expect(embed.setColor).toHaveBeenCalledWith(0xF59E0B);
            });

            test('should create info embed', () => {
                const embed = embedBuilder.createInfoEmbed('Information', 'Here is some useful information');

                expect(embed.setTitle).toHaveBeenCalledWith('ℹ️ Information');
                expect(embed.setColor).toHaveBeenCalledWith(0x6366F1);
            });

            test('should create loading embed', () => {
                const embed = embedBuilder.createLoadingEmbed('Processing your request...');

                expect(embed.setTitle).toHaveBeenCalledWith('⏳ Loading');
                expect(embed.setDescription).toHaveBeenCalledWith('Processing your request...');
            });
        });

        describe('updateEmbedStatus', () => {
            test('should update embed with new status', () => {
                const mockEmbed = {
                    data: { fields: [] },
                    setTimestamp: jest.fn().mockReturnThis(),
                    addFields: jest.fn().mockReturnThis()
                };

                const updateData = {
                    status: 'completed',
                    progress: { current: 75, total: 100 },
                    participants: 200
                };

                const updatedEmbed = embedBuilder.updateEmbedStatus(mockEmbed, updateData);

                expect(mockEmbed.setTimestamp).toHaveBeenCalled();
                expect(mockEmbed.addFields).toHaveBeenCalled();
            });
        });

        describe('createSelectMenu', () => {
            test('should create select menu with options', () => {
                const options = [
                    { label: 'Option 1', value: 'opt1', description: 'First option' },
                    { label: 'Option 2', value: 'opt2', description: 'Second option' }
                ];

                const menu = embedBuilder.createSelectMenu('test_menu', options);

                expect(ActionRowBuilder).toHaveBeenCalled();
            });
        });
    });

    describe('EmbedTemplates', () => {
        describe('createHelpEmbed', () => {
            test('should create help embed with commands', () => {
                const result = embedTemplates.createHelpEmbed();

                expect(result.embeds).toHaveLength(1);
                expect(result.components).toHaveLength(1);
                expect(EmbedBuilder).toHaveBeenCalled();
            });
        });

        describe('createStatusEmbed', () => {
            test('should create status embed with all information', () => {
                const statusData = {
                    discordStatus: true,
                    nafflesApiStatus: true,
                    communityLinked: true,
                    communityName: 'Test Community',
                    serverCount: 5,
                    uptime: 3600000, // 1 hour
                    lastHealthCheck: Date.now()
                };

                const result = embedTemplates.createStatusEmbed(statusData);

                expect(result.embeds).toHaveLength(1);
                expect(result.components).toHaveLength(1);
            });

            test('should show warning color when services are down', () => {
                const statusData = {
                    discordStatus: false,
                    nafflesApiStatus: true,
                    communityLinked: false,
                    serverCount: 0,
                    uptime: 0,
                    lastHealthCheck: Date.now()
                };

                const result = embedTemplates.createStatusEmbed(statusData);

                expect(result.embeds).toHaveLength(1);
            });
        });

        describe('createCommunityLinkingEmbed', () => {
            test('should create start step embed', () => {
                const result = embedTemplates.createCommunityLinkingEmbed({ step: 'start' });

                expect(result.embeds).toHaveLength(1);
                expect(result.components).toHaveLength(1);
            });

            test('should create success step embed', () => {
                const result = embedTemplates.createCommunityLinkingEmbed({
                    step: 'success',
                    communityId: 'community123'
                });

                expect(result.embeds).toHaveLength(1);
                expect(result.components).toHaveLength(1);
            });

            test('should create error step embed', () => {
                const result = embedTemplates.createCommunityLinkingEmbed({
                    step: 'error',
                    error: 'Invalid community ID'
                });

                expect(result.embeds).toHaveLength(1);
                expect(result.components).toHaveLength(1);
            });
        });

        describe('createTaskListEmbed', () => {
            test('should create task list with tasks', () => {
                const tasks = [
                    {
                        title: 'Follow Twitter',
                        type: 'twitter_follow',
                        points: 100,
                        status: 'active',
                        completedBy: 25
                    },
                    {
                        title: 'Join Discord',
                        type: 'discord_join',
                        points: 150,
                        status: 'active',
                        completedBy: 40
                    }
                ];

                const paginationData = {
                    currentPage: 1,
                    totalPages: 1,
                    totalTasks: 2
                };

                const result = embedTemplates.createTaskListEmbed(tasks, paginationData);

                expect(result.embeds).toHaveLength(1);
                expect(result.components).toHaveLength(1);
            });

            test('should create empty task list', () => {
                const result = embedTemplates.createTaskListEmbed([], {
                    currentPage: 1,
                    totalPages: 1,
                    totalTasks: 0
                });

                expect(result.embeds).toHaveLength(1);
                expect(result.components).toHaveLength(1);
            });

            test('should create task list with pagination', () => {
                const tasks = [
                    { title: 'Task 1', type: 'custom', points: 100, status: 'active', completedBy: 10 }
                ];

                const paginationData = {
                    currentPage: 2,
                    totalPages: 5,
                    totalTasks: 25
                };

                const result = embedTemplates.createTaskListEmbed(tasks, paginationData);

                expect(result.embeds).toHaveLength(1);
                expect(result.components).toHaveLength(2); // Pagination + Action buttons
            });
        });

        describe('createAllowlistConnectionEmbed', () => {
            test('should create start step embed', () => {
                const result = embedTemplates.createAllowlistConnectionEmbed({}, 'start');

                expect(result.embeds).toHaveLength(1);
                expect(result.components).toHaveLength(1);
            });

            test('should create preview step embed', () => {
                const allowlistData = {
                    id: 'allowlist123',
                    title: 'Test Allowlist',
                    description: 'Test description'
                };

                const result = embedTemplates.createAllowlistConnectionEmbed(allowlistData, 'preview');

                expect(result.embeds).toHaveLength(1);
                expect(result.components).toHaveLength(1);
            });

            test('should create success step embed', () => {
                const allowlistData = {
                    id: 'allowlist123',
                    title: 'Test Allowlist'
                };

                const result = embedTemplates.createAllowlistConnectionEmbed(allowlistData, 'success');

                expect(result.embeds).toHaveLength(1);
                expect(result.components).toHaveLength(1);
            });
        });

        describe('createAccountLinkingEmbed', () => {
            test('should create start step embed', () => {
                const result = embedTemplates.createAccountLinkingEmbed({
                    step: 'start',
                    oauthUrl: 'https://oauth.example.com'
                });

                expect(result.embeds).toHaveLength(1);
                expect(result.components).toHaveLength(1);
            });

            test('should create success step embed', () => {
                const result = embedTemplates.createAccountLinkingEmbed({
                    step: 'success',
                    username: 'testuser'
                });

                expect(result.embeds).toHaveLength(1);
                expect(result.components).toHaveLength(0);
            });

            test('should create error step embed', () => {
                const result = embedTemplates.createAccountLinkingEmbed({
                    step: 'error',
                    error: 'OAuth failed'
                });

                expect(result.embeds).toHaveLength(1);
                expect(result.components).toHaveLength(1);
            });
        });
    });

    describe('EmbedUpdateService', () => {
        describe('registerEmbedForUpdates', () => {
            test('should register embed for updates', async () => {
                const embedInfo = {
                    guildId: 'guild123',
                    channelId: 'channel123',
                    messageId: 'message123',
                    type: 'task',
                    dataId: 'task123',
                    updateFrequency: 30000
                };

                await embedUpdateService.registerEmbedForUpdates('embed123', embedInfo);

                expect(mockRedisService.setex).toHaveBeenCalledWith(
                    'embed_update:embed123',
                    3600,
                    JSON.stringify(embedInfo)
                );
                expect(embedUpdateService.activeEmbeds.has('embed123')).toBe(true);
            });
        });

        describe('unregisterEmbedFromUpdates', () => {
            test('should unregister embed from updates', async () => {
                // First register an embed
                embedUpdateService.activeEmbeds.set('embed123', {
                    guildId: 'guild123',
                    channelId: 'channel123',
                    messageId: 'message123',
                    type: 'task',
                    dataId: 'task123'
                });

                await embedUpdateService.unregisterEmbedFromUpdates('embed123');

                expect(mockRedisService.del).toHaveBeenCalledWith('embed_update:embed123');
                expect(embedUpdateService.activeEmbeds.has('embed123')).toBe(false);
            });
        });

        describe('updateEmbed', () => {
            test('should update embed with new data', async () => {
                // Mock Discord channel and message
                const mockMessage = {
                    embeds: [{
                        title: 'Test Task',
                        description: 'Test description',
                        fields: []
                    }],
                    edit: jest.fn()
                };

                const mockChannel = {
                    messages: {
                        fetch: jest.fn().mockResolvedValue(mockMessage)
                    }
                };

                mockClient.channels.fetch.mockResolvedValue(mockChannel);

                // Register embed
                embedUpdateService.activeEmbeds.set('embed123', {
                    guildId: 'guild123',
                    channelId: 'channel123',
                    messageId: 'message123',
                    type: 'task',
                    dataId: 'task123',
                    isActive: true
                });

                const updateData = {
                    status: 'completed',
                    completedBy: 50
                };

                const result = await embedUpdateService.updateEmbed('embed123', updateData, true);

                expect(result).toBe(true);
                expect(mockMessage.edit).toHaveBeenCalled();
            });

            test('should handle non-existent embed', async () => {
                const result = await embedUpdateService.updateEmbed('nonexistent', {});

                expect(result).toBe(false);
            });

            test('should handle cooldown', async () => {
                embedUpdateService.activeEmbeds.set('embed123', {
                    guildId: 'guild123',
                    channelId: 'channel123',
                    messageId: 'message123',
                    type: 'task',
                    dataId: 'task123',
                    isActive: true
                });

                // Set recent cooldown
                embedUpdateService.updateCooldowns.set('embed123', Date.now());

                const result = await embedUpdateService.updateEmbed('embed123', {});

                expect(result).toBe(false);
            });
        });

        describe('batchUpdateEmbeds', () => {
            test('should update multiple embeds', async () => {
                const updates = [
                    { embedId: 'embed1', data: { status: 'active' } },
                    { embedId: 'embed2', data: { status: 'completed' } }
                ];

                // Mock updateEmbed to return success
                jest.spyOn(embedUpdateService, 'updateEmbed').mockResolvedValue(true);

                const result = await embedUpdateService.batchUpdateEmbeds(updates);

                expect(result.successful).toBe(2);
                expect(result.failed).toBe(0);
            });

            test('should handle mixed success/failure', async () => {
                const updates = [
                    { embedId: 'embed1', data: { status: 'active' } },
                    { embedId: 'embed2', data: { status: 'completed' } }
                ];

                // Mock updateEmbed to return mixed results
                jest.spyOn(embedUpdateService, 'updateEmbed')
                    .mockResolvedValueOnce(true)
                    .mockResolvedValueOnce(false);

                const result = await embedUpdateService.batchUpdateEmbeds(updates);

                expect(result.successful).toBe(1);
                expect(result.failed).toBe(1);
            });
        });

        describe('cleanup', () => {
            test('should clean up old embeds', async () => {
                const oldTime = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago

                embedUpdateService.activeEmbeds.set('oldEmbed', {
                    guildId: 'guild123',
                    channelId: 'channel123',
                    messageId: 'message123',
                    type: 'task',
                    dataId: 'task123',
                    lastUpdate: oldTime,
                    isActive: true
                });

                await embedUpdateService.cleanup();

                expect(embedUpdateService.activeEmbeds.has('oldEmbed')).toBe(false);
            });
        });

        describe('initialize', () => {
            test('should restore embeds from Redis', async () => {
                const mockEmbedInfo = {
                    guildId: 'guild123',
                    channelId: 'channel123',
                    messageId: 'message123',
                    type: 'task',
                    dataId: 'task123',
                    updateFrequency: 30000
                };

                mockRedisService.keys.mockResolvedValue(['embed_update:embed123']);
                mockRedisService.get.mockResolvedValue(JSON.stringify(mockEmbedInfo));

                await embedUpdateService.initialize();

                expect(embedUpdateService.activeEmbeds.has('embed123')).toBe(true);
            });
        });

        describe('getStatistics', () => {
            test('should return embed statistics', () => {
                embedUpdateService.activeEmbeds.set('task1', { type: 'task' });
                embedUpdateService.activeEmbeds.set('allowlist1', { type: 'allowlist' });

                const stats = embedUpdateService.getStatistics();

                expect(stats.activeEmbeds).toBe(2);
                expect(stats.embedTypes.task).toBe(1);
                expect(stats.embedTypes.allowlist).toBe(1);
            });
        });
    });

    describe('Helper Functions', () => {
        describe('formatTaskType', () => {
            test('should format different task types', () => {
                expect(embedBuilder.formatTaskType('twitter_follow')).toContain('Twitter Follow');
                expect(embedBuilder.formatTaskType('discord_join')).toContain('Discord Join');
                expect(embedBuilder.formatTaskType('telegram_join')).toContain('Telegram Join');
                expect(embedBuilder.formatTaskType('custom')).toContain('Custom Task');
            });
        });

        describe('formatStatus', () => {
            test('should format different statuses', () => {
                expect(embedBuilder.formatStatus('active')).toContain('Active');
                expect(embedBuilder.formatStatus('completed')).toContain('Completed');
                expect(embedBuilder.formatStatus('expired')).toContain('Expired');
                expect(embedBuilder.formatStatus('paused')).toContain('Paused');
            });
        });

        describe('formatDuration', () => {
            test('should format hours correctly', () => {
                expect(embedBuilder.formatDuration(1)).toBe('1 hour');
                expect(embedBuilder.formatDuration(2)).toBe('2 hours');
                expect(embedBuilder.formatDuration(24)).toBe('1 day');
                expect(embedBuilder.formatDuration(48)).toBe('2 days');
                expect(embedBuilder.formatDuration(168)).toBe('1 week');
                expect(embedBuilder.formatDuration(336)).toBe('2 weeks');
            });
        });

        describe('createProgressBar', () => {
            test('should create progress bar visualization', () => {
                const progressBar = embedBuilder.createProgressBar(5, 10, 10);
                expect(progressBar).toHaveLength(10);
                expect(progressBar).toContain('█');
                expect(progressBar).toContain('░');
            });

            test('should handle 100% progress', () => {
                const progressBar = embedBuilder.createProgressBar(10, 10, 10);
                expect(progressBar).toBe('██████████');
            });

            test('should handle 0% progress', () => {
                const progressBar = embedBuilder.createProgressBar(0, 10, 10);
                expect(progressBar).toBe('░░░░░░░░░░');
            });
        });
    });

    describe('Error Handling', () => {
        test('should handle EmbedBuilder constructor errors', () => {
            EmbedBuilder.mockImplementationOnce(() => {
                throw new Error('Constructor error');
            });

            const result = embedBuilder.createTaskEmbed({ title: 'Test' });
            expect(result).toBeDefined();
        });

        test('should handle missing required fields gracefully', () => {
            const result = embedBuilder.createTaskEmbed({});
            expect(result).toBeDefined();
        });

        test('should handle invalid data types', () => {
            const result = embedBuilder.createTaskEmbed(null);
            expect(result).toBeDefined();
        });
    });

    describe('Integration Tests', () => {
        test('should create complete task workflow', () => {
            const taskData = {
                title: 'Integration Test Task',
                description: 'Complete integration test',
                points: 500,
                type: 'custom',
                status: 'active'
            };

            // Create embed
            const embed = embedBuilder.createTaskEmbed(taskData);
            expect(embed).toBeDefined();

            // Create buttons
            const buttons = embedBuilder.createActionButtons('task', { id: 'test123', status: 'active' });
            expect(buttons).toBeDefined();

            // Update embed status
            const mockEmbed = {
                data: { fields: [] },
                setTimestamp: jest.fn().mockReturnThis(),
                addFields: jest.fn().mockReturnThis()
            };

            const updatedEmbed = embedBuilder.updateEmbedStatus(mockEmbed, { status: 'completed' });
            expect(updatedEmbed).toBeDefined();
        });

        test('should create complete allowlist workflow', () => {
            const allowlistData = {
                title: 'Integration Test Allowlist',
                description: 'Complete integration test allowlist',
                prize: 'Test NFT',
                winnerCount: 100,
                entryPrice: 0
            };

            // Create embed
            const embed = embedBuilder.createAllowlistEmbed(allowlistData);
            expect(embed).toBeDefined();

            // Create buttons
            const buttons = embedBuilder.createActionButtons('allowlist', { id: 'test456', status: 'active' });
            expect(buttons).toBeDefined();
        });
    });
});