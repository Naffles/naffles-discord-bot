const logger = require('../utils/logger');

class AuditLogger {
    constructor(botService) {
        this.botService = botService;
        this.auditLogs = [];
        this.maxLogSize = 10000; // Maximum number of logs to keep in memory
        this.logRetentionDays = 30; // Keep logs for 30 days
        
        // Audit event types
        this.eventTypes = {
            COMMAND_EXECUTED: 'command_executed',
            PERMISSION_GRANTED: 'permission_granted',
            PERMISSION_DENIED: 'permission_denied',
            ADMIN_ACTION: 'admin_action',
            COMMUNITY_LINKED: 'community_linked',
            COMMUNITY_UNLINKED: 'community_unlinked',
            TASK_CREATED: 'task_created',
            TASK_COMPLETED: 'task_completed',
            ALLOWLIST_CONNECTED: 'allowlist_connected',
            USER_JOINED: 'user_joined',
            USER_LEFT: 'user_left',
            BOT_JOINED_GUILD: 'bot_joined_guild',
            BOT_LEFT_GUILD: 'bot_left_guild',
            SECURITY_EVENT: 'security_event',
            RATE_LIMIT_HIT: 'rate_limit_hit',
            ERROR_OCCURRED: 'error_occurred',
            CONFIG_CHANGED: 'config_changed',
            DATA_EXPORT: 'data_export',
            DATA_DELETION: 'data_deletion'
        };
        
        // Start cleanup interval
        this.startCleanup();
    }

    /**
     * Log a command execution
     * @param {Object} interaction - Discord interaction
     * @param {string} result - Execution result
     * @param {Object} additionalData - Additional data to log
     */
    async logCommandExecution(interaction, result, additionalData = {}) {
        try {
            const auditData = {
                type: this.eventTypes.COMMAND_EXECUTED,
                userId: interaction.user.id,
                userTag: interaction.user.tag,
                guildId: interaction.guildId,
                guildName: interaction.guild?.name,
                channelId: interaction.channelId,
                commandName: interaction.commandName,
                commandOptions: this.sanitizeCommandOptions(interaction.options),
                result,
                timestamp: new Date(),
                ipAddress: this.getClientIP(interaction),
                userAgent: this.getUserAgent(interaction),
                ...additionalData
            };
            
            await this.createAuditLog(auditData);

        } catch (error) {
            logger.error('Failed to log command execution:', error);
        }
    }

    /**
     * Log permission check result
     * @param {Object} interaction - Discord interaction
     * @param {string} result - Permission check result
     * @param {string} reason - Reason for the result
     * @param {Object} additionalData - Additional data to log
     */
    async logPermissionCheck(interaction, result, reason, additionalData = {}) {
        try {
            const eventType = result === 'granted' ? 
                this.eventTypes.PERMISSION_GRANTED : 
                this.eventTypes.PERMISSION_DENIED;
            
            const auditData = {
                type: eventType,
                userId: interaction.user.id,
                userTag: interaction.user.tag,
                guildId: interaction.guildId,
                guildName: interaction.guild?.name,
                commandName: interaction.commandName,
                result,
                reason,
                timestamp: new Date(),
                accountAge: this.calculateAccountAge(interaction.user.createdTimestamp),
                memberSince: interaction.member?.joinedTimestamp ? 
                    this.calculateMemberAge(interaction.member.joinedTimestamp) : null,
                userRoles: interaction.member?.roles.cache.map(role => ({
                    id: role.id,
                    name: role.name
                })) || [],
                userPermissions: interaction.member?.permissions.toArray() || [],
                ...additionalData
            };
            
            await this.createAuditLog(auditData);

        } catch (error) {
            logger.error('Failed to log permission check:', error);
        }
    }

    /**
     * Log administrative actions
     * @param {string} adminUserId - Admin user ID
     * @param {string} action - Action performed
     * @param {string} guildId - Guild ID
     * @param {Object} details - Action details
     */
    async logAdminAction(adminUserId, action, guildId, details = {}) {
        try {
            const auditData = {
                type: this.eventTypes.ADMIN_ACTION,
                userId: adminUserId,
                guildId,
                action,
                details,
                timestamp: new Date(),
                severity: this.getActionSeverity(action)
            };
            
            await this.createAuditLog(auditData);

        } catch (error) {
            logger.error('Failed to log admin action:', error);
        }
    }

