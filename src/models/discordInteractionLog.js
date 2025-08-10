const mongoose = require('mongoose');

const discordInteractionLogSchema = new mongoose.Schema({
    // Basic Identification
    interactionId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    guildId: {
        type: String,
        required: true,
        index: true
    },
    channelId: {
        type: String,
        required: true,
        index: true
    },
    userId: {
        type: String,
        required: true,
        index: true
    },
    
    // User Information
    userInfo: {
        username: {
            type: String,
            required: true
        },
        discriminator: String,
        globalName: String,
        displayName: String,
        avatar: String,
        isBot: {
            type: Boolean,
            default: false
        },
        accountAge: Number, // days since account creation
        serverJoinDate: Date,
        roles: [String], // role IDs
        permissions: [String]
    },

    // Interaction Details
    interaction: {
        type: {
            type: String,
            required: true,
            enum: [
                'slash_command',
                'button_click',
                'modal_submit',
                'select_menu',
                'context_menu',
                'autocomplete',
                'message_reaction',
                'message_reply'
            ],
            index: true
        },
        commandName: {
            type: String,
            index: true
        },
        subcommand: String,
        customId: String,
        componentType: String,
        values: [String], // for select menus
        options: mongoose.Schema.Types.Mixed,
        locale: String,
        guildLocale: String
    },

    // Action and Result
    action: {
        type: String,
        required: true,
        index: true
    },
    result: {
        type: String,
        enum: ['success', 'error', 'warning', 'partial_success', 'cancelled', 'timeout'],
        required: true,
        index: true
    },
    
    // Timing Information
    timing: {
        timestamp: {
            type: Date,
            default: Date.now,
            index: true
        },
        responseTime: Number, // milliseconds
        processingTime: Number, // milliseconds
        queueTime: Number, // milliseconds
        totalDuration: Number, // milliseconds
        timeoutOccurred: {
            type: Boolean,
            default: false
        }
    },

    // Context Information
    context: {
        messageId: String,
        parentMessageId: String,
        threadId: String,
        referenceMessageId: String,
        taskId: String,
        allowlistId: String,
        communityId: String,
        sessionId: String,
        correlationId: String,
        userAgent: String,
        ipAddress: String,
        deviceType: String,
        platform: String
    },

    // Request/Response Data
    requestData: {
        parameters: mongoose.Schema.Types.Mixed,
        payload: mongoose.Schema.Types.Mixed,
        headers: mongoose.Schema.Types.Mixed,
        size: Number, // bytes
        contentType: String
    },

    responseData: {
        content: String,
        embeds: mongoose.Schema.Types.Mixed,
        components: mongoose.Schema.Types.Mixed,
        attachments: mongoose.Schema.Types.Mixed,
        flags: Number,
        size: Number, // bytes
        statusCode: Number
    },

    // Error Information
    error: {
        hasError: {
            type: Boolean,
            default: false,
            index: true
        },
        errorCode: String,
        errorMessage: String,
        errorType: String,
        stackTrace: String,
        innerError: mongoose.Schema.Types.Mixed,
        retryCount: {
            type: Number,
            default: 0
        },
        isRetryable: Boolean,
        resolution: String,
        resolvedAt: Date,
        resolvedBy: String
    },

    // Performance Metrics
    performance: {
        memoryUsage: {
            heapUsed: Number,
            heapTotal: Number,
            external: Number,
            rss: Number
        },
        cpuUsage: {
            user: Number,
            system: Number
        },
        networkLatency: Number,
        databaseQueryTime: Number,
        externalApiTime: Number,
        cacheHitRate: Number,
        concurrentRequests: Number
    },

    // Security Information
    security: {
        riskScore: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        riskFactors: [String],
        isBlocked: {
            type: Boolean,
            default: false
        },
        blockReason: String,
        rateLimited: {
            type: Boolean,
            default: false
        },
        rateLimitReason: String,
        suspiciousActivity: {
            type: Boolean,
            default: false
        },
        suspiciousReasons: [String],
        ipReputation: String,
        userReputation: String,
        fraudScore: Number
    },

    // Business Logic
    businessData: {
        pointsAwarded: {
            type: Number,
            default: 0
        },
        pointsDeducted: {
            type: Number,
            default: 0
        },
        taskCompleted: Boolean,
        allowlistEntered: Boolean,
        achievementUnlocked: [String],
        levelUp: Boolean,
        transactionId: String,
        referralCode: String,
        campaignId: String,
        conversionValue: Number,
        revenue: Number
    },

    // Analytics Tags
    analytics: {
        category: String,
        subcategory: String,
        tags: [String],
        experimentId: String,
        variantId: String,
        cohort: String,
        segment: String,
        funnel: String,
        funnelStep: String,
        conversionEvent: Boolean,
        revenueEvent: Boolean,
        customDimensions: mongoose.Schema.Types.Mixed,
        customMetrics: mongoose.Schema.Types.Mixed
    },

    // Integration Data
    integration: {
        nafflesApiCalled: {
            type: Boolean,
            default: false
        },
        nafflesApiResponse: mongoose.Schema.Types.Mixed,
        nafflesApiLatency: Number,
        externalApisCalled: [String],
        webhooksTriggered: [String],
        notificationsSent: [{
            type: String,
            recipient: String,
            status: String,
            timestamp: Date
        }],
        syncStatus: String,
        syncErrors: [String]
    },

    // Metadata
    metadata: {
        version: {
            type: String,
            default: '1.0'
        },
        source: {
            type: String,
            default: 'discord_bot'
        },
        environment: String,
        buildVersion: String,
        featureFlags: [String],
        experimentalFeatures: [String],
        debugMode: {
            type: Boolean,
            default: false
        },
        testMode: {
            type: Boolean,
            default: false
        }
    }
}, {
    timestamps: true
});

