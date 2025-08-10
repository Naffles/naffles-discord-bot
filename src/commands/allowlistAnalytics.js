const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');

// Slash command data for Discord registration
const data = new SlashCommandBuilder()
    .setName('naffles-allowlist-analytics')
    .setDescription('View allowlist entry tracking and analytics for this server')
    .addStringOption(option =>
        option.setName('period')
            .setDescription('Time period for analytics')
            .setRequired(false)
            .addChoices(
                { name: 'Last 7 days', value: '7d' },
                { name: 'Last 30 days', value: '30d' },
                { name: 'All time', value: 'all' }
            ));

class AllowlistAnalyticsCommand {
    constructor(botService) {
        this.botService = botService;
        this.name = 'naffles-allowlist-analytics';
    }

    async execute(interaction) {
        try {
            // Check if user has permission to view analytics
            const permissionCheck = await this.botService.validateUserPermissions(
                interaction.guildId,
                interaction.user.id,
                ['ManageGuild', 'Administrator']
            );

            if (!permissionCheck.hasPermission) {
                return await interaction.reply({
                    content: `❌ You don't have permission to view allowlist analytics. Reason: ${permissionCheck.reason}`,
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

            // Defer reply for data processing
            await interaction.deferReply({ ephemeral: true });

            try {
                // Get analytics data
                const analytics = await this.botService.allowlistIntegration.getAllowlistAnalytics(interaction.guildId);
                const period = interaction.options.getString('period') || 'all';

                // Create analytics embed
                const analyticsEmbed = this.createAnalyticsEmbed(analytics, period, serverMapping.communityName);

                await interaction.editReply({
                    embeds: [analyticsEmbed]
                });

                // Log successful analytics view
                await this.botService.logInteraction(interaction, 'view_allowlist_analytics', 'success');

            } catch (analyticsError) {
                logger.error('Error fetching allowlist analytics:', analyticsError);
                
                await interaction.editReply({
                    content: '❌ Failed to fetch allowlist analytics. Please try again later.'
                });

                await this.botService.logInteraction(interaction, 'view_allowlist_analytics', 'error');
            }

        } catch (error) {
            logger.error('Error in allowlist analytics command:', error);
            
            const errorMessage = '❌ An error occurred while fetching analytics. Please try again later.';
            
            if (interaction.deferred) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }

            await this.botService.logInteraction(interaction, 'view_allowlist_analytics', 'error');
        }
    }

    /**
     * Create analytics embed with comprehensive data visualization
     * @param {Object} analytics - Analytics data
     * @param {string} period - Time period
     * @param {string} communityName - Community name
     * @returns {EmbedBuilder} Analytics embed
     */
    createAnalyticsEmbed(analytics, period, communityName) {
        const embed = new EmbedBuilder()
            .setTitle('📊 Allowlist Analytics Dashboard')
            .setDescription(`Analytics for **${communityName}** Discord server`)
            .setColor(0x3B82F6) // Naffles blue
            .setFooter({ 
                text: 'Powered by Naffles', 
                iconURL: 'https://naffles.com/logo.png' 
            })
            .setTimestamp();

        // Add period information
        const periodText = this.formatPeriod(period);
        embed.addFields({
            name: '📅 Period',
            value: periodText,
            inline: true
        });

        // Add overview statistics
        embed.addFields(
            {
                name: '🎫 Total Allowlists',
                value: `${analytics.totalAllowlists}`,
                inline: true
            },
            {
                name: '🟢 Active Allowlists',
                value: `${analytics.activeAllowlists}`,
                inline: true
            },
            {
                name: '👁️ Total Views',
                value: `${analytics.totalViews.toLocaleString()}`,
                inline: true
            },
            {
                name: '🎪 Total Entries',
                value: `${analytics.totalEntries.toLocaleString()}`,
                inline: true
            },
            {
                name: '📈 Avg Views/Allowlist',
                value: `${analytics.averageViewsPerAllowlist}`,
                inline: true
            },
            {
                name: '📊 Avg Entries/Allowlist',
                value: `${analytics.averageEntriesPerAllowlist}`,
                inline: true
            }
        );

        // Add engagement rate calculation
        const engagementRate = analytics.totalViews > 0 
            ? ((analytics.totalEntries / analytics.totalViews) * 100).toFixed(1)
            : '0.0';
        
        embed.addFields({
            name: '🎯 Engagement Rate',
            value: `${engagementRate}%`,
            inline: true
        });

        // Add top performing allowlists
        if (analytics.connections && analytics.connections.length > 0) {
            const topAllowlists = analytics.connections
                .sort((a, b) => b.entries - a.entries)
                .slice(0, 5)
                .map((allowlist, index) => {
                    const statusEmoji = allowlist.status === 'active' ? '🟢' : '🔴';
                    return `${index + 1}. ${statusEmoji} **${allowlist.title}**\n   👁️ ${allowlist.views} views • 🎪 ${allowlist.entries} entries`;
                })
                .join('\n\n');

            if (topAllowlists) {
                embed.addFields({
                    name: '🏆 Top Performing Allowlists',
                    value: topAllowlists,
                    inline: false
                });
            }
        }

        // Add recent activity
        if (analytics.connections && analytics.connections.length > 0) {
            const recentAllowlists = analytics.connections
                .sort((a, b) => new Date(b.connectedAt) - new Date(a.connectedAt))
                .slice(0, 3)
                .map(allowlist => {
                    const statusEmoji = allowlist.status === 'active' ? '🟢' : '🔴';
                    const connectedDate = new Date(allowlist.connectedAt);
                    const timestamp = Math.floor(connectedDate.getTime() / 1000);
                    return `${statusEmoji} **${allowlist.title}**\n   Connected <t:${timestamp}:R>`;
                })
                .join('\n\n');

            if (recentAllowlists) {
                embed.addFields({
                    name: '🕒 Recent Activity',
                    value: recentAllowlists,
                    inline: false
                });
            }
        }

        // Add performance insights
        const insights = this.generatePerformanceInsights(analytics);
        if (insights.length > 0) {
            embed.addFields({
                name: '💡 Performance Insights',
                value: insights.join('\n'),
                inline: false
            });
        }

        return embed;
    }

    /**
     * Format time period for display
     * @param {string} period - Period code
     * @returns {string} Formatted period
     */
    formatPeriod(period) {
        const periodMap = {
            '7d': 'Last 7 days',
            '30d': 'Last 30 days',
            'all': 'All time'
        };
        return periodMap[period] || 'All time';
    }

    /**
     * Generate performance insights based on analytics data
     * @param {Object} analytics - Analytics data
     * @returns {Array} Array of insight strings
     */
    generatePerformanceInsights(analytics) {
        const insights = [];

        // Engagement rate insights
        const engagementRate = analytics.totalViews > 0 
            ? (analytics.totalEntries / analytics.totalViews) * 100
            : 0;

        if (engagementRate > 50) {
            insights.push('🎉 Excellent engagement rate! Your allowlists are highly attractive to users.');
        } else if (engagementRate > 25) {
            insights.push('👍 Good engagement rate. Consider optimizing allowlist descriptions for better conversion.');
        } else if (engagementRate > 0) {
            insights.push('📈 Room for improvement. Try adding more attractive prizes or clearer requirements.');
        }

        // Activity insights
        if (analytics.activeAllowlists === 0 && analytics.totalAllowlists > 0) {
            insights.push('⏰ No active allowlists. Consider creating new allowlists to maintain engagement.');
        } else if (analytics.activeAllowlists > 3) {
            insights.push('🔥 High activity! You have multiple active allowlists running simultaneously.');
        }

        // Volume insights
        if (analytics.totalAllowlists > 10) {
            insights.push('🏆 Experienced community! You\'ve run many successful allowlists.');
        } else if (analytics.totalAllowlists > 5) {
            insights.push('📊 Growing community! Keep up the consistent allowlist activity.');
        } else if (analytics.totalAllowlists > 0) {
            insights.push('🌱 Getting started! Consider running more allowlists to build community engagement.');
        }

        // Performance comparison insights
        if (analytics.averageEntriesPerAllowlist > 100) {
            insights.push('🎯 High-performing allowlists! Your average entry count is excellent.');
        } else if (analytics.averageEntriesPerAllowlist > 50) {
            insights.push('📈 Solid performance! Your allowlists are attracting good participation.');
        }

        return insights;
    }
}

// Export both the command class and the slash command data
module.exports = AllowlistAnalyticsCommand;
module.exports.data = data;