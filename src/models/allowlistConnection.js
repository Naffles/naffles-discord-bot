const mongoose = require('mongoose');

const allowlistConnectionSchema = new mongoose.Schema({
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
        required: true
    },
    messageId: {
        type: String,
        required: true,
        unique: true
    },
    connectedBy: {
        type: String,
        required: true
    },
    connectedAt: {
        type: Date,
        default: Date.now
    },
    allowlistData: {
        title: String,
        description: String,
        prize: String,
        winnerCount: Number,
        entryPrice: String,
        endTime: Date,
        status: String
    },
    interactions: {
        views: {
            type: Number,
            default: 0
        },
        entries: {
            type: Number,
            default: 0
        },
        lastInteraction: Date
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Indexes
allowlistConnectionSchema.index({ allowlistId: 1, guildId: 1 });
allowlistConnectionSchema.index({ messageId: 1 });
allowlistConnectionSchema.index({ connectedBy: 1 });
allowlistConnectionSchema.index({ isActive: 1 });
allowlistConnectionSchema.index({ 'allowlistData.status': 1 });

// Methods
allowlistConnectionSchema.methods.incrementViews = function() {
    this.interactions.views += 1;
    this.interactions.lastInteraction = new Date();
    return this.save();
};

allowlistConnectionSchema.methods.incrementEntries = function() {
    this.interactions.entries += 1;
    this.interactions.lastInteraction = new Date();
    return this.save();
};

allowlistConnectionSchema.methods.updateAllowlistData = function(allowlistData) {
    this.allowlistData = { ...this.allowlistData, ...allowlistData };
    return this.save();
};

allowlistConnectionSchema.methods.deactivate = function() {
    this.isActive = false;
    return this.save();
};

// Static methods
allowlistConnectionSchema.statics.findByAllowlist = function(allowlistId) {
    return this.find({ allowlistId, isActive: true });
};

allowlistConnectionSchema.statics.findByGuild = function(guildId) {
    return this.find({ guildId, isActive: true }).sort({ connectedAt: -1 });
};

allowlistConnectionSchema.statics.findByMessage = function(messageId) {
    return this.findOne({ messageId, isActive: true });
};

allowlistConnectionSchema.statics.findConnection = function(allowlistId, guildId) {
    return this.findOne({ allowlistId, guildId, isActive: true });
};

allowlistConnectionSchema.statics.getActiveCount = function() {
    return this.countDocuments({ isActive: true });
};

allowlistConnectionSchema.statics.getEntryStats = function(guildId) {
    return this.aggregate([
        { $match: { guildId, isActive: true } },
        {
            $group: {
                _id: null,
                totalAllowlists: { $sum: 1 },
                totalViews: { $sum: '$interactions.views' },
                totalEntries: { $sum: '$interactions.entries' },
                avgViewsPerAllowlist: { $avg: '$interactions.views' },
                avgEntriesPerAllowlist: { $avg: '$interactions.entries' }
            }
        }
    ]);
};

allowlistConnectionSchema.statics.findByStatus = function(status) {
    return this.find({ 
        'allowlistData.status': status, 
        isActive: true 
    }).sort({ connectedAt: -1 });
};

module.exports = mongoose.model('AllowlistConnection', allowlistConnectionSchema);