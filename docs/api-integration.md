# Discord Bot API Integration Documentation

This document provides comprehensive information about the Naffles Discord bot's integration with external APIs, including the Naffles backend API, Discord API, and other third-party services.

## Table of Contents

1. [API Architecture Overview](#api-architecture-overview)
2. [Naffles Backend API Integration](#naffles-backend-api-integration)
3. [Discord API Integration](#discord-api-integration)
4. [Authentication and Authorization](#authentication-and-authorization)
5. [Error Handling and Retry Logic](#error-handling-and-retry-logic)
6. [Rate Limiting and Performance](#rate-limiting-and-performance)
7. [Data Synchronization](#data-synchronization)
8. [Webhook Integration](#webhook-integration)
9. [API Testing and Monitoring](#api-testing-and-monitoring)
10. [Development and Debugging](#development-and-debugging)

## API Architecture Overview

The Naffles Discord bot serves as a bridge between Discord and the Naffles platform, integrating multiple APIs to provide seamless functionality.

### Integration Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Discord API   │    │ Naffles Discord │    │  Naffles API    │
│                 │    │      Bot        │    │                 │
│ • Gateway       │◄──►│                 │◄──►│ • Communities   │
│ • REST API      │    │ • Command       │    │ • Social Tasks  │
│ • Webhooks      │    │   Processing    │    │ • Allowlists    │
│ • OAuth2        │    │ • Event         │    │ • Users         │
│                 │    │   Handling      │    │ • Analytics     │
└─────────────────┘    │ • Data Sync     │    └─────────────────┘
                       │ • Error         │
┌─────────────────┐    │   Handling      │    ┌─────────────────┐
│  External APIs  │    │                 │    │   Database      │
│                 │◄──►│                 │◄──►│                 │
│ • Twitter API   │    └─────────────────┘    │ • MongoDB       │
│ • Telegram API  │                           │ • Redis Cache   │
│ • Social APIs   │                           │ • Session Store │
└─────────────────┘                           └─────────────────┘
```

### Core Integration Principles

1. **Asynchronous Processing**: All API calls are non-blocking
2. **Graceful Degradation**: Fallback mechanisms for API failures
3. **Data Consistency**: Synchronization between Discord and Naffles data
4. **Real-time Updates**: Bidirectional data synchronization
5. **Security First**: All API communications are authenticated and encrypted

## Naffles Backend API Integration

### API Client Configuration

**Base API Client Setup**:
```javascript
const axios = require('axios');

class NafflesApiClient {
    constructor() {
        this.baseURL = process.env.NAFFLES_API_BASE_URL;
        this.apiKey = process.env.NAFFLES_API_KEY;
        this.timeout = 10000; // 10 seconds
        
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: this.timeout,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'User-Agent': 'Naffles-Discord-Bot/1.0',
                'Accept': 'application/json'
            }
        });
        
        this.setupInterceptors();
    }
    
    setupInterceptors() {
        // Request interceptor for logging and authentication
        this.client.interceptors.request.use(
            (config) => {
                logger.debug('API Request', {
                    method: config.method,
                    url: config.url,
                    params: config.params
                });
                return config;
            },
            (error) => {
                logger.error('API Request Error', error);
                return Promise.reject(error);
            }
        );
        
        // Response interceptor for error handling and logging
        this.client.interceptors.response.use(
            (response) => {
                logger.debug('API Response', {
                    status: response.status,
                    url: response.config.url,
                    duration: Date.now() - response.config.metadata?.startTime
                });
                return response;
            },
            (error) => {
                this.handleApiError(error);
                return Promise.reject(error);
            }
        );
    }
}
```

### Community Management API

**Community Operations**:
```javascript
class CommunityApiService extends NafflesApiClient {
    async getCommunity(communityId) {
        try {
            const response = await this.client.get(`/api/communities/${communityId}`);
            return response.data;
        } catch (error) {
            throw new ApiError('Failed to fetch community', error);
        }
    }
    
    async linkDiscordServer(communityId, guildId, userId) {
        try {
            const response = await this.client.post(`/api/communities/${communityId}/discord-link`, {
                guildId,
                linkedBy: userId,
                timestamp: new Date().toISOString()
            });
            return response.data;
        } catch (error) {
            throw new ApiError('Failed to link Discord server', error);
        }
    }
    
    async unlinkDiscordServer(communityId) {
        try {
            const response = await this.client.delete(`/api/communities/${communityId}/discord-link`);
            return response.data;
        } catch (error) {
            throw new ApiError('Failed to unlink Discord server', error);
        }
    }
    
    async getCommunityMembers(communityId, options = {}) {
        try {
            const params = {
                page: options.page || 1,
                limit: options.limit || 50,
                sort: options.sort || 'joinedAt',
                order: options.order || 'desc'
            };
            
            const response = await this.client.get(`/api/communities/${communityId}/members`, { params });
            return response.data;
        } catch (error) {
            throw new ApiError('Failed to fetch community members', error);
        }
    }
}
```

### Social Tasks API

**Task Management Operations**:
```javascript
class SocialTasksApiService extends NafflesApiClient {
    async createSocialTask(communityId, taskData) {
        try {
            const response = await this.client.post(`/api/communities/${communityId}/social-tasks`, {
                ...taskData,
                source: 'discord-bot',
                createdAt: new Date().toISOString()
            });
            return response.data;
        } catch (error) {
            throw new ApiError('Failed to create social task', error);
        }
    }
    
    async getSocialTasks(communityId, filters = {}) {
        try {
            const params = {
                status: filters.status || 'active',
                limit: filters.limit || 25,
                page: filters.page || 1,
                sortBy: filters.sortBy || 'createdAt',
                sortOrder: filters.sortOrder || 'desc'
            };
            
            const response = await this.client.get(`/api/communities/${communityId}/social-tasks`, { params });
            return response.data;
        } catch (error) {
            throw new ApiError('Failed to fetch social tasks', error);
        }
    }
    
    async updateTaskProgress(taskId, progressData) {
        try {
            const response = await this.client.patch(`/api/social-tasks/${taskId}/progress`, progressData);
            return response.data;
        } catch (error) {
            throw new ApiError('Failed to update task progress', error);
        }
    }
    
    async completeTask(taskId, userId, completionData) {
        try {
            const response = await this.client.post(`/api/social-tasks/${taskId}/complete`, {
                userId,
                completionData,
                completedAt: new Date().toISOString(),
                source: 'discord-bot'
            });
            return response.data;
        } catch (error) {
            throw new ApiError('Failed to complete task', error);
        }
    }
}
```

### Allowlist API

**Allowlist Management Operations**:
```javascript
class AllowlistApiService extends NafflesApiClient {
    async getAllowlist(allowlistId) {
        try {
            const response = await this.client.get(`/api/allowlists/${allowlistId}`);
            return response.data;
        } catch (error) {
            throw new ApiError('Failed to fetch allowlist', error);
        }
    }
    
    async connectAllowlistToDiscord(allowlistId, connectionData) {
        try {
            const response = await this.client.post(`/api/allowlists/${allowlistId}/discord-connection`, {
                ...connectionData,
                connectedAt: new Date().toISOString()
            });
            return response.data;
        } catch (error) {
            throw new ApiError('Failed to connect allowlist to Discord', error);
        }
    }
    
    async enterAllowlist(allowlistId, entryData) {
        try {
            const response = await this.client.post(`/api/allowlists/${allowlistId}/entries`, {
                ...entryData,
                enteredAt: new Date().toISOString(),
                source: 'discord-bot'
            });
            return response.data;
        } catch (error) {
            throw new ApiError('Failed to enter allowlist', error);
        }
    }
    
    async getAllowlistEntries(allowlistId, options = {}) {
        try {
            const params = {
                page: options.page || 1,
                limit: options.limit || 100,
                status: options.status || 'active'
            };
            
            const response = await this.client.get(`/api/allowlists/${allowlistId}/entries`, { params });
            return response.data;
        } catch (error) {
            throw new ApiError('Failed to fetch allowlist entries', error);
        }
    }
}
```

### User Management API

**User Operations**:
```javascript
class UserApiService extends NafflesApiClient {
    async linkDiscordAccount(nafflesUserId, discordData) {
        try {
            const response = await this.client.post(`/api/users/${nafflesUserId}/discord-link`, {
                discordId: discordData.id,
                username: discordData.username,
                discriminator: discordData.discriminator,
                avatar: discordData.avatar,
                linkedAt: new Date().toISOString()
            });
            return response.data;
        } catch (error) {
            throw new ApiError('Failed to link Discord account', error);
        }
    }
    
    async getUserByDiscordId(discordId) {
        try {
            const response = await this.client.get(`/api/users/discord/${discordId}`);
            return response.data;
        } catch (error) {
            if (error.response?.status === 404) {
                return null; // User not found
            }
            throw new ApiError('Failed to fetch user by Discord ID', error);
        }
    }
    
    async updateUserActivity(userId, activityData) {
        try {
            const response = await this.client.patch(`/api/users/${userId}/activity`, {
                ...activityData,
                timestamp: new Date().toISOString(),
                source: 'discord-bot'
            });
            return response.data;
        } catch (error) {
            throw new ApiError('Failed to update user activity', error);
        }
    }
}
```

## Discord API Integration

### Discord Client Configuration

**Bot Client Setup**:
```javascript
const { Client, GatewayIntentBits, Partials } = require('discord.js');

class DiscordBotClient {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.MessageContent
            ],
            partials: [
                Partials.User,
                Partials.Channel,
                Partials.GuildMember,
                Partials.Message
            ]
        });
        
        this.setupEventHandlers();
        this.setupErrorHandling();
    }
    
    setupEventHandlers() {
        this.client.on('ready', () => {
            logger.info(`Discord bot logged in as ${this.client.user.tag}`);
            this.registerSlashCommands();
        });
        
        this.client.on('interactionCreate', async (interaction) => {
            await this.handleInteraction(interaction);
        });
        
        this.client.on('guildCreate', async (guild) => {
            await this.handleGuildJoin(guild);
        });
        
        this.client.on('guildDelete', async (guild) => {
            await this.handleGuildLeave(guild);
        });
    }
    
    setupErrorHandling() {
        this.client.on('error', (error) => {
            logger.error('Discord client error', error);
        });
        
        this.client.on('warn', (warning) => {
            logger.warn('Discord client warning', warning);
        });
        
        this.client.on('shardError', (error, shardId) => {
            logger.error(`Shard ${shardId} error`, error);
        });
    }
}
```

### Slash Command Registration

**Command Registration System**:
```javascript
class SlashCommandManager {
    constructor(client) {
        this.client = client;
        this.commands = new Map();
        this.loadCommands();
    }
    
    loadCommands() {
        const commandFiles = fs.readdirSync('./src/commands').filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
            const CommandClass = require(`./commands/${file}`);
            const command = new CommandClass(this.botService);
            
            this.commands.set(command.name, command);
        }
    }
    
    async registerGlobalCommands() {
        const commandData = Array.from(this.commands.values()).map(command => command.data);
        
        try {
            const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
            
            await rest.put(
                Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
                { body: commandData }
            );
            
            logger.info(`Successfully registered ${commandData.length} global slash commands`);
        } catch (error) {
            logger.error('Failed to register slash commands', error);
            throw error;
        }
    }
    
    async registerGuildCommands(guildId) {
        const commandData = Array.from(this.commands.values()).map(command => command.data);
        
        try {
            const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
            
            await rest.put(
                Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, guildId),
                { body: commandData }
            );
            
            logger.info(`Successfully registered ${commandData.length} guild commands for ${guildId}`);
        } catch (error) {
            logger.error(`Failed to register guild commands for ${guildId}`, error);
            throw error;
        }
    }
}
```

### Interaction Handling

**Comprehensive Interaction Handler**:
```javascript
class InteractionHandler {
    constructor(botService) {
        this.botService = botService;
        this.commands = new Map();
        this.buttonHandlers = new Map();
        this.selectMenuHandlers = new Map();
        this.modalHandlers = new Map();
    }
    
    async handleInteraction(interaction) {
        try {
            // Log interaction for analytics
            await this.logInteraction(interaction);
            
            if (interaction.isChatInputCommand()) {
                await this.handleSlashCommand(interaction);
            } else if (interaction.isButton()) {
                await this.handleButtonInteraction(interaction);
            } else if (interaction.isStringSelectMenu()) {
                await this.handleSelectMenuInteraction(interaction);
            } else if (interaction.isModalSubmit()) {
                await this.handleModalSubmission(interaction);
            }
        } catch (error) {
            logger.error('Error handling interaction', {
                interactionId: interaction.id,
                type: interaction.type,
                error: error.message
            });
            
            await this.handleInteractionError(interaction, error);
        }
    }
    
    async handleSlashCommand(interaction) {
        const command = this.commands.get(interaction.commandName);
        
        if (!command) {
            await interaction.reply({
                content: '❌ Unknown command. Please try again.',
                ephemeral: true
            });
            return;
        }
        
        // Check rate limiting
        const rateLimitCheck = await this.checkRateLimit(interaction);
        if (!rateLimitCheck.allowed) {
            await interaction.reply({
                content: `⏰ Rate limited. Please wait ${rateLimitCheck.retryAfter} seconds.`,
                ephemeral: true
            });
            return;
        }
        
        // Execute command
        await command.execute(interaction);
    }
    
    async handleButtonInteraction(interaction) {
        const [handlerName, ...params] = interaction.customId.split('_');
        const handler = this.buttonHandlers.get(handlerName);
        
        if (!handler) {
            await interaction.reply({
                content: '❌ Button handler not found.',
                ephemeral: true
            });
            return;
        }
        
        await handler.handle(interaction, params);
    }
}
```

### Message and Embed Management

**Rich Embed Creation**:
```javascript
class EmbedBuilder {
    constructor() {
        this.defaultColor = 0x7C3AED; // Naffles purple
        this.brandingConfig = {
            logoUrl: 'https://naffles.com/logo.png',
            footerText: 'Powered by Naffles',
            thumbnailUrl: 'https://naffles.com/thumbnail.png'
        };
    }
    
    createTaskEmbed(task) {
        const embed = new MessageEmbed()
            .setTitle(`🎯 ${task.title}`)
            .setDescription(task.description)
            .setColor(this.getTaskColor(task.status))
            .addFields(
                { name: '💰 Reward', value: `${task.points} points`, inline: true },
                { name: '🏷️ Type', value: this.formatTaskType(task.type), inline: true },
                { name: '📊 Status', value: this.formatStatus(task.status), inline: true }
            )
            .setFooter({ 
                text: this.brandingConfig.footerText, 
                iconURL: this.brandingConfig.logoUrl 
            })
            .setTimestamp(new Date(task.createdAt));
        
        if (task.endTime) {
            const endTime = Math.floor(new Date(task.endTime).getTime() / 1000);
            embed.addFields({ name: '⏰ Ends', value: `<t:${endTime}:R>`, inline: true });
        }
        
        return embed;
    }
    
    createAllowlistEmbed(allowlist) {
        const embed = new MessageEmbed()
            .setTitle(`🎫 ${allowlist.title}`)
            .setDescription(allowlist.description)
            .setColor(0xEC4899) // Pink for allowlists
            .addFields(
                { name: '🎯 Winners', value: allowlist.winnerCount.toString(), inline: true },
                { name: '💰 Entry Cost', value: allowlist.entryPrice || 'Free', inline: true },
                { name: '👥 Entries', value: `${allowlist.currentEntries}/${allowlist.maxEntries || '∞'}`, inline: true }
            )
            .setFooter({ 
                text: this.brandingConfig.footerText, 
                iconURL: this.brandingConfig.logoUrl 
            })
            .setTimestamp(new Date(allowlist.createdAt));
        
        if (allowlist.endTime) {
            const endTime = Math.floor(new Date(allowlist.endTime).getTime() / 1000);
            embed.addFields({ name: '⏰ Ends', value: `<t:${endTime}:R>`, inline: true });
        }
        
        return embed;
    }
    
    createErrorEmbed(title, description, suggestions = []) {
        const embed = new MessageEmbed()
            .setTitle(`❌ ${title}`)
            .setDescription(description)
            .setColor(0xEF4444); // Red for errors
        
        if (suggestions.length > 0) {
            embed.addFields({
                name: '💡 Suggestions',
                value: suggestions.map(s => `• ${s}`).join('\n'),
                inline: false
            });
        }
        
        return embed;
    }
}
```

## Authentication and Authorization

### OAuth2 Integration

**Discord OAuth2 Flow**:
```javascript
class DiscordOAuthService {
    constructor() {
        this.clientId = process.env.DISCORD_CLIENT_ID;
        this.clientSecret = process.env.DISCORD_CLIENT_SECRET;
        this.redirectUri = process.env.DISCORD_REDIRECT_URI;
        this.scopes = ['identify', 'guilds'];
    }
    
    generateAuthUrl(state) {
        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            response_type: 'code',
            scope: this.scopes.join(' '),
            state: state
        });
        
        return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
    }
    
    async exchangeCodeForToken(code) {
        try {
            const response = await axios.post('https://discord.com/api/oauth2/token', {
                client_id: this.clientId,
                client_secret: this.clientSecret,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: this.redirectUri
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            
            return response.data;
        } catch (error) {
            throw new AuthenticationError('Failed to exchange code for token', error);
        }
    }
    
    async getUserInfo(accessToken) {
        try {
            const response = await axios.get('https://discord.com/api/users/@me', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            
            return response.data;
        } catch (error) {
            throw new AuthenticationError('Failed to fetch user info', error);
        }
    }
    
    async refreshToken(refreshToken) {
        try {
            const response = await axios.post('https://discord.com/api/oauth2/token', {
                client_id: this.clientId,
                client_secret: this.clientSecret,
                grant_type: 'refresh_token',
                refresh_token: refreshToken
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            
            return response.data;
        } catch (error) {
            throw new AuthenticationError('Failed to refresh token', error);
        }
    }
}
```

### Permission Validation

**Multi-Level Permission System**:
```javascript
class PermissionManager {
    constructor() {
        this.permissionCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }
    
    async validateUserPermissions(guildId, userId, requiredPermissions) {
        const cacheKey = `${guildId}:${userId}`;
        const cached = this.permissionCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return this.checkPermissions(cached.permissions, requiredPermissions);
        }
        
        try {
            const guild = await client.guilds.fetch(guildId);
            const member = await guild.members.fetch(userId);
            
            const permissions = {
                discord: member.permissions.toArray(),
                roles: member.roles.cache.map(role => ({
                    id: role.id,
                    name: role.name,
                    permissions: role.permissions.toArray()
                })),
                isOwner: member.id === guild.ownerId,
                isAdmin: member.permissions.has('Administrator')
            };
            
            // Cache permissions
            this.permissionCache.set(cacheKey, {
                permissions,
                timestamp: Date.now()
            });
            
            return this.checkPermissions(permissions, requiredPermissions);
        } catch (error) {
            logger.error('Failed to validate user permissions', {
                guildId,
                userId,
                error: error.message
            });
            
            return {
                hasPermission: false,
                reason: 'Unable to verify permissions'
            };
        }
    }
    
    checkPermissions(userPermissions, requiredPermissions) {
        // Check if user is server owner (has all permissions)
        if (userPermissions.isOwner) {
            return { hasPermission: true };
        }
        
        // Check if user has Administrator permission (has all permissions)
        if (userPermissions.isAdmin) {
            return { hasPermission: true };
        }
        
        // Check specific required permissions
        const missingPermissions = requiredPermissions.filter(
            permission => !userPermissions.discord.includes(permission)
        );
        
        if (missingPermissions.length > 0) {
            return {
                hasPermission: false,
                reason: `Missing permissions: ${missingPermissions.join(', ')}`
            };
        }
        
        return { hasPermission: true };
    }
    
    async validateCommunityAccess(userId, communityId, requiredRole = 'member') {
        try {
            const user = await this.nafflesApi.getUserByDiscordId(userId);
            if (!user) {
                return {
                    hasAccess: false,
                    reason: 'Discord account not linked to Naffles'
                };
            }
            
            const community = await this.nafflesApi.getCommunity(communityId);
            const membership = await this.nafflesApi.getCommunityMembership(communityId, user.id);
            
            if (!membership) {
                return {
                    hasAccess: false,
                    reason: 'Not a member of this community'
                };
            }
            
            const roleHierarchy = ['member', 'moderator', 'admin', 'owner'];
            const userRoleLevel = roleHierarchy.indexOf(membership.role);
            const requiredRoleLevel = roleHierarchy.indexOf(requiredRole);
            
            if (userRoleLevel < requiredRoleLevel) {
                return {
                    hasAccess: false,
                    reason: `Insufficient community role. Required: ${requiredRole}, Current: ${membership.role}`
                };
            }
            
            return { hasAccess: true };
        } catch (error) {
            logger.error('Failed to validate community access', {
                userId,
                communityId,
                requiredRole,
                error: error.message
            });
            
            return {
                hasAccess: false,
                reason: 'Unable to verify community access'
            };
        }
    }
}
```

## Error Handling and Retry Logic

### Comprehensive Error Handling

**Error Classification and Handling**:
```javascript
class ApiErrorHandler {
    constructor() {
        this.retryableErrors = [
            'ECONNRESET',
            'ENOTFOUND',
            'ECONNREFUSED',
            'ETIMEDOUT',
            'NETWORK_ERROR'
        ];
        
        this.retryableStatusCodes = [429, 500, 502, 503, 504];
        this.maxRetries = 3;
        this.baseDelay = 1000; // 1 second
    }
    
    async handleApiError(error, context = {}) {
        const errorInfo = this.classifyError(error);
        
        // Log error with context
        logger.error('API Error', {
            ...errorInfo,
            context,
            timestamp: new Date().toISOString()
        });
        
        // Determine if error is retryable
        if (this.isRetryableError(error)) {
            return this.scheduleRetry(error, context);
        }
        
        // Handle specific error types
        switch (errorInfo.type) {
            case 'AUTHENTICATION_ERROR':
                return this.handleAuthenticationError(error, context);
            case 'PERMISSION_ERROR':
                return this.handlePermissionError(error, context);
            case 'RATE_LIMIT_ERROR':
                return this.handleRateLimitError(error, context);
            case 'VALIDATION_ERROR':
                return this.handleValidationError(error, context);
            default:
                return this.handleGenericError(error, context);
        }
    }
    
    classifyError(error) {
        if (error.response) {
            const status = error.response.status;
            const data = error.response.data;
            
            switch (status) {
                case 401:
                    return { type: 'AUTHENTICATION_ERROR', status, data };
                case 403:
                    return { type: 'PERMISSION_ERROR', status, data };
                case 404:
                    return { type: 'NOT_FOUND_ERROR', status, data };
                case 422:
                    return { type: 'VALIDATION_ERROR', status, data };
                case 429:
                    return { type: 'RATE_LIMIT_ERROR', status, data };
                case 500:
                case 502:
                case 503:
                case 504:
                    return { type: 'SERVER_ERROR', status, data };
                default:
                    return { type: 'HTTP_ERROR', status, data };
            }
        } else if (error.request) {
            return { type: 'NETWORK_ERROR', error: error.message };
        } else {
            return { type: 'UNKNOWN_ERROR', error: error.message };
        }
    }
    
    async scheduleRetry(error, context, attempt = 1) {
        if (attempt > this.maxRetries) {
            throw new MaxRetriesExceededError('Maximum retry attempts exceeded', error);
        }
        
        const delay = this.calculateRetryDelay(attempt, error);
        
        logger.info('Scheduling retry', {
            attempt,
            delay,
            maxRetries: this.maxRetries,
            context
        });
        
        await this.sleep(delay);
        
        try {
            // Retry the original operation
            return await context.retryFunction();
        } catch (retryError) {
            return this.scheduleRetry(retryError, context, attempt + 1);
        }
    }
    
    calculateRetryDelay(attempt, error) {
        // Exponential backoff with jitter
        const exponentialDelay = this.baseDelay * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 1000; // Add up to 1 second of jitter
        
        // Check for Retry-After header (rate limiting)
        if (error.response?.headers?.['retry-after']) {
            const retryAfter = parseInt(error.response.headers['retry-after']) * 1000;
            return Math.max(retryAfter, exponentialDelay) + jitter;
        }
        
        return exponentialDelay + jitter;
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
```

### Circuit Breaker Pattern

**Circuit Breaker Implementation**:
```javascript
class CircuitBreaker {
    constructor(options = {}) {
        this.failureThreshold = options.failureThreshold || 5;
        this.resetTimeout = options.resetTimeout || 60000; // 1 minute
        this.monitoringPeriod = options.monitoringPeriod || 10000; // 10 seconds
        
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.successCount = 0;
    }
    
    async execute(operation, fallback = null) {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
                this.state = 'HALF_OPEN';
                this.successCount = 0;
            } else {
                return this.executeFallback(fallback);
            }
        }
        
        try {
            const result = await operation();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            
            if (this.state === 'OPEN') {
                return this.executeFallback(fallback);
            }
            
            throw error;
        }
    }
    
    onSuccess() {
        this.failureCount = 0;
        
        if (this.state === 'HALF_OPEN') {
            this.successCount++;
            if (this.successCount >= 3) { // Require 3 successes to close
                this.state = 'CLOSED';
            }
        }
    }
    
    onFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        
        if (this.failureCount >= this.failureThreshold) {
            this.state = 'OPEN';
        }
    }
    
    async executeFallback(fallback) {
        if (typeof fallback === 'function') {
            return await fallback();
        }
        
        throw new CircuitBreakerOpenError('Circuit breaker is open');
    }
}
```

## Rate Limiting and Performance

### Intelligent Rate Limiting

**Multi-Tier Rate Limiting System**:
```javascript
class RateLimitManager {
    constructor() {
        this.limits = {
            global: { requests: 1000, window: 60000 }, // 1000 requests per minute globally
            perUser: { requests: 10, window: 60000 }, // 10 requests per minute per user
            perGuild: { requests: 100, window: 60000 }, // 100 requests per minute per guild
            perCommand: {
                'create-task': { requests: 5, window: 300000 }, // 5 task creations per 5 minutes
                'connect-allowlist': { requests: 3, window: 600000 } // 3 allowlist connections per 10 minutes
            }
        };
        
        this.counters = new Map();
        this.violations = new Map();
    }
    
    async checkRateLimit(key, limitType, identifier = null) {
        const limit = this.getLimitConfig(limitType, identifier);
        const counterKey = `${limitType}:${key}`;
        
        const current = this.counters.get(counterKey) || { count: 0, resetTime: Date.now() + limit.window };
        
        // Reset counter if window has passed
        if (Date.now() >= current.resetTime) {
            current.count = 0;
            current.resetTime = Date.now() + limit.window;
        }
        
        // Check if limit exceeded
        if (current.count >= limit.requests) {
            await this.recordViolation(counterKey, limitType);
            return {
                allowed: false,
                retryAfter: Math.ceil((current.resetTime - Date.now()) / 1000),
                limit: limit.requests,
                remaining: 0,
                resetTime: current.resetTime
            };
        }
        
        // Increment counter
        current.count++;
        this.counters.set(counterKey, current);
        
        return {
            allowed: true,
            limit: limit.requests,
            remaining: limit.requests - current.count,
            resetTime: current.resetTime
        };
    }
    
    getLimitConfig(limitType, identifier) {
        if (limitType === 'perCommand' && identifier) {
            return this.limits.perCommand[identifier] || this.limits.perUser;
        }
        
        return this.limits[limitType] || this.limits.global;
    }
    
    async recordViolation(key, limitType) {
        const violations = this.violations.get(key) || { count: 0, firstViolation: Date.now() };
        violations.count++;
        
        this.violations.set(key, violations);
        
        // Alert if excessive violations
        if (violations.count > 10) {
            await this.alertSecurityTeam(key, limitType, violations);
        }
    }
}
```

### Performance Optimization

**Caching and Performance Strategies**:
```javascript
class PerformanceOptimizer {
    constructor() {
        this.cache = new Map();
        this.cacheConfig = {
            communities: { ttl: 300000, maxSize: 1000 }, // 5 minutes, 1000 entries
            users: { ttl: 600000, maxSize: 5000 }, // 10 minutes, 5000 entries
            tasks: { ttl: 60000, maxSize: 2000 }, // 1 minute, 2000 entries
            allowlists: { ttl: 120000, maxSize: 1000 } // 2 minutes, 1000 entries
        };
        
        this.setupCacheCleanup();
    }
    
    async getCachedData(key, type, fetchFunction) {
        const cacheKey = `${type}:${key}`;
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheConfig[type].ttl) {
            return cached.data;
        }
        
        try {
            const data = await fetchFunction();
            
            // Store in cache
            this.cache.set(cacheKey, {
                data,
                timestamp: Date.now()
            });
            
            // Enforce cache size limits
            this.enforceCacheSize(type);
            
            return data;
        } catch (error) {
            // Return stale data if available and error is not critical
            if (cached && this.isNonCriticalError(error)) {
                logger.warn('Using stale cache data due to API error', { key, type, error: error.message });
                return cached.data;
            }
            
            throw error;
        }
    }
    
    invalidateCache(key, type) {
        const cacheKey = `${type}:${key}`;
        this.cache.delete(cacheKey);
    }
    
    enforceCacheSize(type) {
        const config = this.cacheConfig[type];
        const typeKeys = Array.from(this.cache.keys()).filter(key => key.startsWith(`${type}:`));
        
        if (typeKeys.length > config.maxSize) {
            // Remove oldest entries
            const sortedKeys = typeKeys
                .map(key => ({ key, timestamp: this.cache.get(key).timestamp }))
                .sort((a, b) => a.timestamp - b.timestamp);
            
            const keysToRemove = sortedKeys.slice(0, typeKeys.length - config.maxSize);
            keysToRemove.forEach(({ key }) => this.cache.delete(key));
        }
    }
    
    setupCacheCleanup() {
        // Clean up expired cache entries every 5 minutes
        setInterval(() => {
            const now = Date.now();
            
            for (const [key, value] of this.cache.entries()) {
                const [type] = key.split(':');
                const config = this.cacheConfig[type];
                
                if (config && now - value.timestamp > config.ttl) {
                    this.cache.delete(key);
                }
            }
        }, 300000); // 5 minutes
    }
}
```

## Data Synchronization

### Real-time Data Sync

**Bidirectional Synchronization System**:
```javascript
class DataSynchronizer {
    constructor(botService) {
        this.botService = botService;
        this.syncQueue = [];
        this.syncInProgress = new Set();
        this.syncInterval = 30000; // 30 seconds
        
        this.setupSyncScheduler();
        this.setupWebhookHandlers();
    }
    
    async syncTaskData(taskId, source = 'discord') {
        if (this.syncInProgress.has(`task:${taskId}`)) {
            return; // Sync already in progress
        }
        
        this.syncInProgress.add(`task:${taskId}`);
        
        try {
            // Get latest data from both sources
            const [discordData, nafflesData] = await Promise.all([
                this.getDiscordTaskData(taskId),
                this.getNafflesTaskData(taskId)
            ]);
            
            // Determine which data is more recent
            const syncDirection = this.determineSyncDirection(discordData, nafflesData, source);
            
            switch (syncDirection) {
                case 'discord_to_naffles':
                    await this.syncDiscordToNaffles(taskId, discordData);
                    break;
                case 'naffles_to_discord':
                    await this.syncNafflesToDiscord(taskId, nafflesData);
                    break;
                case 'conflict':
                    await this.handleSyncConflict(taskId, discordData, nafflesData);
                    break;
                case 'no_sync_needed':
                    // Data is already in sync
                    break;
            }
            
            logger.debug('Task data synchronized', { taskId, direction: syncDirection });
        } catch (error) {
            logger.error('Failed to sync task data', { taskId, error: error.message });
            throw error;
        } finally {
            this.syncInProgress.delete(`task:${taskId}`);
        }
    }
    
    async syncAllowlistData(allowlistId, source = 'discord') {
        if (this.syncInProgress.has(`allowlist:${allowlistId}`)) {
            return;
        }
        
        this.syncInProgress.add(`allowlist:${allowlistId}`);
        
        try {
            const [discordData, nafflesData] = await Promise.all([
                this.getDiscordAllowlistData(allowlistId),
                this.getNafflesAllowlistData(allowlistId)
            ]);
            
            // Sync entry counts and status
            if (discordData && nafflesData) {
                await this.updateDiscordAllowlistPost(allowlistId, {
                    currentEntries: nafflesData.currentEntries,
                    status: nafflesData.status,
                    lastUpdated: new Date()
                });
            }
            
            logger.debug('Allowlist data synchronized', { allowlistId });
        } catch (error) {
            logger.error('Failed to sync allowlist data', { allowlistId, error: error.message });
            throw error;
        } finally {
            this.syncInProgress.delete(`allowlist:${allowlistId}`);
        }
    }
    
    determineSyncDirection(discordData, nafflesData, source) {
        if (!discordData && !nafflesData) {
            return 'no_sync_needed';
        }
        
        if (!discordData) {
            return 'naffles_to_discord';
        }
        
        if (!nafflesData) {
            return 'discord_to_naffles';
        }
        
        // Compare timestamps
        const discordTimestamp = new Date(discordData.lastUpdated).getTime();
        const nafflesTimestamp = new Date(nafflesData.lastUpdated).getTime();
        
        const timeDiff = Math.abs(discordTimestamp - nafflesTimestamp);
        
        // If timestamps are very close (within 5 seconds), use source preference
        if (timeDiff < 5000) {
            return source === 'discord' ? 'discord_to_naffles' : 'naffles_to_discord';
        }
        
        // Use more recent data
        if (discordTimestamp > nafflesTimestamp) {
            return 'discord_to_naffles';
        } else if (nafflesTimestamp > discordTimestamp) {
            return 'naffles_to_discord';
        }
        
        // If timestamps are equal, check for conflicts
        if (this.hasDataConflicts(discordData, nafflesData)) {
            return 'conflict';
        }
        
        return 'no_sync_needed';
    }
    
    setupSyncScheduler() {
        // Periodic sync for active items
        setInterval(async () => {
            await this.performScheduledSync();
        }, this.syncInterval);
    }
    
    async performScheduledSync() {
        try {
            // Get all active tasks and allowlists that need syncing
            const activeTasks = await this.getActiveTasksForSync();
            const activeAllowlists = await this.getActiveAllowlistsForSync();
            
            // Sync in batches to avoid overwhelming the APIs
            const batchSize = 10;
            
            for (let i = 0; i < activeTasks.length; i += batchSize) {
                const batch = activeTasks.slice(i, i + batchSize);
                await Promise.all(batch.map(task => this.syncTaskData(task.id, 'scheduled')));
            }
            
            for (let i = 0; i < activeAllowlists.length; i += batchSize) {
                const batch = activeAllowlists.slice(i, i + batchSize);
                await Promise.all(batch.map(allowlist => this.syncAllowlistData(allowlist.id, 'scheduled')));
            }
            
            logger.debug('Scheduled sync completed', {
                tasksSynced: activeTasks.length,
                allowlistsSynced: activeAllowlists.length
            });
        } catch (error) {
            logger.error('Scheduled sync failed', error);
        }
    }
}
```

## Webhook Integration

### Webhook Management

**Webhook Handler System**:
```javascript
class WebhookManager {
    constructor(botService) {
        this.botService = botService;
        this.webhooks = new Map();
        this.webhookSecret = process.env.WEBHOOK_SECRET;
        
        this.setupWebhookRoutes();
    }
    
    setupWebhookRoutes() {
        // Naffles API webhooks
        this.botService.app.post('/webhooks/naffles/task-completed', 
            this.validateWebhookSignature.bind(this),
            this.handleTaskCompletedWebhook.bind(this)
        );
        
        this.botService.app.post('/webhooks/naffles/allowlist-updated',
            this.validateWebhookSignature.bind(this),
            this.handleAllowlistUpdatedWebhook.bind(this)
        );
        
        this.botService.app.post('/webhooks/naffles/community-updated',
            this.validateWebhookSignature.bind(this),
            this.handleCommunityUpdatedWebhook.bind(this)
        );
    }
    
    validateWebhookSignature(req, res, next) {
        const signature = req.headers['x-naffles-signature'];
        const timestamp = req.headers['x-naffles-timestamp'];
        
        if (!signature || !timestamp) {
            return res.status(401).json({ error: 'Missing signature or timestamp' });
        }
        
        // Check timestamp to prevent replay attacks
        const currentTime = Math.floor(Date.now() / 1000);
        if (Math.abs(currentTime - parseInt(timestamp)) > 300) { // 5 minutes tolerance
            return res.status(401).json({ error: 'Request timestamp too old' });
        }
        
        // Verify signature
        const expectedSignature = this.generateWebhookSignature(req.body, timestamp);
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
            return res.status(401).json({ error: 'Invalid signature' });
        }
        
        next();
    }
    
    generateWebhookSignature(payload, timestamp) {
        const data = `${timestamp}.${JSON.stringify(payload)}`;
        return crypto.createHmac('sha256', this.webhookSecret).update(data).digest('hex');
    }
    
    async handleTaskCompletedWebhook(req, res) {
        try {
            const { taskId, userId, completionData } = req.body;
            
            // Update Discord post with completion
            await this.updateTaskDiscordPost(taskId, {
                completedBy: completionData.completedBy,
                completionRate: completionData.completionRate,
                lastUpdated: new Date()
            });
            
            // Send completion notification if configured
            await this.sendTaskCompletionNotification(taskId, userId, completionData);
            
            res.status(200).json({ success: true });
        } catch (error) {
            logger.error('Failed to handle task completed webhook', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    
    async handleAllowlistUpdatedWebhook(req, res) {
        try {
            const { allowlistId, updateType, data } = req.body;
            
            switch (updateType) {
                case 'entry_added':
                    await this.updateAllowlistEntryCount(allowlistId, data.newEntryCount);
                    break;
                case 'status_changed':
                    await this.updateAllowlistStatus(allowlistId, data.newStatus);
                    break;
                case 'winners_selected':
                    await this.announceAllowlistWinners(allowlistId, data.winners);
                    break;
            }
            
            res.status(200).json({ success: true });
        } catch (error) {
            logger.error('Failed to handle allowlist updated webhook', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    
    async registerWebhook(url, events, secret) {
        try {
            const response = await this.botService.nafflesApi.post('/api/webhooks', {
                url,
                events,
                secret,
                active: true
            });
            
            const webhookId = response.data.id;
            this.webhooks.set(webhookId, { url, events, secret });
            
            return webhookId;
        } catch (error) {
            logger.error('Failed to register webhook', error);
            throw error;
        }
    }
}
```

## API Testing and Monitoring

### Comprehensive API Testing

**API Health Monitoring**:
```javascript
class ApiHealthMonitor {
    constructor() {
        this.healthChecks = new Map();
        this.alertThresholds = {
            responseTime: 5000, // 5 seconds
            errorRate: 0.05, // 5%
            availability: 0.99 // 99%
        };
        
        this.setupHealthChecks();
    }
    
    setupHealthChecks() {
        // Discord API health check
        this.healthChecks.set('discord', {
            name: 'Discord API',
            url: 'https://discord.com/api/v10/gateway',
            method: 'GET',
            interval: 60000, // 1 minute
            timeout: 5000,
            expectedStatus: 200
        });
        
        // Naffles API health check
        this.healthChecks.set('naffles', {
            name: 'Naffles API',
            url: `${process.env.NAFFLES_API_BASE_URL}/health`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.NAFFLES_API_KEY}`
            },
            interval: 30000, // 30 seconds
            timeout: 10000,
            expectedStatus: 200
        });
        
        this.startHealthChecks();
    }
    
    startHealthChecks() {
        for (const [key, config] of this.healthChecks.entries()) {
            this.scheduleHealthCheck(key, config);
        }
    }
    
    scheduleHealthCheck(key, config) {
        const performCheck = async () => {
            const startTime = Date.now();
            let status = 'healthy';
            let error = null;
            
            try {
                const response = await axios({
                    method: config.method,
                    url: config.url,
                    headers: config.headers,
                    timeout: config.timeout
                });
                
                if (response.status !== config.expectedStatus) {
                    status = 'unhealthy';
                    error = `Unexpected status code: ${response.status}`;
                }
            } catch (err) {
                status = 'unhealthy';
                error = err.message;
            }
            
            const responseTime = Date.now() - startTime;
            
            // Record health check result
            await this.recordHealthCheck(key, {
                status,
                responseTime,
                error,
                timestamp: new Date()
            });
            
            // Check for alerts
            await this.checkHealthAlerts(key, status, responseTime, error);
        };
        
        // Perform initial check
        performCheck();
        
        // Schedule recurring checks
        setInterval(performCheck, config.interval);
    }
    
    async recordHealthCheck(service, result) {
        // Store in database for historical analysis
        await HealthCheck.create({
            service,
            ...result
        });
        
        // Update real-time metrics
        this.updateHealthMetrics(service, result);
    }
    
    updateHealthMetrics(service, result) {
        const metrics = this.getServiceMetrics(service);
        
        metrics.totalChecks++;
        metrics.lastCheck = result.timestamp;
        metrics.lastStatus = result.status;
        metrics.lastResponseTime = result.responseTime;
        
        if (result.status === 'healthy') {
            metrics.successfulChecks++;
        } else {
            metrics.failedChecks++;
            metrics.lastError = result.error;
        }
        
        // Calculate availability and average response time
        metrics.availability = metrics.successfulChecks / metrics.totalChecks;
        metrics.averageResponseTime = this.calculateAverageResponseTime(service);
    }
    
    async checkHealthAlerts(service, status, responseTime, error) {
        const metrics = this.getServiceMetrics(service);
        
        // Response time alert
        if (responseTime > this.alertThresholds.responseTime) {
            await this.sendAlert('slow_response', {
                service,
                responseTime,
                threshold: this.alertThresholds.responseTime
            });
        }
        
        // Error rate alert
        if (metrics.availability < this.alertThresholds.availability) {
            await this.sendAlert('low_availability', {
                service,
                availability: metrics.availability,
                threshold: this.alertThresholds.availability
            });
        }
        
        // Service down alert
        if (status === 'unhealthy') {
            await this.sendAlert('service_unhealthy', {
                service,
                error,
                consecutiveFailures: this.getConsecutiveFailures(service)
            });
        }
    }
    
    async generateHealthReport(timeframe = '24h') {
        const startTime = this.getTimeframeStart(timeframe);
        
        const healthData = await HealthCheck.find({
            timestamp: { $gte: startTime }
        }).sort({ timestamp: 1 });
        
        const report = {
            timeframe,
            generatedAt: new Date(),
            services: {}
        };
        
        for (const [service] of this.healthChecks.entries()) {
            const serviceData = healthData.filter(check => check.service === service);
            
            report.services[service] = {
                totalChecks: serviceData.length,
                successfulChecks: serviceData.filter(check => check.status === 'healthy').length,
                averageResponseTime: this.calculateAverage(serviceData.map(check => check.responseTime)),
                availability: serviceData.filter(check => check.status === 'healthy').length / serviceData.length,
                incidents: this.identifyIncidents(serviceData),
                trends: this.analyzeTrends(serviceData)
            };
        }
        
        return report;
    }
}
```

## Development and Debugging

### Development Tools

**API Testing and Debugging Tools**:
```javascript
class ApiDebugger {
    constructor() {
        this.debugMode = process.env.NODE_ENV === 'development';
        this.requestLog = [];
        this.maxLogSize = 1000;
    }
    
    logApiRequest(config, response, error = null) {
        if (!this.debugMode) return;
        
        const logEntry = {
            timestamp: new Date().toISOString(),
            method: config.method?.toUpperCase(),
            url: config.url,
            headers: this.sanitizeHeaders(config.headers),
            params: config.params,
            data: this.sanitizeRequestData(config.data),
            responseStatus: response?.status,
            responseTime: response?.config?.metadata?.responseTime,
            error: error ? {
                message: error.message,
                code: error.code,
                status: error.response?.status
            } : null
        };
        
        this.requestLog.push(logEntry);
        
        // Maintain log size
        if (this.requestLog.length > this.maxLogSize) {
            this.requestLog.shift();
        }
        
        // Console output for development
        if (error) {
            console.error('🔴 API Error:', logEntry);
        } else {
            console.log('🟢 API Success:', logEntry);
        }
    }
    
    sanitizeHeaders(headers) {
        if (!headers) return {};
        
        const sanitized = { ...headers };
        
        // Remove sensitive headers
        delete sanitized.Authorization;
        delete sanitized['X-API-Key'];
        
        return sanitized;
    }
    
    sanitizeRequestData(data) {
        if (!data) return null;
        
        const sanitized = JSON.parse(JSON.stringify(data));
        
        // Remove sensitive fields
        if (sanitized.password) sanitized.password = '[REDACTED]';
        if (sanitized.token) sanitized.token = '[REDACTED]';
        if (sanitized.apiKey) sanitized.apiKey = '[REDACTED]';
        
        return sanitized;
    }
    
    getRequestLog(filters = {}) {
        let filteredLog = [...this.requestLog];
        
        if (filters.method) {
            filteredLog = filteredLog.filter(entry => 
                entry.method === filters.method.toUpperCase()
            );
        }
        
        if (filters.status) {
            filteredLog = filteredLog.filter(entry => 
                entry.responseStatus === filters.status
            );
        }
        
        if (filters.hasError !== undefined) {
            filteredLog = filteredLog.filter(entry => 
                Boolean(entry.error) === filters.hasError
            );
        }
        
        if (filters.since) {
            const sinceTime = new Date(filters.since);
            filteredLog = filteredLog.filter(entry => 
                new Date(entry.timestamp) >= sinceTime
            );
        }
        
        return filteredLog;
    }
    
    exportRequestLog(format = 'json') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `api-debug-log-${timestamp}`;
        
        switch (format) {
            case 'json':
                return {
                    filename: `${filename}.json`,
                    content: JSON.stringify(this.requestLog, null, 2)
                };
            case 'csv':
                return {
                    filename: `${filename}.csv`,
                    content: this.convertToCsv(this.requestLog)
                };
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }
    
    convertToCsv(data) {
        if (data.length === 0) return '';
        
        const headers = ['timestamp', 'method', 'url', 'responseStatus', 'responseTime', 'error'];
        const csvRows = [headers.join(',')];
        
        for (const entry of data) {
            const row = [
                entry.timestamp,
                entry.method || '',
                entry.url || '',
                entry.responseStatus || '',
                entry.responseTime || '',
                entry.error ? entry.error.message : ''
            ];
            
            csvRows.push(row.map(field => `"${field}"`).join(','));
        }
        
        return csvRows.join('\n');
    }
}
```

---

**This documentation provides a comprehensive overview of the Discord bot's API integration architecture.** For specific implementation details or troubleshooting, refer to the individual service documentation or contact the development team.