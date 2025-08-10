const logger = require('../utils/logger');

class PermissionManager {
    constructor(botService) {
        this.botService = botService;
        this.permissionCache = new Map();
        this.cacheTimeout = 300000; // 5 minutes
        
        // Default permission configurations
        this.defaultPermissions = {
            'naffles-create-task': {
                requiredRoles: [], // Empty means any member can use
                requiredPermissions: ['SendMessages'],
                adminOnly: false,
                cooldown: 10000,
                maxUsesPerHour: 10
            },
            'naffles-list-tasks': {
                requiredRoles: [],
                requiredPermissions: ['SendMessages'],
                adminOnly: false,
                cooldown: 5000,
                maxUsesPerHour: 20
            },
            'naffles-connect-allowlist': {
                requiredRoles: [],
                requiredPermissions: ['ManageMessages'],
                adminOnly: true,
                cooldown: 15000,
                maxUsesPerHour: 5
            },
            'naffles-link-community': {
                requiredRoles: [],
                requiredPermissions: ['Administrator'],
                adminOnly: true,
                cooldown: 30000,
                maxUsesPerHour: 2
            },
            'naffles-status': {
                requiredRoles: [],
                requiredPermissions: ['SendMessages'],
                adminOnly: false,
                cooldown: 5000,
                maxUsesPerHour: 30
            },
            'naffles-help': {
                requiredRoles: [],
                requiredPermissions: [],
                adminOnly: false,
                cooldown: 2000,
                maxUsesPerHour: 50
            },
            'naffles-security': {
                requiredRoles: [],
                requiredPermissions: ['Administrator'],
                adminOnly: true,
                cooldown: 30000,
                maxUsesPerHour: 10
            }
        };
        
        // Server-specific permission overrides
        this.serverPermissions = new Map();
        
        // Start cache cleanup
        this.startCacheCleanup();
    }

    /**
     * Check if user has permission to execute a command
     * @param {Object} interaction - Discord interaction
     * @param {string} commandName - Command name
     * @returns {Object} Permission check result
     */
    async checkCommandPermission(interaction, commandName) {
        try {
            const guildId = interaction.guildId;
            const userId = interaction.user.id;
            const member = interaction.member;
            
            if (!guildId || !member) {
                return {
                    allowed: false,
                    reason: 'Command can only be used in servers',
                    severity: 'low'
                };
            }

            // Get permission configuration
            const permConfig = await this.getPermissionConfig(guildId, commandName);
            
            // Check if user is bot (anti-bot measure)
            if (interaction.user.bot) {
                logger.security('Bot attempted to use command', {
                    userId,
                    guildId,
                    commandName,
                    botTag: interaction.user.tag
                });
                
                return {
                    allowed: false,
                    reason: 'Bots cannot use commands',
                    severity: 'medium'
                };
            }

            // Check account age (anti-abuse measure)
            const accountAge = Date.now() - interaction.user.createdTimestamp;
            const minAccountAge = 7 * 24 * 60 * 60 * 1000; // 7 days
            
            if (accountAge < minAccountAge) {
                logger.security('New account attempted command', {
                    userId,
                    guildId,
                    commandName,
                    accountAge: Math.floor(accountAge / (24 * 60 * 60 * 1000)),
                    userTag: interaction.user.tag
                });
                
                return {
                    allowed: false,
                    reason: 'Account must be at least 7 days old to use commands',
                    severity: 'medium'
                };
            }

            // Check if admin-only command
            if (permConfig.adminOnly) {
                const isAdmin = await this.checkAdminPermission(member, guildId);
                if (!isAdmin.allowed) {
                    logger.security('Non-admin attempted admin command', {
                        userId,
                        guildId,
                        commandName,
                        userTag: interaction.user.tag
                    });
                    
                    return {
                        allowed: false,
                        reason: 'This command requires administrator permissions',
                        severity: 'medium'
                    };
                }
            }

            // Check required Discord permissions
            if (permConfig.requiredPermissions.length > 0) {
                const hasPermissions = await this.checkDiscordPermissions(
                    member, 
                    permConfig.requiredPermissions
                );
                
                if (!hasPermissions.allowed) {
                    return {
                        allowed: false,
                        reason: `Missing required permissions: ${hasPermissions.missing.join(', ')}`,
                        severity: 'low'
                    };
                }
            }

            // Check required roles
            if (permConfig.requiredRoles.length > 0) {
                const hasRoles = await this.checkRequiredRoles(
                    member, 
                    permConfig.requiredRoles
                );
                
                if (!hasRoles.allowed) {
                    return {
                        allowed: false,
                        reason: `Missing required roles: ${hasRoles.missing.join(', ')}`,
                        severity: 'low'
                    };
                }
            }

            // Check usage limits
            const usageCheck = await this.checkUsageLimits(userId, guildId, commandName, permConfig);
            if (!usageCheck.allowed) {
                return usageCheck;
            }

            // All checks passed
            return {
                allowed: true,
                reason: 'Permission granted',
                severity: 'none'
            };

        } catch (error) {
            logger.error('Permission check failed:', error);
            
            // On error, deny permission for security
            return {
                allowed: false,
                reason: 'Permission check failed',
                severity: 'high'
            };
        }
    }

