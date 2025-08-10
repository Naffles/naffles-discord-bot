const logger = require('../utils/logger');
const AllowlistConnection = require('../models/allowlistConnection');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * Allowlist Integration Service
 * Handles comprehensive allowlist integration and entry management for Discord servers
 */
class AllowlistIntegrationService {
    constructor(botService) {
        this.botService = botService;
        this.activeConnections = new Map(); // Track active allowlist connections
        this.entryCache = new Map(); // Cache entry attempts for anti-fraud
        this.syncInterval = null;
        
        // Initialize real-time synchronization
        this.initializeRealTimeSync();
    }

    /**
     * Connect an existing Naffles allowlist to a Discord server
     * @param {Object} params - Connection parameters
     * @returns {Object} Connection result
     */
    async connectAllowlistToServer(params) {
        try {
            const { allowlistId, guildId, channelId, connectedBy } = params;

            // Fetch allowlist details from Naffles API
            const allowlist = await this.botService.makeNafflesApiCall(
                `/api/allowlists/${allowlistId}`
            );

            if (!allowlist) {
                throw new Error('Allowlist not found');
            }

            // Check if allowlist is already connected to this server
            const existingConnection = await AllowlistConnection.findConnection(allowlistId, guildId);
            if (existingConnection) {
                throw new Error('Allowlist is already connected to this server');
            }

            // Validate server community mapping
            const serverMapping = await this.botService.getServerCommunityMapping(guildId);
            if (!serverMapping) {
                throw new Error('Discord server is not linked to a Naffles community');
            }

            // Verify allowlist belongs to the community
            if (allowlist.communityId !== serverMapping.communityId) {
                throw new Error('Allowlist does not belong to your community');
            }

            // Get Discord channel
            const channel = await this.botService.client.channels.fetch(channelId);
            if (!channel) {
                throw new Error('Discord channel not found');
            }

            // Create comprehensive allowlist embed
            const allowlistEmbed = this.createComprehensiveAllowlistEmbed(allowlist);
            const actionButtons = this.createAllowlistActionButtons(allowlist);

            // Post allowlist to Discord channel
            const allowlistMessage = await channel.send({
                embeds: [allowlistEmbed],
                components: [actionButtons]
            });

            // Store allowlist connection in database
            const connection = new AllowlistConnection({
                allowlistId: allowlist.id,
                guildId,
                channelId,
                messageId: allowlistMessage.id,
                connectedBy,
                allowlistData: {
                    title: allowlist.title,
                    description: allowlist.description,
                    prize: allowlist.prize,
                    winnerCount: allowlist.winnerCount,
                    entryPrice: allowlist.entryPrice?.amount || '0',
                    endTime: allowlist.endTime,
                    status: allowlist.status
                }
            });

            await connection.save();

            // Add to active connections for real-time updates
            this.activeConnections.set(allowlist.id, {
                connection,
                lastUpdate: new Date(),
                channel,
                message: allowlistMessage
            });

            // Update allowlist with Discord connection info via API
            await this.botService.makeNafflesApiCall(
                `/api/allowlists/${allowlistId}/discord-connection`,
                'POST',
                {
                    guildId,
                    channelId,
                    messageId: allowlistMessage.id,
                    connected: true
                }
            );

            logger.info(`Allowlist ${allowlistId} connected to Discord server ${guildId}`);

            return {
                success: true,
                connection,
                message: allowlistMessage,
                allowlist
            };

        } catch (error) {
            logger.error('Error connecting allowlist to server:', error);
            throw error;
        }
    }

