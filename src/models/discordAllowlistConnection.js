const mongoose = require('mongoose');

const discordAllowlistConnectionSchema = new mongoose.Schema({
    allowlistId: {
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
    
    // Connection Information
    connectionData: {
        connectedBy: {
            type: String,
            required: true,
            index: true
        },
        connectedAt: {
            type: Date,
            default: Date.now,
            index: true
        },
        connectionMethod: {
            type: String,
            enum: ['slash_command', 'api', 'webhook', 'manual'],
            default: 'slash_command'
        },
        connectorRole: String,
        connectorPermissions: [String]
    },

    // Allowlist Information
    allowlistData: {
        title: {
            type: String,
            required: true
        },
        description: String,
        prize: {
            type: String,
            required: true
        },
        prizeValue: {
            amount: Number,
            currency: String,
            usdValue: Number
        },
        winnerCount: {
            type: Number,
            required: true
        },
        maxEntries: Number,
        entryPrice: {
            amount: {
                type: Number,
                default: 0
            },
            currency: String,
            isFree: {
                type: Boolean,
                default: true
            }
        },
        requirements: [{
            type: String,
            description: String,
            isRequired: Boolean,
            verificationData: mongoose.Schema.Types.Mixed
        }],
        category: String,
        tags: [String],
        status: {
            type: String,
            enum: ['active', 'paused', 'completed', 'expired', 'cancelled'],
            default: 'active',
            index: true
        }
    },

    // Timing Information
    timing: {
        startTime: {
            type: Date,
            default: Date.now
        },
        endTime: {
            type: Date,
            required: true,
            index: true
        },
        duration: Number, // in minutes
        timeZone: String,
        countdownEnabled: {
            type: Boolean,
            default: true
        },
        remindersSent: [{
            type: String, // e.g., "24h", "1h", "15m"
            sentAt: Date
        }]
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
        }],
        pinnedAt: Date,
        pinnedBy: String
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
        entries: {
            type: Number,
            default: 0
        },
        attempts: {
            type: Number,
            default: 0
        },
        successfulEntries: {
            type: Number,
            default: 0
        },
        failedEntries: {
            type: Number,
            default: 0
        },
        conversionRate: {
            type: Number,
            default: 0
        },
        lastInteraction: Date,
        peakInteractionHour: Number,
        interactionsByHour: [{
            hour: Number,
            count: Number
        }]
    },

    // User Engagement Data
    engagement: {
        viewerIds: [String], // Discord user IDs who viewed
        entrantIds: [String], // Discord user IDs who entered
        interestedIds: [String], // Users who reacted with interest
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
        },
        bookmarks: {
            type: Number,
            default: 0
        }
    },

    // Entry Management
    entryManagement: {
        entryQueue: [{
            userId: String,
            username: String,
            entryTime: Date,
            status: {
                type: String,
                enum: ['pending', 'approved', 'rejected', 'processing'],
                default: 'pending'
            },
            verificationData: mongoose.Schema.Types.Mixed,
            rejectionReason: String
        }],
        duplicateAttempts: [{
            userId: String,
            attemptTime: Date,
            ipAddress: String
        }],
        fraudulentAttempts: [{
            userId: String,
            attemptTime: Date,
            reason: String,
            flaggedBy: String
        }],
        waitingList: [{
            userId: String,
            username: String,
            joinedWaitingListAt: Date,
            notified: Boolean
        }]
    },

    // Performance Analytics
    analytics: {
        engagementScore: Number, // calculated engagement metric
        viralityScore: Number, // shares and reactions metric
        qualityScore: Number, // overall allowlist quality metric
        competitiveness: Number, // entries vs winner count ratio
        popularityTrend: [{
            date: Date,
            views: Number,
            entries: Number,
            engagement: Number
        }],
        demographicData: {
            topCountries: [String],
            topTimezones: [String],
            entryMethods: mongoose.Schema.Types.Mixed
        },
        performanceMetrics: {
            averageEntryTime: Number, // seconds from view to entry
            bounceRate: Number, // percentage who viewed but didn't enter
            completionRate: Number, // percentage who completed entry process
            retentionRate: Number // percentage who stayed engaged
        }
    },

    // Winner Information (populated after draw)
    winnerData: {
        isDrawn: {
            type: Boolean,
            default: false
        },
        drawnAt: Date,
        drawnBy: String,
        winners: [{
            userId: String,
            username: String,
            position: Number,
            notified: Boolean,
            notifiedAt: Date,
            claimed: Boolean,
            claimedAt: Date
        }],
        drawMethod: String, // e.g., "VRF", "manual", "automated"
        vrfRequestId: String,
        randomSeed: String,
        isVerifiable: Boolean
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
        }],
        lastDataUpdate: Date,
        dataVersion: {
            type: Number,
            default: 1
        }
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
        }],
        riskScore: {
            type: Number,
            default: 0
        }
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
discordAllowlistConnectionSchema.index({ allowlistId: 1, guildId: 1 });
discordAllowlistConnectionSchema.index({ guildId: 1, 'allowlistData.status': 1 });
discordAllowlistConnectionSchema.index({ messageId: 1, 'lifecycle.isActive': 1 });
discordAllowlistConnectionSchema.index({ 'connectionData.connectedBy': 1, 'connectionData.connectedAt': -1 });
discordAllowlistConnectionSchema.index({ 'timing.endTime': 1, 'allowlistData.status': 1 });
discordAllowlistConnectionSchema.index({ 'interactionStats.lastInteraction': -1 });
discordAllowlistConnectionSchema.index({ 'lifecycle.isActive': 1, 'lifecycle.isArchived': 1 });
discordAllowlistConnectionSchema.index({ 'winnerData.isDrawn': 1, 'timing.endTime': 1 });

