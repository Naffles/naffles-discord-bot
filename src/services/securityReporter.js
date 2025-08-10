const logger = require('../utils/logger');

class SecurityReporter {
    constructor(botService) {
        this.botService = botService;
        this.reports = [];
        this.alertChannels = new Map(); // Guild ID -> Channel ID for security alerts
        this.reportSchedule = {
            daily: true,
            weekly: true,
            monthly: true
        };
        
        // Start scheduled reporting
        this.startScheduledReporting();
    }

    /**
     * Generate comprehensive security report
     * @param {string} timeframe - Timeframe for the report (hour/day/week/month)
     * @param {string} guildId - Optional guild ID to filter by
     * @returns {Object} Security report
     */
    async generateSecurityReport(timeframe = 'day', guildId = null) {
        try {
            const now = new Date();
            const timeframes = {
                hour: 60 * 60 * 1000,
                day: 24 * 60 * 60 * 1000,
                week: 7 * 24 * 60 * 60 * 1000,
                month: 30 * 24 * 60 * 60 * 1000
            };
            
            const startTime = new Date(now.getTime() - timeframes[timeframe]);
            
            // Gather data from various sources
            const securityStats = this.botService.securityMonitor?.getSecurityStatistics() || {};
            const auditStats = this.botService.auditLogger?.getAuditStatistics() || {};
            const rateLimitStats = this.botService.rateLimiter?.getStatistics() || {};
            const permissionStats = this.botService.permissionManager?.getPermissionStatistics() || {};
            
            // Get recent security events
            const securityEvents = this.botService.securityMonitor?.getRecentSecurityEvents(100) || [];
            const filteredEvents = securityEvents.filter(event => {
                const eventTime = new Date(event.timestamp);
                const inTimeframe = eventTime >= startTime;
                const inGuild = !guildId || event.guildId === guildId;
                return inTimeframe && inGuild;
            });
            
            // Get audit logs
            const auditLogs = this.botService.auditLogger?.getAuditLogs({
                startDate: startTime,
                guildId
            }, 1000) || [];
            
            // Analyze threats
            const threatAnalysis = this.analyzeThreatPatterns(filteredEvents, auditLogs);
            
            // Generate recommendations
            const recommendations = this.generateSecurityRecommendations(threatAnalysis, securityStats);
            
            const report = {
                id: `security_report_${Date.now()}`,
                timeframe,
                guildId,
                generatedAt: now,
                period: {
                    start: startTime,
                    end: now
                },
                summary: {
                    totalSecurityEvents: filteredEvents.length,
                    highSeverityEvents: filteredEvents.filter(e => e.severity === 'high').length,
                    criticalEvents: filteredEvents.filter(e => e.severity === 'critical').length,
                    totalAuditLogs: auditLogs.length,
                    uniqueUsers: new Set(auditLogs.map(log => log.userId).filter(Boolean)).size,
                    uniqueGuilds: new Set(auditLogs.map(log => log.guildId).filter(Boolean)).size,
                    commandsExecuted: auditLogs.filter(log => log.type === 'command_executed').length,
                    permissionDenials: auditLogs.filter(log => log.type === 'permission_denied').length,
                    rateLimitHits: auditLogs.filter(log => log.type === 'rate_limit_hit').length
                },
                securityEvents: {
                    byType: this.groupEventsByType(filteredEvents),
                    bySeverity: this.groupEventsBySeverity(filteredEvents),
                    byGuild: this.groupEventsByGuild(filteredEvents),
                    timeline: this.createEventTimeline(filteredEvents)
                },
                threatAnalysis,
                systemHealth: {
                    rateLimiter: {
                        totalEntries: rateLimitStats.totalEntries || 0,
                        activeEntries: rateLimitStats.activeEntries || 0,
                        memoryUsage: rateLimitStats.memoryUsage || 0
                    },
                    permissions: {
                        cacheSize: permissionStats.cacheSize || 0,
                        serverConfigs: permissionStats.serverConfigs || 0,
                        recentActivity: permissionStats.recentActivity || 0
                    },
                    monitoring: {
                        suspiciousUsers: securityStats.suspiciousUsers || 0,
                        recentEvents: securityStats.recentEvents || 0,
                        dailyEvents: securityStats.dailyEvents || 0
                    }
                },
                topRisks: this.identifyTopRisks(filteredEvents, auditLogs),
                recommendations,
                actionItems: this.generateActionItems(threatAnalysis, recommendations)
            };
            
            // Store report
            this.reports.push(report);
            
            // Keep only recent reports (last 100)
            if (this.reports.length > 100) {
                this.reports = this.reports.slice(-100);
            }
            
            logger.security('Security report generated', {
                reportId: report.id,
                timeframe,
                guildId,
                eventCount: filteredEvents.length,
                highSeverityCount: report.summary.highSeverityEvents
            });
            
            return report;

        } catch (error) {
            logger.error('Failed to generate security report:', error);
            return null;
        }
    }

