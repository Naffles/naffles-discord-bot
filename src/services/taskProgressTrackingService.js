const logger = require('../utils/logger');

/**
 * Task Progress Tracking Service
 * Provides real-time updates and user feedback for social task progress
 * Handles completion verification, progress analytics, and user notifications
 */
class TaskProgressTrackingService {
    constructor(botService) {
        this.botService = botService;
        
        // Active tracking sessions
        this.trackingSessions = new Map();
        
        // Progress update intervals
        this.updateIntervals = new Map();
        
        // User feedback queue
        this.feedbackQueue = new Map();
        
        // Analytics cache
        this.analyticsCache = new Map();
        this.analyticsCacheExpiry = 2 * 60 * 1000; // 2 minutes
    }

    /**
     * Start tracking progress for a task
     * @param {string} taskId - Task ID
     * @param {Object} trackingConfig - Tracking configuration
     * @returns {Promise<void>}
     */
    async startTaskTracking(taskId, trackingConfig = {}) {
        try {
            logger.info('Starting task progress tracking:', {
                taskId,
                updateFrequency: trackingConfig.updateFrequency || 30000
            });

            // Initialize tracking session
            const session = {
                taskId,
                startedAt: new Date(),
                updateFrequency: trackingConfig.updateFrequency || 30000,
                lastUpdate: null,
                totalUpdates: 0,
                isActive: true,
                config: trackingConfig
            };

            this.trackingSessions.set(taskId, session);

            // Start periodic updates
            await this.startPeriodicUpdates(taskId, session);

            // Initialize progress analytics
            await this.initializeProgressAnalytics(taskId);

            logger.info('Task progress tracking started:', { taskId });

        } catch (error) {
            logger.error('Error starting task progress tracking:', error);
            throw error;
        }
    }

    /**
     * Stop tracking progress for a task
     * @param {string} taskId - Task ID
     * @returns {Promise<void>}
     */
    async stopTaskTracking(taskId) {
        try {
            logger.info('Stopping task progress tracking:', { taskId });

            // Clear update interval
            const intervalId = this.updateIntervals.get(taskId);
            if (intervalId) {
                clearInterval(intervalId);
                this.updateIntervals.delete(taskId);
            }

            // Mark session as inactive
            const session = this.trackingSessions.get(taskId);
            if (session) {
                session.isActive = false;
                session.stoppedAt = new Date();
            }

            // Process any remaining feedback
            await this.processPendingFeedback(taskId);

            logger.info('Task progress tracking stopped:', { taskId });

        } catch (error) {
            logger.error('Error stopping task progress tracking:', error);
        }
    }

    /**
     * Update task progress with new data
     * @param {string} taskId - Task ID
     * @param {Object} progressData - Progress update data
     * @returns {Promise<void>}
     */
    async updateTaskProgress(taskId, progressData) {
        try {
            const session = this.trackingSessions.get(taskId);
            if (!session || !session.isActive) {
                logger.warn('No active tracking session for task:', { taskId });
                return;
            }

            logger.debug('Updating task progress:', {
                taskId,
                updateType: progressData.type
            });

            // Update session data
            session.lastUpdate = new Date();
            session.totalUpdates++;

            // Process different types of progress updates
            switch (progressData.type) {
                case 'completion_attempt':
                    await this.handleCompletionAttempt(taskId, progressData);
                    break;
                
                case 'completion_success':
                    await this.handleCompletionSuccess(taskId, progressData);
                    break;
                
                case 'completion_failure':
                    await this.handleCompletionFailure(taskId, progressData);
                    break;
                
                case 'view_count_update':
                    await this.handleViewCountUpdate(taskId, progressData);
                    break;
                
                case 'analytics_update':
                    await this.handleAnalyticsUpdate(taskId, progressData);
                    break;
                
                default:
                    logger.warn('Unknown progress update type:', progressData.type);
            }

            // Update Discord embeds if needed
            if (progressData.updateEmbed !== false) {
                await this.updateDiscordEmbeds(taskId, progressData);
            }

            // Update analytics
            await this.updateProgressAnalytics(taskId, progressData);

        } catch (error) {
            logger.error('Error updating task progress:', error);
        }
    }

