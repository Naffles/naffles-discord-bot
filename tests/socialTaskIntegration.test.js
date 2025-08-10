const { describe, test, expect, beforeEach, afterEach, jest } = require('@jest/globals');
const SocialTaskIntegrationService = require('../src/services/socialTaskIntegrationService');
const TaskProgressTrackingService = require('../src/services/taskProgressTrackingService');
const TaskEligibilityService = require('../src/services/taskEligibilityService');
const TaskAnalyticsService = require('../src/services/taskAnalyticsService');

// Mock Discord.js
jest.mock('discord.js', () => ({
    Client: jest.fn(),
    GatewayIntentBits: {},
    EmbedBuilder: jest.fn(() => ({
        setTitle: jest.fn().mockReturnThis(),
        setDescription: jest.fn().mockReturnThis(),
        setColor: jest.fn().mockReturnThis(),
        addFields: jest.fn().mockReturnThis(),
        setFooter: jest.fn().mockReturnThis(),
        setTimestamp: jest.fn().mockReturnThis()
    })),
    ActionRowBuilder: jest.fn(() => ({
        addComponents: jest.fn().mockReturnThis()
    })),
    ButtonBuilder: jest.fn(() => ({
        setCustomId: jest.fn().mockReturnThis(),
        setLabel: jest.fn().mockReturnThis(),
        setStyle: jest.fn().mockReturnThis(),
        setEmoji: jest.fn().mockReturnThis(),
        setDisabled: jest.fn().mockReturnThis()
    })),
    ButtonStyle: {
        Primary: 1,
        Secondary: 2,
        Success: 3,
        Danger: 4,
        Link: 5
    }
}));