    /**
     * Analyze threat patterns from events and logs
     * @param {Array} securityEvents - Security events
     * @param {Array} auditLogs - Audit logs
     * @returns {Object} Threat analysis
     */
    analyzeThreatPatterns(securityEvents, auditLogs) {
        try {
            const analysis = {
                suspiciousUsers: new Map(),
                attackPatterns: [],
                riskLevel: 'low',
                trends: {
                    increasing: [],
                    decreasing: [],
                    stable: []
                }
            };
            
            // Analyze suspicious users
            securityEvents.forEach(event => {
                if (event.userId) {
                    if (!analysis.suspiciousUsers.has(event.userId)) {
                        analysis.suspiciousUsers.set(event.userId, {
                            userId: event.userId,
                            events: [],
                            riskScore: 0,
                            patterns: new Set()
                        });
                    }
                    
                    const userData = analysis.suspiciousUsers.get(event.userId);
                    userData.events.push(event);
                    userData.riskScore += this.calculateEventRiskScore(event);
                    userData.patterns.add(event.type);
                }
            });
            
            // Identify attack patterns
            const eventsByType = this.groupEventsByType(securityEvents);
            
            // Check for coordinated attacks
            if (eventsByType.mass_joins > 5) {
                analysis.attackPatterns.push({
                    type: 'mass_join_attack',
                    severity: 'high',
                    description: 'Multiple mass join events detected',
                    count: eventsByType.mass_joins
                });
            }
            
            // Check for bot networks
            const botEvents = securityEvents.filter(e => e.type === 'bot_detection');
            if (botEvents.length > 3) {
                analysis.attackPatterns.push({
                    type: 'bot_network',
                    severity: 'high',
                    description: 'Multiple bot accounts detected',
                    count: botEvents.length
                });
            }
            
            // Check for permission escalation attempts
            const permissionDenials = auditLogs.filter(log => log.type === 'permission_denied');
            const escalationAttempts = permissionDenials.filter(log => 
                log.reason?.includes('admin') || log.reason?.includes('Administrator')
            );
            
            if (escalationAttempts.length > 10) {
                analysis.attackPatterns.push({
                    type: 'permission_escalation',
                    severity: 'medium',
                    description: 'Multiple admin permission attempts detected',
                    count: escalationAttempts.length
                });
            }
            
            // Calculate overall risk level
            const highSeverityEvents = securityEvents.filter(e => e.severity === 'high').length;
            const criticalEvents = securityEvents.filter(e => e.severity === 'critical').length;
            
            if (criticalEvents > 0 || highSeverityEvents > 10) {
                analysis.riskLevel = 'critical';
            } else if (highSeverityEvents > 5 || analysis.attackPatterns.length > 2) {
                analysis.riskLevel = 'high';
            } else if (highSeverityEvents > 0 || analysis.attackPatterns.length > 0) {
                analysis.riskLevel = 'medium';
            }
            
            return analysis;

        } catch (error) {
            logger.error('Failed to analyze threat patterns:', error);
            return {
                suspiciousUsers: new Map(),
                attackPatterns: [],
                riskLevel: 'unknown',
                trends: { increasing: [], decreasing: [], stable: [] }
            };
        }
    }

