const ErrorHandler = require('./src/utils/errorHandler');
const FallbackService = require('./src/services/fallbackService');
const logger = require('./src/utils/logger');

// Mock Discord.js components for testing
const mockDiscordComponents = {
    EmbedBuilder: class {
        constructor() {
            this.data = {};
        }
        setColor(color) { this.data.color = color; return this; }
        setTitle(title) { this.data.title = title; return this; }
        setDescription(desc) { this.data.description = desc; return this; }
        addFields(fields) { this.data.fields = fields; return this; }
        setFooter(footer) { this.data.footer = footer; return this; }
        setTimestamp() { this.data.timestamp = new Date(); return this; }
    },
    ActionRowBuilder: class {
        constructor() {
            this.components = [];
        }
        addComponents(...components) {
            this.components.push(...components);
            return this;
        }
    },
    ButtonBuilder: class {
        constructor() {
            this.data = {};
        }
        setLabel(label) { this.data.label = label; return this; }
        setStyle(style) { this.data.style = style; return this; }
        setURL(url) { this.data.url = url; return this; }
        setEmoji(emoji) { this.data.emoji = emoji; return this; }
    },
    ButtonStyle: {
        Link: 5
    }
};

// Mock the discord.js module for standalone execution
if (typeof require !== 'undefined') {
    const Module = require('module');
    const originalRequire = Module.prototype.require;
    
    Module.prototype.require = function(id) {
        if (id === 'discord.js') {
            return mockDiscordComponents;
        }
        return originalRequire.apply(this, arguments);
    };
}

