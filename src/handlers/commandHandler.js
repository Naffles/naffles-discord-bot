const logger = require('../utils/logger');
const CreateTaskCommand = require('../commands/createTask');
const ListTasksCommand = require('../commands/listTasks');
const ConnectAllowlistCommand = require('../commands/connectAllowlist');
const AllowlistAnalyticsCommand = require('../commands/allowlistAnalytics');
const LinkCommunityCommand = require('../commands/linkCommunity');
const StatusCommand = require('../commands/status');
const HelpCommand = require('../commands/help');
const SecurityCommand = require('../commands/security');

class CommandHandler {
    constructor(botService) {
        this.botService = botService;
        this.commands = new Map();
        this.cooldowns = new Map();
        this.initializeCommands();
    }

    async initialize() {
        logger.info('Command handler initialized successfully');
    }

    initializeCommands() {
        // Initialize command instances
        const createTaskCommand = new CreateTaskCommand(this.botService);
        const listTasksCommand = new ListTasksCommand(this.botService);
        const connectAllowlistCommand = new ConnectAllowlistCommand(this.botService);
        const allowlistAnalyticsCommand = new AllowlistAnalyticsCommand(this.botService);
        const linkCommunityCommand = new LinkCommunityCommand(this.botService);
        const statusCommand = new StatusCommand(this.botService);
        const helpCommand = new HelpCommand(this.botService);
        const securityCommand = new SecurityCommand(this.botService);

        // Register commands
        this.commands.set('naffles-create-task', createTaskCommand);
        this.commands.set('naffles-list-tasks', listTasksCommand);
        this.commands.set('naffles-connect-allowlist', connectAllowlistCommand);
        this.commands.set('naffles-allowlist-analytics', allowlistAnalyticsCommand);
        this.commands.set('naffles-link-community', linkCommunityCommand);
        this.commands.set('naffles-status', statusCommand);
        this.commands.set('naffles-help', helpCommand);
        this.commands.set('naffles-security', securityCommand);

        logger.info(`Initialized ${this.commands.size} slash commands`);
    }

