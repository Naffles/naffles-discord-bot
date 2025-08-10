const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const EmbedBuilderService = require('./embedBuilder');

/**
 * Specialized Embed Templates for Different Use Cases
 * Provides pre-configured embed templates for common Discord bot scenarios
 */
class EmbedTemplates extends EmbedBuilderService {
    constructor() {
        super();
    }

    /**
     * Create help embed with command information
     * @param {Object} options - Configuration options
     * @returns {Object} Embed and components
     */
    createHelpEmbed(options = {}) {
        const embed = new EmbedBuilder()
            .setTitle(`${this.emojis.help} Naffles Discord Bot Help`)
            .setDescription('Welcome to the Naffles Discord Bot! Here are all available commands and features.')
            .setColor(this.colors.info)
            .addFields(
                {
                    name: `${this.emojis.task} Task Management`,
                    value: [
                        '`/naffles-create-task` - Create a new social task',
                        '`/naffles-list-tasks` - List active community tasks'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: `${this.emojis.allowlist} Allowlist Management`,
                    value: [
                        '`/naffles-connect-allowlist` - Connect an allowlist to Discord'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: `${this.emojis.community} Community Setup`,
                    value: [
                        '`/naffles-link-community` - Link Discord server to Naffles community',
                        '`/naffles-status` - Check bot connection status'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: `${this.emojis.info} Getting Started`,
                    value: [
                        '1. Link your Discord server to a Naffles community',
                        '2. Create social tasks to engage your members',
                        '3. Connect allowlists for NFT launches',
                        '4. Monitor progress with real-time updates'
                    ].join('\n'),
                    inline: false
                }
            )
            .setFooter({ 
                text: 'Powered by Naffles', 
                iconURL: this.brandAssets.iconUrl 
            })
            .setTimestamp();

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setURL('https://naffles.com/docs/discord-bot')
                    .setLabel('Documentation')
                    .setStyle(ButtonStyle.Link)
                    .setEmoji('📚'),
                new ButtonBuilder()
                    .setURL('https://naffles.com/support')
                    .setLabel('Support')
                    .setStyle(ButtonStyle.Link)
                    .setEmoji('🆘'),
                new ButtonBuilder()
                    .setURL('https://naffles.com')
                    .setLabel('Visit Naffles')
                    .setStyle(ButtonStyle.Link)
                    .setEmoji('🌐')
            );

        return { embeds: [embed], components: [buttons] };
    }

    /**
     * Create status embed showing bot and API connection status
     * @param {Object} statusData - Status information
     * @returns {Object} Embed and components
     */
    createStatusEmbed(statusData) {
        const {
            discordStatus,
            nafflesApiStatus,
            communityLinked,
            communityName,
            serverCount,
            uptime,
            lastHealthCheck
        } = statusData;

        const embed = new EmbedBuilder()
            .setTitle(`${this.emojis.settings} Naffles Bot Status`)
            .setDescription('Current status of the Naffles Discord bot and its connections.')
            .setColor(discordStatus && nafflesApiStatus ? this.colors.success : this.colors.warning)
            .addFields(
                {
                    name: `${this.emojis.discord} Discord Connection`,
                    value: discordStatus ? `${this.emojis.success} Connected` : `${this.emojis.error} Disconnected`,
                    inline: true
                },
                {
                    name: `${this.emojis.link} Naffles API`,
                    value: nafflesApiStatus ? `${this.emojis.success} Connected` : `${this.emojis.error} Disconnected`,
                    inline: true
                },
                {
                    name: `${this.emojis.community} Community Link`,
                    value: communityLinked ? `${this.emojis.success} Linked to ${communityName}` : `${this.emojis.warning} Not Linked`,
                    inline: true
                },
                {
                    name: `${this.emojis.info} Server Count`,
                    value: `${serverCount} servers`,
                    inline: true
                },
                {
                    name: `${this.emojis.time} Uptime`,
                    value: this.formatUptime(uptime),
                    inline: true
                },
                {
                    name: `${this.emojis.status} Last Health Check`,
                    value: `<t:${Math.floor(lastHealthCheck / 1000)}:R>`,
                    inline: true
                }
            )
            .setFooter({ 
                text: 'Powered by Naffles', 
                iconURL: this.brandAssets.iconUrl 
            })
            .setTimestamp();

        const buttons = new ActionRowBuilder();
        
        if (!communityLinked) {
            buttons.addComponents(
                new ButtonBuilder()
                    .setCustomId('link_community_prompt')
                    .setLabel('Link Community')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(this.emojis.link)
            );
        }

        buttons.addComponents(
            new ButtonBuilder()
                .setCustomId('refresh_status')
                .setLabel('Refresh Status')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🔄')
        );

        return { embeds: [embed], components: buttons.components.length > 0 ? [buttons] : [] };
    }

    /**
     * Create community linking embed
     * @param {Object} linkingData - Community linking information
     * @returns {Object} Embed and components
     */
    createCommunityLinkingEmbed(linkingData = {}) {
        const { step = 'start', communityId, error } = linkingData;

        let embed;
        let buttons = new ActionRowBuilder();

        if (step === 'start') {
            embed = new EmbedBuilder()
                .setTitle(`${this.emojis.link} Link Community to Discord`)
                .setDescription([
                    'Connect your Discord server to a Naffles community to enable:',
                    '',
                    `${this.emojis.task} **Social Task Management** - Create and manage tasks directly from Discord`,
                    `${this.emojis.allowlist} **Allowlist Integration** - Post allowlists with interactive buttons`,
                    `${this.emojis.community} **Community Features** - Access community-specific tools and analytics`,
                    '',
                    'To get started, you\'ll need your Naffles community ID from your community settings.'
                ].join('\n'))
                .setColor(this.colors.info)
                .addFields(
                    {
                        name: `${this.emojis.info} How to Find Your Community ID`,
                        value: [
                            '1. Visit [Naffles.com](https://naffles.com)',
                            '2. Go to your community dashboard',
                            '3. Navigate to Settings → Discord Integration',
                            '4. Copy your Community ID'
                        ].join('\n'),
                        inline: false
                    }
                )
                .setFooter({ 
                    text: 'Powered by Naffles', 
                    iconURL: this.brandAssets.iconUrl 
                })
                .setTimestamp();

            buttons.addComponents(
                new ButtonBuilder()
                    .setURL('https://naffles.com/communities')
                    .setLabel('Visit Naffles')
                    .setStyle(ButtonStyle.Link)
                    .setEmoji('🌐'),
                new ButtonBuilder()
                    .setCustomId('start_community_linking')
                    .setLabel('Start Linking')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(this.emojis.link)
            );
        } else if (step === 'success') {
            embed = new EmbedBuilder()
                .setTitle(`${this.emojis.success} Community Successfully Linked!`)
                .setDescription(`Your Discord server has been successfully linked to community: **${communityId}**`)
                .setColor(this.colors.success)
                .addFields(
                    {
                        name: `${this.emojis.task} What's Next?`,
                        value: [
                            '• Use `/naffles-create-task` to create social tasks',
                            '• Use `/naffles-connect-allowlist` to post allowlists',
                            '• Use `/naffles-list-tasks` to manage existing tasks',
                            '• Use `/naffles-help` for more information'
                        ].join('\n'),
                        inline: false
                    }
                )
                .setFooter({ 
                    text: 'Powered by Naffles', 
                    iconURL: this.brandAssets.iconUrl 
                })
                .setTimestamp();

            buttons.addComponents(
                new ButtonBuilder()
                    .setCustomId('create_first_task')
                    .setLabel('Create First Task')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(this.emojis.task),
                new ButtonBuilder()
                    .setURL('https://naffles.com/docs/discord-bot')
                    .setLabel('View Documentation')
                    .setStyle(ButtonStyle.Link)
                    .setEmoji('📚')
            );
        } else if (step === 'error') {
            embed = this.createErrorEmbed(
                error || 'Failed to link community',
                {
                    troubleshooting: [
                        '• Verify your community ID is correct',
                        '• Ensure you have admin permissions in the community',
                        '• Check that the community exists and is active',
                        '• Try again in a few moments'
                    ].join('\n')
                }
            );

            buttons.addComponents(
                new ButtonBuilder()
                    .setCustomId('retry_community_linking')
                    .setLabel('Try Again')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔄'),
                new ButtonBuilder()
                    .setURL('https://naffles.com/support')
                    .setLabel('Get Support')
                    .setStyle(ButtonStyle.Link)
                    .setEmoji('🆘')
            );
        }

        return { embeds: [embed], components: [buttons] };
    }

    /**
     * Create task list embed with pagination
     * @param {Array} tasks - List of tasks
     * @param {Object} paginationData - Pagination information
     * @returns {Object} Embed and components
     */
    createTaskListEmbed(tasks, paginationData = {}) {
        const { currentPage = 1, totalPages = 1, totalTasks = 0 } = paginationData;

        const embed = new EmbedBuilder()
            .setTitle(`${this.emojis.task} Community Tasks`)
            .setDescription(totalTasks > 0 ? 
                `Showing ${tasks.length} of ${totalTasks} tasks (Page ${currentPage}/${totalPages})` :
                'No tasks found for this community.'
            )
            .setColor(this.colors.primary)
            .setFooter({ 
                text: 'Powered by Naffles', 
                iconURL: this.brandAssets.iconUrl 
            })
            .setTimestamp();

        // Add task fields
        if (tasks.length > 0) {
            tasks.forEach((task, index) => {
                const taskNumber = (currentPage - 1) * 5 + index + 1;
                embed.addFields({
                    name: `${taskNumber}. ${task.title}`,
                    value: [
                        `**Type:** ${this.formatTaskType(task.type)}`,
                        `**Reward:** ${task.points} points`,
                        `**Status:** ${this.formatStatus(task.status)}`,
                        `**Completed:** ${task.completedBy || 0} users`
                    ].join('\n'),
                    inline: false
                });
            });
        } else {
            embed.addFields({
                name: `${this.emojis.info} No Tasks Found`,
                value: 'Use `/naffles-create-task` to create your first social task!',
                inline: false
            });
        }

        const components = [];

        // Add pagination if needed
        if (totalPages > 1) {
            components.push(this.createPaginationControls({
                currentPage,
                totalPages,
                customId: 'task_list_page'
            }));
        }

        // Add action buttons
        const actionButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('create_new_task')
                    .setLabel('Create Task')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(this.emojis.task),
                new ButtonBuilder()
                    .setCustomId('refresh_task_list')
                    .setLabel('Refresh')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔄')
            );

        components.push(actionButtons);

        return { embeds: [embed], components };
    }

    /**
     * Create allowlist connection embed
     * @param {Object} allowlistData - Allowlist information
     * @param {string} step - Current step in the process
     * @returns {Object} Embed and components
     */
    createAllowlistConnectionEmbed(allowlistData, step = 'start') {
        let embed;
        let buttons = new ActionRowBuilder();

        if (step === 'start') {
            embed = new EmbedBuilder()
                .setTitle(`${this.emojis.allowlist} Connect Allowlist to Discord`)
                .setDescription([
                    'Connect an existing Naffles allowlist to this Discord server.',
                    '',
                    'This will create an interactive post that allows members to:',
                    `${this.emojis.allowlist} Enter the allowlist directly from Discord`,
                    `${this.emojis.info} View detailed allowlist information`,
                    `${this.emojis.countdown} See real-time countdown and updates`,
                    '',
                    'You\'ll need the Allowlist ID from your Naffles dashboard.'
                ].join('\n'))
                .setColor(this.colors.success)
                .setFooter({ 
                    text: 'Powered by Naffles', 
                    iconURL: this.brandAssets.iconUrl 
                })
                .setTimestamp();

            buttons.addComponents(
                new ButtonBuilder()
                    .setURL('https://naffles.com/allowlists')
                    .setLabel('View Allowlists')
                    .setStyle(ButtonStyle.Link)
                    .setEmoji('🌐'),
                new ButtonBuilder()
                    .setCustomId('start_allowlist_connection')
                    .setLabel('Connect Allowlist')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(this.emojis.allowlist)
            );
        } else if (step === 'preview') {
            embed = this.createAllowlistEmbed(allowlistData, { preview: true });
            embed.setTitle(`${this.emojis.allowlist} Allowlist Preview`);
            embed.setDescription(`Preview of how the allowlist will appear in Discord:\n\n${allowlistData.description}`);

            buttons.addComponents(
                new ButtonBuilder()
                    .setCustomId(`confirm_allowlist_connection_${allowlistData.id}`)
                    .setLabel('Confirm & Post')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji(this.emojis.success),
                new ButtonBuilder()
                    .setCustomId('cancel_allowlist_connection')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(this.emojis.error)
            );
        } else if (step === 'success') {
            embed = new EmbedBuilder()
                .setTitle(`${this.emojis.success} Allowlist Connected Successfully!`)
                .setDescription(`The allowlist "${allowlistData.title}" has been posted to this channel with interactive buttons.`)
                .setColor(this.colors.success)
                .addFields({
                    name: `${this.emojis.info} What Happens Next?`,
                    value: [
                        '• Members can enter the allowlist using the button below the post',
                        '• The post will update automatically with real-time information',
                        '• You can monitor entries from your Naffles dashboard'
                    ].join('\n'),
                    inline: false
                })
                .setFooter({ 
                    text: 'Powered by Naffles', 
                    iconURL: this.brandAssets.iconUrl 
                })
                .setTimestamp();

            buttons.addComponents(
                new ButtonBuilder()
                    .setURL(`https://naffles.com/allowlist/${allowlistData.id}`)
                    .setLabel('View on Naffles')
                    .setStyle(ButtonStyle.Link)
                    .setEmoji('🌐'),
                new ButtonBuilder()
                    .setCustomId('connect_another_allowlist')
                    .setLabel('Connect Another')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(this.emojis.allowlist)
            );
        }

        return { embeds: [embed], components: [buttons] };
    }

    /**
     * Create account linking embed
     * @param {Object} linkingData - Account linking information
     * @returns {Object} Embed and components
     */
    createAccountLinkingEmbed(linkingData = {}) {
        const { step = 'start', oauthUrl, error, username } = linkingData;

        let embed;
        let buttons = new ActionRowBuilder();

        if (step === 'start') {
            embed = new EmbedBuilder()
                .setTitle(`${this.emojis.link} Link Your Naffles Account`)
                .setDescription([
                    'Link your Discord account to your Naffles account to:',
                    '',
                    `${this.emojis.task} **Complete Social Tasks** - Automatically verify task completion`,
                    `${this.emojis.allowlist} **Enter Allowlists** - Seamlessly enter allowlists from Discord`,
                    `${this.emojis.reward} **Earn Rewards** - Receive points and rewards directly`,
                    `${this.emojis.community} **Access Features** - Unlock community-specific features`,
                    '',
                    'Click the button below to securely link your accounts via OAuth.'
                ].join('\n'))
                .setColor(this.colors.info)
                .setFooter({ 
                    text: 'Powered by Naffles', 
                    iconURL: this.brandAssets.iconUrl 
                })
                .setTimestamp();

            if (oauthUrl) {
                buttons.addComponents(
                    new ButtonBuilder()
                        .setURL(oauthUrl)
                        .setLabel('Link Account')
                        .setStyle(ButtonStyle.Link)
                        .setEmoji(this.emojis.link)
                );
            }
        } else if (step === 'success') {
            embed = new EmbedBuilder()
                .setTitle(`${this.emojis.success} Account Successfully Linked!`)
                .setDescription(`Your Discord account has been linked to Naffles account: **${username}**`)
                .setColor(this.colors.success)
                .addFields({
                    name: `${this.emojis.info} You Can Now:`,
                    value: [
                        '• Complete social tasks directly from Discord',
                        '• Enter allowlists with one click',
                        '• Receive automatic reward notifications',
                        '• Access all community features'
                    ].join('\n'),
                    inline: false
                })
                .setFooter({ 
                    text: 'Powered by Naffles', 
                    iconURL: this.brandAssets.iconUrl 
                })
                .setTimestamp();
        } else if (step === 'error') {
            embed = this.createErrorEmbed(
                error || 'Failed to link account',
                {
                    troubleshooting: [
                        '• Ensure you have a Naffles account',
                        '• Check that you completed the OAuth process',
                        '• Try clearing your browser cache and cookies',
                        '• Contact support if the issue persists'
                    ].join('\n')
                }
            );

            buttons.addComponents(
                new ButtonBuilder()
                    .setCustomId('retry_account_linking')
                    .setLabel('Try Again')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔄')
            );
        }

        return { embeds: [embed], components: buttons.components.length > 0 ? [buttons] : [] };
    }

    /**
     * Format uptime in human-readable format
     * @private
     */
    formatUptime(uptimeMs) {
        const seconds = Math.floor(uptimeMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days}d ${hours % 24}h ${minutes % 60}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }
}

module.exports = EmbedTemplates;