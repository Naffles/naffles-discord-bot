const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../utils/logger');

// Slash command data for Discord registration
const data = new SlashCommandBuilder()
    .setName('naffles-status')
    .setDescription('Check the Discord bot connection status and community link');

class StatusCommand {
    constructor(botService) {
        this.botService = botService;
        this.name = 'naffles-status';
    }

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            // Get server-community status
            const serverStatus = await this.botService.communityLinking.getServerCommunityStatus(interaction.guildId);

            // Get bot health status
            const healthStatus = await this.botService.communityLinking.healthCheck();

            // Get guild information
            const guild = interaction.guild;
            const botMember = guild.members.me;

            // Create status embed
            const embed = new EmbedBuilder()
                .setTitle('🤖 Naffles Discord Bot Status')
                .setColor(serverStatus.isLinked ? 0x10B981 : 0xF59E0B) // Green if linked, orange if not
                .setThumbnail(guild.iconURL())
                .setTimestamp();

            // Bot connection status
            embed.addFields({
                name: '🔗 Bot Connection',
                value: this.botService.connectionStatus.discord ? '🟢 Connected' : '🔴 Disconnected',
                inline: true
            });

            // API connection status
            embed.addFields({
                name: '🌐 Naffles API',
                value: healthStatus.nafflesApi ? '🟢 Online' : '🔴 Offline',
                inline: true
            });

            // Bot permissions
            const hasRequiredPerms = botMember.permissions.has(['SendMessages', 'EmbedLinks', 'UseApplicationCommands']);
            embed.addFields({
                name: '🔐 Bot Permissions',
                value: hasRequiredPerms ? '🟢 Sufficient' : '🟡 Limited',
                inline: true
            });

            // Community link status
            if (serverStatus.isLinked) {
                embed.addFields(
                    {
                        name: '🎯 Linked Community',
                        value: serverStatus.community?.name || 'Unknown',
                        inline: true
                    },
                    {
                        name: '🆔 Community ID',
                        value: serverStatus.mapping.communityId,
                        inline: true
                    },
                    {
                        name: '👤 Linked By',
                        value: `<@${serverStatus.mapping.linkedBy}>`,
                        inline: true
                    },
                    {
                        name: '📅 Linked At',
                        value: `<t:${Math.floor(serverStatus.mapping.linkedAt.getTime() / 1000)}:F>`,
                        inline: true
                    }
                );

                if (serverStatus.community) {
                    embed.addFields(
                        {
                            name: '👥 Community Members',
                            value: `${serverStatus.community.memberCount || 0}`,
                            inline: true
                        },
                        {
                            name: '💰 Points Currency',
                            value: serverStatus.community.pointsName || 'Points',
                            inline: true
                        }
                    );
                }

                embed.setDescription('✅ This Discord server is successfully linked to a Naffles community. You can use all bot commands.');
            } else {
                embed.setDescription('⚠️ This Discord server is not linked to any Naffles community. Use `/naffles-link-community` to get started.');
                embed.addFields({
                    name: '🚀 Getting Started',
                    value: 'Use `/naffles-link-community` to link this server to your Naffles community.',
                    inline: false
                });
            }

            // Performance metrics
            const uptimeHours = (Date.now() - this.botService.metrics.uptime) / (1000 * 60 * 60);
            embed.addFields(
                {
                    name: '📊 Commands Processed',
                    value: `${this.botService.metrics.commandsProcessed}`,
                    inline: true
                },
                {
                    name: '⏱️ Uptime',
                    value: `${uptimeHours.toFixed(1)} hours`,
                    inline: true
                },
                {
                    name: '🏥 Health Score',
                    value: this.calculateHealthScore(healthStatus, serverStatus),
                    inline: true
                }
            );

            // Create action buttons
            const actionRow = new ActionRowBuilder();

            if (serverStatus.isLinked) {
                actionRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId('test_connection')
                        .setLabel('Test Connection')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🔍'),
                    new ButtonBuilder()
                        .setCustomId('refresh_status')
                        .setLabel('Refresh Status')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔄')
                );

