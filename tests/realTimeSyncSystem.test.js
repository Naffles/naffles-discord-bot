const RealTimeSyncService = require('../src/services/realTimeSyncService');
const WebhookIntegrationService = require('../src/services/webhookIntegrationService');
const SyncMonitoringService = require('../src/services/syncMonitoringService');
const logger = require('../src/utils/logger');

// Mock dependencies
jest.mock('../src/utils/logger');
jest.mock('axios');

describe('Real-Time Synchronization System', () => {
    let mockBotService;
    let mockDb;
    let mockRedis;
    let mockClient;
    let realTimeSyncService;
    let webhookIntegrationService;
    let syncMonitoringService;

    beforeEach(() => {
        // Mock Discord client
        mockClient = {
            isReady: jest.fn(() => true),
            channels: {
                fetch: jest.fn()
            },
            guilds: {
                cache: new Map()
            }
        };

        // Mock database service
        mockDb = {
            getTaskMessages: jest.fn(),
            getAllowlistMessages: jest.fn(),
            getServersByCommunity: jest.fn(),
            getAllServerMappings: jest.fn(),
            ping: jest.fn()
        };

        // Mock Redis service
        mockRedis = {
            setex: jest.fn(),
            get: jest.fn(),
            del: jest.fn(),
            keys: jest.fn(),
            lpush: jest.fn(),
            ltrim: jest.fn(),
            expire: jest.fn(),
            lrange: jest.fn(),
            ping: jest.fn()
        };

        // Mock bot service
        mockBotService = {
            client: mockClient,
            db: mockDb,
            redis: mockRedis,
            makeNafflesApiCall: jest.fn(),
            createTaskEmbed: jest.fn(),
            createAllowlistEmbed: jest.fn(),
            createInfoEmbed: jest.fn(),
            createErrorEmbed: jest.fn()
        };

        // Initialize services
        realTimeSyncService = new RealTimeSyncService(mockBotService);
        webhookIntegrationService = new WebhookIntegrationService(mockBotService, realTimeSyncService);
        syncMonitoringService = new SyncMonitoringService(mockBotService, realTimeSyncService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('RealTimeSyncService', () => {
        describe('initialization', () => {
            test('should initialize successfully', async () => {
                mockRedis.keys.mockResolvedValue([]);
                
                await realTimeSyncService.initialize();
                
                expect(logger.info).toHaveBeenCalledWith('Initializing Real-Time Sync Service...');
                expect(logger.info).toHaveBeenCalledWith('Real-Time Sync Service initialized successfully');
            });

            test('should restore sync state from Redis', async () => {
                const mockSyncData = {
                    type: 'task_status',
                    taskId: 'task123',
                    newStatus: 'active',
                    timestamp: Date.now()
                };

                mockRedis.keys.mockResolvedValue(['embed_update:sync123']);
                mockRedis.get.mockResolvedValue(JSON.stringify(mockSyncData));

                await realTimeSyncService.initialize();

                expect(mockRedis.keys).toHaveBeenCalledWith('embed_update:*');
                expect(mockRedis.get).toHaveBeenCalledWith('embed_update:sync123');
            });
        });

        describe('task status synchronization', () => {
            test('should handle task status sync', async () => {
                const taskData = {
                    taskId: 'task123',
                    newStatus: 'completed',
                    metadata: { completedBy: 'user123' }
                };

                mockBotService.makeNafflesApiCall.mockResolvedValue({ success: true });
                mockDb.getTaskMessages.mockResolvedValue([]);

                await realTimeSyncService.handleTaskStatusSync(taskData);

                expect(realTimeSyncService.syncQueue.size).toBeGreaterThan(0);
            });

            test('should update Discord task embeds', async () => {
                const taskId = 'task123';
                const updateData = { status: 'completed' };
                const mockChannel = {
                    messages: {
                        fetch: jest.fn().mockResolvedValue({
                            embeds: [{ title: 'Test Task' }],
                            edit: jest.fn(),
                            components: []
                        })
                    }
                };

                mockDb.getTaskMessages.mockResolvedValue([{
                    channelId: 'channel123',
                    messageId: 'message123'
                }]);
                mockClient.channels.fetch.mockResolvedValue(mockChannel);
                mockBotService.makeNafflesApiCall.mockResolvedValue({
                    id: taskId,
                    title: 'Test Task',
                    status: 'completed'
                });
                mockBotService.createTaskEmbed.mockReturnValue({ title: 'Updated Task' });

                await realTimeSyncService.updateDiscordTaskEmbeds(taskId, updateData);

                expect(mockClient.channels.fetch).toHaveBeenCalledWith('channel123');
                expect(mockChannel.messages.fetch).toHaveBeenCalledWith('message123');
            });
        });

        describe('allowlist synchronization', () => {
            test('should handle allowlist sync', async () => {
                const allowlistData = {
                    allowlistId: 'allowlist123',
                    updateType: 'participant_added',
                    changes: { totalParticipants: 50 }
                };

                mockBotService.makeNafflesApiCall.mockResolvedValue({ success: true });
                mockDb.getAllowlistMessages.mockResolvedValue([]);

                await realTimeSyncService.handleAllowlistSync(allowlistData);

                expect(realTimeSyncService.syncQueue.size).toBeGreaterThan(0);
            });

            test('should update Discord allowlist embeds', async () => {
                const allowlistId = 'allowlist123';
                const changes = { participants: 25 };
                const mockChannel = {
                    messages: {
                        fetch: jest.fn().mockResolvedValue({
                            embeds: [{ title: 'Test Allowlist' }],
                            edit: jest.fn(),
                            components: []
                        })
                    }
                };

                mockDb.getAllowlistMessages.mockResolvedValue([{
                    channelId: 'channel123',
                    messageId: 'message123'
                }]);
                mockClient.channels.fetch.mockResolvedValue(mockChannel);
                mockBotService.makeNafflesApiCall.mockResolvedValue({
                    id: allowlistId,
                    title: 'Test Allowlist',
                    participants: 25
                });
                mockBotService.createAllowlistEmbed.mockReturnValue({ title: 'Updated Allowlist' });

                await realTimeSyncService.updateDiscordAllowlistEmbeds(allowlistId, changes);

                expect(mockClient.channels.fetch).toHaveBeenCalledWith('channel123');
                expect(mockChannel.messages.fetch).toHaveBeenCalledWith('message123');
            });
        });

        describe('user progress synchronization', () => {
            test('should handle user progress sync', async () => {
                const progressData = {
                    userId: 'user123',
                    progressType: 'points_earned',
                    progressData: { points: 100 }
                };

                mockBotService.makeNafflesApiCall.mockResolvedValue({ success: true });

                await realTimeSyncService.handleUserProgressSync(progressData);

                expect(realTimeSyncService.syncQueue.size).toBeGreaterThan(0);
            });
        });

        describe('batch synchronization', () => {
            test('should handle batch sync', async () => {
                const batchData = {
                    operations: [
                        { type: 'task_status', taskId: 'task1', newStatus: 'active' },
                        { type: 'task_status', taskId: 'task2', newStatus: 'completed' }
                    ],
                    priority: 'normal'
                };

                await realTimeSyncService.handleBatchSync(batchData);

                expect(realTimeSyncService.batchQueue.length).toBeGreaterThan(0);
            });

            test('should prioritize high priority batch operations', async () => {
                const normalBatch = {
                    operations: [{ type: 'task_status', taskId: 'task1' }],
                    priority: 'normal'
                };
                const highPriorityBatch = {
                    operations: [{ type: 'task_status', taskId: 'task2' }],
                    priority: 'high'
                };

                await realTimeSyncService.handleBatchSync(normalBatch);
                await realTimeSyncService.handleBatchSync(highPriorityBatch);

                expect(realTimeSyncService.batchQueue[0].priority).toBe('high');
            });

            test('should group operations by type for batch processing', () => {
                const operations = [
                    { operations: [{ type: 'task_status', taskId: 'task1' }] },
                    { operations: [{ type: 'allowlist_update', allowlistId: 'al1' }] },
                    { operations: [{ type: 'task_status', taskId: 'task2' }] }
                ];

                const grouped = realTimeSyncService.groupOperationsByType(operations);

                expect(grouped.task_status).toHaveLength(2);
                expect(grouped.allowlist_update).toHaveLength(1);
            });
        });

        describe('webhook event handling', () => {
            test('should handle webhook events', async () => {
                const webhookData = {
                    eventType: 'task.status_changed',
                    data: { taskId: 'task123', newStatus: 'completed' },
                    timestamp: new Date(),
                    signature: 'valid_signature'
                };

                // Mock signature verification
                realTimeSyncService.verifyWebhookSignature = jest.fn(() => true);

                await realTimeSyncService.handleWebhookEvent(webhookData);

                expect(realTimeSyncService.metrics.webhookEvents).toBe(1);
            });

            test('should reject invalid webhook signatures', async () => {
                const webhookData = {
                    eventType: 'task.status_changed',
                    data: { taskId: 'task123' },
                    signature: 'invalid_signature'
                };

                realTimeSyncService.verifyWebhookSignature = jest.fn(() => false);

                await realTimeSyncService.handleWebhookEvent(webhookData);

                expect(realTimeSyncService.metrics.webhookEvents).toBe(0);
            });
        });

        describe('error handling and retry logic', () => {
            test('should retry failed sync operations', async () => {
                const syncId = 'sync123';
                const error = new Error('API call failed');

                realTimeSyncService.syncQueue.set(syncId, {
                    type: 'task_status',
                    taskId: 'task123',
                    retries: 0
                });

                await realTimeSyncService.handleSyncRetry(syncId, error);

                const syncOp = realTimeSyncService.syncQueue.get(syncId);
                expect(syncOp.retries).toBe(1);
                expect(syncOp.lastError).toBe('API call failed');
            });

            test('should remove sync operation after max retries', async () => {
                const syncId = 'sync123';
                const error = new Error('API call failed');

                realTimeSyncService.syncQueue.set(syncId, {
                    type: 'task_status',
                    taskId: 'task123',
                    retries: 3 // Already at max retries
                });

                await realTimeSyncService.handleSyncRetry(syncId, error);

                expect(realTimeSyncService.syncQueue.has(syncId)).toBe(false);
                expect(realTimeSyncService.metrics.failedSyncs).toBe(1);
            });

            test('should implement error cooldowns', () => {
                const syncId = 'sync123';
                realTimeSyncService.errorCooldowns.set(syncId, Date.now());

                const isOnCooldown = realTimeSyncService.isOnErrorCooldown(syncId);

                expect(isOnCooldown).toBe(true);
            });
        });

        describe('performance metrics', () => {
            test('should update sync metrics', () => {
                const syncTime = 1500;

                realTimeSyncService.updateSyncMetrics(syncTime);

                expect(realTimeSyncService.metrics.lastSyncTime).toBeDefined();
                expect(realTimeSyncService.metrics.averageSyncTime).toBeGreaterThan(0);
            });

            test('should provide statistics', () => {
                const stats = realTimeSyncService.getStatistics();

                expect(stats).toHaveProperty('syncOperations');
                expect(stats).toHaveProperty('successfulSyncs');
                expect(stats).toHaveProperty('failedSyncs');
                expect(stats).toHaveProperty('queueSize');
                expect(stats).toHaveProperty('activeSyncs');
            });
        });
    });

    describe('WebhookIntegrationService', () => {
        describe('initialization', () => {
            test('should initialize webhook server', async () => {
                // Mock Express app and server
                const mockServer = {
                    listen: jest.fn((port, callback) => {
                        callback();
                        return mockServer;
                    })
                };

                webhookIntegrationService.app = {
                    use: jest.fn(),
                    post: jest.fn(),
                    get: jest.fn(),
                    listen: mockServer.listen
                };

                await webhookIntegrationService.initialize();

                expect(mockServer.listen).toHaveBeenCalled();
            });
        });

        describe('webhook processing', () => {
            test('should process valid webhook', async () => {
                const mockReq = {
                    body: Buffer.from(JSON.stringify({
                        eventType: 'task.status_changed',
                        data: { taskId: 'task123', newStatus: 'completed' },
                        timestamp: new Date()
                    })),
                    get: jest.fn(() => 'valid_signature'),
                    ip: '127.0.0.1'
                };

                const mockRes = {
                    status: jest.fn(() => mockRes),
                    json: jest.fn()
                };

                webhookIntegrationService.verifyWebhookSignature = jest.fn(() => true);
                webhookIntegrationService.processWebhookEvent = jest.fn(() => Promise.resolve());

                await webhookIntegrationService.handleWebhook(mockReq, mockRes);

                expect(mockRes.status).toHaveBeenCalledWith(200);
                expect(webhookIntegrationService.metrics.webhooksReceived).toBe(1);
            });

            test('should reject webhook with invalid signature', async () => {
                const mockReq = {
                    body: Buffer.from(JSON.stringify({ eventType: 'test' })),
                    get: jest.fn(() => 'invalid_signature'),
                    ip: '127.0.0.1'
                };

                const mockRes = {
                    status: jest.fn(() => mockRes),
                    json: jest.fn()
                };

                webhookIntegrationService.verifyWebhookSignature = jest.fn(() => false);

                await webhookIntegrationService.handleWebhook(mockReq, mockRes);

                expect(mockRes.status).toHaveBeenCalledWith(401);
            });

            test('should process batch webhooks', async () => {
                const mockReq = {
                    body: Buffer.from(JSON.stringify({
                        batchId: 'batch123',
                        events: [
                            { eventType: 'task.status_changed', data: { taskId: 'task1' } },
                            { eventType: 'task.status_changed', data: { taskId: 'task2' } }
                        ],
                        timestamp: new Date()
                    })),
                    get: jest.fn(() => 'valid_signature'),
                    ip: '127.0.0.1'
                };

                const mockRes = {
                    status: jest.fn(() => mockRes),
                    json: jest.fn()
                };

                webhookIntegrationService.verifyWebhookSignature = jest.fn(() => true);
                webhookIntegrationService.processBatchWebhookEvents = jest.fn(() => 
                    Promise.resolve([
                        { success: true, eventType: 'task.status_changed' },
                        { success: true, eventType: 'task.status_changed' }
                    ])
                );

                await webhookIntegrationService.handleBatchWebhook(mockReq, mockRes);

                expect(mockRes.status).toHaveBeenCalledWith(200);
                expect(webhookIntegrationService.metrics.batchWebhooks).toBe(1);
            });
        });

        describe('rate limiting', () => {
            test('should enforce rate limits', () => {
                const mockReq = { ip: '127.0.0.1' };
                const mockRes = {
                    status: jest.fn(() => mockRes),
                    json: jest.fn()
                };
                const mockNext = jest.fn();

                // Simulate exceeding rate limit
                webhookIntegrationService.rateLimits.set('127.0.0.1', {
                    requests: 101,
                    windowStart: Date.now()
                });

                webhookIntegrationService.rateLimitMiddleware(mockReq, mockRes, mockNext);

                expect(mockRes.status).toHaveBeenCalledWith(429);
                expect(mockNext).not.toHaveBeenCalled();
            });

            test('should allow requests within rate limit', () => {
                const mockReq = { ip: '127.0.0.1' };
                const mockRes = {
                    status: jest.fn(() => mockRes),
                    json: jest.fn()
                };
                const mockNext = jest.fn();

                webhookIntegrationService.rateLimitMiddleware(mockReq, mockRes, mockNext);

                expect(mockNext).toHaveBeenCalled();
                expect(mockRes.status).not.toHaveBeenCalled();
            });
        });

        describe('health checks', () => {
            test('should return healthy status', async () => {
                const mockReq = {};
                const mockRes = {
                    status: jest.fn(() => mockRes),
                    json: jest.fn()
                };

                mockBotService.client.isReady.mockReturnValue(true);
                webhookIntegrationService.checkDatabaseHealth = jest.fn(() => Promise.resolve(true));
                webhookIntegrationService.checkRedisHealth = jest.fn(() => Promise.resolve(true));

                await webhookIntegrationService.handleHealthCheck(mockReq, mockRes);

                expect(mockRes.status).toHaveBeenCalledWith(200);
                expect(mockRes.json).toHaveBeenCalledWith(
                    expect.objectContaining({
                        status: 'healthy'
                    })
                );
            });
        });
    });

    describe('SyncMonitoringService', () => {
        describe('initialization', () => {
            test('should initialize monitoring service', async () => {
                await syncMonitoringService.initialize();

                expect(logger.info).toHaveBeenCalledWith('Initializing Sync Monitoring Service...');
                expect(logger.info).toHaveBeenCalledWith('Sync Monitoring Service initialized successfully');
            });
        });

        describe('performance monitoring', () => {
            test('should collect performance metrics', async () => {
                const mockStats = {
                    syncOperations: 100,
                    successfulSyncs: 95,
                    failedSyncs: 5,
                    queueSize: 10,
                    activeSyncs: 2,
                    batchQueueSize: 5,
                    errorCooldowns: 1,
                    averageSyncTime: 1500,
                    webhookEvents: 50
                };

                realTimeSyncService.getStatistics = jest.fn(() => mockStats);

                await syncMonitoringService.collectPerformanceMetrics();

                expect(syncMonitoringService.performanceHistory.length).toBeGreaterThan(0);
                expect(mockRedis.setex).toHaveBeenCalledWith(
                    'discord_sync_performance',
                    300,
                    expect.any(String)
                );
            });

            test('should maintain performance history size limit', async () => {
                // Fill history beyond limit
                for (let i = 0; i < 1100; i++) {
                    syncMonitoringService.performanceHistory.push({
                        timestamp: Date.now() - i * 1000,
                        syncOperations: i
                    });
                }

                const mockStats = {
                    syncOperations: 1100,
                    successfulSyncs: 1000,
                    failedSyncs: 100,
                    queueSize: 0,
                    activeSyncs: 0,
                    batchQueueSize: 0,
                    errorCooldowns: 0,
                    averageSyncTime: 1000,
                    webhookEvents: 0
                };

                realTimeSyncService.getStatistics = jest.fn(() => mockStats);

                await syncMonitoringService.collectPerformanceMetrics();

                expect(syncMonitoringService.performanceHistory.length).toBeLessThanOrEqual(1000);
            });
        });

        describe('health checks', () => {
            test('should perform comprehensive health check', async () => {
                const mockStats = {
                    queueSize: 50,
                    batchQueueSize: 10,
                    errorCooldowns: 5,
                    successfulSyncs: 100,
                    failedSyncs: 10,
                    batchOperations: 20,
                    syncOperations: 110
                };

                realTimeSyncService.getStatistics = jest.fn(() => mockStats);
                mockRedis.lrange.mockResolvedValue([
                    JSON.stringify({ timestamp: Date.now() - 60000 })
                ]);

                await syncMonitoringService.performHealthCheck();

                expect(syncMonitoringService.healthStatus.overall).toBeDefined();
                expect(syncMonitoringService.healthStatus.components).toHaveProperty('syncQueue');
                expect(syncMonitoringService.healthStatus.components).toHaveProperty('batchProcessing');
                expect(syncMonitoringService.healthStatus.components).toHaveProperty('webhookIntegration');
                expect(syncMonitoringService.healthStatus.components).toHaveProperty('errorRecovery');
            });

            test('should detect unhealthy conditions', async () => {
                const mockStats = {
                    queueSize: 250, // Above critical threshold
                    batchQueueSize: 10,
                    errorCooldowns: 25, // Above critical threshold
                    successfulSyncs: 50,
                    failedSyncs: 100, // More failures than successes
                    batchOperations: 0,
                    syncOperations: 150
                };

                realTimeSyncService.getStatistics = jest.fn(() => mockStats);
                mockRedis.lrange.mockResolvedValue([]);

                await syncMonitoringService.performHealthCheck();

                expect(syncMonitoringService.healthStatus.overall).toBe('critical');
                expect(syncMonitoringService.healthStatus.components.syncQueue).toBe('critical');
                expect(syncMonitoringService.healthStatus.components.errorRecovery).toBe('critical');
            });
        });

        describe('alert monitoring', () => {
            test('should detect high failure rate alert', async () => {
                syncMonitoringService.performanceHistory.push({
                    timestamp: Date.now(),
                    failureRate: 0.15, // Above threshold
                    averageSyncTime: 2000,
                    queueSize: 50,
                    errorCooldowns: 5
                });

                await syncMonitoringService.checkAlertConditions();

                expect(syncMonitoringService.activeAlerts.size).toBeGreaterThan(0);
            });

            test('should detect slow sync time alert', async () => {
                syncMonitoringService.performanceHistory.push({
                    timestamp: Date.now(),
                    failureRate: 0.05,
                    averageSyncTime: 6000, // Above threshold
                    queueSize: 50,
                    errorCooldowns: 5
                });

                await syncMonitoringService.checkAlertConditions();

                expect(syncMonitoringService.activeAlerts.size).toBeGreaterThan(0);
            });

            test('should respect alert cooldowns', async () => {
                const alertType = 'high_failure_rate';
                syncMonitoringService.alertCooldowns.set(alertType, Date.now());

                const isOnCooldown = syncMonitoringService.isAlertOnCooldown(alertType);

                expect(isOnCooldown).toBe(true);
            });
        });

        describe('optimization analysis', () => {
            test('should generate optimization recommendations', async () => {
                // Add performance history with suboptimal metrics
                for (let i = 0; i < 15; i++) {
                    syncMonitoringService.performanceHistory.push({
                        timestamp: Date.now() - i * 30000,
                        queueSize: 75, // High queue size
                        averageSyncTime: 4000, // Slow sync time
                        failureRate: 0.08, // High failure rate
                        batchQueueSize: 5
                    });
                }

                const recommendations = await syncMonitoringService.analyzeOptimizationOpportunities();

                expect(recommendations.length).toBeGreaterThan(0);
                expect(recommendations.some(r => r.type === 'queue_optimization')).toBe(true);
                expect(recommendations.some(r => r.type === 'performance_optimization')).toBe(true);
                expect(recommendations.some(r => r.type === 'reliability_optimization')).toBe(true);
            });

            test('should cache optimization recommendations', async () => {
                // First call
                const recommendations1 = await syncMonitoringService.analyzeOptimizationOpportunities();
                
                // Second call should return cached result
                const recommendations2 = await syncMonitoringService.analyzeOptimizationOpportunities();

                expect(recommendations1).toEqual(recommendations2);
            });
        });

        describe('performance trends', () => {
            test('should calculate performance trends', () => {
                const now = Date.now();
                syncMonitoringService.performanceHistory = [
                    { timestamp: now - 60000, queueSize: 10, failureRate: 0.05, averageSyncTime: 1000, syncOperations: 100 },
                    { timestamp: now - 30000, queueSize: 15, failureRate: 0.07, averageSyncTime: 1200, syncOperations: 150 },
                    { timestamp: now, queueSize: 20, failureRate: 0.10, averageSyncTime: 1500, syncOperations: 200 }
                ];

                const trends = syncMonitoringService.getPerformanceTrends(120000); // 2 minutes

                expect(trends).toHaveProperty('trends');
                expect(trends).toHaveProperty('summary');
                expect(trends.trends.queueSize).toBe('increasing');
                expect(trends.trends.failureRate).toBe('increasing');
                expect(trends.trends.averageSyncTime).toBe('increasing');
            });

            test('should handle insufficient data', () => {
                const trends = syncMonitoringService.getPerformanceTrends();

                expect(trends).toHaveProperty('error');
                expect(trends.error).toBe('No data available for the specified time range');
            });
        });

        describe('event recording', () => {
            test('should record sync events', () => {
                const eventData = {
                    syncId: 'sync123',
                    syncType: 'task_status',
                    duration: 1500
                };

                syncMonitoringService.recordSyncEvent('completed', eventData);

                expect(mockRedis.lpush).toHaveBeenCalledWith(
                    'discord_sync_events',
                    expect.stringContaining('sync123')
                );
            });

            test('should record batch events', () => {
                const batchData = {
                    batchId: 'batch123',
                    operationCount: 10,
                    successful: 8,
                    failed: 2,
                    duration: 3000
                };

                syncMonitoringService.recordBatchEvent(batchData);

                expect(mockRedis.lpush).toHaveBeenCalledWith(
                    'discord_batch_events',
                    expect.stringContaining('batch123')
                );
            });

            test('should record webhook events', () => {
                const webhookData = {
                    eventType: 'task.status_changed',
                    processed: true,
                    batchId: 'batch123'
                };

                syncMonitoringService.recordWebhookEvent(webhookData);

                expect(mockRedis.lpush).toHaveBeenCalledWith(
                    'discord_webhook_events',
                    expect.stringContaining('task.status_changed')
                );
            });
        });
    });

    describe('Integration Tests', () => {
        test('should handle end-to-end sync flow', async () => {
            // Initialize all services
            await realTimeSyncService.initialize();
            await syncMonitoringService.initialize();

            // Simulate task status change
            const taskData = {
                taskId: 'task123',
                newStatus: 'completed',
                metadata: { completedBy: 'user123' }
            };

            mockBotService.makeNafflesApiCall.mockResolvedValue({ success: true });
            mockDb.getTaskMessages.mockResolvedValue([]);

            // Trigger sync
            await realTimeSyncService.handleTaskStatusSync(taskData);

            // Verify sync was queued
            expect(realTimeSyncService.syncQueue.size).toBeGreaterThan(0);

            // Process sync queue
            await realTimeSyncService.processPendingSyncs();

            // Verify metrics were updated
            expect(realTimeSyncService.metrics.syncOperations).toBeGreaterThan(0);
        });

        test('should handle webhook to sync integration', async () => {
            const webhookData = {
                eventType: 'task.status_changed',
                data: {
                    taskId: 'task123',
                    oldStatus: 'active',
                    newStatus: 'completed',
                    changes: { completedBy: 'user123' }
                },
                timestamp: new Date(),
                signature: 'valid_signature'
            };

            realTimeSyncService.verifyWebhookSignature = jest.fn(() => true);
            mockBotService.makeNafflesApiCall.mockResolvedValue({ success: true });

            // Process webhook
            await realTimeSyncService.handleWebhookEvent(webhookData);

            // Verify sync was triggered
            expect(realTimeSyncService.syncQueue.size).toBeGreaterThan(0);
        });

        test('should handle monitoring and alerting integration', async () => {
            await syncMonitoringService.initialize();

            // Simulate poor performance metrics
            const mockStats = {
                syncOperations: 100,
                successfulSyncs: 80,
                failedSyncs: 20,
                queueSize: 150,
                activeSyncs: 10,
                batchQueueSize: 20,
                errorCooldowns: 15,
                averageSyncTime: 6000,
                webhookEvents: 50
            };

            realTimeSyncService.getStatistics = jest.fn(() => mockStats);

            // Collect metrics
            await syncMonitoringService.collectPerformanceMetrics();

            // Check alerts
            await syncMonitoringService.checkAlertConditions();

            // Verify alerts were generated
            expect(syncMonitoringService.activeAlerts.size).toBeGreaterThan(0);
        });
    });
});