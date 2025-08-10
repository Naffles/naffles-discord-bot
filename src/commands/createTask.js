const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const logger = require('../utils/logger');

// Slash command data for Discord registration
const data = new SlashCommandBuilder()
    .setName('naffles-create-task')
    .setDescription('Create a new social task for your community')
    .addStringOption(option =>
        option.setName('type')
            .setDescription('Type of social task to create')
            .setRequired(true)
            .addChoices(
                { name: 'Twitter Follow', value: 'twitter_follow' },
                { name: 'Discord Join', value: 'discord_join' },
                { name: 'Telegram Join', value: 'telegram_join' },
                { name: 'Custom Task', value: 'custom' }
            ))
    .addStringOption(option =>
        option.setName('title')
            .setDescription('Title of the task')
            .setRequired(true)
            .setMaxLength(100))
    .addStringOption(option =>
        option.setName('description')
            .setDescription('Description of the task')
            .setRequired(true)
            .setMaxLength(500))
    .addIntegerOption(option =>
        option.setName('points')
            .setDescription('Points reward for completing the task')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(10000))
    .addIntegerOption(option =>
        option.setName('duration')
            .setDescription('Duration in hours (default: 168 hours = 1 week)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(8760)); // Max 1 year

class CreateTaskCommand {
    constructor(botService) {
        this.botService = botService;
        this.name = 'naffles-create-task';
    }

    async execute(interaction) {
        try {
            // Check if user has permission to create tasks
            const permissionCheck = await this.botService.validateUserPermissions(
                interaction.guildId,
                interaction.user.id,
                ['ManageGuild']
            );

            if (!permissionCheck.hasPermission) {
                return await interaction.reply({
                    content: `❌ You don't have permission to create tasks. Reason: ${permissionCheck.reason}`,
                    ephemeral: true
                });
            }

            // Check if server is linked to a community
            const serverMapping = await this.botService.getServerCommunityMapping(interaction.guildId);
            if (!serverMapping) {
                return await interaction.reply({
                    content: '❌ This Discord server is not linked to a Naffles community. Please link your server first at https://naffles.com/discord-setup',
                    ephemeral: true
                });
            }

            // Get command options
            const taskType = interaction.options.getString('type');
            const title = interaction.options.getString('title');
            const description = interaction.options.getString('description');
            const points = interaction.options.getInteger('points');
            const duration = interaction.options.getInteger('duration') || 168; // Default 1 week

            // Create modal for additional task details
            const modal = new ModalBuilder()
                .setCustomId(`create_task_modal_${Date.now()}`)
                .setTitle('Create Social Task');

            // Add additional fields based on task type
            if (taskType === 'twitter_follow') {
                const twitterInput = new TextInputBuilder()
                    .setCustomId('twitter_username')
                    .setLabel('Twitter Username (without @)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('naffles')
                    .setRequired(true)
                    .setMaxLength(50);

                modal.addComponents(new ActionRowBuilder().addComponents(twitterInput));
            } else if (taskType === 'discord_join') {
                const discordInput = new TextInputBuilder()
                    .setCustomId('discord_invite')
                    .setLabel('Discord Invite Link')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('https://discord.gg/naffles')
                    .setRequired(true)
                    .setMaxLength(200);

                modal.addComponents(new ActionRowBuilder().addComponents(discordInput));
            } else if (taskType === 'telegram_join') {
                const telegramInput = new TextInputBuilder()
                    .setCustomId('telegram_link')
                    .setLabel('Telegram Group/Channel Link')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('https://t.me/naffles')
                    .setRequired(true)
                    .setMaxLength(200);

                modal.addComponents(new ActionRowBuilder().addComponents(telegramInput));
            } else if (taskType === 'custom') {
                const instructionsInput = new TextInputBuilder()
                    .setCustomId('custom_instructions')
                    .setLabel('Task Instructions')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Detailed instructions for completing this task...')
                    .setRequired(true)
                    .setMaxLength(1000);

                const verificationInput = new TextInputBuilder()
                    .setCustomId('verification_method')
                    .setLabel('How will completion be verified?')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Manual review, screenshot submission, etc.')
                    .setRequired(true)
                    .setMaxLength(500);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(instructionsInput),
                    new ActionRowBuilder().addComponents(verificationInput)
                );
            }

            // Store task data in Redis for modal submission
            const taskData = {
                type: taskType,
                title,
                description,
                points,
                duration,
                guildId: interaction.guildId,
                userId: interaction.user.id,
                communityId: serverMapping.communityId
            };

            await this.botService.redis.setex(
                `task_creation_${interaction.user.id}_${interaction.guildId}`,
                300, // 5 minutes
                JSON.stringify(taskData)
            );

            // Show modal
            await interaction.showModal(modal);

            // Log interaction
            await this.botService.logInteraction(interaction, 'create_task_initiated', 'success');

        } catch (error) {
            logger.error('Error in createTask command:', error);
            
            const errorMessage = '❌ An error occurred while creating the task. Please try again later.';
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }

            await this.botService.logInteraction(interaction, 'create_task_initiated', 'error');
        }
    }

    async handleModalSubmit(interaction) {
        try {
            // Get stored task data
            const taskDataKey = `task_creation_${interaction.user.id}_${interaction.guildId}`;
            const storedData = await this.botService.redis.get(taskDataKey);
            
            if (!storedData) {
                return await interaction.reply({
                    content: '❌ Task creation session expired. Please try again.',
                    ephemeral: true
                });
            }

            const taskData = JSON.parse(storedData);
            
            // Get modal input values
            const modalData = {};
            if (taskData.type === 'twitter_follow') {
                modalData.twitterUsername = interaction.fields.getTextInputValue('twitter_username');
            } else if (taskData.type === 'discord_join') {
                modalData.discordInvite = interaction.fields.getTextInputValue('discord_invite');
            } else if (taskData.type === 'telegram_join') {
                modalData.telegramLink = interaction.fields.getTextInputValue('telegram_link');
            } else if (taskData.type === 'custom') {
                modalData.customInstructions = interaction.fields.getTextInputValue('custom_instructions');
                modalData.verificationMethod = interaction.fields.getTextInputValue('verification_method');
            }

            // Combine task data with modal data
            const completeTaskData = { ...taskData, ...modalData };

            // Create task via social task integration service
            const createdTask = await this.botService.socialTaskIntegration.createSocialTask(
                completeTaskData,
                {
                    guildId: interaction.guildId,
                    channelId: interaction.channel.id,
                    userId: interaction.user.id
                }
            );

            // Post task to Discord channel with real-time tracking
            const { message: taskMessage } = await this.botService.socialTaskIntegration.postTaskToDiscord(
                interaction.channel,
                createdTask,
                {
                    enableUpdates: true,
                    showAnalytics: true
                }
            );

            // Start progress tracking
            await this.botService.taskProgressTracking.startTaskTracking(createdTask.id, {
                updateFrequency: 30000, // 30 seconds
                enableRealTimeUpdates: true
            });

            // Clean up Redis data
            await this.botService.redis.del(taskDataKey);

            // Reply to interaction
            await interaction.reply({
                content: `✅ Task "${createdTask.title}" has been created and posted to this channel!`,
                ephemeral: true
            });

            // Log successful creation
            await this.botService.logInteraction(interaction, 'create_task_completed', 'success');

        } catch (error) {
            logger.error('Error handling task creation modal:', error);
            
            await interaction.reply({
                content: '❌ Failed to create task. Please check your inputs and try again.',
                ephemeral: true
            });

            await this.botService.logInteraction(interaction, 'create_task_completed', 'error');
        }
    }
}

// Export both the command class and the slash command data
module.exports = CreateTaskCommand;
module.exports.data = data;