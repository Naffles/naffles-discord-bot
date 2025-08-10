const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const logger = require('../utils/logger');

/**
 * Rich Embed Builder Service for Discord Posts
 * Provides comprehensive embed templates with Naffles branding and consistent styling
 */
class EmbedBuilderService {
    constructor() {
        // Naffles brand colors
        this.colors = {
            primary: 0x3B82F6,      // Naffles blue
            success: 0x10B981,      // Green
            warning: 0xF59E0B,      // Amber
            error: 0xEF4444,        // Red
            info: 0x6366F1,         // Indigo
            purple: 0x7C3AED,       // Purple
            gray: 0x6B7280          // Gray
        };

        // Brand assets
        this.brandAssets = {
            logoUrl: 'https://naffles.com/logo.png',
            iconUrl: 'https://naffles.com/icon.png',
            bannerUrl: 'https://naffles.com/banner.png'
        };

        // Emoji mappings for consistent styling
        this.emojis = {
            task: '🎯',
            allowlist: '🎫',
            reward: '💰',
            time: '⏰',
            status: '📊',
            type: '🏷️',
            completed: '✅',
            prize: '🏆',
            participants: '👥',
            entry: '🎪',
            countdown: '⏳',
            success: '🎉',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️',
            loading: '⏳',
            twitter: '🐦',
            discord: '💬',
            telegram: '📱',
            custom: '🔧',
            nft: '🖼️',
            crypto: '💎',
            community: '🏘️',
            user: '👤',
            link: '🔗',
            settings: '⚙️',
            help: '❓',
            navigation: '🧭'
        };
    }

    /**
     * Create a task embed with dynamic content rendering
     * @param {Object} taskData - Task information
     * @param {Object} options - Additional options for customization
     * @returns {EmbedBuilder} Discord embed
     */
    createTaskEmbed(taskData, options = {}) {
        try {
            const embed = new EmbedBuilder()
                .setTitle(`${this.emojis.task} ${taskData.title}`)
                .setDescription(this.formatDescription(taskData.description, options.maxLength || 500))
                .setColor(this.colors.primary)
                .setFooter({ 
                    text: 'Powered by Naffles', 
                    iconURL: this.brandAssets.iconUrl 
                })
                .setTimestamp();

            // Add task-specific fields
            this.addTaskFields(embed, taskData);

            // Add thumbnail if provided
            if (taskData.thumbnailUrl || options.thumbnailUrl) {
                embed.setThumbnail(taskData.thumbnailUrl || options.thumbnailUrl);
            }

            // Add author if provided
            if (taskData.author) {
                embed.setAuthor({
                    name: taskData.author.name,
                    iconURL: taskData.author.iconURL,
                    url: taskData.author.url
                });
            }

            return embed;
        } catch (error) {
            logger.error('Error creating task embed:', error);
            return this.createErrorEmbed('Failed to create task embed');
        }
    }

    /**
     * Create an allowlist embed with comprehensive information display
     * @param {Object} allowlistData - Allowlist information
     * @param {Object} options - Additional options for customization
     * @returns {EmbedBuilder} Discord embed
     */
    createAllowlistEmbed(allowlistData, options = {}) {
        try {
            const embed = new EmbedBuilder()
                .setTitle(`${this.emojis.allowlist} ${allowlistData.title}`)
                .setDescription(this.formatDescription(allowlistData.description, options.maxLength || 500))
                .setColor(this.colors.success)
                .setFooter({ 
                    text: 'Powered by Naffles', 
                    iconURL: this.brandAssets.iconUrl 
                })
                .setTimestamp();

            // Add allowlist-specific fields
            this.addAllowlistFields(embed, allowlistData);

            // Add prize image if available
            if (allowlistData.prizeImageUrl) {
                embed.setImage(allowlistData.prizeImageUrl);
            }

            // Add thumbnail
            if (allowlistData.thumbnailUrl || options.thumbnailUrl) {
                embed.setThumbnail(allowlistData.thumbnailUrl || options.thumbnailUrl);
            }

            // Add countdown timer if end time is provided
            if (allowlistData.endTime) {
                this.addCountdownField(embed, allowlistData.endTime);
            }

            return embed;
        } catch (error) {
            logger.error('Error creating allowlist embed:', error);
            return this.createErrorEmbed('Failed to create allowlist embed');
        }
    }

