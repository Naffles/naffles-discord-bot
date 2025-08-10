// Debug test to isolate the freezing issue
console.log('Starting debug test...');

// Test 1: Basic winston import
try {
    console.log('Test 1: Importing winston...');
    const winston = require('winston');
    console.log('Winston imported successfully');
} catch (error) {
    console.error('Winston import failed:', error.message);
}

// Test 2: Basic winston logger creation
try {
    console.log('Test 2: Creating basic winston logger...');
    const winston = require('winston');
    const basicLogger = winston.createLogger({
        level: 'info',
        format: winston.format.simple(),
        transports: [
            new winston.transports.Console()
        ]
    });
    console.log('Basic winston logger created successfully');
    
    // Test logging
    basicLogger.info('Test log message');
    console.log('Basic logging works');
} catch (error) {
    console.error('Basic winston logger failed:', error.message);
}

// Test 3: File system operations
try {
    console.log('Test 3: Testing file system operations...');
    const fs = require('fs');
    const path = require('path');
    
    const logsDir = path.join(__dirname, 'logs');
    console.log('Logs directory path:', logsDir);
    
    if (!fs.existsSync(logsDir)) {
        console.log('Creating logs directory...');
        fs.mkdirSync(logsDir, { recursive: true });
        console.log('Logs directory created');
    } else {
        console.log('Logs directory already exists');
    }
} catch (error) {
    console.error('File system operations failed:', error.message);
}

// Test 4: Winston with file transport
try {
    console.log('Test 4: Creating winston logger with file transport...');
    const winston = require('winston');
    const path = require('path');
    
    const fileLogger = winston.createLogger({
        level: 'info',
        format: winston.format.simple(),
        transports: [
            new winston.transports.Console(),
            new winston.transports.File({
                filename: path.join(__dirname, 'logs', 'test.log'),
                maxsize: 1024 * 1024, // 1MB
                maxFiles: 1
            })
        ]
    });
    
    console.log('File logger created successfully');
    fileLogger.info('Test file log message');
    console.log('File logging works');
} catch (error) {
    console.error('File logger failed:', error.message);
}

console.log('Debug test completed');