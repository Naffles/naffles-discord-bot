const logger = require('../utils/logger');

/**
 * Task Analytics Service
 * Provides comprehensive analytics and completion tracking for community administrators
 * Handles real-time metrics, performance analysis, and reporting
 */
class TaskAnalyticsService {
    constructor(botService) {
        this.botService = botService;
        
        // Analytics cache
        this.analyticsCache = new Map();
        this.cacheExpiry = 3 * 60 * 1000; // 3 minutes
        
        // Real-time metrics tracking
        this.metricsBuffer = new Map();
        this.metricsFlushInterval = 30000; // 30 seconds
        
        // Start metrics flushing
        this.startMetricsFlushing();
    }

    /**
     * Get comprehensive task analytics for community administrators
     * @param {string} communityId - Community ID
     * @param {string} adminUserId - Admin user ID
     * @param {Object} options - Analytics options
     * @returns {Promise<Object>} Comprehensive analytics data
     */
    async getCommunityTaskAnalytics(communityId, adminUserId, options = {}) {
        try {
            logger.info('Getting community task analytics:', {
                communityId,
                adminUserId,
                timeframe: options.timeframe || '30d'
            });

            // Verify admin permissions
            const hasPermission = await this.verifyAdminPermissions(communityId, adminUserId);
            if (!hasPermission) {
                throw new Error('Insufficient permissions to view analytics');
            }

            const cacheKey = `community_analytics_${communityId}_${options.timeframe || '30d'}`;
            const cached = this.analyticsCache.get(cacheKey);
            
            if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
                return cached.data;
            }

            // Get analytics from multiple sources
            const [
                taskOverview,
                completionMetrics,
                userEngagement,
                discordMetrics,
                performanceData
            ] = await Promise.all([
                this.getTaskOverview(communityId, options),
                this.getCompletionMetrics(communityId, options),
                this.getUserEngagementMetrics(communityId, options),
                this.getDiscordMetrics(communityId, options),
                this.getPerformanceData(communityId, options)
            ]);

            const analytics = {
                communityId,
                timeframe: options.timeframe || '30d',
                generatedAt: new Date(),
                overview: taskOverview,
                completions: completionMetrics,
                engagement: userEngagement,
                discord: discordMetrics,
                performance: performanceData,
                insights: await this.generateInsights(communityId, {
                    taskOverview,
                    completionMetrics,
                    userEngagement,
                    discordMetrics,
                    performanceData
                })
            };

            // Cache the result
            this.analyticsCache.set(cacheKey, {
                data: analytics,
                timestamp: Date.now()
            });

            return analytics;

        } catch (error) {
            logger.error('Error getting community task analytics:', error);
            throw error;
        }
    }

    /**
     * Get analytics for specific task
     * @param {string} taskId - Task ID
     * @param {string} adminUserId - Admin user ID
     * @param {Object} options - Analytics options
     * @returns {Promise<Object>} Task-specific analytics
     */
    async getTaskAnalytics(taskId, adminUserId, options = {}) {
        try {
            logger.info('Getting task analytics:', {
                taskId,
                adminUserId
            });

            // Get task details and verify permissions
            const task = await this.getTaskDetails(taskId);
            if (!task) {
                throw new Error('Task not found');
            }

            const hasPermission = await this.verifyAdminPermissions(task.communityId, adminUserId);
            if (!hasPermission) {
                throw new Error('Insufficient permissions to view task analytics');
            }

            const cacheKey = `task_analytics_${taskId}`;
            const cached = this.analyticsCache.get(cacheKey);
            
            if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
                return cached.data;
            }

            // Get comprehensive task analytics
            const [
                basicMetrics,
                completionData,
                userInteractions,
                discordActivity,
                timelineData
            ] = await Promise.all([
                this.getTaskBasicMetrics(taskId),
                this.getTaskCompletionData(taskId),
                this.getTaskUserInteractions(taskId),
                this.getTaskDiscordActivity(taskId),
                this.getTaskTimelineData(taskId)
            ]);

            const analytics = {
                taskId,
                task: {
                    id: task.id,
                    title: task.title,
                    type: task.type,
                    status: task.status,
                    createdAt: task.createdAt
                },
                generatedAt: new Date(),
                metrics: basicMetrics,
                completions: completionData,
                interactions: userInteractions,
                discord: discordActivity,
                timeline: timelineData,
                insights: await this.generateTaskInsights(taskId, {
                    basicMetrics,
                    completionData,
                    userInteractions,
                    discordActivity
                })
            };

            // Cache the result
            this.analyticsCache.set(cacheKey, {
                data: analytics,
                timestamp: Date.now()
            });

            return analytics;

        } catch (error) {
            logger.error('Error getting task analytics:', error);
            throw error;
        }
    }

    /**
     * Track real-time task interaction
     * @param {string} taskId - Task ID
     * @param {string} interactionType - Type of interaction
     * @param {Object} interactionData - Interaction data
     * @returns {Promise<void>}
     */
    async trackTaskInteraction(taskId, interactionType, interactionData) {
        try {
            const metricKey = `${taskId}_${interactionType}`;
            
            // Add to metrics buffer
            if (!this.metricsBuffer.has(metricKey)) {
                this.metricsBuffer.set(metricKey, []);
            }
            
            this.metricsBuffer.get(metricKey).push({
                timestamp: new Date(),
                ...interactionData
            });

            // Clear analytics cache for this task
            this.clearTaskAnalyticsCache(taskId);

        } catch (error) {
            logger.error('Error tracking task interaction:', error);
        }
    }

    /**
     * Get completion tracking data for task
     * @param {string} taskId - Task ID
     * @param {Object} options - Tracking options
     * @returns {Promise<Object>} Completion tracking data
     */
    async getCompletionTracking(taskId, options = {}) {
        try {
            const [
                recentCompletions,
                completionTrends,
                userProgress,
                verificationQueue
            ] = await Promise.all([
                this.getRecentCompletions(taskId, options.limit || 10),
                this.getCompletionTrends(taskId, options.timeframe || '7d'),
                this.getUserProgressData(taskId),
                this.getVerificationQueue(taskId)
            ]);

            return {
                taskId,
                recent: recentCompletions,
                trends: completionTrends,
                userProgress,
                verification: verificationQueue,
                summary: {
                    totalCompletions: recentCompletions.length,
                    pendingVerifications: verificationQueue.length,
                    averageCompletionTime: this.calculateAverageCompletionTime(recentCompletions),
                    successRate: this.calculateSuccessRate(completionTrends)
                }
            };

        } catch (error) {
            logger.error('Error getting completion tracking:', error);
            throw error;
        }
    }

    /**
     * Generate analytics report for community
     * @param {string} communityId - Community ID
     * @param {string} adminUserId - Admin user ID
     * @param {Object} reportOptions - Report configuration
     * @returns {Promise<Object>} Analytics report
     */
    async generateAnalyticsReport(communityId, adminUserId, reportOptions = {}) {
        try {
            logger.info('Generating analytics report:', {
                communityId,
                adminUserId,
                reportType: reportOptions.type || 'comprehensive'
            });

            const analytics = await this.getCommunityTaskAnalytics(communityId, adminUserId, reportOptions);
            
            const report = {
                reportId: `report_${Date.now()}`,
                communityId,
                generatedAt: new Date(),
                generatedBy: adminUserId,
                type: reportOptions.type || 'comprehensive',
                timeframe: reportOptions.timeframe || '30d',
                data: analytics,
                summary: this.generateReportSummary(analytics),
                recommendations: await this.generateRecommendations(analytics),
                exportOptions: {
                    csv: true,
                    pdf: true,
                    json: true
                }
            };

            // Store report for future access
            await this.storeAnalyticsReport(report);

            return report;

        } catch (error) {
            logger.error('Error generating analytics report:', error);
            throw error;
        }
    }

    /**
     * Get real-time dashboard data
     * @param {string} communityId - Community ID
     * @param {string} adminUserId - Admin user ID
     * @returns {Promise<Object>} Real-time dashboard data
     */
    async getRealTimeDashboard(communityId, adminUserId) {
        try {
            // Verify permissions
            const hasPermission = await this.verifyAdminPermissions(communityId, adminUserId);
            if (!hasPermission) {
                throw new Error('Insufficient permissions to view dashboard');
            }

            const [
                activeTasks,
                recentActivity,
                liveMetrics,
                pendingActions
            ] = await Promise.all([
                this.getActiveTasks(communityId),
                this.getRecentActivity(communityId, 24), // Last 24 hours
                this.getLiveMetrics(communityId),
                this.getPendingActions(communityId)
            ]);

            return {
                communityId,
                lastUpdated: new Date(),
                activeTasks: {
                    count: activeTasks.length,
                    tasks: activeTasks.map(task => ({
                        id: task.id,
                        title: task.title,
                        type: task.type,
                        completions: task.stats?.totalCompletions || 0,
                        views: task.stats?.totalViews || 0,
                        status: task.status
                    }))
                },
                recentActivity: {
                    count: recentActivity.length,
                    activities: recentActivity.slice(0, 10) // Latest 10
                },
                liveMetrics,
                pendingActions: {
                    verifications: pendingActions.verifications || 0,
                    reports: pendingActions.reports || 0,
                    appeals: pendingActions.appeals || 0
                }
            };

        } catch (error) {
            logger.error('Error getting real-time dashboard:', error);
            throw error;
        }
    }

    // Private helper methods

    /**
     * Start metrics flushing interval
     * @private
     */
    startMetricsFlushing() {
        setInterval(async () => {
            await this.flushMetricsBuffer();
        }, this.metricsFlushInterval);
    }

    /**
     * Flush metrics buffer to database
     * @private
     */
    async flushMetricsBuffer() {
        try {
            if (this.metricsBuffer.size === 0) return;

            const metricsToFlush = new Map(this.metricsBuffer);
            this.metricsBuffer.clear();

            for (const [metricKey, metrics] of metricsToFlush) {
                try {
                    await this.storeMetrics(metricKey, metrics);
                } catch (error) {
                    logger.error('Error storing metrics:', error);
                }
            }

        } catch (error) {
            logger.error('Error flushing metrics buffer:', error);
        }
    }

    /**
     * Get task overview metrics
     * @private
     */
    async getTaskOverview(communityId, options) {
        try {
            const tasks = await this.botService.makeNafflesApiCall(
                `/api/social-tasks/community/${communityId}/overview?timeframe=${options.timeframe || '30d'}`
            );

            return {
                totalTasks: tasks.length,
                activeTasks: tasks.filter(t => t.status === 'active').length,
                completedTasks: tasks.filter(t => t.status === 'completed').length,
                expiredTasks: tasks.filter(t => t.status === 'expired').length,
                taskTypes: this.aggregateTaskTypes(tasks),
                averageCompletionRate: this.calculateAverageCompletionRate(tasks)
            };

        } catch (error) {
            logger.error('Error getting task overview:', error);
            return {};
        }
    }

    /**
     * Get completion metrics
     * @private
     */
    async getCompletionMetrics(communityId, options) {
        try {
            const completions = await this.botService.makeNafflesApiCall(
                `/api/social-tasks/community/${communityId}/completions?timeframe=${options.timeframe || '30d'}`
            );

            return {
                totalCompletions: completions.length,
                successfulCompletions: completions.filter(c => c.status === 'completed').length,
                pendingCompletions: completions.filter(c => c.status === 'pending').length,
                rejectedCompletions: completions.filter(c => c.status === 'rejected').length,
                averageCompletionTime: this.calculateAverageCompletionTime(completions),
                completionsByDay: this.aggregateCompletionsByDay(completions),
                completionsByType: this.aggregateCompletionsByType(completions)
            };

        } catch (error) {
            logger.error('Error getting completion metrics:', error);
            return {};
        }
    }

    /**
     * Get user engagement metrics
     * @private
     */
    async getUserEngagementMetrics(communityId, options) {
        try {
            const engagement = await this.botService.makeNafflesApiCall(
                `/api/social-tasks/community/${communityId}/engagement?timeframe=${options.timeframe || '30d'}`
            );

            return {
                totalUsers: engagement.totalUsers || 0,
                activeUsers: engagement.activeUsers || 0,
                newUsers: engagement.newUsers || 0,
                returningUsers: engagement.returningUsers || 0,
                averageTasksPerUser: engagement.averageTasksPerUser || 0,
                topPerformers: engagement.topPerformers || [],
                engagementTrends: engagement.trends || []
            };

        } catch (error) {
            logger.error('Error getting user engagement metrics:', error);
            return {};
        }
    }

    /**
     * Get Discord-specific metrics
     * @private
     */
    async getDiscordMetrics(communityId, options) {
        try {
            const discordData = await this.botService.db.getCommunityDiscordMetrics(communityId, options);

            return {
                totalDiscordInteractions: discordData.totalInteractions || 0,
                buttonClicks: discordData.buttonClicks || 0,
                embedViews: discordData.embedViews || 0,
                commandUsage: discordData.commandUsage || {},
                messagesSent: discordData.messagesSent || 0,
                averageResponseTime: discordData.averageResponseTime || 0,
                mostActiveChannels: discordData.mostActiveChannels || []
            };

        } catch (error) {
            logger.error('Error getting Discord metrics:', error);
            return {};
        }
    }

    /**
     * Get performance data
     * @private
     */
    async getPerformanceData(communityId, options) {
        try {
            const performance = await this.botService.makeNafflesApiCall(
                `/api/social-tasks/community/${communityId}/performance?timeframe=${options.timeframe || '30d'}`
            );

            return {
                averageTaskCreationTime: performance.averageTaskCreationTime || 0,
                averageVerificationTime: performance.averageVerificationTime || 0,
                systemUptime: performance.systemUptime || 100,
                errorRate: performance.errorRate || 0,
                apiResponseTimes: performance.apiResponseTimes || {},
                bottlenecks: performance.bottlenecks || []
            };

        } catch (error) {
            logger.error('Error getting performance data:', error);
            return {};
        }
    }

    /**
     * Generate insights from analytics data
     * @private
     */
    async generateInsights(communityId, analyticsData) {
        const insights = [];

        try {
            // Task completion insights
            if (analyticsData.completionMetrics.totalCompletions > 0) {
                const successRate = (analyticsData.completionMetrics.successfulCompletions / analyticsData.completionMetrics.totalCompletions) * 100;
                
                if (successRate > 80) {
                    insights.push({
                        type: 'positive',
                        category: 'completion_rate',
                        title: 'High Success Rate',
                        message: `Your tasks have a ${successRate.toFixed(1)}% success rate, indicating well-designed tasks.`,
                        priority: 'low'
                    });
                } else if (successRate < 50) {
                    insights.push({
                        type: 'warning',
                        category: 'completion_rate',
                        title: 'Low Success Rate',
                        message: `Your tasks have a ${successRate.toFixed(1)}% success rate. Consider reviewing task requirements.`,
                        priority: 'high',
                        recommendations: [
                            'Review task difficulty and requirements',
                            'Provide clearer instructions',
                            'Consider reducing complexity'
                        ]
                    });
                }
            }

            // Engagement insights
            if (analyticsData.userEngagement.totalUsers > 0) {
                const engagementRate = (analyticsData.userEngagement.activeUsers / analyticsData.userEngagement.totalUsers) * 100;
                
                if (engagementRate < 30) {
                    insights.push({
                        type: 'warning',
                        category: 'engagement',
                        title: 'Low User Engagement',
                        message: `Only ${engagementRate.toFixed(1)}% of users are actively completing tasks.`,
                        priority: 'medium',
                        recommendations: [
                            'Increase task rewards',
                            'Create more engaging task types',
                            'Improve task visibility'
                        ]
                    });
                }
            }

            // Discord activity insights
            if (analyticsData.discordMetrics.totalDiscordInteractions > 0) {
                const clickRate = (analyticsData.discordMetrics.buttonClicks / analyticsData.discordMetrics.embedViews) * 100;
                
                if (clickRate > 15) {
                    insights.push({
                        type: 'positive',
                        category: 'discord_engagement',
                        title: 'High Discord Engagement',
                        message: `Your Discord posts have a ${clickRate.toFixed(1)}% click-through rate.`,
                        priority: 'low'
                    });
                }
            }

            // Performance insights
            if (analyticsData.performanceData.errorRate > 5) {
                insights.push({
                    type: 'error',
                    category: 'performance',
                    title: 'High Error Rate',
                    message: `System error rate is ${analyticsData.performanceData.errorRate}%, which may affect user experience.`,
                    priority: 'high',
                    recommendations: [
                        'Review system logs for common errors',
                        'Check API integrations',
                        'Monitor system resources'
                    ]
                });
            }

            return insights;

        } catch (error) {
            logger.error('Error generating insights:', error);
            return [];
        }
    }

    /**
     * Generate task-specific insights
     * @private
     */
    async generateTaskInsights(taskId, analyticsData) {
        const insights = [];

        try {
            // Completion rate insight
            if (analyticsData.basicMetrics.totalViews > 0) {
                const completionRate = (analyticsData.basicMetrics.totalCompletions / analyticsData.basicMetrics.totalViews) * 100;
                
                if (completionRate < 10) {
                    insights.push({
                        type: 'warning',
                        title: 'Low Completion Rate',
                        message: `Only ${completionRate.toFixed(1)}% of viewers complete this task.`,
                        recommendations: [
                            'Simplify task requirements',
                            'Improve task description',
                            'Increase reward amount'
                        ]
                    });
                }
            }

            // Time-based insights
            if (analyticsData.completionData.averageCompletionTime > 0) {
                const avgTime = analyticsData.completionData.averageCompletionTime;
                
                if (avgTime > 300) { // 5 minutes
                    insights.push({
                        type: 'info',
                        title: 'Long Completion Time',
                        message: `Users take an average of ${Math.round(avgTime / 60)} minutes to complete this task.`,
                        recommendations: [
                            'Consider breaking into smaller tasks',
                            'Provide step-by-step guidance'
                        ]
                    });
                }
            }

            return insights;

        } catch (error) {
            logger.error('Error generating task insights:', error);
            return [];
        }
    }

    /**
     * Verify admin permissions
     * @private
     */
    async verifyAdminPermissions(communityId, userId) {
        try {
            const membership = await this.botService.makeNafflesApiCall(
                `/api/communities/${communityId}/members/${userId}`
            );

            return membership && (membership.role === 'admin' || membership.role === 'owner');

        } catch (error) {
            logger.error('Error verifying admin permissions:', error);
            return false;
        }
    }

    /**
     * Get task details
     * @private
     */
    async getTaskDetails(taskId) {
        try {
            return await this.botService.makeNafflesApiCall(`/api/social-tasks/${taskId}`);
        } catch (error) {
            logger.error('Error getting task details:', error);
            return null;
        }
    }

    /**
     * Clear task analytics cache
     * @private
     */
    clearTaskAnalyticsCache(taskId) {
        const keysToDelete = [];
        
        for (const key of this.analyticsCache.keys()) {
            if (key.includes(taskId)) {
                keysToDelete.push(key);
            }
        }
        
        keysToDelete.forEach(key => this.analyticsCache.delete(key));
    }

    /**
     * Store metrics to database
     * @private
     */
    async storeMetrics(metricKey, metrics) {
        try {
            await this.botService.db.storeTaskMetrics(metricKey, metrics);
        } catch (error) {
            logger.error('Error storing metrics:', error);
        }
    }

    /**
     * Store analytics report
     * @private
     */
    async storeAnalyticsReport(report) {
        try {
            await this.botService.db.storeAnalyticsReport(report);
        } catch (error) {
            logger.error('Error storing analytics report:', error);
        }
    }

    // Utility calculation methods

    /**
     * Calculate average completion rate
     * @private
     */
    calculateAverageCompletionRate(tasks) {
        if (!tasks || tasks.length === 0) return 0;
        
        const rates = tasks.map(task => {
            const views = task.stats?.totalViews || 0;
            const completions = task.stats?.totalCompletions || 0;
            return views > 0 ? (completions / views) * 100 : 0;
        });
        
        return rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
    }

    /**
     * Calculate average completion time
     * @private
     */
    calculateAverageCompletionTime(completions) {
        if (!completions || completions.length === 0) return 0;
        
        const times = completions
            .filter(c => c.completionTime)
            .map(c => c.completionTime);
        
        if (times.length === 0) return 0;
        
        return times.reduce((sum, time) => sum + time, 0) / times.length;
    }

    /**
     * Calculate success rate
     * @private
     */
    calculateSuccessRate(trends) {
        if (!trends || !trends.totalAttempts) return 0;
        return (trends.successfulCompletions / trends.totalAttempts) * 100;
    }

    /**
     * Aggregate task types
     * @private
     */
    aggregateTaskTypes(tasks) {
        const types = {};
        tasks.forEach(task => {
            types[task.type] = (types[task.type] || 0) + 1;
        });
        return types;
    }

    /**
     * Aggregate completions by day
     * @private
     */
    aggregateCompletionsByDay(completions) {
        const byDay = {};
        completions.forEach(completion => {
            const day = new Date(completion.completedAt).toISOString().split('T')[0];
            byDay[day] = (byDay[day] || 0) + 1;
        });
        return byDay;
    }

    /**
     * Aggregate completions by type
     * @private
     */
    aggregateCompletionsByType(completions) {
        const byType = {};
        completions.forEach(completion => {
            const type = completion.task?.type || 'unknown';
            byType[type] = (byType[type] || 0) + 1;
        });
        return byType;
    }

    /**
     * Generate report summary
     * @private
     */
    generateReportSummary(analytics) {
        return {
            totalTasks: analytics.overview?.totalTasks || 0,
            totalCompletions: analytics.completions?.totalCompletions || 0,
            activeUsers: analytics.engagement?.activeUsers || 0,
            successRate: analytics.completions?.successfulCompletions && analytics.completions?.totalCompletions
                ? (analytics.completions.successfulCompletions / analytics.completions.totalCompletions) * 100
                : 0,
            topPerformingTaskType: this.getTopPerformingTaskType(analytics),
            keyInsights: analytics.insights?.slice(0, 3) || []
        };
    }

    /**
     * Get top performing task type
     * @private
     */
    getTopPerformingTaskType(analytics) {
        if (!analytics.completions?.completionsByType) return 'N/A';
        
        const types = analytics.completions.completionsByType;
        const topType = Object.keys(types).reduce((a, b) => types[a] > types[b] ? a : b, '');
        
        return topType || 'N/A';
    }

    /**
     * Generate recommendations
     * @private
     */
    async generateRecommendations(analytics) {
        const recommendations = [];

        // Add recommendations based on analytics data
        if (analytics.overview?.activeTasks < 3) {
            recommendations.push({
                category: 'task_creation',
                priority: 'medium',
                title: 'Create More Tasks',
                description: 'Consider creating more active tasks to increase user engagement.',
                action: 'Create 2-3 new tasks this week'
            });
        }

        if (analytics.engagement?.activeUsers < analytics.engagement?.totalUsers * 0.3) {
            recommendations.push({
                category: 'engagement',
                priority: 'high',
                title: 'Improve User Engagement',
                description: 'Low user engagement detected. Consider increasing rewards or simplifying tasks.',
                action: 'Review task difficulty and reward structure'
            });
        }

        return recommendations;
    }

    // Additional helper methods for specific analytics queries

    /**
     * Get recent completions
     * @private
     */
    async getRecentCompletions(taskId, limit = 10) {
        try {
            return await this.botService.makeNafflesApiCall(
                `/api/social-tasks/${taskId}/completions/recent?limit=${limit}`
            );
        } catch (error) {
            logger.error('Error getting recent completions:', error);
            return [];
        }
    }

    /**
     * Get completion trends
     * @private
     */
    async getCompletionTrends(taskId, timeframe = '7d') {
        try {
            return await this.botService.makeNafflesApiCall(
                `/api/social-tasks/${taskId}/trends?timeframe=${timeframe}`
            );
        } catch (error) {
            logger.error('Error getting completion trends:', error);
            return {};
        }
    }

    /**
     * Get user progress data
     * @private
     */
    async getUserProgressData(taskId) {
        try {
            return await this.botService.makeNafflesApiCall(
                `/api/social-tasks/${taskId}/user-progress`
            );
        } catch (error) {
            logger.error('Error getting user progress data:', error);
            return [];
        }
    }

    /**
     * Get verification queue
     * @private
     */
    async getVerificationQueue(taskId) {
        try {
            return await this.botService.makeNafflesApiCall(
                `/api/social-tasks/${taskId}/verification-queue`
            );
        } catch (error) {
            logger.error('Error getting verification queue:', error);
            return [];
        }
    }

    /**
     * Get active tasks
     * @private
     */
    async getActiveTasks(communityId) {
        try {
            return await this.botService.makeNafflesApiCall(
                `/api/social-tasks/community/${communityId}?status=active`
            );
        } catch (error) {
            logger.error('Error getting active tasks:', error);
            return [];
        }
    }

    /**
     * Get recent activity
     * @private
     */
    async getRecentActivity(communityId, hours = 24) {
        try {
            return await this.botService.makeNafflesApiCall(
                `/api/social-tasks/community/${communityId}/activity?hours=${hours}`
            );
        } catch (error) {
            logger.error('Error getting recent activity:', error);
            return [];
        }
    }

    /**
     * Get live metrics
     * @private
     */
    async getLiveMetrics(communityId) {
        try {
            return await this.botService.makeNafflesApiCall(
                `/api/social-tasks/community/${communityId}/live-metrics`
            );
        } catch (error) {
            logger.error('Error getting live metrics:', error);
            return {};
        }
    }

    /**
     * Get pending actions
     * @private
     */
    async getPendingActions(communityId) {
        try {
            return await this.botService.makeNafflesApiCall(
                `/api/social-tasks/community/${communityId}/pending-actions`
            );
        } catch (error) {
            logger.error('Error getting pending actions:', error);
            return {};
        }
    }

    /**
     * Get task basic metrics
     * @private
     */
    async getTaskBasicMetrics(taskId) {
        try {
            return await this.botService.makeNafflesApiCall(
                `/api/social-tasks/${taskId}/metrics`
            );
        } catch (error) {
            logger.error('Error getting task basic metrics:', error);
            return {};
        }
    }

    /**
     * Get task completion data
     * @private
     */
    async getTaskCompletionData(taskId) {
        try {
            return await this.botService.makeNafflesApiCall(
                `/api/social-tasks/${taskId}/completion-data`
            );
        } catch (error) {
            logger.error('Error getting task completion data:', error);
            return {};
        }
    }

    /**
     * Get task user interactions
     * @private
     */
    async getTaskUserInteractions(taskId) {
        try {
            return await this.botService.makeNafflesApiCall(
                `/api/social-tasks/${taskId}/interactions`
            );
        } catch (error) {
            logger.error('Error getting task user interactions:', error);
            return {};
        }
    }

    /**
     * Get task Discord activity
     * @private
     */
    async getTaskDiscordActivity(taskId) {
        try {
            return await this.botService.db.getTaskDiscordActivity(taskId);
        } catch (error) {
            logger.error('Error getting task Discord activity:', error);
            return {};
        }
    }

    /**
     * Get task timeline data
     * @private
     */
    async getTaskTimelineData(taskId) {
        try {
            return await this.botService.makeNafflesApiCall(
                `/api/social-tasks/${taskId}/timeline`
            );
        } catch (error) {
            logger.error('Error getting task timeline data:', error);
            return [];
        }
    }
}

module.exports = TaskAnalyticsService;