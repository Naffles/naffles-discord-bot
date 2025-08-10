/**
 * Global Setup for Discord Bot Tests
 * Initializes test environment and shared resources
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

module.exports = async () => {
    console.log('🔧 Setting up global test environment...');

    // Start in-memory MongoDB server
    const mongoServer = await MongoMemoryServer.create({
        binary: {
            version: '6.0.0'
        },
        instance: {
            dbName: 'discord-bot-test'
        }
    });

    const mongoUri = mongoServer.getUri();
    
    // Store server instance and URI for cleanup
    global.__MONGO_SERVER__ = mongoServer;
    global.__MONGO_URI__ = mongoUri;

    // Set environment variables for tests
    process.env.MONGODB_URI = mongoUri;
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error';
    process.env.DISCORD_BOT_TOKEN = 'test-bot-token';
    process.env.DISCORD_CLIENT_ID = 'test-client-id';
    process.env.NAFFLES_API_BASE_URL = 'https://api.test.naffles.com';
    process.env.NAFFLES_API_KEY = 'test-api-key';
    process.env.REDIS_URL = 'redis://localhost:6379';

    // Note: Test timeout is configured in jest.config.js

    console.log('✅ Global test environment setup complete');
    console.log(`   MongoDB URI: ${mongoUri}`);
    console.log(`   Test Database: discord-bot-test`);
};