// Compound Indexes for Performance
discordInteractionLogSchema.index({ guildId: 1, 'timing.timestamp': -1 });
discordInteractionLogSchema.index({ userId: 1, 'timing.timestamp': -1 });
discordInteractionLogSchema.index({ 'interaction.type': 1, 'timing.timestamp': -1 });
discordInteractionLogSchema.index({ 'interaction.commandName': 1, 'timing.timestamp': -1 });
discordInteractionLogSchema.index({ action: 1, result: 1, 'timing.timestamp': -1 });
discordInteractionLogSchema.index({ 'context.taskId': 1, 'timing.timestamp': -1 });
discordInteractionLogSchema.index({ 'context.allowlistId': 1, 'timing.timestamp': -1 });
discordInteractionLogSchema.index({ 'error.hasError': 1, 'timing.timestamp': -1 });
discordInteractionLogSchema.index({ 'security.isBlocked': 1, 'timing.timestamp': -1 });
discordInteractionLogSchema.index({ 'security.suspiciousActivity': 1, 'timing.timestamp': -1 });

// TTL Index - automatically delete logs older than 90 days
discordInteractionLogSchema.index(
    { 'timing.timestamp': 1 }, 
    { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

// Text Index for Search
discordInteractionLogSchema.index({
    'userInfo.username': 'text',
    'interaction.commandName': 'text',
    action: 'text',
    'error.errorMessage': 'text'
});

// Static Methods for Logging
discordInteractionLogSchema.statics.logInteraction = function(data) {
    // Generate unique interaction ID
    data.interactionId = `${data.guildId}_${data.userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return this.create(data);
};

discordInteractionLogSchema.statics.logCommand = function(interaction, result, responseTime, error = null) {
    const logData = {
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        userId: interaction.user.id,
        userInfo: {
            username: interaction.user.username,
            discriminator: interaction.user.discriminator,
            globalName: interaction.user.globalName,
            displayName: interaction.member?.displayName,
            avatar: interaction.user.avatar,
            isBot: interaction.user.bot || false
        },
        interaction: {
            type: 'slash_command',
            commandName: interaction.commandName,
            subcommand: interaction.options?.getSubcommand?.(false),
            options: interaction.options?.data || [],
            locale: interaction.locale,
            guildLocale: interaction.guildLocale
        },
        action: `command_${interaction.commandName}`,
        result: result,
        timing: {
            responseTime: responseTime,
            totalDuration: responseTime
        },
        context: {
            messageId: interaction.id,
            sessionId: interaction.token
        }
    };

    if (error) {
        logData.error = {
            hasError: true,
            errorCode: error.code,
            errorMessage: error.message,
            errorType: error.name,
            stackTrace: error.stack
        };
    }

    return this.logInteraction(logData);
};

discordInteractionLogSchema.statics.logButtonClick = function(interaction, customId, result, responseTime, error = null) {
    const logData = {
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        userId: interaction.user.id,
        userInfo: {
            username: interaction.user.username,
            discriminator: interaction.user.discriminator,
            globalName: interaction.user.globalName,
            displayName: interaction.member?.displayName,
            avatar: interaction.user.avatar,
            isBot: interaction.user.bot || false
        },
        interaction: {
            type: 'button_click',
            customId: customId,
            componentType: 'button'
        },
        action: `button_${customId}`,
        result: result,
        timing: {
            responseTime: responseTime,
            totalDuration: responseTime
        },
        context: {
            messageId: interaction.message?.id,
            parentMessageId: interaction.message?.reference?.messageId
        }
    };

    if (error) {
        logData.error = {
            hasError: true,
            errorCode: error.code,
            errorMessage: error.message,
            errorType: error.name,
            stackTrace: error.stack
        };
    }

    return this.logInteraction(logData);
};

// Analytics and Reporting Methods
discordInteractionLogSchema.statics.getGuildStats = function(guildId, days = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return this.aggregate([
        { 
            $match: { 
                guildId, 
                'timing.timestamp': { $gte: cutoffDate } 
            } 
        },
        {
            $group: {
                _id: {
                    action: '$action',
                    result: '$result'
                },
                count: { $sum: 1 },
                avgResponseTime: { $avg: '$timing.responseTime' },
                totalResponseTime: { $sum: '$timing.responseTime' },
                minResponseTime: { $min: '$timing.responseTime' },
                maxResponseTime: { $max: '$timing.responseTime' }
            }
        },
        {
            $group: {
                _id: '$_id.action',
                results: {
                    $push: {
                        result: '$_id.result',
                        count: '$count',
                        avgResponseTime: '$avgResponseTime',
                        totalResponseTime: '$totalResponseTime',
                        minResponseTime: '$minResponseTime',
                        maxResponseTime: '$maxResponseTime'
                    }
                },
                totalCount: { $sum: '$count' },
                overallAvgResponseTime: { $avg: '$avgResponseTime' }
            }
        },
        { $sort: { totalCount: -1 } }
    ]);
};

discordInteractionLogSchema.statics.getUserStats = function(userId, days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return this.aggregate([
        { 
            $match: { 
                userId, 
                'timing.timestamp': { $gte: cutoffDate } 
            } 
        },
        {
            $group: {
                _id: '$action',
                count: { $sum: 1 },
                successCount: {
                    $sum: { $cond: [{ $eq: ['$result', 'success'] }, 1, 0] }
                },
                errorCount: {
                    $sum: { $cond: [{ $eq: ['$result', 'error'] }, 1, 0] }
                },
                avgResponseTime: { $avg: '$timing.responseTime' },
                totalPointsAwarded: { $sum: '$businessData.pointsAwarded' },
                lastActivity: { $max: '$timing.timestamp' }
            }
        },
        { $sort: { count: -1 } }
    ]);
};

discordInteractionLogSchema.statics.getCommandStats = function(commandName, days = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return this.aggregate([
        { 
            $match: { 
                'interaction.commandName': commandName, 
                'timing.timestamp': { $gte: cutoffDate } 
            } 
        },
        {
            $group: {
                _id: {
                    date: { $dateToString: { format: '%Y-%m-%d', date: '$timing.timestamp' } },
                    result: '$result'
                },
                count: { $sum: 1 },
                avgResponseTime: { $avg: '$timing.responseTime' }
            }
        },
        {
            $group: {
                _id: '$_id.date',
                results: {
                    $push: {
                        result: '$_id.result',
                        count: '$count',
                        avgResponseTime: '$avgResponseTime'
                    }
                },
                totalCount: { $sum: '$count' },
                dailyAvgResponseTime: { $avg: '$avgResponseTime' }
            }
        },
        { $sort: { _id: 1 } }
    ]);
};

discordInteractionLogSchema.statics.getErrorLogs = function(guildId = null, limit = 50) {
    const query = { 'error.hasError': true };
    if (guildId) {
        query.guildId = guildId;
    }
    
    return this.find(query)
        .sort({ 'timing.timestamp': -1 })
        .limit(limit)
        .select('guildId userId userInfo.username action timing.timestamp error.errorCode error.errorMessage interaction.commandName');
};

discordInteractionLogSchema.statics.getPerformanceMetrics = function(days = 1) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return this.aggregate([
        { 
            $match: { 
                'timing.timestamp': { $gte: cutoffDate } 
            } 
        },
        {
            $group: {
                _id: null,
                totalInteractions: { $sum: 1 },
                avgResponseTime: { $avg: '$timing.responseTime' },
                p95ResponseTime: { $percentile: { input: '$timing.responseTime', p: [0.95], method: 'approximate' } },
                p99ResponseTime: { $percentile: { input: '$timing.responseTime', p: [0.99], method: 'approximate' } },
                errorRate: {
                    $avg: { $cond: [{ $eq: ['$result', 'error'] }, 1, 0] }
                },
                successRate: {
                    $avg: { $cond: [{ $eq: ['$result', 'success'] }, 1, 0] }
                },
                uniqueUsers: { $addToSet: '$userId' },
                uniqueGuilds: { $addToSet: '$guildId' },
                totalPointsAwarded: { $sum: '$businessData.pointsAwarded' },
                totalRevenue: { $sum: '$businessData.revenue' }
            }
        },
        {
            $project: {
                totalInteractions: 1,
                avgResponseTime: 1,
                p95ResponseTime: { $arrayElemAt: ['$p95ResponseTime', 0] },
                p99ResponseTime: { $arrayElemAt: ['$p99ResponseTime', 0] },
                errorRate: { $multiply: ['$errorRate', 100] },
                successRate: { $multiply: ['$successRate', 100] },
                uniqueUserCount: { $size: '$uniqueUsers' },
                uniqueGuildCount: { $size: '$uniqueGuilds' },
                totalPointsAwarded: 1,
                totalRevenue: 1
            }
        }
    ]);
};

discordInteractionLogSchema.statics.getSecurityAlerts = function(days = 1) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return this.find({
        'timing.timestamp': { $gte: cutoffDate },
        $or: [
            { 'security.isBlocked': true },
            { 'security.suspiciousActivity': true },
            { 'security.riskScore': { $gte: 70 } }
        ]
    })
    .sort({ 'timing.timestamp': -1 })
    .select('guildId userId userInfo.username action timing.timestamp security');
};

discordInteractionLogSchema.statics.getActivitySummary = function(days = 1) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return this.aggregate([
        { 
            $match: { 
                'timing.timestamp': { $gte: cutoffDate } 
            } 
        },
        {
            $group: {
                _id: null,
                totalInteractions: { $sum: 1 },
                uniqueUsers: { $addToSet: '$userId' },
                uniqueGuilds: { $addToSet: '$guildId' },
                successCount: {
                    $sum: { $cond: [{ $eq: ['$result', 'success'] }, 1, 0] }
                },
                errorCount: {
                    $sum: { $cond: [{ $eq: ['$result', 'error'] }, 1, 0] }
                },
                commandCounts: {
                    $push: '$interaction.commandName'
                },
                avgResponseTime: { $avg: '$timing.responseTime' },
                totalPointsAwarded: { $sum: '$businessData.pointsAwarded' }
            }
        },
        {
            $project: {
                totalInteractions: 1,
                uniqueUserCount: { $size: '$uniqueUsers' },
                uniqueGuildCount: { $size: '$uniqueGuilds' },
                successCount: 1,
                errorCount: 1,
                successRate: { 
                    $multiply: [
                        { $divide: ['$successCount', '$totalInteractions'] }, 
                        100
                    ] 
                },
                avgResponseTime: 1,
                totalPointsAwarded: 1
            }
        }
    ]);
};

// Cleanup Methods
discordInteractionLogSchema.statics.cleanupOldLogs = function(daysToKeep = 90) {
    const cutoffDate = new Date(Date.now() - (daysToKeep * 24 * 60 * 60 * 1000));
    
    return this.deleteMany({
        'timing.timestamp': { $lt: cutoffDate }
    });
};

discordInteractionLogSchema.statics.archiveOldLogs = function(daysToArchive = 30) {
    const cutoffDate = new Date(Date.now() - (daysToArchive * 24 * 60 * 60 * 1000));
    
    return this.updateMany(
        {
            'timing.timestamp': { $lt: cutoffDate },
            'metadata.archived': { $ne: true }
        },
        {
            $set: { 'metadata.archived': true, 'metadata.archivedAt': new Date() }
        }
    );
};

module.exports = mongoose.model('DiscordInteractionLog', discordInteractionLogSchema);