    /**
     * Get current progress for a task
     * @param {string} taskId - Task ID
     * @returns {Promise<Object>} Current progress data
     */
    async getCurrentProgress(taskId) {
        try {
            const cacheKey = `progress_${taskId}`;
            const cached = this.analyticsCache.get(cacheKey);
            
            if (cached && (Date.now() - cached.timestamp) < this.analyticsCacheExpiry) {
                return cached.data;
            }

            // Get progress from multiple sources
            const [taskData, analytics, discordMetrics] = await Promise.all([
                this.getTaskData(taskId),
                this.getTaskAnalytics(taskId),
                this.getDiscordMetrics(taskId)
            ]);

            const progress = {
                taskId,
                status: taskData?.status || 'unknown',
                totalCompletions: analytics?.totalCompletions || 0,
                totalAttempts: analytics?.totalAttempts || 0,
                successRate: this.calculateSuccessRate(analytics),
                discordViews: discordMetrics?.views || 0,
                discordInteractions: discordMetrics?.interactions || 0,
                lastUpdated: new Date(),
                isTracking: this.trackingSessions.has(taskId)
            };

            // Cache the result
            this.analyticsCache.set(cacheKey, {
                data: progress,
                timestamp: Date.now()
            });

            return progress;

        } catch (error) {
            logger.error('Error getting current progress:', error);
            return {
                taskId,
                status: 'error',
                totalCompletions: 0,
                totalAttempts: 0,
                successRate: 0,
                discordViews: 0,
                discordInteractions: 0,
                lastUpdated: new Date(),
                isTracking: false
            };
        }
    }

    /**
     * Provide user feedback for task interaction
     * @param {string} taskId - Task ID
     * @param {string} userId - User ID
     * @param {Object} feedbackData - Feedback data
     * @returns {Promise<void>}
     */
    async provideUserFeedback(taskId, userId, feedbackData) {
        try {
            logger.debug('Providing user feedback:', {
                taskId,
                userId,
                feedbackType: feedbackData.type
            });

            const feedbackKey = `${taskId}_${userId}`;
            
            // Store feedback in queue
            this.feedbackQueue.set(feedbackKey, {
                taskId,
                userId,
                ...feedbackData,
                timestamp: new Date()
            });

            // Process feedback immediately if possible
            await this.processFeedback(feedbackKey);

        } catch (error) {
            logger.error('Error providing user feedback:', error);
        }
    }

    /**
     * Get task completion verification status
     * @param {string} taskId - Task ID
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Verification status
     */
    async getCompletionVerificationStatus(taskId, userId) {
        try {
            // Check with Naffles API
            const completion = await this.botService.makeNafflesApiCall(
                `/api/social-tasks/${taskId}/completions/${userId}`
            ).catch(() => null);

            if (!completion) {
                return {
                    status: 'not_completed',
                    verified: false,
                    canAttempt: true
                };
            }

            return {
                status: completion.status,
                verified: completion.status === 'completed' || completion.status === 'approved',
                canAttempt: false,
                completedAt: completion.completedAt,
                verificationMethod: completion.verification?.method,
                pointsAwarded: completion.rewards?.pointsAwarded
            };

        } catch (error) {
            logger.error('Error getting completion verification status:', error);
            return {
                status: 'error',
                verified: false,
                canAttempt: false
            };
        }
    }

    /**
     * Generate progress report for task
     * @param {string} taskId - Task ID
     * @param {Object} options - Report options
     * @returns {Promise<Object>} Progress report
     */
    async generateProgressReport(taskId, options = {}) {
        try {
            const progress = await this.getCurrentProgress(taskId);
            const session = this.trackingSessions.get(taskId);
            const analytics = await this.getDetailedAnalytics(taskId);

            const report = {
                taskId,
                generatedAt: new Date(),
                trackingSession: session ? {
                    startedAt: session.startedAt,
                    duration: session.stoppedAt ? 
                        session.stoppedAt - session.startedAt : 
                        Date.now() - session.startedAt,
                    totalUpdates: session.totalUpdates,
                    isActive: session.isActive
                } : null,
                progress,
                analytics,
                summary: {
                    completionRate: this.calculateCompletionRate(analytics),
                    averageCompletionTime: this.calculateAverageCompletionTime(analytics),
                    mostActiveHour: this.findMostActiveHour(analytics),
                    topCompletionMethods: this.getTopCompletionMethods(analytics)
                }
            };

            return report;

        } catch (error) {
            logger.error('Error generating progress report:', error);
            throw error;
        }
    }

    // Private helper methods