    /**
     * Check if user has admin permissions
     * @param {Object} member - Discord member
     * @param {string} guildId - Guild ID
     * @returns {Object} Admin check result
     */
    async checkAdminPermission(member, guildId) {
        try {
            // Check if user is guild owner
            if (member.guild.ownerId === member.user.id) {
                return { allowed: true, reason: 'Guild owner' };
            }

            // Check if user has Administrator permission
            if (member.permissions.has('Administrator')) {
                return { allowed: true, reason: 'Administrator permission' };
            }

            // Check if user has ManageGuild permission (alternative admin check)
            if (member.permissions.has('ManageGuild')) {
                return { allowed: true, reason: 'Manage guild permission' };
            }

            // Check server-specific admin roles
            const serverConfig = this.serverPermissions.get(guildId);
            if (serverConfig && serverConfig.adminRoles) {
                const hasAdminRole = member.roles.cache.some(role => 
                    serverConfig.adminRoles.includes(role.id)
                );
                
                if (hasAdminRole) {
                    return { allowed: true, reason: 'Admin role' };
                }
            }

            return { allowed: false, reason: 'Not an administrator' };

        } catch (error) {
            logger.error('Admin permission check failed:', error);
            return { allowed: false, reason: 'Admin check failed' };
        }
    }

    /**
     * Check Discord permissions
     * @param {Object} member - Discord member
     * @param {Array} requiredPermissions - Required permissions
     * @returns {Object} Permission check result
     */
    async checkDiscordPermissions(member, requiredPermissions) {
        try {
            const missing = [];
            
            for (const permission of requiredPermissions) {
                if (!member.permissions.has(permission)) {
                    missing.push(permission);
                }
            }
            
            return {
                allowed: missing.length === 0,
                missing,
                reason: missing.length === 0 ? 'All permissions present' : `Missing: ${missing.join(', ')}`
            };

        } catch (error) {
            logger.error('Discord permission check failed:', error);
            return {
                allowed: false,
                missing: requiredPermissions,
                reason: 'Permission check failed'
            };
        }
    }

    /**
     * Check required roles
     * @param {Object} member - Discord member
     * @param {Array} requiredRoles - Required role IDs or names
     * @returns {Object} Role check result
     */
    async checkRequiredRoles(member, requiredRoles) {
        try {
            const missing = [];
            const memberRoles = member.roles.cache;
            
            for (const roleIdentifier of requiredRoles) {
                const hasRole = memberRoles.some(role => 
                    role.id === roleIdentifier || 
                    role.name.toLowerCase() === roleIdentifier.toLowerCase()
                );
                
                if (!hasRole) {
                    missing.push(roleIdentifier);
                }
            }
            
            return {
                allowed: missing.length === 0,
                missing,
                reason: missing.length === 0 ? 'All roles present' : `Missing: ${missing.join(', ')}`
            };

        } catch (error) {
            logger.error('Role check failed:', error);
            return {
                allowed: false,
                missing: requiredRoles,
                reason: 'Role check failed'
            };
        }
    }

    /**
     * Check usage limits for command
     * @param {string} userId - User ID
     * @param {string} guildId - Guild ID
     * @param {string} commandName - Command name
     * @param {Object} permConfig - Permission configuration
     * @returns {Object} Usage limit check result
     */
    async checkUsageLimits(userId, guildId, commandName, permConfig) {
        try {
            const key = `usage_${userId}_${guildId}_${commandName}`;
            const now = Date.now();
            const hourWindow = 60 * 60 * 1000; // 1 hour
            
            // Get usage data from cache
            let usageData = this.permissionCache.get(key);
            if (!usageData) {
                usageData = {
                    uses: [],
                    createdAt: now
                };
            }
            
            // Filter to last hour
            usageData.uses = usageData.uses.filter(timestamp => 
                now - timestamp < hourWindow
            );
            
            // Check if limit exceeded
            if (usageData.uses.length >= permConfig.maxUsesPerHour) {
                logger.security('Command usage limit exceeded', {
                    userId,
                    guildId,
                    commandName,
                    uses: usageData.uses.length,
                    limit: permConfig.maxUsesPerHour
                });
                
                return {
                    allowed: false,
                    reason: `Command usage limit exceeded (${permConfig.maxUsesPerHour} per hour)`,
                    severity: 'medium'
                };
            }
            
            // Add current use
            usageData.uses.push(now);
            usageData.lastUsed = now;
            
            // Update cache
            this.permissionCache.set(key, usageData);
            
            return {
                allowed: true,
                remaining: permConfig.maxUsesPerHour - usageData.uses.length,
                reason: 'Usage limit check passed'
            };

        } catch (error) {
            logger.error('Usage limit check failed:', error);
            return {
                allowed: true, // Allow on error to prevent blocking legitimate users
                reason: 'Usage limit check failed'
            };
        }
    }

