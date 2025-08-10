const mongoose = require('mongoose');

const discordServerMappingSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    communityId: {
        type: String,
        required: true,
        index: true
    },
    linkedBy: {
        type: String,
        required: true,
        index: true
    },
    linkedAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    
    // Guild Information
    guildInfo: {
        name: {
            type: String,
            required: true
        },
        icon: String,
        memberCount: {
            type: Number,
            default: 0
        },
        ownerId: String,
        preferredLocale: String,
        features: [String],
        premiumTier: {
            type: Number,
            default: 0
        },
        verificationLevel: Number,
        lastUpdated: {
            type: Date,
            default: Date.now
        }
    },

    // Bot Configuration
    botConfig: {
        defaultChannel: String,
        allowedRoles: [{
            roleId: String,
            roleName: String,
            permissions: {
                createTasks: {
                    type: Boolean,
                    default: false
                },
                connectAllowlists: {
                    type: Boolean,
                    default: false
                },
                manageSettings: {
                    type: Boolean,
                    default: false
                }
            }
        }],
        autoPostTasks: {
            type: Boolean,
            default: true
        },
        autoPostAllowlists: {
            type: Boolean,
            default: true
        },
        notificationSettings: {
            taskCompletions: {
                type: Boolean,
                default: true
            },
            allowlistEntries: {
                type: Boolean,
                default: true
            },
            systemAlerts: {
                type: Boolean,
                default: true
            }
        }
    },

    // Activity Tracking
    activityStats: {
        totalTasksCreated: {
            type: Number,
            default: 0
        },
        totalAllowlistsConnected: {
            type: Number,
            default: 0
        },
        totalInteractions: {
            type: Number,
            default: 0
        },
        uniqueActiveUsers: {
            type: Number,
            default: 0
        },
        lastActivity: Date,
        lastTaskCreated: Date,
        lastAllowlistConnected: Date
    },

    // Integration Status
    integrationStatus: {
        isHealthy: {
            type: Boolean,
            default: true
        },
        lastHealthCheck: {
            type: Date,
            default: Date.now
        },
        apiConnectionStatus: {
            type: String,
            enum: ['connected', 'disconnected', 'error'],
            default: 'connected'
        },
        lastApiError: {
            message: String,
            timestamp: Date,
            errorCode: String
        },
        webhookStatus: {
            isActive: {
                type: Boolean,
                default: false
            },
            webhookUrl: String,
            lastWebhookEvent: Date
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
        ipAddress: String
    }]
}, {
    timestamps: true
});

// Compound Indexes for Performance
discordServerMappingSchema.index({ guildId: 1, communityId: 1 });
discordServerMappingSchema.index({ communityId: 1, isActive: 1 });
discordServerMappingSchema.index({ linkedBy: 1, linkedAt: -1 });
discordServerMappingSchema.index({ 'activityStats.lastActivity': -1 });
discordServerMappingSchema.index({ 'integrationStatus.isHealthy': 1, isActive: 1 });

// TTL Index for inactive mappings (cleanup after 1 year of inactivity)
discordServerMappingSchema.index(
    { 'activityStats.lastActivity': 1 }, 
    { 
        expireAfterSeconds: 365 * 24 * 60 * 60,
        partialFilterExpression: { isActive: false }
    }
);

// Instance Methods
discordServerMappingSchema.methods.updateActivity = function() {
    this.activityStats.lastActivity = new Date();
    this.activityStats.totalInteractions += 1;
    return this.save();
};

discordServerMappingSchema.methods.updateGuildInfo = function(guildData) {
    this.guildInfo = {
        ...this.guildInfo,
        name: guildData.name,
        icon: guildData.iconURL?.() || null,
        memberCount: guildData.memberCount,
        ownerId: guildData.ownerId,
        preferredLocale: guildData.preferredLocale,
        features: guildData.features || [],
        premiumTier: guildData.premiumTier || 0,
        verificationLevel: guildData.verificationLevel,
        lastUpdated: new Date()
    };
    return this.save();
};

discordServerMappingSchema.methods.incrementTaskCreated = function() {
    this.activityStats.totalTasksCreated += 1;
    this.activityStats.lastTaskCreated = new Date();
    this.activityStats.lastActivity = new Date();
    return this.save();
};

discordServerMappingSchema.methods.incrementAllowlistConnected = function() {
    this.activityStats.totalAllowlistsConnected += 1;
    this.activityStats.lastAllowlistConnected = new Date();
    this.activityStats.lastActivity = new Date();
    return this.save();
};

discordServerMappingSchema.methods.updateHealthStatus = function(isHealthy, errorDetails = null) {
    this.integrationStatus.isHealthy = isHealthy;
    this.integrationStatus.lastHealthCheck = new Date();
    
    if (!isHealthy && errorDetails) {
        this.integrationStatus.lastApiError = {
            message: errorDetails.message,
            timestamp: new Date(),
            errorCode: errorDetails.code
        };
        this.integrationStatus.apiConnectionStatus = 'error';
    } else if (isHealthy) {
        this.integrationStatus.apiConnectionStatus = 'connected';
    }
    
    return this.save();
};

discordServerMappingSchema.methods.addAuditEntry = function(action, performedBy, details = {}, ipAddress = null) {
    this.auditLog.push({
        action,
        performedBy,
        timestamp: new Date(),
        details,
        ipAddress
    });
    
    // Keep only last 100 audit entries
    if (this.auditLog.length > 100) {
        this.auditLog = this.auditLog.slice(-100);
    }
    
    return this.save();
};

discordServerMappingSchema.methods.deactivate = function(reason, performedBy) {
    this.isActive = false;
    this.addAuditEntry('deactivated', performedBy, { reason });
    return this.save();
};

// Static Methods
discordServerMappingSchema.statics.findByGuild = function(guildId) {
    return this.findOne({ guildId, isActive: true });
};

discordServerMappingSchema.statics.findByCommunity = function(communityId) {
    return this.find({ communityId, isActive: true });
};

discordServerMappingSchema.statics.getActiveCount = function() {
    return this.countDocuments({ isActive: true });
};

discordServerMappingSchema.statics.getHealthyCount = function() {
    return this.countDocuments({ 
        isActive: true, 
        'integrationStatus.isHealthy': true 
    });
};

discordServerMappingSchema.statics.findUnhealthyMappings = function() {
    return this.find({
        isActive: true,
        'integrationStatus.isHealthy': false
    }).sort({ 'integrationStatus.lastHealthCheck': 1 });
};

discordServerMappingSchema.statics.getActivityStats = function(days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return this.aggregate([
        {
            $match: {
                isActive: true,
                'activityStats.lastActivity': { $gte: cutoffDate }
            }
        },
        {
            $group: {
                _id: null,
                totalServers: { $sum: 1 },
                totalTasks: { $sum: '$activityStats.totalTasksCreated' },
                totalAllowlists: { $sum: '$activityStats.totalAllowlistsConnected' },
                totalInteractions: { $sum: '$activityStats.totalInteractions' },
                avgTasksPerServer: { $avg: '$activityStats.totalTasksCreated' },
                avgAllowlistsPerServer: { $avg: '$activityStats.totalAllowlistsConnected' }
            }
        }
    ]);
};

discordServerMappingSchema.statics.findInactiveMappings = function(days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return this.find({
        isActive: true,
        $or: [
            { 'activityStats.lastActivity': { $lt: cutoffDate } },
            { 'activityStats.lastActivity': { $exists: false } }
        ]
    }).sort({ 'activityStats.lastActivity': 1 });
};

module.exports = mongoose.model('DiscordServerMapping', discordServerMappingSchema);