// TTL Index for expired allowlists (cleanup after 180 days of expiration)
discordAllowlistConnectionSchema.index(
    { 'timing.endTime': 1 }, 
    { 
        expireAfterSeconds: 180 * 24 * 60 * 60,
        partialFilterExpression: { 
            'allowlistData.status': { $in: ['expired', 'completed', 'cancelled'] }
        }
    }
);

// Text Index for Search
discordAllowlistConnectionSchema.index({
    'allowlistData.title': 'text',
    'allowlistData.description': 'text',
    'allowlistData.prize': 'text',
    'allowlistData.category': 'text'
});

// Instance Methods
discordAllowlistConnectionSchema.methods.incrementViews = function(userId = null) {
    this.interactionStats.views += 1;
    this.interactionStats.lastInteraction = new Date();
    
    if (userId && !this.engagement.viewerIds.includes(userId)) {
        this.engagement.viewerIds.push(userId);
        this.interactionStats.uniqueViews += 1;
    }
    
    this.updateAnalytics();
    return this.save();
};

discordAllowlistConnectionSchema.methods.incrementEntries = function(userId) {
    this.interactionStats.entries += 1;
    this.interactionStats.successfulEntries += 1;
    this.interactionStats.lastInteraction = new Date();
    
    if (userId && !this.engagement.entrantIds.includes(userId)) {
        this.engagement.entrantIds.push(userId);
    }
    
    this.updateAnalytics();
    return this.save();
};

discordAllowlistConnectionSchema.methods.incrementAttempts = function(success = true) {
    this.interactionStats.attempts += 1;
    
    if (success) {
        this.interactionStats.successfulEntries += 1;
    } else {
        this.interactionStats.failedEntries += 1;
    }
    
    this.updateConversionRate();
    return this.save();
};

discordAllowlistConnectionSchema.methods.updateConversionRate = function() {
    if (this.interactionStats.views > 0) {
        this.interactionStats.conversionRate = 
            (this.interactionStats.entries / this.interactionStats.views) * 100;
    }
};

discordAllowlistConnectionSchema.methods.updateAnalytics = function() {
    // Calculate engagement score (weighted metric)
    const viewWeight = 1;
    const entryWeight = 10;
    const shareWeight = 5;
    const reactionWeight = 3;
    
    const totalReactions = this.engagement.reactions.reduce((sum, r) => sum + r.count, 0);
    
    this.analytics.engagementScore = 
        (this.interactionStats.views * viewWeight) +
        (this.interactionStats.entries * entryWeight) +
        (this.engagement.shares * shareWeight) +
        (totalReactions * reactionWeight);
    
    // Calculate competitiveness
    if (this.allowlistData.winnerCount > 0) {
        this.analytics.competitiveness = this.interactionStats.entries / this.allowlistData.winnerCount;
    }
    
    // Update conversion rate
    this.updateConversionRate();
};