class ErrorHandlingFallbackVerifier {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            tests: []
        };
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
            this.results.tests.push({ name: testName, status: 'FAILED', error: error.message });
            console.log(`❌ ${testName} - FAILED: ${error.message}`);
        }
    }

    async verifyErrorHandler() {
        console.log('\n🔍 Verifying Error Handler...');

        await this.runTest('ErrorHandler Initialization', async () => {
            const errorHandler = new ErrorHandler();
            if (!errorHandler.errorCounts || !errorHandler.retryConfig) {
                throw new Error('ErrorHandler not properly initialized');
            }
        });

        await this.runTest('Discord Error Categorization', async () => {
            const errorHandler = new ErrorHandler();
            
            // Test rate limit error
            const rateLimitError = new Error('Rate limit exceeded');
            rateLimitError.code = 429;
            const result = errorHandler.handleDiscordError(rateLimitError);
            
            if (result.type !== 'rate_limit' || !result.recoverable) {
                throw new Error('Rate limit error not properly categorized');
            }
        });

        await this.runTest('API Error Categorization', async () => {
            const errorHandler = new ErrorHandler();
            
            // Test timeout error
            const timeoutError = new Error('Request timeout');
            timeoutError.code = 'ECONNABORTED';
            const result = errorHandler.handleApiError(timeoutError);
            
            if (result.type !== 'timeout' || result.action !== 'retry') {
                throw new Error('Timeout error not properly categorized');
            }
        });

        await this.runTest('Database Error Categorization', async () => {
            const errorHandler = new ErrorHandler();
            
            // Test connection error
            const connectionError = new Error('Database connection failed');
            const result = errorHandler.handleDatabaseError(connectionError);
            
            if (result.type !== 'connection' || result.severity !== 'critical') {
                throw new Error('Database connection error not properly categorized');
            }
        });

        await this.runTest('Retry Mechanism', async () => {
            const errorHandler = new ErrorHandler();
            let attempts = 0;
            
            const mockOperation = () => {
                attempts++;
                if (attempts < 3) {
                    throw new Error('Test error');
                }
                return 'success';
            };

            const result = await errorHandler.executeWithRetry(mockOperation, { maxRetries: 3 });
            
            if (result !== 'success' || attempts !== 3) {
                throw new Error('Retry mechanism not working correctly');
            }
        });

        await this.runTest('Exponential Backoff Calculation', async () => {
            const errorHandler = new ErrorHandler();
            
            const delay1 = errorHandler.calculateRetryDelay(0);
            const delay2 = errorHandler.calculateRetryDelay(1);
            const delay3 = errorHandler.calculateRetryDelay(2);
            
            if (delay1 >= delay2 || delay2 >= delay3) {
                throw new Error('Exponential backoff not working correctly');
            }
        });

        await this.runTest('Maintenance Mode Management', async () => {
            const errorHandler = new ErrorHandler();
            
            errorHandler.activateMaintenanceMode('Test maintenance', new Date(Date.now() + 3600000));
            
            if (!errorHandler.isMaintenanceModeActive()) {
                throw new Error('Maintenance mode not activated');
            }
            
            errorHandler.deactivateMaintenanceMode();
            
            if (errorHandler.isMaintenanceModeActive()) {
                throw new Error('Maintenance mode not deactivated');
            }
        });

        await this.runTest('Service Status Tracking', async () => {
            const errorHandler = new ErrorHandler();
            
            errorHandler.updateServiceStatus('testService', false);
            const status = errorHandler.getServiceStatus('testService');
            
            if (status.available !== false) {
                throw new Error('Service status not updated correctly');
            }
        });

        await this.runTest('Error Statistics', async () => {
            const errorHandler = new ErrorHandler();
            
            // Generate some test errors
            errorHandler.trackError('test', 'error1');
            errorHandler.trackError('test', 'error2');
            
            const stats = errorHandler.getErrorStatistics();
            
            if (!stats.categories.test || stats.categories.test.total < 2) {
                throw new Error('Error statistics not tracking correctly');
            }
        });
    }

    async verifyFallbackService() {
        console.log('\n🔍 Verifying Fallback Service...');

        await this.runTest('FallbackService Initialization', async () => {
            const mockBotService = {
                db: {
                    logFallbackUsage: jest.fn().mockResolvedValue(true)
                }
            };
            
            const fallbackService = new FallbackService(mockBotService);
            
            if (!fallbackService.fallbackConfig || !fallbackService.fallbackStats) {
                throw new Error('FallbackService not properly initialized');
            }
        });

        await this.runTest('API Unavailable Handling', async () => {
            const mockBotService = { db: { logFallbackUsage: jest.fn() } };
            const fallbackService = new FallbackService(mockBotService);
            
            const mockInteraction = {
                guildId: 'test-guild',
                user: { id: 'test-user' },
                replied: false,
                reply: jest.fn().mockResolvedValue(true)
            };
            
            await fallbackService.handleApiUnavailable(mockInteraction, 'test_operation', new Error('API down'));
            
            if (fallbackService.fallbackStats.apiFailures !== 1) {
                throw new Error('API failure not tracked correctly');
            }
        });

        await this.runTest('Database Unavailable Handling', async () => {
            const mockBotService = { db: { logFallbackUsage: jest.fn() } };
            const fallbackService = new FallbackService(mockBotService);
            
            const mockInteraction = {
                guildId: 'test-guild',
                user: { id: 'test-user' },
                replied: false,
                reply: jest.fn().mockResolvedValue(true)
            };
            
            await fallbackService.handleDatabaseUnavailable(mockInteraction, 'test_operation', new Error('DB down'));
            
            if (fallbackService.fallbackStats.databaseFailures !== 1) {
                throw new Error('Database failure not tracked correctly');
            }
        });

        await this.runTest('Discord API Failure Handling', async () => {
            const mockBotService = { db: { logFallbackUsage: jest.fn() } };
            const fallbackService = new FallbackService(mockBotService);
            
            const mockInteraction = {
                guildId: 'test-guild',
                user: { id: 'test-user' },
                replied: false,
                reply: jest.fn().mockResolvedValue(true)
            };
            
            await fallbackService.handleDiscordApiFailure(mockInteraction, 'test_operation', new Error('Discord down'));
            
            if (fallbackService.fallbackStats.discordFailures !== 1) {
                throw new Error('Discord failure not tracked correctly');
            }
        });

        await this.runTest('Maintenance Mode Handling', async () => {
            const mockBotService = { db: { logFallbackUsage: jest.fn() } };
            const fallbackService = new FallbackService(mockBotService);
            
            const mockInteraction = {
                guildId: 'test-guild',
                user: { id: 'test-user' },
                replied: false,
                reply: jest.fn().mockResolvedValue(true)
            };
            
            const maintenanceInfo = {
                active: true,
                reason: 'Test maintenance',
                estimatedEndTime: new Date(Date.now() + 3600000)
            };
            
            await fallbackService.handleMaintenanceMode(mockInteraction, maintenanceInfo);
            
            // Should complete without throwing
        });

        await this.runTest('Graceful Degradation', async () => {
            const mockBotService = { db: { logFallbackUsage: jest.fn() } };
            const fallbackService = new FallbackService(mockBotService);
            
            const degradation = fallbackService.getGracefulDegradation('task_creation');
            
            if (!degradation.alternative || !degradation.message) {
                throw new Error('Graceful degradation not providing alternatives');
            }
        });

        await this.runTest('Fallback Decision Logic', async () => {
            const mockBotService = { db: { logFallbackUsage: jest.fn() } };
            const fallbackService = new FallbackService(mockBotService);
            
            // Test network error
            const networkError = new Error('ECONNREFUSED');
            networkError.code = 'ECONNREFUSED';
            
            const decision = fallbackService.shouldUseFallback(networkError, 'test_operation');
            
            if (!decision.useFallback || decision.type !== 'api_unavailable') {
                throw new Error('Fallback decision logic not working correctly');
            }
        });

        await this.runTest('User-Friendly Messages', async () => {
            const mockBotService = { db: { logFallbackUsage: jest.fn() } };
            const fallbackService = new FallbackService(mockBotService);
            
            const message = fallbackService.createUserFriendlyMessage(
                new Error('Test error'),
                { context: 'task_creation', suggestAlternatives: true }
            );
            
            if (!message.message || !message.alternatives || message.alternatives.length === 0) {
                throw new Error('User-friendly messages not generated correctly');
            }
        });

        await this.runTest('Troubleshooting Steps', async () => {
            const mockBotService = { db: { logFallbackUsage: jest.fn() } };
            const fallbackService = new FallbackService(mockBotService);
            
            const steps = fallbackService.getTroubleshootingSteps('connection_error');
            
            if (!steps.steps || steps.steps.length === 0) {
                throw new Error('Troubleshooting steps not provided');
            }
        });

        await this.runTest('Fallback Statistics', async () => {
            const mockBotService = { db: { logFallbackUsage: jest.fn() } };
            const fallbackService = new FallbackService(mockBotService);
            
            fallbackService.recordFallbackSuccess('website_redirect', 'test_operation');
            fallbackService.recordFallbackFailure('cached_data', 'test_operation');
            
            const stats = fallbackService.getFallbackStatistics();
            
            if (!stats.website_redirect || stats.website_redirect.successCount !== 1) {
                throw new Error('Fallback statistics not tracking correctly');
            }
        });
    }

    async verifyIntegration() {
        console.log('\n🔍 Verifying Integration...');

        await this.runTest('Error Handler and Fallback Integration', async () => {
            const errorHandler = new ErrorHandler();
            const mockBotService = { db: { logFallbackUsage: jest.fn() } };
            const fallbackService = new FallbackService(mockBotService);
            
            // Test error that should trigger fallback
            const error = new Error('Connection failed');
            const errorResult = errorHandler.handleApiError(error);
            
            if (!errorHandler.shouldTriggerFallback(errorResult)) {
                throw new Error('Error handler not triggering fallback correctly');
            }
            
            const fallbackDecision = fallbackService.shouldUseFallback(error, 'test_operation');
            
            if (!fallbackDecision.useFallback) {
                throw new Error('Fallback service not accepting error for fallback');
            }
        });

        await this.runTest('End-to-End Error Flow', async () => {
            const errorHandler = new ErrorHandler();
            const mockBotService = { db: { logFallbackUsage: jest.fn() } };
            const fallbackService = new FallbackService(mockBotService);
            
            const mockInteraction = {
                guildId: 'test-guild',
                user: { id: 'test-user' },
                replied: false,
                reply: jest.fn().mockResolvedValue(true)
            };
            
            // Simulate complete error handling flow
            const error = new Error('Service unavailable');
            error.code = 'ECONNREFUSED';
            
            const errorResult = errorHandler.handleApiError(error);
            
            if (errorHandler.shouldTriggerFallback(errorResult)) {
                await fallbackService.handleApiUnavailable(mockInteraction, 'test_operation', error);
            }
            
            // Verify interaction was called
            if (!mockInteraction.reply.mock.calls.length) {
                throw new Error('End-to-end flow not completing interaction');
            }
        });
    }

    async verifyPerformance() {
        console.log('\n🔍 Verifying Performance...');

        await this.runTest('High Error Rate Handling', async () => {
            const errorHandler = new ErrorHandler();
            const startTime = Date.now();
            
            // Generate 100 errors quickly
            for (let i = 0; i < 100; i++) {
                const error = new Error(`Test error ${i}`);
                errorHandler.handleGeneralError(error);
            }
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            if (duration > 5000) { // Should complete within 5 seconds
                throw new Error(`High error rate handling too slow: ${duration}ms`);
            }
        });

        await this.runTest('Memory Usage Under Load', async () => {
            const errorHandler = new ErrorHandler();
            const initialMemory = process.memoryUsage().heapUsed;
            
            // Generate many errors to test memory management
            for (let i = 0; i < 1000; i++) {
                const error = new Error(`Memory test error ${i}`);
                errorHandler.handleApiError(error);
            }
            
            // Force cleanup
            errorHandler.cleanup();
            
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;
            
            // Memory increase should be reasonable (less than 50MB)
            if (memoryIncrease > 50 * 1024 * 1024) {
                throw new Error(`Excessive memory usage: ${memoryIncrease / 1024 / 1024}MB`);
            }
        });
    }

    async runAllTests() {
        console.log('🚀 Starting Error Handling and Fallback System Verification...\n');

        await this.verifyErrorHandler();
        await this.verifyFallbackService();
        await this.verifyIntegration();
        await this.verifyPerformance();

        this.printResults();
    }

    printResults() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 VERIFICATION RESULTS');
        console.log('='.repeat(60));
        
        console.log(`✅ Passed: ${this.results.passed}`);
        console.log(`❌ Failed: ${this.results.failed}`);
        console.log(`📈 Success Rate: ${((this.results.passed / (this.results.passed + this.results.failed)) * 100).toFixed(1)}%`);
        
        if (this.results.failed > 0) {
            console.log('\n❌ Failed Tests:');
            this.results.tests
                .filter(test => test.status === 'FAILED')
                .forEach(test => {
                    console.log(`   • ${test.name}: ${test.error}`);
                });
        }
        
        console.log('\n' + '='.repeat(60));
        
        if (this.results.failed === 0) {
            console.log('🎉 All tests passed! Error handling and fallback system is working correctly.');
        } else {
            console.log('⚠️  Some tests failed. Please review the implementation.');
            process.exit(1);
        }
    }
}

// Mock jest functions for standalone execution
if (typeof jest === 'undefined') {
    global.jest = {
        fn: () => {
            const mockFn = () => Promise.resolve(true);
            mockFn.mockResolvedValue = () => mockFn;
            mockFn.mock = { calls: [] };
            return mockFn;
        }
    };
}

// Run verification
const verifier = new ErrorHandlingFallbackVerifier();
verifier.runAllTests().catch(error => {
    console.error('Verification failed:', error);
    process.exit(1);
});