    /**
     * Process allowlist entry with comprehensive validation
     * @param {Object} interaction - Discord interaction
     * @param {string} allowlistId - Allowlist ID
     * @returns {Object} Entry result
     */
    async processAllowlistEntry(interaction, allowlistId) {
        try {
            const userId = interaction.user.id;
            const username = interaction.user.username;

            // Anti-fraud: Check entry rate limiting
            const rateLimitKey = `allowlist_entry_${userId}_${allowlistId}`;
            const isRateLimited = await this.botService.rateLimiter.checkRateLimit(
                rateLimitKey,
                3, // 3 attempts
                300 // per 5 minutes
            );

            if (isRateLimited) {
                return {
                    success: false,
                    message: '⏰ You are attempting to enter too frequently. Please wait 5 minutes and try again.',
                    reason: 'rate_limited'
                };
            }

            // Get user's Naffles account
            const userAccount = await this.botService.db.getUserAccountLink(userId);
            if (!userAccount) {
                return {
                    success: false,
                    message: '❌ You need to link your Naffles account first. Visit https://naffles.com/discord-link to get started.',
                    reason: 'account_not_linked'
                };
            }

            // Fetch allowlist details
            const allowlist = await this.botService.makeNafflesApiCall(
                `/api/allowlists/${allowlistId}`
            );

            if (!allowlist) {
                return {
                    success: false,
                    message: '❌ Allowlist not found.',
                    reason: 'allowlist_not_found'
                };
            }

            // Check allowlist status and timing
            const now = new Date();
            const endTime = new Date(allowlist.endTime);

            if (allowlist.status !== 'active' || now > endTime) {
                return {
                    success: false,
                    message: '❌ This allowlist is no longer active.',
                    reason: 'allowlist_inactive'
                };
            }

            // Check for existing entry
            const existingEntry = await this.botService.makeNafflesApiCall(
                `/api/allowlists/${allowlistId}/participation`,
                'GET',
                null,
                { userId: userAccount.nafflesUserId }
            );

            if (existingEntry) {
                return {
                    success: false,
                    message: '✅ You are already entered in this allowlist!',
                    reason: 'already_entered'
                };
            }

            // Validate social task requirements
            const requirementValidation = await this.validateSocialRequirements(
                allowlist,
                userAccount.nafflesUserId,
                userId
            );

            if (!requirementValidation.valid) {
                return {
                    success: false,
                    message: `❌ Requirements not met: ${requirementValidation.message}`,
                    reason: 'requirements_not_met',
                    details: requirementValidation.details
                };
            }

            // Check entry capacity
            if (allowlist.maxEntries && allowlist.totalEntries >= allowlist.maxEntries) {
                return {
                    success: false,
                    message: '❌ This allowlist has reached maximum capacity.',
                    reason: 'capacity_reached'
                };
            }

            // Process entry through Naffles API
            const entryData = {
                userId: userAccount.nafflesUserId,
                discordId: userId,
                discordUsername: username,
                walletAddress: userAccount.walletAddress,
                socialData: {
                    discordId: userId,
                    discordUsername: username,
                    verifiedAt: new Date()
                },
                completedTasks: requirementValidation.completedTasks || []
            };

            const entryResult = await this.botService.makeNafflesApiCall(
                `/api/allowlists/${allowlistId}/enter`,
                'POST',
                entryData
            );

            if (!entryResult) {
                return {
                    success: false,
                    message: '❌ Failed to process entry. Please try again later.',
                    reason: 'entry_failed'
                };
            }

            // Update connection analytics
            await this.updateConnectionAnalytics(allowlistId, 'entry', userId);

            // Send success notification
            await this.sendEntrySuccessNotification(interaction, allowlist, entryResult);

            // Update Discord embed with new participant count
            await this.updateAllowlistEmbed(allowlistId);

            logger.info(`User ${userId} successfully entered allowlist ${allowlistId}`);

            return {
                success: true,
                message: '🎉 Successfully entered the allowlist! Good luck!',
                entry: entryResult
            };

        } catch (error) {
            logger.error('Error processing allowlist entry:', error);
            
            // Determine error type and provide appropriate message
            let errorMessage = '❌ An error occurred while processing your entry. Please try again later.';
            let reason = 'unknown_error';

            if (error.response) {
                if (error.response.status === 400) {
                    errorMessage = '❌ Invalid entry data. Please check the requirements and try again.';
                    reason = 'invalid_data';
                } else if (error.response.status === 403) {
                    errorMessage = '❌ You don\'t have permission to enter this allowlist.';
                    reason = 'permission_denied';
                } else if (error.response.status === 409) {
                    errorMessage = '✅ You are already entered in this allowlist!';
                    reason = 'already_entered';
                }
            }

            return {
                success: false,
                message: errorMessage,
                reason,
                error: error.message
            };
        }
    }