discordAllowlistConnectionSchema.methods.addEntry = function(userId, username, verificationData = {}) {
    // Check for duplicate entry
    const existingEntry = this.entryManagement.entryQueue.find(e => e.userId === userId);
    if (existingEntry) {
        this.entryManagement.duplicateAttempts.push({
            userId,
            attemptTime: new Date(),
            ipAddress: verificationData.ipAddress
        });
        return false;
    }
    
    this.entryManagement.entryQueue.push({
        userId,
        username,
        entryTime: new Date(),
        status: 'pending',
        verificationData
    });
    
    this.incrementEntries(userId);
    return this.save();
};

discordAllowlistConnectionSchema.methods.approveEntry = function(userId, approvedBy) {
    const entry = this.entryManagement.entryQueue.find(e => e.userId === userId);
    if (entry) {
        entry.status = 'approved';
        this.addAuditEntry('entry_approved', approvedBy, { userId, username: entry.username });
    }
    return this.save();
};

discordAllowlistConnectionSchema.methods.rejectEntry = function(userId, rejectedBy, reason) {
    const entry = this.entryManagement.entryQueue.find(e => e.userId === userId);
    if (entry) {
        entry.status = 'rejected';
        entry.rejectionReason = reason;
        this.addAuditEntry('entry_rejected', rejectedBy, { userId, username: entry.username, reason });
    }
    return this.save();
};

discordAllowlistConnectionSchema.methods.updateAllowlistData = function(allowlistData) {
    const oldData = this.allowlistData.toObject();
    this.allowlistData = { ...this.allowlistData.toObject(), ...allowlistData };
    this.messageData.lastUpdated = new Date();
    this.messageData.updateCount += 1;
    this.syncData.lastDataUpdate = new Date();
    this.syncData.dataVersion += 1;
    
    this.addAuditEntry('allowlist_updated', 'system', {
        oldData,
        newData: allowlistData
    });
    
    return this.save();
};

