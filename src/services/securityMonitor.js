const logger = require('../utils/logger');

class SecurityMonitor {
    constructor(botService) {
        this.botService = botService;
        this.suspiciousActivity = new Map();
        this.securityEvents = [];
        this.alertThresholds = {
            rapidCommands: { count: 10, window: 60000 }, // 10 commands in 1 minute
            failedPermissions: { count: 5, window: 300000 }, // 5 failed permissions in 5 minutes
            newAccountActivity: { count: 3, window: 3600000 }, // 3 activities from new accounts in 1 hour
            botDetection: { count: 1, window: 0 }, // Immediate alert for bot activity
            massJoins: { count: 10, window: 300000 }, // 10 joins in 5 minutes
            suspiciousPatterns: { count: 3, window: 1800000 } // 3 suspicious patterns in 30 minutes
        };
        
        // Security event types
        this.eventTypes = {
            RAPID_COMMANDS: 'rapid_commands',
            PERMISSION_DENIED: 'permission_denied',
            NEW_ACCOUNT_ACTIVITY: 'new_account_activity',
            BOT_DETECTION: 'bot_detection',
            MASS_JOINS: 'mass_joins',
            SUSPICIOUS_PATTERN: 'suspicious_pattern',
            RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
            COMMAND_ABUSE: 'command_abuse',
            UNAUTHORIZED_ACCESS: 'unauthorized_access',
            ACCOUNT_AGE_VIOLATION: 'account_age_violation'
        };
        
        // Start monitoring
        this.startMonitoring();
    }

    /**
     * Monitor command execution for suspicious activity
     * @param {Object} interaction - Discord interaction
     * @param {string} result - Command execution result
     */
    async monitorCommandExecution(interaction, result) {
        try {
            const userId = interaction.user.id;
            const guildId = interaction.guildId;
            const commandName = interaction.commandName;
            const timestamp = Date.now();
            
            // Track command usage
            await this.trackCommandUsage(userId, guildId, commandName, timestamp);
            
            // Check for rapid command usage
            await this.checkRapidCommands(userId, guildId, timestamp);
            
            // Monitor failed permissions
            if (result === 'permission_denied') {
                await this.trackFailedPermission(userId, guildId, commandName, timestamp);
            }
            
            // Check new account activity
            await this.checkNewAccountActivity(interaction, timestamp);
            
            // Detect bot behavior patterns
            await this.detectBotBehavior(interaction, timestamp);
            
            // Check for command abuse patterns
            await this.checkCommandAbusePatterns(userId, guildId, commandName, timestamp);

        } catch (error) {
            logger.error('Security monitoring failed:', error);
        }
    }

    /**
     * Track command usage for analysis
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {string} commandName - Command name
     * @param {number} timestamp - Timestamp
     */
    async trackCommandUsage(userId, guildId, commandName, timestamp) {
        try {
            const key = `commands_${userId}_${guildId}`;
            
            if (!this.suspiciousActivity.has(key)) {
                this.suspiciousActivity.set(key, {
                    commands: [],
                    patterns: [],
                    firstSeen: timestamp
                });
            }
            
            const userData = this.suspiciousActivity.get(key);
            userData.commands.push({
                command: commandName,
                timestamp,
                guild: guildId
            });
            
            // Keep only recent commands (last hour)
            const hourAgo = timestamp - 3600000;
            userData.commands = userData.commands.filter(cmd => cmd.timestamp > hourAgo);
            
            this.suspiciousActivity.set(key, userData);

        } catch (error) {
            logger.error('Failed to track command usage:', error);
        }
    }

    /**
     * Check for rapid command execution
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {number} timestamp - Timestamp
     */
    async checkRapidCommands(userId, guildId, timestamp) {
        try {
            const key = `commands_${userId}_${guildId}`;
            const userData = this.suspiciousActivity.get(key);
            
            if (!userData) return;
            
            const threshold = this.alertThresholds.rapidCommands;
            const recentCommands = userData.commands.filter(cmd => 
                timestamp - cmd.timestamp < threshold.window
            );
            
            if (recentCommands.length >= threshold.count) {
                await this.createSecurityEvent({
                    type: this.eventTypes.RAPID_COMMANDS,
                    userId,
                    guildId,
                    severity: 'medium',
                    details: {
                        commandCount: recentCommands.length,
                        timeWindow: threshold.window,
                        commands: recentCommands.map(cmd => cmd.command)
                    },
                    timestamp
                });
            }

        } catch (error) {
            logger.error('Failed to check rapid commands:', error);
        }
    }

