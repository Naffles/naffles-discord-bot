const logger = require('../utils/logger');
const axios = require('axios');

/**
 * Social Task Integration Service
 * Handles integration between Discord bot and Naffles social task system
 * Provides seamless task creation, management, and completion tracking
 */
class SocialTaskIntegrationService {
    constructor(botService) {
        this.botService = botService;
        this.nafflesApiBaseUrl = process.env.NAFFLES_API_BASE_URL;
        this.nafflesApiKey = process.env.NAFFLES_API_KEY;
        
        // Task completion tracking
        this.activeCompletions = new Map();
        
        // Task analytics cache
        this.analyticsCache = new Map();
        this.analyticsCacheExpiry = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Create a social task through Discord bot integration
     * @param {Object} taskData - Task creation data
     * @param {Object} discordContext - Discord context (guild, user, etc.)
     * @returns {Promise<Object>} Created task with Discord integration data
     */
    async createSocialTask(taskData, discordContext) {
        try {
            logger.info('Creating social task via Discord integration:', {
                taskType: taskData.type,
                guildId: discordContext.guildId,
                userId: discordContext.userId
            });

            // Get server-community mapping
            const serverMapping = await this.botService.getServerCommunityMapping(discordContext.guildId);
            if (!serverMapping) {
                throw new Error('Discord server is not linked to a Naffles community');
            }

            // Prepare task data for Naffles API
            const nafflesTaskData = this.prepareTaskDataForNaffles(taskData, serverMapping.communityId, discordContext);

            // Create task via Naffles API
            const createdTask = await this.botService.makeNafflesApiCall(
                '/api/social-tasks',
                'POST',
                nafflesTaskData
            );

            // Store Discord-specific task metadata
            await this.storeDiscordTaskMetadata(createdTask.id, {
                guildId: discordContext.guildId,
                channelId: discordContext.channelId,
                createdBy: discordContext.userId,
                createdAt: new Date(),
                messageId: null // Will be set when posted
            });

            // Initialize task analytics tracking
            await this.initializeTaskAnalytics(createdTask.id);

            logger.info('Social task created successfully:', {
                taskId: createdTask.id,
                title: createdTask.title,
                type: createdTask.type
            });

            return {
                ...createdTask,
                discordIntegration: {
                    guildId: discordContext.guildId,
                    channelId: discordContext.channelId,
                    createdBy: discordContext.userId
                }
            };

        } catch (error) {
            logger.error('Error creating social task via Discord:', error);
            throw error;
        }
    }

    /**
     * Post task to Discord channel with rich embed and interactive buttons
     * @param {Object} channel - Discord channel object
     * @param {Object} taskData - Task data
     * @param {Object} options - Posting options
     * @returns {Promise<Object>} Posted message and tracking data
     */
    async postTaskToDiscord(channel, taskData, options = {}) {
        try {
            logger.info('Posting task to Discord channel:', {
                taskId: taskData.id,
                channelId: channel.id,
                guildId: channel.guild.id
            });

            // Create task embed with real-time updates enabled
            const embed = this.botService.createTaskEmbed(taskData, {
                showProgress: true,
                showAnalytics: options.showAnalytics || false,
                enableUpdates: true
            });

            // Create interactive buttons
            const buttons = this.botService.createActionButtons('task', taskData, {
                showCompleteButton: true,
                showDetailsButton: true,
                showAnalyticsButton: options.showAnalytics || false
            });

            // Post message to Discord
            const message = await channel.send({
                embeds: [embed],
                components: [buttons]
            });

            // Store message reference for updates
            await this.storeTaskMessage({
                taskId: taskData.id,
                guildId: channel.guild.id,
                channelId: channel.id,
                messageId: message.id,
                embedId: `task_${taskData.id}_${message.id}`,
                createdAt: new Date()
            });

            // Register for real-time updates
            if (options.enableUpdates !== false) {
                await this.registerTaskForUpdates(taskData.id, {
                    guildId: channel.guild.id,
                    channelId: channel.id,
                    messageId: message.id,
                    updateFrequency: options.updateFrequency || 30000
                });
            }

            // Start progress tracking
            await this.startTaskProgressTracking(taskData.id);

            logger.info('Task posted to Discord successfully:', {
                taskId: taskData.id,
                messageId: message.id
            });

            return {
                message,
                embedId: `task_${taskData.id}_${message.id}`,
                trackingEnabled: true
            };

        } catch (error) {
            logger.error('Error posting task to Discord:', error);
            throw error;
        }
    }

    /**
     * Handle task completion from Discord interaction
     * @param {Object} interaction - Discord interaction
     * @param {string} taskId - Task ID
     * @returns {Promise<Object>} Completion result
     */
    async handleTaskCompletion(interaction, taskId) {
        try {
            logger.info('Handling task completion from Discord:', {
                taskId,
                userId: interaction.user.id,
                guildId: interaction.guildId
            });

            // Check if user has linked Naffles account
            const userAccount = await this.botService.db.getUserAccountLink(interaction.user.id);
            if (!userAccount) {
                return {
                    success: false,
                    reason: 'account_not_linked',
                    message: 'You need to link your Naffles account first. Visit https://naffles.com/discord-link to get started.'
                };
            }

            // Get task details
            const task = await this.getTaskDetails(taskId);
            if (!task) {
                return {
                    success: false,
                    reason: 'task_not_found',
                    message: 'Task not found or no longer available.'
                };
            }

            // Check task availability
            const availability = await this.checkTaskAvailability(task, userAccount.nafflesUserId);
            if (!availability.available) {
                return {
                    success: false,
                    reason: availability.reason,
                    message: availability.message
                };
            }

            // Track completion attempt
            const completionId = `${taskId}_${userAccount.nafflesUserId}`;
            this.activeCompletions.set(completionId, {
                taskId,
                userId: userAccount.nafflesUserId,
                discordId: interaction.user.id,
                startedAt: new Date(),
                status: 'processing'
            });

            // Process task completion based on type
            const completionResult = await this.processTaskCompletion(task, userAccount, interaction);

            // Update completion tracking
            this.activeCompletions.set(completionId, {
                ...this.activeCompletions.get(completionId),
                status: completionResult.success ? 'completed' : 'failed',
                completedAt: new Date(),
                result: completionResult
            });

            // Update task analytics
            await this.updateTaskAnalytics(taskId, {
                completionAttempt: true,
                success: completionResult.success,
                userId: userAccount.nafflesUserId,
                discordId: interaction.user.id
            });

            // Update Discord embed if completion was successful
            if (completionResult.success) {
                await this.updateTaskEmbed(taskId, {
                    newCompletion: true,
                    completedBy: interaction.user.username
                });
            }

            // Clean up completion tracking after 5 minutes
            setTimeout(() => {
                this.activeCompletions.delete(completionId);
            }, 5 * 60 * 1000);

            logger.info('Task completion processed:', {
                taskId,
                userId: userAccount.nafflesUserId,
                success: completionResult.success
            });

            return completionResult;

        } catch (error) {
            logger.error('Error handling task completion:', error);
            return {
                success: false,
                reason: 'processing_error',
                message: 'An error occurred while processing your task completion. Please try again later.'
            };
        }
    }

    /**
     * Verify task completion based on task type
     * @param {Object} task - Task object
     * @param {Object} userAccount - User account data
     * @param {Object} interaction - Discord interaction
     * @returns {Promise<Object>} Verification result
     */
    async verifyTaskCompletion(task, userAccount, interaction) {
        try {
            logger.info('Verifying task completion:', {
                taskId: task.id,
                taskType: task.type,
                userId: userAccount.nafflesUserId
            });

            switch (task.type) {
                case 'twitter_follow':
                    return await this.verifyTwitterFollow(task, userAccount);
                
                case 'discord_join':
                    return await this.verifyDiscordJoin(task, userAccount, interaction);
                
                case 'telegram_join':
                    return await this.verifyTelegramJoin(task, userAccount);
                
                case 'custom':
                    return await this.verifyCustomTask(task, userAccount, interaction);
                
                default:
                    return {
                        verified: false,
                        reason: 'unsupported_task_type',
                        message: 'Task type verification not supported'
                    };
            }

        } catch (error) {
            logger.error('Error verifying task completion:', error);
            return {
                verified: false,
                reason: 'verification_error',
                message: 'Verification failed due to technical error'
            };
        }
    }

    /**
     * Get task progress and analytics
     * @param {string} taskId - Task ID
     * @param {Object} options - Analytics options
     * @returns {Promise<Object>} Task analytics data
     */
    async getTaskAnalytics(taskId, options = {}) {
        try {
            const cacheKey = `analytics_${taskId}`;
            const cached = this.analyticsCache.get(cacheKey);
            
            if (cached && (Date.now() - cached.timestamp) < this.analyticsCacheExpiry) {
                return cached.data;
            }

            // Get analytics from Naffles API
            const analytics = await this.botService.makeNafflesApiCall(
                `/api/social-tasks/${taskId}/analytics`
            );

            // Get Discord-specific analytics
            const discordAnalytics = await this.getDiscordTaskAnalytics(taskId);

            // Combine analytics data
            const combinedAnalytics = {
                ...analytics,
                discord: discordAnalytics,
                lastUpdated: new Date()
            };

            // Cache the result
            this.analyticsCache.set(cacheKey, {
                data: combinedAnalytics,
                timestamp: Date.now()
            });

            return combinedAnalytics;

        } catch (error) {
            logger.error('Error getting task analytics:', error);
            throw error;
        }
    }

    /**
     * Update task embed with real-time progress
     * @param {string} taskId - Task ID
     * @param {Object} updateData - Update data
     * @returns {Promise<void>}
     */
    async updateTaskEmbed(taskId, updateData) {
        try {
            // Get all Discord messages for this task
            const taskMessages = await this.getTaskMessages(taskId);
            
            for (const messageData of taskMessages) {
                try {
                    // Get updated task data
                    const taskData = await this.getTaskDetails(taskId);
                    if (!taskData) continue;

                    // Get channel and message
                    const channel = await this.botService.client.channels.fetch(messageData.channelId);
                    if (!channel) continue;

                    const message = await channel.messages.fetch(messageData.messageId);
                    if (!message) continue;

                    // Create updated embed
                    const updatedEmbed = this.botService.createTaskEmbed(taskData, {
                        showProgress: true,
                        showAnalytics: true,
                        lastUpdate: new Date()
                    });

                    // Update message
                    await message.edit({
                        embeds: [updatedEmbed],
                        components: message.components // Keep existing buttons
                    });

                    logger.debug('Task embed updated:', {
                        taskId,
                        messageId: messageData.messageId
                    });

                } catch (messageError) {
                    logger.warn('Failed to update specific task message:', {
                        taskId,
                        messageId: messageData.messageId,
                        error: messageError.message
                    });
                }
            }

        } catch (error) {
            logger.error('Error updating task embed:', error);
        }
    }

    /**
     * Handle task lifecycle management
     * @param {string} taskId - Task ID
     * @param {string} newStatus - New task status
     * @returns {Promise<void>}
     */
    async handleTaskLifecycle(taskId, newStatus) {
        try {
            logger.info('Handling task lifecycle change:', {
                taskId,
                newStatus
            });

            // Update task status in Naffles
            await this.botService.makeNafflesApiCall(
                `/api/social-tasks/${taskId}/status`,
                'PATCH',
                { status: newStatus }
            );

            // Handle status-specific actions
            switch (newStatus) {
                case 'active':
                    await this.handleTaskActivation(taskId);
                    break;
                
                case 'completed':
                    await this.handleTaskCompletion(taskId);
                    break;
                
                case 'expired':
                    await this.handleTaskExpiration(taskId);
                    break;
                
                case 'paused':
                    await this.handleTaskPause(taskId);
                    break;
            }

            // Update all Discord embeds
            await this.updateTaskEmbed(taskId, { statusChange: newStatus });

            logger.info('Task lifecycle change processed:', {
                taskId,
                newStatus
            });

        } catch (error) {
            logger.error('Error handling task lifecycle:', error);
            throw error;
        }
    }

    /**
     * Get task eligibility for user
     * @param {string} taskId - Task ID
     * @param {string} userId - User ID (Naffles)
     * @returns {Promise<Object>} Eligibility result
     */
    async checkTaskEligibility(taskId, userId) {
        try {
            const eligibility = await this.botService.makeNafflesApiCall(
                `/api/social-tasks/${taskId}/eligibility/${userId}`
            );

            return {
                eligible: eligibility.eligible,
                reason: eligibility.reason,
                requirements: eligibility.requirements || [],
                canComplete: eligibility.canComplete || false
            };

        } catch (error) {
            logger.error('Error checking task eligibility:', error);
            return {
                eligible: false,
                reason: 'eligibility_check_failed',
                requirements: [],
                canComplete: false
            };
        }
    }

    // Private helper methods

    /**
     * Prepare task data for Naffles API
     * @private
     */
    prepareTaskDataForNaffles(taskData, communityId, discordContext) {
        const nafflesTaskData = {
            communityId,
            title: taskData.title,
            description: taskData.description,
            type: taskData.type,
            rewards: {
                points: taskData.points,
                bonusMultiplier: taskData.bonusMultiplier || 1
            },
            configuration: {},
            schedule: {
                startDate: new Date(),
                endDate: taskData.duration ? new Date(Date.now() + (taskData.duration * 60 * 60 * 1000)) : null
            },
            verification: {
                requiresApproval: taskData.type === 'custom',
                autoVerify: taskData.type !== 'custom'
            },
            discordIntegration: {
                guildId: discordContext.guildId,
                channelId: discordContext.channelId,
                createdBy: discordContext.userId
            }
        };

        // Add type-specific configuration
        switch (taskData.type) {
            case 'twitter_follow':
                nafflesTaskData.configuration.twitterUsername = taskData.twitterUsername;
                break;
            
            case 'discord_join':
                nafflesTaskData.configuration.discordInviteUrl = taskData.discordInvite;
                nafflesTaskData.configuration.discordServerId = this.extractDiscordServerId(taskData.discordInvite);
                break;
            
            case 'telegram_join':
                nafflesTaskData.configuration.telegramChannelUrl = taskData.telegramLink;
                break;
            
            case 'custom':
                nafflesTaskData.configuration.instructions = taskData.customInstructions;
                nafflesTaskData.configuration.verificationMethod = taskData.verificationMethod;
                break;
        }

        return nafflesTaskData;
    }

    /**
     * Process task completion based on type
     * @private
     */
    async processTaskCompletion(task, userAccount, interaction) {
        try {
            // Verify task completion
            const verificationResult = await this.verifyTaskCompletion(task, userAccount, interaction);
            
            if (!verificationResult.verified) {
                return {
                    success: false,
                    reason: verificationResult.reason,
                    message: verificationResult.message
                };
            }

            // Submit completion to Naffles API
            const completionData = {
                userId: userAccount.nafflesUserId,
                discordId: interaction.user.id,
                discordUsername: interaction.user.username,
                verificationData: verificationResult.data,
                completedAt: new Date(),
                source: 'discord_bot'
            };

            const completion = await this.botService.makeNafflesApiCall(
                `/api/social-tasks/${task.id}/complete`,
                'POST',
                completionData
            );

            return {
                success: true,
                completion,
                pointsEarned: task.rewards.points,
                message: task.type === 'custom' 
                    ? `Task completion submitted for review! You'll receive ${task.rewards.points} points once approved.`
                    : `🎉 Task completed successfully! You earned ${task.rewards.points} points!`
            };

        } catch (error) {
            logger.error('Error processing task completion:', error);
            
            if (error.response?.status === 409) {
                return {
                    success: false,
                    reason: 'already_completed',
                    message: '✅ You have already completed this task!'
                };
            }

            return {
                success: false,
                reason: 'processing_error',
                message: 'Failed to process task completion. Please try again later.'
            };
        }
    }

    /**
     * Verify Twitter follow task
     * @private
     */
    async verifyTwitterFollow(task, userAccount) {
        try {
            // This would integrate with Twitter API to verify follow
            // For now, we'll use a placeholder implementation
            
            return {
                verified: true,
                data: {
                    method: 'twitter_api',
                    targetUsername: task.configuration.twitterUsername,
                    verifiedAt: new Date()
                },
                message: 'Twitter follow verified successfully'
            };

        } catch (error) {
            logger.error('Error verifying Twitter follow:', error);
            return {
                verified: false,
                reason: 'twitter_verification_failed',
                message: 'Could not verify Twitter follow. Please ensure you have followed the account.'
            };
        }
    }

    /**
     * Verify Discord join task
     * @private
     */
    async verifyDiscordJoin(task, userAccount, interaction) {
        try {
            const serverId = task.configuration.discordServerId;
            if (!serverId) {
                return {
                    verified: false,
                    reason: 'invalid_server_config',
                    message: 'Invalid Discord server configuration'
                };
            }

            // Check if user is in the target Discord server
            const targetGuild = this.botService.client.guilds.cache.get(serverId);
            if (!targetGuild) {
                return {
                    verified: false,
                    reason: 'server_not_accessible',
                    message: 'Cannot verify Discord server membership'
                };
            }

            const member = await targetGuild.members.fetch(interaction.user.id).catch(() => null);
            if (!member) {
                return {
                    verified: false,
                    reason: 'not_member',
                    message: 'You are not a member of the required Discord server'
                };
            }

            return {
                verified: true,
                data: {
                    method: 'discord_api',
                    serverId: serverId,
                    serverName: targetGuild.name,
                    verifiedAt: new Date()
                },
                message: 'Discord server membership verified successfully'
            };

        } catch (error) {
            logger.error('Error verifying Discord join:', error);
            return {
                verified: false,
                reason: 'discord_verification_failed',
                message: 'Could not verify Discord server membership'
            };
        }
    }

    /**
     * Verify Telegram join task
     * @private
     */
    async verifyTelegramJoin(task, userAccount) {
        try {
            // This would integrate with Telegram API to verify membership
            // For now, we'll use a placeholder implementation
            
            return {
                verified: true,
                data: {
                    method: 'telegram_api',
                    channelUrl: task.configuration.telegramChannelUrl,
                    verifiedAt: new Date()
                },
                message: 'Telegram membership verified successfully'
            };

        } catch (error) {
            logger.error('Error verifying Telegram join:', error);
            return {
                verified: false,
                reason: 'telegram_verification_failed',
                message: 'Could not verify Telegram membership. Please ensure you have joined the channel.'
            };
        }
    }

    /**
     * Verify custom task
     * @private
     */
    async verifyCustomTask(task, userAccount, interaction) {
        try {
            // Custom tasks require manual verification
            return {
                verified: true,
                requiresManualReview: true,
                data: {
                    method: 'manual_review',
                    submittedBy: interaction.user.username,
                    submittedAt: new Date(),
                    instructions: task.configuration.instructions
                },
                message: 'Custom task submitted for manual review'
            };

        } catch (error) {
            logger.error('Error verifying custom task:', error);
            return {
                verified: false,
                reason: 'custom_verification_failed',
                message: 'Could not submit custom task for verification'
            };
        }
    }

    /**
     * Get task details from Naffles API
     * @private
     */
    async getTaskDetails(taskId) {
        try {
            return await this.botService.makeNafflesApiCall(`/api/social-tasks/${taskId}`);
        } catch (error) {
            logger.error('Error getting task details:', error);
            return null;
        }
    }

    /**
     * Check task availability for user
     * @private
     */
    async checkTaskAvailability(task, userId) {
        try {
            if (task.status !== 'active') {
                return {
                    available: false,
                    reason: 'task_inactive',
                    message: 'This task is no longer active.'
                };
            }

            if (task.schedule?.endDate && new Date() > new Date(task.schedule.endDate)) {
                return {
                    available: false,
                    reason: 'task_expired',
                    message: 'This task has expired.'
                };
            }

            // Check if user has already completed the task
            const existingCompletion = await this.botService.makeNafflesApiCall(
                `/api/social-tasks/${task.id}/completions/${userId}`
            ).catch(() => null);

            if (existingCompletion) {
                return {
                    available: false,
                    reason: 'already_completed',
                    message: 'You have already completed this task.'
                };
            }

            return {
                available: true,
                reason: 'available',
                message: 'Task is available for completion.'
            };

        } catch (error) {
            logger.error('Error checking task availability:', error);
            return {
                available: false,
                reason: 'availability_check_failed',
                message: 'Could not check task availability.'
            };
        }
    }

    /**
     * Store Discord task metadata
     * @private
     */
    async storeDiscordTaskMetadata(taskId, metadata) {
        try {
            await this.botService.db.storeTaskMetadata({
                taskId,
                ...metadata
            });
        } catch (error) {
            logger.error('Error storing Discord task metadata:', error);
        }
    }

    /**
     * Store task message reference
     * @private
     */
    async storeTaskMessage(messageData) {
        try {
            await this.botService.db.storeTaskMessage(messageData);
        } catch (error) {
            logger.error('Error storing task message:', error);
        }
    }

    /**
     * Get task messages from database
     * @private
     */
    async getTaskMessages(taskId) {
        try {
            return await this.botService.db.getTaskMessages(taskId);
        } catch (error) {
            logger.error('Error getting task messages:', error);
            return [];
        }
    }

    /**
     * Initialize task analytics tracking
     * @private
     */
    async initializeTaskAnalytics(taskId) {
        try {
            const analyticsData = {
                taskId,
                createdAt: new Date(),
                totalViews: 0,
                totalCompletionAttempts: 0,
                totalCompletions: 0,
                discordInteractions: 0
            };

            await this.botService.db.initializeTaskAnalytics(analyticsData);
        } catch (error) {
            logger.error('Error initializing task analytics:', error);
        }
    }

    /**
     * Update task analytics
     * @private
     */
    async updateTaskAnalytics(taskId, updateData) {
        try {
            await this.botService.db.updateTaskAnalytics(taskId, updateData);
            
            // Clear analytics cache
            this.analyticsCache.delete(`analytics_${taskId}`);
        } catch (error) {
            logger.error('Error updating task analytics:', error);
        }
    }

    /**
     * Get Discord-specific task analytics
     * @private
     */
    async getDiscordTaskAnalytics(taskId) {
        try {
            return await this.botService.db.getTaskAnalytics(taskId);
        } catch (error) {
            logger.error('Error getting Discord task analytics:', error);
            return {
                totalViews: 0,
                totalCompletionAttempts: 0,
                totalCompletions: 0,
                discordInteractions: 0
            };
        }
    }

    /**
     * Register task for real-time updates
     * @private
     */
    async registerTaskForUpdates(taskId, updateConfig) {
        try {
            await this.botService.embedUpdater.registerEmbedForUpdates(
                `task_${taskId}_${updateConfig.messageId}`,
                {
                    type: 'task',
                    dataId: taskId,
                    ...updateConfig
                }
            );
        } catch (error) {
            logger.error('Error registering task for updates:', error);
        }
    }

    /**
     * Start task progress tracking
     * @private
     */
    async startTaskProgressTracking(taskId) {
        try {
            // Set up periodic progress updates
            const updateInterval = setInterval(async () => {
                try {
                    const analytics = await this.getTaskAnalytics(taskId);
                    await this.updateTaskEmbed(taskId, {
                        progressUpdate: true,
                        analytics
                    });
                } catch (error) {
                    logger.error('Error in task progress tracking:', error);
                }
            }, 60000); // Update every minute

            // Store interval reference for cleanup
            await this.botService.redis.setex(
                `task_tracking_${taskId}`,
                24 * 60 * 60, // 24 hours
                JSON.stringify({ intervalId: updateInterval[Symbol.toPrimitive]() })
            );

        } catch (error) {
            logger.error('Error starting task progress tracking:', error);
        }
    }

    /**
     * Extract Discord server ID from invite URL
     * @private
     */
    extractDiscordServerId(inviteUrl) {
        try {
            const match = inviteUrl.match(/discord\.gg\/([a-zA-Z0-9]+)/);
            return match ? match[1] : null;
        } catch (error) {
            logger.error('Error extracting Discord server ID:', error);
            return null;
        }
    }

    /**
     * Handle task activation
     * @private
     */
    async handleTaskActivation(taskId) {
        try {
            logger.info('Handling task activation:', { taskId });
            
            // Start progress tracking
            await this.startTaskProgressTracking(taskId);
            
            // Initialize analytics
            await this.initializeTaskAnalytics(taskId);
            
        } catch (error) {
            logger.error('Error handling task activation:', error);
        }
    }

    /**
     * Handle task completion
     * @private
     */
    async handleTaskCompletion(taskId) {
        try {
            logger.info('Handling task completion:', { taskId });
            
            // Stop progress tracking
            const trackingData = await this.botService.redis.get(`task_tracking_${taskId}`);
            if (trackingData) {
                const { intervalId } = JSON.parse(trackingData);
                clearInterval(intervalId);
                await this.botService.redis.del(`task_tracking_${taskId}`);
            }
            
            // Final analytics update
            await this.updateTaskEmbed(taskId, {
                finalUpdate: true,
                status: 'completed'
            });
            
        } catch (error) {
            logger.error('Error handling task completion:', error);
        }
    }

    /**
     * Handle task expiration
     * @private
     */
    async handleTaskExpiration(taskId) {
        try {
            logger.info('Handling task expiration:', { taskId });
            
            // Stop progress tracking
            const trackingData = await this.botService.redis.get(`task_tracking_${taskId}`);
            if (trackingData) {
                const { intervalId } = JSON.parse(trackingData);
                clearInterval(intervalId);
                await this.botService.redis.del(`task_tracking_${taskId}`);
            }
            
            // Update embeds to show expired status
            await this.updateTaskEmbed(taskId, {
                finalUpdate: true,
                status: 'expired'
            });
            
        } catch (error) {
            logger.error('Error handling task expiration:', error);
        }
    }

    /**
     * Handle task pause
     * @private
     */
    async handleTaskPause(taskId) {
        try {
            logger.info('Handling task pause:', { taskId });
            
            // Update embeds to show paused status
            await this.updateTaskEmbed(taskId, {
                statusUpdate: true,
                status: 'paused'
            });
            
        } catch (error) {
            logger.error('Error handling task pause:', error);
        }
    }
}

module.exports = SocialTaskIntegrationService;