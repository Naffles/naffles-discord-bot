#!/usr/bin/env node

/**
 * Test script for comprehensive error handling and fallback system
 */

const ErrorHandler = require('./src/utils/errorHandler');
const FallbackService = require('./src/services/fallbackService');
const logger = require('./src/utils/logger');

// Mock Discord interaction for testing
const createMockInteraction = (options = {}) => ({
    guildId: options.guildId || 'test-guild-123',
    user: { id: options.userId || 'test-user-456' },
    replied: options.replied || false,
    deferred: options.deferred || false,
    reply: async (content) => {
        console.log('📤 Discord Reply:', JSON.stringify(content, null, 2));
        return true;
    },
    editReply: async (content) => {
        console.log('✏️ Discord Edit Reply:', JSON.stringify(content, null, 2));
        return true;
    }
});

// Mock bot service
const mockBotService = {
    db: {
        logFallbackUsage: async (data) => {
            console.log('💾 Database Log:', JSON.stringify(data, null, 2));
            return true;
        }
    }
};

async function testErrorHandling() {
    console.log('🧪 Testing Error Handling and Fallback System\n');
    
    const errorHandler = new ErrorHandler();
    const fallbackService = new FallbackService(mockBotService);
    
    console.log('='.repeat(60));
    console.log('1. Testing Error Categorization');
    console.log('='.repeat(60));
    
    // Test Discord errors
    console.log('\n📱 Discord Errors:');
    
    const rateLimitError = new Error('Rate limit exceeded');
    rateLimitError.code = 429;
    const rateLimitResult = errorHandler.handleDiscordError(rateLimitError);
    console.log('Rate Limit:', rateLimitResult);
    
    const permissionError = new Error('Missing permissions');
    permissionError.code = 50013;
    const permissionResult = errorHandler.handleDiscordError(permissionError);
    console.log('Permission:', permissionResult);
    
    // Test API errors
    console.log('\n🌐 API Errors:');
    
    const timeoutError = new Error('Request timeout');
    timeoutError.code = 'ECONNABORTED';
    const timeoutResult = errorHandler.handleApiError(timeoutError);
    console.log('Timeout:', timeoutResult);
    
    const networkError = new Error('Connection refused');
    networkError.code = 'ECONNREFUSED';
    const networkResult = errorHandler.handleApiError(networkError);
    console.log('Network:', networkResult);
    
    // Test Database errors
    console.log('\n💾 Database Errors:');
    
    const dbConnectionError = new Error('Database connection failed');
    dbConnectionError.name = 'ConnectionError';
    const dbResult = errorHandler.handleDatabaseError(dbConnectionError);
    console.log('DB Connection:', dbResult);
    
    console.log('\n='.repeat(60));
    console.log('2. Testing Retry Mechanism');
    console.log('='.repeat(60));
    
    let attempts = 0;
    const flakyOperation = () => {
        attempts++;
        console.log(`🔄 Attempt ${attempts}`);
        if (attempts < 3) {
            throw new Error('Temporary failure');
        }
        return 'Success!';
    };
    
    try {
        const result = await errorHandler.executeWithRetry(flakyOperation, {
            maxRetries: 3,
            baseDelay: 100
        });
        console.log('✅ Retry Result:', result);
    } catch (error) {
        console.log('❌ Retry Failed:', error.message);
    }
    
    console.log('\n='.repeat(60));
    console.log('3. Testing Fallback Service');
    console.log('='.repeat(60));
    
    const mockInteraction = createMockInteraction();
    
    // Test API unavailable fallback
    console.log('\n🔌 API Unavailable Fallback:');
    const apiError = new Error('API service unavailable');
    await fallbackService.handleApiUnavailable(mockInteraction, 'task_creation', apiError);
    
    // Test Discord failure fallback
    console.log('\n📱 Discord Failure Fallback:');
    const discordError = new Error('Discord API error');
    discordError.code = 50013;
    const discordResult = await fallbackService.handleDiscordFailure(mockInteraction, discordError);
    console.log('Discord Fallback Result:', discordResult);
    
    // Test maintenance mode
    console.log('\n🔧 Maintenance Mode:');
    const maintenanceInfo = {
        reason: 'Scheduled system upgrade',
        estimatedEndTime: new Date(Date.now() + 3600000)
    };
    await fallbackService.handleMaintenanceMode(mockInteraction, maintenanceInfo);
    
    console.log('\n='.repeat(60));
    console.log('4. Testing Graceful Degradation');
    console.log('='.repeat(60));
    
    const taskDegradation = fallbackService.getGracefulDegradation('task_creation');
    console.log('Task Creation Degradation:', taskDegradation);
    
    const allowlistDegradation = fallbackService.getGracefulDegradation('allowlist_management');
    console.log('Allowlist Management Degradation:', allowlistDegradation);
    
    const unknownDegradation = fallbackService.getGracefulDegradation('unknown_feature');
    console.log('Unknown Feature Degradation:', unknownDegradation);
    
    console.log('\n='.repeat(60));
    console.log('5. Testing Fallback Decision Logic');
    console.log('='.repeat(60));
    
    const connectionError = new Error('Connection refused');
    connectionError.code = 'ECONNREFUSED';
    const connectionRecommendation = fallbackService.shouldUseFallback(connectionError, 'api_call');
    console.log('Connection Error Recommendation:', connectionRecommendation);
    
    const validationError = new Error('Invalid input');
    const validationRecommendation = fallbackService.shouldUseFallback(validationError, 'user_input');
    console.log('Validation Error Recommendation:', validationRecommendation);
    
    console.log('\n='.repeat(60));
    console.log('6. Testing User-Friendly Messages');
    console.log('='.repeat(60));
    
    const friendlyMessage = fallbackService.createUserFriendlyMessage(apiError, {
        context: 'task_creation',
        suggestAlternatives: true
    });
    console.log('User-Friendly Message:', friendlyMessage);
    
    const troubleshooting = fallbackService.getTroubleshootingSteps('connection_error');
    console.log('Troubleshooting Steps:', troubleshooting);
    
    console.log('\n='.repeat(60));
    console.log('7. Testing Statistics and Monitoring');
    console.log('='.repeat(60));
    
    // Generate some errors for statistics
    for (let i = 0; i < 5; i++) {
        errorHandler.handleApiError(networkError);
    }
    
    const errorStats = errorHandler.getErrorStatistics();
    console.log('Error Statistics:', errorStats);
    
    const fallbackStats = fallbackService.getFallbackStats();
    console.log('Fallback Statistics:', fallbackStats);
    
    console.log('\n='.repeat(60));
    console.log('8. Testing Service Status Management');
    console.log('='.repeat(60));
    
    // Update service statuses
    errorHandler.updateServiceStatus('discord', false);
    errorHandler.updateServiceStatus('nafflesApi', true);
    errorHandler.updateServiceStatus('database', false);
    
    const serviceStatuses = errorHandler.getAllServiceStatuses();
    console.log('Service Statuses:', serviceStatuses);
    
    console.log('\n='.repeat(60));
    console.log('9. Testing Maintenance Mode');
    console.log('='.repeat(60));
    
    // Test maintenance mode activation
    errorHandler.activateMaintenanceMode('System upgrade', new Date(Date.now() + 7200000));
    console.log('Maintenance Mode Active:', errorHandler.isMaintenanceModeActive());
    console.log('Maintenance Info:', errorHandler.getMaintenanceInfo());
    
    // Test maintenance mode deactivation
    errorHandler.deactivateMaintenanceMode();
    console.log('Maintenance Mode Active After Deactivation:', errorHandler.isMaintenanceModeActive());
    
    console.log('\n='.repeat(60));
    console.log('10. Testing Integration Scenarios');
    console.log('='.repeat(60));
    
    // Simulate a complete error handling flow
    const criticalError = new Error('Database connection lost');
    criticalError.code = 'ECONNREFUSED';
    
    console.log('\n🚨 Critical Error Scenario:');
    const errorResult = errorHandler.handleDatabaseError(criticalError);
    console.log('Error Result:', errorResult);
    
    const shouldFallback = errorHandler.shouldTriggerFallback(errorResult);
    console.log('Should Trigger Fallback:', shouldFallback);
    
    if (shouldFallback) {
        console.log('🔄 Triggering fallback...');
        await fallbackService.handleApiUnavailable(mockInteraction, 'database_operation', criticalError);
    }
    
    console.log('\n✅ Error Handling and Fallback System Test Complete!');
    console.log('\n📊 Final Statistics:');
    console.log('Error Handler Stats:', errorHandler.getErrorStatistics());
    console.log('Fallback Service Stats:', fallbackService.getFallbackStats());
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Run the test
if (require.main === module) {
    testErrorHandling().catch(error => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });
}

module.exports = { testErrorHandling };