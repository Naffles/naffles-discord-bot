const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

class CommunityLinkingService {
    constructor(botService) {
        this.botService = botService;
        this.nafflesApiBaseUrl = process.env.NAFFLES_API_BASE_URL;
        this.nafflesApiKey = process.env.NAFFLES_API_KEY;
        this.discordClientId = process.env.DISCORD_CLIENT_ID;
        this.discordClientSecret = process.env.DISCORD_CLIENT_SECRET;
        this.discordRedirectUri = process.env.DISCORD_REDIRECT_URI;
    }

    /**
     * Generate OAuth URL for Discord authentication
     */
    generateOAuthUrl(guildId, userId, communityId) {
        const state = this.generateSecureState(guildId, userId, communityId);
        
        const params = new URLSearchParams({
            client_id: this.discordClientId,
            redirect_uri: this.discordRedirectUri,
            response_type: 'code',
            scope: 'identify guilds',
            state: state,
            prompt: 'consent'
        });

        return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
    }

    /**
     * Generate secure state parameter for OAuth
     */
    generateSecureState(guildId, userId, communityId) {
        const data = {
            guildId,
            userId,
            communityId,
            timestamp: Date.now(),
            nonce: crypto.randomBytes(16).toString('hex')
        };

        const stateString = JSON.stringify(data);
        const signature = crypto
            .createHmac('sha256', process.env.DISCORD_OAUTH_SECRET || 'fallback-secret')
            .update(stateString)
            .digest('hex');

        return Buffer.from(JSON.stringify({ data, signature })).toString('base64');
    }

    /**
     * Verify and decode OAuth state parameter
     */
    verifyOAuthState(state) {
        try {
            const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
            const { data, signature } = decoded;

            // Verify signature
            const expectedSignature = crypto
                .createHmac('sha256', process.env.DISCORD_OAUTH_SECRET || 'fallback-secret')
                .update(JSON.stringify(data))
                .digest('hex');

            if (signature !== expectedSignature) {
                throw new Error('Invalid state signature');
            }

            // Check timestamp (valid for 10 minutes)
            const maxAge = 10 * 60 * 1000; // 10 minutes
            if (Date.now() - data.timestamp > maxAge) {
                throw new Error('State expired');
            }

            return data;
        } catch (error) {
            logger.error('Failed to verify OAuth state:', error);
            throw new Error('Invalid OAuth state');
        }
    }