    /**
     * Log community linking events
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {string} communityId - Community ID
     * @param {string} action - Action (linked/unlinked)
     * @param {Object} additionalData - Additional data
     */
    async logCommunityLinking(userId, guildId, communityId, action, additionalData = {}) {
        try {
            const eventType = action === 'linked' ? 
                this.eventTypes.COMMUNITY_LINKED : 
                this.eventTypes.COMMUNITY_UNLINKED;
            
            const auditData = {
                type: eventType,
                userId,
                guildId,
                communityId,
                action,
                timestamp: new Date(),
                ...additionalData
            };
            
            await this.createAuditLog(auditData);

        } catch (error) {
            logger.error('Failed to log community linking:', error);
        }
    }

    /**
     * Log task-related events
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {string} taskId - Task ID
     * @param {string} action - Action (created/completed)
     * @param {Object} taskData - Task data
     */
    async logTaskEvent(userId, guildId, taskId, action, taskData = {}) {
        try {
            const eventType = action === 'created' ? 
                this.eventTypes.TASK_CREATED : 
                this.eventTypes.TASK_COMPLETED;
            
            const auditData = {
                type: eventType,
                userId,
                guildId,
                taskId,
                action,
                taskType: taskData.type,
                taskTitle: taskData.title,
                pointsReward: taskData.points,
                timestamp: new Date(),
                taskData: this.sanitizeTaskData(taskData)
            };
            
            await this.createAuditLog(auditData);

        } catch (error) {
            logger.error('Failed to log task event:', error);
        }
    }

    /**
     * Log allowlist events
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {string} allowlistId - Allowlist ID
     * @param {string} action - Action performed
     * @param {Object} additionalData - Additional data
     */
    async logAllowlistEvent(userId, guildId, allowlistId, action, additionalData = {}) {
        try {
            const auditData = {
                type: this.eventTypes.ALLOWLIST_CONNECTED,
                userId,
                guildId,
                allowlistId,
                action,
                timestamp: new Date(),
                ...additionalData
            };
            
            await this.createAuditLog(auditData);

        } catch (error) {
            logger.error('Failed to log allowlist event:', error);
        }
    }

    /**
     * Log user join/leave events
     * @param {Object} member - Discord member
     * @param {string} action - Action (joined/left)
     */
    async logUserEvent(member, action) {
        try {
            const eventType = action === 'joined' ? 
                this.eventTypes.USER_JOINED : 
                this.eventTypes.USER_LEFT;
            
            const auditData = {
                type: eventType,
                userId: member.user.id,
                userTag: member.user.tag,
                guildId: member.guild.id,
                guildName: member.guild.name,
                action,
                timestamp: new Date(),
                accountAge: this.calculateAccountAge(member.user.createdTimestamp),
                isBot: member.user.bot,
                memberCount: member.guild.memberCount
            };
            
            await this.createAuditLog(auditData);

        } catch (error) {
            logger.error('Failed to log user event:', error);
        }
    }

    /**
     * Log bot guild events
     * @param {Object} guild - Discord guild
     * @param {string} action - Action (joined/left)
     */
    async logBotGuildEvent(guild, action) {
        try {
            const eventType = action === 'joined' ? 
                this.eventTypes.BOT_JOINED_GUILD : 
                this.eventTypes.BOT_LEFT_GUILD;
            
            const auditData = {
                type: eventType,
                guildId: guild.id,
                guildName: guild.name,
                action,
                timestamp: new Date(),
                memberCount: guild.memberCount,
                ownerId: guild.ownerId,
                features: guild.features,
                verificationLevel: guild.verificationLevel
            };
            
            await this.createAuditLog(auditData);

        } catch (error) {
            logger.error('Failed to log bot guild event:', error);
        }
    }

    /**
     * Log security events
     * @param {Object} securityEvent - Security event data
     */
    async logSecurityEvent(securityEvent) {
        try {
            const auditData = {
                type: this.eventTypes.SECURITY_EVENT,
                userId: securityEvent.userId,
                guildId: securityEvent.guildId,
                securityEventType: securityEvent.type,
                severity: securityEvent.severity,
                details: securityEvent.details,
                timestamp: new Date(securityEvent.timestamp),
                eventId: securityEvent.id
            };
            
            await this.createAuditLog(auditData);

        } catch (error) {
            logger.error('Failed to log security event:', error);
        }
    }

    /**
     * Log rate limiting events
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {string} action - Action that was rate limited
     * @param {Object} rateLimitData - Rate limit data
     */
    async logRateLimit(userId, guildId, action, rateLimitData) {
        try {
            const auditData = {
                type: this.eventTypes.RATE_LIMIT_HIT,
                userId,
                guildId,
                action,
                rateLimitData,
                timestamp: new Date()
            };
            
            await this.createAuditLog(auditData);

        } catch (error) {
            logger.error('Failed to log rate limit:', error);
        }
    }

