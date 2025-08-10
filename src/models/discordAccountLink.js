const mongoose = require('mongoose');
const crypto = require('crypto');

const discordAccountLinkSchema = new mongoose.Schema({
    discordId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    nafflesUserId: {
        type: String,
        required: true,
        index: true
    },
    
    // Discord User Information
    discordUserInfo: {
        username: {
            type: String,
            required: true
        },
        discriminator: String,
        globalName: String,
        avatar: String,
        banner: String,
        accentColor: Number,
        locale: String,
        verified: Boolean,
        mfaEnabled: Boolean,
        premiumType: Number,
        publicFlags: Number,
        lastUpdated: {
            type: Date,
            default: Date.now
        }
    },

    // Naffles User Information
    nafflesUserInfo: {
        username: {
            type: String,
            required: true
        },
        walletAddress: String,
        email: String,
        tier: String,
        lastUpdated: {
            type: Date,
            default: Date.now
        }
    },

    // Linking Information
    linkingData: {
        method: {
            type: String,
            enum: ['oauth', 'manual', 'verification_code', 'admin_link'],
            default: 'oauth'
        },
        linkedAt: {
            type: Date,
            default: Date.now,
            index: true
        },
        linkedBy: String, // Admin user ID if manually linked
        lastVerified: {
            type: Date,
            default: Date.now
        },
        verificationToken: String,
        tokenExpiresAt: Date,
        ipAddress: String,
        userAgent: String
    },

    // OAuth Token Management (Encrypted)
    oauthTokens: {
        accessToken: String, // Encrypted
        refreshToken: String, // Encrypted
        tokenType: String,
        scope: String,
        expiresAt: Date,
        lastRefreshed: Date
    },

    // Status and Permissions
    status: {
        isActive: {
            type: Boolean,
            default: true,
            index: true
        },
        isVerified: {
            type: Boolean,
            default: false
        },
        isSuspended: {
            type: Boolean,
            default: false
        },
        suspensionReason: String,
        suspendedAt: Date,
        suspendedBy: String
    },

    // Permissions
    permissions: {
        allowTaskCompletion: {
            type: Boolean,
            default: true
        },
        allowAllowlistEntry: {
            type: Boolean,
            default: true
        },
        allowPointsEarning: {
            type: Boolean,
            default: true
        },
        allowNotifications: {
            type: Boolean,
            default: true
        },
        dataProcessingConsent: {
            type: Boolean,
            default: false
        },
        consentTimestamp: Date
    },

    // Activity Statistics
    activityStats: {
        totalTasksCompleted: {
            type: Number,
            default: 0
        },
        totalPointsEarned: {
            type: Number,
            default: 0
        },
        totalAllowlistsEntered: {
            type: Number,
            default: 0
        },
        totalInteractions: {
            type: Number,
            default: 0
        },
        lastActivity: Date,
        lastTaskCompletion: Date,
        lastAllowlistEntry: Date,
        averageResponseTime: Number,
        preferredInteractionTime: String // e.g., "morning", "evening"
    },

    // Security and Audit
    securityData: {
        loginAttempts: {
            type: Number,
            default: 0
        },
        lastLoginAttempt: Date,
        isLocked: {
            type: Boolean,
            default: false
        },
        lockReason: String,
        lockedAt: Date,
        lockedBy: String,
        failedVerifications: {
            type: Number,
            default: 0
        },
        lastFailedVerification: Date,
        suspiciousActivityFlags: [{
            type: String,
            timestamp: Date,
            details: mongoose.Schema.Types.Mixed
        }]
    },

    // Audit Trail
    auditLog: [{
        action: {
            type: String,
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        performedBy: String,
        details: mongoose.Schema.Types.Mixed,
        ipAddress: String,
        userAgent: String
    }]
}, {
    timestamps: true
});

// Compound Indexes for Performance
discordAccountLinkSchema.index({ discordId: 1, nafflesUserId: 1 });
discordAccountLinkSchema.index({ nafflesUserId: 1, 'status.isActive': 1 });
discordAccountLinkSchema.index({ 'linkingData.linkedAt': -1 });
discordAccountLinkSchema.index({ 'activityStats.lastActivity': -1 });
discordAccountLinkSchema.index({ 'status.isActive': 1, 'status.isVerified': 1 });
discordAccountLinkSchema.index({ 'oauthTokens.expiresAt': 1 });

// TTL Index for expired verification tokens
discordAccountLinkSchema.index(
    { 'linkingData.tokenExpiresAt': 1 }, 
    { 
        expireAfterSeconds: 0,
        partialFilterExpression: { 
            'linkingData.verificationToken': { $exists: true },
            'status.isVerified': false
        }
    }
);

// TTL Index for inactive accounts (cleanup after 2 years of inactivity)
discordAccountLinkSchema.index(
    { 'activityStats.lastActivity': 1 }, 
    { 
        expireAfterSeconds: 2 * 365 * 24 * 60 * 60,
        partialFilterExpression: { 'status.isActive': false }
    }
);

// Encryption/Decryption Methods
const ENCRYPTION_KEY = process.env.DISCORD_TOKEN_ENCRYPTION_KEY || 'default-key-change-in-production';

function encrypt(text) {
    if (!text) return null;
    const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

function decrypt(encryptedText) {
    if (!encryptedText) return null;
    try {
        const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        return null;
    }
}

// Pre-save middleware for token encryption
discordAccountLinkSchema.pre('save', function(next) {
    if (this.isModified('oauthTokens.accessToken') && this.oauthTokens.accessToken) {
        this.oauthTokens.accessToken = encrypt(this.oauthTokens.accessToken);
    }
    if (this.isModified('oauthTokens.refreshToken') && this.oauthTokens.refreshToken) {
        this.oauthTokens.refreshToken = encrypt(this.oauthTokens.refreshToken);
    }
    next();
});

// Instance Methods
discordAccountLinkSchema.methods.getDecryptedTokens = function() {
    return {
        accessToken: decrypt(this.oauthTokens.accessToken),
        refreshToken: decrypt(this.oauthTokens.refreshToken),
        tokenType: this.oauthTokens.tokenType,
        scope: this.oauthTokens.scope,
        expiresAt: this.oauthTokens.expiresAt
    };
};

discordAccountLinkSchema.methods.updateTokens = function(tokenData) {
    this.oauthTokens = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenType: tokenData.token_type,
        scope: tokenData.scope,
        expiresAt: new Date(Date.now() + (tokenData.expires_in * 1000)),
        lastRefreshed: new Date()
    };
    return this.save();
};

discordAccountLinkSchema.methods.updateActivity = function(activityType = 'general') {
    this.activityStats.lastActivity = new Date();
    this.activityStats.totalInteractions += 1;
    
    if (activityType === 'task') {
        this.activityStats.lastTaskCompletion = new Date();
    } else if (activityType === 'allowlist') {
        this.activityStats.lastAllowlistEntry = new Date();
    }
    
    return this.save();
};

discordAccountLinkSchema.methods.incrementTaskCompletion = function(points = 0) {
    this.activityStats.totalTasksCompleted += 1;
    this.activityStats.totalPointsEarned += points;
    this.activityStats.lastTaskCompletion = new Date();
    this.activityStats.lastActivity = new Date();
    return this.save();
};

discordAccountLinkSchema.methods.incrementAllowlistEntry = function() {
    this.activityStats.totalAllowlistsEntered += 1;
    this.activityStats.lastAllowlistEntry = new Date();
    this.activityStats.lastActivity = new Date();
    return this.save();
};

discordAccountLinkSchema.methods.updateDiscordInfo = function(discordUser) {
    this.discordUserInfo = {
        username: discordUser.username,
        discriminator: discordUser.discriminator,
        globalName: discordUser.global_name,
        avatar: discordUser.avatar,
        banner: discordUser.banner,
        accentColor: discordUser.accent_color,
        locale: discordUser.locale,
        verified: discordUser.verified,
        mfaEnabled: discordUser.mfa_enabled,
        premiumType: discordUser.premium_type,
        publicFlags: discordUser.public_flags,
        lastUpdated: new Date()
    };
    this.linkingData.lastVerified = new Date();
    return this.save();
};

discordAccountLinkSchema.methods.updateNafflesInfo = function(nafflesUser) {
    this.nafflesUserInfo = {
        username: nafflesUser.username,
        walletAddress: nafflesUser.walletAddress,
        email: nafflesUser.email,
        tier: nafflesUser.tier,
        lastUpdated: new Date()
    };
    return this.save();
};

discordAccountLinkSchema.methods.addAuditEntry = function(action, performedBy, details = {}, ipAddress = null, userAgent = null) {
    this.auditLog.push({
        action,
        timestamp: new Date(),
        performedBy,
        details,
        ipAddress,
        userAgent
    });
    
    // Keep only last 50 audit entries
    if (this.auditLog.length > 50) {
        this.auditLog = this.auditLog.slice(-50);
    }
    
    return this.save();
};

discordAccountLinkSchema.methods.suspend = function(reason, suspendedBy) {
    this.status.isSuspended = true;
    this.status.suspensionReason = reason;
    this.status.suspendedAt = new Date();
    this.status.suspendedBy = suspendedBy;
    this.addAuditEntry('suspended', suspendedBy, { reason });
    return this.save();
};

discordAccountLinkSchema.methods.unsuspend = function(unsuspendedBy) {
    this.status.isSuspended = false;
    this.status.suspensionReason = null;
    this.status.suspendedAt = null;
    this.status.suspendedBy = null;
    this.addAuditEntry('unsuspended', unsuspendedBy);
    return this.save();
};

discordAccountLinkSchema.methods.deactivate = function(reason, performedBy) {
    this.status.isActive = false;
    this.addAuditEntry('deactivated', performedBy, { reason });
    return this.save();
};

discordAccountLinkSchema.methods.isTokenExpired = function() {
    return this.oauthTokens.expiresAt && this.oauthTokens.expiresAt < new Date();
};

discordAccountLinkSchema.methods.flagSuspiciousActivity = function(flagType, details) {
    this.securityData.suspiciousActivityFlags.push({
        type: flagType,
        timestamp: new Date(),
        details
    });
    
    // Keep only last 10 flags
    if (this.securityData.suspiciousActivityFlags.length > 10) {
        this.securityData.suspiciousActivityFlags = this.securityData.suspiciousActivityFlags.slice(-10);
    }
    
    return this.save();
};

// Static Methods
discordAccountLinkSchema.statics.findByDiscord = function(discordId) {
    return this.findOne({ 
        discordId, 
        'status.isActive': true,
        'status.isSuspended': false
    });
};

discordAccountLinkSchema.statics.findByNaffles = function(nafflesUserId) {
    return this.findOne({ 
        nafflesUserId, 
        'status.isActive': true,
        'status.isSuspended': false
    });
};

discordAccountLinkSchema.statics.getActiveCount = function() {
    return this.countDocuments({ 
        'status.isActive': true,
        'status.isSuspended': false
    });
};

discordAccountLinkSchema.statics.getVerifiedCount = function() {
    return this.countDocuments({ 
        'status.isActive': true,
        'status.isVerified': true,
        'status.isSuspended': false
    });
};

discordAccountLinkSchema.statics.findExpiredTokens = function() {
    return this.find({
        'status.isActive': true,
        'oauthTokens.expiresAt': { $lt: new Date() }
    });
};

discordAccountLinkSchema.statics.getActivityStats = function(days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return this.aggregate([
        {
            $match: {
                'status.isActive': true,
                'activityStats.lastActivity': { $gte: cutoffDate }
            }
        },
        {
            $group: {
                _id: null,
                totalLinks: { $sum: 1 },
                totalTasksCompleted: { $sum: '$activityStats.totalTasksCompleted' },
                totalPointsEarned: { $sum: '$activityStats.totalPointsEarned' },
                totalAllowlistsEntered: { $sum: '$activityStats.totalAllowlistsEntered' },
                avgTasksPerUser: { $avg: '$activityStats.totalTasksCompleted' },
                avgPointsPerUser: { $avg: '$activityStats.totalPointsEarned' },
                avgAllowlistsPerUser: { $avg: '$activityStats.totalAllowlistsEntered' }
            }
        }
    ]);
};

discordAccountLinkSchema.statics.findRecentlyActive = function(days = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return this.find({
        'status.isActive': true,
        'activityStats.lastActivity': { $gte: cutoffDate }
    }).sort({ 'activityStats.lastActivity': -1 });
};

discordAccountLinkSchema.statics.findInactiveAccounts = function(days = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return this.find({
        'status.isActive': true,
        $or: [
            { 'activityStats.lastActivity': { $lt: cutoffDate } },
            { 'activityStats.lastActivity': { $exists: false } }
        ]
    }).sort({ 'activityStats.lastActivity': 1 });
};

discordAccountLinkSchema.statics.findSuspiciousAccounts = function() {
    return this.find({
        'status.isActive': true,
        'securityData.suspiciousActivityFlags.0': { $exists: true }
    }).sort({ 'securityData.suspiciousActivityFlags.timestamp': -1 });
};

module.exports = mongoose.model('DiscordAccountLink', discordAccountLinkSchema);