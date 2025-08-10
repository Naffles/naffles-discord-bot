const logger = require('../utils/logger');

class EventHandler {
    constructor(client, botService, commandHandler) {
        this.client = client;
        this.botService = botService;
        this.commandHandler = commandHandler;
    }

    async initialize() {
        try {
            logger.info('Initializing Discord event handlers...');

            // Set up event listeners
            this.setupClientEvents();
            this.setupGuildEvents();
            this.setupInteractionEvents();

            logger.info('Discord event handlers initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize event handlers:', error);
            throw error;
        }
    }

    setupClientEvents() {
        // Bot ready event
        this.client.once('ready', async () => {
            logger.info(`Discord bot logged in as ${this.client.user.tag}`);
            logger.info(`Bot is in ${this.client.guilds.cache.size} guilds`);

            // Set bot status
            this.client.user.setActivity('Naffles Community Management', { type: 'WATCHING' });

            // Initialize bot service after client is ready
            await this.botService.onReady();
        });

        // Error handling
        this.client.on('error', (error) => {
            logger.error('Discord client error:', error);
        });

        this.client.on('warn', (warning) => {
            logger.warn('Discord client warning:', warning);
        });

        // Reconnection events
        this.client.on('disconnect', () => {
            logger.warn('Discord client disconnected');
        });

        this.client.on('reconnecting', () => {
            logger.info('Discord client reconnecting...');
        });

        this.client.on('resume', () => {
            logger.info('Discord client resumed connection');
        });
    }

    setupGuildEvents() {
        // Guild join event
        this.client.on('guildCreate', async (guild) => {
            logger.info(`Bot joined guild: ${guild.name} (${guild.id})`);
            
            try {
                await this.botService.onGuildJoin(guild);
                
                // Log bot guild join
                if (this.botService.auditLogger) {
                    await this.botService.auditLogger.logBotGuildEvent(guild, 'joined');
                }
            } catch (error) {
                logger.error(`Error handling guild join for ${guild.name}:`, error);
            }
        });

        // Guild leave event
        this.client.on('guildDelete', async (guild) => {
            logger.info(`Bot left guild: ${guild.name} (${guild.id})`);
            
            try {
                await this.botService.onGuildLeave(guild);
                
                // Log bot guild leave
                if (this.botService.auditLogger) {
                    await this.botService.auditLogger.logBotGuildEvent(guild, 'left');
                }
            } catch (error) {
                logger.error(`Error handling guild leave for ${guild.name}:`, error);
            }
        });

        // Guild member events
        this.client.on('guildMemberAdd', async (member) => {
            try {
                await this.botService.onMemberJoin(member);
                
                // Monitor for mass joins and security threats
                if (this.botService.securityMonitor) {
                    await this.botService.securityMonitor.monitorMemberJoin(member);
                }
                
                // Log member join
                if (this.botService.auditLogger) {
                    await this.botService.auditLogger.logUserEvent(member, 'joined');
                }
            } catch (error) {
                logger.error(`Error handling member join in ${member.guild.name}:`, error);
            }
        });

        this.client.on('guildMemberRemove', async (member) => {
            try {
                await this.botService.onMemberLeave(member);
                
                // Log member leave
                if (this.botService.auditLogger) {
                    await this.botService.auditLogger.logUserEvent(member, 'left');
                }
            } catch (error) {
                logger.error(`Error handling member leave in ${member.guild.name}:`, error);
            }
        });
    }

    setupInteractionEvents() {
        // Slash command interactions
        this.client.on('interactionCreate', async (interaction) => {
            try {
                if (interaction.isChatInputCommand()) {
                    await this.handleSlashCommand(interaction);
                } else if (interaction.isButton()) {
                    await this.handleButtonInteraction(interaction);
                } else if (interaction.isStringSelectMenu()) {
                    await this.handleSelectMenuInteraction(interaction);
                } else if (interaction.isModalSubmit()) {
                    await this.handleModalSubmit(interaction);
                }
            } catch (error) {
                logger.error('Error handling interaction:', error);
                
                // Try to respond with error message if possible
                try {
                    const errorMessage = 'An error occurred while processing your request. Please try again later.';
                    
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ content: errorMessage, ephemeral: true });
                    } else {
                        await interaction.reply({ content: errorMessage, ephemeral: true });
                    }
                } catch (replyError) {
                    logger.error('Failed to send error response:', replyError);
                }
            }
        });
    }

    async handleSlashCommand(interaction) {
        const { commandName } = interaction;
        
        logger.info(`Slash command received: ${commandName} from ${interaction.user.tag} in ${interaction.guild?.name || 'DM'}`);

        // Log interaction
        await this.botService.logInteraction({
            guildId: interaction.guildId,
            userId: interaction.user.id,
            action: 'slash_command',
            command: commandName,
            timestamp: new Date(),
            metadata: {
                channelId: interaction.channelId,
                options: interaction.options.data
            }
        });

        // Handle the command through the command handler
        if (this.commandHandler) {
            await this.commandHandler.handleSlashCommand(interaction);
        } else {
            logger.error('Command handler not available');
            await interaction.reply({
                content: 'Command handler not available. Please try again later.',
                ephemeral: true
            });
        }
    }

    async handleButtonInteraction(interaction) {
        logger.info(`Button interaction: ${interaction.customId} from ${interaction.user.tag}`);

        // Log interaction
        await this.botService.logInteraction({
            guildId: interaction.guildId,
            userId: interaction.user.id,
            action: 'button_click',
            command: interaction.customId,
            timestamp: new Date(),
            metadata: {
                channelId: interaction.channelId,
                messageId: interaction.message.id
            }
        });

        // Handle button through bot service
        await this.botService.handleButtonInteraction(interaction);
    }

    async handleSelectMenuInteraction(interaction) {
        logger.info(`Select menu interaction: ${interaction.customId} from ${interaction.user.tag}`);

        // Log interaction
        await this.botService.logInteraction({
            guildId: interaction.guildId,
            userId: interaction.user.id,
            action: 'select_menu',
            command: interaction.customId,
            timestamp: new Date(),
            metadata: {
                channelId: interaction.channelId,
                values: interaction.values
            }
        });

        // Handle select menu through command handler
        if (this.commandHandler) {
            await this.commandHandler.handleSelectMenu(interaction);
        } else {
            await this.botService.handleSelectMenuInteraction(interaction);
        }
    }

    async handleModalSubmit(interaction) {
        logger.info(`Modal submit: ${interaction.customId} from ${interaction.user.tag}`);

        // Log interaction
        await this.botService.logInteraction({
            guildId: interaction.guildId,
            userId: interaction.user.id,
            action: 'modal_submit',
            command: interaction.customId,
            timestamp: new Date(),
            metadata: {
                channelId: interaction.channelId,
                fields: interaction.fields.fields.map(field => ({
                    customId: field.customId,
                    value: field.value
                }))
            }
        });

        // Handle modal through command handler
        if (this.commandHandler) {
            await this.commandHandler.handleModalSubmit(interaction);
        } else {
            await this.botService.handleModalSubmit(interaction);
        }
    }
}

module.exports = EventHandler;