    /**
     * Generate security recommendations
     * @param {Object} threatAnalysis - Threat analysis results
     * @param {Object} securityStats - Security statistics
     * @returns {Array} Security recommendations
     */
    generateSecurityRecommendations(threatAnalysis, securityStats) {
        const recommendations = [];
        
        try {
            // High-risk user recommendations
            if (threatAnalysis.suspiciousUsers.size > 0) {
                const highRiskUsers = Array.from(threatAnalysis.suspiciousUsers.values())
                    .filter(user => user.riskScore > 50);
                
                if (highRiskUsers.length > 0) {
                    recommendations.push({
                        priority: 'high',
                        category: 'user_management',
                        title: 'Review High-Risk Users',
                        description: `${highRiskUsers.length} users have high risk scores and should be reviewed`,
                        action: 'Review user activity and consider restrictions',
                        users: highRiskUsers.map(u => u.userId)
                    });
                }
            }
            
            // Attack pattern recommendations
            threatAnalysis.attackPatterns.forEach(pattern => {
                if (pattern.type === 'mass_join_attack') {
                    recommendations.push({
                        priority: 'high',
                        category: 'server_security',
                        title: 'Enable Server Verification',
                        description: 'Mass join attacks detected',
                        action: 'Consider enabling phone verification or higher verification levels'
                    });
                }
                
                if (pattern.type === 'bot_network') {
                    recommendations.push({
                        priority: 'high',
                        category: 'bot_protection',
                        title: 'Implement Bot Detection',
                        description: 'Bot network activity detected',
                        action: 'Review and ban suspicious bot accounts'
                    });
                }
                
                if (pattern.type === 'permission_escalation') {
                    recommendations.push({
                        priority: 'medium',
                        category: 'permissions',
                        title: 'Review Permission Structure',
                        description: 'Multiple permission escalation attempts detected',
                        action: 'Audit role permissions and implement principle of least privilege'
                    });
                }
            });
            
            // Rate limiting recommendations
            if (securityStats.recentEvents > 50) {
                recommendations.push({
                    priority: 'medium',
                    category: 'rate_limiting',
                    title: 'Adjust Rate Limits',
                    description: 'High activity levels detected',
                    action: 'Consider tightening rate limits for commands'
                });
            }
            
            // General security recommendations
            if (threatAnalysis.riskLevel === 'high' || threatAnalysis.riskLevel === 'critical') {
                recommendations.push({
                    priority: 'high',
                    category: 'monitoring',
                    title: 'Increase Monitoring',
                    description: 'High risk level detected',
                    action: 'Enable more frequent security reports and alerts'
                });
            }
            
            // Account age recommendations
            const newAccountEvents = securityStats.eventsByType?.new_account_activity || 0;
            if (newAccountEvents > 10) {
                recommendations.push({
                    priority: 'medium',
                    category: 'account_security',
                    title: 'Implement Account Age Restrictions',
                    description: 'High new account activity detected',
                    action: 'Consider increasing minimum account age requirements'
                });
            }

        } catch (error) {
            logger.error('Failed to generate security recommendations:', error);
        }
        
        return recommendations;
    }

    /**
     * Generate actionable items from analysis
     * @param {Object} threatAnalysis - Threat analysis
     * @param {Array} recommendations - Security recommendations
     * @returns {Array} Action items
     */
    generateActionItems(threatAnalysis, recommendations) {
        const actionItems = [];
        
        try {
            // Immediate actions for critical risks
            if (threatAnalysis.riskLevel === 'critical') {
                actionItems.push({
                    priority: 'immediate',
                    title: 'Critical Security Review',
                    description: 'Critical security events detected - immediate review required',
                    assignee: 'security_team',
                    dueDate: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
                });
            }
            
            // High-priority recommendations
            const highPriorityRecs = recommendations.filter(r => r.priority === 'high');
            highPriorityRecs.forEach(rec => {
                actionItems.push({
                    priority: 'high',
                    title: rec.title,
                    description: rec.action,
                    category: rec.category,
                    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
                });
            });
            
            // Medium-priority recommendations
            const mediumPriorityRecs = recommendations.filter(r => r.priority === 'medium');
            mediumPriorityRecs.forEach(rec => {
                actionItems.push({
                    priority: 'medium',
                    title: rec.title,
                    description: rec.action,
                    category: rec.category,
                    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
                });
            });
            
            // Regular maintenance items
            actionItems.push({
                priority: 'low',
                title: 'Regular Security Audit',
                description: 'Review security logs and update configurations',
                category: 'maintenance',
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
            });

        } catch (error) {
            logger.error('Failed to generate action items:', error);
        }
        
        return actionItems;
    }