    /**
     * Start periodic updates for a task
     * @private
     */
    async startPeriodicUpdates(taskId, session) {
        try {
            const intervalId = setInterval(async () => {
                try {
                    if (!session.isActive) {
                        clearInterval(intervalId);
                        this.updateIntervals.delete(taskId);
                        return;
                    }

                    // Get current progress
                    const progress = await this.getCurrentProgress(taskId);
                    
                    // Update Discord embeds
                    await this.updateDiscordEmbeds(taskId, {
                        type: 'periodic_update',
                        progress
                    });

                    session.lastUpdate = new Date();
                    session.totalUpdates++;

                } catch (error) {
                    logger.error('Error in periodic update:', error);
                }
            }, session.updateFrequency);

            this.updateIntervals.set(taskId, intervalId);

        } catch (error) {
            logger.error('Error starting periodic updates:', error);
        }
    }

    /**
     * Handle completion attempt
     * @private
     */
    async handleCompletionAttempt(taskId, progressData) {
        try {
            logger.debug('Handling completion attempt:', {
                taskId,
                userId: progressData.userId
            });

            // Update attempt count
            await this.incrementAttemptCount(taskId);

            // Provide user feedback
            if (progressData.userId) {
                await this.provideUserFeedback(taskId, progressData.userId, {
                    type: 'attempt_started',
                    message: 'Processing your task completion...',
                    timestamp: new Date()
                });
            }

        } catch (error) {
            logger.error('Error handling completion attempt:', error);
        }
    }

    /**
     * Handle completion success
     * @private
     */
    async handleCompletionSuccess(taskId, progressData) {
        try {
            logger.debug('Handling completion success:', {
                taskId,
                userId: progressData.userId
            });

            // Update completion count
            await this.incrementCompletionCount(taskId);

            // Provide user feedback
            if (progressData.userId) {
                await this.provideUserFeedback(taskId, progressData.userId, {
                    type: 'completion_success',
                    message: `🎉 Task completed successfully! You earned ${progressData.pointsEarned || 0} points!`,
                    pointsEarned: progressData.pointsEarned,
                    timestamp: new Date()
                });
            }

            // Update Discord embeds with celebration
            await this.updateDiscordEmbeds(taskId, {
                type: 'completion_success',
                newCompletion: true,
                completedBy: progressData.username
            });

        } catch (error) {
            logger.error('Error handling completion success:', error);
        }
    }

    /**
     * Handle completion failure
     * @private
     */
    async handleCompletionFailure(taskId, progressData) {
        try {
            logger.debug('Handling completion failure:', {
                taskId,
                userId: progressData.userId,
                reason: progressData.reason
            });

            // Update failure count
            await this.incrementFailureCount(taskId);

            // Provide user feedback with troubleshooting
            if (progressData.userId) {
                const troubleshootingMessage = this.getTroubleshootingMessage(progressData.reason);
                
                await this.provideUserFeedback(taskId, progressData.userId, {
                    type: 'completion_failure',
                    message: `❌ Task completion failed: ${progressData.message}`,
                    troubleshooting: troubleshootingMessage,
                    reason: progressData.reason,
                    timestamp: new Date()
                });
            }

        } catch (error) {
            logger.error('Error handling completion failure:', error);
        }
    }

    /**
     * Handle view count update
     * @private
     */
    async handleViewCountUpdate(taskId, progressData) {
        try {
            await this.incrementViewCount(taskId);
        } catch (error) {
            logger.error('Error handling view count update:', error);
        }
    }

    /**
     * Handle analytics update
     * @private
     */
    async handleAnalyticsUpdate(taskId, progressData) {
        try {
            // Clear analytics cache to force refresh
            this.analyticsCache.delete(`progress_${taskId}`);
            this.analyticsCache.delete(`analytics_${taskId}`);
        } catch (error) {
            logger.error('Error handling analytics update:', error);
        }
    }

    /**
     * Update Discord embeds with progress data
     * @private
     */
    async updateDiscordEmbeds(taskId, updateData) {
        try {
            // Get task messages
            const taskMessages = await this.getTaskMessages(taskId);
            
            for (const messageData of taskMessages) {
                try {
                    // Get channel and message
                    const channel = await this.botService.client.channels.fetch(messageData.channelId);
                    if (!channel) continue;

                    const message = await channel.messages.fetch(messageData.messageId);
                    if (!message) continue;

                    // Get updated task data
                    const taskData = await this.getTaskData(taskId);
                    if (!taskData) continue;

                    // Get current progress
                    const progress = await this.getCurrentProgress(taskId);

                    // Create updated embed
                    const updatedEmbed = this.botService.createTaskEmbed(taskData, {
                        showProgress: true,
                        showAnalytics: true,
                        progress,
                        lastUpdate: new Date(),
                        updateType: updateData.type
                    });

                    // Update message
                    await message.edit({
                        embeds: [updatedEmbed],
                        components: message.components // Keep existing buttons
                    });

                    logger.debug('Discord embed updated:', {
                        taskId,
                        messageId: messageData.messageId,
                        updateType: updateData.type
                    });

                } catch (messageError) {
                    logger.warn('Failed to update specific Discord message:', {
                        taskId,
                        messageId: messageData.messageId,
                        error: messageError.message
                    });
                }
            }

        } catch (error) {
            logger.error('Error updating Discord embeds:', error);
        }
    }

