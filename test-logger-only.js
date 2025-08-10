// Test just the logger import
console.log('Testing logger import...');

try {
    console.log('About to require logger...');
    const logger = require('./src/utils/logger');
    console.log('Logger imported successfully');

    console.log('About to log a message...');
    logger.info('Test message');
    console.log('Message logged successfully');

    console.log('Test completed successfully');

    // Force exit to prevent hanging
    setTimeout(() => {
        console.log('Forcing exit...');
        process.exit(0);
    }, 100);

} catch (error) {
    console.error('Logger test failed:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
}