    /**
     * Send security alert to configured channels
     * @param {Object} alert - Alert data
     * @param {string} guildId - Guild ID (optional)
     */
    async sendSecurityAlert(alert, guildId = null) {
        try {
            const alertMessage = this.formatSecurityAlert(alert);
            
            if (guildId && this.alertChannels.has(guildId)) {
                const channelId = this.alertChannels.get(guildId);
                const channel = await this.botService.client.channels.fetch(channelId);
                
                if (channel) {
                    await channel.send({
                        embeds: [alertMessage]
                    });
                }
            }
            
            // Log alert
            logger.security('Security alert sent', {
                alertType: alert.type,
                severity: alert.severity,
                guildId
            });

        } catch (error) {
            logger.error('Failed to send security alert:', error);
        }
    }

    /**
     * Format security alert as Discord embed
     * @param {Object} alert - Alert data
     * @returns {Object} Discord embed
     */
    formatSecurityAlert(alert) {
        const { EmbedBuilder } = require('discord.js');
        
        const colors = {
            low: 0x00ff00,      // Green
            medium: 0xffff00,   // Yellow
            high: 0xff8000,     // Orange
            critical: 0xff0000  // Red
        };
        
        const embed = new EmbedBuilder()
            .setTitle('🚨 Security Alert')
            .setDescription(alert.description || 'Security event detected')
            .setColor(colors[alert.severity] || colors.medium)
            .setTimestamp()
            .addFields([
                {
                    name: 'Alert Type',
                    value: alert.type || 'Unknown',
                    inline: true
                },
                {
                    name: 'Severity',
                    value: alert.severity?.toUpperCase() || 'UNKNOWN',
                    inline: true
                },
                {
                    name: 'Time',
                    value: new Date().toLocaleString(),
                    inline: true
                }
            ]);
        
        if (alert.details) {
            embed.addFields([{
                name: 'Details',
                value: typeof alert.details === 'string' ? 
                    alert.details : 
                    JSON.stringify(alert.details, null, 2).substring(0, 1000)
            }]);
        }
        
        if (alert.recommendations) {
            embed.addFields([{
                name: 'Recommended Actions',
                value: Array.isArray(alert.recommendations) ? 
                    alert.recommendations.join('\n') : 
                    alert.recommendations
            }]);
        }
        
        return embed;
    }

    /**
     * Configure alert channel for a guild
     * @param {string} guildId - Guild ID
     * @param {string} channelId - Channel ID for alerts
     */
    setAlertChannel(guildId, channelId) {
        this.alertChannels.set(guildId, channelId);
        logger.info('Security alert channel configured', { guildId, channelId });
    }

    /**
     * Remove alert channel for a guild
     * @param {string} guildId - Guild ID
     */
    removeAlertChannel(guildId) {
        this.alertChannels.delete(guildId);
        logger.info('Security alert channel removed', { guildId });
    }

    /**
     * Get recent security reports
     * @param {number} limit - Maximum number of reports
     * @returns {Array} Recent reports
     */
    getRecentReports(limit = 10) {
        return this.reports
            .sort((a, b) => b.generatedAt - a.generatedAt)
            .slice(0, limit);
    }

    /**
     * Helper methods for data analysis
     */
    
    groupEventsByType(events) {
        const grouped = {};
        events.forEach(event => {
            grouped[event.type] = (grouped[event.type] || 0) + 1;
        });
        return grouped;
    }
    
    groupEventsBySeverity(events) {
        const grouped = {};
        events.forEach(event => {
            grouped[event.severity] = (grouped[event.severity] || 0) + 1;
        });
        return grouped;
    }
    
    groupEventsByGuild(events) {
        const grouped = {};
        events.forEach(event => {
            if (event.guildId) {
                grouped[event.guildId] = (grouped[event.guildId] || 0) + 1;
            }
        });
        return grouped;
    }
    
    createEventTimeline(events) {
        const timeline = {};
        events.forEach(event => {
            const hour = new Date(event.timestamp).toISOString().substring(0, 13);
            timeline[hour] = (timeline[hour] || 0) + 1;
        });
        return timeline;
    }
    
