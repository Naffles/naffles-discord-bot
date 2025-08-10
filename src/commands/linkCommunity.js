const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../utils/logger');

// Slash command data for Discord registration
const data = new SlashCommandBuilder()
    .setName('naffles-link-community')
    .setDescription('Link this Discord server to a Naffles community')
    .addStringOption(option =>
        option.setName('community_id')
            .setDescription('Your Naffles community ID (found in community settings)')
            .setRequired(true)
            .setMaxLength(50));

class LinkCommunityCommand {
    constructor(botService) {
        this.botService = botService;
        this.name = 'naffles-link-community';
    }

    async execute(interaction) {
        try {
            // Check if user has permission to link community
            const permissionCheck = await this.botService.validateUserPermissions(
                interaction.guildId,
                interaction.user.id,
                ['ManageGuild']
            );

            if (!permissionCheck.hasPermission) {
                return await interaction.reply({
                    content: `❌ You don't have permission to link communities. You need the "Manage Server" permission. Reason: ${permissionCheck.reason}`,
                    ephemeral: true
                });
            }

            // Check if server is already linked
            const existingMapping = await this.botService.getServerCommunityMapping(interaction.guildId);
            if (existingMapping) {
                const embed = new EmbedBuilder()
                    .setTitle('🔗 Server Already Linked')
                    .setDescription(`This Discord server is already linked to community ID: \`${existingMapping.communityId}\``)
                    .addFields(
                        { name: 'Linked By', value: `<@${existingMapping.linkedBy}>`, inline: true },
                        { name: 'Linked At', value: `<t:${Math.floor(existingMapping.linkedAt.getTime() / 1000)}:F>`, inline: true }
                    )
                    .setColor(0xF59E0B) // Orange
                    .setTimestamp();

                const actionRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('unlink_community')
                            .setLabel('Unlink Community')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('🔓'),
                        new ButtonBuilder()
                            .setCustomId('relink_community')
                            .setLabel('Link Different Community')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('🔄')
                    );

                return await interaction.reply({
                    embeds: [embed],
                    components: [actionRow],
                    ephemeral: true
                });
            }

            const communityId = interaction.options.getString('community_id');

            // Validate community exists and user has access
            await interaction.deferReply({ ephemeral: true });

            try {
                const communityData = await this.botService.makeNafflesApiCall(
                    `/api/communities/${communityId}/validate-ownership`,
                    'POST',
                    { discordUserId: interaction.user.id }
                );

                if (!communityData.canManage) {
                    return await interaction.editReply({
                        content: `❌ You don't have permission to manage community "${communityData.name}". Only community owners can link Discord servers.`
                    });
                }

                // Check if community is already linked to another server
                const existingCommunityMapping = await this.botService.db.ServerMapping.findOne({
                    communityId,
                    isActive: true
                });

                if (existingCommunityMapping) {
                    return await interaction.editReply({
                        content: `❌ Community "${communityData.name}" is already linked to another Discord server. Each community can only be linked to one Discord server at a time.`
                    });
                }

                // Create the server-community mapping
                const mapping = await this.botService.createServerCommunityMapping(
                    interaction.guildId,
                    communityId,
                    interaction.user.id
                );

                // Update mapping with guild info
                const guild = interaction.guild;
                await mapping.updateGuildInfo(guild);

                // Create success embed
                const successEmbed = new EmbedBuilder()
                    .setTitle('✅ Community Linked Successfully!')
                    .setDescription(`Discord server **${guild.name}** has been successfully linked to Naffles community **${communityData.name}**.`)
                    .addFields(
                        { name: '🏠 Discord Server', value: guild.name, inline: true },
                        { name: '🎯 Naffles Community', value: communityData.name, inline: true },
                        { name: '👤 Linked By', value: interaction.user.username, inline: true },
                        { name: '📊 Community Members', value: `${communityData.memberCount || 0}`, inline: true },
                        { name: '💰 Points Currency', value: communityData.pointsName || 'Points', inline: true },
                        { name: '🆔 Community ID', value: communityId, inline: true }
                    )
                    .setColor(0x10B981) // Green
                    .setThumbnail(guild.iconURL())
                    .setFooter({ 
                        text: 'You can now use /naffles-create-task and /naffles-connect-allowlist commands!',
                        iconURL: 'https://naffles.com/logo.png'
                    })
                    .setTimestamp();

                const actionRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('test_connection')
                            .setLabel('Test Connection')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('🔍'),
                        new ButtonBuilder()
                            .setURL('https://naffles.com/community/' + communityId)
                            .setLabel('View Community')
                            .setStyle(ButtonStyle.Link)
                            .setEmoji('🌐')
                    );

                await interaction.editReply({
                    embeds: [successEmbed],
                    components: [actionRow]
                });

                // Send notification to community channel if configured
                await this.sendCommunityNotification(guild, communityData);

                // Log successful linking
                await this.botService.logInteraction(interaction, 'link_community', 'success');

            } catch (apiError) {
                logger.error('API error during community validation:', apiError);
                
                let errorMessage = '❌ Failed to validate community. ';
                if (apiError.response?.status === 404) {
                    errorMessage += 'Community not found. Please check the community ID.';
                } else if (apiError.response?.status === 403) {
                    errorMessage += 'You don\'t have permission to manage this community.';
                } else {
                    errorMessage += 'Please check the community ID and try again.';
                }

                await interaction.editReply({ content: errorMessage });
                await this.botService.logInteraction(interaction, 'link_community', 'error');
            }

        } catch (error) {
            logger.error('Error in linkCommunity command:', error);
            
            const errorMessage = '❌ An error occurred while linking the community. Please try again later.';
            
            if (interaction.deferred) {
                await interaction.editReply({ content: errorMessage });
            } else if (!interaction.replied) {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }

            await this.botService.logInteraction(interaction, 'link_community', 'error');
        }
    }

    async handleButtonInteraction(interaction) {
        try {
            const action = interaction.customId;

            if (action === 'unlink_community') {
                await this.handleUnlinkCommunity(interaction);
            } else if (action === 'relink_community') {
                await this.handleRelinkCommunity(interaction);
            } else if (action === 'test_connection') {
                await this.handleTestConnection(interaction);
            }

        } catch (error) {
            logger.error('Error handling link community button interaction:', error);
            await interaction.reply({
                content: '❌ An error occurred. Please try again.',
                ephemeral: true
            });
        }
    }

    async handleUnlinkCommunity(interaction) {
        // Check permissions
        const permissionCheck = await this.botService.validateUserPermissions(
            interaction.guildId,
            interaction.user.id,
            ['ManageGuild']
        );

        if (!permissionCheck.hasPermission) {
            return await interaction.reply({
                content: '❌ You don\'t have permission to unlink communities.',
                ephemeral: true
            });
        }

        // Get current mapping
        const mapping = await this.botService.getServerCommunityMapping(interaction.guildId);
        if (!mapping) {
            return await interaction.reply({
                content: '❌ No community link found for this server.',
                ephemeral: true
            });
        }

        // Remove the mapping
        await this.botService.db.deleteServerCommunityMapping(interaction.guildId);

        const embed = new EmbedBuilder()
            .setTitle('🔓 Community Unlinked')
            .setDescription(`Discord server has been unlinked from community \`${mapping.communityId}\`.`)
            .setColor(0xEF4444) // Red
            .setTimestamp();

        await interaction.update({
            embeds: [embed],
            components: []
        });

        await this.botService.logInteraction(interaction, 'unlink_community', 'success');
    }

    async handleRelinkCommunity(interaction) {
        // Check permissions
        const permissionCheck = await this.botService.validateUserPermissions(
            interaction.guildId,
            interaction.user.id,
            ['ManageGuild']
        );

        if (!permissionCheck.hasPermission) {
            return await interaction.reply({
                content: '❌ You don\'t have permission to relink communities.',
                ephemeral: true
            });
        }

        // Remove existing mapping
        await this.botService.db.deleteServerCommunityMapping(interaction.guildId);

        const embed = new EmbedBuilder()
            .setTitle('🔄 Ready to Link New Community')
            .setDescription('Previous community link has been removed. Use `/naffles-link-community` to link a new community.')
            .setColor(0x3B82F6) // Blue
            .setTimestamp();

        await interaction.update({
            embeds: [embed],
            components: []
        });

        await this.botService.logInteraction(interaction, 'relink_community', 'success');
    }

    async handleTestConnection(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const mapping = await this.botService.getServerCommunityMapping(interaction.guildId);
            if (!mapping) {
                return await interaction.editReply({
                    content: '❌ No community link found for this server.'
                });
            }

            // Test API connection
            const communityData = await this.botService.makeNafflesApiCall(
                `/api/communities/${mapping.communityId}`
            );

            const embed = new EmbedBuilder()
                .setTitle('✅ Connection Test Successful')
                .setDescription('Discord bot is successfully connected to your Naffles community.')
                .addFields(
                    { name: '🎯 Community', value: communityData.name, inline: true },
                    { name: '👥 Members', value: `${communityData.memberCount || 0}`, inline: true },
                    { name: '💰 Points', value: communityData.pointsName || 'Points', inline: true },
                    { name: '📊 Active Tasks', value: `${communityData.activeTasks || 0}`, inline: true },
                    { name: '🎫 Active Allowlists', value: `${communityData.activeAllowlists || 0}`, inline: true },
                    { name: '🔗 Connection Status', value: '🟢 Online', inline: true }
                )
                .setColor(0x10B981) // Green
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error('Connection test failed:', error);
            
            const embed = new EmbedBuilder()
                .setTitle('❌ Connection Test Failed')
                .setDescription('Unable to connect to Naffles API. Please try again later.')
                .addFields(
                    { name: '🔗 Connection Status', value: '🔴 Offline', inline: true },
                    { name: '⚠️ Error', value: error.message || 'Unknown error', inline: false }
                )
                .setColor(0xEF4444) // Red
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }
    }

    async sendCommunityNotification(guild, communityData) {
        try {
            // This would send a notification to the community's notification channel
            // if they have one configured in their Naffles community settings
            await this.botService.makeNafflesApiCall(
                `/api/communities/${communityData.id}/notifications`,
                'POST',
                {
                    type: 'discord_server_linked',
                    data: {
                        guildName: guild.name,
                        guildId: guild.id,
                        memberCount: guild.memberCount,
                        linkedAt: new Date()
                    }
                }
            );
        } catch (error) {
            // Non-critical error, just log it
            logger.warn('Failed to send community notification:', error);
        }
    }
}

// Export both the command class and the slash command data
module.exports = LinkCommunityCommand;
module.exports.data = data;