#!/usr/bin/env node

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const logger = require('./src/utils/logger');

// Load environment variables
dotenv.config();

class CommandRegistration {
    constructor() {
        this.rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
        this.clientId = process.env.DISCORD_CLIENT_ID;
    }

    async registerCommands() {
        try {
            logger.info('Starting Discord slash command registration...');

            // Validate environment
            if (!process.env.DISCORD_BOT_TOKEN) {
                throw new Error('DISCORD_BOT_TOKEN is required');
            }
            if (!process.env.DISCORD_CLIENT_ID) {
                throw new Error('DISCORD_CLIENT_ID is required');
            }

            // Load commands
            const commands = [];
            const commandsPath = path.join(__dirname, 'src', 'commands');
            
            if (!fs.existsSync(commandsPath)) {
                throw new Error('Commands directory not found');
            }

            const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
            
            logger.info(`Found ${commandFiles.length} command files`);

            for (const file of commandFiles) {
                try {
                    const command = require(path.join(commandsPath, file));
                    if (command.data) {
                        commands.push(command.data.toJSON());
                        logger.info(`Loaded command: ${command.data.name}`);
                    } else {
                        logger.warn(`Command file ${file} does not export data property`);
                    }
                } catch (error) {
                    logger.error(`Failed to load command ${file}:`, error);
                }
            }

            if (commands.length === 0) {
                throw new Error('No valid commands found to register');
            }

            // Register commands globally
            logger.info(`Registering ${commands.length} commands globally...`);
            
            const data = await this.rest.put(
                Routes.applicationCommands(this.clientId),
                { body: commands }
            );

            logger.info(`Successfully registered ${data.length} Discord slash commands globally`);

            // Log registered commands
            data.forEach(command => {
                logger.info(`Registered: /${command.name} - ${command.description}`);
            });

            return data;

        } catch (error) {
            logger.error('Failed to register Discord commands:', error);
            throw error;
        }
    }

    async registerGuildCommands(guildId) {
        try {
            logger.info(`Registering commands for guild: ${guildId}`);

            // Load commands
            const commands = [];
            const commandsPath = path.join(__dirname, 'src', 'commands');
            const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

            for (const file of commandFiles) {
                const command = require(path.join(commandsPath, file));
                if (command.data) {
                    commands.push(command.data.toJSON());
                }
            }

            // Register commands for specific guild (faster for testing)
            const data = await this.rest.put(
                Routes.applicationGuildCommands(this.clientId, guildId),
                { body: commands }
            );

            logger.info(`Successfully registered ${data.length} commands for guild ${guildId}`);
            return data;

        } catch (error) {
            logger.error(`Failed to register guild commands for ${guildId}:`, error);
            throw error;
        }
    }

    async clearCommands() {
        try {
            logger.info('Clearing all global commands...');

            await this.rest.put(
                Routes.applicationCommands(this.clientId),
                { body: [] }
            );

            logger.info('Successfully cleared all global commands');

        } catch (error) {
            logger.error('Failed to clear commands:', error);
            throw error;
        }
    }

    async clearGuildCommands(guildId) {
        try {
            logger.info(`Clearing commands for guild: ${guildId}`);

            await this.rest.put(
                Routes.applicationGuildCommands(this.clientId, guildId),
                { body: [] }
            );

            logger.info(`Successfully cleared commands for guild ${guildId}`);

        } catch (error) {
            logger.error(`Failed to clear guild commands for ${guildId}:`, error);
            throw error;
        }
    }

    async listCommands() {
        try {
            logger.info('Fetching registered commands...');

            const commands = await this.rest.get(
                Routes.applicationCommands(this.clientId)
            );

            logger.info(`Found ${commands.length} registered commands:`);
            commands.forEach(command => {
                logger.info(`- /${command.name}: ${command.description}`);
            });

            return commands;

        } catch (error) {
            logger.error('Failed to list commands:', error);
            throw error;
        }
    }
}

// CLI interface
if (require.main === module) {
    const registration = new CommandRegistration();
    const command = process.argv[2];
    const guildId = process.argv[3];

    (async () => {
        try {
            switch (command) {
                case 'register':
                    await registration.registerCommands();
                    break;
                case 'register-guild':
                    if (!guildId) {
                        console.error('Guild ID is required for register-guild command');
                        process.exit(1);
                    }
                    await registration.registerGuildCommands(guildId);
                    break;
                case 'clear':
                    await registration.clearCommands();
                    break;
                case 'clear-guild':
                    if (!guildId) {
                        console.error('Guild ID is required for clear-guild command');
                        process.exit(1);
                    }
                    await registration.clearGuildCommands(guildId);
                    break;
                case 'list':
                    await registration.listCommands();
                    break;
                default:
                    console.log('Usage: node register-commands.js [register|register-guild|clear|clear-guild|list] [guildId]');
                    console.log('');
                    console.log('Commands:');
                    console.log('  register       - Register commands globally (takes up to 1 hour)');
                    console.log('  register-guild - Register commands for a specific guild (instant)');
                    console.log('  clear          - Clear all global commands');
                    console.log('  clear-guild    - Clear commands for a specific guild');
                    console.log('  list           - List currently registered commands');
                    console.log('');
                    console.log('Examples:');
                    console.log('  node register-commands.js register');
                    console.log('  node register-commands.js register-guild 123456789012345678');
                    process.exit(1);
            }

            // Force exit to prevent hanging
            setTimeout(() => {
                process.exit(0);
            }, 1000);

        } catch (error) {
            logger.error('Command registration failed:', error);
            process.exit(1);
        }
    })();
}

module.exports = CommandRegistration;