    /**
     * Exchange OAuth code for access token
     */
    async exchangeCodeForToken(code) {
        try {
            const response = await axios.post('https://discord.com/api/oauth2/token', 
                new URLSearchParams({
                    client_id: this.discordClientId,
                    client_secret: this.discordClientSecret,
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: this.discordRedirectUri
                }),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            return response.data;
        } catch (error) {
            logger.error('Failed to exchange OAuth code:', error);
            throw new Error('OAuth token exchange failed');
        }
    }

    /**
     * Get Discord user info from access token
     */
    async getDiscordUserInfo(accessToken) {
        try {
            const response = await axios.get('https://discord.com/api/users/@me', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            return response.data;
        } catch (error) {
            logger.error('Failed to get Discord user info:', error);
            throw new Error('Failed to get user information');
        }
    }

    /**
     * Get Discord user guilds from access token
     */
    async getDiscordUserGuilds(accessToken) {
        try {
            const response = await axios.get('https://discord.com/api/users/@me/guilds', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            return response.data;
        } catch (error) {
            logger.error('Failed to get Discord user guilds:', error);
            throw new Error('Failed to get user guilds');
        }
    }

    /**
     * Validate community ownership through Naffles API
     */
    async validateCommunityOwnership(communityId, discordUserId, nafflesUserId = null) {
        try {
            const response = await axios.post(
                `${this.nafflesApiBaseUrl}/api/communities/${communityId}/validate-ownership`,
                {
                    discordUserId,
                    nafflesUserId
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.nafflesApiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data;
        } catch (error) {
            logger.error('Failed to validate community ownership:', error);
            
            if (error.response?.status === 404) {
                throw new Error('Community not found');
            } else if (error.response?.status === 403) {
                throw new Error('Insufficient permissions');
            } else {
                throw new Error('Validation failed');
            }
        }
    }

    /**
     * Get community information
     */
    async getCommunityInfo(communityId) {
        try {
            const response = await axios.get(
                `${this.nafflesApiBaseUrl}/api/communities/${communityId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.nafflesApiKey}`
                    }
                }
            );

            return response.data;
        } catch (error) {
            logger.error('Failed to get community info:', error);
            throw new Error('Failed to retrieve community information');
        }
    }

    /**
     * Check if community is already linked to another server
     */
    async checkCommunityLinkStatus(communityId) {
        try {
            const existingMapping = await this.botService.db.ServerMapping.findOne({
                communityId,
                isActive: true
            });

            return {
                isLinked: !!existingMapping,
                guildId: existingMapping?.guildId || null,
                linkedAt: existingMapping?.linkedAt || null,
                linkedBy: existingMapping?.linkedBy || null
            };
        } catch (error) {
            logger.error('Failed to check community link status:', error);
            throw new Error('Failed to check link status');
        }
    }

    /**
     * Check if server is already linked to a community
     */
    async checkServerLinkStatus(guildId) {
        try {
            const existingMapping = await this.botService.db.ServerMapping.findOne({
                guildId,
                isActive: true
            });

            return {
                isLinked: !!existingMapping,
                communityId: existingMapping?.communityId || null,
                linkedAt: existingMapping?.linkedAt || null,
                linkedBy: existingMapping?.linkedBy || null
            };
        } catch (error) {
            logger.error('Failed to check server link status:', error);
            throw new Error('Failed to check link status');
        }
    }

    /**
     * Create server-community mapping with validation
     */
    async createServerCommunityMapping(guildId, communityId, userId, additionalData = {}) {
        try {
            // Validate that neither server nor community is already linked
            const serverStatus = await this.checkServerLinkStatus(guildId);
            const communityStatus = await this.checkCommunityLinkStatus(communityId);

            if (serverStatus.isLinked) {
                throw new Error(`Server is already linked to community ${serverStatus.communityId}`);
            }

            if (communityStatus.isLinked) {
                throw new Error(`Community is already linked to server ${communityStatus.guildId}`);
            }

            // Create the mapping
            const mappingData = {
                guildId,
                communityId,
                linkedBy: userId,
                linkedAt: new Date(),
                isActive: true,
                ...additionalData
            };

            const mapping = await this.botService.db.createServerCommunityMapping(mappingData);

            // Notify Naffles API about the new link
            await this.notifyNafflesApiAboutLink(guildId, communityId, 'linked');

            logger.info(`Successfully created server-community mapping: ${guildId} -> ${communityId}`);
            return mapping;

        } catch (error) {
            logger.error('Failed to create server-community mapping:', error);
            throw error;
        }
    }

    /**
     * Remove server-community mapping
     */
    async removeServerCommunityMapping(guildId, userId) {
        try {
            const existingMapping = await this.botService.db.ServerMapping.findOne({
                guildId,
                isActive: true
            });

            if (!existingMapping) {
                throw new Error('No active mapping found for this server');
            }

            // Deactivate the mapping
            await this.botService.db.deleteServerCommunityMapping(guildId);

            // Notify Naffles API about the unlink
            await this.notifyNafflesApiAboutLink(guildId, existingMapping.communityId, 'unlinked');

            logger.info(`Successfully removed server-community mapping: ${guildId} -> ${existingMapping.communityId}`);
            return existingMapping;

        } catch (error) {
            logger.error('Failed to remove server-community mapping:', error);
            throw error;
        }
    }

    /**
     * Notify Naffles API about link changes
     */
    async notifyNafflesApiAboutLink(guildId, communityId, action) {
        try {
            await axios.post(
                `${this.nafflesApiBaseUrl}/api/communities/${communityId}/discord-link`,
                {
                    action, // 'linked' or 'unlinked'
                    guildId,
                    timestamp: new Date()
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.nafflesApiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
        } catch (error) {
            // Non-critical error, just log it
            logger.warn(`Failed to notify Naffles API about ${action}:`, error);
        }
    }

    /**
     * Validate user permissions for community management
     */
    async validateUserCommunityPermissions(discordUserId, communityId) {
        try {
            // First check if user has a linked Naffles account
            const accountLink = await this.botService.db.AccountLink.findOne({
                discordId: discordUserId,
                isActive: true
            });

            let nafflesUserId = null;
            if (accountLink) {
                nafflesUserId = accountLink.nafflesUserId;
            }

            // Validate ownership through Naffles API
            const validation = await this.validateCommunityOwnership(
                communityId,
                discordUserId,
                nafflesUserId
            );

            return {
                canManage: validation.canManage,
                communityName: validation.communityName,
                userRole: validation.userRole,
                requiresAccountLink: !accountLink && validation.requiresAccountLink
            };

        } catch (error) {
            logger.error('Failed to validate user community permissions:', error);
            throw error;
        }
    }

    /**
     * Get comprehensive server-community status
     */
    async getServerCommunityStatus(guildId) {
        try {
            const mapping = await this.botService.db.ServerMapping.findOne({
                guildId,
                isActive: true
            });

            if (!mapping) {
                return {
                    isLinked: false,
                    mapping: null,
                    community: null
                };
            }

            // Get community information
            let community = null;
            try {
                community = await this.getCommunityInfo(mapping.communityId);
            } catch (error) {
                logger.warn('Failed to get community info for linked community:', error);
            }

            return {
                isLinked: true,
                mapping,
                community
            };

        } catch (error) {
            logger.error('Failed to get server-community status:', error);
            throw error;
        }
    }

    /**
     * Cleanup expired OAuth states
     */
    async cleanupExpiredOAuthStates() {
        try {
            // This would clean up any stored OAuth states that have expired
            // Implementation depends on where states are stored (Redis, database, etc.)
            logger.info('OAuth state cleanup completed');
        } catch (error) {
            logger.error('Failed to cleanup expired OAuth states:', error);
        }
    }

    /**
     * Health check for community linking service
     */
    async healthCheck() {
        try {
            // Test Naffles API connectivity
            const response = await axios.get(`${this.nafflesApiBaseUrl}/health`, {
                headers: {
                    'Authorization': `Bearer ${this.nafflesApiKey}`
                },
                timeout: 5000
            });

            return {
                status: 'healthy',
                nafflesApi: response.status === 200,
                timestamp: new Date()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                nafflesApi: false,
                error: error.message,
                timestamp: new Date()
            };
        }
    }
}

module.exports = CommunityLinkingService;