/**
 * Mock Discord Client for Testing
 * Provides comprehensive Discord.js mocking without actual Discord API calls
 */

const { EventEmitter } = require('events');

class MockDiscordClient extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = options;
        this.token = null;
        this.readyTimestamp = null;
        this.user = null;
        this.application = null;
        this.ws = new MockWebSocketManager();
        
        // Initialize collections
        this.guilds = new MockGuildManager(this);
        this.channels = new MockChannelManager(this);
        this.users = new MockUserManager(this);
        
        // State tracking
        this._ready = false;
        this._destroyed = false;
        this.uptime = 0;
        
        // Mock data storage
        this._mockData = {
            guilds: new Map(),
            channels: new Map(),
            users: new Map(),
            messages: new Map(),
            interactions: []
        };
        
        // Start uptime counter
        this._startTime = Date.now();
        this._uptimeInterval = setInterval(() => {
            this.uptime = Date.now() - this._startTime;
        }, 1000);
    }

    // Client lifecycle methods
    async login(token) {
        if (this._destroyed) {
            throw new Error('Client is destroyed');
        }
        
        this.token = token;
        
        // Simulate login delay
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Set up mock user
        this.user = new MockClientUser({
            id: 'mock-bot-123',
            username: 'MockBot',
            discriminator: '0000',
            bot: true
        });
        
        this.readyTimestamp = Date.now();
        this._ready = true;
        
        // Emit ready event
        process.nextTick(() => {
            this.emit('ready');
        });
        
        return token;
    }

    async destroy() {
        if (this._destroyed) return;
        
        this._destroyed = true;
        this._ready = false;
        
        if (this._uptimeInterval) {
            clearInterval(this._uptimeInterval);
        }
        
        this.removeAllListeners();
        
        // Clear all collections
        this.guilds.cache.clear();
        this.channels.cache.clear();
        this.users.cache.clear();
        
        this.emit('disconnect');
    }

    isReady() {
        return this._ready && !this._destroyed;
    }

    // Mock data management
    addMockGuild(guildData) {
        const guild = new MockGuild(this, guildData);
        this._mockData.guilds.set(guild.id, guild);
        this.guilds.cache.set(guild.id, guild);
        return guild;
    }

    addMockChannel(channelData) {
        const channel = new MockTextChannel(this, channelData);
        this._mockData.channels.set(channel.id, channel);
        this.channels.cache.set(channel.id, channel);
        
        // Add to guild if specified
        if (channelData.guildId && this._mockData.guilds.has(channelData.guildId)) {
            const guild = this._mockData.guilds.get(channelData.guildId);
            guild.channels.cache.set(channel.id, channel);
        }
        
        return channel;
    }

    addMockUser(userData) {
        const user = new MockUser(this, userData);
        this._mockData.users.set(user.id, user);
        this.users.cache.set(user.id, user);
        return user;
    }

    // Simulate Discord events
    simulateGuildCreate(guildData) {
        const guild = this.addMockGuild(guildData);
        this.emit('guildCreate', guild);
        return guild;
    }

    simulateGuildDelete(guildId) {
        const guild = this._mockData.guilds.get(guildId);
        if (guild) {
            this._mockData.guilds.delete(guildId);
            this.guilds.cache.delete(guildId);
            this.emit('guildDelete', guild);
        }
        return guild;
    }

    simulateInteractionCreate(interactionData) {
        const interaction = new MockInteraction(this, interactionData);
        this._mockData.interactions.push(interaction);
        this.emit('interactionCreate', interaction);
        return interaction;
    }

    simulateMemberJoin(guildId, memberData) {
        const guild = this._mockData.guilds.get(guildId);
        if (guild) {
            const member = new MockGuildMember(guild, memberData);
            guild.members.cache.set(member.id, member);
            this.emit('guildMemberAdd', member);
            return member;
        }
        return null;
    }

    simulateMemberLeave(guildId, memberId) {
        const guild = this._mockData.guilds.get(guildId);
        if (guild) {
            const member = guild.members.cache.get(memberId);
            if (member) {
                guild.members.cache.delete(memberId);
                this.emit('guildMemberRemove', member);
                return member;
            }
        }
        return null;
    }

    // Utility methods for testing
    getStats() {
        return {
            guilds: this.guilds.cache.size,
            channels: this.channels.cache.size,
            users: this.users.cache.size,
            uptime: this.uptime,
            ready: this._ready,
            destroyed: this._destroyed
        };
    }

    reset() {
        // Clear all mock data
        this._mockData.guilds.clear();
        this._mockData.channels.clear();
        this._mockData.users.clear();
        this._mockData.messages.clear();
        this._mockData.interactions = [];
        
        // Clear collections
        this.guilds.cache.clear();
        this.channels.cache.clear();
        this.users.cache.clear();
        
        // Reset state
        this._ready = false;
        this._destroyed = false;
        this.token = null;
        this.user = null;
        this.readyTimestamp = null;
        this.uptime = 0;
        this._startTime = Date.now();
    }
}

