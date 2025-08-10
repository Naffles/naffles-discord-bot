const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../utils/logger');

/**
 * Fallback Service - Handles graceful degradation and fallback mechanisms
 * when external services are unavailable or experiencing issues
 */
class FallbackService {
    constructor(botService) {
        this.botService = botService;
        
        // Fallback configuration
        this.fallbackConfig = {
            websiteUrl: process.env.NAFFLES_WEBSITE_URL || 'https://naffles.com',
            supportUrl: process.env.NAFFLES_SUPPORT_URL || 'https://naffles.com/support',
            statusUrl: process.env.NAFFLES_STATUS_URL || 'https://status.naffles.com',
            discordSupportUrl: process.env.DISCORD_SUPPORT_URL || 'https://discord.gg/naffles'
        };
        
        // Fallback statistics
        this.fallbackStats = {
            apiFailures: 0,
            databaseFailures: 0,
            discordFailures: 0,
            websiteRedirects: 0,
            lastReset: Date.now()
        };
        
        // Retry configuration
        this.retryConfig = {
            maxRetries: 3,
            baseDelay: 1000, // 1 second
            maxDelay: 30000, // 30 seconds
            backoffMultiplier: 2
        };
        
        // Maintenance mode tracking
        this.maintenanceMode = {
            active: false,
            reason: null,
            startTime: null,
            estimatedEndTime: null
        };
        
        // Service availability tracking
        this.serviceStatus = {
            discord: { available: true, lastCheck: Date.now() },
            nafflesApi: { available: true, lastCheck: Date.now() },
            database: { available: true, lastCheck: Date.now() }
        };
        
        logger.info('FallbackService initialized');
    }

