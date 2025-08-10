#!/usr/bin/env node

const AllowlistIntegrationService = require('./src/services/allowlistIntegrationService');
const AllowlistConnection = require('./src/models/allowlistConnection');
const logger = require('./src/utils/logger');

/**
 * Comprehensive verification script for Allowlist Integration functionality
 */
class AllowlistIntegrationVerification {
    constructor() {
        this.testResults = [];
        this.mockBotService = this.createMockBotService();
        this.service = new AllowlistIntegrationService(this.mockBotService);
    }

    createMockBotService() {
        return {
            client: {
                channels: {
                    fetch: jest.fn().mockResolvedValue({
                        id: 'test-channel-id',
                        guild: { id: 'test-guild-id' },
                        send: jest.fn().mockResolvedValue({
                            id: 'test-message-id',
                            edit: jest.fn().mockResolvedValue()
                        })
                    })
                },
                guilds: {
                    fetch: jest.fn().mockResolvedValue({
                        members: {
                            fetch: jest.fn().mockResolvedValue({
                                joinedAt: new Date(),
                                roles: {
                                    cache: {
                                        some: (callback) => callback({ name: 'Member', id: 'role1' }),
                                        map: (callback) => [callback({ name: 'Member', id: 'role1' })]
                                    }
                                }
                            })
                        }
                    })
                }
            },
            rateLimiter: {
                checkRateLimit: jest.fn().mockResolvedValue(false)
            },
            db: {
                getUserAccountLink: jest.fn().mockResolvedValue({
                    nafflesUserId: 'test-naffles-user-id',
                    walletAddress: '0x123...'
                })
            },
            makeNafflesApiCall: jest.fn(),
            getServerCommunityMapping: jest.fn().mockResolvedValue({
                communityId: 'test-community-id',
                communityName: 'Test Community'
            }),
            logInteraction: jest.fn().mockResolvedValue(true)
        };
    }

    async runTest(testName, testFunction) {
        try {
            console.log(`\n🧪 Running: ${testName}`);
            await testFunction();
            console.log(`✅ PASSED: ${testName}`);
            this.testResults.push({ name: testName, status: 'PASSED' });
        } catch (error) {
            console.error(`❌ FAILED: ${testName} - ${error.message}`);
            this.testResults.push({ name: testName, status: 'FAILED', error: error.message });
        }
    }

    async testServiceInstantiation() {
        if (!this.service) {
            throw new Error('Service not instantiated');
        }
        
        if (typeof this.service.connectAllowlistToServer !== 'function') {
            throw new Error('connectAllowlistToServer method not found');
        }
        
        if (typeof this.service.processAllowlistEntry !== 'function') {
            throw new Error('processAllowlistEntry method not found');
        }
        
        if (typeof this.service.validateSocialRequirements !== 'function') {
            throw new Error('validateSocialRequirements method not found');
        }
        
        if (typeof this.service.getAllowlistAnalytics !== 'function') {
            throw new Error('getAllowlistAnalytics method not found');
        }
    }

    async testFormatTaskType() {
        const testCases = [
            { input: 'twitter_follow', expected: '🐦 Twitter Follow' },
            { input: 'discord_join', expected: '💬 Discord Join' },
            { input: 'telegram_join', expected: '📱 Telegram Join' },
            { input: 'custom', expected: '🔧 Custom Task' },
            { input: 'unknown_type', expected: '🔧 unknown_type' }
        ];

        for (const testCase of testCases) {
            const result = this.service.formatTaskType(testCase.input);
            if (result !== testCase.expected) {
                throw new Error(`Expected "${testCase.expected}", got "${result}" for input "${testCase.input}"`);
            }
        }
    }

