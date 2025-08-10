const express = require('express');
const logger = require('../utils/logger');

class OAuthHandler {
    constructor(botService, communityLinkingService) {
        this.botService = botService;
        this.communityLinkingService = communityLinkingService;
        this.router = express.Router();
        this.setupRoutes();
    }

    setupRoutes() {
        // OAuth callback route
        this.router.get('/callback', this.handleOAuthCallback.bind(this));
        
        // OAuth initiation route
        this.router.get('/initiate', this.handleOAuthInitiation.bind(this));
        
        // OAuth status check route
        this.router.get('/status/:guildId', this.handleStatusCheck.bind(this));
        
        // OAuth error route
        this.router.get('/error', this.handleOAuthError.bind(this));
    }

    /**
     * Handle OAuth initiation
     */
    async handleOAuthInitiation(req, res) {
        try {
            const { guildId, userId, communityId } = req.query;

            if (!guildId || !userId || !communityId) {
                return res.status(400).json({
                    error: 'Missing required parameters: guildId, userId, communityId'
                });
            }

            // Generate OAuth URL
            const oauthUrl = this.communityLinkingService.generateOAuthUrl(guildId, userId, communityId);

            // Store initiation data in Redis for tracking
            await this.botService.redis.setex(
                `oauth_initiation_${guildId}_${userId}`,
                600, // 10 minutes
                JSON.stringify({
                    guildId,
                    userId,
                    communityId,
                    initiatedAt: new Date(),
                    status: 'initiated'
                })
            );

            // Redirect to Discord OAuth
            res.redirect(oauthUrl);

        } catch (error) {
            logger.error('Error handling OAuth initiation:', error);
            res.redirect('/oauth/error?error=initiation_failed');
        }
    }

    /**
     * Handle OAuth callback from Discord
     */
    async handleOAuthCallback(req, res) {
        try {
            const { code, state, error } = req.query;

            if (error) {
                logger.error('OAuth error from Discord:', error);
                return res.redirect(`/oauth/error?error=${error}`);
            }

            if (!code || !state) {
                return res.redirect('/oauth/error?error=missing_parameters');
            }

            // Verify and decode state
            let stateData;
            try {
                stateData = this.communityLinkingService.verifyOAuthState(state);
            } catch (error) {
                logger.error('Invalid OAuth state:', error);
                return res.redirect('/oauth/error?error=invalid_state');
            }

            const { guildId, userId, communityId } = stateData;

            // Exchange code for access token
            const tokenData = await this.communityLinkingService.exchangeCodeForToken(code);

            // Get Discord user information
            const discordUser = await this.communityLinkingService.getDiscordUserInfo(tokenData.access_token);

            // Verify the user ID matches
            if (discordUser.id !== userId) {
                logger.error('User ID mismatch in OAuth callback');
                return res.redirect('/oauth/error?error=user_mismatch');
            }

            // Get user's guilds to verify they have access to the target guild
            const userGuilds = await this.communityLinkingService.getDiscordUserGuilds(tokenData.access_token);
            const targetGuild = userGuilds.find(guild => guild.id === guildId);

            if (!targetGuild) {
                return res.redirect('/oauth/error?error=guild_access_denied');
            }

            // Check if user has manage permissions in the guild
            const hasManagePermission = (parseInt(targetGuild.permissions) & 0x20) === 0x20; // MANAGE_GUILD
            if (!hasManagePermission) {
                return res.redirect('/oauth/error?error=insufficient_permissions');
            }

            // Validate community ownership
            const communityValidation = await this.communityLinkingService.validateUserCommunityPermissions(
                userId,
                communityId
            );

            if (!communityValidation.canManage) {
                return res.redirect('/oauth/error?error=community_access_denied');
            }

            // Check for existing links
            const serverStatus = await this.communityLinkingService.checkServerLinkStatus(guildId);
            const communityStatus = await this.communityLinkingService.checkCommunityLinkStatus(communityId);

            if (serverStatus.isLinked) {
                return res.redirect(`/oauth/error?error=server_already_linked&communityId=${serverStatus.communityId}`);
            }

            if (communityStatus.isLinked) {
                return res.redirect(`/oauth/error?error=community_already_linked&guildId=${communityStatus.guildId}`);
            }

            // Create the server-community mapping
            const mapping = await this.communityLinkingService.createServerCommunityMapping(
                guildId,
                communityId,
                userId,
                {
                    metadata: {
                        guildName: targetGuild.name,
                        guildIcon: targetGuild.icon,
                        oauthCompletedAt: new Date(),
                        discordUsername: discordUser.username,
                        discordDiscriminator: discordUser.discriminator
                    }
                }
            );

            // Update OAuth status in Redis
            await this.botService.redis.setex(
                `oauth_completion_${guildId}_${userId}`,
                300, // 5 minutes
                JSON.stringify({
                    guildId,
                    userId,
                    communityId,
                    status: 'completed',
                    completedAt: new Date(),
                    mappingId: mapping._id
                })
            );

            // Send success notification to Discord channel
            await this.sendSuccessNotification(guildId, communityValidation.communityName, discordUser);

            // Redirect to success page
            res.redirect(`/oauth/success?guildId=${guildId}&communityId=${communityId}&communityName=${encodeURIComponent(communityValidation.communityName)}`);

        } catch (error) {
            logger.error('Error handling OAuth callback:', error);
            res.redirect('/oauth/error?error=callback_failed');
        }
    }