    /**
     * Get permission configuration for command
     * @param {string} guildId - Guild ID
     * @param {string} commandName - Command name
     * @returns {Object} Permission configuration
     */
    async getPermissionConfig(guildId, commandName) {
        try {
            // Get server-specific overrides
            const serverConfig = this.serverPermissions.get(guildId);
            const serverOverride = serverConfig?.commands?.[commandName];
            
            // Merge with defaults
            const defaultConfig = this.defaultPermissions[commandName] || this.defaultPermissions['naffles-help'];
            
            return {
                ...defaultConfig,
                ...serverOverride
            };

        } catch (error) {
            logger.error('Failed to get permission config:', error);
            return this.defaultPermissions['naffles-help']; // Safest default
        }
    }

    /**
     * Update server permission configuration
     * @param {string} guildId - Guild ID
     * @param {Object} config - Permission configuration
     */
    async updateServerPermissions(guildId, config) {
        try {
            this.serverPermissions.set(guildId, {
                ...this.serverPermissions.get(guildId),
                ...config,
                updatedAt: new Date()
            });
            
            logger.info('Server permissions updated', { guildId, config });
            
            // Clear related cache entries
            this.clearServerCache(guildId);

        } catch (error) {
            logger.error('Failed to update server permissions:', error);
        }
    }

    /**
     * Get server permission configuration
     * @param {string} guildId - Guild ID
     * @returns {Object} Server permission configuration
     */
    getServerPermissions(guildId) {
        return this.serverPermissions.get(guildId) || {};
    }

    /**
     * Reset server permissions to defaults
     * @param {string} guildId - Guild ID
     */
    async resetServerPermissions(guildId) {
        try {
            this.serverPermissions.delete(guildId);
            this.clearServerCache(guildId);
            
            logger.info('Server permissions reset to defaults', { guildId });

        } catch (error) {
            logger.error('Failed to reset server permissions:', error);
        }
    }

    /**
     * Clear cache entries for a server
     * @param {string} guildId - Guild ID
     */
    clearServerCache(guildId) {
        try {
            const keysToDelete = [];
            
            for (const key of this.permissionCache.keys()) {
                if (key.includes(`_${guildId}_`)) {
                    keysToDelete.push(key);
                }
            }
            
            keysToDelete.forEach(key => this.permissionCache.delete(key));
            
            logger.info('Server cache cleared', { guildId, clearedEntries: keysToDelete.length });

        } catch (error) {
            logger.error('Failed to clear server cache:', error);
        }
    }

    /**
     * Get permission statistics
     * @returns {Object} Permission statistics
     */
    getPermissionStatistics() {
        try {
            const stats = {
                cacheSize: this.permissionCache.size,
                serverConfigs: this.serverPermissions.size,
                defaultCommands: Object.keys(this.defaultPermissions).length,
                recentActivity: 0
            };
            
            // Count recent activity (last hour)
            const hourAgo = Date.now() - (60 * 60 * 1000);
            for (const [key, data] of this.permissionCache.entries()) {
                if (data.lastUsed && data.lastUsed > hourAgo) {
                    stats.recentActivity++;
                }
            }
            
            return stats;

        } catch (error) {
            logger.error('Failed to get permission statistics:', error);
            return {
                cacheSize: 0,
                serverConfigs: 0,
                defaultCommands: 0,
                recentActivity: 0
            };
        }
    }

    /**
     * Start cache cleanup interval
     */
    startCacheCleanup() {
        setInterval(() => {
            this.cleanupCache();
        }, this.cacheTimeout);
        
        logger.info('Permission cache cleanup started');
    }

    /**
     * Clean up expired cache entries
     */
    cleanupCache() {
        try {
            const now = Date.now();
            const keysToDelete = [];
            
            for (const [key, data] of this.permissionCache.entries()) {
                // Remove entries older than cache timeout
                if (data.createdAt && now - data.createdAt > this.cacheTimeout) {
                    keysToDelete.push(key);
                }
                
                // Clean up usage arrays
                if (data.uses) {
                    const hourAgo = now - (60 * 60 * 1000);
                    data.uses = data.uses.filter(timestamp => timestamp > hourAgo);
                    
                    // Remove if no recent uses
                    if (data.uses.length === 0 && (!data.lastUsed || now - data.lastUsed > this.cacheTimeout)) {
                        keysToDelete.push(key);
                    }
                }
            }
            
            keysToDelete.forEach(key => this.permissionCache.delete(key));
            
            if (keysToDelete.length > 0) {
                logger.info('Permission cache cleanup completed', {
                    cleanedEntries: keysToDelete.length,
                    remainingEntries: this.permissionCache.size
                });
            }

        } catch (error) {
            logger.error('Permission cache cleanup failed:', error);
        }
    }

    /**
     * Clear all permission data
     */
    clear() {
        const cacheSize = this.permissionCache.size;
        const serverSize = this.serverPermissions.size;
        
        this.permissionCache.clear();
        this.serverPermissions.clear();
        
        logger.info('Permission manager cleared', {
            clearedCacheEntries: cacheSize,
            clearedServerConfigs: serverSize
        });
    }
}

module.exports = PermissionManager;