    async testCreateComprehensiveAllowlistEmbed() {
        const mockAllowlist = {
            id: 'test-allowlist-id',
            title: 'Test Allowlist',
            description: 'Test description',
            prize: 'NFT Collection',
            winnerCount: 10,
            entryPrice: { amount: '0.1', tokenType: 'ETH' },
            totalEntries: 25,
            endTime: new Date(Date.now() + 86400000),
            status: 'active',
            socialTasks: [
                {
                    taskType: 'twitter_follow',
                    required: true
                }
            ],
            profitGuaranteePercentage: 50
        };

        const embed = this.service.createComprehensiveAllowlistEmbed(mockAllowlist);
        
        if (!embed) {
            throw new Error('Embed not created');
        }
        
        if (!embed.data.title.includes('Test Allowlist')) {
            throw new Error('Embed title not set correctly');
        }
        
        if (!embed.data.fields || embed.data.fields.length === 0) {
            throw new Error('Embed fields not set');
        }
        
        // Check for required fields
        const fieldNames = embed.data.fields.map(field => field.name);
        const requiredFields = ['🏆 Prize', '👥 Winners', '💰 Entry Price', '📊 Participants', '⏰ Ends', '📈 Status'];
        
        for (const requiredField of requiredFields) {
            if (!fieldNames.some(name => name.includes(requiredField.split(' ')[1]))) {
                throw new Error(`Required field "${requiredField}" not found in embed`);
            }
        }
    }

    async testCreateAllowlistActionButtons() {
        const mockAllowlist = {
            id: 'test-allowlist-id',
            status: 'active',
            endTime: new Date(Date.now() + 86400000)
        };

        const actionRow = this.service.createAllowlistActionButtons(mockAllowlist);
        
        if (!actionRow) {
            throw new Error('Action row not created');
        }
        
        if (!actionRow.components || actionRow.components.length === 0) {
            throw new Error('Action row has no components');
        }
        
        // Check for required buttons
        const buttonLabels = actionRow.components.map(component => component.data.label);
        const requiredButtons = ['Enter Allowlist', 'View Details', 'View on Naffles'];
        
        for (const requiredButton of requiredButtons) {
            if (!buttonLabels.includes(requiredButton)) {
                throw new Error(`Required button "${requiredButton}" not found`);
            }
        }
    }

    async testValidateSocialRequirementsNoTasks() {
        const mockAllowlist = {
            socialTasks: []
        };

        const result = await this.service.validateSocialRequirements(
            mockAllowlist,
            'test-naffles-user-id',
            'test-discord-user-id'
        );

        if (!result.valid) {
            throw new Error('Should be valid with no social tasks');
        }
        
        if (result.completedTasks.length !== 0) {
            throw new Error('Should have no completed tasks');
        }
    }

    async testValidateDiscordJoinSuccess() {
        const mockTask = {
            verificationData: {
                discord: {
                    serverId: 'test-server-id',
                    serverName: 'Test Server'
                }
            }
        };

        const result = await this.service.validateDiscordJoin(mockTask, 'test-discord-user-id');

        if (!result.valid) {
            throw new Error(`Discord join validation should succeed: ${result.reason}`);
        }
        
        if (result.reason !== 'Discord membership verified') {
            throw new Error(`Unexpected reason: ${result.reason}`);
        }
    }

    async testValidateTwitterFollow() {
        const mockTask = {
            taskId: 'test-task-id',
            verificationData: {
                twitter: {
                    username: 'testaccount'
                }
            }
        };

        // Mock successful Twitter verification
        this.mockBotService.makeNafflesApiCall.mockResolvedValueOnce({
            verified: true,
            data: { method: 'twitter_api' }
        });

        const result = await this.service.validateTwitterFollow(mockTask, 'test-naffles-user-id');

        if (!result.valid) {
            throw new Error(`Twitter follow validation should succeed: ${result.reason}`);
        }
        
        if (result.reason !== 'Verified') {
            throw new Error(`Unexpected reason: ${result.reason}`);
        }
    }

    async testValidateTelegramJoin() {
        const mockTask = {
            taskId: 'test-task-id',
            verificationData: {
                telegram: {
                    channelId: 'test-channel-id',
                    channelName: 'Test Channel'
                }
            }
        };

        // Mock successful Telegram verification
        this.mockBotService.makeNafflesApiCall.mockResolvedValueOnce({
            verified: true,
            data: { method: 'telegram_api' }
        });

        const result = await this.service.validateTelegramJoin(mockTask, 'test-naffles-user-id');

        if (!result.valid) {
            throw new Error(`Telegram join validation should succeed: ${result.reason}`);
        }
        
        if (result.reason !== 'Verified') {
            throw new Error(`Unexpected reason: ${result.reason}`);
        }
    }

