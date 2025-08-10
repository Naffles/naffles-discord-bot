#!/usr/bin/env node

console.log('Starting error handling debug...');

try {
    console.log('1. Loading ErrorHandler...');
    const ErrorHandler = require('./src/utils/errorHandler');
    console.log('✅ ErrorHandler loaded successfully');

    console.log('2. Loading FallbackService...');
    const FallbackService = require('./src/services/fallbackService');
    console.log('✅ FallbackService loaded successfully');

    console.log('3. Creating instances...');
    const errorHandler = new ErrorHandler();
    console.log('✅ ErrorHandler instance created');

    const mockBotService = { db: { logFallbackUsage: async () => true } };
    const fallbackService = new FallbackService(mockBotService);
    console.log('✅ FallbackService instance created');

    console.log('4. Testing basic error handling...');
    const testError = new Error('Test error');
    const result = errorHandler.handleGeneralError(testError);
    console.log('✅ Basic error handling works:', result.type);

    console.log('5. Testing fallback decision...');
    const networkError = new Error('Connection refused');
    networkError.code = 'ECONNREFUSED';
    const recommendation = fallbackService.shouldUseFallback(networkError, 'test');
    console.log('✅ Fallback decision works:', recommendation.useFallback);

    console.log('✅ All basic tests passed!');
    process.exit(0);

} catch (error) {
    console.error('❌ Error during debug:', error);
    process.exit(1);
}