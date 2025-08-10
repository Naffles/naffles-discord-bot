const logger = require('../utils/logger');
const ConnectAllowlistCommand = require('../commands/connectAllowlist');

class ButtonHandler {
    constructor(botService) {
        this.botService = botService;
        this.connectAllowlistCommand = new ConnectAllowlistCommand(botService);
    }

    async handleButtonInteraction(interaction) {
        try {
            const customId = interaction.customId;
            
            // Rate limiting check
            const rateLimitKey = `button_${interaction.user.id}`;
            const isRateLimited = await this.botService.rateLimiter.checkRateLimit(
                rateLimitKey,
                10, // 10 button clicks
                60 // per minute
            );

            if (isRateLimited) {
                return await interaction.reply({
                    content: '⏰ You are clicking buttons too quickly. Please wait a moment and try again.',
                    ephemeral: true
                });
            }

            // Handle different button types
            if (customId.startsWith('complete_task_')) {
                await this.handleTaskCompletion(interaction);
            } else if (customId.startsWith('view_task_')) {
                await this.handleTaskView(interaction);
            } else if (customId.startsWith('enter_allowlist_')) {
                await this.connectAllowlistCommand.handleAllowlistEntry(interaction);
            } else if (customId.startsWith('view_allowlist_')) {
                await this.connectAllowlistCommand.handleAllowlistView(interaction);
            } else if (customId === 'unlink_community' || customId === 'relink_community' || customId === 'test_connection') {
                // Handle community linking button interactions
                await this.handleCommunityLinkingButtons(interaction);
            } else if (customId === 'refresh_status' || customId === 'link_community_help') {
                // Handle status command button interactions
                await this.handleStatusButtons(interaction);
            } else if (customId === 'help_commands' || customId === 'help_setup') {
                // Handle help command button interactions
                await this.handleHelpButtons(interaction);
            } else {
                logger.warn(`Unknown button interaction: ${customId}`);
                await interaction.reply({
                    content: '❌ Unknown button. Please try again.',
                    ephemeral: true
                });
            }

        } catch (error) {
            logger.error(`Error handling button interaction ${interaction.customId}:`, error);
            
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({
                        content: '❌ An error occurred while processing your request. Please try again later.',
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: '❌ An error occurred while processing your request. Please try again later.',
                        ephemeral: true
                    });
                }
            } catch (replyError) {
                logger.error('Failed to send button error message:', replyError);
            }
        }
    }

    async handleTaskCompletion(interaction) {
        try {
            // Extract task ID from custom ID
            const taskId = interaction.customId.split('_')[2];

            // Check if user has linked Naffles account
            const userAccount = await this.botService.db.getUserAccountLink(interaction.user.id);
            if (!userAccount) {
                return await interaction.reply({
                    content: '❌ You need to link your Naffles account first. Visit https://naffles.com/discord-link to get started.',
                    ephemeral: true
                });
            }

            // Check task eligibility first
            const eligibility = await this.botService.taskEligibility.checkTaskEligibility(
                taskId,
                userAccount.nafflesUserId,
                interaction.user.id
            );

            if (!eligibility.eligible) {
                // Provide detailed guidance for ineligible users
                const guidance = await this.botService.taskEligibility.getRequirementGuidance(
                    taskId,
                    userAccount.nafflesUserId,
                    interaction.user.id
                );

                let responseMessage = `❌ ${eligibility.message}`;
                if (guidance.guidance && guidance.guidance.length > 0) {
                    responseMessage += '\n\n**Requirements:**\n';
                    guidance.guidance.forEach(guide => {
                        responseMessage += `• ${guide.message}\n`;
                    });
                }

                return await interaction.reply({
                    content: responseMessage,
                    ephemeral: true
                });
            }

            // Track completion attempt
            await this.botService.taskProgressTracking.updateTaskProgress(taskId, {
                type: 'completion_attempt',
                userId: userAccount.nafflesUserId,
                discordId: interaction.user.id,
                username: interaction.user.username,
                timestamp: new Date()
            });

            // Handle task completion through integration service
            const completionResult = await this.botService.socialTaskIntegration.handleTaskCompletion(
                interaction,
                taskId
            );

            if (completionResult.success) {
                // Track successful completion
                await this.botService.taskProgressTracking.updateTaskProgress(taskId, {
                    type: 'completion_success',
                    userId: userAccount.nafflesUserId,
                    discordId: interaction.user.id,
                    username: interaction.user.username,
                    pointsEarned: completionResult.pointsEarned,
                    timestamp: new Date()
                });

                // Provide user feedback
                await this.botService.taskProgressTracking.provideUserFeedback(
                    taskId,
                    userAccount.nafflesUserId,
                    {
                        type: 'completion_success',
                        message: completionResult.message,
                        pointsEarned: completionResult.pointsEarned
                    }
                );

                await interaction.reply({
                    content: completionResult.message,
                    ephemeral: true
                });
            } else {
                // Track failed completion
                await this.botService.taskProgressTracking.updateTaskProgress(taskId, {
                    type: 'completion_failure',
                    userId: userAccount.nafflesUserId,
                    discordId: interaction.user.id,
                    username: interaction.user.username,
                    reason: completionResult.reason,
                    timestamp: new Date()
                });

                // Check if user can retry
                const retryEligibility = await this.botService.taskEligibility.checkRetryEligibility(
                    taskId,
                    userAccount.nafflesUserId,
                    { reason: completionResult.reason }
                );

                let responseMessage = completionResult.message;
                if (retryEligibility.canRetry) {
                    responseMessage += `\n\n🔄 You can retry this task (${retryEligibility.retriesRemaining} attempts remaining).`;
                }

                await interaction.reply({
                    content: responseMessage,
                    ephemeral: true
                });
            }

            // Log interaction
            await this.botService.logInteraction(interaction, 'complete_task', completionResult.success ? 'success' : 'error');

        } catch (error) {
            logger.error('Error handling task completion:', error);
            
            await interaction.reply({
                content: '❌ An error occurred while processing your task completion. Please try again later.',
                ephemeral: true
            });

            await this.botService.logInteraction(interaction, 'complete_task', 'error');
        }
    }

    async handleTaskView(interaction) {
        try {
            // Extract task ID from custom ID
            const taskId = interaction.customId.split('_')[2];

            // Get task details
            const task = await this.botService.makeNafflesApiCall(
                `/api/social-tasks/${taskId}`
            );

            // Create detailed task embed
            const taskEmbed = this.createDetailedTaskEmbed(task);

            await interaction.reply({
                embeds: [taskEmbed],
                ephemeral: true
            });

            // Log interaction
            await this.botService.logInteraction(interaction, 'view_task', 'success');

        } catch (error) {
            logger.error('Error handling task view:', error);
            
            await interaction.reply({
                content: '❌ Failed to load task details. Please try again later.',
                ephemeral: true
            });

            await this.botService.logInteraction(interaction, 'view_task', 'error');
        }
    }

    async verifyTaskCompletion(task, userAccount) {
        try {
            // This would integrate with external APIs to verify task completion
            // For now, we'll implement basic verification logic
            
            switch (task.type) {
                case 'twitter_follow':
                    // Would integrate with Twitter API to verify follow
                    return { verified: true, data: { method: 'twitter_api' } };
                    
                case 'discord_join':
                    // Would check if user is in the specified Discord server
                    return { verified: true, data: { method: 'discord_api' } };
                    
                case 'telegram_join':
                    // Would integrate with Telegram API to verify membership
                    return { verified: true, data: { method: 'telegram_api' } };
                    
                default:
                    return { verified: false, reason: 'Unknown task type' };
            }
        } catch (error) {
            logger.error('Error verifying task completion:', error);
            return { verified: false, reason: 'Verification failed' };
        }
    }

    createDetailedTaskEmbed(task) {
        const { EmbedBuilder } = require('discord.js');
        
        const embed = new EmbedBuilder()
            .setTitle(`🎯 ${task.title}`)
            .setDescription(task.description)
            .setColor(0x3B82F6) // Naffles blue
            .addFields(
                { name: '💰 Reward', value: `${task.points} points`, inline: true },
                { name: '🏷️ Type', value: this.formatTaskType(task.type), inline: true },
                { name: '📊 Status', value: this.formatStatus(task.status), inline: true }
            )
            .setFooter({ 
                text: 'Powered by Naffles', 
                iconURL: 'https://naffles.com/logo.png' 
            })
            .setTimestamp(new Date(task.createdAt));

        // Add type-specific information
        if (task.type === 'twitter_follow' && task.twitterUsername) {
            embed.addFields({ name: '🐦 Follow', value: `@${task.twitterUsername}`, inline: true });
        } else if (task.type === 'discord_join' && task.discordInvite) {
            embed.addFields({ name: '💬 Join Server', value: `[Click Here](${task.discordInvite})`, inline: true });
        } else if (task.type === 'telegram_join' && task.telegramLink) {
            embed.addFields({ name: '📱 Join Group', value: `[Click Here](${task.telegramLink})`, inline: true });
        }

        return embed;
    }

    formatTaskType(type) {
        const typeMap = {
            'twitter_follow': '🐦 Twitter Follow',
            'discord_join': '💬 Discord Join',
            'telegram_join': '📱 Telegram Join',
            'custom': '🔧 Custom Task'
        };
        return typeMap[type] || type;
    }

    formatStatus(status) {
        const statusMap = {
            'active': '🟢 Active',
            'completed': '✅ Completed',
            'expired': '🔴 Expired',
            'paused': '⏸️ Paused'
        };
        return statusMap[status] || status;
    }

    async handleCommunityLinkingButtons(interaction) {
        try {
            // Get the link community command from the command handler
            const linkCommunityCommand = this.botService.commandHandler?.commands?.get('naffles-link-community');
            if (linkCommunityCommand && linkCommunityCommand.handleButtonInteraction) {
                await linkCommunityCommand.handleButtonInteraction(interaction);
            } else {
                await interaction.reply({
                    content: '❌ Community linking functionality is not available.',
                    ephemeral: true
                });
            }
        } catch (error) {
            logger.error('Error handling community linking button:', error);
            await interaction.reply({
                content: '❌ An error occurred. Please try again.',
                ephemeral: true
            });
        }
    }

    async handleStatusButtons(interaction) {
        try {
            // Get the status command from the command handler
            const statusCommand = this.botService.commandHandler?.commands?.get('naffles-status');
            if (statusCommand && statusCommand.handleButtonInteraction) {
                await statusCommand.handleButtonInteraction(interaction);
            } else {
                await interaction.reply({
                    content: '❌ Status functionality is not available.',
                    ephemeral: true
                });
            }
        } catch (error) {
            logger.error('Error handling status button:', error);
            await interaction.reply({
                content: '❌ An error occurred. Please try again.',
                ephemeral: true
            });
        }
    }

    async handleHelpButtons(interaction) {
        try {
            // Get the help command from the command handler
            const helpCommand = this.botService.commandHandler?.commands?.get('naffles-help');
            if (helpCommand && helpCommand.handleButtonInteraction) {
                await helpCommand.handleButtonInteraction(interaction);
            } else {
                await interaction.reply({
                    content: '❌ Help functionality is not available.',
                    ephemeral: true
                });
            }
        } catch (error) {
            logger.error('Error handling help button:', error);
            await interaction.reply({
                content: '❌ An error occurred. Please try again.',
                ephemeral: true
            });
        }
    }
}

module.exports = ButtonHandler;