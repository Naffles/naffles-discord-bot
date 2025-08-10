const mongoose = require('mongoose');

const accountLinkSchema = new mongoose.Schema({
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
    discordUsername: {
        type: String,
        required: true
    },
    discordDiscriminator: {
        type: String,
        default: null
    },
    discordAvatar: {
        type: String,
        default: null
    },
    nafflesUsername: {
        type: String,
        required: true
    },
    linkMethod: {
        type: String,
        enum: ['oauth', 'manual', 'verification_code'],
        default: 'oauth'
    },
    linkedAt: {
        type: Date,
        default: Date.now
    },
    lastVerified: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    },
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
        }
    },
    metadata: {
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
        lastActivity: Date,
        ipAddress: String,
        userAgent: String
    }
}, {
    timestamps: true
});

// Indexes
accountLinkSchema.index({ discordId: 1, nafflesUserId: 1 });
accountLinkSchema.index({ nafflesUserId: 1 });
accountLinkSchema.index({ isActive: 1 });
accountLinkSchema.index({ linkedAt: 1 });

// Methods
accountLinkSchema.methods.updateActivity = function() {
    this.metadata.lastActivity = new Date();
    return this.save();
};

accountLinkSchema.methods.incrementTaskCompletion = function(points = 0) {
    this.metadata.totalTasksCompleted += 1;
    this.metadata.totalPointsEarned += points;
    this.metadata.lastActivity = new Date();
    return this.save();
};

accountLinkSchema.methods.incrementAllowlistEntry = function() {
    this.metadata.totalAllowlistsEntered += 1;
    this.metadata.lastActivity = new Date();
    return this.save();
};

accountLinkSchema.methods.updateDiscordInfo = function(discordUser) {
    this.discordUsername = discordUser.username;
    this.discordDiscriminator = discordUser.discriminator;
    this.discordAvatar = discordUser.avatar;
    this.lastVerified = new Date();
    return this.save();
};

accountLinkSchema.methods.deactivate = function() {
    this.isActive = false;
    return this.save();
};

// Static methods
accountLinkSchema.statics.findByDiscord = function(discordId) {
    return this.findOne({ discordId, isActive: true });
};

accountLinkSchema.statics.findByNaffles = function(nafflesUserId) {
    return this.findOne({ nafflesUserId, isActive: true });
};

accountLinkSchema.statics.getActiveCount = function() {
    return this.countDocuments({ isActive: true });
};

accountLinkSchema.statics.getActivityStats = function() {
    return this.aggregate([
        { $match: { isActive: true } },
        {
            $group: {
                _id: null,
                totalLinks: { $sum: 1 },
                totalTasksCompleted: { $sum: '$metadata.totalTasksCompleted' },
                totalPointsEarned: { $sum: '$metadata.totalPointsEarned' },
                totalAllowlistsEntered: { $sum: '$metadata.totalAllowlistsEntered' },
                avgTasksPerUser: { $avg: '$metadata.totalTasksCompleted' },
                avgPointsPerUser: { $avg: '$metadata.totalPointsEarned' }
            }
        }
    ]);
};

accountLinkSchema.statics.findRecentlyActive = function(days = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return this.find({
        isActive: true,
        'metadata.lastActivity': { $gte: cutoffDate }
    }).sort({ 'metadata.lastActivity': -1 });
};

module.exports = mongoose.model('AccountLink', accountLinkSchema);