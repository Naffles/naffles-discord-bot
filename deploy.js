#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const logger = require('./src/utils/logger');

class DiscordBotDeployment {
    constructor() {
        this.deploymentConfig = {
            environment: process.env.NODE_ENV || 'development',
            version: this.getVersion(),
            timestamp: new Date().toISOString()
        };
    }

    getVersion() {
        try {
            const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
            return packageJson.version || '1.0.0';
        } catch (error) {
            return '1.0.0';
        }
    }

    async deploy() {
        try {
            logger.info('Starting Discord bot deployment...');
            logger.info(`Environment: ${this.deploymentConfig.environment}`);
            logger.info(`Version: ${this.deploymentConfig.version}`);

            // Validate environment
            await this.validateEnvironment();

            // Install dependencies
            await this.installDependencies();

            // Run tests if available
            await this.runTests();

            // Register Discord commands
            await this.registerDiscordCommands();

            // Start the bot
            await this.startBot();

            logger.info('Discord bot deployment completed successfully');

        } catch (error) {
            logger.error('Deployment failed:', error);
            process.exit(1);
        }
    }

    async validateEnvironment() {
        logger.info('Validating environment configuration...');

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

        // Validate Discord token format
        if (!process.env.DISCORD_BOT_TOKEN.match(/^[A-Za-z0-9._-]+$/)) {
            throw new Error('Invalid Discord bot token format');
        }

        // Validate MongoDB URI format
        if (!process.env.MONGODB_URI.startsWith('mongodb://') && !process.env.MONGODB_URI.startsWith('mongodb+srv://')) {
            throw new Error('Invalid MongoDB URI format');
        }

        logger.info('Environment validation completed');
    }

    async installDependencies() {
        logger.info('Installing dependencies...');
        
        try {
            execSync('npm ci --production', { stdio: 'inherit' });
            logger.info('Dependencies installed successfully');
        } catch (error) {
            throw new Error(`Failed to install dependencies: ${error.message}`);
        }
    }

    async runTests() {
        if (this.deploymentConfig.environment === 'production') {
            logger.info('Skipping tests in production deployment');
            return;
        }

        logger.info('Running tests...');
        
        try {
            // Check if test script exists
            const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
            if (packageJson.scripts && packageJson.scripts.test) {
                execSync('npm test', { stdio: 'inherit' });
                logger.info('Tests completed successfully');
            } else {
                logger.info('No test script found, skipping tests');
            }
        } catch (error) {
            if (this.deploymentConfig.environment === 'development') {
                logger.warn(`Tests failed: ${error.message}`);
            } else {
                throw new Error(`Tests failed: ${error.message}`);
            }
        }
    }

    async registerDiscordCommands() {
        logger.info('Registering Discord slash commands...');
        
        try {
            // Import and run command registration
            const { REST, Routes } = require('discord.js');
            const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

            // Load commands
            const commands = [];
            const commandsPath = path.join(__dirname, 'src', 'commands');
            
            if (fs.existsSync(commandsPath)) {
                const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
                
                for (const file of commandFiles) {
                    const command = require(path.join(commandsPath, file));
                    if (command.data) {
                        commands.push(command.data.toJSON());
                    }
                }
            }

            if (commands.length > 0) {
                await rest.put(
                    Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
                    { body: commands }
                );
                
                logger.info(`Successfully registered ${commands.length} Discord slash commands`);
            } else {
                logger.info('No commands found to register');
            }
            
        } catch (error) {
            throw new Error(`Failed to register Discord commands: ${error.message}`);
        }
    }

    async startBot() {
        logger.info('Starting Discord bot...');
        
        try {
            // Import and start the bot
            const NafflesDiscordBot = require('./src/index');
            const bot = new NafflesDiscordBot();
            
            // Start the bot
            await bot.start();
            
        } catch (error) {
            throw new Error(`Failed to start Discord bot: ${error.message}`);
        }
    }

    // Health check endpoint for monitoring
    async healthCheck() {
        try {
            const NafflesDiscordBot = require('./src/index');
            const bot = new NafflesDiscordBot();
            
            // Initialize without starting
            await bot.initialize();
            
            const health = {
                status: 'healthy',
                version: this.deploymentConfig.version,
                environment: this.deploymentConfig.environment,
                timestamp: new Date().toISOString(),
                services: {
                    discord: bot.client?.isReady() || false,
                    database: bot.databaseService?.isHealthy() || false,
                    redis: bot.redisService?.isConnected() || false
                }
            };

            return health;
            
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

// CLI interface
if (require.main === module) {
    const deployment = new DiscordBotDeployment();
    
    const command = process.argv[2];
    
    switch (command) {
        case 'deploy':
            deployment.deploy();
            break;
        case 'health':
            deployment.healthCheck().then(health => {
                console.log(JSON.stringify(health, null, 2));
                process.exit(health.status === 'healthy' ? 0 : 1);
            });
            break;
        default:
            console.log('Usage: node deploy.js [deploy|health]');
            console.log('  deploy - Deploy the Discord bot');
            console.log('  health - Check bot health status');
            process.exit(1);
    }
}

module.exports = DiscordBotDeployment;