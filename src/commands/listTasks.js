const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const logger = require('../utils/logger');

// Slash command data for Discord registration
const data = new SlashCommandBuilder()
    .setName('naffles-list-tasks')
    .setDescription('List social tasks for your community')
    .addStringOption(option =>
        option.setName('status')
            .setDescription('Filter tasks by status')
            .setRequired(false)
            .addChoices(
                { name: 'Active', value: 'active' },
                { name: 'Completed', value: 'completed' },
                { name: 'Expired', value: 'expired' },
                { name: 'All', value: 'all' }
            ));

class ListTasksCommand {
    constructor(botService) {
        this.botService = botService;
        this.name = 'naffles-list-tasks';
    }

    async execute(interaction) {
        try {
            // Check if server is linked to a community
            const serverMapping = await this.botService.getServerCommunityMapping(interaction.guildId);
            if (!serverMapping) {
                return await interaction.reply({
                    content: '❌ This Discord server is not linked to a Naffles community. Please link your server first at https://naffles.com/discord-setup',
                    ephemeral: true
                });
            }

            // Get status filter
            const statusFilter = interaction.options.getString('status') || 'active';

            // Defer reply for API call
            await interaction.deferReply();

            // Fetch tasks from Naffles API
            const tasks = await this.botService.makeNafflesApiCall(
                `/api/communities/${serverMapping.communityId}/social-tasks?status=${statusFilter}&limit=25`
            );

            // Get analytics for admin users (if they have permissions)
            let analyticsData = null;
            try {
                const userAccount = await this.botService.db.getUserAccountLink(interaction.user.id);
                if (userAccount) {
                    analyticsData = await this.botService.taskAnalytics.getCommunityTaskAnalytics(
                        serverMapping.communityId,
                        userAccount.nafflesUserId,
                        { timeframe: '7d' }
                    ).catch(() => null); // Ignore permission errors
                }
            } catch (error) {
                // User doesn't have admin permissions, continue without analytics
            }

            if (!tasks || tasks.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('📋 Social Tasks')
                    .setDescription(`No ${statusFilter} tasks found for this community.`)
                    .setColor(0x6B7280) // Gray
                    .setFooter({ 
                        text: 'Use /naffles-create-task to create a new task', 
                        iconURL: 'https://naffles.com/logo.png' 
                    })
                    .setTimestamp();

                return await interaction.editReply({ embeds: [embed] });
            }

            // Create main embed
            const mainEmbed = new EmbedBuilder()
                .setTitle(`📋 Social Tasks (${statusFilter})`)
                .setDescription(`Found ${tasks.length} ${statusFilter} task${tasks.length !== 1 ? 's' : ''} for this community.`)
                .setColor(0x3B82F6) // Naffles blue
                .setFooter({ 
                    text: 'Select a task below to view details', 
                    iconURL: 'https://naffles.com/logo.png' 
                })
                .setTimestamp();

            // Add summary fields
            const totalPoints = tasks.reduce((sum, task) => sum + (task.points || 0), 0);
            const completedTasks = tasks.filter(task => task.status === 'completed').length;
            
            mainEmbed.addFields(
                { name: '💰 Total Points Available', value: totalPoints.toString(), inline: true },
                { name: '✅ Completed Tasks', value: completedTasks.toString(), inline: true },
                { name: '📊 Active Tasks', value: (tasks.length - completedTasks).toString(), inline: true }
            );

            // Add analytics data if available (for admins)
            if (analyticsData) {
                mainEmbed.addFields(
                    { name: '📈 Total Completions (7d)', value: analyticsData.completions?.totalCompletions?.toString() || '0', inline: true },
                    { name: '👥 Active Users (7d)', value: analyticsData.engagement?.activeUsers?.toString() || '0', inline: true },
                    { name: '🎯 Success Rate', value: `${Math.round(analyticsData.completions?.successfulCompletions / analyticsData.completions?.totalCompletions * 100) || 0}%`, inline: true }
                );
            }

            // Create select menu for task details
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_task_details')
                .setPlaceholder('Select a task to view details...')
                .setMinValues(1)
                .setMaxValues(1);

            // Add task options to select menu (limit to 25 due to Discord limits)
            const taskOptions = tasks.slice(0, 25).map(task => ({
                label: task.title.length > 100 ? task.title.substring(0, 97) + '...' : task.title,
                description: `${task.points} points • ${this.formatTaskType(task.type)} • ${task.status}`,
                value: task.id.toString(),
                emoji: this.getTaskEmoji(task.type)
            }));

            selectMenu.addOptions(taskOptions);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            // Store tasks data for select menu interaction
            await this.botService.redis.setex(
                `task_list_${interaction.user.id}_${interaction.guildId}`,
                300, // 5 minutes
                JSON.stringify(tasks)
            );

            await interaction.editReply({
                embeds: [mainEmbed],
                components: [row]
            });

            // Log interaction
            await this.botService.logInteraction(interaction, 'list_tasks', 'success');

        } catch (error) {
            logger.error('Error in listTasks command:', error);
            
            const errorMessage = '❌ An error occurred while fetching tasks. Please try again later.';
            
            if (interaction.deferred) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }

            await this.botService.logInteraction(interaction, 'list_tasks', 'error');
        }
    }

    async handleSelectMenu(interaction) {
        try {
            // Get stored tasks data
            const tasksDataKey = `task_list_${interaction.user.id}_${interaction.guildId}`;
            const storedData = await this.botService.redis.get(tasksDataKey);
            
            if (!storedData) {
                return await interaction.reply({
                    content: '❌ Task list session expired. Please run the command again.',
                    ephemeral: true
                });
            }

            const tasks = JSON.parse(storedData);
            const selectedTaskId = interaction.values[0];
            const selectedTask = tasks.find(task => task.id.toString() === selectedTaskId);

            if (!selectedTask) {
                return await interaction.reply({
                    content: '❌ Selected task not found.',
                    ephemeral: true
                });
            }

            // Create detailed task embed
            const taskEmbed = this.createDetailedTaskEmbed(selectedTask);
            const actionButtons = this.botService.createActionButtons('task', selectedTask);

            await interaction.reply({
                embeds: [taskEmbed],
                components: selectedTask.status === 'active' ? [actionButtons] : [],
                ephemeral: true
            });

            // Log interaction
            await this.botService.logInteraction(interaction, 'view_task_details', 'success');

        } catch (error) {
            logger.error('Error handling task select menu:', error);
            
            await interaction.reply({
                content: '❌ Failed to load task details. Please try again.',
                ephemeral: true
            });

            await this.botService.logInteraction(interaction, 'view_task_details', 'error');
        }
    }

    createDetailedTaskEmbed(task) {
        const embed = new EmbedBuilder()
            .setTitle(`🎯 ${task.title}`)
            .setDescription(task.description)
            .setColor(this.getTaskColor(task.status))
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

        // Add duration info
        if (task.duration) {
            embed.addFields({ name: '⏰ Duration', value: `${task.duration} hours`, inline: true });
        }

        // Add completion info
        if (task.completedBy && task.completedBy > 0) {
            embed.addFields({ name: '✅ Completed By', value: `${task.completedBy} users`, inline: true });
        }

        // Add end time if available
        if (task.endTime) {
            const endTime = Math.floor(new Date(task.endTime).getTime() / 1000);
            embed.addFields({ name: '⏰ Ends', value: `<t:${endTime}:R>`, inline: true });
        }

        // Add type-specific information
        if (task.type === 'twitter_follow' && task.twitterUsername) {
            embed.addFields({ name: '🐦 Twitter Account', value: `@${task.twitterUsername}`, inline: true });
        } else if (task.type === 'discord_join' && task.discordInvite) {
            embed.addFields({ name: '💬 Discord Server', value: `[Join Server](${task.discordInvite})`, inline: true });
        } else if (task.type === 'telegram_join' && task.telegramLink) {
            embed.addFields({ name: '📱 Telegram', value: `[Join Group](${task.telegramLink})`, inline: true });
        }

        // Add custom task details
        if (task.type === 'custom') {
            if (task.customInstructions) {
                embed.addFields({ name: '📝 Instructions', value: task.customInstructions.substring(0, 1024), inline: false });
            }
            if (task.verificationMethod) {
                embed.addFields({ name: '✅ Verification', value: task.verificationMethod.substring(0, 1024), inline: false });
            }
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

    getTaskEmoji(type) {
        const emojiMap = {
            'twitter_follow': '🐦',
            'discord_join': '💬',
            'telegram_join': '📱',
            'custom': '🔧'
        };
        return emojiMap[type] || '📋';
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

    getTaskColor(status) {
        const colorMap = {
            'active': 0x10B981, // Green
            'completed': 0x6B7280, // Gray
            'expired': 0xEF4444, // Red
            'paused': 0xF59E0B // Yellow
        };
        return colorMap[status] || 0x3B82F6; // Default blue
    }
}

// Export both the command class and the slash command data
module.exports = ListTasksCommand;
module.exports.data = data;