    /**
     * Process feedback for user
     * @private
     */
    async processFeedback(feedbackKey) {
        try {
            const feedback = this.feedbackQueue.get(feedbackKey);
            if (!feedback) return;

            // Process different types of feedback
            switch (feedback.type) {
                case 'attempt_started':
                    await this.sendLoadingFeedback(feedback);
                    break;
                
                case 'completion_success':
                    await this.sendSuccessFeedback(feedback);
                    break;
                
                case 'completion_failure':
                    await this.sendFailureFeedback(feedback);
                    break;
            }

            // Remove from queue after processing
            this.feedbackQueue.delete(feedbackKey);

        } catch (error) {
            logger.error('Error processing feedback:', error);
        }
    }

    /**
     * Process pending feedback for task
     * @private
     */
    async processPendingFeedback(taskId) {
        try {
            const pendingFeedback = Array.from(this.feedbackQueue.entries())
                .filter(([key, feedback]) => feedback.taskId === taskId);

            for (const [key, feedback] of pendingFeedback) {
                await this.processFeedback(key);
            }

        } catch (error) {
            logger.error('Error processing pending feedback:', error);
        }
    }

    /**
     * Send loading feedback to user
     * @private
     */
    async sendLoadingFeedback(feedback) {
        try {
            // This would send a loading message or update to the user
            logger.debug('Sending loading feedback:', {
                taskId: feedback.taskId,
                userId: feedback.userId
            });
        } catch (error) {
            logger.error('Error sending loading feedback:', error);
        }
    }

    /**
     * Send success feedback to user
     * @private
     */
    async sendSuccessFeedback(feedback) {
        try {
            // This would send a success message to the user
            logger.debug('Sending success feedback:', {
                taskId: feedback.taskId,
                userId: feedback.userId,
                pointsEarned: feedback.pointsEarned
            });
        } catch (error) {
            logger.error('Error sending success feedback:', error);
        }
    }

    /**
     * Send failure feedback to user
     * @private
     */
    async sendFailureFeedback(feedback) {
        try {
            // This would send a failure message with troubleshooting to the user
            logger.debug('Sending failure feedback:', {
                taskId: feedback.taskId,
                userId: feedback.userId,
                reason: feedback.reason
            });
        } catch (error) {
            logger.error('Error sending failure feedback:', error);
        }
    }

    /**
     * Get troubleshooting message for failure reason
     * @private
     */
    getTroubleshootingMessage(reason) {
        const troubleshootingMap = {
            'account_not_linked': 'Please link your Naffles account at https://naffles.com/discord-link',
            'already_completed': 'You have already completed this task.',
            'task_expired': 'This task has expired. Check for new tasks!',
            'verification_failed': 'Please ensure you have completed the required action and try again.',
            'twitter_verification_failed': 'Make sure you have followed the Twitter account and try again.',
            'discord_verification_failed': 'Please join the required Discord server and try again.',
            'telegram_verification_failed': 'Please join the Telegram channel and try again.'
        };

        return troubleshootingMap[reason] || 'Please try again or contact support if the issue persists.';
    }

    /**
     * Initialize progress analytics
     * @private
     */
    async initializeProgressAnalytics(taskId) {
        try {
            const analyticsData = {
                taskId,
                initializedAt: new Date(),
                totalViews: 0,
                totalAttempts: 0,
                totalCompletions: 0,
                totalFailures: 0,
                discordInteractions: 0
            };

            await this.botService.db.initializeTaskAnalytics(analyticsData);
        } catch (error) {
            logger.error('Error initializing progress analytics:', error);
        }
    }

    /**
     * Update progress analytics
     * @private
     */
    async updateProgressAnalytics(taskId, progressData) {
        try {
            await this.botService.db.updateTaskAnalytics(taskId, {
                type: progressData.type,
                timestamp: new Date(),
                data: progressData
            });

            // Clear cache
            this.analyticsCache.delete(`progress_${taskId}`);
            this.analyticsCache.delete(`analytics_${taskId}`);

        } catch (error) {
            logger.error('Error updating progress analytics:', error);
        }
    }