    /**
     * Create interactive button components for task completion and allowlist entry
     * @param {string} type - Type of buttons ('task' or 'allowlist')
     * @param {Object} data - Data for button configuration
     * @param {Object} options - Additional options
     * @returns {ActionRowBuilder} Action row with buttons
     */
    createActionButtons(type, data, options = {}) {
        try {
            const row = new ActionRowBuilder();

            if (type === 'task') {
                this.addTaskButtons(row, data, options);
            } else if (type === 'allowlist') {
                this.addAllowlistButtons(row, data, options);
            } else if (type === 'navigation') {
                this.addNavigationButtons(row, data, options);
            }

            return row;
        } catch (error) {
            logger.error('Error creating action buttons:', error);
            return new ActionRowBuilder(); // Return empty row on error
        }
    }

    /**
     * Create pagination controls for long content lists
     * @param {Object} paginationData - Pagination information
     * @returns {ActionRowBuilder} Action row with pagination buttons
     */
    createPaginationControls(paginationData) {
        try {
            const row = new ActionRowBuilder();
            const { currentPage, totalPages, customId } = paginationData;

            // Previous button
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${customId}_prev_${currentPage - 1}`)
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⬅️')
                    .setDisabled(currentPage <= 1)
            );

            // Page indicator
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${customId}_page_info`)
                    .setLabel(`${currentPage} / ${totalPages}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );

            // Next button
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${customId}_next_${currentPage + 1}`)
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('➡️')
                    .setDisabled(currentPage >= totalPages)
            );

