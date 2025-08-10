const mongoose = require('mongoose');

const discordTaskPostSchema = new mongoose.Schema({
    taskId: {
        type: String,
        required: true,
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
    messageId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    
    // Creation Information
    creationData: {
        createdBy: {
            type: String,
            required: true,
            index: true
        },
        createdAt: {
            type: Date,
            default: Date.now,
            index: true
        },
        creationMethod: {
            type: String,
            enum: ['slash_command', 'api', 'webhook', 'manual'],
            default: 'slash_command'
        },
        creatorRole: String,
        creatorPermissions: [String]
    },

    // Task Information
    taskData: {
        title: {
            type: String,
            required: true
        },
        description: String,
        type: {
            type: String,
            required: true,
            enum: ['twitter_follow', 'discord_join', 'telegram_join', 'custom', 'raffle_entry', 'social_share']
        },
        category: String,
        points: {
            type: Number,
            default: 0
        },
        requirements: [{
            type: String,
            description: String,
            isRequired: Boolean,
            verificationData: mongoose.Schema.Types.Mixed
        }],
        rewards: [{
            type: String,
            amount: Number,
            description: String
        }],
        status: {
            type: String,
            enum: ['active', 'paused', 'completed', 'expired', 'cancelled'],
            default: 'active',
            index: true
        },
        priority: {
            type: String,
            enum: ['low', 'normal', 'high', 'urgent'],
            default: 'normal'
        }
    },

    // Timing Information
    timing: {
        startTime: {
            type: Date,
            default: Date.now
        },
        endTime: Date,
        duration: Number, // in minutes
        timeZone: String,
        isRecurring: {
            type: Boolean,
            default: false
        },
        recurringPattern: String, // e.g., "daily", "weekly"
        nextRecurrence: Date
    },

    // Discord Message Information
    messageData: {
        embedId: String,
        embedVersion: {
            type: Number,
            default: 1
        },
        buttonIds: [String],
        lastUpdated: {
            type: Date,
            default: Date.now
        },
        updateCount: {
            type: Number,
            default: 0
        },
        messageContent: String,
        embedData: mongoose.Schema.Types.Mixed,
        attachments: [{
            id: String,
            filename: String,
            url: String,
            size: Number,
            contentType: String
        }]
    },

    // Interaction Statistics
    interactionStats: {
        views: {
            type: Number,
            default: 0
        },
        uniqueViews: {
            type: Number,
            default: 0
        },
        completions: {
            type: Number,
            default: 0
        },
        attempts: {
            type: Number,
            default: 0
        },
        successRate: {
            type: Number,
            default: 0
        },
        averageCompletionTime: Number, // in seconds
        lastInteraction: Date,
        peakInteractionHour: Number,
        interactionsByHour: [{
            hour: Number,
            count: Number
        }]
    },

    // User Engagement Data
    engagement: {
        participantIds: [String], // Discord user IDs
        completedByIds: [String], // Discord user IDs who completed
        viewedByIds: [String], // Discord user IDs who viewed
        reactions: [{
            emoji: String,
            count: Number,
            users: [String]
        }],
        comments: [{
            userId: String,
            username: String,
            content: String,
            timestamp: Date,
            isModerated: Boolean
        }],
        shares: {
            type: Number,
            default: 0
        }
    },

    // Performance Analytics
    analytics: {
        conversionRate: Number, // views to completions
        engagementScore: Number, // calculated engagement metric
        viralityScore: Number, // shares and reactions metric
        qualityScore: Number, // overall task quality metric
        feedbackScore: Number, // user feedback average
        completionTrend: [{
            date: Date,
            completions: Number,
            views: Number
        }],
        demographicData: {
            topCountries: [String],
            topTimezones: [String],
            ageGroups: mongoose.Schema.Types.Mixed
        }
    },

    // Status and Lifecycle
    lifecycle: {
        isActive: {
            type: Boolean,
            default: true,
            index: true
        },
        isPinned: {
            type: Boolean,
            default: false
        },
        isFeatured: {
            type: Boolean,
            default: false
        },
        isArchived: {
            type: Boolean,
            default: false
        },
        archivedAt: Date,
        archivedBy: String,
        archivedReason: String,
        lastStatusChange: {
            type: Date,
            default: Date.now
        },
        statusHistory: [{
            status: String,
            timestamp: Date,
            changedBy: String,
            reason: String
        }]
    },

    // Integration and Sync
    syncData: {
        lastSyncWithNaffles: Date,
        syncStatus: {
            type: String,
            enum: ['synced', 'pending', 'failed', 'conflict'],
            default: 'synced'
        },
        syncErrors: [{
            error: String,
            timestamp: Date,
            resolved: Boolean
        }],
        webhookDeliveries: [{
            webhookId: String,
            deliveredAt: Date,
            status: String,
            responseCode: Number
        }]
    },

    // Moderation and Security
    moderation: {
        isModerated: {
            type: Boolean,
            default: false
        },
        moderatedBy: String,
        moderatedAt: Date,
        moderationReason: String,
        flaggedReports: [{
            reportedBy: String,
            reason: String,
            timestamp: Date,
            status: String,
            reviewedBy: String,
            reviewedAt: Date
        }],
        autoModerationFlags: [{
            flag: String,
            confidence: Number,
            timestamp: Date,
            action: String
        }]
    },

    // Audit Trail
    auditLog: [{
        action: {
            type: String,
            required: true
        },
        performedBy: {
            type: String,
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        details: mongoose.Schema.Types.Mixed,
        ipAddress: String,
        userAgent: String,
        changes: mongoose.Schema.Types.Mixed
    }]
}, {
    timestamps: true
});

// Compound Indexes for Performance
discordTaskPostSchema.index({ taskId: 1, guildId: 1 });
discordTaskPostSchema.index({ guildId: 1, 'taskData.status': 1 });
discordTaskPostSchema.index({ messageId: 1, 'lifecycle.isActive': 1 });
discordTaskPostSchema.index({ 'creationData.createdBy': 1, 'creationData.createdAt': -1 });
discordTaskPostSchema.index({ 'timing.endTime': 1, 'taskData.status': 1 });
discordTaskPostSchema.index({ 'interactionStats.lastInteraction': -1 });
discordTaskPostSchema.index({ 'lifecycle.isActive': 1, 'lifecycle.isArchived': 1 });

// TTL Index for expired tasks (cleanup after 90 days of expiration)
discordTaskPostSchema.index(
    { 'timing.endTime': 1 }, 
    { 
        expireAfterSeconds: 90 * 24 * 60 * 60,
        partialFilterExpression: { 
            'taskData.status': { $in: ['expired', 'completed', 'cancelled'] }
        }
    }
);

// Text Index for Search
discordTaskPostSchema.index({
    'taskData.title': 'text',
    'taskData.description': 'text',
    'taskData.category': 'text'
});

// Instance Methods
discordTaskPostSchema.methods.incrementViews = function(userId = null) {
    this.interactionStats.views += 1;
    this.interactionStats.lastInteraction = new Date();
    
    if (userId && !this.engagement.viewedByIds.includes(userId)) {
        this.engagement.viewedByIds.push(userId);
        this.interactionStats.uniqueViews += 1;
    }
    
    this.updateEngagementMetrics();
    return this.save();
};

discordTaskPostSchema.methods.incrementCompletions = function(userId, completionTime = null) {
    this.interactionStats.completions += 1;
    this.interactionStats.lastInteraction = new Date();
    
    if (userId && !this.engagement.completedByIds.includes(userId)) {
        this.engagement.completedByIds.push(userId);
    }
    
    if (completionTime) {
        const currentAvg = this.interactionStats.averageCompletionTime || 0;
        const completionCount = this.interactionStats.completions;
        this.interactionStats.averageCompletionTime = 
            ((currentAvg * (completionCount - 1)) + completionTime) / completionCount;
    }
    
    this.updateEngagementMetrics();
    return this.save();
};

discordTaskPostSchema.methods.incrementAttempts = function() {
    this.interactionStats.attempts += 1;
    this.updateSuccessRate();
    return this.save();
};

discordTaskPostSchema.methods.updateSuccessRate = function() {
    if (this.interactionStats.attempts > 0) {
        this.interactionStats.successRate = 
            (this.interactionStats.completions / this.interactionStats.attempts) * 100;
    }
};

discordTaskPostSchema.methods.updateEngagementMetrics = function() {
    // Calculate conversion rate
    if (this.interactionStats.views > 0) {
        this.analytics.conversionRate = 
            (this.interactionStats.completions / this.interactionStats.views) * 100;
    }
    
    // Calculate engagement score (weighted metric)
    const viewWeight = 1;
    const completionWeight = 5;
    const shareWeight = 3;
    const reactionWeight = 2;
    
    const totalReactions = this.engagement.reactions.reduce((sum, r) => sum + r.count, 0);
    
    this.analytics.engagementScore = 
        (this.interactionStats.views * viewWeight) +
        (this.interactionStats.completions * completionWeight) +
        (this.engagement.shares * shareWeight) +
        (totalReactions * reactionWeight);
};

discordTaskPostSchema.methods.updateTaskData = function(taskData) {
    const oldData = this.taskData.toObject();
    this.taskData = { ...this.taskData.toObject(), ...taskData };
    this.messageData.lastUpdated = new Date();
    this.messageData.updateCount += 1;
    
    this.addAuditEntry('task_updated', 'system', {
        oldData,
        newData: taskData
    });
    
    return this.save();
};

discordTaskPostSchema.methods.updateStatus = function(newStatus, changedBy, reason = null) {
    const oldStatus = this.taskData.status;
    this.taskData.status = newStatus;
    this.lifecycle.lastStatusChange = new Date();
    
    this.lifecycle.statusHistory.push({
        status: newStatus,
        timestamp: new Date(),
        changedBy,
        reason
    });
    
    this.addAuditEntry('status_changed', changedBy, {
        oldStatus,
        newStatus,
        reason
    });
    
    return this.save();
};

discordTaskPostSchema.methods.addReaction = function(emoji, userId) {
    const existingReaction = this.engagement.reactions.find(r => r.emoji === emoji);
    
    if (existingReaction) {
        if (!existingReaction.users.includes(userId)) {
            existingReaction.users.push(userId);
            existingReaction.count += 1;
        }
    } else {
        this.engagement.reactions.push({
            emoji,
            count: 1,
            users: [userId]
        });
    }
    
    this.updateEngagementMetrics();
    return this.save();
};

discordTaskPostSchema.methods.addComment = function(userId, username, content) {
    this.engagement.comments.push({
        userId,
        username,
        content,
        timestamp: new Date(),
        isModerated: false
    });
    
    return this.save();
};

discordTaskPostSchema.methods.archive = function(archivedBy, reason = null) {
    this.lifecycle.isArchived = true;
    this.lifecycle.isActive = false;
    this.lifecycle.archivedAt = new Date();
    this.lifecycle.archivedBy = archivedBy;
    this.lifecycle.archivedReason = reason;
    
    this.addAuditEntry('archived', archivedBy, { reason });
    return this.save();
};

discordTaskPostSchema.methods.addAuditEntry = function(action, performedBy, details = {}, ipAddress = null, userAgent = null) {
    this.auditLog.push({
        action,
        performedBy,
        timestamp: new Date(),
        details,
        ipAddress,
        userAgent,
        changes: details
    });
    
    // Keep only last 100 audit entries
    if (this.auditLog.length > 100) {
        this.auditLog = this.auditLog.slice(-100);
    }
    
    return this.save();
};

discordTaskPostSchema.methods.isExpired = function() {
    return this.timing.endTime && this.timing.endTime < new Date();
};

discordTaskPostSchema.methods.getTimeRemaining = function() {
    if (!this.timing.endTime) return null;
    const now = new Date();
    const remaining = this.timing.endTime.getTime() - now.getTime();
    return remaining > 0 ? remaining : 0;
};

// Static Methods
discordTaskPostSchema.statics.findByTask = function(taskId) {
    return this.find({ taskId, 'lifecycle.isActive': true });
};

discordTaskPostSchema.statics.findByGuild = function(guildId, includeArchived = false) {
    const query = { guildId };
    if (!includeArchived) {
        query['lifecycle.isArchived'] = false;
    }
    return this.find(query).sort({ 'creationData.createdAt': -1 });
};

discordTaskPostSchema.statics.findByMessage = function(messageId) {
    return this.findOne({ messageId, 'lifecycle.isActive': true });
};

discordTaskPostSchema.statics.findActiveByGuild = function(guildId) {
    return this.find({
        guildId,
        'taskData.status': 'active',
        'lifecycle.isActive': true,
        'lifecycle.isArchived': false,
        $or: [
            { 'timing.endTime': { $gt: new Date() } },
            { 'timing.endTime': { $exists: false } }
        ]
    }).sort({ 'creationData.createdAt': -1 });
};

discordTaskPostSchema.statics.findExpiredTasks = function() {
    return this.find({
        'taskData.status': 'active',
        'timing.endTime': { $lte: new Date() },
        'lifecycle.isActive': true
    });
};

discordTaskPostSchema.statics.getCompletionStats = function(guildId, days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return this.aggregate([
        { 
            $match: { 
                guildId, 
                'lifecycle.isActive': true,
                'creationData.createdAt': { $gte: cutoffDate }
            } 
        },
        {
            $group: {
                _id: null,
                totalTasks: { $sum: 1 },
                totalViews: { $sum: '$interactionStats.views' },
                totalCompletions: { $sum: '$interactionStats.completions' },
                avgViewsPerTask: { $avg: '$interactionStats.views' },
                avgCompletionsPerTask: { $avg: '$interactionStats.completions' },
                avgConversionRate: { $avg: '$analytics.conversionRate' },
                avgEngagementScore: { $avg: '$analytics.engagementScore' }
            }
        }
    ]);
};

discordTaskPostSchema.statics.getTopPerformingTasks = function(guildId, limit = 10) {
    return this.find({
        guildId,
        'lifecycle.isActive': true,
        'lifecycle.isArchived': false
    })
    .sort({ 'analytics.engagementScore': -1 })
    .limit(limit)
    .select('taskData.title taskData.type interactionStats analytics');
};

discordTaskPostSchema.statics.getTasksByStatus = function(status) {
    return this.find({ 
        'taskData.status': status,
        'lifecycle.isActive': true 
    }).sort({ 'creationData.createdAt': -1 });
};

discordTaskPostSchema.statics.getAnalyticsSummary = function(guildId, days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return this.aggregate([
        {
            $match: {
                guildId,
                'lifecycle.isActive': true,
                'creationData.createdAt': { $gte: cutoffDate }
            }
        },
        {
            $group: {
                _id: '$taskData.type',
                count: { $sum: 1 },
                totalViews: { $sum: '$interactionStats.views' },
                totalCompletions: { $sum: '$interactionStats.completions' },
                avgConversionRate: { $avg: '$analytics.conversionRate' },
                avgEngagementScore: { $avg: '$analytics.engagementScore' }
            }
        },
        { $sort: { totalCompletions: -1 } }
    ]);
};

module.exports = mongoose.model('DiscordTaskPost', discordTaskPostSchema);