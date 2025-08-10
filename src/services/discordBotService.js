const { REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
const logger = require('../utils/logger');
const RateLimiter = require('../utils/rateLimiter');
const ErrorHandler = require('../utils/errorHandler');
const CommunityLinkingService = require('./communityLinkingService');
const EmbedBuilderService = require('./embedBuilder');
const EmbedUpdateService = require('./embedUpdateService');
const EmbedTemplates = require('./embedTemplates');
const SocialTaskIntegrationService = require('./socialTaskIntegrationService');
const TaskProgressTrackingService = require('./taskProgressTrackingService');
const TaskEligibilityService = require('./taskEligibilityService');
const TaskAnalyticsService = require('./taskAnalyticsService');
const AllowlistIntegrationService = require('./allowlistIntegrationService');
const PermissionManager = require('./permissionManager');
const SecurityMonitor = require('./securityMonitor');
const AuditLogger = require('./auditLogger');
const SecurityReporter = require('./securityReporter');
const RealTimeSyncService = require('./realTimeSyncService');
const WebhookIntegrationService = require('./webhookIntegrationService');
const SyncMonitoringService = require('./syncMonitoringService');

class DiscordBotService {
    constructor(client, databaseService, redisService) {
        this.client = client;
        this.db = databaseService;
        this.redis = redisService;
        this.rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
        this.rateLimiter = new RateLimiter();
        this.errorHandler = new ErrorHandler();
        this.nafflesApiBaseUrl = process.env.NAFFLES_API_BASE_URL;
        this.nafflesApiKey = process.env.NAFFLES_API_KEY;
        
        // Initialize community linking service
        this.communityLinking = new CommunityLinkingService(this);
        
        // Initialize embed services
        this.embedBuilder = new EmbedBuilderService();
        this.embedUpdater = new EmbedUpdateService(client, databaseService, redisService);
        this.embedTemplates = new EmbedTemplates();
        
        // Initialize social task integration services
        this.socialTaskIntegration = new SocialTaskIntegrationService(this);
        this.taskProgressTracking = new TaskProgressTrackingService(this);
        this.taskEligibility = new TaskEligibilityService(this);
        this.taskAnalytics = new TaskAnalyticsService(this);
        
        // Initialize allowlist integration service
        this.allowlistIntegration = new AllowlistIntegrationService(this);
        
        // Initialize security services
        this.permissionManager = new PermissionManager(this);
        this.securityMonitor = new SecurityMonitor(this);
        this.auditLogger = new AuditLogger(this);
        this.securityReporter = new SecurityReporter(this);
        
        // Initialize real-time synchronization services
        this.realTimeSync = new RealTimeSyncService(this);
        this.webhookIntegration = new WebhookIntegrationService(this, this.realTimeSync);
        this.syncMonitoring = new SyncMonitoringService(this, this.realTimeSync);
        
        // Command handler will be initialized later
        this.commandHandler = null;
        
        // Connection monitoring
        this.connectionStatus = {
            discord: false,
            nafflesApi: false,
            lastHealthCheck: null
        };

        // Performance metrics
        this.metrics = {
            commandsProcessed: 0,
            errorsEncountered: 0,
            apiCallsSuccessful: 0,
            apiCallsFailed: 0,
            uptime: Date.now()
        };
    }

    async initialize() {
        try {
            logger.info('Initializing Discord Bot Service...');

            // Set up Discord client event listeners
            this.setupDiscordEventListeners();

            // Register slash commands
            await this.registerSlashCommands();

            // Start connection monitoring
            this.startConnectionMonitoring();

            // Initialize performance tracking
            this.initializePerformanceTracking();

            // Initialize embed update service
            await this.embedUpdater.initialize();

            // Initialize real-time synchronization services
            await this.realTimeSync.initialize();
            await this.webhookIntegration.initialize();
            await this.syncMonitoring.initialize();

            logger.info('Discord Bot Service initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Discord Bot Service:', error);
            throw error;
        }
    }

    setupDiscordEventListeners() {
        this.client.on('ready', () => {
            logger.info(`Discord bot logged in as ${this.client.user.tag}`);
            this.connectionStatus.discord = true;
            this.updateBotPresence();
        });

        this.client.on('disconnect', () => {
            logger.warn('Discord bot disconnected');
            this.connectionStatus.discord = false;
        });

        this.client.on('reconnecting', () => {
            logger.info('Discord bot reconnecting...');
        });

        this.client.on('error', (error) => {
            logger.error('Discord client error:', error);
            this.metrics.errorsEncountered++;
        });

        this.client.on('warn', (warning) => {
            logger.warn('Discord client warning:', warning);
        });

        this.client.on('rateLimit', (rateLimitData) => {
            logger.warn('Discord rate limit hit:', rateLimitData);
        });
    }

    async registerSlashCommands() {
        try {
            logger.info('Registering Discord slash commands...');

            const commands = [
                {
                    name: 'naffles-create-task',
                    description: 'Create a new social task for your community',
                    options: [
                        {
                            name: 'type',
                            description: 'Type of social task',
                            type: 3, // STRING
                            required: true,
                            choices: [
                                { name: 'Twitter Follow', value: 'twitter_follow' },
                                { name: 'Discord Join', value: 'discord_join' },
                                { name: 'Telegram Join', value: 'telegram_join' },
                                { name: 'Custom Task', value: 'custom' }
                            ]
                        },
                        {
                            name: 'title',
                            description: 'Title of the social task',
                            type: 3, // STRING
                            required: true,
                            max_length: 100
                        },
                        {
                            name: 'description',
                            description: 'Description of the social task',
                            type: 3, // STRING
                            required: true,
                            max_length: 500
                        },
                        {
                            name: 'points',
                            description: 'Points reward for completing the task',
                            type: 4, // INTEGER
                            required: true,
                            min_value: 1,
                            max_value: 10000
                        },
                        {
                            name: 'duration',
                            description: 'Duration in hours (default: 168 hours = 1 week)',
                            type: 4, // INTEGER
                            required: false,
                            min_value: 1,
                            max_value: 8760 // 1 year
                        }
                    ]
                },
                {
                    name: 'naffles-list-tasks',
                    description: 'List active social tasks for your community',
                    options: [
                        {
                            name: 'status',
                            description: 'Filter tasks by status',
                            type: 3, // STRING
                            required: false,
                            choices: [
                                { name: 'Active', value: 'active' },
                                { name: 'Completed', value: 'completed' },
                                { name: 'Expired', value: 'expired' },
                                { name: 'All', value: 'all' }
                            ]
                        }
                    ]
                },
                {
                    name: 'naffles-connect-allowlist',
                    description: 'Connect an existing allowlist to this Discord server',
                    options: [
                        {
                            name: 'allowlist_id',
                            description: 'ID of the allowlist to connect',
                            type: 3, // STRING
                            required: true
                        }
                    ]
                },
                {
                    name: 'naffles-link-community',
                    description: 'Link this Discord server to a Naffles community',
                    options: [
                        {
                            name: 'community_id',
                            description: 'Your Naffles community ID (found in community settings)',
                            type: 3, // STRING
                            required: true,
                            max_length: 50
                        }
                    ]
                },
                {
                    name: 'naffles-status',
                    description: 'Check the Discord bot connection status and community link'
                },
                {
                    name: 'naffles-help',
                    description: 'Get help with Naffles Discord bot commands and setup'
                },
                {
                    name: 'naffles-security',
                    description: 'Security management and monitoring (Admin only)',
                    options: [
                        {
                            name: 'report',
                            description: 'Generate a security report',
                            type: 1, // SUB_COMMAND
                            options: [
                                {
                                    name: 'timeframe',
                                    description: 'Report timeframe',
                                    type: 3, // STRING
                                    required: false,
                                    choices: [
                                        { name: 'Last Hour', value: 'hour' },
                                        { name: 'Last Day', value: 'day' },
                                        { name: 'Last Week', value: 'week' },
                                        { name: 'Last Month', value: 'month' }
                                    ]
                                }
                            ]
                        },
                        {
                            name: 'stats',
                            description: 'View security statistics',
                            type: 1 // SUB_COMMAND
                        },
                        {
                            name: 'alerts',
                            description: 'Configure security alerts',
                            type: 1, // SUB_COMMAND
                            options: [
                                {
                                    name: 'action',
                                    description: 'Alert action',
                                    type: 3, // STRING
                                    required: true,
                                    choices: [
                                        { name: 'Setup Channel', value: 'setup' },
                                        { name: 'Remove Alerts', value: 'remove' },
                                        { name: 'Test Alert', value: 'test' }
                                    ]
                                },
                                {
                                    name: 'channel',
                                    description: 'Channel for security alerts',
                                    type: 7, // CHANNEL
                                    required: false
                                }
                            ]
                        },
                        {
                            name: 'audit',
                            description: 'View audit logs',
                            type: 1, // SUB_COMMAND
                            options: [
                                {
                                    name: 'user',
                                    description: 'Filter by user',
                                    type: 6, // USER
                                    required: false
                                },
                                {
                                    name: 'type',
                                    description: 'Filter by event type',
                                    type: 3, // STRING
                                    required: false,
                                    choices: [
                                        { name: 'Command Executed', value: 'command_executed' },
                                        { name: 'Permission Denied', value: 'permission_denied' },
                                        { name: 'Security Event', value: 'security_event' },
                                        { name: 'Admin Action', value: 'admin_action' }
                                    ]
                                }
                            ]
                        },
                        {
                            name: 'permissions',
                            description: 'Manage permission configuration',
                            type: 1, // SUB_COMMAND
                            options: [
                                {
                                    name: 'action',
                                    description: 'Permission action',
                                    type: 3, // STRING
                                    required: true,
                                    choices: [
                                        { name: 'View Config', value: 'view' },
                                        { name: 'Reset to Defaults', value: 'reset' }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ];

            await this.rest.put(
                Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
                { body: commands }
            );

            logger.info(`Successfully registered ${commands.length} slash commands`);
        } catch (error) {
            logger.error('Failed to register slash commands:', error);
            throw error;
        }
    }

    async updateBotPresence() {
        try {
            const serverCount = this.client.guilds.cache.size;
            await this.client.user.setPresence({
                activities: [{
                    name: `${serverCount} servers | /naffles-create-task`,
                    type: 0 // PLAYING
                }],
                status: 'online'
            });
        } catch (error) {
            logger.error('Failed to update bot presence:', error);
        }
    }

    startConnectionMonitoring() {
        // Monitor connections every 30 seconds
        setInterval(async () => {
            await this.performHealthCheck();
        }, 30000);

        logger.info('Connection monitoring started');
    }

    async performHealthCheck() {
        try {
            this.connectionStatus.lastHealthCheck = new Date();

            // Check Discord connection
            this.connectionStatus.discord = this.client.isReady();

            // Check Naffles API connection
            try {
                const response = await axios.get(`${this.nafflesApiBaseUrl}/health`, {
                    timeout: 5000,
                    headers: {
                        'Authorization': `Bearer ${this.nafflesApiKey}`
                    }
                });
                this.connectionStatus.nafflesApi = response.status === 200;
                this.metrics.apiCallsSuccessful++;
            } catch (error) {
                this.connectionStatus.nafflesApi = false;
                this.metrics.apiCallsFailed++;
                logger.warn('Naffles API health check failed:', error.message);
            }

            // Log health status
            if (!this.connectionStatus.discord || !this.connectionStatus.nafflesApi) {
                logger.warn('Health check issues detected:', this.connectionStatus);
            }
        } catch (error) {
            logger.error('Health check failed:', error);
        }
    }

    initializePerformanceTracking() {
        // Log performance metrics every 5 minutes
        setInterval(() => {
            const uptimeHours = (Date.now() - this.metrics.uptime) / (1000 * 60 * 60);
            logger.info('Performance metrics:', {
                ...this.metrics,
                uptimeHours: uptimeHours.toFixed(2),
                commandsPerHour: (this.metrics.commandsProcessed / uptimeHours).toFixed(2),
                errorRate: ((this.metrics.errorsEncountered / this.metrics.commandsProcessed) * 100).toFixed(2) + '%'
            });
        }, 5 * 60 * 1000);
    }

    async makeNafflesApiCall(endpoint, method = 'GET', data = null) {
        try {
            const config = {
                method,
                url: `${this.nafflesApiBaseUrl}${endpoint}`,
                headers: {
                    'Authorization': `Bearer ${this.nafflesApiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            };

            if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
                config.data = data;
            }

            const response = await axios(config);
            this.metrics.apiCallsSuccessful++;
            return response.data;
        } catch (error) {
            this.metrics.apiCallsFailed++;
            logger.error(`Naffles API call failed [${method} ${endpoint}]:`, error.message);
            throw error;
        }
    }

    async getServerCommunityMapping(guildId) {
        try {
            const mapping = await this.db.getServerCommunityMapping(guildId);
            return mapping;
        } catch (error) {
            logger.error('Failed to get server community mapping:', error);
            return null;
        }
    }

    async createServerCommunityMapping(guildId, communityId, userId) {
        try {
            const mapping = await this.db.createServerCommunityMapping({
                guildId,
                communityId,
                linkedBy: userId,
                linkedAt: new Date(),
                isActive: true
            });
            
            logger.info(`Created server-community mapping: ${guildId} -> ${communityId}`);
            return mapping;
        } catch (error) {
            logger.error('Failed to create server community mapping:', error);
            throw error;
        }
    }

    async validateUserPermissions(guildId, userId, requiredPermissions = []) {
        try {
            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) {
                return { hasPermission: false, reason: 'Guild not found' };
            }

            const member = await guild.members.fetch(userId);
            if (!member) {
                return { hasPermission: false, reason: 'Member not found' };
            }

            // Check if user has administrator permission
            if (member.permissions.has('Administrator')) {
                return { hasPermission: true, reason: 'Administrator' };
            }

            // Check specific permissions
            for (const permission of requiredPermissions) {
                if (!member.permissions.has(permission)) {
                    return { hasPermission: false, reason: `Missing permission: ${permission}` };
                }
            }

            return { hasPermission: true, reason: 'Permissions validated' };
        } catch (error) {
            logger.error('Failed to validate user permissions:', error);
            return { hasPermission: false, reason: 'Permission check failed' };
        }
    }

    createTaskEmbed(taskData, options = {}) {
        return this.embedBuilder.createTaskEmbed(taskData, options);
    }

    createAllowlistEmbed(allowlistData, options = {}) {
        return this.embedBuilder.createAllowlistEmbed(allowlistData, options);
    }

    createActionButtons(type, data, options = {}) {
        return this.embedBuilder.createActionButtons(type, data, options);
    }

    formatTaskType(type) {
        return this.embedBuilder.formatTaskType(type);
    }

    /**
     * Create and post a task embed with real-time updates
     * @param {Object} channel - Discord channel
     * @param {Object} taskData - Task information
     * @param {Object} options - Additional options
     * @returns {Object} Posted message and embed ID
     */
    async postTaskEmbed(channel, taskData, options = {}) {
        try {
            const embed = this.createTaskEmbed(taskData, options);
            const buttons = this.createActionButtons('task', taskData, options);
            
            const message = await channel.send({
                embeds: [embed],
                components: [buttons]
            });

            // Register for real-time updates if requested
            if (options.enableUpdates !== false) {
                const embedId = `task_${taskData.id}_${message.id}`;
                await this.embedUpdater.registerEmbedForUpdates(embedId, {
                    guildId: channel.guild.id,
                    channelId: channel.id,
                    messageId: message.id,
                    type: 'task',
                    dataId: taskData.id,
                    updateFrequency: options.updateFrequency || 30000
                });

                return { message, embedId };
            }

            return { message, embedId: null };
        } catch (error) {
            logger.error('Error posting task embed:', error);
            throw error;
        }
    }

    /**
     * Create and post an allowlist embed with real-time updates
     * @param {Object} channel - Discord channel
     * @param {Object} allowlistData - Allowlist information
     * @param {Object} options - Additional options
     * @returns {Object} Posted message and embed ID
     */
    async postAllowlistEmbed(channel, allowlistData, options = {}) {
        try {
            const embed = this.createAllowlistEmbed(allowlistData, options);
            const buttons = this.createActionButtons('allowlist', allowlistData, options);
            
            const message = await channel.send({
                embeds: [embed],
                components: [buttons]
            });

            // Register for real-time updates if requested
            if (options.enableUpdates !== false) {
                const embedId = `allowlist_${allowlistData.id}_${message.id}`;
                await this.embedUpdater.registerEmbedForUpdates(embedId, {
                    guildId: channel.guild.id,
                    channelId: channel.id,
                    messageId: message.id,
                    type: 'allowlist',
                    dataId: allowlistData.id,
                    updateFrequency: options.updateFrequency || 30000
                });

                return { message, embedId };
            }

            return { message, embedId: null };
        } catch (error) {
            logger.error('Error posting allowlist embed:', error);
            throw error;
        }
    }

    /**
     * Update an existing embed with new data
     * @param {string} embedId - Embed identifier
     * @param {Object} updateData - New data for the embed
     * @param {boolean} force - Force update even if on cooldown
     */
    async updateEmbed(embedId, updateData, force = false) {
        return await this.embedUpdater.updateEmbed(embedId, updateData, force);
    }

    /**
     * Create pagination controls for long content
     * @param {Object} paginationData - Pagination information
     * @returns {ActionRowBuilder} Pagination controls
     */
    createPaginationControls(paginationData) {
        return this.embedBuilder.createPaginationControls(paginationData);
    }

    /**
     * Create success embed
     * @param {string} title - Success title
     * @param {string} message - Success message
     * @param {Object} options - Additional options
     * @returns {EmbedBuilder} Success embed
     */
    createSuccessEmbed(title, message, options = {}) {
        return this.embedBuilder.createSuccessEmbed(title, message, options);
    }

    /**
     * Create error embed
     * @param {string} message - Error message
     * @param {Object} options - Additional options
     * @returns {EmbedBuilder} Error embed
     */
    createErrorEmbed(message, options = {}) {
        return this.embedBuilder.createErrorEmbed(message, options);
    }

    /**
     * Create warning embed
     * @param {string} title - Warning title
     * @param {string} message - Warning message
     * @param {Object} options - Additional options
     * @returns {EmbedBuilder} Warning embed
     */
    createWarningEmbed(title, message, options = {}) {
        return this.embedBuilder.createWarningEmbed(title, message, options);
    }

    /**
     * Create info embed
     * @param {string} title - Info title
     * @param {string} message - Info message
     * @param {Object} options - Additional options
     * @returns {EmbedBuilder} Info embed
     */
    createInfoEmbed(title, message, options = {}) {
        return this.embedBuilder.createInfoEmbed(title, message, options);
    }

    /**
     * Create loading embed
     * @param {string} message - Loading message
     * @returns {EmbedBuilder} Loading embed
     */
    createLoadingEmbed(message = 'Processing...') {
        return this.embedBuilder.createLoadingEmbed(message);
    }

    /**
     * Get embed update service statistics
     * @returns {Object} Statistics about active embeds
     */
    getEmbedStatistics() {
        return this.embedUpdater.getStatistics();
    }

    async logInteraction(interaction, action, result) {
        try {
            const logData = {
                guildId: interaction.guildId,
                userId: interaction.user.id,
                username: interaction.user.username,
                action,
                result,
                timestamp: new Date(),
                commandName: interaction.commandName || null,
                customId: interaction.customId || null
            };

            await this.db.logInteraction(logData);
            this.metrics.commandsProcessed++;
        } catch (error) {
            logger.error('Failed to log interaction:', error);
        }
    }

    // Event Handler Methods
    async onReady() {
        try {
            logger.info('Discord bot is ready and connected');
            this.connectionStatus.discord = true;
            
            // Update bot presence
            await this.updateBotPresence();
            
            // Perform initial health check
            await this.performHealthCheck();
            
            // Clean up expired task posts
            await this.cleanupExpiredTasks();
            
        } catch (error) {
            logger.error('Error in onReady handler:', error);
        }
    }

    async onGuildJoin(guild) {
        try {
            logger.info(`Bot joined guild: ${guild.name} (${guild.id})`);
            
            // Log the guild join event
            await this.logInteraction({
                guildId: guild.id,
                userId: null,
                action: 'guild_join',
                timestamp: new Date(),
                metadata: {
                    guildName: guild.name,
                    memberCount: guild.memberCount
                }
            });

            // Send welcome message to the guild owner or system channel
            await this.sendGuildWelcomeMessage(guild);
            
        } catch (error) {
            logger.error(`Error handling guild join for ${guild.name}:`, error);
        }
    }

    async onGuildLeave(guild) {
        try {
            logger.info(`Bot left guild: ${guild.name} (${guild.id})`);
            
            // Log the guild leave event
            await this.logInteraction({
                guildId: guild.id,
                userId: null,
                action: 'guild_leave',
                timestamp: new Date(),
                metadata: {
                    guildName: guild.name
                }
            });

            // Clean up guild-specific data
            await this.cleanupGuildData(guild.id);
            
        } catch (error) {
            logger.error(`Error handling guild leave for ${guild.name}:`, error);
        }
    }

    async onMemberJoin(member) {
        try {
            // Log member join if needed for analytics
            await this.logInteraction({
                guildId: member.guild.id,
                userId: member.user.id,
                action: 'member_join',
                timestamp: new Date(),
                metadata: {
                    username: member.user.username,
                    discriminator: member.user.discriminator
                }
            });
            
        } catch (error) {
            logger.error(`Error handling member join in ${member.guild.name}:`, error);
        }
    }

    async onMemberLeave(member) {
        try {
            // Log member leave if needed for analytics
            await this.logInteraction({
                guildId: member.guild.id,
                userId: member.user.id,
                action: 'member_leave',
                timestamp: new Date(),
                metadata: {
                    username: member.user.username,
                    discriminator: member.user.discriminator
                }
            });
            
        } catch (error) {
            logger.error(`Error handling member leave in ${member.guild.name}:`, error);
        }
    }

    async handleButtonInteraction(interaction) {
        try {
            const [action, ...params] = interaction.customId.split('_');
            
            switch (action) {
                case 'task':
                    await this.handleTaskButtonInteraction(interaction, params);
                    break;
                case 'allowlist':
                    await this.handleAllowlistButtonInteraction(interaction, params);
                    break;
                case 'link':
                    await this.handleLinkButtonInteraction(interaction, params);
                    break;
                default:
                    logger.warn(`Unknown button interaction: ${interaction.customId}`);
                    await interaction.reply({
                        content: 'Unknown button action. Please try again.',
                        ephemeral: true
                    });
            }
            
        } catch (error) {
            logger.error('Error handling button interaction:', error);
            await this.errorHandler.handleInteractionError(interaction, error);
        }
    }

    async handleSelectMenuInteraction(interaction) {
        try {
            const [action, ...params] = interaction.customId.split('_');
            
            switch (action) {
                case 'task':
                    await this.handleTaskSelectMenuInteraction(interaction, params);
                    break;
                case 'community':
                    await this.handleCommunitySelectMenuInteraction(interaction, params);
                    break;
                default:
                    logger.warn(`Unknown select menu interaction: ${interaction.customId}`);
                    await interaction.reply({
                        content: 'Unknown menu action. Please try again.',
                        ephemeral: true
                    });
            }
            
        } catch (error) {
            logger.error('Error handling select menu interaction:', error);
            await this.errorHandler.handleInteractionError(interaction, error);
        }
    }

    async handleModalSubmit(interaction) {
        try {
            const [action, ...params] = interaction.customId.split('_');
            
            switch (action) {
                case 'task':
                    await this.handleTaskModalSubmit(interaction, params);
                    break;
                case 'allowlist':
                    await this.handleAllowlistModalSubmit(interaction, params);
                    break;
                default:
                    logger.warn(`Unknown modal submit: ${interaction.customId}`);
                    await interaction.reply({
                        content: 'Unknown form submission. Please try again.',
                        ephemeral: true
                    });
            }
            
        } catch (error) {
            logger.error('Error handling modal submit:', error);
            await this.errorHandler.handleInteractionError(interaction, error);
        }
    }

    // Helper Methods for Interactions
    async handleTaskButtonInteraction(interaction, params) {
        const [taskAction, taskId] = params;
        
        switch (taskAction) {
            case 'complete':
                await this.completeTask(interaction, taskId);
                break;
            case 'info':
                await this.showTaskInfo(interaction, taskId);
                break;
            default:
                await interaction.reply({
                    content: 'Unknown task action.',
                    ephemeral: true
                });
        }
    }

    async handleAllowlistButtonInteraction(interaction, params) {
        const [allowlistAction, allowlistId] = params;
        
        switch (allowlistAction) {
            case 'enter':
                await this.enterAllowlist(interaction, allowlistId);
                break;
            case 'info':
                await this.showAllowlistInfo(interaction, allowlistId);
                break;
            default:
                await interaction.reply({
                    content: 'Unknown allowlist action.',
                    ephemeral: true
                });
        }
    }

    async handleLinkButtonInteraction(interaction, params) {
        const [linkAction] = params;
        
        switch (linkAction) {
            case 'account':
                await this.startAccountLinking(interaction);
                break;
            case 'verify':
                await this.verifyAccountLink(interaction);
                break;
            default:
                await interaction.reply({
                    content: 'Unknown link action.',
                    ephemeral: true
                });
        }
    }

    // Utility Methods
    async sendGuildWelcomeMessage(guild) {
        try {
            const embed = new EmbedBuilder()
                .setTitle('🎉 Welcome to Naffles!')
                .setDescription('Thank you for adding the Naffles Discord bot to your server!')
                .addFields(
                    {
                        name: '🚀 Getting Started',
                        value: 'Use `/naffles-help` to see all available commands and get started with community management.'
                    },
                    {
                        name: '🔗 Link Your Community',
                        value: 'Connect your Discord server to a Naffles community to enable social tasks and allowlist management.'
                    },
                    {
                        name: '📚 Need Help?',
                        value: 'Visit our documentation or contact support for assistance setting up your community.'
                    }
                )
                .setColor(0x7C3AED)
                .setTimestamp();

            // Try to send to system channel first, then owner
            let channel = guild.systemChannel;
            if (!channel) {
                const owner = await guild.fetchOwner();
                if (owner) {
                    channel = await owner.createDM();
                }
            }

            if (channel) {
                await channel.send({ embeds: [embed] });
            }
            
        } catch (error) {
            logger.error(`Failed to send welcome message to guild ${guild.name}:`, error);
        }
    }

    async cleanupGuildData(guildId) {
        try {
            // Remove server community mapping
            await this.db.deleteServerCommunityMapping(guildId);
            
            // Clean up task posts
            await this.db.TaskPost.deleteMany({ guildId });
            
            // Clean up interaction logs (keep for analytics but mark as inactive)
            await this.db.InteractionLog.updateMany(
                { guildId },
                { isActive: false }
            );
            
            logger.info(`Cleaned up data for guild ${guildId}`);
            
        } catch (error) {
            logger.error(`Failed to cleanup data for guild ${guildId}:`, error);
        }
    }

    async cleanupExpiredTasks() {
        try {
            const expiredCount = await this.db.expireOldTaskPosts();
            if (expiredCount > 0) {
                logger.info(`Cleaned up ${expiredCount} expired task posts`);
            }
        } catch (error) {
            logger.error('Failed to cleanup expired tasks:', error);
        }
    }

    /**
     * Cleanup method for graceful shutdown
     */
    async cleanup() {
        try {
            logger.info('Starting Discord bot service cleanup...');

            // Cleanup allowlist integration service
            if (this.allowlistIntegration) {
                this.allowlistIntegration.cleanup();
                logger.info('Allowlist integration service cleaned up');
            }

            // Cleanup embed updater
            if (this.embedUpdater) {
                await this.embedUpdater.cleanup();
                logger.info('Embed updater cleaned up');
            }

            // Stop connection monitoring
            if (this.connectionMonitorInterval) {
                clearInterval(this.connectionMonitorInterval);
                this.connectionMonitorInterval = null;
                logger.info('Connection monitoring stopped');
            }

            // Stop performance tracking
            if (this.performanceTrackingInterval) {
                clearInterval(this.performanceTrackingInterval);
                this.performanceTrackingInterval = null;
                logger.info('Performance tracking stopped');
            }

            logger.info('Discord bot service cleanup completed');
        } catch (error) {
            logger.error('Error during Discord bot service cleanup:', error);
        }
    }

    // Placeholder methods for task and allowlist interactions
    async completeTask(interaction, taskId) {
        await interaction.reply({
            content: 'Task completion functionality will be implemented in the next phase.',
            ephemeral: true
        });
    }

    async showTaskInfo(interaction, taskId) {
        await interaction.reply({
            content: 'Task info functionality will be implemented in the next phase.',
            ephemeral: true
        });
    }

    async enterAllowlist(interaction, allowlistId) {
        try {
            const result = await this.allowlistIntegration.processAllowlistEntry(interaction, allowlistId);
            
            if (result.success) {
                // Success is handled by the integration service
                return;
            } else {
                // Handle different error types
                let errorMessage = result.message;
                
                if (result.reason === 'requirements_not_met' && result.details) {
                    errorMessage += '\n\n**Requirements:**\n' + result.details;
                }
                
                await interaction.reply({
                    content: errorMessage,
                    ephemeral: true
                });
            }
        } catch (error) {
            logger.error('Error in enterAllowlist:', error);
            await interaction.reply({
                content: '❌ An error occurred while processing your entry. Please try again later.',
                ephemeral: true
            });
        }
    }

    async showAllowlistInfo(interaction, allowlistId) {
        try {
            // Fetch detailed allowlist information
            const allowlist = await this.makeNafflesApiCall(
                `/api/allowlists/${allowlistId}`
            );

            if (!allowlist) {
                return await interaction.reply({
                    content: '❌ Allowlist not found.',
                    ephemeral: true
                });
            }

            // Create detailed embed
            const detailEmbed = new EmbedBuilder()
                .setTitle(`🎫 ${allowlist.title}`)
                .setDescription(allowlist.description || 'No description provided.')
                .setColor(0x10B981) // Green
                .setFooter({ 
                    text: 'Powered by Naffles', 
                    iconURL: 'https://naffles.com/logo.png' 
                })
                .setTimestamp();

            // Add detailed fields
            if (allowlist.prize) {
                detailEmbed.addFields({ name: '🏆 Prize', value: allowlist.prize, inline: true });
            }

            const winnerText = allowlist.winnerCount === 'everyone' 
                ? 'Everyone Wins!' 
                : `${allowlist.winnerCount} Winners`;
            detailEmbed.addFields({ name: '👥 Winners', value: winnerText, inline: true });

            const priceText = !allowlist.entryPrice || parseFloat(allowlist.entryPrice.amount) === 0
                ? 'Free'
                : `${allowlist.entryPrice.amount} ${allowlist.entryPrice.tokenType}`;
            detailEmbed.addFields({ name: '💰 Entry Price', value: priceText, inline: true });

            detailEmbed.addFields({ name: '📊 Participants', value: `${allowlist.totalEntries || 0}`, inline: true });

            if (allowlist.endTime) {
                const endTimestamp = Math.floor(new Date(allowlist.endTime).getTime() / 1000);
                detailEmbed.addFields({ name: '⏰ Ends', value: `<t:${endTimestamp}:R>`, inline: true });
            }

            const statusEmoji = allowlist.status === 'active' ? '🟢' : '🔴';
            detailEmbed.addFields({ 
                name: '📈 Status', 
                value: `${statusEmoji} ${allowlist.status.charAt(0).toUpperCase() + allowlist.status.slice(1)}`, 
                inline: true 
            });

            // Add social requirements if any
            if (allowlist.socialTasks && allowlist.socialTasks.length > 0) {
                const requirements = allowlist.socialTasks
                    .filter(task => task.required)
                    .map(task => `• ${this.allowlistIntegration.formatTaskType(task.taskType)}`)
                    .join('\n');
                
                if (requirements) {
                    detailEmbed.addFields({
                        name: '📋 Requirements',
                        value: requirements,
                        inline: false
                    });
                }
            }

            // Add profit guarantee if applicable
            if (allowlist.profitGuaranteePercentage && allowlist.profitGuaranteePercentage > 0) {
                detailEmbed.addFields({
                    name: '💎 Profit Guarantee',
                    value: `${allowlist.profitGuaranteePercentage}% of winner sales distributed to losers`,
                    inline: false
                });
            }

            await interaction.reply({
                embeds: [detailEmbed],
                ephemeral: true
            });

            // Update analytics
            await this.allowlistIntegration.updateConnectionAnalytics(allowlistId, 'view', interaction.user.id);

        } catch (error) {
            logger.error('Error in showAllowlistInfo:', error);
            await interaction.reply({
                content: '❌ Failed to load allowlist details. Please try again later.',
                ephemeral: true
            });
        }
    }

    async startAccountLinking(interaction) {
        await interaction.reply({
            content: 'Account linking functionality will be implemented in the next phase.',
            ephemeral: true
        });
    }

    async verifyAccountLink(interaction) {
        await interaction.reply({
            content: 'Account verification functionality will be implemented in the next phase.',
            ephemeral: true
        });
    }

    // API Connection Test
    async testApiConnection() {
        try {
            const response = await this.makeNafflesApiCall('/health');
            return {
                status: 'healthy',
                responseTime: response.responseTime || 0,
                version: response.data?.version || 'unknown'
            };
        } catch (error) {
            throw new Error(`Naffles API connection failed: ${error.message}`);
        }
    }

    getConnectionStatus() {
        return this.connectionStatus;
    }

    getMetrics() {
        return {
            ...this.metrics,
            uptimeHours: (Date.now() - this.metrics.uptime) / (1000 * 60 * 60)
        };
    }
}

module.exports = DiscordBotService;