const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const logger = require('../utils/logger');

// Slash command data for Discord registration
const data = new SlashCommandBuilder()
    .setName('naffles-help')
    .setDescription('Get help with Naffles Discord bot commands and setup');

class HelpCommand {
    constructor(botService) {
        this.botService = botService;
        this.name = 'naffles-help';
    }

    async execute(interaction) {
        try {
            // Check if server is linked to determine which help to show
            const serverStatus = await this.botService.communityLinking.getServerCommunityStatus(interaction.guildId);

            const embed = new EmbedBuilder()
                .setTitle('🤖 Naffles Discord Bot Help')
                .setDescription('Welcome to the Naffles Discord bot! Here\'s everything you need to know.')
                .setColor(0x7C3AED) // Purple
                .setThumbnail('https://naffles.com/logo.png')
                .setTimestamp();

            if (serverStatus.isLinked) {
                // Server is linked - show full command help
                embed.addFields(
                    {
                        name: '✅ Server Status',
                        value: `This server is linked to **${serverStatus.community?.name || 'your community'}**`,
                        inline: false
                    },
                    {
                        name: '📋 Available Commands',
                        value: this.getLinkedServerCommands(),
                        inline: false
                    },
                    {
                        name: '🎯 Social Tasks',
                        value: 'Create Twitter follows, Discord joins, Telegram joins, and custom tasks with point rewards.',
                        inline: true
                    },
                    {
                        name: '🎫 Allowlists',
                        value: 'Connect existing Naffles allowlists to your Discord server for easy entry.',
                        inline: true
                    },
                    {
                        name: '📊 Management',
                        value: 'Check status, test connections, and manage your community integration.',
                        inline: true
                    }
                );
            } else {
                // Server is not linked - show setup help
                embed.addFields(
                    {
                        name: '⚠️ Server Status',
                        value: 'This server is not linked to a Naffles community yet.',
                        inline: false
                    },
                    {
                        name: '🚀 Getting Started',
                        value: this.getSetupInstructions(),
                        inline: false
                    },
                    {
                        name: '📋 Basic Commands',
                        value: this.getBasicCommands(),
                        inline: false
                    }
                );
            }

            // Create action buttons and select menu
            const actionRow1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('help_commands')
                        .setLabel('Command Details')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📋'),
                    new ButtonBuilder()
                        .setCustomId('help_setup')
                        .setLabel('Setup Guide')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔧'),
                    new ButtonBuilder()
                        .setURL('https://naffles.com/discord-docs')
                        .setLabel('Documentation')
                        .setStyle(ButtonStyle.Link)
                        .setEmoji('📚')
                );

            const selectMenu = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('help_topic')
                        .setPlaceholder('Choose a help topic...')
                        .addOptions([
                            {
                                label: 'Community Linking',
                                description: 'How to link your Discord server to Naffles',
                                value: 'linking',
                                emoji: '🔗'
                            },
                            {
                                label: 'Social Tasks',
                                description: 'Creating and managing social tasks',
                                value: 'tasks',
                                emoji: '🎯'
                            },
                            {
                                label: 'Allowlists',
                                description: 'Connecting and managing allowlists',
                                value: 'allowlists',
                                emoji: '🎫'
                            },
                            {
                                label: 'Permissions',
                                description: 'Required Discord permissions',
                                value: 'permissions',
                                emoji: '🔐'
                            },
                            {
                                label: 'Troubleshooting',
                                description: 'Common issues and solutions',
                                value: 'troubleshooting',
                                emoji: '🔧'
                            }
                        ])
                );

            await interaction.reply({
                embeds: [embed],
                components: [actionRow1, selectMenu],
                ephemeral: true
            });