    /**
     * Get task data from API
     * @private
     */
    async getTaskData(taskId) {
        try {
            return await this.botService.makeNafflesApiCall(`/api/social-tasks/${taskId}`);
        } catch (error) {
            logger.error('Error getting task data:', error);
            return null;
        }
    }

    /**
     * Get task analytics
     * @private
     */
    async getTaskAnalytics(taskId) {
        try {
            return await this.botService.makeNafflesApiCall(`/api/social-tasks/${taskId}/analytics`);
        } catch (error) {
            logger.error('Error getting task analytics:', error);
            return {};
        }
    }

    /**
     * Get Discord metrics
     * @private
     */
    async getDiscordMetrics(taskId) {
        try {
            return await this.botService.db.getTaskAnalytics(taskId);
        } catch (error) {
            logger.error('Error getting Discord metrics:', error);
            return {};
        }
    }

    /**
     * Get task messages
     * @private
     */
    async getTaskMessages(taskId) {
        try {
            return await this.botService.db.getTaskMessages(taskId);
        } catch (error) {
            logger.error('Error getting task messages:', error);
            return [];
        }
    }

    /**
     * Get detailed analytics
     * @private
     */
    async getDetailedAnalytics(taskId) {
        try {
            const [nafflesAnalytics, discordAnalytics] = await Promise.all([
                this.getTaskAnalytics(taskId),
                this.getDiscordMetrics(taskId)
            ]);

            return {
                ...nafflesAnalytics,
                discord: discordAnalytics
            };

        } catch (error) {
            logger.error('Error getting detailed analytics:', error);
            return {};
        }
    }

    /**
     * Calculate success rate
     * @private
     */
    calculateSuccessRate(analytics) {
        if (!analytics || !analytics.totalAttempts) return 0;
        return Math.round((analytics.totalCompletions / analytics.totalAttempts) * 100);
    }

    /**
     * Calculate completion rate
     * @private
     */
    calculateCompletionRate(analytics) {
        if (!analytics || !analytics.totalViews) return 0;
        return Math.round((analytics.totalCompletions / analytics.totalViews) * 100);
    }

    /**
     * Calculate average completion time
     * @private
     */
    calculateAverageCompletionTime(analytics) {
        if (!analytics || !analytics.completionTimes || analytics.completionTimes.length === 0) {
            return 0;
        }
        
        const total = analytics.completionTimes.reduce((sum, time) => sum + time, 0);
        return Math.round(total / analytics.completionTimes.length);
    }

    /**
     * Find most active hour
     * @private
     */
    findMostActiveHour(analytics) {
        if (!analytics || !analytics.hourlyActivity) return null;
        
        let maxHour = 0;
        let maxActivity = 0;
        
        for (let hour = 0; hour < 24; hour++) {
            const activity = analytics.hourlyActivity[hour] || 0;
            if (activity > maxActivity) {
                maxActivity = activity;
                maxHour = hour;
            }
        }
        
        return { hour: maxHour, activity: maxActivity };
    }

    /**
     * Get top completion methods
     * @private
     */
    getTopCompletionMethods(analytics) {
        if (!analytics || !analytics.completionMethods) return [];
        
        return Object.entries(analytics.completionMethods)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .map(([method, count]) => ({ method, count }));
    }

    /**
     * Increment attempt count
     * @private
     */
    async incrementAttemptCount(taskId) {
        try {
            await this.botService.db.incrementTaskMetric(taskId, 'totalAttempts');
        } catch (error) {
            logger.error('Error incrementing attempt count:', error);
        }
    }

    /**
     * Increment completion count
     * @private
     */
    async incrementCompletionCount(taskId) {
        try {
            await this.botService.db.incrementTaskMetric(taskId, 'totalCompletions');
        } catch (error) {
            logger.error('Error incrementing completion count:', error);
        }
    }

    /**
     * Increment failure count
     * @private
     */
    async incrementFailureCount(taskId) {
        try {
            await this.botService.db.incrementTaskMetric(taskId, 'totalFailures');
        } catch (error) {
            logger.error('Error incrementing failure count:', error);
        }
    }

    /**
     * Increment view count
     * @private
     */
    async incrementViewCount(taskId) {
        try {
            await this.botService.db.incrementTaskMetric(taskId, 'totalViews');
        } catch (error) {
            logger.error('Error incrementing view count:', error);
        }
    }
}

module.exports = TaskProgressTrackingService;