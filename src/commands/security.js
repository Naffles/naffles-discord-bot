const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../utils/logger');

class SecurityCommand {
    constructor(botService) {
        this.botService = botService;
    }

    async execute(interaction) {
        try {
            // Check if user has admin permissions
            const adminCheck = await this.botService.permissionManager.checkAdminPermission(
                interaction.member,
                interaction.guildId
            );

            if (!adminCheck.allowed) {
                return await interaction.reply({
                    content: '🚫 This command requires administrator permissions.',
                    ephemeral: true
                });
            }

            const subcommand = interaction.options.getSubcommand();

            switch (subcommand) {
                case 'report':
                    await this.handleSecurityReport(interaction);
                    break;
                case 'stats':
                    await this.handleSecurityStats(interaction);
                    break;
                case 'alerts':
                    await this.handleSecurityAlerts(interaction);
                    break;
                case 'audit':
                    await this.handleAuditLogs(interaction);
                    break;
                case 'permissions':
                    await this.handlePermissionConfig(interaction);
                    break;
                default:
                    await interaction.reply({
                        content: '❌ Unknown security subcommand.',
                        ephemeral: true
                    });
            }

        } catch (error) {
            logger.error('Error in security command:', error);
            await interaction.reply({
                content: '❌ An error occurred while processing the security command.',
                ephemeral: true
            });
        }
    }

    async handleSecurityReport(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const timeframe = interaction.options.getString('timeframe') || 'day';
            const report = await this.botService.securityReporter.generateSecurityReport(
                timeframe,
                interaction.guildId
            );

            if (!report) {
                return await interaction.editReply({
                    content: '❌ Failed to generate security report.'
                });
            }

            const embed = new EmbedBuilder()
                .setTitle(`🛡️ Security Report - ${timeframe.toUpperCase()}`)
                .setDescription(`Security analysis for ${interaction.guild.name}`)
                .setColor(this.getRiskColor(report.threatAnalysis.riskLevel))
                .setTimestamp()
                .addFields([
                    {
                        name: '📊 Summary',
                        value: [
                            `**Total Events:** ${report.summary.totalSecurityEvents}`,
                            `**High Severity:** ${report.summary.highSeverityEvents}`,
                            `**Critical Events:** ${report.summary.criticalEvents}`,
                            `**Commands Executed:** ${report.summary.commandsExecuted}`,
                            `**Permission Denials:** ${report.summary.permissionDenials}`
                        ].join('\n'),
                        inline: true
                    },
                    {
                        name: '⚠️ Risk Assessment',
                        value: [
                            `**Risk Level:** ${report.threatAnalysis.riskLevel.toUpperCase()}`,
                            `**Suspicious Users:** ${report.threatAnalysis.suspiciousUsers.size}`,
                            `**Attack Patterns:** ${report.threatAnalysis.attackPatterns.length}`,
                            `**Top Risks:** ${report.topRisks.length}`
                        ].join('\n'),
                        inline: true
                    },
                    {
                        name: '🔧 System Health',
                        value: [
                            `**Rate Limiter:** ${report.systemHealth.rateLimiter.activeEntries} active`,
                            `**Permissions:** ${report.systemHealth.permissions.cacheSize} cached`,
                            `**Monitoring:** ${report.systemHealth.monitoring.suspiciousUsers} tracked`
                        ].join('\n'),
                        inline: true
                    }
                ]);

            // Add recommendations if any
            if (report.recommendations.length > 0) {
                const topRecommendations = report.recommendations.slice(0, 3);
                embed.addFields([{
                    name: '💡 Top Recommendations',
                    value: topRecommendations.map((rec, index) => 
                        `${index + 1}. **${rec.title}** - ${rec.description}`
                    ).join('\n')
                }]);
            }

            // Add action items if any
            if (report.actionItems.length > 0) {
                const urgentActions = report.actionItems.filter(item => 
                    item.priority === 'immediate' || item.priority === 'high'
                );
                
                if (urgentActions.length > 0) {
                    embed.addFields([{
                        name: '🚨 Urgent Actions Required',
                        value: urgentActions.map(action => 
                            `• **${action.title}** (${action.priority})`
                        ).join('\n')
                    }]);
                }
            }

            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('security_detailed_report')
                        .setLabel('Detailed Report')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📋'),
                    new ButtonBuilder()
                        .setCustomId('security_export_data')
                        .setLabel('Export Data')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('💾')
                );