    /**
     * Handle API unavailability with website redirection
     * @param {Object} interaction - Discord interaction
     * @param {string} operation - Failed operation
     * @param {Error} error - Original error
     * @returns {Promise} Fallback response
     */
    async handleApiUnavailable(interaction, operation, error) {
        try {
            logger.warn('API unavailable, providing fallback', {
                operation,
                error: error.message,
                guildId: interaction.guildId,
                userId: interaction.user.id
            });

            this.fallbackStats.apiFailures++;

            const embed = this.createApiUnavailableEmbed(operation);
            const buttons = this.createWebsiteRedirectButtons(operation);

            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({
                    embeds: [embed],
                    components: [buttons]
                });
            } else {
                await interaction.reply({
                    embeds: [embed],
                    components: [buttons],
                    ephemeral: true
                });
            }

            // Log fallback usage
            await this.logFallbackUsage('api_unavailable', {
                operation,
                guildId: interaction.guildId,
                userId: interaction.user.id,
                error: error.message
            });

        } catch (fallbackError) {
            logger.error('Fallback handling failed:', fallbackError);
            await this.handleCriticalFailure(interaction, 'api_fallback_failed');
        }
    }

    /**
     * Handle Discord API failures with graceful degradation
     * @param {Object} interaction - Discord interaction
     * @param {Error} error - Original error
     * @returns {Promise<Object>} Fallback result
     */
    async handleDiscordFailure(interaction, error) {
        try {
            const embed = new EmbedBuilder()
                .setColor('#FF6B35')
                .setTitle('🔌 Discord Connection Issue')
                .setDescription('We\'re experiencing issues with Discord. Please use the website for full functionality.')
                .addFields([
                    {
                        name: '🌐 Alternative Access',
                        value: `Visit [naffles.com](${this.fallbackConfig.websiteUrl}) to continue using all features.`,
                        inline: false
                    }
                ])
                .setTimestamp();

            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('Open Naffles Website')
                        .setStyle(ButtonStyle.Link)
                        .setURL(this.fallbackConfig.websiteUrl)
                        .setEmoji('🌐')
                );

            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ embeds: [embed], components: [buttons] });
            } else {
                await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
            }

            await this.logFallbackUsage('discord_failure', {
                guildId: interaction.guildId,
                userId: interaction.user.id,
                error: error.message
            });

            return {
                fallbackUsed: true,
                fallbackType: 'website_redirect',
                message: 'Redirected to website due to Discord issues'
            };

        } catch (fallbackError) {
            logger.error('Discord failure fallback failed:', fallbackError);
            return {
                fallbackUsed: false,
                fallbackType: null,
                message: 'Unable to provide fallback'
            };
        }
    }

    /**
     * Handle maintenance mode scenarios
     * @param {Object} interaction - Discord interaction
     * @param {Object} maintenanceInfo - Maintenance information
     * @returns {Promise} Maintenance response
     */
    async handleMaintenanceMode(interaction, maintenanceInfo) {
        try {
            logger.info('Handling maintenance mode interaction', {
                guildId: interaction.guildId,
                userId: interaction.user.id,
                maintenanceInfo
            });

            const embed = this.createMaintenanceEmbed(maintenanceInfo);
            const buttons = this.createMaintenanceButtons();

            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({
                    embeds: [embed],
                    components: [buttons]
                });
            } else {
                await interaction.reply({
                    embeds: [embed],
                    components: [buttons],
                    ephemeral: true
                });
            }

            // Log maintenance mode interaction
            await this.logFallbackUsage('maintenance_mode', {
                guildId: interaction.guildId,
                userId: interaction.user.id,
                maintenanceInfo
            });

        } catch (error) {
            logger.error('Maintenance mode handling failed:', error);
            await this.handleCriticalFailure(interaction, 'maintenance_handler_failed');
        }
    }

    /**
     * Create API unavailable embed
     * @param {string} operation - Failed operation
     * @returns {EmbedBuilder} API unavailable embed
     */
    createApiUnavailableEmbed(operation) {
        return new EmbedBuilder()
            .setColor('#FF6B35')
            .setTitle('🔌 Service Temporarily Unavailable')
            .setDescription(
                'The Naffles API is currently unavailable. This is usually temporary and ' +
                'our team is working to restore service quickly.'
            )
            .addFields([
                {
                    name: '🔄 What happened?',
                    value: `The "${operation}" operation couldn't be completed due to a service interruption.`,
                    inline: false
                },
                {
                    name: '⏰ What can you do?',
                    value: 
                        '• Try again in a few minutes\n' +
                        '• Use the website directly for immediate access\n' +
                        '• Check our status page for updates',
                    inline: false
                },
                {
                    name: '🆘 Need immediate help?',
                    value: 'Visit our website or contact support using the buttons below.',
                    inline: false
                }
            ])
            .setFooter({
                text: 'We apologize for the inconvenience • Naffles Discord Bot',
                iconURL: 'https://naffles.com/favicon.ico'
            })
            .setTimestamp();
    }

    /**
     * Create maintenance mode embed
     * @param {Object} maintenanceInfo - Maintenance information
     * @returns {EmbedBuilder} Maintenance embed
     */
    createMaintenanceEmbed(maintenanceInfo) {
        const embed = new EmbedBuilder()
            .setColor('#6C5CE7')
            .setTitle('🔧 Scheduled Maintenance')
            .setDescription(
                'The Naffles Discord bot is currently undergoing scheduled maintenance to improve ' +
                'performance and add new features.'
            );

        const fields = [];

        if (maintenanceInfo.reason) {
            fields.push({
                name: '📋 Maintenance Details',
                value: maintenanceInfo.reason,
                inline: false
            });
        }

        if (maintenanceInfo.estimatedEndTime) {
            const endTime = new Date(maintenanceInfo.estimatedEndTime);
            const now = new Date();
            const timeRemaining = Math.max(0, Math.ceil((endTime - now) / (1000 * 60)));
            
            fields.push({
                name: '⏱️ Estimated Completion',
                value: `${endTime.toLocaleString()}\n(~${timeRemaining} minutes remaining)`,
                inline: false
            });
        }

        fields.push({
            name: '🌐 Alternative Access',
            value: 
                '• Visit naffles.com directly\n' +
                '• All web features remain fully functional\n' +
                '• Mobile app is also available',
            inline: false
        });

        embed.addFields(fields);
        embed.setFooter({
            text: 'Thank you for your patience during maintenance • Naffles Discord Bot',
            iconURL: 'https://naffles.com/favicon.ico'
        });
        embed.setTimestamp();

        return embed;
    }

    /**
     * Create website redirect buttons
     * @param {string} operation - Failed operation
     * @returns {ActionRowBuilder} Button row
     */
    createWebsiteRedirectButtons(operation) {
        const row = new ActionRowBuilder();

        // Main website button
        row.addComponents(
            new ButtonBuilder()
                .setLabel('Open Naffles Website')
                .setStyle(ButtonStyle.Link)
                .setURL(this.fallbackConfig.websiteUrl)
                .setEmoji('🌐')
        );

        // Operation-specific button
        if (operation.includes('task') || operation.includes('social')) {
            row.addComponents(
                new ButtonBuilder()
                    .setLabel('Manage Tasks')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`${this.fallbackConfig.websiteUrl}/community/tasks`)
                    .setEmoji('📋')
            );
        } else if (operation.includes('allowlist')) {
            row.addComponents(
                new ButtonBuilder()
                    .setLabel('View Allowlists')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`${this.fallbackConfig.websiteUrl}/allowlists`)
                    .setEmoji('📝')
            );
        }

        // Support button
        row.addComponents(
            new ButtonBuilder()
                .setLabel('Get Support')
                .setStyle(ButtonStyle.Link)
                .setURL(this.fallbackConfig.supportUrl)
                .setEmoji('🆘')
        );

        return row;
    }

    /**
     * Create maintenance mode buttons
     * @returns {ActionRowBuilder} Button row
     */
    createMaintenanceButtons() {
        return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('Visit Website')
                    .setStyle(ButtonStyle.Link)
                    .setURL(this.fallbackConfig.websiteUrl)
                    .setEmoji('🌐'),
                new ButtonBuilder()
                    .setLabel('Status Page')
                    .setStyle(ButtonStyle.Link)
                    .setURL(this.fallbackConfig.statusUrl)
                    .setEmoji('📊'),
                new ButtonBuilder()
                    .setLabel('Support Discord')
                    .setStyle(ButtonStyle.Link)
                    .setURL(this.fallbackConfig.discordSupportUrl)
                    .setEmoji('💬')
            );
    }

    /**
     * Handle critical system failures
     * @param {Object} interaction - Discord interaction
     * @param {string} failureType - Type of critical failure
     * @returns {Promise} Emergency response
     */
    async handleCriticalFailure(interaction, failureType) {
        try {
            logger.error('Critical system failure detected', {
                failureType,
                guildId: interaction.guildId,
                userId: interaction.user.id
            });

            const message = `🚨 **Critical System Error**\n\n` +
                `We're experiencing technical difficulties. Please visit ${this.fallbackConfig.websiteUrl} ` +
                `or contact support at ${this.fallbackConfig.supportUrl}\n\n` +
                `Error ID: ${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.editReply({ content: message, embeds: [], components: [] });
                } else {
                    await interaction.reply({ content: message, ephemeral: true });
                }
            } catch (replyError) {
                logger.error('Unable to send critical failure message:', replyError);
            }

        } catch (error) {
            logger.error('Critical failure handler failed:', error);
        }
    }

    /**
     * Provide graceful degradation for specific features
     * @param {string} feature - Feature that failed
     * @param {Object} context - Additional context
     * @returns {Object} Degradation options
     */
    getGracefulDegradation(feature, context = {}) {
        const degradations = {
            'task_creation': {
                alternative: 'website_form',
                message: 'Create tasks directly on the website',
                url: `${this.fallbackConfig.websiteUrl}/community/tasks/create`
            },
            'allowlist_management': {
                alternative: 'website_dashboard',
                message: 'Manage allowlists from your community dashboard',
                url: `${this.fallbackConfig.websiteUrl}/community/allowlists`
            },
            'community_linking': {
                alternative: 'manual_setup',
                message: 'Link your community manually in settings',
                url: `${this.fallbackConfig.websiteUrl}/community/settings`
            }
        };

        return degradations[feature] || {
            alternative: 'website_access',
            message: 'Use the website for full functionality',
            url: this.fallbackConfig.websiteUrl
        };
    }

    /**
     * Check if fallback should be used based on error patterns
     * @param {Error} error - Error to analyze
     * @param {string} operation - Operation that failed
     * @returns {Object} Fallback recommendation
     */
    shouldUseFallback(error, operation) {
        const errorMessage = error.message?.toLowerCase() || '';
        const errorCode = error.code;

        // API-related errors
        if (errorMessage.includes('econnrefused') || 
            errorMessage.includes('timeout') ||
            errorMessage.includes('network') ||
            errorMessage.includes('connection refused') ||
            errorCode === 'ECONNABORTED' ||
            errorCode === 'ECONNREFUSED') {
            return {
                useFallback: true,
                type: 'api_unavailable',
                reason: 'Network or API connectivity issue'
            };
        }

        // Database-related errors
        if (errorMessage.includes('connection') && errorMessage.includes('database') ||
            errorMessage.includes('mongodb') ||
            errorMessage.includes('redis')) {
            return {
                useFallback: true,
                type: 'database_unavailable',
                reason: 'Database connectivity issue'
            };
        }

        // Discord API errors
        if (errorCode === 429 || // Rate limit
            errorCode === 50013 || // Missing permissions
            errorCode === 10004 || // Unknown guild
            errorMessage.includes('discord')) {
            return {
                useFallback: true,
                type: 'discord_api_failure',
                reason: 'Discord API issue'
            };
        }

        // Default: no fallback needed
        return {
            useFallback: false,
            type: null,
            reason: 'Error does not require fallback'
        };
    }

    /**
     * Create user-friendly error message
     * @param {Error} error - Original error
     * @param {Object} options - Message options
     * @returns {Object} User-friendly message
     */
    createUserFriendlyMessage(error, options = {}) {
        const { context, suggestAlternatives } = options;

        let message = '⚠️ **Something went wrong**\n\n';
        
        // Provide context-specific messaging
        switch (context) {
            case 'task_creation':
                message += 'We couldn\'t create your task right now. ';
                break;
            case 'allowlist_management':
                message += 'We couldn\'t access your allowlist data right now. ';
                break;
            case 'community_linking':
                message += 'We couldn\'t link your community right now. ';
                break;
            default:
                message += 'The requested operation couldn\'t be completed right now. ';
        }

        message += 'This is usually temporary and should resolve quickly.\n\n';

        const alternatives = [];
        if (suggestAlternatives) {
            alternatives.push('Try again in a few minutes');
            alternatives.push(`Visit [naffles.com](${this.fallbackConfig.websiteUrl}) for full functionality`);
            alternatives.push(`Contact [support](${this.fallbackConfig.supportUrl}) if this persists`);
        }

        return { message, alternatives };
    }

    /**
     * Get troubleshooting steps for specific error types
     * @param {string} errorType - Type of error
     * @returns {Object} Troubleshooting information
     */
    getTroubleshootingSteps(errorType) {
        const troubleshooting = {
            connection_error: {
                steps: [
                    'Check your internet connection',
                    'Try the command again in 1-2 minutes',
                    'Visit naffles.com if the issue persists',
                    'Contact support if the problem continues'
                ]
            },
            permission_error: {
                steps: [
                    'Check that the bot has necessary permissions',
                    'Ensure you have the required role in this server',
                    'Ask a server administrator for help',
                    'Try the command in a different channel'
                ]
            },
            rate_limit: {
                steps: [
                    'Wait 30-60 seconds before trying again',
                    'Avoid rapid repeated commands',
                    'Use the website for immediate access',
                    'Commands will work normally after the cooldown'
                ]
            }
        };

        return troubleshooting[errorType] || {
            steps: [
                'Try the command again',
                'Wait a few minutes if it fails again',
                'Visit naffles.com for alternative access',
                'Contact support if needed'
            ]
        };
    }

    /**
     * Log fallback usage for monitoring
     * @param {string} type - Fallback type
     * @param {Object} details - Fallback details
     */
    async logFallbackUsage(type, details) {
        try {
            const logData = {
                type,
                timestamp: new Date(),
                details,
                stats: this.getFallbackStats()
            };

            logger.info('Fallback used', logData);

            // Update website redirect counter
            if (type.includes('unavailable') || type === 'maintenance_mode') {
                this.fallbackStats.websiteRedirects++;
            }

            // Store in database if available
            if (this.botService && this.botService.db) {
                try {
                    await this.botService.db.logFallbackUsage(logData);
                } catch (dbError) {
                    // Don't fail if database logging fails
                    logger.warn('Failed to log fallback usage to database:', dbError.message);
                }
            }

        } catch (error) {
            logger.error('Failed to log fallback usage:', error);
        }
    }

    /**
     * Get fallback usage statistics
     * @returns {Object} Fallback statistics
     */
    getFallbackStats() {
        const now = Date.now();
        const hoursSinceReset = (now - this.fallbackStats.lastReset) / (1000 * 60 * 60);

        return {
            ...this.fallbackStats,
            hoursSinceReset: hoursSinceReset.toFixed(2),
            totalFallbacks: this.fallbackStats.apiFailures + 
                           this.fallbackStats.databaseFailures + 
                           this.fallbackStats.discordFailures
        };
    }

    /**
     * Reset fallback statistics
     */
    resetStats() {
        this.fallbackStats = {
            apiFailures: 0,
            databaseFailures: 0,
            discordFailures: 0,
            websiteRedirects: 0,
            lastReset: Date.now()
        };

        logger.info('Fallback statistics reset');
    }

    /**
     * Enable maintenance mode
     * @param {Object} maintenanceInfo - Maintenance information
     */
    enableMaintenanceMode(maintenanceInfo) {
        this.maintenanceMode = {
            active: true,
            reason: maintenanceInfo.reason || 'Scheduled maintenance',
            startTime: new Date(),
            estimatedEndTime: maintenanceInfo.estimatedEndTime || null
        };

        logger.info('Maintenance mode enabled', this.maintenanceMode);
    }

    /**
     * Disable maintenance mode
     */
    disableMaintenanceMode() {
        this.maintenanceMode = {
            active: false,
            reason: null,
            startTime: null,
            estimatedEndTime: null
        };

        logger.info('Maintenance mode disabled');
    }

    /**
     * Check if maintenance mode is active
     * @returns {boolean} Maintenance mode status
     */
    isMaintenanceModeActive() {
        return this.maintenanceMode.active;
    }

    /**
     * Update service status
     * @param {string} service - Service name
     * @param {boolean} available - Service availability
     */
    updateServiceStatus(service, available) {
        if (this.serviceStatus[service]) {
            this.serviceStatus[service].available = available;
            this.serviceStatus[service].lastCheck = Date.now();
            
            logger.info(`Service status updated: ${service} = ${available ? 'available' : 'unavailable'}`);
        }
    }

    /**
     * Get service status
     * @param {string} service - Service name
     * @returns {Object} Service status
     */
    getServiceStatus(service) {
        return this.serviceStatus[service] || { available: false, lastCheck: 0 };
    }

    /**
     * Get all service statuses
     * @returns {Object} All service statuses
     */
    getAllServiceStatuses() {
        return { ...this.serviceStatus };
    }
}

module.exports = FallbackService;