class MockWebSocketManager {
    constructor() {
        this.ping = 50; // Mock ping
        this.status = 0; // READY
    }
}

class MockGuildManager {
    constructor(client) {
        this.client = client;
        this.cache = new Map();
    }

    async fetch(guildId, options = {}) {
        if (this.cache.has(guildId)) {
            return this.cache.get(guildId);
        }
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Return null if not found (simulate Discord behavior)
        return null;
    }

    resolve(guild) {
        if (typeof guild === 'string') {
            return this.cache.get(guild);
        }
        return guild;
    }
}

class MockChannelManager {
    constructor(client) {
        this.client = client;
        this.cache = new Map();
    }

    async fetch(channelId, options = {}) {
        if (this.cache.has(channelId)) {
            return this.cache.get(channelId);
        }
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 50));
        
        return null;
    }

    resolve(channel) {
        if (typeof channel === 'string') {
            return this.cache.get(channel);
        }
        return channel;
    }
}

class MockUserManager {
    constructor(client) {
        this.client = client;
        this.cache = new Map();
    }

    async fetch(userId, options = {}) {
        if (this.cache.has(userId)) {
            return this.cache.get(userId);
        }
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 50));
        
        return null;
    }

    resolve(user) {
        if (typeof user === 'string') {
            return this.cache.get(user);
        }
        return user;
    }
}

class MockGuild {
    constructor(client, data = {}) {
        this.client = client;
        this.id = data.id || 'mock-guild-123';
        this.name = data.name || 'Mock Guild';
        this.description = data.description || null;
        this.icon = data.icon || null;
        this.banner = data.banner || null;
        this.ownerId = data.ownerId || 'mock-owner-123';
        this.memberCount = data.memberCount || 100;
        this.large = data.large || false;
        this.premiumTier = data.premiumTier || 0;
        this.systemChannelId = data.systemChannelId || null;
        this.joinedTimestamp = data.joinedTimestamp || Date.now();
        
        // Initialize managers
        this.channels = new MockGuildChannelManager(this);
        this.members = new MockGuildMemberManager(this);
        this.roles = new MockRoleManager(this);
        
        // Add default channels
        if (data.channels) {
            data.channels.forEach(channelData => {
                const channel = new MockTextChannel(client, { ...channelData, guildId: this.id });
                this.channels.cache.set(channel.id, channel);
            });
        }
        
        // Add default members
        if (data.members) {
            data.members.forEach(memberData => {
                const member = new MockGuildMember(this, memberData);
                this.members.cache.set(member.id, member);
            });
        }
    }

    async fetchOwner() {
        const owner = this.members.cache.get(this.ownerId);
        if (owner) return owner;
        
        // Create mock owner if not exists
        const mockOwner = new MockGuildMember(this, {
            user: { id: this.ownerId, username: 'GuildOwner', discriminator: '0001' }
        });
        this.members.cache.set(this.ownerId, mockOwner);
        return mockOwner;
    }

    toString() {
        return this.name;
    }
}