    /**
     * Track failed permission attempts
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {string} commandName - Command name
     * @param {number} timestamp - Timestamp
     */
    async trackFailedPermission(userId, guildId, commandName, timestamp) {
        try {
            const key = `failed_perms_${userId}_${guildId}`;
            
            if (!this.suspiciousActivity.has(key)) {
                this.suspiciousActivity.set(key, {
                    failures: [],
                    firstFailure: timestamp
                });
            }
            
            const userData = this.suspiciousActivity.get(key);
            userData.failures.push({
                command: commandName,
                timestamp
            });
            
            // Keep only recent failures
            const threshold = this.alertThresholds.failedPermissions;
            userData.failures = userData.failures.filter(failure => 
                timestamp - failure.timestamp < threshold.window
            );
            
            // Check if threshold exceeded
            if (userData.failures.length >= threshold.count) {
                await this.createSecurityEvent({
                    type: this.eventTypes.PERMISSION_DENIED,
                    userId,
                    guildId,
                    severity: 'medium',
                    details: {
                        failureCount: userData.failures.length,
                        timeWindow: threshold.window,
                        commands: userData.failures.map(f => f.command)
                    },
                    timestamp
                });
            }
            
            this.suspiciousActivity.set(key, userData);

        } catch (error) {
            logger.error('Failed to track failed permission:', error);
        }
    }

    /**
     * Check for new account suspicious activity
     * @param {Object} interaction - Discord interaction
     * @param {number} timestamp - Timestamp
     */
    async checkNewAccountActivity(interaction, timestamp) {
        try {
            const userId = interaction.user.id;
            const guildId = interaction.guildId;
            const accountAge = timestamp - interaction.user.createdTimestamp;
            const newAccountThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days
            
            if (accountAge < newAccountThreshold) {
                const key = `new_account_${guildId}`;
                
                if (!this.suspiciousActivity.has(key)) {
                    this.suspiciousActivity.set(key, {
                        newAccounts: [],
                        firstSeen: timestamp
                    });
                }
                
                const guildData = this.suspiciousActivity.get(key);
                guildData.newAccounts.push({
                    userId,
                    accountAge: Math.floor(accountAge / (24 * 60 * 60 * 1000)), // days
                    timestamp,
                    command: interaction.commandName
                });
                
                // Keep only recent activity
                const threshold = this.alertThresholds.newAccountActivity;
                guildData.newAccounts = guildData.newAccounts.filter(account => 
                    timestamp - account.timestamp < threshold.window
                );
                
                // Check if threshold exceeded
                if (guildData.newAccounts.length >= threshold.count) {
                    await this.createSecurityEvent({
                        type: this.eventTypes.NEW_ACCOUNT_ACTIVITY,
                        userId: null,
                        guildId,
                        severity: 'medium',
                        details: {
                            newAccountCount: guildData.newAccounts.length,
                            timeWindow: threshold.window,
                            accounts: guildData.newAccounts
                        },
                        timestamp
                    });
                }
                
                this.suspiciousActivity.set(key, guildData);
            }

        } catch (error) {
            logger.error('Failed to check new account activity:', error);
        }
    }

    /**
     * Detect bot behavior patterns
     * @param {Object} interaction - Discord interaction
     * @param {number} timestamp - Timestamp
     */
    async detectBotBehavior(interaction, timestamp) {
        try {
            const userId = interaction.user.id;
            const guildId = interaction.guildId;
            
            // Check if user is actually a bot
            if (interaction.user.bot) {
                await this.createSecurityEvent({
                    type: this.eventTypes.BOT_DETECTION,
                    userId,
                    guildId,
                    severity: 'high',
                    details: {
                        botTag: interaction.user.tag,
                        command: interaction.commandName,
                        reason: 'Bot account attempted command'
                    },
                    timestamp
                });
                return;
            }
            
            // Check for bot-like patterns
            const key = `commands_${userId}_${guildId}`;
            const userData = this.suspiciousActivity.get(key);
            
            if (userData && userData.commands.length >= 5) {
                const recentCommands = userData.commands.slice(-5);
                
                // Check for identical timing patterns (bot-like)
                const timingDiffs = [];
                for (let i = 1; i < recentCommands.length; i++) {
                    timingDiffs.push(recentCommands[i].timestamp - recentCommands[i-1].timestamp);
                }
                
                // If all timing differences are very similar (within 100ms), it's suspicious
                const avgDiff = timingDiffs.reduce((a, b) => a + b, 0) / timingDiffs.length;
                const isConsistentTiming = timingDiffs.every(diff => Math.abs(diff - avgDiff) < 100);
                
                if (isConsistentTiming && avgDiff < 5000) { // Less than 5 seconds between commands
                    await this.createSecurityEvent({
                        type: this.eventTypes.SUSPICIOUS_PATTERN,
                        userId,
                        guildId,
                        severity: 'medium',
                        details: {
                            pattern: 'consistent_timing',
                            averageInterval: avgDiff,
                            commandCount: recentCommands.length,
                            reason: 'Bot-like consistent timing detected'
                        },
                        timestamp
                    });
                }
            }

        } catch (error) {
            logger.error('Failed to detect bot behavior:', error);
        }
    }

