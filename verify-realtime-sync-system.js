#!/usr/bin/env node

/**
 * Real-Time Synchronization System Verification Script
 * Tests the complete real-time sync infrastructure including:
 * - Task status synchronization
 * - Allowlist updates
 * - User progress tracking
 * - Webhook integration
 * - Batch processing
 * - Error handling and recovery
 * - Performance monitoring
 */

const path = require('path');
const fs = require('fs');

// Setup test environment
process.env.NODE_ENV = 'test';
process.env.DISCORD_BOT_TOKEN = 'test_token';
process.env.DISCORD_CLIENT_ID = 'test_client_id';
process.env.NAFFLES_API_BASE_URL = 'http://localhost:3000';
process.env.NAFFLES_API_KEY = 'test_api_key';
process.env.DISCORD_WEBHOOK_SECRET = 'test_webhook_secret';
process.env.DISCORD_WEBHOOK_PORT = '3001';

const logger = require('./src/utils/logger');
const RealTimeSyncService = require('./src/services/realTimeSyncService');
const WebhookIntegrationService = require('./src/services/webhookIntegrationService');
const SyncMonitoringService = require('./src/services/syncMonitoringService');

class RealTimeSyncVerification {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            tests: []
        };
        
        this.mockServices = this.createMockServices();
        this.realTimeSyncService = null;
        this.webhookIntegrationService = null;
        this.syncMonitoringService = null;
    }

    createMockServices() {
        const mockClient = {
            isReady: () => true,
            channels: {
                fetch: jest.fn().mockResolvedValue({
                    messages: {
                        fetch: jest.fn().mockResolvedValue({
                            embeds: [{ title: 'Test Embed' }],
                            edit: jest.fn(),
                            components: []
                        })
                    }
                })
            },
            guilds: {
                cache: new Map()
            }
        };

        const mockDb = {
            getTaskMessages: jest.fn().mockResolvedValue([
                { channelId: 'channel123', messageId: 'message123' }
            ]),
            getAllowlistMessages: jest.fn().mockResolvedValue([
                { channelId: 'channel456', messageId: 'message456' }
            ]),
            getServersByCommunity: jest.fn().mockResolvedValue([
                { guildId: 'guild123' }
            ]),
            getAllServerMappings: jest.fn().mockResolvedValue([
                { guildId: 'guild123', communityId: 'community123' }
            ]),
            ping: jest.fn().mockResolvedValue(true)
        };

        const mockRedis = {
            setex: jest.fn().mockResolvedValue('OK'),
            get: jest.fn().mockResolvedValue(null),
            del: jest.fn().mockResolvedValue(1),
            keys: jest.fn().mockResolvedValue([]),
            lpush: jest.fn().mockResolvedValue(1),
            ltrim: jest.fn().mockResolvedValue('OK'),
            expire: jest.fn().mockResolvedValue(1),
            lrange: jest.fn().mockResolvedValue([]),
            ping: jest.fn().mockResolvedValue('PONG')
        };

        const mockBotService = {
            client: mockClient,
            db: mockDb,
            redis: mockRedis,
            makeNafflesApiCall: jest.fn().mockResolvedValue({ success: true }),
            createTaskEmbed: jest.fn().mockReturnValue({ title: 'Task Embed' }),
            createAllowlistEmbed: jest.fn().mockReturnValue({ title: 'Allowlist Embed' }),
            createInfoEmbed: jest.fn().mockReturnValue({ title: 'Info Embed' }),
            createErrorEmbed: jest.fn().mockReturnValue({ title: 'Error Embed' })
        };

        return { mockClient, mockDb, mockRedis, mockBotService };
    }

    async runTest(testName, testFunction) {
        try {
            console.log(`\n🧪 Running: ${testName}`);
            await testFunction();
            this.results.passed++;
            this.results.tests.push({ name: testName, status: 'PASSED' });
            console.log(`✅ ${testName} - PASSED`);
        } catch (error) {
            this.results.failed++;
            this.results.tests.push({ 
                name: testName, 
                status: 'FAILED', 
                error: error.message 
            });
            console.log(`❌ ${testName} - FAILED: ${error.message}`);
        }
    }

    async verifyServiceInitialization() {
        await this.runTest('Real-Time Sync Service Initialization', async () => {
            this.realTimeSyncService = new RealTimeSyncService(this.mockServices.mockBotService);
            await this.realTimeSyncService.initialize();
            
            if (!this.realTimeSyncService.syncQueue) {
                throw new Error('Sync queue not initialized');
            }
            
            if (!this.realTimeSyncService.batchQueue) {
                throw new Error('Batch queue not initialized');
            }
        });

        await this.runTest('Webhook Integration Service Initialization', async () => {
            this.webhookIntegrationService = new WebhookIntegrationService(
                this.mockServices.mockBotService,
                this.realTimeSyncService
            );
            
            // Mock Express app for testing
            this.webhookIntegrationService.app = {
                use: jest.fn(),
                post: jest.fn(),
                get: jest.fn(),
                listen: jest.fn((port, callback) => {
                    callback();
                    return { close: jest.fn() };
                })
            };
            
            await this.webhookIntegrationService.initialize();
            
            if (!this.webhookIntegrationService.eventHandlers) {
                throw new Error('Event handlers not initialized');
            }
        });

        await this.runTest('Sync Monitoring Service Initialization', async () => {
            this.syncMonitoringService = new SyncMonitoringService(
                this.mockServices.mockBotService,
                this.realTimeSyncService
            );
            
            await this.syncMonitoringService.initialize();
            
            if (!this.syncMonitoringService.performanceHistory) {
                throw new Error('Performance history not initialized');
            }
        });
    }

    async verifyTaskStatusSync() {
        await this.runTest('Task Status Synchronization', async () => {
            const taskData = {
                taskId: 'task123',
                newStatus: 'completed',
                metadata: { completedBy: 'user123' }
            };

            await this.realTimeSyncService.handleTaskStatusSync(taskData);
            
            if (this.realTimeSyncService.syncQueue.size === 0) {
                throw new Error('Task sync not queued');
            }
        });

        await this.runTest('Task Embed Updates', async () => {
            const taskId = 'task123';
            const updateData = { status: 'completed' };

            this.mockServices.mockBotService.makeNafflesApiCall.mockResolvedValueOnce({
                id: taskId,
                title: 'Test Task',
                status: 'completed'
            });

            await this.realTimeSyncService.updateDiscordTaskEmbeds(taskId, updateData);
            
            // Verify API calls were made
            if (!this.mockServices.mockBotService.makeNafflesApiCall.mock.calls.length) {
                throw new Error('No API calls made for task data');
            }
        });
    }

    async verifyAllowlistSync() {
        await this.runTest('Allowlist Synchronization', async () => {
            const allowlistData = {
                allowlistId: 'allowlist123',
                updateType: 'participant_added',
                changes: { totalParticipants: 50 }
            };

            await this.realTimeSyncService.handleAllowlistSync(allowlistData);
            
            if (this.realTimeSyncService.syncQueue.size === 0) {
                throw new Error('Allowlist sync not queued');
            }
        });

        await this.runTest('Allowlist Embed Updates', async () => {
            const allowlistId = 'allowlist123';
            const changes = { participants: 25 };

            this.mockServices.mockBotService.makeNafflesApiCall.mockResolvedValueOnce({
                id: allowlistId,
                title: 'Test Allowlist',
                participants: 25
            });

            await this.realTimeSyncService.updateDiscordAllowlistEmbeds(allowlistId, changes);
            
            // Verify embed updates were attempted
            if (!this.mockServices.mockClient.channels.fetch.mock.calls.length) {
                throw new Error('No channel fetch calls made');
            }
        });
    }

    async verifyUserProgressSync() {
        await this.runTest('User Progress Synchronization', async () => {
            const progressData = {
                userId: 'user123',
                progressType: 'points_earned',
                progressData: { points: 100 }
            };

            await this.realTimeSyncService.handleUserProgressSync(progressData);
            
            if (this.realTimeSyncService.syncQueue.size === 0) {
                throw new Error('User progress sync not queued');
            }
        });
    }

    async verifyBatchProcessing() {
        await this.runTest('Batch Synchronization', async () => {
            const batchData = {
                operations: [
                    { type: 'task_status', taskId: 'task1', newStatus: 'active' },
                    { type: 'task_status', taskId: 'task2', newStatus: 'completed' },
                    { type: 'allowlist_update', allowlistId: 'al1', updateType: 'status_change' }
                ],
                priority: 'normal'
            };

            await this.realTimeSyncService.handleBatchSync(batchData);
            
            if (this.realTimeSyncService.batchQueue.length === 0) {
                throw new Error('Batch operations not queued');
            }
        });

        await this.runTest('High Priority Batch Processing', async () => {
            const normalBatch = {
                operations: [{ type: 'task_status', taskId: 'task1' }],
                priority: 'normal'
            };
            const highPriorityBatch = {
                operations: [{ type: 'task_status', taskId: 'task2' }],
                priority: 'high'
            };

            await this.realTimeSyncService.handleBatchSync(normalBatch);
            await this.realTimeSyncService.handleBatchSync(highPriorityBatch);
            
            if (this.realTimeSyncService.batchQueue[0].priority !== 'high') {
                throw new Error('High priority batch not prioritized');
            }
        });

        await this.runTest('Batch Operation Grouping', async () => {
            const operations = [
                { operations: [{ type: 'task_status', taskId: 'task1' }] },
                { operations: [{ type: 'allowlist_update', allowlistId: 'al1' }] },
                { operations: [{ type: 'task_status', taskId: 'task2' }] }
            ];

            const grouped = this.realTimeSyncService.groupOperationsByType(operations);
            
            if (!grouped.task_status || grouped.task_status.length !== 2) {
                throw new Error('Task status operations not grouped correctly');
            }
            
            if (!grouped.allowlist_update || grouped.allowlist_update.length !== 1) {
                throw new Error('Allowlist operations not grouped correctly');
            }
        });
    }

    async verifyWebhookIntegration() {
        await this.runTest('Webhook Event Processing', async () => {
            const webhookData = {
                eventType: 'task.status_changed',
                data: { taskId: 'task123', newStatus: 'completed' },
                timestamp: new Date(),
                signature: 'valid_signature'
            };

            // Mock signature verification
            this.realTimeSyncService.verifyWebhookSignature = jest.fn(() => true);

            await this.realTimeSyncService.handleWebhookEvent(webhookData);
            
            if (this.realTimeSyncService.metrics.webhookEvents === 0) {
                throw new Error('Webhook event not processed');
            }
        });

        await this.runTest('Webhook Signature Verification', async () => {
            const validPayload = Buffer.from('{"test": "data"}');
            const validSignature = require('crypto')
                .createHmac('sha256', 'test_webhook_secret')
                .update(validPayload)
                .digest('hex');

            const isValid = this.webhookIntegrationService.verifyWebhookSignature(
                validPayload,
                validSignature
            );
            
            if (!isValid) {
                throw new Error('Valid webhook signature not verified');
            }

            // Test invalid signature
            const isInvalid = this.webhookIntegrationService.verifyWebhookSignature(
                validPayload,
                'invalid_signature'
            );
            
            if (isInvalid) {
                throw new Error('Invalid webhook signature was accepted');
            }
        });

        await this.runTest('Webhook Rate Limiting', async () => {
            const mockReq = { ip: '127.0.0.1' };
            const mockRes = {
                status: jest.fn(() => mockRes),
                json: jest.fn()
            };
            const mockNext = jest.fn();

            // Simulate exceeding rate limit
            this.webhookIntegrationService.rateLimits.set('127.0.0.1', {
                requests: 101,
                windowStart: Date.now()
            });

            this.webhookIntegrationService.rateLimitMiddleware(mockReq, mockRes, mockNext);
            
            if (!mockRes.status.mock.calls.some(call => call[0] === 429)) {
                throw new Error('Rate limit not enforced');
            }
        });
    }

    async verifyErrorHandling() {
        await this.runTest('Sync Operation Retry Logic', async () => {
            const syncId = 'sync123';
            const error = new Error('API call failed');

            this.realTimeSyncService.syncQueue.set(syncId, {
                type: 'task_status',
                taskId: 'task123',
                retries: 0
            });

            await this.realTimeSyncService.handleSyncRetry(syncId, error);

            const syncOp = this.realTimeSyncService.syncQueue.get(syncId);
            if (!syncOp || syncOp.retries !== 1) {
                throw new Error('Retry logic not working correctly');
            }
        });

        await this.runTest('Max Retries Handling', async () => {
            const syncId = 'sync456';
            const error = new Error('Persistent failure');

            this.realTimeSyncService.syncQueue.set(syncId, {
                type: 'task_status',
                taskId: 'task456',
                retries: 3 // At max retries
            });

            const initialFailedSyncs = this.realTimeSyncService.metrics.failedSyncs;
            await this.realTimeSyncService.handleSyncRetry(syncId, error);

            if (this.realTimeSyncService.syncQueue.has(syncId)) {
                throw new Error('Sync operation not removed after max retries');
            }
            
            if (this.realTimeSyncService.metrics.failedSyncs <= initialFailedSyncs) {
                throw new Error('Failed sync metric not incremented');
            }
        });

        await this.runTest('Error Cooldown System', async () => {
            const syncId = 'sync789';
            this.realTimeSyncService.errorCooldowns.set(syncId, Date.now());

            const isOnCooldown = this.realTimeSyncService.isOnErrorCooldown(syncId);
            
            if (!isOnCooldown) {
                throw new Error('Error cooldown not working');
            }
        });
    }

    async verifyPerformanceMonitoring() {
        await this.runTest('Performance Metrics Collection', async () => {
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

            this.realTimeSyncService.getStatistics = jest.fn(() => mockStats);

            await this.syncMonitoringService.collectPerformanceMetrics();
            
            if (this.syncMonitoringService.performanceHistory.length === 0) {
                throw new Error('Performance metrics not collected');
            }
        });

        await this.runTest('Health Check System', async () => {
            const mockStats = {
                queueSize: 50,
                batchQueueSize: 10,
                errorCooldowns: 5,
                successfulSyncs: 100,
                failedSyncs: 10,
                batchOperations: 20,
                syncOperations: 110
            };

            this.realTimeSyncService.getStatistics = jest.fn(() => mockStats);
            this.mockServices.mockRedis.lrange.mockResolvedValue([
                JSON.stringify({ timestamp: Date.now() - 60000 })
            ]);

            await this.syncMonitoringService.performHealthCheck();
            
            if (!this.syncMonitoringService.healthStatus.overall) {
                throw new Error('Health status not updated');
            }
        });

        await this.runTest('Alert Detection System', async () => {
            this.syncMonitoringService.performanceHistory.push({
                timestamp: Date.now(),
                failureRate: 0.15, // Above threshold
                averageSyncTime: 2000,
                queueSize: 50,
                errorCooldowns: 5
            });

            await this.syncMonitoringService.checkAlertConditions();
            
            if (this.syncMonitoringService.activeAlerts.size === 0) {
                throw new Error('Alert not generated for high failure rate');
            }
        });

        await this.runTest('Optimization Recommendations', async () => {
            // Add performance history with suboptimal metrics
            for (let i = 0; i < 15; i++) {
                this.syncMonitoringService.performanceHistory.push({
                    timestamp: Date.now() - i * 30000,
                    queueSize: 75,
                    averageSyncTime: 4000,
                    failureRate: 0.08,
                    batchQueueSize: 5
                });
            }

            const recommendations = await this.syncMonitoringService.analyzeOptimizationOpportunities();
            
            if (recommendations.length === 0) {
                throw new Error('No optimization recommendations generated');
            }
        });
    }

    async verifyIntegrationScenarios() {
        await this.runTest('End-to-End Sync Flow', async () => {
            // Simulate complete sync flow
            const taskData = {
                taskId: 'integration_test_task',
                newStatus: 'completed',
                metadata: { completedBy: 'user123' }
            };

            // Trigger sync
            await this.realTimeSyncService.handleTaskStatusSync(taskData);
            
            // Process sync queue
            await this.realTimeSyncService.processPendingSyncs();
            
            // Verify metrics were updated
            if (this.realTimeSyncService.metrics.syncOperations === 0) {
                throw new Error('Sync operations metric not updated');
            }
        });

        await this.runTest('Webhook to Sync Integration', async () => {
            const webhookData = {
                eventType: 'task.status_changed',
                data: {
                    taskId: 'webhook_test_task',
                    oldStatus: 'active',
                    newStatus: 'completed',
                    changes: { completedBy: 'user456' }
                },
                timestamp: new Date(),
                signature: 'valid_signature'
            };

            this.realTimeSyncService.verifyWebhookSignature = jest.fn(() => true);

            const initialQueueSize = this.realTimeSyncService.syncQueue.size;
            await this.realTimeSyncService.handleWebhookEvent(webhookData);
            
            if (this.realTimeSyncService.syncQueue.size <= initialQueueSize) {
                throw new Error('Webhook did not trigger sync operation');
            }
        });

        await this.runTest('Monitoring and Alerting Integration', async () => {
            // Simulate poor performance
            const mockStats = {
                syncOperations: 100,
                successfulSyncs: 70,
                failedSyncs: 30,
                queueSize: 150,
                activeSyncs: 10,
                batchQueueSize: 20,
                errorCooldowns: 15,
                averageSyncTime: 6000,
                webhookEvents: 50
            };

            this.realTimeSyncService.getStatistics = jest.fn(() => mockStats);

            // Collect metrics and check alerts
            await this.syncMonitoringService.collectPerformanceMetrics();
            await this.syncMonitoringService.checkAlertConditions();
            
            if (this.syncMonitoringService.activeAlerts.size === 0) {
                throw new Error('No alerts generated for poor performance');
            }
        });
    }

    async verifyStatisticsAndReporting() {
        await this.runTest('Service Statistics', async () => {
            const syncStats = this.realTimeSyncService.getStatistics();
            const webhookStats = this.webhookIntegrationService.getStatistics();
            const monitoringStats = this.syncMonitoringService.getStatistics();

            if (!syncStats.syncOperations && syncStats.syncOperations !== 0) {
                throw new Error('Sync statistics missing syncOperations');
            }
            
            if (!webhookStats.webhooksReceived && webhookStats.webhooksReceived !== 0) {
                throw new Error('Webhook statistics missing webhooksReceived');
            }
            
            if (!monitoringStats.healthStatus) {
                throw new Error('Monitoring statistics missing healthStatus');
            }
        });

        await this.runTest('Performance Trends Analysis', async () => {
            // Add trend data
            const now = Date.now();
            this.syncMonitoringService.performanceHistory = [
                { timestamp: now - 60000, queueSize: 10, failureRate: 0.05, averageSyncTime: 1000, syncOperations: 100 },
                { timestamp: now - 30000, queueSize: 15, failureRate: 0.07, averageSyncTime: 1200, syncOperations: 150 },
                { timestamp: now, queueSize: 20, failureRate: 0.10, averageSyncTime: 1500, syncOperations: 200 }
            ];

            const trends = this.syncMonitoringService.getPerformanceTrends(120000);
            
            if (!trends.trends || !trends.summary) {
                throw new Error('Performance trends not calculated correctly');
            }
        });
    }

    async runAllTests() {
        console.log('🚀 Starting Real-Time Synchronization System Verification\n');
        console.log('=' .repeat(60));

        try {
            await this.verifyServiceInitialization();
            await this.verifyTaskStatusSync();
            await this.verifyAllowlistSync();
            await this.verifyUserProgressSync();
            await this.verifyBatchProcessing();
            await this.verifyWebhookIntegration();
            await this.verifyErrorHandling();
            await this.verifyPerformanceMonitoring();
            await this.verifyIntegrationScenarios();
            await this.verifyStatisticsAndReporting();

        } catch (error) {
            console.error('\n💥 Verification failed with error:', error.message);
            this.results.failed++;
        }

        this.printResults();
    }

    printResults() {
        console.log('\n' + '=' .repeat(60));
        console.log('📊 VERIFICATION RESULTS');
        console.log('=' .repeat(60));

        console.log(`\n✅ Passed: ${this.results.passed}`);
        console.log(`❌ Failed: ${this.results.failed}`);
        console.log(`📈 Success Rate: ${((this.results.passed / (this.results.passed + this.results.failed)) * 100).toFixed(1)}%`);

        if (this.results.failed > 0) {
            console.log('\n❌ FAILED TESTS:');
            this.results.tests
                .filter(test => test.status === 'FAILED')
                .forEach(test => {
                    console.log(`   • ${test.name}: ${test.error}`);
                });
        }

        console.log('\n📋 DETAILED RESULTS:');
        this.results.tests.forEach(test => {
            const status = test.status === 'PASSED' ? '✅' : '❌';
            console.log(`   ${status} ${test.name}`);
        });

        if (this.results.failed === 0) {
            console.log('\n🎉 All real-time synchronization system tests passed!');
            console.log('✨ The system is ready for production use.');
        } else {
            console.log('\n⚠️  Some tests failed. Please review and fix the issues.');
            process.exit(1);
        }
    }
}

// Run verification if called directly
if (require.main === module) {
    const verification = new RealTimeSyncVerification();
    verification.runAllTests().catch(error => {
        console.error('Verification script failed:', error);
        process.exit(1);
    });
}

module.exports = RealTimeSyncVerification;