class MockTextChannel {
    constructor(client, data = {}) {
        this.client = client;
        this.id = data.id || 'mock-channel-123';
        this.name = data.name || 'general';
        this.type = data.type || 0; // GUILD_TEXT
        this.guildId = data.guildId || null;
        this.position = data.position || 0;
        this.topic = data.topic || null;
        this.nsfw = data.nsfw || false;
        this.rateLimitPerUser = data.rateLimitPerUser || 0;
        this.parentId = data.parentId || null;
        
        // Message storage
        this.messages = new MockMessageManager(this);
        
        // Permissions
        this.permissionOverwrites = new Map();
    }

    async send(options) {
        // Handle both string and object options
        const messageData = typeof options === 'string' 
            ? { content: options }
            : options;
        
        const message = new MockMessage(this, {
            ...messageData,
            id: `mock-message-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            author: this.client.user,
            timestamp: new Date()
        });
        
        this.messages.cache.set(message.id, message);
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 50));
        
        return message;
    }

    toString() {
        return `#${this.name}`;
    }
}

class MockUser {
    constructor(client, data = {}) {
        this.client = client;
        this.id = data.id || 'mock-user-123';
        this.username = data.username || 'MockUser';
        this.discriminator = data.discriminator || '0000';
        this.avatar = data.avatar || null;
        this.bot = data.bot || false;
        this.system = data.system || false;
        this.flags = data.flags || 0;
        this.createdTimestamp = data.createdTimestamp || Date.now() - (30 * 24 * 60 * 60 * 1000);
    }

    get tag() {
        return `${this.username}#${this.discriminator}`;
    }

    get createdAt() {
        return new Date(this.createdTimestamp);
    }

    async createDM() {
        return new MockDMChannel(this.client, { recipient: this });
    }

    toString() {
        return `<@${this.id}>`;
    }
}

class MockClientUser extends MockUser {
    constructor(data = {}) {
        super(null, data);
        this.verified = data.verified || true;
        this.mfaEnabled = data.mfaEnabled || false;
    }
}

class MockGuildMember {
    constructor(guild, data = {}) {
        this.guild = guild;
        this.client = guild.client;
        
        // User data
        if (data.user) {
            this.user = new MockUser(this.client, data.user);
            this.id = this.user.id;
        } else {
            this.id = data.id || 'mock-member-123';
            this.user = new MockUser(this.client, { id: this.id });
        }
        
        this.nickname = data.nickname || null;
        this.joinedTimestamp = data.joinedTimestamp || Date.now() - (10 * 24 * 60 * 60 * 1000);
        this.premiumSinceTimestamp = data.premiumSinceTimestamp || null;
        this.deaf = data.deaf || false;
        this.mute = data.mute || false;
        this.pending = data.pending || false;
        
        // Roles and permissions
        this.roles = new MockGuildMemberRoleManager(this, data.roles || []);
        this.permissions = new MockPermissions(data.permissions || ['SendMessages', 'ViewChannel']);
    }

    get joinedAt() {
        return new Date(this.joinedTimestamp);
    }

    get displayName() {
        return this.nickname || this.user.username;
    }

    async createDM() {
        return this.user.createDM();
    }

    toString() {
        return `<@${this.id}>`;
    }
}

class MockMessage {
    constructor(channel, data = {}) {
        this.channel = channel;
        this.client = channel.client;
        this.id = data.id || 'mock-message-123';
        this.content = data.content || '';
        this.author = data.author || channel.client.user;
        this.timestamp = data.timestamp || new Date();
        this.editedTimestamp = data.editedTimestamp || null;
        this.tts = data.tts || false;
        this.mentionEveryone = data.mentionEveryone || false;
        this.embeds = data.embeds || [];
        this.attachments = new Map();
        this.reactions = new Map();
        this.pinned = data.pinned || false;
        this.type = data.type || 0; // DEFAULT
        this.components = data.components || [];
    }

    async edit(options) {
        // Handle both string and object options
        const editData = typeof options === 'string' 
            ? { content: options }
            : options;
        
        if (editData.content !== undefined) {
            this.content = editData.content;
        }
        if (editData.embeds !== undefined) {
            this.embeds = editData.embeds;
        }
        if (editData.components !== undefined) {
            this.components = editData.components;
        }
        
        this.editedTimestamp = new Date();
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 50));
        
        return this;
    }