            await interaction.editReply({
                embeds: [embed],
                components: [buttons]
            });

        } catch (error) {
            logger.error('Error generating security report:', error);
            await interaction.editReply({
                content: '❌ Failed to generate security report.'
            });
        }
    }

    async handleSecurityStats(interaction) {
        try {
            const securityStats = this.botService.securityMonitor.getSecurityStatistics();
            const auditStats = this.botService.auditLogger.getAuditStatistics();
            const permissionStats = this.botService.permissionManager.getPermissionStatistics();

            const embed = new EmbedBuilder()
                .setTitle('📈 Security Statistics')
                .setDescription(`Real-time security metrics for ${interaction.guild.name}`)
                .setColor(0x00ff00)
                .setTimestamp()
                .addFields([
                    {
                        name: '🔍 Security Monitoring',
                        value: [
                            `**Total Events:** ${securityStats.totalEvents}`,
                            `**Recent Events:** ${securityStats.recentEvents} (last hour)`,
                            `**Daily Events:** ${securityStats.dailyEvents}`,
                            `**Suspicious Users:** ${securityStats.suspiciousUsers}`
                        ].join('\n'),
                        inline: true
                    },
                    {
                        name: '📝 Audit Logs',
                        value: [
                            `**Total Logs:** ${auditStats.totalLogs}`,
                            `**Recent Logs:** ${auditStats.recentLogs} (last hour)`,
                            `**Daily Logs:** ${auditStats.dailyLogs}`,
                            `**Unique Users:** ${auditStats.uniqueUsers}`
                        ].join('\n'),
                        inline: true
                    },
                    {
                        name: '🔐 Permissions',
                        value: [
                            `**Cache Size:** ${permissionStats.cacheSize}`,
                            `**Server Configs:** ${permissionStats.serverConfigs}`,
                            `**Recent Activity:** ${permissionStats.recentActivity}`,
                            `**Commands:** ${permissionStats.defaultCommands}`
                        ].join('\n'),
                        inline: true
                    }
                ]);

            // Add event breakdown
            if (Object.keys(securityStats.eventsByType).length > 0) {
                const eventTypes = Object.entries(securityStats.eventsByType)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 5)
                    .map(([type, count]) => `**${type}:** ${count}`)
                    .join('\n');

                embed.addFields([{
                    name: '📊 Top Event Types',
                    value: eventTypes
                }]);
            }

            await interaction.reply({
                embeds: [embed],
                ephemeral: true
            });

        } catch (error) {
            logger.error('Error getting security stats:', error);
            await interaction.reply({
                content: '❌ Failed to retrieve security statistics.',
                ephemeral: true
            });
        }
    }

    async handleSecurityAlerts(interaction) {
        try {
            const action = interaction.options.getString('action');
            const channelId = interaction.options.getChannel('channel')?.id;

            if (action === 'setup' && channelId) {
                this.botService.securityReporter.setAlertChannel(interaction.guildId, channelId);
                
                await interaction.reply({
                    content: `✅ Security alerts configured for <#${channelId}>`,
                    ephemeral: true
                });
                
                // Log admin action
                await this.botService.auditLogger.logAdminAction(
                    interaction.user.id,
                    'security_alerts_configured',
                    interaction.guildId,
                    { channelId }
                );
                
            } else if (action === 'remove') {
                this.botService.securityReporter.removeAlertChannel(interaction.guildId);
                
                await interaction.reply({
                    content: '✅ Security alerts disabled for this server.',
                    ephemeral: true
                });
                
                // Log admin action
                await this.botService.auditLogger.logAdminAction(
                    interaction.user.id,
                    'security_alerts_disabled',
                    interaction.guildId
                );
                
            } else if (action === 'test') {
                await this.botService.securityReporter.sendSecurityAlert({
                    type: 'test_alert',
                    severity: 'low',
                    description: 'This is a test security alert to verify the alert system is working.',
                    details: {
                        testTime: new Date().toISOString(),
                        triggeredBy: interaction.user.tag
                    }
                }, interaction.guildId);
                
                await interaction.reply({
                    content: '✅ Test security alert sent.',
                    ephemeral: true
                });
                
            } else {
                await interaction.reply({
                    content: '❌ Invalid alert action or missing channel.',
                    ephemeral: true
                });
            }

        } catch (error) {
            logger.error('Error handling security alerts:', error);
            await interaction.reply({
                content: '❌ Failed to configure security alerts.',
                ephemeral: true
            });
        }
    }

    async handleAuditLogs(interaction) {
        try {
            const action = interaction.options.getString('action') || 'recent';
            const userId = interaction.options.getUser('user')?.id;
            const eventType = interaction.options.getString('type');

            const filters = {
                guildId: interaction.guildId
            };

            if (userId) filters.userId = userId;
            if (eventType) filters.type = eventType;

            const logs = this.botService.auditLogger.getAuditLogs(filters, 10);

            if (logs.length === 0) {
                return await interaction.reply({
                    content: '📝 No audit logs found matching the criteria.',
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('📋 Audit Logs')
                .setDescription(`Recent audit logs for ${interaction.guild.name}`)
                .setColor(0x0099ff)
                .setTimestamp();

            logs.slice(0, 5).forEach((log, index) => {
                const timestamp = new Date(log.timestamp).toLocaleString();
                const user = log.userTag || log.userId || 'System';
                const action = log.type.replace(/_/g, ' ').toUpperCase();
                
                embed.addFields([{
                    name: `${index + 1}. ${action}`,
                    value: [
                        `**User:** ${user}`,
                        `**Time:** ${timestamp}`,
                        `**Details:** ${log.reason || log.result || 'N/A'}`
                    ].join('\n'),
                    inline: false
                }]);
            });

            if (logs.length > 5) {
                embed.setFooter({ text: `Showing 5 of ${logs.length} logs` });
            }

            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('audit_export')
                        .setLabel('Export Logs')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('💾'),
                    new ButtonBuilder()
                        .setCustomId('audit_filter')
                        .setLabel('Filter Logs')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🔍')
                );

            await interaction.reply({
                embeds: [embed],
                components: [buttons],
                ephemeral: true
            });

        } catch (error) {
            logger.error('Error retrieving audit logs:', error);
            await interaction.reply({
                content: '❌ Failed to retrieve audit logs.',
                ephemeral: true
            });
        }
    }

    async handlePermissionConfig(interaction) {
        try {
            const action = interaction.options.getString('action');
            const command = interaction.options.getString('command');

            if (action === 'view') {
                const serverPerms = this.botService.permissionManager.getServerPermissions(interaction.guildId);
                
                const embed = new EmbedBuilder()
                    .setTitle('🔐 Permission Configuration')
                    .setDescription(`Permission settings for ${interaction.guild.name}`)
                    .setColor(0x9932cc)
                    .setTimestamp();

                if (Object.keys(serverPerms).length === 0) {
                    embed.addFields([{
                        name: 'Configuration',
                        value: 'Using default permission settings for all commands.'
                    }]);
                } else {
                    // Show configured permissions
                    if (serverPerms.commands) {
                        const commandPerms = Object.entries(serverPerms.commands)
                            .map(([cmd, config]) => `**${cmd}:** Admin Only: ${config.adminOnly ? 'Yes' : 'No'}`)
                            .join('\n');
                        
                        embed.addFields([{
                            name: 'Command Permissions',
                            value: commandPerms || 'No custom command permissions set.'
                        }]);
                    }
                    
                    if (serverPerms.adminRoles) {
                        const roleNames = serverPerms.adminRoles
                            .map(roleId => {
                                const role = interaction.guild.roles.cache.get(roleId);
                                return role ? role.name : roleId;
                            })
                            .join(', ');
                        
                        embed.addFields([{
                            name: 'Admin Roles',
                            value: roleNames || 'No custom admin roles set.'
                        }]);
                    }
                }

                await interaction.reply({
                    embeds: [embed],
                    ephemeral: true
                });

            } else if (action === 'reset') {
                await this.botService.permissionManager.resetServerPermissions(interaction.guildId);
                
                await interaction.reply({
                    content: '✅ Permission configuration reset to defaults.',
                    ephemeral: true
                });
                
                // Log admin action
                await this.botService.auditLogger.logAdminAction(
                    interaction.user.id,
                    'permissions_reset',
                    interaction.guildId
                );
                
            } else {
                await interaction.reply({
                    content: '❌ Invalid permission action.',
                    ephemeral: true
                });
            }

        } catch (error) {
            logger.error('Error handling permission config:', error);
            await interaction.reply({
                content: '❌ Failed to configure permissions.',
                ephemeral: true
            });
        }
    }

    getRiskColor(riskLevel) {
        const colors = {
            low: 0x00ff00,      // Green
            medium: 0xffff00,   // Yellow
            high: 0xff8000,     // Orange
            critical: 0xff0000, // Red
            unknown: 0x808080   // Gray
        };
        
        return colors[riskLevel] || colors.unknown;
    }
}

module.exports = SecurityCommand;