    /**
     * Check for command abuse patterns
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {string} commandName - Command name
     * @param {number} timestamp - Timestamp
     */
    async checkCommandAbusePatterns(userId, guildId, commandName, timestamp) {
        try {
            const key = `commands_${userId}_${guildId}`;
            const userData = this.suspiciousActivity.get(key);
            
            if (!userData) return;
            
            // Check for repeated identical commands
            const recentCommands = userData.commands.filter(cmd => 
                timestamp - cmd.timestamp < 300000 // Last 5 minutes
            );
            
            const commandCounts = {};
            recentCommands.forEach(cmd => {
                commandCounts[cmd.command] = (commandCounts[cmd.command] || 0) + 1;
            });
            
            // Alert if same command used more than 5 times in 5 minutes
            for (const [command, count] of Object.entries(commandCounts)) {
                if (count >= 5) {
                    await this.createSecurityEvent({
                        type: this.eventTypes.COMMAND_ABUSE,
                        userId,
                        guildId,
                        severity: 'medium',
                        details: {
                            command,
                            count,
                            timeWindow: 300000,
                            reason: 'Repeated command usage detected'
                        },
                        timestamp
                    });
                }
            }

        } catch (error) {
            logger.error('Failed to check command abuse patterns:', error);
        }
    }

    /**
     * Monitor guild member joins for mass join attacks
     * @param {Object} member - Discord member
     */
    async monitorMemberJoin(member) {
        try {
            const guildId = member.guild.id;
            const timestamp = Date.now();
            const key = `joins_${guildId}`;
            
            if (!this.suspiciousActivity.has(key)) {
                this.suspiciousActivity.set(key, {
                    joins: [],
                    firstJoin: timestamp
                });
            }
            
            const guildData = this.suspiciousActivity.get(key);
            guildData.joins.push({
                userId: member.user.id,
                userTag: member.user.tag,
                accountAge: timestamp - member.user.createdTimestamp,
                timestamp
            });
            
            // Keep only recent joins
            const threshold = this.alertThresholds.massJoins;
            guildData.joins = guildData.joins.filter(join => 
                timestamp - join.timestamp < threshold.window
            );
            
            // Check if threshold exceeded
            if (guildData.joins.length >= threshold.count) {
                const newAccounts = guildData.joins.filter(join => 
                    join.accountAge < 7 * 24 * 60 * 60 * 1000 // Less than 7 days old
                );
                
                await this.createSecurityEvent({
                    type: this.eventTypes.MASS_JOINS,
                    userId: null,
                    guildId,
                    severity: newAccounts.length > 5 ? 'high' : 'medium',
                    details: {
                        joinCount: guildData.joins.length,
                        newAccountCount: newAccounts.length,
                        timeWindow: threshold.window,
                        recentJoins: guildData.joins.slice(-5) // Last 5 joins
                    },
                    timestamp
                });
            }
            
            this.suspiciousActivity.set(key, guildData);

        } catch (error) {
            logger.error('Failed to monitor member join:', error);
        }
    }

