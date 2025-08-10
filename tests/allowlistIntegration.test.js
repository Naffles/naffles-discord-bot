const { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } = require('@jest/globals');
const AllowlistIntegrationService = require('../src/services/allowlistIntegrationService');
const AllowlistConnection = require('../src/models/allowlistConnection');
const { setupTestEnvironment, cleanupTestEnvironment } = require('./setup');

describe('Allowlist Integration Service', () => {
    let testEnv;
    let allowlistIntegrationService;
    let mockBotService;
    let mockInteraction;
    let mockChannel;
    let mockMessage;

    beforeAll(async () => {
        testEnv = await setupTestEnvironment();
    });

    afterAll(async () => {
        await cleanupTestEnvironment(testEnv);
    });

    beforeEach(async () => {
        // Create mock bot service
        mockBotService = {
            client: {
                channels: {
                    fetch: jest.fn()
                },
                guilds: {
                    fetch: jest.fn()
                }
            },
            rateLimiter: {
                checkRateLimit: jest.fn().mockResolvedValue(false)
            },
            db: {
                getUserAccountLink: jest.fn()
            },
            makeNafflesApiCall: jest.fn(),
            getServerCommunityMapping: jest.fn(),
            logInteraction: jest.fn().mockResolvedValue(true)
        };

        // Create mock Discord objects
        mockChannel = {
            id: 'test-channel-id',
            guild: { id: 'test-guild-id' },
            send: jest.fn()
        };

        mockMessage = {
            id: 'test-message-id',
            edit: jest.fn()
        };

        mockInteraction = {
            user: {
                id: 'test-user-id',
                username: 'testuser'
            },
            guild: {
                id: 'test-guild-id'
            },
            channel: mockChannel,
            reply: jest.fn(),
            editReply: jest.fn(),
            deferReply: jest.fn()
        };

        // Initialize service
        allowlistIntegrationService = new AllowlistIntegrationService(mockBotService);

        // Clear database
        await AllowlistConnection.deleteMany({});
    });

    afterEach(async () => {
        if (allowlistIntegrationService) {
            allowlistIntegrationService.cleanup();
        }
        await AllowlistConnection.deleteMany({});
    });

    describe('connectAllowlistToServer', () => {
        test('should successfully connect allowlist to Discord server', async () => {
            // Mock API responses
            const mockAllowlist = {
                id: 'test-allowlist-id',
                title: 'Test Allowlist',
                description: 'Test description',
                communityId: 'test-community-id',
                status: 'active',
                winnerCount: 10,
                entryPrice: { amount: '0', tokenType: 'ETH' },
                endTime: new Date(Date.now() + 86400000), // 24 hours from now
                totalEntries: 0,
                socialTasks: []
            };

            const mockServerMapping = {
                communityId: 'test-community-id',
                communityName: 'Test Community'
            };

            mockBotService.makeNafflesApiCall
                .mockResolvedValueOnce(mockAllowlist) // Get allowlist
                .mockResolvedValueOnce(true); // Update connection

            mockBotService.getServerCommunityMapping.mockResolvedValue(mockServerMapping);
            mockBotService.client.channels.fetch.mockResolvedValue(mockChannel);
            mockChannel.send.mockResolvedValue(mockMessage);

            const result = await allowlistIntegrationService.connectAllowlistToServer({
                allowlistId: 'test-allowlist-id',
                guildId: 'test-guild-id',
                channelId: 'test-channel-id',
                connectedBy: 'test-user-id'
            });

            expect(result.success).toBe(true);
            expect(result.allowlist).toEqual(mockAllowlist);
            expect(result.message).toEqual(mockMessage);

            // Verify database record was created
            const connection = await AllowlistConnection.findOne({
                allowlistId: 'test-allowlist-id',
                guildId: 'test-guild-id'
            });

            expect(connection).toBeTruthy();
            expect(connection.channelId).toBe('test-channel-id');
            expect(connection.connectedBy).toBe('test-user-id');
        });

        test('should reject connection if allowlist already connected', async () => {
            // Create existing connection
            await new AllowlistConnection({
                allowlistId: 'test-allowlist-id',
                guildId: 'test-guild-id',
                channelId: 'test-channel-id',
                messageId: 'existing-message-id',
                connectedBy: 'other-user-id',
                allowlistData: {
                    title: 'Existing Allowlist',
                    status: 'active'
                }
            }).save();

            await expect(
                allowlistIntegrationService.connectAllowlistToServer({
                    allowlistId: 'test-allowlist-id',
                    guildId: 'test-guild-id',
                    channelId: 'test-channel-id',
                    connectedBy: 'test-user-id'
                })
            ).rejects.toThrow('Allowlist is already connected to this server');
        });

        test('should reject connection if server not linked to community', async () => {
            mockBotService.getServerCommunityMapping.mockResolvedValue(null);

            await expect(
                allowlistIntegrationService.connectAllowlistToServer({
                    allowlistId: 'test-allowlist-id',
                    guildId: 'test-guild-id',
                    channelId: 'test-channel-id',
                    connectedBy: 'test-user-id'
                })
            ).rejects.toThrow('Discord server is not linked to a Naffles community');
        });

        test('should reject connection if allowlist belongs to different community', async () => {
            const mockAllowlist = {
                id: 'test-allowlist-id',
                communityId: 'different-community-id'
            };

            const mockServerMapping = {
                communityId: 'test-community-id'
            };

            mockBotService.makeNafflesApiCall.mockResolvedValue(mockAllowlist);
            mockBotService.getServerCommunityMapping.mockResolvedValue(mockServerMapping);

            await expect(
                allowlistIntegrationService.connectAllowlistToServer({
                    allowlistId: 'test-allowlist-id',
                    guildId: 'test-guild-id',
                    channelId: 'test-channel-id',
                    connectedBy: 'test-user-id'
                })
            ).rejects.toThrow('Allowlist does not belong to your community');
        });
    });

    describe('processAllowlistEntry', () => {
        test('should successfully process allowlist entry', async () => {
            const mockAllowlist = {
                id: 'test-allowlist-id',
                title: 'Test Allowlist',
                status: 'active',
                endTime: new Date(Date.now() + 86400000),
                totalEntries: 5,
                maxEntries: 100,
                socialTasks: []
            };

            const mockUserAccount = {
                nafflesUserId: 'naffles-user-id',
                walletAddress: '0x123...'
            };

            const mockEntryResult = {
                id: 'entry-id',
                success: true
            };

            mockBotService.rateLimiter.checkRateLimit.mockResolvedValue(false);
            mockBotService.db.getUserAccountLink.mockResolvedValue(mockUserAccount);
            mockBotService.makeNafflesApiCall
                .mockResolvedValueOnce(mockAllowlist) // Get allowlist
                .mockResolvedValueOnce(null) // Check existing entry
                .mockResolvedValueOnce(mockEntryResult); // Process entry

            const result = await allowlistIntegrationService.processAllowlistEntry(
                mockInteraction,
                'test-allowlist-id'
            );

            expect(result.success).toBe(true);
            expect(result.message).toContain('Successfully entered the allowlist');
            expect(mockInteraction.reply).toHaveBeenCalled();
        });

        test('should reject entry if user account not linked', async () => {
            mockBotService.rateLimiter.checkRateLimit.mockResolvedValue(false);
            mockBotService.db.getUserAccountLink.mockResolvedValue(null);

            const result = await allowlistIntegrationService.processAllowlistEntry(
                mockInteraction,
                'test-allowlist-id'
            );

            expect(result.success).toBe(false);
            expect(result.reason).toBe('account_not_linked');
            expect(result.message).toContain('link your Naffles account');
        });

        test('should reject entry if allowlist is inactive', async () => {
            const mockAllowlist = {
                id: 'test-allowlist-id',
                status: 'ended',
                endTime: new Date(Date.now() - 86400000) // 24 hours ago
            };

            const mockUserAccount = {
                nafflesUserId: 'naffles-user-id'
            };

            mockBotService.rateLimiter.checkRateLimit.mockResolvedValue(false);
            mockBotService.db.getUserAccountLink.mockResolvedValue(mockUserAccount);
            mockBotService.makeNafflesApiCall.mockResolvedValue(mockAllowlist);

            const result = await allowlistIntegrationService.processAllowlistEntry(
                mockInteraction,
                'test-allowlist-id'
            );

            expect(result.success).toBe(false);
            expect(result.reason).toBe('allowlist_inactive');
            expect(result.message).toContain('no longer active');
        });

        test('should reject entry if user already entered', async () => {
            const mockAllowlist = {
                id: 'test-allowlist-id',
                status: 'active',
                endTime: new Date(Date.now() + 86400000),
                socialTasks: []
            };

            const mockUserAccount = {
                nafflesUserId: 'naffles-user-id'
            };

            const mockExistingEntry = {
                id: 'existing-entry-id'
            };

            mockBotService.rateLimiter.checkRateLimit.mockResolvedValue(false);
            mockBotService.db.getUserAccountLink.mockResolvedValue(mockUserAccount);
            mockBotService.makeNafflesApiCall
                .mockResolvedValueOnce(mockAllowlist)
                .mockResolvedValueOnce(mockExistingEntry);

            const result = await allowlistIntegrationService.processAllowlistEntry(
                mockInteraction,
                'test-allowlist-id'
            );

            expect(result.success).toBe(false);
            expect(result.reason).toBe('already_entered');
            expect(result.message).toContain('already entered');
        });

        test('should reject entry if rate limited', async () => {
            mockBotService.rateLimiter.checkRateLimit.mockResolvedValue(true);

            const result = await allowlistIntegrationService.processAllowlistEntry(
                mockInteraction,
                'test-allowlist-id'
            );

            expect(result.success).toBe(false);
            expect(result.reason).toBe('rate_limited');
            expect(result.message).toContain('attempting to enter too frequently');
        });

        test('should reject entry if capacity reached', async () => {
            const mockAllowlist = {
                id: 'test-allowlist-id',
                status: 'active',
                endTime: new Date(Date.now() + 86400000),
                totalEntries: 100,
                maxEntries: 100,
                socialTasks: []
            };

            const mockUserAccount = {
                nafflesUserId: 'naffles-user-id'
            };

            mockBotService.rateLimiter.checkRateLimit.mockResolvedValue(false);
            mockBotService.db.getUserAccountLink.mockResolvedValue(mockUserAccount);
            mockBotService.makeNafflesApiCall
                .mockResolvedValueOnce(mockAllowlist)
                .mockResolvedValueOnce(null); // No existing entry

            const result = await allowlistIntegrationService.processAllowlistEntry(
                mockInteraction,
                'test-allowlist-id'
            );

            expect(result.success).toBe(false);
            expect(result.reason).toBe('capacity_reached');
            expect(result.message).toContain('reached maximum capacity');
        });
    });

    describe('validateSocialRequirements', () => {
        test('should pass validation with no social tasks', async () => {
            const mockAllowlist = {
                socialTasks: []
            };

            const result = await allowlistIntegrationService.validateSocialRequirements(
                mockAllowlist,
                'naffles-user-id',
                'discord-user-id'
            );

            expect(result.valid).toBe(true);
            expect(result.completedTasks).toEqual([]);
        });

        test('should pass validation with completed required tasks', async () => {
            const mockAllowlist = {
                socialTasks: [
                    {
                        taskId: 'task-1',
                        taskType: 'twitter_follow',
                        required: true,
                        verificationData: {
                            twitter: { username: 'testaccount' }
                        }
                    }
                ]
            };

            // Mock successful Twitter validation
            mockBotService.makeNafflesApiCall.mockResolvedValue({
                verified: true,
                data: { method: 'twitter_api' }
            });

            const result = await allowlistIntegrationService.validateSocialRequirements(
                mockAllowlist,
                'naffles-user-id',
                'discord-user-id'
            );

            expect(result.valid).toBe(true);
            expect(result.completedTasks).toHaveLength(1);
            expect(result.completedTasks[0].taskType).toBe('twitter_follow');
        });

        test('should fail validation with incomplete required tasks', async () => {
            const mockAllowlist = {
                socialTasks: [
                    {
                        taskId: 'task-1',
                        taskType: 'twitter_follow',
                        required: true,
                        verificationData: {
                            twitter: { username: 'testaccount' }
                        }
                    }
                ]
            };

            // Mock failed Twitter validation
            mockBotService.makeNafflesApiCall.mockResolvedValue({
                verified: false,
                reason: 'Twitter follow not detected'
            });

            const result = await allowlistIntegrationService.validateSocialRequirements(
                mockAllowlist,
                'naffles-user-id',
                'discord-user-id'
            );

            expect(result.valid).toBe(false);
            expect(result.message).toContain('complete the required social tasks');
            expect(result.failedTasks).toHaveLength(1);
        });

        test('should skip optional tasks in validation', async () => {
            const mockAllowlist = {
                socialTasks: [
                    {
                        taskId: 'task-1',
                        taskType: 'twitter_follow',
                        required: false, // Optional task
                        verificationData: {
                            twitter: { username: 'testaccount' }
                        }
                    }
                ]
            };

            const result = await allowlistIntegrationService.validateSocialRequirements(
                mockAllowlist,
                'naffles-user-id',
                'discord-user-id'
            );

            expect(result.valid).toBe(true);
            expect(result.completedTasks).toEqual([]);
        });
    });

    describe('validateDiscordJoin', () => {
        test('should validate Discord server membership', async () => {
            const mockTask = {
                verificationData: {
                    discord: {
                        serverId: 'test-server-id',
                        serverName: 'Test Server'
                    }
                }
            };

            const mockGuild = {
                members: {
                    fetch: jest.fn().mockResolvedValue({
                        joinedAt: new Date(),
                        roles: {
                            cache: new Map([
                                ['role1', { name: 'Member' }]
                            ])
                        }
                    })
                }
            };

            mockBotService.client.guilds.fetch.mockResolvedValue(mockGuild);

            const result = await allowlistIntegrationService.validateDiscordJoin(
                mockTask,
                'discord-user-id'
            );

            expect(result.valid).toBe(true);
            expect(result.reason).toBe('Discord membership verified');
            expect(result.verificationData.serverId).toBe('test-server-id');
        });

        test('should fail validation if user not in server', async () => {
            const mockTask = {
                verificationData: {
                    discord: {
                        serverId: 'test-server-id',
                        serverName: 'Test Server'
                    }
                }
            };

            const mockGuild = {
                members: {
                    fetch: jest.fn().mockRejectedValue(new Error('Member not found'))
                }
            };

            mockBotService.client.guilds.fetch.mockResolvedValue(mockGuild);

            const result = await allowlistIntegrationService.validateDiscordJoin(
                mockTask,
                'discord-user-id'
            );

            expect(result.valid).toBe(false);
            expect(result.reason).toContain('Not a member of the required Discord server');
        });

        test('should validate required role if specified', async () => {
            const mockTask = {
                verificationData: {
                    discord: {
                        serverId: 'test-server-id',
                        serverName: 'Test Server',
                        requiredRole: 'VIP'
                    }
                }
            };

            const mockGuild = {
                members: {
                    fetch: jest.fn().mockResolvedValue({
                        joinedAt: new Date(),
                        roles: {
                            cache: new Map([
                                ['role1', { name: 'VIP' }],
                                ['role2', { name: 'Member' }]
                            ])
                        }
                    })
                }
            };

            mockBotService.client.guilds.fetch.mockResolvedValue(mockGuild);

            const result = await allowlistIntegrationService.validateDiscordJoin(
                mockTask,
                'discord-user-id'
            );

            expect(result.valid).toBe(true);
            expect(result.verificationData.roles).toContain('VIP');
        });

        test('should fail validation if required role missing', async () => {
            const mockTask = {
                verificationData: {
                    discord: {
                        serverId: 'test-server-id',
                        serverName: 'Test Server',
                        requiredRole: 'VIP'
                    }
                }
            };

            const mockGuild = {
                members: {
                    fetch: jest.fn().mockResolvedValue({
                        joinedAt: new Date(),
                        roles: {
                            cache: new Map([
                                ['role1', { name: 'Member' }]
                            ])
                        }
                    })
                }
            };

            mockBotService.client.guilds.fetch.mockResolvedValue(mockGuild);

            const result = await allowlistIntegrationService.validateDiscordJoin(
                mockTask,
                'discord-user-id'
            );

            expect(result.valid).toBe(false);
            expect(result.reason).toContain('Missing required role: VIP');
        });
    });

    describe('getAllowlistAnalytics', () => {
        test('should return comprehensive analytics data', async () => {
            // Create test connections
            const connections = [
                new AllowlistConnection({
                    allowlistId: 'allowlist-1',
                    guildId: 'test-guild-id',
                    channelId: 'channel-1',
                    messageId: 'message-1',
                    connectedBy: 'user-1',
                    allowlistData: {
                        title: 'Allowlist 1',
                        status: 'active'
                    },
                    interactions: {
                        views: 100,
                        entries: 25
                    }
                }),
                new AllowlistConnection({
                    allowlistId: 'allowlist-2',
                    guildId: 'test-guild-id',
                    channelId: 'channel-2',
                    messageId: 'message-2',
                    connectedBy: 'user-2',
                    allowlistData: {
                        title: 'Allowlist 2',
                        status: 'ended'
                    },
                    interactions: {
                        views: 50,
                        entries: 15
                    }
                })
            ];

            await AllowlistConnection.insertMany(connections);

            const analytics = await allowlistIntegrationService.getAllowlistAnalytics('test-guild-id');

            expect(analytics.totalAllowlists).toBe(2);
            expect(analytics.activeAllowlists).toBe(1);
            expect(analytics.totalViews).toBe(150);
            expect(analytics.totalEntries).toBe(40);
            expect(analytics.averageViewsPerAllowlist).toBe(75);
            expect(analytics.averageEntriesPerAllowlist).toBe(20);
            expect(analytics.connections).toHaveLength(2);
        });

        test('should return empty analytics for guild with no allowlists', async () => {
            const analytics = await allowlistIntegrationService.getAllowlistAnalytics('empty-guild-id');

            expect(analytics.totalAllowlists).toBe(0);
            expect(analytics.activeAllowlists).toBe(0);
            expect(analytics.totalViews).toBe(0);
            expect(analytics.totalEntries).toBe(0);
            expect(analytics.connections).toHaveLength(0);
        });
    });

    describe('updateAllowlistEmbed', () => {
        test('should update Discord message with latest allowlist data', async () => {
            // Create test connection
            const connection = new AllowlistConnection({
                allowlistId: 'test-allowlist-id',
                guildId: 'test-guild-id',
                channelId: 'test-channel-id',
                messageId: 'test-message-id',
                connectedBy: 'test-user-id',
                allowlistData: {
                    title: 'Test Allowlist',
                    status: 'active',
                    participants: 10
                }
            });

            await connection.save();

            const updatedAllowlist = {
                id: 'test-allowlist-id',
                title: 'Test Allowlist',
                status: 'active',
                totalEntries: 15,
                winnerCount: 10,
                entryPrice: { amount: '0', tokenType: 'ETH' },
                endTime: new Date(Date.now() + 86400000),
                socialTasks: []
            };

            mockBotService.makeNafflesApiCall.mockResolvedValue(updatedAllowlist);
            mockBotService.client.channels.fetch.mockResolvedValue(mockChannel);
            mockChannel.messages = {
                fetch: jest.fn().mockResolvedValue(mockMessage)
            };

            await allowlistIntegrationService.updateAllowlistEmbed('test-allowlist-id');

            expect(mockMessage.edit).toHaveBeenCalled();
            
            // Verify connection was updated
            const updatedConnection = await AllowlistConnection.findById(connection._id);
            expect(updatedConnection.allowlistData.participants).toBe(15);
        });
    });

    describe('cleanup', () => {
        test('should cleanup resources properly', () => {
            // Set up some resources
            allowlistIntegrationService.activeConnections.set('test', {});
            allowlistIntegrationService.entryCache.set('test', {});

            // Call cleanup
            allowlistIntegrationService.cleanup();

            expect(allowlistIntegrationService.activeConnections.size).toBe(0);
            expect(allowlistIntegrationService.entryCache.size).toBe(0);
        });
    });
});