    async handleSlashCommand(interaction) {
        try {
            const command = this.commands.get(interaction.commandName);
            
            if (!command) {
                logger.warn(`Unknown command: ${interaction.commandName}`);
                await this.botService.auditLogger.logCommandExecution(interaction, 'unknown_command');
                return await interaction.reply({
                    content: '❌ Unknown command. Please try again.',
                    ephemeral: true
                });
            }

            // Check permissions first
            const permissionResult = await this.botService.permissionManager.checkCommandPermission(
                interaction, 
                interaction.commandName
            );

            if (!permissionResult.allowed) {
                // Log permission denial
                await this.botService.auditLogger.logPermissionCheck(
                    interaction, 
                    'denied', 
                    permissionResult.reason
                );
                
                // Monitor for security
                await this.botService.securityMonitor.monitorCommandExecution(interaction, 'permission_denied');
                
                return await interaction.reply({
                    content: `🚫 ${permissionResult.reason}`,
                    ephemeral: true
                });
            }

            // Log permission granted
            await this.botService.auditLogger.logPermissionCheck(
                interaction, 
                'granted', 
                permissionResult.reason
            );

            // Check command cooldown
            const cooldownKey = `${interaction.user.id}_${interaction.commandName}`;
            const cooldownTime = this.getCooldownTime(interaction.commandName);
            
            if (this.cooldowns.has(cooldownKey)) {
                const expirationTime = this.cooldowns.get(cooldownKey) + cooldownTime;
                
                if (Date.now() < expirationTime) {
                    const timeLeft = (expirationTime - Date.now()) / 1000;
                    await this.botService.auditLogger.logCommandExecution(interaction, 'cooldown_blocked');
                    return await interaction.reply({
                        content: `⏰ Please wait ${timeLeft.toFixed(1)} more seconds before using this command again.`,
                        ephemeral: true
                    });
                }
            }

            // Rate limiting check
            const rateLimitResult = this.botService.rateLimiter.checkRateLimit(
                interaction.user.id,
                'command'
            );

            if (!rateLimitResult.allowed) {
                const retryAfterSeconds = Math.ceil(rateLimitResult.retryAfter / 1000);
                
                // Log rate limit hit
                await this.botService.auditLogger.logRateLimit(
                    interaction.user.id,
                    interaction.guildId,
                    'command',
                    rateLimitResult
                );
                
                return await interaction.reply({
                    content: `⏰ You are using commands too quickly. Please wait ${retryAfterSeconds} seconds and try again.`,
                    ephemeral: true
                });
            }

            // Set cooldown
            this.cooldowns.set(cooldownKey, Date.now());
            setTimeout(() => this.cooldowns.delete(cooldownKey), cooldownTime);

            // Execute command
            await command.execute(interaction);
            
            // Log successful command usage
            await this.logCommandUsage(interaction, 'success');
            
            // Monitor command execution for security
            await this.botService.securityMonitor.monitorCommandExecution(interaction, 'success');

        } catch (error) {
            logger.error(`Error handling slash command ${interaction.commandName}:`, error);
            
            // Log failed command usage
            await this.logCommandUsage(interaction, 'error');
            
            // Log error in audit system
            await this.botService.auditLogger.logError(error, {
                commandName: interaction.commandName,
                userId: interaction.user.id,
                guildId: interaction.guildId
            });
            
            // Monitor for security implications
            await this.botService.securityMonitor.monitorCommandExecution(interaction, 'error');
            
            const errorMessage = '❌ An error occurred while processing your command. Please try again later.';
            
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: errorMessage, ephemeral: true });
                } else {
                    await interaction.reply({ content: errorMessage, ephemeral: true });
                }
            } catch (replyError) {
                logger.error('Failed to send error message:', replyError);
            }
        }
    }

    getCooldownTime(commandName) {
        const cooldownTimes = {
            'naffles-create-task': 10000, // 10 seconds
            'naffles-list-tasks': 5000,   // 5 seconds
            'naffles-connect-allowlist': 15000, // 15 seconds
            'naffles-allowlist-analytics': 10000, // 10 seconds
            'naffles-link-community': 30000, // 30 seconds
            'naffles-status': 5000, // 5 seconds
            'naffles-help': 2000 // 2 seconds
        };
        
        return cooldownTimes[commandName] || 5000; // Default 5 seconds
    }

    async handleModalSubmit(interaction) {
        try {
            // Determine which command should handle this modal
            if (interaction.customId.startsWith('create_task_modal_')) {
                const createTaskCommand = this.commands.get('naffles-create-task');
                await createTaskCommand.handleModalSubmit(interaction);
            } else {
                logger.warn(`Unknown modal: ${interaction.customId}`);
                await interaction.reply({
                    content: '❌ Unknown modal submission. Please try again.',
                    ephemeral: true
                });
            }

        } catch (error) {
            logger.error(`Error handling modal submit ${interaction.customId}:`, error);
            
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({
                        content: '❌ An error occurred while processing your submission. Please try again later.',
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: '❌ An error occurred while processing your submission. Please try again later.',
                        ephemeral: true
                    });
                }
            } catch (replyError) {
                logger.error('Failed to send modal error message:', replyError);
            }
        }
    }

    async handleSelectMenu(interaction) {
        try {
            // Determine which command should handle this select menu
            if (interaction.customId === 'select_task_details') {
                const listTasksCommand = this.commands.get('naffles-list-tasks');
                await listTasksCommand.handleSelectMenu(interaction);
            } else if (interaction.customId === 'help_topic') {
                const helpCommand = this.commands.get('naffles-help');
                if (helpCommand && helpCommand.handleSelectMenuInteraction) {
                    await helpCommand.handleSelectMenuInteraction(interaction);
                } else {
                    await interaction.reply({
                        content: '❌ Help functionality is not available.',
                        ephemeral: true
                    });
                }
            } else {
                logger.warn(`Unknown select menu: ${interaction.customId}`);
                await interaction.reply({
                    content: '❌ Unknown selection. Please try again.',
                    ephemeral: true
                });
            }

        } catch (error) {
            logger.error(`Error handling select menu ${interaction.customId}:`, error);
            
            try {
                await interaction.reply({
                    content: '❌ An error occurred while processing your selection. Please try again later.',
                    ephemeral: true
                });
            } catch (replyError) {
                logger.error('Failed to send select menu error message:', replyError);
            }
        }
    }

    getCommandList() {
        return Array.from(this.commands.keys());
    }

    getCommandCount() {
        return this.commands.size;
    }

    getCommandUsageStats() {
        // This would typically be stored in Redis or database
        // For now, return basic stats
        return {
            totalCommands: this.commands.size,
            commandList: Array.from(this.commands.keys()),
            activeCooldowns: this.cooldowns.size
        };
    }

    async logCommandUsage(interaction, result) {
        try {
            await this.botService.logInteraction(interaction, `command_${interaction.commandName}`, result);
        } catch (error) {
            logger.error('Failed to log command usage:', error);
        }
    }
}

module.exports = CommandHandler;