            // Log interaction
            await this.botService.logInteraction(interaction, 'help_requested', 'success');

        } catch (error) {
            logger.error('Error in help command:', error);
            
            const errorMessage = '❌ An error occurred while loading help. Please try again later.';
            
            if (!interaction.replied) {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }

            await this.botService.logInteraction(interaction, 'help_requested', 'error');
        }
    }

    async handleButtonInteraction(interaction) {
        try {
            const action = interaction.customId;

            if (action === 'help_commands') {
                await this.showCommandDetails(interaction);
            } else if (action === 'help_setup') {
                await this.showSetupGuide(interaction);
            }

        } catch (error) {
            logger.error('Error handling help button interaction:', error);
            await interaction.reply({
                content: '❌ An error occurred. Please try again.',
                ephemeral: true
            });
        }
    }

    async handleSelectMenuInteraction(interaction) {
        try {
            const topic = interaction.values[0];

            switch (topic) {
                case 'linking':
                    await this.showLinkingHelp(interaction);
                    break;
                case 'tasks':
                    await this.showTasksHelp(interaction);
                    break;
                case 'allowlists':
                    await this.showAllowlistsHelp(interaction);
                    break;
                case 'permissions':
                    await this.showPermissionsHelp(interaction);
                    break;
                case 'troubleshooting':
                    await this.showTroubleshootingHelp(interaction);
                    break;
                default:
                    await interaction.reply({
                        content: 'Unknown help topic selected.',
                        ephemeral: true
                    });
            }

        } catch (error) {
            logger.error('Error handling help select menu:', error);
            await interaction.reply({
                content: '❌ An error occurred. Please try again.',
                ephemeral: true
            });
        }
    }

    async showCommandDetails(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('📋 Command Details')
            .setDescription('Detailed information about all Naffles Discord bot commands.')
            .setColor(0x3B82F6) // Blue
            .addFields(
                {
                    name: '🔗 `/naffles-link-community`',
                    value: '**Purpose:** Link this Discord server to your Naffles community\n**Usage:** `/naffles-link-community community_id:YOUR_ID`\n**Permissions:** Manage Server',
                    inline: false
                },
                {
                    name: '🎯 `/naffles-create-task`',
                    value: '**Purpose:** Create social tasks for your community\n**Usage:** `/naffles-create-task type:twitter_follow title:"Follow Us" ...`\n**Permissions:** Manage Server (or configured roles)',
                    inline: false
                },
                {
                    name: '📋 `/naffles-list-tasks`',
                    value: '**Purpose:** List active social tasks\n**Usage:** `/naffles-list-tasks status:active`\n**Permissions:** Everyone',
                    inline: false
                },
                {
                    name: '🎫 `/naffles-connect-allowlist`',
                    value: '**Purpose:** Connect existing allowlists to Discord\n**Usage:** `/naffles-connect-allowlist allowlist_id:YOUR_ID`\n**Permissions:** Manage Server',
                    inline: false
                },
                {
                    name: '📊 `/naffles-status`',
                    value: '**Purpose:** Check bot and community connection status\n**Usage:** `/naffles-status`\n**Permissions:** Everyone',
                    inline: false
                },
                {
                    name: '❓ `/naffles-help`',
                    value: '**Purpose:** Show this help information\n**Usage:** `/naffles-help`\n**Permissions:** Everyone',
                    inline: false
                }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    async showSetupGuide(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🔧 Setup Guide')
            .setDescription('Step-by-step guide to set up the Naffles Discord bot.')
            .setColor(0x10B981) // Green
            .addFields(
                {
                    name: '1️⃣ Prerequisites',
                    value: '• Have a Naffles community (create at naffles.com)\n• Have "Manage Server" permission in Discord\n• Be the owner of the Naffles community',
                    inline: false
                },
                {
                    name: '2️⃣ Find Your Community ID',
                    value: '• Go to your Naffles community dashboard\n• Navigate to Settings → General\n• Copy your Community ID',
                    inline: false
                },
                {
                    name: '3️⃣ Link Your Server',
                    value: '• Run `/naffles-link-community` in Discord\n• Paste your Community ID\n• Follow the authentication process',
                    inline: false
                },
                {
                    name: '4️⃣ Configure Permissions',
                    value: '• Set which Discord roles can create tasks\n• Configure default channels for posts\n• Test the connection with `/naffles-status`',
                    inline: false
                },
                {
                    name: '5️⃣ Start Creating Content',
                    value: '• Use `/naffles-create-task` for social tasks\n• Use `/naffles-connect-allowlist` for allowlists\n• Monitor activity in your community dashboard',
                    inline: false
                }
            )
            .setFooter({ text: 'Need more help? Visit our documentation or contact support.' })
            .setTimestamp();

        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setURL('https://naffles.com/discord-setup')
                    .setLabel('Detailed Setup Guide')
                    .setStyle(ButtonStyle.Link)
                    .setEmoji('📖'),
                new ButtonBuilder()
                    .setURL('https://naffles.com/support')
                    .setLabel('Get Support')
                    .setStyle(ButtonStyle.Link)
                    .setEmoji('💬')
            );

        await interaction.reply({ embeds: [embed], components: [actionRow], ephemeral: true });
    }

    async showLinkingHelp(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🔗 Community Linking Help')
            .setDescription('Everything you need to know about linking your Discord server to Naffles.')
            .setColor(0xF59E0B) // Orange
            .addFields(
                {
                    name: '🎯 What is Community Linking?',
                    value: 'Community linking connects your Discord server to your Naffles community, enabling social tasks and allowlist management directly from Discord.',
                    inline: false
                },
                {
                    name: '📋 Requirements',
                    value: '• Own a Naffles community\n• Have "Manage Server" permission in Discord\n• One-to-one relationship (one server per community)',
                    inline: false
                },
                {
                    name: '🔧 How to Link',
                    value: '1. Get your Community ID from Naffles dashboard\n2. Run `/naffles-link-community community_id:YOUR_ID`\n3. Complete OAuth authentication if prompted\n4. Verify with `/naffles-status`',
                    inline: false
                },
                {
                    name: '❓ Common Issues',
                    value: '• **Community not found:** Check your Community ID\n• **Permission denied:** Ensure you own the community\n• **Already linked:** Each community can only link to one server',
                    inline: false
                }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    async showTasksHelp(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🎯 Social Tasks Help')
            .setDescription('Learn how to create and manage social tasks for your community.')
            .setColor(0x8B5CF6) // Purple
            .addFields(
                {
                    name: '📝 Task Types',
                    value: '• **Twitter Follow:** Users follow a Twitter account\n• **Discord Join:** Users join a Discord server\n• **Telegram Join:** Users join a Telegram group\n• **Custom Task:** Any custom action you define',
                    inline: false
                },
                {
                    name: '🎮 Creating Tasks',
                    value: '1. Run `/naffles-create-task`\n2. Choose task type and fill in details\n3. Set point rewards and duration\n4. Task is automatically posted to Discord',
                    inline: false
                },
                {
                    name: '⚙️ Task Settings',
                    value: '• **Points:** 1-10,000 points reward\n• **Duration:** 1 hour to 1 year\n• **Verification:** Automatic for social platforms\n• **Manual Review:** Available for custom tasks',
                    inline: false
                },
                {
                    name: '📊 Task Management',
                    value: '• View active tasks with `/naffles-list-tasks`\n• Tasks automatically expire after duration\n• Completed tasks award points to user accounts\n• Track completion in community dashboard',
                    inline: false
                }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    async showAllowlistsHelp(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🎫 Allowlists Help')
            .setDescription('Connect your Naffles allowlists to Discord for easy community access.')
            .setColor(0xEC4899) // Pink
            .addFields(
                {
                    name: '🎯 What are Allowlists?',
                    value: 'Allowlists are exclusive entry lists for NFT projects, events, or opportunities. Users can enter directly from Discord.',
                    inline: false
                },
                {
                    name: '🔗 Connecting Allowlists',
                    value: '1. Create an allowlist on Naffles.com\n2. Copy the Allowlist ID\n3. Run `/naffles-connect-allowlist allowlist_id:YOUR_ID`\n4. Allowlist is posted to Discord with entry button',
                    inline: false
                },
                {
                    name: '✨ Features',
                    value: '• **Direct Entry:** Users click button to enter\n• **Real-time Updates:** Entry count updates live\n• **Requirements Check:** Automatic verification\n• **Winner Selection:** VRF-based fair selection',
                    inline: false
                },
                {
                    name: '⚡ Entry Process',
                    value: '• Users click "Enter Allowlist" button\n• Bot checks entry requirements\n• Account linking handled automatically\n• Entry confirmed with feedback message',
                    inline: false
                }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    async showPermissionsHelp(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🔐 Permissions Help')
            .setDescription('Understanding Discord permissions required for the Naffles bot.')
            .setColor(0xEF4444) // Red
            .addFields(
                {
                    name: '🤖 Bot Permissions',
                    value: '• **Send Messages:** Post tasks and allowlists\n• **Embed Links:** Rich embed formatting\n• **Use Slash Commands:** Command functionality\n• **Manage Messages:** Update task status\n• **Add Reactions:** Interactive buttons',
                    inline: false
                },
                {
                    name: '👤 User Permissions',
                    value: '• **Manage Server:** Required for linking communities\n• **Manage Server:** Required for creating tasks (default)\n• **Everyone:** Can view tasks and enter allowlists\n• **Custom Roles:** Can be configured per server',
                    inline: false
                },
                {
                    name: '⚙️ Permission Configuration',
                    value: '• Default: Only "Manage Server" users can create tasks\n• Customizable: Set specific roles for task creation\n• Flexible: Different permissions for different commands\n• Secure: Community linking always requires "Manage Server"',
                    inline: false
                },
                {
                    name: '🔧 Troubleshooting',
                    value: '• **Bot not responding:** Check bot permissions\n• **Commands not working:** Verify slash command permissions\n• **Can\'t create tasks:** Check "Manage Server" permission\n• **Missing embeds:** Verify "Embed Links" permission',
                    inline: false
                }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    async showTroubleshootingHelp(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🔧 Troubleshooting Help')
            .setDescription('Solutions to common issues with the Naffles Discord bot.')
            .setColor(0x6B7280) // Gray
            .addFields(
                {
                    name: '❌ Bot Not Responding',
                    value: '• Check if bot is online (green status)\n• Verify bot has required permissions\n• Try `/naffles-status` to check connection\n• Restart Discord client if needed',
                    inline: false
                },
                {
                    name: '🔗 Community Linking Issues',
                    value: '• **Community not found:** Double-check Community ID\n• **Permission denied:** Ensure you own the community\n• **Already linked:** Each community can only link once\n• **OAuth failed:** Try again or contact support',
                    inline: false
                },
                {
                    name: '🎯 Task Creation Problems',
                    value: '• **Permission denied:** Need "Manage Server" permission\n• **Server not linked:** Link community first\n• **Invalid parameters:** Check task type and settings\n• **API error:** Try again in a few minutes',
                    inline: false
                },
                {
                    name: '🎫 Allowlist Connection Issues',
                    value: '• **Allowlist not found:** Verify Allowlist ID\n• **Already connected:** Each allowlist can only connect once\n• **Entry failed:** Check user account linking\n• **Requirements not met:** Verify entry requirements',
                    inline: false
                },
                {
                    name: '🆘 Getting More Help',
                    value: '• Use `/naffles-status` for diagnostic information\n• Check our documentation for detailed guides\n• Contact support with specific error messages\n• Join our Discord for community help',
                    inline: false
                }
            )
            .setTimestamp();

        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setURL('https://naffles.com/support')
                    .setLabel('Contact Support')
                    .setStyle(ButtonStyle.Link)
                    .setEmoji('💬'),
                new ButtonBuilder()
                    .setURL('https://discord.gg/naffles')
                    .setLabel('Join Our Discord')
                    .setStyle(ButtonStyle.Link)
                    .setEmoji('💬')
            );

        await interaction.reply({ embeds: [embed], components: [actionRow], ephemeral: true });
    }

    getLinkedServerCommands() {
        return `• \`/naffles-create-task\` - Create social tasks
• \`/naffles-list-tasks\` - View active tasks  
• \`/naffles-connect-allowlist\` - Connect allowlists
• \`/naffles-status\` - Check connection status
• \`/naffles-help\` - Show this help`;
    }

    getBasicCommands() {
        return `• \`/naffles-link-community\` - Link your community
• \`/naffles-status\` - Check bot status
• \`/naffles-help\` - Show this help`;
    }

    getSetupInstructions() {
        return `1. **Get Community ID** - Find it in your Naffles community settings
2. **Link Server** - Use \`/naffles-link-community\` with your ID
3. **Verify Connection** - Check with \`/naffles-status\`
4. **Start Creating** - Use \`/naffles-create-task\` and other commands`;
    }
}

// Export both the command class and the slash command data
module.exports = HelpCommand;
module.exports.data = data;