    async testValidateCustomTask() {
        const mockTask = {
            taskId: 'test-task-id',
            verificationData: {
                custom: {
                    verificationUrl: 'https://example.com/verify'
                }
            }
        };

        // Mock successful custom task verification
        this.mockBotService.makeNafflesApiCall.mockResolvedValueOnce({
            verified: true,
            data: { method: 'custom_verification' }
        });

        const result = await this.service.validateCustomTask(mockTask, 'test-naffles-user-id');

        if (!result.valid) {
            throw new Error(`Custom task validation should succeed: ${result.reason}`);
        }
        
        if (result.reason !== 'Verified') {
            throw new Error(`Unexpected reason: ${result.reason}`);
        }
    }

    async testCleanup() {
        // Set up some resources
        this.service.activeConnections.set('test', {});
        this.service.entryCache.set('test', {});

        // Call cleanup
        this.service.cleanup();

        if (this.service.activeConnections.size !== 0) {
            throw new Error('Active connections not cleared');
        }
        
        if (this.service.entryCache.size !== 0) {
            throw new Error('Entry cache not cleared');
        }
    }

    async runAllTests() {
        console.log('🚀 Starting Allowlist Integration Service Verification\n');

        await this.runTest('Service Instantiation', () => this.testServiceInstantiation());
        await this.runTest('Format Task Type', () => this.testFormatTaskType());
        await this.runTest('Create Comprehensive Allowlist Embed', () => this.testCreateComprehensiveAllowlistEmbed());
        await this.runTest('Create Allowlist Action Buttons', () => this.testCreateAllowlistActionButtons());
        await this.runTest('Validate Social Requirements (No Tasks)', () => this.testValidateSocialRequirementsNoTasks());
        await this.runTest('Validate Discord Join Success', () => this.testValidateDiscordJoinSuccess());
        await this.runTest('Validate Twitter Follow', () => this.testValidateTwitterFollow());
        await this.runTest('Validate Telegram Join', () => this.testValidateTelegramJoin());
        await this.runTest('Validate Custom Task', () => this.testValidateCustomTask());
        await this.runTest('Cleanup', () => this.testCleanup());

        this.printSummary();
    }

    printSummary() {
        console.log('\n📊 Test Summary:');
        console.log('================');
        
        const passed = this.testResults.filter(result => result.status === 'PASSED').length;
        const failed = this.testResults.filter(result => result.status === 'FAILED').length;
        const total = this.testResults.length;
        
        console.log(`Total Tests: ${total}`);
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        
        if (failed > 0) {
            console.log('\n❌ Failed Tests:');
            this.testResults
                .filter(result => result.status === 'FAILED')
                .forEach(result => {
                    console.log(`  - ${result.name}: ${result.error}`);
                });
        }
        
        const successRate = ((passed / total) * 100).toFixed(1);
        console.log(`\n🎯 Success Rate: ${successRate}%`);
        
        if (failed === 0) {
            console.log('\n🎉 All tests passed! Allowlist Integration Service is working correctly.');
        } else {
            console.log('\n⚠️  Some tests failed. Please review the implementation.');
        }
    }
}

// Mock Jest functions for standalone execution
global.jest = {
    fn: () => {
        const mockFn = function(...args) {
            if (mockFn._mockResolvedValueOnce && mockFn._mockResolvedValueOnce.length > 0) {
                return Promise.resolve(mockFn._mockResolvedValueOnce.shift());
            }
            if (mockFn._mockResolvedValue !== undefined) {
                return Promise.resolve(mockFn._mockResolvedValue);
            }
            if (mockFn._mockImplementation) {
                return mockFn._mockImplementation(...args);
            }
            return Promise.resolve();
        };
        
        mockFn.mockResolvedValue = function(value) {
            this._mockResolvedValue = value;
            return this;
        };
        
        mockFn.mockResolvedValueOnce = function(value) {
            this._mockResolvedValueOnce = this._mockResolvedValueOnce || [];
            this._mockResolvedValueOnce.push(value);
            return this;
        };
        
        mockFn.mockImplementation = function(fn) {
            this._mockImplementation = fn;
            return this;
        };
        
        return mockFn;
    }
};

// Run verification if this file is executed directly
if (require.main === module) {
    const verification = new AllowlistIntegrationVerification();
    verification.runAllTests().catch(error => {
        console.error('Verification failed:', error);
        process.exit(1);
    });
}

module.exports = AllowlistIntegrationVerification;