    /**
     * Log errors
     * @param {Error} error - Error object
     * @param {Object} context - Error context
     */
    async logError(error, context = {}) {
        try {
            const auditData = {
                type: this.eventTypes.ERROR_OCCURRED,
                errorMessage: error.message,
                errorStack: error.stack,
                errorName: error.name,
                context,
                timestamp: new Date(),
                severity: this.getErrorSeverity(error)
            };
            
            await this.createAuditLog(auditData);

        } catch (logError) {
            logger.error('Failed to log error:', logError);
        }
    }

    /**
     * Log configuration changes
     * @param {string} adminUserId - Admin user ID
     * @param {string} guildId - Guild ID
     * @param {string} configType - Type of configuration changed
     * @param {Object} changes - Configuration changes
     */
    async logConfigChange(adminUserId, guildId, configType, changes) {
        try {
            const auditData = {
                type: this.eventTypes.CONFIG_CHANGED,
                userId: adminUserId,
                guildId,
                configType,
                changes: this.sanitizeConfigChanges(changes),
                timestamp: new Date(),
                severity: 'medium'
            };
            
            await this.createAuditLog(auditData);

        } catch (error) {
            logger.error('Failed to log config change:', error);
        }
    }

    /**
     * Create an audit log entry
     * @param {Object} auditData - Audit data
     */
    async createAuditLog(auditData) {
        try {
            // Add unique ID
            auditData.id = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Add to memory storage
            this.auditLogs.push(auditData);
            
            // Maintain memory limit
            if (this.auditLogs.length > this.maxLogSize) {
                this.auditLogs = this.auditLogs.slice(-this.maxLogSize);
            }
            
            // Log to Winston
            logger.audit('Audit log created', auditData);
            
            // Store in database if available
            if (this.botService.db && this.botService.db.logAuditEvent) {
                await this.botService.db.logAuditEvent(auditData);
            }

        } catch (error) {
            logger.error('Failed to create audit log:', error);
        }
    }

    /**
     * Get audit logs with filtering
     * @param {Object} filters - Filter criteria
     * @param {number} limit - Maximum number of logs to return
     * @returns {Array} Filtered audit logs
     */
    getAuditLogs(filters = {}, limit = 100) {
        try {
            let filteredLogs = [...this.auditLogs];
            
            // Apply filters
            if (filters.userId) {
                filteredLogs = filteredLogs.filter(log => log.userId === filters.userId);
            }
            
            if (filters.guildId) {
                filteredLogs = filteredLogs.filter(log => log.guildId === filters.guildId);
            }
            
            if (filters.type) {
                filteredLogs = filteredLogs.filter(log => log.type === filters.type);
            }
            
            if (filters.startDate) {
                const startDate = new Date(filters.startDate);
                filteredLogs = filteredLogs.filter(log => log.timestamp >= startDate);
            }
            
            if (filters.endDate) {
                const endDate = new Date(filters.endDate);
                filteredLogs = filteredLogs.filter(log => log.timestamp <= endDate);
            }
            
            if (filters.severity) {
                filteredLogs = filteredLogs.filter(log => log.severity === filters.severity);
            }
            
            // Sort by timestamp (newest first)
            filteredLogs.sort((a, b) => b.timestamp - a.timestamp);
            
            // Apply limit
            return filteredLogs.slice(0, limit);

        } catch (error) {
            logger.error('Failed to get audit logs:', error);
            return [];
        }
    }

