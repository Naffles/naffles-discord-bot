/**
 * Global Teardown for Discord Bot Tests
 * Cleans up test environment and shared resources
 */

const mongoose = require('mongoose');

module.exports = async () => {
    console.log('🧹 Cleaning up global test environment...');

    // Close mongoose connections
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
        console.log('   ✅ Mongoose disconnected');
    }

    // Stop MongoDB server
    if (global.__MONGO_SERVER__) {
        await global.__MONGO_SERVER__.stop();
        console.log('   ✅ MongoDB server stopped');
    }

    // Clear global variables
    delete global.__MONGO_SERVER__;
    delete global.__MONGO_URI__;

    // Force garbage collection if available
    if (global.gc) {
        global.gc();
        console.log('   ✅ Garbage collection performed');
    }

    console.log('✅ Global test environment cleanup complete');
};