    /**
     * Create a security event
     * @param {Object} eventData - Security event data
     */
    async createSecurityEvent(eventData) {
        try {
            const event = {
                id: `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                ...eventData,
                createdAt: new Date(eventData.timestamp)
            };
            
            // Add to events list
            this.securityEvents.push(event);
            
            // Keep only recent events (last 24 hours)
            const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
            this.securityEvents = this.securityEvents.filter(e => 
                e.timestamp > dayAgo
            );
            
            // Log security event
            logger.security('Security event created', event);
            
            // Send alert if high severity
            if (event.severity === 'high' || event.severity === 'critical') {
                await this.sendSecurityAlert(event);
            }
            
            // Store in database if available
            if (this.botService.db) {
                await this.botService.db.logSecurityEvent(event);
            }

        } catch (error) {
            logger.error('Failed to create security event:', error);
        }
    }

    /**
     * Send security alert
     * @param {Object} event - Security event
     */
    async sendSecurityAlert(event) {
        try {
            // Log high-priority alert
            logger.security('HIGH PRIORITY SECURITY ALERT', {
                eventId: event.id,
                type: event.type,
                severity: event.severity,
                userId: event.userId,
                guildId: event.guildId,
                details: event.details
            });
            
            // TODO: Implement additional alerting mechanisms:
            // - Discord webhook notifications
            // - Email alerts to administrators
            // - Integration with external monitoring systems
            
        } catch (error) {
            logger.error('Failed to send security alert:', error);
        }
    }

    /**
     * Get security statistics
     * @returns {Object} Security statistics
     */
    getSecurityStatistics() {
        try {
            const now = Date.now();
            const hourAgo = now - 3600000;
            const dayAgo = now - (24 * 60 * 60 * 1000);
            
            const recentEvents = this.securityEvents.filter(e => e.timestamp > hourAgo);
            const dailyEvents = this.securityEvents.filter(e => e.timestamp > dayAgo);
            
            const eventsByType = {};
            const eventsBySeverity = {};
            
            dailyEvents.forEach(event => {
                eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
                eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
            });
            
            return {
                totalEvents: this.securityEvents.length,
                recentEvents: recentEvents.length,
                dailyEvents: dailyEvents.length,
                eventsByType,
                eventsBySeverity,
                suspiciousUsers: this.suspiciousActivity.size,
                alertThresholds: this.alertThresholds
            };

        } catch (error) {
            logger.error('Failed to get security statistics:', error);
            return {
                totalEvents: 0,
                recentEvents: 0,
                dailyEvents: 0,
                eventsByType: {},
                eventsBySeverity: {},
                suspiciousUsers: 0,
                alertThresholds: this.alertThresholds
            };
        }
    }

    /**
     * Get recent security events
     * @param {number} limit - Maximum number of events to return
     * @returns {Array} Recent security events
     */
    getRecentSecurityEvents(limit = 50) {
        try {
            return this.securityEvents
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, limit);

        } catch (error) {
            logger.error('Failed to get recent security events:', error);
            return [];
        }
    }

    /**
     * Clear security data for a user
     * @param {string} userId - User ID
     */
    clearUserSecurityData(userId) {
        try {
            const keysToDelete = [];
            
            for (const key of this.suspiciousActivity.keys()) {
                if (key.includes(`_${userId}_`)) {
                    keysToDelete.push(key);
                }
            }
            
            keysToDelete.forEach(key => this.suspiciousActivity.delete(key));
            
            logger.info('User security data cleared', { userId, clearedEntries: keysToDelete.length });

        } catch (error) {
            logger.error('Failed to clear user security data:', error);
        }
    }

    /**
     * Start monitoring intervals
     */
    startMonitoring() {
        // Clean up old data every 10 minutes
        setInterval(() => {
            this.cleanupOldData();
        }, 600000);
        
        // Generate security reports every hour
        setInterval(() => {
            this.generateHourlyReport();
        }, 3600000);
        
        logger.info('Security monitoring started');
    }

    /**
     * Clean up old monitoring data
     */
    cleanupOldData() {
        try {
            const now = Date.now();
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours
            let cleanedEntries = 0;
            
            for (const [key, data] of this.suspiciousActivity.entries()) {
                if (data.firstSeen && now - data.firstSeen > maxAge) {
                    this.suspiciousActivity.delete(key);
                    cleanedEntries++;
                }
            }
            
            if (cleanedEntries > 0) {
                logger.info('Security monitoring cleanup completed', {
                    cleanedEntries,
                    remainingEntries: this.suspiciousActivity.size
                });
            }

        } catch (error) {
            logger.error('Security monitoring cleanup failed:', error);
        }
    }

    /**
     * Generate hourly security report
     */
    generateHourlyReport() {
        try {
            const stats = this.getSecurityStatistics();
            
            if (stats.recentEvents > 0) {
                logger.security('Hourly security report', stats);
            }

        } catch (error) {
            logger.error('Failed to generate hourly security report:', error);
        }
    }

    /**
     * Clear all security monitoring data
     */
    clear() {
        const activitySize = this.suspiciousActivity.size;
        const eventsSize = this.securityEvents.length;
        
        this.suspiciousActivity.clear();
        this.securityEvents = [];
        
        logger.info('Security monitor cleared', {
            clearedActivity: activitySize,
            clearedEvents: eventsSize
        });
    }
}

module.exports = SecurityMonitor;