    /**
     * Get audit statistics
     * @returns {Object} Audit statistics
     */
    getAuditStatistics() {
        try {
            const now = new Date();
            const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
            const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            
            const recentLogs = this.auditLogs.filter(log => log.timestamp >= hourAgo);
            const dailyLogs = this.auditLogs.filter(log => log.timestamp >= dayAgo);
            const weeklyLogs = this.auditLogs.filter(log => log.timestamp >= weekAgo);
            
            const logsByType = {};
            const logsBySeverity = {};
            const logsByUser = {};
            const logsByGuild = {};
            
            this.auditLogs.forEach(log => {
                // Count by type
                logsByType[log.type] = (logsByType[log.type] || 0) + 1;
                
                // Count by severity
                if (log.severity) {
                    logsBySeverity[log.severity] = (logsBySeverity[log.severity] || 0) + 1;
                }
                
                // Count by user
                if (log.userId) {
                    logsByUser[log.userId] = (logsByUser[log.userId] || 0) + 1;
                }
                
                // Count by guild
                if (log.guildId) {
                    logsByGuild[log.guildId] = (logsByGuild[log.guildId] || 0) + 1;
                }
            });
            
            return {
                totalLogs: this.auditLogs.length,
                recentLogs: recentLogs.length,
                dailyLogs: dailyLogs.length,
                weeklyLogs: weeklyLogs.length,
                logsByType,
                logsBySeverity,
                uniqueUsers: Object.keys(logsByUser).length,
                uniqueGuilds: Object.keys(logsByGuild).length,
                topUsers: Object.entries(logsByUser)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 10),
                topGuilds: Object.entries(logsByGuild)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 10)
            };

        } catch (error) {
            logger.error('Failed to get audit statistics:', error);
            return {
                totalLogs: 0,
                recentLogs: 0,
                dailyLogs: 0,
                weeklyLogs: 0,
                logsByType: {},
                logsBySeverity: {},
                uniqueUsers: 0,
                uniqueGuilds: 0,
                topUsers: [],
                topGuilds: []
            };
        }
    }

    /**
     * Export audit logs
     * @param {Object} filters - Filter criteria
     * @param {string} format - Export format (json/csv)
     * @returns {string} Exported data
     */
    exportAuditLogs(filters = {}, format = 'json') {
        try {
            const logs = this.getAuditLogs(filters, 10000); // Max 10k for export
            
            if (format === 'csv') {
                return this.convertToCSV(logs);
            }
            
            return JSON.stringify(logs, null, 2);

        } catch (error) {
            logger.error('Failed to export audit logs:', error);
            return format === 'csv' ? '' : '[]';
        }
    }

    /**
     * Helper methods
     */
    
    sanitizeCommandOptions(options) {
        if (!options) return {};
        
        const sanitized = {};
        options.data?.forEach(option => {
            sanitized[option.name] = option.value;
        });
        
        return sanitized;
    }
    
    sanitizeTaskData(taskData) {
        return {
            type: taskData.type,
            title: taskData.title,
            points: taskData.points,
            duration: taskData.duration
        };
    }
    
    sanitizeConfigChanges(changes) {
        // Remove sensitive data from config changes
        const sanitized = { ...changes };
        delete sanitized.tokens;
        delete sanitized.secrets;
        delete sanitized.passwords;
        return sanitized;
    }
    
    calculateAccountAge(createdTimestamp) {
        return Math.floor((Date.now() - createdTimestamp) / (24 * 60 * 60 * 1000));
    }
    
    calculateMemberAge(joinedTimestamp) {
        return Math.floor((Date.now() - joinedTimestamp) / (24 * 60 * 60 * 1000));
    }
    
    getActionSeverity(action) {
        const highSeverityActions = ['ban', 'kick', 'delete', 'purge', 'config_reset'];
        const mediumSeverityActions = ['mute', 'warn', 'config_change', 'permission_change'];
        
        if (highSeverityActions.some(a => action.toLowerCase().includes(a))) {
            return 'high';
        }
        if (mediumSeverityActions.some(a => action.toLowerCase().includes(a))) {
            return 'medium';
        }
        return 'low';
    }
    
    getErrorSeverity(error) {
        if (error.name === 'TypeError' || error.name === 'ReferenceError') {
            return 'high';
        }
        if (error.message?.includes('permission') || error.message?.includes('unauthorized')) {
            return 'medium';
        }
        return 'low';
    }
    
    getClientIP(interaction) {
        // Discord doesn't provide IP addresses, return placeholder
        return 'discord_api';
    }
    
    getUserAgent(interaction) {
        // Discord doesn't provide user agent, return placeholder
        return 'discord_client';
    }
    
    convertToCSV(logs) {
        if (logs.length === 0) return '';
        
        const headers = Object.keys(logs[0]).join(',');
        const rows = logs.map(log => 
            Object.values(log).map(value => 
                typeof value === 'object' ? JSON.stringify(value) : value
            ).join(',')
        );
        
        return [headers, ...rows].join('\n');
    }

    /**
     * Start cleanup interval
     */
    startCleanup() {
        // Clean up old logs every hour
        setInterval(() => {
            this.cleanupOldLogs();
        }, 60 * 60 * 1000);
        
        logger.info('Audit logger cleanup started');
    }

    /**
     * Clean up old audit logs
     */
    cleanupOldLogs() {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.logRetentionDays);
            
            const originalLength = this.auditLogs.length;
            this.auditLogs = this.auditLogs.filter(log => log.timestamp >= cutoffDate);
            
            const cleanedCount = originalLength - this.auditLogs.length;
            
            if (cleanedCount > 0) {
                logger.info('Audit logs cleanup completed', {
                    cleanedLogs: cleanedCount,
                    remainingLogs: this.auditLogs.length
                });
            }

        } catch (error) {
            logger.error('Audit logs cleanup failed:', error);
        }
    }

    /**
     * Clear all audit logs
     */
    clear() {
        const logCount = this.auditLogs.length;
        this.auditLogs = [];
        
        logger.info('Audit logger cleared', { clearedLogs: logCount });
    }
}

module.exports = AuditLogger;