const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');

// Slash command data for Discord registration
const data = new SlashCommandBuilder()
    .setName('naffles-connect-allowlist')
    .setDescription('Connect an existing Naffles allowlist to this Discord channel')
    .addStringOption(option =>
        option.setName('allowlist_id')
            .setDescription('The ID of the allowlist to connect')
            .setRequired(true)
            .setMaxLength(50));

class ConnectAllowlistCommand {
    constructor(botService) {
        this.botService = botService;
        this.name = 'naffles-connect-allowlist';
    }

    async execute(interaction) {
        try {
            // Check if user has permission to connect allowlists
            const permissionCheck = await this.botService.validateUserPermissions(
                interaction.guildId,
                interaction.user.id,
                ['ManageGuild']
            );

            if (!permissionCheck.hasPermission) {
                return await interaction.reply({
                    content: `❌ You don't have permission to connect allowlists. Reason: ${permissionCheck.reason}`,
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

            // Get allowlist ID
            const allowlistId = interaction.options.getString('allowlist_id');

            // Defer reply for API call
            await interaction.deferReply();

            try {
                // Use the allowlist integration service to connect the allowlist
                const connectionResult = await this.botService.allowlistIntegration.connectAllowlistToServer({
                    allowlistId,
                    guildId: interaction.guildId,
                    channelId: interaction.channel.id,
                    connectedBy: interaction.user.id
                });

                if (connectionResult.success) {
                    // Reply to interaction
                    await interaction.editReply({
                        content: `✅ Allowlist "${connectionResult.allowlist.title}" has been connected and posted to this channel!`
                    });

                    // Log successful connection
                    await this.botService.logInteraction(interaction, 'connect_allowlist', 'success');
                } else {
                    throw new Error(connectionResult.error || 'Failed to connect allowlist');
                }

            } catch (apiError) {
                logger.error('API error in connectAllowlist:', apiError);
                
                if (apiError.response && apiError.response.status === 404) {
                    await interaction.editReply({
                        content: '❌ Allowlist not found. Please check the allowlist ID and try again.'
                    });
                } else if (apiError.response && apiError.response.status === 403) {
                    await interaction.editReply({
                        content: '❌ You don\'t have permission to access this allowlist.'
                    });
                } else {
                    await interaction.editReply({
                        content: '❌ Failed to fetch allowlist details. Please try again later.'
                    });
                }

                await this.botService.logInteraction(interaction, 'connect_allowlist', 'error');
            }

        } catch (error) {
            logger.error('Error in connectAllowlist command:', error);
            
            const errorMessage = '❌ An error occurred while connecting the allowlist. Please try again later.';
            
            if (interaction.deferred) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }

            await this.botService.logInteraction(interaction, 'connect_allowlist', 'error');
        }
    }

    async handleAllowlistEntry(interaction) {
        try {
            // Extract allowlist ID from custom ID
            const allowlistId = interaction.customId.split('_')[2];

            // Use the allowlist integration service to process the entry
            const result = await this.botService.allowlistIntegration.processAllowlistEntry(interaction, allowlistId);
            
            if (result.success) {
                // Success is handled by the integration service
                await this.botService.logInteraction(interaction, 'enter_allowlist', 'success');
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

                await this.botService.logInteraction(interaction, 'enter_allowlist', 'error');
            }

        } catch (error) {
            logger.error('Error handling allowlist entry:', error);
            
            await interaction.reply({
                content: '❌ An error occurred while processing your entry. Please try again later.',
                ephemeral: true
            });

            await this.botService.logInteraction(interaction, 'enter_allowlist', 'error');
        }
    }

    async handleAllowlistView(interaction) {
        try {
            // Extract allowlist ID from custom ID
            const allowlistId = interaction.customId.split('_')[2];

            // Use the Discord bot service's showAllowlistInfo method
            await this.botService.showAllowlistInfo(interaction, allowlistId);

            // Log interaction
            await this.botService.logInteraction(interaction, 'view_allowlist_details', 'success');

        } catch (error) {
            logger.error('Error handling allowlist view:', error);
            
            await interaction.reply({
                content: '❌ Failed to load allowlist details. Please try again later.',
                ephemeral: true
            });

            await this.botService.logInteraction(interaction, 'view_allowlist_details', 'error');
        }
    }
}

// Export both the command class and the slash command data
module.exports = ConnectAllowlistCommand;
module.exports.data = data;