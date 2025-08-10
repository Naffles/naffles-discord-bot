const { Client, GatewayIntentBits, Collection } = require('discord.js');
const dotenv = require('dotenv');
const path = require('path');
const logger = require('./utils/logger');
const DiscordBotService = require('./services/discordBotService');
const DatabaseService = require('./services/databaseService');
const RedisService = require('./services/redisService');
const CommandHandler = require('./handlers/commandHandler');
const EventHandler = require('./handlers/eventHandler');
const HealthMonitor = require('./services/healthMonitor');

// Load environment variables
dotenv.config();

class NafflesDiscordBot {
    constructor() {
        this.client = null;
        this.botService = null;
        this.databaseService = null;
        this.redisService = null;
        this.commandHandler = null;
        this.eventHandler = null;
        this.healthMonitor = null;
        this.isShuttingDown = false;
    }

    async initialize() {
        try {
            logger.info('Initializing Naffles Discord Bot...');

            // Validate environment configuration
            this.validateEnvironment();

            // Initialize Discord client with required intents
            this.client = new Client({
                intents: [
                    GatewayIntentBits.Guilds,
                    GatewayIntentBits.GuildMessages,
                    GatewayIntentBits.MessageContent,
                    GatewayIntentBits.GuildMembers,
                    GatewayIntentBits.GuildMessageReactions
                ],
                partials: []
            });

            // Initialize services
            await this.initializeServices();

            // Set up command and event handlers
            await this.setupHandlers();

            // Set up health monitoring
            this.setupHealthMonitoring();

            // Set up graceful shutdown
            this.setupGracefulShutdown();

            logger.info('Discord bot initialization completed successfully');
        } catch (error) {
            logger.error('Failed to initialize Discord bot:', error);
            throw error;
        }
    }

    validateEnvironment() {
        const requiredEnvVars = [
            'DISCORD_BOT_TOKEN',
            'DISCORD_CLIENT_ID',
            'NAFFLES_API_BASE_URL',
            'MONGODB_URI',
            'REDIS_URL'
        ];

        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
            throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
        }

        logger.info('Environment validation completed successfully');
    }

    async initializeServices() {
        try {
            // Initialize database service
            this.databaseService = new DatabaseService();
            await this.databaseService.connect();

            // Initialize Redis service
            this.redisService = new RedisService();
            await this.redisService.connect();

            // Initialize Discord bot service
            this.botService = new DiscordBotService(this.client, this.databaseService, this.redisService);
            await this.botService.initialize();

            logger.info('All services initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize services:', error);
            throw error;
        }
    }

    async setupHandlers() {
        try {
            // Initialize command handler
            this.commandHandler = new CommandHandler(this.botService);
            await this.commandHandler.initialize();

            // Initialize event handler with command handler reference
            this.eventHandler = new EventHandler(this.client, this.botService, this.commandHandler);
            await this.eventHandler.initialize();

            logger.info('Command and event handlers set up successfully');
        } catch (error) {
            logger.error('Failed to set up handlers:', error);
            throw error;
        }
    }

    setupHealthMonitoring() {
        this.healthMonitor = new HealthMonitor(this.client, this.botService);
        this.healthMonitor.start();
        logger.info('Health monitoring started');
    }

    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            if (this.isShuttingDown) return;
            this.isShuttingDown = true;

            logger.info(`Received ${signal}. Starting graceful shutdown...`);

            try {
                // Stop health monitoring
                if (this.healthMonitor) {
                    this.healthMonitor.stop();
                }

                // Disconnect Discord client
                if (this.client) {
                    await this.client.destroy();
                    logger.info('Discord client disconnected');
                }

                // Close database connections
                if (this.databaseService) {
                    await this.databaseService.disconnect();
                    logger.info('Database connection closed');
                }

                // Cleanup bot service and sync services
                if (this.botService) {
                    // Shutdown sync services gracefully
                    if (this.botService.realTimeSync) {
                        await this.botService.realTimeSync.shutdown();
                        logger.info('Real-time sync service shutdown');
                    }
                    
                    if (this.botService.webhookIntegration) {
                        await this.botService.webhookIntegration.shutdown();
                        logger.info('Webhook integration service shutdown');
                    }
                    
                    if (this.botService.syncMonitoring) {
                        await this.botService.syncMonitoring.shutdown();
                        logger.info('Sync monitoring service shutdown');
                    }
                    
                    await this.botService.cleanup();
                    logger.info('Bot service cleaned up');
                }

                // Close Redis connection
                if (this.redisService) {
                    await this.redisService.disconnect();
                    logger.info('Redis connection closed');
                }

                logger.info('Graceful shutdown completed');
                process.exit(0);
            } catch (error) {
                logger.error('Error during shutdown:', error);
                process.exit(1);
            }
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught exception:', error);
            shutdown('uncaughtException');
        });
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled rejection at:', promise, 'reason:', reason);
            shutdown('unhandledRejection');
        });
    }

    async start() {
        try {
            await this.initialize();
            
            // Login to Discord
            await this.client.login(process.env.DISCORD_BOT_TOKEN);
            
            logger.info('Naffles Discord Bot started successfully');
        } catch (error) {
            logger.error('Failed to start Discord bot:', error);
            process.exit(1);
        }
    }
}

// Start the bot if this file is run directly
if (require.main === module) {
    const bot = new NafflesDiscordBot();
    bot.start().catch(error => {
        logger.error('Fatal error starting bot:', error);
        process.exit(1);
    });
}

module.exports = NafflesDiscordBot;