discordAllowlistConnectionSchema.methods.updateStatus = function(newStatus, changedBy, reason = null) {
    const oldStatus = this.allowlistData.status;
    this.allowlistData.status = newStatus;
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

discordAllowlistConnectionSchema.methods.setWinners = function(winners, drawnBy, drawMethod = 'VRF', vrfData = {}) {
    this.winnerData.isDrawn = true;
    this.winnerData.drawnAt = new Date();
    this.winnerData.drawnBy = drawnBy;
    this.winnerData.drawMethod = drawMethod;
    this.winnerData.vrfRequestId = vrfData.requestId;
    this.winnerData.randomSeed = vrfData.randomSeed;
    this.winnerData.isVerifiable = drawMethod === 'VRF';
    
    this.winnerData.winners = winners.map((winner, index) => ({
        userId: winner.userId,
        username: winner.username,
        position: index + 1,
        notified: false,
        claimed: false
    }));
    
    this.updateStatus('completed', drawnBy, 'Winners drawn');
    
    this.addAuditEntry('winners_drawn', drawnBy, {
        winnerCount: winners.length,
        drawMethod,
        vrfData
    });
    
    return this.save();
};

discordAllowlistConnectionSchema.methods.addReaction = function(emoji, userId) {
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
    
    this.updateAnalytics();
    return this.save();
};

discordAllowlistConnectionSchema.methods.addComment = function(userId, username, content) {
    this.engagement.comments.push({
        userId,
        username,
        content,
        timestamp: new Date(),
        isModerated: false
    });
    
    return this.save();
};

discordAllowlistConnectionSchema.methods.archive = function(archivedBy, reason = null) {
    this.lifecycle.isArchived = true;
    this.lifecycle.isActive = false;
    this.lifecycle.archivedAt = new Date();
    this.lifecycle.archivedBy = archivedBy;
    this.lifecycle.archivedReason = reason;
    
    this.addAuditEntry('archived', archivedBy, { reason });
    return this.save();
};

discordAllowlistConnectionSchema.methods.addAuditEntry = function(action, performedBy, details = {}, ipAddress = null, userAgent = null) {
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

discordAllowlistConnectionSchema.methods.isExpired = function() {
    return this.timing.endTime && this.timing.endTime < new Date();
};

discordAllowlistConnectionSchema.methods.getTimeRemaining = function() {
    if (!this.timing.endTime) return null;
    const now = new Date();
    const remaining = this.timing.endTime.getTime() - now.getTime();
    return remaining > 0 ? remaining : 0;
};

discordAllowlistConnectionSchema.methods.getEntryCount = function() {
    return this.entryManagement.entryQueue.filter(e => e.status === 'approved').length;
};

// Static Methods
discordAllowlistConnectionSchema.statics.findByAllowlist = function(allowlistId) {
    return this.find({ allowlistId, 'lifecycle.isActive': true });
};

discordAllowlistConnectionSchema.statics.findByGuild = function(guildId, includeArchived = false) {
    const query = { guildId };
    if (!includeArchived) {
        query['lifecycle.isArchived'] = false;
    }
    return this.find(query).sort({ 'connectionData.connectedAt': -1 });
};

discordAllowlistConnectionSchema.statics.findByMessage = function(messageId) {
    return this.findOne({ messageId, 'lifecycle.isActive': true });
};

discordAllowlistConnectionSchema.statics.findConnection = function(allowlistId, guildId) {
    return this.findOne({ 
        allowlistId, 
        guildId, 
        'lifecycle.isActive': true 
    });
};

discordAllowlistConnectionSchema.statics.findActiveByGuild = function(guildId) {
    return this.find({
        guildId,
        'allowlistData.status': 'active',
        'lifecycle.isActive': true,
        'lifecycle.isArchived': false,
        'timing.endTime': { $gt: new Date() }
    }).sort({ 'timing.endTime': 1 });
};

discordAllowlistConnectionSchema.statics.findExpiredAllowlists = function() {
    return this.find({
        'allowlistData.status': 'active',
        'timing.endTime': { $lte: new Date() },
        'lifecycle.isActive': true
    });
};

discordAllowlistConnectionSchema.statics.getEntryStats = function(guildId, days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return this.aggregate([
        { 
            $match: { 
                guildId, 
                'lifecycle.isActive': true,
                'connectionData.connectedAt': { $gte: cutoffDate }
            } 
        },
        {
            $group: {
                _id: null,
                totalAllowlists: { $sum: 1 },
                totalViews: { $sum: '$interactionStats.views' },
                totalEntries: { $sum: '$interactionStats.entries' },
                avgViewsPerAllowlist: { $avg: '$interactionStats.views' },
                avgEntriesPerAllowlist: { $avg: '$interactionStats.entries' },
                avgConversionRate: { $avg: '$interactionStats.conversionRate' },
                avgEngagementScore: { $avg: '$analytics.engagementScore' }
            }
        }
    ]);
};

discordAllowlistConnectionSchema.statics.getTopPerformingAllowlists = function(guildId, limit = 10) {
    return this.find({
        guildId,
        'lifecycle.isActive': true,
        'lifecycle.isArchived': false
    })
    .sort({ 'analytics.engagementScore': -1 })
    .limit(limit)
    .select('allowlistData.title allowlistData.prize interactionStats analytics');
};

discordAllowlistConnectionSchema.statics.findByStatus = function(status) {
    return this.find({ 
        'allowlistData.status': status, 
        'lifecycle.isActive': true 
    }).sort({ 'connectionData.connectedAt': -1 });
};

discordAllowlistConnectionSchema.statics.getAnalyticsSummary = function(guildId, days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return this.aggregate([
        {
            $match: {
                guildId,
                'lifecycle.isActive': true,
                'connectionData.connectedAt': { $gte: cutoffDate }
            }
        },
        {
            $group: {
                _id: '$allowlistData.category',
                count: { $sum: 1 },
                totalViews: { $sum: '$interactionStats.views' },
                totalEntries: { $sum: '$interactionStats.entries' },
                avgConversionRate: { $avg: '$interactionStats.conversionRate' },
                avgEngagementScore: { $avg: '$analytics.engagementScore' },
                avgCompetitiveness: { $avg: '$analytics.competitiveness' }
            }
        },
        { $sort: { totalEntries: -1 } }
    ]);
};

module.exports = mongoose.model('DiscordAllowlistConnection', discordAllowlistConnectionSchema);