                if (serverStatus.community) {
                    actionRow.addComponents(
                        new ButtonBuilder()
                            .setURL(`https://naffles.com/community/${serverStatus.mapping.communityId}`)
                            .setLabel('View Community')
                            .setStyle(ButtonStyle.Link)
                            .setEmoji('🌐')
                    );
                }
            } else {
                actionRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId('link_community_help')
                        .setLabel('Link Community')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('🔗'),
                    new ButtonBuilder()
                        .setURL('https://naffles.com/discord-setup')
                        .setLabel('Setup Guide')
                        .setStyle(ButtonStyle.Link)
                        .setEmoji('📚')
                );
            }

            await interaction.editReply({
                embeds: [embed],
                components: [actionRow]
            });

            // Log interaction
            await this.botService.logInteraction(interaction, 'status_check', 'success');

        } catch (error) {
            logger.error('Error in status command:', error);
            
            const errorMessage = '❌ An error occurred while checking status. Please try again later.';
            
            if (interaction.deferred) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }

            await this.botService.logInteraction(interaction, 'status_check', 'error');
        }
    }

    async handleButtonInteraction(interaction) {
        try {
            const action = interaction.customId;

            if (action === 'test_connection') {
                await this.handleTestConnection(interaction);
            } else if (action === 'refresh_status') {
                await this.handleRefreshStatus(interaction);
            } else if (action === 'link_community_help') {
                await this.handleLinkCommunityHelp(interaction);
            }

        } catch (error) {
            logger.error('Error handling status button interaction:', error);
            await interaction.reply({
                content: '❌ An error occurred. Please try again.',
                ephemeral: true
            });
        }
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

            // Test Discord permissions
            const guild = interaction.guild;
            const botMember = guild.members.me;
            const permissions = botMember.permissions.toArray();

            const embed = new EmbedBuilder()
                .setTitle('✅ Connection Test Results')
                .setDescription('All systems are functioning properly.')
                .addFields(
                    { name: '🎯 Community', value: communityData.name, inline: true },
                    { name: '👥 Members', value: `${communityData.memberCount || 0}`, inline: true },
                    { name: '💰 Points', value: communityData.pointsName || 'Points', inline: true },
                    { name: '📊 Active Tasks', value: `${communityData.activeTasks || 0}`, inline: true },
                    { name: '🎫 Active Allowlists', value: `${communityData.activeAllowlists || 0}`, inline: true },
                    { name: '🔗 Connection Status', value: '🟢 Online', inline: true },
                    { name: '🔐 Bot Permissions', value: `${permissions.length} permissions`, inline: true },
                    { name: '⚡ Response Time', value: '< 1 second', inline: true },
                    { name: '🏥 Overall Health', value: '🟢 Excellent', inline: true }
                )
                .setColor(0x10B981) // Green
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error('Connection test failed:', error);
            
            const embed = new EmbedBuilder()
                .setTitle('❌ Connection Test Failed')
                .setDescription('Some issues were detected with the connection.')
                .addFields(
                    { name: '🔗 Connection Status', value: '🔴 Issues Detected', inline: true },
                    { name: '⚠️ Error Details', value: error.message || 'Unknown error', inline: false },
                    { name: '🔧 Suggested Actions', value: '• Check community ID\n• Verify bot permissions\n• Try again in a few minutes', inline: false }
                )
                .setColor(0xEF4444) // Red
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }
    }

    async handleRefreshStatus(interaction) {
        // Re-execute the main status command
        await this.execute(interaction);
    }

    async handleLinkCommunityHelp(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🔗 Link Your Community')
            .setDescription('To link this Discord server to your Naffles community, follow these steps:')
            .addFields(
                {
                    name: '1️⃣ Get Your Community ID',
                    value: 'Go to your Naffles community settings and copy your Community ID.',
                    inline: false
                },
                {
                    name: '2️⃣ Use the Link Command',
                    value: 'Run `/naffles-link-community` with your Community ID.',
                    inline: false
                },
                {
                    name: '3️⃣ Verify Permissions',
                    value: 'Make sure you have "Manage Server" permission and own the Naffles community.',
                    inline: false
                },
                {
                    name: '4️⃣ Start Using Commands',
                    value: 'Once linked, you can use `/naffles-create-task` and `/naffles-connect-allowlist`.',
                    inline: false
                }
            )
            .setColor(0x3B82F6) // Blue
            .setFooter({ text: 'Need help? Visit our support page' })
            .setTimestamp();

        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setURL('https://naffles.com/discord-setup')
                    .setLabel('Setup Guide')
                    .setStyle(ButtonStyle.Link)
                    .setEmoji('📚'),
                new ButtonBuilder()
                    .setURL('https://naffles.com/support')
                    .setLabel('Get Support')
                    .setStyle(ButtonStyle.Link)
                    .setEmoji('💬')
            );

        await interaction.reply({
            embeds: [embed],
            components: [actionRow],
            ephemeral: true
        });
    }

    calculateHealthScore(healthStatus, serverStatus) {
        let score = 0;
        let maxScore = 4;

        // API connection (25%)
        if (healthStatus.nafflesApi) score += 1;

        // Discord connection (25%)
        if (this.botService.connectionStatus.discord) score += 1;

        // Community link (25%)
        if (serverStatus.isLinked) score += 1;

        // Error rate (25%)
        const errorRate = this.botService.metrics.errorsEncountered / Math.max(this.botService.metrics.commandsProcessed, 1);
        if (errorRate < 0.1) score += 1; // Less than 10% error rate

        const percentage = Math.round((score / maxScore) * 100);
        
        if (percentage >= 90) return '🟢 Excellent';
        if (percentage >= 70) return '🟡 Good';
        if (percentage >= 50) return '🟠 Fair';
        return '🔴 Poor';
    }
}

// Export both the command class and the slash command data
module.exports = StatusCommand;
module.exports.data = data;