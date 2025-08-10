const ErrorHandler = require('../src/utils/errorHandler');
const FallbackService = require('../src/services/fallbackService');
const logger = require('../src/utils/logger');

// Mock logger
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    security: jest.fn(),
    logError: jest.fn(),
    discord: jest.fn(),
    api: jest.fn(),
    database: jest.fn(),
    performance: jest.fn(),
    audit: jest.fn(),
    logWithContext: jest.fn(),
    logApiCall: jest.fn()
};

jest.mock('../src/utils/logger', () => mockLogger);

describe('Error Handling and Fallback System', () => {
    let errorHandler;
    let fallbackService;
    let mockBotService;
    let mockInteraction;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Clear all mock logger functions
        Object.values(mockLogger).forEach(mockFn => {
            if (typeof mockFn === 'function' && mockFn.mockClear) {
                mockFn.mockClear();
            }
        });
        
        // Mock bot service
        mockBotService = {
            db: {
                logFallbackUsage: jest.fn().mockResolvedValue(true)
            }
        };

        // Mock Discord interaction
        mockInteraction = {
            guildId: 'test-guild-123',
            user: { id: 'test-user-456' },
            replied: false,
            deferred: false,
            reply: jest.fn().mockResolvedValue(true),
            editReply: jest.fn().mockResolvedValue(true)
        };

        errorHandler = new ErrorHandler();
        fallbackService = new FallbackService(mockBotService);
    });

    describe('ErrorHandler', () => {
        describe('Error Categorization', () => {
            test('should categorize Discord rate limit errors correctly', () => {
                const error = new Error('Rate limit exceeded');
                error.code = 429;

                const result = errorHandler.handleDiscordError(error);

                expect(result.type).toBe('rate_limit');
                expect(result.severity).toBe('medium');
                expect(result.recoverable).toBe(true);
                expect(result.userMessage).toContain('wait a moment');
            });

            test('should categorize Discord permission errors correctly', () => {
                const error = new Error('Missing permissions');
                error.code = 50013;

                const result = errorHandler.handleDiscordError(error);

                expect(result.type).toBe('permissions');
                expect(result.severity).toBe('medium');
                expect(result.recoverable).toBe(false);
                expect(result.userMessage).toContain('permissions');
            });

            test('should categorize API timeout errors correctly', () => {
                const error = new Error('Request timeout');
                error.code = 'ECONNABORTED';

                const result = errorHandler.handleApiError(error);

                expect(result.type).toBe('timeout');
                expect(result.severity).toBe('medium');
                expect(result.recoverable).toBe(true);
                expect(result.action).toBe('retry');
            });

            test('should categorize API network errors correctly', () => {
                const error = new Error('Connection refused');
                error.code = 'ECONNREFUSED';

                const result = errorHandler.handleApiError(error);

                expect(result.type).toBe('network');
                expect(result.severity).toBe('high');
                expect(result.recoverable).toBe(true);
                expect(result.action).toBe('retry_with_delay');
            });

            test('should categorize database connection errors correctly', () => {
                const error = new Error('Database connection failed');
                error.name = 'ConnectionError';

                const result = errorHandler.handleDatabaseError(error);

                expect(result.type).toBe('connection');
                expect(result.severity).toBe('critical');
                expect(result.recoverable).toBe(true);
                expect(result.action).toBe('reconnect');
            });
        });

        describe('Error Tracking', () => {
            test('should track error occurrences', () => {
                const error = new Error('Test error');
                
                errorHandler.handleGeneralError(error);
                errorHandler.handleGeneralError(error);

                const stats = errorHandler.getErrorStatistics();
                expect(stats.total).toBeGreaterThan(0);
                expect(stats.categories.general).toBeDefined();
            });

            test('should detect error threshold exceeded', () => {
                const error = new Error('Rate limit');
                error.code = 429;

                // Trigger multiple errors to exceed threshold
                for (let i = 0; i < 15; i++) {
                    errorHandler.handleDiscordError(error);
                }

                expect(mockLogger.security).toHaveBeenCalledWith(
                    'Error threshold exceeded',
                    expect.objectContaining({
                        category: 'discord',
                        type: 'rate_limit'
                    })
                );
            });
        });

        describe('Retry Mechanism', () => {
            test('should execute operation with retry on failure', async () => {
                let attempts = 0;
                const operation = jest.fn().mockImplementation(() => {
                    attempts++;
                    if (attempts < 3) {
                        throw new Error('Temporary failure');
                    }
                    return 'success';
                });

                const result = await errorHandler.executeWithRetry(operation, {
                    maxRetries: 3,
                    baseDelay: 1 // Very short delay for testing
                });

                expect(result).toBe('success');
                expect(operation).toHaveBeenCalledTimes(3);
            }, 15000);

            test('should fail after max retries exceeded', async () => {
                const operation = jest.fn().mockRejectedValue(new Error('Persistent failure'));

                await expect(
                    errorHandler.executeWithRetry(operation, {
                        maxRetries: 2,
                        baseDelay: 1
                    })
                ).rejects.toThrow('Persistent failure');

                expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
            }, 15000);

            test('should calculate exponential backoff delay correctly', () => {
                const delay1 = errorHandler.calculateRetryDelay(0);
                const delay2 = errorHandler.calculateRetryDelay(1);
                const delay3 = errorHandler.calculateRetryDelay(2);

                expect(delay2).toBeGreaterThan(delay1);
                expect(delay3).toBeGreaterThan(delay2);
                expect(delay3).toBeLessThanOrEqual(errorHandler.retryConfig.maxDelay);
            });
        });

        describe('Maintenance Mode', () => {
            test('should activate maintenance mode', () => {
                const reason = 'Scheduled maintenance';
                const endTime = new Date(Date.now() + 3600000);

                errorHandler.activateMaintenanceMode(reason, endTime);

                expect(errorHandler.isMaintenanceModeActive()).toBe(true);
                
                const info = errorHandler.getMaintenanceInfo();
                expect(info.reason).toBe(reason);
                expect(info.estimatedEndTime).toBe(endTime);
            });

            test('should deactivate maintenance mode', () => {
                errorHandler.activateMaintenanceMode('Test maintenance');
                errorHandler.deactivateMaintenanceMode();

                expect(errorHandler.isMaintenanceModeActive()).toBe(false);
                
                const info = errorHandler.getMaintenanceInfo();
                expect(info.reason).toBeNull();
            });
        });

        describe('Service Status Tracking', () => {
            test('should update service status', () => {
                errorHandler.updateServiceStatus('discord', false);

                const status = errorHandler.getServiceStatus('discord');
                expect(status.available).toBe(false);
                expect(status.lastCheck).toBeGreaterThan(0);
            });

            test('should get all service statuses', () => {
                errorHandler.updateServiceStatus('discord', false);
                errorHandler.updateServiceStatus('nafflesApi', true);

                const statuses = errorHandler.getAllServiceStatuses();
                expect(statuses.discord.available).toBe(false);
                expect(statuses.nafflesApi.available).toBe(true);
            });
        });

        describe('Fallback Triggers', () => {
            test('should trigger fallback for critical errors', () => {
                const error = new Error('Database connection failed');
                error.name = 'ConnectionError';

                const result = errorHandler.handleDatabaseError(error);
                const shouldFallback = errorHandler.shouldTriggerFallback(result);

                expect(shouldFallback).toBe(true);
            });

            test('should not trigger fallback for minor errors', () => {
                const error = new Error('Validation failed');
                error.name = 'ValidationError';

                const result = errorHandler.handleDatabaseError(error);
                const shouldFallback = errorHandler.shouldTriggerFallback(result);

                expect(shouldFallback).toBe(false);
            });
        });
    });

    describe('FallbackService', () => {
        describe('API Unavailable Handling', () => {
            test('should handle API unavailable with website redirect', async () => {
                const error = new Error('API unavailable');
                const operation = 'task_creation';

                await fallbackService.handleApiUnavailable(mockInteraction, operation, error);

                expect(mockInteraction.reply).toHaveBeenCalledWith(
                    expect.objectContaining({
                        embeds: expect.arrayContaining([
                            expect.objectContaining({
                                data: expect.objectContaining({
                                    title: '🔌 Service Temporarily Unavailable'
                                })
                            })
                        ]),
                        components: expect.any(Array),
                        ephemeral: true
                    })
                );
            });

            test('should log fallback usage', async () => {
                const error = new Error('API unavailable');
                const operation = 'task_creation';

                await fallbackService.handleApiUnavailable(mockInteraction, operation, error);

                expect(mockBotService.db.logFallbackUsage).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: 'api_unavailable',
                        details: expect.objectContaining({
                            operation,
                            guildId: mockInteraction.guildId,
                            userId: mockInteraction.user.id
                        })
                    })
                );
            });
        });

        describe('Discord Failure Handling', () => {
            test('should handle Discord failures with graceful degradation', async () => {
                const error = new Error('Discord API error');
                error.code = 50013;

                const result = await fallbackService.handleDiscordFailure(mockInteraction, error);

                expect(result.fallbackUsed).toBe(true);
                expect(result.fallbackType).toBe('website_redirect');
                expect(mockInteraction.reply).toHaveBeenCalled();
            });

            test('should handle Discord failure fallback errors', async () => {
                const error = new Error('Discord API error');
                mockInteraction.reply.mockRejectedValue(new Error('Reply failed'));

                const result = await fallbackService.handleDiscordFailure(mockInteraction, error);

                expect(result.fallbackUsed).toBe(false);
                expect(mockLogger.error).toHaveBeenCalledWith(
                    'Discord failure fallback failed:',
                    expect.any(Error)
                );
            });
        });

        describe('Maintenance Mode Handling', () => {
            test('should handle maintenance mode interactions', async () => {
                const maintenanceInfo = {
                    reason: 'Scheduled maintenance',
                    estimatedEndTime: new Date(Date.now() + 3600000)
                };

                await fallbackService.handleMaintenanceMode(mockInteraction, maintenanceInfo);

                expect(mockInteraction.reply).toHaveBeenCalledWith(
                    expect.objectContaining({
                        embeds: expect.arrayContaining([
                            expect.objectContaining({
                                data: expect.objectContaining({
                                    title: '🔧 Scheduled Maintenance'
                                })
                            })
                        ]),
                        components: expect.any(Array),
                        ephemeral: true
                    })
                );
            });
        });

        describe('Critical Failure Handling', () => {
            test('should handle critical system failures', async () => {
                const failureType = 'api_fallback_failed';

                await fallbackService.handleCriticalFailure(mockInteraction, failureType);

                expect(mockInteraction.reply).toHaveBeenCalledWith(
                    expect.objectContaining({
                        content: expect.stringContaining('Critical System Error'),
                        ephemeral: true
                    })
                );
            });

            test('should handle critical failure when reply fails', async () => {
                const failureType = 'api_fallback_failed';
                mockInteraction.reply.mockRejectedValue(new Error('Reply failed'));

                await fallbackService.handleCriticalFailure(mockInteraction, failureType);

                expect(mockLogger.error).toHaveBeenCalledWith(
                    'Unable to send critical failure message:',
                    expect.any(Error)
                );
            });
        });

        describe('Graceful Degradation', () => {
            test('should provide graceful degradation for task creation', () => {
                const degradation = fallbackService.getGracefulDegradation('task_creation');

                expect(degradation.alternative).toBe('website_form');
                expect(degradation.message).toContain('Create tasks directly');
                expect(degradation.url).toContain('/community/tasks/create');
            });

            test('should provide graceful degradation for allowlist management', () => {
                const degradation = fallbackService.getGracefulDegradation('allowlist_management');

                expect(degradation.alternative).toBe('website_dashboard');
                expect(degradation.message).toContain('Manage allowlists');
                expect(degradation.url).toContain('/community/allowlists');
            });

            test('should provide default degradation for unknown features', () => {
                const degradation = fallbackService.getGracefulDegradation('unknown_feature');

                expect(degradation.alternative).toBe('website_access');
                expect(degradation.message).toContain('Use the website');
            });
        });

        describe('Fallback Decision Logic', () => {
            test('should recommend fallback for API connectivity issues', () => {
                const error = new Error('Connection refused');
                error.code = 'ECONNREFUSED';

                const recommendation = fallbackService.shouldUseFallback(error, 'task_creation');

                expect(recommendation.useFallback).toBe(true);
                expect(recommendation.type).toBe('api_unavailable');
                expect(recommendation.reason).toContain('connectivity issue');
            });

            test('should recommend fallback for database issues', () => {
                const error = new Error('MongoDB connection failed');

                const recommendation = fallbackService.shouldUseFallback(error, 'data_retrieval');

                expect(recommendation.useFallback).toBe(true);
                expect(recommendation.type).toBe('database_unavailable');
            });

            test('should not recommend fallback for validation errors', () => {
                const error = new Error('Invalid input provided');

                const recommendation = fallbackService.shouldUseFallback(error, 'user_input');

                expect(recommendation.useFallback).toBe(false);
                expect(recommendation.reason).toContain('does not require fallback');
            });
        });

        describe('User-Friendly Messaging', () => {
            test('should create context-specific error messages', () => {
                const error = new Error('Operation failed');
                const options = {
                    context: 'task_creation',
                    suggestAlternatives: true
                };

                const result = fallbackService.createUserFriendlyMessage(error, options);

                expect(result.message).toContain('create your task');
                expect(result.alternatives).toContain('Try again in a few minutes');
                expect(result.alternatives.some(alt => alt.includes('naffles.com'))).toBe(true);
            });

            test('should provide troubleshooting steps', () => {
                const steps = fallbackService.getTroubleshootingSteps('connection_error');

                expect(steps.steps).toContain('Check your internet connection');
                expect(steps.steps).toContain('Try the command again in 1-2 minutes');
                expect(steps.steps).toContain('Visit naffles.com if the issue persists');
            });
        });

        describe('Statistics and Monitoring', () => {
            test('should track fallback statistics', async () => {
                const error = new Error('API unavailable');
                
                await fallbackService.handleApiUnavailable(mockInteraction, 'test_operation', error);

                const stats = fallbackService.getFallbackStats();
                expect(stats.apiFailures).toBe(1);
                expect(stats.websiteRedirects).toBe(1);
                expect(stats.totalFallbacks).toBe(1);
            });

            test('should reset fallback statistics', () => {
                fallbackService.fallbackStats.apiFailures = 5;
                fallbackService.fallbackStats.websiteRedirects = 3;

                fallbackService.resetStats();

                const stats = fallbackService.getFallbackStats();
                expect(stats.apiFailures).toBe(0);
                expect(stats.websiteRedirects).toBe(0);
                expect(stats.totalFallbacks).toBe(0);
            });
        });

        describe('Service Status Management', () => {
            test('should update service status', () => {
                fallbackService.updateServiceStatus('discord', false);

                const status = fallbackService.getServiceStatus('discord');
                expect(status.available).toBe(false);
                expect(status.lastCheck).toBeGreaterThan(0);
            });

            test('should get all service statuses', () => {
                fallbackService.updateServiceStatus('nafflesApi', false);
                fallbackService.updateServiceStatus('database', true);

                const statuses = fallbackService.getAllServiceStatuses();
                expect(statuses.nafflesApi.available).toBe(false);
                expect(statuses.database.available).toBe(true);
            });
        });

        describe('Maintenance Mode Management', () => {
            test('should enable maintenance mode', () => {
                const maintenanceInfo = {
                    reason: 'System upgrade',
                    estimatedEndTime: new Date(Date.now() + 7200000)
                };

                fallbackService.enableMaintenanceMode(maintenanceInfo);

                expect(fallbackService.isMaintenanceModeActive()).toBe(true);
            });

            test('should disable maintenance mode', () => {
                fallbackService.enableMaintenanceMode({ reason: 'Test' });
                fallbackService.disableMaintenanceMode();

                expect(fallbackService.isMaintenanceModeActive()).toBe(false);
            });
        });
    });

    describe('Integration Tests', () => {
        test('should integrate error handler with fallback service', async () => {
            const error = new Error('API connection failed');
            error.code = 'ECONNREFUSED';

            // Handle error with error handler
            const errorResult = errorHandler.handleApiError(error);
            
            // Check if fallback should be triggered
            const shouldFallback = errorHandler.shouldTriggerFallback(errorResult);
            expect(shouldFallback).toBe(true);

            // Trigger fallback service
            if (shouldFallback) {
                await fallbackService.handleApiUnavailable(mockInteraction, 'test_operation', error);
            }

            expect(mockInteraction.reply).toHaveBeenCalled();
            expect(mockBotService.db.logFallbackUsage).toHaveBeenCalled();
        });

        test('should handle maintenance mode across both services', () => {
            const maintenanceInfo = {
                reason: 'Database maintenance',
                estimatedEndTime: new Date(Date.now() + 3600000)
            };

            // Enable maintenance mode in error handler
            errorHandler.activateMaintenanceMode(maintenanceInfo.reason, maintenanceInfo.estimatedEndTime);
            
            // Enable maintenance mode in fallback service
            fallbackService.enableMaintenanceMode(maintenanceInfo);

            expect(errorHandler.isMaintenanceModeActive()).toBe(true);
            expect(fallbackService.isMaintenanceModeActive()).toBe(true);
        });

        test('should coordinate service status updates', () => {
            // Update status in error handler
            errorHandler.updateServiceStatus('nafflesApi', false);
            
            // Update status in fallback service
            fallbackService.updateServiceStatus('nafflesApi', false);

            const errorHandlerStatus = errorHandler.getServiceStatus('nafflesApi');
            const fallbackServiceStatus = fallbackService.getServiceStatus('nafflesApi');

            expect(errorHandlerStatus.available).toBe(false);
            expect(fallbackServiceStatus.available).toBe(false);
        });
    });

    describe('Edge Cases', () => {
        test('should handle null/undefined errors gracefully', () => {
            const result1 = errorHandler.handleGeneralError(null);
            const result2 = errorHandler.handleGeneralError(undefined);

            expect(result1.type).toBe('unknown');
            expect(result2.type).toBe('unknown');
        });

        test('should handle interaction reply failures in fallback', async () => {
            mockInteraction.reply.mockRejectedValue(new Error('Discord API down'));
            mockInteraction.editReply.mockRejectedValue(new Error('Discord API down'));

            const error = new Error('API unavailable');
            
            // Should not throw despite reply failures
            await expect(
                fallbackService.handleApiUnavailable(mockInteraction, 'test_operation', error)
            ).resolves.not.toThrow();
        });

        test('should handle database logging failures gracefully', async () => {
            mockBotService.db.logFallbackUsage.mockRejectedValue(new Error('Database unavailable'));

            const error = new Error('API unavailable');
            
            // Should not throw despite database logging failure
            await expect(
                fallbackService.handleApiUnavailable(mockInteraction, 'test_operation', error)
            ).resolves.not.toThrow();

            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Failed to log fallback usage to database:',
                'Database unavailable'
            );
        });
    });
});