    async delete() {
        this.channel.messages.cache.delete(this.id);
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 50));
        
        return this;
    }

    toString() {
        return this.content;
    }
}

class MockInteraction {
    constructor(client, data = {}) {
        this.client = client;
        this.id = data.id || 'mock-interaction-123';
        this.type = data.type || 2; // APPLICATION_COMMAND
        this.token = data.token || 'mock-token';
        this.version = data.version || 1;
        this.applicationId = data.applicationId || client.user?.id;
        
        // Command data
        this.commandName = data.commandName || 'test-command';
        this.commandType = data.commandType || 1; // CHAT_INPUT
        this.commandId = data.commandId || 'mock-command-123';
        
        // Context
        this.guildId = data.guildId || null;
        this.channelId = data.channelId || null;
        this.user = data.user || new MockUser(client, { id: 'mock-user-123' });
        this.member = data.member || null;
        
        // Options and components
        this.options = new MockCommandInteractionOptionResolver(data.options || {});
        this.customId = data.customId || null;
        
        // Response state
        this._replied = false;
        this._deferred = false;
        this._followedUp = false;
        
        // Mock response methods
        this.reply = jest.fn().mockImplementation(async (options) => {
            this._replied = true;
            await new Promise(resolve => setTimeout(resolve, 50));
            return new MockInteractionResponse(options);
        });
        
        this.deferReply = jest.fn().mockImplementation(async (options = {}) => {
            this._deferred = true;
            await new Promise(resolve => setTimeout(resolve, 50));
            return new MockInteractionResponse({ ephemeral: options.ephemeral });
        });
        
        this.editReply = jest.fn().mockImplementation(async (options) => {
            if (!this._replied && !this._deferred) {
                throw new Error('Cannot edit a reply that has not been sent');
            }
            await new Promise(resolve => setTimeout(resolve, 50));
            return new MockInteractionResponse(options);
        });
        
        this.followUp = jest.fn().mockImplementation(async (options) => {
            if (!this._replied && !this._deferred) {
                throw new Error('Cannot follow up on an interaction that has not been replied to');
            }
            this._followedUp = true;
            await new Promise(resolve => setTimeout(resolve, 50));
            return new MockInteractionResponse(options);
        });
        
        this.deleteReply = jest.fn().mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
        });
    }

    isCommand() {
        return this.type === 2; // APPLICATION_COMMAND
    }

    isButton() {
        return this.type === 3 && this.customId; // MESSAGE_COMPONENT
    }

    isSelectMenu() {
        return this.type === 3 && !this.customId; // MESSAGE_COMPONENT
    }

    isModalSubmit() {
        return this.type === 5; // MODAL_SUBMIT
    }

    get replied() {
        return this._replied;
    }

    get deferred() {
        return this._deferred;
    }
}

class MockCommandInteractionOptionResolver {
    constructor(options = {}) {
        this._options = options;
    }

    getString(name, required = false) {
        const value = this._options[name];
        if (required && value === undefined) {
            throw new Error(`Required option "${name}" not provided`);
        }
        return typeof value === 'string' ? value : null;
    }

    getInteger(name, required = false) {
        const value = this._options[name];
        if (required && value === undefined) {
            throw new Error(`Required option "${name}" not provided`);
        }
        return typeof value === 'number' && Number.isInteger(value) ? value : null;
    }

    getNumber(name, required = false) {
        const value = this._options[name];
        if (required && value === undefined) {
            throw new Error(`Required option "${name}" not provided`);
        }
        return typeof value === 'number' ? value : null;
    }

    getBoolean(name, required = false) {
        const value = this._options[name];
        if (required && value === undefined) {
            throw new Error(`Required option "${name}" not provided`);
        }
        return typeof value === 'boolean' ? value : null;
    }

    getUser(name, required = false) {
        const value = this._options[name];
        if (required && value === undefined) {
            throw new Error(`Required option "${name}" not provided`);
        }
        return value instanceof MockUser ? value : null;
    }

