// Simple test to check if basic functionality works
console.log('Testing basic functionality...');

try {
    // Test basic Node.js functionality
    console.log('Node.js version:', process.version);
    console.log('Current working directory:', process.cwd());
    
    // Test logger (fixed version)
    console.log('Testing logger...');
    const logger = require('./src/utils/logger');
    logger.info('Logger test successful');
    console.log('Logger working correctly');
    
    // Test rate limiter
    console.log('Testing rate limiter...');
    const RateLimiter = require('./src/utils/rateLimiter');
    const rateLimiter = new RateLimiter();
    const result = rateLimiter.checkRateLimit('test-user', 'command');
    console.log('Rate limiter test result:', result);
    
    console.log('Basic functionality test completed successfully');
    
    // Force exit to prevent hanging due to winston keeping event loop alive
    setTimeout(() => {
        console.log('Exiting...');
        process.exit(0);
    }, 100);
    
} catch (error) {
    console.error('Basic functionality test failed:', error);
    console.error('Error details:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
}