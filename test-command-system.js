// Test the complete command system
const CommandHandler = require('./src/handlers/commandHandler');
const logger = require('./src/utils/logger');

console.log('Testing Discord bot command system...');

try {
    // Mock bot service for testing
    const mockBotService = {
        rateLimiter: {
            checkRateLimit: (userId, action) => ({
                allowed: true,
                remaining: 5,
                resetTime: Date.now() + 60000,
                retryAfter: 0
            })
        },
        logInteraction: async (interaction, type, result) => {
            console.log(`Logged interaction: ${type} - ${result}`);
        }
    };

    // Create command handler
    const commandHandler = new CommandHandler(mockBotService);
    
    console.log('Command handler created successfully');
    console.log(`Commands loaded: ${commandHandler.getCommandCount()}`);
    console.log(`Command list: ${commandHandler.getCommandList().join(', ')}`);
    
    // Test command usage stats
    const stats = commandHandler.getCommandUsageStats();
    console.log('Command usage stats:', stats);
    
    // Test cooldown functionality
    const cooldownTime = commandHandler.getCooldownTime('naffles-create-task');
    console.log(`Create task cooldown: ${cooldownTime}ms`);
    
    console.log('Command system test completed successfully');
    
    // Force exit
    setTimeout(() => {
        process.exit(0);
    }, 100);
    
} catch (error) {
    console.error('Command system test failed:', error);
    process.exit(1);
}