    /**
     * Validate social task requirements for allowlist entry
     * @param {Object} allowlist - Allowlist data
     * @param {string} nafflesUserId - Naffles user ID
     * @param {string} discordId - Discord user ID
     * @returns {Object} Validation result
     */
    async validateSocialRequirements(allowlist, nafflesUserId, discordId) {
        try {
            if (!allowlist.socialTasks || allowlist.socialTasks.length === 0) {
                return { valid: true, completedTasks: [] };
            }

            const completedTasks = [];
            const failedTasks = [];

            for (const task of allowlist.socialTasks) {
                if (!task.required) {
                    continue; // Skip optional tasks
                }

                const validation = await this.validateSingleSocialTask(task, nafflesUserId, discordId);
                
                if (validation.valid) {
                    completedTasks.push({
                        taskId: task.taskId,
                        taskType: task.taskType,
                        completedAt: new Date(),
                        verificationData: validation.verificationData
                    });
                } else {
                    failedTasks.push({
                        taskType: task.taskType,
                        reason: validation.reason,
                        guidance: validation.guidance
                    });
                }
            }

            if (failedTasks.length > 0) {
                const failureMessages = failedTasks.map(task => 
                    `• ${this.formatTaskType(task.taskType)}: ${task.reason}`
                ).join('\n');

                return {
                    valid: false,
                    message: 'Please complete the required social tasks',
                    details: failureMessages,
                    failedTasks
                };
            }

            return {
                valid: true,
                completedTasks
            };

        } catch (error) {
            logger.error('Error validating social requirements:', error);
            return {
                valid: false,
                message: 'Unable to verify social requirements',
                error: error.message
            };
        }
    }

    /**
     * Validate a single social task
     * @param {Object} task - Social task data
     * @param {string} nafflesUserId - Naffles user ID
     * @param {string} discordId - Discord user ID
     * @returns {Object} Validation result
     */
    async validateSingleSocialTask(task, nafflesUserId, discordId) {
        try {
            switch (task.taskType) {
                case 'twitter_follow':
                    return await this.validateTwitterFollow(task, nafflesUserId);
                
                case 'discord_join':
                    return await this.validateDiscordJoin(task, discordId);
                
                case 'telegram_join':
                    return await this.validateTelegramJoin(task, nafflesUserId);
                
                case 'custom':
                    return await this.validateCustomTask(task, nafflesUserId);
                
                default:
                    return {
                        valid: false,
                        reason: 'Unknown task type',
                        guidance: 'Please contact support for assistance'
                    };
            }
        } catch (error) {
            logger.error(`Error validating ${task.taskType} task:`, error);
            return {
                valid: false,
                reason: 'Verification failed',
                guidance: 'Please try again or contact support'
            };
        }
    }

    /**
     * Validate Twitter follow task
     * @param {Object} task - Twitter task data
     * @param {string} nafflesUserId - Naffles user ID
     * @returns {Object} Validation result
     */
    async validateTwitterFollow(task, nafflesUserId) {
        try {
            // Call Naffles API to verify Twitter follow
            const verification = await this.botService.makeNafflesApiCall(
                `/api/social-tasks/verify-twitter-follow`,
                'POST',
                {
                    userId: nafflesUserId,
                    targetUsername: task.verificationData?.twitter?.username,
                    taskId: task.taskId
                }
            );

            return {
                valid: verification.verified,
                reason: verification.verified ? 'Verified' : 'Twitter follow not detected',
                guidance: verification.verified ? null : `Please follow @${task.verificationData?.twitter?.username} on Twitter`,
                verificationData: verification.data
            };
        } catch (error) {
            logger.error('Error validating Twitter follow:', error);
            return {
                valid: false,
                reason: 'Unable to verify Twitter follow',
                guidance: 'Please ensure you have followed the required account and try again'
            };
        }
    }

