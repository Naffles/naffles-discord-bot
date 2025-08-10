const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Simple console format
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let metaStr = '';
        if (Object.keys(meta).length > 0) {
            metaStr = ' ' + JSON.stringify(meta);
        }
        return `${timestamp} [${level}]: ${message}${metaStr}`;
    })
);

// Create a simple logger with minimal configuration
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { 
        service: 'naffles-discord-bot'
    },
    transports: [
        // Only console transport for now to avoid file I/O issues
        new winston.transports.Console({
            format: consoleFormat,
            level: process.env.LOG_LEVEL || 'info'
        })
    ]
});

// Add custom logging methods
logger.discord = (message, meta = {}) => {
    logger.info(message, { ...meta, category: 'discord' });
};

logger.api = (message, meta = {}) => {
    logger.info(message, { ...meta, category: 'api' });
};

logger.database = (message, meta = {}) => {
    logger.info(message, { ...meta, category: 'database' });
};

logger.security = (message, meta = {}) => {
    logger.warn(message, { ...meta, category: 'security' });
};

logger.performance = (message, meta = {}) => {
    logger.info(message, { ...meta, category: 'performance' });
};

logger.audit = (message, meta = {}) => {
    logger.info(message, { ...meta, category: 'audit' });
};

// Helper method for structured logging
logger.logWithContext = (level, message, context = {}) => {
    const logData = {
        message,
        timestamp: new Date().toISOString(),
        ...context
    };
    
    logger[level](logData);
};

// Helper method for error logging with stack traces
logger.logError = (error, context = {}) => {
    if (!error) {
        logger.error('Error occurred', { message: 'Unknown error', ...context });
        return;
    }
    
    const errorData = {
        message: error.message || 'Unknown error',
        stack: error.stack || 'No stack trace available',
        name: error.name || 'Error',
        ...context
    };
    
    logger.error('Error occurred', errorData);
};

// Helper method for API call logging
logger.logApiCall = (method, url, statusCode, responseTime, context = {}) => {
    const logData = {
        method,
        url,
        statusCode,
        responseTime,
        ...context
    };
    
    if (statusCode >= 400) {
        logger.error('API call failed', logData);
    } else {
        logger.api('API call completed', logData);
    }
};

// Helper method for Discord interaction logging
logger.logDiscordInteraction = (interactionType, guildId, userId, success, context = {}) => {
    const logData = {
        interactionType,
        guildId,
        userId,
        success,
        timestamp: new Date().toISOString(),
        ...context
    };
    
    if (success) {
        logger.discord('Discord interaction completed', logData);
    } else {
        logger.error('Discord interaction failed', logData);
    }
};

// Helper method for performance monitoring
logger.logPerformance = (operation, duration, context = {}) => {
    const logData = {
        operation,
        duration,
        timestamp: new Date().toISOString(),
        ...context
    };
    
    if (duration > 5000) { // Log slow operations (>5s)
        logger.warn('Slow operation detected', logData);
    } else {
        logger.performance('Operation completed', logData);
    }
};

// Create a child logger for specific modules
logger.child = (defaultMeta) => {
    return winston.createLogger({
        level: logger.level,
        levels: logLevels,
        format: logger.format,
        defaultMeta: { ...logger.defaultMeta, ...defaultMeta },
        transports: logger.transports
    });
};

module.exports = logger;