    getChannel(name, required = false) {
        const value = this._options[name];
        if (required && value === undefined) {
            throw new Error(`Required option "${name}" not provided`);
        }
        return value instanceof MockTextChannel ? value : null;
    }
}

class MockInteractionResponse {
    constructor(data = {}) {
        this.content = data.content || null;
        this.embeds = data.embeds || [];
        this.components = data.components || [];
        this.ephemeral = data.ephemeral || false;
        this.tts = data.tts || false;
        this.allowedMentions = data.allowedMentions || null;
    }
}

// Additional mock classes for completeness
class MockGuildChannelManager {
    constructor(guild) {
        this.guild = guild;
        this.cache = new Map();
    }

    async create(options) {
        const channel = new MockTextChannel(this.guild.client, {
            ...options,
            guildId: this.guild.id,
            id: `mock-channel-${Date.now()}`
        });
        this.cache.set(channel.id, channel);
        return channel;
    }
}

class MockGuildMemberManager {
    constructor(guild) {
        this.guild = guild;
        this.cache = new Map();
    }

    async fetch(userId) {
        if (this.cache.has(userId)) {
            return this.cache.get(userId);
        }
        return null;
    }
}

class MockRoleManager {
    constructor(guild) {
        this.guild = guild;
        this.cache = new Map();
        
        // Add @everyone role
        const everyoneRole = new MockRole(guild, {
            id: guild.id,
            name: '@everyone',
            permissions: ['ViewChannel', 'SendMessages']
        });
        this.cache.set(guild.id, everyoneRole);
    }
}

class MockRole {
    constructor(guild, data = {}) {
        this.guild = guild;
        this.id = data.id || 'mock-role-123';
        this.name = data.name || 'Mock Role';
        this.color = data.color || 0;
        this.hoist = data.hoist || false;
        this.position = data.position || 0;
        this.permissions = new MockPermissions(data.permissions || []);
        this.managed = data.managed || false;
        this.mentionable = data.mentionable || false;
    }
}

class MockGuildMemberRoleManager {
    constructor(member, roleIds = []) {
        this.member = member;
        this.cache = new Map();
        
        // Add roles from IDs
        roleIds.forEach(roleId => {
            const role = member.guild.roles.cache.get(roleId);
            if (role) {
                this.cache.set(roleId, role);
            }
        });
        
        // Always include @everyone role
        const everyoneRole = member.guild.roles.cache.get(member.guild.id);
        if (everyoneRole) {
            this.cache.set(member.guild.id, everyoneRole);
        }
    }

    has(roleId) {
        return this.cache.has(roleId);
    }
}

class MockPermissions {
    constructor(permissions = []) {
        this._permissions = new Set(permissions);
    }

    has(permission) {
        if (Array.isArray(permission)) {
            return permission.every(p => this._permissions.has(p));
        }
        return this._permissions.has(permission);
    }

    toArray() {
        return Array.from(this._permissions);
    }
}

class MockMessageManager {
    constructor(channel) {
        this.channel = channel;
        this.cache = new Map();
    }

    async fetch(messageId) {
        if (this.cache.has(messageId)) {
            return this.cache.get(messageId);
        }
        return null;
    }
}

class MockDMChannel {
    constructor(client, data = {}) {
        this.client = client;
        this.id = data.id || 'mock-dm-123';
        this.type = 1; // DM
        this.recipient = data.recipient;
        this.messages = new MockMessageManager(this);
    }

    async send(options) {
        const messageData = typeof options === 'string' 
            ? { content: options }
            : options;
        
        const message = new MockMessage(this, {
            ...messageData,
            id: `mock-dm-message-${Date.now()}`,
            author: this.client.user,
            timestamp: new Date()
        });
        
        this.messages.cache.set(message.id, message);
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        return message;
    }
}

module.exports = {
    MockDiscordClient,
    MockGuild,
    MockTextChannel,
    MockUser,
    MockGuildMember,
    MockMessage,
    MockInteraction,
    MockRole,
    MockPermissions
};