    /**
     * Validate Discord join task
     * @param {Object} task - Discord task data
     * @param {string} discordId - Discord user ID
     * @returns {Object} Validation result
     */
    async validateDiscordJoin(task, discordId) {
        try {
            const serverId = task.verificationData?.discord?.serverId;
            if (!serverId) {
                return {
                    valid: false,
                    reason: 'Invalid Discord server configuration',
                    guidance: 'Please contact the allowlist creator'
                };
            }

            // Check if user is in the required Discord server
            const guild = await this.botService.client.guilds.fetch(serverId).catch(() => null);
            if (!guild) {
                return {
                    valid: false,
                    reason: 'Unable to access Discord server',
                    guidance: 'Please ensure the server is accessible and try again'
                };
            }

            const member = await guild.members.fetch(discordId).catch(() => null);
            if (!member) {
                return {
                    valid: false,
                    reason: 'Not a member of the required Discord server',
                    guidance: `Please join the Discord server: ${task.verificationData?.discord?.serverName || 'Required Server'}`
                };
            }

            // Check for required role if specified
            if (task.verificationData?.discord?.requiredRole) {
                const hasRole = member.roles.cache.some(role => 
                    role.name === task.verificationData.discord.requiredRole ||
                    role.id === task.verificationData.discord.requiredRole
                );

                if (!hasRole) {
                    return {
                        valid: false,
                        reason: `Missing required role: ${task.verificationData.discord.requiredRole}`,
                        guidance: 'Please obtain the required role in the Discord server'
                    };
                }
            }

            return {
                valid: true,
                reason: 'Discord membership verified',
                verificationData: {
                    serverId,
                    memberSince: member.joinedAt,
                    roles: member.roles.cache.map(role => role.name)
                }
            };

        } catch (error) {
            logger.error('Error validating Discord join:', error);
            return {
                valid: false,
                reason: 'Unable to verify Discord membership',
                guidance: 'Please ensure you have joined the required Discord server'
            };
        }
    }

    /**
     * Validate Telegram join task
     * @param {Object} task - Telegram task data
     * @param {string} nafflesUserId - Naffles user ID
     * @returns {Object} Validation result
     */
    async validateTelegramJoin(task, nafflesUserId) {
        try {
            // Call Naffles API to verify Telegram membership
            const verification = await this.botService.makeNafflesApiCall(
                `/api/social-tasks/verify-telegram-join`,
                'POST',
                {
                    userId: nafflesUserId,
                    channelId: task.verificationData?.telegram?.channelId,
                    taskId: task.taskId
                }
            );

            return {
                valid: verification.verified,
                reason: verification.verified ? 'Verified' : 'Telegram membership not detected',
                guidance: verification.verified ? null : `Please join the Telegram channel: ${task.verificationData?.telegram?.channelName}`,
                verificationData: verification.data
            };
        } catch (error) {
            logger.error('Error validating Telegram join:', error);
            return {
                valid: false,
                reason: 'Unable to verify Telegram membership',
                guidance: 'Please ensure you have joined the required Telegram channel'
            };
        }
    }

    /**
     * Validate custom task
     * @param {Object} task - Custom task data
     * @param {string} nafflesUserId - Naffles user ID
     * @returns {Object} Validation result
     */
    async validateCustomTask(task, nafflesUserId) {
        try {
            // Call Naffles API to verify custom task
            const verification = await this.botService.makeNafflesApiCall(
                `/api/social-tasks/verify-custom-task`,
                'POST',
                {
                    userId: nafflesUserId,
                    taskId: task.taskId,
                    verificationUrl: task.verificationData?.custom?.verificationUrl
                }
            );

            return {
                valid: verification.verified,
                reason: verification.verified ? 'Verified' : verification.reason || 'Custom task not completed',
                guidance: verification.verified ? null : verification.guidance || 'Please complete the required task',
                verificationData: verification.data
            };
        } catch (error) {
            logger.error('Error validating custom task:', error);
            return {
                valid: false,
                reason: 'Unable to verify custom task',
                guidance: 'Please complete the required task and try again'
            };
        }
    }