describe('Social Task Integration System', () => {
    let mockBotService;
    let socialTaskIntegration;
    let taskProgressTracking;
    let taskEligibility;
    let taskAnalytics;

    beforeEach(() => {
        // Mock bot service
        mockBotService = {
            client: {
                channels: {
                    fetch: jest.fn()
                },
                guilds: {
                    cache: {
                        get: jest.fn()
                    }
                }
            },
            db: {
                getUserAccountLink: jest.fn(),
                getServerCommunityMapping: jest.fn(),
                storeTaskMetadata: jest.fn(),
                storeTaskMessage: jest.fn(),
                getTaskMessages: jest.fn(),
                initializeTaskAnalytics: jest.fn(),
                updateTaskAnalytics: jest.fn(),
                getTaskAnalytics: jest.fn(),
                logInteraction: jest.fn(),
                incrementTaskMetric: jest.fn(),
                getCommunityDiscordMetrics: jest.fn(),
                storeTaskMetrics: jest.fn(),
                storeAnalyticsReport: jest.fn(),
                getTaskDiscordActivity: jest.fn()
            },
            redis: {
                setex: jest.fn(),
                get: jest.fn(),
                del: jest.fn()
            },
            makeNafflesApiCall: jest.fn(),
            getServerCommunityMapping: jest.fn(),
            createTaskEmbed: jest.fn(),
            createActionButtons: jest.fn(),
            logInteraction: jest.fn(),
            embedUpdater: {
                registerEmbedForUpdates: jest.fn()
            }
        };

        // Initialize services
        socialTaskIntegration = new SocialTaskIntegrationService(mockBotService);
        taskProgressTracking = new TaskProgressTrackingService(mockBotService);
        taskEligibility = new TaskEligibilityService(mockBotService);
        taskAnalytics = new TaskAnalyticsService(mockBotService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('SocialTaskIntegrationService', () => {
        test('should create social task with Discord integration', async () => {
            // Mock data
            const taskData = {
                title: 'Test Task',
                description: 'Test Description',
                type: 'twitter_follow',
                points: 100,
                twitterUsername: 'naffles'
            };

            const discordContext = {
                guildId: 'guild123',
                channelId: 'channel123',
                userId: 'user123'
            };

            const mockServerMapping = {
                communityId: 'community123'
            };

            const mockCreatedTask = {
                id: 'task123',
                title: 'Test Task',
                type: 'twitter_follow',
                points: 100
            };

            // Setup mocks
            mockBotService.getServerCommunityMapping.mockResolvedValue(mockServerMapping);
            mockBotService.makeNafflesApiCall.mockResolvedValue(mockCreatedTask);
            mockBotService.db.storeTaskMetadata.mockResolvedValue();

            // Execute
            const result = await socialTaskIntegration.createSocialTask(taskData, discordContext);

            // Verify
            expect(mockBotService.getServerCommunityMapping).toHaveBeenCalledWith(discordContext.guildId);
            expect(mockBotService.makeNafflesApiCall).toHaveBeenCalledWith(
                '/api/social-tasks',
                'POST',
                expect.objectContaining({
                    communityId: mockServerMapping.communityId,
                    title: taskData.title,
                    type: taskData.type
                })
            );
            expect(result).toEqual(expect.objectContaining({
                id: mockCreatedTask.id,
                discordIntegration: expect.objectContaining({
                    guildId: discordContext.guildId
                })
            }));
        });

        test('should handle task completion with verification', async () => {
            // Mock data
            const mockInteraction = {
                user: { id: 'discord123', username: 'testuser' },
                guildId: 'guild123'
            };

            const mockUserAccount = {
                nafflesUserId: 'user123'
            };

            const mockTask = {
                id: 'task123',
                type: 'twitter_follow',
                status: 'active',
                rewards: { points: 100 }
            };

            // Setup mocks
            mockBotService.db.getUserAccountLink.mockResolvedValue(mockUserAccount);
            mockBotService.makeNafflesApiCall
                .mockResolvedValueOnce(mockTask) // getTaskDetails
                .mockResolvedValueOnce(null) // checkPreviousCompletion
                .mockResolvedValueOnce({ id: 'completion123' }); // submitCompletion

            // Mock verification
            jest.spyOn(socialTaskIntegration, 'verifyTaskCompletion').mockResolvedValue({
                verified: true,
                data: { method: 'twitter_api' }
            });

            // Execute
            const result = await socialTaskIntegration.handleTaskCompletion(mockInteraction, 'task123');

            // Verify
            expect(result.success).toBe(true);
            expect(result.pointsEarned).toBe(100);
            expect(mockBotService.makeNafflesApiCall).toHaveBeenCalledWith(
                '/api/social-tasks/task123/complete',
                'POST',
                expect.objectContaining({
                    userId: mockUserAccount.nafflesUserId,
                    discordId: mockInteraction.user.id
                })
            );
        });

        test('should handle account not linked error', async () => {
            // Mock data
            const mockInteraction = {
                user: { id: 'discord123', username: 'testuser' },
                guildId: 'guild123'
            };

            // Setup mocks
            mockBotService.db.getUserAccountLink.mockResolvedValue(null);

            // Execute
            const result = await socialTaskIntegration.handleTaskCompletion(mockInteraction, 'task123');

            // Verify
            expect(result.success).toBe(false);
            expect(result.reason).toBe('account_not_linked');
            expect(result.message).toContain('link your Naffles account');
        });
    });

    describe('TaskProgressTrackingService', () => {
        test('should start task tracking with configuration', async () => {
            const taskId = 'task123';
            const trackingConfig = {
                updateFrequency: 30000,
                enableRealTimeUpdates: true
            };

            // Setup mocks
            mockBotService.db.initializeTaskAnalytics.mockResolvedValue();

            // Execute
            await taskProgressTracking.startTaskTracking(taskId, trackingConfig);

            // Verify
            expect(taskProgressTracking.trackingSessions.has(taskId)).toBe(true);
            expect(mockBotService.db.initializeTaskAnalytics).toHaveBeenCalledWith(
                expect.objectContaining({ taskId })
            );
        });

        test('should update task progress with different types', async () => {
            const taskId = 'task123';
            
            // Start tracking first
            await taskProgressTracking.startTaskTracking(taskId);

            // Test completion attempt
            await taskProgressTracking.updateTaskProgress(taskId, {
                type: 'completion_attempt',
                userId: 'user123',
                discordId: 'discord123'
            });

            // Test completion success
            await taskProgressTracking.updateTaskProgress(taskId, {
                type: 'completion_success',
                userId: 'user123',
                pointsEarned: 100
            });

            // Verify session is active
            const session = taskProgressTracking.trackingSessions.get(taskId);
            expect(session.isActive).toBe(true);
            expect(session.totalUpdates).toBeGreaterThan(0);
        });

        test('should provide user feedback', async () => {
            const taskId = 'task123';
            const userId = 'user123';
            const feedbackData = {
                type: 'completion_success',
                message: 'Task completed successfully!',
                pointsEarned: 100
            };

            // Execute
            await taskProgressTracking.provideUserFeedback(taskId, userId, feedbackData);

            // Verify feedback is queued
            const feedbackKey = `${taskId}_${userId}`;
            expect(taskProgressTracking.feedbackQueue.has(feedbackKey)).toBe(true);
        });

        test('should get current progress', async () => {
            const taskId = 'task123';

            // Mock API responses
            mockBotService.makeNafflesApiCall
                .mockResolvedValueOnce({ status: 'active' }) // getTaskData
                .mockResolvedValueOnce({ totalCompletions: 5, totalAttempts: 10 }) // getTaskAnalytics
                .mockResolvedValueOnce({ views: 100, interactions: 25 }); // getDiscordMetrics

            mockBotService.db.getTaskAnalytics.mockResolvedValue({
                views: 100,
                interactions: 25
            });

            // Execute
            const progress = await taskProgressTracking.getCurrentProgress(taskId);

            // Verify
            expect(progress).toEqual(expect.objectContaining({
                taskId,
                status: 'active',
                totalCompletions: 5,
                totalAttempts: 10,
                discordViews: 100,
                discordInteractions: 25
            }));
        });
    });

    describe('TaskEligibilityService', () => {
        test('should check task eligibility comprehensively', async () => {
            const taskId = 'task123';
            const userId = 'user123';
            const discordId = 'discord123';

            const mockTask = {
                id: taskId,
                status: 'active',
                requirements: {
                    minimum_level: 5
                },
                schedule: {
                    startDate: new Date(Date.now() - 86400000), // Yesterday
                    endDate: new Date(Date.now() + 86400000)    // Tomorrow
                }
            };

            const mockUserData = {
                id: userId,
                level: 10,
                createdAt: new Date(Date.now() - 30 * 86400000) // 30 days ago
            };

            // Setup mocks
            mockBotService.makeNafflesApiCall
                .mockResolvedValueOnce(mockTask) // getTaskDetails
                .mockResolvedValueOnce(mockUserData) // getUserData
                .mockResolvedValueOnce(null); // checkPreviousCompletion

            // Execute
            const eligibility = await taskEligibility.checkTaskEligibility(taskId, userId, discordId);

            // Verify
            expect(eligibility.eligible).toBe(true);
            expect(eligibility.reason).toBe('eligible');
            expect(eligibility.canComplete).toBe(true);
        });

        test('should detect ineligible user with detailed reasons', async () => {
            const taskId = 'task123';
            const userId = 'user123';
            const discordId = 'discord123';

            const mockTask = {
                id: taskId,
                status: 'active',
                requirements: {
                    minimum_level: 10
                }
            };

            const mockUserData = {
                id: userId,
                level: 5, // Below requirement
                createdAt: new Date()
            };

            // Setup mocks
            mockBotService.makeNafflesApiCall
                .mockResolvedValueOnce(mockTask)
                .mockResolvedValueOnce(mockUserData)
                .mockResolvedValueOnce(null);

            // Execute
            const eligibility = await taskEligibility.checkTaskEligibility(taskId, userId, discordId);

            // Verify
            expect(eligibility.eligible).toBe(false);
            expect(eligibility.reason).toBe('requirements_not_met');
            expect(eligibility.requirements).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    type: 'minimum_level',
                    valid: false
                })
            ]));
        });

        test('should check retry eligibility', async () => {
            const taskId = 'task123';
            const userId = 'user123';
            const failureReason = { reason: 'verification_failed' };

            const mockTask = {
                id: taskId,
                retryConfiguration: {
                    maxRetries: 3,
                    cooldownMinutes: 5
                }
            };

            // Setup mocks
            mockBotService.makeNafflesApiCall.mockResolvedValue(mockTask);
            jest.spyOn(taskEligibility, 'getUserRetryHistory').mockResolvedValue([]);

            // Execute
            const retryEligibility = await taskEligibility.checkRetryEligibility(taskId, userId, failureReason);

            // Verify
            expect(retryEligibility.canRetry).toBe(true);
            expect(retryEligibility.retriesRemaining).toBe(3);
        });

        test('should validate specific requirements', async () => {
            const mockUserData = {
                level: 10,
                createdAt: new Date(Date.now() - 30 * 86400000)
            };

            const mockTaskData = {
                communityId: 'community123'
            };

            // Test minimum level validation
            const levelResult = await taskEligibility.validateRequirement(
                'minimum_level',
                5,
                mockUserData,
                mockTaskData
            );

            expect(levelResult.valid).toBe(true);
            expect(levelResult.currentValue).toBe(10);
            expect(levelResult.requiredValue).toBe(5);

            // Test account age validation
            const ageResult = await taskEligibility.validateRequirement(
                'account_age',
                7, // 7 days
                mockUserData,
                mockTaskData
            );

            expect(ageResult.valid).toBe(true);
            expect(ageResult.currentAge).toBeGreaterThan(7);
        });
    });

    describe('TaskAnalyticsService', () => {
        test('should get community task analytics for admin', async () => {
            const communityId = 'community123';
            const adminUserId = 'admin123';

            // Mock admin verification
            mockBotService.makeNafflesApiCall
                .mockResolvedValueOnce({ role: 'admin' }) // verifyAdminPermissions
                .mockResolvedValueOnce([{ id: 'task1', status: 'active' }]) // getTaskOverview
                .mockResolvedValueOnce({ totalCompletions: 50 }) // getCompletionMetrics
                .mockResolvedValueOnce({ activeUsers: 25 }) // getUserEngagementMetrics
                .mockResolvedValueOnce({ totalInteractions: 100 }); // getPerformanceData

            mockBotService.db.getCommunityDiscordMetrics.mockResolvedValue({
                totalInteractions: 100,
                buttonClicks: 50
            });

            // Execute
            const analytics = await taskAnalytics.getCommunityTaskAnalytics(communityId, adminUserId);

            // Verify
            expect(analytics).toEqual(expect.objectContaining({
                communityId,
                timeframe: '30d',
                overview: expect.any(Object),
                completions: expect.any(Object),
                engagement: expect.any(Object),
                discord: expect.any(Object),
                insights: expect.any(Array)
            }));
        });

        test('should get task-specific analytics', async () => {
            const taskId = 'task123';
            const adminUserId = 'admin123';

            const mockTask = {
                id: taskId,
                title: 'Test Task',
                type: 'twitter_follow',
                status: 'active',
                communityId: 'community123'
            };

            // Setup mocks
            mockBotService.makeNafflesApiCall
                .mockResolvedValueOnce(mockTask) // getTaskDetails
                .mockResolvedValueOnce({ role: 'admin' }) // verifyAdminPermissions
                .mockResolvedValueOnce({ totalViews: 100 }) // getTaskBasicMetrics
                .mockResolvedValueOnce({ totalCompletions: 25 }) // getTaskCompletionData
                .mockResolvedValueOnce({ interactions: 50 }) // getTaskUserInteractions
                .mockResolvedValueOnce([]); // getTaskTimelineData

            mockBotService.db.getTaskDiscordActivity.mockResolvedValue({
                buttonClicks: 30,
                embedViews: 80
            });

            // Execute
            const analytics = await taskAnalytics.getTaskAnalytics(taskId, adminUserId);

            // Verify
            expect(analytics).toEqual(expect.objectContaining({
                taskId,
                task: expect.objectContaining({
                    id: taskId,
                    title: 'Test Task'
                }),
                metrics: expect.any(Object),
                completions: expect.any(Object),
                interactions: expect.any(Object),
                discord: expect.any(Object),
                insights: expect.any(Array)
            }));
        });

        test('should track real-time task interactions', async () => {
            const taskId = 'task123';
            const interactionType = 'button_click';
            const interactionData = {
                userId: 'user123',
                buttonType: 'complete_task'
            };

            // Execute
            await taskAnalytics.trackTaskInteraction(taskId, interactionType, interactionData);

            // Verify metrics buffer
            const metricKey = `${taskId}_${interactionType}`;
            expect(taskAnalytics.metricsBuffer.has(metricKey)).toBe(true);
            
            const metrics = taskAnalytics.metricsBuffer.get(metricKey);
            expect(metrics).toHaveLength(1);
            expect(metrics[0]).toEqual(expect.objectContaining({
                userId: 'user123',
                buttonType: 'complete_task',
                timestamp: expect.any(Date)
            }));
        });

        test('should generate analytics report', async () => {
            const communityId = 'community123';
            const adminUserId = 'admin123';

            // Mock analytics data
            const mockAnalytics = {
                overview: { totalTasks: 10 },
                completions: { totalCompletions: 100 },
                engagement: { activeUsers: 50 },
                insights: []
            };

            jest.spyOn(taskAnalytics, 'getCommunityTaskAnalytics').mockResolvedValue(mockAnalytics);
            mockBotService.db.storeAnalyticsReport.mockResolvedValue();

            // Execute
            const report = await taskAnalytics.generateAnalyticsReport(communityId, adminUserId);

            // Verify
            expect(report).toEqual(expect.objectContaining({
                reportId: expect.stringMatching(/^report_\d+$/),
                communityId,
                generatedBy: adminUserId,
                type: 'comprehensive',
                data: mockAnalytics,
                summary: expect.any(Object),
                recommendations: expect.any(Array)
            }));

            expect(mockBotService.db.storeAnalyticsReport).toHaveBeenCalledWith(report);
        });

        test('should get real-time dashboard data', async () => {
            const communityId = 'community123';
            const adminUserId = 'admin123';

            // Setup mocks
            mockBotService.makeNafflesApiCall
                .mockResolvedValueOnce({ role: 'admin' }) // verifyAdminPermissions
                .mockResolvedValueOnce([{ id: 'task1', status: 'active' }]) // getActiveTasks
                .mockResolvedValueOnce([{ type: 'completion', timestamp: new Date() }]) // getRecentActivity
                .mockResolvedValueOnce({ activeUsers: 25 }) // getLiveMetrics
                .mockResolvedValueOnce({ verifications: 5 }); // getPendingActions

            // Execute
            const dashboard = await taskAnalytics.getRealTimeDashboard(communityId, adminUserId);

            // Verify
            expect(dashboard).toEqual(expect.objectContaining({
                communityId,
                lastUpdated: expect.any(Date),
                activeTasks: expect.objectContaining({
                    count: 1,
                    tasks: expect.any(Array)
                }),
                recentActivity: expect.objectContaining({
                    count: 1,
                    activities: expect.any(Array)
                }),
                liveMetrics: expect.any(Object),
                pendingActions: expect.any(Object)
            }));
        });

        test('should deny access to non-admin users', async () => {
            const communityId = 'community123';
            const userId = 'user123'; // Not admin

            // Mock non-admin user
            mockBotService.makeNafflesApiCall.mockResolvedValue({ role: 'member' });

            // Execute and verify error
            await expect(
                taskAnalytics.getCommunityTaskAnalytics(communityId, userId)
            ).rejects.toThrow('Insufficient permissions to view analytics');
        });
    });

    describe('Integration Tests', () => {
        test('should handle complete task workflow', async () => {
            // Setup complete workflow
            const taskData = {
                title: 'Integration Test Task',
                description: 'Test task for integration',
                type: 'twitter_follow',
                points: 50,
                twitterUsername: 'naffles'
            };

            const discordContext = {
                guildId: 'guild123',
                channelId: 'channel123',
                userId: 'user123'
            };

            const mockInteraction = {
                user: { id: 'discord123', username: 'testuser' },
                guildId: 'guild123',
                channel: {
                    id: 'channel123',
                    send: jest.fn().mockResolvedValue({ id: 'message123' })
                }
            };

            // Mock all required data
            mockBotService.getServerCommunityMapping.mockResolvedValue({ communityId: 'community123' });
            mockBotService.makeNafflesApiCall.mockResolvedValue({ id: 'task123', ...taskData });
            mockBotService.db.getUserAccountLink.mockResolvedValue({ nafflesUserId: 'user123' });
            mockBotService.createTaskEmbed.mockReturnValue({});
            mockBotService.createActionButtons.mockReturnValue({});

            // 1. Create task
            const createdTask = await socialTaskIntegration.createSocialTask(taskData, discordContext);
            expect(createdTask.id).toBe('task123');

            // 2. Start progress tracking
            await taskProgressTracking.startTaskTracking(createdTask.id);
            expect(taskProgressTracking.trackingSessions.has(createdTask.id)).toBe(true);

            // 3. Check eligibility
            mockBotService.makeNafflesApiCall
                .mockResolvedValueOnce({ id: 'task123', status: 'active', requirements: {} })
                .mockResolvedValueOnce({ id: 'user123', level: 1 })
                .mockResolvedValueOnce(null);

            const eligibility = await taskEligibility.checkTaskEligibility(
                createdTask.id,
                'user123',
                'discord123'
            );
            expect(eligibility.eligible).toBe(true);

            // 4. Track analytics
            await taskAnalytics.trackTaskInteraction(createdTask.id, 'view', { userId: 'user123' });
            expect(taskAnalytics.metricsBuffer.size).toBeGreaterThan(0);

            // 5. Complete task
            mockBotService.makeNafflesApiCall
                .mockResolvedValueOnce({ id: 'task123', status: 'active', rewards: { points: 50 } })
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce({ id: 'completion123' });

            jest.spyOn(socialTaskIntegration, 'verifyTaskCompletion').mockResolvedValue({
                verified: true,
                data: { method: 'twitter_api' }
            });

            const completionResult = await socialTaskIntegration.handleTaskCompletion(
                mockInteraction,
                createdTask.id
            );

            expect(completionResult.success).toBe(true);
            expect(completionResult.pointsEarned).toBe(50);
        });

        test('should handle error scenarios gracefully', async () => {
            // Test API failure
            mockBotService.makeNafflesApiCall.mockRejectedValue(new Error('API Error'));

            const result = await socialTaskIntegration.handleTaskCompletion(
                { user: { id: 'discord123' }, guildId: 'guild123' },
                'task123'
            );

            expect(result.success).toBe(false);
            expect(result.reason).toBe('processing_error');

            // Test network timeout
            mockBotService.makeNafflesApiCall.mockImplementation(() => 
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), 100)
                )
            );

            const timeoutResult = await socialTaskIntegration.handleTaskCompletion(
                { user: { id: 'discord123' }, guildId: 'guild123' },
                'task123'
            );

            expect(timeoutResult.success).toBe(false);
        });
    });
});