    /**
     * Handle OAuth status check
     */
    async handleStatusCheck(req, res) {
        try {
            const { guildId } = req.params;
            const { userId } = req.query;

            if (!guildId) {
                return res.status(400).json({ error: 'Guild ID required' });
            }

            // Check current server-community status
            const serverStatus = await this.communityLinkingService.getServerCommunityStatus(guildId);

            // Check for pending OAuth completion
            let pendingOAuth = null;
            if (userId) {
                const pendingData = await this.botService.redis.get(`oauth_completion_${guildId}_${userId}`);
                if (pendingData) {
                    pendingOAuth = JSON.parse(pendingData);
                }
            }

            res.json({
                guildId,
                isLinked: serverStatus.isLinked,
                mapping: serverStatus.mapping,
                community: serverStatus.community,
                pendingOAuth,
                timestamp: new Date()
            });

        } catch (error) {
            logger.error('Error checking OAuth status:', error);
            res.status(500).json({ error: 'Status check failed' });
        }
    }

    /**
     * Handle OAuth errors
     */
    async handleOAuthError(req, res) {
        const { error, guildId, communityId } = req.query;

        const errorMessages = {
            'access_denied': 'You denied access to Discord. Please try again and grant the required permissions.',
            'invalid_request': 'Invalid OAuth request. Please try again.',
            'invalid_state': 'Invalid or expired authentication state. Please try again.',
            'user_mismatch': 'User verification failed. Please ensure you\'re using the correct Discord account.',
            'guild_access_denied': 'You don\'t have access to the specified Discord server.',
            'insufficient_permissions': 'You need "Manage Server" permission in the Discord server to link communities.',
            'community_access_denied': 'You don\'t have permission to manage this Naffles community.',
            'server_already_linked': 'This Discord server is already linked to another community.',
            'community_already_linked': 'This community is already linked to another Discord server.',
            'initiation_failed': 'Failed to initiate OAuth process. Please try again.',
            'callback_failed': 'OAuth callback failed. Please try again.',
            'missing_parameters': 'Missing required parameters in OAuth callback.'
        };

        const errorMessage = errorMessages[error] || 'An unknown error occurred during authentication.';

        // Send HTML error page
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Naffles Discord Bot - Authentication Error</title>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { 
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        margin: 0;
                        padding: 20px;
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .container {
                        background: white;
                        border-radius: 12px;
                        padding: 40px;
                        max-width: 500px;
                        text-align: center;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                    }
                    .error-icon { font-size: 48px; margin-bottom: 20px; }
                    h1 { color: #e53e3e; margin-bottom: 20px; }
                    p { color: #666; line-height: 1.6; margin-bottom: 30px; }
                    .button {
                        display: inline-block;
                        background: #5865f2;
                        color: white;
                        padding: 12px 24px;
                        border-radius: 6px;
                        text-decoration: none;
                        font-weight: 600;
                        margin: 0 10px;
                    }
                    .button:hover { background: #4752c4; }
                    .button.secondary { background: #6c757d; }
                    .button.secondary:hover { background: #5a6268; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="error-icon">❌</div>
                    <h1>Authentication Failed</h1>
                    <p>${errorMessage}</p>
                    <div>
                        <a href="https://naffles.com/discord-setup" class="button">Try Again</a>
                        <a href="https://naffles.com/support" class="button secondary">Get Help</a>
                    </div>
                </div>
            </body>
            </html>
        `);
    }

    /**
     * Send success notification to Discord channel
     */
    async sendSuccessNotification(guildId, communityName, discordUser) {
        try {
            const guild = this.botService.client.guilds.cache.get(guildId);
            if (!guild) return;

            // Try to find a suitable channel to send the notification
            let channel = guild.systemChannel;
            if (!channel) {
                // Find the first text channel the bot can send messages to
                channel = guild.channels.cache.find(ch => 
                    ch.type === 0 && // TEXT channel
                    ch.permissionsFor(guild.members.me).has('SendMessages')
                );
            }

            if (channel) {
                const embed = {
                    title: '🎉 Community Successfully Linked!',
                    description: `Discord server **${guild.name}** has been successfully linked to Naffles community **${communityName}**.`,
                    color: 0x10B981, // Green
                    fields: [
                        {
                            name: '👤 Linked By',
                            value: `${discordUser.username}#${discordUser.discriminator}`,
                            inline: true
                        },
                        {
                            name: '🎯 Community',
                            value: communityName,
                            inline: true
                        },
                        {
                            name: '🚀 Next Steps',
                            value: 'You can now use `/naffles-create-task` and `/naffles-connect-allowlist` commands!',
                            inline: false
                        }
                    ],
                    footer: {
                        text: 'Powered by Naffles',
                        icon_url: 'https://naffles.com/logo.png'
                    },
                    timestamp: new Date().toISOString()
                };

                await channel.send({ embeds: [embed] });
            }

        } catch (error) {
            logger.error('Failed to send success notification:', error);
        }
    }

    /**
     * Get the Express router
     */
    getRouter() {
        return this.router;
    }
}

module.exports = OAuthHandler;