    /**
     * Create comprehensive allowlist embed with all information
     * @param {Object} allowlist - Allowlist data
     * @returns {EmbedBuilder} Discord embed
     */
    createComprehensiveAllowlistEmbed(allowlist) {
        const embed = new EmbedBuilder()
            .setTitle(`🎫 ${allowlist.title}`)
            .setDescription(allowlist.description || 'Join this exclusive allowlist!')
            .setColor(0x10B981) // Green
            .setFooter({ 
                text: 'Powered by Naffles', 
                iconURL: 'https://naffles.com/logo.png' 
            })
            .setTimestamp();

        // Add prize information
        if (allowlist.prize) {
            embed.addFields({
                name: '🏆 Prize',
                value: allowlist.prize,
                inline: true
            });
        }

        // Add winner count
        const winnerText = allowlist.winnerCount === 'everyone' 
            ? 'Everyone Wins!' 
            : `${allowlist.winnerCount} Winners`;
        
        embed.addFields({
            name: '👥 Winners',
            value: winnerText,
            inline: true
        });

        // Add entry price
        const priceText = !allowlist.entryPrice || parseFloat(allowlist.entryPrice.amount) === 0
            ? 'Free'
            : `${allowlist.entryPrice.amount} ${allowlist.entryPrice.tokenType}`;
        
        embed.addFields({
            name: '💰 Entry Price',
            value: priceText,
            inline: true
        });

        // Add current participants
        embed.addFields({
            name: '📊 Participants',
            value: `${allowlist.totalEntries || 0}`,
            inline: true
        });

        // Add end time
        if (allowlist.endTime) {
            const endTimestamp = Math.floor(new Date(allowlist.endTime).getTime() / 1000);
            embed.addFields({
                name: '⏰ Ends',
                value: `<t:${endTimestamp}:R>`,
                inline: true
            });
        }

        // Add status
        const statusEmoji = allowlist.status === 'active' ? '🟢' : '🔴';
        embed.addFields({
            name: '📈 Status',
            value: `${statusEmoji} ${allowlist.status.charAt(0).toUpperCase() + allowlist.status.slice(1)}`,
            inline: true
        });

        // Add social requirements if any
        if (allowlist.socialTasks && allowlist.socialTasks.length > 0) {
            const requirements = allowlist.socialTasks
                .filter(task => task.required)
                .map(task => `• ${this.formatTaskType(task.taskType)}`)
                .join('\n');
            
            if (requirements) {
                embed.addFields({
                    name: '📋 Requirements',
                    value: requirements,
                    inline: false
                });
            }
        }

        // Add profit guarantee if applicable
        if (allowlist.profitGuaranteePercentage && allowlist.profitGuaranteePercentage > 0) {
            embed.addFields({
                name: '💎 Profit Guarantee',
                value: `${allowlist.profitGuaranteePercentage}% of winner sales distributed to losers`,
                inline: false
            });
        }

        return embed;
    }