    calculateEventRiskScore(event) {
        const scores = {
            bot_detection: 50,
            mass_joins: 30,
            permission_denied: 10,
            rapid_commands: 20,
            new_account_activity: 15,
            suspicious_pattern: 25,
            command_abuse: 20,
            rate_limit_exceeded: 5
        };
        
        const baseScore = scores[event.type] || 10;
        const severityMultiplier = {
            low: 1,
            medium: 2,
            high: 3,
            critical: 5
        };
        
        return baseScore * (severityMultiplier[event.severity] || 1);
    }
    
    identifyTopRisks(events, logs) {
        const risks = [];
        
        // Analyze event patterns
        const eventsByType = this.groupEventsByType(events);
        const eventsBySeverity = this.groupEventsBySeverity(events);
        
        // High-frequency events
        Object.entries(eventsByType).forEach(([type, count]) => {
            if (count > 10) {
                risks.push({
                    type: 'high_frequency_events',
                    description: `High frequency of ${type} events`,
                    count,
                    severity: count > 50 ? 'high' : 'medium'
                });
            }
        });
        
        // Critical events
        if (eventsBySeverity.critical > 0) {
            risks.push({
                type: 'critical_events',
                description: 'Critical security events detected',
                count: eventsBySeverity.critical,
                severity: 'critical'
            });
        }
        
        // Permission issues
        const permissionDenials = logs.filter(log => log.type === 'permission_denied').length;
        if (permissionDenials > 20) {
            risks.push({
                type: 'permission_issues',
                description: 'High number of permission denials',
                count: permissionDenials,
                severity: 'medium'
            });
        }
        
        return risks.sort((a, b) => {
            const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
            return severityOrder[b.severity] - severityOrder[a.severity];
        });
    }

    /**
     * Start scheduled reporting
     */
    startScheduledReporting() {
        // Daily reports at midnight
        if (this.reportSchedule.daily) {
            setInterval(async () => {
                const now = new Date();
                if (now.getHours() === 0 && now.getMinutes() === 0) {
                    await this.generateAndDistributeDailyReport();
                }
            }, 60000); // Check every minute
        }
        
        // Weekly reports on Sundays
        if (this.reportSchedule.weekly) {
            setInterval(async () => {
                const now = new Date();
                if (now.getDay() === 0 && now.getHours() === 1 && now.getMinutes() === 0) {
                    await this.generateAndDistributeWeeklyReport();
                }
            }, 60000);
        }
        
        logger.info('Scheduled security reporting started');
    }

    /**
     * Generate and distribute daily security report
     */
    async generateAndDistributeDailyReport() {
        try {
            const report = await this.generateSecurityReport('day');
            
            if (report && (report.summary.highSeverityEvents > 0 || report.summary.criticalEvents > 0)) {
                // Send alerts for significant daily activity
                for (const [guildId, channelId] of this.alertChannels.entries()) {
                    await this.sendSecurityAlert({
                        type: 'daily_report',
                        severity: report.summary.criticalEvents > 0 ? 'high' : 'medium',
                        description: `Daily security report: ${report.summary.totalSecurityEvents} events, ${report.summary.highSeverityEvents} high severity`,
                        details: report.summary
                    }, guildId);
                }
            }
            
            logger.info('Daily security report generated and distributed');

        } catch (error) {
            logger.error('Failed to generate daily security report:', error);
        }
    }

    /**
     * Generate and distribute weekly security report
     */
    async generateAndDistributeWeeklyReport() {
        try {
            const report = await this.generateSecurityReport('week');
            
            // Always send weekly reports
            for (const [guildId, channelId] of this.alertChannels.entries()) {
                await this.sendSecurityAlert({
                    type: 'weekly_report',
                    severity: 'low',
                    description: `Weekly security summary: ${report.summary.totalSecurityEvents} events processed`,
                    details: report.summary,
                    recommendations: report.recommendations.slice(0, 3).map(r => r.title)
                }, guildId);
            }
            
            logger.info('Weekly security report generated and distributed');

        } catch (error) {
            logger.error('Failed to generate weekly security report:', error);
        }
    }

    /**
     * Clear all reports and data
     */
    clear() {
        const reportCount = this.reports.length;
        const alertChannelCount = this.alertChannels.size;
        
        this.reports = [];
        this.alertChannels.clear();
        
        logger.info('Security reporter cleared', {
            clearedReports: reportCount,
            clearedAlertChannels: alertChannelCount
        });
    }
}

module.exports = SecurityReporter;