            return row;
        } catch (error) {
            logger.error('Error creating pagination controls:', error);
            return new ActionRowBuilder();
        }
    }

    /**
     * Create success embed template with user-friendly messaging
     * @param {string} title - Success title
     * @param {string} message - Success message
     * @param {Object} options - Additional options
     * @returns {EmbedBuilder} Success embed
     */
    createSuccessEmbed(title, message, options = {}) {
        const embed = new EmbedBuilder()
            .setTitle(`${this.emojis.success} ${title}`)
            .setDescription(message)
            .setColor(this.colors.success)
            .setFooter({ 
                text: 'Powered by Naffles', 
                iconURL: this.brandAssets.iconUrl 
            })
            .setTimestamp();

        if (options.fields) {
            embed.addFields(options.fields);
        }

        if (options.thumbnailUrl) {
            embed.setThumbnail(options.thumbnailUrl);
        }

        return embed;
    }

    /**
     * Create error embed template with troubleshooting guidance
     * @param {string} message - Error message
     * @param {Object} options - Additional options including troubleshooting steps
     * @returns {EmbedBuilder} Error embed
     */
    createErrorEmbed(message, options = {}) {
        const embed = new EmbedBuilder()
            .setTitle(`${this.emojis.error} Error`)
            .setDescription(message)
            .setColor(this.colors.error)
            .setFooter({ 
                text: 'Powered by Naffles', 
                iconURL: this.brandAssets.iconUrl 
            })
            .setTimestamp();

        // Add troubleshooting guidance if provided
        if (options.troubleshooting) {
            embed.addFields({
                name: `${this.emojis.help} Troubleshooting`,
                value: options.troubleshooting,
                inline: false
            });
        }

        // Add support information
        if (options.showSupport !== false) {
            embed.addFields({
                name: `${this.emojis.info} Need Help?`,
                value: 'Contact support or visit our documentation for assistance.',
                inline: false
            });
        }

        return embed;
    }

    /**
     * Create warning embed template
     * @param {string} title - Warning title
     * @param {string} message - Warning message
     * @param {Object} options - Additional options
     * @returns {EmbedBuilder} Warning embed
     */
    createWarningEmbed(title, message, options = {}) {
        const embed = new EmbedBuilder()
            .setTitle(`${this.emojis.warning} ${title}`)
            .setDescription(message)
            .setColor(this.colors.warning)
            .setFooter({ 
                text: 'Powered by Naffles', 
                iconURL: this.brandAssets.iconUrl 
            })
            .setTimestamp();

        if (options.fields) {
            embed.addFields(options.fields);
        }

        return embed;
    }

    /**
     * Create info embed template
     * @param {string} title - Info title
     * @param {string} message - Info message
     * @param {Object} options - Additional options
     * @returns {EmbedBuilder} Info embed
     */
    createInfoEmbed(title, message, options = {}) {
        const embed = new EmbedBuilder()
            .setTitle(`${this.emojis.info} ${title}`)
            .setDescription(message)
            .setColor(this.colors.info)
            .setFooter({ 
                text: 'Powered by Naffles', 
                iconURL: this.brandAssets.iconUrl 
            })
            .setTimestamp();

        if (options.fields) {
            embed.addFields(options.fields);
        }

        if (options.thumbnailUrl) {
            embed.setThumbnail(options.thumbnailUrl);
        }

        return embed;
    }

    /**
     * Create loading embed template
     * @param {string} message - Loading message
     * @returns {EmbedBuilder} Loading embed
     */
    createLoadingEmbed(message = 'Processing...') {
        return new EmbedBuilder()
            .setTitle(`${this.emojis.loading} Loading`)
            .setDescription(message)
            .setColor(this.colors.info)
            .setFooter({ 
                text: 'Powered by Naffles', 
                iconURL: this.brandAssets.iconUrl 
            })
            .setTimestamp();
    }

    /**
     * Update embed with real-time status changes
     * @param {EmbedBuilder} embed - Existing embed to update
     * @param {Object} updateData - Data for updates
     * @returns {EmbedBuilder} Updated embed
     */
    updateEmbedStatus(embed, updateData) {
        try {
            // Update timestamp
            embed.setTimestamp();

            // Update status field if provided
            if (updateData.status) {
                const statusField = embed.data.fields?.find(field => field.name.includes('Status'));
                if (statusField) {
                    statusField.value = `${this.emojis.status} ${updateData.status}`;
                } else {
                    embed.addFields({
                        name: `${this.emojis.status} Status`,
                        value: updateData.status,
                        inline: true
                    });
                }
            }

            // Update progress if provided
            if (updateData.progress !== undefined) {
                this.updateProgressField(embed, updateData.progress);
            }

            // Update participant count if provided
            if (updateData.participants !== undefined) {
                this.updateParticipantField(embed, updateData.participants);
            }

            // Update countdown if provided
            if (updateData.endTime) {
                this.updateCountdownField(embed, updateData.endTime);
            }

            return embed;
        } catch (error) {
            logger.error('Error updating embed status:', error);
            return embed;
        }
    }

    /**
     * Create select menu for navigation or options
     * @param {string} customId - Custom ID for the select menu
     * @param {Array} options - Menu options
     * @param {Object} config - Menu configuration
     * @returns {ActionRowBuilder} Action row with select menu
     */
    createSelectMenu(customId, options, config = {}) {
        try {
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(customId)
                .setPlaceholder(config.placeholder || 'Select an option...')
                .setMinValues(config.minValues || 1)
                .setMaxValues(config.maxValues || 1);

            // Add options
            const menuOptions = options.map(option => ({
                label: option.label,
                description: option.description || null,
                value: option.value,
                emoji: option.emoji || null,
                default: option.default || false
            }));

            selectMenu.addOptions(menuOptions);

            return new ActionRowBuilder().addComponents(selectMenu);
        } catch (error) {
            logger.error('Error creating select menu:', error);
            return new ActionRowBuilder();
        }
    }

    // Private helper methods

    /**
     * Add task-specific fields to embed
     * @private
     */
    addTaskFields(embed, taskData) {
        // Reward field
        if (taskData.points !== undefined) {
            embed.addFields({
                name: `${this.emojis.reward} Reward`,
                value: `${taskData.points} points`,
                inline: true
            });
        }

        // Duration field
        if (taskData.duration) {
            embed.addFields({
                name: `${this.emojis.time} Duration`,
                value: this.formatDuration(taskData.duration),
                inline: true
            });
        }

        // Status field
        if (taskData.status) {
            embed.addFields({
                name: `${this.emojis.status} Status`,
                value: this.formatStatus(taskData.status),
                inline: true
            });
        }

        // Task type field
        if (taskData.type) {
            embed.addFields({
                name: `${this.emojis.type} Type`,
                value: this.formatTaskType(taskData.type),
                inline: true
            });
        }

        // Completion count
        if (taskData.completedBy !== undefined) {
            embed.addFields({
                name: `${this.emojis.completed} Completed By`,
                value: `${taskData.completedBy} users`,
                inline: true
            });
        }

        // Requirements
        if (taskData.requirements && taskData.requirements.length > 0) {
            embed.addFields({
                name: `${this.emojis.info} Requirements`,
                value: taskData.requirements.join('\n'),
                inline: false
            });
        }

        // Time remaining
        if (taskData.endTime) {
            this.addCountdownField(embed, taskData.endTime);
        }
    }

    /**
     * Add allowlist-specific fields to embed
     * @private
     */
    addAllowlistFields(embed, allowlistData) {
        // Prize field
        if (allowlistData.prize) {
            embed.addFields({
                name: `${this.emojis.prize} Prize`,
                value: allowlistData.prize,
                inline: true
            });
        }

        // Winner count
        if (allowlistData.winnerCount !== undefined) {
            embed.addFields({
                name: `${this.emojis.participants} Winners`,
                value: allowlistData.winnerCount === 'everyone' ? 'Everyone Wins!' : `${allowlistData.winnerCount}`,
                inline: true
            });
        }

        // Entry price
        if (allowlistData.entryPrice !== undefined) {
            embed.addFields({
                name: `${this.emojis.entry} Entry Price`,
                value: allowlistData.entryPrice === 0 || allowlistData.entryPrice === '0' ? 'Free' : `${allowlistData.entryPrice}`,
                inline: true
            });
        }

        // Current participants
        if (allowlistData.participants !== undefined) {
            embed.addFields({
                name: `${this.emojis.participants} Participants`,
                value: `${allowlistData.participants}`,
                inline: true
            });
        }

        // Social requirements
        if (allowlistData.socialTasks && allowlistData.socialTasks.length > 0) {
            const requirements = allowlistData.socialTasks.map(task => 
                `${this.getTaskTypeEmoji(task.taskType)} ${task.description || this.formatTaskType(task.taskType)}`
            ).join('\n');
            
            embed.addFields({
                name: `${this.emojis.info} Requirements`,
                value: requirements,
                inline: false
            });
        }

        // Profit guarantee
        if (allowlistData.profitGuaranteePercentage) {
            embed.addFields({
                name: `${this.emojis.success} Profit Guarantee`,
                value: `${allowlistData.profitGuaranteePercentage}% of winner sales distributed to losers`,
                inline: false
            });
        }
    }

    /**
     * Add task-specific buttons
     * @private
     */
    addTaskButtons(row, data, options) {
        // Complete task button
        if (!options.hideCompleteButton) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`complete_task_${data.id}`)
                    .setLabel('Complete Task')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(this.emojis.completed)
                    .setDisabled(data.status === 'completed' || data.status === 'expired')
            );
        }

        // View details button
        if (!options.hideDetailsButton) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`view_task_${data.id}`)
                    .setLabel('View Details')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('👁️')
            );
        }

        // Visit link button (for external tasks)
        if (data.externalUrl && !options.hideExternalButton) {
            row.addComponents(
                new ButtonBuilder()
                    .setURL(data.externalUrl)
                    .setLabel('Visit Link')
                    .setStyle(ButtonStyle.Link)
                    .setEmoji(this.emojis.link)
            );
        }
    }

    /**
     * Add allowlist-specific buttons
     * @private
     */
    addAllowlistButtons(row, data, options) {
        // Enter allowlist button
        if (!options.hideEnterButton) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`enter_allowlist_${data.id}`)
                    .setLabel('Enter Allowlist')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji(this.emojis.allowlist)
                    .setDisabled(data.status === 'ended' || data.status === 'full')
            );
        }

        // View details button
        if (!options.hideDetailsButton) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`view_allowlist_${data.id}`)
                    .setLabel('View Details')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('👁️')
            );
        }

        // Visit Naffles button
        if (!options.hideNafflesButton) {
            row.addComponents(
                new ButtonBuilder()
                    .setURL(`https://naffles.com/allowlist/${data.id}`)
                    .setLabel('View on Naffles')
                    .setStyle(ButtonStyle.Link)
                    .setEmoji(this.emojis.link)
            );
        }
    }

    /**
     * Add navigation buttons
     * @private
     */
    addNavigationButtons(row, data, options) {
        if (data.buttons) {
            data.buttons.forEach(button => {
                const discordButton = new ButtonBuilder()
                    .setCustomId(button.customId)
                    .setLabel(button.label)
                    .setStyle(this.getButtonStyle(button.style))
                    .setDisabled(button.disabled || false);

                if (button.emoji) {
                    discordButton.setEmoji(button.emoji);
                }

                if (button.url) {
                    discordButton.setURL(button.url).setStyle(ButtonStyle.Link);
                }

                row.addComponents(discordButton);
            });
        }
    }

    /**
     * Add countdown field to embed
     * @private
     */
    addCountdownField(embed, endTime) {
        const timestamp = Math.floor(new Date(endTime).getTime() / 1000);
        embed.addFields({
            name: `${this.emojis.countdown} Time Remaining`,
            value: `<t:${timestamp}:R>`,
            inline: true
        });
    }

    /**
     * Update countdown field in embed
     * @private
     */
    updateCountdownField(embed, endTime) {
        const timestamp = Math.floor(new Date(endTime).getTime() / 1000);
        const countdownField = embed.data.fields?.find(field => field.name.includes('Time Remaining'));
        if (countdownField) {
            countdownField.value = `<t:${timestamp}:R>`;
        } else {
            this.addCountdownField(embed, endTime);
        }
    }

    /**
     * Update progress field in embed
     * @private
     */
    updateProgressField(embed, progress) {
        const progressBar = this.createProgressBar(progress.current, progress.total);
        const progressField = embed.data.fields?.find(field => field.name.includes('Progress'));
        if (progressField) {
            progressField.value = `${progressBar} ${progress.current}/${progress.total}`;
        } else {
            embed.addFields({
                name: `${this.emojis.status} Progress`,
                value: `${progressBar} ${progress.current}/${progress.total}`,
                inline: true
            });
        }
    }

    /**
     * Update participant field in embed
     * @private
     */
    updateParticipantField(embed, participants) {
        const participantField = embed.data.fields?.find(field => field.name.includes('Participants'));
        if (participantField) {
            participantField.value = `${participants}`;
        } else {
            embed.addFields({
                name: `${this.emojis.participants} Participants`,
                value: `${participants}`,
                inline: true
            });
        }
    }

    /**
     * Format description with length limit
     * @private
     */
    formatDescription(description, maxLength = 500) {
        if (!description) return 'No description provided.';
        if (description.length <= maxLength) return description;
        return description.substring(0, maxLength - 3) + '...';
    }

    /**
     * Format task type with emoji
     * @private
     */
    formatTaskType(type) {
        const typeMap = {
            'twitter_follow': `${this.emojis.twitter} Twitter Follow`,
            'discord_join': `${this.emojis.discord} Discord Join`,
            'telegram_join': `${this.emojis.telegram} Telegram Join`,
            'custom': `${this.emojis.custom} Custom Task`
        };
        return typeMap[type] || `${this.emojis.custom} ${type}`;
    }

    /**
     * Get task type emoji
     * @private
     */
    getTaskTypeEmoji(type) {
        const emojiMap = {
            'twitter_follow': this.emojis.twitter,
            'discord_join': this.emojis.discord,
            'telegram_join': this.emojis.telegram,
            'custom': this.emojis.custom
        };
        return emojiMap[type] || this.emojis.custom;
    }

    /**
     * Format status with appropriate styling
     * @private
     */
    formatStatus(status) {
        const statusMap = {
            'active': `${this.emojis.success} Active`,
            'completed': `${this.emojis.completed} Completed`,
            'expired': `${this.emojis.error} Expired`,
            'paused': `${this.emojis.warning} Paused`,
            'ended': `${this.emojis.info} Ended`,
            'full': `${this.emojis.warning} Full`
        };
        return statusMap[status] || `${this.emojis.info} ${status}`;
    }

    /**
     * Format duration in human-readable format
     * @private
     */
    formatDuration(hours) {
        if (hours < 24) {
            return `${hours} hour${hours !== 1 ? 's' : ''}`;
        } else if (hours < 168) {
            const days = Math.floor(hours / 24);
            return `${days} day${days !== 1 ? 's' : ''}`;
        } else {
            const weeks = Math.floor(hours / 168);
            return `${weeks} week${weeks !== 1 ? 's' : ''}`;
        }
    }

    /**
     * Get Discord button style from string
     * @private
     */
    getButtonStyle(style) {
        const styleMap = {
            'primary': ButtonStyle.Primary,
            'secondary': ButtonStyle.Secondary,
            'success': ButtonStyle.Success,
            'danger': ButtonStyle.Danger,
            'link': ButtonStyle.Link
        };
        return styleMap[style] || ButtonStyle.Secondary;
    }

    /**
     * Create progress bar visualization
     * @private
     */
    createProgressBar(current, total, length = 10) {
        const percentage = Math.min(current / total, 1);
        const filled = Math.round(percentage * length);
        const empty = length - filled;
        return '█'.repeat(filled) + '░'.repeat(empty);
    }
}

module.exports = EmbedBuilderService;