    /**
     * Create action buttons for allowlist interaction
     * @param {Object} allowlist - Allowlist data
     * @returns {ActionRowBuilder} Action row with buttons
     */
    createAllowlistActionButtons(allowlist) {
        const row = new ActionRowBuilder();

        // Enter allowlist button
        const enterButton = new ButtonBuilder()
            .setCustomId(`enter_allowlist_${allowlist.id}`)
            .setLabel('Enter Allowlist')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🎫');

        // Disable if allowlist is not active
        if (allowlist.status !== 'active' || new Date() > new Date(allowlist.endTime)) {
            enterButton.setDisabled(true);
        }

        row.addComponents(enterButton);

        // View details button
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`view_allowlist_${allowlist.id}`)
                .setLabel('View Details')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('👁️')
        );

        // Visit Naffles button
        row.addComponents(
            new ButtonBuilder()
                .setURL(`https://naffles.com/allowlist/${allowlist.id}`)
                .setLabel('View on Naffles')
                .setStyle(ButtonStyle.Link)
                .setEmoji('🔗')
        );

        return row;
    }

    /**
     * Send entry success notification to user
     * @param {Object} interaction - Discord interaction
     * @param {Object} allowlist - Allowlist data
     * @param {Object} entry - Entry result
     */
    async sendEntrySuccessNotification(interaction, allowlist, entry) {
        try {
            const successEmbed = new EmbedBuilder()
                .setTitle('🎉 Allowlist Entry Successful!')
                .setDescription(`You have successfully entered **${allowlist.title}**`)
                .setColor(0x10B981) // Green
                .addFields(
                    { name: '👤 Discord User', value: interaction.user.username, inline: true },
                    { name: '🎫 Entry ID', value: entry.id || 'N/A', inline: true },
                    { name: '⏰ Entered At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                )
                .setFooter({ 
                    text: 'Good luck! Winners will be announced when the allowlist ends.', 
                    iconURL: 'https://naffles.com/logo.png' 
                })
                .setTimestamp();

            // Add winner announcement time if available
            if (allowlist.endTime) {
                const endTimestamp = Math.floor(new Date(allowlist.endTime).getTime() / 1000);
                successEmbed.addFields({
                    name: '🏆 Winners Announced',
                    value: `<t:${endTimestamp}:F>`,
                    inline: false
                });
            }

            await interaction.reply({
                embeds: [successEmbed],
                ephemeral: true
            });

        } catch (error) {
            logger.error('Error sending entry success notification:', error);
            // Fallback to simple message
            await interaction.reply({
                content: '🎉 Successfully entered the allowlist! Good luck!',
                ephemeral: true
            });
        }
    }

    /**
     * Update connection analytics
     * @param {string} allowlistId - Allowlist ID
     * @param {string} action - Action type
     * @param {string} userId - User ID
     */
    async updateConnectionAnalytics(allowlistId, action, userId) {
        try {
            const connections = await AllowlistConnection.findByAllowlist(allowlistId);
            
            for (const connection of connections) {
                if (action === 'entry') {
                    await connection.incrementEntries();
                } else if (action === 'view') {
                    await connection.incrementViews();
                }
            }

            logger.debug(`Updated analytics for allowlist ${allowlistId}: ${action} by ${userId}`);
        } catch (error) {
            logger.error('Error updating connection analytics:', error);
        }
    }

    /**
     * Update allowlist embed with current data
     * @param {string} allowlistId - Allowlist ID
     */
    async updateAllowlistEmbed(allowlistId) {
        try {
            const connections = await AllowlistConnection.findByAllowlist(allowlistId);
            if (connections.length === 0) return;

            // Fetch updated allowlist data
            const allowlist = await this.botService.makeNafflesApiCall(
                `/api/allowlists/${allowlistId}`
            );

            if (!allowlist) return;

            // Update each connected Discord message
            for (const connection of connections) {
                try {
                    const channel = await this.botService.client.channels.fetch(connection.channelId);
                    if (!channel) continue;

                    const message = await channel.messages.fetch(connection.messageId);
                    if (!message) continue;

                    // Create updated embed
                    const updatedEmbed = this.createComprehensiveAllowlistEmbed(allowlist);
                    const updatedButtons = this.createAllowlistActionButtons(allowlist);

                    // Update message
                    await message.edit({
                        embeds: [updatedEmbed],
                        components: [updatedButtons]
                    });

                    // Update connection data
                    await connection.updateAllowlistData({
                        status: allowlist.status,
                        participants: allowlist.totalEntries
                    });

                } catch (messageError) {
                    logger.error(`Error updating message for connection ${connection._id}:`, messageError);
                }
            }

        } catch (error) {
            logger.error('Error updating allowlist embed:', error);
        }
    }

    /**
     * Initialize real-time synchronization with Naffles backend
     */
    initializeRealTimeSync() {
        // Set up periodic sync every 30 seconds
        this.syncInterval = setInterval(async () => {
            await this.syncAllowlistStatuses();
        }, 30000);

        logger.info('Allowlist real-time synchronization initialized');
    }

    /**
     * Sync allowlist statuses with Naffles backend
     */
    async syncAllowlistStatuses() {
        try {
            const activeConnections = await AllowlistConnection.find({ isActive: true });
            
            for (const connection of activeConnections) {
                try {
                    // Fetch current allowlist status
                    const allowlist = await this.botService.makeNafflesApiCall(
                        `/api/allowlists/${connection.allowlistId}`
                    );

                    if (!allowlist) continue;

                    // Check if status has changed
                    const hasStatusChanged = connection.allowlistData.status !== allowlist.status;
                    const hasParticipantsChanged = connection.allowlistData.participants !== allowlist.totalEntries;

                    if (hasStatusChanged || hasParticipantsChanged) {
                        await this.updateAllowlistEmbed(connection.allowlistId);
                        
                        // Handle expiration
                        if (allowlist.status === 'ended' && connection.allowlistData.status === 'active') {
                            await this.handleAllowlistExpiration(connection, allowlist);
                        }
                    }

                } catch (syncError) {
                    logger.error(`Error syncing allowlist ${connection.allowlistId}:`, syncError);
                }
            }

        } catch (error) {
            logger.error('Error during allowlist status sync:', error);
        }
    }

    /**
     * Handle allowlist expiration
     * @param {Object} connection - Allowlist connection
     * @param {Object} allowlist - Updated allowlist data
     */
    async handleAllowlistExpiration(connection, allowlist) {
        try {
            const channel = await this.botService.client.channels.fetch(connection.channelId);
            if (!channel) return;

            // Send expiration notification
            const expirationEmbed = new EmbedBuilder()
                .setTitle('⏰ Allowlist Ended')
                .setDescription(`**${allowlist.title}** has ended. Winners will be announced soon!`)
                .setColor(0xF59E0B) // Amber
                .addFields(
                    { name: '📊 Total Participants', value: `${allowlist.totalEntries || 0}`, inline: true },
                    { name: '👥 Winners', value: `${allowlist.winnerCount}`, inline: true }
                )
                .setFooter({ 
                    text: 'Powered by Naffles', 
                    iconURL: 'https://naffles.com/logo.png' 
                })
                .setTimestamp();

            await channel.send({
                embeds: [expirationEmbed]
            });

            logger.info(`Allowlist ${connection.allowlistId} expired, notification sent`);

        } catch (error) {
            logger.error('Error handling allowlist expiration:', error);
        }
    }

    /**
     * Get allowlist entry analytics for community administrators
     * @param {string} guildId - Discord guild ID
     * @returns {Object} Analytics data
     */
    async getAllowlistAnalytics(guildId) {
        try {
            const stats = await AllowlistConnection.getEntryStats(guildId);
            const connections = await AllowlistConnection.findByGuild(guildId);

            return {
                totalAllowlists: connections.length,
                activeAllowlists: connections.filter(c => c.allowlistData.status === 'active').length,
                totalViews: stats[0]?.totalViews || 0,
                totalEntries: stats[0]?.totalEntries || 0,
                averageViewsPerAllowlist: Math.round(stats[0]?.avgViewsPerAllowlist || 0),
                averageEntriesPerAllowlist: Math.round(stats[0]?.avgEntriesPerAllowlist || 0),
                connections: connections.map(c => ({
                    allowlistId: c.allowlistId,
                    title: c.allowlistData.title,
                    status: c.allowlistData.status,
                    views: c.interactions.views,
                    entries: c.interactions.entries,
                    connectedAt: c.connectedAt
                }))
            };

        } catch (error) {
            logger.error('Error getting allowlist analytics:', error);
            throw error;
        }
    }

    /**
     * Format task type for display
     * @param {string} taskType - Task type
     * @returns {string} Formatted task type
     */
    formatTaskType(taskType) {
        const typeMap = {
            'twitter_follow': '🐦 Twitter Follow',
            'discord_join': '💬 Discord Join',
            'telegram_join': '📱 Telegram Join',
            'custom': '🔧 Custom Task'
        };
        return typeMap[taskType] || `🔧 ${taskType}`;
    }

    /**
     * Cleanup method
     */
    cleanup() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        
        this.activeConnections.clear();
        this.entryCache.clear();
        
        logger.info('Allowlist integration service cleaned up');
    }
}

module.exports = AllowlistIntegrationService;